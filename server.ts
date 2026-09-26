import 'dotenv/config';
import fs from 'node:fs';
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function createApp() {
  const { createReportingRouter } = await import('./server/reporting/router');
  const { analyticsRouter } = await import('./server/api');
  const { authenticate } = await import('./server/security');
  const { apiErrorHandler } = await import('./server/apiErrors');
  const { analyticalConcurrency, apiAuditLog, requestContext, sameOriginRequests, securityHeaders } = await import('./server/httpGuards');

  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext());
  app.use(securityHeaders());
  app.use(compression());
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  // Authentication is fail-closed by default. A local development identity is
  // available only when explicitly enabled outside production.
  const allowDevAuth = process.env.NODE_ENV !== 'production' && process.env.CX_ALLOW_DEV_AUTH === 'true';
  const authMiddleware = allowDevAuth
    ? (_req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.locals.principal = {
          subject: 'dev-user',
          email: process.env.DEV_USER_EMAIL || 'dev@example.invalid',
          tenants: (process.env.CX_DEV_TENANTS || 'default_tenant').split(',').map(value => value.trim()).filter(Boolean),
          role: process.env.CX_DEV_ROLE === 'viewer' ? 'viewer' : 'admin',
        };
        next();
      }
    : authenticate();

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  }, apiAuditLog, authMiddleware, sameOriginRequests());
  const concurrency = analyticalConcurrency();
  app.use('/api/reporting', concurrency, createReportingRouter());
  app.use('/api/analytics', concurrency, (_req, res, next) => { res.setHeader('X-Analytics-Status', 'UNVERIFIED'); next(); }, analyticsRouter);
  // Arbitrary warehouse browsing is intentionally disabled. All analytical
  // access must flow through tenant-scoped, validated API contracts.
  app.use('/api/bq', (_req, res) => res.status(410).json({
    success: false,
    error: 'Direct warehouse browsing is disabled. Use tenant-scoped analytics and evidence endpoints.'
  }));
  app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'Unknown API endpoint' }));
  const hasDist = fs.existsSync(path.join(process.cwd(), 'dist', 'client', 'index.html'))
    || fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' || hasDist;

  if (isProduction && hasDist) {
    const clientDirectory = fs.existsSync(path.join(process.cwd(), 'dist', 'client', 'index.html'))
      ? path.join(process.cwd(), 'dist', 'client')
      : path.join(process.cwd(), 'dist');
    app.use(express.static(clientDirectory, { dotfiles: 'deny' }));
    app.get(/.*/, (req, res) => {
      if (path.extname(req.path) || req.path.split('/').some(p => p.startsWith('.'))) return res.status(404).end();
      return res.sendFile(path.join(clientDirectory, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.use(apiErrorHandler);
  return app;
}

export async function startServer() {
  const app = await createApp();
  const port = Math.min(Math.max(Number(process.env.PORT) || 3000, 1), 65535);
  return new Promise<express.Application>((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`ConversionX listening on ${port}`);
      resolve(app);
    });
    server.once('error', (error) => {
      console.error('Server startup failed:', error.message);
      process.exitCode = 1;
      reject(error);
    });
  });
}

const currentFileHref = import.meta.url;
const entryFileHref = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
const isMain = currentFileHref === entryFileHref;

if (isMain) {
  const isTsFile = currentFileHref.endsWith('.ts');
  const bundlePath = path.join(process.cwd(), 'dist', 'server', 'server.mjs');

  if (isTsFile && fs.existsSync(bundlePath) && process.env.NODE_ENV === 'production' && !process.env.TSX_ACTIVE) {
    // When invoked as 'node server.ts' in production, delegate to pre-bundled server
    const bundleUrl = pathToFileURL(bundlePath).href;
    const serverModule = await import(/* @vite-ignore */ bundleUrl);
    if (typeof serverModule.startServer === 'function') {
      await serverModule.startServer();
    } else if (typeof serverModule.createApp === 'function') {
      const app = await serverModule.createApp();
      const port = Math.min(Math.max(Number(process.env.PORT) || 3000, 1), 65535);
      app.listen(port, '0.0.0.0', () => console.log(`ConversionX listening on ${port}`));
    }
  } else {
    startServer().catch((error) => {
      console.error('Server startup failed:', error);
      process.exitCode = 1;
    });
  }
}

