import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import MediaMetricCard from '../src/features/evidenceWorkspace/MediaMetricCard';
import SalesOutcomeSummary from '../src/features/sales/components/SalesOutcomeSummary';
import ReleaseEvidence from '../src/features/evidenceWorkspace/ReleaseEvidence';
import VendorComparison from '../src/features/vendors/components/VendorComparison';
import ExceptionWorkbench from '../src/features/trust/components/ExceptionWorkbench';
import { MemoryRouter } from 'react-router-dom';
import { agentAudit, campaignAudit, exceptionAudit, salesAudit, suppliedProvenance, vendorAudit } from '../src/features/evidenceWorkspace/secondaryAudit';
import type { ReleaseManifest } from '../contracts/reporting';

async function renderTest(run: (app: { container: HTMLElement; render: (node: React.ReactNode) => Promise<void>; click: (element: HTMLElement) => Promise<void>; copied: string[] }) => Promise<void>) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://synthetic.invalid/reports' });
  const original = { window: globalThis.window, document: globalThis.document, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), act: (globalThis as any).IS_REACT_ACT_ENVIRONMENT };
  const copied: string[] = [];
  globalThis.window = dom.window as any; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: Object.assign(dom.window.navigator, { clipboard: { writeText: async (text: string) => { copied.push(text); } } }) });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try { await run({ container, copied, render: async node => { await act(async () => root.render(React.createElement(MemoryRouter, {}, node))); }, click: async element => { assert.ok(element); await act(async () => element.click()); } }); }
  finally { await act(async () => root.unmount()); globalThis.window = original.window; globalThis.document = original.document; if (original.navigator) Object.defineProperty(globalThis, 'navigator', original.navigator); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = original.act; dom.window.close(); }
}
const release = {
  releaseId: 'SYNTHETIC-RELEASE-'+ 'long-identifier-'.repeat(20), tenantId: 'synthetic-a', status: 'PUBLISHED', modelVersion: 'synthetic-model', metricVersion: 'synthetic-metric', engineHash: 'synthetic-engine-hash', approvedBy: 'Synthetic approver', approvalReference: 'SYNTHETIC-APPROVAL-'+ 'exact-'.repeat(20), builtAt: '2026-09-30T06:00:00Z', cutoff: '2026-09-28T23:59:59Z', sourceBatchIds: ['synthetic-batch'],
  snapshots: { leads: { table: 'synthetic.project.long_snapshot_table', createdAt: '2026-09-30T05:00:00Z', snapshotTime: '2026-09-29T00:00:00Z' } }, provenance: { records: { table: 'synthetic.project.provenance_records', createdAt: '2026-09-30T05:00:00Z', snapshotTime: '2026-09-29T00:00:00Z' } },
  sources: [{ fact: 'leads', status: 'PARTIAL', completeThrough: '2026-09-27T00:00:00Z', earliestAvailable: '2026-01-01T00:00:00Z', contractVersion: 'synthetic-contract', owner: 'Synthetic owner', approvalReference: 'synthetic-source-approval' }],
  checks: [{ id: 'unrun', status: 'NOT_RUN', observed: 'not executed', expected: 'source complete', jobId: '' }, { id: 'pass', status: 'PASS', observed: '0', expected: '0', jobId: 'synthetic-job-id' }, { id: 'fail', status: 'FAIL', observed: '1', expected: '0', jobId: 'synthetic-failed-job' }],
} as ReleaseManifest;
const scope = { clientId: 'synthetic-a', startDate: '2026-09-28', endDate: '2026-09-28', filters: { vendor: { operator: 'in', values: ['A', 'B'] } } };

test('release audit preserves all supplied evidence and NOT_RUN while identifiers copy exactly', async () => {
  await renderTest(async app => {
    await app.render(React.createElement(ReleaseEvidence, { release }));
    for (const text of [release.releaseId, release.approvalReference, release.engineHash, 'synthetic-batch', 'synthetic-contract', 'Synthetic owner', 'synthetic-source-approval', 'synthetic.project.provenance_records', 'PARTIAL']) assert.ok(app.container.textContent!.includes(text));
    const status = app.container.querySelector('[data-state="NOT_RUN"]')!; assert.equal(status.textContent, 'NOT_RUN');
    assert.equal(app.container.querySelectorAll('nav[aria-label="Release audit journey"] a').length, 4);
    const buttons = () => [...app.container.querySelectorAll('button')];
    await app.click(buttons().find(b => b.textContent === 'Copy Release ID')!);
    await app.click(buttons().find(b => b.textContent === 'Copy Approval reference')!);
    assert.deepEqual(app.copied, [release.releaseId, release.approvalReference]);
    assert.ok(app.container.textContent!.includes('Copied'));
    await app.click(buttons().find(b => b.textContent === 'Not run')!);
    assert.equal(app.container.querySelectorAll('[aria-label="Audit check evidence"] tbody tr').length, 1);
    assert.equal(app.container.querySelector('[aria-label="Audit check evidence"] [data-state="NOT_RUN"]')?.textContent, 'NOT_RUN');
    assert.equal(app.container.querySelector('[aria-label="Audit check evidence"] [data-state="PASS"]'), null);
  });
});

test('provenance allowlist copies only supplied metadata and never promotes availability to validation', () => {
  assert.deepEqual(suppliedProvenance({ status: 'AVAILABLE', rankingStatus: 'APPROVED', secret: 'omit', metadata: { generatedAt: '2026-09-30', timezone: 'UTC', queryJobId: 'synthetic-job', apiKey: 'omit' } }), { generatedAt: '2026-09-30', queryJobId: 'synthetic-job', timezone: 'UTC' });
});

test('agent audit keeps call grain and supplied sold-RPC components, with no lead-cohort drill', () => {
  const row = { agentId: 'Synthetic agent', vendor: 'A', totalCalls: 120, contactCount: 8, rpcSalesCount: 2, salesCount: 5, contactRate: null, saleRate: 25 } as any;
  const audit = agentAudit(row, 'saleRate', scope, { metadata: { validationStatus: 'NOT_VERIFIED' } });
  assert.equal(audit.value, '25.00%'); assert.equal(audit.numeratorCount, 2); assert.equal(audit.denominatorCount, 8); assert.equal(audit.recordDrill, undefined); assert.equal(audit.metricId, undefined); assert.deepEqual(audit.scope, scope); assert.equal(audit.provenance?.validationStatus, 'NOT_VERIFIED');
  assert.equal(agentAudit(row, 'contactRate', scope, {}).value, '—');
  assert.equal(agentAudit({ ...row, totalCalls: 0 }, 'calls', scope, {}).value, '0');
});

test('campaign audit uses returned ratios and components without recalculating or inventing lead records', () => {
  const data = { spendSource: { table: 'synthetic.marketing.api' }, grainDiagnostics: { fields: ['day', 'campaign', 'adset'] } } as any;
  const summary = { spend: 100, cpl: 17, leads: 9, clicks: null, impressions: 1000, ctr: null } as any;
  const audit = campaignAudit(data, summary, 'cpl', scope);
  assert.equal(audit.value, 'R 17'); assert.equal(audit.numeratorCount, 100); assert.equal(audit.denominatorCount, 9); assert.equal(audit.recordDrill, undefined); assert.equal(audit.provenance?.source, 'synthetic.marketing.api');
  assert.equal(campaignAudit(data, { ...summary, spend: null }, 'spend', scope).value, '—');
  assert.equal(campaignAudit(data, { ...summary, spend: 0 }, 'spend', scope).value, 'R 0');
});

test('sales audit withholds narrower pending drill and uses canonical count definitions without altering values', () => {
  const original = { type: 'metric', title: 'Sales without recorded activation', value: '73', scope, recordDrill: { drill: 'unactivated-sales' } } as const;
  const audit = salesAudit(original, { generatedAt: '2026-09-30T06:00:00Z' })!;
  assert.equal(audit.value, '73'); assert.equal(audit.recordDrill, undefined); assert.match(audit.detailLimitation!, />14 days/); assert.equal(audit.provenance?.generatedAt, '2026-09-30T06:00:00Z'); assert.equal(original.recordDrill.drill, 'unactivated-sales');
  assert.equal(salesAudit({ ...original, title: 'Recorded sales' }, {})?.metricId, 'sale_leads');
});

test('vendor chart and table expose exact selected audit measure while vendor filter remains separate', async () => {
  const vendor = { vendor: 'Synthetic vendor', leads: 42, deliveryRate: null, dialRate: 0, contactRate: null, saleRate: 0, activationRate: 0, medianFirstDial: null, callsPerLead: null, invalidRate: null } as any;
  await renderTest(async app => {
    const audited: unknown[] = [], filtered: string[] = [];
    await app.render(React.createElement(VendorComparison, { vendors: [vendor], onSelectVendor: value => filtered.push(value), onInspectVendor: (row, measure) => audited.push([row, measure]) }));
    const action = app.container.querySelector<HTMLButtonElement>('button[aria-label="Inspect Fetched leads evidence for Synthetic vendor"]')!;
    await app.click(action); assert.deepEqual(audited, [[vendor, 'leads']]); assert.deepEqual(filtered, []);
    await app.click(app.container.querySelector('button[aria-label="Filter to vendor Synthetic vendor"]')!); assert.deepEqual(filtered, ['Synthetic vendor']);
    const audit = vendorAudit(vendor, 'deliveryRate', scope, {}); assert.equal(audit.value, '—'); assert.equal(audit.numeratorCount, undefined); assert.equal(audit.recordDrill?.drillValue, vendor.vendor);
  });
});

test('exception audit accepts only existing supported drill IDs and selected workbench action opens local evidence', async () => {
  const item = { id: 'missing-disposition', title: 'Missing disposition', count: 0, detail: 'Dialled leads missing a disposition.', severity: 'medium', byVendor: [], bySource: [], previousCount: null, absoluteChange: null, percentageChange: null } as any;
  assert.equal(exceptionAudit(item, scope, {}).value, 0); assert.equal(exceptionAudit(item, scope, {}).recordDrill?.drill, item.id); assert.equal(exceptionAudit({ ...item, id: 'unknown-check' }, scope, {}).recordDrill, undefined);
  await renderTest(async app => { const calls: unknown[] = []; await app.render(React.createElement(ExceptionWorkbench, { items: [item], evidenceHref: () => '/lead-explorer', isAdmin: false, onInspect: value => calls.push(value) })); await app.click([...app.container.querySelectorAll('button')].find(b => b.textContent === 'Inspect evidence')!); assert.deepEqual(calls, [item]); assert.equal(app.container.querySelector('a[href="/lead-explorer"]'), null); });
});

test('marketing change action requires supplied comparison and dispatches its exact canonical metric', async () => {
  await renderTest(async app => {
    const calls: string[] = []; let inspections = 0;
    const props = { label: 'Platform CPL', value: 'R 12', note: 'Spend / platform leads', metric: 'cpl' as const, delta: 0, canCompare: true, onInvestigate: (metric: string) => calls.push(metric), onInspect: () => { inspections++; } };
    for (const extra of [{ canCompare: false }, { delta: null }, { value: '—' }]) {
      await app.render(React.createElement(MediaMetricCard, { ...props, ...extra }));
      assert.equal([...app.container.querySelectorAll('button')].some(b => b.textContent === 'Why changed?'), false);
      await app.click([...app.container.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Inspect evidence: Platform CPL')!);
    }
    assert.equal(inspections, 3); assert.deepEqual(calls, []);
    await app.render(React.createElement(MediaMetricCard, props));
    await app.click([...app.container.querySelectorAll('button')].find(b => b.textContent === 'Why changed?')!);
    assert.deepEqual(calls, ['cpl']);
  });
});

test('sales count and revenue cards provide evidence actions without unrelated rate explanations', async () => {
  await renderTest(async app => {
    const calls: string[] = [];
    const model = { summary: { totalSales: 5, totalActivations: 0, activationRatio: 0, salesWithoutActivation: null, validPendingActivation: null, invalidFutureSales: 0, realizedRevenue: null, currency: 'ZAR', salesWithRecordedRevenue: null, unbilledSales: 0, unrecordedRevenueSales: 5 } } as any;
    await app.render(React.createElement(SalesOutcomeSummary, { model, onInspect: metric => calls.push(metric) }));
    assert.equal(app.container.textContent!.includes('Why changed?'), false);
    const inspect = [...app.container.querySelectorAll<HTMLButtonElement>('.cx-metric-primary')];
    assert.equal(inspect.length, 4); for (const button of inspect) await app.click(button);
    assert.deepEqual(calls, ['sales', 'activations', 'unactivated', 'revenue']);
    assert.equal(app.container.querySelector('[aria-label="Recorded activations summary"] strong')?.textContent, '0');
    assert.equal(app.container.querySelector('[aria-label="Sales without recorded activation summary"] strong')?.textContent, '—');
  });
});
