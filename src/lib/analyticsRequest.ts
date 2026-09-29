import { ApiRequestError } from './apiTransport';

/** Shared GET/POST guard. A frontend HTML shell must never be treated as data. */
export async function readAnalyticsResponse<T = unknown>(res: Response): Promise<{ data: T; success: boolean; metadata?: any }> {
  const requestId = res.headers.get('x-request-id');
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('json')) {
    throw new ApiRequestError('The API returned a non-JSON page. Verify this deployment routes /api to the backend, not the frontend shell.', res.ok ? 502 : res.status, 'API_INVALID_RESPONSE', requestId);
  }
  let body: any;
  try { body = await res.json(); } catch {
    throw new ApiRequestError('The API returned invalid JSON. No data was substituted.', 502, 'API_INVALID_RESPONSE', requestId);
  }
  if (!res.ok) throw new ApiRequestError(typeof body?.error === 'string' ? body.error : `Analytics request failed (${res.status}).`, res.status, 'API_HTTP_ERROR', requestId);
  if (!body || Array.isArray(body) || body.success !== true || !Object.prototype.hasOwnProperty.call(body, 'data')) {
    throw new ApiRequestError(typeof body?.error === 'string' ? body.error : 'The API did not return a successful data envelope.', 502, 'API_UNSUCCESSFUL_RESPONSE', requestId);
  }
  return body;
}

export async function fetchAnalyticsJson<T = any>(url: string, signal?: AbortSignal): Promise<{ data: T; success: boolean; metadata?: any }> {
  return readAnalyticsResponse<T>(await fetch(url, { signal, credentials: 'same-origin', headers: { Accept: 'application/json' } }));
}

export function analyticsUrl(path: string, ...paramsObjects: (Record<string, any> | undefined)[]): string {
  const base = path.startsWith('/api') ? path : `/api/analytics${path.startsWith('/') ? path : '/' + path}`;
  const searchParams = new URLSearchParams();
  for (const obj of paramsObjects) {
    if (!obj) continue;
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'object') {
          searchParams.set(key, JSON.stringify(value));
        } else {
          searchParams.set(key, String(value));
        }
      }
    }
  }
  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
}

export function analyticsError(responseOrErr: any, body?: any): any {
  if (body && body.error) {
    const err: any = new Error(body.error);
    if (responseOrErr && responseOrErr.status) err.status = responseOrErr.status;
    return err;
  }
  if (responseOrErr instanceof Error) return responseOrErr;
  if (responseOrErr && typeof responseOrErr.status === 'number') {
    const err: any = new Error(`Request failed with status ${responseOrErr.status}`);
    err.status = responseOrErr.status;
    return err;
  }
  return new Error(String(responseOrErr || 'Analytics request failed'));
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function recordsCsv(records: Record<string, any>[]): string {
  if (!records || records.length === 0) return '';
  const headers = Array.from(new Set(records.flatMap(r => Object.keys(r))));
  const quote = (v: any) => {
    if (v === null || v === undefined) return '""';
    return `"${String(v).replace(/"/g, '""')}"`;
  };
  const headerLine = headers.map(quote).join(',');
  const rowLines = records.map(r => headers.map(h => quote(r[h])).join(','));
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}
