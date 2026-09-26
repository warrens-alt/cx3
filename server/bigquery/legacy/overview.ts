import { getBigQueryClient } from '../client';
import { getClientConfig } from '../config';
import { getBaseSemanticLayer } from '../views';
import type { BaseQueryParams } from './types';
import { buildWhereClause } from './types';
import { percentOrNull, ratioOrNull } from '../../analytics/common/metrics';

export async function getOverviewStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const baseLayer = getBaseSemanticLayer(client);
  
  // PRIMARY OVERVIEW QUERY
  const primaryQuery = `
    ${baseLayer}
    SELECT
      COUNT(DISTINCT lead_id) as leads,
      COUNTIF(routing_depth > 0) as routed_leads,
      COUNTIF(routing_depth > 0 AND total_transactions > 0) as handoff_leads,
      SAFE_DIVIDE(COUNTIF(routing_depth > 0 AND total_transactions > 0), NULLIF(COUNTIF(routing_depth > 0), 0)) * 100 as handoff_rate_pct,
      COUNTIF(has_delivery = true) as delivered,
      COUNTIF(has_call = true) as called,
      COUNTIF(has_rpc = true) as rpcs,
      COUNTIF(has_sale = true) as sales,
      COUNTIF(has_billable_sale = true) as billable_sales,
      COUNTIF(has_sale = true AND has_billable_sale = false) as unbilled_sales,
      COUNTIF(has_activation = true) as activations,
      SUM(total_revenue) as revenue,
      SUM(total_transactions) as transactions,
      SUM(total_calls) as calls_total,
      COUNTIF(hospital_applied_inconsistent = true) as inconsistent_leads
    FROM vw_leads
    ${sql}
  `;

  // TREND QUERY (Daily)
  const trendQuery = `
    ${baseLayer}
    SELECT 
      CAST(capture_date AS STRING) as date,
      COUNT(DISTINCT lead_id) as leads,
      COUNTIF(routing_depth > 0) as routed_leads,
      COUNTIF(has_delivery = true) as delivered,
      COUNTIF(has_call = true) as called,
      COUNTIF(has_sale = true) as sales,
      COUNTIF(has_billable_sale = true) as billable_sales,
      SUM(total_revenue) as revenue
    FROM vw_leads
    ${sql}
    GROUP BY date
    ORDER BY date ASC
  `;

  // SOURCES QUERY
  const sourcesQuery = `
    ${baseLayer}
    SELECT 
      source,
      COUNT(DISTINCT lead_id) as leads,
      COUNTIF(has_billable_sale = true) as billable_sales,
      SUM(total_revenue) as revenue
    FROM vw_leads
    ${sql}
    GROUP BY source
    ORDER BY leads DESC
    LIMIT 10
  `;

  // Execute all 3 primary sub-queries in parallel
  const [primaryResult, trendResult, sourcesResult] = await Promise.all([
    bq.query({ query: primaryQuery, params: queryParams }),
    bq.query({ query: trendQuery, params: queryParams }),
    bq.query({ query: sourcesQuery, params: queryParams })
  ]);

  const [rows] = primaryResult;
  const [trendRows] = trendResult;
  const [sourcesRows] = sourcesResult;

  const data = rows[0] || {};
  
  const leads = Number(data.leads) || 0;
  const routedLeads = Number(data.routed_leads) || 0;
  const handoffLeads = Number(data.handoff_leads) || 0;
  const handoffRate = Number(data.handoff_rate_pct) || 0;
  const delivered = Number(data.delivered) || 0;
  const called = Number(data.called) || 0;
  
  const rpcs = Number(data.rpcs) || 0;
  const sales = Number(data.sales) || 0;
  const billableSales = Number(data.billable_sales) || 0;
  const unbilledSales = Number(data.unbilled_sales) || 0;
  const activations = Number(data.activations) || 0;
  const revenue = Number(data.revenue) || 0;
  const transactions = Number(data.transactions) || 0;
  const callsTotal = Number(data.calls_total) || 0;
  const inconsistentLeads = Number(data.inconsistent_leads) || 0;
  
  let spend = 0;
  if (client.semanticMappings.tables.marketing) {
    let spendSql = '';
    const spendParams = {};
    if (params.startDate) { spendSql += ` CAST(date AS STRING) >= @startDate `; (spendParams as any)['startDate'] = params.startDate; }
    if (params.endDate) { spendSql += (spendSql ? ' AND ' : '') + ` CAST(date AS STRING) <= @endDate `; (spendParams as any)['endDate'] = params.endDate; }
    if (spendSql) spendSql = 'WHERE ' + spendSql;
    
    const spendQuery = `SELECT SUM(budget) as spend FROM \`${client.semanticMappings.tables.marketing}\` ${spendSql}`;
    try {
      const [spendRows] = await bq.query({ query: spendQuery, params: spendParams });
      spend = Number(spendRows[0]?.spend) || 0;
    } catch (e) {
      spend = 0;
    }
  }
  
  const trend = trendRows.map((r: any) => ({
    date: r.date,
    leads: Number(r.leads) || 0,
    routedLeads: Number(r.routed_leads) || 0,
    delivered: Number(r.delivered) || 0,
    called: Number(r.called) || 0,
    sales: Number(r.sales) || 0,
    billableSales: Number(r.billable_sales) || 0,
    revenue: Number(r.revenue) || 0
  }));

  const sources = sourcesRows.map((r: any) => ({
    source: r.source || 'Unknown',
    leads: Number(r.leads) || 0,
    billableSales: Number(r.billable_sales) || 0,
    revenue: Number(r.revenue) || 0
  }));

  // Generate dynamic attention items
  const attentionItems: Array<{
    id: string;
    title: string;
    severity: 'critical' | 'warning' | 'info';
    magnitude: string;
    affected: string;
    reason: string;
    actionPath: string;
    actionLabel: string;
  }> = [];

  if (unbilledSales > 0) {
    attentionItems.push({
      id: 'unbilled_sales',
      title: 'Unbilled Sales (Revenue Leakage)',
      severity: 'critical',
      magnitude: `${unbilledSales} sale events generated R0 revenue`,
      affected: `${((unbilledSales / Math.max(1, sales)) * 100).toFixed(1)}% of total sales`,
      reason: 'Sale flagged in Vicidial / HLC status with zero attributed ledger revenue in activations.',
      actionPath: '/outcomes',
      actionLabel: 'Investigate Outcomes'
    });
  }

  const missingHandoffCount = routedLeads - handoffLeads;
  if (missingHandoffCount > 0 && routedLeads > 0) {
    attentionItems.push({
      id: 'missing_handoffs',
      title: 'Routed Leads Without HLC Transaction',
      severity: 'warning',
      magnitude: `${missingHandoffCount.toLocaleString()} leads stalled at routing stage`,
      affected: `${(100 - handoffRate).toFixed(1)}% dropped before handoff`,
      reason: 'Lead matched an offershop partner ROR timestamp but did not register in subsequent HLC vendor transactions.',
      actionPath: '/routing',
      actionLabel: 'Audit Routing Cascade'
    });
  }

  if (inconsistentLeads > 0) {
    attentionItems.push({
      id: 'inconsistent_vetting',
      title: 'Vetting Timestamp Inconsistency',
      severity: 'info',
      magnitude: `${inconsistentLeads.toLocaleString()} records with sentinel date conflicts`,
      affected: 'Hospital applied flag vs timestamp mismatch',
      reason: 'Flag indicates true while timestamp holds 1900 sentinel value, or vice-versa.',
      actionPath: '/data-trust',
      actionLabel: 'View Trust Matrix'
    });
  }

  return {
    leads,
    routedLeads,
    handoffLeads,
    handoffRate: Number(handoffRate.toFixed(1)),
    delivered,
    called,
    rpcs,
    sales,
    billableSales,
    unbilledSales,
    activations,
    revenue,
    transactions,
    callsTotal,
    deliveryRate: percentOrNull(delivered, leads, 1),
    callCoverage: percentOrNull(called, delivered, 1),
    rpcRate: percentOrNull(rpcs, called, 1),
    saleRate: percentOrNull(sales, called, 1),
    leadToSaleRate: percentOrNull(sales, leads, 1),
    billableSaleRate: percentOrNull(billableSales, sales, 1),
    activationRate: percentOrNull(activations, billableSales, 1),
    revenuePerLead: ratioOrNull(revenue, leads, 2),
    revenuePerBillableSale: ratioOrNull(revenue, billableSales, 2),
    callsPerLead: ratioOrNull(callsTotal, leads, 2),
    callsPerCalledLead: ratioOrNull(callsTotal, called, 2),
    spend,
    cpa: ratioOrNull(spend, leads, 2),
    roas: percentOrNull(revenue, spend, 1),
    trend,
    sources,
    attentionItems,
    dataReadiness: {
      leads: 'RELIABLE',
      delivered: 'RELIABLE',
      called: 'RELIABLE',
      rpcs: 'RELIABLE',
      sales: 'RELIABLE',
      billableSales: 'RELIABLE',
      revenue: 'RELIABLE'
    }
  };
}
