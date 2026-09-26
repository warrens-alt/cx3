import { getBigQueryClient } from '../client';
import { getClientConfig } from '../config';
import { getBaseSemanticLayer } from '../views';
import type { BaseQueryParams } from './types';
import { buildWhereClause } from './types';

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
