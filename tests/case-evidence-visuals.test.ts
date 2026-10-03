import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import EvidenceMatrix from '../src/shared/visuals/EvidenceMatrix';
import SourceEvidenceMatrix from '../src/features/trust/components/SourceEvidenceMatrix';
import LeadJourney from '../src/features/leadLedger/LeadJourney';
import { lifecyclePresentation } from '../src/shared/visuals/lifecyclePresentation';

const documentFor = (element: React.ReactElement) => new JSDOM(renderToStaticMarkup(element)).window.document;

test('evidence matrix keeps all supplied states explicit with a keyboard reachable exact-value table', () => {
  const states = ['observed', 'issue', 'partial', 'unavailable', 'unverified'] as const;
  const document = documentFor(React.createElement(EvidenceMatrix, {
    label: 'Returned states', columns: [{ key: 'status', label: 'Status' }],
    rows: states.map(state => ({ key: state, label: state, cells: { status: { state, label: `${state} evidence` } } })),
  }));
  assert.equal(document.querySelector('[role=region]')?.getAttribute('tabindex'), '0');
  for (const state of states) {
    const cell = document.querySelector(`td[data-state=${state}]`);
    assert.equal(cell?.textContent, `${state} evidence`);
    assert.ok(cell?.querySelector('svg[aria-hidden=true]'));
  }
  assert.match(document.querySelector('caption')!.textContent!, /no combined score is calculated/);
});

test('source matrix does not infer completeness or current freshness from zero rows and returned age', () => {
  const document = documentFor(React.createElement(SourceEvidenceMatrix, { sources: [
    { key: 'zero', label: 'Observed zero', status: 'OBSERVED', table: null, latestRecordAt: '2020-01-01T00:00:00Z', ageHours: 0, rowCount: 0, detail: 'Unverified ingestion' },
    { key: 'missing', label: 'Missing', status: 'UNCONFIGURED', table: null, latestRecordAt: null, ageHours: null, rowCount: null, detail: 'No source contract' },
  ] }));
  const rows = document.querySelectorAll('.cx-evidence-matrix tbody tr');
  assert.equal(rows[0].querySelectorAll('td')[0].getAttribute('data-state'), 'observed');
  assert.match(rows[0].textContent!, /0 rows.*completeness not inferred.*0h returned age/);
  assert.equal(rows[1].querySelectorAll('td[data-state=unavailable]').length, 3);
  assert.ok(document.querySelector('.cx-source-exact-evidence table'));
  assert.doesNotMatch(document.body.textContent!, /100%|health score:|Healthy feed/);
});

test('source contract gaps stay neutral and are not promoted to measured integrity issues', () => {
  const statuses = ['TIMESTAMP_CONTRACT_REQUIRED', 'MAPPING_REQUIRED', 'NOT_VERIFIED', 'WARNING'];
  const document = documentFor(React.createElement(SourceEvidenceMatrix, { sources: statuses.map(status => ({
    key: status, label: status, status, table: null, latestRecordAt: null, ageHours: null, rowCount: null, detail: 'Returned source state',
  })) }));
  const cells = [...document.querySelectorAll('.cx-evidence-matrix tbody tr')].map(row => row.querySelectorAll('td')[1]);
  assert.deepEqual(cells.map(cell => cell.getAttribute('data-state')), ['unavailable', 'unavailable', 'unverified', 'issue']);
  assert.match(cells[0].textContent!, /Timestamp contract required/);
  assert.match(cells[1].textContent!, /Mapping required/);
});

test('lead timeline renders canonical lifecycle icons, timed and untimed node states', () => {
  const document = documentFor(React.createElement(LeadJourney, { row: {
    lead_id: 'sample', fetched: '2020-01-01T08:00:00Z', delivered_time: '2020-01-01T08:07:00Z', first_call_time: '2020-01-01T08:25:00Z', dialled: true, contacted: true, sale: true, activated: true,
  } }));
  const stages = { capture: 'fetched', delivery: 'delivered', call: 'dialled', rpc: 'rpc', sale: 'sales', activation: 'activated' } as const;
  for (const [event, stage] of Object.entries(stages)) {
    const node = document.querySelector(`[id$="-journey-panel"] [data-stage=${event}].cx-journey-event`);
    assert.ok(node?.querySelector('.cx-journey-node svg'));
    assert.ok(node?.getAttribute('style')?.includes(lifecyclePresentation[stage].color));
  }
  assert.equal(document.querySelectorAll('.cx-journey-spine [data-certainty=observed]').length, 3);
  assert.equal(document.querySelectorAll('.cx-journey-spine [data-certainty=unavailable]').length, 0);
  assert.equal(document.querySelectorAll('[id$="-journey-panel"] .cx-journey-undated [data-certainty=unavailable]').length, 3);
});

test('chronology anomaly is visible on the affected timeline event with its raw time retained', () => {
  const document = documentFor(React.createElement(LeadJourney, { row: {
    lead_id: 'anomaly', fetched: '2020-01-01T09:00:00Z', delivered_time: '2020-01-01T08:00:00Z',
  } }));
  const event = document.querySelector('.cx-journey-spine [data-stage=delivery].cx-journey-event');
  assert.equal(event?.getAttribute('data-anomaly'), 'true');
  assert.equal(event?.querySelector('time')?.getAttribute('datetime'), '2020-01-01T08:00:00.000Z');
  assert.match(event?.querySelector('.cx-journey-inline-anomaly')?.textContent || '', /precedes captured/);
  assert.equal(event?.parentElement?.getAttribute('data-connector'), 'start');
  assert.deepEqual([...document.querySelectorAll('.cx-journey-spine .cx-journey-event strong')].map(node => node.textContent), ['Delivered', 'Captured']);
});
