import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';

// 4. CONTACT STRATEGY
export async function getContactStrategyAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH raw AS (
      SELECT
        l.lead_id,
        COALESCE(SAFE_CAST(hlc.total_calls AS INT64), 0) AS total_calls,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
        COALESCE(hlc.revenue_generated, 0) AS revenue
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    lead_level AS (
      SELECT
        lead_id,
        MAX(GREATEST(total_calls, 0)) AS call_count,
        COUNTIF(is_rpc) > 0 AS is_rpc,
        COUNTIF(is_sale) > 0 AS is_sale,
        COUNTIF(is_activated) > 0 AS is_activated,
        MAX(revenue) AS revenue
      FROM raw
      GROUP BY lead_id
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
        END AS attempt_bucket,
        CASE
          WHEN call_count = 0 THEN 0
          WHEN call_count = 1 THEN 1
          WHEN call_count = 2 THEN 2
          WHEN call_count = 3 THEN 3
          WHEN call_count = 4 THEN 4
          ELSE 5
        END AS bucket_order,
        COUNT(*) AS leads,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales,
        COUNTIF(is_activated) AS activations,
        ROUND(SUM(revenue), 2) AS revenue
      FROM lead_level
      GROUP BY 1, 2
      ORDER BY bucket_order
    )
    SELECT * FROM brackets
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const totalLeads = rows.reduce((acc: number, row: any) => acc + Number(row.leads || 0), 0);
  const attemptPerformance = rows.map((row: any) => {
    const leads = Number(row.leads || 0);
    const contacted = Number(row.contacted || 0);
    const sales = Number(row.sales || 0);
    const activations = Number(row.activations || 0);
    return {
      bucket: row.attempt_bucket,
      leads,
      sharePct: totalLeads > 0 ? Number(((leads / totalLeads) * 100).toFixed(1)) : 0,
      contacted,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      sales,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activations,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
      revenue: Number(row.revenue || 0),
      callCost: null,
      marginalSales: null,
      marginalCostPerSale: null
    };
  });

  const oneCall = attemptPerformance.find(row => row.bucket === '1 call');
  const multiCallLeads = attemptPerformance
    .filter(row => !['0 calls', '1 call'].includes(row.bucket))
    .reduce((sum, row) => sum + row.leads, 0);
  const highAttempt = attemptPerformance.find(row => row.bucket === '5+ calls');

  return {
    attemptPerformance,
    attemptCadence: [],
    summary: {
      totalLeads,
      zeroCallLeads: attemptPerformance.find(row => row.bucket === '0 calls')?.leads || 0,
      oneCallLeads: oneCall?.leads || 0,
      singleAttemptSharePct: totalLeads > 0 ? Number((((oneCall?.leads || 0) / totalLeads) * 100).toFixed(1)) : 0,
      multiAttemptLeads: multiCallLeads,
      multiAttemptSharePct: totalLeads > 0 ? Number(((multiCallLeads / totalLeads) * 100).toFixed(1)) : 0,
      fivePlusCallLeads: highAttempt?.leads || 0,
      fivePlusNoRpcLeads: highAttempt ? Math.max(highAttempt.leads - highAttempt.contacted, 0) : 0,
    },
    noAnswerAnalysis: {
      status: 'UNAVAILABLE',
      reason: 'Event-level attempt spacing, callback completion and redial economics are not independently validated. Recommendations are withheld.',
      stopThresholdRecommendation: null,
      diminishingReturnsCutoff: null,
      callbackFollowupRate: null,
      callbackSaleConversion: null
    },
    methodology: 'Buckets are exclusive per lead using the maximum recorded HLC total_calls value. They describe observed call-count populations and do not identify which specific attempt produced the outcome.'
  };
}
