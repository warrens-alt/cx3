import { validTimestampSql } from '../../bigquery/integrity';
import { configuredSourceTable } from './warehouse';
import { buildFilterClause } from './scope';
import type { OffernetQueryParams } from './types';

/** A lead is counted once after scope selection; repeated HLC counters are cumulative, not events. */
export function operationalLeadCtes(params: OffernetQueryParams, byVendor = false, table = configuredSourceTable(params.clientId, 'leads')): string {
  const { whereSql } = buildFilterClause(params);
  return `operational_raw AS (
    SELECT l.lead_id,
      ${validTimestampSql('l.fetched')} AS fetched_ts,
      COALESCE(hlc.vendor, 'Unknown') AS vendor,
      COALESCE(l.offershop_source, '') AS source,
      COALESCE(l.offershop_grade, '') AS grade,
      COALESCE(l.offershop_color_vetting, 'Unvetted') AS vetting,
      l.valid_idno, l.phone_valid,
      ${validTimestampSql('hlc.attempted_to_deliver')} AS attempted_ts,
      ${validTimestampSql('hlc.delivered')} AS delivered_ts,
      ${validTimestampSql('hlc.first_call_date')} AS first_call_ts,
      ${validTimestampSql('hlc.sale')} AS sale_ts,
      ${validTimestampSql('hlc.activated')} AS activation_ts,
      CASE WHEN SAFE_CAST(hlc.total_calls AS INT64) >= 0 THEN SAFE_CAST(hlc.total_calls AS INT64) END AS total_calls,
      CASE WHEN SAFE_CAST(hlc.rpc AS INT64) >= 0 THEN SAFE_CAST(hlc.rpc AS INT64) > 0 END AS is_rpc,
      NULLIF(TRIM(hlc.last_dialer_status), '') AS last_dialer_status,
      SAFE_CAST(hlc.revenue_generated AS FLOAT64) AS revenue
    FROM ${table} l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    ${whereSql}
  ), operational_leads AS (
    ${operationalLeadSelectSql('operational_raw', byVendor)}
  )`;
}

/** Reuse normalization after raw cohort selection; grouping before selection can mix repeated lead IDs across periods. */
export function operationalLeadSelectSql(rawCteName: 'operational_raw' | 'current_operational_raw', byVendor = false): string {
  return `    SELECT lead_id,
      MIN(fetched_ts) AS fetched_ts,
      ${byVendor ? 'vendor' : "ARRAY_AGG(vendor ORDER BY IF(delivered_ts IS NULL, 1, 0), delivered_ts, vendor LIMIT 1)[SAFE_OFFSET(0)] AS vendor"},
      ANY_VALUE(source) AS source, ANY_VALUE(grade) AS grade, ANY_VALUE(vetting) AS vetting,
      LOGICAL_OR(LOWER(TRIM(CAST(valid_idno AS STRING))) IN ('0', 'false') OR LOWER(TRIM(CAST(phone_valid AS STRING))) IN ('0', 'false')) AS is_invalid,
      MIN(attempted_ts) AS attempted_ts,
      MIN(delivered_ts) AS delivered_ts,
      MIN(first_call_ts) AS first_call_ts,
      MIN(sale_ts) AS sale_ts,
      MIN(activation_ts) AS activation_ts,
      COUNTIF(delivered_ts IS NOT NULL) > 0 AS is_delivered,
      COUNTIF(first_call_ts IS NOT NULL) > 0 AS is_dialled,
      CASE WHEN COUNTIF(is_rpc) > 0 THEN TRUE WHEN COUNTIF(is_rpc IS NULL) > 0 THEN NULL ELSE FALSE END AS is_rpc,
      COUNTIF(sale_ts IS NOT NULL) > 0 AS is_sale,
      COUNTIF(activation_ts IS NOT NULL) > 0 AS is_activated,
      MAX(total_calls) AS recorded_call_count,
      COUNTIF(first_call_ts IS NOT NULL AND last_dialer_status IS NOT NULL) > 0 AS has_disposition,
      SUM(revenue) AS revenue,
      MAX(revenue) AS max_recorded_revenue
    FROM ${rawCteName}
    WHERE lead_id IS NOT NULL
    GROUP BY lead_id${byVendor ? ', vendor' : ''}`;
}

/** An empty denominator is unavailable, while a measured zero numerator remains zero. */
export function metricPercent(numerator: number, denominator: number, decimals = 1): number | null {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? Number(((numerator / denominator) * 100).toFixed(decimals))
    : null;
}
