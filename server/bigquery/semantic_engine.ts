import { getBigQueryClient } from './client';
import { getClientConfig } from './config';
import { getBaseSemanticLayer } from './views';
import { buildLeadWhere, RequestError, validateScope, type Filters } from './filters';
import { finiteOrNull } from './integrity';

export const getAllowedDimensions = (timezone: string): Record<string, string> => {
  new Intl.DateTimeFormat('en', { timeZone: timezone });
  return {
    date: 'CAST(capture_date AS STRING)', week: "FORMAT_DATE('%G-W%V', capture_date)", month: "FORMAT_DATE('%Y-%m', capture_date)",
    source: "IFNULL(source, 'Unknown')", vendor: "IFNULL(vendor, 'Unknown')", medium: "IFNULL(medium, 'Unknown')",
    hour: `LPAD(CAST(EXTRACT(HOUR FROM DATETIME(capture_timestamp, '${timezone}')) AS STRING), 2, '0')`,
    weekday: `CAST(EXTRACT(DAYOFWEEK FROM DATETIME(capture_timestamp, '${timezone}')) AS STRING)`,
    calls_bucket: "CASE WHEN total_calls IS NULL OR total_calls = 0 THEN '0' WHEN total_calls <= 5 THEN CAST(total_calls AS STRING) WHEN total_calls <= 10 THEN '6-10' ELSE '11+' END",
    response_bucket: `CASE WHEN first_call_timestamp IS NULL THEN 'Uncalled' WHEN first_call_timestamp < capture_timestamp THEN 'Invalid chronology'
      WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, SECOND) <= 300 THEN '0–5m'
      WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, SECOND) <= 900 THEN '>5–15m'
      WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, SECOND) <= 3600 THEN '>15–60m'
      WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, SECOND) <= 14400 THEN '>1–4h'
      WHEN TIMESTAMP_DIFF(first_call_timestamp, capture_timestamp, SECOND) <= 86400 THEN '>4–24h' ELSE '>24h' END`,
  };
};
export const ALLOWED_METRICS: Record<string, string> = {
  leads: 'COUNT(*)', delivered: 'COUNTIF(has_delivery)', called: 'COUNTIF(has_call)', rpcs: 'COUNTIF(has_rpc)',
  sales: 'COUNTIF(has_sale)', billable_sales: 'COUNTIF(has_billable_sale)', activations: 'COUNTIF(has_activation)', revenue: 'SUM(total_revenue)',
  delivery_rate: '100 * SAFE_DIVIDE(COUNTIF(has_delivery), COUNT(*))', dial_rate: '100 * SAFE_DIVIDE(COUNTIF(has_call), COUNT(*))',
  call_coverage: '100 * SAFE_DIVIDE(COUNTIF(has_call), COUNTIF(has_delivery))', rpc_rate: '100 * SAFE_DIVIDE(COUNTIF(has_rpc), COUNTIF(has_call))',
  sale_rate: '100 * SAFE_DIVIDE(COUNTIF(has_sale), COUNTIF(has_call))', lead_to_sale_rate: '100 * SAFE_DIVIDE(COUNTIF(has_sale), COUNT(*))',
  billable_sale_rate: '100 * SAFE_DIVIDE(COUNTIF(has_billable_sale), COUNTIF(has_sale))', activation_rate: '100 * SAFE_DIVIDE(COUNTIF(has_activation), COUNTIF(has_sale))',
  revenue_per_lead: 'SAFE_DIVIDE(SUM(total_revenue), COUNT(*))', revenue_per_sale: 'SAFE_DIVIDE(SUM(total_revenue), COUNTIF(has_sale))', calls_per_lead: 'SAFE_DIVIDE(SUM(total_calls), COUNT(*))',
};
interface DynamicParams { clientId: string; metric: string; dimension: string; secondaryDimension?: string; startDate?: string; endDate?: string; filters?: Filters; }
const pct = (a: number, b: number) => b ? Number((100 * a / b).toFixed(1)) : null;
function validateDimensions(params: DynamicParams) {
  const client = getClientConfig(params.clientId), dimensions = getAllowedDimensions(client.timezone);
  if (!Object.hasOwn(ALLOWED_METRICS, params.metric)) throw new RequestError('Unsupported metric');
  if (!Object.hasOwn(dimensions, params.dimension) || (params.secondaryDimension && !Object.hasOwn(dimensions, params.secondaryDimension))) throw new RequestError('Unsupported dimension; campaign mapping is not available');
  // A lead can have several vendors. Grouping on its first vendor would misattribute outcomes.
  if (params.dimension === 'vendor' || params.secondaryDimension === 'vendor') throw new RequestError('Use the vendor transaction breakdown for vendor-grouped metrics; first-vendor lead attribution is not supported', 422);
  return { client, dimensions };
}
export async function executeDynamicQuery(params: DynamicParams) {
  const scope = validateScope(params), { client, dimensions } = validateDimensions({ ...params, clientId: scope.clientId });
  const { sql, queryParams } = buildLeadWhere(scope), bq = getBigQueryClient(client.bigQueryProject);
  const dim2 = params.secondaryDimension ? `, ${dimensions[params.secondaryDimension]} AS dim2` : '';
  const temporal = ['date', 'week', 'month', 'hour', 'weekday'].includes(params.dimension);
  const query = `${getBaseSemanticLayer(client)} SELECT ${dimensions[params.dimension]} AS dim1${dim2}, ${ALLOWED_METRICS[params.metric]} AS value,
    COUNT(*) AS sample_size, COUNT(*) AS full_leads, COUNTIF(has_delivery) AS full_delivered, COUNTIF(has_call) AS full_called,
    COUNTIF(has_rpc) AS full_rpcs, COUNTIF(has_sale) AS full_sales, COUNTIF(has_billable_sale) AS full_billable_sales,
    COUNTIF(has_activation) AS full_activations, SUM(total_revenue) AS full_revenue
    FROM vw_leads ${sql} GROUP BY 1${params.secondaryDimension ? ', 2' : ''}
    ORDER BY ${temporal ? 'dim1' : 'value DESC, dim1'} LIMIT 1001`;
  const start = Date.now(), [job] = await bq.createQueryJob({ query, params: queryParams }), [rows] = await job.getQueryResults();
  return { success: true, data: rows.slice(0, 1000).map((r: any) => {
    const l = Number(r.full_leads), d = Number(r.full_delivered), c = Number(r.full_called), rpc = Number(r.full_rpcs), s = Number(r.full_sales), b = Number(r.full_billable_sales), a = Number(r.full_activations), rev = Number(r.full_revenue) || 0;
    return { dim1: r.dim1, dim2: r.dim2, value: finiteOrNull(r.value), sampleSize: Number(r.sample_size),
      fullFunnel: { leads: l, delivered: d, called: c, rpcs: rpc, sales: s, billableSales: b, activations: a, revenue: rev,
        deliveryRate: pct(d, l), callRate: pct(c, l), rpcRate: pct(rpc, c), saleRate: pct(s, c), leadToSaleRate: pct(s, l),
        billableSaleRate: pct(b, s), activationRate: pct(a, s), revPerLead: l ? rev / l : null } };
  }), metadata: { durationMs: Date.now() - start, bytesBilled: job.metadata.statistics?.query?.totalBytesBilled ?? null,
    metric: params.metric, dimension: params.dimension, secondaryDimension: params.secondaryDimension, truncated: rows.length > 1000,
    rateUnit: 'percent', appliedFilters: scope.filters, attribution: 'selected_vendor_transactions', dateBasis: 'lead_capture_cohort' } };
}
export function previousPeriod(startDate: string, endDate: string) {
  const scope = validateScope({ startDate, endDate });
  const start = Date.parse(scope.startDate!), end = Date.parse(scope.endDate!);
  const days = Math.floor((end - start) / 86400000) + 1;
  return { days, startDate: new Date(start - days * 86400000).toISOString().slice(0, 10), endDate: new Date(start - 86400000).toISOString().slice(0, 10) };
}
export async function generateDriverInsights(input: Omit<DynamicParams, 'metric' | 'dimension'> & { metric?: string; dimension?: string }) {
  const end = input.endDate || new Date().toISOString().slice(0, 10);
  const start = input.startDate || new Date(Date.parse(end) - 29 * 86400000).toISOString().slice(0, 10);
  const params = { ...input, startDate: start, endDate: end, metric: input.metric || 'activations', dimension: input.dimension || 'source' };
  const scope = validateScope(params), { client, dimensions } = validateDimensions({ ...params, clientId: scope.clientId });
  const previous = previousPeriod(start, end), currentWhere = buildLeadWhere(scope), previousWhere = buildLeadWhere({ ...scope, startDate: previous.startDate, endDate: previous.endDate });
  const dim = dimensions[params.dimension], metric = ALLOWED_METRICS[params.metric];
  const base = getBaseSemanticLayer(client), bq = getBigQueryClient(client.bigQueryProject);
  const [[currentRows], [previousRows]] = await Promise.all([
    bq.query({ query: `${base} SELECT ${dim} AS segment, ${metric} AS val, COUNT(*) AS volume FROM vw_leads ${currentWhere.sql} GROUP BY 1`, params: currentWhere.queryParams }),
    bq.query({ query: `${base} SELECT ${dim} AS segment, ${metric} AS val, COUNT(*) AS volume FROM vw_leads ${previousWhere.sql} GROUP BY 1`, params: previousWhere.queryParams }),
  ]);
  const current = new Map<string, any>(currentRows.map(r => [String(r.segment), r])), prior = new Map<string, any>(previousRows.map(r => [String(r.segment), r]));
  const additive = ['leads', 'delivered', 'called', 'rpcs', 'sales', 'billable_sales', 'activations', 'revenue'].includes(params.metric);
  const data = [...new Set([...current.keys(), ...prior.keys()])].map(segment => {
    const c = current.get(segment), p = prior.get(segment);
    const cv = c ? finiteOrNull(c.val) : (additive ? 0 : null), pv = p ? finiteOrNull(p.val) : (additive ? 0 : null);
    const change = cv !== null && pv !== null ? cv - pv : null;
    return { segment, current: cv, previous: pv, change, pctChange: change !== null && pv !== null && pv !== 0 ? Number((100 * change / Math.abs(pv)).toFixed(1)) : null,
      currentVolume: Number(c?.volume) || 0, previousVolume: Number(p?.volume) || 0 };
  }).sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));
  return { success: true, metric: params.metric, dimension: params.dimension, daysCompared: previous.days,
    comparison: { current: { startDate: start, endDate: end }, previous }, appliedFilters: scope.filters,
    isAdditive: additive, interpretation: 'Observed differences, not evidence of causation. Outcome maturity can differ between capture cohorts.', data };
}
