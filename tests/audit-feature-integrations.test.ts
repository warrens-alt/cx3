import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildAcceptanceFixture } from '../scripts/build-frontend-acceptance-fixture.mjs';
import { lifecycleVisualAudit, salesVisualAudit } from '../src/features/evidenceWorkspace/metricVisualAudit';
import { speedCohortAudit } from '../src/features/contact/model/speedAudit';
import { commercialNodeAudit } from '../src/features/commercial/commercialAudit';
import JourneyAuditLens from '../src/features/journey/components/JourneyAuditLens';
import { requiredInputAvailability } from '../src/shared/evidence/auditVisualModel';

const scope = { clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-29', filters: { vendor: { operator: 'in', values: ['Synthetic A', 'Synthetic B'] } } };
const commercial = {
  status: 'UNAVAILABLE', reason: 'Costs unavailable', currency: 'ZAR',
  baseline: { mediaSpend: 0, cpl: 0, cpc: 0, revenue: 50, fixedOverhead: null, blendedCostPerSale: 0, revenueToMediaSpendRatio: null },
  media: { spendSourceTable: 'synthetic.marketing.platform', spendSourceColumn: 'approved_observed_spend', platformLeads: 10, platformClicks: 2, reason: 'Approved incurred spend' },
  economics: { status: 'AVAILABLE', reason: 'Approved matched keys', matchedSpend: 0, fetched: 10, sales: 2, activations: 0, recordedRevenue: 50 },
  attribution: { status: 'AVAILABLE', reason: 'Approved keys only', summary: { matchedKeys: 1, marketingOnlyKeys: 2, operationsOnlyKeys: 0 } },
  grainDiagnostics: { rowCount: 3, distinctGrainCount: 3, duplicateGrainRows: 0, missingGrainRows: 0, missingSpendRows: 0, fields: ['date', 'campaign'] },
  reconciliation: { status: 'RECONCILED', rawObservedSpend: 0, contractedGrainSpend: 0, campaignAggregationSpend: 0, commercialTotalSpend: 0, difference: 0, reason: 'Same-query arithmetic, not external billing.' },
  pAndLBreakdown: [],
} as any;

test('lifecycle audit preserves exact recorded and qualified values without invented exclusions or changed drill scope', () => {
  const original = { type: 'stage' as const, title: 'Dialled', value: '100', scope, recordDrill: { drill: 'funnel-stage', drillValue: 'dialled' } };
  const snapshot = JSON.stringify(original);
  const audit = lifecycleVisualAudit(original, 100, 'dialled', { recordedEvidence: { dialled: 110 } } as any);
  assert.equal(audit.anatomy?.numerator?.value, 100);
  assert.equal(audit.qualification?.recorded?.value, 110);
  assert.equal(audit.qualification?.qualified?.value, 100);
  assert.equal(audit.qualification?.excluded, undefined);
  assert.deepEqual(audit.qualification?.reasons, []);
  assert.deepEqual(audit.recordDrill, original.recordDrill);
  assert.deepEqual(audit.scope, scope);
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(lifecycleVisualAudit(original, 0, 'fetched').anatomy?.value, 0);
});

test('sales revenue audit separates overlapping recorded/zero coverage and retains missing optional counts as unavailable', () => {
  const content = { type: 'metric' as const, title: 'Source-recorded revenue', value: 'R 0', scope };
  const audit = salesVisualAudit(content, { reconciliation: { realizedRevenue: 0, salesWithRecordedRevenue: 5, unbilledSales: 2, unrecordedRevenueSales: 3 }, currency: 'ZAR' } as any)!;
  assert.deepEqual(audit.coverage?.categories.map(row => row.value), [5, 2, 3]);
  assert.equal(audit.coverage?.composition, 'separate');
  assert.equal(audit.anatomy?.value, 0);
  assert.equal(audit.anatomy?.completeness?.state, 'partial');
  const missing = salesVisualAudit(content, { reconciliation: { realizedRevenue: null } } as any)!;
  assert.deepEqual(missing.coverage?.categories.map(row => row.value), [null, null, null]);
  assert.equal(missing.anatomy?.completeness?.state, 'unavailable');
});

test('sales activation ratio retains independent supplied populations even when activations exceed sales', () => {
  const audit = salesVisualAudit({ type: 'metric', title: 'Activations / recorded sales', scope }, { reconciliation: { totalSales: 2, totalActivations: 3, activationRate: 150 } } as any)!;
  assert.equal(audit.metricId, 'activation_rate');
  assert.equal(audit.anatomy?.kind, 'independent_ratio');
  assert.equal(audit.anatomy?.value, 150);
  assert.equal(audit.anatomy?.numerator?.value, 3);
  assert.equal(audit.anatomy?.denominator?.value, 2);
  assert.equal(audit.recordDrill, undefined);
});

test('response speed RPC audit does not reverse engineer the missing denominator from the supplied rate', () => {
  const row = { cohort: '0–15 minutes', leads: 100, contacted: 5, contactRate: 50, sales: 0, saleRate: 0, activations: 0, activationRate: null };
  const audit = speedCohortAudit(row, 'rpc', scope);
  assert.equal(audit.value, '50.0%');
  assert.equal(audit.numeratorCount, 5);
  assert.equal(audit.denominatorCount, null);
  assert.equal(audit.anatomy?.denominator?.value, null);
  assert.equal(audit.recordDrill, undefined);
  assert.deepEqual(audit.scope, scope);
  const sale = speedCohortAudit(row, 'sales', scope);
  assert.equal(sale.anatomy?.numerator?.value, 0);
  assert.equal(sale.anatomy?.denominator?.value, 100);
});

test('commercial audit shows the returned approved field and same-query arithmetic without independent reconciliation claims', () => {
  const audit = commercialNodeAudit(commercial, 'spend', scope, 'ZAR');
  assert.equal(audit.anatomy?.value, 0);
  assert.equal(audit.trace?.find(node => node.type === 'field')?.label, 'approved_observed_spend');
  assert.equal(audit.provenance?.source, 'synthetic.marketing.platform');
  assert.equal(audit.reconciliation?.kind, 'delivery_consistency');
  assert.equal(audit.reconciliation?.state, 'formula_checked');
  assert.equal(audit.reconciliation?.values.find(row => row.key === 'difference')?.value, 0);
  assert.match(audit.reconciliation!.detail!, /does not establish independent billing reconciliation/);
  const partial = commercialNodeAudit({ ...commercial, reconciliation: { ...commercial.reconciliation, status: 'PARTIAL', difference: -3 } }, 'spend', scope);
  assert.equal(partial.reconciliation?.state, 'mismatch');
  assert.equal(partial.reconciliation?.values.find(row => row.key === 'difference')?.value, -3);
});

test('commercial missing coverage remains unavailable while financial dependencies count literal input availability', () => {
  const absent = commercialNodeAudit({ ...commercial, grainDiagnostics: { ...commercial.grainDiagnostics, missingSpendRows: undefined } }, 'spend', scope);
  assert.equal(absent.coverage?.categories.find(row => row.key === 'missing')?.value, null);
  assert.equal(absent.coverage?.composition, 'separate');
  const audit = commercialNodeAudit(commercial, 'profit', scope);
  assert.equal(audit.value, null);
  assert.deepEqual(requiredInputAvailability(audit.dependencies!.inputs), { available: 2, total: 5 });
  assert.deepEqual(audit.dependencies?.inputs.map(input => input.value), [0, 50, null, null, null]);
  assert.deepEqual(audit.scope, scope);
  assert.equal(audit.recordDrill, undefined);
});

test('Journey lens represents unavailable and measured-zero stages independently with accessible actions', () => {
  const stages = [{ key: 'fetched', name: 'Fetched', volume: 0 }, { key: 'rpc', name: 'RPC', volume: null }] as any;
  const html = renderToStaticMarkup(React.createElement(JourneyAuditLens, { stages, onInspectStage: () => {} }));
  assert.match(html, /Fetched evidence state/);
  assert.match(html, /RPC evidence state/);
  assert.match(html, /data-audit-state="observed"/);
  assert.match(html, /data-audit-state="unavailable"/);
  assert.equal((html.match(/Independent reconciliation/g) || []).length, 2);
  assert.equal((html.match(/aria-label="Audit evidence:/g) || []).length, 2);
  assert.doesNotMatch(html, /Business verified|Reconciled for scope/);
});

const output = await mkdtemp(path.join(tmpdir(), 'cx3-feature-audit-'));
await buildAcceptanceFixture(output);
const script = await readFile(path.join(output, 'fixture.js'), 'utf8');
test.after(() => rm(output, { recursive: true, force: true }));
async function mount(route: string, payloads: Record<string, unknown>) {
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { if (!error.message.includes('navigation')) errors.push(error.message); });
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://synthetic.invalid', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window as any;
  Object.assign(w, { Response, Request, Headers, AbortController, TextEncoder, TextDecoder, ReadableStream, ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, __fixture: { initialRoute: route, payloads } });
  w.matchMedia = (media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLElement.prototype.scrollTo = () => {};
  w.scrollTo = () => {};
  w.HTMLElement.prototype.getClientRects = function () { return this.isConnected ? [new w.DOMRect(0, 0, 100, 30)] : []; };
  w.eval(script);
  const find = (selector: string, text?: string): any => [...w.document.querySelectorAll(selector)].find((element: any) => text === undefined || (element.getAttribute('aria-label') || element.textContent || '').includes(text));
  const settle = () => new Promise(resolve => setTimeout(resolve, 60));
  const wait = async (condition: () => unknown) => { for (let index = 0; index < 150; index++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error(w.document.body.textContent + '\n' + errors.join('\n')); };
  const click = async (selector: string, text?: string) => { const element = find(selector, text); assert.ok(element, `Missing ${selector}: ${text}`); element.focus(); element.click(); await settle(); };
  return { w, find, wait, settle, click, close() { w.__fixture.unmount(); w.close(); } };
}

test('rendered Journey lens is presentation-only, keeps normal progression and restores selected lens after drawer interaction', async () => {
  const lifecycle = { comparisons: Object.fromEntries([['fetched', 120], ['delivered', 100], ['dialled', 80], ['rpc', 12], ['sales', 30], ['activations', 0]].map(([key, current]) => [key, { current }])), transitions: [], recordedEvidence: { delivered: 105, dialled: 90, rpc: 15 }, segments: {}, validationStatus: 'NOT_VERIFIED', unsupportedDimensions: [] };
  const route = '/funnel?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-29&filters=' + encodeURIComponent(JSON.stringify(scope.filters));
  const app = await mount(route, { '/api/analytics/offernet/funnel': { lifecycle, velocity: {}, byVendor: [], bySource: [], byGrade: [] } });
  try {
    await app.wait(() => app.find('#journey-progression'));
    assert.equal(app.find('[aria-label="Journey presentation lens"]'), undefined);
    const initialRequests = app.w.__fixture.requests.length;
    await app.click('button', 'Display preferences');
    await app.click('.cx-audit-preference button', 'On');
    await app.click('button', 'Display preferences');
    await app.click('[aria-label="Journey presentation lens"] button', 'Audit evidence');
    assert.equal(app.w.document.querySelectorAll('.cx-journey-audit-lens>ol>li').length, 6);
    assert.ok(app.find('.cx-lifecycle-path'));
    assert.equal(app.w.__fixture.requests.length, initialRequests);
    await app.click('.cx-journey-audit-lens button', 'Audit evidence: Dial');
    assert.match(app.find('.cx-audit-body').textContent, /Recorded source evidence90/);
    assert.match(app.find('.cx-audit-body').textContent, /Qualified lifecycle population80/);
    const link = new URL(app.find('a', 'Inspect supporting records').href, 'https://synthetic.invalid');
    assert.equal(link.searchParams.get('clientId'), scope.clientId);
    assert.deepEqual(JSON.parse(link.searchParams.get('filters')!), scope.filters);
    assert.equal(link.searchParams.get('drillValue'), 'dialled');
    await app.click('button', 'Close inspector');
    assert.ok(app.find('.cx-journey-audit-lens'));
    assert.equal(app.find('[aria-label="Journey presentation lens"] button', 'Audit evidence').getAttribute('aria-pressed'), 'true');
    assert.equal(app.w.__fixture.requests.length, initialRequests);
  } finally { app.close(); }
});

test('rendered Commercial bridge opens canonical audit at the exact workspace scope without new requests', async () => {
  const route = '/commercial?clientId=synthetic-a&startDate=2026-09-28&endDate=2026-09-29&filters=' + encodeURIComponent(JSON.stringify(scope.filters));
  const app = await mount(route, { '/api/analytics/offernet/commercial': commercial });
  try {
    await app.wait(() => app.find('.cx-commercial-evidence-bridge'));
    const initialRequests = app.w.__fixture.requests.length;
    await app.click('.cx-lineage-marketing button', 'Audit evidence');
    assert.match(app.find('.cx-evidence-trace').textContent, /approved_observed_spend/);
    assert.match(app.find('.cx-audit-body').textContent, /Formula checked/);
    assert.equal(app.w.document.querySelectorAll('[role="dialog"]').length, 1);
    const link = new URL(app.find('a', 'Open detailed analysis').href, 'https://synthetic.invalid');
    assert.equal(link.searchParams.get('clientId'), scope.clientId);
    assert.equal(link.searchParams.get('startDate'), scope.startDate);
    assert.deepEqual(JSON.parse(link.searchParams.get('filters')!), scope.filters);
    await app.click('button', 'Close inspector');
    await app.click('.cx-lineage-cohort button', 'Audit evidence');
    assert.match(app.find('.cx-audit-body').textContent, /separate cohort population/);
    await app.click('button', 'Close inspector');
    await app.click('.cx-commercial-not-calculable button', 'Audit evidence');
    assert.match(app.find('.cx-audit-body').textContent, /2 of 5 required inputs available/);
    assert.equal(app.w.__fixture.requests.length, initialRequests);
  } finally { app.close(); }
});
