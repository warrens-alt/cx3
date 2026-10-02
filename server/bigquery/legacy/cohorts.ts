import { completeRevenueSumSql } from '../../analytics/common/leadMetrics';
import { getBigQueryClient } from '../client';
import { getClientConfig } from '../config';
import { getBaseSemanticLayer } from '../views';
import type { BaseQueryParams } from './types';
import { buildWhereClause } from './types';
import { RequestError, buildLeadWhere } from '../filters';

export async function getCohortStats(params: BaseQueryParams & { cohortType?: string; metricType?: string }) {
  const client = getClientConfig(params.clientId);
  const bq = getBigQueryClient(client.bigQueryProject);
  const { sql, queryParams } = buildLeadWhere(params);
  
  const cohortType = params.cohortType || 'weekly';
  const metricType = params.metricType || 'sale';

  let cohortExpr = `FORMAT_DATE('%Y-W%W', capture_date)`;
  if (cohortType === 'daily') {
    cohortExpr = `CAST(capture_date AS STRING)`;
  } else if (cohortType === 'monthly') {
    cohortExpr = `FORMAT_DATE('%Y-%m', capture_date)`;
  }

  const outcomeFields: Record<string, { flag: string; timestamp: string }> = {
    call_coverage: { flag: 'has_call', timestamp: 'first_call_timestamp' },
    sale: { flag: 'has_sale', timestamp: 'sale_timestamp' },
    rpc: { flag: 'has_rpc', timestamp: 'rpc_timestamp' },
    activation: { flag: 'has_activation', timestamp: 'activation_timestamp' },
  };
  if (!['daily', 'weekly', 'monthly'].includes(cohortType)) throw new RequestError('Unsupported cohort type', 422);
  if (metricType !== 'revenue' && !Object.hasOwn(outcomeFields, metricType)) throw new RequestError('Unsupported cohort metric', 422);
  const outcome = outcomeFields[metricType];
  // A cumulative revenue balance cannot establish when each amount was earned.
  const missingTiming = outcome ? `COUNTIF(${outcome.flag} AND ${outcome.timestamp} IS NULL)` : 'COUNT(*)';
  const maturationExpr = [0, 1, 3, 7, 14, 30].map(day => {
    if (!outcome) return `CAST(NULL AS INT64) AS m_d${day}`;
    return `CASE WHEN ${missingTiming} > 0 THEN NULL ELSE COUNTIF(
      ${outcome.flag} AND ${outcome.timestamp} >= capture_timestamp
      AND ${outcome.timestamp} <= CURRENT_TIMESTAMP()
      AND TIMESTAMP_DIFF(${outcome.timestamp}, capture_timestamp, DAY) <= ${day}
    ) END AS m_d${day}`;
  }).join(',\n');

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
      ${completeRevenueSumSql('total_revenue')} as revenue,
      COUNTIF(total_revenue IS NULL) AS missing_revenue_leads,
      ${missingTiming} AS missing_event_timestamps,
      ${maturationExpr}
    FROM vw_leads
    ${sql}
    GROUP BY cohort
    ORDER BY cohort DESC
    LIMIT 17
  `;
  
  const [rows] = await bq.query({ query, params: queryParams });
  return rows.slice(0, 16).map((r: any) => {
    const size = Number(r.size) || 0;
    const delivered = Number(r.delivered) || 0;
    const called = Number(r.called) || 0;
    const rpcs = Number(r.rpcs) || 0;
    const sales = Number(r.sales) || 0;
    const billableSales = Number(r.billable_sales) || 0;
    const activations = Number(r.activations) || 0;
    const revenue = r.revenue == null ? null : Number(r.revenue);

    const calcMetric = (val: any) => {
      if (val === null || val === undefined) return null;
      const num = Number(val) || 0;
      if (metricType === 'revenue') {
        return size > 0 ? Number((num / size).toFixed(2)) : null;
      }
      return size > 0 ? Number(((num / size) * 100).toFixed(1)) : null;
    };

    return {
      cohort: r.cohort || 'Unknown',
      detailTruncated: rows.length > 16,
      rowLimit: 16,
      missingRevenueLeads: Number(r.missing_revenue_leads || 0),
      size,
      delivered,
      deliveryRate: size > 0 ? Number(((delivered / size) * 100).toFixed(1)) : null,
      called,
      callRate: size > 0 ? Number(((called / size) * 100).toFixed(1)) : null,
      callCoverage: delivered > 0 ? Number(((called / delivered) * 100).toFixed(1)) : null,
      rpcs,
      rpcRate: called > 0 ? Number(((rpcs / called) * 100).toFixed(1)) : null,
      sales,
      saleRate: size > 0 ? Number(((sales / size) * 100).toFixed(1)) : null,
      leadToSaleRate: size > 0 ? Number(((sales / size) * 100).toFixed(1)) : null,
      billableSales,
      billableSaleRate: sales > 0 ? Number(((billableSales / sales) * 100).toFixed(1)) : null,
      activations,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : null,
      revenue,
      revPerLead: revenue !== null && size > 0 ? Number((revenue / size).toFixed(2)) : null,
      maturationStatus: !outcome || Number(r.missing_event_timestamps || 0) > 0 ? 'UNAVAILABLE' : 'OBSERVED',
      maturationReason: !outcome
        ? 'Revenue maturation requires dated revenue events; the current source contains cumulative balances.'
        : Number(r.missing_event_timestamps || 0) > 0
          ? 'Some recorded outcomes have no event timestamp; cumulative maturation is withheld for this cohort.'
          : null,
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
