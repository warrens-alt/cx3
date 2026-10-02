import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';
import { LEDGER_HEADERS, ledgerCsvCell } from '../contracts/leadLedgerReplica';

const output = await mkdtemp(path.join(tmpdir(), 'cx3-source-export-feedback-'));
await buildAcceptanceFixture(output);
const script = await readFile(path.join(output, 'fixture.js'), 'utf8');
test.after(() => rm(output, { recursive: true, force: true }));
const route = (tenant: string, extra = '') => `/lead-explorer?clientId=${tenant}&startDate=2026-09-28&endDate=2026-09-28&view=source${extra}`;
const exportPath = '/api/analytics/lead-ledger/replica/export';
const csv = '\uFEFF' + LEDGER_HEADERS.map(ledgerCsvCell).join(',') + '\r\n' + LEDGER_HEADERS.map(header => ledgerCsvCell(header === 'Lead ID' ? 'SYNTHETIC-EXPORT' : null)).join(',') + '\r\n';
const csvResponse = (jobId: string) => new Response(csv, { headers: { 'Content-Type': 'text/csv', 'X-Export-Truncated': 'false', 'X-Export-Row-Count': '1', 'X-Export-Query-Job': jobId, 'Content-Disposition': 'attachment; filename="synthetic-source.csv"' } });

async function mount() {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { if (!error.message.includes('navigation')) errors.push(error.message); });
  virtualConsole.on('error', (...items) => errors.push(items.map(String).join(' ')));
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any;
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream, structuredClone, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, __fixture: { initialRoute: route('synthetic-a'), sourceLeadCount: 2 } });
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.HTMLElement.prototype.scrollTo = () => {}; w.scrollTo = () => {};
  w.HTMLElement.prototype.getClientRects = function () { return this.isConnected && !this.closest('[hidden], [inert]') ? [new w.DOMRect(0, 0, 100, 30)] : []; };
  const downloads: unknown[] = [];
  w.URL.createObjectURL = (blob: unknown) => { downloads.push(blob); return 'blob:synthetic'; }; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { assert.equal(this.download, 'synthetic-source.csv'); };
  w.eval(script);
  const text = () => w.document.body.textContent || '';
  const findButton = (label: string): any => [...w.document.querySelectorAll('button')].find((element: any) => (element.getAttribute('aria-label') || element.textContent || '').trim() === label);
  const wait = async (check: () => unknown, label = 'Source export feedback') => {
    for (let attempt = 0; attempt < 150; attempt++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw new Error(`${label}\n${text().slice(0, 3000)}\n${errors.join('; ')}`);
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 70));
  const click = async (label: string) => { const button = findButton(label); assert.ok(button, label); assert.equal(button.disabled, false, label); button.focus(); button.click(); await settle(); };
  await wait(() => findButton('Export source-compatible data')?.disabled === false);
  const deferred: Array<{ tenant: string; signal: AbortSignal; resolve: (response: Response) => void; reject: (error: Error) => void }> = [];
  const fallback = w.fetch;
  // Deliberately ignore abort while a response is pending. This models a late
  // transport response and proves scope/controller guards, not only fetch abort.
  w.fetch = (input: unknown, options: any) => {
    const url = new URL(String(input), 'https://synthetic.invalid');
    if (url.pathname !== exportPath) return fallback(input, options);
    w.__fixture.requests.push(url.pathname + url.search);
    return new Promise<Response>((resolve, reject) => deferred.push({ tenant: url.searchParams.get('clientId')!, signal: options.signal, resolve, reject }));
  };
  const begin = async () => {
    const before = deferred.length;
    await click('Export source-compatible data');
    await wait(() => w.document.querySelector('[aria-label="Export current evidence"]'));
    await click('Download CSV');
    await wait(() => deferred.length === before + 1 && text().includes('Preparing one complete query snapshot'));
    return deferred.at(-1)!;
  };
  const navigate = async (tenant: string, extra = '') => {
    w.__fixture.navigate(route(tenant, extra));
    await wait(() => new URL(w.__fixture.location, 'https://synthetic.invalid').searchParams.get('clientId') === tenant && [...w.document.querySelectorAll('.cx-ledger-provenance div')].some((field: any) => field.querySelector('dt')?.textContent === 'Workspace / client' && field.querySelector('dd')?.textContent === tenant) && findButton('Export source-compatible data')?.disabled === false);
    await settle();
  };
  return { w, text, findButton, wait, settle, click, begin, navigate, deferred, downloads, close() { w.__fixture.unmount(); dom.window.close(); assert.deepEqual(errors, []); } };
}

test('a deferred source export cannot publish or disable export controls after a tenant switch', async () => {
  const app = await mount();
  try {
    const oldExport = await app.begin();
    assert.equal(oldExport.tenant, 'synthetic-a');
    assert.ok(app.findButton('Cancel export'));
    await app.navigate('synthetic-b');
    assert.equal(oldExport.signal.aborted, true);
    assert.doesNotMatch(app.text(), /Preparing one complete query snapshot|Export cancelled|old-tenant-job/);
    assert.equal(app.findButton('Cancel export'), undefined);
    const currentExport = await app.begin();
    assert.equal(currentExport.tenant, 'synthetic-b');
    oldExport.resolve(csvResponse('old-tenant-job'));
    await app.settle();
    assert.ok(app.findButton('Cancel export'), 'Late old-scope finally cannot stop the current download');
    assert.equal(app.findButton('Export source-compatible data').disabled, true);
    assert.doesNotMatch(app.text(), /old-tenant-job|Export cancelled/);
    assert.equal(app.downloads.length, 0);
    currentExport.resolve(csvResponse('current-tenant-job'));
    await app.wait(() => app.text().includes('Complete: 1 source rows. Query job: current-tenant-job.'));
    assert.equal(app.downloads.length, 1);
    assert.equal(app.findButton('Cancel export'), undefined);
    await app.navigate('synthetic-a');
    assert.doesNotMatch(app.text(), /current-tenant-job|old-tenant-job|Complete: 1 source rows/);
    await app.navigate('synthetic-b');
    assert.doesNotMatch(app.text(), /current-tenant-job|old-tenant-job|Complete: 1 source rows/, 'Returning to an earlier scope does not restore its stale export feedback');
  } finally { app.close(); }
});

test('same-scope cancellation and errors stay visible, then clear with the reporting scope', async () => {
  const app = await mount();
  try {
    const cancelled = await app.begin();
    await app.click('Cancel export');
    assert.equal(cancelled.signal.aborted, true);
    cancelled.resolve(csvResponse('cancelled-job'));
    await app.wait(() => app.text().includes('Export cancelled. No file was saved.'));
    assert.equal(app.findButton('Export source-compatible data').disabled, false);
    assert.equal(app.downloads.length, 0);
    const failed = await app.begin();
    failed.reject(new app.w.Error('Synthetic export failure for current scope'));
    await app.wait(() => app.text().includes('Synthetic export failure for current scope'));
    assert.equal(app.findButton('Export source-compatible data').disabled, false);
    assert.equal(app.findButton('Cancel export'), undefined);
    await app.navigate('synthetic-a', '&sourceSearch=changed-source-scope');
    assert.doesNotMatch(app.text(), /Synthetic export failure for current scope|Export cancelled/);
    assert.equal(app.downloads.length, 0);
  } finally { app.close(); }
});
