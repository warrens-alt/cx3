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
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await context.addInitScript(theme => {
      localStorage.setItem('cx-theme', theme); localStorage.setItem('cx.presentation.audit-mode.v1', 'on');
      const rows = [{
        lead_id: 'SYNTHETIC-LEAD-0001-very-long-identity-for-responsive-checks', consumer_id: '9007199254740993', transaction_id: 'SYNTHETIC-TX',
        source: 'synthetic-source', medium: 'synthetic-medium', grade: 'A', vetting: null, valid_lead: true, valid_idno: 2, phone_valid: null,
        vendor: 'Synthetic vendor', status: 'Delivered', last_dialer_status: 'Synthetic RPC disposition',
        fetched: '2026-09-28T09:02:00Z', delivered_time: '2026-09-28T09:06:00Z', first_call_time: '2026-09-29T04:43:00Z',
        total_calls: 4, dialled: true, qualified_delivery: true, qualified_rpc: true, qualified_sale: false, qualified_activation: false,
        recorded_delivery: true, recorded_first_dial: true, recorded_sale: true, recorded_activation: true,
        delivery_before_capture: false, first_dial_before_capture: false, first_dial_before_delivery: false, sale_before_capture: false, activation_before_sale: false,
        sale_time: null, activation_time: null, contacted: true, sale: true, activated: true, revenue: '1234567890.123456789', currency: 'ZAR',
        investigationReason: { code: 'FUNNEL_STAGE', label: 'Capture recorded in the selected cohort', detail: 'Synthetic returned capture-cohort population; outcome times are not supplied.' },
        synthetic_extra_null: null, synthetic_extra_nested: { note: '<script>synthetic text only</script>', array: [0, null, 'exact'], metadata: { supplied: false } },
      }, { lead_id: 'SYNTHETIC-LEAD-0002', source: 'synthetic-source', fetched: '2026-09-28T10:00:00Z', contacted: false, total_calls: 0, synthetic_second_row_only: false }];
      window.__leadEvidenceQaRows = rows;
      let state;
      Object.defineProperty(window, '__fixture', { configurable: true, get: () => state, set: value => {
        state = value; state.sourceLeadCount = 26;
        state.payloads = { ...state.payloads, '/api/analytics/offernet/exceptions': { exceptions: [], validationStatus: 'NOT_VERIFIED', populationNote: 'No matched-period exception breakdown was supplied for this synthetic capture-stage population.' }, '/api/analytics/offernet/raw-leads': {
          clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', rows, totalCount: rows.length, limit: 50, offset: 0,
          drill: 'funnel-stage', drillValue: 'fetched', segmentSource: 'synthetic-source', validationStatus: 'NOT_VERIFIED', dateBasis: 'intake_cohort', countingGrain: 'lead',
        } };
      } });
    }, theme);
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    const shot = async name => { const file = `${name}-${theme}-${viewport.width}.png`; await page.screenshot({ path: path.join(output, file) }); result.screenshots.push(file); };
    let currentCheck;
    const check = async (name, fn) => { currentCheck = name; await fn(); result.checks.push(name); };
    try {
      await page.goto(origin + '/lead-explorer' + scope + '&drill=funnel-stage&drillValue=fetched&segmentSource=synthetic-source');
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
      await check('Record search remains separate from reporting filters and investigation narrowing', async () => {
        await page.evaluate(leadId => { const payload = window.__fixture.payloads['/api/analytics/offernet/raw-leads']; payload.rows = window.__leadEvidenceQaRows.filter(row => row.lead_id === leadId); payload.totalCount = payload.rows.length; }, leadId);
        await page.getByRole('textbox', { name: 'Search lead records', exact: true }).fill(leadId);
        await page.getByRole('button', { name: 'Search', exact: true }).click();
        await page.waitForFunction(leadId => new URL(location.href).searchParams.get('search') === leadId && document.querySelectorAll('.cx-investigation-records tbody tr').length === 1, leadId);
        const searchRequest = (await requests(page)).filter(value => value.includes('/raw-leads')).at(-1);
        const query = new URL(searchRequest, origin).searchParams;
        assert.equal(query.get('search'), leadId); assert.equal(query.get('drill'), 'funnel-stage'); assert.equal(query.get('drillValue'), 'fetched'); assert.equal(query.get('segmentSource'), 'synthetic-source');
        assert.equal(query.get('clientId'), 'synthetic-a'); assert.equal(query.get('startDate'), '2026-09-28'); assert.equal(query.get('endDate'), '2026-09-28');
        await page.evaluate(() => { const payload = window.__fixture.payloads['/api/analytics/offernet/raw-leads']; payload.rows = window.__leadEvidenceQaRows; payload.totalCount = payload.rows.length; });
        await page.getByRole('button', { name: 'Clear', exact: true }).click();
        await page.waitForFunction(() => !new URL(location.href).searchParams.has('search') && document.querySelectorAll('.cx-investigation-records tbody tr').length === 2);
        assert.equal(new URL(page.url()).searchParams.get('segmentSource'), 'synthetic-source');
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
        const returned = await page.evaluate(() => [...new Set(window.__leadEvidenceQaRows.flatMap(row => Object.keys(row)))].sort());
        assert.deepEqual((await page.locator('.cx-investigation-records thead th[data-parameter-key]').evaluateAll(elements => elements.map(element => element.dataset.parameterKey))).sort(), returned);
        assert.equal(await page.locator('.cx-investigation-records thead th').count(), returned.length + 1);
        assert.match(await page.locator('.cx-investigation-records tbody tr').first().locator('[data-parameter-key=synthetic_extra_null]').innerText(), /Unavailable/);
        assert.match(await page.locator('.cx-investigation-records tbody tr').first().locator('[data-parameter-key=synthetic_second_row_only]').innerText(), /Not supplied/);
        const scroll = page.locator('.cx-investigation-table-wrap[data-preset=full]');
        assert.equal(await scroll.evaluate(element => element.scrollWidth > element.clientWidth), true);
        const identityHeader = page.locator('.cx-investigation-records thead th').first();
        const start = await identityHeader.boundingBox();
        await scroll.evaluate(element => { element.scrollLeft = element.scrollWidth; }); await settle(page);
        const end = await identityHeader.boundingBox();
        assert.ok(start && end && Math.abs(start.x - end.x) <= 1, 'The identity header remains aligned with its sticky first column during horizontal scroll');
        await scroll.evaluate(element => { element.scrollLeft = 0; }); await scroll.scrollIntoViewIfNeeded(); await settle(page); await shot('full-analytical');
      });
      await check('Column manager supports search, show/hide, restore, all/optional controls and keyboard focus without requests', async () => {
        const before = await requests(page);
        const manager = page.locator('.cx-analytical-column-manager');
        const trigger = manager.locator(':scope > summary'); await trigger.click();
        const fields = () => page.locator('.cx-investigation-records thead th[data-parameter-key]').evaluateAll(elements => elements.map(element => element.dataset.parameterKey));
        const complete = (await fields()).sort();
        assert.ok((await manager.locator('legend').allTextContents()).includes('Additional returned fields'));
        await manager.getByLabel('Search analytical columns', { exact: true }).fill('synthetic_extra_nested');
        const optional = manager.getByRole('checkbox', { name: /synthetic_extra_nested/ });
        assert.equal(await manager.getByRole('checkbox').count(), 1);
        await optional.uncheck(); assert.equal((await fields()).includes('synthetic_extra_nested'), false);
        await optional.check(); assert.equal((await fields()).includes('synthetic_extra_nested'), true);
        await manager.getByRole('button', { name: 'Clear optional fields', exact: true }).click();
        assert.deepEqual(await fields(), ['lead_id']);
        await manager.getByRole('button', { name: 'Select all', exact: true }).click();
        assert.deepEqual((await fields()).sort(), complete);
        await manager.getByRole('button', { name: 'Restore Full analytical preset', exact: true }).click();
        assert.deepEqual((await fields()).sort(), complete);
        await manager.getByLabel('Search analytical columns', { exact: true }).fill('');
        assert.equal(await manager.getByRole('checkbox', { name: /Lead ID/ }).isDisabled(), true);
        await manager.scrollIntoViewIfNeeded(); await overflow(page); await shot('column-manager');
        await manager.getByLabel('Search analytical columns', { exact: true }).focus(); await page.keyboard.press('Escape');
        assert.equal(await manager.evaluate(element => element.open), false);
        assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
        assert.deepEqual(await requests(page), before);
        const scroll = page.locator('.cx-investigation-table-wrap[data-preset=full]');
        await scroll.evaluate(element => { element.scrollLeft = element.scrollWidth; });
        await page.getByRole('button', { name: `Open dossier for lead ${leadId}`, exact: true }).click();
        await page.locator('.cx-lead-dossier').waitFor();
        await page.locator('.cx-record-view select').selectOption('investigation');
        assert.equal(await page.locator('.cx-lead-dossier').getAttribute('aria-label'), `Lead dossier for ${leadId}`);
      });
      await check('All parameters exposes complete grouped returned evidence with name search, nulls and safe nested values', async () => {
        const dossier = page.locator('.cx-lead-dossier');
        await page.waitForFunction(() => window.__fixture.requests.some(value => value.includes('/lead-timeline/')));
        const before = await requests(page);
        const summary = dossier.locator('.cx-dossier-body[data-section=summary]');
        assert.deepEqual(await summary.locator('[data-summary-group] h3').allTextContents(), ['Identity', 'Current state', 'Qualification', 'Contact', 'Outcomes', 'Timing']);
        assert.match(await summary.locator('[data-summary-group=timing]').innerText(), /19h 37m/);
        await summary.getByText('All parameters', { exact: true }).click();
        const inspector = summary.getByRole('region', { name: 'All analytical parameters', exact: true });
        const expected = await page.evaluate(() => Object.keys(window.__leadEvidenceQaRows[0]).sort());
        assert.deepEqual((await inspector.locator('[data-parameter-key]').evaluateAll(elements => elements.map(element => element.dataset.parameterKey))).sort(), expected);
        const groups = await inspector.locator('.cx-analytical-parameter-group > summary').allTextContents();
        for (const name of ['Identity', 'Acquisition', 'Qualification', 'Delivery / routing', 'Contact', 'Outcomes', 'Commercial', 'Timing', 'Investigation', 'Audit / metadata', 'Additional returned fields']) assert.ok(groups.some(label => label.startsWith(name)), name);
        await inspector.getByRole('searchbox', { name: 'Search parameter names', exact: true }).fill('synthetic_extra');
        assert.equal(await inspector.locator('[data-parameter-key]').count(), 2);
        assert.match(await inspector.locator('[data-parameter-key=synthetic_extra_null]').innerText(), /Unavailable/);
        const nested = inspector.locator('[data-parameter-key=synthetic_extra_nested]');
        await nested.getByText('Returned details', { exact: true }).click();
        assert.match(await nested.innerText(), /synthetic text only/); assert.equal(await inspector.locator('script').count(), 0);
        await nested.getByText('Raw returned JSON', { exact: true }).click();
        assert.match(await nested.locator('pre').innerText(), /"supplied": false/);
        assert.doesNotMatch(await inspector.innerText(), /\[object Object\]/);
        await inspector.scrollIntoViewIfNeeded(); await overflow(page); await shot('all-parameters');
        await inspector.getByRole('searchbox', { name: 'Search parameter names', exact: true }).fill('no-such-returned-parameter');
        await inspector.getByText('No returned parameter names match this search.', { exact: true }).waitFor();
        await inspector.getByRole('searchbox', { name: 'Search parameter names', exact: true }).fill('');
        assert.equal(await inspector.locator('[data-parameter-key]').count(), expected.length);
        assert.deepEqual(await requests(page), before);
        await summary.getByText('All parameters', { exact: true }).click();
      });
      await check('One dossier, six keyboard tabs, Audit adds no request', async () => {
        const dossier = page.locator('.cx-lead-dossier');
        assert.equal(await dossier.count(), 1);
        assert.deepEqual(await dossier.locator('[role=tab]').allTextContents(), ['Summary', 'Timeline', 'Calls', 'Outcomes', 'Audit', 'Source']);
        await page.waitForFunction(() => window.__fixture.requests.some(value => value.includes('/lead-timeline/')));
        const before = await requests(page);
        await dossier.locator('.cx-dossier-body[data-section=summary]').scrollIntoViewIfNeeded();
        assert.equal(await dossier.locator('[data-evidence-stage]').count(), 6);
        const lifecycle = dossier.getByRole('list', { name: 'Recorded lifecycle evidence', exact: true });
        assert.equal(await lifecycle.locator('[data-evidence-state=observed]').count(), 3);
        assert.equal(await lifecycle.locator('[data-evidence-state=untimed]').count(), 3);
        assert.match(await dossier.locator('.cx-lead-evidence-summary').innerText(), /Calls: 4/);
        await settle(page); await shot('population-summary');
        await dossier.getByRole('tab', { name: 'Summary', exact: true }).focus(); await page.keyboard.press('ArrowRight');
        assert.equal(await dossier.locator('.cx-dossier-tabs').getByRole('tab', { name: 'Timeline', exact: true }).evaluate(element => element === document.activeElement), true);
        assert.match(await dossier.innerText(), /attempt history|Individual synthetic call times/);
        await dossier.locator('.cx-journey-forensic-canvas:not([hidden])').scrollIntoViewIfNeeded();
        await settle(page); await shot('population-journey');
        await dossier.getByRole('tab', { name: 'Audit', exact: true }).click();
        assert.equal(await dossier.locator('.cx-evidence-trace').count(), 1);
        assert.deepEqual(await requests(page), before);
        await dossier.scrollIntoViewIfNeeded(); await settle(page);
        if (viewport.width >= 1180) {
          const geometry = await dossier.evaluate(element => {
            const context = document.querySelector('.cx-investigation-context[data-compact=true]');
            const workspace = element.closest('.cx-lead-evidence-master-detail');
            const main = element.closest('.cx-main');
            const styles = getComputedStyle(element);
            return { dossier: element.getBoundingClientRect().top, context: context.getBoundingClientRect().bottom,
              dossierRect: element.getBoundingClientRect().toJSON(), position: styles.position, top: styles.top, maxHeight: styles.maxHeight, inlineStyle: element.getAttribute('style'),
              workspaceRect: workspace?.getBoundingClientRect().toJSON(), mainRect: main?.getBoundingClientRect().toJSON(), contextTop: getComputedStyle(context).top };
          });
          assert.ok(geometry.dossier >= geometry.context, `Dossier heading must remain below the sticky Investigation strip: ${JSON.stringify(geometry)}`);
        }
        await overflow(page); await shot('population-audit');
      });
      await check('Timeline keeps elapsed chronology and untimed outcomes separate, with event audit, copy, pin and source handoff', async () => {
        const dossier = page.locator('.cx-lead-dossier');
        await dossier.locator('.cx-dossier-tabs').getByRole('tab', { name: 'Timeline', exact: true }).click();
        const before = await requests(page);
        assert.equal(count(before, 'source'), 0);
        const chronology = dossier.getByRole('list', { name: 'Observed chronology', exact: true });
        assert.equal(await chronology.locator('.cx-journey-event').count(), 3);
        assert.match(await chronology.innerText(), /4m.*19h 37m/s);
        const untimed = dossier.getByRole('region', { name: 'Recorded stages without timestamps', exact: true });
        assert.equal(await untimed.locator('.cx-journey-event').count(), 3);
        assert.equal(await untimed.locator('time').count(), 0);
        assert.match(await untimed.innerText(), /no known chronological order.*Right-party contact.*Sale.*Activation/s);
        const timelineViews = dossier.getByRole('tablist', { name: 'Timeline views', exact: true });
        assert.deepEqual(await timelineViews.getByRole('tab').allTextContents(), ['Chronology', 'Event log']);
        await timelineViews.getByRole('tab', { name: 'Event log', exact: true }).focus(); await page.keyboard.press('Enter');
        await timelineViews.getByRole('tab', { name: 'Chronology', exact: true }).click();
        await chronology.locator('.cx-journey-event[data-stage=call]').click();
        const selected = dossier.getByRole('region', { name: 'Selected event evidence', exact: true });
        assert.match(await selected.innerText(), /First dial.*Observed timestamp.*Normalized evidence.*Original source fields/s);
        await selected.getByRole('button', { name: /^Audit evidence:/ }).click();
        const audit = page.getByRole('dialog'); await audit.waitFor();
        assert.match(await audit.innerText(), /NOT_VERIFIED/);
        assert.match(await audit.innerText(), /first_call_time|First dial|first dial/);
        await audit.getByRole('button', { name: 'Close inspector', exact: true }).click();
        await selected.getByRole('button', { name: 'Copy evidence', exact: true }).click();
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        assert.ok(copied.includes(leadId)); assert.match(copied, /First dial.*2026-09-29T04:43:00/s);
        await selected.getByRole('button', { name: 'Pin timeline event', exact: true }).click();
        assert.match(await page.locator('.cx-investigation-tray > summary').innerText(), /1 pinned observation/);
        assert.deepEqual(await requests(page), before);
        await selected.scrollIntoViewIfNeeded(); await overflow(page); await shot('timeline-event-evidence');
        await selected.getByRole('button', { name: 'View source fields', exact: true }).click();
        await dossier.locator('.cx-dossier-body[data-section=source] [data-source-highlight=true]').first().waitFor({ state: 'attached' });
        assert.equal(count(await requests(page), 'source'), 1);
        assert.equal(new URL(page.url()).searchParams.has('leadId'), false);
      });
      await check('Exact lazy source records and session-local source handoff', async () => {
        const dossier = page.locator('.cx-lead-dossier');
        await dossier.getByRole('tab', { name: 'Source', exact: true }).click();
        await dossier.locator('.cx-ledger-raw-record').first().waitFor({ state: 'attached' });
        const allFields = dossier.getByText('View all 63 raw source fields', { exact: true });
        if (!(await allFields.evaluate(element => element.parentElement.open))) await allFields.click();
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
        const sourceAllFields = page.locator('.cx-lead-dossier').getByText('View all 63 raw source fields', { exact: true });
        if (!(await sourceAllFields.evaluate(element => element.parentElement.open))) await sourceAllFields.click();
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
        const query = new URL(page.url()).searchParams;
        for (const [key, value] of Object.entries({ clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', drill: 'funnel-stage', drillValue: 'fetched', segmentSource: 'synthetic-source', preset: 'investigation' })) assert.equal(query.get(key), value, key);
        assert.equal(query.has('search'), false);
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
