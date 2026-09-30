import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';
import { LEDGER_HEADERS, ledgerCsvCell } from '../contracts/leadLedgerReplica';
import { buildLeadLedgerExport } from '../src/lib/leadLedgerExport';

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
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, __fixture: { initialRoute: route, ...options } });
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

test('Explorer source-evidence link preserves complete scope and submits only the existing source search', async () => {
  const filters = { vendor: { operator: 'in', values: ['Synthetic vendor', 'Other vendor'] }, grade: { operator: 'not_equals', value: 'D' } };
  const query = scope + '&workspace=alpha&workspace=beta&filters=' + encodeURIComponent(JSON.stringify(filters)) + '&drill=awaiting-first-dial&drillValue=obsolete&search=SYNTHETIC-LEAD-0001';
  const app = await mount('/lead-explorer' + query, { sourceLeadCount: 26 });
  try {
    await app.wait(() => app.find('button', `Open timeline for lead ${leadId}`));
    await app.click('button', `Open timeline for lead ${leadId}`);
    await app.wait(() => app.find('a', 'Open source evidence'));
    const link = app.find('a', 'Open source evidence');
    const target = new URL(link.href);
    assert.equal(target.pathname, '/lead-ledger');
    assert.equal(target.searchParams.get('search'), leadId);
    assert.equal(target.searchParams.get('clientId'), 'synthetic-a');
    assert.equal(target.searchParams.get('startDate'), '2026-09-28');
    assert.equal(target.searchParams.get('endDate'), '2026-09-28');
    assert.deepEqual(target.searchParams.getAll('workspace'), ['alpha', 'beta']);
    assert.deepEqual(JSON.parse(target.searchParams.get('filters')!), filters);
    assert.equal(target.searchParams.has('drill'), false);
    assert.equal(target.searchParams.has('drillValue'), false);
    assert.equal(app.w.__fixture.requests.filter((request: string) => request.startsWith(replicaPath)).length, 0, 'Rendering a source link performs no source request');
    await app.click('a', 'Open source evidence');
    await app.wait(() => app.find('#ledger-search')?.value === leadId && app.find('.cx-ledger-source-table tbody tr'));
    const expected = replicaPath + '?' + new URLSearchParams({ clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', filters: JSON.stringify(filters), sourceMode: 'configured', search: leadId, limit: '25', offset: '0' });
    assert.deepEqual(Array.from(app.w.__fixture.requests.filter((request: string) => request.startsWith(replicaPath + '?'))), [expected], 'No intermediate unfiltered source query is issued');
    assert.equal(app.find('.cx-ledger-source-table tbody').children.length, 1);
    assert.match(app.text(), /not an exact-match or reconciliation claim/);
  } finally { app.close(); }
});

test('source search URL changes reset pagination synchronously and support back / forward without stale search', async () => {
  const app = await mount('/lead-ledger' + scope, { sourceLeadCount: 26 });
  try {
    await app.wait(() => app.find('.cx-ledger-source-table tbody tr'));
    await app.click('.cx-ledger-pagination button', 'Next');
    await app.wait(() => app.text().includes('SYNTHETIC-SOURCE-0026'));
    const before = app.w.__fixture.requests.length;
    app.w.__fixture.navigate('/lead-ledger' + scope + '&search=SYNTHETIC-SOURCE-0026');
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
    await app.wait(() => app.w.__fixture.location.includes('search=SYNTHETIC-SOURCE-0025') && app.find('.cx-ledger-source-table tbody')?.textContent.includes('SYNTHETIC-SOURCE-0025'));
    await app.click('.cx-ledger-toolbar button', 'Clear');
    await app.wait(() => !new URL(app.w.__fixture.location, 'https://synthetic.invalid').searchParams.has('search') && app.find('#ledger-search')?.value === '');
    assert.equal(app.find('#ledger-search').value, '');
  } finally { app.close(); }
});

test('source snapshot distinguishes generated time from freshness and retains all 63 raw fields and exact values', async () => {
  const app = await mount('/lead-ledger' + scope);
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
    await app.click('.cx-ledger-inspector summary', 'View all 63 raw source fields');
    const records = [...app.w.document.querySelectorAll('.cx-ledger-inspector .cx-ledger-raw-record')] as any[];
    assert.equal(records.length, 2, 'Repeated returned source records stay separate');
    for (const record of records) {
      const fields = [...record.querySelectorAll('[data-raw-field]')] as any[];
      assert.equal(fields.length, 63);
      assert.deepEqual(fields.map(field => field.dataset.rawField).sort(), [...LEDGER_HEADERS].sort());
      assert.equal(record.querySelector('[data-raw-field="HLC Revenue Generated"] dd').textContent, '1234567890.123456789');
      assert.equal(record.querySelector('[data-raw-field="HLC Total Calls"] dd').textContent, '0');
      assert.equal(record.querySelector('[data-raw-field="HLC RPC"] dd').textContent, 'Not recorded');
    }
    assert.match(app.find('.cx-ledger-inspector').textContent, /Raw source value/);
    assert.equal(app.w.__fixture.requests.length, before);
  } finally { app.close(); }
});

function analyticalResult() {
  return { clientId: 'synthetic-a', startDate: '2026-09-25', endDate: '2026-09-26', filters: { vendor: { operator: 'in', values: ['One', 'Two'] } }, search: 'returned search', drill: null, drillValue: null, timezone: 'Africa/Johannesburg', dateBasis: 'intake_cohort', definitionVersion: 'fixture-v1', metricId: 'lead_records', countingGrain: 'lead', generatedAt: '2026-09-29T00:00:00Z', sourceCutoff: null, validationStatus: 'NOT_VERIFIED', totalCount: 1, limit: 50, offset: 0, rows: [{ lead_id: 'SYNTHETIC-EXPORT', sale: null, contacted: false, total_calls: 0, revenue: '1234567890.123456789' }] };
}

test('analytical export review is local, result-bound, keyboard dismissible and downloads unchanged CSV once', async () => {
  const result = analyticalResult();
  const app = await mount('/lead-ledger' + scope, { payloads: { '/api/analytics/offernet/raw-leads': result } });
  try {
    await app.click('button', 'Operational analysis');
    await app.wait(() => app.text().includes('SYNTHETIC-EXPORT'));
    const before = app.w.__fixture.requests.length;
    await app.click('summary', 'More actions');
    const trigger = await app.click('button', 'Export Page CSV');
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
    await app.click('button', 'Export Page CSV');
    await app.click('button', 'Download CSV');
    await app.wait(() => app.blobs.length === 1);
    assert.equal(app.w.__fixture.requests.length, before);
    const expected = buildLeadLedgerExport(result);
    assert.equal((await app.blobText(app.blobs[0])).replace(/^\uFEFF/, ''), expected.csv.replace(/^\uFEFF/, ''));
    assert.deepEqual(app.filenames, [expected.filename]);
    assert.equal(app.find('[aria-label="Export current evidence"]'), undefined);
  } finally { app.close(); }
});

test('source preflight adds no request and confirms the existing complete source export URL and CSV unchanged', async () => {
  const app = await mount('/lead-ledger' + scope + '&search=' + encodeURIComponent(leadId), { sourceLeadCount: 26 });
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
    await app.click('button', 'Export complete 63-column CSV');
    await app.wait(() => app.find('[aria-label="Export current evidence"]'));
    assert.match(app.find('[aria-label="Export current evidence"]').textContent, /separate single query snapshot/);
    assert.match(app.find('[aria-label="Export current evidence"]').textContent, /Current page limits do not limit this export/);
    assert.equal(app.w.__fixture.requests.length, before);
    await app.click('button', 'Cancel');
    assert.equal(app.w.__fixture.requests.length, before);
    await app.click('button', 'Export complete 63-column CSV');
    await app.click('button', 'Download CSV');
    await app.wait(() => app.blobs.length === 1);
    const expected = replicaPath + '/export?' + new URLSearchParams({ clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', filters: '{}', sourceMode: 'configured', search: leadId, mode: 'compatible' });
    assert.deepEqual(Array.from(app.w.__fixture.requests.slice(before)), [expected]);
    assert.equal((await app.blobText(app.blobs[0])).replace(/^\uFEFF/, ''), csv.replace(/^\uFEFF/, ''));
    assert.deepEqual(app.filenames, ['synthetic-source.csv']);
  } finally { app.close(); }
});

test('a source export review cannot survive a scope change or request failure', async () => {
  const app = await mount('/lead-ledger' + scope);
  try {
    await app.wait(() => app.find('.cx-ledger-source-table tbody tr'));
    await app.click('button', 'Export complete 63-column CSV');
    await app.wait(() => app.find('[aria-label="Export current evidence"]'));
    app.w.__fixture.fail = ['lead-ledger/replica'];
    app.w.__fixture.navigate('/lead-ledger?clientId=synthetic-a&startDate=2026-09-27&endDate=2026-09-28');
    await app.wait(() => !app.find('[aria-label="Export current evidence"]') && app.find('[role="alert"]'));
    assert.equal(app.find('button', 'Export complete 63-column CSV').disabled, true);
    assert.equal(app.w.__fixture.requests.some((request: string) => request.includes('/replica/export')), false);
    assert.equal(app.blobs.length, 0);
  } finally { app.close(); }
});

test('Explorer review does not invent absent export metadata or bypass existing export validation', async () => {
  const app = await mount('/lead-explorer' + scope);
  try {
    await app.wait(() => app.find('button', 'Export current view'));
    const before = app.w.__fixture.requests.length;
    await app.click('button', 'Export current view');
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

test('non-admin Explorer cannot expose the source-evidence action', async () => {
  const app = await mount('/lead-explorer' + scope, { nonAdmin: true });
  try {
    await app.wait(() => app.find('button', `Open timeline for lead ${leadId}`));
    await app.click('button', `Open timeline for lead ${leadId}`);
    await app.wait(() => app.find('[role="dialog"][aria-label="Lead timeline"]'));
    assert.equal(app.find('a', 'Open source evidence'), undefined);
    assert.equal(app.w.__fixture.requests.some((request: string) => request.startsWith(replicaPath)), false);
  } finally { app.close(); }
});

test('partial source export retains its warning and existing available-fields export mode', async () => {
  const coverage = { source: 'synthetic partial source', available: LEDGER_HEADERS.filter(header => header !== 'HLC RPC'), missing: ['HLC RPC'], compatible: false, richViewEnabled: false };
  const app = await mount('/lead-ledger' + scope, { payloads: { [replicaPath + '/coverage']: coverage } });
  try {
    await app.wait(() => app.find('button', 'Export all rows · partial fields'));
    assert.equal(app.find('button', 'Export complete 63-column CSV').disabled, true);
    const before = app.w.__fixture.requests.length;
    await app.click('button', 'Export all rows · partial fields');
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
