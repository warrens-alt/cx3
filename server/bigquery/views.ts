import type { TenantConfiguration } from './config';
import { tableIdentifier } from './config';
import { vendorScope } from '../analyticsContext';
import { validTimestampSql as ts } from './integrity';

/** Versioned, read-only semantic CTEs. Bind vendorScope().params through the shared client. */
export function getBaseSemanticLayer(client: TenantConfiguration): string {
  const partners = client.semanticMappings.partners || [];
  if (partners.some(p => !/^[a-z0-9_]+$/i.test(p))) throw new Error('Invalid configured routing partner');
  const ror = partners.length ? partners.map(p => `STRUCT('${p.toUpperCase()}' AS partner, ${ts(`l.ror_${p.toLowerCase()}`)} AS timestamp)`).join(',') : `STRUCT(CAST(NULL AS STRING) AS partner, CAST(NULL AS TIMESTAMP) AS timestamp)`;
  // The existing source timestamp interpretation is retained (UTC). Confirm source timezone before SLA sign-off.
  const vendor = vendorScope('vendor');
  const hlcFields: Record<string, string> = {
    vendor: 'vendor', transaction_id: 'transaction_id', status: 'latest_dialer_status',
    attempted_to_deliver: 'attempted_delivery_timestamp', delivered: 'delivery_timestamp',
    first_call_date: 'first_call_timestamp', last_call_date: 'last_call_timestamp',
    last_dialer_status: 'latest_dialer_status', total_calls_length_in_sec: 'total_call_duration_seconds',
    total_calls: 'total_calls', rpc: 'rpc', sale: 'sale', activated: 'activation', revenue_generated: 'revenue', currency: 'currency',
  };
  const projections = Array.from({ length: 10 }, (_, i) => Object.entries(hlcFields).map(([suffix, field]) => `MAX(IF(hlc_record_number = ${i + 1}, ${field}, NULL)) AS hlc_${i + 1}_${suffix}`).join(',')).join(',');
  if (client.dataSourceMode === 'shared') throw new Error('Shared-table tenants require an explicit, independently tested row-security implementation');
  const calls = client.semanticMappings.tables.calls;
  const activations = client.semanticMappings.tables.activations;
  return `WITH base_leads AS (
    SELECT l.lead_id, l.consumer_id, IFNULL(l.offershop_source, 'Unknown') AS source,
      IFNULL(l.offernet_medium, 'Unknown') AS medium, l.fetched, SAFE_CAST(l.valid_lead AS BOOL) AS valid_lead,
      ${ts('l.fetched')} AS capture_timestamp, DATE(${ts('l.fetched')}) AS capture_date,
      ${ts('l.fetched')} IS NULL AS sentinel_capture,
      (LOWER(l.offershop_source) LIKE '%revet%' OR LOWER(l.offershop_source) LIKE '%re-vet%') AS is_revetted,
      SAFE_CAST(l.valid_idno AS BOOL) AS valid_idno, SAFE_CAST(l.phone_valid AS BOOL) AS phone_valid,
      ${ts('l.standardised_idno')} AS standardised_idno_ts, ${ts('l.standardised_mobile')} AS standardised_mobile_ts,
      l.offershop_grade AS grade, SPLIT(l.offershop_color_vetting, ',')[SAFE_OFFSET(0)] AS vetting,
      ${ts('l.hospital_applied_date')} AS hospital_applied_date, l.hospital_applied,
      (SAFE_CAST(l.hospital_applied AS BOOL) IS TRUE AND ${ts('l.hospital_applied_date')} IS NULL)
        OR (SAFE_CAST(l.hospital_applied AS BOOL) IS FALSE AND ${ts('l.hospital_applied_date')} IS NOT NULL) AS hospital_applied_inconsistent,
      ARRAY(SELECT AS STRUCT partner, timestamp FROM UNNEST([${ror}]) WHERE timestamp IS NOT NULL) AS valid_ror_events,
      l.hlc_details
    FROM ${tableIdentifier(client.semanticMappings.tables.leads)} l
  ), unpacked_transactions AS (
    SELECT l.* EXCEPT(hlc_details), idx + 1 AS hlc_record_number, hlc.vendor AS hlc_vendor,
      CAST(hlc.transaction_id AS STRING) AS hlc_transaction_id, hlc.status AS hlc_status,
      CASE
        WHEN REGEXP_CONTAINS(LOWER(hlc.status), r'declin|reject|fail|cancel') THEN 'Declined'
        WHEN REGEXP_CONTAINS(LOWER(hlc.status), r'duplicat|exist') THEN 'Duplicate'
        WHEN REGEXP_CONTAINS(LOWER(hlc.status), r'pend|process|wait') THEN 'Pending'
        WHEN REGEXP_CONTAINS(LOWER(hlc.status), r'activat') THEN 'Activation'
        WHEN REGEXP_CONTAINS(LOWER(hlc.status), r'approv|accept|success') THEN 'Approved'
        WHEN REGEXP_CONTAINS(LOWER(hlc.status), r'vet|qual|score') THEN 'Quality/Vetting' ELSE 'Other' END AS normalised_status_family,
      ${ts('hlc.attempted_to_deliver')} AS attempted_delivery_timestamp,
      ${ts('hlc.delivered')} AS delivery_timestamp,
      ${ts('hlc.expected_first_dial')} AS expected_first_dial_timestamp,
      SAFE_CAST(hlc.new_dialer_lead AS INT64) AS new_dialer_lead,
      ${ts('hlc.first_call_date')} AS hlc_first_call, ${ts('hlc.last_call_date')} AS hlc_last_call,
      hlc.last_dialer_status, SAFE_CAST(hlc.last_call_length_in_sec AS INT64) AS hlc_last_call_duration,
      SAFE_CAST(hlc.total_calls_length_in_sec AS INT64) AS hlc_total_call_duration,
      SAFE_CAST(hlc.total_calls AS INT64) AS hlc_total_calls, SAFE_CAST(hlc.rpc AS INT64) > 0 AS hlc_rpc,
      ${ts('hlc.sale')} AS sale_timestamp, ${ts('hlc.activated')} AS activation_timestamp,
      SAFE_CAST(hlc.revenue_generated AS FLOAT64) AS hlc_revenue_generated
    FROM base_leads l LEFT JOIN UNNEST(l.hlc_details) hlc WITH OFFSET idx
  ), ranked_transactions AS (
    SELECT t.*,
      ROW_NUMBER() OVER (PARTITION BY lead_id, hlc_vendor ORDER BY hlc_record_number, hlc_transaction_id) AS vendor_row_number,
      COUNT(*) OVER (PARTITION BY lead_id, hlc_vendor) AS vendor_row_count,
      MAX(hlc_total_calls) OVER (PARTITION BY lead_id, hlc_vendor) AS vendor_hlc_calls,
      MAX(hlc_total_call_duration) OVER (PARTITION BY lead_id, hlc_vendor) AS vendor_hlc_duration,
      ROW_NUMBER() OVER (PARTITION BY lead_id, hlc_vendor, COALESCE(NULLIF(hlc_transaction_id, ''), CONCAT('hlc-row:', CAST(hlc_record_number AS STRING))) ORDER BY
        COALESCE(hlc_last_call, activation_timestamp, sale_timestamp, delivery_timestamp, capture_timestamp) DESC,
        hlc_record_number DESC) AS transaction_rank
    FROM unpacked_transactions t
  ), transaction_references AS (
    SELECT hlc_transaction_id, COUNT(DISTINCT TO_JSON_STRING(STRUCT(lead_id, hlc_vendor))) AS reference_count
    FROM unpacked_transactions WHERE NULLIF(hlc_transaction_id, '') IS NOT NULL GROUP BY hlc_transaction_id
  ), vicidial_summary AS (
    ${calls ? `SELECT CAST(dialer_lead_id AS STRING) AS dialer_lead_id, vendor,
      MIN(${ts('call_start_date')}) AS first_call_timestamp, MAX(${ts('call_end_date')}) AS last_call_timestamp,
      SUM(SAFE_CAST(length_in_sec AS INT64)) AS total_duration, COUNT(*) AS total_calls,
      LOGICAL_OR(SAFE_CAST(is_rpc AS BOOL)) AS rpc, LOGICAL_OR(SAFE_CAST(is_sale AS BOOL)) AS sale,
      MIN(IF(SAFE_CAST(is_sale AS BOOL), ${ts('call_start_date')}, NULL)) AS first_sale_timestamp,
      MIN(IF(SAFE_CAST(is_rpc AS BOOL), ${ts('call_start_date')}, NULL)) AS first_rpc_timestamp
      FROM ${tableIdentifier(calls)} GROUP BY dialer_lead_id, vendor` : `SELECT CAST(NULL AS STRING) AS dialer_lead_id, CAST(NULL AS STRING) AS vendor, CAST(NULL AS TIMESTAMP) AS first_call_timestamp, CAST(NULL AS TIMESTAMP) AS last_call_timestamp, CAST(NULL AS INT64) AS total_duration, CAST(NULL AS INT64) AS total_calls, CAST(NULL AS BOOL) AS rpc, CAST(NULL AS BOOL) AS sale, CAST(NULL AS TIMESTAMP) AS first_sale_timestamp, CAST(NULL AS TIMESTAMP) AS first_rpc_timestamp WHERE FALSE`}
  ), activations AS (
    ${activations ? `SELECT CAST(transaction_id AS STRING) AS transaction_id,
      MIN(${ts('date_created')}) AS activation_date, MAX(SAFE_CAST(expected_ontact_revenue AS FLOAT64)) AS revenue
      FROM ${tableIdentifier(activations)} GROUP BY transaction_id` : `SELECT CAST(NULL AS STRING) AS transaction_id, CAST(NULL AS TIMESTAMP) AS activation_date, CAST(NULL AS FLOAT64) AS revenue WHERE FALSE`}
  ), transaction_evidence AS (
    SELECT '${client.id}' AS client_id, t.lead_id, t.consumer_id, t.hlc_record_number,
      t.hlc_vendor AS vendor, t.hlc_transaction_id AS transaction_id, t.capture_timestamp, t.capture_date,
      t.is_revetted, ARRAY_LENGTH(t.valid_ror_events) AS routing_depth, t.source, t.medium,
      t.valid_lead, t.valid_idno, t.phone_valid, t.grade, t.vetting, t.hospital_applied_inconsistent,
      t.standardised_idno_ts, t.standardised_mobile_ts, t.attempted_delivery_timestamp, t.delivery_timestamp,
      t.expected_first_dial_timestamp, t.new_dialer_lead,
      COALESCE(t.sale_timestamp, IF(t.vendor_row_count = 1, v.first_sale_timestamp, NULL)) AS sale_timestamp,
      (t.sale_timestamp IS NOT NULL OR (t.vendor_row_count = 1 AND IFNULL(v.sale, FALSE))) AS sale,
      IFNULL(v.sale, FALSE) AS vendor_sale_evidence, v.first_sale_timestamp AS vendor_sale_timestamp,
      IFNULL(v.rpc, FALSE) OR IFNULL(t.hlc_rpc, FALSE) AS rpc, v.first_rpc_timestamp AS rpc_timestamp,
      COALESCE(IF(t.vendor_row_count = 1, v.first_call_timestamp, NULL), t.hlc_first_call) AS first_call_timestamp,
      COALESCE(IF(t.vendor_row_count = 1, v.last_call_timestamp, NULL), t.hlc_last_call) AS last_call_timestamp,
      v.first_call_timestamp AS vendor_first_call_timestamp, v.last_call_timestamp AS vendor_last_call_timestamp,
      t.last_dialer_status AS latest_dialer_status, t.normalised_status_family,
      -- Vendor call logs are counted ONCE, not once for every HLC transaction. HLC-only summaries use a conservative maximum.
      IF(t.vendor_row_number = 1, COALESCE(v.total_calls, t.vendor_hlc_calls, 0), 0) AS total_calls,
      IF(t.vendor_row_number = 1, COALESCE(v.total_duration, t.vendor_hlc_duration, 0), 0) AS total_call_duration_seconds,
      t.vendor_row_number = 1 AS call_count_anchor, 'lead_vendor' AS call_count_grain,
      t.vendor_row_count > 1 AND v.total_calls IS NOT NULL AS ambiguous_transaction_call_attribution,
      COALESCE(a.activation_date, t.activation_timestamp) AS activation_timestamp,
      (a.activation_date IS NOT NULL OR t.activation_timestamp IS NOT NULL) AS activation,
      IF(t.transaction_rank = 1, COALESCE(a.revenue, t.hlc_revenue_generated, 0), 0) AS revenue,
      t.transaction_rank > 1 AS duplicate_flag, IFNULL(ref.reference_count, 0) > 1 AS activation_id_conflict,
      '${client.currency}' AS currency, t.sentinel_capture
    FROM ranked_transactions t
    LEFT JOIN vicidial_summary v ON CAST(t.lead_id AS STRING) = v.dialer_lead_id AND t.hlc_vendor = v.vendor
    LEFT JOIN transaction_references ref ON t.hlc_transaction_id = ref.hlc_transaction_id
    LEFT JOIN activations a ON t.hlc_transaction_id = a.transaction_id AND ref.reference_count = 1
  ), vw_lead_vendor_transactions AS (
    SELECT *, (sale AND revenue > 0) AS is_billable_sale
    FROM transaction_evidence ${vendor.sql ? `WHERE ${vendor.sql}` : ''}
  ), lead_rollup AS (
    SELECT client_id, lead_id, MAX(consumer_id) AS consumer_id, MAX(capture_timestamp) AS capture_timestamp,
      MAX(capture_date) AS capture_date, MAX(source) AS source, MAX(medium) AS medium,
      ARRAY_AGG(vendor IGNORE NULLS ORDER BY hlc_record_number LIMIT 1)[SAFE_OFFSET(0)] AS vendor,
      LOGICAL_OR(is_revetted) AS is_revetted, MAX(routing_depth) AS routing_depth,
      LOGICAL_OR(valid_lead) AS valid_lead, LOGICAL_OR(valid_idno) AS valid_idno, LOGICAL_OR(phone_valid) AS phone_valid,
      MAX(grade) AS grade, MAX(vetting) AS vetting, LOGICAL_OR(hospital_applied_inconsistent) AS hospital_applied_inconsistent,
      COUNT(DISTINCT vendor) AS vendor_count, COUNT(DISTINCT IF(NULLIF(transaction_id, '') IS NOT NULL, TO_JSON_STRING(STRUCT(vendor, transaction_id)), NULL)) AS total_transactions,
      LOGICAL_OR(delivery_timestamp IS NOT NULL) AS has_delivery,
      LOGICAL_OR(first_call_timestamp IS NOT NULL OR vendor_first_call_timestamp IS NOT NULL OR total_calls > 0) AS has_call,
      LOGICAL_OR(rpc) AS has_rpc, LOGICAL_OR(sale OR vendor_sale_evidence) AS has_sale,
      LOGICAL_OR(is_billable_sale) AS has_billable_sale, LOGICAL_OR(activation) AS has_activation,
      SUM(total_calls) AS total_calls, SUM(total_call_duration_seconds) AS total_call_duration_seconds,
      MIN(delivery_timestamp) AS delivery_timestamp,
      MIN(COALESCE(vendor_first_call_timestamp, first_call_timestamp)) AS first_call_timestamp,
      MAX(COALESCE(vendor_last_call_timestamp, last_call_timestamp)) AS last_call_timestamp,
      MIN(COALESCE(sale_timestamp, vendor_sale_timestamp)) AS sale_timestamp, MIN(rpc_timestamp) AS rpc_timestamp,
      MIN(activation_timestamp) AS activation_timestamp, SUM(revenue) AS total_revenue,
      LOGICAL_OR(duplicate_flag) AS duplicate_flag, LOGICAL_OR(activation_id_conflict) AS activation_id_conflict,
      LOGICAL_OR(sentinel_capture) AS sentinel_capture, ${projections}
    FROM vw_lead_vendor_transactions GROUP BY client_id, lead_id
  ), vw_leads AS (
    SELECT *, total_transactions AS transaction_count, has_delivery AS delivered, has_call AS called,
      has_rpc AS rpc, has_sale AS sale, has_activation AS activation, total_revenue AS revenue,
      has_billable_sale AS is_billable, total_call_duration_seconds AS talk_time_sec
    FROM lead_rollup
  ), vw_ror_events AS (
    SELECT l.lead_id, l.consumer_id, l.capture_timestamp, l.capture_date, r.partner, r.timestamp AS ror_timestamp,
      ROW_NUMBER() OVER (PARTITION BY l.lead_id ORDER BY r.timestamp, r.partner) AS route_sequence,
      LAG(r.partner) OVER (PARTITION BY l.lead_id ORDER BY r.timestamp, r.partner) AS previous_partner,
      LEAD(r.partner) OVER (PARTITION BY l.lead_id ORDER BY r.timestamp, r.partner) AS next_partner,
      TIMESTAMP_DIFF(r.timestamp, LAG(r.timestamp) OVER (PARTITION BY l.lead_id ORDER BY r.timestamp, r.partner), SECOND) AS time_from_previous_route_sec
    FROM base_leads l CROSS JOIN UNNEST(l.valid_ror_events) r
    WHERE EXISTS (SELECT 1 FROM vw_leads selected WHERE selected.lead_id = l.lead_id)
  ), vw_consumers AS (
    SELECT consumer_id, MIN(capture_timestamp) AS first_lead_date, MAX(capture_timestamp) AS latest_lead_date,
      COUNT(DISTINCT lead_id) AS lead_count, COUNT(DISTINCT source) AS unique_source_count,
      COUNT(DISTINCT vendor) AS unique_vendor_count, COUNT(DISTINCT transaction_id) AS transaction_count,
      MAX(routing_depth) AS max_routing_depth, COUNT(DISTINCT IF(is_revetted, lead_id, NULL)) AS revetted_lead_count,
      LOGICAL_OR(delivery_timestamp IS NOT NULL) AS has_delivery,
      LOGICAL_OR(first_call_timestamp IS NOT NULL OR vendor_first_call_timestamp IS NOT NULL OR total_calls > 0) AS has_call,
      LOGICAL_OR(rpc) AS has_rpc, LOGICAL_OR(sale OR vendor_sale_evidence) AS has_sale,
      LOGICAL_OR(is_billable_sale) AS has_billable_sale, LOGICAL_OR(activation) AS has_activation, SUM(revenue) AS total_revenue
    FROM vw_lead_vendor_transactions WHERE consumer_id > 0 GROUP BY consumer_id
  ), vw_commercial_events AS (
    SELECT lead_id, consumer_id, vendor, transaction_id, sale_timestamp, activation_timestamp, is_billable_sale,
      revenue, currency, latest_dialer_status, normalised_status_family, source, medium, capture_timestamp, capture_date
    FROM vw_lead_vendor_transactions WHERE sale OR revenue > 0 OR activation
  )`;
}
