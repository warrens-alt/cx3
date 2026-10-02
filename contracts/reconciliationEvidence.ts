import { METRIC_REGISTRY_VERSION } from './metricRegistry';
import type { Filters } from './filters';

/** Supported import format of the existing operator-run harness, not a metric registry. */
export const RECONCILIATION_IMPORT_VERSION = 'cx.operational-reconciliation.2026-10-02.1';
export const RECONCILIATION_GRAIN = 'Distinct lead IDs after scoped source selection; revenue keys at lead/vendor/transaction grain';
export const RECONCILIATION_PERSISTENCE = { status: 'UNAVAILABLE', reason: 'No approved reconciliation evidence store is configured. Imported files remain in this browser view only.' } as const;
export const RECONCILIATION_FILE_LIMIT = 131_072;
export type ReconciliationRunMode = 'dry-run' | 'warehouse' | 'compare';
export type ReconciliationReadinessState = 'Not run' | 'Dry-run validated' | 'Warehouse measured' | 'Compared with service' | 'Matched' | 'Mismatch detected' | 'Unavailable';
export interface ReconciliationScope { tenant: string; startDate: string; endDate: string; filters: Partial<Record<'vendor' | 'source' | 'grade', string>> }
export interface ReconciliationComparison { metric: string; warehouse: string | null; service: string | null; difference: string | null; status: 'RECONCILED_FOR_SCOPE' | 'MISMATCH' | 'UNAVAILABLE' }
export interface ImportedReconciliationEvidence {
  scope: ReconciliationScope;
  state: ReconciliationReadinessState;
  declaredStatus: 'LIVE_RECONCILIATION_PENDING' | 'WAREHOUSE_MEASURED_ONLY' | 'RECONCILED_FOR_SCOPE' | 'MISMATCH_OR_UNAVAILABLE';
  provenance: 'OPERATOR_SUPPLIED_UNATTESTED';
  generatedAt: string; asOf: string; timezone: string; dateBasis: 'INTAKE_CAPTURE_COHORT'; countingGrain: string;
  definitionVersion: string; harnessVersion: string; sourceTables: string[]; warehouseQueryId: string | null;
  maximumBytesBilled: string; dryRunBytes: number | null; metrics: Record<string, string | null>; comparisons: ReconciliationComparison[];
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${label} must be a bounded nonempty string.`);
  return value;
}
function date(value: unknown, label: string): string {
  const result = text(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) throw new Error(`${label} must be an actual calendar date.`);
  return result;
}
function scope(tenant: unknown, start: unknown, end: unknown, filters: unknown): ReconciliationScope {
  const tenantId = text(tenant, 'Tenant', 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) throw new Error('Invalid tenant.');
  const startDate = date(start, 'Start date'), endDate = date(end, 'End date');
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
  if (days < 0 || days > 365) throw new Error('Select ordered dates spanning at most 366 inclusive days.');
  const values: ReconciliationScope['filters'] = {};
  for (const [key, value] of Object.entries(object(filters, 'Filters'))) {
    if (!['vendor', 'source', 'grade'].includes(key)) throw new Error(`Unsupported reconciliation filter: ${key}.`);
    const filter = text(value, `${key} filter`, 200);
    if (filter.trim() !== filter || ['all', 'all vendors', 'all sources', 'all grades', 'undefined', 'null'].includes(filter.toLowerCase()) || filter.startsWith('--')) throw new Error(`Select an exact ${key} value or remove the filter.`);
    values[key as keyof typeof values] = filter;
  }
  return { tenant: tenantId, startDate, endDate, filters: values };
}
export function reconciliationScopeKey(value: ReconciliationScope): string {
  return JSON.stringify([value.tenant, value.startDate, value.endDate, ...['vendor', 'source', 'grade'].map(key => value.filters[key as keyof typeof value.filters] ?? null)]);
}
export function prepareReconciliationScope(input: { tenant: string; startDate: string; endDate: string; filters: Filters; unsupportedParameters?: string[] }): ReconciliationScope {
  if (input.unsupportedParameters?.length) throw new Error(`This operator workflow cannot apply these URL parameters: ${input.unsupportedParameters.join(', ')}. Remove them explicitly before preparing a command.`);
  const values: Record<string, string> = {};
  for (const [key, condition] of Object.entries(input.filters)) {
    if (!['vendor', 'source', 'grade'].includes(key)) throw new Error(`Unsupported reconciliation filter: ${key}.`);
    const value = condition.operator === 'equals' ? condition.value : condition.operator === 'in' && condition.values?.length === 1 ? condition.values[0] : undefined;
    if (typeof value !== 'string') throw new Error(`Reconciliation requires one exact ${key} value; other filter operators and multiple values are unsupported.`);
    values[key] = value;
  }
  return scope(input.tenant, input.startDate, input.endDate, values);
}
const shellQuote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;
export function reconciliationCommand(value: ReconciliationScope, mode: ReconciliationRunMode): string {
  const checked = scope(value.tenant, value.startDate, value.endDate, value.filters);
  if (!['dry-run', 'warehouse', 'compare'].includes(mode)) throw new Error('Unsupported run mode.');
  const args = ['--client', checked.tenant, '--start', checked.startDate, '--end', checked.endDate];
  for (const key of ['vendor', 'source', 'grade'] as const) if (checked.filters[key]) args.push(`--${key}`, checked.filters[key]!);
  const command = `npm run reconcile:metrics -- ${args.map((arg, index) => index % 2 ? shellQuote(arg) : arg).join(' ')}`;
  return command + (mode === 'dry-run' ? ' --dry-run' : mode === 'compare' ? ' --compare-service' : '');
}
function timestamp(value: unknown, label: string): string {
  const result = text(value, label, 35);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(result) || !Number.isFinite(Date.parse(result))) throw new Error(`Invalid ${label}.`);
  date(result.slice(0, 10), label);
  if (new Date(result).toISOString().slice(0, 19) !== result.slice(0, 19)) throw new Error(`Invalid ${label}.`);
  return result;
}
function decimal(value: unknown, label: string, count = false): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 100 || !(count ? /^\d+$/ : /^-?\d+(?:\.\d+)?$/).test(value)) throw new Error(`${label} must be an exact decimal string or null.`);
  return value;
}

export function parseReconciliationEvidence(input: string, expectedScope: ReconciliationScope): ImportedReconciliationEvidence {
  if (input.length > RECONCILIATION_FILE_LIMIT) throw new Error('Reconciliation file exceeds 128 KiB.');
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch { throw new Error('Choose the JSON output of the reconciliation harness.'); }
  const raw = object(parsed, 'Reconciliation evidence');
  if (raw.harnessVersion !== RECONCILIATION_IMPORT_VERSION || raw.definitionVersion !== METRIC_REGISTRY_VERSION) throw new Error('Unsupported harness or metric definition version.');
  if (raw.validationStatus !== 'NOT_VERIFIED' || raw.sourceContractStatus !== 'BUSINESS_MEANING_NOT_VERIFIED') throw new Error('Imported evidence must preserve unverified validation and business meaning.');
  if (raw.countingGrain !== RECONCILIATION_GRAIN || raw.dateBasis !== 'INTAKE_CAPTURE_COHORT' || raw.truncation !== false) throw new Error('Unsupported grain, date basis or truncated evidence.');
  const period = object(raw.period, 'Period');
  const importedScope = scope(raw.tenant, period.start, period.end, raw.filters);
  if (reconciliationScopeKey(importedScope) !== reconciliationScopeKey(expectedScope)) throw new Error('Imported evidence does not match the selected tenant, dates and complete filters.');
  const generatedAt = timestamp(raw.generatedAt, 'generation timestamp'), asOf = timestamp(raw.asOf, 'as-of timestamp');
  if (Date.parse(asOf) > Date.parse(generatedAt)) throw new Error('As-of time cannot follow generation time.');
  const timezone = text(raw.timezone, 'Timezone', 80);
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw new Error('Invalid timezone.'); }
  if (!Array.isArray(raw.sourceTables) || !raw.sourceTables.length || raw.sourceTables.length > 10 || raw.sourceTables.some(value => typeof value !== 'string' || !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$/.test(value))) throw new Error('Source-table provenance is unavailable or invalid.');
  const maximumBytesBilled = text(raw.maximumBytesBilled, 'Query ceiling', 19);
  if (!/^\d+$/.test(maximumBytesBilled) || BigInt(maximumBytesBilled) <= 0n || BigInt(maximumBytesBilled) > 9223372036854775807n) throw new Error('Invalid query ceiling.');
  const common = { scope: importedScope, provenance: 'OPERATOR_SUPPLIED_UNATTESTED' as const, generatedAt, asOf, timezone,
    countingGrain: RECONCILIATION_GRAIN, dateBasis: 'INTAKE_CAPTURE_COHORT' as const, definitionVersion: METRIC_REGISTRY_VERSION,
    harnessVersion: RECONCILIATION_IMPORT_VERSION, sourceTables: raw.sourceTables as string[], maximumBytesBilled };
  if (raw.dryRun !== undefined) {
    const dryRun = object(raw.dryRun, 'Dry run');
    if (raw.reconciliationStatus !== 'LIVE_RECONCILIATION_PENDING' || raw.metrics !== undefined || raw.comparisons !== undefined || raw.comparison !== null) throw new Error('A dry run cannot contain measured or compared evidence.');
    const bytes = dryRun.totalBytesProcessed;
    if (bytes !== null && (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0)) throw new Error('Invalid dry-run byte estimate.');
    return { ...common, state: 'Dry-run validated', declaredStatus: 'LIVE_RECONCILIATION_PENDING', warehouseQueryId: null, dryRunBytes: bytes as number | null, metrics: {}, comparisons: [] };
  }
  const metricValues = object(raw.metrics, 'Warehouse metrics');
  if (!Object.keys(metricValues).length || Object.keys(metricValues).length > 100) throw new Error('Warehouse measurements are missing or excessive.');
  const metrics = Object.fromEntries(Object.entries(metricValues).map(([key, value]) => {
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,79}$/.test(key)) throw new Error('Invalid metric identifier.');
    return [key, decimal(value, key)];
  }));
  const warehouseQueryId = raw.warehouseQueryId === null ? null : text(raw.warehouseQueryId, 'Warehouse job ID');
  if (raw.comparisons === null) {
    if (raw.reconciliationStatus !== 'WAREHOUSE_MEASURED_ONLY' || !Array.isArray(raw.comparedMetrics) || raw.comparedMetrics.length) throw new Error('Uncompared warehouse measurements cannot claim reconciliation.');
    return { ...common, state: 'Warehouse measured', declaredStatus: 'WAREHOUSE_MEASURED_ONLY', warehouseQueryId, dryRunBytes: null, metrics, comparisons: [] };
  }
  const metricIds = ['fetched', 'qualifiedDelivered', 'qualifiedDialled', 'rpc', 'recordedSales', 'recordedActivations', 'callCountUnrecorded'];
  if (!Array.isArray(raw.comparisons) || raw.comparisons.length !== metricIds.length) throw new Error('The complete supported service comparison is required.');
  const seen = new Set<string>();
  const comparisons = raw.comparisons.map((entry): ReconciliationComparison => {
    const row = object(entry, 'Comparison'), metric = text(row.metric, 'Comparison metric');
    if (!metricIds.includes(metric) || seen.has(metric)) throw new Error('Unknown or duplicate comparison metric.');
    seen.add(metric);
    const warehouse = decimal(row.warehouse, 'Warehouse count', true), service = decimal(row.service, 'Service count', true);
    if (service !== null && BigInt(service) > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Service count exceeds the harness safe-integer contract.');
    if (warehouse !== metrics[metric]) throw new Error('Comparison value differs from its warehouse measurement.');
    const difference = warehouse === null || service === null ? null : (BigInt(service) - BigInt(warehouse)).toString();
    const status = difference === null ? 'UNAVAILABLE' : difference === '0' ? 'RECONCILED_FOR_SCOPE' : 'MISMATCH';
    if (row.difference !== difference || row.status !== status) throw new Error('Comparison difference or status contradicts the exact supplied counts.');
    return { metric, warehouse, service, difference, status };
  });
  if (!Array.isArray(raw.comparedMetrics) || JSON.stringify(raw.comparedMetrics) !== JSON.stringify(comparisons.map(row => row.metric))) throw new Error('Compared metric list differs from the evidence rows.');
  const allMatch = comparisons.every(row => row.status === 'RECONCILED_FOR_SCOPE');
  const declaredStatus = allMatch ? 'RECONCILED_FOR_SCOPE' : 'MISMATCH_OR_UNAVAILABLE';
  if (raw.reconciliationStatus !== declaredStatus) throw new Error('Overall reconciliation claim contradicts the comparison evidence.');
  const state = allMatch ? 'Matched' : comparisons.some(row => row.status === 'MISMATCH') ? 'Mismatch detected' : 'Unavailable';
  return { ...common, state, declaredStatus, warehouseQueryId, dryRunBytes: null, metrics, comparisons };
}
