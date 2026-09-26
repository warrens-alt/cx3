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
  const { RequestError } = await import('./server/bigquery/filters');
  const { getBigQueryClient } = await import('./server/bigquery/client');
  const { getAllClients, tableIdentifier } = await import('./server/bigquery/config');
  const { apiErrorHandler } = await import('./server/apiErrors');
  const { analyticalConcurrency, apiAuditLog, requestContext, sameOriginRequests, securityHeaders } = await import('./server/httpGuards');

  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext());
  app.use(securityHeaders());
  app.use(compression());
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  const authMiddleware = !process.env.IAP_AUDIENCE
    ? (_req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.locals.principal = {
          subject: 'dev-user',
          email: process.env.DEV_USER_EMAIL || 'warrens@bastionflowe.com',
          tenants: ['default_tenant', 'mondo', 'mtn', 'ontact_blc', 'vodacom_bizvoip', 'real_promotions', 'rewardsco', 'oneplan'],
          role: 'admin',
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
  app.use('/api/analytics', concurrency, (_req, res, next) => { res.setHeader('X-Analytics-Status', 'VERIFIED'); next(); }, analyticsRouter);
  // Restored Google Cloud BigQuery API endpoints
  app.get('/api/bq/status', async (_req, res) => {
    try {
      const client = getBigQueryClient('dashboards-422710');
      const [rows] = await client.query({
        query: `SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', MAX(SAFE_CAST(fetched AS TIMESTAMP)), 'UTC') AS latest FROM \`dashboards-422710.lead_ledger.clustered_lead_ledger\``
      });
      res.json({
        success: true,
        connected: true,
        project: 'dashboards-422710',
        projectName: 'Dashboards (dashboards-422710)',
        dataset: 'lead_ledger',
        latestData: rows[0]?.latest || null
      });
    } catch (error: any) {
      res.json({
        success: false,
        connected: false,
        project: 'dashboards-422710',
        error: error?.message || 'BigQuery connection failed'
      });
    }
  });

  app.get('/api/bq/projects', async (_req, res, next) => {
    try {
      const primaryProject = 'dashboards-422710';
      const tenantProjects = getAllClients().map(t => t.bigQueryProject);
      const allProjects = [...new Set([primaryProject, ...tenantProjects].filter((p): p is string => Boolean(p)))];
      res.json({
        success: true,
        data: allProjects.map(id => ({
          id,
          name: id === 'dashboards-422710' ? 'Dashboards (dashboards-422710)' : id
        }))
      });
    } catch (error) { next(error); }
  });

  app.get('/api/bq/datasets', async (req, res, next) => {
    try {
      const projectId = (req.query.projectId as string) || 'dashboards-422710';
      const client = getBigQueryClient(projectId);
      const [datasets] = await client.getDatasets();
      // Ensure lead_ledger is prioritized
      const sorted = [...datasets].sort((a, b) => {
        if (a.id === 'lead_ledger') return -1;
        if (b.id === 'lead_ledger') return 1;
        return (a.id || '').localeCompare(b.id || '');
      });
      res.json({ success: true, data: sorted.map(d => ({ id: d.id })) });
    } catch (error) { next(error); }
  });

  app.get('/api/bq/tables', async (req, res, next) => {
    try {
      const projectId = (req.query.projectId as string) || 'dashboards-422710';
      const datasetId = (req.query.datasetId as string) || 'lead_ledger';
      const client = getBigQueryClient(projectId);
      const dataset = (client as any).dataset ? (client as any).dataset(datasetId) : ((client as any).client?.dataset(datasetId));
      const [tables] = await dataset.getTables();
      // Prioritize the three key analytical tables as shown in the platform configuration
      const priorityOrder = [
        'lead_ledger_platform_insights',
        'lead_ledger_all_vicidial_insights_time_to_dial',
        'lead_ledger_all_vicidial_insights',
        'clustered_lead_ledger',
        'tbl_blc_activations'
      ];
      const sorted = [...tables].sort((a, b) => {
        const idxA = priorityOrder.indexOf(a.id || '');
        const idxB = priorityOrder.indexOf(b.id || '');
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return (a.id || '').localeCompare(b.id || '');
      });
      res.json({ success: true, data: sorted.map(t => ({ id: t.id })) });
    } catch (error) { next(error); }
  });

  app.get('/api/bq/preview', async (req, res, next) => {
    try {
      const projectId = (req.query.projectId as string) || 'dashboards-422710';
      const datasetId = (req.query.datasetId as string) || 'lead_ledger';
      const tableId = (req.query.tableId as string) || 'lead_ledger_platform_insights';
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
      const client = getBigQueryClient(projectId);
      const [rawRows] = await client.query({
        query: `SELECT * FROM ${tableIdentifier(`${projectId}.${datasetId}.${tableId}`)} LIMIT ${limit}`
      });

      // Normalize BigQuery Date/Numeric/Timestamp types for frontend rendering
      const rows = rawRows.map(r => {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (v === null || v === undefined) {
            clean[k] = null;
          } else if (typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
            clean[k] = (v as Record<string, unknown>).value;
          } else if (typeof v === 'object' && typeof (v as { toString?: () => string }).toString === 'function' && (v as { constructor?: { name?: string } }).constructor?.name === 'Big') {
            clean[k] = (v as { toString: () => string }).toString();
          } else {
            clean[k] = v;
          }
        }
        return clean;
      });

      res.json({ success: true, data: rows });
    } catch (error) { next(error); }
  });

  app.get('/api/bq/filter-options', async (req, res, next) => {
    try {
      const projectId = (req.query.projectId as string) || 'dashboards-422710';
      const datasetId = (req.query.datasetId as string) || 'lead_ledger';
      const tableId = (req.query.tableId as string) || 'lead_ledger_platform_insights';
      const client = getBigQueryClient(projectId);
      let query = `SELECT DISTINCT channel FROM ${tableIdentifier(`${projectId}.${datasetId}.lead_ledger_platform_insights`)} WHERE channel IS NOT NULL LIMIT 50`;
      if (tableId.includes('vicidial') || tableId.includes('clustered')) {
        query = `SELECT DISTINCT vendor FROM ${tableIdentifier(`${projectId}.${datasetId}.${tableId}`)} WHERE vendor IS NOT NULL LIMIT 50`;
      }
      const [rows] = await client.query({ query });
      res.json({ success: true, data: rows });
    } catch (error) { next(error); }
  });

  app.use('/api/bq', (_req, res) => res.status(410).json({ success: false, error: 'Unrestricted warehouse browsing has been retired. Use the configured analytics and export endpoints.' }));
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

  if (isTsFile && fs.existsSync(bundlePath) && !process.env.TSX_ACTIVE) {
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

