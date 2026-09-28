import { getAnalyticalSessionGeneration } from '../analyticalSession';

export function buildQueryString(params: Record<string, any>): string {
  const q = new URLSearchParams();
  // Stable ordering lets equivalent scopes share one pending request and one cache entry.
  for (const [key, value] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) {
    if (value !== undefined && value !== null && value !== '') {
      q.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

interface CacheEntry<T> { data: T; timestamp: number; }
interface SharedRequest {
  promise: Promise<any>;
  controller: AbortController;
  consumers: number;
  settled: boolean;
}

export const memoryCache = new Map<string, CacheEntry<any>>();
export const inFlightRequests = new Map<string, Promise<any>>();
const requests = new Map<string, SharedRequest>();
let generation = 0;
export const CACHE_TTL_MS = 60 * 1000;
export const CACHE_MAX_ENTRIES = 200;

export function pruneOffernetCache(now = Date.now()) {
  for (const [key, entry] of memoryCache) {
    if (now - entry.timestamp >= CACHE_TTL_MS) memoryCache.delete(key);
  }
  if (memoryCache.size <= CACHE_MAX_ENTRIES) return;
  const oldest = [...memoryCache.entries()]
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .slice(0, memoryCache.size - CACHE_MAX_ENTRIES);
  oldest.forEach(([key]) => memoryCache.delete(key));
}

export function invalidateOffernetCache() {
  generation++;
  memoryCache.clear();
  for (const request of requests.values()) request.controller.abort();
  requests.clear();
  inFlightRequests.clear();
}

function abortError() { return new DOMException('The request was cancelled.', 'AbortError'); }

/** Cancellation belongs to each consumer; shared fetches stop only after the last one leaves. */
function subscribe<T>(url: string, request: SharedRequest, signal?: AbortSignal, expectedSessionGen = getAnalyticalSessionGeneration()): Promise<T> {
  request.consumers++;
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      signal?.removeEventListener('abort', cancel);
      request.consumers--;
      return true;
    };
    const cancel = () => {
      if (!finish()) return;
      reject(abortError());
      if (!request.settled && request.consumers === 0) {
        request.controller.abort();
        if (requests.get(url) === request) {
          requests.delete(url);
          inFlightRequests.delete(url);
        }
      }
    };
    signal?.addEventListener('abort', cancel, { once: true });
    request.promise.then(
      value => {
        if (expectedSessionGen !== getAnalyticalSessionGeneration()) {
          if (finish()) reject(abortError());
        } else {
          if (finish()) resolve(value);
        }
      },
      error => { if (finish()) reject(error); },
    );
    if (signal?.aborted) cancel();
  });
}

export async function fetchOffernetJson<T>(url: string, forceRefresh = false, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw abortError();
  const sessionGen = getAnalyticalSessionGeneration();
  pruneOffernetCache();
  const pending = requests.get(url);
  // Refresh bypasses resolved data, not an identical request that is already running.
  if (pending) return subscribe<T>(url, pending, signal, sessionGen);
  if (!forceRefresh && memoryCache.has(url)) return memoryCache.get(url)!.data as T;

  if (forceRefresh) memoryCache.delete(url);
  const requestGeneration = generation;
  const request: SharedRequest = { controller: new AbortController(), consumers: 0, settled: false, promise: undefined! };
  request.promise = Promise.resolve().then(async () => {
    try {
      const response = await fetch(url, { credentials: 'same-origin', signal: request.controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Object.assign(new Error(body.error || `Server request failed with status ${response.status}`), { status: response.status });
      }
      const json = await response.json();
      if (request.controller.signal.aborted || sessionGen !== getAnalyticalSessionGeneration()) throw abortError();
      if (json.success === false) throw new Error(json.error || 'The analytics request failed.');
      const result = json.data as T;
      // A cancelled or invalidated older fetch can never restore stale data or clear its replacement.
      if (generation === requestGeneration && sessionGen === getAnalyticalSessionGeneration() && requests.get(url) === request) {
        memoryCache.set(url, { data: result, timestamp: Date.now() });
        pruneOffernetCache();
      }
      return result;
    } finally {
      request.settled = true;
      if (requests.get(url) === request) {
        requests.delete(url);
        inFlightRequests.delete(url);
      }
    }
  });
  requests.set(url, request);
  inFlightRequests.set(url, request.promise);
  return subscribe<T>(url, request, signal, sessionGen);
}
