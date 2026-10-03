/** Synthetic visual audit acceptance. Browser plugin unavailable; uses an existing Playwright runtime. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { buildAcceptanceFixture } from './build-frontend-acceptance-fixture.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.CX_BROWSER_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'cx3-audit-evidence-')));
assert.ok(!output.startsWith(root + path.sep), 'Evidence must remain outside the repository.');
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), 'cx3-audit-app-'));
await buildAcceptanceFixture(fixture);
const metadata = path.join(fixture, 'payloads.mjs');
await build({ stdin: { contents: `export {reductionPayloads} from './tests/frontend/reductionFixtures'; export {convergencePayloads} from './tests/frontend/convergenceFixtures';`, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: metadata });
const { reductionPayloads, convergencePayloads } = await import(pathToFileURL(metadata).href);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
  const file = pathname === '/brand/conversionx-grey.png' ? 'conversionx-grey.png' : ['/fixture.js', '/fixture.css', '/application.css'].includes(pathname) ? pathname.slice(1) : 'index.html';
  try { response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html'); response.end(await readFile(path.join(fixture, file))); } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.CX_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CX_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CX_CHROMIUM_EXECUTABLE } : {}) });
const scope = '?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28&vendor=Synthetic+vendor';
const results = [];
const requests = page => page.evaluate(() => [...window.__fixture.requests]);
function assertVendorScope(params) { const filters=JSON.parse(params.get('filters') || '{}'); assert.ok(params.get('vendor') === 'Synthetic vendor' || filters.vendor?.value === 'Synthetic vendor' || filters.vendor?.values?.includes('Synthetic vendor')); }
const countRaw = values => values.filter(url => url.includes('/raw-leads')).length;
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function overflow(page) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, drawer: document.querySelector('.cx-audit-drawer')?.clientWidth, drawerScroll: document.querySelector('.cx-audit-drawer')?.scrollWidth }));
  assert.ok(dimensions.document <= dimensions.viewport + 1, `Document overflow ${JSON.stringify(dimensions)}`);
  if (dimensions.drawer) assert.ok(dimensions.drawerScroll <= dimensions.drawer + 1, `Drawer overflow ${JSON.stringify(dimensions)}`);
}
async function openAudit(page, trigger, verify, screenshotName) {
  const before = await requests(page);
  await trigger.focus();
  await trigger.click();
  const panel = page.getByRole('dialog');
  await panel.waitFor();
  await settle(page);
  assert.deepEqual(await requests(page), before, 'Opening audit must not fetch');
  await verify(panel);
  await overflow(page);
  const visibility = await panel.evaluate(element => {
    const box = element.getBoundingClientRect();
    return [0.2, 0.5, 0.75].map(fraction => {
      const x = box.left + box.width / 2, y = box.top + box.height * fraction;
      const hit = document.elementFromPoint(x, y);
      return { fraction, visible: element.contains(hit), obstructingElement: hit?.className };
    });
  });
  assert.ok(visibility.every(point => point.visible), `Audit drawer must remain above sticky workspace layers: ${JSON.stringify(visibility)}`);
  assert.equal(await panel.evaluate(element => element.contains(document.activeElement)), true, 'Focus enters panel');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await panel.evaluate(element => element.contains(document.activeElement)), true, 'Keyboard focus stays inside');
  await page.screenshot({ path: path.join(output, screenshotName + '.png') });
  if (await panel.locator('.cx-evidence-trace').count()) { await panel.locator('.cx-evidence-trace').scrollIntoViewIfNeeded(); await page.screenshot({path:path.join(output,screenshotName+'-trace.png')}); }
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'Focus returns to metric');
  assert.deepEqual(await requests(page), before, 'Closing audit must not fetch');
}
try {
  for (const theme of ['light', 'dark']) for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }, { width: 320, height: 844 }]) {
    const context = await browser.newContext({ viewport, colorScheme: theme });
    await context.addInitScript(({ theme, payloads }) => {
      localStorage.setItem('cx-theme', theme); localStorage.setItem('cx.presentation.audit-mode.v1', 'on');
      Object.defineProperty(window, '__fixture', { configurable: true, get() { return this.__auditFixture; }, set(value) { this.__auditFixture = { ...value, payloads, auditContent: { type:'custom', title:'Synthetic audit state fixture', value:0, showAnatomy:false, scope:{clientId:'synthetic-a',startDate:'2026-09-28',endDate:'2026-09-28',filters:{}}, dimensions:['observed','mapped','scoped','partial','mismatch','not_verified','unavailable'].map(state=>({key:state,label:state.replaceAll('_',' '),state,detail:'Synthetic state rendering only; not production evidence.'})), trace:[{key:'source',type:'source',label:'Synthetic source',value:null,state:'unavailable'},{key:'display',type:'display',label:'Synthetic output',value:0,state:'observed'}] } };  } });
    }, { theme, payloads: { ...convergencePayloads, ...reductionPayloads, '/api/analytics/offernet/exceptions': { exceptions: [{id:'awaiting-first-dial',title:'Awaiting first dial',count:20,previousCount:15,absoluteChange:5,percentageChange:100/3,severity:'medium',description:'Synthetic pending queue',byVendor:[{name:'Synthetic vendor',count:20}],bySource:[{name:'synthetic-source',count:20}]}], validationStatus:'NOT_VERIFIED',populationNote:'Synthetic overlapping checks',comparison:{current:{startDate:'2026-09-28',endDate:'2026-09-28'},previous:{startDate:'2026-09-27',endDate:'2026-09-27'},days:1} } } });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const visit = async (route, extra = '') => {
      await page.goto(origin + route + scope + extra); await page.locator('main h1').waitFor(); await page.waitForLoadState('networkidle'); await settle(page);
      assert.match(await page.title(), / · ConversionX$/); assert.equal(new URL(page.url()).pathname, route); assert.equal(await page.locator('html').getAttribute('data-theme'), theme); assert.ok((await page.locator('main').innerText()).length > 30); assert.equal(await page.locator('vite-error-overlay').count(), 0); await overflow(page);
    };
    const run = async (name, task) => {
      const result = { name, theme, viewport, passed: false };
      try { await task(); assert.deepEqual(errors, []); result.passed = true; console.log(`PASS ${name} ${theme} ${viewport.width}`); }
      catch (error) { result.failure = error.message; result.errors = [...errors]; await page.screenshot({ path: path.join(output, `${name}-${theme}-${viewport.width}-failure.png`) }).catch(() => {}); console.error(`FAIL ${name} ${theme} ${viewport.width}: ${error.message}`); }
      results.push(result);
    };
    const shot = name => `${name}-${theme}-${viewport.width}`;
    await run('overview-metric', async () => {
      await visit('/overview');
      await openAudit(page, page.locator('.cx-outcome-card .cx-audit-evidence-control').first(), async panel => { assert.match(await panel.innerText(), /Metric anatomy.*Evidence trace/s); assert.match(await panel.innerText(), /Independent reconciliation.*Not verified/s); }, shot('overview-metric'));
      const before = await requests(page); await page.getByRole('button', { name: 'Display preferences', exact: true }).click(); await page.getByRole('button', { name: 'Off', exact: true }).click(); await page.getByRole('button', { name: 'On', exact: true }).click(); await page.keyboard.press('Escape'); assert.deepEqual(await requests(page), before); assert.equal(await page.evaluate(() => localStorage.getItem('cx.presentation.audit-mode.v1')), 'on');
      const trigger = page.locator('.cx-outcome-card .cx-audit-evidence-control').first(); await trigger.click(); const previewBefore = await requests(page); await page.getByRole('button', { name: 'Load supporting preview', exact: true }).click(); await page.getByRole('region', { name: 'Supporting record preview', exact: true }).waitFor(); const previewAfter = await requests(page); assert.equal(countRaw(previewAfter), countRaw(previewBefore) + 1); const query = new URL(previewAfter.findLast(url => url.includes('/raw-leads')), origin).searchParams; assert.equal(query.get('limit'), '10'); assert.equal(query.get('clientId'), 'synthetic-a'); assert.equal(query.get('startDate'), '2026-09-28'); assert.equal(query.get('endDate'), '2026-09-28'); assertVendorScope(query); assert.equal(query.get('drill'), 'funnel-stage'); assert.equal(query.get('drillValue'), 'fetched'); assert.match(await page.getByRole('region', { name: 'Supporting record preview', exact: true }).innerText(), /•••/); await page.keyboard.press('Escape');
    });
    await run('journey-lens', async () => {
      await visit('/funnel'); const before = await requests(page); await page.getByRole('button', { name: 'Audit evidence', exact: true }).first().click(); await page.locator('.cx-journey-audit-lens').waitFor(); assert.deepEqual(await requests(page), before); assert.match(await page.locator('.cx-journey-audit-lens').innerText(), /Not verified/); await page.screenshot({ path: path.join(output, shot('journey-lens') + '.png') }); await openAudit(page, page.locator('.cx-journey-audit-lens .cx-audit-evidence-control').first(), async panel => { assert.match(await panel.innerText(), /Evidence state/); }, shot('journey-panel'));
    });
    await run('response-speed-ratio', async () => {
      await visit('/speed-to-lead'); await page.getByText('View exact latency cohort evidence', { exact: true }).click(); const trigger = page.getByRole('button', { name: /Audit evidence:.*RPC/ }).first(); await openAudit(page, trigger, async panel => { assert.match(await panel.innerText(), /Denominator unavailable/); }, shot('speed-ratio'));
    });
    await run('sales-evidence', async () => {
      await visit('/sales-activation'); await openAudit(page, page.locator('.cx-audit-evidence-control').first(), async panel => { assert.match(await panel.innerText(), /Metric anatomy/); }, shot('sales-evidence'));
    });
    await run('commercial-bridge', async () => {
      await visit('/commercial'); await openAudit(page, page.getByRole('button', { name: 'Audit evidence: Observed media spend', exact: true }), async panel => { assert.match(await panel.innerText(), /synthetic_observed_spend/); assert.match(await panel.innerText(), /Delivery consistency/); }, shot('commercial-bridge'));
      await openAudit(page, page.getByRole('button', { name: 'Audit evidence: Contribution / profit', exact: true }), async panel => { assert.match(await panel.innerText(), /required inputs available/i); assert.match(await panel.innerText(), /Telephony cost.*Unavailable/s); }, shot('commercial-inputs'));
    });
    await run('data-confidence-hub', async () => {
      await visit('/data-integrity'); const before = await requests(page); await page.getByRole('tab', { name: 'Metric evidence', exact: true }).click(); await page.getByRole('region', { name: 'Metric audit dimensions', exact: true }).waitFor(); assert.deepEqual(await requests(page), before); await openAudit(page, page.locator('.cx-metric-audit-hub:visible button').filter({hasText:'Audit evidence'}).first(), async panel => { assert.match(await panel.innerText(), /No value for this metric/); assert.match(await panel.innerText(), /Not verified/); }, shot('confidence-metric'));
      await page.getByRole('tab', { name: 'Source evidence', exact: true }).click(); await page.screenshot({ path: path.join(output, shot('confidence-source') + '.png') }); await overflow(page);
    });
    await run('investigation-pinned', async () => {
      await visit('/investigate', '&drill=awaiting-first-dial&segmentSource=synthetic-source'); await page.getByRole('button', { name: 'Pin evidence', exact: true }).click(); const tray = page.locator('#investigation-evidence-tray:visible'); if (await tray.getAttribute('open') === null) await tray.locator('summary').first().click(); await openAudit(page, tray.locator('.cx-audit-evidence-control:visible').first(), async panel => { const link = panel.getByRole('link', { name: /Inspect supporting records/ }); const params = new URL(await link.getAttribute('href'), origin).searchParams; assert.equal(params.get('drill'), 'awaiting-first-dial'); assert.equal(params.get('segmentSource'), 'synthetic-source'); assertVendorScope(params); }, shot('pinned-audit'));
    });
    await run('ledger-record', async () => {
      await visit('/lead-explorer', '&view=population'); await page.getByRole('button', { name: /Open dossier for lead/ }).filter({ visible: true }).first().click(); await page.getByRole('tab', { name: 'Timeline', exact: true }).click(); const event = page.locator('.cx-journey-event').first(); await event.click(); await openAudit(page, page.locator('.cx-journey-evidence .cx-audit-evidence-control'), async panel => { assert.match(await panel.innerText(), /already loaded evidence/); assert.equal(await panel.locator('.cx-metric-anatomy').count(), 0); assert.equal(await panel.getByRole('button', { name: 'Load supporting preview', exact: true }).count(), 0); }, shot('ledger-record'));
    });
    await run('audit-state-visuals', async () => { await page.goto(origin + '/__fixture/audit' + scope); const panel=page.getByRole('dialog'); await panel.waitFor(); await settle(page); assert.equal(await page.locator('html').getAttribute('data-theme'), theme); for (const state of ['observed','mapped','scoped','partial','mismatch','not_verified','unavailable']) assert.ok(await panel.locator(`.cx-audit-dimensions > li[data-state="${state}"]`).count() >= 1, `Missing visible audit state: ${state}`); await overflow(page); await page.screenshot({path:path.join(output,shot('audit-state-visuals')+'.png')}); });
    await context.close();
  }
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme });
    await context.addInitScript(theme => { localStorage.setItem('cx-theme', theme); Object.defineProperty(window, '__fixture', { configurable: true, get() { return this.__auditFixture; }, set(value) { this.__auditFixture = { ...value, nonAdmin: true }; } }); }, theme);
    const page = await context.newPage(); page.setDefaultTimeout(8000); const result = { name: 'viewer-record-gate', theme, passed: false };
    try { await page.goto(origin + '/overview' + scope); await page.locator('.cx-outcome-card .cx-audit-evidence-control').first().click(); const before = await requests(page); assert.equal(await page.getByRole('button', { name: 'Load supporting preview', exact: true }).count(), 0); assert.equal(await page.getByRole('link', { name: /Inspect supporting records/ }).count(), 0); assert.match(await page.getByRole('dialog').innerText(), /administrator access/); assert.deepEqual(await requests(page), before); result.passed = true; } catch (error) { result.failure = error.message; } results.push(result); await context.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, synthetic: true, results }, null, 2)); }
if (results.some(result => !result.passed)) process.exitCode = 1;
console.log(`Audit acceptance: ${results.filter(result => result.passed).length}/${results.length}; evidence ${output}`);
