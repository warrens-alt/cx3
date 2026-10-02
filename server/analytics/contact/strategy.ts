import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { buildFilterClause } from '../common/scope';
import { completeRevenueSumSql, OPERATIONAL_REVENUE_POLICY, operationalLeadCtes, metricPercent } from '../common/leadMetrics';

// 4. CONTACT STRATEGY
export function buildContactStrategyResult(rows: any[]) {
  const totalLeads = rows.reduce((acc: number, row: any) => acc + Number(row.leads || 0), 0);
  const attemptPerformance = rows.map((row: any) => {
    const leads = Number(row.leads || 0);
    const dialled = row.dialled != null ? Number(row.dialled) : null;
    const contacted = Number(row.contacted || 0);
    const noRpc = row.no_rpc != null ? Number(row.no_rpc) : null;
    const sales = Number(row.sales || 0);
    const activations = Number(row.activations || 0);
    return {
      bucket: row.attempt_bucket,
      leads,
      sharePct: metricPercent(leads, totalLeads, 1),
      dialled,
      noRpc,
      rpcUnrecorded: row.rpc_unrecorded == null ? null : Number(row.rpc_unrecorded),
      contacted,
      contactRate: metricPercent(contacted, dialled),
      sales,
      saleRate: metricPercent(sales, leads, 2),
      activations,
      activationRate: metricPercent(activations, sales, 1),
      revenue: row.revenue == null ? null : Number(row.revenue),
      callCost: null,
      marginalSales: null,
      marginalCostPerSale: null
    };
  });

  const dialledLeads = attemptPerformance.some(row => row.dialled === null) ? null : attemptPerformance.reduce((sum, row) => sum + row.dialled, 0);
  const oneCall = attemptPerformance.find(row => row.bucket === '1 call');
  const multiCallRows = attemptPerformance.filter(row => !['0 calls', '1 call', 'Unrecorded'].includes(row.bucket));
  const multiCallLeads = multiCallRows.some(row => row.dialled === null) ? null : multiCallRows.reduce((sum, row) => sum + row.dialled, 0);
  const highAttempt = attemptPerformance.find(row => row.bucket === '5+ calls');
  const oneCallLeads = oneCall ? oneCall.dialled : 0;

  return {
    attemptPerformance,
    attemptCadence: [],
    summary: {
      totalLeads,
      dialledLeads,
      unrecordedCallLeads: attemptPerformance.find(row => row.bucket === 'Unrecorded')?.leads || 0,
      unrecordedDialledCallLeads: attemptPerformance.find(row => row.bucket === 'Unrecorded')?.dialled ?? (attemptPerformance.some(row => row.bucket === 'Unrecorded') ? null : 0),
      oneCallNoRpcLeads: oneCall ? oneCall.noRpc : 0,
      zeroCallNoRpcLeads: attemptPerformance.some(row => row.bucket === '0 calls') ? attemptPerformance.find(row => row.bucket === '0 calls')!.noRpc : 0,
      zeroCallLeads: attemptPerformance.find(row => row.bucket === '0 calls')?.leads || 0,
      oneCallLeads,
      singleAttemptSharePct: dialledLeads > 0 ? metricPercent(oneCallLeads, dialledLeads, 1) : null,
      multiAttemptLeads: multiCallLeads,
      multiAttemptSharePct: dialledLeads > 0 ? metricPercent(multiCallLeads, dialledLeads, 1) : null,
      fivePlusCallLeads: highAttempt?.leads || 0,
      fivePlusNoRpcLeads: highAttempt ? highAttempt.noRpc : 0,
    },
    effortEvidence: { status: 'UNAVAILABLE', reason: 'Incremental attempt-level RPC and sale yield require the attempt that produced each outcome. Total-call snapshots support only exclusive bucket associations.' },
    noAnswerAnalysis: {
      status: 'UNAVAILABLE',
      reason: 'Event-level attempt spacing, callback completion and redial economics are not independently validated. Recommendations are withheld.',
      stopThresholdRecommendation: null,
      diminishingReturnsCutoff: null,
      callbackFollowupRate: null,
      callbackSaleConversion: null
    },
    methodology: 'Buckets are exclusive per lead using the maximum non-negative recorded HLC total_calls value. Missing counters remain Unrecorded; no-RPC counts require an explicit recorded zero. One-call and multi-call shares count qualified dialled leads in those recorded buckets / all qualified dialled leads; the denominator includes the separately exposed unrecorded-call population. They describe observed call-count populations and do not identify which specific attempt produced the outcome.'
  };
}

export async function getContactStrategyAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { queryParams } = buildFilterClause(params);

  const query = `
    WITH ${operationalLeadCtes(params)},
    lead_level AS (
      SELECT *, recorded_call_count AS call_count FROM operational_leads
    ),
    brackets AS (
      SELECT
        CASE
          WHEN call_count IS NULL THEN 'Unrecorded'
          WHEN call_count = 0 THEN '0 calls'
          WHEN call_count = 1 THEN '1 call'
          WHEN call_count = 2 THEN '2 calls'
          WHEN call_count = 3 THEN '3 calls'
          WHEN call_count = 4 THEN '4 calls'
          ELSE '5+ calls'
        END AS attempt_bucket,
        CASE
          WHEN call_count IS NULL THEN 6
          WHEN call_count = 0 THEN 0
          WHEN call_count = 1 THEN 1
          WHEN call_count = 2 THEN 2
          WHEN call_count = 3 THEN 3
          WHEN call_count = 4 THEN 4
          ELSE 5
        END AS bucket_order,
        COUNT(*) AS leads,
        COUNTIF(is_dialled) AS dialled,
        COUNTIF(is_rpc IS FALSE) AS no_rpc,
        COUNTIF(is_rpc IS NULL) AS rpc_unrecorded,
        COUNTIF(is_qualified_rpc) AS contacted,
        COUNTIF(is_sale) AS sales,
        COUNTIF(is_activated) AS activations,
        ROUND(${completeRevenueSumSql()}, 2) AS revenue
      FROM lead_level
      GROUP BY 1, 2
      ORDER BY bucket_order
    )
    SELECT * FROM brackets
  `;

  const [rows] = await client.query({ query, params: queryParams });
  return buildContactStrategyResult(rows);
}
