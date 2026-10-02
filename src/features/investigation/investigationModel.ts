import type { AiInsightsData } from '../../lib/offernetClient';
import { INVESTIGATION_LABELS } from '../../../contracts/investigation';
import type { Filters } from '../../../contracts/filters';
import { filterDescription } from '../../shared/evidence/auditPresentation';

export const SEGMENT_KEYS = ['segmentVendor', 'segmentSource', 'segmentGrade', 'segmentLeadAge'] as const;
export const INVESTIGATION_KEYS = ['drill', 'drillValue', 'investigationMetric', ...SEGMENT_KEYS] as const;
export const SEGMENT_LABELS: Record<string, string> = { segmentVendor: 'Vendor', segmentSource: 'Source', segmentGrade: 'Grade', segmentLeadAge: 'First-dial age' };
export interface InvestigationModel {
  type: 'exception' | 'metric' | 'population'; label: string; drill: string; drillValue: string; metric: string;
  search?: string; clientId: string; clientLabel: string; startDate: string; endDate: string; filters: Filters;
  segments: Array<{ key: typeof SEGMENT_KEYS[number]; label: string; value: string }>;
  populationCount?: number | null; validationStatus: string; dateBasis: string; countingGrain: string;
}
export function investigationLabel(params: URLSearchParams): string {
  const drill = params.get('drill') || '';
  const value = params.get('drillValue');
  if (drill) return `${INVESTIGATION_LABELS[drill] || 'Investigation population'}${value ? ` · ${value.replaceAll('-to-', ' → ')}` : ''}`;
  const metric = params.get('investigationMetric');
  return metric ? `Change in ${metric.replace(/([A-Z])/g, ' $1').toLowerCase()}` : 'Reporting population';
}
export function investigationRequest(params: URLSearchParams) {
  return Object.fromEntries(INVESTIGATION_KEYS.filter(key => key !== 'investigationMetric' && params.has(key)).map(key => [key, params.get(key)!]));
}
export function clearInvestigationParams(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  for (const key of [...INVESTIGATION_KEYS, 'page', 'leadId']) next.delete(key);
  return next;
}
export function investigationPath(path: string, params: URLSearchParams, changes: Record<string, string | null> = {}) {
  const next = new URLSearchParams(params);
  next.delete('leadId'); next.delete('page');
  for (const [key, value] of Object.entries(changes)) value === null ? next.delete(key) : next.set(key, value);
  return `${path}${next.size ? `?${next}` : ''}`;
}
/** Copy only an exact, safe scope. Search/identity filters cannot be dropped silently. */
export function shareableInvestigationPath(path: string, params: URLSearchParams): string | null {
  if (params.has('search') || params.has('leadId') || params.has('consumerId')) return null;
  try {
    const filters = JSON.parse(params.get('filters') || '{}');
    if (Object.keys(filters).some(key => /lead.?id|consumer.?id|transaction/i.test(key))) return null;
  } catch { return null; }
  const allowed = new Set(['clientId', 'workspace', 'startDate', 'endDate', 'filters', 'vendor', 'source', 'grade', 'medium', 'cli', 'campaign', 'channel', 'adset', 'agent', ...INVESTIGATION_KEYS]);
  const safe = new URLSearchParams();
  for (const [key, value] of params) if (allowed.has(key)) safe.append(key, value);
  return investigationPath(path, safe);
}
export function investigationScopeText(model: InvestigationModel) {
  return [model.clientLabel, `${model.startDate || 'Open start'} – ${model.endDate || 'Open end'}`,
    ...Object.entries(model.filters).map(([key, value]) => `${key}: ${filterDescription(value)}`),
    ...(model.search ? [`Record search: ${model.search}`] : []), model.label, ...model.segments.map(segment => `${segment.label}: ${segment.value}`), model.dateBasis, model.countingGrain].join(' · ');
}

export function matchesInvestigationResponse(data: AiInsightsData | null | undefined, query: Record<string, unknown>) {
  if (!data?.scope) return false;
  // Compare equivalent supported filter representations, not their JSON spelling.
  const filterShape = (value: Record<string, unknown>) => {
    const normalized = new Map<string, string>();
    for (const [key, raw] of Object.entries(value)) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const condition = raw as { operator?: string; value?: unknown; values?: unknown[] };
      const dimension = ['partner', 'ror_partner'].includes(key) ? 'vendor' : key;
      const single = condition.operator === 'equals' ? condition.value : condition.operator === 'in' && condition.values?.length === 1 ? condition.values[0] : undefined;
      const representation = single !== undefined ? JSON.stringify({ operator: 'equals', value: typeof single === 'string' ? single.trim() : single }) : JSON.stringify(raw, Object.keys(raw).sort());
      if (normalized.has(dimension) && normalized.get(dimension) !== representation) return null;
      normalized.set(dimension, representation);
    }
    return JSON.stringify([...normalized].sort(([a], [b]) => a.localeCompare(b)));
  };
  let filters: Record<string, unknown>;
  try { filters = JSON.parse(String(query.filters || '{}')); } catch { return false; }
  const expected = filterShape(filters);
  if (expected === null || filterShape(data.scope.filters || {}) !== expected) return false;
  return ['clientId', 'startDate', 'endDate', 'drill', 'drillValue', 'metric', 'search', ...SEGMENT_KEYS].every(key => (data.scope?.[key as keyof NonNullable<AiInsightsData['scope']>] || '') === (query[key] || ''));
}
