interface CacheEntry<T> { data: T; storedAt: number; expiresAt: number }
interface Pending<T> { promise: Promise<T>; valid: boolean }

/** Bounded process-local LRU. Permission scoping is supplied by each caller's key.
 * Invalidation also fences pending work, so old requests cannot repopulate a cleared cache.
 */
export class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Pending<unknown>>();
  private readonly maxEntries: number;
  constructor(maxEntries = 200) { this.maxEntries = Math.max(1, Math.floor(maxEntries) || 200); }

  getEntry<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) { this.cache.delete(key); return null; }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry as CacheEntry<T>;
  }
  get<T>(key: string): T | null { return this.getEntry<T>(key)?.data ?? null; }

  set<T>(key: string, data: T, ttlSeconds = 120): void {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return;
    const now = Date.now();
    for (const [oldKey, entry] of this.cache) if (now >= entry.expiresAt) this.cache.delete(oldKey);
    this.cache.delete(key);
    while (this.cache.size >= this.maxEntries) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { data, storedAt: now, expiresAt: now + ttlSeconds * 1000 });
  }

  getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 120): Promise<T> {
    const cached = ttlSeconds > 0 ? this.getEntry<T>(key) : null;
    if (cached) return Promise.resolve(cached.data);
    const pending = this.inflight.get(key);
    if (pending) return pending.promise as Promise<T>;
    const token: Pending<T> = { valid: true, promise: Promise.resolve(undefined as T) };
    // Defer the fetcher: synchronous throws must not leave an orphaned in-flight entry.
    token.promise = Promise.resolve().then(fetcher).then(result => {
      if (token.valid) this.set(key, result, ttlSeconds);
      return result;
    }).finally(() => {
      if (this.inflight.get(key) === token) this.inflight.delete(key);
    });
    this.inflight.set(key, token);
    return token.promise;
  }

  clear(): void {
    this.cache.clear();
    for (const pending of this.inflight.values()) pending.valid = false;
    this.inflight.clear();
  }
  invalidateNamespace(prefix: string): void {
    const matches = (key: string) => key.startsWith(prefix) || key.includes(prefix);
    for (const key of this.cache.keys()) if (matches(key)) this.cache.delete(key);
    for (const [key, pending] of this.inflight) {
      if (matches(key)) { pending.valid = false; this.inflight.delete(key); }
    }
  }
}
export const serverQueryCache = new QueryCache(300);
