/** Synthetic reporting/replay QA. Browser plugin unavailable; existing Playwright runtime. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildAcceptanceFixture } from './build-frontend-acceptance-fixture.mjs';
import { fixtureRelease, fixtureRow, fixtureRepository, request } from '../tests/reporting-fixtures.ts';
import { executeReport } from '../server/reporting/service.ts';
import { attachReplayToken, replayReport } from '../server/reporting/replay.ts';

const output = process.env.CX_BROWSER_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'cx3-reports-qa-'));
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), 'cx3-reports-app-'));
await buildAcceptanceFixture(fixture);
const scope = { ...request, tenantId: 'synthetic-a' };
const release = { ...fixtureRelease(), tenantId: scope.tenantId };
const repo = fixtureRepository(release, [fixtureRow(scope)]).repository;
const authority = { subject: 'synthetic-browser', role: 'viewer', tenants: ['synthetic-a'], email: 'fixture@example.invalid' };
const key = 'synthetic-browser-only-signing-secret-at-least-32-bytes';
const report = attachReplayToken(await executeReport(repo, authority, scope), key);
const replay = await replayReport(repo, authority, { contractVersion: 'cx.report-replay.1', tenantId: scope.tenantId, token: report.token }, { signingKey: key });
const payloads = { '/api/reporting/catalogue': { configured: true, status: 'AVAILABLE', release, replayConfigured: true, execution: { status: 'SUPPORTED', definitionHash: release.execution.definitionHash } }, '/api/reporting': report, '/api/reporting/replay': replay };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
  const name = url.pathname === '/brand/conversionx-grey.png' ? 'conversionx-grey.png' : ['/fixture.js', '/fixture.css', '/application.css'].includes(url.pathname) ? url.pathname.slice(1) : 'index.html';
  try { res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : 'text/html'); res.end(await readFile(path.join(fixture, name))); } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.CX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CX_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CX_CHROMIUM_EXECUTABLE } : {}) });
const results = [];
try {
  for (const theme of ['light', 'dark']) for (const width of [1440, 1024, 820, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 820 ? 1180 : width < 640 ? 844 : 1000 }, colorScheme: theme, reducedMotion: 'reduce', acceptDownloads: true });
    await context.addInitScript(({ theme, payloads }) => {
      localStorage.setItem('cx-theme', theme); let state;
      Object.defineProperty(window, '__fixture', { configurable: true, get: () => state, set: value => { state = { ...value, payloads }; } });
    }, { theme, payloads });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', err => errors.push(err.message)); page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    const record = { theme, width, passed: false, checks: [], screenshots: [] };
    const check = async (name, action) => { await action(); record.checks.push(name); };
    const overflow = async () => { const size = await page.evaluate(() => ({ width: innerWidth, doc: document.documentElement.scrollWidth, main: document.querySelector('main').clientWidth, scroll: document.querySelector('main').scrollWidth })); assert.ok(size.doc <= size.width + 1 && size.scroll <= size.main + 1, JSON.stringify(size)); };
    const shot = async name => { const filename = `${name}-${theme}-${width}.png`; await page.screenshot({ path: path.join(output, filename) }); record.screenshots.push(filename); };
    try {
      await page.goto(`${origin}/reports?clientId=synthetic-a&startDate=${scope.startDate}&endDate=${scope.endDate}`);
      await page.getByRole('button', { name: 'Run report', exact: true }).waitFor();
      await check('Page identity, no automatic execution, responsive controls', async () => {
        assert.equal(await page.title(), 'Evidence reports · ConversionX');
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.evaluate(() => window.__fixture.requests.filter(value => value === '/api/reporting').length), 0);
        await overflow();
      });
      await check('Explicit bounded report and exact evidence', async () => {
        await page.getByRole('button', { name: 'Run report', exact: true }).click();
        await page.locator('.cx-report-result').waitFor();
        assert.ok((await page.locator('.cx-report-metric-grid').innerText()).includes('9007199254740993'));
        assert.ok((await page.locator('.cx-report-metric-grid').innerText()).includes('NOT_VERIFIED'));
        assert.equal(await page.locator('.cx-report-metric-card').count(), 1);
        await overflow(); await shot('report-exact');
      });
      await check('Canonical audit drawer lineage, Escape and focus return', async () => {
        const trigger = page.getByRole('button', { name: 'Inspect definition and lineage' }); await trigger.click();
        const dialog = page.getByRole('dialog', { name: 'Fetched leads' }); await dialog.waitFor();
        assert.ok((await dialog.innerText()).includes('fixture.reporting.leads'));
        assert.ok((await dialog.innerText()).includes('No record-level'));
        await shot('report-audit'); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
        assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
      });
      await check('Signed replay reproduces without reconciliation promotion', async () => {
        await page.getByRole('button', { name: 'Replay and compare', exact: true }).click();
        await page.getByRole('heading', { name: 'MATCH', exact: true }).waitFor();
        assert.ok((await page.locator('.cx-report-replay').innerText()).includes('Original immutable result'));
        assert.ok((await page.locator('.cx-report-replay').innerText()).includes('NOT_VERIFIED'));
        assert.equal(await page.locator('.cx-report-result [data-audit-state="reconciled"]').count(), 0);
        await page.locator('.cx-report-replay').scrollIntoViewIfNeeded(); await overflow(); await shot('report-replay');
      });
      await check('Exact JSON export contains original scope and replay evidence', async () => {
        const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export result and evidence' }).click();
        const downloaded = await download, file = path.join(output, `result-${theme}-${width}.json`); await downloaded.saveAs(file);
        const parsed = JSON.parse(await readFile(file, 'utf8'));
        assert.equal(parsed.request.tenantId, 'synthetic-a'); assert.equal(parsed.totals[0].value, '9007199254740993'); assert.equal(parsed.evidence.independentlyReconciled, 'NOT_VERIFIED');
      });
      await check('Unsupported private scope prevents execution', async () => {
        await page.evaluate(() => window.__fixture.navigate('/reports?clientId=synthetic-a&startDate=2026-09-01&endDate=2026-09-02&search=private-record'));
        await page.getByText(/This URL includes record/).waitFor(); assert.equal(await page.getByRole('button', { name: 'Run report', exact: true }).isDisabled(), true);
        assert.equal(await page.locator('.cx-report-result').count(), 0); await overflow();
      });
      assert.deepEqual(errors, []); record.passed = true;
    } catch (error) { record.error = error.stack || String(error); record.console = errors; await shot('failure'); }
    results.push(record); await context.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, synthetic: true, browserPlugin: 'not available', results }, null, 2)); }
console.log(JSON.stringify({ output, passed: results.filter(item => item.passed).length, total: results.length, checks: results.reduce((sum, item) => sum + item.checks.length, 0) }));
if (results.some(item => !item.passed)) process.exitCode = 1;
