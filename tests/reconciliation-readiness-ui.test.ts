import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';
import { RECONCILIATION_GRAIN, RECONCILIATION_IMPORT_VERSION } from '../contracts/reconciliationEvidence';
import { METRIC_REGISTRY_VERSION } from '../contracts/metricRegistry';

const output = await mkdtemp(path.join(tmpdir(), 'cx3-reconciliation-ui-'));
await buildAcceptanceFixture(output);
const script = await readFile(path.join(output, 'fixture.js'), 'utf8');
test.after(() => rm(output, { recursive: true, force: true }));
const scope = '?clientId=synthetic-a&startDate=2026-09-01&endDate=2026-09-30';
const imported = JSON.stringify({
  tenant: 'synthetic-a', period: { start: '2026-09-01', end: '2026-09-30' }, filters: {},
  generatedAt: '2026-10-02T10:00:00Z', asOf: '2026-10-02T10:00:00Z', timezone: 'Africa/Johannesburg',
  definitionVersion: METRIC_REGISTRY_VERSION, harnessVersion: RECONCILIATION_IMPORT_VERSION,
  countingGrain: RECONCILIATION_GRAIN, dateBasis: 'INTAKE_CAPTURE_COHORT', truncation: false,
  validationStatus: 'NOT_VERIFIED', sourceContractStatus: 'BUSINESS_MEANING_NOT_VERIFIED',
  sourceTables: ['synthetic_project.synthetic_dataset.synthetic_table'], maximumBytesBilled: '1000000000',
  reconciliationStatus: 'WAREHOUSE_MEASURED_ONLY', warehouseQueryId: 'synthetic-job', metrics: { fetched: '0' }, comparisons: null, comparedMetrics: [],
});

async function mount(nonAdmin = false, suffix = '') {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { if (!error.message.includes('navigation')) errors.push(error.message); });
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any;
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, __fixture: { initialRoute: '/validation' + scope + suffix, nonAdmin } });
  w.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLElement.prototype.scrollTo = () => {};
  w.scrollTo = () => {};
  w.eval(script);
  const wait = async (check: () => unknown) => {
    for (let index = 0; index < 200; index++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw new Error(`Expected reconciliation UI. ${w.document.body.textContent?.slice(0, 800)} ${errors.join('\n')}`);
  };
  await wait(() => w.document.body.textContent.includes('Reconciliation operator'));
  return { w, errors, wait, close: () => { w.__fixture.unmount(); dom.window.close(); } };
}

test('admin prepares a bounded command and imports local evidence without making a warehouse request', async () => {
  const app = await mount();
  try {
    await app.wait(() => app.w.document.querySelector('input[type="file"]'));
    await app.wait(() => app.w.__fixture.requests.some((request: string) => request.startsWith('/api/analytics/validation?')));
    const before = [...app.w.__fixture.requests];
    assert.match(app.w.document.querySelector('pre[aria-label="Reconciliation command"]').textContent, /--client 'synthetic-a'.*--dry-run/);
    const input = app.w.document.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [{ size: imported.length, text: async () => imported }], configurable: true });
    input.dispatchEvent(new app.w.Event('change', { bubbles: true }));
    await app.wait(() => app.w.document.body.textContent.includes('Warehouse measured'));
    assert.match(app.w.document.body.textContent, /OPERATOR|Operator file/);
    assert.match(app.w.document.body.textContent, /NOT_VERIFIED · local import is not trusted certification/);
    assert.match(app.w.document.body.textContent, /PersistenceUNAVAILABLE/);
    assert.match(app.w.document.querySelector('[aria-label="Exact imported warehouse measurements"]').textContent, /fetched0/);
    assert.deepEqual([...app.w.__fixture.requests], before);
    app.w.__fixture.navigate('/validation?clientId=synthetic-b&startDate=2026-09-01&endDate=2026-09-30');
    await app.wait(() => app.w.document.querySelector('pre[aria-label="Reconciliation command"]')?.textContent.includes("'synthetic-b'"));
    assert.doesNotMatch(app.w.document.body.textContent, /Warehouse measured|synthetic-job/);
    assert.match(app.w.document.body.textContent, /Operator file stateNot run/);
    assert.deepEqual(app.errors, []);
  } finally { app.close(); }
});

test('ordinary user cannot prepare a reconciliation command or import operator evidence', async () => {
  const app = await mount(true);
  try {
    assert.match(app.w.document.body.textContent, /Administrator access is required/);
    assert.equal(app.w.document.querySelector('input[type="file"]'), null);
    assert.equal(app.w.document.querySelector('pre[aria-label="Reconciliation command"]'), null);
  } finally { app.close(); }
});

test('unsupported private scope prevents command preparation instead of silently dropping the search', async () => {
  const app = await mount(false, '&search=private-record');
  try {
    assert.match(app.w.document.body.textContent, /cannot apply these URL parameters: search/);
    assert.equal(app.w.document.querySelector('input[type="file"]'), null);
    assert.equal(app.w.document.querySelector('pre[aria-label="Reconciliation command"]'), null);
  } finally { app.close(); }
});
