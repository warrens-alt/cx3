/** Synthetic browser regression. Optional Playwright runtime; no live services or credentials. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildAcceptanceFixture } from './build-frontend-acceptance-fixture.mjs';

const { chromium } = await import(process.env.CX_PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.CX_BROWSER_QA_OUTPUT || await mkdtemp(path.join(tmpdir(), 'cx3-investigation-qa-'));
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(path.join(tmpdir(), 'cx3-investigation-app-'));
await buildAcceptanceFixture(fixture);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = pathname === '/brand/conversionx-grey.png' ? 'conversionx-grey.png' : ['/fixture.js', '/fixture.css', '/application.css'].includes(pathname) ? pathname.slice(1) : 'index.html';
  try {
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    response.end(await readFile(path.join(fixture, file)));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CX_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CX_CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
const page = await context.newPage();
const errors = [], messages = [], checks = [], screenshots = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', entry => { if (['error', 'warning'].includes(entry.type())) messages.push(entry.text()); });
const scope = '?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28';
const exception = { id: 'awaiting-first-dial', title: 'Awaiting first dial', count: 20, previousCount: 15, absoluteChange: 5, percentageChange: 100 / 3, severity: 'medium', description: 'Synthetic pending queue', byVendor: [{ name: 'Synthetic vendor', count: 20 }], bySource: [{ name: 'synthetic-source', count: 20 }] };
await page.addInitScript(({ exception }) => {
  let fixture;
  const defaults = { payloads: { '/api/analytics/offernet/exceptions': { exceptions: [exception], validationStatus: 'NOT_VERIFIED', populationNote: 'Synthetic overlapping checks', comparison: { current: { startDate: '2026-09-28', endDate: '2026-09-28' }, previous: { startDate: '2026-09-27', endDate: '2026-09-27' }, days: 1 } } } };
  Object.defineProperty(window, '__fixture', { configurable: true, get: () => fixture, set: value => { fixture = value; fixture.payloads = { ...defaults.payloads, ...value.payloads }; } });
}, { exception });
const text = () => page.locator('body').innerText();
const waitText = value => page.getByText(value, { exact: false }).first().waitFor();
const step = name => page.locator(`nav[aria-label="Investigation workflow"] [data-stage="${name}"]`);
const stageDescription = name => step(name).evaluate(element => document.getElementById(element.getAttribute('aria-describedby'))?.textContent || '');
const waitStage = (name, value) => page.waitForFunction(({ name, value }) => document.querySelector(`[data-stage="${name}"]`)?.textContent.includes(value), { name, value });
const check = async (name, action) => { await action(); checks.push({ name, passed: true }); console.log(`PASS: ${name}`); };
const visit = async (url = '/investigate' + scope + '&drill=awaiting-first-dial') => { await page.goto(origin + url); await page.getByRole('navigation', { name: 'Investigation workflow', exact: true }).waitFor(); };
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
let failure;
try {
  await check('Page identity, meaningful screen and six accessible stages', async () => {
    await visit(); assert.equal(await page.title(), 'Investigation inbox · ConversionX');
    await waitStage('signal', 'Current 20'); assert.equal(await page.locator('[data-stage]').count(), 6);
    assert.match(await text(), /NOT_VERIFIED/); assert.equal(await step('diagnose').getAttribute('aria-current'), 'step');
    assert.equal(await page.locator('vite-error-overlay').count(), 0);
  });
  await check('Active analysis has one queue request and no unused overview/control request', async () => {
    const requests = await page.evaluate(() => window.__fixture.requests);
    assert.equal(requests.filter(url => url.includes('/offernet/exceptions')).length, 1);
    assert.equal(requests.filter(url => /\/offernet\/(overview|operating-controls)/.test(url)).length, 0);
  });
  await check('Overview anomalies and changes enter Investigation with exact scope and no selected identity', async () => {
    const scoped = scope + '&vendor=Synthetic%20vendor&source=synthetic-source&selectedLeadId=PRIVATE-SELECTED';
    await page.goto(origin + '/overview' + scoped);
    await page.getByRole('link', { name: 'Investigate Awaiting first dial: 20 affected leads', exact: true }).click();
    await waitStage('signal', 'Current 20');
    let query = new URL(page.url()).searchParams;
    assert.equal(new URL(page.url()).pathname, '/investigate');
    assert.equal(query.get('drill'), 'awaiting-first-dial');
    assert.equal(query.get('vendor'), 'Synthetic vendor');
    assert.equal(query.get('source'), 'synthetic-source');
    assert.equal(query.has('selectedLeadId'), false);
    assert.equal((await page.evaluate(() => window.__fixture.requests)).some(url => url.includes('raw-leads')), false);
    await page.goto(origin + '/overview' + scoped);
    await page.getByRole('heading', { name: 'What changed?', exact: true }).waitFor();
    await page.evaluate(async () => {
      const data = window.__fixture.payloads['/api/analytics/offernet/overview'];
      data.comparison = { fetchedDelta: 20, deliveryRateDelta: null, dialRateDelta: null, contactRateDelta: null, saleRateDelta: null, activationRateDelta: null };
      data.comparisonWindow = { startDate: '2026-09-27', endDate: '2026-09-27' };
      await window.__fixture.refresh();
    });
    await page.getByRole('button', { name: 'Investigate Lead volume change: +20%', exact: true }).click();
    await waitStage('signal', 'Current 120');
    query = new URL(page.url()).searchParams;
    assert.equal(new URL(page.url()).pathname, '/investigate');
    assert.equal(query.get('investigationMetric'), 'fetchedLeads');
    assert.equal(query.get('clientId'), 'synthetic-a');
    assert.equal(query.get('startDate'), '2026-09-28');
    assert.equal(query.get('endDate'), '2026-09-28');
    assert.equal(query.get('vendor'), 'Synthetic vendor');
    assert.equal(query.get('source'), 'synthetic-source');
    assert.equal(query.has('selectedLeadId'), false);
    assert.equal(await page.getByRole('dialog').count(), 0);
    await visit(); await waitStage('signal', 'Current 20');
  });
  await check('Narrowing and browser back/forward retain predicate and reporting scope', async () => {
    await page.locator('[aria-label="Vendor exact breakdown"] a').first().click();
    await page.getByRole('button', { name: /Open dossier for lead/ }).first().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('segmentVendor'), 'Synthetic vendor');
    assert.equal(new URL(page.url()).searchParams.get('drill'), 'awaiting-first-dial');
    assert.match(await stageDescription('segment'), /Synthetic vendor/);
    await page.goBack(); await waitStage('signal', 'Current 20'); assert.equal(new URL(page.url()).searchParams.has('segmentVendor'), false);
    await page.goForward(); await page.getByRole('button', { name: /Open dossier for lead/ }).first().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('segmentVendor'), 'Synthetic vendor');
  });
  await check('Record dossier stays session-only and returns keyboard focus', async () => {
    const trigger = page.getByRole('button', { name: /Open dossier for lead/ }).first();
    await trigger.click(); await page.getByRole('complementary', { name: /Lead dossier for/ }).waitFor();
    assert.match(await stageDescription('records'), /Lead dossier open/);
    assert.equal(new URL(page.url()).searchParams.has('leadId'), false);
    for (const tab of ['Journey', 'Calls', 'Outcomes', 'Audit', 'Source', 'Summary']) await page.getByRole('tab', { name: tab, exact: true }).click();
    await page.getByRole('button', { name: 'Close lead dossier' }).click();
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  });
  await check('Pinned evidence retains its observed scope; conclusion is independent of validation', async () => {
    await page.getByRole('button', { name: /Open dossier for lead/ }).first().click();
    await page.getByRole('button', { name: 'Pin lead evidence', exact: true }).click();
    await step('conclusion').click(); await page.getByLabel('Analyst conclusion · not validation').fill('Synthetic analyst note: further evidence required.');
    await page.getByLabel('What remains unknown?').fill('Call evidence unavailable.');
    assert.match(await stageDescription('conclusion'), /Analyst note exists.*open questions recorded/s);
    assert.match(await stageDescription('evidence'), /1 session observation pinned.*NOT_VERIFIED/s);
    assert.match(await page.locator('.cx-investigation-tray').innerText(), /Synthetic vendor/);
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export pinned evidence' }).click();
    const csv = await readFile(await (await download).path(), 'utf8'); assert.match(csv, /NOT_VERIFIED/); assert.match(csv, /Synthetic analyst note/);
  });
  await check('Responsive 1440/820/390 layouts in light/dark themes have no document overflow', async () => {
    for (const theme of ['light', 'dark']) for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: width === 820 ? 1180 : width === 390 ? 844 : 1000 });
      await page.evaluate(theme => { localStorage.setItem('cx-theme', theme); document.documentElement.dataset.theme = theme; document.documentElement.classList.toggle('dark', theme === 'dark'); }, theme);
      await page.locator('[aria-label="Investigation context"]').scrollIntoViewIfNeeded(); await settle();
      const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, main: document.querySelector('main')?.clientWidth, mainScroll: document.querySelector('main')?.scrollWidth }));
      assert.ok(sizes.document <= width + 1, JSON.stringify(sizes)); assert.ok(sizes.mainScroll <= sizes.main + 1, JSON.stringify(sizes));
      const name = `workflow-${theme}-${width}.png`; await page.screenshot({ path: path.join(output, name) }); screenshots.push(name);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await check('Record search retains exact query and clear population removes dependent narrowing', async () => {
    await page.getByRole('button', { name: 'Close lead dossier' }).click();
    await page.getByPlaceholder('Lead ID, consumer ID, vendor, source or disposition').fill('SYNTHETIC-CONSUMER');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await waitStage('records', '1 matching leads'); assert.equal(new URL(page.url()).searchParams.get('search'), 'SYNTHETIC-CONSUMER');
    await page.locator('.cx-investigation-definition > summary').click();
    await page.getByRole('button', { name: 'Clear investigation', exact: true }).click();
    const params = new URL(page.url()).searchParams;
    assert.equal(params.has('drill'), false); assert.equal(params.has('segmentVendor'), false); assert.equal(params.get('clientId'), 'synthetic-a');
  });
  await check('Role change clears dossier, evidence and disables record requests', async () => {
    await visit('/lead-explorer' + scope + '&drill=awaiting-first-dial');
    await page.getByRole('button', { name: /Open dossier for lead/ }).first().click();
    await page.getByRole('button', { name: 'Pin lead evidence', exact: true }).click();
    await page.evaluate(() => { window.__fixture.requests = []; window.__fixture.setAccess({ nonAdmin: true }); });
    await waitText('Record access is restricted to authorised administrators');
    assert.equal(await page.getByRole('complementary', { name: /Lead dossier for/ }).count(), 0);
    assert.equal((await page.evaluate(() => window.__fixture.requests)).filter(url => /raw-leads|lead-timeline|source-observability/.test(url)).length, 0);
    await page.evaluate(() => window.__fixture.setAccess({ nonAdmin: false }));
    await page.getByRole('button', { name: /Open dossier for lead/ }).first().waitFor();
    assert.equal(await page.getByRole('complementary', { name: /Lead dossier for/ }).count(), 0);
    assert.match(await stageDescription('evidence'), /0 session observations/);
  });
  await check('Workspace switch clears local selection and pinned evidence', async () => {
    await page.getByRole('button', { name: /Open dossier for lead/ }).first().click();
    await page.getByRole('button', { name: 'Pin lead evidence', exact: true }).click();
    await page.evaluate(scope => window.__fixture.navigate('/lead-explorer' + scope.replace('synthetic-a', 'synthetic-b')), scope);
    await page.waitForURL('**/*clientId=synthetic-b*'); await waitStage('evidence', '0 session observations');
    assert.equal(await page.getByRole('complementary', { name: /Lead dossier for/ }).count(), 0);
  });
  await check('Empty and failed record populations remain distinct from zero and unavailable source evidence', async () => {
    await page.evaluate(() => { window.__fixture.payloads['/api/analytics/offernet/raw-leads'] = { rows: [], totalCount: 0, limit: 50, offset: 0, validationStatus: 'NOT_VERIFIED' }; window.__fixture.navigate('/lead-explorer?clientId=synthetic-a&source=Empty'); });
    await waitText('No matching records'); assert.match(await stageDescription('records'), /No matching records/);
    await page.evaluate(() => { window.__fixture.fail = ['raw-leads']; window.__fixture.navigate('/lead-explorer?clientId=synthetic-a&source=Failed'); });
    await waitText('Record evidence unavailable'); assert.match(await text(), /Synthetic request failure/);
  });
  await check('Reference validation is non-certified onscreen and in downloaded CSV', async () => {
    await page.goto(origin + '/validation' + scope); await waitText('Historical reference');
    assert.match(await text(), /NOT_VERIFIED|Not verified/); assert.doesNotMatch(await text(), /2026.*[Vv]erified/);
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: /Export reference matrix/ }).click();
    const csv = await readFile(await (await download).path(), 'utf8'); assert.match(csv, /NOT_VERIFIED/); assert.match(csv, /HISTORICAL_REFERENCE/);
  });
  await check('Legacy route is absent and does not issue legacy API requests', async () => {
    await page.goto(origin + '/lead-engine' + scope); await page.getByRole('heading', { name: 'Page not found' }).waitFor();
    assert.equal((await page.evaluate(() => window.__fixture.requests)).filter(url => url.includes('lead-engine')).length, 0);
  });
  await check('Saved storage unconfigured is a neutral deployment state', async () => {
    await visit();
    await page.evaluate(() => { const original = window.fetch; window.fetch = async (url, init) => String(url).includes('/api/saved-analyses') ? new Response(JSON.stringify({ success: true, data: { configured: false, definitions: [], limit: 100 } }), { headers: { 'content-type': 'application/json' } }) : original(url, init); });
    await page.getByText('Saved investigations', { exact: true }).click(); await waitText('not configured for this deployment');
    assert.equal(await page.locator('.cx-saved-investigations [role="alert"]').count(), 0);
  });
  await check('Saved definition create/reopen/rename/conflict/delete preserves exact private definition scope', async () => {
    await visit('/investigate' + scope + '&drill=awaiting-first-dial&segmentSource=Saved-source');
    await page.evaluate(() => {
      const original = window.fetch; window.__savedQa = { definitions: [], requests: [], conflict: false };
      window.fetch = async (url, init = {}) => {
        if (!String(url).includes('/api/saved-analyses')) return original(url, init);
        const state = window.__savedQa, method = init.method || 'GET', parsed = new URL(String(url), location.origin), body = init.body ? JSON.parse(init.body) : null;
        state.requests.push({ method, body });
        let data, status = 200;
        if (method === 'GET') data = { configured: true, definitions: state.definitions, limit: 100 };
        else if (state.conflict) { status = 409; data = 'The saved investigation changed. Reload the latest revision.'; }
        else if (method === 'POST') { data = { ...body.definition, id: 'synthetic-saved', ownerSubject: 'synthetic-user', revision: 1, createdAt: '2026-10-02T08:00:00.000Z', updatedAt: '2026-10-02T08:00:00.000Z' }; state.definitions = [data]; }
        else if (method === 'PUT') { data = { ...state.definitions[0], ...body.definition, revision: body.revision + 1, updatedAt: '2026-10-02T09:00:00.000Z' }; state.definitions = [data]; }
        else { if (Number(parsed.searchParams.get('revision')) !== state.definitions[0].revision) throw new Error('Incorrect delete revision'); state.definitions = []; data = { deleted: true }; }
        return new Response(JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: data }), { status, headers: { 'content-type': 'application/json' } });
      };
    });
    await page.getByText('Saved investigations', { exact: true }).click(); await waitText('No saved investigations');
    await page.getByLabel('Investigation name', { exact: true }).fill('Synthetic follow-up'); await page.getByRole('button', { name: 'Save investigation', exact: true }).click();
    await page.getByRole('button', { name: 'Open Synthetic follow-up' }).waitFor();
    const draft = await page.evaluate(() => window.__savedQa.definitions[0]); assert.equal(draft.investigation.segmentSource, 'Saved-source');
    for (const key of ['leadId', 'records', 'search', 'notes', 'conclusion', 'pins', 'resultCount']) assert.equal(Object.hasOwn(draft, key), false);
    await page.getByRole('button', { name: 'Open Synthetic follow-up' }).click(); assert.equal(new URL(page.url()).searchParams.get('segmentSource'), 'Saved-source');
    await page.getByRole('button', { name: 'Rename Synthetic follow-up' }).click(); await page.getByLabel('New investigation name').fill('Renamed follow-up'); await page.getByRole('button', { name: 'Save name', exact: true }).click(); await page.getByRole('button', { name: 'Open Renamed follow-up' }).waitFor();
    await page.evaluate(() => { window.__savedQa.conflict = true; }); await page.getByRole('button', { name: 'Delete Renamed follow-up' }).click(); await waitText('Reload the latest revision');
    assert.equal(await page.getByRole('button', { name: 'Open Renamed follow-up' }).count(), 1);
    await page.evaluate(() => { window.__savedQa.conflict = false; }); await page.getByRole('button', { name: 'Refresh saved list' }).click(); await page.getByRole('button', { name: 'Delete Renamed follow-up' }).click(); await waitText('No saved investigations');
  });
  await check('Current-view refresh updates the active driver once and keeps inactive overview idle', async () => {
    for (const route of ['/investigate', '/lead-explorer']) {
      await visit(route + scope + '&investigationMetric=fetchedLeads'); await waitStage('signal', 'Current 120');
      const before = await page.evaluate(() => window.__fixture.requests.filter(url => url.includes('/offernet/root-cause')).length);
      await page.evaluate(() => { window.__fixture.payloads['/api/analytics/offernet/root-cause'].metric.currentValue = 121; });
      await page.getByRole('button', { name: 'Refresh current view', exact: true }).click(); await waitStage('signal', 'Current 121');
      const requests = await page.evaluate(() => window.__fixture.requests);
      assert.equal(requests.filter(url => url.includes('/offernet/root-cause')).length, before + 1);
      assert.equal(requests.filter(url => /\/offernet\/(overview|operating-controls)/.test(url)).length, 0);
    }
  });
  await check('Chart catalogue has no synthetic production values or scope-dependent measurements', async () => {
    await page.goto(origin + '/visuals' + scope); await waitText('No analytical dataset is connected');
    await page.getByLabel('Catalogue measure').selectOption('sales');
    await page.getByRole('button', { name: 'line', exact: true }).click();
    assert.equal(await page.locator('.cx-viz-canvas').count(), 0); assert.match(await text(), /No plottable values/);
    assert.doesNotMatch(await text(), /Verified Sales/);
    assert.equal((await page.evaluate(() => window.__fixture.requests)).filter(url => url.includes('/api/analytics/')).length, 0);
  });
  await check('No browser runtime errors or console warnings', async () => { assert.deepEqual(errors, []); assert.deepEqual(messages, []); });
} catch (error) {
  failure = { message: error.message, stack: error.stack, url: page.url(), body: (await text()).slice(0, 20000) };
  await page.screenshot({ path: path.join(output, 'failure.png') });
  console.error(error);
} finally {
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ synthetic: true, origin, browser: await browser.version(), checks, screenshots, errors, messages, failure }, null, 2));
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
console.log(`Browser evidence: ${output}`);
if (failure) process.exitCode = 1;
