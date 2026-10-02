import type { ExceptionRuleResult } from '../../contracts/operations';
import { REPORT_REQUEST_VERSION, REPORT_RESULT_VERSION, REPORT_REPLAY_VERSION, type EvidenceReportResult, type ReportRequest, type ReleaseManifest, type ReportReplayResult } from '../../contracts/reporting';

export interface ReportingCatalogue { configured: boolean; status: string; release: ReleaseManifest | null; message?: string; reason?: string; replayConfigured?: boolean; execution?: { status: 'SUPPORTED' | 'NOT_SUPPORTED'; definitionHash: string; reason?: string }; }

async function envelope<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.success !== true || !json.data || typeof json.data !== 'object') throw new Error(typeof json?.error === 'string' ? json.error : `Evidence reporting request failed (${response.status}).`);
  return json.data as T;
}

export function validateReportResponse(raw: EvidenceReportResult, request: ReportRequest, releaseId: string): EvidenceReportResult {
  if (raw?.contractVersion !== REPORT_RESULT_VERSION || raw.request?.tenantId !== request.tenantId || raw.releaseId !== releaseId || !['AVAILABLE', 'UNAVAILABLE', 'NOT_SUPPORTED'].includes(raw.status) || !Array.isArray(raw.totals) || !Array.isArray(raw.groups) || !Array.isArray(raw.metricDefinitions) || !raw.evidence || !raw.replay) throw new Error('The returned report does not match the requested workspace, release or response contract.');
  for (const key of ['startDate', 'endDate', 'dateBasis', 'grouping', 'currency', 'observationCutoff'] as const) {
    const same = key === 'observationCutoff' ? Date.parse(raw.request[key]) === Date.parse(request[key]) : raw.request[key] === request[key];
    if (!same) throw new Error('The returned report does not match the requested scope.');
  }
  const canonical = (value: object) => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, Array.isArray(values) ? [...values].sort() : values]));
  if (canonical(raw.request.filters) !== canonical(request.filters) || JSON.stringify([...raw.request.metrics].sort()) !== JSON.stringify([...request.metrics].sort())) throw new Error('The returned report does not match the requested filters or metrics.');
  for (const row of [...raw.totals, ...raw.groups]) {
    if (!request.metrics.includes(row.metricId) || !row.evidence || row.evidence.releaseId !== releaseId || row.evidence.definitionVersion !== raw.metricVersion || !['value', 'numerator', 'denominator'].every(key => row[key as 'value'] === null || typeof row[key as 'value'] === 'string')) throw new Error('The returned metric evidence is incomplete or mismatched.');
  }
  return raw;
}

export interface ExceptionCatalogueResponse {
  available?: boolean;
  reason?: string | null;
  releaseId?: string;
  cutoff?: string;
  rules: ExceptionRuleResult[];
}

export async function reportingRequest<T = any>(path: string, signal?: AbortSignal): Promise<T> {
  const url = path.startsWith('/api/') ? path : `/api/reporting${path.startsWith('/') ? path : '/' + path}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }
  const json = await res.json();
  return (json.data ?? json) as T;
}

export async function createEvidenceReport(payload: ReportRequest, releaseId?: string, signal?: AbortSignal): Promise<EvidenceReportResult> {
  if (!releaseId) throw new Error('Select an approved reporting release before execution.');
  const res = await fetch('/api/reporting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, contractVersion: REPORT_REQUEST_VERSION, releaseId }),
    signal,
  });
  return validateReportResponse(await envelope<EvidenceReportResult>(res), payload, releaseId);
}

export async function fetchReportingCatalogue(clientId?: string, signal?: AbortSignal, releaseId?: string): Promise<ReportingCatalogue> {
  const query = clientId ? `?tenantId=${encodeURIComponent(clientId)}${releaseId ? `&releaseId=${encodeURIComponent(releaseId)}` : ''}` : '';
  const res = await fetch(`/api/reporting/catalogue${query}`, { signal });
  const data = await envelope<ReportingCatalogue>(res);
  if (data.release && data.release.tenantId !== clientId) throw new Error('The returned release belongs to a different workspace.');
  if (data.release && releaseId && data.release.releaseId !== releaseId) throw new Error('The returned release does not match the selected immutable release.');
  return data;
}

export async function replayEvidenceReport(tenantId: string, token: string, signal?: AbortSignal): Promise<ReportReplayResult> {
  const response = await fetch('/api/reporting/replay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractVersion: REPORT_REPLAY_VERSION, tenantId, token }), signal });
  const result = await envelope<ReportReplayResult>(response);
  if (result.contractVersion !== REPORT_REPLAY_VERSION || !['MATCH', 'MISMATCH', 'RELEASE_UNAVAILABLE', 'REPLAY_INVALID', 'NOT_REPLAYABLE'].includes(result.status) || result.comparisonKind !== 'IMMUTABLE_REPRODUCTION' || result.reconciliationStatus !== 'NOT_VERIFIED') throw new Error('Invalid replay comparison contract.');
  for (const comparison of [result.original, result.replayed]) if (comparison && (comparison.request.tenantId !== tenantId || !Array.isArray(comparison.totals) || !Array.isArray(comparison.groups))) throw new Error('Replay returned evidence outside the current workspace.');
  return result;
}
