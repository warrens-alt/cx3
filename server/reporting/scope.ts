import { METRIC_BY_ID, METRICS, REPORT_REQUEST_VERSION, type VersionedReportRequest } from '../../contracts/reporting';
import { RequestError, validateDate } from '../bigquery/filters';
import { fingerprint } from './fingerprint';

export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError(`Invalid ${label}`, 422);
  return value as Record<string, unknown>;
}
export function allowedKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new RequestError(`Unsupported ${label} field`, 422);
}
export function reportIdentity(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new RequestError(`Explicit ${label} is required`, 422);
  return value;
}
export function isoTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw new RequestError(`${label} must be a UTC ISO timestamp`, 422);
  validateDate(value.slice(0, 10), label);
  if (value.slice(11, 19) !== new Date(value).toISOString().slice(11, 19)) throw new RequestError(`Invalid ${label}`, 422);
  return new Date(value).toISOString();
}
export function reportRequest(input: unknown): VersionedReportRequest {
  const raw = object(input, 'report request');
  allowedKeys(raw, ['contractVersion', 'releaseId', 'tenantId', 'startDate', 'endDate', 'observationCutoff', 'dateBasis', 'grouping', 'currency', 'metrics', 'filters'], 'report request');
  if (raw.contractVersion !== REPORT_REQUEST_VERSION) throw new RequestError('Unsupported report request contract version', 422);
  const tenantId = reportIdentity(raw.tenantId, 'tenantId'), releaseId = reportIdentity(raw.releaseId, 'releaseId');
  const startDate = validateDate(raw.startDate, 'startDate'), endDate = validateDate(raw.endDate, 'endDate');
  if (!startDate || !endDate || endDate < startDate || Date.parse(endDate) - Date.parse(startDate) > 365 * 86_400_000) throw new RequestError('Select an ordered UTC period of at most 366 inclusive days', 422);
  const observationCutoff = isoTimestamp(raw.observationCutoff, 'observationCutoff');
  if (observationCutoff < `${startDate}T00:00:00.000Z`) throw new RequestError('Observation cutoff predates the requested period', 422);
  if (!['capture_cohort', 'event_date'].includes(raw.dateBasis as string)) throw new RequestError('Unsupported date basis', 422);
  if (!['none', 'source', 'vendor', 'capture_month'].includes(raw.grouping as string)) throw new RequestError('Unsupported grouping', 422);
  if (typeof raw.currency !== 'string' || !/^[A-Z]{3}$/.test(raw.currency)) throw new RequestError('Select an explicit ISO currency code', 422);
  if (!Array.isArray(raw.metrics) || !raw.metrics.length || raw.metrics.length > METRICS.length || raw.metrics.some(id => typeof id !== 'string' || !Object.hasOwn(METRIC_BY_ID, id))) throw new RequestError('Unknown or missing registered metric', 422);
  if (new Set(raw.metrics).size !== raw.metrics.length) throw new RequestError('Duplicate metric selection', 422);
  const filters = object(raw.filters, 'filters');
  allowedKeys(filters, ['vendor', 'source', 'medium'], 'filter');
  const normalized: VersionedReportRequest['filters'] = {};
  for (const key of ['vendor', 'source', 'medium'] as const) {
    const values = filters[key];
    if (values === undefined) continue;
    if (!Array.isArray(values) || !values.length || values.length > 20 || values.some(value => typeof value !== 'string' || value !== value.trim() || !value || value.length > 128 || /[\u0000-\u001f]/.test(value))) throw new RequestError(`Invalid ${key} filter`, 422);
    normalized[key] = [...new Set(values as string[])].sort();
  }
  return { contractVersion: REPORT_REQUEST_VERSION, tenantId, releaseId, startDate, endDate, observationCutoff, dateBasis: raw.dateBasis as VersionedReportRequest['dateBasis'], grouping: raw.grouping as VersionedReportRequest['grouping'], currency: raw.currency, metrics: [...raw.metrics].sort(), filters: normalized };
}
/** Metric selection is separate: each immutable row holds one registered metric for this exact scope. */
export function reportScopeHash(request: VersionedReportRequest): string {
  const { metrics: _metrics, releaseId: _release, ...scope } = request;
  return fingerprint(scope);
}
