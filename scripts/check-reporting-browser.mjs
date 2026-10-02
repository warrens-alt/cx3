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
import { METRICS, METRIC_BY_ID } from '../contracts/reporting.ts';
import { reportRequest } from '../server/reporting/scope.ts';

const output = process.env.CX_BROWSER_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'cx3-reports-qa-'));
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), 'cx3-reports-app-'));
await buildAcceptanceFixture(fixture);
const scope = { ...request, tenantId: 'synthetic-a' };
const release = { ...fixtureRelease(), tenantId: scope.tenantId };
release.execution.supportedMetrics = METRICS.map(metric => metric.id);
const historicalRelease = { ...release, releaseId: 'release_historical', approvalReference: 'synthetic-historical-approval' };
const authority = { subject: 'synthetic-browser', role: 'viewer', tenants: ['synthetic-a'], email: 'fixture@example.invalid' };
const key = 'synthetic-browser-only-signing-secret-at-least-32-bytes';
const registeredRelease = releaseId => releaseId === historicalRelease.releaseId ? historicalRelease : releaseId === undefined || releaseId === release.releaseId ? release : null;
const repository = fixtureRepository(release).repository;
repository.release = async (_tenant, releaseId) => registeredRelease(releaseId);
function requestRepository(input) {
  const normalized = reportRequest(input);
  const rows = normalized.metrics.flatMap(id => {
    const metric = METRIC_BY_ID[id], ratio = metric.unit === 'percent';
    const value = ratio ? '50' : metric.unit === 'currency' ? '9007199254740993.123456789' : '9007199254740993';
    const row = { ...fixtureRow(normalized), metric_id: id, unit: metric.unit, grain: metric.grain, value, numerator: ratio ? '1' : value, denominator: ratio ? '2' : null };
    return normalized.grouping === 'none' ? [row] : [row, { ...row, is_total: false, group_key: normalized.grouping === 'vendor' ? 'Synthetic vendor' : 'Synthetic source' }];
  });
  return { ...repository, query: fixtureRepository(registeredRelease(normalized.releaseId), rows).repository.query };
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
  if (url.pathname.startsWith('/api/reporting')) {
    try {
      let data;
      if (url.pathname === '/api/reporting/catalogue') {
        const selected = registeredRelease(url.searchParams.get('releaseId') || undefined);
        data = { configured: true, status: selected ? 'AVAILABLE' : 'NO_APPROVED_RELEASE', release: selected, replayConfigured: true, execution: { status: selected ? 'SUPPORTED' : 'NOT_SUPPORTED', definitionHash: release.execution.definitionHash } };
      } else {
        let text = ''; for await (const chunk of req) text += chunk;
        const body = JSON.parse(text);
        if (url.pathname === '/api/reporting') data = attachReplayToken(await executeReport(requestRepository(body), authority, body), key);
        else if (url.pathname === '/api/reporting/replay') {
          const descriptor = JSON.parse(Buffer.from(body.token.split('.')[0], 'base64url').toString());
          data = await replayReport(requestRepository(descriptor.original.request), authority, body, { signingKey: key });
        } else throw new Error('Unexpected synthetic reporting request');
      }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data }));
    } catch (error) { res.writeHead(error.status || 500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: error.message })); }
    return;
  }
  const name = url.pathname === '/brand/conversionx-grey.png' ? 'conversionx-grey.png' : ['/fixture.js', '/fixture.css', '/application.css'].includes(url.pathname) ? url.pathname.slice(1) : 'index.html';
  try { res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : 'text/html'); res.end(await readFile(path.join(fixture, name))); } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.CX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CX_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CX_CHROMIUM_EXECUTABLE } : {}) });
const results = [];
const canonical = process.env.CX_QA_CANONICAL === 'true';
const reportRoute = canonical ? '/evidence/releases' : '/reports';
const vendorRoute = canonical ? '/evidence/vendors' : '/vendors';
const reconciliationRoute = canonical ? '/commercial/reconciliation' : '/reconciliation';
const routeSlug = route => route.slice(1).replaceAll('/', '-');
try {
  for (const theme of ['light', 'dark']) for (const width of [1440, 1024, 820, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 820 ? 1180 : width < 640 ? 844 : 1000 }, colorScheme: theme, reducedMotion: 'reduce', acceptDownloads: true });
    await context.addInitScript(({ theme }) => {
      localStorage.setItem('cx-theme', theme); let state;
      Object.defineProperty(window, '__fixture', { configurable: true, get: () => state, set: value => { state = { requestDetails: [], ...value }; } });
      const nativeFetch = window.fetch.bind(window); let fixtureFetch = nativeFetch;
      Object.defineProperty(window, 'fetch', { configurable: true, set: value => { fixtureFetch = value; }, get: () => (input, options = {}) => {
        const url = new URL(String(input), location.origin);
        if (url.pathname.startsWith('/api/reporting')) {
          state.requests.push(url.pathname + url.search);
          state.requestDetails.push({ url: url.pathname + url.search, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
          return nativeFetch(input, options);
        }
        return fixtureFetch(input, options);
      } });
    }, { theme });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', err => errors.push(err.message)); page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    const record = { theme, width, passed: false, checks: [], failures: [], screenshots: [] };
    const check = async (name, action) => {
      try { await action(); record.checks.push(name); }
      catch (error) { record.failures.push({ name, error: error.stack || String(error) }); console.error(`FAIL ${theme} ${width}: ${name}: ${error.message}`); await shot(`failure-${record.failures.length}`); }
    };
    const overflow = async () => { const size = await page.evaluate(() => ({ width: innerWidth, doc: document.documentElement.scrollWidth, main: document.querySelector('main').clientWidth, scroll: document.querySelector('main').scrollWidth })); assert.ok(size.doc <= size.width + 1 && size.scroll <= size.main + 1, JSON.stringify(size)); };
    const shot = async name => { const filename = `${name}-${theme}-${width}.png`; await page.screenshot({ path: path.join(output, filename) }); record.screenshots.push(filename); };
    try {
      await page.goto(`${origin}${reportRoute}?clientId=synthetic-a&startDate=${scope.startDate}&endDate=${scope.endDate}`);
      await page.getByRole('button', { name: 'Run report', exact: true }).waitFor();
      await check('Page identity, no automatic execution, responsive controls', async () => {
        assert.equal(await page.title(), 'Releases & replay · ConversionX');
        assert.equal(new URL(page.url()).pathname, reportRoute);
        assert.ok((await page.locator('main').innerText()).length > 100);
        assert.equal(await page.locator('vite-error-overlay, nextjs-portal').count(), 0);
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
        assert.equal(await dialog.getByRole('button', { name: 'Copy scoped link', exact: true, includeHidden: true }).count(), 0, 'Immutable execution cannot be restored by an operational page link');
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
        await page.evaluate(route => window.__fixture.navigate(route + '?clientId=synthetic-a&startDate=2026-09-01&endDate=2026-09-02&search=private-record'), reportRoute);
        await page.getByText(/This URL includes record/).waitFor(); assert.equal(await page.getByRole('button', { name: 'Run report', exact: true }).isDisabled(), true);
        assert.equal(await page.locator('.cx-report-result').count(), 0); await overflow();
      });
      for (const route of [vendorRoute, reconciliationRoute]) {
        await check(`${route}: historical release reaches every execution and exact values retain precision`, async () => {
        await page.goto(`${origin}${route}?clientId=synthetic-a&startDate=${scope.startDate}&endDate=${scope.endDate}&release=${historicalRelease.releaseId}`);
        await page.waitForFunction(() => window.__fixture.requestDetails.some(item => item.url === '/api/reporting' && item.method === 'POST'));
        await page.waitForFunction(() => document.querySelector('main').textContent.includes('9,007,199,254,740,993'));
        await page.waitForLoadState('networkidle');
        const details = await page.evaluate(() => window.__fixture.requestDetails);
        const catalogues = details.filter(item => item.url.startsWith('/api/reporting/catalogue'));
        assert.ok(catalogues.length > 0); assert.ok(catalogues.every(item => new URL(item.url, origin).searchParams.get('releaseId') === historicalRelease.releaseId));
        const executions = details.filter(item => item.url === '/api/reporting' && item.method === 'POST');
        assert.ok(executions.length >= 2, 'Current and previous intervals both execute');
        assert.ok(executions.every(item => item.body.releaseId === historicalRelease.releaseId && item.body.tenantId === 'synthetic-a'));
        const text = await page.locator('main').innerText(); assert.ok(text.includes('9,007,199,254,740,993')); assert.ok(text.includes('9,007,199,254,740,993.123456789')); assert.ok(!text.includes('9,007,199,254,740,992'));
        await overflow();
        const clippedValues = await page.locator('.cx-ops-metric-value, .cx-ops-periods strong, .cx-ops-driver article strong, .cx-command-metric strong').evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent));
        assert.deepEqual(clippedValues, [], 'Exact summary values fit or wrap without clipping');
        const table = page.getByRole('region', { name: /table, scroll for all values/ });
        await table.focus(); assert.equal(await table.evaluate(element => element === document.activeElement), true);
        await table.evaluate(element => { element.scrollLeft = element.scrollWidth; });
        assert.ok(await table.evaluate(element => element.scrollLeft > 0), 'Wide exact table is independently scrollable');
        await table.evaluate(element => { element.scrollLeft = 0; });
        await page.locator('h1').scrollIntoViewIfNeeded(); await shot(routeSlug(route) + '-historical-exact');
        await table.scrollIntoViewIfNeeded(); await shot(routeSlug(route) + '-historical-table');
        assert.ok(text.includes('Supporting frozen records are unavailable in this interface.'));
        if (route === reconciliationRoute) {
          await page.getByText('View period changes and reconciliation methodology', { exact: true }).click();
          const methodology = page.locator('.cx-commercial-controls');
          assert.ok((await methodology.innerText()).includes('does not expose agreement versions'));
          assert.ok((await methodology.innerText()).includes('does not expose the agreement, eligibility or effective-date evidence'));
        }
        });
        await check(`${route}: graph tooltip preserves original exact values without overflow`, async () => {
          const panel = page.locator('.cx-ops-table-card');
          await panel.getByRole('button', { name: 'Graph', exact: true }).click();
          const bar = panel.locator('.recharts-bar-rectangle').first();
          await bar.waitFor(); await bar.hover();
          const tooltip = panel.locator('.cx-chart-tooltip'); await tooltip.waitFor({ state: 'visible' });
          await tooltip.locator('..').evaluate(async element => {
            await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });
          const values = await tooltip.locator('.cx-chart-tooltip-value').allTextContents();
          const expected = route === vendorRoute ? '9,007,199,254,740,993' : 'R9,007,199,254,740,993.123456789';
          assert.equal(values.length, route === vendorRoute ? 4 : 2);
          assert.ok(values.every(value => value === expected), JSON.stringify(values));
          const bounds = await tooltip.evaluate(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, viewport: innerWidth, clipped: [...element.querySelectorAll('.cx-chart-tooltip-value')].some(value => value.scrollWidth > value.clientWidth + 1) }; });
          assert.ok(bounds.left >= 0 && bounds.right <= bounds.viewport && !bounds.clipped, JSON.stringify(bounds));
          assert.ok((await panel.innerText()).includes('Axes and bar lengths are approximate.'));
          await overflow(); await shot(routeSlug(route) + '-graph-exact-tooltip');
        });
      }
      for (const route of [reportRoute, vendorRoute, reconciliationRoute]) {
        await check(`${route}: repeated release identity is rejected before reporting access`, async () => {
          await page.goto(`${origin}${route}?clientId=synthetic-a&startDate=${scope.startDate}&endDate=${scope.endDate}&release=${release.releaseId}&release=${historicalRelease.releaseId}`);
          await page.getByText('Choose one explicit reporting release.', { exact: true }).first().waitFor();
          assert.equal(await page.evaluate(() => window.__fixture.requests.filter(value => value.startsWith('/api/reporting')).length), 0);
          await overflow();
        });
        for (const parameter of ['consumer_id=synthetic-private-identity', 'unregisteredScope=do-not-drop']) await check(`${route}: ${parameter.split('=')[0]} blocks execution`, async () => {
          await page.goto(`${origin}${route}?clientId=synthetic-a&startDate=${scope.startDate}&endDate=${scope.endDate}&${parameter}`);
          await page.getByText(/This URL includes record/).first().waitFor();
          await page.waitForLoadState('networkidle');
          assert.equal(await page.evaluate(() => window.__fixture.requests.filter(value => value === '/api/reporting').length), 0);
          if (route === reportRoute) assert.equal(await page.getByRole('button', { name: 'Run report', exact: true }).isDisabled(), true);
          await overflow();
        });
      }
      assert.deepEqual(errors, []); record.passed = record.failures.length === 0;
    } catch (error) { record.error = error.stack || String(error); record.console = errors; await shot('failure'); }
    results.push(record); console.log(`${record.passed ? 'PASS' : 'FAIL'} ${theme} ${width}: ${record.checks.length} passed, ${record.failures.length} failed`); await context.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, synthetic: true, browserPlugin: 'not available', results }, null, 2)); }
console.log(JSON.stringify({ output, passed: results.filter(item => item.passed).length, total: results.length, checks: results.reduce((sum, item) => sum + item.checks.length, 0) }));
if (results.some(item => !item.passed)) process.exitCode = 1;
