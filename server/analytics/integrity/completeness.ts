import { validationSql } from '../../../contracts/validation';
import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';
import { validTimestampSql } from '../../bigquery/integrity';
import { getMarketingSpendIntegrity } from '../common/marketing';
import { getSourceObservability } from './sourceObservability';

// 9. DATA INTEGRITY (DATA HEALTH)
export async function getDataIntegrityAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const sourceScope = buildFilterClause(params, 'l', '');
  const query = `
    WITH scoped_source AS (SELECT l.* FROM ${configuredSourceTable(params.clientId, 'leads')} l ${sourceScope.whereSql}), lead_quality AS (
      SELECT l.lead_id,
        LOGICAL_OR(NULLIF(TRIM(l.offershop_source), '') IS NULL) AS missing_source,
        LOGICAL_OR(NULLIF(TRIM(l.offershop_grade), '') IS NULL) AS missing_grade,
        LOGICAL_OR(
          (NULLIF(TRIM(CAST(hlc.delivered AS STRING)), '') IS NOT NULL AND ${validTimestampSql('hlc.delivered')} IS NULL)
          OR (NULLIF(TRIM(CAST(hlc.first_call_date AS STRING)), '') IS NOT NULL AND ${validTimestampSql('hlc.first_call_date')} IS NULL)
          OR (NULLIF(TRIM(CAST(hlc.sale AS STRING)), '') IS NOT NULL AND ${validTimestampSql('hlc.sale')} IS NULL)
          OR (NULLIF(TRIM(CAST(hlc.activated AS STRING)), '') IS NOT NULL AND ${validTimestampSql('hlc.activated')} IS NULL)
        ) AS invalid_lifecycle_timestamp,
        LOGICAL_OR(${validTimestampSql('hlc.delivered')} < ${validTimestampSql('l.fetched')}
          OR ${validTimestampSql('hlc.first_call_date')} < ${validTimestampSql('hlc.delivered')}
          OR ${validTimestampSql('hlc.activated')} < ${validTimestampSql('hlc.sale')}) AS out_of_order_timestamps,
        LOGICAL_OR(NULLIF(TRIM(l.standardised_idno), '') IS NULL OR (${validationSql('l.valid_idno')}) IS FALSE) AS invalid_id,
        LOGICAL_OR(NULLIF(TRIM(l.standardised_mobile), '') IS NULL OR (${validationSql('l.phone_valid')}) IS FALSE) AS invalid_phone,
        LOGICAL_OR(l.valid_lead IS FALSE) AS invalid_lead,
        LOGICAL_OR(l.valid_lead IS NULL) AS unrecorded_valid_lead,
        LOGICAL_OR((${validationSql('l.valid_idno')}) IS NULL) AS unrecorded_valid_id,
        LOGICAL_OR((${validationSql('l.phone_valid')}) IS NULL) AS unrecorded_valid_phone,
        COUNTIF(NULLIF(TRIM(hlc.vendor), '') IS NOT NULL) = 0 AS unassigned_vendor,
        COUNTIF(${validTimestampSql('hlc.first_call_date')} IS NOT NULL) > 0 AS is_dialled,
        COUNTIF(${validTimestampSql('hlc.first_call_date')} IS NOT NULL AND NULLIF(TRIM(hlc.last_dialer_status), '') IS NOT NULL) > 0 AS has_disposition,
        LOGICAL_OR(l.consumer_id IS NULL OR l.consumer_id = 0) AS unmatched_consumer
      FROM scoped_source l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
      GROUP BY l.lead_id
    )
    SELECT COUNT(*) AS total_leads,
      (SELECT COUNT(*) FROM scoped_source) AS source_row_count,
      (SELECT COUNTIF(lead_id IS NULL OR TRIM(CAST(lead_id AS STRING)) = '') FROM scoped_source) AS missing_lead_ids,
      (SELECT COUNT(*) - COUNT(DISTINCT lead_id) - COUNTIF(lead_id IS NULL) FROM scoped_source) AS duplicate_lead_id_rows,
      COUNTIF(missing_source) AS missing_source,
      COUNTIF(missing_grade) AS missing_grade,
      COUNTIF(invalid_lifecycle_timestamp) AS invalid_lifecycle_timestamps,
      COUNTIF(out_of_order_timestamps) AS out_of_order_timestamps,
      COUNTIF(invalid_id) AS invalid_id_numbers,
      COUNTIF(invalid_phone) AS invalid_mobile_numbers,
      COUNTIF(invalid_lead) AS invalid_lead_flags,
      COUNTIF(unrecorded_valid_lead) AS unrecorded_valid_lead_flags,
      COUNTIF(unrecorded_valid_id) + COUNTIF(unrecorded_valid_phone) AS unrecorded_validation_flags,
      COUNTIF(unassigned_vendor) AS unassigned_vendor_leads,
      COUNTIF(is_dialled AND NOT has_disposition) AS missing_dispositions,
      COUNTIF(unmatched_consumer) AS unmatched_consumer_ids
    FROM lead_quality
    WHERE lead_id IS NOT NULL
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const d = rows[0] || {};
  const total = Number(d.total_leads || 0);

  const observedCheck = (checkName: string, category: string, discrepancyCount: number | null, detail: string) => ({
    checkName,
    category,
    status: discrepancyCount === null ? 'UNAVAILABLE' as const : discrepancyCount === 0 ? 'HEALTHY' as const : 'WARNING' as const,
    evidence: discrepancyCount === null ? 'UNAVAILABLE' : 'OBSERVED',
    discrepancyCount,
    detail
  });

  const invalidValidation = Number(d.invalid_id_numbers || 0) + Number(d.invalid_mobile_numbers || 0);
  const checks = [
    observedCheck('Missing Source', 'Acquisition', Number(d.missing_source || 0), 'Distinct scoped leads with a null or blank source.'),
    observedCheck('Missing Grade', 'Lead Quality', Number(d.missing_grade || 0), 'Distinct scoped leads with a null or blank grade.'),
    observedCheck('Invalid / Sentinel Lifecycle Timestamps', 'Temporal Integrity', Number(d.invalid_lifecycle_timestamps || 0), 'Distinct capture-cohort leads with a nonblank invalid, 1900 or 1970 delivery, first-dial, sale or activation value. Sentinel values are not counted as successful events.'),
    observedCheck('Out-of-order Lifecycle Timestamps', 'Temporal Integrity', Number(d.out_of_order_timestamps || 0), 'Delivery before capture, first dial before delivery, or activation before sale.'),
    observedCheck('Missing Lead IDs', 'Lead Grain', Number(d.missing_lead_ids || 0), 'Physical scoped source rows with null or blank lead identifiers; these cannot safely be investigated as unique leads.'),
    observedCheck('Duplicate Lead ID Rows', 'Lead Grain', Number(d.duplicate_lead_id_rows || 0), 'Extra physical source rows sharing a non-null lead ID, measured before expanding nested vendor records. Repeated vendor lifecycle entries are not counted as duplicate leads.'),
    observedCheck('Invalid Lead Flags', 'Lead Vetting', Number(d.invalid_lead_flags || 0), 'Distinct leads explicitly marked false by the BOOLEAN valid_lead field.'),
    observedCheck('Unrecorded Validation Flags', 'Lead Vetting', Number(d.unrecorded_validation_flags || 0) + Number(d.unrecorded_valid_lead_flags || 0), 'Missing or unrecognized ID/mobile flags and missing valid_lead booleans remain unknown; they are not converted to false.'),
    observedCheck(
      'Missing Dispositions',
      'Dialler Telephony',
      Number(d.missing_dispositions || 0),
      `${Number(d.missing_dispositions || 0).toLocaleString()} dialled leads have no recorded dialler disposition.`
    ),
    observedCheck(
      'Unmatched Consumer IDs',
      'Data Lineage',
      Number(d.unmatched_consumer_ids || 0),
      `${Number(d.unmatched_consumer_ids || 0).toLocaleString()} lead records have no usable consumer identifier.`
    ),
    observedCheck(
      'Missing / Sentinel Capture Timestamps',
      'Temporal Integrity',
      null,
      'Capture-date coverage cannot be measured inside a capture-date cohort: missing, invalid, 1900 and 1970 timestamps cannot be assigned to its date range.'
    ),
    observedCheck(
      'Unassigned Vendor Records',
      'Routing',
      Number(d.unassigned_vendor_leads || 0),
      `${Number(d.unassigned_vendor_leads || 0).toLocaleString()} distinct leads have no recorded vendor in scope.`
    ),
    observedCheck(
      'ID / Mobile Validation Gaps',
      'Lead Vetting',
      invalidValidation,
      total > 0
        ? `${invalidValidation.toLocaleString()} validation gaps observed across ${total.toLocaleString()} distinct leads.`
        : 'No lead records were available in the selected scope.'
    )
  ];

  const [sourceObservability, marketing] = await Promise.all([
    getSourceObservability({ clientId: params.clientId }),
    getMarketingSpendIntegrity(params).catch(() => null),
  ]);
  checks.push(observedCheck('Marketing Spend Grain', 'Marketing', marketing?.duplicateGrainRows ?? null,
    marketing ? `${marketing.status}: ${marketing.reason} Source: ${marketing.table || 'Unavailable'}; approved spend: ${marketing.spendColumn || 'Unavailable'}; rows: ${marketing.rowCount ?? 'Unavailable'}; distinct grain: ${marketing.distinctGrainCount ?? 'Unavailable'}; missing grain keys: ${marketing.missingGrainRows ?? 'Unavailable'}; missing spend: ${marketing.missingSpendRows ?? 'Unavailable'}.` : 'Marketing grain could not be verified from an approved contract in this scope.'));
  if (marketing && marketing.status !== 'OBSERVED' && marketing.status !== 'VALID') {
    checks[checks.length - 1].status = marketing.status === 'INVALID_GRAIN' ? 'WARNING' : 'UNAVAILABLE';
  }

  return {
    overallHealthScore: null,
    healthGrade: 'NOT_VERIFIED',
    validationStatus: 'NOT_VERIFIED',
    reason: 'Observed discrepancy counts are shown without an invented enterprise health score. Thresholds require approved data-quality contracts.',
    checks,
    totalRecordsAudited: total,
    physicalSourceRows: Number(d.source_row_count || 0),
    sources: sourceObservability.sources
  };
}
