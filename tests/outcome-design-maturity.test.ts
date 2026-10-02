import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import VendorComparison from '../src/features/vendors/components/VendorComparison';
import SalesSegmentComparison from '../src/features/sales/components/SalesSegmentComparison';
import SalesOutcomeSummary from '../src/features/sales/components/SalesOutcomeSummary';
import CommercialEvidenceBridge from '../src/features/commercial/CommercialEvidenceBridge';
import { adaptSalesActivationData } from '../src/features/sales/model/salesActivationAdapter';
import { convergenceSalesPayload, convergenceVendorPayload } from './frontend/convergenceFixtures';
import type { CommercialData } from '../src/lib/offernetClient';

async function renderTest(run: (app: { container: HTMLElement; render: (node: React.ReactNode) => Promise<void>; click: (element: HTMLElement) => Promise<void>; hover: (element: HTMLElement, enter: boolean) => Promise<void> }) => Promise<void>) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://synthetic.invalid/reports' });
  const original = { window: globalThis.window, document: globalThis.document, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), act: (globalThis as any).IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window as any; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try { await run({ container, render: async node => { await act(async () => root.render(node)); }, click: async element => { assert.ok(element); await act(async () => element.click()); }, hover: async (element, enter) => { await act(async () => element.dispatchEvent(new dom.window.MouseEvent(enter ? 'mouseover' : 'mouseout', { bubbles: true, relatedTarget: dom.window.document.body }))); } }); }
  finally { await act(async () => root.unmount()); globalThis.window = original.window; globalThis.document = original.document; if (original.navigator) Object.defineProperty(globalThis, 'navigator', original.navigator); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = original.act; dom.window.close(); }
}

const documentFor = (node: React.ReactNode) => new JSDOM(renderToStaticMarkup(node)).window.document;

test('vendor local selection aligns bars, lifecycle and exact rows without changing report scope', async () => {
  const vendors = structuredClone(convergenceVendorPayload.vendors), before = structuredClone(vendors);
  const filtered: string[] = [], inspected: string[] = [];
  await renderTest(async app => {
    await app.render(React.createElement(VendorComparison, { vendors, onSelectVendor: name => filtered.push(name), onInspectVendor: row => inspected.push(row.vendor) }));
    const bar = app.container.querySelector<HTMLButtonElement>('.cx-evidence-bar-list button')!;
    await app.click(bar);
    assert.equal(bar.getAttribute('aria-pressed'), 'true');
    assert.equal(app.container.querySelectorAll('tbody tr[data-selected="true"]').length, 2);
    assert.match(app.container.querySelector('.cx-outcome-selection[role="status"]')!.textContent!, /Selected · VendorLeadDialler SA/);
    assert.deepEqual(filtered, []); assert.deepEqual(inspected, []);
    const selected = app.container.querySelectorAll('[aria-pressed="true"]').length;
    const otherRow = app.container.querySelectorAll<HTMLElement>('.cx-vendor-lifecycle-matrix tbody tr')[1];
    await app.hover(otherRow, true);
    assert.equal(otherRow.getAttribute('data-highlighted'), 'true');
    assert.equal(app.container.querySelectorAll('[aria-pressed="true"]').length, selected);
    assert.match(app.container.querySelector('.cx-outcome-selection[role="status"]')!.textContent!, /LeadDialler SA/);
    assert.deepEqual(filtered, []);
    await app.hover(otherRow, false);
    assert.equal(app.container.querySelector('.cx-vendor-lifecycle-matrix tbody tr')?.getAttribute('data-highlighted'), 'true');
    await app.click([...app.container.querySelectorAll('button')].find(button => button.textContent === 'Inspect selected vendor')!);
    assert.deepEqual(inspected, ['LeadDialler SA']); assert.deepEqual(filtered, []);
    await app.click(app.container.querySelector('.cx-outcome-selection button:nth-of-type(2)')!);
    assert.deepEqual(filtered, ['LeadDialler SA']);
    assert.deepEqual(vendors, before);
  });
});

test('vendor selection follows the exact vendor identifier through refreshed response ordering', async () => {
  const vendors = structuredClone(convergenceVendorPayload.vendors);
  await renderTest(async app => {
    const render = (rows: typeof vendors) => app.render(React.createElement(VendorComparison, { vendors: rows, onSelectVendor: () => {} }));
    await render(vendors);
    await app.click(app.container.querySelector<HTMLButtonElement>('button[aria-label="Select vendor LeadDialler SA"]')!);
    await render([...vendors].reverse());
    assert.match(app.container.querySelector('.cx-outcome-selection')!.textContent!, /LeadDialler SA/);
    assert.match(app.container.querySelector('.cx-vendor-lifecycle-matrix tr[data-selected]')!.textContent!, /LeadDialler SA/);
    await render(vendors.filter(row => row.vendor !== 'LeadDialler SA'));
    assert.equal(app.container.querySelector('.cx-outcome-selection'), null);
    assert.equal(app.container.querySelector('tr[data-selected]'), null);
  });
});

test('vendor exact filter remains explicit and observed zero is distinct from unavailable', async () => {
  await renderTest(async app => {
    const filtered: string[] = [];
    await app.render(React.createElement(VendorComparison, { vendors: convergenceVendorPayload.vendors, onSelectVendor: name => filtered.push(name) }));
    await app.click(app.container.querySelector<HTMLButtonElement>('button[aria-label="Select vendor Empty Vendor"]')!);
    assert.deepEqual(filtered, []);
    assert.equal(app.container.querySelector('.cx-evidence-bar-list li[data-selected] [data-state]')?.getAttribute('data-state'), 'zero');
    assert.ok(app.container.querySelector('.cx-vendor-lifecycle-matrix tr[data-selected] [data-state="unknown"]'));
    await app.click(app.container.querySelector<HTMLButtonElement>('button[aria-label="Filter to vendor Empty Vendor"]')!);
    assert.deepEqual(filtered, ['Empty Vendor']);
  });
});

test('sales segment selection and hover stay local and maintain corresponding exact evidence', async () => {
  const model = adaptSalesActivationData(convergenceSalesPayload)!;
  const before = structuredClone(model), inspected: string[] = [];
  const props = { model, activeDimension: 'vendor' as const, onSelectDimension: () => {}, search: '', onSearchChange: () => {}, showAllInChart: false, onToggleShowAllInChart: () => {}, onInspectRow: (row: { name: string }) => inspected.push(row.name), onExportSegment: () => {} };
  await renderTest(async app => {
    await app.render(React.createElement(SalesSegmentComparison, props));
    await app.click(app.container.querySelector<HTMLButtonElement>('button[aria-label="Select Partner B segment"]')!);
    assert.deepEqual(inspected, []);
    assert.match(app.container.querySelector('.cx-outcome-selection[role="status"]')!.textContent!, /Partner B.*40 sales · 25 activations/);
    assert.match(app.container.querySelector('.cx-evidence-bar-list li[data-selected]')!.textContent!, /Partner B/);
    assert.match(app.container.querySelector('tbody tr[data-selected]')!.textContent!, /Partner B/);
    const first = app.container.querySelector<HTMLElement>('.cx-evidence-bar-list li')!;
    await app.hover(first, true);
    assert.match(app.container.querySelector('tbody tr[data-highlighted]')!.textContent!, /Partner A/);
    assert.match(app.container.querySelector('tbody tr[data-selected]')!.textContent!, /Partner B/);
    await app.click([...app.container.querySelectorAll('button')].find(button => button.textContent === 'Inspect selected segment')!);
    assert.deepEqual(inspected, ['Partner B']);
    await app.render(React.createElement(SalesSegmentComparison, { ...props, activeDimension: 'source' }));
    assert.equal(app.container.querySelector('.cx-outcome-selection[role="status"]'), null);
    assert.equal(app.container.querySelector('tbody tr[data-selected]'), null);
    assert.deepEqual(model, before);
  });
});

test('Sales telemetry complements the outcome map without repeating its three population counts', () => {
  const model = adaptSalesActivationData(convergenceSalesPayload)!;
  const doc = documentFor(React.createElement(SalesOutcomeSummary, { model, contextOnly: true, onInspect: () => {} }));
  assert.equal(doc.querySelectorAll('.cx-telemetry-rail article').length, 3);
  assert.match(doc.body.textContent!, /Source-recorded revenue.*Median time to sale.*Median time to activation/);
  for (const label of ['Recorded sales summary', 'Recorded activations summary', 'Sales without recorded activation summary']) assert.equal(doc.querySelector(`[aria-label="${label}"]`), null);
});

const commercial = (matched: boolean): CommercialData => ({ status: 'PARTIAL', reason: 'Fixture', currency: 'ZAR', baseline: { mediaSpend: 0, revenue: 2600, cpl: 10, cpc: null } as CommercialData['baseline'], media: { platformLeads: 80 } as CommercialData['media'], pAndLBreakdown: [],
  economics: { status: matched ? 'AVAILABLE' : 'UNAVAILABLE', recordedRevenue: matched ? 2400 : null, fetched: matched ? 100 : null, sales: matched ? 10 : null, activations: matched ? 8 : null } as CommercialData['economics'],
  attribution: { status: matched ? 'AVAILABLE' : 'UNAVAILABLE', rows: [], summary: { matchedKeys: matched ? 3 : 0, marketingOnlyKeys: 1, operationsOnlyKeys: 0 } } as CommercialData['attribution'],
});

test('commercial lineage links only approved matched value and leaves full cohort revenue independent', () => {
  const data = commercial(true), before = structuredClone(data);
  const doc = documentFor(React.createElement(CommercialEvidenceBridge, { data, currency: 'ZAR' }));
  assert.equal(doc.querySelector('.cx-lineage-matched-revenue')?.getAttribute('data-linked'), 'true');
  assert.match(doc.querySelector('.cx-lineage-matched-revenue')!.textContent!, /2,400/);
  assert.match(doc.querySelector('.cx-lineage-cohort')!.textContent!, /2,600.*Separate cohort/);
  assert.equal(doc.querySelector('.cx-lineage-cohort')?.hasAttribute('data-linked'), false);
  assert.equal(doc.querySelector('.cx-attribution-boundary')?.getAttribute('data-state'), 'partial');
  assert.match(doc.querySelector('.cx-commercial-not-calculable')!.textContent!, /Not calculable/);
  assert.deepEqual(data, before);
});

test('commercial ghost nodes retain missing evidence and observed zero without drawing a substantiated link', () => {
  const doc = documentFor(React.createElement(CommercialEvidenceBridge, { data: commercial(false), currency: 'ZAR' }));
  assert.match(doc.querySelector('.cx-lineage-marketing')!.textContent!, /Observed zero/);
  assert.equal(doc.querySelector('.cx-lineage-operations')?.getAttribute('data-state'), 'unavailable');
  assert.equal(doc.querySelector('.cx-lineage-matched-revenue')?.getAttribute('data-linked'), 'false');
  assert.equal(doc.querySelector('.cx-lineage-matched-revenue')?.getAttribute('data-state'), 'unavailable');
  assert.equal(doc.querySelector('details')?.hasAttribute('open'), false);
  assert.match(doc.querySelector('details')!.textContent!, /No subtotal is inferred/);
});
