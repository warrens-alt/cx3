import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';
import { LEDGER_HEADERS, ledgerCsvCell, analyseLedgerLead } from '../contracts/leadLedgerReplica';
import { buildLeadEvidenceExport } from '../src/lib/analysisExport';

const output = await mkdtemp(path.join(tmpdir(), 'cx3-ledger-audit-'));
await buildAcceptanceFixture(output);
const script = await readFile(path.join(output, 'fixture.js'), 'utf8');
test.after(() => rm(output, { recursive: true, force: true }));
const scope = '?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28';
const leadId = 'SYNTHETIC-LEAD-0001-very-long-identity-for-responsive-checks';
const replicaPath = '/api/analytics/lead-ledger/replica';

async function mount(route: string, options: any = {}) {
  const errors: string[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', (error: Error) => { if (!error.message.includes('navigation')) errors.push(error.message); });
  console.on('error', (...args: unknown[]) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window as any;
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream, structuredClone, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, __fixture: { initialRoute: route, ...options } });
  w.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.HTMLElement.prototype.scrollTo = () => {}; w.scrollTo = () => {};
  // JSDOM cannot measure layout; model connected visible elements for modal focus.
  w.HTMLElement.prototype.getClientRects = function () {
    if (!this.isConnected || this.closest('[hidden]')) return [];
    for (let el = this; el; el = el.parentElement) if (w.getComputedStyle(el).display === 'none') return [];
    return [new w.DOMRect(0, 0, 100, 30)];
  };
  const blobs: any[] = [], filenames: string[] = [];
  w.URL.createObjectURL = (blob: any) => { blobs.push(blob); return 'blob:synthetic'; }; w.URL.revokeObjectURL = () => {};
  const originalAnchorClick = w.HTMLAnchorElement.prototype.click;
  w.HTMLAnchorElement.prototype.click = function () { if (this.download) filenames.push(this.download); else originalAnchorClick.call(this); };
  w.eval(script);
  const text = () => w.document.body.textContent || '';
  const find = (selector: string, label?: string): any => [...w.document.querySelectorAll(selector)].find((el: any) => label === undefined || (el.getAttribute('aria-label') || el.textContent || '').includes(label));
  const wait = async (check: () => unknown, label = 'Expected audit presentation') => {
    for (let i = 0; i < 150; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw new Error(`${label}\n${text().slice(0, 2500)}\nErrors: ${errors.join('; ')}`);
  };
  const click = async (selector: string, label?: string) => {
    const element = find(selector, label); assert.ok(element, `Missing ${selector}: ${label}`);
    element.focus(); element.click(); await new Promise(resolve => setTimeout(resolve, 30)); return element;
  };
  const input = async (element: any, value: string) => {
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new w.Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 25));
  };
  const blobText = (blob: any) => new Promise<string>((resolve, reject) => { const reader = new w.FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob); });
  try { await wait(() => w.document.querySelector('#main-content h1') && w.document.activeElement === w.document.querySelector('#main-content')); }
  catch (error) { w.__fixture.unmount(); dom.window.close(); throw error; }
  return { w, text, find, wait, click, input, blobText, blobs, filenames, errors, close() { w.__fixture.unmount(); dom.window.close(); assert.deepEqual(errors, []); } };
}

test('Population embeds exact source evidence and retains scope without putting the selected identifier in navigation', async () => {
  const filters = { vendor: { operator: 'in', values: ['Synthetic vendor', 'Other vendor'] }, grade: { operator: 'not_equals', value: 'D' } };
  const query = scope + '&workspace=alpha&workspace=beta&filters=' + encodeURIComponent(JSON.stringify(filters)) + '&drill=awaiting-first-dial&search=SYNTHETIC-LEAD-0001';
  const app = await mount('/lead-explorer' + query, { sourceLeadCount: 26 });
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${leadId}`));
    const location = app.w.__fixture.location;
    await app.click('button', `Open dossier for lead ${leadId}`);
    await app.wait(() => app.find('.cx-lead-dossier'));
    assert.equal(app.w.document.activeElement, app.find('.cx-lead-dossier'));
    assert.equal(app.w.__fixture.location, location, 'Selecting a private lead is session-only');
    assert.equal(app.find('[role="dialog"][aria-label="Lead timeline"]'), undefined);
    assert.equal(app.w.__fixture.requests.filter((request: string) => request.startsWith(replicaPath)).length, 0, 'Source data loads only when requested');
    const timeline = app.w.__fixture.requests.find((request: string) => request.startsWith('/api/analytics/offernet/lead-timeline/'));
    const timelineScope = new URL(timeline, 'https://synthetic.invalid').searchParams;
    assert.equal(timelineScope.get('clientId'), 'synthetic-a');
    assert.equal(timelineScope.get('startDate'), '2026-09-28');
    assert.equal(timelineScope.get('endDate'), '2026-09-28');
    assert.equal(timelineScope.get('drill'), 'awaiting-first-dial');
    assert.deepEqual(JSON.parse(timelineScope.get('filters')!), filters);
    await app.click('button', 'View source evidence');
    await app.wait(() => app.find('.cx-lead-dossier .cx-ledger-inspector-sections'));
    const expected = replicaPath + '?' + new URLSearchParams({ clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', filters: JSON.stringify({ ...filters, lead_id: { operator: 'equals', value: leadId } }), sourceMode: 'configured', search: leadId, limit: '25', offset: '0' });
    assert.deepEqual(Array.from(app.w.__fixture.requests.filter((request: string) => request.startsWith(replicaPath + '?'))), [expected]);
    assert.equal(app.w.__fixture.location, location);
    assert.equal(app.find('.cx-lead-dossier').textContent.includes('SYNTHETIC-LEAD-0002'), false, 'Other substring matches are never displayed');
    assert.match(app.find('.cx-lead-dossier').textContent, /Original source evidence.*NOT_VERIFIED/);
  } finally { app.close(); }
});

test('source search URL changes reset pagination synchronously and support back / forward without stale search', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=source', { sourceLeadCount: 26 });
  try {
    await app.wait(() => app.find('.cx-ledger-source-table tbody tr'));
    await app.click('.cx-ledger-pagination button', 'Next');
    await app.wait(() => app.text().includes('SYNTHETIC-SOURCE-0026'));
    const before = app.w.__fixture.requests.length;
    app.w.__fixture.navigate('/lead-explorer' + scope + '&view=source&sourceSearch=SYNTHETIC-SOURCE-0026');
    await app.wait(() => app.find('#ledger-search')?.value === 'SYNTHETIC-SOURCE-0026' && app.find('.cx-ledger-pagination')?.textContent.includes('Page 1'));
    const queries = app.w.__fixture.requests.slice(before).filter((request: string) => request.startsWith(replicaPath + '?'));
    assert.deepEqual(Array.from(queries), [replicaPath + '?' + new URLSearchParams({ clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', filters: '{}', sourceMode: 'configured', search: 'SYNTHETIC-SOURCE-0026', limit: '25', offset: '0' })]);
    app.w.__fixture.navigate(-1);
    await app.wait(() => app.find('#ledger-search')?.value === '' && app.find('.cx-ledger-source-table tbody')?.children.length === 25);
    app.w.__fixture.navigate(1);
    await app.wait(() => app.find('#ledger-search')?.value === 'SYNTHETIC-SOURCE-0026' && app.find('.cx-ledger-source-table tbody')?.children.length === 1);
    const beforeDraft = app.w.__fixture.requests.length;
    await app.input(app.find('#ledger-search'), 'SYNTHETIC-SOURCE-0025');
    assert.equal(app.w.__fixture.requests.length, beforeDraft);
    app.find('#ledger-search').form.dispatchEvent(new app.w.Event('submit', { bubbles: true, cancelable: true }));
    await app.wait(() => app.w.__fixture.location.includes('sourceSearch=SYNTHETIC-SOURCE-0025') && app.find('.cx-ledger-source-table tbody')?.textContent.includes('SYNTHETIC-SOURCE-0025'));
    await app.click('.cx-ledger-toolbar button', 'Clear');
    await app.wait(() => !new URL(app.w.__fixture.location, 'https://synthetic.invalid').searchParams.has('sourceSearch') && app.find('#ledger-search')?.value === '');
    assert.equal(app.find('#ledger-search').value, '');
  } finally { app.close(); }
});

test('source snapshot distinguishes generated time from freshness and retains all 63 raw fields and exact values', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=source');
  try {
    await app.wait(() => app.find('[aria-label="Source snapshot"]'));
    const snapshot = app.find('[aria-label="Source snapshot"]');
    assert.match(snapshot.textContent, /Fetched cohort/);
    assert.match(snapshot.textContent, /NOT_VERIFIED/);
    assert.match(snapshot.textContent, /2026-09-30T06:00:00Z/);
    assert.match(snapshot.textContent, /not source freshness/);
    assert.equal([...snapshot.querySelectorAll('dt')].some((element: any) => element.textContent === 'Query job ID'), false, 'Absent optional metadata has no empty row');
    const before = app.w.__fixture.requests.length;
    await app.click('button', `Inspect source lead ${leadId}`);
    await app.wait(() => app.find('.cx-lead-dossier .cx-ledger-inspector-sections'));
    await app.click('.cx-lead-dossier summary', 'View all 63 raw source fields');
    const records = [...app.w.document.querySelectorAll('.cx-lead-dossier .cx-ledger-raw-record')] as any[];
    assert.equal(records.length, 2, 'Repeated returned source records stay separate');
    for (const record of records) {
      const fields = [...record.querySelectorAll('[data-raw-field]')] as any[];
      assert.equal(fields.length, 63);
      assert.deepEqual(fields.map(field => field.dataset.rawField).sort(), [...LEDGER_HEADERS].sort());
      assert.equal(record.querySelector('[data-raw-field="HLC Revenue Generated"] dd').textContent, '1234567890.123456789');
      assert.equal(record.querySelector('[data-raw-field="HLC Total Calls"] dd').textContent, '0');
      assert.equal(record.querySelector('[data-raw-field="HLC RPC"] dd').textContent, 'Not recorded');
    }
    assert.match(app.find('.cx-lead-dossier').textContent, /Raw source value/);
    assert.equal(app.w.__fixture.requests.length, before);
  } finally { app.close(); }
});

function analyticalResult() {
  return { clientId: 'synthetic-a', startDate: '2026-09-25', endDate: '2026-09-26', filters: { vendor: { operator: 'in', values: ['One', 'Two'] } }, search: 'returned search', drill: null, drillValue: null, timezone: 'Africa/Johannesburg', dateBasis: 'intake_cohort', definitionVersion: 'fixture-v1', metricId: 'lead_records', countingGrain: 'lead', generatedAt: '2026-09-29T00:00:00Z', sourceCutoff: null, validationStatus: 'NOT_VERIFIED', totalCount: 1, limit: 50, offset: 0, rows: [{ lead_id: 'SYNTHETIC-EXPORT', sale: null, contacted: false, total_calls: 0, revenue: '1234567890.123456789' }] };
}

test('analytical export review is local, result-bound, keyboard dismissible and downloads unchanged CSV once', async () => {
  const result = analyticalResult();
  const app = await mount('/lead-explorer' + scope, { payloads: { '/api/analytics/offernet/raw-leads': result } });
  try {
    await app.wait(() => app.text().includes('SYNTHETIC-EXPORT'));
    const before = app.w.__fixture.requests.length;
    const trigger = await app.click('button', 'Export current analytical page');
    await app.wait(() => app.find('[role="dialog"][aria-label="Export current evidence"]'));
    const dialog = app.find('[role="dialog"][aria-label="Export current evidence"]');
    assert.match(dialog.textContent, /Current returned page/);
    assert.match(dialog.textContent, /2026-09-25 → 2026-09-26/);
    assert.match(dialog.textContent, /"values":\["One","Two"\]/);
    assert.match(dialog.textContent, /returned search/);
    assert.match(dialog.textContent, /NOT_VERIFIED/);
    assert.match(dialog.textContent, /intake_cohort/);
    assert.equal(app.w.__fixture.requests.length, before);
    assert.equal(app.blobs.length, 0);
    await app.wait(() => dialog.contains(app.w.document.activeElement));
    app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await app.wait(() => !app.find('[aria-label="Export current evidence"]'));
    await app.wait(() => app.w.document.activeElement === trigger);
    await app.click('button', 'Export current analytical page');
    await app.click('button', 'Download CSV');
    await app.wait(() => app.blobs.length === 1);
    assert.equal(app.w.__fixture.requests.length, before);
    const expected = buildLeadEvidenceExport(result);
    assert.equal((await app.blobText(app.blobs[0])).replace(/^\uFEFF/, ''), expected.csv.replace(/^\uFEFF/, ''));
    assert.deepEqual(app.filenames, [expected.filename + '.csv']);
    assert.equal(app.find('[aria-label="Export current evidence"]'), undefined);
  } finally { app.close(); }
});

test('source preflight adds no request and confirms the existing complete source export URL and CSV unchanged', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=source&sourceSearch=' + encodeURIComponent(leadId), { sourceLeadCount: 26 });
  try {
    await app.wait(() => app.find('.cx-ledger-source-table tbody tr'));
    const before = app.w.__fixture.requests.length;
    const originalFetch = app.w.fetch;
    const csv = '\uFEFF' + LEDGER_HEADERS.map(ledgerCsvCell).join(',') + '\r\n' + LEDGER_HEADERS.map(header => ledgerCsvCell(header === 'Lead ID' ? leadId : null)).join(',') + '\r\n';
    // Test-only complete response: production request and CSV receiver remain real.
    app.w.fetch = async (input: any, options: any) => {
      const url = new URL(String(input), 'https://synthetic.invalid');
      if (url.pathname !== replicaPath + '/export') return originalFetch(input, options);
      app.w.__fixture.requests.push(url.pathname + url.search);
      return new Response(csv, { headers: { 'Content-Type': 'text/csv', 'X-Export-Truncated': 'false', 'X-Export-Row-Count': '1', 'X-Export-Query-Job': 'synthetic-export-job', 'Content-Disposition': 'attachment; filename="synthetic-source.csv"' } });
    };
    await app.click('button', 'Export source-compatible data');
    await app.wait(() => app.find('[aria-label="Export current evidence"]'));
    assert.match(app.find('[aria-label="Export current evidence"]').textContent, /separate single query snapshot/);
    assert.match(app.find('[aria-label="Export current evidence"]').textContent, /Current page limits do not limit this export/);
    assert.equal(app.w.__fixture.requests.length, before);
    await app.click('button', 'Cancel');
    assert.equal(app.w.__fixture.requests.length, before);
    await app.click('button', 'Export source-compatible data');
    await app.click('button', 'Download CSV');
    await app.wait(() => app.blobs.length === 1);
    const expected = replicaPath + '/export?' + new URLSearchParams({ clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', filters: '{}', sourceMode: 'configured', search: leadId, mode: 'compatible' });
    assert.deepEqual(Array.from(app.w.__fixture.requests.slice(before)), [expected]);
    assert.equal((await app.blobText(app.blobs[0])).replace(/^\uFEFF/, ''), csv.replace(/^\uFEFF/, ''));
    assert.deepEqual(app.filenames, ['synthetic-source.csv']);
  } finally { app.close(); }
});

test('a source export review cannot survive a scope change or request failure', async () => {
  const app = await mount('/lead-explorer' + scope + '&view=source');
  try {
    await app.wait(() => app.find('.cx-ledger-source-table tbody tr'));
    await app.click('button', 'Export source-compatible data');
    await app.wait(() => app.find('[aria-label="Export current evidence"]'));
    app.w.__fixture.fail = ['lead-ledger/replica'];
    app.w.__fixture.navigate('/lead-explorer?clientId=synthetic-a&startDate=2026-09-27&endDate=2026-09-28&view=source');
    await app.wait(() => !app.find('[aria-label="Export current evidence"]') && app.find('[role="alert"]'));
    assert.equal(app.find('button', 'Export source-compatible data').disabled, true);
    assert.equal(app.w.__fixture.requests.some((request: string) => request.includes('/replica/export')), false);
    assert.equal(app.blobs.length, 0);
  } finally { app.close(); }
});

test('Population review does not invent absent export metadata or bypass existing export validation', async () => {
  const app = await mount('/lead-explorer' + scope);
  try {
    await app.wait(() => app.find('button', 'Export current analytical page') && !app.find('button', 'Export current analytical page').disabled);
    const before = app.w.__fixture.requests.length;
    await app.click('button', 'Export current analytical page');
    await app.wait(() => app.find('[aria-label="Export current evidence"]'));
    const dialog = app.find('[aria-label="Export current evidence"]');
    assert.match(dialog.textContent, /Current returned page/);
    assert.equal([...dialog.querySelectorAll('dt')].some((element: any) => element.textContent === 'Date basis'), false);
    assert.equal([...dialog.querySelectorAll('dt')].some((element: any) => element.textContent === 'Generated at'), false);
    assert.equal(app.w.__fixture.requests.length, before);
    await app.click('button', 'Download CSV');
    await app.wait(() => app.find('[role="alert"]')?.textContent.includes('Cannot export'));
    assert.equal(app.blobs.length, 0);
    assert.equal(app.w.__fixture.requests.length, before);
  } finally { app.close(); }
});

test('non-admin Population fails closed without analytical record, timeline or source requests', async () => {
  const app = await mount('/lead-explorer' + scope, { nonAdmin: true });
  try {
    await app.wait(() => app.text().includes('Record access is restricted'));
    assert.equal(app.find('.cx-lead-dossier'), undefined);
    assert.equal(app.find('button', 'View source evidence'), undefined);
    assert.equal(app.w.__fixture.requests.some((request: string) => request.startsWith(replicaPath) || request.includes('/raw-leads') || request.includes('/lead-timeline')), false);
  } finally { app.close(); }
});

test('partial source export retains its warning and existing available-fields export mode', async () => {
  const coverage = { source: 'synthetic partial source', available: LEDGER_HEADERS.filter(header => header !== 'HLC RPC'), missing: ['HLC RPC'], compatible: false, richViewEnabled: false };
  const app = await mount('/lead-explorer' + scope + '&view=source', { payloads: { [replicaPath + '/coverage']: coverage } });
  try {
    await app.wait(() => app.find('button', 'Export source data with available fields'));
    assert.equal(app.find('button', 'Export source-compatible data').disabled, true);
    const before = app.w.__fixture.requests.length;
    await app.click('button', 'Export source data with available fields');
    await app.wait(() => app.find('[aria-label="Export current evidence"]'));
    const dialog = app.find('[aria-label="Export current evidence"]');
    assert.match(dialog.textContent, /HLC RPC/);
    assert.match(dialog.textContent, /explicitly partial/);
    assert.equal(app.w.__fixture.requests.length, before);
    // The existing fixture rejects unsupported exports. Verify the exact request
    // and visible failure, without inventing a successful partial response.
    await app.click('button', 'Download CSV');
    await app.wait(() => app.find('.cx-ledger-error')?.textContent.includes('Synthetic request failure'));
    const expected = replicaPath + '/export?' + new URLSearchParams({ clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', filters: '{}', sourceMode: 'configured', search: '', mode: 'available' });
    assert.deepEqual(Array.from(app.w.__fixture.requests.slice(before)), [expected]);
    assert.equal(app.blobs.length, 0);
  } finally { app.close(); }
});


test('dossier reuses the loaded journey, preserves unavailable evidence and supports tabs and return focus', async () => {
  const result = analyticalResult();
  result.rows[0] = { ...result.rows[0], investigationReason: { code: 'AWAITING_FIRST_DIAL', label: 'Delivered · no recorded first dial' } } as typeof result.rows[0];
  const app = await mount('/lead-explorer' + scope + '&drill=awaiting-first-dial', { payloads: { '/api/analytics/offernet/raw-leads': result } });
  try {
    await app.wait(() => app.find('button', 'Open dossier for lead SYNTHETIC-EXPORT'));
    const trigger = await app.click('button', 'Open dossier for lead SYNTHETIC-EXPORT');
    await app.wait(() => app.find('.cx-lead-dossier'));
    assert.match(app.find('.cx-dossier-inclusion').textContent, /Delivered · no recorded first dial/);
    assert.doesNotMatch(app.find('.cx-dossier-body').textContent, /Recorded first dial timestamp|First dial qualification/, 'Concise Summary does not duplicate journey or audit detail');
    assert.match(app.find('.cx-lead-dossier').textContent, /NOT_VERIFIED/);
    const summary = app.find('[role="tab"]', 'Summary');
    summary.focus(); summary.dispatchEvent(new app.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await app.wait(() => app.find('.cx-ledger-journey'));
    assert.equal(app.w.document.activeElement, app.find('.cx-dossier-tabs [role="tab"]', 'Timeline'));
    assert.match(app.find('.cx-ledger-journey').textContent, /Timeline unavailable/);
    await app.click('.cx-dossier-tabs [role="tab"]', 'Calls');
    await app.wait(() => app.find('.cx-dossier-body').textContent.includes('Recorded call aggregates'));
    assert.match(app.find('.cx-dossier-body').textContent, /First dialUnavailable/);
    assert.match(app.find('.cx-dossier-body').textContent, /Individual attempt timestamps.*unavailable/);
    assert.equal(app.find('.cx-dossier-body').querySelectorAll('.cx-journey-event').length, 0);
    await app.click('.cx-dossier-tabs [role="tab"]', 'Audit');
    await app.wait(() => app.find('.cx-dossier-body').textContent.includes('Supplied qualification flags'));
    assert.match(app.find('.cx-dossier-body').textContent, /First dial · dialledQualification not supplied/);
    await app.click('button', 'Close lead dossier');
    await app.wait(() => !app.find('.cx-lead-dossier') && app.w.document.activeElement === trigger);
  } finally { app.close(); }
});

test('Population scope changes clear selection and pagination; stale timeline and source completions cannot leak', async () => {
  const timelinePath = '/api/analytics/offernet/lead-timeline/SYNTHETIC-LEAD-0051';
  const app = await mount('/lead-explorer' + scope + '&drill=awaiting-first-dial', { defer: [timelinePath, replicaPath] });
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${leadId}`));
    await app.click('.cx-explorer-pagination button', 'Next');
    await app.wait(() => app.find('button', 'Open dossier for lead SYNTHETIC-LEAD-0051'));
    await app.click('button', 'Open dossier for lead SYNTHETIC-LEAD-0051');
    await app.wait(() => app.w.__fixture.pending?.[timelinePath]);
    await app.click('button', 'View source evidence');
    await app.wait(() => app.w.__fixture.pending?.[replicaPath]);
    app.w.__fixture.navigate('/lead-explorer?clientId=synthetic-b&startDate=2026-09-27&endDate=2026-09-28&drill=one-call-only&segmentVendor=Other');
    await app.wait(() => app.find('.cx-explorer-pagination')?.textContent.includes('Page 1') && !app.find('.cx-lead-dossier'));
    app.w.__fixture.pending[timelinePath](); app.w.__fixture.pending[replicaPath]();
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(app.find('.cx-lead-dossier'), undefined);
    const newer = app.w.__fixture.requests.filter((request: string) => request.includes('/raw-leads') && request.includes('synthetic-b'));
    assert.equal(newer.length, 1);
    assert.equal(new URL(newer[0], 'https://synthetic.invalid').searchParams.get('offset'), '0');
    assert.equal(new URL(newer[0], 'https://synthetic.invalid').searchParams.get('segmentVendor'), 'Other');
  } finally { app.close(); }
});

test('Population search and clear controls preserve the correct investigation and reporting scope', async () => {
  const app = await mount('/lead-explorer' + scope + '&drill=one-call-only&segmentGrade=A');
  try {
    await app.wait(() => app.find('button', `Open dossier for lead ${leadId}`));
    const input = app.find('[aria-label="Search lead records"]');
    await app.input(input, 'SYNTHETIC-LEAD-0002');
    input.form.dispatchEvent(new app.w.Event('submit', { bubbles: true, cancelable: true }));
    await app.wait(() => app.w.__fixture.location.includes('search=SYNTHETIC-LEAD-0002'));
    let params = new URL(app.w.__fixture.location, 'https://synthetic.invalid').searchParams;
    assert.equal(params.get('drill'), 'one-call-only'); assert.equal(params.get('segmentGrade'), 'A');
    await app.click('.cx-explorer-search button', 'Clear');
    await app.wait(() => !new URL(app.w.__fixture.location, 'https://synthetic.invalid').searchParams.has('search'));
    params = new URL(app.w.__fixture.location, 'https://synthetic.invalid').searchParams;
    assert.equal(params.get('drill'), 'one-call-only');
    await app.click('button', 'Clear investigation');
    await app.wait(() => !new URL(app.w.__fixture.location, 'https://synthetic.invalid').searchParams.has('drill'));
    params = new URL(app.w.__fixture.location, 'https://synthetic.invalid').searchParams;
    assert.equal(params.get('segmentGrade'), null); assert.equal(params.get('clientId'), 'synthetic-a'); assert.equal(params.get('startDate'), '2026-09-28'); assert.equal(params.get('endDate'), '2026-09-28');
  } finally { app.close(); }
});


test('dossier source vendor narrowing distinguishes null and blank vendors and excludes unrelated warnings', async () => {
  const result = analyticalResult();
  const generatedAt = '2026-09-30T06:00:00Z';
  const lead = analyseLedgerLead('selected', [
    { 'Lead ID': 'SYNTHETIC-EXPORT', 'HLC Vendor': 'Keep', 'HLC Transaction ID': 'KEEP-TX', 'Fetched': '2026-09-28T09:00:00Z', 'HLC Total Calls': 0 },
    { 'Lead ID': 'SYNTHETIC-EXPORT', 'HLC Vendor': null, 'HLC Transaction ID': 'NULL-VENDOR-TX', 'Fetched': '2026-09-28T09:00:00Z' },
    { 'Lead ID': 'SYNTHETIC-EXPORT', 'HLC Vendor': '  ', 'HLC Transaction ID': 'BLANK-VENDOR-TX', 'Fetched': '2026-09-28T09:00:00Z' },
    { 'Lead ID': 'SYNTHETIC-EXPORT', 'HLC Vendor': 'Excluded vendor', 'HLC Transaction ID': 'EXCLUDED-TX', 'Fetched': '2026-09-28T09:00:00Z', 'HLC First Call Date': 'invalid-time' },
  ], Date.parse(generatedAt));
  const source = { leads: [lead], metadata: { clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', validationStatus: 'NOT_VERIFIED', generatedAt, filters: {}, coverage: { source: 'Synthetic source', available: LEDGER_HEADERS, missing: [] }, hasMore: false } };
  for (const [vendor, transaction] of [['Keep', 'KEEP-TX'], ['Unknown', 'NULL-VENDOR-TX'], ['Unrecorded', 'BLANK-VENDOR-TX']]) {
    const app = await mount('/lead-explorer' + scope + '&drill=one-call-only&segmentVendor=' + vendor, { payloads: { '/api/analytics/offernet/raw-leads': result, [replicaPath]: source } });
    try {
      await app.wait(() => app.find('button', 'Open dossier for lead SYNTHETIC-EXPORT'));
      await app.click('button', 'Open dossier for lead SYNTHETIC-EXPORT');
      await app.click('button', 'View source evidence');
      await app.wait(() => app.find('.cx-lead-dossier .cx-ledger-inspector-sections'));
      const panel = app.find('.cx-dossier-body');
      assert.equal(panel.querySelectorAll('.cx-ledger-raw-record').length, 1, `${vendor} retains only its source record`);
      assert.equal(panel.querySelectorAll('[data-raw-field]').length, 63);
      assert.equal(panel.querySelector('[data-raw-field="HLC Transaction ID"] dd').textContent, transaction);
      assert.doesNotMatch(panel.textContent, /EXCLUDED-TX|Excluded vendor|invalid timestamp/);
    } finally { app.close(); }
  }
});


test('closing dossier restores focus to the visible table counterpart when a split-pane card becomes hidden', async () => {
  const app = await mount('/lead-explorer' + scope);
  try {
    // Model the real responsive container transition: wide table before a
    // selection, record cards in the narrower pane while the dossier is open.
    const style = app.w.document.createElement('style');
    style.textContent = '[data-has-selection="true"] .cx-investigation-table-wrap{display:none}[data-has-selection="false"] .cx-investigation-record-cards{display:none}';
    app.w.document.head.appendChild(style);
    await app.wait(() => app.find('button', `Open dossier for lead ${leadId}`));
    await app.click('.cx-investigation-table-wrap button', `Open dossier for lead ${leadId}`);
    await app.wait(() => app.find('.cx-lead-dossier'));
    const cardTrigger = await app.click('.cx-investigation-record-cards button', 'Open dossier for lead SYNTHETIC-LEAD-0002');
    assert.ok(cardTrigger.getClientRects().length, 'The card trigger is visible in the split pane');
    await app.click('button', 'Close lead dossier');
    const tableTrigger = app.find('.cx-investigation-table-wrap button', 'Open dossier for lead SYNTHETIC-LEAD-0002');
    await app.wait(() => app.w.document.activeElement === tableTrigger);
    assert.equal(cardTrigger.getClientRects().length, 0, 'The previous card trigger is now hidden');
    assert.ok(tableTrigger.getClientRects().length, 'Focus lands on the visible equivalent lead');
  } finally { app.close(); }
});


test('dossier retains recorded anomalous timestamps and distinguishes qualified progression from recorded outcomes', async () => {
  const result = analyticalResult();
  result.rows[0] = { ...result.rows[0], fetched: '2026-09-28T10:00:00Z', delivered_time: '2026-09-28T10:01:00Z', first_call_time: '2026-09-28T09:00:00Z', sale_time: '2026-09-28T10:20:00Z', activation_time: '2026-09-28T10:10:00Z',
    recorded_first_dial: true, qualified_delivery: true, dialled: false, qualified_activation: false,
    delivery_before_capture: false, first_dial_before_capture: true, first_dial_before_delivery: true, sale_before_capture: false, activation_before_sale: true,
    sale: true, activated: true, investigationReason: { code: 'INVALID_TIMESTAMPS', label: 'Recorded timestamp order is inconsistent' },
  } as typeof result.rows[0];
  const app = await mount('/lead-explorer' + scope + '&drill=invalid-timestamps', { payloads: { '/api/analytics/offernet/raw-leads': result } });
  try {
    await app.wait(() => app.find('button', 'Open dossier for lead SYNTHETIC-EXPORT'));
    await app.click('button', 'Open dossier for lead SYNTHETIC-EXPORT');
    await app.wait(() => app.find('.cx-lead-dossier'));
    await app.click('.cx-dossier-tabs [role="tab"]', 'Timeline');
    await app.wait(() => app.find('.cx-journey-event[data-stage="call"]'));
    await app.click('.cx-journey-event[data-stage="call"]');
    await app.wait(() => app.find('.cx-journey-evidence').textContent.includes('first_call_time'));
    assert.match(app.find('.cx-journey-evidence').textContent, /first_call_time2026-09-28T09:00:00Z/);
    assert.match(app.find('.cx-journey-anomalies').textContent, /First dial precedes delivered/);
    await app.click('.cx-dossier-tabs [role="tab"]', 'Audit');
    await app.wait(() => app.find('.cx-dossier-body').textContent.includes('Supplied qualification flags'));
    const audit = app.find('.cx-dossier-body');
    assert.match(audit.textContent, /First dial · dialledExcluded from qualified progression/);
    for (const anomaly of ['First dial before capture', 'First dial before delivery', 'Activation before sale']) assert.match(audit.querySelector('[aria-label="Recorded chronology anomalies"]').textContent, new RegExp(anomaly));
    assert.match(audit.textContent, /do not certify billing, collection or business completion/);
    await app.click('.cx-dossier-tabs [role="tab"]', 'Outcomes');
    await app.wait(() => app.find('.cx-dossier-body').textContent.includes('Recorded outcome evidence'));
    const outcomes = app.find('.cx-dossier-body');
    assert.match(outcomes.textContent, /Sale · saleRecordedActivation · activatedRecorded/);
    assert.match(outcomes.textContent, /Source-recorded revenue/);
    assert.match(outcomes.textContent, /does not create an upstream event, collected cash or a confirmed event time/);
  } finally { app.close(); }
});
