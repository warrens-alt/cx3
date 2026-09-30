import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';
import { groupIntegrityChecks, type IntegrityCheck } from '../src/features/trust/integrityAuditPresentation';
import { matchesWarehouseObject, parseWarehouseSource, warehouseAnalysisReturn, warehouseSchemaPath } from '../src/features/evidenceWorkspace/warehouseAuditNavigation';

const source = 'synthetic-project.synthetic_dataset.synthetic_table';
const filters = { vendor: { operator: 'in', values: ['Synthetic A', 'Synthetic B'] }, source: { operator: 'not_equals', value: 'Excluded source' } };
const scope = `?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-29&filters=${encodeURIComponent(JSON.stringify(filters))}`;
const checks: IntegrityCheck[] = [
  { checkName: 'Measured zero', category: 'Lead grain', status: 'HEALTHY', discrepancyCount: 0, evidence: 'OBSERVED', detail: 'Zero distinct scoped leads have the measured gap.' },
  { checkName: 'Measured gaps', category: 'Lead grain', status: 'WARNING', discrepancyCount: 2, evidence: 'OBSERVED', detail: 'Two distinct scoped leads have the measured gap.' },
  { checkName: 'Missing count', category: 'Coverage', status: 'UNAVAILABLE', discrepancyCount: null, evidence: 'UNAVAILABLE', detail: 'The count cannot be measured in this cohort.' },
  { checkName: 'Limited measurement', category: 'Coverage', status: 'UNAVAILABLE', discrepancyCount: 0, evidence: 'OBSERVED', detail: 'The supplied zero does not complete the missing contract.' },
];
const dataset = { project: 'synthetic-project', dataset: 'synthetic_dataset', totalObjects: 1, tablesCount: 1, viewsCount: 0, totalColumns: 1, families: [], sampleObjects: ['synthetic_table'], status: 'CATALOGUE_ONLY', description: 'Synthetic registered schema evidence.' };
const table = { project: dataset.project, dataset: dataset.dataset, tableName: 'synthetic_table', tableType: 'TABLE', columns: [{ name: 'synthetic_field', type: 'STRING' }], family: 'synthetic', disposition: 'synthetic', analyticalGrain: 'Synthetic source rows', dateFields: [], candidateKeys: [], sensitiveFields: [] };
const payloads = {
  '/api/analytics/offernet/data-integrity': { totalRecordsAudited: 2, overallHealthScore: null, healthGrade: 'NOT_VERIFIED', validationStatus: 'NOT_VERIFIED', reason: 'Synthetic operational evidence; no certification.', checks, sources: [{ key: 'leads', label: 'Synthetic exact source', status: 'OBSERVED', table: source, latestRecordAt: null, ageHours: null, rowCount: 0, detail: 'A measured row count does not prove freshness.' }, { key: 'missing', label: 'Synthetic unregistered source', status: 'UNAVAILABLE', table: 'synthetic-project.synthetic_dataset.not_registered', latestRecordAt: null, ageHours: null, rowCount: null, detail: 'No source read was supplied.' }, { key: 'malformed', label: 'Synthetic partial source', status: 'MAPPING_REQUIRED', table: 'synthetic_dataset.only_two_parts', latestRecordAt: null, ageHours: null, rowCount: null, detail: 'No fully qualified source identifier.' }] },
  '/api/analytics/warehouse/overview': { generatedAt: '2026-09-30T06:00:00Z', evidence: { status: 'CATALOGUE_ONLY', snapshotDate: '2026-09-29', liveDataQueried: false, reason: 'Synthetic saved catalogue; source access is unmeasured.' }, kpis: { totalProjects: 1, totalDatasets: 1, totalWarehouseObjects: 1 }, datasets: [dataset], projects: [], tableInventoryPreview: [] },
  '/api/analytics/warehouse/tables': [table],
};

test('integrity grouping preserves zero, null, order, duplicates and original check objects', () => {
  const input = [...checks, checks[0]];
  const snapshot = JSON.stringify(input);
  const grouped = groupIntegrityChecks(input);
  assert.deepEqual(grouped.measured, [checks[0], checks[1], checks[0]]);
  assert.deepEqual(grouped.limitations, [checks[2], checks[3]]);
  assert.equal(grouped.limitations[1].discrepancyCount, 0);
  assert.equal(grouped.measured[0], checks[0]);
  assert.equal(JSON.stringify(input), snapshot);
});

test('source navigation carries exact identity and safely returns complete analysis scope', () => {
  const destination = warehouseSchemaPath(source, 'synthetic-a', '/data-integrity' + scope + '&workspace=one&workspace=two');
  assert.ok(destination);
  const params = new URL(destination, 'https://synthetic.invalid').searchParams;
  assert.equal(params.get('tab'), 'tables');
  assert.equal(params.get('project'), 'synthetic-project');
  assert.equal(params.get('dataset'), 'synthetic_dataset');
  assert.equal(params.get('table'), 'synthetic_table');
  const back = new URL(params.get('analysisReturn')!, 'https://synthetic.invalid');
  assert.deepEqual(JSON.parse(back.searchParams.get('filters')!), filters);
  assert.deepEqual(back.searchParams.getAll('workspace'), ['one', 'two']);
  for (const invalid of [null, '', 'dataset.table', 'project.dataset.*', 'project.dataset.table.extra', 'project.dataset.table?tab=pull', '`project.dataset.table`']) assert.equal(parseWarehouseSource(invalid), null);
  for (const unsafe of ['https://external.invalid/data-integrity', '//external.invalid/data-integrity', '/data-integrity/../admin', '/data-integrity-extra', '/admin']) assert.equal(warehouseAnalysisReturn(unsafe), null);
  assert.equal(matchesWarehouseObject(table, { ...table, tableName: 'SYNTHETIC_TABLE' }), false);
  assert.equal(matchesWarehouseObject(table, { ...table, project: 'another-project' }), false);
});

const output = await mkdtemp(path.join(tmpdir(), 'cx3-integrity-audit-'));
await buildAcceptanceFixture(output);
const script = await readFile(path.join(output, 'fixture.js'), 'utf8');
test.after(() => rm(output, { recursive: true, force: true }));
async function mount(route: string, options: Record<string, unknown> = {}) {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { if (!error.message.includes('navigation')) errors.push(error.message); });
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any;
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, __fixture: { initialRoute: route, payloads, ...options } });
  w.matchMedia = (media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLElement.prototype.scrollTo = () => {};
  w.scrollTo = () => {};
  w.HTMLElement.prototype.getClientRects = function () { return this.isConnected ? [new w.DOMRect(0, 0, 100, 30)] : []; };
  w.eval(script);
  const find = (selector: string, text?: string): any => [...w.document.querySelectorAll(selector)].find((el: any) => text === undefined || (el.getAttribute('aria-label') || el.textContent || '').includes(text));
  const wait = async (condition: () => unknown) => { for (let i = 0; i < 150; i++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error(w.document.body.textContent + '\n' + errors.join('\n')); };
  const settle = () => new Promise(resolve => setTimeout(resolve, 60));
  const click = async (selector: string, text?: string) => { const element = find(selector, text); assert.ok(element, `Missing ${selector}: ${text}`); element.focus(); element.click(); await settle(); };
  return { w, find, wait, click, settle, close() { w.__fixture.unmount(); w.close(); } };
}

test('rendered integrity inspectors distinguish zero and unavailable without requests or invented drills', async () => {
  const app = await mount('/data-integrity' + scope, { nonAdmin: true });
  try {
    await app.wait(() => app.find('#measured-discrepancies tbody tr'));
    assert.equal(app.w.document.querySelectorAll('#measured-discrepancies tbody tr').length, 2);
    assert.equal(app.w.document.querySelectorAll('#evidence-limitations tbody tr').length, 2);
    assert.equal(app.w.document.querySelectorAll('.cx-source-evidence-table a').length, 2);
    assert.equal(app.find('button', 'Why changed'), undefined);
    await app.settle();
    const count = app.w.__fixture.requests.length;
    await app.click('button', 'Inspect evidence for Measured zero');
    await app.wait(() => app.find('[role="dialog"]'));
    assert.equal(app.find('.cx-audit-result>strong').textContent, '0');
    assert.match(app.find('[role="dialog"]').textContent, /Measured zero/);
    assert.match(app.find('[role="dialog"]').textContent, /Record drill is not available for this check/);
    assert.match(app.find('[role="dialog"]').textContent, /Synthetic A, Synthetic B/);
    assert.equal(app.find('[role="dialog"] a[href*="lead-explorer"]'), undefined);
    assert.equal(app.find('[data-validation]').getAttribute('data-validation'), 'NOT_VERIFIED');
    await app.click('button', 'Close inspector');
    await app.click('button', 'Inspect evidence for Missing count');
    assert.equal(app.find('.cx-audit-result>strong').textContent, '—');
    assert.match(app.find('.cx-audit-result').textContent, /Unavailable/);
    assert.equal(app.w.__fixture.requests.length, count);
    app.w.__fixture.navigate('/data-integrity' + scope.replace('2026-09-29', '2026-09-30'));
    await app.wait(() => !app.find('[role="dialog"]'));
  } finally { app.close(); }
});

test('exact source schema navigation reads only catalogue metadata and restores complete scope', async () => {
  const app = await mount('/data-integrity' + scope, { nonAdmin: true });
  try {
    await app.wait(() => app.find('.cx-source-evidence-table a'));
    await app.click('.cx-source-evidence-table a');
    await app.wait(() => app.find('.cx-warehouse-schema[data-audit-selected="true"]'));
    const selected = app.find('.cx-warehouse-schema[data-audit-selected="true"]');
    assert.equal(selected.open, true);
    assert.match(selected.textContent, /synthetic_table/);
    assert.match(app.find('.cx-warehouse-audit-context').textContent, /exact object is registered/);
    assert.deepEqual([...app.w.__fixture.requests].filter((url: string) => url.includes('/warehouse/')).map((url: string) => new URL(url, 'https://synthetic.invalid').pathname).sort(), ['/api/analytics/warehouse/overview', '/api/analytics/warehouse/tables']);
    await app.click('a', 'Back to analysis');
    await app.wait(() => app.w.__fixture.location.startsWith('/data-integrity?'));
    const returned = new URL(app.w.__fixture.location, 'https://synthetic.invalid').searchParams;
    assert.deepEqual(JSON.parse(returned.get('filters')!), filters);
    assert.equal(returned.get('startDate'), '2026-09-28');
    assert.equal(returned.get('endDate'), '2026-09-29');
  } finally { app.close(); }
});

test('unregistered source remains unmatched; schema navigation does not grant source-read access', async () => {
  const app = await mount(warehouseSchemaPath(source, 'synthetic-a', '/data-integrity' + scope)!, { nonAdmin: true });
  try {
    await app.wait(() => app.find('.cx-warehouse-schema[data-audit-selected="true"]'));
    await app.click('button', 'Read a current source window');
    await app.wait(() => app.find('h2', 'Read-only source inspection'));
    assert.match(app.w.document.body.textContent, /require an administrator with explicit Offernet Master access/);
    assert.equal(app.w.__fixture.requests.filter((url: string) => url.includes('/warehouse/')).length, 2);
    app.w.__fixture.navigate(warehouseSchemaPath('synthetic-project.synthetic_dataset.not_registered', 'synthetic-a', '/data-integrity' + scope));
    await app.wait(() => app.find('.cx-warehouse-audit-context')?.textContent.includes('No exact registered object'));
    assert.equal(app.find('.cx-warehouse-schema[data-audit-selected="true"]'), undefined);
    assert.match(app.find('.cx-warehouse-audit-context').textContent, /not_registered/);
  } finally { app.close(); }
});

test('dataset evidence opens locally and keeps catalogue timestamps distinct from freshness', async () => {
  const app = await mount('/warehouse?clientId=synthetic-a');
  try {
    await app.wait(() => app.find('button', 'Inspect evidence for synthetic-project.synthetic_dataset'));
    await app.settle();
    const count = app.w.__fixture.requests.length;
    await app.click('button', 'Inspect evidence for synthetic-project.synthetic_dataset');
    assert.equal(app.find('.cx-audit-result>strong').textContent, '1');
    assert.match(app.find('[role="dialog"]').textContent, /CATALOGUE_ONLY/);
    assert.match(app.find('[role="dialog"]').textContent, /not source freshness/);
    assert.match(app.find('[role="dialog"]').textContent, /no supporting lead-record drill/);
    assert.equal(app.w.__fixture.requests.length, count);
    await app.click('button', 'Browse synthetic-project.synthetic_dataset schema');
    await app.wait(() => app.find('.cx-warehouse-schema'));
    assert.equal(app.find('[role="dialog"]'), undefined);
    assert.equal(app.w.__fixture.requests.filter((url: string) => url.includes('/warehouse/')).length, 2);
  } finally { app.close(); }
});

test('speed timing audit uses the selected returned event pair and opens without requests', async () => {
  const app = await mount('/speed-to-lead' + scope, { nonAdmin: true });
  try {
    await app.wait(() => app.find('.cx-speed-latency-visual button', 'Capture → Delivery'));
    await app.settle();
    const count = app.w.__fixture.requests.length;
    await app.click('.cx-speed-latency-visual button', 'Capture → Delivery');
    assert.equal(app.find('.cx-audit-result>strong').textContent, '0s');
    assert.match(app.find('[role="dialog"]').textContent, /Capture timestamp to delivery/);
    assert.match(app.find('[role="dialog"]').textContent, /Median seconds \(supplied\)0/);
    assert.equal(app.find('[role="dialog"] a[href*="lead-explorer"]'), undefined);
    assert.equal(app.w.__fixture.requests.length, count);
    await app.click('button', 'Close inspector');
    await app.click('button', 'Inspect evidence: P90 First Dial');
    assert.equal(app.find('.cx-audit-result>strong').textContent, '8.4h');
    assert.match(app.find('[role="dialog"]').textContent, /Delivery → First Dial/);
    assert.equal(app.w.__fixture.requests.length, count);
  } finally { app.close(); }
});
