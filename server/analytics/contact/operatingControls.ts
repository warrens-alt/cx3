import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';

export async function getOperatingControlsAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);
  const operating = clientConfig.operationalConfig?.operatingHours || { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };
  const timezone = clientConfig.timezone || 'Africa/Johannesburg';
  const paramsWithOperating = {
    ...queryParams,
    tenantTimezone: timezone,
    operatingStart: operating.start.length === 5 ? operating.start + ':00' : operating.start,
    operatingEnd: operating.end.length === 5 ? operating.end + ':00' : operating.end,
    operatingWorkdays: operating.workdays,
  };

  const query = `
    WITH raw AS (
      SELECT
        l.lead_id,
        SAFE_CAST(l.fetched AS TIMESTAMP) AS fetched_ts,
        COALESCE(l.offershop_source, '') AS source,
        COALESCE(l.offershop_grade, '') AS grade,
        hlc.vendor,
        SAFE_CAST(hlc.delivered AS TIMESTAMP) AS delivered_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) AS first_call_ts,
        COALESCE(SAFE_CAST(hlc.total_calls AS INT64), 0) AS total_calls,
        COALESCE(hlc.last_dialer_status, '') AS last_dialer_status,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
        SAFE_CAST(hlc.sale AS TIMESTAMP) AS sale_ts,
        SAFE_CAST(hlc.activated AS TIMESTAMP) AS activation_ts
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    lead_level AS (
      SELECT
        lead_id,
        ANY_VALUE(fetched_ts) AS fetched_ts,
        ANY_VALUE(source) AS source,
        ANY_VALUE(grade) AS grade,
        COALESCE(
          ARRAY_AGG(vendor IGNORE NULLS ORDER BY IF(delivered_ts IS NULL, 1, 0), delivered_ts ASC LIMIT 1)[SAFE_OFFSET(0)],
          'Unknown'
        ) AS vendor,
        COUNTIF(delivered_ts IS NOT NULL) > 0 AS is_delivered,
        COUNTIF(first_call_ts IS NOT NULL) > 0 AS is_dialled,
        COUNTIF(is_rpc) > 0 AS is_rpc,
        COUNTIF(is_sale) > 0 AS is_sale,
        COUNTIF(is_activated) > 0 AS is_activated,
        MAX(GREATEST(total_calls, 0)) AS recorded_call_count,
        COUNTIF(first_call_ts IS NOT NULL AND TRIM(last_dialer_status) != '') > 0 AS has_disposition,
        MIN(delivered_ts) AS first_delivery_ts,
        MIN(first_call_ts) AS first_call_ts,
        MIN(CASE WHEN is_sale THEN sale_ts END) AS sale_ts,
        MIN(CASE WHEN is_activated THEN activation_ts END) AS activation_ts
      FROM raw
      GROUP BY lead_id
    ),
    classified AS (
      SELECT
        *,
        TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) AS delivery_to_dial_sec,
        TIMESTAMP_DIFF(first_call_ts, fetched_ts, SECOND) AS capture_to_dial_sec,
        CASE
          WHEN fetched_ts IS NULL THEN NULL
          WHEN CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) NOT IN UNNEST(@operatingWorkdays) THEN TRUE
          WHEN FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) < @operatingStart THEN TRUE
          WHEN FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) >= @operatingEnd THEN TRUE
          ELSE FALSE
        END AS is_after_hours,
        CASE
          WHEN fetched_ts IS NULL THEN FALSE
          WHEN CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) IN (6, 7) THEN TRUE
          ELSE FALSE
        END AS is_weekend,
        CASE
          WHEN recorded_call_count <= 0 THEN '0 calls'
          WHEN recorded_call_count = 1 THEN '1 call'
          WHEN recorded_call_count = 2 THEN '2 calls'
          WHEN recorded_call_count = 3 THEN '3 calls'
          WHEN recorded_call_count = 4 THEN '4 calls'
          ELSE '5+ calls'
        END AS attempt_bucket,
        CASE
          WHEN NOT is_delivered THEN 'Not delivered'
          WHEN NOT is_dialled THEN 'Undialled'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) < 0 THEN 'Invalid timing'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 900 THEN '0–15m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 1800 THEN '15–30m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 3600 THEN '30–60m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 21600 THEN '1–6h'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 86400 THEN '6–24h'
          ELSE '24h+'
        END AS sla_band,
        CASE
          WHEN NOT is_sale OR is_activated OR sale_ts IS NULL THEN NULL
          WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 3 THEN '0–3d'
          WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 7 THEN '4–7d'
          WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 14 THEN '8–14d'
          WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 30 THEN '15–30d'
          ELSE '30d+'
        END AS activation_age_bucket
      FROM lead_level
    ),
    summary AS (
      SELECT
        COUNT(*) AS total_leads,
        COUNTIF(is_delivered) AS delivered_leads,
        COUNTIF(is_dialled) AS dialled_leads,
        COUNTIF(recorded_call_count = 0) AS zero_call_leads,
        COUNTIF(recorded_call_count = 1) AS one_call_leads,
        COUNTIF(recorded_call_count >= 2) AS multi_call_leads,
        COUNTIF(recorded_call_count >= 5 AND NOT is_rpc) AS high_attempt_no_rpc_leads,
        COUNTIF(is_dialled AND has_disposition) AS disposition_complete_leads,
        COUNTIF(is_after_hours) AS after_hours_leads,
        COUNTIF(is_weekend) AS weekend_leads,
        COUNTIF(is_delivered AND is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 900) AS sla_15m_leads,
        COUNTIF(is_delivered AND is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 3600) AS sla_60m_leads,
        COUNTIF(is_delivered AND NOT is_dialled) AS awaiting_first_dial,
        MAX(CASE WHEN is_delivered AND NOT is_dialled AND first_delivery_ts IS NOT NULL
          THEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), first_delivery_ts, SECOND) END) AS oldest_delivery_wait_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND capture_to_dial_sec >= 0 THEN capture_to_dial_sec END, 100)[OFFSET(50)] AS capture_to_dial_median_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND capture_to_dial_sec >= 0 THEN capture_to_dial_sec END, 100)[OFFSET(90)] AS capture_to_dial_p90_sec,
        COUNTIF(is_dialled AND capture_to_dial_sec BETWEEN 0 AND 900) AS capture_sla_15m_leads,
        COUNTIF(is_dialled AND capture_to_dial_sec BETWEEN 0 AND 3600) AS capture_sla_60m_leads,
        COUNTIF(is_sale AND NOT is_activated AND sale_ts IS NOT NULL AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) > 14) AS activation_backlog_14d,
        COUNTIF(is_after_hours AND is_rpc) AS after_hours_rpc,
        COUNTIF(NOT is_after_hours AND is_rpc) AS operating_hours_rpc,
        COUNTIF(is_after_hours AND is_sale) AS after_hours_sales,
        COUNTIF(NOT is_after_hours AND is_sale) AS operating_hours_sales,
        COUNTIF(NOT is_after_hours) AS operating_hours_leads,
        COUNTIF(source = '') AS missing_source,
        COUNTIF(grade = '') AS missing_grade,
        COUNTIF(vendor = 'Unknown') AS missing_vendor,
        COUNTIF(is_dialled AND NOT has_disposition) AS missing_disposition
      FROM classified
    ),
    attempts AS (
      SELECT
        attempt_bucket AS bucket,
        CASE attempt_bucket
          WHEN '0 calls' THEN 0 WHEN '1 call' THEN 1 WHEN '2 calls' THEN 2
          WHEN '3 calls' THEN 3 WHEN '4 calls' THEN 4 ELSE 5 END AS bucket_order,
        COUNT(*) AS leads,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales,
        COUNTIF(is_activated) AS activations
      FROM classified
      GROUP BY attempt_bucket
    ),
    sla AS (
      SELECT
        sla_band AS band,
        CASE sla_band
          WHEN '0–15m' THEN 1 WHEN '15–30m' THEN 2 WHEN '30–60m' THEN 3
          WHEN '1–6h' THEN 4 WHEN '6–24h' THEN 5 WHEN '24h+' THEN 6
          WHEN 'Undialled' THEN 7 WHEN 'Not delivered' THEN 8 ELSE 9 END AS sort_order,
        COUNT(*) AS leads,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales
      FROM classified
      GROUP BY sla_band
    ),
    activation_age AS (
      SELECT activation_age_bucket AS bucket, COUNT(*) AS leads
      FROM classified
      WHERE activation_age_bucket IS NOT NULL
      GROUP BY activation_age_bucket
    ),
    hourly_flow AS (
      SELECT
        hour_of_day AS hour,
        SUM(captured) AS captured,
        SUM(first_dials) AS first_dials
      FROM (
        SELECT
          CAST(FORMAT_TIMESTAMP('%H', fetched_ts, @tenantTimezone) AS INT64) AS hour_of_day,
          COUNT(*) AS captured,
          0 AS first_dials
        FROM classified
        WHERE fetched_ts IS NOT NULL
        GROUP BY hour_of_day
        UNION ALL
        SELECT
          CAST(FORMAT_TIMESTAMP('%H', first_call_ts, @tenantTimezone) AS INT64) AS hour_of_day,
          0 AS captured,
          COUNT(*) AS first_dials
        FROM classified
        WHERE first_call_ts IS NOT NULL
        GROUP BY hour_of_day
      )
      GROUP BY hour_of_day
    ),
    daily_turnaround AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(fetched_ts, @tenantTimezone)) AS date,
        COUNT(*) AS leads,
        COUNTIF(is_dialled) AS dialled,
        COUNTIF(NOT is_dialled) AS undialled,
        APPROX_QUANTILES(CASE WHEN is_dialled AND capture_to_dial_sec >= 0 THEN capture_to_dial_sec END, 100)[OFFSET(50)] AS median_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND capture_to_dial_sec >= 0 THEN capture_to_dial_sec END, 100)[OFFSET(90)] AS p90_sec,
        COUNTIF(is_dialled AND capture_to_dial_sec BETWEEN 0 AND 900) AS within_15m,
        COUNTIF(is_dialled AND capture_to_dial_sec BETWEEN 0 AND 3600) AS within_60m
      FROM classified
      WHERE fetched_ts IS NOT NULL
      GROUP BY date
    ),
    vendor_controls AS (
      SELECT
        vendor,
        COUNT(*) AS leads,
        COUNTIF(is_dialled) AS dialled,
        COUNTIF(recorded_call_count = 1) AS one_call_leads,
        COUNTIF(recorded_call_count >= 5 AND NOT is_rpc) AS high_attempt_no_rpc,
        COUNTIF(is_dialled AND NOT has_disposition) AS missing_disposition,
        COUNTIF(is_delivered AND is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 900) AS sla_15m_leads,
        COUNTIF(is_delivered) AS delivered,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales,
        APPROX_QUANTILES(CASE WHEN is_dialled AND delivery_to_dial_sec >= 0 THEN delivery_to_dial_sec END, 100)[OFFSET(50)] AS median_first_dial_sec
      FROM classified
      GROUP BY vendor
      ORDER BY leads DESC
      LIMIT 20
    )
    SELECT
      summary.*,
      ARRAY(SELECT AS STRUCT * FROM attempts ORDER BY bucket_order) AS attempts,
      ARRAY(SELECT AS STRUCT * FROM sla ORDER BY sort_order) AS sla_bands,
      ARRAY(SELECT AS STRUCT * FROM activation_age) AS activation_ageing,
      ARRAY(SELECT AS STRUCT * FROM hourly_flow ORDER BY hour) AS hourly_flow,
      ARRAY(SELECT AS STRUCT * FROM daily_turnaround ORDER BY date) AS daily_turnaround,
      ARRAY(SELECT AS STRUCT * FROM vendor_controls) AS vendor_controls
    FROM summary
  `;

  const [rows] = await client.query({ query, params: paramsWithOperating });
  const row = rows[0] || {};
  const total = Number(row.total_leads || 0);
  const dialled = Number(row.dialled_leads || 0);
  const delivered = Number(row.delivered_leads || 0);
  const afterHours = Number(row.after_hours_leads || 0);
  const operatingHours = Number(row.operating_hours_leads || 0);
  const awaitingFirstDial = Number(row.awaiting_first_dial || 0);
  const captureMedianSec = row.capture_to_dial_median_sec === null || row.capture_to_dial_median_sec === undefined ? null : Number(row.capture_to_dial_median_sec);
  const captureP90Sec = row.capture_to_dial_p90_sec === null || row.capture_to_dial_p90_sec === undefined ? null : Number(row.capture_to_dial_p90_sec);

  const attemptBuckets = (row.attempts || []).map((item: any) => {
    const leads = Number(item.leads || 0);
    const contacted = Number(item.contacted || 0);
    const sales = Number(item.sales || 0);
    const activations = Number(item.activations || 0);
    return {
      bucket: item.bucket,
      leads,
      sharePct: total > 0 ? Number(((leads / total) * 100).toFixed(1)) : 0,
      contacted,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      sales,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activations,
    };
  });

  const slaBands = (row.sla_bands || []).map((item: any) => {
    const leads = Number(item.leads || 0);
    const contacted = Number(item.contacted || 0);
    const sales = Number(item.sales || 0);
    return {
      band: item.band,
      leads,
      sharePct: total > 0 ? Number(((leads / total) * 100).toFixed(1)) : 0,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
    };
  });

  const vendorControls = (row.vendor_controls || []).map((item: any) => {
    const leads = Number(item.leads || 0);
    const vendorDialled = Number(item.dialled || 0);
    const vendorDelivered = Number(item.delivered || 0);
    const contacted = Number(item.contacted || 0);
    const sales = Number(item.sales || 0);
    const oneCall = Number(item.one_call_leads || 0);
    const missingDisposition = Number(item.missing_disposition || 0);
    const sla15 = Number(item.sla_15m_leads || 0);
    return {
      vendor: item.vendor,
      leads,
      oneCallSharePct: vendorDialled > 0 ? Number(((oneCall / vendorDialled) * 100).toFixed(1)) : 0,
      highAttemptNoRpc: Number(item.high_attempt_no_rpc || 0),
      dispositionCompletenessPct: vendorDialled > 0 ? Number((((vendorDialled - missingDisposition) / vendorDialled) * 100).toFixed(1)) : 0,
      sla15Rate: vendorDelivered > 0 ? Number(((sla15 / vendorDelivered) * 100).toFixed(1)) : 0,
      medianFirstDial: formatDuration(item.median_first_dial_sec === null ? null : Number(item.median_first_dial_sec)),
      rpcRate: vendorDialled > 0 ? Number(((contacted / vendorDialled) * 100).toFixed(1)) : 0,
      leadToSaleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
    };
  });

  return {
    summary: {
      totalLeads: total,
      deliveredLeads: delivered,
      dialledLeads: dialled,
      zeroCallLeads: Number(row.zero_call_leads || 0),
      oneCallLeads: Number(row.one_call_leads || 0),
      multiCallLeads: Number(row.multi_call_leads || 0),
      highAttemptNoRpcLeads: Number(row.high_attempt_no_rpc_leads || 0),
      singleAttemptSharePct: dialled > 0 ? Number(((Number(row.one_call_leads || 0) / dialled) * 100).toFixed(1)) : 0,
      multiAttemptSharePct: dialled > 0 ? Number(((Number(row.multi_call_leads || 0) / dialled) * 100).toFixed(1)) : 0,
      dispositionCompletenessPct: dialled > 0 ? Number(((Number(row.disposition_complete_leads || 0) / dialled) * 100).toFixed(1)) : 0,
      afterHoursLeads: afterHours,
      afterHoursSharePct: total > 0 ? Number(((afterHours / total) * 100).toFixed(1)) : 0,
      weekendLeads: Number(row.weekend_leads || 0),
      weekendSharePct: total > 0 ? Number(((Number(row.weekend_leads || 0) / total) * 100).toFixed(1)) : 0,
      sla15Rate: delivered > 0 ? Number(((Number(row.sla_15m_leads || 0) / delivered) * 100).toFixed(1)) : 0,
      sla60Rate: delivered > 0 ? Number(((Number(row.sla_60m_leads || 0) / delivered) * 100).toFixed(1)) : 0,
      awaitingFirstDial,
      oldestDeliveryWait: formatDuration(row.oldest_delivery_wait_sec === null || row.oldest_delivery_wait_sec === undefined ? null : Number(row.oldest_delivery_wait_sec)),
      captureToDialMedian: formatDuration(captureMedianSec),
      captureToDialP90: formatDuration(captureP90Sec),
      captureWithin15mRate: total > 0 ? Number(((Number(row.capture_sla_15m_leads || 0) / total) * 100).toFixed(1)) : 0,
      captureWithin60mRate: total > 0 ? Number(((Number(row.capture_sla_60m_leads || 0) / total) * 100).toFixed(1)) : 0,
      activationBacklog14d: Number(row.activation_backlog_14d || 0),
      afterHoursRpcRate: afterHours > 0 ? Number(((Number(row.after_hours_rpc || 0) / afterHours) * 100).toFixed(1)) : 0,
      operatingHoursRpcRate: operatingHours > 0 ? Number(((Number(row.operating_hours_rpc || 0) / operatingHours) * 100).toFixed(1)) : 0,
      afterHoursSaleRate: afterHours > 0 ? Number(((Number(row.after_hours_sales || 0) / afterHours) * 100).toFixed(2)) : 0,
      operatingHoursSaleRate: operatingHours > 0 ? Number(((Number(row.operating_hours_sales || 0) / operatingHours) * 100).toFixed(2)) : 0,
    },
    attemptBuckets,
    slaBands,
    activationAgeing: row.activation_ageing || [],
    hourlyFlow: (row.hourly_flow || []).map((item: any) => ({
      hour: Number(item.hour || 0),
      captured: Number(item.captured || 0),
      firstDials: Number(item.first_dials || 0),
    })),
    dailyTurnaround: (row.daily_turnaround || []).map((item: any) => {
      const leads = Number(item.leads || 0);
      return {
        date: item.date,
        leads,
        dialled: Number(item.dialled || 0),
        undialled: Number(item.undialled || 0),
        median: formatDuration(item.median_sec === null ? null : Number(item.median_sec)),
        p90: formatDuration(item.p90_sec === null ? null : Number(item.p90_sec)),
        within15mRate: leads > 0 ? Number(((Number(item.within_15m || 0) / leads) * 100).toFixed(1)) : 0,
        within60mRate: leads > 0 ? Number(((Number(item.within_60m || 0) / leads) * 100).toFixed(1)) : 0,
      };
    }),
    vendorControls,
    dataCompleteness: {
      missingSource: Number(row.missing_source || 0),
      missingGrade: Number(row.missing_grade || 0),
      missingVendor: Number(row.missing_vendor || 0),
      missingDisposition: Number(row.missing_disposition || 0),
    },
    operatingContext: {
      timezone,
      start: operating.start,
      end: operating.end,
      workdays: operating.workdays,
    },
    methodology: {
      callCount: 'Call-count controls use the maximum recorded HLC/vendor total_calls value per lead. They are descriptive and are not event-level attempt attribution.',
      vendor: 'Vendor controls use the first recorded delivered vendor per lead to keep each lead exclusive in the comparison.',
      operatingHours: 'Operating-hours classification uses the tenant timezone and configured operating window.',
      captureTurnaround: 'Capture-to-first-dial measures lead fetched/API-entry time to the first recorded dial. Delivery-to-first-dial remains a separate downstream handoff metric.',
      realtimeDialler: 'Live agent state, hopper priority, dial level, drop rate and hopper-reset events require the VICIdial real-time/API source and are not inferred from historical BigQuery rows.',
    },
    validationStatus: 'NOT_VERIFIED',
  };
}
