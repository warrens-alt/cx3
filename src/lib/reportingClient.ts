import type { ExceptionRuleResult } from '../../contracts/operations';

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

export async function createEvidenceReport(payload: any, releaseId?: string, signal?: AbortSignal) {
  const res = await fetch('/api/reporting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function fetchReportingCatalogue(signal?: AbortSignal) {
  const res = await fetch('/api/reporting/catalogue', { signal });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}
