import { Router } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { requireAdmin } from '../security';
import { requireTenant } from '../securityPolicy';
import { RequestError, scalarString, boundedInteger } from '../bigquery/filters';
import { analyticalRoute } from '../analyticalWork';
import { getLedgerReplica, exportLedgerReplica, ledgerCoverage } from './runtime';
import { LedgerError } from './query';

/** Mounted after analyticsRouter so its authenticated, validated tenant scope is inherited. */
export function createLeadLedgerRouter() {
  const router = Router();
  router.use('/lead-ledger/replica', requireAdmin, (_req, res, next) => {
    try {
      if (!res.locals.principal || !res.locals.scope) throw new RequestError('Authenticated tenant scope required.', 401);
      requireTenant(res.locals.principal, res.locals.scope.clientId);
      next();
    } catch (error) { next(error); }
  });
  const options = (query: Record<string, unknown>) => {
    if (['segment', 'chartBucket', 'metrics', 'sql', 'table', 'grain'].some(key => query[key] !== undefined)) throw new RequestError('Unsupported raw LeadLedger parameter.', 422);
    return {
      sourceMode: scalarString(query.sourceMode, 'sourceMode', 20) || 'configured',
      search: scalarString(query.search, 'search', 200) || '',
      limit: boundedInteger(query.limit, 25, 100, 1), offset: boundedInteger(query.offset, 0, 10000000),
    };
  };
  router.get('/lead-ledger/replica/coverage', analyticalRoute(async (req, res) => {
    res.json({ success: true, data: await ledgerCoverage(res.locals.scope, options(req.query)) });
  }));
  router.get('/lead-ledger/replica', analyticalRoute(async (req, res) => {
    res.json({ success: true, data: await getLedgerReplica(res.locals.scope, options(req.query)) });
  }));
  router.get('/lead-ledger/replica/export', analyticalRoute(async (req, res) => {
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', abort);
    try {
      const result = await exportLedgerReplica(res.locals.scope, options(req.query), scalarString(req.query.mode, 'mode', 20) || 'compatible', controller.signal);
      const name = `${result.clientId.replace(/[^a-z0-9_-]/gi, '_')}_LeadLedger_${result.dates.startDate}_${result.dates.endDate}_${result.coverage.compatible ? 'raw63' : 'partial-fields'}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      res.setHeader('X-Export-Row-Count', String(result.expectedRows));
      res.setHeader('X-Export-Truncated', 'false');
      res.setHeader('X-Export-Field-Coverage', `${result.coverage.available.length}/63`);
      res.setHeader('X-Export-Missing-Fields', result.coverage.missing.join('; '));
      res.setHeader('X-Export-Source', result.coverage.source);
      res.setHeader('X-Export-Query-Job', result.jobId || 'unavailable');
      // Pipeline propagates mid-stream failures as a failed download, never a successful partial CSV.
      await pipeline(Readable.from(result.csv), res);
      if (process.env.CX_ENABLE_AUDIT_LOG === 'true') console.info(JSON.stringify({ action: 'LEAD_LEDGER_EXPORT', subject: res.locals.principal.subject, clientId: result.clientId, rowCount: result.expectedRows, source: result.coverage.source, jobId: result.jobId }));
    } finally { res.removeListener('close', abort); }
  }));
  router.use((error: unknown, _req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (res.headersSent) { res.destroy(error instanceof Error ? error : undefined); return; }
    next(error instanceof LedgerError ? new RequestError(error.message, error.status) : error);
  });
  return router;
}
