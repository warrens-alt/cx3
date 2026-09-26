import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';
import { getSourceObservability } from './sourceObservability';

// 9. DATA INTEGRITY (DATA HEALTH)
export async function getDataIntegrityAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    SELECT
      COUNT(DISTINCT l.lead_id) AS total_leads,
      COUNTIF(l.fetched LIKE '1900%' OR l.fetched LIKE '1970%' OR l.fetched IS NULL) AS sentinel_fetch_dates,
      COUNTIF(l.standardised_idno IS NULL OR l.valid_idno = '0' OR l.valid_idno = 'false') AS invalid_id_numbers,
      COUNTIF(l.standardised_mobile IS NULL OR l.phone_valid = '0' OR l.phone_valid = 'false') AS invalid_mobile_numbers,
      COUNTIF(hlc.vendor IS NULL OR hlc.vendor = '') AS unassigned_vendor_leads,
      COUNTIF(hlc.delivered IS NOT NULL AND (hlc.last_dialer_status IS NULL OR hlc.last_dialer_status = '')) AS missing_dispositions,
      COUNTIF(l.consumer_id IS NULL OR l.consumer_id = 0) AS unmatched_consumer_ids
    FROM ${configuredSourceTable(params.clientId, 'leads')} l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    ${whereSql}
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const d = rows[0] || {};
  const total = Number(d.total_leads || 0);

  const observedCheck = (checkName: string, category: string, discrepancyCount: number, detail: string) => ({
    checkName,
    category,
    status: discrepancyCount === 0 ? 'HEALTHY' as const : 'WARNING' as const,
    evidence: 'OBSERVED',
    discrepancyCount,
    detail
  });

  const invalidValidation = Number(d.invalid_id_numbers || 0) + Number(d.invalid_mobile_numbers || 0);
  const checks = [
    observedCheck(
      'Missing Dispositions',
      'Dialler Telephony',
      Number(d.missing_dispositions || 0),
      `${Number(d.missing_dispositions || 0).toLocaleString()} delivered records have no recorded dialler disposition.`
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
      Number(d.sentinel_fetch_dates || 0),
      `${Number(d.sentinel_fetch_dates || 0).toLocaleString()} records have missing, 1900, or 1970 capture timestamps.`
    ),
    observedCheck(
      'Unassigned Vendor Records',
      'Routing',
      Number(d.unassigned_vendor_leads || 0),
      `${Number(d.unassigned_vendor_leads || 0).toLocaleString()} expanded HLC records have no vendor value.`
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
