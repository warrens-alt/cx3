/** Canonical Lead Evidence QA. Browser plugin unavailable; existing Playwright runtime, synthetic data only. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildAcceptanceFixture } from './build-frontend-acceptance-fixture.mjs';

const output = process.env.CX_BROWSER_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'cx3-lead-evidence-qa-'));
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), 'cx3-lead-evidence-app-'));
await buildAcceptanceFixture(fixture);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
  const file = pathname === '/brand/conversionx-grey.png' ? 'conversionx-grey.png' : ['/fixture.js', '/fixture.css', '/application.css'].includes(pathname) ? pathname.slice(1) : 'index.html';
  try { response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html'); response.end(await readFile(path.join(fixture, file))); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.CX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CX_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CX_CHROMIUM_EXECUTABLE } : {}) });
const scope = '?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28';
const leadId = 'SYNTHETIC-LEAD-0001-very-long-identity-for-responsive-checks';
const results = [];
const requests = page => page.evaluate(() => [...window.__fixture.requests]);
const count = (values, type) => values.filter(value => type === 'source' ? /\/lead-ledger\/replica\?/.test(value) : value.includes(type)).length;
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function overflow(page) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, main: document.querySelector('main')?.clientWidth, mainScroll: document.querySelector('main')?.scrollWidth }));
  assert.ok(size.document <= size.viewport + 1 && size.mainScroll <= size.main + 1, JSON.stringify(size));
}
try {
  for (const theme of ['light', 'dark']) for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }, { width: 320, height: 844 }]) {
    const result = { theme, viewport, passed: false, checks: [], screenshots: [] };
    const context = await browser.newContext({ viewport, colorScheme: theme, reducedMotion: 'reduce', acceptDownloads: true });
    await context.addInitScript(theme => {
      localStorage.setItem('cx-theme', theme); localStorage.setItem('cx.presentation.audit-mode.v1', 'on');
      let state;
      Object.defineProperty(window, '__fixture', { configurable: true, get: () => state, set: value => { state = { ...value, sourceLeadCount: 26 }; } });
    }, theme);
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    const shot = async name => { const file = `${name}-${theme}-${viewport.width}.png`; await page.screenshot({ path: path.join(output, file) }); result.screenshots.push(file); };
    let currentCheck;
    const check = async (name, fn) => { currentCheck = name; await fn(); result.checks.push(name); };
    try {
      await page.goto(origin + '/lead-explorer' + scope + '&drill=awaiting-first-dial&segmentSource=synthetic-source');
      await page.getByRole('button', { name: `Open dossier for lead ${leadId}`, exact: true }).filter({ visible: true }).waitFor();
      await check('Canonical identity and lazy initial requests', async () => {
        assert.equal(await page.title(), 'Lead Evidence · ConversionX');
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.getByRole('tablist', { name: 'Lead Evidence modes' }).count(), 1);
        const values = await requests(page);
        assert.equal(count(values, '/raw-leads'), 1); assert.equal(count(values, 'source'), 0); assert.equal(count(values, '/lead-timeline/'), 0);
        assert.ok(await page.locator('.cx-lead-evidence-summary[data-compact=true]:visible').count() > 0);
        assert.equal(await page.locator('.cx-lead-evidence-summary[data-compact=true]:visible').first().locator('[data-evidence-stage]').count(), 6);
        await overflow(page);
      });
      await check('All presentation presets reuse rows; full table scrolls internally', async () => {
        const before = await requests(page);
        for (const preset of ['journey', 'contact', 'outcomes', 'full']) {
          await page.locator('.cx-record-view select').selectOption(preset);
          await page.waitForFunction(preset => new URL(location.href).searchParams.get('preset') === preset, preset);
          await settle(page); await overflow(page);
          assert.deepEqual(await requests(page), before);
        }
        await page.locator('.cx-investigation-table-wrap[data-preset=full] .cx-investigation-records[data-preset=full]').waitFor();
        assert.equal(await page.locator('.cx-investigation-records thead th').count(), 17);
        const scroll = page.locator('.cx-investigation-table-wrap[data-preset=full]');
        assert.equal(await scroll.evaluate(element => element.scrollWidth > element.clientWidth), true);
        await scroll.evaluate(element => { element.scrollLeft = element.scrollWidth; });
        await page.getByRole('button', { name: `Open dossier for lead ${leadId}`, exact: true }).click();
        await page.locator('.cx-lead-dossier').waitFor();
        await page.locator('.cx-record-view select').selectOption('investigation');
        assert.equal(await page.locator('.cx-lead-dossier').getAttribute('aria-label'), `Lead dossier for ${leadId}`);
      });
      await check('One dossier, six keyboard tabs, Audit adds no request', async () => {
        const dossier = page.locator('.cx-lead-dossier');
        assert.equal(await dossier.count(), 1);
        assert.deepEqual(await dossier.locator('[role=tab]').allTextContents(), ['Summary', 'Journey', 'Calls', 'Outcomes', 'Audit', 'Source']);
        await page.waitForFunction(() => window.__fixture.requests.some(value => value.includes('/lead-timeline/')));
        const before = await requests(page);
        await dossier.locator('.cx-dossier-body[data-section=summary]').scrollIntoViewIfNeeded();
        assert.equal(await dossier.locator('[data-evidence-stage]').count(), 6);
        assert.match(await dossier.locator('.cx-lead-evidence-summary').innerText(), /Recorded lifecycle.*Calls:.*Attempt-level timestamps/s);
        await settle(page); await shot('population-summary');
        await dossier.getByRole('tab', { name: 'Summary', exact: true }).focus(); await page.keyboard.press('ArrowRight');
        assert.equal(await dossier.locator('.cx-dossier-tabs').getByRole('tab', { name: 'Journey', exact: true }).evaluate(element => element === document.activeElement), true);
        assert.match(await dossier.innerText(), /attempt history|Individual synthetic call times/);
        await dossier.locator('.cx-journey-forensic-canvas:not([hidden])').scrollIntoViewIfNeeded();
        await settle(page); await shot('population-journey');
        await dossier.getByRole('tab', { name: 'Audit', exact: true }).click();
        assert.equal(await dossier.locator('.cx-evidence-trace').count(), 1);
        assert.deepEqual(await requests(page), before);
        await dossier.scrollIntoViewIfNeeded(); await settle(page);
        if (viewport.width >= 1180) {
          const geometry = await dossier.evaluate(element => ({ dossier: element.getBoundingClientRect().top, context: document.querySelector('.cx-investigation-context[data-compact=true]').getBoundingClientRect().bottom }));
          assert.ok(geometry.dossier >= geometry.context, `Dossier heading must remain below the sticky Investigation strip: ${JSON.stringify(geometry)}`);
        }
        await overflow(page); await shot('population-audit');
      });
      await check('Exact lazy source records and session-local source handoff', async () => {
        const dossier = page.locator('.cx-lead-dossier');
        await dossier.getByRole('tab', { name: 'Source', exact: true }).click();
        await dossier.locator('.cx-ledger-raw-record').first().waitFor({ state: 'attached' });
        await dossier.getByText('View all 63 raw source fields', { exact: true }).click();
        assert.equal(await dossier.locator('.cx-ledger-raw-record').count(), 2);
        const relationship = dossier.getByRole('region', { name: 'Source and analytical relationship', exact: true });
        assert.match(await relationship.innerText(), /2.*Source column availability.*1 exact analytical lead loaded.*Not verified/s);
        assert.equal(await dossier.locator('[data-raw-field]').count(), 126);
        const source = (await requests(page)).find(value => /\/lead-ledger\/replica\?/.test(value));
        const query = new URL(source, origin).searchParams;
        assert.equal(query.get('search'), leadId); assert.equal(JSON.parse(query.get('filters')).lead_id.value, leadId);
        await dossier.getByRole('button', { name: 'Open in Source Evidence', exact: true }).click();
        await page.waitForURL('**/*view=source*');
        await page.locator('.cx-source-evidence-master-detail .cx-ledger-raw-record').first().waitFor({ state: 'attached' });
        await page.locator('.cx-lead-dossier').getByText('View all 63 raw source fields', { exact: true }).click();
        assert.equal(page.url().includes(leadId), false);
        assert.equal(new URL(page.url()).searchParams.get('segmentSource'), 'synthetic-source');
        assert.equal(await page.locator('.cx-lead-dossier').count(), 1);
        assert.match(await page.locator('main').innerText(), /Unique leads.*Source rows/is);
        await page.locator('.cx-lead-dossier').scrollIntoViewIfNeeded(); await overflow(page); await shot('source-records');
      });
      await check('Distinct export preflight is request-free and closes with focus', async () => {
        const trigger = page.getByRole('button', { name: 'Export source-compatible data', exact: true });
        const before = await requests(page); await trigger.click();
        const dialog = page.getByRole('dialog'); await dialog.waitFor();
        assert.match(await dialog.innerText(), /separate single query snapshot.*Current page limits do not limit/s);
        assert.deepEqual(await requests(page), before); await overflow(page); await shot('source-export');
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
        assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
      });
      await check('Mode keyboard and history retain scoped identity without private URL state', async () => {
        const sourceTab = page.getByRole('tab', { name: 'Source Evidence', exact: true });
        await sourceTab.focus(); await page.keyboard.press('ArrowLeft');
        await page.waitForURL('**/*view=population*');
        await page.waitForFunction(() => document.activeElement?.getAttribute('data-view') === 'population' && document.activeElement?.getAttribute('aria-selected') === 'true');
        assert.equal(await page.getByRole('tab', { name: 'Population', exact: true }).evaluate(element => element === document.activeElement), true);
        await page.locator('.cx-lead-dossier').waitFor();
        await page.goBack(); await page.waitForURL('**/*view=source*');
        await page.goForward(); await page.waitForURL('**/*view=population*');
        assert.equal(page.url().includes(leadId), false); await overflow(page);
        await page.getByRole('button', { name: 'Close lead dossier', exact: true }).click();
        const trigger = page.getByRole('button', { name: `Open dossier for lead ${leadId}`, exact: true }).filter({ visible: true });
        await page.waitForFunction(() => !document.querySelector('.cx-lead-dossier') && document.activeElement?.getAttribute('data-lead-id') === 'SYNTHETIC-LEAD-0001-very-long-identity-for-responsive-checks' && document.activeElement.getClientRects().length > 0);
        assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
      });
      await check('Population export explicitly covers current returned page', async () => {
        const before = await requests(page); await page.getByRole('button', { name: 'Export current analytical page', exact: true }).click();
        const dialog = page.getByRole('dialog'); await dialog.waitFor();
        assert.match(await dialog.innerText(), /Current returned page.*Pagination limits still apply/s);
        assert.deepEqual(await requests(page), before); await page.keyboard.press('Escape');
      });
      await check('Permission revocation removes private evidence and further record reads', async () => {
        await page.getByRole('button', { name: `Open dossier for lead ${leadId}`, exact: true }).filter({ visible: true }).click();
        await page.locator('.cx-lead-dossier').waitFor();
        await page.evaluate(() => { window.__fixture.requests = []; window.__fixture.setAccess({ nonAdmin: true }); });
        await page.getByText('Record access is restricted to authorised administrators.', { exact: false }).waitFor();
        await settle(page);
        assert.equal(await page.locator('.cx-lead-dossier').count(), 0);
        assert.equal((await requests(page)).filter(value => /raw-leads|lead-timeline|lead-ledger/.test(value)).length, 0);
        await overflow(page);
      });
      assert.deepEqual(errors, []); result.passed = true;
      console.log(`PASS Lead Evidence ${theme} ${viewport.width}: ${result.checks.length} checks`);
    } catch (error) { result.failure = error.message; result.failedCheck = currentCheck; result.stack = error.stack; result.errors = errors; await shot('failure').catch(() => {}); console.error(`FAIL Lead Evidence ${theme} ${viewport.width} ${currentCheck}: ${error.stack}`); }
    finally { results.push(result); await context.close(); }
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await writeFile(path.join(output, 'results.json'), JSON.stringify({ synthetic: true, results }, null, 2)); }
if (results.some(result => !result.passed)) process.exitCode = 1;
console.log(`Evidence: ${output}`);
