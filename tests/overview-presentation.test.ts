import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { JSDOM } from 'jsdom';
import FirstCallResponse from '../src/features/overview/components/FirstCallResponse';
import OverviewChanges from '../src/features/overview/components/OverviewChanges';
import OutcomeStrip from '../src/features/overview/components/OutcomeStrip';
import JourneySummary, { type FunnelStageItem } from '../src/features/overview/components/JourneySummary';

const route = '/overview?clientId=synthetic-a&startDate=2026-09-22&endDate=2026-09-28&vendor=Synthetic%20vendor';
async function withRenderedComponent(run: (app: { container: HTMLElement; render: (element: React.ReactNode) => Promise<void>; click: (element: HTMLElement) => Promise<void> }) => Promise<void>) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://synthetic.invalid' });
  const original = { window: globalThis.window, document: globalThis.document, act: (globalThis as any).IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window as any;
  globalThis.document = dom.window.document;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await run({ container,
      render: async element => { await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: [route] }, element))); },
      click: async element => { assert.ok(element, 'Expected an available control'); await act(async () => element.click()); },
    });
  } finally {
    await act(async () => root.unmount());
    globalThis.window = original.window;
    globalThis.document = original.document;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = original.act;
    dom.window.close();
  }
}

const outcomeData = {
  kpis: { fetchedLeads: 100, deliveredLeads: 80, saleLeads: 40, activatedLeads: 0, deliveryRate: 80, leadToSaleRate: 40, activationRate: 0 },
  comparison: { fetchedDelta: 0, deliveryRateDelta: -1, saleRateDelta: 2, activationRateDelta: 0 },
} as React.ComponentProps<typeof OutcomeStrip>['data'];

test('Overview Why changed requires comparison evidence and dispatches the existing metric when available', async () => {
  await withRenderedComponent(async app => {
    const investigations: string[] = [];
    const inspected: string[] = [];
    const props = { data: outcomeData, isAdmin: true, onInspect: (content: any) => inspected.push(content.metricId), onWhyChanged: (metric: any) => investigations.push(metric) };
    const whyButtons = () => [...app.container.querySelectorAll('button')].filter(button => button.textContent?.trim() === 'Why changed?');
    for (const hasComparison of [false, undefined]) {
      await app.render(React.createElement(OutcomeStrip, { ...props, hasComparison }));
      assert.equal(whyButtons().length, 0);
      assert.equal(app.container.querySelectorAll('.cx-outcome-card').length, 4);
    }
    await app.click(app.container.querySelector('.cx-outcome-card .cx-metric-primary')!);
    assert.deepEqual(inspected, ['fetched_leads']);
    assert.deepEqual(investigations, []);
    await app.render(React.createElement(OutcomeStrip, { ...props, hasComparison: true }));
    assert.equal(whyButtons().length, 1);
    for (const button of whyButtons()) await app.click(button);
    assert.deepEqual(investigations, ['fetchedLeads']);
    await app.render(React.createElement(OutcomeStrip, { ...props, hasComparison: false }));
    assert.equal(whyButtons().length, 0);
    await app.render(React.createElement(OutcomeStrip, { ...props, hasComparison: true, onWhyChanged: undefined }));
    assert.equal(whyButtons().length, 0);
  });
});

const stages: FunnelStageItem[] = [
  { key: 'fetched', name: 'Fetched', volume: 100, transitionRate: null },
  { key: 'delivered', name: 'Delivered', volume: 80, transitionRate: 70, loss: 7 },
  { key: 'dialled', name: 'Dialled', volume: 120, transitionRate: 90, loss: 11 },
  { key: 'rpc', name: 'RPC', volume: null, transitionRate: null, loss: null },
  { key: 'sales', name: 'Sales', volume: 40, transitionRate: null, loss: null },
  { key: 'activated', name: 'Activated', volume: 0, transitionRate: 0, loss: 0 },
];

test('Overview rail preserves nonnested counts, null and zero, returned losses, and audit-first admin selections', async () => {
  await withRenderedComponent(async app => {
    const inspected: { stage: FunnelStageItem; index: number }[] = [];
    const before = JSON.stringify(stages);
    await app.render(React.createElement(JourneySummary, { stages, isAdmin: true, onInspectStage: (stage, index) => inspected.push({ stage, index }) }));
    const items = [...app.container.querySelectorAll<HTMLElement>('.cx-overview-lifecycle-rail > li')];
    assert.equal(items.length, 6);
    assert.deepEqual(items.map(item => item.dataset.series), ['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activation']);
    assert.deepEqual(items.map(item => item.querySelector('.cx-overview-stage-count')?.textContent), ['100', '80', '120', '—', '40', '0']);
    const width = (index: number) => parseFloat(items[index].querySelector<HTMLElement>('.cx-overview-stage-track > span')!.style.width);
    assert.ok(Math.abs(width(0) - 100 / 120 * 100) < 0.00001);
    assert.ok(width(2) > width(1));
    assert.equal(width(2), 100);
    assert.equal(width(5), 0);
    assert.equal(items[3].querySelector('.cx-overview-stage-track')?.getAttribute('data-evidence'), 'unavailable');
    assert.equal(items[3].querySelector('.cx-overview-stage-track > span'), null);
    assert.match(items[3].textContent!, /Transition rate unavailable/);
    assert.match(items[4].textContent!, /Transition rate unavailable/);
    assert.match(items[5].textContent!, /0% from prior stage/);
    assert.equal(app.container.querySelector('a button, button a'), null);
    assert.equal(app.container.querySelector('a[href*="lead-explorer"]'), null);
    await app.click(items[2].querySelector('button')!);
    assert.deepEqual(inspected, [{ stage: stages[2], index: 2 }]);
    const disclosure = app.container.querySelector('details')!;
    assert.equal(disclosure.open, false);
    await app.click(disclosure.querySelector('summary')!);
    assert.equal(disclosure.open, true);
    assert.deepEqual([...disclosure.querySelectorAll('li strong')].map(element => element.textContent), ['7 leads', '11 leads', '0 leads']);
    assert.doesNotMatch(app.container.textContent!, /Waterfall|Overall Conversion|Highest Drop Milestone|NaN/);
    assert.equal(JSON.stringify(stages), before);
  });
});

test('Overview viewer rail uses evidence buttons without record links and passes returned transition loss unchanged', async () => {
  await withRenderedComponent(async app => {
    const stageCalls: unknown[] = [], lossCalls: unknown[] = [];
    await app.render(React.createElement(JourneySummary, { stages, isAdmin: false, onInspectStage: (stage, index) => stageCalls.push([stage, index]), onInspectLoss: (...args) => lossCalls.push(args) }));
    assert.equal(app.container.querySelector('a[href*="lead-explorer"]'), null);
    await app.click(app.container.querySelector('[data-stage="sales"] button.cx-overview-stage-count')!);
    assert.deepEqual(stageCalls, [[stages[4], 4]]);
    await app.click(app.container.querySelector('details summary')!);
    await app.click(app.container.querySelector('details li button')!);
    assert.deepEqual(lossCalls, [['Fetched', 'Delivered', 7, 'fetched-to-delivered']]);
    await app.render(React.createElement(JourneySummary, { stages: [], isAdmin: false }));
    assert.match(app.container.textContent!, /No lifecycle counts are supplied/);
    assert.equal(app.container.querySelector('.cx-overview-stage-count'), null);
  });
});


test('Overview first-call response displays exact supplied measurements and preserves scoped navigation', async () => {
  await withRenderedComponent(async app => {
    const props = { sla: { firstDialTargetMinutes: 17, complianceRate: 0, medianDeliveryToDial: '0s', p90DeliveryToDial: '41m' }, backlog: { awaitingFirstDial: 0, over60Minutes: 9, buckets: [], byVendor: [] } };
    const before = JSON.stringify(props);
    await app.render(React.createElement(FirstCallResponse, props));
    assert.match(app.container.textContent!, /within 17 minutes/);
    assert.equal(app.container.querySelector('strong')!.textContent, '0.0%');
    assert.deepEqual([...app.container.querySelectorAll('dd')].map(value => value.textContent), ['0s', '41m', '0', '9']);
    const link = new URL(app.container.querySelector('a')!.href, 'https://synthetic.invalid');
    assert.equal(link.pathname, '/speed-to-lead');
    assert.equal(link.searchParams.get('clientId'), 'synthetic-a');
    assert.equal(link.searchParams.get('vendor'), 'Synthetic vendor');
    assert.equal(JSON.stringify(props), before);
    await app.render(React.createElement(FirstCallResponse, { sla: undefined, backlog: undefined } as any));
    assert.match(app.container.textContent!, /unavailable/);
    assert.equal(app.container.querySelector('strong')!.textContent, '—');
    assert.deepEqual([...app.container.querySelectorAll('dd')].map(value => value.textContent), ['—', '—', '—', '—']);
  });
});

test('Overview What changed preserves supplied deltas and gates investigation on comparison evidence', async () => {
  await withRenderedComponent(async app => {
    const calls: string[] = [];
    const props = { changes: [{ label: 'Lead volume', value: 0, unit: '%', metric: 'fetchedLeads' as const }, { label: 'Delivery rate', value: -4.2, unit: 'pp', metric: 'deliveryRate' as const }], onInvestigate: (metric: string) => calls.push(metric) };
    await app.render(React.createElement(OverviewChanges, { ...props, hasComparison: false }));
    assert.equal(app.container.querySelector('button'), null);
    assert.match(app.container.textContent!, /Comparison evidence is unavailable for the selected reporting scope/);
    await app.render(React.createElement(OverviewChanges, { ...props, hasComparison: true, comparisonWindow: { startDate: '2026-09-15', endDate: '2026-09-21' } }));
    assert.deepEqual([...app.container.querySelectorAll('strong')].map(value => value.textContent), ['0%', '-4.2pp']);
    for (const button of app.container.querySelectorAll('button')) await app.click(button);
    assert.deepEqual(calls, ['fetchedLeads', 'deliveryRate']);
  });
});
