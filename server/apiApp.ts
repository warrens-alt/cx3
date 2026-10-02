import express from 'express';
import compression from 'compression';
import type { Application, Request, Response, NextFunction } from 'express';
import type { CliArchiveBackend } from './cliImports/archive';
import type { SavedInvestigationBackend } from './savedAnalyses/repository';

export interface ApiMountOptions {
  /** Runtime-owned archive binding; defaults to the existing GCS configuration on Node. */
  cliArchiveBackend?: () => CliArchiveBackend | null;
  /** Separate, explicitly configured durable storage for personal investigation definitions. */
  savedAnalysisBackend?: () => SavedInvestigationBackend | null;
}

/**
 * Mount the complete ConversionX API stack on an Express application.
 *
 * This is intentionally independent from static/Vite serving so Google AI Studio's
 * Vite preview runtime and Cloudflare Workers can mount the same API implementation.
 */
export async function mountApi(app: Application, options: ApiMountOptions = {}) {
  const { createReportingRouter } = await import('./reporting/router');
  const { analyticsRouter } = await import('./api');
  const { createLeadLedgerRouter } = await import('./leadLedger/router');
  const { createBlcRouter } = await import('./blc/router');
  const { createCliImportRouter } = await import('./cliImports/router');
  const { createSavedInvestigationRouter } = await import('./savedAnalyses/router');
  const { authenticate } = await import('./security');
  const { apiErrorHandler } = await import('./apiErrors');
  const { analyticalConcurrency, apiAuditLog, requestContext, sameOriginRequests, securityHeaders } = await import('./httpGuards');

  app.disable('x-powered-by');
  app.use(requestContext());
  app.use(securityHeaders());
  app.use(compression());
  // Allow JSON escaping overhead for the separately enforced 48 KiB CSV ceiling.
  app.use('/api/analytics/cli-performance/import', express.json({ limit: '128kb' }));
  app.use(express.json({ limit: '64kb' }));

  // Liveness deliberately stays outside the authenticated API boundary.
  app.get(['/api/health', '/api/health/', '/api', '/api/'], (_req, res) => res.json({ status: 'ok', service: 'ConversionX' }));

  // A static development identity remains opt-in only. AI Studio Preview uses
  // verified Firebase bearer authentication instead; production remains IAP.
  const allowDevAuth = process.env.NODE_ENV !== 'production' && process.env.CX_ALLOW_DEV_AUTH === 'true';
  const authMiddleware = allowDevAuth
    ? (_req: Request, res: Response, next: NextFunction) => {
        res.locals.principal = {
          subject: 'dev-user',
          email: process.env.DEV_USER_EMAIL || 'dev@example.invalid',
          tenants: (process.env.CX_DEV_TENANTS || 'default_tenant').split(',').map(value => value.trim()).filter(Boolean),
          // Analyst has viewer API capabilities; unknown roles must not gain authority.
          role: process.env.CX_DEV_ROLE === 'admin' ? 'admin' : 'viewer',
        };
        next();
      }
    : authenticate();

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  }, apiAuditLog, authMiddleware, sameOriginRequests());

  const concurrency = analyticalConcurrency();
  app.use('/api/saved-analyses', concurrency, createSavedInvestigationRouter(options.savedAnalysisBackend));
  app.use('/api/reporting', concurrency, createReportingRouter());
  app.use('/api/analytics', concurrency, (_req, res, next) => {
    res.setHeader('X-Analytics-Status', 'UNVERIFIED');
    next();
  }, createCliImportRouter(options.cliArchiveBackend), analyticsRouter, createLeadLedgerRouter(), createBlcRouter());

  app.use('/api/bq', (_req, res) => res.status(410).json({
    success: false,
    error: 'Direct warehouse browsing is disabled. Use tenant-scoped analytics and evidence endpoints.'
  }));
  app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'Unknown API endpoint' }));
  app.use(apiErrorHandler);
}
