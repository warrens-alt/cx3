// High-performance In-Memory TTL Cache for BigQuery Aggregation Responses
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private inflight = new Map<string, Promise<any>>();
  private maxEntries: number;

  constructor(maxEntries: number = 200) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number = 120): void {
    if (ttlSeconds <= 0) return;
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest 20%
      const keys = Array.from(this.cache.keys());
      for (let i = 0; i < Math.floor(this.maxEntries * 0.2); i++) {
        this.cache.delete(keys[i]);
      }
    }
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  // Deduplicate concurrent in-flight requests for identical queries
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number = 120): Promise<T> {
    const cached = ttlSeconds > 0 ? this.get<T>(key) : null;
    if (cached !== null) {
      return cached;
    }

    if (this.inflight.has(key)) {
      return this.inflight.get(key) as Promise<T>;
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, ttlSeconds);
        return result;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  invalidateNamespace(prefix: string): void {
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix) || key.includes(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const serverQueryCache = new QueryCache(300);
