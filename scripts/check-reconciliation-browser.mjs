/** Synthetic reconciliation QA. Browser plugin unavailable; existing Playwright runtime. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAcceptanceFixture } from './build-frontend-acceptance-fixture.mjs';
import { runReconciliation } from './reconcile-operational-metrics.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.CX_BROWSER_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'cx3-reconciliation-qa-')));
assert.ok(output !== root && !output.startsWith(root + path.sep), 'Browser evidence must remain outside the repository.');
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), 'cx3-reconciliation-app-'));
await buildAcceptanceFixture(fixture);
// The actual harness compiles its registered tenant query but all jobs/service data are synthetic.
// No live client, API, credentials or warehouse execution is used by this acceptance script.
const scope = { clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-30' };
const counts = { fetched: '2', qualifiedDelivered: '1', qualifiedDialled: '1', rpc: '0', recordedSales: '1', recordedActivations: '1', callCountUnrecorded: '1', completeRevenueTotal: null, knownRevenueSubtotal: '12345678901234567890.123456789' };
const service = { fetchedLeads: 2, deliveredLeads: 1, dialledLeads: 1, contactedLeads: 0, saleLeads: 1, activatedLeads: 1, unrecordedCallLeads: 1 };
const artifacts = {};
for (const mode of ['dry', 'warehouse', 'match', 'mismatch', 'unavailable']) {
  artifacts[mode] = await runReconciliation({ scope, dryRun: mode === 'dry', compareService: !['dry', 'warehouse'].includes(mode) }, {
    client: { dryRun: async () => ({ totalBytesProcessed: 0 }), createQueryJob: async () => [{ id: 'synthetic-browser-job', getQueryResults: async () => [[counts]] }] },
    service: async () => ({ kpis: { ...service, ...(mode === 'mismatch' ? { fetchedLeads: 1 } : mode === 'unavailable' ? { fetchedLeads: null } : {}) } }),
  });
  await writeFile(path.join(output, `synthetic-harness-${mode}.json`), JSON.stringify(artifacts[mode], null, 2));
}
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
  const name = pathname === '/brand/conversionx-grey.png' ? 'conversionx-grey.png' : ['/fixture.js', '/fixture.css', '/application.css'].includes(pathname) ? pathname.slice(1) : 'index.html';
  try { res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : 'text/html'); res.end(await readFile(path.join(fixture, name))); } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.CX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CX_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CX_CHROMIUM_EXECUTABLE } : {}) });
const query = new URLSearchParams({ clientId: scope.clientId, startDate: scope.startDate, endDate: scope.endDate }).toString();
const route = `/validation?${query}`;
const results = [];
const requests = page => page.evaluate(() => [...window.__fixture.requests]);
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function makeContext(theme, width, nonAdmin = false) {
  const context = await browser.newContext({ viewport: { width, height: width === 820 ? 1180 : width < 640 ? 844 : 1000 }, colorScheme: theme, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript(({ theme, nonAdmin }) => {
    localStorage.setItem('cx-theme', theme); let state;
    Object.defineProperty(window, '__fixture', { configurable: true, get: () => state, set: value => { state = { ...value, nonAdmin }; } });
  }, { theme, nonAdmin });
  return context;
}
try {
  for (const theme of ['light', 'dark']) for (const width of [1440, 1024, 820, 390, 320]) {
    const context = await makeContext(theme, width);
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    const result = { theme, width, passed: false, checks: [], screenshots: [] };
    const check = async (name, action) => { await action(); result.checks.push(name); };
    const panel = page.getByRole('region', { name: 'Reconciliation operator workflow', exact: true });
    const overflow = async () => {
      const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, main: document.querySelector('main')?.clientWidth, mainScroll: document.querySelector('main')?.scrollWidth }));
      assert.ok(size.document <= size.viewport + 1 && size.mainScroll <= size.main + 1, `Page overflow: ${JSON.stringify(size)}`);
    };
    const shot = async (name, target = page) => { const filename = `${name}-${theme}-${width}.png`; await target.screenshot({ path: path.join(output, filename) }); result.screenshots.push(filename); };
    const importFile = async (name, expected) => {
      const before = await requests(page);
      await panel.getByLabel('Import reconciliation harness JSON', { exact: true }).setInputFiles(path.join(output, `synthetic-harness-${name}.json`));
      await panel.getByText(expected, { exact: true }).first().waitFor();
      await settle(page); assert.deepEqual(await requests(page), before, 'Local import must not issue a request');
      assert.match(await panel.innerText(), /NOT_VERIFIED · local import is not trusted certification/);
      assert.match(await panel.innerText(), /Persistence\s+UNAVAILABLE/);
      assert.equal(await panel.locator('[data-audit-state="reconciled"]').count(), 0);
      await overflow();
    };
    try {
      await page.goto(origin + route); await panel.waitFor(); await page.waitForLoadState('networkidle'); await settle(page);
      await check('Page identity, meaningful content, theme, overlays and initial state', async () => {
        assert.equal(new URL(page.url()).pathname, '/validation'); assert.match(await page.title(), /Validation.* · ConversionX$/);
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme); assert.ok((await page.locator('main').innerText()).length > 100);
        assert.equal(await page.locator('vite-error-overlay, nextjs-portal').count(), 0);
        assert.match(await panel.innerText(), /Not run/); await overflow(); await shot('reconciliation-initial');
      });
      await check('Fixed command modes, exact scope and clipboard without execution', async () => {
        const before = await requests(page), command = panel.getByLabel('Reconciliation command');
        assert.equal(await command.innerText(), "npm run reconcile:metrics -- --client 'mtn' --start '2026-09-01' --end '2026-09-30' --dry-run");
        await panel.getByRole('combobox', { name: 'Operator run' }).selectOption('compare'); assert.match(await command.innerText(), / --compare-service$/);
        await panel.getByRole('button', { name: 'Copy command', exact: true }).click(); await panel.getByText('Command copied. No reconciliation has run.', { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await command.innerText());
        await panel.getByRole('combobox', { name: 'Operator run' }).selectOption('warehouse'); assert.doesNotMatch(await command.innerText(), /--compare-service|--dry-run/);
        assert.deepEqual(await requests(page), before);
      });
      await check('Actual synthetic dry-run artifact does not become warehouse evidence', async () => { await importFile('dry', 'Dry-run validated'); assert.match(await panel.innerText(), /Not compared/); });
      await check('Actual synthetic warehouse artifact preserves exact decimals, zero and unavailable', async () => {
        await importFile('warehouse', 'Warehouse measured'); await panel.getByText('Inspect imported scope, provenance and exact measurements', { exact: true }).click();
        const table = panel.getByRole('region', { name: 'Exact imported warehouse measurements' });
        assert.match(await table.innerText(), /12345678901234567890\.123456789/); assert.match(await table.innerText(), /rpc\s+0/); assert.match(await table.innerText(), /completeRevenueTotal\s+Unavailable/);
        await overflow();
      });
      await check('Actual synthetic match remains unattested with exact comparison values', async () => {
        await importFile('match', 'Matched'); assert.match(await panel.innerText(), /Compared with service · listed metrics only/);
        assert.equal(await panel.locator('.cx-audit-comparison-table tbody tr').count(), 7);
        assert.match(await panel.innerText(), /Operator-supplied comparison · unattested/);
        await panel.locator('.cx-audit-reconciliation').scrollIntoViewIfNeeded(); await shot('reconciliation-match');
        if (width < 820) {
          const scroll = panel.getByRole('region', { name: 'Exact comparison values', exact: true });
          await scroll.focus(); await scroll.hover(); await page.mouse.wheel(1000, 0);
          await page.waitForFunction(() => document.querySelector('.cx-audit-comparison-scroll')?.scrollLeft > 0);
          const edge = await scroll.evaluate(element => ({ viewport: element.getBoundingClientRect().right, value: element.querySelector('tbody tr td:last-child').getBoundingClientRect().right }));
          assert.ok(edge.value <= edge.viewport + 1, 'Exact differences remain reachable by horizontal scrolling');
          await shot('reconciliation-match-scrolled');
        }
      });
      await check('Actual synthetic mismatch and unavailable evidence retain distinct statuses', async () => {
        await importFile('mismatch', 'Mismatch detected'); assert.match(await panel.locator('.cx-audit-comparison-table tbody tr').first().innerText(), /-1/);
        await panel.locator('.cx-audit-reconciliation').scrollIntoViewIfNeeded(); await shot('reconciliation-mismatch');
        await importFile('unavailable', 'Unavailable'); assert.match(await panel.locator('.cx-audit-comparison-table tbody tr').first().innerText(), /Unavailable/);
      });
      await check('Clear action and tenant change discard local evidence', async () => {
        await panel.getByRole('button', { name: 'Clear local evidence', exact: true }).click(); await panel.getByText('Not run', { exact: true }).waitFor();
        await importFile('match', 'Matched');
        await page.evaluate(route => window.__fixture.navigate(route.replace('clientId=mtn', 'clientId=mondo')), route);
        await panel.getByLabel('Reconciliation command').filter({ hasText: "'mondo'" }).waitFor();
        assert.match(await panel.innerText(), /Not run/); assert.equal(await panel.locator('.cx-audit-reconciliation').count(), 0);
      });
      await check('Exact selected filters remain in the prepared command', async () => {
        await page.evaluate(route => window.__fixture.navigate(route + '&vendor=Synthetic+vendor&source=Synthetic+source&grade=Synthetic+grade'), route);
        await panel.getByLabel('Reconciliation command').filter({ hasText: "--vendor 'Synthetic vendor'" }).waitFor();
        assert.match(await panel.getByLabel('Reconciliation command').innerText(), /--source 'Synthetic source' --grade 'Synthetic grade'/); await overflow();
      });
      await check('Private and unsupported filters block commands without silently narrowing scope', async () => {
        await page.evaluate(route => window.__fixture.navigate(route + '&search=private-record'), route);
        await panel.getByText(/cannot apply these URL parameters: search/).waitFor();
        assert.equal(await panel.locator('input[type=file], pre').count(), 0); await overflow();
        await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('main')?.scrollTo(0, 0); });
        await settle(page); await shot('reconciliation-private-scope');
        await page.evaluate(route => window.__fixture.navigate(route + '&filters=' + encodeURIComponent(JSON.stringify({ medium: { operator: 'equals', value: 'unsupported' } }))), route);
        await panel.getByText(/Unsupported reconciliation filter: medium/).waitFor(); assert.equal(await panel.locator('input[type=file], pre').count(), 0);
      });
      await check('Non-admin cannot prepare or import operator evidence', async () => {
        const viewer = await makeContext(theme, width, true);
        try {
          const viewerPage = await viewer.newPage(); viewerPage.on('pageerror', error => errors.push(error.message)); viewerPage.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
          await viewerPage.goto(origin + route); await viewerPage.getByText('Administrator access is required to prepare or inspect reconciliation evidence.', { exact: true }).waitFor(); await viewerPage.waitForLoadState('networkidle');
          assert.equal(await viewerPage.locator('input[type=file], pre[aria-label="Reconciliation command"]').count(), 0);
          const size = await viewerPage.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth })); assert.ok(size.scroll <= size.width + 1);
          await shot('reconciliation-viewer', viewerPage);
        } finally { await viewer.close(); }
      });
      assert.deepEqual(errors, []); result.passed = true; console.log(`PASS reconciliation ${theme} ${width} (${result.checks.length} checks)`);
    } catch (error) { result.error = error.stack || String(error); result.console = errors; await shot('failure').catch(() => {}); console.error(`FAIL reconciliation ${theme} ${width}: ${error.message}`); }
    results.push(result); await context.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, synthetic: true, browserPlugin: 'not available', results }, null, 2)); }
console.log(JSON.stringify({ output, passed: results.filter(result => result.passed).length, total: results.length, checks: results.reduce((sum, result) => sum + result.checks.length, 0) }));
if (results.some(result => !result.passed)) process.exitCode = 1;
