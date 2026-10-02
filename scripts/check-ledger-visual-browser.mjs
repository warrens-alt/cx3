/** Synthetic ledger visual QA. Browser plugin unavailable; use an existing Playwright runtime. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildLedgerTimelineFixture } from './build-ledger-timeline-fixture.mjs';

const output = process.env.CX_BROWSER_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'cx3-ledger-visual-qa-'));
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), 'cx3-ledger-visual-app-'));
await buildLedgerTimelineFixture(fixture);
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
try {
  for (const theme of ['light', 'dark']) for (const viewport of viewports) {
    const result = { theme, viewport, passed: false, screenshots: [] };
    const context = await browser.newContext({ viewport, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', entry => { if (['error', 'warning'].includes(entry.type())) errors.push(entry.text()); });
    await page.addInitScript(theme => localStorage.setItem('cx-theme', theme), theme);
    const selectLead = async lead => {
      await page.locator('[aria-label="Analytical ledger records"] tbody button').filter({ hasText: new RegExp(`^${lead}$`) }).click();
      await page.locator('.cx-ledger-operational-inspector h2').filter({ hasText: new RegExp(`^${lead}$`) }).waitFor();
      await page.locator('.cx-ledger-journey').scrollIntoViewIfNeeded();
    };
    const screenshot = async state => { const name = `ledger-${state}-${theme}-${viewport.width}.png`; await page.screenshot({ path: path.join(output, name) }); result.screenshots.push(name); };
    try {
      await page.goto(`${origin}/lead-ledger?clientId=synthetic-a&startDate=2026-09-15&endDate=2026-09-30`);
      await page.getByRole('button', { name: 'Operational analysis', exact: false }).click();
      await selectLead('SYN-COMPLETE');
      assert.match(await page.title(), /Lead ledger/i);
      assert.equal(await page.locator('vite-error-overlay').count(), 0);
      assert.equal(await page.locator('.cx-journey-spine .cx-journey-node svg').count(), 6);
      assert.equal(await page.locator('.cx-journey-spine [data-certainty=observed]').count(), 3);
      assert.equal(await page.locator('.cx-journey-spine [data-certainty=unavailable]').count(), 3);
      const alignment = await page.locator('.cx-journey-spine').evaluate(spine => [...spine.querySelectorAll('.cx-journey-event')].map(event => ({
        time: event.querySelector('.cx-journey-time-column').getBoundingClientRect().x,
        node: event.querySelector('.cx-journey-node').getBoundingClientRect().x,
        copy: event.querySelector('.cx-journey-event-copy').getBoundingClientRect().x,
        y: event.getBoundingClientRect().y,
      })));
      assert.ok(alignment.every(row => row.time === alignment[0].time && row.node === alignment[0].node && row.copy === alignment[0].copy && row.time < row.node && row.node < row.copy), 'Dedicated time, spine, and evidence columns must align');
      assert.ok(alignment.slice(1).every((row, index) => row.y > alignment[index].y), 'Lifecycle rows must stay vertically ordered');
      const before = await page.evaluate(() => [...window.__fixture.requests]);
      const sale = page.locator('.cx-journey-spine button[data-stage=sale]');
      await sale.focus(); await page.keyboard.press('Enter');
      assert.equal(await sale.getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('.cx-journey-evidence').innerText(), /Timestamp unavailable/);
      assert.deepEqual(await page.evaluate(() => [...window.__fixture.requests]), before);
      await page.locator('.cx-journey-spine').scrollIntoViewIfNeeded();
      await screenshot('complete');
      await selectLead('SYN-REVERSED-TIME');
      const anomaly = page.locator('.cx-journey-spine button[data-stage=call]');
      assert.equal(await anomaly.getAttribute('data-anomaly'), 'true');
      assert.match(await anomaly.locator('.cx-journey-inline-anomaly').innerText(), /precedes delivered/);
      assert.equal(await anomaly.locator('time').getAttribute('datetime'), '2026-09-28T09:29:51.000Z');
      await anomaly.scrollIntoViewIfNeeded();
      await screenshot('anomaly');
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, main: document.querySelector('main')?.clientWidth, mainScroll: document.querySelector('main')?.scrollWidth }));
      assert.ok(geometry.page <= viewport.width + 1 && geometry.mainScroll <= geometry.main + 1, JSON.stringify(geometry));
      assert.deepEqual(errors, []);
      result.passed = true;
      console.log(`PASS ledger ${theme} ${viewport.width}: canonical nodes, keyboard selection, inline anomaly, no overflow`);
    } catch (error) { result.failure = error.message; result.errors = errors; await screenshot('failure').catch(() => {}); console.error(`FAIL ledger ${theme} ${viewport.width}: ${error.message}`); }
    finally { results.push(result); await context.close(); }
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); }
if (results.some(result => !result.passed)) process.exitCode = 1;
console.log(`Evidence: ${output}`);
