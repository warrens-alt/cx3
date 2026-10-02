import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLedgerTimeline, formatLedgerDuration } from '../src/features/leadLedger/timeline';

const now = Date.parse('2026-10-02T12:00:00Z');
// Synthetic fixtures use exactly the fields returned by operational raw-leads.
// A complete supported journey has untimed outcome flags: this endpoint does
// not return RPC, sale or activation event times or an individual-call history.
const complete = {
  lead_id: 'SYNTHETIC-COMPLETE', consumer_id: '00000123', source: 'Synthetic campaign', medium: 'Synthetic channel',
  fetched: '2026-09-28T09:04:00Z', delivered_time: '2026-09-28T09:11:00Z', first_call_time: '2026-09-28T09:29:00Z',
  dialled: true, contacted: true, sale: true, activated: true, total_calls: 5,
  vendor: 'Synthetic representative vendor', transaction_id: 'SYNTHETIC-TRANSACTION', last_dialer_status: 'Sale',
};

test('complete supported journey preserves timed intake/delivery/dial and explicitly untimed outcomes', () => {
  const original = JSON.stringify(complete);
  const model = buildLedgerTimeline(complete, now);
  assert.deepEqual(model.milestones.map(event => event.kind), ['capture', 'delivery', 'call', 'rpc', 'sale', 'activation']);
  assert.deepEqual(model.timedEvents.map(event => event.kind), ['capture', 'delivery', 'call']);
  assert.deepEqual(model.untimedEvents.map(event => event.kind), ['rpc', 'sale', 'activation']);
  assert.ok(model.untimedEvents.every(event => event.timestamp === null && event.timestampStatus === 'unavailable'));
  assert.deepEqual(model.transitions.map(transition => transition.label), ['7m', '18m', 'Time unavailable', 'Time unavailable', 'Time unavailable']);
  assert.equal(model.currentStage?.kind, 'activation');
  assert.deepEqual(model.duration, { milliseconds: 25 * 60000, label: '25m', caption: 'Recorded timestamp span' });
  assert.deepEqual(model.anomalies, []);
  assert.equal(JSON.stringify(complete), original, 'The loaded evidence row is not mutated');
});

test('partial journey retains calls without manufacturing downstream outcomes', () => {
  const model = buildLedgerTimeline({ ...complete, contacted: null, sale: false, activated: null }, now);
  assert.deepEqual(model.milestones.map(event => event.kind), ['capture', 'delivery', 'call']);
  assert.deepEqual(model.outcomes.map(outcome => [outcome.kind, outcome.state]), [['rpc', 'unavailable'], ['sale', 'not-recorded'], ['activation', 'unavailable']]);
  assert.equal(model.calls.count, 5);
  assert.equal(model.currentStage?.kind, 'call');
  assert.equal(JSON.stringify(model).includes('failed'), false);
});

test('missing event times never borrow generated, cutoff, freshness or other-contract timestamps', () => {
  const model = buildLedgerTimeline({
    lead_id: 'SYNTHETIC-UNTIMED', dialled: true, contacted: true, sale: true, activated: true,
    generatedAt: '2026-09-28T12:00:00Z', sourceCutoff: '2026-09-28T11:00:00Z', latestData: '2026-09-28T10:00:00Z',
    ingestion_timestamp: '2026-09-28T09:00:00Z', updated_at: '2026-09-28T08:00:00Z',
    capture_timestamp: '2026-09-28T09:04:00Z', rpc_timestamp: '2026-09-28T10:00:00Z', sale_timestamp: '2026-09-28T11:00:00Z', activation_timestamp: '2026-09-28T12:00:00Z',
  }, now);
  assert.equal(model.timedEvents.length, 0);
  assert.equal(model.untimedEvents.length, 4);
  assert.ok(model.transitions.every(transition => transition.milliseconds === null && transition.state === 'unavailable'));
  assert.equal(model.duration, null);
});

test('source-only lead supplies no decorative milestones and unknown is never zero', () => {
  const model = buildLedgerTimeline({ lead_id: 'SYNTHETIC-SOURCE-ONLY', grade: 'A', vetting: 'Green', valid_lead: true, status: 'Sale' }, now);
  assert.deepEqual(model.milestones, []);
  assert.deepEqual(model.timedEvents, []);
  assert.equal(model.currentStage, null);
  assert.equal(model.calls.count, null);
  assert.equal(model.duration, null);
  assert.ok(model.outcomes.every(outcome => outcome.state === 'unavailable'));
});

test('aggregate attempts remain one count and RPC never becomes a claimed attempt number', () => {
  const model = buildLedgerTimeline({ ...complete, total_calls: 127, contacted: true }, now);
  assert.equal(model.calls.count, 127);
  assert.deepEqual(model.calls.evidenceFields, [{ label: 'total_calls', value: 127 }]);
  assert.equal(model.milestones.filter(event => event.kind === 'call').length, 1);
  assert.equal(model.timedEvents.filter(event => event.kind === 'call').length, 1);
  assert.match(model.calls.limitation, /RPC attempt number are unavailable/);
  assert.equal(model.untimedEvents.find(event => event.kind === 'rpc')?.timestamp, null);
});

test('sale without activation does not imply failed activation or an upstream contact', () => {
  const model = buildLedgerTimeline({ lead_id: 'SYNTHETIC-SALE-ONLY', sale: 'true', activated: 'false', contacted: null, dialled: null }, now);
  assert.deepEqual(model.milestones.map(event => event.kind), ['sale']);
  assert.equal(model.currentStage?.kind, 'sale');
  assert.deepEqual(model.outcomes.find(outcome => outcome.kind === 'activation'), { kind: 'activation', title: 'Activation', state: 'not-recorded' });
  assert.equal(model.outcomes.find(outcome => outcome.kind === 'rpc')?.state, 'unavailable');
  assert.equal(model.duration, null);
  assert.equal(JSON.stringify(model).includes('failed'), false);
});

test('measured zero and exact cumulative counts retain their source meaning', () => {
  for (const count of [0, '0', '9007199254740993']) assert.equal(buildLedgerTimeline({ total_calls: count }, now).calls.count, count);
  for (const count of [undefined, null, '', ' ', false, -1, 0.2, NaN, Infinity, 'bad', 9007199254740992]) {
    assert.equal(buildLedgerTimeline({ total_calls: count }, now).calls.count, null);
  }
  const noCalls = buildLedgerTimeline({ total_calls: 0, dialled: false }, now);
  assert.equal(noCalls.milestones.length, 0, 'Zero does not create a first-dial event');
});

test('long journeys and source identifiers preserve timing and evidence without invented ownership', () => {
  const source = 'SYNTHETIC-SOURCE-' + 'x'.repeat(500);
  const model = buildLedgerTimeline({ ...complete, source, vendor: 'vendor-' + 'x'.repeat(500), agent: 'SYNTHETIC-AGENT-007', delivered_time: '2026-09-30T10:11:00Z', first_call_time: '2026-10-01T10:29:00Z' }, now);
  assert.equal(model.transitions[0].label, '2d 1h');
  assert.equal(model.transitions[1].label, '1d 18m');
  assert.equal(model.duration?.label, '3d 1h');
  assert.equal(model.milestones[0].evidenceFields.find(field => field.label === 'source')?.value, source);
  assert.ok(model.milestones.every(event => event.owner === null && event.vendor === null && event.agent === null));
  assert.ok(model.milestones.every(event => !event.evidenceFields.some(field => ['vendor', 'transaction_id', 'last_dialer_status', 'agent'].includes(field.label))));
});

test('future and invalid timestamps remain evidence anomalies excluded from chronology and durations', () => {
  for (const timestamp of ['2099-01-01T00:00:00Z', '2026-02-30T10:00:00Z', '2026-09-28', 'not a date', '2026-09-28T24:00:00Z', '2026-09-28T09:11:00+24:00']) {
    const model = buildLedgerTimeline({ ...complete, delivered_time: timestamp }, now);
    assert.equal(model.timedEvents.some(event => event.kind === 'delivery'), false);
    assert.equal(model.milestones.some(event => event.kind === 'delivery'), false);
    assert.equal(model.anomalies.length, 1);
    assert.equal(model.anomalies[0].field, 'delivered_time');
    assert.equal(model.anomalies[0].value, timestamp);
    assert.equal(model.duration, null);
  }
  const supportedUntimed = buildLedgerTimeline({ first_call_time: '2099-01-01T00:00:00Z', dialled: true }, now);
  assert.equal(supportedUntimed.untimedEvents[0].kind, 'call', 'The independent true flag remains evidence while its future timestamp is excluded');
  assert.equal(supportedUntimed.timedEvents.length, 0);
});

test('negative lifecycle intervals are anomalies while Events remains truly chronological', () => {
  const model = buildLedgerTimeline({ ...complete, first_call_time: '2026-09-28T09:06:00Z' }, now);
  assert.deepEqual(model.milestones.slice(0, 3).map(event => event.kind), ['capture', 'delivery', 'call']);
  assert.deepEqual(model.timedEvents.map(event => event.kind), ['capture', 'call', 'delivery']);
  assert.equal(model.transitions[1].state, 'anomaly');
  assert.equal(model.transitions[1].milliseconds, null);
  assert.equal(model.transitions[1].label, 'Timing anomaly');
  assert.match(model.anomalies[0].message, /First dial precedes delivered/);
  assert.equal(model.duration, null);
});

test('elapsed time uses valid event instants including offsets and no arbitrary SLA judgement', () => {
  const model = buildLedgerTimeline({ fetched: '2026-09-28T11:04:00+02:00', delivered_time: '2026-09-28T09:11:00Z', first_call_time: '2026-09-28T11:29:00Z' }, now);
  assert.equal(model.timedEvents[0].timestamp, '2026-09-28T09:04:00.000Z');
  assert.deepEqual(model.transitions.map(transition => transition.label), ['7m', '2h 18m']);
  assert.deepEqual(model.anomalies, []);
  assert.equal(JSON.stringify(model).includes('SLA'), false);
  assert.equal(formatLedgerDuration(-1000), 'Time unavailable');
  assert.equal(formatLedgerDuration(NaN), 'Time unavailable');
  assert.equal(formatLedgerDuration(0), '0s');
  assert.equal(formatLedgerDuration(500), '<1s');
});

test('source field handoffs stay explicit and independent from normalized labels', () => {
  const model = buildLedgerTimeline(complete, now);
  assert.deepEqual(model.milestones.map(event => event.sourceFields), [
    ['Fetched', 'Offershop Source', 'OFFERNET MEDIUM'], ['HLC Delivered'], ['HLC First Call Date'], ['HLC RPC'], ['HLC Sale'], ['HLC Activated'],
  ]);
  assert.deepEqual(model.milestones.find(event => event.kind === 'delivery')?.evidenceFields, [{ label: 'delivered_time', value: complete.delivered_time }]);
  assert.deepEqual(model.milestones.find(event => event.kind === 'sale')?.evidenceFields, [{ label: 'sale', value: true }]);
});
