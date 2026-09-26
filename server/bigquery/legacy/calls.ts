import { getBigQueryClient } from '../client';
import { getClientConfig } from '../config';
import { getBaseSemanticLayer } from '../views';
import { METRIC_DEFINITIONS } from '../metrics';
import type { BaseQueryParams } from './types';
import { buildWhereClause } from './types';

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
