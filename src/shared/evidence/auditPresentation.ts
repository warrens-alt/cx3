import { getAllowedParamsForTarget, UNIVERSAL_SCOPE_PARAMS } from '../../app/navigation/ScopePreservingRedirect';

export interface AuditScope {
  clientId: string;
  clientLabel?: string;
  startDate?: string;
  endDate?: string;
  filters?: Record<string, unknown>;
}
export interface AuditDefinition {
  meaning?: string;
  grain?: string;
  dateBasis?: string;
  nullMeaning?: string;
  calculation?: string;
  limitations?: string[];
}
/** Explicit display allowlist: never spread a response/configuration into the audit UI. */
export interface AuditProvenance {
  validationStatus?: string;
  dateBasis?: string;
  countingGrain?: string;
  generatedAt?: string;
  evaluatedAt?: string;
  queryJobId?: string;
  reportVersion?: string;
  metricVersion?: string;
  observationCutoff?: string;
  timezone?: string;
  modelVersion?: string;
  source?: string;
  sourceCompleteness?: string;
}
export function buildScopeSearch(scope?: AuditScope): string {
  if (!scope) return '';
  const params = new URLSearchParams();
  if (scope.clientId) params.set('clientId', scope.clientId);
  if (scope.startDate) params.set('startDate', scope.startDate);
  if (scope.endDate) params.set('endDate', scope.endDate);
  const structured: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(scope.filters || {})) {
    if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
    else if (value !== undefined && value !== null) structured[key] = value;
  }
  if (Object.keys(structured).length) params.set('filters', JSON.stringify(structured));
  return params.size ? `?${params}` : '';
}
export function scopedViewPath(pathname: string, search: string, scope?: AuditScope): string {
  const params = new URLSearchParams(search);
  const allowed = getAllowedParamsForTarget(pathname, params.toString());
  const result = new URLSearchParams();
  for (const [key, value] of params) if (allowed.has(key)) result.append(key, value);
  if (scope) {
    // The observed result's explicit scope wins over potentially newer controls.
    for (const key of UNIVERSAL_SCOPE_PARAMS) if (key !== 'workspace') result.delete(key);
    for (const [key, value] of new URLSearchParams(buildScopeSearch(scope))) if (allowed.has(key)) result.append(key, value);
  }
  return pathname + (result.size ? `?${result}` : '');
}
export function filterDescription(value: unknown): string {
  if (value === null || value === undefined) return 'Not supplied';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.map(filterDescription).join(', ');
  const condition = value as Record<string, unknown>;
  if (condition.operator === 'in' && Array.isArray(condition.values)) return `in: ${condition.values.map(String).join(', ')}`;
  if (condition.operator === 'equals') return `equals: ${String(condition.value)}`;
  if (condition.operator === 'between') return `between: ${String(condition.min)} → ${String(condition.max)}`;
  return JSON.stringify(value);
}
export function resultState(value: string | number | null | undefined) {
  if (value == null || (typeof value === 'number' && !Number.isFinite(value)) || (typeof value === 'string' && /^(?:$|—(?:\s|$)|Unavailable$|Not (?:recorded|supplied)$)/i.test(value.trim()))) return 'Unavailable';
  if (value === 0 || (typeof value === 'string' && /^(?:(?:[A-Z]{3}|R|[$€£])\s*)?[+-]?0+(?:[.,]0+)?(?:\s*(?:%|leads?|records?|s|m|h))?$/i.test(value.trim()))) return 'Measured zero';
  return 'Observed';
}

export const STAGE_METRIC_IDS: Record<string, string> = { fetched: 'fetched_leads', delivered: 'delivered_leads', dialled: 'dialled_leads', rpc: 'rpc_leads', sales: 'sale_leads', activated: 'activated_leads' };
