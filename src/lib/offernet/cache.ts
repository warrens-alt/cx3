export function buildQueryString(params: Record<string, any>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      q.set(key, String(value));
    }
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const memoryCache = new Map<string, CacheEntry<any>>();
export const inFlightRequests = new Map<string, Promise<any>>();
export const CACHE_TTL_MS = 60 * 1000; // 60 seconds
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
  memoryCache.clear();
  inFlightRequests.clear();
}

export async function fetchOffernetJson<T>(url: string, forceRefresh = false): Promise<T> {
  const now = Date.now();
  pruneOffernetCache(now);
  if (!forceRefresh && memoryCache.has(url)) {
    const entry = memoryCache.get(url)!;
    if (now - entry.timestamp < CACHE_TTL_MS) {
      return entry.data as T;
    }
  }

  if (!forceRefresh && inFlightRequests.has(url)) {
    return inFlightRequests.get(url) as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) {
        let errorMsg = `Server request failed with status ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson.error) errorMsg = errJson.error;
        } catch {
          // ignore json parse error
        }
        throw new Error(errorMsg);
      }
      const json = await response.json();
      const result = json.data as T;
      memoryCache.set(url, { data: result, timestamp: Date.now() });
      pruneOffernetCache();
      return result;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, fetchPromise);
  return fetchPromise;
}
