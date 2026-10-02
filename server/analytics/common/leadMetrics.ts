import { validationSql } from '../../../contracts/validation';
import { getClientConfig } from '../../bigquery/config';
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
      SAFE_CAST(hlc.revenue_generated AS NUMERIC) AS revenue,
      NULLIF(TRIM(CAST(hlc.transaction_id AS STRING)), '') AS revenue_transaction_id,
      NULLIF(TRIM(CAST(hlc.vendor AS STRING)), '') AS revenue_vendor,
      UPPER(NULLIF(TRIM(CAST(hlc.currency AS STRING)), '')) AS revenue_currency,
      hlc IS NOT NULL AS has_hlc_record
    FROM ${table} l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    ${whereSql}
  ), operational_leads AS (
    ${operationalLeadSelectSql('operational_raw', byVendor, getClientConfig(params.clientId).currency)}
  )`;
}

/** Reuse normalization after raw cohort selection; grouping before selection can mix repeated lead IDs across periods. */
export function operationalLeadSelectSql(rawCteName: 'operational_raw' | 'current_operational_raw', byVendor = false, currency = 'ZAR'): string {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('A configured ISO currency is required for operational revenue.');
  const keys = `lead_id${byVendor ? ', vendor' : ''}`;
  return `WITH lead_rollup AS (SELECT lead_id,
      MIN(fetched_ts) AS fetched_ts,
      ${byVendor ? 'vendor' : "ARRAY_AGG(vendor ORDER BY IF(delivered_ts IS NULL, 1, 0), delivered_ts, vendor LIMIT 1)[SAFE_OFFSET(0)] AS vendor"},
      ANY_VALUE(source) AS source, ANY_VALUE(grade) AS grade, ANY_VALUE(vetting) AS vetting,
      LOGICAL_OR((${validationSql('valid_idno')}) IS FALSE OR (${validationSql('phone_valid')}) IS FALSE) AS is_invalid,
      MIN(attempted_ts) AS attempted_ts,
      MIN(delivered_ts) AS delivered_ts,
      MIN(first_call_ts) AS first_call_ts,
      MIN(sale_ts) AS sale_ts,
      MIN(activation_ts) AS activation_ts,
      COUNTIF(delivered_ts IS NOT NULL) > 0 AS has_recorded_delivery,
      COUNTIF(first_call_ts IS NOT NULL) > 0 AS has_recorded_first_dial,
      CASE WHEN COUNTIF(is_rpc) > 0 THEN TRUE WHEN COUNTIF(is_rpc IS NULL) > 0 THEN NULL ELSE FALSE END AS is_rpc,
      COUNTIF(sale_ts IS NOT NULL) > 0 AS has_recorded_sale,
      COUNTIF(sale_ts IS NOT NULL) > 0 AS is_sale,
      COUNTIF(activation_ts IS NOT NULL) > 0 AS has_recorded_activation,
      COUNTIF(activation_ts IS NOT NULL) > 0 AS is_activated,
      MAX(total_calls) AS recorded_call_count,
      COUNTIF(first_call_ts IS NOT NULL AND last_dialer_status IS NOT NULL) > 0 AS has_disposition
    FROM ${rawCteName}
    WHERE lead_id IS NOT NULL
    GROUP BY lead_id${byVendor ? ', vendor' : ''}
    ), lifecycle_qualified AS (
      SELECT lead_rollup.*, ${operationalLifecycleStateSql()} FROM lead_rollup
    ), financial_keys AS (
      SELECT lead_id, vendor, revenue_vendor, revenue_transaction_id,
        COUNT(*) AS source_rows,
        COUNT(DISTINCT TO_JSON_STRING(STRUCT(revenue AS amount, revenue_currency AS currency))) AS value_variants,
        ANY_VALUE(revenue) AS amount, ANY_VALUE(revenue_currency) AS currency
      FROM ${rawCteName} WHERE lead_id IS NOT NULL AND has_hlc_record
      GROUP BY lead_id, vendor, revenue_vendor, revenue_transaction_id
    ), financial_assessed AS (
      SELECT *, revenue_vendor IS NOT NULL AND revenue_transaction_id IS NOT NULL
        AND value_variants = 1 AND amount IS NOT NULL AND currency = '${currency}' AS eligible
      FROM financial_keys
    ), financial_totals AS (
      SELECT ${keys},
        IF(COUNTIF(eligible IS NOT TRUE) > 0, NULL, SUM(amount)) AS revenue,
        SUM(IF(eligible, amount, NULL)) AS known_revenue_subtotal,
        COUNTIF(eligible IS NOT TRUE) AS incomplete_revenue_keys,
        COUNTIF(value_variants > 1) AS conflicting_revenue_keys,
        SUM(IF(eligible, source_rows - 1, 0)) AS revenue_duplicate_rows_collapsed
      FROM financial_assessed GROUP BY ${keys}
    ) SELECT lifecycle_qualified.*, financial_totals.* EXCEPT(${keys})
      FROM lifecycle_qualified LEFT JOIN financial_totals USING (${keys})`;

}

/** Qualification never rewrites the recorded timestamps, outcome evidence or raw tri-state RPC.
 * Missing predecessors cannot establish chronology. Earliest recorded events are assessed as recorded,
 * rather than selecting a later convenient event to hide an anomaly. Sales and activations remain
 * independent source-recorded populations; only transition intersections use qualified outcomes.
 */
export function operationalLifecycleStateSql(): string {
  const delivered = '(delivered_ts >= fetched_ts) IS TRUE';
  const dialled = '(delivered_ts >= fetched_ts AND first_call_ts >= fetched_ts AND first_call_ts >= delivered_ts) IS TRUE';
  const sale = '(sale_ts >= fetched_ts) IS TRUE';
  const activated = '(sale_ts >= fetched_ts AND activation_ts >= sale_ts) IS TRUE';
  return `${delivered} AS is_delivered,
      ${dialled} AS is_dialled,
      (${dialled} AND is_rpc IS TRUE) AS is_qualified_rpc,
      ${sale} AS is_qualified_sale,
      ${activated} AS is_qualified_activation,
      (${dialled} AND is_rpc IS TRUE AND ${sale} AND (sale_ts >= first_call_ts) IS TRUE) AS has_qualified_rpc_sale,
      (delivered_ts < fetched_ts) IS TRUE AS delivery_before_capture,
      (first_call_ts < fetched_ts) IS TRUE AS first_dial_before_capture,
      (first_call_ts < delivered_ts) IS TRUE AS first_dial_before_delivery,
      (sale_ts < fetched_ts) IS TRUE AS sale_before_capture,
      (activation_ts < sale_ts) IS TRUE AS activation_before_sale`;
}

export const OPERATIONAL_LIFECYCLE_POLICY = 'cx.lifecycle.3.0.0: capture cohort; delivery requires delivery >= capture; dial requires qualified delivery and first dial >= delivery/capture; RPC requires qualified dial plus positive recorded evidence. Sales and activations remain independent recorded timestamps. Funnel intersections require ordered predecessors. Missing predecessors do not establish qualification.';

/** An empty denominator is unavailable, while a measured zero numerator remains zero. */
export function metricPercent(numerator: number, denominator: number, decimals = 1): number | null {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? Number(((numerator / denominator) * 100).toFixed(decimals))
    : null;
}

/** A complete total cannot silently omit an incomplete lead/key. Real zero remains zero. */
export function completeRevenueSumSql(expression = 'revenue'): string {
  return `CASE WHEN COUNTIF(${expression} IS NULL) > 0 THEN NULL ELSE SUM(${expression}) END`;
}
export const OPERATIONAL_REVENUE_POLICY = '2026-09-29.1: recorded NUMERIC amounts grouped by lead/vendor/transaction; identical amount+currency duplicates collapse once; unresolved keys, conflicting values, missing amounts or currencies withhold the complete total. Separate known subtotal is not cash or verified billability.';
