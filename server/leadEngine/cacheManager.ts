export interface CacheItem<T> {
  key: string;
  data: T;
  storedAt: number;
  expiresAt: number;
  ttlSeconds: number;
  hitCount: number;
}

export interface CacheStats {
  totalEntries: number;
  activeEntries: number;
  expiredEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  estimatedMemoryKb: number;
  items: Array<{
    key: string;
    storedAt: string;
    expiresAt: string;
    remainingSeconds: number;
    hitCount: number;
  }>;
}

class InProcessLeadEngineCache {
  private store = new Map<string, CacheItem<any>>();
  private totalHits = 0;
  private totalMisses = 0;

  get<T>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) {
      this.totalMisses++;
      return null;
    }
    const now = Date.now();
    if (now >= item.expiresAt) {
      this.store.delete(key);
      this.totalMisses++;
      return null;
    }
    item.hitCount++;
    this.totalHits++;
    return item.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds = 300): void {
    const now = Date.now();
    this.store.set(key, {
      key,
      data,
      storedAt: now,
      expiresAt: now + ttlSeconds * 1000,
      ttlSeconds,
      hitCount: 0,
    });
  }

  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await fetcher();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  clear(): { purgedEntries: number } {
    const count = this.store.size;
    this.store.clear();
    return { purgedEntries: count };
  }

  getStats(): CacheStats {
    const now = Date.now();
    const itemsList: CacheStats['items'] = [];
    let active = 0;
    let expired = 0;
    let totalBytesEst = 0;

    for (const [key, item] of this.store.entries()) {
      const isExpired = now >= item.expiresAt;
      if (isExpired) {
        expired++;
      } else {
        active++;
        const rem = Math.max(0, Math.round((item.expiresAt - now) / 1000));
        itemsList.push({
          key,
          storedAt: new Date(item.storedAt).toISOString(),
          expiresAt: new Date(item.expiresAt).toISOString(),
          remainingSeconds: rem,
          hitCount: item.hitCount,
        });
      }
      totalBytesEst += key.length * 2 + 128;
    }

    const totalRequests = this.totalHits + this.totalMisses;
    const hitRate = totalRequests > 0 ? Number(((this.totalHits / totalRequests) * 100).toFixed(1)) : 0;

    return {
      totalEntries: this.store.size,
      activeEntries: active,
      expiredEntries: expired,
      hits: this.totalHits,
      misses: this.totalMisses,
      hitRate,
      estimatedMemoryKb: Math.max(1, Math.round(totalBytesEst / 1024)),
      items: itemsList.sort((a, b) => b.remainingSeconds - a.remainingSeconds),
    };
  }
}

export const leadEngineCache = new InProcessLeadEngineCache();
