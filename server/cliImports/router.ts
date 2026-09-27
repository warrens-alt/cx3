import { Router, type Request, type Response, type NextFunction } from 'express';
import { analyticsRequestTenant } from '../requestTenant';
import { requireTenant, type Principal } from '../securityPolicy';
import { RequestError, scalarString, validateFilters, validateScope } from '../bigquery/filters';
import { withAnalyticsScope } from '../analyticsContext';
import { getCliPerformance, parseAndValidateCliCsv, setTenantImport, clearTenantImport } from '../bigquery/cli_analytics';
import { serverQueryCache } from '../cache';
import { configuredCliArchive } from './gcs';
import {
  CliArchiveError, cliRowsToCsv, cliArchiveStatus, prepareCliImport, importCliArchive, pauseCliArchive,
  MAX_CLI_UPLOAD_BYTES, type CliArchive, type CliArchiveBackend,
} from './archive';

/** Serializes this process's compatibility cache while GCS generations protect durable multi-instance writes. */
export function createCliImportRouter(
  resolveBackend: () => CliArchiveBackend | null = configuredCliArchive,
  readPerformance: typeof getCliPerformance = getCliPerformance,
) {
  const router = Router();
  const queues = new Map<string, Promise<void>>();
  const revisions = new Map<string, string>();
  function restore(tenant: string, archive: CliArchive | null, revision: string) {
    if (revisions.get(tenant) === revision) return;
    if (!archive?.active || !archive.rows.length) clearTenantImport(tenant);
    else {
      const parsed = parseAndValidateCliCsv(cliRowsToCsv(archive.rows), `cli_archive_${archive.imports.length}_reports.csv`);
      if (parsed.errors.length) throw new CliArchiveError('CLI_ARCHIVE_INVALID', 'Saved CLI records failed report validation. No report was returned.', 503);
      setTenantImport(tenant, { uploadedAt: archive.updatedAt, filename: `cli_archive_${archive.imports.length}_reports.csv`,
        records: parsed.records, trend: parsed.trend, leadAgeBands: parsed.leadAgeBands, anomalies: parsed.anomalies });
    }
    serverQueryCache.invalidateNamespace(tenant);
    revisions.set(tenant, revision);
  }
  async function handle(req: Request, res: Response, next: NextFunction) {
    const path = req.path.replace(/\/+$/, '').toLowerCase();
    const cliPath = path === '/cli-performance' || path.startsWith('/cli-performance/');
    const cliExport = path === '/export' && req.query.grain === 'cli';
    if (!cliPath && !cliExport) return next();
    // Both the normal authenticated mount and this tenant gate must pass before any storage I/O.
    const principal = res.locals.principal as Principal | undefined;
    if (!principal) throw new RequestError('Authentication required', 401);
    const tenant = analyticsRequestTenant(req);
    requireTenant(principal, tenant);
    const history = path === '/cli-performance/import/history';
    const mutation = !['GET', 'HEAD'].includes(req.method);
    if ((mutation || history) && principal.role !== 'admin') throw new RequestError('Administrator access required', 403);
    if (path === '/cli-performance/load-sample') {
      if (process.env.NODE_ENV === 'production' || process.env.CX_CLI_IMPORT_BUCKET?.trim()) {
        throw new CliArchiveError('CLI_SAMPLE_DISABLED', 'Synthetic reports cannot be loaded into an enabled private archive or production.', 403);
      }
      return next();
    }
    const previous = queues.get(tenant) || Promise.resolve();
    let unlock!: () => void;
    const current = new Promise<void>(resolve => { unlock = resolve; });
    queues.set(tenant, current);
    await previous;
    let released = false, workDone = false;
    const release = () => {
      if (released) return;
      released = true; unlock();
      res.off('finish', onEnd); res.off('close', onEnd);
      if (queues.get(tenant) === current) queues.delete(tenant);
    };
    const onEnd = () => { if (workDone) release(); };
    res.once('finish', onEnd); res.once('close', onEnd);
    if (res.destroyed || res.writableEnded) { release(); return; }
    try {
      const backend = resolveBackend();
      if (history && req.method === 'GET') {
        const snapshot = backend ? await backend.read(tenant) : null;
        res.setHeader('Cache-Control', 'private, no-store');
        return res.json({ success: true, data: backend ? cliArchiveStatus(snapshot!.archive) : {
          configured: false, active: false, rowCount: 0, reportCount: 0, dates: [], imports: [],
          maxUploadBytes: MAX_CLI_UPLOAD_BYTES, message: 'Configure approved private storage before importing reports.',
        } });
      }
      if (path === '/cli-performance/import' && req.method === 'POST') {
        if (!backend) throw new CliArchiveError('CLI_STORAGE_NOT_CONFIGURED', 'Persistent CLI storage is not configured. Set CX_CLI_IMPORT_BUCKET on the server; no memory-only upload was accepted.', 503);
        const prepared = prepareCliImport(req.body?.csvText, req.body?.filename);
        const checked = parseAndValidateCliCsv(cliRowsToCsv(prepared.rows), prepared.filename);
        if (checked.errors.length) throw new CliArchiveError('INVALID_CLI_CSV', checked.errors.slice(0, 5).join(' '));
        const result = await importCliArchive(backend, tenant, prepared, principal.subject);
        revisions.delete(tenant);
        restore(tenant, result.archive, `import:${result.archive.updatedAt}:${result.archive.rows.length}`);
        return res.json({ success: true, count: result.insertedCount, insertedCount: result.insertedCount,
          duplicateCount: result.duplicateCount, duplicate: result.duplicate, anomalies: checked.anomalies,
          storage: 'PRIVATE_PERSISTENT_ARCHIVE', data: cliArchiveStatus(result.archive),
          message: result.duplicate ? 'Already saved. No rows were counted twice; the archive is active.'
            : `Saved ${result.insertedCount} new CLI rows; retained earlier reporting dates.` });
      }
      if (path === '/cli-performance/import' && req.method === 'DELETE') {
        if (!backend) { clearTenantImport(tenant); serverQueryCache.invalidateNamespace(tenant); revisions.delete(tenant); }
        else {
          await pauseCliArchive(backend, tenant, principal.subject);
          clearTenantImport(tenant); serverQueryCache.invalidateNamespace(tenant); revisions.delete(tenant);
        }
        return res.json({ success: true, message: 'Imported reporting paused. Saved history is retained; upload an existing or new report to resume.' });
      }
      // Restore the derived compatibility cache before the existing, scoped reporting/export handlers.
      // Those handlers retain their warehouse preference, filters, metric definitions and imported provenance.
      if (['GET', 'HEAD'].includes(req.method) && (path === '/cli-performance' || cliExport)) {
        if (backend) {
          const { archive, generation } = await backend.read(tenant);
          restore(tenant, archive, generation);
          res.setHeader('X-CLI-Archive', archive?.active ? 'active' : 'inactive');
          if (path === '/cli-performance' && req.method === 'GET') {
            const scope = cliReadScope(req, tenant);
            const data = await withAnalyticsScope(scope, () => readPerformance(scope));
            if (data.provenance === 'IMPORTED_REPORT' && data.summary) {
              // Daily archive rows repeat CLIs. Do not count one CLI once per reporting date.
              data.summary = { ...data.summary, activeClis: new Set(data.cliPerformance.map(row => row.cli)).size,
                avgLeadAgeDays: data.cliPerformance.length && data.cliPerformance.every(row => row.avgLeadAgeDays !== null)
                  ? data.leadAgeBands.avgLeadAgeDays : null };
              // Optional fields cannot produce complete-period totals from partial daily coverage.
              if (data.cliPerformance.some(row => row.asrCount === null)) { data.summary.asrCount = null; data.summary.asrRate = null; }
              if (data.cliPerformance.some(row => row.answeredCount === null)) {
                data.summary.answeredCount = null; data.summary.answeredRate = null; data.summary.salePerAnswerRate = null;
              }
              if (data.cliPerformance.some(row => row.activations === null)) data.summary.activations = null;
              if (data.cliPerformance.some(row => row.recordedValue === null)) data.summary.recordedValue = null;
            }
            return res.json({ success: true, data: { ...data, archive: {
              active: archive?.active ?? false, latestSavedReportDate: cliArchiveStatus(archive).latestReportDate,
              savedReportCount: archive?.imports.length || 0,
            } } });
          }
        }
        return next();
      }
      // Do not let alternate methods/trailing slash routes reach the old memory-only import handlers.
      if (path === '/cli-performance/import' || history) return res.status(405).json({ success: false, error: 'Method not allowed' });
      return next();
    } catch (error) { release(); throw error; }
    finally { workDone = true; if (res.destroyed || res.writableEnded) release(); }
  }
  router.use((req, res, next) => {
    void handle(req, res, next).catch(error => {
      if (res.headersSent || res.destroyed) return next(error);
      if (error instanceof CliArchiveError) return res.status(error.status).json({ success: false, error: error.message, code: error.code });
      next(error);
    });
  });
  return router;
}

/** Mirror the existing analytics scope contract, including explicit conflicts and unsupported filters. */
function cliReadScope(req: Request, tenant: string) {
  const filters = validateFilters(req.query.filters);
  for (const key of ['source', 'medium', 'vendor', 'partner', 'ror_partner', 'grade', 'cli', 'campaign', 'channel', 'adset', 'agent']) {
    const value = scalarString(req.query[key], key, 500);
    if (!value) continue;
    const values = value.split(',').map(item => item.trim()).filter(Boolean);
    const targetKey = ['partner', 'ror_partner'].includes(key) ? 'vendor' : key;
    const existing = filters[targetKey] || filters[key];
    if (existing) {
      const existingValues = existing.operator === 'in' ? existing.values : existing.operator === 'equals' ? [existing.value] : [];
      if (JSON.stringify([...(existingValues || [])].sort()) !== JSON.stringify([...values].sort())) throw new RequestError(`Conflicting ${targetKey} filters`, 422);
    } else filters[targetKey] = { operator: 'in', values };
  }
  for (const key of ['vendor', 'partner', 'ror_partner']) {
    const filter = filters[key];
    if (filter?.operator === 'equals') filters[key] = { operator: 'in', values: [filter.value!] };
    else if (filter && filter.operator !== 'in') throw new RequestError(`Use an inclusion filter for ${key}`);
  }
  return validateScope({ clientId: tenant, startDate: req.query.startDate, endDate: req.query.endDate, filters });
}
