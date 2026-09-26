export type FetchLike = typeof globalThis.fetch;
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  constructor(message: string, status: number, code = 'API_ERROR', requestId: string | null = null) {
    super(message); this.name = 'ApiRequestError'; this.status = status; this.code = code; this.requestId = requestId;
  }
}
const aborted = () => new DOMException('Request cancelled', 'AbortError');
export function localApiUrl(input: RequestInfo | URL): URL | null {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  try {
    const url = new URL(raw, origin);
    return url.origin === origin && url.pathname.startsWith('/api/') ? url : null;
  } catch { return null; }
}
interface BufferedResponse { body: string; status: number; statusText: string; headers: Headers }
interface Flight { controller: AbortController; consumers: number; settled: boolean; promise: Promise<BufferedResponse> }

/** Coalesce identical same-identity analytical GETs, not writes or exports.
 * No completed responses are retained here: React Query owns browser freshness.
 * A departing consumer cannot cancel another consumer's request.
 */
export function createApiTransport(baseFetch: FetchLike, timeoutMs = 90000): FetchLike {
  const pending = new Map<string, Flight>();
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = localApiUrl(input);
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (signal?.aborted) throw aborted();
    if (!url || method !== 'GET' || !url.pathname.startsWith('/api/analytics/') || /\/(export)(\/|$)/.test(url.pathname) || url.searchParams.get('format') === 'csv') {
      return baseFetch(input, init);
    }
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    url.searchParams.sort(); // Sort keys, preserving the order of repeated values.
    const key = JSON.stringify([url.href, [...headers.entries()].sort(), init?.credentials || (input instanceof Request ? input.credentials : 'same-origin'), init?.cache, init?.redirect]);
    let flight = pending.get(key);
    if (!flight) {
      const controller = new AbortController();
      const created: Flight = { controller, consumers: 0, settled: false, promise: Promise.resolve(undefined as unknown as BufferedResponse) };
      const timer = setTimeout(() => controller.abort(new ApiRequestError('The analytics request timed out. Narrow the reporting dates or retry.', 504, 'API_TIMEOUT')), timeoutMs);
      const work = async (): Promise<BufferedResponse> => {
        const response = await baseFetch(input, { ...init, headers, signal: controller.signal });
        const requestId = response.headers.get('x-request-id');
        const body = await response.text();
        const contentType = response.headers.get('content-type') || '';
        let parsed: any;
        try { parsed = JSON.parse(body); } catch { /* handled below without exposing HTML */ }
        if (!response.ok) throw new ApiRequestError(typeof parsed?.error === 'string' ? parsed.error : `Analytics request failed (${response.status}).`, response.status, 'API_HTTP_ERROR', requestId);
        if (!contentType.includes('json') || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new ApiRequestError('The analytics URL returned a non-JSON page. Check that /api is routed to the backend, then reload.', 502, 'API_INVALID_RESPONSE', requestId);
        }
        if (parsed.success !== true) throw new ApiRequestError(typeof parsed.error === 'string' ? parsed.error : 'The analytics response did not confirm success.', 502, 'API_UNSUCCESSFUL_RESPONSE', requestId);
        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete('content-encoding');
        responseHeaders.delete('content-length');
        return { body, status: response.status, statusText: response.statusText, headers: responseHeaders };
      };
      created.promise = Promise.resolve().then(work).catch(error => {
        if (controller.signal.aborted && controller.signal.reason instanceof ApiRequestError) throw controller.signal.reason;
        throw error;
      }).finally(() => {
        clearTimeout(timer); created.settled = true;
        if (pending.get(key) === created) pending.delete(key);
      });
      flight = created;
      // Bound indexing. Requests beyond this ceiling still run under server quotas.
      if (pending.size < 64) pending.set(key, created);
    }
    const shared = flight;
    shared.consumers += 1;
    return new Promise<Response>((resolve, reject) => {
      let finished = false;
      const release = () => {
        signal?.removeEventListener('abort', onAbort);
        shared.consumers -= 1;
        if (!shared.settled && shared.consumers === 0) {
          if (pending.get(key) === shared) pending.delete(key);
          shared.controller.abort();
        }
      };
      const onAbort = () => { if (!finished) { finished = true; release(); reject(aborted()); } };
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) { onAbort(); return; }
      shared.promise.then(result => {
        if (finished) return;
        finished = true; release();
        resolve(new Response(result.body, { status: result.status, statusText: result.statusText, headers: result.headers }));
      }, error => {
        if (finished) return;
        finished = true; release(); reject(error);
      });
    });
  }) as FetchLike;
}
