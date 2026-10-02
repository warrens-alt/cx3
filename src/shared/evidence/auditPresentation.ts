import { buildPreservedDestination, getAllowedParamsForTarget, UNIVERSAL_SCOPE_PARAMS, INVESTIGATION_SCOPE_PARAMS } from '../../app/navigation/ScopePreservingRedirect';

export interface AuditScope {
  clientId: string;
  clientLabel?: string;
  startDate?: string;
  endDate?: string;
  filters?: Record<string, unknown>;
  /** Exact saved case predicates. An empty object deliberately clears inherited case narrowing. */
  narrowing?: Record<string, string>;
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
  for (const [key, value] of Object.entries(scope.narrowing || {})) {
    if ((INVESTIGATION_SCOPE_PARAMS.has(key) || key === 'search') && value) params.set(key, value);
  }
  return params.size ? `?${params}` : '';
}
/** Only established public scope parameters can travel; selected lead IDs stay local. */
export function auditScopeSearch(search: string, scope?: AuditScope): string {
  const result = new URLSearchParams(search);
  result.delete('leadId');
  result.delete('lead_id');
  if (scope) {
    for (const key of UNIVERSAL_SCOPE_PARAMS) if (key !== 'workspace') result.delete(key);
    if (scope.narrowing !== undefined) {
      for (const key of [...INVESTIGATION_SCOPE_PARAMS, 'search']) result.delete(key);
    }
    for (const [key, value] of new URLSearchParams(buildScopeSearch(scope))) result.set(key, value);
  }
  return result.toString();
}
export function auditDestination(path: string, search: string, scope?: AuditScope): string {
  return buildPreservedDestination(path, auditScopeSearch(search, scope));
}
/** Do not turn a private record search/identity-filter population into a shareable URL. */
export function canShareAuditScope(search: string): boolean {
  const params = new URLSearchParams(search);
  if (['search', 'leadId', 'lead_id', 'consumerId'].some(key => params.has(key))) return false;
  try {
    const filters = JSON.parse(params.get('filters') || '{}');
    return !Object.keys(filters).some(key => /lead.?id|consumer.?id|transaction/i.test(key));
  } catch { return false; }
}
export function scopedViewPath(pathname: string, search: string, scope?: AuditScope): string {
  const params = new URLSearchParams(auditScopeSearch(search, scope));
  const allowed = getAllowedParamsForTarget(pathname, params.toString());
  const result = new URLSearchParams();
  for (const [key, value] of params) if (allowed.has(key)) result.append(key, value);
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
  if (value == null || (typeof value === 'number' && !Number.isFinite(value)) || (typeof value === 'string' && /^(?:$|—(?:\s|$)|(?:Unavailable|Timestamp unavailable)(?:\s|%|$)|Not (?:recorded|supplied|measured|calculable)$)/i.test(value.trim()))) return 'Unavailable';
  if (value === 0 || (typeof value === 'string' && /^(?:(?:[A-Z]{3}|R|[$€£])\s*)?[+-]?0+(?:[.,]0+)?(?:\s*(?:%|leads?|records?|s|m|h))?$/i.test(value.trim()))) return 'Measured zero';
  return 'Observed';
}

export const STAGE_METRIC_IDS: Record<string, string> = { fetched: 'fetched_leads', delivered: 'delivered_leads', dialled: 'dialled_leads', rpc: 'rpc_leads', sales: 'sale_leads', activated: 'activated_leads' };
