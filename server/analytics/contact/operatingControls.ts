import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { operationalLeadCtes } from '../common/leadMetrics';
import { buildFilterClause } from '../common/scope';
import { percentOrNull, durationSecondsOrNull, numberOrNull } from '../common/metrics';

export function buildOperatingControlsQuery(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const { queryParams } = buildFilterClause(params);
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
    WITH ${operationalLeadCtes(params)},
    classified AS (
      SELECT
        *,
        TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND) AS delivery_to_dial_sec,
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
          WHEN recorded_call_count IS NULL THEN 'Unrecorded'
          WHEN recorded_call_count = 0 THEN '0 calls'
          WHEN recorded_call_count = 1 THEN '1 call'
          WHEN recorded_call_count = 2 THEN '2 calls'
          WHEN recorded_call_count = 3 THEN '3 calls'
          WHEN recorded_call_count = 4 THEN '4 calls'
          ELSE '5+ calls'
        END AS attempt_bucket,
        CASE
          WHEN delivered_ts IS NOT NULL AND NOT is_delivered THEN 'Invalid timing'
          WHEN first_call_ts < delivered_ts THEN 'Invalid timing'
          WHEN NOT is_delivered THEN 'Not delivered'
          WHEN first_call_ts IS NULL THEN 'Undialled'
          WHEN NOT is_dialled THEN 'Unqualified dial'
          WHEN TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND) <= 900 THEN '0–15m'
          WHEN TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND) <= 1800 THEN '15–30m'
          WHEN TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND) <= 3600 THEN '30–60m'
          WHEN TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND) <= 21600 THEN '1–6h'
          WHEN TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND) <= 86400 THEN '6–24h'
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
      FROM operational_leads
    ),
    summary AS (
      SELECT
        COUNT(*) AS total_leads,
        COUNTIF(is_delivered) AS delivered_leads,
        COUNTIF(is_dialled) AS dialled_leads,
        COUNTIF(recorded_call_count IS NULL) AS unrecorded_call_leads,
        COUNTIF(is_dialled AND recorded_call_count IS NULL) AS dialled_unrecorded_call_leads,
        COUNTIF(recorded_call_count = 0) AS zero_call_leads,
        COUNTIF(is_dialled AND recorded_call_count = 1) AS one_call_leads,
        COUNTIF(is_dialled AND recorded_call_count >= 2) AS multi_call_leads,
        COUNTIF(recorded_call_count >= 5 AND is_rpc IS FALSE) AS high_attempt_no_rpc_leads,
        COUNTIF(is_dialled AND has_disposition) AS disposition_complete_leads,
        COUNTIF(is_after_hours) AS after_hours_leads,
        COUNTIF(is_weekend) AS weekend_leads,
        COUNTIF(is_delivered AND is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 900) AS sla_15m_leads,
        COUNTIF(is_delivered AND is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 3600) AS sla_60m_leads,
        COUNTIF(is_delivered AND NOT is_dialled) AS awaiting_first_dial,
        MAX(CASE WHEN is_delivered AND NOT is_dialled AND delivered_ts IS NOT NULL
          THEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), delivered_ts, SECOND) END) AS oldest_delivery_wait_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND capture_to_dial_sec >= 0 THEN capture_to_dial_sec END, 100)[OFFSET(50)] AS capture_to_dial_median_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND capture_to_dial_sec >= 0 THEN capture_to_dial_sec END, 100)[OFFSET(90)] AS capture_to_dial_p90_sec,
        COUNTIF(is_dialled AND capture_to_dial_sec BETWEEN 0 AND 900) AS capture_sla_15m_leads,
        COUNTIF(is_dialled AND capture_to_dial_sec BETWEEN 0 AND 3600) AS capture_sla_60m_leads,
        COUNTIF(is_sale AND NOT is_activated AND sale_ts IS NOT NULL AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) > 14) AS activation_backlog_14d,
        COUNTIF(is_after_hours AND is_dialled AND is_rpc IS TRUE) AS after_hours_rpc,
        COUNTIF(NOT is_after_hours AND is_dialled AND is_rpc IS TRUE) AS operating_hours_rpc,
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
          WHEN 'Unrecorded' THEN -1 WHEN '0 calls' THEN 0 WHEN '1 call' THEN 1 WHEN '2 calls' THEN 2
          WHEN '3 calls' THEN 3 WHEN '4 calls' THEN 4 ELSE 5 END AS bucket_order,
        COUNT(*) AS leads,
        COUNTIF(is_dialled AND is_rpc IS TRUE) AS contacted,
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
        COUNTIF(is_dialled AND is_rpc IS TRUE) AS contacted,
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
        COUNTIF(recorded_call_count IS NULL) AS unrecorded_call_leads,
        COUNTIF(is_dialled AND recorded_call_count IS NULL) AS dialled_unrecorded_call_leads,
        COUNTIF(recorded_call_count = 0) AS zero_call_leads,
        COUNTIF(is_dialled AND recorded_call_count = 1) AS one_call_leads,
        COUNTIF(recorded_call_count >= 5 AND is_rpc IS FALSE) AS high_attempt_no_rpc,
        COUNTIF(is_dialled AND NOT has_disposition) AS missing_disposition,
        COUNTIF(is_delivered AND is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 900) AS sla_15m_leads,
        COUNTIF(is_delivered) AS delivered,
        COUNTIF(is_dialled AND is_rpc IS TRUE) AS contacted,
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

  return { query, queryParams: paramsWithOperating, clientConfig, operating };
}

export async function getOperatingControlsAnalytics(params: OffernetQueryParams) {
  const { query, queryParams, clientConfig, operating } = buildOperatingControlsQuery(params);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const [rows] = await client.query({ query, params: queryParams });
  if (!rows[0]) throw new Error('Operating controls aggregate evidence is unavailable.');
  return buildOperatingControlsResult(rows[0], clientConfig, operating);
}

export function buildOperatingControlsResult(row: any, clientConfig: any, operating: any) {
  const total = Number(row.total_leads || 0);
  const dialled = Number(row.dialled_leads || 0);
  const delivered = Number(row.delivered_leads || 0);
  const afterHours = Number(row.after_hours_leads || 0);
  const operatingHours = Number(row.operating_hours_leads || 0);
  const awaitingFirstDial = Number(row.awaiting_first_dial || 0);
  const captureMedianSec = durationSecondsOrNull(row.capture_to_dial_median_sec);
  const captureP90Sec = durationSecondsOrNull(row.capture_to_dial_p90_sec);

  const attemptBuckets = (row.attempts || []).map((item: any) => {
    const leads = Number(item.leads || 0);
    const contacted = Number(item.contacted || 0);
    const sales = Number(item.sales || 0);
    const activations = Number(item.activations || 0);
    return {
      bucket: item.bucket,
      leads,
      sharePct: percentOrNull(leads, total, 1),
      contacted,
      contactRate: percentOrNull(contacted, leads, 1),
      sales,
      saleRate: percentOrNull(sales, leads, 2),
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
      sharePct: percentOrNull(leads, total, 1),
      contactRate: percentOrNull(contacted, leads, 1),
      saleRate: percentOrNull(sales, leads, 2),
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
    const medianFirstDialSec = durationSecondsOrNull(item.median_first_dial_sec);
    return {
      vendor: item.vendor,
      leads,
      unrecordedCallLeads: numberOrNull(item.unrecorded_call_leads),
      dialledUnrecordedCallLeads: numberOrNull(item.dialled_unrecorded_call_leads),
      dialledUnrecordedCallSharePct: percentOrNull(item.dialled_unrecorded_call_leads, vendorDialled, 1),
      zeroCallLeads: numberOrNull(item.zero_call_leads),
      oneCallSharePct: percentOrNull(oneCall, vendorDialled, 1),
      highAttemptNoRpc: Number(item.high_attempt_no_rpc || 0),
      dispositionCompletenessPct: vendorDialled > 0 ? percentOrNull(vendorDialled - missingDisposition, vendorDialled, 1) : null,
      sla15Rate: percentOrNull(sla15, vendorDelivered, 1),
      medianFirstDial: formatDuration(medianFirstDialSec),
      rpcRate: percentOrNull(contacted, vendorDialled, 1),
      leadToSaleRate: percentOrNull(sales, leads, 2),
    };
  });

  return {
    summary: {
      totalLeads: total,
      deliveredLeads: delivered,
      dialledLeads: dialled,
      unrecordedCallLeads: numberOrNull(row.unrecorded_call_leads),
      dialledUnrecordedCallLeads: numberOrNull(row.dialled_unrecorded_call_leads),
      dialledUnrecordedCallSharePct: percentOrNull(row.dialled_unrecorded_call_leads, dialled, 1),
      zeroCallLeads: Number(row.zero_call_leads || 0),
      oneCallLeads: Number(row.one_call_leads || 0),
      multiCallLeads: Number(row.multi_call_leads || 0),
      highAttemptNoRpcLeads: Number(row.high_attempt_no_rpc_leads || 0),
      singleAttemptSharePct: percentOrNull(row.one_call_leads, dialled, 1),
      multiAttemptSharePct: percentOrNull(row.multi_call_leads, dialled, 1),
      dispositionCompletenessPct: percentOrNull(row.disposition_complete_leads, dialled, 1),
      afterHoursLeads: afterHours,
      afterHoursSharePct: percentOrNull(afterHours, total, 1),
      weekendLeads: Number(row.weekend_leads || 0),
      weekendSharePct: percentOrNull(row.weekend_leads, total, 1),
      sla15Rate: percentOrNull(row.sla_15m_leads, delivered, 1),
      sla60Rate: percentOrNull(row.sla_60m_leads, delivered, 1),
      awaitingFirstDial,
      oldestDeliveryWait: formatDuration(durationSecondsOrNull(row.oldest_delivery_wait_sec)),
      captureToDialMedian: formatDuration(captureMedianSec),
      captureToDialP90: formatDuration(captureP90Sec),
      captureWithin15mRate: percentOrNull(row.capture_sla_15m_leads, total, 1),
      captureWithin60mRate: percentOrNull(row.capture_sla_60m_leads, total, 1),
      activationBacklog14d: Number(row.activation_backlog_14d || 0),
      afterHoursRpcRate: percentOrNull(row.after_hours_rpc, afterHours, 1),
      operatingHoursRpcRate: percentOrNull(row.operating_hours_rpc, operatingHours, 1),
      afterHoursSaleRate: percentOrNull(row.after_hours_sales, afterHours, 2),
      operatingHoursSaleRate: percentOrNull(row.operating_hours_sales, operatingHours, 2),
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
        median: formatDuration(durationSecondsOrNull(item.median_sec)),
        p90: formatDuration(durationSecondsOrNull(item.p90_sec)),
        within15mRate: percentOrNull(item.within_15m, leads, 1),
        within60mRate: percentOrNull(item.within_60m, leads, 1),
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
      timezone: clientConfig.timezone || 'Africa/Johannesburg',
      start: operating.start,
      end: operating.end,
      workdays: operating.workdays,
    },
    methodology: {
      callCount: 'Call-count controls use the maximum recorded HLC/vendor total_calls value per lead. Only valid non-negative counters qualify: null/invalid/negative is Unrecorded; an explicit 0 is Zero calls. One-call and multi-call shares count qualified dialled leads in each recorded bucket / all qualified dialled leads; dialled leads with unrecorded counters are reported separately. These are descriptive cumulative counters, not event-level attempt attribution. The 5+ no RPC population requires explicit negative RPC; unknown RPC is excluded.',
      vendor: 'Vendor controls use the first recorded delivered vendor per lead to keep each lead exclusive in the comparison.',
      operatingHours: 'Operating-hours classification uses the tenant timezone and configured operating window.',
      captureTurnaround: 'Capture-to-first-dial measures lead fetched/API-entry time to the first recorded dial. Delivery-to-first-dial remains a separate downstream handoff metric.',
      realtimeDialler: 'Live agent state, hopper priority, dial level, drop rate and hopper-reset events require the VICIdial real-time/API source and are not inferred from historical BigQuery rows.',
    },
    validationStatus: 'NOT_VERIFIED',
  };
}
