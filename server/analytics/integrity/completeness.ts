import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';
import { validTimestampSql } from '../../bigquery/integrity';
import { getSourceObservability } from './sourceObservability';

// 9. DATA INTEGRITY (DATA HEALTH)
export async function getDataIntegrityAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH lead_quality AS (
      SELECT l.lead_id,
        LOGICAL_OR(NULLIF(TRIM(l.standardised_idno), '') IS NULL OR LOWER(TRIM(l.valid_idno)) IN ('0', 'false')) AS invalid_id,
        LOGICAL_OR(NULLIF(TRIM(l.standardised_mobile), '') IS NULL OR LOWER(TRIM(l.phone_valid)) IN ('0', 'false')) AS invalid_phone,
        LOGICAL_OR(l.valid_lead IS FALSE) AS invalid_lead,
        LOGICAL_OR(l.valid_lead IS NULL) AS unrecorded_valid_lead,
        LOGICAL_OR(l.valid_idno IS NULL OR LOWER(TRIM(l.valid_idno)) NOT IN ('true', 'false', '1', '0')) AS unrecorded_valid_id,
        LOGICAL_OR(l.phone_valid IS NULL OR LOWER(TRIM(l.phone_valid)) NOT IN ('true', 'false', '1', '0')) AS unrecorded_valid_phone,
        COUNTIF(NULLIF(TRIM(hlc.vendor), '') IS NOT NULL) = 0 AS unassigned_vendor,
        COUNTIF(${validTimestampSql('hlc.first_call_date')} IS NOT NULL) > 0 AS is_dialled,
        COUNTIF(${validTimestampSql('hlc.first_call_date')} IS NOT NULL AND NULLIF(TRIM(hlc.last_dialer_status), '') IS NOT NULL) > 0 AS has_disposition,
        LOGICAL_OR(l.consumer_id IS NULL OR l.consumer_id = 0) AS unmatched_consumer
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
      GROUP BY l.lead_id
    )
    SELECT COUNT(*) AS total_leads,
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

  const sourceObservability = await getSourceObservability({ clientId: params.clientId });

  return {
    overallHealthScore: null,
    healthGrade: 'NOT_VERIFIED',
    validationStatus: 'NOT_VERIFIED',
    reason: 'Observed discrepancy counts are shown without an invented enterprise health score. Thresholds require approved data-quality contracts.',
    checks,
    totalRecordsAudited: total,
    sources: sourceObservability.sources
  };
}
