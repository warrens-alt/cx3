/** Opt-in, read-only audit. This independent aggregation intentionally does not import operationalLeadCtes. */
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { getClientConfig } from '../server/bigquery/config';
import { getBigQueryClient } from '../server/bigquery/client';
import { validateScope } from '../server/bigquery/filters';
import { validTimestampSql } from '../server/bigquery/integrity';
import { safeSourceError } from '../server/bigquery/sourceAccess';
import { buildFilterClause } from '../server/analytics/common/scope';
import { configuredSourceTable } from '../server/analytics/common/warehouse';
import type { OffernetQueryParams } from '../server/analytics/common/types';
import { getExecutiveOverview } from '../server/analytics/overview/service';
import { METRIC_REGISTRY_VERSION } from '../contracts/metricRegistry';

export const RECONCILIATION_VERSION = 'cx.operational-reconciliation.2026-10-02.1';
export const RECONCILIATION_USAGE = `Usage: npm run reconcile:metrics -- --client mtn --start 2026-09-01 --end 2026-09-30 [--vendor NAME] [--source NAME] [--grade NAME] [--compare-service] [--dry-run]

Read-only, opt-in BigQuery audit using existing credentials (including ADC).
An explicit active tenant and ordered dates are required; maximum 366 inclusive days.
Unsupported filters fail before a warehouse job. No fallback source, writes or schema changes.
--dry-run estimates the independent query; it does not execute the service comparison.
JSON on stdout preserves exact count and decimal strings. Comparison table goes to stderr.
Matching compared metrics means RECONCILED_FOR_SCOPE only, never business certification.`;
export interface ReconciliationOptions { scope: OffernetQueryParams; compareService: boolean; dryRun: boolean }
export function parseReconciliationArgs(args: string[]): ReconciliationOptions | null {
  if (args.includes('--help') || args.includes('-h')) return null;
  const values = new Map<string, string>();
  let compareService = false, dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (values.has(key)) throw new Error(`Specify ${key} only once.`);
    if (key === '--compare-service' || key === '--dry-run') {
      values.set(key, 'true'); compareService ||= key === '--compare-service'; dryRun ||= key === '--dry-run'; continue;
    }
    if (!['--client', '--start', '--end', '--vendor', '--source', '--grade'].includes(key)) throw new Error(`Unknown option ${key}. Use --help.`);
    const value = args[++i];
    if (!value?.trim() || value.startsWith('--')) throw new Error(`Missing value for ${key}.`);
    values.set(key, value.trim());
  }
  for (const key of ['--client', '--start', '--end']) if (!values.has(key)) throw new Error(`${key} is required.`);
  const clientId = getClientConfig(values.get('--client')!).id;
  const dates = validateScope({ clientId, startDate: values.get('--start'), endDate: values.get('--end') });
  if (Date.parse(dates.endDate!) - Date.parse(dates.startDate!) > 365 * 86_400_000) throw new Error('Select at most 366 inclusive days.');
  const scope: OffernetQueryParams = { clientId, startDate: dates.startDate, endDate: dates.endDate };
  for (const key of ['vendor', 'source', 'grade'] as const) if (values.has(`--${key}`)) {
    const value = values.get(`--${key}`)!;
    if (['all', 'all vendors', 'all sources', 'all grades', 'undefined', 'null'].includes(value.toLowerCase())) throw new Error(`Omit --${key} for the full population; a supplied filter must select a value.`);
    scope[key] = value;
  }
  buildFilterClause(scope); // Validate source-specific support before any query/client creation.
  return { scope, compareService, dryRun };
}

/** Only source adaptation, timestamp parsing and access/scope guards are shared; rollups/formulas are independent. */
export function compileReconciliationQuery(scope: OffernetQueryParams, asOf: string) {
  const config = getClientConfig(scope.clientId);
  const { whereSql, queryParams } = buildFilterClause(scope);
  const counts: Record<string, string> = {
    fetched: 'COUNT(*)', recordedDelivered: 'COUNTIF(delivery IS NOT NULL)', qualifiedDelivered: 'COUNTIF(delivery_ok)',
    recordedDialled: 'COUNTIF(dial IS NOT NULL)', qualifiedDialled: 'COUNTIF(dial_ok)', rpc: 'COUNTIF(dial_ok AND rpc IS TRUE)',
    unknownRpcDialled: 'COUNTIF(dial_ok AND rpc IS NULL)', recordedSales: 'COUNTIF(sale IS NOT NULL)', recordedActivations: 'COUNTIF(activation IS NOT NULL)',
    qualifiedSaleActivation: 'COUNTIF(sale >= capture AND activation >= sale)',
    deliveryBeforeCapture: 'COUNTIF(delivery < capture)', firstDialBeforeCapture: 'COUNTIF(dial < capture)',
    firstDialBeforeDelivery: 'COUNTIF(dial < delivery)', saleBeforeCapture: 'COUNTIF(sale < capture)', activationBeforeSale: 'COUNTIF(activation < sale)',
    callCountUnrecorded: 'COUNTIF(calls IS NULL)', dialledCallCountUnrecorded: 'COUNTIF(dial_ok AND calls IS NULL)',
    zeroCalls: 'COUNTIF(calls = 0)', oneCall: 'COUNTIF(calls = 1)', twoCalls: 'COUNTIF(calls = 2)', threeCalls: 'COUNTIF(calls = 3)', fourCalls: 'COUNTIF(calls = 4)', fivePlusCalls: 'COUNTIF(calls >= 5)', fivePlusNoRpc: 'COUNTIF(calls >= 5 AND rpc IS FALSE)',
    salesRevenuePresent: 'COUNTIF(sale IS NOT NULL AND complete_revenue IS NOT NULL)', salesRevenueExplicitZero: 'COUNTIF(sale IS NOT NULL AND complete_revenue = 0)', salesRevenueMissing: 'COUNTIF(sale IS NOT NULL AND complete_revenue IS NULL)',
    revenueMissingLeads: 'COUNTIF(complete_revenue IS NULL)',
    awaitingFirstDial: 'COUNTIF(delivery_ok AND NOT dial_ok)',
    backlogOver15m: 'COUNTIF(delivery_ok AND NOT dial_ok AND TIMESTAMP_DIFF(TIMESTAMP(@asOf), delivery, SECOND) > 900)',
    backlogOver60m: 'COUNTIF(delivery_ok AND NOT dial_ok AND TIMESTAMP_DIFF(TIMESTAMP(@asOf), delivery, SECOND) > 3600)',
  };
  const ratios: Record<string, [string,string]> = {
    deliveryRate: ['COUNTIF(delivery_ok)', 'COUNT(*)'], dialCoverage: ['COUNTIF(dial_ok)', 'COUNTIF(delivery_ok)'],
    rpcRate: ['COUNTIF(dial_ok AND rpc IS TRUE)', 'COUNTIF(dial_ok)'], leadToSale: ['COUNTIF(sale IS NOT NULL)', 'COUNT(*)'],
    independentActivationSaleRatio: ['COUNTIF(activation IS NOT NULL)', 'COUNTIF(sale IS NOT NULL)'],
    qualifiedSaleActivationConversion: ['COUNTIF(sale >= capture AND activation >= sale)', 'COUNTIF(sale IS NOT NULL)'],
  };
  const sql = `WITH raw AS (
    SELECT l.lead_id, ${validTimestampSql('l.fetched')} AS capture,
      ${validTimestampSql('hlc.delivered')} AS delivery, ${validTimestampSql('hlc.first_call_date')} AS dial,
      ${validTimestampSql('hlc.sale')} AS sale, ${validTimestampSql('hlc.activated')} AS activation,
      CASE WHEN SAFE_CAST(hlc.total_calls AS INT64) >= 0 THEN SAFE_CAST(hlc.total_calls AS INT64) END AS calls,
      CASE WHEN SAFE_CAST(hlc.rpc AS INT64) >= 0 THEN SAFE_CAST(hlc.rpc AS INT64) > 0 END AS rpc,
      hlc IS NOT NULL AS has_transaction, COALESCE(hlc.vendor, 'Unknown') AS vendor_group,
      NULLIF(TRIM(CAST(hlc.vendor AS STRING)), '') AS vendor_key,
      NULLIF(TRIM(CAST(hlc.transaction_id AS STRING)), '') AS transaction_key,
      SAFE_CAST(hlc.revenue_generated AS NUMERIC) AS amount,
      UPPER(NULLIF(TRIM(CAST(hlc.currency AS STRING)), '')) AS currency
    FROM ${configuredSourceTable(scope.clientId, 'leads')} l LEFT JOIN UNNEST(l.hlc_details) hlc
    ${whereSql}
  ), leads AS (
    SELECT lead_id, MIN(capture) AS capture, MIN(delivery) AS delivery, MIN(dial) AS dial,
      MIN(sale) AS sale, MIN(activation) AS activation, MAX(calls) AS calls,
      CASE WHEN COUNTIF(rpc IS TRUE) > 0 THEN TRUE WHEN COUNTIF(rpc IS NULL) > 0 THEN NULL ELSE FALSE END AS rpc
    FROM raw WHERE lead_id IS NOT NULL GROUP BY lead_id
  ), qualified AS (
    SELECT *, (capture IS NOT NULL AND delivery IS NOT NULL AND delivery >= capture) AS delivery_ok,
      (capture IS NOT NULL AND delivery IS NOT NULL AND dial IS NOT NULL AND delivery >= capture AND dial >= capture AND dial >= delivery) AS dial_ok
    FROM leads
  ), revenue_keys AS (
    SELECT lead_id, vendor_group, vendor_key, transaction_key, COUNT(*) AS source_rows,
      COUNT(DISTINCT TO_JSON_STRING(STRUCT(amount AS amount, currency AS currency))) AS variants,
      ANY_VALUE(amount) AS amount, ANY_VALUE(currency) AS currency
    FROM raw WHERE lead_id IS NOT NULL AND has_transaction
    GROUP BY lead_id, vendor_group, vendor_key, transaction_key
  ), assessed_keys AS (
    SELECT *, vendor_key IS NOT NULL AND transaction_key IS NOT NULL AND variants = 1 AND amount IS NOT NULL AND currency = @currency AS eligible
    FROM revenue_keys
  ), revenue_leads AS (
    SELECT lead_id, IF(COUNTIF(eligible IS NOT TRUE) > 0, NULL, SUM(amount)) AS complete_revenue,
      SUM(IF(eligible, amount, NULL)) AS known_subtotal
    FROM assessed_keys GROUP BY lead_id
  ), population AS (
    SELECT qualified.*, revenue_leads.* EXCEPT(lead_id) FROM qualified LEFT JOIN revenue_leads USING(lead_id)
  ) SELECT
    ${Object.entries(counts).map(([name, expression]) => `CAST(${expression} AS STRING) AS ${name}`).join(',\n    ')},
    ${Object.entries(ratios).map(([name, [n,d]]) => `CAST(100 * SAFE_DIVIDE(CAST(${n} AS NUMERIC), CAST(${d} AS NUMERIC)) AS STRING) AS ${name}`).join(',\n    ')},
    CAST(APPROX_QUANTILES(IF(dial_ok, TIMESTAMP_DIFF(dial, delivery, SECOND), NULL), 100)[OFFSET(50)] AS STRING) AS medianDeliveryToDialSec,
    CAST(APPROX_QUANTILES(IF(dial_ok, TIMESTAMP_DIFF(dial, delivery, SECOND), NULL), 100)[OFFSET(90)] AS STRING) AS p90DeliveryToDialSec,
    CAST(SUM(known_subtotal) AS STRING) AS knownRevenueSubtotal,
    CAST(CASE WHEN COUNTIF(complete_revenue IS NULL) > 0 THEN NULL ELSE SUM(complete_revenue) END AS STRING) AS completeRevenueTotal,
    (SELECT CAST(COUNTIF(eligible) AS STRING) FROM assessed_keys) AS eligibleRevenueKeys,
    (SELECT CAST(COUNTIF(eligible IS NOT TRUE) AS STRING) FROM assessed_keys) AS incompleteRevenueKeys,
    (SELECT CAST(COUNTIF(variants > 1) AS STRING) FROM assessed_keys) AS conflictingRevenueKeys,
    (SELECT CAST(COALESCE(SUM(IF(eligible, source_rows - 1, 0)), 0) AS STRING) FROM assessed_keys) AS duplicateRevenueRowsCollapsed
  FROM population`;
  return { query: sql, params: { ...queryParams, asOf, currency: config.currency } };
}

const coreMetrics = {
  fetched: 'fetchedLeads', qualifiedDelivered: 'deliveredLeads', qualifiedDialled: 'dialledLeads', rpc: 'contactedLeads',
  recordedSales: 'saleLeads', recordedActivations: 'activatedLeads', callCountUnrecorded: 'unrecordedCallLeads',
} as const;
export function compareReconciliation(warehouse: Record<string, string | null>, service: { kpis: Record<string, unknown> }) {
  return Object.entries(coreMetrics).map(([metric, serviceKey]) => {
    const raw = warehouse[metric], value = service.kpis[serviceKey];
    const representable = typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    const observed = typeof raw === 'string' && /^\d+$/.test(raw);
    const difference = observed && representable ? (BigInt(value) - BigInt(raw)).toString() : null;
    return { metric, warehouse: raw ?? null, service: representable ? String(value) : null, difference,
      status: difference === null ? 'UNAVAILABLE' : difference === '0' ? 'RECONCILED_FOR_SCOPE' : 'MISMATCH' };
  });
}

export async function runReconciliation(options: ReconciliationOptions, dependencies?: { client: ReturnType<typeof getBigQueryClient>; service?: typeof getExecutiveOverview }) {
  const generatedAt = new Date().toISOString();
  const config = getClientConfig(options.scope.clientId);
  const query = compileReconciliationQuery(options.scope, generatedAt);
  const client = dependencies?.client || getBigQueryClient(config.bigQueryProject);
  const metadata = {
    tenant: config.id, period: { start: options.scope.startDate, end: options.scope.endDate },
    filters: Object.fromEntries(['vendor','source','grade'].filter(key => options.scope[key as keyof OffernetQueryParams] !== undefined).map(key => [key, options.scope[key as keyof OffernetQueryParams]])),
    generatedAt, asOf: generatedAt, timezone: config.timezone, dateBasis: 'INTAKE_CAPTURE_COHORT',
    countingGrain: 'Distinct lead IDs after scoped source selection; revenue keys at lead/vendor/transaction grain',
    sourceTables: [config.semanticMappings.tables.leads], definitionVersion: METRIC_REGISTRY_VERSION, harnessVersion: RECONCILIATION_VERSION,
    validationStatus: 'NOT_VERIFIED', sourceContractStatus: 'BUSINESS_MEANING_NOT_VERIFIED',
    truncation: false, precision: 'Warehouse counts/NUMERIC outputs are decimal strings; durations use APPROX_QUANTILES. Service count comparison refuses unsafe JS integers.',
    maximumBytesBilled: process.env.BIGQUERY_MAX_BYTES_BILLED || '1000000000',
  };
  if (options.dryRun) return { ...metadata, reconciliationStatus: 'LIVE_RECONCILIATION_PENDING', dryRun: await client.dryRun(query), comparison: null };
  const [job] = await client.createQueryJob(query);
  const [rows] = await job.getQueryResults();
  if (rows.length !== 1) throw new Error('Independent reconciliation query did not return exactly one aggregate row.');
  const metrics = rows[0] as Record<string, string | null>;
  const service = options.compareService ? await (dependencies?.service || getExecutiveOverview)(options.scope, { includeDiagnostics: false }) : null;
  const comparisons = service ? compareReconciliation(metrics, service) : null;
  return { ...metadata, warehouseQueryId: job.id || null, serviceQueryIds: null,
    reconciliationStatus: comparisons?.every(row => row.status === 'RECONCILED_FOR_SCOPE') ? 'RECONCILED_FOR_SCOPE' : comparisons ? 'MISMATCH_OR_UNAVAILABLE' : 'WAREHOUSE_MEASURED_ONLY',
    comparedMetrics: comparisons?.map(row => row.metric) || [],
    comparisonLimit: 'Only listed stable count metrics are cross-checked. Jobs run sequentially against mutable sources; matching once does not certify a production total or source meaning. Financial decimals remain exact warehouse evidence, not a legacy Number-based service reconciliation.',
    metrics, comparisons };
}
async function main() {
  let options: ReconciliationOptions | null;
  try { options = parseReconciliationArgs(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : 'Invalid arguments. Use --help.'); process.exitCode = 1; return; }
  if (!options) { console.info(RECONCILIATION_USAGE); return; }
  const result = await runReconciliation(options);
  console.info(JSON.stringify(result, null, 2));
  if ('comparisons' in result && result.comparisons) {
    console.error('Metric                        Raw query           CX3 service         Difference');
    for (const row of result.comparisons) console.error(`${row.metric.padEnd(30)}${String(row.warehouse ?? 'unavailable').padEnd(20)}${String(row.service ?? 'unavailable').padEnd(20)}${row.difference ?? 'unavailable'}`);
    if (result.comparisons.some(row => row.status !== 'RECONCILED_FOR_SCOPE')) process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(safeSourceError(error).error); process.exitCode = 1; });
}
