import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';

const output = await mkdtemp(path.join(tmpdir(), 'cx3-lead-evidence-workspace-'));
await buildAcceptanceFixture(output);
const script = await readFile(path.join(output, 'fixture.js'), 'utf8');
test.after(() => rm(output, { recursive: true, force: true }));
const scope = '?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28';
const firstLead = 'SYNTHETIC-LEAD-0001-very-long-identity-for-responsive-checks';
const rawPath = '/api/analytics/offernet/raw-leads';
const sourcePath = '/api/analytics/lead-ledger/replica';
const timelinePrefix = '/api/analytics/offernet/lead-timeline/';

async function mount(route = '/lead-explorer' + scope, options: Record<string, any> = {}) {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { if (!error.message.includes('navigation')) errors.push(error.message); });
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any;
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream, structuredClone, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, __fixture: { initialRoute: route, ...options, payloads: { [timelinePrefix + firstLead]: { leadId: firstLead, consumerId: 0, vendor: 'Synthetic vendor', source: 'synthetic-source', grade: 'A', events: [] }, ...options.payloads } } });
  w.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.HTMLElement.prototype.scrollTo = () => {}; w.scrollTo = () => {};
  w.HTMLElement.prototype.getClientRects = function () {
    if (!this.isConnected || this.closest('[hidden]')) return [];
    for (let element = this; element; element = element.parentElement) if (w.getComputedStyle(element).display === 'none') return [];
    return [new w.DOMRect(0, 0, 100, 30)];
  };
  const text = () => w.document.body.textContent || '';
  const find = (selector: string, label?: string, parent: any = w.document): any => [...parent.querySelectorAll(selector)].find((element: any) => label === undefined || (element.getAttribute('aria-label') || element.textContent || '').trim() === label);
  const wait = async (check: () => unknown, label = 'Lead Evidence condition') => {
    for (let attempt = 0; attempt < 150; attempt++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw new Error(`${label}\n${text().slice(0, 3500)}\nErrors: ${errors.join('; ')}`);
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 70));
  const click = async (selector: string, label?: string, parent?: any) => {
    const element = find(selector, label, parent); assert.ok(element, `Missing ${selector}: ${label}`);
    assert.equal(element.disabled, false, `Disabled ${label}`);
    element.focus(); element.click(); await settle(); return element;
  };
  const select = async (selector: string, value: string) => {
    const element = find(selector); assert.ok(element, selector);
    element.value = value; element.dispatchEvent(new w.Event('change', { bubbles: true })); await settle();
  };
  const queries = (pathname: string) => (w.__fixture.requests as string[]).filter(request => new URL(request, 'https://synthetic.invalid').pathname === pathname);
  const timelines = () => (w.__fixture.requests as string[]).filter(request => request.startsWith(timelinePrefix));
  const requestParams = (request: string) => new URL(request, 'https://synthetic.invalid').searchParams;
  const locationParams = () => new URL(w.__fixture.location, 'https://synthetic.invalid').searchParams;
  w.eval(script);
  try { await wait(() => find('h1', 'Lead Evidence')); }
  catch (error) { w.__fixture.unmount(); dom.window.close(); throw error; }
  return { w, find, wait, settle, click, select, text, queries, timelines, requestParams, locationParams, close() { w.__fixture.unmount(); dom.window.close(); assert.deepEqual(errors, []); } };
}

test('canonical Population is the default and mounts analytical rows without a source or timeline request', async () => {
  const app = await mount();
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
    assert.equal(app.find('[role="tab"][data-view="population"]')?.getAttribute('aria-selected'), 'true');
    assert.equal(app.queries(rawPath).length, 1);
    assert.equal(app.queries(sourcePath).length, 0);
    assert.equal(app.queries(sourcePath + '/coverage').length, 0);
    assert.equal(app.timelines().length, 0);
    assert.match(app.find('#investigation-records')?.textContent, /One normalized analytical lead representation per row/);
    assert.equal(app.find('.cx-lead-dossier'), undefined);
  } finally { app.close(); }
});

test('direct Source Evidence mounts only source queries and selecting uses the loaded canonical dossier', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=source');
  try {
    await app.wait(() => app.find('button', `Inspect source lead ${firstLead}`));
    assert.equal(app.find('[role="tab"][data-view="source"]')?.getAttribute('aria-selected'), 'true');
    assert.equal(app.queries(sourcePath).length, 1);
    assert.equal(app.queries(sourcePath + '/coverage').length, 1);
    assert.equal(app.queries(rawPath).length, 0);
    assert.equal(app.timelines().length, 0);
    const requests = app.w.__fixture.requests.length;
    const beforeLocation = app.w.__fixture.location;
    await app.click('button', `Inspect source lead ${firstLead}`);
    await app.wait(() => app.find('.cx-lead-dossier'));
    const dossier = app.find('.cx-lead-dossier');
    assert.equal(app.find('[role="tab"][aria-selected="true"]', 'Source', dossier)?.textContent, 'Source');
    assert.match(dossier.textContent, /No normalized lead row loaded · 2 original source records/);
    assert.match(dossier.textContent, /matching identifiers do not establish reconciliation/);
    assert.equal(dossier.querySelectorAll('.cx-ledger-raw-record').length, 2);
    assert.equal(app.w.__fixture.requests.length, requests, 'Selecting source evidence reuses returned source records');
    assert.equal(app.w.__fixture.location, beforeLocation);
    assert.equal(app.queries(rawPath).length, 0);
  } finally { app.close(); }
});

test('URL presets reuse the loaded population and retain the exact selected dossier across back and forward', async () => {
  const app = await mount();
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
    await app.click('button', `Open dossier for lead ${firstLead}`);
    await app.wait(() => app.find('.cx-lead-dossier'));
    const dossier = app.find('.cx-lead-dossier');
    await app.wait(() => app.timelines().length === 1);
    await app.settle();
    const requests = app.w.__fixture.requests.length;
    for (const preset of ['journey', 'contact', 'outcomes', 'full']) {
      await app.select('.cx-record-view select', preset);
      await app.wait(() => app.find('.cx-investigation-records')?.dataset.preset === preset);
      assert.equal(app.locationParams().get('preset'), preset);
      assert.equal(app.find('.cx-lead-dossier'), dossier);
      assert.equal(app.find('button', `Open dossier for lead ${firstLead}`)?.getAttribute('aria-pressed'), 'true');
      assert.equal(app.w.__fixture.requests.length, requests);
    }
    assert.equal(app.w.document.querySelectorAll('.cx-investigation-records thead th').length, 17);
    app.w.__fixture.navigate(-1);
    await app.wait(() => app.find('.cx-record-view select')?.value === 'outcomes');
    assert.equal(app.find('.cx-lead-dossier'), dossier);
    app.w.__fixture.navigate(1);
    await app.wait(() => app.find('.cx-record-view select')?.value === 'full');
    assert.equal(app.w.__fixture.requests.length, requests);
    for (const request of app.queries(rawPath)) assert.equal(app.requestParams(request).has('preset'), false);
    assert.equal(app.w.__fixture.location.includes(firstLead), false);
  } finally { app.close(); }
});

test('Population page sizes and first/last navigation use the returned count with correctly scoped offsets', async () => {
  const app = await mount();
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
    assert.equal(app.find('[aria-label="Analytical leads per page"]')?.value, '50');
    assert.match(app.find('.cx-explorer-pagination')?.textContent, /Total: 101 matching leads/);
    for (const size of ['25', '100', '50']) {
      await app.select('[aria-label="Analytical leads per page"]', size);
      await app.wait(() => app.find('.cx-explorer-pagination')?.textContent.includes('Page 1') && app.w.document.querySelectorAll('.cx-investigation-records tbody tr').length === Number(size));
      assert.equal(app.find('button', 'First', app.find('.cx-explorer-pagination'))?.disabled, true);
      await app.click('button', 'Last', app.find('.cx-explorer-pagination'));
      await app.wait(() => app.w.document.querySelectorAll('.cx-investigation-records tbody tr').length === 1 && app.find('.cx-explorer-count')?.textContent.includes('101–101'));
      const request = app.queries(rawPath).at(-1)!;
      assert.equal(app.requestParams(request).get('limit'), size);
      assert.equal(app.requestParams(request).get('offset'), '100');
      assert.equal(app.requestParams(request).get('clientId'), 'synthetic-a');
      assert.equal(app.requestParams(request).get('startDate'), '2026-09-28');
      assert.equal(app.find('button', 'Last', app.find('.cx-explorer-pagination'))?.disabled, true);
      assert.equal(app.find('button', 'Next', app.find('.cx-explorer-pagination'))?.disabled, true);
      await app.click('button', 'First', app.find('.cx-explorer-pagination'));
      await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
      assert.match(app.find('.cx-explorer-pagination')?.textContent, /Page 1/);
    }
    assert.equal(app.queries(sourcePath).length, 0);
    assert.equal(app.timelines().length, 0);
  } finally { app.close(); }
});

test('unknown Population total disables last-page navigation without inventing a total', async () => {
  const rows = [{ lead_id: firstLead, total_calls: 0 }];
  const app = await mount('/lead-explorer' + scope, { payloads: { [rawPath]: { clientId: 'synthetic-a', rows, totalCount: null, limit: 50, offset: 0 } } });
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
    assert.equal(app.find('button', 'Last', app.find('.cx-explorer-pagination'))?.disabled, true);
    assert.doesNotMatch(app.find('.cx-explorer-pagination')?.textContent, /Total:/);
    assert.equal(app.queries(rawPath).length, 1);
  } finally { app.close(); }
});

test('a selected Population lead clears when the next returned page no longer contains it', async () => {
  const app = await mount();
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
    await app.click('button', `Open dossier for lead ${firstLead}`);
    await app.wait(() => app.find('.cx-lead-dossier'));
    await app.click('button', 'Next', app.find('.cx-explorer-pagination'));
    await app.wait(() => app.find('button', 'Open dossier for lead SYNTHETIC-LEAD-0051') && !app.find('.cx-lead-dossier'));
    assert.equal(app.requestParams(app.queries(rawPath).at(-1)!).get('offset'), '50');
    assert.equal(app.w.__fixture.location.includes(firstLead), false);
    assert.equal(app.queries(sourcePath).length, 0);
  } finally { app.close(); }
});

test('Summary stays lazy, Source tab reads once, and source-mode handoff keeps identity session-local', async () => {
  const app = await mount('/lead-explorer' + scope + '&drill=awaiting-first-dial&segmentSource=synthetic-source', { sourceLeadCount: 26 });
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
    await app.click('button', `Open dossier for lead ${firstLead}`);
    await app.wait(() => app.find('.cx-lead-dossier'));
    const dossier = app.find('.cx-lead-dossier');
    assert.equal(app.find('[role="tab"][aria-selected="true"]', 'Summary', dossier)?.textContent, 'Summary');
    assert.equal(app.queries(sourcePath).length, 0);
    await app.click('[role="tab"]', 'Source', dossier);
    await app.wait(() => dossier.querySelectorAll('.cx-ledger-raw-record').length === 2);
    assert.equal(app.queries(sourcePath).length, 1);
    const sourceQuery = app.requestParams(app.queries(sourcePath)[0]);
    assert.equal(sourceQuery.get('search'), firstLead);
    assert.equal(JSON.parse(sourceQuery.get('filters')!).lead_id.value, firstLead);
    await app.click('[role="tab"]', 'Summary', dossier);
    await app.click('[role="tab"]', 'Source', dossier);
    assert.equal(app.queries(sourcePath).length, 1, 'Reopening Source reuses the exact already-returned query');
    await app.click('button', 'Open in Source Evidence', dossier);
    await app.wait(() => app.locationParams().get('view') === 'source' && app.find('[role="tab"][data-view="source"]')?.getAttribute('aria-selected') === 'true' && app.find('button', `Inspect source lead ${firstLead}`) && app.find('.cx-lead-dossier')?.querySelectorAll('.cx-ledger-raw-record').length === 2);
    assert.equal(app.find('.cx-lead-dossier')?.getAttribute('aria-label'), `Lead dossier for ${firstLead}`);
    assert.equal(app.locationParams().get('drill'), 'awaiting-first-dial');
    assert.equal(app.locationParams().get('segmentSource'), 'synthetic-source');
    assert.equal(app.w.__fixture.location.includes(firstLead), false);
    assert.equal(app.locationParams().has('leadId'), false);
    assert.equal(app.locationParams().has('sourceSearch'), false);
    assert.match(app.text(), /do not independently qualify every source transaction/);
    await app.click('[role="tab"][data-view="population"]');
    await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
    assert.equal(app.find('.cx-lead-dossier')?.getAttribute('aria-label'), `Lead dossier for ${firstLead}`);
    assert.equal(app.find('button', `Open dossier for lead ${firstLead}`)?.getAttribute('aria-pressed'), 'true');
  } finally { app.close(); }
});

test('the primary Source Evidence tab focuses the selected Population lead exactly without adding identity to the URL', async () => {
  const filters = { vendor: { operator: 'in', values: ['One', 'Two'] }, grade: { operator: 'not_equals', value: 'D' } };
  const query = scope + '&filters=' + encodeURIComponent(JSON.stringify(filters)) + '&drill=awaiting-first-dial&segmentSource=synthetic-source&preset=journey';
  const app = await mount('/lead-explorer' + query, { sourceLeadCount: 26 });
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
    await app.click('button', `Open dossier for lead ${firstLead}`);
    await app.wait(() => app.find('.cx-lead-dossier'));
    assert.equal(app.queries(sourcePath).length, 0, 'Opening Summary does not eagerly read source records');
    const analyticalReads = app.queries(rawPath).length;
    const timelineReads = app.timelines().length;
    await app.click('[role="tab"][data-view="source"]');
    await app.wait(() => app.find('[role="tab"][data-view="source"]')?.getAttribute('aria-selected') === 'true' && app.find('.cx-lead-dossier')?.querySelectorAll('.cx-ledger-raw-record').length === 2);
    assert.equal(app.queries(sourcePath).length, 1, 'Direct mode switch issues only the focused source query');
    const source = app.requestParams(app.queries(sourcePath)[0]);
    assert.equal(source.get('clientId'), 'synthetic-a');
    assert.equal(source.get('startDate'), '2026-09-28');
    assert.equal(source.get('endDate'), '2026-09-28');
    assert.equal(source.get('search'), firstLead);
    assert.deepEqual(JSON.parse(source.get('filters')!), { ...filters, lead_id: { operator: 'equals', value: firstLead } });
    assert.equal(source.has('drill'), false, 'Analytical predicates remain context and do not qualify individual source records');
    assert.equal(source.has('segmentSource'), false);
    assert.equal(app.find('.cx-lead-dossier')?.getAttribute('aria-label'), `Lead dossier for ${firstLead}`);
    assert.equal(app.find('button', `Inspect source lead ${firstLead}`)?.getAttribute('aria-pressed'), 'true');
    assert.equal(app.queries(rawPath).length, analyticalReads);
    assert.equal(app.timelines().length, timelineReads);
    assert.equal(app.locationParams().get('view'), 'source');
    assert.equal(app.locationParams().get('drill'), 'awaiting-first-dial');
    assert.equal(app.locationParams().get('segmentSource'), 'synthetic-source');
    assert.equal(app.locationParams().get('preset'), 'journey');
    assert.deepEqual(JSON.parse(app.locationParams().get('filters')!), filters);
    assert.equal(app.locationParams().has('sourceSearch'), false);
    assert.equal(app.locationParams().has('leadId'), false);
    assert.equal(app.w.__fixture.location.includes(firstLead), false);
  } finally { app.close(); }
});

test('a source-only unmatched selection clears on a direct Population mode switch', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=source&sourceSearch=SYNTHETIC-SOURCE-0026', { sourceLeadCount: 26 });
  try {
    await app.wait(() => app.find('button', 'Inspect source lead SYNTHETIC-SOURCE-0026'));
    await app.click('button', 'Inspect source lead SYNTHETIC-SOURCE-0026');
    await app.wait(() => app.find('.cx-lead-dossier'));
    assert.match(app.find('.cx-lead-dossier')?.textContent, /No normalized lead row loaded/);
    assert.equal(app.queries(rawPath).length, 0);
    await app.click('[role="tab"][data-view="population"]');
    await app.wait(() => app.find('[role="tab"][data-view="population"]')?.getAttribute('aria-selected') === 'true' && app.find('button', `Open dossier for lead ${firstLead}`));
    assert.equal(app.find('.cx-lead-dossier'), undefined);
    assert.equal(app.w.document.querySelector('.cx-investigation-records [data-selected="true"]'), null);
    assert.equal(app.timelines().length, 0);
    assert.equal(app.queries(rawPath).length, 1, 'Population switch loads its population without a separate identity lookup');
    assert.equal(app.requestParams(app.queries(rawPath)[0]).has('search'), false, 'Source search does not become an analytical search');
    assert.equal(app.requestParams(app.queries(rawPath)[0]).has('sourceSearch'), false);
  } finally { app.close(); }
});

test('clearing a source-only selection through the primary Population tab cannot restart its pending analytical lookup on return', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=source');
  try {
    await app.wait(() => app.find('button', `Inspect source lead ${firstLead}`));
    await app.click('button', `Inspect source lead ${firstLead}`);
    app.w.__fixture.defer = [rawPath];
    await app.click('button', 'Load analytical evidence', app.find('.cx-lead-dossier'));
    await app.wait(() => app.w.__fixture.pending?.[rawPath]);
    const resolveOldLookup = app.w.__fixture.pending[rawPath];
    app.w.__fixture.defer = [];
    await app.click('[role="tab"][data-view="population"]');
    await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`) && !app.find('.cx-lead-dossier'));
    const exactReads = app.queries(rawPath).filter(request => app.requestParams(request).get('search') === firstLead).length;
    assert.equal(exactReads, 1);
    await app.click('[role="tab"][data-view="source"]');
    await app.wait(() => app.find('button', `Inspect source lead ${firstLead}`) && !app.find('.cx-lead-dossier'));
    assert.equal(app.queries(rawPath).filter(request => app.requestParams(request).get('search') === firstLead).length, exactReads, 'No old identity lookup restarts after selection was cleared');
    resolveOldLookup();
    await app.settle();
    assert.equal(app.find('.cx-lead-dossier'), undefined);
    assert.equal(app.timelines().length, 0);
  } finally { app.close(); }
});

test('source page membership clears the dossier when the returned page omits its selected source key', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=source', { sourceLeadCount: 26 });
  try {
    await app.wait(() => app.find('button', `Inspect source lead ${firstLead}`));
    await app.click('button', `Inspect source lead ${firstLead}`);
    await app.wait(() => app.find('.cx-lead-dossier'));
    await app.click('button', 'Next', app.find('.cx-ledger-pagination'));
    await app.wait(() => app.find('button', 'Inspect source lead SYNTHETIC-SOURCE-0026') && !app.find('.cx-lead-dossier'));
    assert.equal(app.requestParams(app.queries(sourcePath).at(-1)!).get('offset'), '25');
    assert.equal(app.find('button', 'Inspect source lead SYNTHETIC-SOURCE-0026')?.getAttribute('aria-pressed'), 'false');
    await app.click('button', 'Previous', app.find('.cx-ledger-pagination'));
    await app.wait(() => app.find('button', `Inspect source lead ${firstLead}`));
    assert.equal(app.find('.cx-lead-dossier'), undefined, 'Returning to a cached page does not restore the stale selection');
    assert.equal(app.find('button', `Inspect source lead ${firstLead}`)?.getAttribute('aria-pressed'), 'false');
    assert.equal(app.queries(rawPath).length, 0);
    assert.equal(app.timelines().length, 0);
  } finally { app.close(); }
});

test('source-only evidence loads analytical data only on explicit request and permits handoff after an exact match', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=source');
  try {
    await app.wait(() => app.find('button', `Inspect source lead ${firstLead}`));
    await app.click('button', `Inspect source lead ${firstLead}`);
    await app.wait(() => app.find('button', 'Load analytical evidence', app.find('.cx-lead-dossier')));
    assert.equal(app.queries(rawPath).length, 0);
    assert.equal(app.timelines().length, 0);
    assert.equal(app.find('button', 'Open analytical lead', app.find('.cx-lead-dossier')), undefined);
    await app.click('button', 'Load analytical evidence', app.find('.cx-lead-dossier'));
    await app.wait(() => app.find('button', 'Open analytical lead', app.find('.cx-lead-dossier')));
    assert.equal(app.queries(rawPath).length, 1);
    assert.equal(app.timelines().length, 0, 'Matching a normalized row in Source mode does not load a timeline');
    const exact = app.requestParams(app.queries(rawPath)[0]);
    assert.equal(exact.get('search'), firstLead);
    assert.equal(JSON.parse(exact.get('filters')!).lead_id.value, firstLead);
    assert.match(app.find('.cx-lead-dossier')?.textContent, /One normalized lead row · 2 original source records/);
    await app.click('button', 'Open analytical lead', app.find('.cx-lead-dossier'));
    await app.wait(() => app.locationParams().get('view') === 'population' && app.find('button', `Open dossier for lead ${firstLead}`));
    assert.equal(app.find('.cx-lead-dossier')?.getAttribute('aria-label'), `Lead dossier for ${firstLead}`);
    assert.equal(app.w.__fixture.location.includes(firstLead), false);
  } finally { app.close(); }
});

test('an inexact normalized result never substitutes another lead or enables an analytical handoff', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=source');
  try {
    await app.wait(() => app.find('button', `Inspect source lead ${firstLead}`));
    await app.click('button', `Inspect source lead ${firstLead}`);
    app.w.__fixture.payloads[rawPath] = { clientId: 'synthetic-a', limit: 25, offset: 0, totalCount: 1, rows: [{ lead_id: firstLead + '-substring-only', sale: true }] };
    await app.click('button', 'Load analytical evidence', app.find('.cx-lead-dossier'));
    await app.wait(() => app.find('.cx-lead-dossier')?.textContent.includes('No exact analytical lead match was returned'));
    assert.equal(app.find('button', 'Open analytical lead', app.find('.cx-lead-dossier')), undefined);
    assert.match(app.find('.cx-lead-dossier')?.textContent, /No normalized lead row loaded/);
    assert.equal(app.find('.cx-lead-dossier')?.textContent.includes(firstLead + '-substring-only'), false);
    assert.equal(app.queries(rawPath).length, 1);
    assert.equal(app.timelines().length, 0);
  } finally { app.close(); }
});

test('tenant, reporting scope, and effective permission changes fence a selected dossier', async () => {
  for (const change of ['tenant', 'dates', 'permission']) {
    const app = await mount();
    try {
      await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
      await app.click('button', `Open dossier for lead ${firstLead}`);
      await app.wait(() => app.find('.cx-lead-dossier'));
      if (change === 'tenant') app.w.__fixture.navigate('/lead-explorer' + scope.replace('synthetic-a', 'synthetic-b'));
      if (change === 'dates') app.w.__fixture.navigate('/lead-explorer' + scope.replaceAll('2026-09-28', '2026-09-29'));
      if (change === 'permission') app.w.__fixture.setAccess({ nonAdmin: true });
      await app.wait(() => !app.find('.cx-lead-dossier'), change + ' should remove selected private evidence');
      if (change === 'permission') {
        const before = app.w.__fixture.requests.length;
        assert.match(app.text(), /Record access is restricted to authorised administrators/);
        await app.settle();
        assert.equal(app.w.__fixture.requests.length, before);
      } else {
        await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`));
        assert.equal(app.find('button', `Open dossier for lead ${firstLead}`)?.getAttribute('aria-pressed'), 'false');
        const params = app.requestParams(app.queries(rawPath).at(-1)!);
        assert.equal(params.get(change === 'tenant' ? 'clientId' : 'startDate'), change === 'tenant' ? 'synthetic-b' : '2026-09-29');
      }
    } finally { app.close(); }
  }
});

test('a deferred source-to-analytical match cannot restore private selection after a scope or permission boundary', async () => {
  for (const change of ['tenant', 'dates', 'permission']) {
    const app = await mount('/lead-explorer' + scope + '&view=source', { sourceLeadCount: 2 });
    try {
      await app.wait(() => app.find('button', `Inspect source lead ${firstLead}`));
      await app.click('button', `Inspect source lead ${firstLead}`);
      app.w.__fixture.defer = [rawPath];
      await app.click('button', 'Load analytical evidence', app.find('.cx-lead-dossier'));
      await app.wait(() => app.w.__fixture.pending?.[rawPath]);
      const resolveOldMatch = app.w.__fixture.pending[rawPath];
      if (change === 'tenant') app.w.__fixture.navigate('/lead-explorer' + scope.replace('synthetic-a', 'synthetic-b') + '&view=source');
      if (change === 'dates') app.w.__fixture.navigate('/lead-explorer' + scope.replaceAll('2026-09-28', '2026-09-29') + '&view=source');
      if (change === 'permission') app.w.__fixture.setAccess({ nonAdmin: true });
      await app.wait(() => !app.find('.cx-lead-dossier'));
      app.w.__fixture.defer = [];
      resolveOldMatch();
      await app.settle();
      assert.equal(app.find('.cx-lead-dossier'), undefined, `${change}: a completed old-scope match must not reinstate the dossier`);
      assert.equal(app.queries(rawPath).length, 1);
      assert.equal(app.timelines().length, 0);
      if (change === 'permission') assert.match(app.text(), /Source evidence requires authorised administrator access/);
      else {
        await app.wait(() => app.find('button', `Inspect source lead ${firstLead}`));
        assert.equal(app.find('button', `Inspect source lead ${firstLead}`)?.getAttribute('aria-pressed'), 'false');
        const params = app.requestParams(app.queries(sourcePath).at(-1)!);
        assert.equal(params.get(change === 'tenant' ? 'clientId' : 'startDate'), change === 'tenant' ? 'synthetic-b' : '2026-09-29');
      }
    } finally { app.close(); }
  }
});

test('invalid mode and preset normalize to Population, and mode back/forward follows URL without extra cached reads', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=invalid&preset=source');
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${firstLead}`) && app.locationParams().get('view') === 'population' && !app.locationParams().has('preset'));
    assert.equal(app.find('.cx-record-view select')?.value, 'investigation');
    assert.equal(app.queries(rawPath).length, 1);
    await app.click('[role="tab"][data-view="source"]');
    await app.wait(() => app.find('button', `Inspect source lead ${firstLead}`));
    const requests = app.w.__fixture.requests.length;
    app.w.__fixture.navigate(-1);
    await app.wait(() => app.find('[role="tab"][data-view="population"]')?.getAttribute('aria-selected') === 'true' && app.find('button', `Open dossier for lead ${firstLead}`));
    app.w.__fixture.navigate(1);
    await app.wait(() => app.find('[role="tab"][data-view="source"]')?.getAttribute('aria-selected') === 'true' && app.find('button', `Inspect source lead ${firstLead}`));
    assert.equal(app.w.__fixture.requests.length, requests);
    assert.equal(app.timelines().length, 0);
  } finally { app.close(); }
});
