import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import AnalyticalAllParameters from '../src/features/investigation/AnalyticalAllParameters';
import InvestigationRecordList from '../src/features/investigation/InvestigationRecordList';
import LeadDossierSummary from '../src/features/investigation/LeadDossierSummary';
import { analyticalParameter, analyticalParameterText, formatAnalyticalRevenue, type AnalyticalRow } from '../src/features/investigation/analyticalParameters';

const cases: Array<{ name: string; values: Record<string, unknown>; expected: string }> = [
  { name: 'USD decimal scale', values: { revenue: '123.4500', currency: 'USD' }, expected: '123.4500 USD' },
  { name: 'ZAR decimal scale', values: { revenue: '123.4500', currency: 'ZAR' }, expected: '123.4500 ZAR' },
  { name: 'missing currency', values: { revenue: '123.4500' }, expected: '123.4500' },
  { name: 'null currency', values: { revenue: '123.4500', currency: null }, expected: '123.4500' },
  { name: 'recorded numeric zero', values: { revenue: 0, currency: 'USD' }, expected: '0 USD' },
  { name: 'recorded string zero', values: { revenue: '0.0000', currency: 'ZAR' }, expected: '0.0000 ZAR' },
  { name: 'exact high precision', values: { revenue: '1234567890.123456789', currency: 'USD' }, expected: '1234567890.123456789 USD' },
  { name: 'exact negative amount', values: { revenue: '-0.12500000000000001' }, expected: '-0.12500000000000001' },
  { name: 'null amount', values: { revenue: null, currency: 'USD' }, expected: 'Unavailable' },
  { name: 'undefined amount', values: { revenue: undefined, currency: 'USD' }, expected: 'Unavailable' },
  { name: 'invalid amount text', values: { revenue: 'unknown', currency: 'USD' }, expected: 'Unavailable' },
  { name: 'invalid structured amount', values: { revenue: { amount: '123.4500' }, currency: 'USD' }, expected: 'Unavailable' },
];

function renderedValue(element: React.ReactElement, selector: string): string | undefined {
  const dom = new JSDOM(renderToStaticMarkup(element));
  try { return dom.window.document.querySelector(selector)?.textContent ?? undefined; }
  finally { dom.window.close(); }
}

test('one analytical revenue formatter accepts an explicit field and rejects absent, invalid or nonfinite amounts', () => {
  assert.equal(formatAnalyticalRevenue({ returned_revenue: '123.4500', currency: 'USD', revenue: 999 }, 'returned_revenue'), '123.4500 USD');
  assert.equal(formatAnalyticalRevenue({ currency: 'USD' }), 'Unavailable');
  for (const revenue of ['', ' ', 'R 12', '1,234', 'NaN', 'Infinity', Number.NaN, Infinity, -Infinity, true, false, [], {}]) {
    assert.equal(formatAnalyticalRevenue({ revenue, currency: 'USD' }), 'Unavailable', `Reject ${String(revenue)}`);
  }
  for (const currency of ['', ' ', null, undefined, 0, { code: 'USD' }]) assert.equal(formatAnalyticalRevenue({ revenue: '12.3400', currency }), '12.3400');
  const inheritedCurrency = Object.assign(Object.create({ currency: 'ZAR' }), { revenue: '12.3400' });
  assert.equal(formatAnalyticalRevenue(inheritedCurrency), '12.3400', 'Only a currency owned by the returned row is presented');
});

for (const item of cases) test(`${item.name}: Summary, curated table/cards, Full analytical and All parameters agree`, () => {
  const row = { lead_id: 'PRIVATE-CURRENCY-LEAD', ...item.values };
  assert.equal(formatAnalyticalRevenue(row), item.expected);
  assert.equal(analyticalParameterText(row, analyticalParameter('revenue')), item.expected);
  const summary = React.createElement(LeadDossierSummary, { row, validation: 'NOT_VERIFIED' });
  assert.equal(renderedValue(summary, '[data-summary-group="outcomes"] dl>div:last-child dd'), item.expected);
  const recordList = (preset: 'outcomes' | 'full') => React.createElement(InvestigationRecordList, { rows: [row], preset, selectedLeadId: row.lead_id, dossierId: 'dossier', onSelect() {} });
  assert.equal(renderedValue(recordList('outcomes'), 'tbody td[data-parameter-key="revenue"]'), item.expected);
  assert.equal(renderedValue(recordList('outcomes'), '.cx-investigation-record-cards dl>div:last-child dd'), item.expected);
  assert.equal(renderedValue(recordList('full'), 'tbody td[data-parameter-key="revenue"] .cx-analytical-parameter-value>span'), item.expected);
  assert.equal(renderedValue(React.createElement(AnalyticalAllParameters, { row }), '[data-parameter-key="revenue"] dd .cx-analytical-parameter-value>span'), item.expected);
});

test('all-field presentation preserves the difference between an absent amount and a returned null amount', () => {
  const field = analyticalParameter('revenue');
  const absent: AnalyticalRow = { lead_id: 'ABSENT', currency: 'USD' };
  assert.equal(formatAnalyticalRevenue(absent), 'Unavailable');
  assert.equal(analyticalParameterText(absent, field), 'Not supplied');
  assert.equal(analyticalParameterText({ ...absent, revenue: null }, field), 'Unavailable');
});
