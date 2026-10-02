import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';
import { convergenceJourneyPayload, convergencePayloads } from './frontend/convergenceFixtures';
import { validJourneySelection, selectionDrill, selectionTransition, supportedJourneyLenses, selectionMetric } from '../src/workspaces/journey/journeySelection';
import { operationAttemptItems, attemptInvestigationPath } from '../src/workspaces/operations/operationsPresentation';
import { buildOperatingControlsResult } from '../server/analytics/contact/operatingControls';

test('Journey selection retains only supported presentation identifiers and exact existing drills', () => {
  assert.equal(validJourneySelection('sales-to-activated'), 'sales-to-activated');
  assert.equal(validJourneySelection('private-lead-id'), 'fetched');
  assert.deepEqual(selectionDrill('rpc'), { drill: 'funnel-stage', drillValue: 'rpc' });
  assert.deepEqual(selectionDrill('delivered-to-dialled'), { drill: 'funnel-loss', drillValue: 'delivered-to-dialled' });
  assert.equal(selectionMetric('activated'), 'activations');
  assert.equal(selectionTransition('delivered-to-dialled', convergenceJourneyPayload.lifecycle)?.converted, 6);
  assert.equal(convergenceJourneyPayload.lifecycle?.comparisons.dialled.current, 7);
  assert.equal(selectionTransition('rpc', convergenceJourneyPayload.lifecycle), undefined);
});

test('Journey analytical lenses are restricted to supplied supported dimensions', () => {
  assert.deepEqual(supportedJourneyLenses(), ['comparison', 'timing']);
  const data = { ...convergenceJourneyPayload.lifecycle!, segments: { vendor: [], source: [], grade: [], captureHour: [] }, unsupportedDimensions: ['grade', 'campaign'] };
  assert.deepEqual(supportedJourneyLenses(data), ['comparison', 'vendor', 'source', 'captureHour', 'timing']);
  assert.ok(!supportedJourneyLenses(data).includes('campaign' as any));
});

test('Operations preserves recorded zero separately from missing cumulative counters and never broadens unsupported buckets', () => {
  const rows = Object.freeze([{ bucket: '0 calls', leads: 0 }, { bucket: 'Unrecorded', leads: 7 }]);
  const before = JSON.stringify(rows);
  const items = operationAttemptItems(rows as any);
  assert.equal(items[0].value, 0);
  assert.equal(items[1].value, 7);
  assert.equal(items[1].appearance, 'unrecorded');
  assert.equal(attemptInvestigationPath('0 calls'), '/investigate?drill=zero-call-leads');
  assert.equal(attemptInvestigationPath('Unrecorded'), '/investigate?drill=call-effort&drillValue=Unrecorded');
  assert.equal(attemptInvestigationPath('4+ calls'), null);
  assert.equal(JSON.stringify(rows), before);
});

const output = await mkdtemp(path.join(tmpdir(), 'cx3-product-journey-operations-'));
await buildAcceptanceFixture(output);
const script = await readFile(path.join(output, 'fixture.js'), 'utf8');
test.after(() => rm(output, { recursive: true, force: true }));
const scope = '?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-28&vendor=VendorA';
// Source-shaped synthetic evidence uses the real result adapter; no production warehouse read.
const controls = buildOperatingControlsResult({ total_leads: 10, delivered_leads: 8, dialled_leads: 6, unrecorded_call_leads: 3,
  zero_call_leads: 0, awaiting_first_dial: 2,
  attempts: [{ bucket: '0 calls', leads: 0, contacted: 0, sales: 0, activations: 0 }, { bucket: 'Unrecorded', leads: 3, contacted: 1, sales: 0, activations: 0 }],
  sla_bands: [{ band: '0–15m', leads: 6, contacted: 2, sales: 0 }, { band: 'Undialled', leads: 2, contacted: 0, sales: 0 }],
  vendor_controls: [{ vendor: 'VendorA', leads: 10, dialled: 6, delivered: 8, contacted: 2, sales: 0, unrecorded_call_leads: 3, zero_call_leads: 0 }],
  hourly_flow: [{ hour: 9, captured: 10, first_dials: 6 }],
}, { timezone: 'Africa/Johannesburg' }, { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] });

async function mount(route: string, options: Record<string, unknown> = {}) {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { if (!error.message.includes('navigation')) errors.push(error.message); });
  virtualConsole.on('error', (...args: unknown[]) => errors.push(args.join(' ')));
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any;
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, structuredClone, ReadableStream, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, __fixture: { initialRoute: route, payloads: { ...convergencePayloads, '/api/analytics/offernet/operating-controls': controls }, ...options } });
  w.matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLElement.prototype.scrollTo = () => {};
  w.scrollTo = () => {};
  w.HTMLElement.prototype.getClientRects = function () { return this.isConnected && !this.closest('[hidden]') ? [new w.DOMRect(0, 0, 100, 30)] : []; };
  w.URL.createObjectURL = () => 'blob:synthetic'; w.URL.revokeObjectURL = () => {};
  w.eval(script);
  const text = () => w.document.querySelector('main')?.textContent || w.document.body.textContent || '';
  const wait = async (check: () => unknown) => { for (let index = 0; index < 180; index++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error(`Product UI did not settle: ${text().slice(0, 2200)} ${errors.join('; ')}`); };
  const button = (label: string) => [...w.document.querySelectorAll('button')].find((element: any) => element.textContent?.includes(label)) as any;
  await wait(() => w.__fixture.navigate);
  return { w, text, wait, button, async click(element: any) { assert.ok(element); element.click(); await new Promise(resolve => setTimeout(resolve, 30)); }, close() { w.__fixture.unmount(); dom.window.close(); assert.deepEqual(errors, []); } };
}

test('Journey selection updates in place, loads only selected transition context and retains scope across lens changes', async () => {
  const app = await mount('/journey' + scope);
  try {
    await app.wait(() => app.w.document.querySelector('.cx-journey-selected'));
    const requests = app.w.__fixture.requests.length;
    await app.click(app.w.document.querySelector('[data-stage="dialled"] .cx-lifecycle-node'));
    assert.equal(app.w.document.querySelector('#journey-selected-heading').textContent, 'Dialled');
    assert.match(app.w.document.querySelector('.cx-journey-selected-values').textContent, /Current population7/);
    assert.equal(app.w.__fixture.requests.length, requests, 'stage selection uses the loaded lifecycle result');
    assert.equal(app.w.document.querySelector('.cx-journey-workspace-heading'), null, 'default workbench has no redundant upper Journey strip');
    await app.click(app.button('Delivered → Dialled'));
    assert.equal(app.w.document.querySelector('#journey-selected-heading').textContent, 'Delivered → Dialled');
    assert.match(app.w.document.querySelector('.cx-journey-selected-values').textContent, /Qualified intersection6/);
    assert.match(app.w.document.querySelector('.cx-journey-selected-values').textContent, /No recorded progression2/);
    assert.equal(app.w.document.querySelector('.cx-journey-analysis-content').dataset.lens, 'timing');
    await app.wait(() => app.w.document.querySelector('[aria-label="Response speed in this cohort"] .cx-percentile-rail'));
    const countRequests = (resource: string) => app.w.__fixture.requests.filter((url: string) => url.startsWith(`/api/analytics/offernet/${resource}?`)).length;
    assert.equal(countRequests('funnel'), 1);
    assert.equal(countRequests('speed-to-lead'), 1, 'only the selected response context is requested');
    assert.equal(countRequests('contact-strategy'), 0); assert.equal(countRequests('sales-activation'), 0);
    const link = app.w.document.querySelector('.cx-journey-selected-actions a');
    const params = new URL(link.href).searchParams;
    assert.equal(params.get('drill'), 'funnel-loss'); assert.equal(params.get('drillValue'), 'delivered-to-dialled');
    assert.equal(params.get('vendor'), 'VendorA'); assert.equal(params.get('clientId'), 'synthetic-a');
    assert.equal(params.get('startDate'), '2026-09-28');
    app.w.__fixture.navigate('/journey/outcomes' + scope);
    await app.wait(() => app.w.document.querySelector('.cx-journey-context-note'));
    assert.match(app.w.document.querySelector('.cx-journey-workspace-heading').textContent, /Delivered → Dialled/);
    app.w.__fixture.navigate('/journey' + scope);
    await app.wait(() => app.w.document.querySelector('#journey-selected-heading')?.textContent === 'Delivered → Dialled');
    assert.match(app.text(), /Qualification population Unavailable/);
    assert.match(app.text(), /Routed population Unavailable/);
  } finally { app.close(); }
});

test('Journey transitions show actual effort and ageing below selection without deriving missing populations or rates', async () => {
  const app = await mount('/journey' + scope);
  try {
    await app.wait(() => app.w.document.querySelector('.cx-journey-selected'));
    await app.click(app.button('Dialled → RPC'));
    await app.wait(() => app.w.document.querySelector('[aria-label="Journey call effort outcomes"]'));
    const table = app.w.document.querySelector('[aria-label="Journey call effort outcomes"]');
    assert.match(table.textContent, /RPC \/ dialled.*Sale \/ bucket leads/);
    assert.equal(table.querySelector('tbody tr').querySelectorAll('td')[1].textContent, 'Unavailable', 'missing qualified dialled base stays unavailable');
    await app.click(app.button('Sale → Activation'));
    await app.wait(() => app.w.document.querySelector('[aria-label="Activation ageing in this cohort"] .cx-evidence-bars'));
    const context = app.w.document.querySelector('[aria-label="Activation ageing in this cohort"]');
    assert.match(context.textContent, /Recorded sales 100.*Recorded activations 70/);
    assert.deepEqual([...context.querySelectorAll('.cx-evidence-bar-value')].map((node: any) => node.textContent), ['12', '8', '6', '4', '3', '2']);
    assert.match(context.textContent, /not filtered to|Context does not imply/);
    const salesRequests = () => app.w.__fixture.requests.filter((url: string) => url.startsWith('/api/analytics/offernet/sales-activation?')).length;
    assert.equal(salesRequests(), 1);
    app.w.__fixture.navigate('/journey/outcomes' + scope);
    await app.wait(() => app.w.document.querySelector('.cx-outcome-branch-map'));
    assert.equal(salesRequests(), 1, 'Outcomes reuses the exact scoped transition resource');
  } finally { app.close(); }
});

test('canonical Outcomes and both legacy URLs mount the same lazy sales feature with independent evidence and exact scope', async () => {
  for (const route of ['/journey/outcomes', '/sales-activation', '/outcomes']) {
    const app = await mount(route + scope);
    try {
      const doc = app.w.document;
      await app.wait(() => doc.querySelector('.cx-product-journey .cx-sales-page .cx-outcome-branch-map'));
      assert.equal(doc.querySelectorAll('.cx-sales-page').length, 1, route);
      const nodes = [...doc.querySelectorAll('.cx-outcome-branch-node')] as HTMLElement[];
      assert.deepEqual(nodes.map(node => node.querySelector('strong')?.textContent), ['100', '70', '35', '85'], route + ' preserves returned independent populations, including the actual pending queue');
      assert.match(nodes[1].textContent!, /70\.0% activation \/ sale ratio · independent counts/);
      assert.match(doc.querySelector('[aria-label="Activation ageing queue"]')?.textContent || '', /35.*2 future timestamp anomaly/);
      const requests = app.w.__fixture.requests as string[];
      const salesRequests = requests.filter(url => url.startsWith('/api/analytics/offernet/sales-activation?'));
      assert.equal(salesRequests.length, 1, route);
      const requestScope = new URL(salesRequests[0], 'https://synthetic.invalid').searchParams;
      for (const key of ['clientId', 'startDate', 'endDate']) assert.equal(requestScope.get(key), new URLSearchParams(scope.slice(1)).get(key), `${route} retains ${key}`);
      assert.deepEqual(JSON.parse(requestScope.get('filters')!).vendor, { operator: 'in', values: ['VendorA'] }, route + ' sends the exact normalized vendor predicate');
      assert.equal(requests.filter(url => url.startsWith('/api/analytics/offernet/funnel?')).length, 0, 'Outcomes does not mount lifecycle analytics in parallel');
      const before = requests.length;
      await app.click(nodes[0]);
      await app.wait(() => doc.querySelector('[aria-labelledby="inspector-title"]'));
      const dialog = doc.querySelector('[aria-labelledby="inspector-title"]');
      assert.match(dialog.textContent, /Recorded sales.*100/);
      const drill = [...dialog.querySelectorAll('a')].find((link: any) => new URL(link.href).searchParams.get('drill') === 'funnel-stage') as HTMLAnchorElement;
      assert.ok(drill, route + ' keeps the existing sale population investigation action');
      const drillScope = new URL(drill.href).searchParams;
      assert.equal(drillScope.get('drillValue'), 'sales');
      for (const key of ['clientId', 'startDate', 'endDate']) assert.equal(drillScope.get(key), new URLSearchParams(scope.slice(1)).get(key), `${route} drill retains ${key}`);
      assert.deepEqual(JSON.parse(drillScope.get('filters')!).vendor, { operator: 'in', values: ['VendorA'] }, route + ' drill retains the exact normalized vendor predicate');
      assert.equal(requests.length, before, 'inspection opens local evidence without repeating analytics');
    } finally { app.close(); }
  }
});

test('Operations loads one shared summary and controls resource, preserving zero versus unrecorded and exact investigation scope', async () => {
  const app = await mount('/operations' + scope);
  try {
    await app.wait(() => app.button('UnrecordedCall counter unavailable'));
    const countRequests = (resource: string) => app.w.__fixture.requests.filter((url: string) => url.startsWith(`/api/analytics/offernet/${resource}?`)).length;
    assert.equal(countRequests('overview'), 1); assert.equal(countRequests('operating-controls'), 1);
    assert.equal(countRequests('contact-strategy'), 0); assert.equal(countRequests('speed-to-lead'), 0);
    const zero = app.w.document.querySelector('.cx-operations-two-column .cx-evidence-bar-track[data-state="zero"] .cx-evidence-bar-fill');
    assert.equal(zero.style.width, '0%');
    assert.match(app.text(), /Call counter unavailable/);
    assert.match(app.text(), /Calls \/ fetched leadUnavailable/);
    await app.click(app.button('UnrecordedCall counter unavailable'));
    await app.wait(() => app.w.__fixture.location.startsWith('/investigate?'));
    const params = new URL(app.w.__fixture.location, 'https://synthetic.invalid').searchParams;
    assert.equal(params.get('drill'), 'call-effort'); assert.equal(params.get('drillValue'), 'Unrecorded'); assert.equal(params.get('vendor'), 'VendorA');
  } finally { app.close(); }
});

test('Operations dispositions path mounts only its own mode and preserves contact feature access', async () => {
  const app = await mount('/operations/dispositions' + scope);
  try {
    await app.wait(() => app.w.__fixture.requests.some((url: string) => url.includes('/contact-dispositions?')));
    assert.equal(app.w.__fixture.requests.filter((url: string) => url.includes('/contact-strategy?')).length, 0);
    assert.equal(app.w.__fixture.requests.filter((url: string) => url.includes('/operating-controls?')).length, 0);
    assert.equal(app.w.__fixture.requests.filter((url: string) => url.includes('/overview?')).length, 0);
    assert.match(app.text(), /Vendor outcomes/);
  } finally { app.close(); }
});
