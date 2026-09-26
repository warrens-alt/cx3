import { getBigQueryClient } from '../client';
import { getClientConfig } from '../config';
import { getBaseSemanticLayer } from '../views';
import { METRIC_DEFINITIONS } from '../metrics';
import type { BaseQueryParams } from './types';
import { buildWhereClause } from './types';

export async function getFunnelStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNT(DISTINCT lead_id) as captured,
      COUNTIF(valid_lead = true) as valid,
      ${METRIC_DEFINITIONS.delivered_leads.numerator} as delivered,
      ${METRIC_DEFINITIONS.called_leads.numerator} as called,
      ${METRIC_DEFINITIONS.rpcs.numerator} as rpc,
      ${METRIC_DEFINITIONS.sales.numerator} as sale,
      COUNTIF(has_billable_sale = true) as billable_sale,
      ${METRIC_DEFINITIONS.activations.numerator} as activated,
      SUM(IFNULL(total_revenue, 0)) as revenue
    FROM vw_leads
    ${sql}
  `;
  
  const [rows] = await bq.query({ query, params: queryParams });
  const stats = rows[0] || {};
  
  const captured = Number(stats.captured) || 0;
  const valid = Number(stats.valid) || 0;
  const delivered = Number(stats.delivered) || 0;
  const called = Number(stats.called) || 0;
  const rpc = Number(stats.rpc) || 0;
  const sale = Number(stats.sale) || 0;
  const billableSale = Number(stats.billable_sale) || 0;
  const activated = Number(stats.activated) || 0;

  return [
    { stage: 'Fetched Leads', count: captured, rate: 100, itemNo: 22, costMetric: 'CPL.Fetched' },
    { stage: 'Standardised Leads', count: valid, rate: captured > 0 ? Number(((valid / captured) * 100).toFixed(1)) : 0, itemNo: 23, costMetric: 'CPL.Standardised' },
    { stage: 'Delivered Leads', count: delivered, rate: valid > 0 ? Number(((delivered / valid) * 100).toFixed(1)) : 0, itemNo: 33, costMetric: 'CPL.Delivered' },
    { stage: 'Dialed Leads', count: called, rate: delivered > 0 ? Number(((called / delivered) * 100).toFixed(1)) : 0, itemNo: 37, costMetric: 'CPL.Dialed' },
    { stage: 'Right Party Contact', count: rpc, rate: called > 0 ? Number(((rpc / called) * 100).toFixed(1)) : 0, itemNo: 39, costMetric: 'CP.RPC' },
    { stage: 'Sales', count: sale, rate: rpc > 0 ? Number(((sale / rpc) * 100).toFixed(1)) : 0, itemNo: 40, costMetric: 'CP.Sale' },
    { stage: 'Delivered Sales', count: billableSale, rate: sale > 0 ? Number(((billableSale / sale) * 100).toFixed(1)) : 0, itemNo: 45, costMetric: 'CPS.Delivered' },
    { stage: 'Activated Sales', count: activated, rate: billableSale > 0 ? Number(((activated / billableSale) * 100).toFixed(1)) : 0, itemNo: 46, costMetric: 'CPS.Activated' }
  ];
}

export async function getAcquisitionStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  if (!client.semanticMappings.tables.marketing) {
    return { data: [], summary: { spend: 0, leads: 0, cpa: 0 } };
  }
  
  const bq = getBigQueryClient(client.bigQueryProject);
  
  let clauses = [];
  const queryParams: any = {};
  if (params.startDate) {
    clauses.push(`CAST(date AS STRING) >= @startDate`);
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    clauses.push(`CAST(date AS STRING) <= @endDate`);
    queryParams.endDate = params.endDate;
  }
  const sql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const query = `
    SELECT 
      CAST(date AS STRING) as date,
      channel,
      SUM(budget) as spend,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(actions_lead) as leads
    FROM \`${client.semanticMappings.tables.marketing}\`
    ${sql}
    GROUP BY date, channel
    ORDER BY date DESC
    LIMIT 500
  `;

  const { sql: leadsSql, queryParams: leadsParams } = buildWhereClause(params, 'vw_leads');
  const downstreamQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNT(DISTINCT lead_id) as total_leads,
      COUNTIF(has_delivery = true) as total_delivered,
      COUNTIF(has_call = true) as total_called,
      COUNTIF(has_rpc = true) as total_rpcs,
      COUNTIF(has_sale = true) as total_sales,
      COUNTIF(has_billable_sale = true) as total_billable_sales,
      COUNTIF(has_activation = true) as total_activations,
      SUM(IFNULL(total_revenue, 0)) as total_revenue
    FROM vw_leads
    ${leadsSql}
  `;
  
  const [[rows], [downstreamRows]] = await Promise.all([
    bq.query({ query, params: queryParams }),
    bq.query({ query: downstreamQuery, params: leadsParams }).catch(() => [[]])
  ]);
  
  const ds = downstreamRows?.[0] || {};
  const delivered = Number(ds.total_delivered) || 0;
  const called = Number(ds.total_called) || 0;
  const rpcs = Number(ds.total_rpcs) || 0;
  const sales = Number(ds.total_sales) || 0;
  const billableSales = Number(ds.total_billable_sales) || 0;
  const activations = Number(ds.total_activations) || 0;
  const revenue = Number(ds.total_revenue) || 0;

  const summary = rows.reduce((acc: any, row: any) => {
    acc.spend += (Number(row.spend) || 0);
    acc.leads += (Number(row.leads) || 0);
    acc.impressions += (Number(row.impressions) || 0);
    acc.clicks += (Number(row.clicks) || 0);
    return acc;
  }, { spend: 0, leads: 0, impressions: 0, clicks: 0 });
  
  // Downstream funnel attachments to summary
  summary.fetchedLeads = Number(ds.total_leads) || 0;
  summary.delivered = delivered;
  summary.called = called;
  summary.rpcs = rpcs;
  summary.sales = sales;
  summary.billableSales = billableSales;
  summary.activations = activations;
  summary.revenue = revenue;

  if (summary.leads > 0) summary.cpa = summary.spend / summary.leads;
  summary.cpl = summary.leads > 0 ? summary.spend / summary.leads : 0;
  summary.cplFetched = summary.fetchedLeads > 0 ? summary.spend / summary.fetchedLeads : summary.cpl;
  summary.cplDelivered = delivered > 0 ? summary.spend / delivered : 0;
  summary.cplDialed = called > 0 ? summary.spend / called : 0;
  summary.cpRpc = rpcs > 0 ? summary.spend / rpcs : 0;
  summary.cpSale = sales > 0 ? summary.spend / sales : 0;
  summary.cpsDelivered = billableSales > 0 ? summary.spend / billableSales : 0;
  summary.cpsActivated = activations > 0 ? summary.spend / activations : 0;
  summary.roas = summary.spend > 0 ? Number(((revenue / summary.spend) * 100).toFixed(1)) : 0;
  
  const campaignsMap = new Map();
  rows.forEach(r => {
    const c = r.campaign || 'Unknown';
    if (!campaignsMap.has(c)) {
      campaignsMap.set(c, { campaign: c, channel: r.channel, spend: 0, impressions: 0, clicks: 0, leads: 0 });
    }
    const camp = campaignsMap.get(c);
    camp.spend += Number(r.spend);
    camp.impressions += Number(r.impressions);
    camp.clicks += Number(r.clicks);
    camp.leads += Number(r.leads);
  });

  const campaigns = Array.from(campaignsMap.values()).map(c => ({
    ...c,
    ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
    cpa: c.leads > 0 ? c.spend / c.leads : 0
  })).sort((a, b) => b.spend - a.spend);

  return { 
    summary, 
    timeseries: rows,
    campaigns
  };
}
