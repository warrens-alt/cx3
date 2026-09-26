import { getBigQueryClient } from '../client';
import { getClientConfig } from '../config';
import { getBaseSemanticLayer } from '../views';
import type { BaseQueryParams } from './types';
import { buildWhereClause } from './types';

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
