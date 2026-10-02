import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act, useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { JSDOM } from 'jsdom';
import AnalyticsPageLayout from '../src/components/AnalyticsPageLayout';
import PageHeader from '../src/components/PageHeader';
import ReportSections from '../src/shared/reporting/ReportSections';
import UnifiedMetricCard from '../src/components/UnifiedMetricCard';
import KpiCard from '../src/components/KpiCard';

async function renderTest(run: (container: HTMLElement, render: (element: React.ReactNode) => Promise<void>) => Promise<void>, route = '/__layout') {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://synthetic.invalid' });
  const previous = { window: globalThis.window, document: globalThis.document, act: (globalThis as any).IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window as any;
  globalThis.document = dom.window.document;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await run(container, async element => { await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: [route] }, element))); });
  } finally {
    await act(async () => root.unmount());
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previous.act;
    dom.window.close();
  }
}

test('page header respects its explicit identity on a route with historical naming', async () => {
  await renderTest(async (container, render) => {
    await render(React.createElement(PageHeader, { title: 'Record explorer', description: 'Inspect the selected records.' }));
    assert.equal(container.querySelector('h1')!.textContent, 'Record explorer');
    assert.equal(container.querySelector('.cx-page-description')!.textContent, 'Inspect the selected records.');
    await render(React.createElement(PageHeader, { title: 'Selected record evidence' }));
    assert.equal(container.querySelector('h1')!.textContent, 'Selected record evidence');
  }, '/lead-explorer');
});

test('canonical layout places title, scope, status and answer in order without remounting retained state', async () => {
  await renderTest(async (container, render) => {
    let mounts = 0;
    function Answer() {
      useEffect(() => { mounts++; }, []);
      return React.createElement('input', { 'aria-label': 'Retained answer note', defaultValue: 'original' });
    }
    const view = (status: string) => React.createElement(AnalyticsPageLayout, {
      title: 'Observed results', description: 'Existing report evidence',
      scope: React.createElement('section', { 'aria-label': 'Reporting scope' }, 'Selected period'),
      status: React.createElement('p', { role: 'status' }, status),
      children: React.createElement(Answer),
    });
    await render(view('Not verified'));
    const sequence = [...container.querySelector('.cx-analytics-page-content')!.children];
    assert.equal(sequence[0].tagName, 'HEADER');
    assert.equal(sequence[0].querySelector('h1')!.textContent, 'Observed results');
    assert.equal(sequence[1].getAttribute('aria-label'), 'Reporting scope');
    assert.equal(sequence[2].getAttribute('role'), 'status');
    assert.equal(sequence[3].getAttribute('aria-label'), 'Retained answer note');
    const input = sequence[3] as HTMLInputElement;
    input.value = 'Analyst draft';
    await render(view('Partial evidence'));
    assert.equal(container.querySelector('input'), input);
    assert.equal(input.value, 'Analyst draft');
    assert.equal(mounts, 1);
    assert.equal(container.querySelectorAll('h1').length, 1);
  });
});

test('local report tabs retain mounted editors, keyboard focus and supplied data across hidden panels', async () => {
  await renderTest(async (container, render) => {
    const mounts: string[] = [];
    function Panel({ id }: { id: string }) {
      useEffect(() => { mounts.push(id); }, [id]);
      return React.createElement('input', { 'aria-label': `${id} note`, defaultValue: id });
    }
    function Report() {
      const [section, setSection] = useState('answer');
      return React.createElement(ReportSections, {
        label: 'Report views', value: section, onChange: setSection,
        sections: ['answer', 'detail'].map(id => ({ id, label: id, content: React.createElement(Panel, { id }) })),
      });
    }
    await render(React.createElement(Report));
    const input = container.querySelector<HTMLInputElement>('input[aria-label="answer note"]')!;
    input.value = 'Keep this evidence note';
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    await act(async () => { tabs[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    assert.equal(document.activeElement, tabs[1]);
    assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
    assert.equal(container.querySelectorAll('[role="tabpanel"]:not([hidden])').length, 1);
    await act(async () => tabs[0].click());
    assert.equal(container.querySelector('input[aria-label="answer note"]'), input);
    assert.equal(input.value, 'Keep this evidence note');
    assert.deepEqual(mounts, ['answer', 'detail']);
  });
});

test('both metric presentations preserve zero and unavailable formatting with readable complete labels', async () => {
  await renderTest(async (container, render) => {
    const label = 'A complete operational label longer than a short card heading';
    await render(React.createElement('div', {},
      React.createElement(UnifiedMetricCard, { label, value: 0, change: 0 }),
      React.createElement(KpiCard, { title: label, value: 0, change: 0 }),
      React.createElement(KpiCard, { title: 'Missing', value: null, prefix: 'R ' }),
    ));
    assert.deepEqual([...container.querySelectorAll('.cx-metric-value')].map(value => value.textContent), ['0', '0', 'Unavailable']);
    assert.equal(container.querySelectorAll('.cx-metric-card').length, 3);
    assert.equal(container.querySelectorAll('.font-mono, .line-clamp-1').length, 0);
    assert.ok(container.textContent!.includes('0.00%'));
    assert.equal(container.querySelectorAll('.text-semantic-neg').length, 0);
    assert.equal(container.querySelectorAll('.cx-metric-label')[0].textContent, label);
  });
});
