import { getBigQueryClient } from './client';
import { getClientConfig } from './config';
import { getBaseSemanticLayer } from './views';
import { METRIC_DEFINITIONS } from './metrics';

export interface BaseQueryParams {
  clientId: string;
  startDate?: string;
  endDate?: string;
  filters?: any;
}

export function buildWhereClause(params: BaseQueryParams, targetView: string = "vw_leads") {
  if (targetView === 'vw_lead_lifecycle') {
    targetView = 'vw_leads';
  }
  let clauses = [];
  const queryParams: any = {};
  
  const dateField = targetView === 'vw_consumers' ? 'DATE(latest_lead_date)' : 'capture_date';
  
  if (params.startDate) {
    clauses.push(`${dateField} >= @startDate`);
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    clauses.push(`${dateField} <= @endDate`);
    queryParams.endDate = params.endDate;
  }

  if (params.filters) {
    let i = 0;
    for (const [key, filter] of Object.entries(params.filters)) {
      const f = filter as any;
      if (!f || !f.operator) continue;
      
      let semanticField = key;
      // Map canonical keys to semantic view columns
      if (key === 'activated') semanticField = 'activation';
      if (key === 'sales') semanticField = 'sale';
      if (key === 'calls') semanticField = 'total_calls';
      
      const paramName = `param_${i}`;
      
      if (f.operator === 'in' && Array.isArray(f.values) && f.values.length > 0) {
        const inParams = f.values.map((v:any, idx:number) => `@${paramName}_${idx}`);
        
        if (key === 'vendor') {
          if (targetView === 'vw_leads' || targetView === 'vw_lead_lifecycle') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.lead_id = ${targetView}.lead_id AND v.vendor IN (${inParams.join(',')}))`);
          } else if (targetView === 'vw_ror_events') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.lead_id = vw_ror_events.lead_id AND v.vendor IN (${inParams.join(',')}))`);
          } else if (targetView === 'vw_consumers') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.consumer_id = vw_consumers.consumer_id AND v.vendor IN (${inParams.join(',')}))`);
          } else {
            clauses.push(`vendor IN (${inParams.join(',')})`);
          }
        } else if (key === 'partner' || key === 'ror_partner') {
          if (targetView === 'vw_ror_events') {
            clauses.push(`partner IN (${inParams.join(',')})`);
          } else {
            clauses.push(`EXISTS (SELECT 1 FROM vw_ror_events r WHERE r.lead_id = ${targetView}.lead_id AND r.partner IN (${inParams.join(',')}))`);
          }
        } else {
          clauses.push(`${semanticField} IN (${inParams.join(',')})`);
        }
        
        f.values.forEach((v:any, idx:number) => {
          queryParams[`${paramName}_${idx}`] = v;
        });
      } else if (f.operator === 'equals' && f.value !== undefined) {
        if (key === 'vendor') {
          if (targetView === 'vw_leads' || targetView === 'vw_lead_lifecycle') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.lead_id = ${targetView}.lead_id AND v.vendor = @${paramName})`);
          } else if (targetView === 'vw_ror_events') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.lead_id = vw_ror_events.lead_id AND v.vendor = @${paramName})`);
          } else if (targetView === 'vw_consumers') {
            clauses.push(`EXISTS (SELECT 1 FROM vw_lead_vendor_transactions v WHERE v.consumer_id = vw_consumers.consumer_id AND v.vendor = @${paramName})`);
          } else {
            clauses.push(`vendor = @${paramName}`);
          }
        } else if (key === 'partner' || key === 'ror_partner') {
          if (targetView === 'vw_ror_events') {
            clauses.push(`partner = @${paramName}`);
          } else {
            clauses.push(`EXISTS (SELECT 1 FROM vw_ror_events r WHERE r.lead_id = ${targetView}.lead_id AND r.partner = @${paramName})`);
          }
        } else {
          clauses.push(`${semanticField} = @${paramName}`);
        }
        queryParams[paramName] = f.value;
      } else if (f.operator === 'not_equals' && f.value !== undefined) {
        clauses.push(`${semanticField} != @${paramName}`);
        queryParams[paramName] = f.value;
      } else if (f.operator === 'between' && f.min !== undefined && f.max !== undefined) {
        clauses.push(`${semanticField} BETWEEN @${paramName}_min AND @${paramName}_max`);
        queryParams[`${paramName}_min`] = f.min;
        queryParams[`${paramName}_max`] = f.max;
      } else if (f.operator === 'greater_than' && f.value !== undefined) {
        clauses.push(`${semanticField} > @${paramName}`);
        queryParams[paramName] = f.value;
      } else if (f.operator === 'less_than' && f.value !== undefined) {
        clauses.push(`${semanticField} < @${paramName}`);
        queryParams[paramName] = f.value;
      }
      i++;
    }
  }

  const sql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { sql, queryParams };
}

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
    deliveryRate: leads > 0 ? Number(((delivered / leads) * 100).toFixed(1)) : 0,
    callCoverage: delivered > 0 ? Number(((called / delivered) * 100).toFixed(1)) : 0,
    rpcRate: called > 0 ? Number(((rpcs / called) * 100).toFixed(1)) : 0,
    saleRate: called > 0 ? Number(((sales / called) * 100).toFixed(1)) : 0,
    leadToSaleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(1)) : 0,
    billableSaleRate: sales > 0 ? Number(((billableSales / sales) * 100).toFixed(1)) : 0,
    activationRate: billableSales > 0 ? Number(((activations / billableSales) * 100).toFixed(1)) : 0,
    revenuePerLead: leads > 0 ? Number((revenue / leads).toFixed(2)) : 0,
    revenuePerBillableSale: billableSales > 0 ? Number((revenue / billableSales).toFixed(2)) : 0,
    callsPerLead: leads > 0 ? Number((callsTotal / leads).toFixed(2)) : 0,
    callsPerCalledLead: called > 0 ? Number((callsTotal / called).toFixed(2)) : 0,
    spend,
    cpa: leads > 0 ? Number((spend / leads).toFixed(2)) : 0,
    roas: spend > 0 ? Number(((revenue / spend) * 100).toFixed(1)) : 0,
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

export async function getDataHealthStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNT(DISTINCT lead_id) as total_leads,
      COUNTIF(sentinel_capture = true) as sentinel_captures,
      COUNTIF(has_delivery = false AND has_rpc = true) as missing_delivery_with_rpc,
      COUNTIF(first_call_timestamp IS NULL AND total_calls > 0) as missing_call_timestamp_with_calls,
      MAX(capture_timestamp) as latest_capture,
      MAX(delivery_timestamp) as latest_delivery,
      MAX(first_call_timestamp) as latest_call,
      MAX(CASE WHEN has_sale = true THEN capture_timestamp ELSE NULL END) as latest_sale
    FROM vw_leads
    ${sql}
  `;
  const [rows] = await bq.query({ query, params: queryParams });
  const row = rows[0] || {};
  const total = Number(row.total_leads) || 0;
  
  const formatTs = (val: any) => {
    if (!val) return 'Unknown';
    const raw = typeof val === 'object' && val.value ? val.value : String(val);
    return raw.substring(0, 10);
  };

  const issues = [];
  if (row.sentinel_captures > 0) {
    issues.push({
      issue: 'Sentinel Capture Timestamps (1900/1970)',
      severity: 'Critical',
      affected: Number(row.sentinel_captures),
      percentage: total > 0 ? ((Number(row.sentinel_captures) / total) * 100).toFixed(2) : 0,
      lastSeen: formatTs(row.latest_capture)
    });
  }
  if (row.missing_delivery_with_rpc > 0) {
    issues.push({
      issue: 'RPC flagged but missing Delivery Timestamp',
      severity: 'Warning',
      affected: Number(row.missing_delivery_with_rpc),
      percentage: total > 0 ? ((Number(row.missing_delivery_with_rpc) / total) * 100).toFixed(2) : 0,
      lastSeen: formatTs(row.latest_capture)
    });
  }
  if (row.missing_call_timestamp_with_calls > 0) {
    issues.push({
      issue: 'Calls > 0 but missing First Call Timestamp',
      severity: 'Warning',
      affected: Number(row.missing_call_timestamp_with_calls),
      percentage: total > 0 ? ((Number(row.missing_call_timestamp_with_calls) / total) * 100).toFixed(2) : 0,
      lastSeen: formatTs(row.latest_capture)
    });
  }
  
  // If no issues, provide a clean slate record
  if (issues.length === 0) {
     issues.push({
      issue: 'No anomalies detected',
      severity: 'Info',
      affected: 0,
      percentage: 0,
      lastSeen: 'N/A'
    });
  }

  return {
    freshness: {
      latestCapture: row.latest_capture ? new Date(row.latest_capture.value || row.latest_capture).toLocaleString() : 'N/A',
      latestDelivery: row.latest_delivery ? new Date(row.latest_delivery.value || row.latest_delivery).toLocaleString() : 'N/A',
      latestCall: row.latest_call ? new Date(row.latest_call.value || row.latest_call).toLocaleString() : 'N/A',
      latestSale: row.latest_sale ? new Date(row.latest_sale.value || row.latest_sale).toLocaleString() : 'N/A'
    },
    issues
  };
}

export async function getCallPerformanceStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql: leadsSql, queryParams: leadsParams } = buildWhereClause(params, 'vw_leads');
  const { sql: txSql, queryParams: txParams } = buildWhereClause(params, 'vw_lead_vendor_transactions');
  
  const summaryQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      ${METRIC_DEFINITIONS.called_leads.numerator} as calledLeads,
      ${METRIC_DEFINITIONS.delivered_leads.numerator} as deliveredLeads,
      ${METRIC_DEFINITIONS.total_calls.numerator} as totalCalls,
      ${METRIC_DEFINITIONS.one_call_leads.numerator} as oneCallLeads,
      ${METRIC_DEFINITIONS.repeat_call_leads.numerator} as repeatCallLeads,
      SUM(IFNULL(total_call_duration_seconds, 0)) as totalDurationSeconds,
      AVG(NULLIF(total_call_duration_seconds, 0)) as avgDurationSeconds
    FROM vw_leads
    ${leadsSql}
  `;
  
  const bucketsQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      CASE 
        WHEN total_calls = 1 THEN '1 Call'
        WHEN total_calls = 2 THEN '2 Calls'
        WHEN total_calls = 3 THEN '3 Calls'
        WHEN total_calls = 4 THEN '4 Calls'
        WHEN total_calls >= 5 THEN '5+ Calls'
        ELSE '0 Calls'
      END as bucket,
      COUNT(DISTINCT lead_id) as current_leads,
      COUNT(DISTINCT lead_id) as previous_leads,
      COUNTIF(has_rpc = true) as rpc_count,
      COUNTIF(has_sale = true) as sale_count,
      COUNTIF(has_activation = true) as activation_count,
      SUM(IFNULL(total_revenue, 0)) as total_revenue,
      SUM(IFNULL(total_call_duration_seconds, 0)) as bucket_duration_seconds
    FROM vw_leads
    ${leadsSql}
    GROUP BY bucket
  `;

  const hourlyQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      EXTRACT(HOUR FROM first_call_timestamp) as hour,
      COUNT(DISTINCT lead_id) as volume,
      COUNTIF(has_rpc = true) as rpc_count,
      COUNTIF(has_sale = true) as sale_count,
      SUM(IFNULL(total_revenue, 0)) as revenue
    FROM vw_leads
    ${leadsSql ? leadsSql + ' AND' : 'WHERE'} first_call_timestamp IS NOT NULL
    GROUP BY hour
    HAVING hour IS NOT NULL AND hour BETWEEN 6 AND 22
    ORDER BY hour ASC
  `;

  const dayOfWeekQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      EXTRACT(DAYOFWEEK FROM first_call_timestamp) as day_num,
      CASE EXTRACT(DAYOFWEEK FROM first_call_timestamp)
        WHEN 1 THEN 'Sun'
        WHEN 2 THEN 'Mon'
        WHEN 3 THEN 'Tue'
        WHEN 4 THEN 'Wed'
        WHEN 5 THEN 'Thu'
        WHEN 6 THEN 'Fri'
        WHEN 7 THEN 'Sat'
      END as day_name,
      COUNT(DISTINCT lead_id) as volume,
      COUNTIF(has_rpc = true) as rpc_count,
      COUNTIF(has_sale = true) as sale_count,
      SUM(IFNULL(total_revenue, 0)) as revenue
    FROM vw_leads
    ${leadsSql ? leadsSql + ' AND' : 'WHERE'} first_call_timestamp IS NOT NULL
    GROUP BY day_num, day_name
    HAVING day_num IS NOT NULL
    ORDER BY day_num ASC
  `;

  const vendorQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COALESCE(vendor, 'Unknown') as vendor,
      COUNT(DISTINCT lead_id) as total_leads,
      COUNTIF(total_calls > 0) as called_leads,
      SUM(total_calls) as total_calls,
      COUNTIF(total_calls = 1) as one_call_leads,
      COUNTIF(rpc = true) as rpc_count,
      COUNTIF(sale = true) as sale_count,
      COUNTIF(activation = true) as activation_count,
      SUM(IFNULL(revenue, 0)) as total_revenue
    FROM vw_lead_vendor_transactions
    ${txSql ? txSql + ' AND' : 'WHERE'} vendor IS NOT NULL
    GROUP BY vendor
    ORDER BY total_leads DESC
    LIMIT 12
  `;

  const dispositionQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COALESCE(NULLIF(TRIM(latest_dialer_status), ''), NULLIF(TRIM(normalised_status_family), ''), 'General / Uncategorized') as disposition,
      COUNT(DISTINCT transaction_id) as volume,
      COUNTIF(rpc = true) as rpc_count,
      COUNTIF(sale = true) as sale_count,
      SUM(IFNULL(revenue, 0)) as total_revenue
    FROM vw_lead_vendor_transactions
    ${txSql ? txSql + ' AND' : 'WHERE'} total_calls > 0
    GROUP BY disposition
    ORDER BY volume DESC
    LIMIT 10
  `;
  
  const [
    [summaryRows], 
    [bucketRows],
    [hourlyRows],
    [dayRows],
    [vendorRows],
    [dispositionRows]
  ] = await Promise.all([
    bq.query({ query: summaryQuery, params: leadsParams }),
    bq.query({ query: bucketsQuery, params: leadsParams }),
    bq.query({ query: hourlyQuery, params: leadsParams }).catch(() => [[]]),
    bq.query({ query: dayOfWeekQuery, params: leadsParams }).catch(() => [[]]),
    bq.query({ query: vendorQuery, params: txParams }).catch(() => [[]]),
    bq.query({ query: dispositionQuery, params: txParams }).catch(() => [[]])
  ]);
  
  const summary = summaryRows[0] || {};
  const calledLeads = Number(summary.calledLeads) || 0;
  const totalCalls = Number(summary.totalCalls) || 0;
  const totalDurationSec = Number(summary.totalDurationSeconds) || 0;
  const avgDurationSec = Number(summary.avgDurationSeconds) || 0;
  
  const formatSecToMinSec = (sec: number) => {
    if (!sec || sec <= 0) return '0m 0s';
    const mins = Math.floor(sec / 60);
    const remainingSecs = Math.round(sec % 60);
    return `${mins}m ${remainingSecs}s`;
  };

  const bucketOrder = ['1 Call', '2 Calls', '3 Calls', '4 Calls', '5+ Calls'];
  const chart = bucketOrder.map(b => {
    const row = bucketRows.find((r: any) => r.bucket === b) || { current: 0, current_leads: 0, previous: 0, previous_leads: 0, rpc_count: 0, sale_count: 0, activation_count: 0, total_revenue: 0, bucket_duration_seconds: 0 };
    const current = Number(row.current ?? row.current_leads) || 0;
    return {
      bucket: b,
      current,
      previous: Number(row.previous ?? row.previous_leads) || 0,
      rpc: current > 0 ? Number(((Number(row.rpc_count) / current) * 100).toFixed(1)) : 0,
      sale: current > 0 ? Number(((Number(row.sale_count) / current) * 100).toFixed(1)) : 0,
      activation: current > 0 ? Number(((Number(row.activation_count) / current) * 100).toFixed(1)) : 0,
      revPerLead: current > 0 ? Number((Number(row.total_revenue) / current).toFixed(2)) : 0,
      totalRevenue: Number(row.total_revenue) || 0,
      avgDurationSec: current > 0 ? Math.round(Number(row.bucket_duration_seconds || 0) / current) : 0
    };
  });

  // Hourly curve
  const hourly = (hourlyRows || []).map((r: any) => {
    const vol = Number(r.volume) || 0;
    const hourNum = Number(r.hour);
    const label = `${hourNum.toString().padStart(2, '0')}:00`;
    return {
      hour: hourNum,
      label,
      volume: vol,
      rpcRate: vol > 0 ? Number(((Number(r.rpc_count) / vol) * 100).toFixed(1)) : 0,
      saleRate: vol > 0 ? Number(((Number(r.sale_count) / vol) * 100).toFixed(1)) : 0,
      revenue: Number(r.revenue) || 0
    };
  });

  // Day of week curve
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayOfWeek = daysOfWeek.map(dayName => {
    const r = (dayRows || []).find((row: any) => row.day_name === dayName) || { volume: 0, rpc_count: 0, sale_count: 0, revenue: 0 };
    const vol = Number(r.volume) || 0;
    return {
      day: dayName,
      volume: vol,
      rpcRate: vol > 0 ? Number(((Number(r.rpc_count) / vol) * 100).toFixed(1)) : 0,
      saleRate: vol > 0 ? Number(((Number(r.sale_count) / vol) * 100).toFixed(1)) : 0,
      revenue: Number(r.revenue) || 0
    };
  });

  // Vendor efficiency
  const vendors = (vendorRows || []).map((r: any) => {
    const called = Number(r.called_leads) || 0;
    const calls = Number(r.total_calls) || 0;
    return {
      vendor: r.vendor,
      totalLeads: Number(r.total_leads) || 0,
      calledLeads: called,
      totalCalls: calls,
      avgCallsPerLead: called > 0 ? Number((calls / called).toFixed(1)) : 0,
      oneCallRate: called > 0 ? Number(((Number(r.one_call_leads) / called) * 100).toFixed(1)) : 0,
      rpcRate: called > 0 ? Number(((Number(r.rpc_count) / called) * 100).toFixed(1)) : 0,
      saleRate: called > 0 ? Number(((Number(r.sale_count) / called) * 100).toFixed(1)) : 0,
      activationRate: called > 0 ? Number(((Number(r.activation_count) / called) * 100).toFixed(1)) : 0,
      revenue: Number(r.total_revenue) || 0,
      revPerLead: called > 0 ? Number((Number(r.total_revenue) / called).toFixed(2)) : 0
    };
  });

  // Dispositions
  const totalDispVolume = (dispositionRows || []).reduce((acc: number, r: any) => acc + (Number(r.volume) || 0), 0);
  const dispositions = (dispositionRows || []).map((r: any) => {
    const vol = Number(r.volume) || 0;
    return {
      disposition: r.disposition,
      volume: vol,
      share: totalDispVolume > 0 ? Number(((vol / totalDispVolume) * 100).toFixed(1)) : 0,
      rpcRate: vol > 0 ? Number(((Number(r.rpc_count) / vol) * 100).toFixed(1)) : 0,
      saleRate: vol > 0 ? Number(((Number(r.sale_count) / vol) * 100).toFixed(1)) : 0,
      revenue: Number(r.total_revenue) || 0
    };
  });

  // Calculate fatigue waste: dials in 5+ bucket that yielded no sale or rpc
  const bucket5 = chart.find(b => b.bucket === '5+ Calls');
  const highDialLeads = bucket5 ? bucket5.current : 0;
  const highDialSales = bucket5 ? Math.round((bucket5.current * bucket5.sale) / 100) : 0;
  const highDialUnconverted = Math.max(0, highDialLeads - highDialSales);

  return {
    calledLeads,
    deliveredLeads: Number(summary.deliveredLeads) || 0,
    totalCalls,
    avgCalls: calledLeads > 0 ? (totalCalls / calledLeads).toFixed(1) : '0.0',
    oneCallLeads: Number(summary.oneCallLeads) || 0,
    oneCallRate: calledLeads > 0 ? ((Number(summary.oneCallLeads) / calledLeads) * 100).toFixed(1) : '0.0',
    repeatCallLeads: Number(summary.repeatCallLeads) || 0,
    repeatCallRate: calledLeads > 0 ? ((Number(summary.repeatCallLeads) / calledLeads) * 100).toFixed(1) : '0.0',
    totalDurationSeconds: totalDurationSec,
    totalDurationHours: (totalDurationSec / 3600).toFixed(1),
    avgDurationSec: Math.round(avgDurationSec),
    avgDuration: avgDurationSec > 0 ? formatSecToMinSec(avgDurationSec) : 'N/A', 
    medianDuration: 'N/A', 
    highDialUnconverted,
    chart,
    hourly,
    dayOfWeek,
    vendors,
    dispositions
  };
}

export async function getSourcesStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT 
      source,
      COUNT(DISTINCT lead_id) as leads,
      COUNTIF(has_delivery = true) as delivery_count,
      COUNTIF(has_call = true) as called_count,
      COUNTIF(has_rpc = true) as rpc_count,
      COUNTIF(has_sale = true) as sale_count,
      COUNTIF(has_billable_sale = true) as billable_sale_count,
      COUNTIF(has_activation = true) as activation_count,
      SUM(IFNULL(total_revenue, 0)) as total_revenue,
      SUM(IFNULL(total_calls, 0)) as total_calls
    FROM vw_leads
    ${sql}
    GROUP BY source
    ORDER BY leads DESC
  `;
  
  const [rows] = await bq.query({ query, params: queryParams });
  const totalLeads = rows.reduce((sum: number, r: any) => sum + (Number(r.leads) || 0), 0);
  
  return rows.map((r: any) => {
    const current = Number(r.leads) || 0;
    const deliv = Number(r.delivery_count) || 0;
    const called = Number(r.called_count) || 0;
    const rpcs = Number(r.rpc_count) || 0;
    const sales = Number(r.sale_count) || 0;
    const billableSales = Number(r.billable_sale_count) || 0;
    const activations = Number(r.activation_count) || 0;
    const revenue = Number(r.total_revenue) || 0;

    return {
      source: r.source || 'Unknown',
      leads: current,
      share: totalLeads > 0 ? Number(((current / totalLeads) * 100).toFixed(1)) : 0,
      delivered: deliv,
      delivery: current > 0 ? Number(((deliv / current) * 100).toFixed(1)) : 0,
      deliveryRate: current > 0 ? Number(((deliv / current) * 100).toFixed(1)) : 0,
      called: called,
      callRate: current > 0 ? Number(((called / current) * 100).toFixed(1)) : 0,
      callCoverage: deliv > 0 ? Number(((called / deliv) * 100).toFixed(1)) : 0,
      rpcs: rpcs,
      rpcRate: called > 0 ? Number(((rpcs / called) * 100).toFixed(1)) : 0,
      sales: sales,
      saleRate: called > 0 ? Number(((sales / called) * 100).toFixed(1)) : 0,
      leadToSaleRate: current > 0 ? Number(((sales / current) * 100).toFixed(1)) : 0,
      billableSales: billableSales,
      billableSaleRate: sales > 0 ? Number(((billableSales / sales) * 100).toFixed(1)) : 0,
      activations: activations,
      activationRate: billableSales > 0 ? Number(((activations / billableSales) * 100).toFixed(1)) : 0,
      revenue: revenue,
      revPerLead: current > 0 ? Number((revenue / current).toFixed(2)) : 0,
      revPerSale: sales > 0 ? Number((revenue / sales).toFixed(2)) : 0
    };
  });
}

export async function getQualityStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNT(DISTINCT lead_id) as total,
      COUNTIF(valid_lead = true) as passed,
      COUNTIF(valid_lead = false) as failed,
      COUNTIF(has_delivery = true) as delivered,
      COUNTIF(has_call = true) as called,
      COUNTIF(has_rpc = true) as rpcs,
      COUNTIF(has_sale = true) as sales,
      COUNTIF(has_billable_sale = true) as billable_sales,
      COUNTIF(has_activation = true) as activations,
      SUM(IFNULL(total_revenue, 0)) as revenue
    FROM vw_leads
    ${sql}
  `;

  const breakdownQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COALESCE(NULLIF(grade, ''), 'Standard') as grade,
      COUNT(DISTINCT lead_id) as leads,
      COUNTIF(has_delivery = true) as delivered,
      COUNTIF(has_call = true) as called,
      COUNTIF(has_rpc = true) as rpcs,
      COUNTIF(has_sale = true) as sales,
      COUNTIF(has_billable_sale = true) as billable_sales,
      COUNTIF(has_activation = true) as activations,
      SUM(IFNULL(total_revenue, 0)) as revenue
    FROM vw_leads
    ${sql}
    GROUP BY grade
    ORDER BY leads DESC
    LIMIT 10
  `;
  
  const [[rows], [gradeRows]] = await Promise.all([
    bq.query({ query, params: queryParams }),
    bq.query({ query: breakdownQuery, params: queryParams }).catch(() => [[]])
  ]);
  
  const stats = rows[0] || { total: 0, passed: 0, failed: 0 };
  const total = Number(stats.total) || 0;
  const passed = Number(stats.passed) || 0;
  const failed = Number(stats.failed) || 0;
  
  const fullFunnelByGrade = (gradeRows || []).map((r: any) => {
    const l = Number(r.leads) || 0;
    const d = Number(r.delivered) || 0;
    const c = Number(r.called) || 0;
    const rpc = Number(r.rpcs) || 0;
    const s = Number(r.sales) || 0;
    const b = Number(r.billable_sales) || 0;
    const a = Number(r.activations) || 0;
    const rev = Number(r.revenue) || 0;

    return {
      grade: r.grade,
      leads: l,
      delivered: d,
      deliveryRate: l > 0 ? Number(((d / l) * 100).toFixed(1)) : 0,
      called: c,
      callRate: l > 0 ? Number(((c / l) * 100).toFixed(1)) : 0,
      rpcs: rpc,
      rpcRate: c > 0 ? Number(((rpc / c) * 100).toFixed(1)) : 0,
      sales: s,
      saleRate: l > 0 ? Number(((s / l) * 100).toFixed(1)) : 0,
      billableSales: b,
      billableSaleRate: s > 0 ? Number(((b / s) * 100).toFixed(1)) : 0,
      activations: a,
      activationRate: s > 0 ? Number(((a / s) * 100).toFixed(1)) : 0,
      revenue: rev,
      revPerLead: l > 0 ? Number((rev / l).toFixed(2)) : 0
    };
  });

  return {
    total,
    passed,
    failed,
    grades: [
      { name: 'Passed Vetting', value: passed, color: '#10b981' },
      { name: 'Failed / Duplicate', value: failed, color: '#f43f5e' }
    ],
    vetting: [
      { name: 'Duplicate', value: failed, color: '#f43f5e' },
      { name: 'Valid', value: passed, color: '#10b981' }
    ],
    passRate: total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0,
    avgScore: 'A-',
    fullFunnelSummary: {
      leads: total,
      passed,
      failed,
      delivered: Number(stats.delivered) || 0,
      called: Number(stats.called) || 0,
      rpcs: Number(stats.rpcs) || 0,
      sales: Number(stats.sales) || 0,
      billableSales: Number(stats.billable_sales) || 0,
      activations: Number(stats.activations) || 0,
      revenue: Number(stats.revenue) || 0,
      deliveryRate: total > 0 ? Number(((Number(stats.delivered) / total) * 100).toFixed(1)) : 0,
      callRate: total > 0 ? Number(((Number(stats.called) / total) * 100).toFixed(1)) : 0,
      rpcRate: Number(stats.called) > 0 ? Number(((Number(stats.rpcs) / Number(stats.called)) * 100).toFixed(1)) : 0,
      saleRate: total > 0 ? Number(((Number(stats.sales) / total) * 100).toFixed(1)) : 0,
      billableSaleRate: Number(stats.sales) > 0 ? Number(((Number(stats.billable_sales) / Number(stats.sales)) * 100).toFixed(1)) : 0,
      activationRate: Number(stats.sales) > 0 ? Number(((Number(stats.activations) / Number(stats.sales)) * 100).toFixed(1)) : 0,
      revPerLead: total > 0 ? Number((Number(stats.revenue) / total).toFixed(2)) : 0
    },
    fullFunnelByGrade,
    chart: fullFunnelByGrade.map(g => ({
      grade: g.grade,
      leads: g.leads,
      rpc: g.rpcs,
      sale: g.sales
    })),
    reasons: [
      { reason: 'Duplicate Record', count: failed, percentage: total > 0 ? Number(((failed / total) * 100).toFixed(1)) : 0 },
      { reason: 'Standard Passed', count: passed, percentage: total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0 }
    ]
  };
}

export async function getSpeedToLeadStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_lead_vendor_transactions');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    , stl_data AS (
      SELECT 
        lead_id,
        TIMESTAMP_DIFF(first_call_timestamp, delivery_timestamp, MINUTE) as stl_minutes,
        CASE WHEN delivery_timestamp >= capture_timestamp THEN TIMESTAMP_DIFF(delivery_timestamp, capture_timestamp, MINUTE) END as c2d_minutes,
        rpc,
        sale,
        is_billable_sale,
        activation,
        IFNULL(revenue, 0) as rev
      FROM vw_lead_vendor_transactions
      ${sql ? sql + ' AND' : 'WHERE'} delivery_timestamp IS NOT NULL
        AND first_call_timestamp IS NOT NULL
        AND first_call_timestamp >= delivery_timestamp
    )
    SELECT
      AVG(stl_minutes) as avg_stl,
      AVG(c2d_minutes) as avg_c2d,
      COUNT(DISTINCT lead_id) as total_called,
      COUNTIF(stl_minutes <= 5) as in_five,
      COUNTIF(stl_minutes <= 60) as in_hour,
      
      COUNTIF(stl_minutes <= 5) as bucket_1_leads,
      COUNTIF(stl_minutes <= 5 AND rpc = true) as bucket_1_rpc,
      COUNTIF(stl_minutes <= 5 AND sale = true) as bucket_1_sale,
      COUNTIF(stl_minutes <= 5 AND is_billable_sale = true) as bucket_1_billable,
      COUNTIF(stl_minutes <= 5 AND activation = true) as bucket_1_activation,
      SUM(CASE WHEN stl_minutes <= 5 THEN rev ELSE 0 END) as bucket_1_revenue,
      
      COUNTIF(stl_minutes > 5 AND stl_minutes <= 15) as bucket_2_leads,
      COUNTIF(stl_minutes > 5 AND stl_minutes <= 15 AND rpc = true) as bucket_2_rpc,
      COUNTIF(stl_minutes > 5 AND stl_minutes <= 15 AND sale = true) as bucket_2_sale,
      COUNTIF(stl_minutes > 5 AND stl_minutes <= 15 AND is_billable_sale = true) as bucket_2_billable,
      COUNTIF(stl_minutes > 5 AND stl_minutes <= 15 AND activation = true) as bucket_2_activation,
      SUM(CASE WHEN stl_minutes > 5 AND stl_minutes <= 15 THEN rev ELSE 0 END) as bucket_2_revenue,
      
      COUNTIF(stl_minutes > 15 AND stl_minutes <= 60) as bucket_3_leads,
      COUNTIF(stl_minutes > 15 AND stl_minutes <= 60 AND rpc = true) as bucket_3_rpc,
      COUNTIF(stl_minutes > 15 AND stl_minutes <= 60 AND sale = true) as bucket_3_sale,
      COUNTIF(stl_minutes > 15 AND stl_minutes <= 60 AND is_billable_sale = true) as bucket_3_billable,
      COUNTIF(stl_minutes > 15 AND stl_minutes <= 60 AND activation = true) as bucket_3_activation,
      SUM(CASE WHEN stl_minutes > 15 AND stl_minutes <= 60 THEN rev ELSE 0 END) as bucket_3_revenue,
      
      COUNTIF(stl_minutes > 60) as bucket_4_leads,
      COUNTIF(stl_minutes > 60 AND rpc = true) as bucket_4_rpc,
      COUNTIF(stl_minutes > 60 AND sale = true) as bucket_4_sale,
      COUNTIF(stl_minutes > 60 AND is_billable_sale = true) as bucket_4_billable,
      COUNTIF(stl_minutes > 60 AND activation = true) as bucket_4_activation,
      SUM(CASE WHEN stl_minutes > 60 THEN rev ELSE 0 END) as bucket_4_revenue
    FROM stl_data
  `;
  
  const [rows] = await bq.query({ query, params: queryParams });
  const stats = rows[0] || {};
  const total = Number(stats.total_called) || 0;

  const buildBucket = (label: string, leads: number, rpcCount: number, saleCount: number, billableCount: number, actCount: number, rev: number) => ({
    bucket: label,
    leads,
    rpcCount,
    rpc: leads > 0 ? Number(((rpcCount / leads) * 100).toFixed(1)) : 0,
    saleCount,
    sale: leads > 0 ? Number(((saleCount / leads) * 100).toFixed(1)) : 0,
    billableCount,
    billableRate: saleCount > 0 ? Number(((billableCount / saleCount) * 100).toFixed(1)) : 0,
    actCount,
    activation: saleCount > 0 ? Number(((actCount / saleCount) * 100).toFixed(1)) : 0,
    revenue: rev,
    revPerLead: leads > 0 ? Number((rev / leads).toFixed(2)) : 0
  });
  
  return {
    metrics: [
      { name: 'Capture to Delivery', avg: stats.avg_c2d != null ? (stats.avg_c2d < 1 ? '< 1m' : `${Math.round(stats.avg_c2d)}m`) : 'N/A', median: 'N/A', p75: 'N/A', p90: 'N/A', p95: 'N/A' },
      { name: 'Delivery to First Call', avg: stats.avg_stl ? `${Math.round(stats.avg_stl)}m` : 'N/A', median: 'N/A', p75: 'N/A', p90: 'N/A', p95: 'N/A' },
    ],
    buckets: [
      buildBucket('< 5m', Number(stats.bucket_1_leads) || 0, Number(stats.bucket_1_rpc) || 0, Number(stats.bucket_1_sale) || 0, Number(stats.bucket_1_billable) || 0, Number(stats.bucket_1_activation) || 0, Number(stats.bucket_1_revenue) || 0),
      buildBucket('5-15m', Number(stats.bucket_2_leads) || 0, Number(stats.bucket_2_rpc) || 0, Number(stats.bucket_2_sale) || 0, Number(stats.bucket_2_billable) || 0, Number(stats.bucket_2_activation) || 0, Number(stats.bucket_2_revenue) || 0),
      buildBucket('15-60m', Number(stats.bucket_3_leads) || 0, Number(stats.bucket_3_rpc) || 0, Number(stats.bucket_3_sale) || 0, Number(stats.bucket_3_billable) || 0, Number(stats.bucket_3_activation) || 0, Number(stats.bucket_3_revenue) || 0),
      buildBucket('> 1h', Number(stats.bucket_4_leads) || 0, Number(stats.bucket_4_rpc) || 0, Number(stats.bucket_4_sale) || 0, Number(stats.bucket_4_billable) || 0, Number(stats.bucket_4_activation) || 0, Number(stats.bucket_4_revenue) || 0),
    ]
  };
}

export async function getCohortStats(params: BaseQueryParams & { cohortType?: string; metricType?: string }) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const cohortType = params.cohortType || 'weekly';
  const metricType = params.metricType || 'sale';

  let cohortExpr = `FORMAT_DATE('%Y-W%W', capture_date)`;
  if (cohortType === 'daily') {
    cohortExpr = `CAST(capture_date AS STRING)`;
  } else if (cohortType === 'monthly') {
    cohortExpr = `FORMAT_DATE('%Y-%m', capture_date)`;
  }

  let maturationExpr = `
    COUNTIF(has_sale = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 0) as m_d0,
    COUNTIF(has_sale = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 1) as m_d1,
    COUNTIF(has_sale = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 3) as m_d3,
    COUNTIF(has_sale = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 7) as m_d7,
    COUNTIF(has_sale = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 14) as m_d14,
    COUNTIF(has_sale = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 30) as m_d30
  `;

  if (metricType === 'call_coverage') {
    maturationExpr = `
      COUNTIF(has_call = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 0) as m_d0,
      COUNTIF(has_call = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 1) as m_d1,
      COUNTIF(has_call = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 3) as m_d3,
      COUNTIF(has_call = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 7) as m_d7,
      COUNTIF(has_call = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 14) as m_d14,
      COUNTIF(has_call = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 30) as m_d30
    `;
  } else if (metricType === 'rpc') {
    maturationExpr = `
      COUNTIF(has_rpc = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 0) as m_d0,
      COUNTIF(has_rpc = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 1) as m_d1,
      COUNTIF(has_rpc = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 3) as m_d3,
      COUNTIF(has_rpc = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 7) as m_d7,
      COUNTIF(has_rpc = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 14) as m_d14,
      COUNTIF(has_rpc = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 30) as m_d30
    `;
  } else if (metricType === 'activation') {
    maturationExpr = `
      COUNTIF(has_activation = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 0) as m_d0,
      COUNTIF(has_activation = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 1) as m_d1,
      COUNTIF(has_activation = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 3) as m_d3,
      COUNTIF(has_activation = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 7) as m_d7,
      COUNTIF(has_activation = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 14) as m_d14,
      COUNTIF(has_activation = true AND TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 30) as m_d30
    `;
  } else if (metricType === 'revenue') {
    maturationExpr = `
      SUM(CASE WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 0 THEN IFNULL(total_revenue, 0) ELSE 0 END) as m_d0,
      SUM(CASE WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 1 THEN IFNULL(total_revenue, 0) ELSE 0 END) as m_d1,
      SUM(CASE WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 3 THEN IFNULL(total_revenue, 0) ELSE 0 END) as m_d3,
      SUM(CASE WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 7 THEN IFNULL(total_revenue, 0) ELSE 0 END) as m_d7,
      SUM(CASE WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 14 THEN IFNULL(total_revenue, 0) ELSE 0 END) as m_d14,
      SUM(CASE WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, DAY) <= 30 THEN IFNULL(total_revenue, 0) ELSE 0 END) as m_d30
    `;
  }

  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      ${cohortExpr} as cohort,
      COUNT(DISTINCT lead_id) as size,
      COUNTIF(has_delivery = true) as delivered,
      COUNTIF(has_call = true) as called,
      COUNTIF(has_rpc = true) as rpcs,
      COUNTIF(has_sale = true) as sales,
      COUNTIF(has_billable_sale = true) as billable_sales,
      COUNTIF(has_activation = true) as activations,
      SUM(IFNULL(total_revenue, 0)) as revenue,
      ${maturationExpr}
    FROM vw_leads
    ${sql}
    GROUP BY cohort
    ORDER BY cohort DESC
    LIMIT 16
  `;
  
  const [rows] = await bq.query({ query, params: queryParams });
  return rows.map((r: any) => {
    const size = Number(r.size) || 0;
    const delivered = Number(r.delivered) || 0;
    const called = Number(r.called) || 0;
    const rpcs = Number(r.rpcs) || 0;
    const sales = Number(r.sales) || 0;
    const billableSales = Number(r.billable_sales) || 0;
    const activations = Number(r.activations) || 0;
    const revenue = Number(r.revenue) || 0;

    const calcMetric = (val: any) => {
      if (val === null || val === undefined) return null;
      const num = Number(val) || 0;
      if (metricType === 'revenue') {
        return size > 0 ? Number((num / size).toFixed(2)) : 0;
      }
      return size > 0 ? Number(((num / size) * 100).toFixed(1)) : 0;
    };

    return {
      cohort: r.cohort || 'Unknown',
      size,
      delivered,
      deliveryRate: size > 0 ? Number(((delivered / size) * 100).toFixed(1)) : 0,
      called,
      callRate: size > 0 ? Number(((called / size) * 100).toFixed(1)) : 0,
      callCoverage: delivered > 0 ? Number(((called / delivered) * 100).toFixed(1)) : 0,
      rpcs,
      rpcRate: called > 0 ? Number(((rpcs / called) * 100).toFixed(1)) : 0,
      sales,
      saleRate: called > 0 ? Number(((sales / called) * 100).toFixed(1)) : 0,
      leadToSaleRate: size > 0 ? Number(((sales / size) * 100).toFixed(1)) : 0,
      billableSales,
      billableSaleRate: sales > 0 ? Number(((billableSales / sales) * 100).toFixed(1)) : 0,
      activations,
      activationRate: billableSales > 0 ? Number(((activations / billableSales) * 100).toFixed(1)) : 0,
      revenue,
      revPerLead: size > 0 ? Number((revenue / size).toFixed(2)) : 0,
      metrics: {
        d0: calcMetric(r.m_d0),
        d1: calcMetric(r.m_d1),
        d3: calcMetric(r.m_d3),
        d7: calcMetric(r.m_d7),
        d14: calcMetric(r.m_d14),
        d30: calcMetric(r.m_d30)
      }
    };
  });
}

export async function getTimeseriesStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      CAST(capture_date AS STRING) as date,
      COUNT(DISTINCT lead_id) as current_val
    FROM vw_leads
    ${sql}
    GROUP BY date
    ORDER BY date ASC
  `;
  const [rows] = await bq.query({ query, params: queryParams });
  return rows.map((r: any) => ({
    date: r.date,
    current: Number(r.current_val) || 0,
    comparison: 0
  }));
}

export async function getLeads(params: BaseQueryParams & { limit?: number; offset?: number }) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      lead_id as id,
      capture_timestamp as captured,
      source,
      medium as campaign,
      CAST(total_calls AS STRING) as calls,
      CASE
        WHEN has_activation = true THEN 'Activated'
        WHEN has_sale = true THEN 'Sale'
        WHEN has_rpc = true THEN 'Contacted'
        WHEN has_call = true THEN 'Called'
        WHEN has_delivery = true THEN 'Delivered'
        ELSE 'Captured'
      END as status,
      IFNULL(CAST(total_revenue AS STRING), '$0') as value,
      'Valid' as quality
    FROM vw_leads
    ${sql}
    ORDER BY capture_timestamp DESC
    LIMIT ${params.limit || 100} OFFSET ${params.offset || 0}
  `;
  const [rows] = await bq.query({ query, params: queryParams });
  return rows;
}


export async function getFilterOptions(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  
  const dateParams: any = {};
  let dateClauses = [];
  if (params.startDate) {
    dateClauses.push(`capture_date >= @startDate`);
    dateParams.startDate = params.startDate;
  }
  if (params.endDate) {
    dateClauses.push(`capture_date <= @endDate`);
    dateParams.endDate = params.endDate;
  }
  const where = dateClauses.length > 0 ? 'WHERE ' + dateClauses.join(' AND ') : '';

  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT DISTINCT 
      source,
      medium,
      grade,
      vetting
    FROM vw_lead_vendor_transactions
    ${where}
    LIMIT 1000
  `;
  
  const vendorQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT 
      vendor as value,
      vendor as label,
      COUNT(DISTINCT lead_id) as uniqueLeads,
      COUNT(1) as transactions
    FROM vw_lead_vendor_transactions
    ${where}
    GROUP BY vendor
    ORDER BY uniqueLeads DESC
    LIMIT 60
  `;
  
  try {
    const [[rows], [vendorRows]] = await Promise.all([
      bq.query({ query, params: dateParams }).catch(err => {
        console.warn('Filter options metadata query error:', err.message);
        return [[]];
      }),
      bq.query({ query: vendorQuery, params: dateParams }).catch(err => {
        console.warn('Vendor options query error:', err.message);
        return [[]];
      })
    ]);
    
    const sources = new Set<string>();
    const mediums = new Set<string>();
    const grades = new Set<string>();
    const vettings = new Set<string>();
    
    (rows || []).forEach((r: any) => {
      if (r.source) sources.add(r.source);
      if (r.medium) mediums.add(r.medium);
      if (r.grade) grades.add(r.grade);
      if (r.vetting) vettings.add(r.vetting);
    });

    return {
      sources: Array.from(sources).sort(),
      mediums: Array.from(mediums).sort(),
      vendors: (vendorRows || []).filter((v: any) => v && v.value),
      grades: Array.from(grades).sort(),
      vettings: Array.from(vettings).sort(),
    };
  } catch (err: any) {
    console.error('Failed in getFilterOptions:', err.message);
    return {
      sources: [],
      mediums: [],
      vendors: [],
      grades: [],
      vettings: [],
    };
  }
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

export async function getOutcomesStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  const { sql: vendorTxSql, queryParams: vendorTxParams } = buildWhereClause(params, 'vw_lead_vendor_transactions');
  
  const summaryQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNTIF(has_activation = true) as total_activations,
      SUM(total_revenue) as total_revenue
    FROM vw_leads
    ${sql}
  `;

  const timeseriesQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      CAST(DATE(capture_timestamp) AS STRING) as date,
      COUNTIF(has_activation = true) as activations,
      SUM(total_revenue) as revenue
    FROM vw_leads
    ${sql}
    GROUP BY date
    ORDER BY date ASC
  `;

  const sourcesQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      source,
      COUNTIF(has_activation = true) as activations,
      SUM(total_revenue) as total_revenue
    FROM vw_leads
    ${sql}
    GROUP BY source
    ORDER BY total_revenue DESC
    LIMIT 20
  `;
  
  const vendorsQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COALESCE(vendor, 'Unknown') as vendor,
      COUNTIF(activation = true) as activations,
      SUM(IFNULL(revenue, 0)) as total_revenue
    FROM vw_lead_vendor_transactions
    ${vendorTxSql ? vendorTxSql + ' AND' : 'WHERE'} vendor IS NOT NULL
    GROUP BY vendor
    ORDER BY total_revenue DESC
    LIMIT 20
  `;

  const [
    [summaryRows],
    [timeseriesRows],
    [sourcesRows],
    [vendorsRows]
  ] = await Promise.all([
    bq.query({ query: summaryQuery, params: queryParams }),
    bq.query({ query: timeseriesQuery, params: queryParams }),
    bq.query({ query: sourcesQuery, params: queryParams }),
    bq.query({ query: vendorsQuery, params: vendorTxParams }).catch(() => [[]])
  ]);

  return {
    summary: summaryRows[0] || { total_activations: 0, total_revenue: 0 },
    timeseries: timeseriesRows || [],
    sources: sourcesRows || [],
    vendors: vendorsRows || []
  };
}

export async function getLeadTimeline(params: BaseQueryParams & { leadId: string }) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      capture_timestamp,
      delivery_timestamp,
      first_call_timestamp,
      sale_timestamp,
      activation_timestamp,
      vendor,
      transaction_id,
      rpc,
      sale,
      activation,
      total_calls,
      latest_dialer_status
    FROM vw_lead_vendor_transactions
    WHERE lead_id = @leadId
    ORDER BY capture_timestamp ASC, delivery_timestamp ASC
  `;

  const [rows] = await bq.query({ query, params: { leadId: params.leadId } });
  
  return rows;
}

export async function getHlcVendorCoverage(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_lead_vendor_transactions');
  
  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      vendor,
      COUNT(transaction_id) as total_transactions,
      COUNT(attempted_delivery_timestamp) / NULLIF(COUNT(transaction_id), 0) as coverage_delivery,
      COUNT(first_call_timestamp) / NULLIF(COUNT(transaction_id), 0) as coverage_first_call,
      COUNT(last_call_timestamp) / NULLIF(COUNT(transaction_id), 0) as coverage_last_call,
      COUNT(latest_dialer_status) / NULLIF(COUNT(transaction_id), 0) as coverage_disposition,
      SUM(IF(total_calls > 0, 1, 0)) / NULLIF(COUNT(transaction_id), 0) as coverage_total_calls,
      SUM(IF(rpc, 1, 0)) / NULLIF(COUNT(transaction_id), 0) as coverage_rpc,
      SUM(IF(sale, 1, 0)) / NULLIF(COUNT(transaction_id), 0) as coverage_sale,
      SUM(IF(activation, 1, 0)) / NULLIF(COUNT(transaction_id), 0) as coverage_activation,
      SUM(IF(revenue > 0, 1, 0)) / NULLIF(COUNT(transaction_id), 0) as coverage_revenue,
      COUNT(latest_dialer_status) / NULLIF(COUNT(transaction_id), 0) as coverage_status
    FROM vw_lead_vendor_transactions
    ${sql}
    GROUP BY vendor
    ORDER BY total_transactions DESC
  `;

  const [rows] = await bq.query({ query, params: queryParams });
  return rows;
}

export async function getRoutingIntelligenceStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql: leadsSql, queryParams: leadsParams } = buildWhereClause(params, 'vw_leads');
  const { sql: rorSql, queryParams: rorParams } = buildWhereClause(params, 'vw_ror_events');

  const overviewQuery = `
    ${getBaseSemanticLayer(client)},
    lead_summary AS (
      SELECT
        COUNT(DISTINCT lead_id) as total_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 0 THEN lead_id END) as total_routed_leads,
        COUNT(DISTINCT CASE WHEN routing_depth = 1 THEN lead_id END) as single_route_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 1 THEN lead_id END) as multi_route_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 0 AND total_transactions > 0 THEN lead_id END) as handoff_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 0 AND total_transactions = 0 THEN lead_id END) as missing_handoff_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 0 AND has_sale THEN lead_id END) as routed_sale_leads,
        COUNT(DISTINCT CASE WHEN routing_depth > 0 AND has_billable_sale THEN lead_id END) as routed_billable_sale_leads,
        SUM(CASE WHEN routing_depth > 0 THEN total_revenue ELSE 0 END) as routed_revenue,
        SUM(total_revenue) as total_revenue,
        AVG(CASE WHEN routing_depth > 0 THEN routing_depth END) as avg_routing_depth
      FROM vw_leads
      ${leadsSql}
    )
    SELECT
      total_leads,
      total_routed_leads,
      SAFE_DIVIDE(total_routed_leads, total_leads) * 100 as routed_lead_share_pct,
      single_route_leads,
      multi_route_leads,
      handoff_leads,
      missing_handoff_leads,
      SAFE_DIVIDE(handoff_leads, total_routed_leads) * 100 as handoff_rate_pct,
      SAFE_DIVIDE(missing_handoff_leads, total_routed_leads) * 100 as missing_handoff_rate_pct,
      routed_sale_leads,
      routed_billable_sale_leads,
      SAFE_DIVIDE(routed_sale_leads, total_routed_leads) * 100 as routed_sale_rate_pct,
      SAFE_DIVIDE(routed_billable_sale_leads, total_routed_leads) * 100 as routed_billable_sale_rate_pct,
      routed_revenue,
      total_revenue,
      SAFE_DIVIDE(routed_revenue, total_routed_leads) as rev_per_routed_lead,
      avg_routing_depth
    FROM lead_summary
  `;

  const depthQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      CASE 
        WHEN routing_depth = 0 THEN '0 Routes (Unrouted)'
        WHEN routing_depth = 1 THEN '1 Partner Route'
        WHEN routing_depth = 2 THEN '2 Partner Routes'
        WHEN routing_depth = 3 THEN '3 Partner Routes'
        WHEN routing_depth = 4 THEN '4 Partner Routes'
        ELSE '5+ Partner Routes'
      END as depth_bucket,
      routing_depth,
      COUNT(DISTINCT lead_id) as leads,
      SAFE_DIVIDE(COUNT(DISTINCT lead_id), (SELECT COUNT(DISTINCT lead_id) FROM vw_leads ${leadsSql})) * 100 as lead_share_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN total_transactions > 0 THEN 1 END), COUNT(*)) * 100 as handoff_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_delivery THEN 1 END), COUNT(*)) * 100 as delivery_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_call THEN 1 END), COUNT(*)) * 100 as call_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_rpc THEN 1 END), COUNT(*)) * 100 as rpc_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_sale THEN 1 END), COUNT(*)) * 100 as sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(*)) as rev_per_lead
    FROM vw_leads
    ${leadsSql}
    GROUP BY depth_bucket, routing_depth
    ORDER BY routing_depth ASC
  `;

  const partnerQuery = `
    ${getBaseSemanticLayer(client)},
    filtered_ror AS (
      SELECT * FROM vw_ror_events
      ${rorSql}
    ),
    partner_handoff AS (
      SELECT 
        r.partner,
        COUNT(DISTINCT r.lead_id) as routed_leads,
        COUNT(DISTINCT CASE WHEN r.route_sequence = 1 THEN r.lead_id END) as first_route_leads,
        COUNT(DISTINCT CASE WHEN r.route_sequence > 1 THEN r.lead_id END) as cascade_route_leads,
        AVG(r.time_from_previous_route_sec) as avg_cascade_delay_sec,
        COUNT(DISTINCT CASE WHEN t.transaction_id IS NOT NULL THEN r.lead_id END) as handoff_leads,
        COUNT(DISTINCT CASE WHEN t.delivery_timestamp IS NOT NULL THEN r.lead_id END) as delivered_leads,
        COUNT(DISTINCT CASE WHEN t.sale THEN r.lead_id END) as sale_leads,
        COUNT(DISTINCT CASE WHEN t.is_billable_sale THEN r.lead_id END) as billable_sale_leads,
        SUM(t.revenue) as total_revenue,
        AVG(TIMESTAMP_DIFF(t.delivery_timestamp, r.ror_timestamp, SECOND)) as avg_handoff_latency_sec
      FROM filtered_ror r
      LEFT JOIN vw_lead_vendor_transactions t ON r.lead_id = t.lead_id
      GROUP BY r.partner
    )
    SELECT
      partner,
      routed_leads,
      first_route_leads,
      cascade_route_leads,
      avg_cascade_delay_sec,
      handoff_leads,
      (routed_leads - handoff_leads) as missing_handoff_leads,
      SAFE_DIVIDE(handoff_leads, routed_leads) * 100 as handoff_rate_pct,
      SAFE_DIVIDE(delivered_leads, routed_leads) * 100 as delivery_rate_pct,
      SAFE_DIVIDE(sale_leads, routed_leads) * 100 as sale_rate_pct,
      SAFE_DIVIDE(billable_sale_leads, routed_leads) * 100 as billable_sale_rate_pct,
      total_revenue,
      SAFE_DIVIDE(total_revenue, routed_leads) as rev_per_lead,
      avg_handoff_latency_sec
    FROM partner_handoff
    ORDER BY routed_leads DESC
  `;

  const pathsQuery = `
    ${getBaseSemanticLayer(client)},
    lead_paths AS (
      SELECT 
        lead_id,
        STRING_AGG(partner, ' -> ' ORDER BY route_sequence ASC) as route_path,
        COUNT(*) as partner_count
      FROM vw_ror_events
      ${rorSql}
      GROUP BY lead_id
    )
    SELECT 
      p.route_path,
      p.partner_count,
      COUNT(DISTINCT l.lead_id) as leads,
      SAFE_DIVIDE(COUNT(DISTINCT l.lead_id), (SELECT COUNT(DISTINCT lead_id) FROM lead_paths)) * 100 as share_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN l.has_delivery THEN 1 END), COUNT(*)) * 100 as deliv_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN l.has_call THEN 1 END), COUNT(*)) * 100 as call_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN l.has_sale THEN 1 END), COUNT(*)) * 100 as sale_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN l.has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_pct,
      SUM(l.total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(l.total_revenue), COUNT(*)) as rev_per_lead
    FROM lead_paths p
    JOIN vw_leads l ON p.lead_id = l.lead_id
    GROUP BY p.route_path, p.partner_count
    ORDER BY leads DESC
    LIMIT 12
  `;

  const missingSampleQuery = `
    ${getBaseSemanticLayer(client)},
    filtered_ror_missing AS (
      SELECT * FROM vw_ror_events
      ${rorSql}
    )
    SELECT 
      r.lead_id,
      r.consumer_id,
      r.partner,
      r.ror_timestamp,
      r.route_sequence,
      l.source,
      l.medium,
      l.capture_timestamp
    FROM filtered_ror_missing r
    JOIN vw_leads l ON r.lead_id = l.lead_id
    WHERE l.total_transactions = 0
    ORDER BY r.capture_timestamp DESC
    LIMIT 20
  `;

  const [
    [overviewRows],
    [depthRows],
    [partnerRows],
    [pathsRows],
    [missingSampleRows]
  ] = await Promise.all([
    bq.query({ query: overviewQuery, params: leadsParams }),
    bq.query({ query: depthQuery, params: leadsParams }),
    bq.query({ query: partnerQuery, params: rorParams }),
    bq.query({ query: pathsQuery, params: rorParams }),
    bq.query({ query: missingSampleQuery, params: rorParams })
  ]);

  return {
    overview: overviewRows[0] || {},
    depthBreakdown: depthRows || [],
    partnerHandoff: partnerRows || [],
    topRoutePaths: pathsRows || [],
    missingSample: missingSampleRows || []
  };
}

export async function getConsumerReentryStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql: consumersSql, queryParams: consumersParams } = buildWhereClause(params, 'vw_consumers');
  const { sql: leadsSql, queryParams: leadsParams } = buildWhereClause(params, 'vw_leads');

  const overviewQuery = `
    ${getBaseSemanticLayer(client)},
    consumer_summary AS (
      SELECT
        COUNT(DISTINCT consumer_id) as total_consumers,
        SUM(lead_count) as total_leads,
        COUNT(DISTINCT CASE WHEN lead_count = 1 THEN consumer_id END) as single_lead_consumers,
        COUNT(DISTINCT CASE WHEN lead_count >= 2 THEN consumer_id END) as repeat_consumers,
        COUNT(DISTINCT CASE WHEN lead_count = 1 AND has_sale THEN consumer_id END) as single_consumers_with_sale,
        COUNT(DISTINCT CASE WHEN lead_count >= 2 AND has_sale THEN consumer_id END) as repeat_consumers_with_sale,
        COUNT(DISTINCT CASE WHEN lead_count = 1 AND has_billable_sale THEN consumer_id END) as single_consumers_with_billable_sale,
        COUNT(DISTINCT CASE WHEN lead_count >= 2 AND has_billable_sale THEN consumer_id END) as repeat_consumers_with_billable_sale,
        SUM(CASE WHEN lead_count = 1 THEN total_revenue ELSE 0 END) as single_consumer_revenue,
        SUM(CASE WHEN lead_count >= 2 THEN total_revenue ELSE 0 END) as repeat_consumer_revenue,
        SUM(total_revenue) as total_revenue
      FROM vw_consumers
      ${consumersSql}
    )
    SELECT
      total_consumers,
      total_leads,
      SAFE_DIVIDE(total_leads, total_consumers) as avg_leads_per_consumer,
      single_lead_consumers,
      repeat_consumers,
      SAFE_DIVIDE(repeat_consumers, total_consumers) * 100 as repeat_consumer_share_pct,
      single_consumers_with_sale,
      repeat_consumers_with_sale,
      SAFE_DIVIDE(single_consumers_with_sale, single_lead_consumers) * 100 as single_sale_rate_pct,
      SAFE_DIVIDE(repeat_consumers_with_sale, repeat_consumers) * 100 as repeat_sale_rate_pct,
      single_consumers_with_billable_sale,
      repeat_consumers_with_billable_sale,
      SAFE_DIVIDE(single_consumers_with_billable_sale, single_lead_consumers) * 100 as single_billable_sale_rate_pct,
      SAFE_DIVIDE(repeat_consumers_with_billable_sale, repeat_consumers) * 100 as repeat_billable_sale_rate_pct,
      single_consumer_revenue,
      repeat_consumer_revenue,
      total_revenue,
      SAFE_DIVIDE(single_consumer_revenue, single_lead_consumers) as rev_per_single_consumer,
      SAFE_DIVIDE(repeat_consumer_revenue, repeat_consumers) as rev_per_repeat_consumer
    FROM consumer_summary
  `;

  const tierQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT 
      CASE 
        WHEN lead_count = 1 THEN '1 Lead'
        WHEN lead_count = 2 THEN '2 Leads'
        WHEN lead_count = 3 THEN '3 Leads'
        WHEN lead_count BETWEEN 4 AND 5 THEN '4-5 Leads'
        ELSE '6+ Leads'
      END as lead_tier,
      COUNT(DISTINCT consumer_id) as consumer_count,
      SAFE_DIVIDE(COUNT(DISTINCT consumer_id), (SELECT COUNT(DISTINCT consumer_id) FROM vw_consumers ${consumersSql})) * 100 as consumer_share_pct,
      SUM(lead_count) as total_leads,
      COUNT(DISTINCT CASE WHEN has_sale THEN consumer_id END) as consumers_with_sale,
      SAFE_DIVIDE(COUNT(DISTINCT CASE WHEN has_sale THEN consumer_id END), COUNT(DISTINCT consumer_id)) * 100 as sale_rate_pct,
      COUNT(DISTINCT CASE WHEN has_billable_sale THEN consumer_id END) as consumers_with_billable_sale,
      SAFE_DIVIDE(COUNT(DISTINCT CASE WHEN has_billable_sale THEN consumer_id END), COUNT(DISTINCT consumer_id)) * 100 as billable_sale_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(DISTINCT consumer_id)) as rev_per_consumer,
      SAFE_DIVIDE(SUM(total_revenue), SUM(lead_count)) as rev_per_lead
    FROM vw_consumers
    ${consumersSql}
    GROUP BY lead_tier
    ORDER BY total_leads DESC
  `;

  const sequenceQuery = `
    ${getBaseSemanticLayer(client)},
    consumer_lead_orders AS (
      SELECT 
        lead_id,
        consumer_id,
        capture_timestamp,
        ROW_NUMBER() OVER(PARTITION BY consumer_id ORDER BY capture_timestamp ASC) as lead_sequence,
        has_delivery,
        has_call,
        has_rpc,
        has_sale,
        has_billable_sale,
        total_revenue
      FROM vw_leads
      WHERE consumer_id > 0
      ${leadsSql ? `AND ${leadsSql.replace('WHERE', '')}` : ''}
    )
    SELECT 
      CASE 
        WHEN lead_sequence = 1 THEN '1st Entry'
        WHEN lead_sequence = 2 THEN '2nd Entry'
        WHEN lead_sequence = 3 THEN '3rd Entry'
        ELSE '4th+ Entry'
      END as entry_stage,
      lead_sequence,
      COUNT(*) as leads,
      SAFE_DIVIDE(COUNT(CASE WHEN has_delivery THEN 1 END), COUNT(*)) * 100 as delivery_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_call THEN 1 END), COUNT(*)) * 100 as call_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_rpc THEN 1 END), COUNT(*)) * 100 as rpc_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_sale THEN 1 END), COUNT(*)) * 100 as sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(*)) as rev_per_lead
    FROM consumer_lead_orders
    GROUP BY entry_stage, lead_sequence
    ORDER BY lead_sequence ASC
    LIMIT 4
  `;

  const sampleQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      consumer_id,
      first_lead_date,
      latest_lead_date,
      lead_count,
      unique_source_count,
      unique_vendor_count,
      transaction_count,
      has_sale,
      has_billable_sale,
      has_activation,
      total_revenue
    FROM vw_consumers
    WHERE lead_count >= 2
    ${consumersSql ? `AND ${consumersSql.replace('WHERE', '')}` : ''}
    ORDER BY total_revenue DESC, lead_count DESC
    LIMIT 25
  `;

  const [
    [overviewRows],
    [tierRows],
    [sequenceRows],
    [sampleRows]
  ] = await Promise.all([
    bq.query({ query: overviewQuery, params: consumersParams }),
    bq.query({ query: tierQuery, params: consumersParams }),
    bq.query({ query: sequenceQuery, params: leadsParams }),
    bq.query({ query: sampleQuery, params: consumersParams })
  ]);

  return {
    overview: overviewRows[0] || {},
    tiers: tierRows || [],
    sequenceEconomics: sequenceRows || [],
    repeatConsumersSample: sampleRows || []
  };
}

export async function getOutcomeQualityStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_lead_vendor_transactions');

  const summaryQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNT(DISTINCT lead_id) as total_leads,
      COUNT(DISTINCT transaction_id) as total_transactions,
      COUNT(CASE WHEN sale THEN 1 END) as total_sales,
      COUNT(CASE WHEN sale THEN 1 END) as total_sale_events,
      COUNT(CASE WHEN is_billable_sale THEN 1 END) as billable_sales,
      COUNT(CASE WHEN sale AND NOT is_billable_sale THEN 1 END) as unbilled_sales,
      COUNT(CASE WHEN activation THEN 1 END) as total_activations,
      SUM(revenue) as total_revenue,
      SAFE_DIVIDE(COUNT(CASE WHEN is_billable_sale THEN 1 END), COUNT(CASE WHEN sale THEN 1 END)) * 100 as billable_conversion_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN is_billable_sale THEN 1 END), COUNT(CASE WHEN sale THEN 1 END)) * 100 as billable_sale_ratio_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN sale AND NOT is_billable_sale THEN 1 END), COUNT(CASE WHEN sale THEN 1 END)) * 100 as revenue_leakage_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN sale AND NOT is_billable_sale THEN 1 END), COUNT(CASE WHEN sale THEN 1 END)) * 100 as revenue_leakage_rate_pct,
      SAFE_DIVIDE(SUM(revenue), COUNT(CASE WHEN is_billable_sale THEN 1 END)) as avg_revenue_per_billable_sale,
      SAFE_DIVIDE(SUM(revenue), COUNT(CASE WHEN is_billable_sale THEN 1 END)) as avg_rev_per_billable_sale,
      SAFE_DIVIDE(SUM(revenue), COUNT(DISTINCT lead_id)) as avg_revenue_per_lead,
      SAFE_DIVIDE(SUM(revenue), COUNT(DISTINCT lead_id)) as rev_per_lead
    FROM vw_lead_vendor_transactions
    ${sql}
  `;

  const vendorStatusQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      IFNULL(vendor, 'Unknown / Direct') as vendor,
      normalised_status_family,
      normalised_status_family as status_family,
      COUNT(DISTINCT lead_id) as leads,
      COUNT(transaction_id) as transactions,
      COUNT(CASE WHEN sale THEN 1 END) as sales,
      COUNT(CASE WHEN sale THEN 1 END) as sale_events,
      COUNT(CASE WHEN is_billable_sale THEN 1 END) as billable_sales,
      COUNT(CASE WHEN sale AND NOT is_billable_sale THEN 1 END) as unbilled_sales,
      COUNT(CASE WHEN activation THEN 1 END) as activations,
      SUM(revenue) as total_revenue,
      SAFE_DIVIDE(COUNT(CASE WHEN is_billable_sale THEN 1 END), COUNT(CASE WHEN sale THEN 1 END)) * 100 as billable_conversion_pct,
      SAFE_DIVIDE(SUM(revenue), COUNT(DISTINCT lead_id)) as rev_per_lead,
      SAFE_DIVIDE(SUM(revenue), COUNT(transaction_id)) as rev_per_transaction
    FROM vw_lead_vendor_transactions
    ${sql}
    GROUP BY vendor, normalised_status_family
    ORDER BY total_revenue DESC, leads DESC
  `;

  const inconsistenciesQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNT(CASE WHEN sale = true AND revenue = 0 THEN 1 END) as sale_zero_revenue_tx,
      COUNT(CASE WHEN revenue > 0 AND sale = false THEN 1 END) as revenue_no_sale_tx,
      COUNT(CASE WHEN activation = true AND sale = false THEN 1 END) as activation_no_sale_tx,
      COUNT(CASE WHEN first_call_timestamp < delivery_timestamp THEN 1 END) as call_before_delivery_tx,
      COUNT(CASE WHEN delivery_timestamp < capture_timestamp THEN 1 END) as delivery_before_capture_tx,
      COUNT(CASE WHEN hospital_applied_inconsistent THEN 1 END) as hospital_applied_inconsistent_tx
    FROM vw_lead_vendor_transactions
    ${sql}
  `;

  const funnelQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNT(DISTINCT lead_id) as step_1_captured_leads,
      COUNT(DISTINCT CASE WHEN delivery_timestamp IS NOT NULL THEN lead_id END) as step_2_delivered_leads,
      COUNT(DISTINCT CASE WHEN first_call_timestamp IS NOT NULL THEN lead_id END) as step_3_called_leads,
      COUNT(DISTINCT CASE WHEN rpc THEN lead_id END) as step_4_rpc_leads,
      COUNT(DISTINCT CASE WHEN sale THEN lead_id END) as step_5_sale_leads,
      COUNT(DISTINCT CASE WHEN is_billable_sale THEN lead_id END) as step_6_billable_sale_leads,
      COUNT(DISTINCT CASE WHEN activation THEN lead_id END) as step_7_activated_leads
    FROM vw_lead_vendor_transactions
    ${sql}
  `;

  const [
    [summaryRows],
    [vendorStatusRows],
    [inconsistenciesRows],
    [funnelRows]
  ] = await Promise.all([
    bq.query({ query: summaryQuery, params: queryParams }),
    bq.query({ query: vendorStatusQuery, params: queryParams }),
    bq.query({ query: inconsistenciesQuery, params: queryParams }),
    bq.query({ query: funnelQuery, params: queryParams })
  ]);

  return {
    summary: summaryRows[0] || {},
    vendorStatusEconomics: vendorStatusRows || [],
    inconsistencies: inconsistenciesRows[0] || {},
    funnel: funnelRows[0] || {}
  };
}

export async function getRevettingStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');

  const comparisonQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      is_revetted,
      COUNT(DISTINCT lead_id) as leads,
      SAFE_DIVIDE(COUNT(DISTINCT lead_id), (SELECT COUNT(DISTINCT lead_id) FROM vw_leads ${sql})) * 100 as lead_share_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_delivery THEN 1 END), COUNT(*)) * 100 as delivery_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_call THEN 1 END), COUNT(*)) * 100 as call_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_rpc THEN 1 END), COUNT(*)) * 100 as rpc_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_sale THEN 1 END), COUNT(*)) * 100 as sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_activation THEN 1 END), COUNT(*)) * 100 as activation_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(*)) as rev_per_lead
    FROM vw_leads
    ${sql}
    GROUP BY is_revetted
    ORDER BY is_revetted ASC
  `;

  const vettingColorQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      vetting,
      is_revetted,
      COUNT(DISTINCT lead_id) as leads,
      SAFE_DIVIDE(COUNT(CASE WHEN has_sale THEN 1 END), COUNT(*)) * 100 as sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(*)) as rev_per_lead
    FROM vw_leads
    ${sql}
    GROUP BY vetting, is_revetted
    ORDER BY leads DESC
  `;

  const [
    [comparisonRows],
    [vettingColorRows]
  ] = await Promise.all([
    bq.query({ query: comparisonQuery, params: queryParams }),
    bq.query({ query: vettingColorQuery, params: queryParams })
  ]);

  return {
    comparison: comparisonRows || [],
    vettingColorBreakdown: vettingColorRows || []
  };
}

export async function getDataTrustStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_lead_vendor_transactions');

  const matrixQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      IFNULL(vendor, 'Unknown / Direct') as vendor,
      COUNT(DISTINCT lead_id) as total_leads,
      COUNT(transaction_id) as total_transactions,
      SAFE_DIVIDE(COUNT(delivery_timestamp), COUNT(*)) * 100 as coverage_delivery_pct,
      SAFE_DIVIDE(COUNT(attempted_delivery_timestamp), COUNT(*)) * 100 as coverage_attempted_delivery_pct,
      SAFE_DIVIDE(COUNT(first_call_timestamp), COUNT(*)) * 100 as coverage_first_call_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN total_calls > 0 THEN 1 END), COUNT(*)) * 100 as coverage_total_calls_pct,
      SAFE_DIVIDE(COUNT(latest_dialer_status), COUNT(*)) * 100 as coverage_disposition_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN rpc THEN 1 END), COUNT(*)) * 100 as coverage_rpc_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN sale THEN 1 END), COUNT(*)) * 100 as coverage_sale_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN is_billable_sale THEN 1 END), COUNT(*)) * 100 as coverage_billable_sale_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN activation THEN 1 END), COUNT(*)) * 100 as coverage_activation_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN revenue > 0 THEN 1 END), COUNT(*)) * 100 as coverage_revenue_pct,
      SUM(revenue) as total_revenue
    FROM vw_lead_vendor_transactions
    ${sql}
    GROUP BY vendor
    ORDER BY total_leads DESC
  `;

  const timingQuery = `
    ${getBaseSemanticLayer(client)}
    SELECT
      COUNT(*) as total_records,
      COUNT(CASE WHEN first_call_timestamp < delivery_timestamp THEN 1 END) as call_before_delivery_count,
      COUNT(CASE WHEN delivery_timestamp < capture_timestamp THEN 1 END) as delivery_before_capture_count,
      COUNT(CASE WHEN sentinel_capture THEN 1 END) as sentinel_capture_count,
      COUNT(CASE WHEN hospital_applied_inconsistent THEN 1 END) as hospital_applied_inconsistent_count
    FROM vw_lead_vendor_transactions
    ${sql}
  `;

  const [
    [matrixRows],
    [timingRows]
  ] = await Promise.all([
    bq.query({ query: matrixQuery, params: queryParams }),
    bq.query({ query: timingQuery, params: queryParams })
  ]);

  const vendors = matrixRows.map((v: any) => {
    const getStatus = (pct: number) => {
      if (pct >= 75) return 'RELIABLE';
      if (pct >= 25) return 'PARTIAL';
      if (pct > 0) return 'INSUFFICIENT DATA';
      return 'UNAVAILABLE';
    };

    return {
      ...v,
      status_delivery: getStatus(v.coverage_delivery_pct || 0),
      status_calls: getStatus(v.coverage_first_call_pct || 0),
      status_rpc: getStatus(v.coverage_rpc_pct || 0),
      status_sale: getStatus(v.coverage_sale_pct || 0),
      status_revenue: getStatus(v.coverage_revenue_pct || 0),
      status_activation: getStatus(v.coverage_activation_pct || 0)
    };
  });

  return {
    vendorCapabilities: vendors,
    timingAnomalies: timingRows[0] || {}
  };
}

export async function getMultiVendorStats(params: BaseQueryParams) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildWhereClause(params, 'vw_leads');

  const query = `
    ${getBaseSemanticLayer(client)}
    SELECT
      CASE 
        WHEN vendor_count = 0 THEN '0 Vendors'
        WHEN vendor_count = 1 THEN '1 Vendor'
        WHEN vendor_count = 2 THEN '2 Vendors'
        WHEN vendor_count = 3 THEN '3 Vendors'
        ELSE '4+ Vendors'
      END as vendor_count_bucket,
      vendor_count,
      COUNT(DISTINCT lead_id) as leads,
      SAFE_DIVIDE(COUNT(DISTINCT lead_id), (SELECT COUNT(DISTINCT lead_id) FROM vw_leads ${sql})) * 100 as lead_share_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_call THEN 1 END), COUNT(*)) * 100 as call_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_rpc THEN 1 END), COUNT(*)) * 100 as rpc_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_sale THEN 1 END), COUNT(*)) * 100 as sale_rate_pct,
      SAFE_DIVIDE(COUNT(CASE WHEN has_billable_sale THEN 1 END), COUNT(*)) * 100 as billable_sale_rate_pct,
      SUM(total_revenue) as total_revenue,
      SAFE_DIVIDE(SUM(total_revenue), COUNT(*)) as rev_per_lead
    FROM vw_leads
    ${sql}
    GROUP BY vendor_count_bucket, vendor_count
    ORDER BY vendor_count ASC
  `;

  const [rows] = await bq.query({ query, params: queryParams });
  return rows;
}
