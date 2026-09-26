import { getBigQueryClient } from '../client';
import { getClientConfig } from '../config';
import { getBaseSemanticLayer } from '../views';
import type { BaseQueryParams } from './types';
import { buildWhereClause } from './types';

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
