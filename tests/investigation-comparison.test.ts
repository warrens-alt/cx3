import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import InvestigationComparison from '../src/features/investigation/InvestigationComparison';

const render = (current: number | null, previous: number | null) => new JSDOM(renderToStaticMarkup(React.createElement(InvestigationComparison, {
  label: 'RPC rate', current, previous, suffix: '%',
  currentWindow: { startDate: '2026-09-15', endDate: '2026-09-28' },
  previousWindow: { startDate: '2026-09-01', endDate: '2026-09-14' },
}))).window.document;

test('comparison visual preserves returned period values and exact windows without creating daily points', () => {
  const doc = render(18.6, 21);
  assert.equal(doc.querySelectorAll('.cx-investigation-comparison-row').length, 2);
  assert.match(doc.querySelector('[data-period=current]')!.textContent!, /2026-09-15 – 2026-09-28.*18.6%/);
  assert.match(doc.querySelector('[data-period=previous] [role=img]')!.getAttribute('aria-label')!, /21%.*2026-09-01 – 2026-09-14/);
  assert.match(doc.querySelector('figcaption')!.textContent!, /daily comparison points are not supplied/);
  assert.equal(doc.querySelectorAll('tbody tr').length, 2);
  assert.match(doc.querySelector('tbody')!.textContent!, /18.6%.*21%/);
});

test('unknown comparison draws no value mark and measured zero remains a literal zero', () => {
  const doc = render(0, null);
  assert.equal(doc.querySelector('[data-period=current]')!.getAttribute('data-state'), 'zero');
  assert.equal(doc.querySelector('[data-period=current] strong')!.textContent, '0%');
  assert.equal(doc.querySelector('[data-period=previous]')!.getAttribute('data-state'), 'unavailable');
  assert.equal(doc.querySelector('[data-period=previous] i'), null);
  assert.match(doc.querySelector('[data-period=previous] strong')!.textContent!, /Unavailable/);
  const unknown = render(null, null);
  assert.equal(unknown.querySelectorAll('.cx-investigation-comparison-track i').length, 0);
});
