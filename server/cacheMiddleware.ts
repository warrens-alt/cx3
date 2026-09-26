import type { Request, Response, NextFunction } from 'express';
import { stableKey } from '../contracts/stableKey';
import { serverQueryCache } from './cache';

/** Every variant includes identity, grants, tenant, complete scope and complete query.
 * Canonical object ordering improves reuse without dropping unsupported filters.
 */
export function responseCacheKey(req: Request, res: Response): string {
  const principal = res.locals.principal;
  return stableKey([principal.subject, principal.role, [...principal.tenants].sort(), req.baseUrl, req.path, res.locals.scope, req.query]);
}
export function cacheResponse(ttlSeconds = 60) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || !res.locals.principal) return next();
    const key = responseCacheKey(req, res);
    const cached = serverQueryCache.getEntry(key);
    if (cached !== null) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Age-Seconds', String(Math.max(0, Math.floor((Date.now() - cached.storedAt) / 1000))));
      res.setHeader('X-Cache-Expires-At', new Date(cached.expiresAt).toISOString());
      return res.json(cached.data);
    }
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-Age-Seconds', '0');
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success === true) {
        serverQueryCache.set(key, body, ttlSeconds);
        if (ttlSeconds > 0) res.setHeader('X-Cache-Expires-At', new Date(Date.now() + ttlSeconds * 1000).toISOString());
      }
      return originalJson(body);
    };
    next();
  };
}
