import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import { currentAnalyticsScope } from '../../analyticsContext';
import { compareMetric, decomposeRateChange, matchedPeriodWindow } from '../../../contracts/periodComparison';
import type { LifecycleDiagnostics, LifecycleSegment, LifecycleTransition } from '../../../contracts/lifecycleAnalytics';
import type { OffernetQueryParams } from './types';
import { completeRevenueSumSql, OPERATIONAL_REVENUE_POLICY, operationalLeadCtes, operationalLeadSelectSql, metricPercent } from './leadMetrics';
import { buildFilterClause } from './scope';

type Row = Record<string, any>;
const dimensions = ['vendor', 'source', 'grade', 'captureHour', 'captureDay'];
const numeric = (r: Row, k: string) => Number(r[k] || 0);
const exactRate = (numerator: number, denominator: number) => denominator > 0 ? 100 * numerator / denominator : null;
export function lifecycleSegment(row: Row): LifecycleSegment {
  const fetched = numeric(row, 'fetched'), delivered = numeric(row, 'delivered'), dialled = numeric(row, 'dialled'), rpc = numeric(row, 'rpc'), sales = numeric(row, 'sales'), activations = numeric(row, 'activations');
  return { key: String(row.segment ?? 'Unrecorded'), fetched, delivered, dialled, rpc, sales, activations,
    revenue: row.revenue == null ? null : Number(row.revenue), missingRevenueLeads: numeric(row, 'missingRevenueLeads'), deliveryRate: exactRate(delivered, fetched), dialRate: exactRate(dialled, delivered), rpcRate: exactRate(rpc, dialled), saleRate: exactRate(sales, fetched), activationRate: exactRate(activations, sales),
    within15mRate: metricPercent(numeric(row, 'within15m'), delivered), oneCallShare: metricPercent(numeric(row, 'oneCall'), dialled), fivePlusNoRpc: numeric(row, 'fivePlusNoRpc'), dispositionCompleteness: metricPercent(numeric(row, 'hasDisposition'), dialled), invalidLeads: numeric(row, 'invalidLeads'), missingSource: numeric(row, 'missingSource'), missingGrade: numeric(row, 'missingGrade') };
}
export function assembleLifecycleDiagnostics(rows: Row[], period: ReturnType<typeof matchedPeriodWindow>): LifecycleDiagnostics {
  const current = lifecycleSegment(rows.find(r => r.period === 'current' && r.dimension === 'all') || {});
  const previous = lifecycleSegment(rows.find(r => r.period === 'previous' && r.dimension === 'all') || {});
  const comparisons = Object.fromEntries(['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activations', 'revenue', 'deliveryRate', 'dialRate', 'rpcRate', 'saleRate', 'activationRate'].map(key => [key, compareMetric(current[key as keyof LifecycleSegment] as number | null, period ? previous[key as keyof LifecycleSegment] as number | null : null, key.endsWith('Rate') ? 'rate' : key === 'revenue' ? 'currency' : 'count')]));
  const c = rows.find(r => r.period === 'current' && r.dimension === 'all') || {};
  const p = rows.find(r => r.period === 'previous' && r.dimension === 'all') || {};
  const stageSpec = [ ['Capture','Delivery','fetched','delivered','delivered'], ['Delivery','Dial','delivered','dialled','deliveredDialled'], ['Dial','RPC','dialled','rpc','dialledRpc'], ['RPC','Sale','rpc','sales','rpcSale'], ['Sale','Activation','sales','activations','saleActivated'] ];
  const transitions: LifecycleTransition[] = stageSpec.map(([from,to,denominator,next,intersection]) => {
    const population = numeric(c, denominator), converted = numeric(c, intersection);
    const rate = metricPercent(converted, population, 8), prior = period ? metricPercent(numeric(p, intersection), numeric(p, denominator), 8) : null;
    return { from, to, population, converted, lost: population - converted, conversionRate: rate, lossRate: metricPercent(population - converted, population, 8), deteriorationPp: rate !== null && prior !== null ? rate - prior : null, status: numeric(c, next) > converted ? 'NON_NESTED' : 'OBSERVED' };
  });
  const segments = Object.fromEntries(dimensions.map(d => [d, rows.filter(r => r.period === 'current' && r.dimension === d).map(lifecycleSegment)]));
  const priorSegments = Object.fromEntries(dimensions.map(d => [d, rows.filter(r => r.period === 'previous' && r.dimension === d).map(lifecycleSegment)]));
  const rateDefinitions: Record<string, [keyof typeof current, keyof typeof current]> = {
    deliveryRate: ['delivered','fetched'], dialRate:['dialled','delivered'], rpcRate:['rpc','dialled'], saleRate:['sales','fetched'], activationRate:['activations','sales'],
  };
  const rateContributions = Object.fromEntries(Object.entries(rateDefinitions).map(([metric,[numerator,denominator]]) => [metric,Object.fromEntries(dimensions.map(d => {
    const complete = (group: LifecycleSegment[], total: LifecycleSegment) => [numerator,denominator].every(key => group.reduce((n,s) => n+Number(s[key]),0) === total[key]);
    return [d, period && complete(segments[d],current) && complete(priorSegments[d],previous)
      ? decomposeRateChange(segments[d].map(s => ({ key:s.key,numerator:Number(s[numerator]),denominator:Number(s[denominator]) })), priorSegments[d].map(s => ({ key:s.key,numerator:Number(s[numerator]),denominator:Number(s[denominator]) }))) : null];
  }))]));

  return { period, comparisons, transitions,
    largestLeakage: transitions.filter(t => (t.lost ?? 0) > 0).sort((a,b) => (b.lost ?? 0) - (a.lost ?? 0))[0] || null,
    largestDeterioration: transitions.filter(t => t.deteriorationPp !== null && t.deteriorationPp < 0).sort((a,b) => a.deteriorationPp! - b.deteriorationPp!)[0] || null,
    velocity: { captureToDeliverySec: c.avgFetchDeliverySec == null ? null : Number(c.avgFetchDeliverySec), deliveryToDialSec: c.avgDeliveryDialSec == null ? null : Number(c.avgDeliveryDialSec), dialToSaleSec: c.avgDialSaleSec == null ? null : Number(c.avgDialSaleSec), saleToActivationSec: c.avgSaleActivationSec == null ? null : Number(c.avgSaleActivationSec) },
    segments, priorSegments, rateContributions, validationStatus: 'NOT_VERIFIED', unsupportedDimensions: ['campaign', 'channel'],
    methodology: 'Capture cohort, one row per lead. Vendor decomposition assigns each lead to its earliest recorded delivery vendor (alphabetical tie-break); independent vendor activity can overlap. Each dimension reconciles separately and dimensions must not be added together. Transition conversion uses leads with both stage events; non-nested records are flagged. Current and previous cohorts have different follow-up maturity.' };
}

/** One bounded aggregate scan for both periods, all segments and transition intersections. */
const pendingDiagnostics = new Map<string, Promise<LifecycleDiagnostics>>();
export function getLifecycleDiagnostics(params: OffernetQueryParams): Promise<LifecycleDiagnostics> {
  const key = JSON.stringify([Object.entries(params).sort(([a],[b]) => a.localeCompare(b)), getClientConfig(params.clientId), currentAnalyticsScope()]);
  const existing = pendingDiagnostics.get(key);
  if (existing) return existing;
  const pending = loadLifecycleDiagnostics(params).finally(() => pendingDiagnostics.delete(key));
  pendingDiagnostics.set(key, pending);
  return pending;
}
/** Shared query fragments let dashboard aggregates and matched-period diagnostics use one warehouse job.
 * Current dashboard rows are filtered before deduplication, preserving their original capture-cohort semantics.
 */
export function compileLifecycleDiagnostics(params: OffernetQueryParams) {
  const period = matchedPeriodWindow(params.startDate, params.endDate);
  const queryScope = period ? { ...params, startDate: period.previous.startDate } : params;
  const { queryParams } = buildFilterClause(queryScope);
  queryParams.lifecycleTimezone = getClientConfig(params.clientId).timezone || 'Africa/Johannesburg';
  if (period) queryParams.lifecycleCurrentStart = period.current.startDate;
  const ctesSql = `${operationalLeadCtes(queryScope)}, classified AS (
    SELECT *, ${period ? "IF(DATE(fetched_ts, @lifecycleTimezone) >= DATE(@lifecycleCurrentStart), 'current', 'previous')" : "'current'"} AS period
    FROM operational_leads
  ), lifecycle_aggregates AS (
  SELECT period, dimension, segment, COUNT(*) AS fetched,
    COUNTIF(is_delivered) AS delivered, COUNTIF(is_dialled) AS dialled, COUNTIF(is_rpc) AS rpc,
    COUNTIF(is_sale) AS sales, COUNTIF(is_activated) AS activations,
    COUNTIF(is_delivered AND is_dialled) AS deliveredDialled, COUNTIF(is_dialled AND is_rpc) AS dialledRpc,
    COUNTIF(is_rpc AND is_sale) AS rpcSale, COUNTIF(is_sale AND is_activated) AS saleActivated,
    AVG(IF(delivered_ts >= fetched_ts, TIMESTAMP_DIFF(delivered_ts, fetched_ts, SECOND), NULL)) AS avgFetchDeliverySec,
    AVG(IF(first_call_ts >= delivered_ts, TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND), NULL)) AS avgDeliveryDialSec,
    AVG(IF(sale_ts >= first_call_ts, TIMESTAMP_DIFF(sale_ts, first_call_ts, SECOND), NULL)) AS avgDialSaleSec,
    AVG(IF(activation_ts >= sale_ts, TIMESTAMP_DIFF(activation_ts, sale_ts, SECOND), NULL)) AS avgSaleActivationSec,
    ${completeRevenueSumSql()} AS revenue, COUNTIF(revenue IS NULL) AS missingRevenueLeads, COUNTIF(TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND) BETWEEN 0 AND 900) AS within15m,
    COUNTIF(is_dialled AND recorded_call_count = 1) AS oneCall, COUNTIF(recorded_call_count >= 5 AND is_rpc IS FALSE) AS fivePlusNoRpc,
    COUNTIF(is_dialled AND has_disposition) AS hasDisposition, COUNTIF(is_invalid) AS invalidLeads,
    COUNTIF(NULLIF(TRIM(source), '') IS NULL) AS missingSource, COUNTIF(NULLIF(TRIM(grade), '') IS NULL) AS missingGrade
  FROM classified CROSS JOIN UNNEST([
    STRUCT('all' AS dimension, 'All' AS segment), STRUCT('vendor', COALESCE(NULLIF(TRIM(vendor), ''), 'Unrecorded')),
    STRUCT('source', COALESCE(NULLIF(TRIM(source), ''), 'Unrecorded')), STRUCT('grade', COALESCE(NULLIF(TRIM(grade), ''), 'Unrecorded')),
    STRUCT('captureHour', COALESCE(FORMAT_TIMESTAMP('%H', fetched_ts, @lifecycleTimezone), 'Unrecorded')),
    STRUCT('captureDay', COALESCE(FORMAT_TIMESTAMP('%A', fetched_ts, @lifecycleTimezone), 'Unrecorded'))
  ]) GROUP BY period, dimension, segment)`;
  const rowsSql = 'SELECT * FROM lifecycle_aggregates ORDER BY period, dimension, fetched DESC';
  return {
    period, queryParams, ctesSql, rowsSql,
    currentLeadCtesSql: (byVendor = false) => !period && !byVendor
      ? 'current_operational_leads AS (SELECT * FROM operational_leads)'
      : `current_operational_raw AS (
      SELECT * FROM operational_raw${period ? '\n      WHERE DATE(fetched_ts, @lifecycleTimezone) >= DATE(@lifecycleCurrentStart)' : ''}
    ), current_operational_leads AS (${operationalLeadSelectSql('current_operational_raw', byVendor, getClientConfig(params.clientId).currency)})`,
  };
}
async function loadLifecycleDiagnostics(params: OffernetQueryParams): Promise<LifecycleDiagnostics> {
  const { period, queryParams, ctesSql, rowsSql } = compileLifecycleDiagnostics(params);
  const query = `WITH ${ctesSql} ${rowsSql}`;
  const [rows] = await getBigQueryClient(getClientConfig(params.clientId).bigQueryProject).query({ query, params: queryParams });
  return assembleLifecycleDiagnostics(rows, period);
}
