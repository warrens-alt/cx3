import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { buildFilterClause } from '../common/scope';
import { operationalLeadCtes, metricPercent } from '../common/leadMetrics';

// 3. SPEED TO LEAD
export async function getSpeedToLeadAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const { queryParams } = buildFilterClause(params);
  const operating = clientConfig.operationalConfig?.operatingHours || { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };
  queryParams.tenantTimezone = clientConfig.timezone || 'Africa/Johannesburg';
  queryParams.operatingStart = operating.start.length === 5 ? operating.start + ':00' : operating.start;
  queryParams.operatingEnd = operating.end.length === 5 ? operating.end + ':00' : operating.end;
  queryParams.operatingWorkdays = operating.workdays;

  const query = `
    WITH ${operationalLeadCtes(params)},
    stage_timings AS (
      SELECT *,
        TIMESTAMP_DIFF(attempted_ts, fetched_ts, SECOND) AS capture_to_fetch_sec,
        TIMESTAMP_DIFF(delivered_ts, fetched_ts, SECOND) AS fetch_to_delivery_sec,
        TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND) AS delivery_to_first_dial_sec,
        TIMESTAMP_DIFF(first_call_ts, fetched_ts, SECOND) AS capture_to_first_dial_sec,
        CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) NOT IN UNNEST(@operatingWorkdays)
          OR FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) < @operatingStart
          OR FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) >= @operatingEnd AS is_after_hours
      FROM operational_leads
    ),
    cohorts AS (
      SELECT
        CASE
          WHEN NOT is_dialled THEN 'Undialled'
          WHEN capture_to_first_dial_sec IS NULL OR capture_to_first_dial_sec < 0 THEN 'Invalid / unrecorded timing'
          WHEN capture_to_first_dial_sec <= 300 THEN '0–5 min'
          WHEN capture_to_first_dial_sec <= 900 THEN '5–15 min'
          WHEN capture_to_first_dial_sec <= 1800 THEN '15–30 min'
          WHEN capture_to_first_dial_sec <= 3600 THEN '30–60 min'
          WHEN capture_to_first_dial_sec <= 10800 THEN '1–3 hrs'
          WHEN capture_to_first_dial_sec <= 21600 THEN '3–6 hrs'
          WHEN capture_to_first_dial_sec <= 43200 THEN '6–12 hrs'
          WHEN capture_to_first_dial_sec <= 86400 THEN '12–24 hrs'
          ELSE '24+ hrs'
        END as age_cohort,
        CASE
          WHEN NOT is_dialled THEN 10
          WHEN capture_to_first_dial_sec IS NULL OR capture_to_first_dial_sec < 0 THEN 11
          WHEN capture_to_first_dial_sec <= 300 THEN 1
          WHEN capture_to_first_dial_sec <= 900 THEN 2
          WHEN capture_to_first_dial_sec <= 1800 THEN 3
          WHEN capture_to_first_dial_sec <= 3600 THEN 4
          WHEN capture_to_first_dial_sec <= 10800 THEN 5
          WHEN capture_to_first_dial_sec <= 21600 THEN 6
          WHEN capture_to_first_dial_sec <= 43200 THEN 7
          WHEN capture_to_first_dial_sec <= 86400 THEN 8
          ELSE 9
        END as sort_order,
        COUNT(DISTINCT lead_id) as leads,
        COUNTIF(is_dialled) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM stage_timings
      GROUP BY 1, 2
      ORDER BY sort_order ASC
    ),
    after_hours AS (
      SELECT
        is_after_hours,
        COUNT(DISTINCT lead_id) as leads,
        COUNTIF(is_dialled) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations,
        AVG(CASE WHEN capture_to_first_dial_sec >= 0 THEN capture_to_first_dial_sec END) as avg_dial_sec
      FROM stage_timings
      GROUP BY is_after_hours
    ),
    percentiles AS (
      SELECT
        -- Stage 1: Capture -> Fetch
        ROUND(AVG(CASE WHEN capture_to_fetch_sec >= 0 THEN capture_to_fetch_sec END), 0) as avg_cap_fetch,
        APPROX_QUANTILES(CASE WHEN capture_to_fetch_sec >= 0 THEN capture_to_fetch_sec END, 100)[OFFSET(50)] as med_cap_fetch,
        APPROX_QUANTILES(CASE WHEN capture_to_fetch_sec >= 0 THEN capture_to_fetch_sec END, 100)[OFFSET(75)] as p75_cap_fetch,
        APPROX_QUANTILES(CASE WHEN capture_to_fetch_sec >= 0 THEN capture_to_fetch_sec END, 100)[OFFSET(90)] as p90_cap_fetch,
        APPROX_QUANTILES(CASE WHEN capture_to_fetch_sec >= 0 THEN capture_to_fetch_sec END, 100)[OFFSET(95)] as p95_cap_fetch,

        -- Stage 2: Fetch -> Delivery
        ROUND(AVG(CASE WHEN fetch_to_delivery_sec >= 0 THEN fetch_to_delivery_sec END), 0) as avg_fetch_deliv,
        APPROX_QUANTILES(CASE WHEN fetch_to_delivery_sec >= 0 THEN fetch_to_delivery_sec END, 100)[OFFSET(50)] as med_fetch_deliv,
        APPROX_QUANTILES(CASE WHEN fetch_to_delivery_sec >= 0 THEN fetch_to_delivery_sec END, 100)[OFFSET(75)] as p75_fetch_deliv,
        APPROX_QUANTILES(CASE WHEN fetch_to_delivery_sec >= 0 THEN fetch_to_delivery_sec END, 100)[OFFSET(90)] as p90_fetch_deliv,
        APPROX_QUANTILES(CASE WHEN fetch_to_delivery_sec >= 0 THEN fetch_to_delivery_sec END, 100)[OFFSET(95)] as p95_fetch_deliv,

        -- Stage 3: Delivery -> First Dial
        ROUND(AVG(CASE WHEN delivery_to_first_dial_sec >= 0 THEN delivery_to_first_dial_sec END), 0) as avg_deliv_dial,
        APPROX_QUANTILES(CASE WHEN delivery_to_first_dial_sec >= 0 THEN delivery_to_first_dial_sec END, 100)[OFFSET(50)] as med_deliv_dial,
        APPROX_QUANTILES(CASE WHEN delivery_to_first_dial_sec >= 0 THEN delivery_to_first_dial_sec END, 100)[OFFSET(75)] as p75_deliv_dial,
        APPROX_QUANTILES(CASE WHEN delivery_to_first_dial_sec >= 0 THEN delivery_to_first_dial_sec END, 100)[OFFSET(90)] as p90_deliv_dial,
        APPROX_QUANTILES(CASE WHEN delivery_to_first_dial_sec >= 0 THEN delivery_to_first_dial_sec END, 100)[OFFSET(95)] as p95_deliv_dial,

        -- Stage 4: Capture -> First Dial
        ROUND(AVG(CASE WHEN capture_to_first_dial_sec >= 0 THEN capture_to_first_dial_sec END), 0) as avg_cap_dial,
        APPROX_QUANTILES(CASE WHEN capture_to_first_dial_sec >= 0 THEN capture_to_first_dial_sec END, 100)[OFFSET(50)] as med_cap_dial,
        APPROX_QUANTILES(CASE WHEN capture_to_first_dial_sec >= 0 THEN capture_to_first_dial_sec END, 100)[OFFSET(75)] as p75_cap_dial,
        APPROX_QUANTILES(CASE WHEN capture_to_first_dial_sec >= 0 THEN capture_to_first_dial_sec END, 100)[OFFSET(90)] as p90_cap_dial,
        APPROX_QUANTILES(CASE WHEN capture_to_first_dial_sec >= 0 THEN capture_to_first_dial_sec END, 100)[OFFSET(95)] as p95_cap_dial
      FROM stage_timings
    )
    SELECT
      (SELECT AS STRUCT COUNTIF(is_delivered AND NOT is_dialled) AS awaitingFirstDial,
        COUNTIF(is_delivered AND NOT is_dialled AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), delivered_ts, SECOND) > 900) AS currentSlaBreaches,
        MAX(IF(is_delivered AND NOT is_dialled AND delivered_ts <= CURRENT_TIMESTAMP(), TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), delivered_ts, SECOND), NULL)) AS oldestUndialledSec,
        COUNTIF(delivery_to_first_dial_sec > 900) AS completedDialBreaches FROM stage_timings) AS backlog,
      (SELECT AS STRUCT * FROM percentiles) as percentiles,
      ARRAY(SELECT AS STRUCT * FROM cohorts) as cohorts,
      ARRAY(SELECT AS STRUCT * FROM after_hours) as after_hours
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || { percentiles: {}, cohorts: [], after_hours: [] };
  const p = data.percentiles || {};

  // Formatted stages include only durations directly supported by source timestamps.
  const numberOrNull = (value: unknown): number | null => value === null || value === undefined ? null : Number(value);
  const timingStages = [
    {
      stage: 'Capture → Delivery Attempt',
      description: 'Recorded capture to first delivery attempt',
      avgSec: numberOrNull(p.avg_cap_fetch),
      medianSec: numberOrNull(p.med_cap_fetch),
      p75Sec: numberOrNull(p.p75_cap_fetch),
      p90Sec: numberOrNull(p.p90_cap_fetch),
      avg: formatDuration(numberOrNull(p.avg_cap_fetch)),
      median: formatDuration(numberOrNull(p.med_cap_fetch)),
      p75: formatDuration(numberOrNull(p.p75_cap_fetch)),
      p90: formatDuration(numberOrNull(p.p90_cap_fetch)),
      p95: formatDuration(numberOrNull(p.p95_cap_fetch)), p95Sec: numberOrNull(p.p95_cap_fetch)
    },
    {
      stage: 'Capture → Delivery',
      description: 'Recorded capture to first confirmed delivery',
      avgSec: numberOrNull(p.avg_fetch_deliv),
      medianSec: numberOrNull(p.med_fetch_deliv),
      p75Sec: numberOrNull(p.p75_fetch_deliv),
      p90Sec: numberOrNull(p.p90_fetch_deliv),
      avg: formatDuration(numberOrNull(p.avg_fetch_deliv)),
      median: formatDuration(numberOrNull(p.med_fetch_deliv)),
      p75: formatDuration(numberOrNull(p.p75_fetch_deliv)),
      p90: formatDuration(numberOrNull(p.p90_fetch_deliv)),
      p95: formatDuration(numberOrNull(p.p95_fetch_deliv)), p95Sec: numberOrNull(p.p95_fetch_deliv)
    },
    {
      stage: 'Delivery → First Dial',
      description: 'Recorded delivery to first recorded dial',
      avgSec: numberOrNull(p.avg_deliv_dial),
      medianSec: numberOrNull(p.med_deliv_dial),
      p75Sec: numberOrNull(p.p75_deliv_dial),
      p90Sec: numberOrNull(p.p90_deliv_dial),
      avg: formatDuration(numberOrNull(p.avg_deliv_dial)),
      median: formatDuration(numberOrNull(p.med_deliv_dial)),
      p75: formatDuration(numberOrNull(p.p75_deliv_dial)),
      p90: formatDuration(numberOrNull(p.p90_deliv_dial)),
      p95: formatDuration(numberOrNull(p.p95_deliv_dial)), p95Sec: numberOrNull(p.p95_deliv_dial)
    },
    {
      stage: 'Capture → First Dial',
      description: 'Lead capture to first recorded dial',
      avgSec: numberOrNull(p.avg_cap_dial),
      medianSec: numberOrNull(p.med_cap_dial),
      p75Sec: numberOrNull(p.p75_cap_dial),
      p90Sec: numberOrNull(p.p90_cap_dial),
      avg: formatDuration(numberOrNull(p.avg_cap_dial)),
      median: formatDuration(numberOrNull(p.med_cap_dial)),
      p75: formatDuration(numberOrNull(p.p75_cap_dial)),
      p90: formatDuration(numberOrNull(p.p90_cap_dial)),
      p95: formatDuration(numberOrNull(p.p95_cap_dial)), p95Sec: numberOrNull(p.p95_cap_dial)
    }
  ];

  const cohorts = (data.cohorts || []).map((c: any) => {
    const leads = Number(c.leads || 0);
    const contacted = Number(c.contacted || 0);
    const sales = Number(c.sales || 0);
    const activations = Number(c.activations || 0);
    return {
      cohort: c.age_cohort,
      leads,
      contacted,
      contactRate: metricPercent(contacted, Number(c.dialled || 0)),
      sales,
      saleRate: metricPercent(sales, leads, 2),
      activations,
      activationRate: metricPercent(activations, sales, 1)
    };
  });

  const afterHours = (data.after_hours || []).map((a: any) => {
    const leads = Number(a.leads || 0);
    const contacted = Number(a.contacted || 0);
    const sales = Number(a.sales || 0);
    return {
      type: a.is_after_hours == null ? 'Unrecorded capture time' : a.is_after_hours ? 'Outside configured operating hours' : `Operating hours (${operating.start}–${operating.end})`,
      leads,
      contactRate: metricPercent(contacted, Number(a.dialled || 0)),
      saleRate: metricPercent(sales, leads, 2),
      avgTimeToFirstDial: formatDuration(a.avg_dial_sec)
    };
  });

  return {
    timingStages,
    backlog: { awaitingFirstDial: Number(data.backlog?.awaitingFirstDial || 0), currentSlaBreaches: Number(data.backlog?.currentSlaBreaches || 0), completedDialBreaches: Number(data.backlog?.completedDialBreaches || 0), oldestUndialled: formatDuration(data.backlog?.oldestUndialledSec) },
    methodology: 'Observed associations by capture-to-first-dial duration. RPC / dialled, sales / fetched, activations / sales. Undialled and invalid timing populations remain explicit; no causal or calling-policy inference.',
    cohorts,
    afterHours,
    operatingContext: {
      timezone: clientConfig.timezone,
      start: operating.start,
      end: operating.end,
      workdays: operating.workdays,
    }
  };
}
