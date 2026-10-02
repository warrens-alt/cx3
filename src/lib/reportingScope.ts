import type { Filters } from '../../contracts/filters';
import { validateDate } from '../../contracts/filters';
import { METRIC_BY_ID, type ReportRequest, type ReleaseManifest } from '../../contracts/reporting';
import { UNIVERSAL_SCOPE_PARAMS } from '../app/navigation/ScopePreservingRedirect';

export function reportLocalScopeError(search: string): string | null {
  const params = new URLSearchParams(search);
  return [...params.keys()].some(key => !UNIVERSAL_SCOPE_PARAMS.has(key) && key !== 'release') ? 'This URL includes record, investigation or legacy scope that immutable reports cannot apply. Remove those parameters explicitly before executing.' : null;
}

/** Scope projection is strict: unsupported dimensions/operators never disappear. */
export function reportingFilters(filters: Filters): ReportRequest['filters'] {
  const result: ReportRequest['filters'] = {};
  for (const [key, condition] of Object.entries(filters)) {
    if (!['vendor', 'source', 'medium'].includes(key)) throw new Error(`Evidence reports do not support the ${key} filter. Remove it explicitly to change scope.`);
    const values = condition.operator === 'equals' ? [condition.value] : condition.operator === 'in' ? condition.values : null;
    if (!values?.length || values.length > 20 || values.some(value => typeof value !== 'string' || !value.trim())) throw new Error(`Evidence reports require explicit equality or inclusion values for ${key}.`);
    result[key as keyof ReportRequest['filters']] = [...new Set(values as string[])].sort();
  }
  return result;
}

export function reportingScopeError(request: ReportRequest, release: ReleaseManifest | null): string | null {
  try {
    if (!validateDate(request.startDate, 'startDate') || !validateDate(request.endDate, 'endDate')) return 'Choose explicit start and end dates in the reporting scope.';
    if (request.startDate > request.endDate) return 'Start date must be on or before end date.';
    if (Date.parse(request.endDate) - Date.parse(request.startDate) > 365 * 86400000) return 'Choose at most 366 inclusive days.';
    if (!release?.execution) return 'This release has no approved executable aggregate snapshot.';
    if (release.tenantId !== request.tenantId) return 'The release belongs to a different workspace.';
    if (release.status !== 'PUBLISHED') return 'This release is not published.';
    if (request.endDate > release.cutoff.slice(0, 10)) return 'The selected dates extend beyond the immutable release cutoff.';
    if (!release.execution.supportedDateBases.includes(request.dateBasis)) return 'This date basis is not supported by the release.';
    if (!release.execution.supportedGroupings.includes(request.grouping)) return 'This grouping is not supported by the release.';
    if (!request.metrics.length || request.metrics.some(metric => !METRIC_BY_ID[metric] || !release.execution!.supportedMetrics.includes(metric) || !METRIC_BY_ID[metric].dateBases.includes(request.dateBasis))) return 'Choose metrics supported by this release and date basis.';
    if (Object.keys(request.filters).some(key => !release.execution!.supportedFilters.includes(key as keyof ReportRequest['filters']))) return 'The release does not support all selected filters. Remove unsupported filters explicitly.';
    return null;
  } catch (error) { return error instanceof Error ? error.message : 'Invalid reporting scope.'; }
}
