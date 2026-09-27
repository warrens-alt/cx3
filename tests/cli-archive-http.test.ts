import test from 'node:test';
import assert from 'node:assert/strict';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createCliImportRouter } from '../server/cliImports/router';
import { getTenantImport, clearTenantImport } from '../server/bigquery/cli_analytics';
import { type CliArchive, type CliArchiveBackend } from '../server/cliImports/archive';
import type { CliPerformanceResponse } from '../contracts/cliPerformance';
import { type Principal } from '../server/securityPolicy';

const csvText = 'report_date,cli_number,campaign_code,total_calls,contact_count,sale_count\n2026-09-22,27000000001,TEST,100,10,2';
class Backend implements CliArchiveBackend {
  archive: CliArchive | null = null; generation = '0'; reads = 0;
  async read() { this.reads++; return { archive: this.archive ? structuredClone(this.archive) : null, generation: this.generation }; }
  async compareAndSwap(_tenant: string, generation: string, archive: CliArchive) {
    if (generation !== this.generation) return false;
    this.archive = structuredClone(archive); this.generation = String(Number(this.generation) + 1); return true;
  }
}
const admin: Principal = { subject: 'synthetic-admin', email: 'admin@example.invalid', role: 'admin', tenants: ['default_tenant'] };
async function withApp(principal: Principal | null, backend: CliArchiveBackend | null, run: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json({ limit: '128kb' }));
  app.use((_req, res, next) => { if (principal) res.locals.principal = principal; next(); });
  app.use('/api/analytics', createCliImportRouter(() => backend, async () => ({ provenance: 'IMPORTED_REPORT', summary: null, metadata: { rowCount: getTenantImport('default_tenant')?.records.length || 0 } } as CliPerformanceResponse)));
  app.get(['/api/analytics/cli-performance', '/api/analytics/export'], (_req, res) => res.json({ cachedRows: getTenantImport('default_tenant')?.records.length || 0 }));
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => res.status(error.status || error.statusCode || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test address');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); clearTenantImport('default_tenant'); }
}
const upload = (base: string, text = csvText, path = '/api/analytics/cli-performance/import') => fetch(`${base}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csvText: text, filename: 'synthetic.csv', clientId: 'default_tenant' }),
});
test('unauthenticated and viewer writes never touch storage', async () => {
  for (const principal of [null, { ...admin, role: 'viewer' as const }]) {
    const backend = new Backend();
    await withApp(principal, backend, async base => { const response = await upload(base); assert.notEqual(response.status, 200); });
    assert.equal(backend.reads, 0);
  }
});
test('an unauthorized tenant is rejected before storage I/O', async () => {
  const backend = new Backend();
  await withApp({ ...admin, tenants: [] }, backend, async base => { const response = await upload(base); assert.notEqual(response.status, 200); });
  assert.equal(backend.reads, 0);
});
test('unconfigured import fails explicitly, including case-insensitive trailing-slash routes', async () => {
  await withApp(admin, null, async base => {
    for (const path of ['/api/analytics/cli-performance/import', '/api/analytics/CLI-PERFORMANCE/IMPORT/']) {
      const response = await upload(base, csvText, path);
      assert.equal(response.status, 503); assert.equal((await response.json()).code, 'CLI_STORAGE_NOT_CONFIGURED');
    }
  });
});
test('uploads, deduplication and history work through HTTP', async () => {
  const backend = new Backend();
  await withApp(admin, backend, async base => {
    assert.equal((await upload(base)).status, 200);
    const duplicate = await (await upload(base)).json();
    assert.equal(duplicate.insertedCount, 0); assert.equal(duplicate.duplicate, true);
    const history = await (await fetch(`${base}/api/analytics/cli-performance/import/history?clientId=default_tenant`)).json();
    assert.equal(history.data.rowCount, 1); assert.equal(history.data.latestReportDate, '2026-09-22');
    assert.equal(history.data.provenance, 'IMPORTED_REPORT');
  });
});
test('a new router instance hydrates reports after the derived memory cache is lost', async () => {
  const backend = new Backend();
  await withApp(admin, backend, async base => { assert.equal((await upload(base)).status, 200); });
  assert.equal(getTenantImport('default_tenant'), null);
  await withApp(admin, backend, async base => {
    const response = await fetch(`${base}/api/analytics/cli-performance?clientId=default_tenant`);
    assert.equal((await response.json()).data.metadata.rowCount, 1);
    const exported = await fetch(`${base}/api/analytics/export?clientId=default_tenant&grain=cli`);
    assert.equal((await exported.json()).cachedRows, 1);
  });
});
test('conflicts do not change saved history', async () => {
  const backend = new Backend();
  await withApp(admin, backend, async base => {
    await upload(base);
    const response = await upload(base, csvText.replace(',100,', ',101,'));
    assert.equal(response.status, 409); assert.equal(backend.archive!.imports.length, 1);
  });
});
test('legacy clear action pauses derived reporting without deleting saved history', async () => {
  const backend = new Backend();
  await withApp(admin, backend, async base => {
    await upload(base);
    const response = await fetch(`${base}/api/analytics/cli-performance/import?clientId=default_tenant`, { method: 'DELETE' });
    assert.equal(response.status, 200); assert.equal(backend.archive!.active, false); assert.equal(backend.archive!.rows.length, 1);
    await upload(base); assert.equal(backend.archive!.active, true); assert.equal(backend.archive!.rows.length, 1);
  });
});
