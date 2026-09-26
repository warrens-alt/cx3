import { BigQuery } from '@google-cloud/bigquery';

interface QueryParams {
  projectId: string;
  datasetId: string;
  tableId: string;
  startDate?: string;
  endDate?: string;
  source?: string;
  medium?: string;
}

function getBaseClient(projectId: string) {
  // Use credentials from env if available, otherwise assume Application Default Credentials (ADC)
  let credentials;
  try {
    if (process.env.BIGQUERY_CREDENTIALS) {
      credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);
    }
  } catch (e) {
    console.warn("Failed to parse BIGQUERY_CREDENTIALS, falling back to ADC");
  }
  return new BigQuery({ projectId, credentials });
}

export async function getOverviewStats(params: QueryParams) {
  const { projectId, datasetId, tableId, startDate, endDate, source, medium } = params;
  const bq = getBaseClient(projectId);
  
  let whereClauses = [];
  if (startDate) whereClauses.push(`DATE(capture_timestamp) >= '${startDate}'`);
  if (endDate) whereClauses.push(`DATE(capture_timestamp) <= '${endDate}'`);
  if (source) whereClauses.push(`source = '${source}'`);
  if (medium) whereClauses.push(`medium = '${medium}'`);
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const query = `
    SELECT
      COUNT(lead_id) as leads,
      COUNTIF(delivery_timestamp IS NOT NULL) as delivered,
      COUNTIF(first_call_timestamp IS NOT NULL) as called,
      COUNTIF(rpc = true) as rpcs,
      COUNTIF(sale = true) as sales,
      COUNTIF(activation = true) as activations,
      SUM(IFNULL(revenue, 0)) as revenue,
      0 as duplicates,
      SUM(IFNULL(calls, 0)) as calls_total
    FROM \`${projectId}.${datasetId}.${tableId}\`
    ${whereSql}
  `;
  
  try {
    const [rows] = await bq.query({ query });
    return rows[0] || null;
  } catch (error: any) {
    throw new Error(`BigQuery overview query failed: ${error.message}`);
  }
}

export async function getCallPerformanceStats(params: QueryParams) {
  const { projectId, datasetId, tableId, startDate, endDate, source, medium } = params;
  const bq = getBaseClient(projectId);
  
  let whereClauses = [];
  if (startDate) whereClauses.push(`DATE(capture_timestamp) >= '${startDate}'`);
  if (endDate) whereClauses.push(`DATE(capture_timestamp) <= '${endDate}'`);
  if (source) whereClauses.push(`source = '${source}'`);
  if (medium) whereClauses.push(`medium = '${medium}'`);
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const summaryQuery = `
    SELECT
      COUNTIF(first_call_timestamp IS NOT NULL) as calledLeads,
      COUNTIF(delivery_timestamp IS NOT NULL) as deliveredLeads,
      SUM(IFNULL(calls, 0)) as totalCalls,
      COUNTIF(calls = 1) as oneCallLeads,
      COUNTIF(calls > 1) as repeatCallLeads
    FROM \`${projectId}.${datasetId}.${tableId}\`
    ${whereSql}
  `;

  const bucketsQuery = `
    SELECT
      CASE 
        WHEN calls = 1 THEN '1 Call'
        WHEN calls = 2 THEN '2 Calls'
        WHEN calls = 3 THEN '3 Calls'
        WHEN calls = 4 THEN '4 Calls'
        WHEN calls >= 5 THEN '5+ Calls'
        ELSE '0 Calls'
      END as bucket,
      COUNT(lead_id) as current,
      COUNT(lead_id) as previous,
      COUNTIF(delivery_timestamp IS NOT NULL) as delivery_count,
      COUNTIF(first_call_timestamp IS NOT NULL) as called_count,
      0 as dupe_count,
      COUNTIF(rpc = true) as rpc_count,
      COUNTIF(sale = true) as sale_count,
      COUNTIF(activation = true) as activation_count,
      SUM(IFNULL(revenue, 0)) as total_revenue
    FROM \`${projectId}.${datasetId}.${tableId}\`
    ${whereSql}
    GROUP BY bucket
  `;

  try {
    const [[summaryRows], [bucketRows]] = await Promise.all([
      bq.query({ query: summaryQuery }),
      bq.query({ query: bucketsQuery })
    ]);

    const summary = summaryRows[0] || {};
    const calledLeads = Number(summary.calledLeads) || 0;
    
    // Sort buckets
    const bucketOrder = ['1 Call', '2 Calls', '3 Calls', '4 Calls', '5+ Calls'];
    const chart = bucketOrder.map(b => {
      const row = bucketRows.find((r: any) => r.bucket === b) || { current: 0, previous: 0, rpc_count: 0, sale_count: 0, activation_count: 0, total_revenue: 0 };
      const current = Number(row.current) || 0;
      return {
        bucket: b,
        current: current,
        previous: Number(row.previous) || 0,
        rpc: current > 0 ? Number(((Number(row.rpc_count) / current) * 100).toFixed(1)) : 0,
        sale: current > 0 ? Number(((Number(row.sale_count) / current) * 100).toFixed(1)) : 0,
        activation: current > 0 ? Number(((Number(row.activation_count) / current) * 100).toFixed(1)) : 0,
        revPerLead: current > 0 ? Number((Number(row.total_revenue) / current).toFixed(2)) : 0
      };
    });

    return {
      calledLeads,
      deliveredLeads: Number(summary.deliveredLeads) || 0,
      avgCalls: calledLeads > 0 ? (Number(summary.totalCalls) / calledLeads).toFixed(1) : 0,
      oneCallLeads: Number(summary.oneCallLeads) || 0,
      oneCallRate: calledLeads > 0 ? ((Number(summary.oneCallLeads) / calledLeads) * 100).toFixed(1) : 0,
      repeatCallLeads: Number(summary.repeatCallLeads) || 0,
      repeatCallRate: calledLeads > 0 ? ((Number(summary.repeatCallLeads) / calledLeads) * 100).toFixed(1) : 0,
      avgDuration: 'N/A', // Not available in flat ledger
      medianDuration: 'N/A', // Not available in flat ledger
      chart
    };
  } catch (error: any) {
    throw new Error(`BigQuery call performance query failed: ${error.message}`);
  }
}

export async function getFunnelStats(params: QueryParams) {
  const { projectId, datasetId, tableId, startDate, endDate, source, medium } = params;
  const bq = getBaseClient(projectId);
  
  let whereClauses = [];
  if (startDate) whereClauses.push(`DATE(capture_timestamp) >= '${startDate}'`);
  if (endDate) whereClauses.push(`DATE(capture_timestamp) <= '${endDate}'`);
  if (source) whereClauses.push(`source = '${source}'`);
  if (medium) whereClauses.push(`medium = '${medium}'`);
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const query = `
    SELECT
      COUNT(lead_id) as captured,
      COUNTIF(valid_lead = true) as valid,
      COUNTIF(delivery_timestamp IS NOT NULL) as delivered,
      COUNTIF(first_call_timestamp IS NOT NULL) as called,
      COUNTIF(rpc = true) as rpc,
      COUNTIF(sale = true) as sale,
      COUNTIF(activation = true) as activated
    FROM \`${projectId}.${datasetId}.${tableId}\`
    ${whereSql}
  `;
  
  try {
    const [rows] = await bq.query({ query });
    return rows[0] || null;
  } catch (error: any) {
    throw new Error(`BigQuery funnel query failed: ${error.message}`);
  }
}

export async function getLeads(params: QueryParams & { limit?: number; offset?: number }) {
  const { projectId, datasetId, tableId, startDate, endDate, source, medium, limit = 100, offset = 0 } = params;
  const bq = getBaseClient(projectId);
  
  let whereClauses = [];
  if (startDate) whereClauses.push(`DATE(capture_timestamp) >= '${startDate}'`);
  if (endDate) whereClauses.push(`DATE(capture_timestamp) <= '${endDate}'`);
  if (source) whereClauses.push(`source = '${source}'`);
  if (medium) whereClauses.push(`medium = '${medium}'`);
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const query = `
    SELECT
      lead_id as id,
      capture_timestamp as captured,
      source,
      medium as campaign,
      CAST(calls AS STRING) as calls,
      CASE
        WHEN activation = true THEN 'Activated'
        WHEN sale = true THEN 'Sale'
        WHEN rpc = true THEN 'Contacted'
        WHEN first_call_timestamp IS NOT NULL THEN 'Called'
        WHEN delivery_timestamp IS NOT NULL THEN 'Delivered'
        ELSE 'Captured'
      END as status,
      IFNULL(CAST(revenue AS STRING), '$0') as value,
      'Valid' as quality
    FROM \`${projectId}.${datasetId}.${tableId}\`
    ${whereSql}
    ORDER BY capture_timestamp DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  try {
    const [rows] = await bq.query({ query });
    return rows;
  } catch (error: any) {
    throw new Error(`BigQuery leads query failed: ${error.message}`);
  }
}

export async function getDataHealthStats(params: QueryParams) {
  const { projectId, datasetId, tableId, startDate, endDate, source, medium } = params;
  const bq = getBaseClient(projectId);
  
  let whereClauses = [];
  if (startDate) whereClauses.push(`DATE(capture_timestamp) >= '${startDate}'`);
  if (endDate) whereClauses.push(`DATE(capture_timestamp) <= '${endDate}'`);
  if (source) whereClauses.push(`source = '${source}'`);
  if (medium) whereClauses.push(`medium = '${medium}'`);
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const query = `
    SELECT
      COUNT(lead_id) as total_leads,
      COUNTIF(EXTRACT(YEAR FROM capture_timestamp) IN (1900, 1970)) as sentinel_captures,
      COUNTIF(delivery_timestamp IS NULL AND rpc = true) as missing_delivery_with_rpc,
      COUNTIF(first_call_timestamp IS NULL AND calls > 0) as missing_call_timestamp_with_calls,
      MAX(capture_timestamp) as latest_capture,
      MAX(delivery_timestamp) as latest_delivery,
      MAX(first_call_timestamp) as latest_call,
      MAX(sale_timestamp) as latest_sale
    FROM \`${projectId}.${datasetId}.${tableId}\`
    ${whereSql}
  `;

  try {
    const [rows] = await bq.query({ query });
    return rows[0] || null;
  } catch (error: any) {
    throw new Error(`BigQuery data health query failed: ${error.message}`);
  }
}

export async function getSourcesStats(params: QueryParams) {
  const { projectId, datasetId, tableId, startDate, endDate, source, medium } = params;
  const bq = getBaseClient(projectId);
  
  let whereClauses = [];
  if (startDate) whereClauses.push(`DATE(capture_timestamp) >= '${startDate}'`);
  if (endDate) whereClauses.push(`DATE(capture_timestamp) <= '${endDate}'`);
  if (source) whereClauses.push(`source = '${source}'`);
  if (medium) whereClauses.push(`medium = '${medium}'`);
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const query = `
    SELECT 
      IFNULL(source, 'Unknown') as source,
      COUNT(lead_id) as leads,
      COUNTIF(rpc = true) as rpc_count,
      COUNTIF(sale = true) as sale_count,
      COUNTIF(activation = true) as activation_count,
      SUM(IFNULL(revenue, 0)) as total_revenue
    FROM \`${projectId}.${datasetId}.${tableId}\`
    ${whereSql}
    GROUP BY source
    ORDER BY leads DESC
  `;

  try {
    const [rows] = await bq.query({ query });
    
    // calculate total leads to get share
    const totalLeads = rows.reduce((sum, r) => sum + (Number(r.leads) || 0), 0);
    
    return rows.map((r: any) => {
      const current = Number(r.leads) || 0;
      return {
        source: r.source,
        leads: current,
        share: totalLeads > 0 ? Number(((current / totalLeads) * 100).toFixed(1)) : 0,
        delivery: current > 0 ? Number(((Number(r.delivery_count) / current) * 100).toFixed(1)) : 0,
        callRate: current > 0 ? Number(((Number(r.called_count) / current) * 100).toFixed(1)) : 0,
        dupes: current > 0 ? Number(((Number(r.dupe_count) / current) * 100).toFixed(1)) : 0,
        saleRate: current > 0 ? Number(((Number(r.sale_count) / current) * 100).toFixed(1)) : 0,
        revPerLead: current > 0 ? Number((Number(r.total_revenue) / current).toFixed(2)) : 0
      };
    });
  } catch (error: any) {
    throw new Error(`BigQuery sources query failed: ${error.message}`);
  }
}

export async function getQualityStats(params: QueryParams) {
  const { projectId, datasetId, tableId, startDate, endDate, source, medium } = params;
  const bq = getBaseClient(projectId);
  
  let whereClauses = [];
  if (startDate) whereClauses.push(`DATE(capture_timestamp) >= '${startDate}'`);
  if (endDate) whereClauses.push(`DATE(capture_timestamp) <= '${endDate}'`);
  if (source) whereClauses.push(`source = '${source}'`);
  if (medium) whereClauses.push(`medium = '${medium}'`);
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const query = `
    SELECT
      COUNT(lead_id) as total,
      0 as passed,
      0 as failed
    FROM \`${projectId}.${datasetId}.${tableId}\`
    ${whereSql}
  `;

  try {
    const [rows] = await bq.query({ query });
    const stats = rows[0] || { total: 0, passed: 0, failed: 0 };
    const total = Number(stats.total) || 0;
    const passed = Number(stats.passed) || 0;
    
    return {
      grades: [
        { name: 'Passed Vetting', value: passed, color: '#10b981' },
        { name: 'Failed Vetting', value: Number(stats.failed) || 0, color: '#f43f5e' }
      ],
      vetting: [
        { name: 'Duplicate', value: Number(stats.failed) || 0, color: '#f43f5e' },
        { name: 'Valid', value: passed, color: '#10b981' }
      ],
      passRate: total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0,
      avgScore: 'N/A',
      chart: [
         { grade: 'Valid', leads: passed, rpc: 0, sale: 0 },
         { grade: 'Duplicate', leads: Number(stats.failed) || 0, rpc: 0, sale: 0 }
      ],
      reasons: [
         { reason: 'Duplicate', count: Number(stats.failed) || 0, percentage: total > 0 ? Number(((Number(stats.failed) / total) * 100).toFixed(1)) : 0 }
      ]
    };
  } catch (error: any) {
    throw new Error(`BigQuery quality query failed: ${error.message}`);
  }
}

export async function getSpeedToLeadStats(params: QueryParams) {
  const { projectId, datasetId, tableId, startDate, endDate, source, medium } = params;
  const bq = getBaseClient(projectId);
  
  let whereClauses = [];
  if (startDate) whereClauses.push(`DATE(capture_timestamp) >= '${startDate}'`);
  if (endDate) whereClauses.push(`DATE(capture_timestamp) <= '${endDate}'`);
  if (source) whereClauses.push(`source = '${source}'`);
  if (medium) whereClauses.push(`medium = '${medium}'`);
  whereClauses.push(`delivery_timestamp IS NOT NULL`);
  whereClauses.push(`first_call_timestamp IS NOT NULL`);
  whereClauses.push(`first_call_timestamp >= delivery_timestamp`);
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  // We approximate the speed to lead in minutes
  const query = `
    WITH stl_data AS (
      SELECT 
        lead_id,
        TIMESTAMP_DIFF(first_call_timestamp, delivery_timestamp, MINUTE) as stl_minutes,
        rpc,
        sale
      FROM \`${projectId}.${datasetId}.${tableId}\`
      ${whereSql}
    )
    SELECT
      AVG(stl_minutes) as avg_stl,
      COUNT(lead_id) as total_called,
      COUNTIF(stl_minutes <= 5) as in_five,
      COUNTIF(stl_minutes <= 60) as in_hour,
      
      COUNTIF(stl_minutes <= 5) as bucket_1_leads,
      COUNTIF(stl_minutes <= 5 AND rpc = true) as bucket_1_rpc,
      COUNTIF(stl_minutes <= 5 AND sale = true) as bucket_1_sale,
      
      COUNTIF(stl_minutes > 5 AND stl_minutes <= 15) as bucket_2_leads,
      COUNTIF(stl_minutes > 5 AND stl_minutes <= 15 AND rpc = true) as bucket_2_rpc,
      COUNTIF(stl_minutes > 5 AND stl_minutes <= 15 AND sale = true) as bucket_2_sale,
      
      COUNTIF(stl_minutes > 15 AND stl_minutes <= 60) as bucket_3_leads,
      COUNTIF(stl_minutes > 15 AND stl_minutes <= 60 AND rpc = true) as bucket_3_rpc,
      COUNTIF(stl_minutes > 15 AND stl_minutes <= 60 AND sale = true) as bucket_3_sale,
      
      COUNTIF(stl_minutes > 60) as bucket_4_leads,
      COUNTIF(stl_minutes > 60 AND rpc = true) as bucket_4_rpc,
      COUNTIF(stl_minutes > 60 AND sale = true) as bucket_4_sale
      
    FROM stl_data
  `;

  try {
    const [rows] = await bq.query({ query });
    const stats = rows[0] || {};
    const total = Number(stats.total_called) || 0;
    
    return {
      metrics: [
        { name: 'Capture to Delivery', avg: 'N/A', median: 'N/A', p75: 'N/A', p90: 'N/A', p95: 'N/A' },
        { name: 'Delivery to First Call', avg: stats.avg_stl ? `${Math.round(stats.avg_stl)}m` : 'N/A', median: 'N/A', p75: 'N/A', p90: 'N/A', p95: 'N/A' },
      ],
      buckets: [
        { 
          bucket: '< 5m', 
          leads: Number(stats.bucket_1_leads) || 0,
          rpc: Number(stats.bucket_1_leads) > 0 ? Number(((Number(stats.bucket_1_rpc) / Number(stats.bucket_1_leads)) * 100).toFixed(1)) : 0,
          sale: Number(stats.bucket_1_leads) > 0 ? Number(((Number(stats.bucket_1_sale) / Number(stats.bucket_1_leads)) * 100).toFixed(1)) : 0,
          activation: 0
        },
        { 
          bucket: '5-15m', 
          leads: Number(stats.bucket_2_leads) || 0,
          rpc: Number(stats.bucket_2_leads) > 0 ? Number(((Number(stats.bucket_2_rpc) / Number(stats.bucket_2_leads)) * 100).toFixed(1)) : 0,
          sale: Number(stats.bucket_2_leads) > 0 ? Number(((Number(stats.bucket_2_sale) / Number(stats.bucket_2_leads)) * 100).toFixed(1)) : 0,
          activation: 0
        },
        { 
          bucket: '15-60m', 
          leads: Number(stats.bucket_3_leads) || 0,
          rpc: Number(stats.bucket_3_leads) > 0 ? Number(((Number(stats.bucket_3_rpc) / Number(stats.bucket_3_leads)) * 100).toFixed(1)) : 0,
          sale: Number(stats.bucket_3_leads) > 0 ? Number(((Number(stats.bucket_3_sale) / Number(stats.bucket_3_leads)) * 100).toFixed(1)) : 0,
          activation: 0
        },
        { 
          bucket: '> 1h', 
          leads: Number(stats.bucket_4_leads) || 0,
          rpc: Number(stats.bucket_4_leads) > 0 ? Number(((Number(stats.bucket_4_rpc) / Number(stats.bucket_4_leads)) * 100).toFixed(1)) : 0,
          sale: Number(stats.bucket_4_leads) > 0 ? Number(((Number(stats.bucket_4_sale) / Number(stats.bucket_4_leads)) * 100).toFixed(1)) : 0,
          activation: 0
        }
      ]
    };
  } catch (error: any) {
    throw new Error(`BigQuery speed to lead query failed: ${error.message}`);
  }
}

export async function getCohortStats(params: QueryParams) {
  const { projectId, datasetId, tableId, startDate, endDate, source, medium } = params;
  const bq = getBaseClient(projectId);
  
  let whereClauses = [];
  if (startDate) whereClauses.push(`DATE(capture_timestamp) >= '${startDate}'`);
  if (endDate) whereClauses.push(`DATE(capture_timestamp) <= '${endDate}'`);
  if (source) whereClauses.push(`source = '${source}'`);
  if (medium) whereClauses.push(`medium = '${medium}'`);
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const query = `
    SELECT
      FORMAT_DATE('%Y-W%W', DATE(capture_timestamp)) as cohort,
      COUNT(lead_id) as size,
      
      -- Sale diffs
      COUNTIF(sale = true AND TIMESTAMP_DIFF(sale_timestamp, capture_timestamp, DAY) = 0) as sale_d0,
      COUNTIF(sale = true AND TIMESTAMP_DIFF(sale_timestamp, capture_timestamp, DAY) <= 1) as sale_d1,
      COUNTIF(sale = true AND TIMESTAMP_DIFF(sale_timestamp, capture_timestamp, DAY) <= 3) as sale_d3,
      COUNTIF(sale = true AND TIMESTAMP_DIFF(sale_timestamp, capture_timestamp, DAY) <= 7) as sale_d7,
      COUNTIF(sale = true AND TIMESTAMP_DIFF(sale_timestamp, capture_timestamp, DAY) <= 14) as sale_d14,
      COUNTIF(sale = true AND TIMESTAMP_DIFF(sale_timestamp, capture_timestamp, DAY) <= 30) as sale_d30
    FROM \`${projectId}.${datasetId}.${tableId}\`
    ${whereSql}
    GROUP BY cohort
    ORDER BY cohort DESC
    LIMIT 10
  `;

  try {
    const [rows] = await bq.query({ query });
    return rows.map((r: any) => {
      const size = Number(r.size) || 0;
      return {
        cohort: r.cohort,
        size,
        metrics: {
          d0: size > 0 ? Number(((Number(r.sale_d0) / size) * 100).toFixed(1)) : null,
          d1: size > 0 ? Number(((Number(r.sale_d1) / size) * 100).toFixed(1)) : null,
          d3: size > 0 ? Number(((Number(r.sale_d3) / size) * 100).toFixed(1)) : null,
          d7: size > 0 ? Number(((Number(r.sale_d7) / size) * 100).toFixed(1)) : null,
          d14: size > 0 ? Number(((Number(r.sale_d14) / size) * 100).toFixed(1)) : null,
          d30: size > 0 ? Number(((Number(r.sale_d30) / size) * 100).toFixed(1)) : null
        }
      };
    });
  } catch (error: any) {
    throw new Error(`BigQuery cohorts query failed: ${error.message}`);
  }
}

export async function getTimeseriesStats(params: QueryParams) {
  const { projectId, datasetId, tableId, startDate, endDate, source, medium } = params;
  const bq = getBaseClient(projectId);
  
  let whereClauses = [];
  if (startDate) whereClauses.push(`DATE(capture_timestamp) >= '${startDate}'`);
  if (endDate) whereClauses.push(`DATE(capture_timestamp) <= '${endDate}'`);
  if (source) whereClauses.push(`source = '${source}'`);
  if (medium) whereClauses.push(`medium = '${medium}'`);
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const query = `
    SELECT
      CAST(DATE(capture_timestamp) AS STRING) as date,
      COUNT(lead_id) as current
    FROM \`${projectId}.${datasetId}.${tableId}\`
    ${whereSql}
    GROUP BY date
    ORDER BY date ASC
  `;

  try {
    const [rows] = await bq.query({ query });
    return rows.map((r: any) => ({
      date: r.date,
      current: Number(r.current) || 0,
      comparison: 0
    }));
  } catch (error: any) {
    throw new Error(`BigQuery timeseries query failed: ${error.message}`);
  }
}

