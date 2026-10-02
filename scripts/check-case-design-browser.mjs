/** Synthetic UI checks. Browser skill unavailable; use the existing Playwright installation. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildAcceptanceFixture } from './build-frontend-acceptance-fixture.mjs';
import { reductionPayloads } from '../tests/frontend/reductionFixtures.ts';

const output = process.env.CX_BROWSER_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'cx3-case-design-qa-'));
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), 'cx3-case-design-app-'));
await buildAcceptanceFixture(fixture);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
  const file = ['/fixture.js', '/fixture.css', '/application.css'].includes(pathname) ? pathname.slice(1) : 'index.html';
  try { response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); response.end(await readFile(path.join(fixture, file))); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.CX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CX_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CX_CHROMIUM_EXECUTABLE } : {}) });
const results = [];
const viewports = [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }];
const scope = '?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28&vendor=Vendor+A';
const exceptions = { validationStatus: 'NOT_VERIFIED', populationNote: 'Synthetic overlapping checks', comparison: { current: { startDate: '2026-09-28', endDate: '2026-09-28' }, previous: { startDate: '2026-09-27', endDate: '2026-09-27' }, days: 1 }, exceptions: [{ id: 'awaiting-first-dial', title: 'Awaiting first dial', count: 20, previousCount: 15, absoluteChange: 5, percentageChange: 100 / 3, severity: 'medium', description: 'Synthetic pending queue', byVendor: [{ name: 'Vendor A', count: 20 }], bySource: [{ name: 'Source A', count: 20 }] }] };
try {
  for (const theme of ['light', 'dark']) for (const viewport of viewports) {
    const result = { theme, viewport, passed: false, screenshots: [] };
    const context = await browser.newContext({ viewport, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', entry => { if (['error', 'warning'].includes(entry.type())) errors.push(entry.text()); });
    await page.addInitScript(({ theme, payloads }) => {
      localStorage.setItem('cx-theme', theme);
      let fixture;
      Object.defineProperty(window, '__fixture', { configurable: true, get: () => fixture, set: value => { fixture = value; fixture.payloads = { ...payloads, ...value.payloads }; } });
    }, { theme, payloads: { ...reductionPayloads, '/api/analytics/offernet/exceptions': exceptions } });
    const screenshot = async state => { const name = `${state}-${theme}-${viewport.width}.png`; await page.screenshot({ path: path.join(output, name) }); result.screenshots.push(name); };
    const overflow = async () => {
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, main: document.querySelector('main')?.clientWidth, mainScroll: document.querySelector('main')?.scrollWidth }));
      assert.ok(geometry.page <= viewport.width + 1 && geometry.mainScroll <= geometry.main + 1, JSON.stringify(geometry));
    };
    try {
      await page.goto(origin + '/investigate' + scope + '&drill=awaiting-first-dial&segmentSource=Source+A');
      await page.locator('.cx-driver-bar-select').waitFor();
      assert.match(await page.locator('[aria-label="Current case scope"]').innerText(), /Synthetic workspace.*2026-09-28.*Vendor A/s);
      assert.match(await page.locator('.cx-investigation-heading').innerText(), /20 affected leads/);
      assert.doesNotMatch(await page.locator('[aria-label="Investigation predicate and narrowing"]').innerText(), /20|15/);
      await page.locator('.cx-investigation-context').scrollIntoViewIfNeeded();
      await screenshot('case-scope');
      if (viewport.width === 1440) {
        await page.locator('#investigation-diagnose').evaluate(element => element.scrollIntoView({ block: 'start' }));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const sticky = await page.evaluate(() => {
          const header = document.querySelector('.cx-investigation-context').getBoundingClientRect();
          const scope = document.querySelector('.cx-scope-controls').getBoundingClientRect();
          const rail = document.querySelector('.cx-investigation-evidence-panel').getBoundingClientRect();
          return { headerTop: header.top, headerBottom: header.bottom, headerHeight: header.height, scopeBottom: scope.bottom, railTop: rail.top, windowY: scrollY, documentHeight: document.documentElement.scrollHeight, mainTop: document.querySelector('.cx-main').getBoundingClientRect().top, mainScroll: document.querySelector('.cx-main').scrollTop };
        });
        assert.ok(sticky.headerHeight <= 170, 'The persistent case header must remain compact: ' + JSON.stringify(sticky));
        assert.equal(sticky.windowY, 0, 'Workflow scrolling must stay within the main report, preserving the shell: ' + JSON.stringify(sticky));
        assert.ok(sticky.headerTop >= sticky.scopeBottom - 2, 'Case identity must not overlap applied scope: ' + JSON.stringify(sticky));
        assert.ok(sticky.railTop >= sticky.headerBottom - 2, 'Evidence must not hide behind case identity: ' + JSON.stringify(sticky));
        result.sticky = sticky;
        await screenshot('case-sticky');
      }
      const before = await page.evaluate(() => [...window.__fixture.requests]);
      const beforeUrl = page.url();
      const select = page.getByRole('button', { name: 'Highlight Vendor A evidence', exact: true });
      await select.focus(); await page.keyboard.press('Enter');
      assert.equal(await select.getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('.cx-driver-table [data-selected=true]').innerText(), /Vendor A.*20/s);
      const focus = page.locator('.cx-driver-analysis .cx-chart-focus-toggle');
      await focus.click();
      await page.getByRole('dialog', { name: 'Awaiting first dial' }).waitFor();
      assert.match(await page.locator('.cx-chart-focus-scope').innerText(), /Synthetic workspace A.*Vendor A/s);
      assert.match(await page.locator('.cx-chart-focus-scope').innerText(), /Investigation: Awaiting first dial.*Source: Source A/s);
      assert.equal(await select.getAttribute('aria-pressed'), 'true');
      await screenshot('case-focus');
      await page.keyboard.press('Escape');
      assert.equal(await focus.evaluate(element => element === document.activeElement), true);
      assert.deepEqual(await page.evaluate(() => [...window.__fixture.requests]), before);
      assert.equal(page.url(), beforeUrl);
      await overflow();
      await page.goto(origin + '/data-integrity' + scope);
      await page.locator('.cx-source-observability:visible .cx-evidence-matrix tbody tr').first().waitFor();
      const gap = page.locator('.cx-source-observability:visible .cx-evidence-matrix tbody tr').filter({ hasText: 'Synthetic calls' });
      assert.equal(await gap.locator('td[data-state=unavailable]').count(), 3);
      assert.equal(await gap.locator('td[data-state=issue]').count(), 0);
      await page.locator('.cx-source-observability:visible').scrollIntoViewIfNeeded();
      await screenshot('source-observability');
      const sourceBefore = await page.evaluate(() => [...window.__fixture.requests]);
      await page.getByRole('button', { name: 'Focus: Source evidence at a glance', exact: true }).click();
      await page.getByRole('dialog', { name: 'Source evidence at a glance', exact: true }).waitFor();
      assert.match(await page.locator('.cx-chart-focus-scope').innerText(), /independent of the selected capture cohort/);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Inspect Synthetic check 14: Unavailable', exact: true }).click();
      assert.match(await page.locator('[aria-label="Selected check evidence"]:visible').innerText(), /Synthetic check 14.*Unavailable/s);
      assert.deepEqual(await page.evaluate(() => [...window.__fixture.requests]), sourceBefore);
      await page.locator('#integrity-comparison:visible').scrollIntoViewIfNeeded();
      await screenshot('discrepancy-selection');
      await overflow();
      assert.deepEqual(errors, []);
      result.passed = true;
      console.log(`PASS case evidence ${theme} ${viewport.width}: scope, request-free focus/selection, neutral contracts, no overflow`);
    } catch (error) { result.failure = error.message; result.errors = errors; await screenshot('failure').catch(() => {}); console.error(`FAIL case evidence ${theme} ${viewport.width}: ${error.message}`); }
    finally { results.push(result); await context.close(); }
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); }
if (results.some(result => !result.passed)) process.exitCode = 1;
console.log(`Evidence: ${output}`);
