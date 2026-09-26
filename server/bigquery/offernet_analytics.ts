import { getBigQueryClient } from './client';
import { getClientConfig } from './config';
import { RequestError } from './filters';

export interface OffernetQueryParams {
  clientId: string;
  startDate?: string;
  endDate?: string;
  period?: 'today' | 'wtd' | 'mtd' | 'wow' | 'mom' | 'matched_mom' | 'custom';
  vendor?: string;
  source?: string;
  medium?: string;
  grade?: string;
  agent?: string;
  campaign?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// Format seconds into human readable duration
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

// Build standard WHERE filter clause for clustered_lead_ledger queries
function buildFilterClause(params: OffernetQueryParams, alias = 'l', hlcAlias = 'hlc') {
  const conditions: string[] = [
    `${alias}.fetched NOT LIKE '1900%'`,
    `${alias}.fetched NOT LIKE '1970%'`,
    `${alias}.fetched IS NOT NULL`
  ];
  const queryParams: Record<string, any> = {};

  if (params.startDate) {
    conditions.push(`DATE(SAFE_CAST(${alias}.fetched AS TIMESTAMP)) >= @startDate`);
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push(`DATE(SAFE_CAST(${alias}.fetched AS TIMESTAMP)) <= @endDate`);
    queryParams.endDate = params.endDate;
  }

  // Tenant / Client mapping filter if tenant targets specific vendors
  const clientConfig = getClientConfig(params.clientId);
  if (clientConfig.id !== 'default_tenant' && clientConfig.id !== 'offernet_master') {
    const tenantVendors = clientConfig.semanticMappings.partners || [];
    if (tenantVendors.length > 0) {
      conditions.push(`EXISTS (SELECT 1 FROM UNNEST(${alias}.hlc_details) h WHERE LOWER(h.vendor) IN UNNEST(@tenantVendors))`);
      if (hlcAlias) {
        conditions.push(`LOWER(${hlcAlias}.vendor) IN UNNEST(@tenantVendors)`);
      }
      queryParams.tenantVendors = tenantVendors.map(v => v.toLowerCase());
    }
  }

  const cleanVendor = params.vendor && !['all', 'all vendors', 'undefined', 'null'].includes(params.vendor.trim().toLowerCase()) 
    ? params.vendor.trim() 
    : undefined;

  if (cleanVendor) {
    conditions.push(`EXISTS (SELECT 1 FROM UNNEST(${alias}.hlc_details) h WHERE LOWER(h.vendor) = LOWER(@vendor))`);
    if (hlcAlias) {
      conditions.push(`LOWER(${hlcAlias}.vendor) = LOWER(@vendor)`);
    }
    queryParams.vendor = cleanVendor;
  }

  const cleanSource = params.source && !['all', 'all sources', 'undefined', 'null'].includes(params.source.trim().toLowerCase()) 
    ? params.source.trim() 
    : undefined;
  if (cleanSource) {
    conditions.push(`LOWER(${alias}.offershop_source) = LOWER(@source)`);
    queryParams.source = cleanSource;
  }

  const cleanMedium = params.medium && !['all', 'undefined', 'null'].includes(params.medium.trim().toLowerCase()) 
    ? params.medium.trim() 
    : undefined;
  if (cleanMedium) {
    conditions.push(`LOWER(${alias}.offernet_medium) = LOWER(@medium)`);
    queryParams.medium = cleanMedium;
  }

  const cleanGrade = params.grade && !['all', 'all grades', 'undefined', 'null'].includes(params.grade.trim().toLowerCase()) 
    ? params.grade.trim() 
    : undefined;
  if (cleanGrade) {
    conditions.push(`LOWER(${alias}.offershop_grade) = LOWER(@grade)`);
    queryParams.grade = cleanGrade;
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    queryParams
  };
}

// 1. EXECUTIVE OVERVIEW
export async function getExecutiveOverview(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
  const clientConfig = getClientConfig(params.clientId);
  const { whereSql, queryParams } = buildFilterClause(params);

  const mainQuery = `
    WITH lead_records AS (
      SELECT
        l.lead_id,
        DATE(SAFE_CAST(l.fetched AS TIMESTAMP)) AS fetched_date,
        hlc.vendor,
        hlc.delivered,
        hlc.first_call_date,
        hlc.last_dialer_status,
        hlc.total_calls,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        SAFE_CAST(hlc.sale AS TIMESTAMP) AS sale_ts,
        SAFE_CAST(hlc.activated AS TIMESTAMP) AS activation_ts,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
        hlc.delivered IS NOT NULL AND hlc.delivered NOT LIKE '1900%' AND hlc.delivered NOT LIKE '1970%' AS is_delivered,
        hlc.first_call_date IS NOT NULL AND hlc.first_call_date NOT LIKE '1900%' AND hlc.first_call_date NOT LIKE '1970%' AS is_dialled,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) AS delivery_to_dial_sec,
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) AS delivery_age_sec,
        COALESCE(hlc.revenue_generated, 0) AS revenue
      FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    summary AS (
      SELECT
        COUNT(DISTINCT lead_id) AS fetched_leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered_leads,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled_leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted_leads,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sale_leads,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activated_leads,
        SUM(revenue) AS total_revenue,
        SUM(COALESCE(total_calls, 0)) AS total_calls_recorded
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
        COUNT(DISTINCT CASE WHEN is_dialled AND (last_dialer_status IS NULL OR TRIM(last_dialer_status) = '') THEN lead_id END) AS dialled_missing_disposition,
        COUNT(DISTINCT CASE WHEN is_sale AND NOT is_activated AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) >= 14 THEN lead_id END) AS sales_unactivated_14d,
        APPROX_QUANTILES(CASE WHEN is_dialled AND delivery_to_dial_sec >= 0 THEN delivery_to_dial_sec END, 100)[OFFSET(50)] AS median_delivery_to_dial_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND delivery_to_dial_sec >= 0 THEN delivery_to_dial_sec END, 100)[OFFSET(90)] AS p90_delivery_to_dial_sec
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
    FROM summary
    CROSS JOIN operational
  `;

  const [rows] = await client.query({ query: mainQuery, params: queryParams });
  const data = rows[0] || {};

  const fetched = Number(data.fetched_leads || 0);
  const delivered = Number(data.delivered_leads || 0);
  const dialled = Number(data.dialled_leads || 0);
  const contacted = Number(data.contacted_leads || 0);
  const sales = Number(data.sale_leads || 0);
  const activated = Number(data.activated_leads || 0);
  const revenue = Number(data.total_revenue || 0);
  const totalCalls = Number(data.total_calls_recorded || 0);

  const rates = {
    deliveryRate: fetched > 0 ? Number(((delivered / fetched) * 100).toFixed(1)) : 0,
    dialRate: delivered > 0 ? Number(((dialled / delivered) * 100).toFixed(1)) : 0,
    contactRate: dialled > 0 ? Number(((contacted / dialled) * 100).toFixed(1)) : 0,
    leadToSaleRate: fetched > 0 ? Number(((sales / fetched) * 100).toFixed(2)) : 0,
    contactToSaleRate: contacted > 0 ? Number(((sales / contacted) * 100).toFixed(1)) : 0,
    activationRate: sales > 0 ? Number(((activated / sales) * 100).toFixed(1)) : 0,
  };

  const funnelStages = [
    { key: 'fetched', name: 'Fetched', volume: fetched, rate: 100 },
    { key: 'delivered', name: 'Delivered', volume: delivered, rate: rates.deliveryRate },
    { key: 'dialled', name: 'Dialled', volume: dialled, rate: rates.dialRate },
    { key: 'rpc', name: 'RPC', volume: contacted, rate: rates.contactRate },
    { key: 'sales', name: 'Sales', volume: sales, rate: rates.leadToSaleRate },
    { key: 'activated', name: 'Activated', volume: activated, rate: rates.activationRate },
  ].map((stage, index, stages) => {
    const previous = index === 0 ? null : stages[index - 1];
    const loss = previous ? Math.max(previous.volume - stage.volume, 0) : 0;
    const transitionRate = previous && previous.volume > 0 ? Number(((stage.volume / previous.volume) * 100).toFixed(1)) : 100;
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

  const slaCompliance = delivered > 0
    ? Number(((Number(data.dialled_within_15m || 0) / delivered) * 100).toFixed(1))
    : 0;

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
      detail: 'Recorded sales are at least 14 days old and have no activation timestamp.',
      path: '/sales-activation',
    },
  ].filter(item => item.value > 0);

  let comparison: null | {
    fetchedDelta: number | null;
    deliveryRateDelta: number | null;
    dialRateDelta: number | null;
    contactRateDelta: number | null;
    saleRateDelta: number | null;
    activationRateDelta: number | null;
    revenueDelta: number | null;
    contributionDelta: null;
  } = null;
  let comparisonWindow: { startDate: string; endDate: string } | null = null;

  if (params.startDate && params.endDate) {
    const startMs = Date.parse(params.startDate + 'T00:00:00Z');
    const endMs = Date.parse(params.endDate + 'T00:00:00Z');
    const days = Math.floor((endMs - startMs) / 86400000) + 1;
    if (days > 0 && days <= 366) {
      const previousEnd = new Date(startMs - 86400000);
      const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
      const previousParams = {
        ...params,
        startDate: previousStart.toISOString().slice(0, 10),
        endDate: previousEnd.toISOString().slice(0, 10),
      };
      comparisonWindow = { startDate: previousParams.startDate, endDate: previousParams.endDate };
      const previousScope = buildFilterClause(previousParams);
      const previousQuery = `
        WITH base AS (
          SELECT
            l.lead_id,
            hlc.delivered,
            hlc.first_call_date,
            SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
            hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
            hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
            COALESCE(hlc.revenue_generated, 0) AS revenue
          FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
          LEFT JOIN UNNEST(l.hlc_details) hlc
          ${previousScope.whereSql}
        )
        SELECT
          COUNT(DISTINCT lead_id) AS fetched,
          COUNT(DISTINCT CASE WHEN delivered IS NOT NULL AND delivered NOT LIKE '1900%' AND delivered NOT LIKE '1970%' THEN lead_id END) AS delivered,
          COUNT(DISTINCT CASE WHEN first_call_date IS NOT NULL AND first_call_date NOT LIKE '1900%' AND first_call_date NOT LIKE '1970%' THEN lead_id END) AS dialled,
          COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
          COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
          COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activated,
          SUM(revenue) AS revenue
        FROM base
      `;
      const [previousRows] = await client.query({ query: previousQuery, params: previousScope.queryParams });
      const previous = previousRows[0] || {};
      const pf = Number(previous.fetched || 0), pd = Number(previous.delivered || 0), pdi = Number(previous.dialled || 0);
      const pc = Number(previous.contacted || 0), ps = Number(previous.sales || 0), pa = Number(previous.activated || 0), pr = Number(previous.revenue || 0);
      const pctDelta = (current: number, prior: number) => prior > 0 ? Number((((current - prior) / prior) * 100).toFixed(1)) : null;
      const ppDelta = (current: number, prior: number) => Number((current - prior).toFixed(1));
      comparison = {
        fetchedDelta: pctDelta(fetched, pf),
        deliveryRateDelta: ppDelta(rates.deliveryRate, pf > 0 ? (pd / pf) * 100 : 0),
        dialRateDelta: ppDelta(rates.dialRate, pd > 0 ? (pdi / pd) * 100 : 0),
        contactRateDelta: ppDelta(rates.contactRate, pdi > 0 ? (pc / pdi) * 100 : 0),
        saleRateDelta: Number((rates.leadToSaleRate - (pf > 0 ? (ps / pf) * 100 : 0)).toFixed(2)),
        activationRateDelta: ppDelta(rates.activationRate, ps > 0 ? (pa / ps) * 100 : 0),
        revenueDelta: pctDelta(revenue, pr),
        contributionDelta: null,
      };
    }
  }

  return {
    kpis: {
      fetchedLeads: fetched,
      deliveredLeads: delivered,
      deliveryRate: rates.deliveryRate,
      dialledLeads: dialled,
      dialRate: rates.dialRate,
      contactedLeads: contacted,
      contactRate: rates.contactRate,
      qualifiedLeads: 0,
      saleLeads: sales,
      leadToSaleRate: rates.leadToSaleRate,
      contactToSaleRate: rates.contactToSaleRate,
      activatedLeads: activated,
      activationRate: rates.activationRate,
      totalCalls,
      callsPerLead: fetched > 0 ? Number((totalCalls / fetched).toFixed(1)) : 0,
      callsPerDialledLead: dialled > 0 ? Number((totalCalls / dialled).toFixed(1)) : 0,
      revenue,
      directCost: null,
      deliveryAgentCost: null,
      allocatedCost: null,
      totalCost: null,
      contribution: null,
      marginPct: null,
      costPerSale: null,
      costPerActivation: null,
      revenuePerLead: fetched > 0 ? Number((revenue / fetched).toFixed(2)) : 0,
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
      medianDeliveryToDial: formatDuration(Number(data.median_delivery_to_dial_sec || 0)),
      p90DeliveryToDial: formatDuration(Number(data.p90_delivery_to_dial_sec || 0)),
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

// 2. FUNNEL INTELLIGENCE
export async function getFunnelIntelligence(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH base AS (
      SELECT 
        l.lead_id,
        SAFE_CAST(l.fetched AS TIMESTAMP) as fetched_ts,
        SAFE_CAST(hlc.delivered AS TIMESTAMP) as delivered_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) as first_dial_ts,
        COALESCE(hlc.vendor, 'Unknown') as vendor,
        COALESCE(l.offershop_source, 'Unknown') as source,
        COALESCE(l.offershop_grade, 'Standard') as grade,
        SAFE_CAST(hlc.sale AS TIMESTAMP) as sale_ts,
        SAFE_CAST(hlc.activated AS TIMESTAMP) as activation_ts,
        SAFE_CAST(hlc.rpc AS INT64) > 0 as is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as is_activated,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.delivered AS TIMESTAMP), SAFE_CAST(l.fetched AS TIMESTAMP), SECOND) as fetch_to_delivery_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) as delivery_to_first_dial_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.sale AS TIMESTAMP), SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SECOND) as dial_to_sale_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.activated AS TIMESTAMP), SAFE_CAST(hlc.sale AS TIMESTAMP), SECOND) as sale_to_act_sec
      FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    velocity AS (
      SELECT 
        AVG(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 86400 THEN fetch_to_delivery_sec END) as avg_fetch_delivery_sec,
        AVG(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END) as avg_deliv_dial_sec,
        AVG(CASE WHEN dial_to_sale_sec BETWEEN 0 AND 2592000 THEN dial_to_sale_sec END) as avg_dial_to_sale_sec,
        AVG(CASE WHEN sale_to_act_sec BETWEEN 0 AND 2592000 THEN sale_to_act_sec END) as avg_sale_to_act_sec
      FROM base
    ),
    by_vendor AS (
      SELECT 
        vendor,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN delivered_ts IS NOT NULL THEN lead_id END) as delivered,
        COUNT(DISTINCT CASE WHEN first_dial_ts IS NOT NULL THEN lead_id END) as dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM base
      GROUP BY vendor
      ORDER BY leads DESC
      LIMIT 12
    ),
    by_source AS (
      SELECT 
        source,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM base
      GROUP BY source
      ORDER BY leads DESC
      LIMIT 10
    ),
    by_grade AS (
      SELECT 
        grade,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM base
      GROUP BY grade
      ORDER BY leads DESC
      LIMIT 8
    )
    SELECT 
      (SELECT AS STRUCT * FROM velocity) as velocity,
      ARRAY(SELECT AS STRUCT * FROM by_vendor) as vendors,
      ARRAY(SELECT AS STRUCT * FROM by_source) as sources,
      ARRAY(SELECT AS STRUCT * FROM by_grade) as grades
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || { velocity: {}, vendors: [], sources: [], grades: [] };

  return {
    velocity: {
      fetchToDelivery: formatDuration(data.velocity?.avg_fetch_delivery_sec),
      deliveryToFirstDial: formatDuration(data.velocity?.avg_deliv_dial_sec),
      firstDialToContact: 'Unavailable',
      contactToSale: formatDuration(data.velocity?.avg_dial_to_sale_sec),
      saleToActivation: formatDuration(data.velocity?.avg_sale_to_act_sec)
    },
    byVendor: data.vendors || [],
    bySource: data.sources || [],
    byGrade: data.grades || []
  };
}

// 3. SPEED TO LEAD
export async function getSpeedToLeadAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH stage_timings AS (
      SELECT 
        l.lead_id,
        SAFE_CAST(l.fetched AS TIMESTAMP) as fetched_ts,
        SAFE_CAST(hlc.delivered AS TIMESTAMP) as delivered_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) as first_dial_ts,
        SAFE_CAST(hlc.rpc AS INT64) > 0 as is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as is_activated,
        
        -- Calculated latencies (in seconds)
        TIMESTAMP_DIFF(SAFE_CAST(hlc.attempted_to_deliver AS TIMESTAMP), SAFE_CAST(l.fetched AS TIMESTAMP), SECOND) as capture_to_fetch_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.delivered AS TIMESTAMP), SAFE_CAST(l.fetched AS TIMESTAMP), SECOND) as fetch_to_delivery_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) as delivery_to_first_dial_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(l.fetched AS TIMESTAMP), SECOND) as capture_to_first_dial_sec,
        
        -- After-hours flag (Operating hours 08:00 - 17:30 Monday-Friday)
        EXTRACT(DAYOFWEEK FROM SAFE_CAST(l.fetched AS TIMESTAMP)) IN (1, 7) 
          OR EXTRACT(HOUR FROM SAFE_CAST(l.fetched AS TIMESTAMP)) < 8 
          OR EXTRACT(HOUR FROM SAFE_CAST(l.fetched AS TIMESTAMP)) >= 18 as is_after_hours
      FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    cohorts AS (
      SELECT 
        CASE 
          WHEN capture_to_first_dial_sec <= 300 THEN '0–5 min'
          WHEN capture_to_first_dial_sec <= 900 THEN '5–15 min'
          WHEN capture_to_first_dial_sec <= 1800 THEN '15–30 min'
          WHEN capture_to_first_dial_sec <= 3600 THEN '30–60 min'
          WHEN capture_to_first_dial_sec <= 21600 THEN '1–6 hrs'
          WHEN capture_to_first_dial_sec <= 43200 THEN '6–12 hrs'
          WHEN capture_to_first_dial_sec <= 86400 THEN '12–24 hrs'
          ELSE '24+ hrs'
        END as age_cohort,
        CASE 
          WHEN capture_to_first_dial_sec <= 300 THEN 1
          WHEN capture_to_first_dial_sec <= 900 THEN 2
          WHEN capture_to_first_dial_sec <= 1800 THEN 3
          WHEN capture_to_first_dial_sec <= 3600 THEN 4
          WHEN capture_to_first_dial_sec <= 21600 THEN 5
          WHEN capture_to_first_dial_sec <= 43200 THEN 6
          WHEN capture_to_first_dial_sec <= 86400 THEN 7
          ELSE 8
        END as sort_order,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM stage_timings
      WHERE capture_to_first_dial_sec > 0
      GROUP BY 1, 2
      ORDER BY sort_order ASC
    ),
    after_hours AS (
      SELECT 
        is_after_hours,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations,
        AVG(CASE WHEN capture_to_first_dial_sec > 0 THEN capture_to_first_dial_sec END) as avg_dial_sec
      FROM stage_timings
      GROUP BY is_after_hours
    ),
    percentiles AS (
      SELECT 
        -- Stage 1: Capture -> Fetch
        ROUND(AVG(CASE WHEN capture_to_fetch_sec BETWEEN 0 AND 3600 THEN capture_to_fetch_sec END), 0) as avg_cap_fetch,
        APPROX_QUANTILES(CASE WHEN capture_to_fetch_sec BETWEEN 0 AND 3600 THEN capture_to_fetch_sec END, 100)[OFFSET(50)] as med_cap_fetch,
        APPROX_QUANTILES(CASE WHEN capture_to_fetch_sec BETWEEN 0 AND 3600 THEN capture_to_fetch_sec END, 100)[OFFSET(75)] as p75_cap_fetch,
        APPROX_QUANTILES(CASE WHEN capture_to_fetch_sec BETWEEN 0 AND 3600 THEN capture_to_fetch_sec END, 100)[OFFSET(90)] as p90_cap_fetch,

        -- Stage 2: Fetch -> Delivery
        ROUND(AVG(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 7200 THEN fetch_to_delivery_sec END), 0) as avg_fetch_deliv,
        APPROX_QUANTILES(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 7200 THEN fetch_to_delivery_sec END, 100)[OFFSET(50)] as med_fetch_deliv,
        APPROX_QUANTILES(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 7200 THEN fetch_to_delivery_sec END, 100)[OFFSET(75)] as p75_fetch_deliv,
        APPROX_QUANTILES(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 7200 THEN fetch_to_delivery_sec END, 100)[OFFSET(90)] as p90_fetch_deliv,

        -- Stage 3: Delivery -> First Dial
        ROUND(AVG(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END), 0) as avg_deliv_dial,
        APPROX_QUANTILES(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END, 100)[OFFSET(50)] as med_deliv_dial,
        APPROX_QUANTILES(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END, 100)[OFFSET(75)] as p75_deliv_dial,
        APPROX_QUANTILES(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END, 100)[OFFSET(90)] as p90_deliv_dial,

        -- Stage 4: Capture -> First Dial
        ROUND(AVG(CASE WHEN capture_to_first_dial_sec BETWEEN 0 AND 604800 THEN capture_to_first_dial_sec END), 0) as avg_cap_dial,
        APPROX_QUANTILES(CASE WHEN capture_to_first_dial_sec BETWEEN 0 AND 604800 THEN capture_to_first_dial_sec END, 100)[OFFSET(50)] as med_cap_dial,
        APPROX_QUANTILES(CASE WHEN capture_to_first_dial_sec BETWEEN 0 AND 604800 THEN capture_to_first_dial_sec END, 100)[OFFSET(75)] as p75_cap_dial,
        APPROX_QUANTILES(CASE WHEN capture_to_first_dial_sec BETWEEN 0 AND 604800 THEN capture_to_first_dial_sec END, 100)[OFFSET(90)] as p90_cap_dial
      FROM stage_timings
    )
    SELECT 
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
      stage: 'Capture → Fetch',
      description: 'Lead generation ingestion & schema validation',
      avgSec: numberOrNull(p.avg_cap_fetch),
      medianSec: numberOrNull(p.med_cap_fetch),
      p75Sec: numberOrNull(p.p75_cap_fetch),
      p90Sec: numberOrNull(p.p90_cap_fetch),
      avg: formatDuration(numberOrNull(p.avg_cap_fetch)),
      median: formatDuration(numberOrNull(p.med_cap_fetch)),
      p75: formatDuration(numberOrNull(p.p75_cap_fetch)),
      p90: formatDuration(numberOrNull(p.p90_cap_fetch))
    },
    {
      stage: 'Fetch → Delivery',
      description: 'Routing dispatch to recorded delivery',
      avgSec: numberOrNull(p.avg_fetch_deliv),
      medianSec: numberOrNull(p.med_fetch_deliv),
      p75Sec: numberOrNull(p.p75_fetch_deliv),
      p90Sec: numberOrNull(p.p90_fetch_deliv),
      avg: formatDuration(numberOrNull(p.avg_fetch_deliv)),
      median: formatDuration(numberOrNull(p.med_fetch_deliv)),
      p75: formatDuration(numberOrNull(p.p75_fetch_deliv)),
      p90: formatDuration(numberOrNull(p.p90_fetch_deliv))
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
      p90: formatDuration(numberOrNull(p.p90_deliv_dial))
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
      p90: formatDuration(numberOrNull(p.p90_cap_dial))
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
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      sales,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activations,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0
    };
  });

  const afterHours = (data.after_hours || []).map((a: any) => {
    const leads = Number(a.leads || 0);
    const contacted = Number(a.contacted || 0);
    const sales = Number(a.sales || 0);
    return {
      type: a.is_after_hours ? 'After Hours (Night / Weekend)' : 'Operating Hours (08:00 - 18:00)',
      leads,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      avgTimeToFirstDial: formatDuration(a.avg_dial_sec)
    };
  });

  return {
    timingStages,
    cohorts,
    afterHours
  };
}

// 4. CONTACT STRATEGY
export async function getContactStrategyAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH attempt_summary AS (
      SELECT 
        l.lead_id,
        COALESCE(hlc.total_calls, 0) as call_count,
        SAFE_CAST(hlc.rpc AS INT64) > 0 as is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as is_activated,
        COALESCE(hlc.revenue_generated, 0) as revenue
      FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    brackets AS (
      SELECT 
        CASE 
          WHEN call_count = 0 THEN '0 calls'
          WHEN call_count = 1 THEN '1 call'
          WHEN call_count = 2 THEN '2 calls'
          WHEN call_count = 3 THEN '3 calls'
          WHEN call_count = 4 THEN '4 calls'
          ELSE '5+ calls'
        END as attempt_bucket,
        CASE 
          WHEN call_count = 0 THEN 0
          WHEN call_count = 1 THEN 1
          WHEN call_count = 2 THEN 2
          WHEN call_count = 3 THEN 3
          WHEN call_count = 4 THEN 4
          ELSE 5
        END as bucket_order,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations,
        ROUND(SUM(revenue), 2) as revenue
      FROM attempt_summary
      GROUP BY 1, 2
      ORDER BY bucket_order ASC
    )
    SELECT * FROM brackets
  `;

  const [rows] = await client.query({ query, params: queryParams });
  
  const totalLeads = rows.reduce((acc: number, r: any) => acc + Number(r.leads || 0), 0);

  const attemptPerformance = rows.map((r: any) => {
    const leads = Number(r.leads || 0);
    const contacted = Number(r.contacted || 0);
    const sales = Number(r.sales || 0);
    const activations = Number(r.activations || 0);
    const revenue = Number(r.revenue || 0);

    return {
      bucket: r.attempt_bucket,
      leads,
      sharePct: totalLeads > 0 ? Number(((leads / totalLeads) * 100).toFixed(1)) : 0,
      contacted,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      sales,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activations,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
      revenue,
      callCost: null,
      marginalSales: null,
      marginalCostPerSale: null
    };
  });

  // Call interval cadence & repeated no-answer analysis
  const attemptCadence: Array<{ transition: string; avgSpacing: string; marginalRpcYield: string; costBenefitRatio: string }> = [];

  const noAnswerAnalysis = {
    status: 'UNAVAILABLE',
    reason: 'No approved redial-cost or carrier-reputation contract is configured. Recommendations are withheld.',
    stopThresholdRecommendation: null,
    diminishingReturnsCutoff: null,
    callbackFollowupRate: null,
    callbackSaleConversion: null
  };

  return {
    attemptPerformance,
    attemptCadence,
    noAnswerAnalysis
  };
}

// 5. VENDOR & LEAD QUALITY
export async function getVendorQualityAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH base AS (
      SELECT
        l.lead_id,
        COALESCE(hlc.vendor, 'Unknown') AS vendor,
        COALESCE(l.offershop_source, 'Unknown') AS source,
        COALESCE(l.offershop_grade, 'Standard') AS grade,
        COALESCE(l.offershop_color_vetting, 'Unvetted') AS vetting,
        l.valid_idno,
        l.phone_valid,
        hlc.delivered IS NOT NULL AND hlc.delivered NOT LIKE '1900%' AND hlc.delivered NOT LIKE '1970%' AS is_delivered,
        hlc.first_call_date IS NOT NULL AND hlc.first_call_date NOT LIKE '1900%' AND hlc.first_call_date NOT LIKE '1970%' AS is_dialled,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
        COALESCE(hlc.total_calls, 0) AS total_calls,
        COALESCE(hlc.revenue_generated, 0) AS revenue,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) AS deliv_to_dial_sec
      FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    vendor_matrix AS (
      SELECT
        vendor,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations,
        COUNT(DISTINCT CASE WHEN valid_idno = '0' OR valid_idno = 'false' OR phone_valid = '0' OR phone_valid = 'false' THEN lead_id END) AS invalid_leads,
        SUM(total_calls) AS total_calls,
        ROUND(SUM(revenue), 2) AS revenue,
        APPROX_QUANTILES(CASE WHEN deliv_to_dial_sec >= 0 THEN deliv_to_dial_sec END, 100)[OFFSET(50)] AS med_first_dial_sec
      FROM base
      GROUP BY vendor
      ORDER BY leads DESC
      LIMIT 15
    ),
    source_matrix AS (
      SELECT
        source,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations,
        COUNT(DISTINCT CASE WHEN valid_idno = '0' OR valid_idno = 'false' OR phone_valid = '0' OR phone_valid = 'false' THEN lead_id END) AS invalid_leads
      FROM base
      GROUP BY source
      ORDER BY leads DESC
      LIMIT 15
    ),
    grade_matrix AS (
      SELECT
        grade,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations
      FROM base
      GROUP BY grade
      ORDER BY leads DESC
      LIMIT 10
    ),
    vetting_matrix AS (
      SELECT
        CASE
          WHEN vetting LIKE 'Orange%' THEN 'Orange'
          WHEN vetting LIKE 'Charcoal%' THEN 'Charcoal'
          WHEN vetting LIKE 'Blue%' THEN 'Blue'
          WHEN vetting LIKE 'Green%' THEN 'Green'
          ELSE 'Other / Unvetted'
        END AS vetting_color,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations
      FROM base
      GROUP BY 1
      ORDER BY leads DESC
    )
    SELECT
      ARRAY(SELECT AS STRUCT * FROM vendor_matrix) AS vendors,
      ARRAY(SELECT AS STRUCT * FROM source_matrix) AS sources,
      ARRAY(SELECT AS STRUCT * FROM grade_matrix) AS grades,
      ARRAY(SELECT AS STRUCT * FROM vetting_matrix) AS vetting
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || { vendors: [], sources: [], grades: [], vetting: [] };

  const vendors = (data.vendors || []).map((v: any) => {
    const leads = Number(v.leads || 0), delivered = Number(v.delivered || 0), dialled = Number(v.dialled || 0);
    const contacted = Number(v.contacted || 0), sales = Number(v.sales || 0), activations = Number(v.activations || 0);
    const invalid = Number(v.invalid_leads || 0), totalCalls = Number(v.total_calls || 0), revenue = Number(v.revenue || 0);
    const medianFirstDialSec = v.med_first_dial_sec === null || v.med_first_dial_sec === undefined ? null : Number(v.med_first_dial_sec);
    return {
      vendor: v.vendor,
      leads,
      deliveryRate: leads > 0 ? Number(((delivered / leads) * 100).toFixed(1)) : 0,
      dialRate: delivered > 0 ? Number(((dialled / delivered) * 100).toFixed(1)) : 0,
      contactRate: dialled > 0 ? Number(((contacted / dialled) * 100).toFixed(1)) : 0,
      saleRate: contacted > 0 ? Number(((sales / contacted) * 100).toFixed(2)) : 0,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
      medianFirstDial: formatDuration(medianFirstDialSec),
      medianFirstDialSec,
      callsPerLead: leads > 0 ? Number((totalCalls / leads).toFixed(1)) : 0,
      invalidRate: leads > 0 ? Number(((invalid / leads) * 100).toFixed(1)) : 0,
      revenue,
      directCost: null,
      deliveryCost: null,
      contribution: null,
      marginPct: null
    };
  });

  const sources = (data.sources || []).map((s: any) => {
    const leads = Number(s.leads || 0), delivered = Number(s.delivered || 0), dialled = Number(s.dialled || 0);
    const contacted = Number(s.contacted || 0), sales = Number(s.sales || 0), activations = Number(s.activations || 0), invalid = Number(s.invalid_leads || 0);
    return {
      source: s.source,
      leads,
      delivered,
      dialled,
      contacted,
      sales,
      activations,
      deliveryRate: leads > 0 ? Number(((delivered / leads) * 100).toFixed(1)) : 0,
      dialRate: delivered > 0 ? Number(((dialled / delivered) * 100).toFixed(1)) : 0,
      contactRate: dialled > 0 ? Number(((contacted / dialled) * 100).toFixed(1)) : 0,
      leadToSaleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
      invalidRate: leads > 0 ? Number(((invalid / leads) * 100).toFixed(1)) : 0,
    };
  });

  const outcomeRates = (row: any, labelKey: 'grade' | 'vetting_color') => {
    const leads = Number(row.leads || 0), contacted = Number(row.contacted || 0), sales = Number(row.sales || 0), activations = Number(row.activations || 0);
    return {
      [labelKey]: row[labelKey],
      leads,
      contacted,
      sales,
      activations,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      leadToSaleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
    };
  };

  return {
    vendors,
    sources,
    grades: (data.grades || []).map((row: any) => outcomeRates(row, 'grade')),
    vetting: (data.vetting || []).map((row: any) => outcomeRates(row, 'vetting_color')),
    commercialStatus: 'UNAVAILABLE',
    commercialReason: 'Vendor contribution and margin are withheld until approved cost contracts are configured.'
  };
}

// 6. TEMPORAL INTELLIGENCE (Day x Hour Heatmaps)
export async function getTemporalAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    SELECT 
      EXTRACT(DAYOFWEEK FROM SAFE_CAST(l.fetched AS TIMESTAMP)) as day_of_week,
      EXTRACT(HOUR FROM SAFE_CAST(l.fetched AS TIMESTAMP)) as hour_of_day,
      COUNT(DISTINCT l.lead_id) as volume,
      COUNT(DISTINCT CASE WHEN SAFE_CAST(hlc.rpc AS INT64) > 0 THEN l.lead_id END) as contacted,
      COUNT(DISTINCT CASE WHEN hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' THEN l.lead_id END) as sales,
      COUNT(DISTINCT CASE WHEN hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' THEN l.lead_id END) as activations
    FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    ${whereSql}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;

  const [rows] = await client.query({ query, params: queryParams });

  // Transform into full 7 x 24 grid
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const heatmap: any[] = [];

  for (let d = 1; d <= 7; d++) {
    for (let h = 0; h < 24; h++) {
      const match = rows.find((r: any) => Number(r.day_of_week) === d && Number(r.hour_of_day) === h);
      const volume = match ? Number(match.volume) : 0;
      const contacted = match ? Number(match.contacted) : 0;
      const sales = match ? Number(match.sales) : 0;
      const activations = match ? Number(match.activations) : 0;

      heatmap.push({
        dayIndex: d,
        dayName: days[d - 1],
        hour: h,
        volume,
        contactRate: volume > 0 ? Number(((contacted / volume) * 100).toFixed(1)) : 0,
        saleRate: volume > 0 ? Number(((sales / volume) * 100).toFixed(2)) : 0,
        activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0
      });
    }
  }

  // Rank observed day/hour cells only. No static "best time" claims are injected.
  const peakWindows = heatmap
    .filter(cell => cell.volume > 0)
    .sort((a, b) => (b.contactRate - a.contactRate) || (b.volume - a.volume))
    .slice(0, 4)
    .map(cell => ({
      window: `${cell.dayName} ${String(cell.hour).padStart(2, '0')}:00–${String((cell.hour + 1) % 24).padStart(2, '0')}:00`,
      contactRate: `${cell.contactRate.toFixed(1)}%`,
      saleIndex: cell.saleRate.toFixed(2),
      verdict: 'Observed high-contact window'
    }));

  return {
    heatmap,
    peakWindows
  };
}

// 7. SALES & ACTIVATION INTELLIGENCE
export async function getSalesActivationAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH sales_data AS (
      SELECT 
        l.lead_id,
        hlc.vendor,
        hlc.transaction_id,
        SAFE_CAST(l.fetched AS TIMESTAMP) as fetched_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) as dial_ts,
        SAFE_CAST(hlc.sale AS TIMESTAMP) as sale_ts,
        SAFE_CAST(hlc.activated AS TIMESTAMP) as activation_ts,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as is_activated,
        COALESCE(hlc.revenue_generated, 0) as revenue
      FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    summary AS (
      SELECT 
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as total_sales,
        COUNT(DISTINCT CASE WHEN is_sale AND revenue > 0 THEN lead_id END) as billable_sales,
        COUNT(DISTINCT CASE WHEN is_sale AND (revenue = 0 OR revenue IS NULL) THEN lead_id END) as unbilled_sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as total_activations,
        SUM(revenue) as realized_revenue,
        AVG(CASE WHEN is_sale THEN TIMESTAMP_DIFF(sale_ts, fetched_ts, SECOND) END) as avg_time_to_sale_sec,
        AVG(CASE WHEN is_activated THEN TIMESTAMP_DIFF(activation_ts, sale_ts, SECOND) END) as avg_time_to_activation_sec
      FROM sales_data
    ),
    by_vendor AS (
      SELECT 
        vendor,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations,
        ROUND(SUM(revenue), 2) as revenue
      FROM sales_data
      WHERE vendor IS NOT NULL
      GROUP BY vendor
      ORDER BY sales DESC
      LIMIT 10
    )
    SELECT 
      summary.*,
      ARRAY(SELECT AS STRUCT * FROM by_vendor) as vendors
    FROM summary
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || {};

  const totalSales = Number(data.total_sales || 0);
  const billable = Number(data.billable_sales || 0);
  const activations = Number(data.total_activations || 0);

  // A maturation curve requires a separately validated activation-event model.
  // Do not substitute a static benchmark for observed cohort evidence.
  const maturationCurve: Array<{ day: string; activationSharePct: number; cumulativePct: number }> = [];

  return {
    reconciliation: {
      totalSales,
      billableSales: billable,
      unbilledSales: Number(data.unbilled_sales || 0),
      totalActivations: activations,
      activationRate: totalSales > 0 ? Number(((activations / totalSales) * 100).toFixed(1)) : 0,
      realizedRevenue: Number(data.realized_revenue || 0),
      avgTimeToSale: formatDuration(data.avg_time_to_sale_sec),
      avgTimeToActivation: formatDuration(data.avg_time_to_activation_sec)
    },
    maturationCurve,
    maturationStatus: 'UNAVAILABLE',
    maturationReason: 'Activation maturation is withheld until event-level activation joins are independently validated.',
    byVendor: data.vendors || []
  };
}

// 8. COMMERCIAL INTELLIGENCE
export async function getCommercialAnalytics(params: OffernetQueryParams) {
  const overview = await getExecutiveOverview(params);
  const kpis = overview.kpis;

  return {
    status: 'UNAVAILABLE',
    reason: 'Profitability, CPL, CPC, contribution and break-even metrics are withheld until approved incurred-cost and rate-card contracts are configured.',
    baseline: {
      volume: kpis.fetchedLeads,
      cpl: null,
      cpc: null,
      conversionRate: kpis.leadToSaleRate,
      revenuePerSale: kpis.saleLeads > 0 ? Number((kpis.revenue / kpis.saleLeads).toFixed(2)) : null,
      fixedOverhead: null,
      revenue: kpis.revenue,
      totalCost: null,
      contribution: null,
      marginPct: null,
      costPerSale: null,
      costPerActivation: null,
      breakEvenVolume: null
    },
    currency: overview.currency,
    pAndLBreakdown: [
      { item: 'Recorded Revenue', amount: kpis.revenue, type: 'recorded_revenue' }
    ]
  };
}

// 9. DATA INTEGRITY (DATA HEALTH)
export async function getDataIntegrityAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
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
    FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
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

  return {
    overallHealthScore: null,
    healthGrade: 'NOT_VERIFIED',
    validationStatus: 'NOT_VERIFIED',
    reason: 'Observed discrepancy counts are shown without an invented enterprise health score. Thresholds require approved data-quality contracts.',
    checks,
    totalRecordsAudited: total
  };
}

// 10. AGENT PERFORMANCE
export async function getAgentPerformanceAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
  const clientConfig = getClientConfig(params.clientId);

  if (params.source || params.medium || params.grade || params.campaign) {
    throw new RequestError('Agent performance supports date, tenant and vendor scope only until cross-source call joins are validated.', 422);
  }

  const conditions = ["user IS NOT NULL AND user != ''"];
  const queryParams: Record<string, any> = {};

  if (params.startDate) {
    conditions.push('DATE(SAFE_CAST(call_start_date AS TIMESTAMP)) >= @startDate');
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push('DATE(SAFE_CAST(call_start_date AS TIMESTAMP)) <= @endDate');
    queryParams.endDate = params.endDate;
  }

  if (clientConfig.id !== 'default_tenant') {
    const tenantVendors = clientConfig.semanticMappings.partners || [];
    if (!tenantVendors.length) throw new RequestError('No approved call-vendor mapping exists for this tenant', 422);
    conditions.push('LOWER(vendor) IN UNNEST(@tenantVendors)');
    queryParams.tenantVendors = tenantVendors.map(value => value.toLowerCase());
  }

  const cleanVendor = params.vendor && !['all', 'all vendors', 'undefined', 'null'].includes(params.vendor.trim().toLowerCase())
    ? params.vendor.trim()
    : undefined;
  if (cleanVendor) {
    conditions.push('LOWER(vendor) = LOWER(@vendor)');
    queryParams.vendor = cleanVendor;
  }

  const query = `
    SELECT
      user AS agent_id,
      vendor,
      COUNT(*) AS total_calls,
      COUNT(DISTINCT dialer_lead_id) AS unique_leads,
      COUNTIF(is_rpc = true) AS rpc_count,
      COUNTIF(is_sale = true) AS sale_count,
      SUM(length_in_sec) AS total_talk_time_sec,
      ROUND(AVG(length_in_sec), 1) AS avg_duration_sec,
      COUNTIF(is_callback = true) AS callbacks_booked
    FROM \`dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights\`
    WHERE ${conditions.join(' AND ')}
    GROUP BY user, vendor
    ORDER BY total_calls DESC
    LIMIT 100
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const agents = rows.map((r: any) => {
    const calls = Number(r.total_calls || 0);
    const uniqueLeads = Number(r.unique_leads || 0);
    const rpcs = Number(r.rpc_count || 0);
    const sales = Number(r.sale_count || 0);
    const talkSec = Number(r.total_talk_time_sec || 0);

    return {
      agentId: r.agent_id,
      vendor: r.vendor,
      totalCalls: calls,
      uniqueLeads,
      contactCount: rpcs,
      contactRate: calls > 0 ? Number(((rpcs / calls) * 100).toFixed(1)) : 0,
      salesCount: sales,
      saleRate: rpcs > 0 ? Number(((sales / rpcs) * 100).toFixed(2)) : 0,
      totalTalkTime: formatDuration(talkSec),
      avgHandleTime: `${Math.round(Number(r.avg_duration_sec || 0))}s`,
      callbacksBooked: Number(r.callbacks_booked || 0),
      performanceTier: null
    };
  });

  return {
    agents,
    rankingStatus: 'UNAVAILABLE',
    rankingReason: 'Performance tiers are withheld until an approved agent-performance scoring contract exists.'
  };
}

// 11. CLIENT & CAMPAIGN ANALYSIS
export async function getClientCampaignAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
  const clientConfig = getClientConfig(params.clientId);

  if (clientConfig.id !== 'default_tenant') {
    return {
      campaigns: [],
      status: 'UNAVAILABLE',
      reason: 'Tenant-to-marketing-client mappings are not yet approved for campaign reporting.'
    };
  }
  if (params.vendor || params.source || params.medium || params.grade || params.agent) {
    throw new RequestError('Campaign reporting currently supports date and campaign scope only.', 422);
  }

  const conditions = ['client_name IS NOT NULL'];
  const queryParams: Record<string, any> = {};
  if (params.startDate) {
    conditions.push('DATE(date) >= @startDate');
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push('DATE(date) <= @endDate');
    queryParams.endDate = params.endDate;
  }
  if (params.campaign) {
    conditions.push('LOWER(Channel_Campaign_Name) = LOWER(@campaign)');
    queryParams.campaign = params.campaign;
  }

  const query = `
    SELECT
      client_name,
      channel,
      Channel_Campaign_Name AS campaign_name,
      channel_adset_name AS adset_name,
      SUM(impressions) AS impressions,
      SUM(clicks) AS clicks,
      SUM(actions_lead) AS recorded_leads
    FROM \`dashboards-422710.lead_ledger.lead_ledger_platform_insights\`
    WHERE ${conditions.join(' AND ')}
    GROUP BY 1, 2, 3, 4
    ORDER BY recorded_leads DESC
    LIMIT 100
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const campaigns = rows.map((r: any) => {
    const imp = Number(r.impressions || 0);
    const clicks = Number(r.clicks || 0);
    return {
      client: r.client_name,
      channel: r.channel || 'Unknown',
      campaign: r.campaign_name || 'Unknown',
      adset: r.adset_name || 'Unknown',
      spend: null,
      impressions: imp,
      clicks,
      ctr: imp > 0 ? Number(((clicks / imp) * 100).toFixed(2)) : 0,
      leads: Number(r.recorded_leads || 0),
      cpc: null,
      cpl: null
    };
  });

  return {
    campaigns,
    status: 'PARTIAL',
    reason: 'Budget is not treated as incurred spend. Spend, CPC and CPL are withheld until an approved cost source exists.'
  };
}

// 12. AI OPERATIONAL INSIGHTS (Gemini API with @google/genai)
export async function getAiInsightsAnalytics(_params: OffernetQueryParams) {
  return {
    insights: [],
    source: 'disabled',
    status: 'UNAVAILABLE',
    reason: 'AI operational summaries are disabled until every upstream metric supplied to the model is independently validated.'
  };
}

// 13. RAW DATA EXPLORER & LEAD TIMELINE
export async function getRawLeads(params: OffernetQueryParams) {
  const client = getBigQueryClient('dashboards-422710');
  const limit = Math.min(Math.max(Number(params.limit) || 50, 10), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);

  const { whereSql, queryParams } = buildFilterClause(params);

  let searchCondition = '';
  if (params.search) {
    searchCondition = `AND (
      LOWER(l.lead_id) LIKE LOWER(@search)
      OR CAST(l.consumer_id AS STRING) LIKE @search
      OR LOWER(hlc.vendor) LIKE LOWER(@search)
      OR LOWER(l.offershop_source) LIKE LOWER(@search)
      OR LOWER(hlc.last_dialer_status) LIKE LOWER(@search)
    )`;
    queryParams.search = `%${params.search}%`;
  }

  const query = `
    SELECT 
      l.lead_id,
      l.consumer_id,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', SAFE_CAST(l.fetched AS TIMESTAMP)) as fetched_time,
      COALESCE(l.offershop_source, 'Unknown') as source,
      COALESCE(l.offernet_medium, 'Unknown') as medium,
      COALESCE(l.offershop_grade, 'Standard') as grade,
      COALESCE(l.offershop_color_vetting, 'Unvetted') as vetting,
      l.valid_lead,
      l.valid_idno,
      l.phone_valid,
      hlc.vendor,
      hlc.transaction_id,
      hlc.status,
      hlc.last_dialer_status,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', SAFE_CAST(hlc.delivered AS TIMESTAMP)) as delivered_time,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', SAFE_CAST(hlc.first_call_date AS TIMESTAMP)) as first_call_time,
      COALESCE(hlc.total_calls, 0) as total_calls,
      SAFE_CAST(hlc.rpc AS INT64) > 0 as is_rpc,
      hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as is_sale,
      hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as is_activated,
      COALESCE(hlc.revenue_generated, 0) as revenue
    FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    ${whereSql}
    ${searchCondition}
    ORDER BY SAFE_CAST(l.fetched AS TIMESTAMP) DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const [rows] = await client.query({ query, params: queryParams });
  return {
    rows,
    limit,
    offset
  };
}

// LEAD TIMELINE MODAL DATA
export async function getLeadTimeline(leadId: string, params: Pick<OffernetQueryParams, 'clientId' | 'vendor'>) {
  const client = getBigQueryClient('dashboards-422710');
  const clientConfig = getClientConfig(params.clientId);
  const conditions = ['l.lead_id = @leadId'];
  const queryParams: Record<string, any> = { leadId };
  const callConditions = ['CAST(dialer_lead_id AS STRING) = @leadId'];

  if (clientConfig.id !== 'default_tenant') {
    const tenantVendors = clientConfig.semanticMappings.partners || [];
    if (!tenantVendors.length) throw new RequestError('No approved vendor mapping exists for this tenant', 422);
    conditions.push('LOWER(hlc.vendor) IN UNNEST(@tenantVendors)');
    callConditions.push('LOWER(vendor) IN UNNEST(@tenantVendors)');
    queryParams.tenantVendors = tenantVendors.map(value => value.toLowerCase());
  }

  const cleanVendor = params.vendor && !['all', 'all vendors', 'undefined', 'null'].includes(params.vendor.trim().toLowerCase())
    ? params.vendor.trim()
    : undefined;
  if (cleanVendor) {
    conditions.push('LOWER(hlc.vendor) = LOWER(@vendor)');
    callConditions.push('LOWER(vendor) = LOWER(@vendor)');
    queryParams.vendor = cleanVendor;
  }

  const query = `
    SELECT
      l.lead_id,
      l.consumer_id,
      l.fetched,
      l.offershop_source,
      l.offernet_medium,
      l.offershop_grade,
      l.offershop_color_vetting,
      l.valid_idno,
      l.phone_valid,
      hlc.*
    FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\` l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    WHERE ${conditions.join(' AND ')}
    ORDER BY SAFE_CAST(hlc.delivered AS TIMESTAMP) DESC
    LIMIT 1
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const row = rows[0];
  if (!row) return null;

  let vicidialCalls: any[] = [];
  try {
    const [callRows] = await client.query({
      query: `
        SELECT
          call_start_date,
          call_end_date,
          length_in_sec,
          user,
          status_name,
          is_rpc,
          is_sale,
          is_callback,
          called_count
        FROM \`dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights\`
        WHERE ${callConditions.join(' AND ')}
        ORDER BY SAFE_CAST(call_start_date AS TIMESTAMP) ASC
        LIMIT 500
      `,
      params: queryParams
    });
    vicidialCalls = callRows;
  } catch {
    vicidialCalls = [];
  }

  const events: any[] = [];

  if (row.fetched && !String(row.fetched).startsWith('1900') && !String(row.fetched).startsWith('1970')) {
    events.push({
      stage: 'Captured',
      title: 'Lead Captured & Ingested',
      timestamp: row.fetched,
      status: 'SUCCESS',
      details: `Source: ${row.offershop_source || 'Unknown'} | Medium: ${row.offernet_medium || 'Unknown'} | Grade: ${row.offershop_grade || 'Unknown'}`
    });
  }

  if (row.delivered && !String(row.delivered).startsWith('1900') && !String(row.delivered).startsWith('1970')) {
    events.push({
      stage: 'Delivered',
      title: `Delivery recorded for ${row.vendor || 'Unknown'}`,
      timestamp: row.delivered,
      status: 'SUCCESS',
      details: `Transaction ID: ${row.transaction_id || 'N/A'}`
    });
  }

  if (vicidialCalls.length > 0) {
    vicidialCalls.forEach((call, index) => {
      events.push({
        stage: `Attempt ${call.called_count || index + 1}`,
        title: `Dial attempt ${call.called_count || index + 1} (${call.status_name || 'Disposition recorded'})`,
        timestamp: call.call_start_date,
        status: call.is_rpc ? 'SUCCESS' : 'INFO',
        details: `Agent: ${call.user || 'Unknown'} | Duration: ${call.length_in_sec || 0}s | RPC: ${call.is_rpc ? 'Yes' : 'No'} | Sale flag: ${call.is_sale ? 'Yes' : 'No'}`
      });
    });
  } else if (row.first_call_date && !String(row.first_call_date).startsWith('1900') && !String(row.first_call_date).startsWith('1970')) {
    events.push({
      stage: 'Dialled',
      title: `First dial timestamp recorded (${row.last_dialer_status || 'No disposition'})`,
      timestamp: row.first_call_date,
      status: 'INFO',
      details: `Cumulative call counter: ${row.total_calls ?? 'Unknown'}`
    });
  }

  if (Number(row.rpc || 0) > 0 || vicidialCalls.some(call => call.is_rpc)) {
    events.push({
      stage: 'Contacted',
      title: 'Right Party Contact flag recorded',
      timestamp: row.first_call_date || row.delivered,
      status: 'INFO',
      details: 'RPC evidence is shown as recorded by the source system; no additional customer-verification claim is inferred.'
    });
  }

  if (row.sale && !String(row.sale).startsWith('1900') && !String(row.sale).startsWith('1970')) {
    events.push({
      stage: 'Sale',
      title: 'Sale timestamp recorded',
      timestamp: row.sale,
      status: 'INFO',
      details: `Recorded revenue field: ZAR ${Number(row.revenue_generated || 0).toLocaleString()}`
    });
  }

  if (row.activated && !String(row.activated).startsWith('1900') && !String(row.activated).startsWith('1970')) {
    events.push({
      stage: 'Activated',
      title: 'Activation timestamp recorded',
      timestamp: row.activated,
      status: 'INFO',
      details: 'Activation is reported exactly as represented in the source row; provisioning or collection is not inferred.'
    });
  }

  return {
    leadId: row.lead_id,
    consumerId: row.consumer_id,
    vendor: row.vendor,
    source: row.offershop_source,
    grade: row.offershop_grade,
    events: events.sort((a, b) => Date.parse(a.timestamp || '') - Date.parse(b.timestamp || ''))
  };
}

