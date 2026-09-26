import type { Request, Response, NextFunction } from 'express';
import { serverQueryCache } from './cache';
/** Cache only successful GET responses and never share permission-dependent payloads between principals. */
export function cacheResponse(ttlSeconds = 60) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || !res.locals.principal) return next();
    const principal = res.locals.principal;
    const key = JSON.stringify([principal.subject, principal.role, [...principal.tenants].sort(), req.baseUrl, req.path, res.locals.scope, req.query]);
    const cached = serverQueryCache.get(key);
    if (cached !== null) { res.setHeader('X-Cache', 'HIT'); return res.json(cached); }
    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success === true) serverQueryCache.set(key, body, ttlSeconds);
      return originalJson(body);
    };
    next();
  };
}
