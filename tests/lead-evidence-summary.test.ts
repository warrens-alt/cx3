import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { buildLeadEvidenceSummary } from '../src/features/investigation/leadEvidenceSummaryModel';
import LeadEvidenceSummary from '../src/features/investigation/LeadEvidenceSummary';
import { formatAnalyticalRevenue } from '../src/features/investigation/analyticalParameters';

const now = Date.parse('2026-10-02T12:00:00Z');
test('lifecycle reading guide preserves six independent positions, missing evidence and literal zero', () => {
  const row = Object.freeze({ fetched: '2026-09-28T07:00:00Z', total_calls: '0', contacted: false, sale: null, activated: true });
  const result = buildLeadEvidenceSummary(row, now);
  assert.deepEqual(result.stages.map(stage => [stage.key, stage.state]), [
    ['capture', 'observed'], ['delivery', 'missing'], ['call', 'missing'], ['rpc', 'not-recorded'], ['sale', 'missing'], ['activation', 'untimed'],
  ]);
  assert.equal(result.calls, '0');
  assert.equal(result.stages[5].timestamp, null);
  assert.equal(result.stages[5].qualification, 'Qualification not supplied');
  assert.equal(result.stages[1].status, 'Unavailable');
  assert.equal(buildLeadEvidenceSummary({ total_calls: null }, now).calls, 'Unavailable');
  assert.equal(result.anomalies.length, 0);
});

test('recorded timestamps do not override supplied qualification exclusions or certify chronology', () => {
  const result = buildLeadEvidenceSummary({ fetched: '2026-09-28T07:00:00Z', delivered_time: '2026-09-28T08:00:00Z', first_call_time: '2026-09-28T07:30:00Z', qualified_delivery: true, dialled: false, qualified_activation: null, sale: true, sale_before_capture: true }, now);
  assert.equal(result.stages[1].qualification, 'Qualified');
  assert.equal(result.stages[2].qualification, 'Excluded from qualified progression');
  assert.equal(result.stages[2].state, 'anomaly');
  assert.equal(result.stages[2].timestamp, '2026-09-28T07:30:00.000Z');
  assert.match(result.stages[2].detail, /precedes/);
  assert.equal(result.stages[4].state, 'anomaly');
  assert.match(result.stages[4].detail, /Sale before capture/);
  assert.equal(result.stages[5].qualification, 'Qualification not supplied');
});

test('invalid and future timestamps remain anomalies rather than recorded milestones', () => {
  const result = buildLeadEvidenceSummary({ fetched: 'invalid', delivered_time: '2099-01-01T00:00:00Z', activated: true }, now);
  assert.equal(result.stages[0].state, 'anomaly');
  assert.equal(result.stages[1].state, 'anomaly');
  assert.equal(result.stages[0].timestamp, null);
  assert.equal(result.stages[1].timestamp, null);
  assert.equal(result.stages[5].state, 'untimed');
  assert.equal(result.stages[4].state, 'missing', 'Activation does not create sale evidence');
});

test('compact and expanded lifecycle positions have text alternatives and no colour-only state', () => {
  for (const compact of [false, true]) {
    const doc = new JSDOM(renderToStaticMarkup(React.createElement(LeadEvidenceSummary, { row: { contacted: false, activated: true, total_calls: null }, compact }))).window.document;
    const stages = [...doc.querySelectorAll('[data-evidence-stage]')];
    assert.equal(stages.length, 6);
    assert.ok(stages.every(stage => stage.getAttribute('aria-label') && stage.querySelector('svg[aria-hidden="true"]')));
    assert.match(stages[3].getAttribute('aria-label')!, /Not recorded/);
    assert.match(stages[5].getAttribute('aria-label')!, /Recorded · untimed.*Qualification not supplied/);
    assert.match(doc.body.textContent!, /Calls: Unavailable/);
    assert.equal(doc.querySelector('button,a'), null, 'Supplemental lifecycle visuals add no record handoff or query');
  }
});

test('recorded monetary evidence retains exact decimals and never invents a currency', () => {
  assert.equal(formatAnalyticalRevenue({ revenue: '1234567890.123456789' }), '1234567890.123456789');
  assert.equal(formatAnalyticalRevenue({ revenue: 0, currency: 'USD' }), '0 USD');
  assert.equal(formatAnalyticalRevenue({ revenue: null }), 'Unavailable');
  assert.equal(formatAnalyticalRevenue({ revenue: 'unknown' }), 'Unavailable');
  assert.equal(formatAnalyticalRevenue({ revenue: Number.NaN }), 'Unavailable');
});
