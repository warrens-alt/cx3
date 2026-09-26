export async function fetchAnalyticsJson<T = any>(url: string, signal?: AbortSignal): Promise<{ data: T; success: boolean; metadata?: any }> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const error: any = new Error(errData.error || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return await res.json();
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
