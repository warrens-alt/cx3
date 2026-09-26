import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { formatDuration } from '../common/types';
import { buildFilterClause } from '../common/scope';
import { operationalLeadCtes, metricPercent } from '../common/leadMetrics';
import { assembleLifecycleDiagnostics, compileLifecycleDiagnostics } from '../common/lifecycleDiagnostics';

// 1. EXECUTIVE OVERVIEW
export async function getExecutiveOverview(params: OffernetQueryParams, options: { includeDiagnostics?: boolean } = {}) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const clientConfig = getClientConfig(params.clientId);
  const diagnostics = options.includeDiagnostics === false ? null : compileLifecycleDiagnostics(params);
  const { queryParams } = diagnostics || buildFilterClause(params);
  queryParams.overviewTimezone = clientConfig.timezone || 'Africa/Johannesburg';

  const mainQuery = `
    WITH ${diagnostics ? `${diagnostics.ctesSql}, ${diagnostics.currentLeadCtesSql()}` : operationalLeadCtes(params)},
    lead_records AS (
      SELECT *, DATE(fetched_ts, @overviewTimezone) AS fetched_date,
        TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND) AS delivery_to_dial_sec,
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), delivered_ts, SECOND) AS delivery_age_sec
      FROM ${diagnostics ? 'current_operational_leads' : 'operational_leads'}
    ),
    summary AS (
      SELECT
        COUNT(DISTINCT lead_id) AS fetched_leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered_leads,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled_leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted_leads,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sale_leads,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activated_leads,
        SUM(revenue) AS total_revenue, COUNTIF(revenue IS NULL) AS missing_revenue_leads,
        CASE WHEN COUNTIF(recorded_call_count IS NULL) > 0 THEN NULL ELSE COALESCE(SUM(recorded_call_count), 0) END AS total_calls_recorded,
        COALESCE(SUM(recorded_call_count), 0) AS recorded_calls_subtotal,
        CASE WHEN COUNTIF(is_dialled AND recorded_call_count IS NULL) > 0 THEN NULL
          ELSE COALESCE(SUM(IF(is_dialled, recorded_call_count, 0)), 0) END AS dialled_calls_recorded,
        COUNTIF(recorded_call_count IS NULL) AS unrecorded_call_leads,
        COUNTIF(recorded_call_count = 0) AS zero_call_leads, COUNTIF(is_dialled AND recorded_call_count = 1) AS one_call_leads,
        COUNTIF(is_dialled AND recorded_call_count >= 2) AS multi_call_leads, COUNTIF(recorded_call_count >= 5 AND is_rpc IS FALSE) AS five_plus_no_rpc
      FROM lead_records
    ),
    daily_trends AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', fetched_date) AS date,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations,
        ROUND(SUM(revenue), 2) AS revenue
      FROM lead_records
      WHERE fetched_date IS NOT NULL
      GROUP BY fetched_date
      ORDER BY fetched_date DESC
      LIMIT 60
    ),
    operational AS (
      SELECT
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled THEN lead_id END) AS awaiting_first_dial,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec BETWEEN 0 AND 900 THEN lead_id END) AS backlog_0_15m,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 900 AND delivery_age_sec <= 1800 THEN lead_id END) AS backlog_15_30m,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 1800 AND delivery_age_sec <= 3600 THEN lead_id END) AS backlog_30_60m,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 3600 AND delivery_age_sec <= 21600 THEN lead_id END) AS backlog_1_6h,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 21600 AND delivery_age_sec <= 43200 THEN lead_id END) AS backlog_6_12h,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 43200 AND delivery_age_sec <= 86400 THEN lead_id END) AS backlog_12_24h,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 86400 THEN lead_id END) AS backlog_24h_plus,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 3600 THEN lead_id END) AS backlog_over_60m,
        COUNT(DISTINCT CASE WHEN is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 900 THEN lead_id END) AS dialled_within_15m,
        COUNT(DISTINCT CASE WHEN is_dialled AND NOT has_disposition THEN lead_id END) AS dialled_missing_disposition,
        COUNT(DISTINCT CASE WHEN is_sale AND NOT is_activated AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) > 14 THEN lead_id END) AS sales_unactivated_14d,
        APPROX_QUANTILES(CASE WHEN is_dialled AND delivery_to_dial_sec >= 0 THEN delivery_to_dial_sec END, 100)[OFFSET(50)] AS median_delivery_to_dial_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND delivery_to_dial_sec >= 0 THEN delivery_to_dial_sec END, 100)[OFFSET(90)] AS p90_delivery_to_dial_sec,
        APPROX_QUANTILES(CASE WHEN first_call_ts >= fetched_ts THEN TIMESTAMP_DIFF(first_call_ts, fetched_ts, SECOND) END, 100)[OFFSET(50)] AS median_capture_to_dial_sec,
        APPROX_QUANTILES(CASE WHEN first_call_ts >= fetched_ts THEN TIMESTAMP_DIFF(first_call_ts, fetched_ts, SECOND) END, 100)[OFFSET(90)] AS p90_capture_to_dial_sec,
        COUNTIF(delivery_to_dial_sec BETWEEN 0 AND 1800) AS within_30m, COUNTIF(delivery_to_dial_sec BETWEEN 0 AND 3600) AS within_60m,
        COUNTIF(is_delivered AND NOT is_dialled AND delivery_age_sec > 900) AS backlog_over_15m,
        COUNTIF(is_delivered AND NOT is_dialled AND delivery_age_sec > 1800) AS backlog_over_30m,
        COUNTIF(is_delivered AND NOT is_dialled AND delivery_age_sec > 21600) AS backlog_over_6h,
        COUNTIF(is_delivered AND NOT is_dialled AND delivery_age_sec > 43200) AS backlog_over_12h,
        COUNTIF(is_sale AND NOT is_activated) AS awaiting_activation,
        COUNTIF(is_sale AND NOT is_activated AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, SECOND) > 259200) AS activation_over_3d,
        COUNTIF(is_sale AND NOT is_activated AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, SECOND) > 604800) AS activation_over_7d,
        COUNTIF(is_sale AND NOT is_activated AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, SECOND) > 2592000) AS activation_over_30d
      FROM lead_records
    ),
    backlog_vendor AS (
      SELECT
        COALESCE(vendor, 'Unknown') AS vendor,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled THEN lead_id END) AS awaiting_first_dial,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 3600 THEN lead_id END) AS over_60m
      FROM lead_records
      GROUP BY vendor
      HAVING awaiting_first_dial > 0
      ORDER BY over_60m DESC, awaiting_first_dial DESC
      LIMIT 8
    )
    SELECT
      summary.*,
      operational.*,
      ARRAY(SELECT AS STRUCT * FROM daily_trends ORDER BY date) AS daily_trends,
      ARRAY(SELECT AS STRUCT * FROM backlog_vendor) AS backlog_by_vendor
      ${diagnostics ? `, ARRAY(SELECT AS STRUCT * FROM lifecycle_aggregates ORDER BY period, dimension, fetched DESC) AS lifecycle_rows` : ''}
    FROM summary
    CROSS JOIN operational
  `;

  const [rows] = await client.query({ query: mainQuery, params: queryParams });
  const data = rows[0] || {};
  const lifecycle = assembleLifecycleDiagnostics(data.lifecycle_rows || [], diagnostics?.period || null);

  const fetched = Number(data.fetched_leads || 0);
  const delivered = Number(data.delivered_leads || 0);
  const dialled = Number(data.dialled_leads || 0);
  const contacted = Number(data.contacted_leads || 0);
  const sales = Number(data.sale_leads || 0);
  const activated = Number(data.activated_leads || 0);
  const revenue = data.total_revenue == null ? null : Number(data.total_revenue);
  const totalCalls = data.total_calls_recorded == null ? null : Number(data.total_calls_recorded);

  const rates = {
    deliveryRate: metricPercent(delivered, fetched, 1),
    dialRate: metricPercent(dialled, delivered, 1),
    contactRate: metricPercent(contacted, dialled, 1),
    leadToSaleRate: metricPercent(sales, fetched, 2),
    contactToSaleRate: metricPercent(sales, contacted, 1),
    activationRate: metricPercent(activated, sales, 1),
  };

  const funnelStages = [
    { key: 'fetched', name: 'Fetched', volume: fetched, rate: fetched > 0 ? 100 : null },
    { key: 'delivered', name: 'Delivered', volume: delivered, rate: rates.deliveryRate },
    { key: 'dialled', name: 'Dialled', volume: dialled, rate: rates.dialRate },
    { key: 'rpc', name: 'RPC', volume: contacted, rate: rates.contactRate },
    { key: 'sales', name: 'Sales', volume: sales, rate: rates.leadToSaleRate },
    { key: 'activated', name: 'Activated', volume: activated, rate: rates.activationRate },
  ].map((stage, index, stages) => {
    const previous = index === 0 ? null : stages[index - 1];
    const evidence = options.includeDiagnostics !== false && previous ? lifecycle.transitions[index - 1] : null;
    const loss = evidence ? evidence.lost : previous ? Math.max(previous.volume - stage.volume, 0) : 0;
    const transitionRate = evidence ? evidence.conversionRate : previous ? metricPercent(stage.volume, previous.volume) : fetched > 0 ? 100 : null;
    return { ...stage, loss, transitionRate };
  });

  const transitions = funnelStages.slice(1).map((stage, index) => ({
    from: funnelStages[index].name,
    to: stage.name,
    loss: stage.loss,
    rate: stage.transitionRate,
  }));
  const largestLeak = transitions.reduce((largest, current) => current.loss > largest.loss ? current : largest, transitions[0] || { from: 'Fetched', to: 'Delivered', loss: 0, rate: 0 });

  const backlogBuckets = [
    { bucket: '0–15m', count: Number(data.backlog_0_15m || 0), severity: 'normal' },
    { bucket: '15–30m', count: Number(data.backlog_15_30m || 0), severity: 'normal' },
    { bucket: '30–60m', count: Number(data.backlog_30_60m || 0), severity: 'attention' },
    { bucket: '1–6h', count: Number(data.backlog_1_6h || 0), severity: 'warning' },
    { bucket: '6–12h', count: Number(data.backlog_6_12h || 0), severity: 'warning' },
    { bucket: '12–24h', count: Number(data.backlog_12_24h || 0), severity: 'critical' },
    { bucket: '24h+', count: Number(data.backlog_24h_plus || 0), severity: 'critical' },
  ];

  const slaCompliance = metricPercent(Number(data.dialled_within_15m || 0), delivered);

  const attention = [
    {
      id: 'awaiting-first-dial',
      title: 'Delivered leads awaiting first dial',
      value: Number(data.awaiting_first_dial || 0),
      severity: Number(data.backlog_over_60m || 0) > 0 ? 'high' : 'medium',
      detail: `${Number(data.backlog_over_60m || 0).toLocaleString()} have been waiting longer than 60 minutes.`,
      path: '/speed-to-lead',
    },
    {
      id: 'missing-disposition',
      title: 'Dialled leads missing disposition',
      value: Number(data.dialled_missing_disposition || 0),
      severity: Number(data.dialled_missing_disposition || 0) > 0 ? 'medium' : 'low',
      detail: 'Dial attempts exist but no latest disposition is recorded.',
      path: '/data-integrity',
    },
    {
      id: 'unactivated-sales',
      title: 'Sales without activation after 14 days',
      value: Number(data.sales_unactivated_14d || 0),
      severity: Number(data.sales_unactivated_14d || 0) > 0 ? 'medium' : 'low',
      detail: 'Recorded sales are more than 14 days old and have no activation timestamp.',
      path: '/sales-activation',
    },
  ].filter(item => item.value > 0);

  const changes = lifecycle.comparisons;
  const comparisonWindow = lifecycle.period?.previous || null;
  const roundedChange = (value: number | null, decimals = 1) => value === null ? null : Number(value.toFixed(decimals));
  const comparison = lifecycle.period ? {
    fetchedDelta: roundedChange(changes.fetched.percentageChange),
    deliveryRateDelta: roundedChange(changes.deliveryRate.percentagePointChange),
    dialRateDelta: roundedChange(changes.dialRate.percentagePointChange),
    contactRateDelta: roundedChange(changes.rpcRate.percentagePointChange),
    saleRateDelta: roundedChange(changes.saleRate.percentagePointChange),
    activationRateDelta: roundedChange(changes.activationRate.percentagePointChange),
    revenueDelta: roundedChange(changes.revenue.percentageChange),
    contributionDelta: null,
  } : null;

  return {
    lifecycle,
    revenueEvidence: { missingLeadValues: Number(data.missing_revenue_leads || 0), basis: 'Sum of available recorded source values; missing revenue is not imputed.' },
    contactEvidence: {
      zeroCallLeads: Number(data.zero_call_leads || 0), oneCallLeads: Number(data.one_call_leads || 0),
      oneCallShare: metricPercent(Number(data.one_call_leads || 0), dialled), multiCallShare: metricPercent(Number(data.multi_call_leads || 0), dialled),
      fivePlusNoRpc: Number(data.five_plus_no_rpc || 0),
      medianCaptureToDial: formatDuration(data.median_capture_to_dial_sec), p90CaptureToDial: formatDuration(data.p90_capture_to_dial_sec),
      within30m: metricPercent(Number(data.within_30m || 0), delivered), within60m: metricPercent(Number(data.within_60m || 0), delivered),
      backlogOver15m: Number(data.backlog_over_15m || 0), backlogOver30m: Number(data.backlog_over_30m || 0), backlogOver6h: Number(data.backlog_over_6h || 0), backlogOver12h: Number(data.backlog_over_12h || 0),
      awaitingActivation: Number(data.awaiting_activation || 0), activationOver3d: Number(data.activation_over_3d || 0), activationOver7d: Number(data.activation_over_7d || 0), activationOver30d: Number(data.activation_over_30d || 0),
    },
    kpis: {
      fetchedLeads: fetched,
      deliveredLeads: delivered,
      deliveryRate: rates.deliveryRate,
      dialledLeads: dialled,
      dialRate: rates.dialRate,
      contactedLeads: contacted,
      contactRate: rates.contactRate,
      qualifiedLeads: null,
      saleLeads: sales,
      leadToSaleRate: rates.leadToSaleRate,
      contactToSaleRate: rates.contactToSaleRate,
      activatedLeads: activated,
      activationRate: rates.activationRate,
      totalCalls,
      recordedCallsSubtotal: Number(data.recorded_calls_subtotal || 0),
      unrecordedCallLeads: Number(data.unrecorded_call_leads || 0),
      callsPerLead: totalCalls !== null && fetched > 0 ? Number((totalCalls / fetched).toFixed(1)) : null,
      callsPerDialledLead: data.dialled_calls_recorded != null && dialled > 0 ? Number((Number(data.dialled_calls_recorded) / dialled).toFixed(1)) : null,
      revenue,
      directCost: null,
      deliveryAgentCost: null,
      allocatedCost: null,
      totalCost: null,
      contribution: null,
      marginPct: null,
      costPerSale: null,
      costPerActivation: null,
      revenuePerLead: fetched > 0 && revenue != null ? Number((revenue / fetched).toFixed(2)) : null,
      breakEvenSales: null,
      actualVsBreakEven: null
    },
    funnelStages,
    funnelLeak: largestLeak,
    dailyTrends: data.daily_trends || [],
    backlog: {
      awaitingFirstDial: Number(data.awaiting_first_dial || 0),
      over60Minutes: Number(data.backlog_over_60m || 0),
      buckets: backlogBuckets,
      byVendor: data.backlog_by_vendor || [],
    },
    sla: {
      firstDialTargetMinutes: 15,
      complianceRate: slaCompliance,
      medianDeliveryToDial: formatDuration(data.median_delivery_to_dial_sec),
      p90DeliveryToDial: formatDuration(data.p90_delivery_to_dial_sec),
    },
    attention,
    comparison,
    comparisonWindow,
    commercialStatus: 'UNAVAILABLE',
    commercialReason: 'Commercial costs and profitability are withheld until an approved rate-card contract is configured.',
    validationStatus: 'NOT_VERIFIED',
    currency: clientConfig.currency || 'ZAR',
    clientName: clientConfig.name
  };
}

/** Commercial ratios need these current-cohort totals only, with the same lead normalization as Overview. */
export async function getOperationalCommercialSummary(params: OffernetQueryParams) {
  const config = getClientConfig(params.clientId);
  const { queryParams } = buildFilterClause(params);
  const [rows] = await getBigQueryClient(config.bigQueryProject).query({
    query: `WITH ${operationalLeadCtes(params)}
      SELECT COUNT(*) AS fetched_leads, COUNTIF(is_sale) AS sale_leads,
        COUNTIF(is_activated) AS activated_leads, SUM(revenue) AS total_revenue
      FROM operational_leads`,
    params: queryParams,
  });
  const row = rows[0] || {};
  const fetchedLeads = Number(row.fetched_leads || 0), saleLeads = Number(row.sale_leads || 0);
  return {
    kpis: { fetchedLeads, saleLeads, activatedLeads: Number(row.activated_leads || 0),
      leadToSaleRate: metricPercent(saleLeads, fetchedLeads, 2),
      revenue: row.total_revenue == null ? null : Number(row.total_revenue) },
    currency: config.currency || 'ZAR',
  };
}
