import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { RequestError } from './bigquery/filters';
import { requestWork } from './analyticalWork';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const REQUEST_ID_HEADER = 'X-Request-Id';

export interface ConcurrencyLimits {
  global: number;
  perSubject: number;
}

function positiveInteger(name: string, raw: string | undefined, fallback: number, maximum: number): number {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be between 1 and ${maximum}`);
  return value;
}

export function concurrencyLimitsFromEnvironment(environment: NodeJS.ProcessEnv = process.env): ConcurrencyLimits {
  return {
    perSubject: positiveInteger('CX_MAX_CONCURRENT_QUERIES_PER_SUBJECT', environment.CX_MAX_CONCURRENT_QUERIES_PER_SUBJECT, 4, 100),
    global: positiveInteger('CX_MAX_CONCURRENT_QUERIES_GLOBAL', environment.CX_MAX_CONCURRENT_QUERIES_GLOBAL, 40, 1000),
  };
}

export function requestContext(): RequestHandler {
  return (_req, res, next) => {
    // Generate this value locally: an untrusted caller cannot choose the audit identifier.
    res.locals.requestId = randomUUID();
    res.setHeader(REQUEST_ID_HEADER, res.locals.requestId);
    next();
  };
}

export function securityHeaders(production = process.env.NODE_ENV === 'production'): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (production) {
      res.setHeader('Content-Security-Policy', [
        "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline' https:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
        "connect-src 'self' https: wss: data:",
        "frame-src 'self' https:",
      ].join('; '));
    }
    next();
  };
}

function parseAllowedOrigins(text: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const item of (text || '').split(',').map(value => value.trim()).filter(Boolean)) {
    let url: URL;
    try { url = new URL(item); } catch { throw new Error('CX_ALLOWED_ORIGINS contains an invalid URL'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('CX_ALLOWED_ORIGINS entries must be HTTP(S) origins without credentials, paths, queries or fragments');
    }
    origins.add(url.origin);
  }
  return origins;
}

/**
 * IAP authenticates the user, while this guard prevents a browser on another
 * origin from spending that user's analytical query budget with ambient auth.
 */
export function sameOriginRequests(configuredOrigins = process.env.CX_ALLOWED_ORIGINS): RequestHandler {
  const allowedOrigins = parseAllowedOrigins(configuredOrigins);
  return (req, _res, next) => {
    if (!UNSAFE_METHODS.has(req.method)) return next();
    if (req.get('sec-fetch-site') === 'cross-site') return next(new RequestError('Cross-origin API request rejected', 403));
    const originHeader = req.get('origin');
    if (!originHeader) return next();
    let origin: URL;
    try { origin = new URL(originHeader); } catch { return next(new RequestError('Invalid request origin', 403)); }
    const permitted = allowedOrigins.size > 0 ? allowedOrigins.has(origin.origin) : origin.host === req.get('host');
    if (!permitted) return next(new RequestError('Cross-origin API request rejected', 403));
    next();
  };
}

/**
 * A process-local load-shedding boundary. Deployments with multiple instances
 * still need an upstream shared rate/quota policy; this guard protects each
 * instance and prevents one authenticated subject from consuming every slot.
 */
export function analyticalConcurrency(limits: ConcurrencyLimits = concurrencyLimitsFromEnvironment()): RequestHandler {
  let total = 0;
  const bySubject = new Map<string, number>();
  return (_req, res, next) => {
    const subject = res.locals.principal?.subject;
    if (typeof subject !== 'string' || !subject) return next(new RequestError('Authentication required', 401));
    const subjectCount = bySubject.get(subject) || 0;
    if (total >= limits.global || subjectCount >= limits.perSubject) {
      res.setHeader('Retry-After', '1');
      return next(new RequestError('Too many analytical requests are already running. Retry shortly.', 429));
    }
    total += 1;
    bySubject.set(subject, subjectCount + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      total -= 1;
      const remaining = (bySubject.get(subject) || 1) - 1;
      if (remaining > 0) bySubject.set(subject, remaining);
      else bySubject.delete(subject);
    };
    const work = requestWork(release);
    res.once('finish', work.end);
    res.once('close', work.end);
    work.run(next);
  };
}

export function apiAuditLog(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.once('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const route = req.route?.path ? String(req.route.path) : 'UNMATCHED_API';
    const isError = res.statusCode >= 400;
    const payload = {
      action: isError ? 'API_REQUEST_ERROR' : 'API_REQUEST',
      requestId: res.locals.requestId,
      subject: res.locals.principal?.subject ?? null,
      method: req.method,
      route,
      status: res.statusCode,
      durationMs: Number(elapsedMs.toFixed(1)),
    };
    if (isError) {
      console.warn(JSON.stringify(payload));
    } else if (process.env.CX_ENABLE_AUDIT_LOG === 'true') {
      console.info(JSON.stringify(payload));
    }
  });
  next();
}
