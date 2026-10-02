import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { operationalLeadCtes, operationalLeadSelectSql, operationalLifecycleStateSql } from '../server/analytics/common/leadMetrics';
import { assembleLifecycleDiagnostics, compileLifecycleDiagnostics } from '../server/analytics/common/lifecycleDiagnostics';
import { buildInvestigationPredicate, exceptionPredicate } from '../server/analytics/investigation/exceptionPredicates';
import { buildQualifiedInvestigationEvidence } from '../server/analytics/investigation/records';
import { AUTHORITATIVE_METRICS } from '../contracts/metricRegistry';

const at = (time: string) => Date.parse(`2026-09-01T${time}:00Z`);
const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-30' };
/** Execute the actual portable qualification expression, not a reimplementation of its rules.
 * BigQuery timestamp normalization is tested separately; these inputs are already normalized.
 */
function fixtureDb() {
  const db = new DatabaseSync(':memory:');
  db.function('TIMESTAMP_DIFF', (end, start, unit) => end == null || start == null ? null : Math.trunc((Number(end) - Number(start)) / (unit === 'DAY' ? 86400000 : 1000)));
  db.exec(`CREATE TABLE source (lead_id TEXT, fetched_ts INTEGER, delivered_ts INTEGER, first_call_ts INTEGER, sale_ts INTEGER, activation_ts INTEGER, is_rpc INTEGER, recorded_call_count INTEGER, has_disposition INTEGER)`);
  const insert = db.prepare('INSERT INTO source VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insert.run('clean', at('10:00'), at('10:01'), at('10:05'), at('10:20'), at('11:00'), 1, 1, 1);
  insert.run('dial-before-capture', at('10:00'), at('10:01'), at('09:00'), null, null, 1, 5, 1);
  insert.run('delivery-before-capture', at('10:00'), at('09:00'), at('10:05'), null, null, 0, 3, 1);
  insert.run('activation-before-sale', at('10:00'), at('10:01'), at('10:05'), at('10:20'), at('10:10'), 1, 2, 1);
  insert.run('sale-without-rpc', at('10:00'), at('10:01'), at('10:05'), at('10:20'), null, null, null, 0);
  insert.run('activation-without-sale', at('10:00'), at('10:01'), null, null, at('11:00'), null, 0, 0);
  insert.run('dial-without-delivery', at('10:00'), null, at('10:05'), null, null, 0, 5, 0);
  insert.run('sale-before-capture', at('10:00'), at('10:01'), at('10:05'), at('09:00'), at('11:00'), 1, 4, 1);
  insert.run('explicit-no-rpc', at('10:00'), at('10:01'), at('10:05'), null, null, 0, 5, 1);
  insert.run('unknown-rpc', at('10:00'), at('10:01'), at('10:05'), null, null, null, 5, 1);
  insert.run('no-predecessor', null, at('10:01'), at('10:05'), at('10:20'), at('11:00'), 1, null, 0);
  db.exec(`CREATE VIEW qualified AS SELECT source.*,
    delivered_ts IS NOT NULL AS has_recorded_delivery,
    first_call_ts IS NOT NULL AS has_recorded_first_dial,
    sale_ts IS NOT NULL AS is_sale, activation_ts IS NOT NULL AS is_activated,
    ${operationalLifecycleStateSql()} FROM source`);
  return db;
}

test('chronology executes clean lifecycle qualification while preserving independent source evidence and RPC unknowns', () => {
  const db = fixtureDb();
  try {
    const get = (id: string) => db.prepare('SELECT * FROM qualified WHERE lead_id = ?').get(id)!;
    const clean = get('clean');
    for (const field of ['is_delivered', 'is_dialled', 'is_qualified_rpc', 'is_qualified_sale', 'is_qualified_activation', 'has_qualified_rpc_sale']) assert.equal(clean[field], 1, field);
    const earlyDial = get('dial-before-capture');
    assert.equal(earlyDial.first_call_ts, at('09:00'));
    assert.equal(earlyDial.has_recorded_first_dial, 1);
    assert.equal(earlyDial.first_dial_before_capture, 1);
    assert.equal(earlyDial.first_dial_before_delivery, 1);
    assert.equal(earlyDial.is_dialled, 0);
    assert.equal(earlyDial.is_rpc, 1, 'positive RPC remains recorded evidence');
    assert.equal(earlyDial.is_qualified_rpc, 0, 'it cannot enter the qualified RPC / dialled population');
    const earlyDelivery = get('delivery-before-capture');
    assert.equal(earlyDelivery.has_recorded_delivery, 1);
    assert.equal(earlyDelivery.delivery_before_capture, 1);
    assert.equal(earlyDelivery.is_delivered, 0);
    assert.equal(earlyDelivery.is_dialled, 0);
    const earlyActivation = get('activation-before-sale');
    assert.equal(earlyActivation.is_activated, 1);
    assert.equal(earlyActivation.activation_before_sale, 1);
    assert.equal(earlyActivation.is_qualified_activation, 0);
    const missingRpc = get('sale-without-rpc');
    assert.equal(missingRpc.is_rpc, null);
    assert.equal(missingRpc.is_sale, 1);
    assert.equal(missingRpc.is_qualified_sale, 1);
    assert.equal(missingRpc.has_qualified_rpc_sale, 0);
    assert.equal(get('activation-without-sale').is_activated, 1);
    assert.equal(get('activation-without-sale').is_qualified_activation, 0);
    assert.equal(get('sale-before-capture').is_sale, 1);
    assert.equal(get('sale-before-capture').is_qualified_sale, 0);
    assert.equal(get('sale-before-capture').has_qualified_rpc_sale, 0);
    assert.equal(get('sale-before-capture').is_qualified_activation, 0);
    assert.equal(get('dial-without-delivery').is_dialled, 0);
    for (const field of ['is_delivered', 'is_dialled', 'is_qualified_sale', 'is_qualified_activation']) assert.equal(get('no-predecessor')[field], 0, field);
  } finally { db.close(); }
});

test('RPC aggregation retains tri-state precedence and cumulative call counts preserve unrecorded vs zero', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE operational_raw(is_rpc INTEGER, total_calls INTEGER)');
    const insert = db.prepare('INSERT INTO operational_raw VALUES (?, ?)');
    const sql = operationalLeadSelectSql('operational_raw');
    const rpcExpression = sql.match(/CASE WHEN COUNTIF\(is_rpc\).*?END AS is_rpc/)![0]
      .replace('COUNTIF(is_rpc)', 'SUM(is_rpc IS TRUE)').replace('COUNTIF(is_rpc IS NULL)', 'SUM(is_rpc IS NULL)');
    for (const [values, expected] of [[[1], 1], [[0], 0], [[null], null], [[0, null], null], [[1, null], 1]] as const) {
      db.exec('DELETE FROM operational_raw');
      for (const value of values) insert.run(value, null);
      assert.equal(db.prepare(`SELECT ${rpcExpression} FROM operational_raw`).get()!.is_rpc, expected);
    }
    for (const [values, expected] of [[[null], null], [[0], 0], [[1], 1], [[null, 0, 1, 3], 3], [[-1], null]] as const) {
      db.exec('DELETE FROM operational_raw');
      for (const value of values) insert.run(null, value);
      assert.equal(db.prepare('SELECT MAX(CASE WHEN total_calls >= 0 THEN total_calls END) AS count FROM operational_raw').get()!.count, expected);
    }
    const ctes = operationalLeadCtes(scope);
    assert.match(ctes, /CASE WHEN SAFE_CAST\(hlc.total_calls AS INT64\) >= 0 THEN SAFE_CAST\(hlc.total_calls AS INT64\) END AS total_calls/);
    assert.match(ctes, /MAX\(total_calls\) AS recorded_call_count/);
    assert.doesNotMatch(ctes, /COALESCE\([^\n]*total_calls/);
    for (const field of ['has_recorded_delivery', 'has_recorded_first_dial', 'has_recorded_sale', 'has_recorded_activation']) assert.ok(ctes.includes(`AS ${field}`));
  } finally { db.close(); }
});

test('queue count equals record-drill count for chronology, effort, SLA and activation predicates', () => {
  const db = fixtureDb();
  const now = String(at('12:00'));
  const dialect = (sql: string) => sql.replace(/\b(SECOND|DAY)\b/g, "'$1'");
  try {
    for (const id of ['awaiting-first-dial', 'sla-breach', 'missing-disposition', 'zero-call-leads', 'one-call-only', 'high-attempt-no-rpc', 'sales-awaiting-activation', 'unactivated-sales', 'invalid-timestamps']) {
      const queue = dialect(exceptionPredicate(id, 'm', now)!);
      const drill = dialect(buildInvestigationPredicate({ ...scope, drill: id }, {}, 'm', now));
      const count = db.prepare(`SELECT SUM(CASE WHEN (${queue}) THEN 1 ELSE 0 END) AS count FROM qualified m`).get()!.count;
      const records = db.prepare(`SELECT lead_id FROM qualified m WHERE ${drill}`).all();
      assert.equal(count, records.length, id);
      if (id === 'awaiting-first-dial') assert.deepEqual(records.map(r => r.lead_id), ['dial-before-capture', 'activation-without-sale']);
      if (id === 'high-attempt-no-rpc') assert.deepEqual(records.map(r => r.lead_id), ['dial-without-delivery', 'explicit-no-rpc']);
      if (id === 'zero-call-leads') assert.deepEqual(records.map(r => r.lead_id), ['activation-without-sale']);
    }
    for (const [drillValue, required, converted] of [
      ['rpc-to-sales', 'is_qualified_rpc', 'has_qualified_rpc_sale'],
      ['sales-to-activated', 'is_sale', 'is_qualified_activation'],
    ]) {
      const loss = buildInvestigationPredicate({ ...scope, drill: 'funnel-loss', drillValue }, {});
      const lossCount = db.prepare(`SELECT COUNT(*) n FROM qualified m WHERE ${loss}`).get()!.n;
      const counts = db.prepare(`SELECT SUM(${required}) parent, SUM(${converted}) converted FROM qualified`).get()!;
      assert.equal(lossCount, Number(counts.parent) - Number(counts.converted));
    }
  } finally { db.close(); }
});

test('diagnostics use ordered intersections and expose NON_NESTED even when qualified headline counts are nested', () => {
  const query = compileLifecycleDiagnostics(scope).ctesSql;
  assert.match(query, /COUNTIF\(has_qualified_rpc_sale\) AS rpcSale/);
  assert.match(query, /COUNTIF\(is_qualified_activation\) AS saleActivated/);
  assert.match(query, /COUNTIF\(has_recorded_first_dial\) AS recordedDialled/);
  const result = assembleLifecycleDiagnostics([{ period: 'current', dimension: 'all', fetched: 4, delivered: 3, dialled: 2, rpc: 1, sales: 2, activations: 2,
    recordedDelivered: 4, recordedDialled: 3, recordedRpc: 2, deliveredDialled: 2, dialledRpc: 1, rpcSale: 0, saleActivated: 1 }], null);
  assert.deepEqual(result.recordedEvidence, { delivered: 4, dialled: 3, rpc: 2 });
  assert.ok(result.transitions.every(t => t.status === 'NON_NESTED'));
  assert.equal(result.transitions.find(t => t.from === 'Sale')!.conversionRate, 50);
  assert.equal(result.comparisons.activationRate.current, 100, 'independent population ratio is preserved');
});

test('dossier evidence exposes raw timestamps, qualified states and individual chronology flags without masking RPC evidence', () => {
  const query = buildQualifiedInvestigationEvidence({ ...scope, drill: 'invalid-timestamps' }).qualifiedSql;
  for (const field of ['m.first_call_ts', 'm.has_recorded_first_dial as recorded_first_dial', 'm.is_dialled as dialled', 'm.is_rpc as contacted', 'm.is_qualified_rpc as qualified_rpc', 'm.sale_before_capture', 'm.activation_before_sale']) assert.ok(query.includes(field), field);
  assert.match(AUTHORITATIVE_METRICS.dialled_leads.plainDefinition, /at or after both capture and delivery/);
  assert.match(AUTHORITATIVE_METRICS.sale_leads.plainDefinition, /does not infer billing, collection/);
  assert.match(AUTHORITATIVE_METRICS.activation_rate.plainDefinition, /not linked sale-to-activation conversion/);
  assert.equal(AUTHORITATIVE_METRICS.dialled_leads.sourceContractStatus, 'BUSINESS_MEANING_NOT_VERIFIED');
  assert.equal(AUTHORITATIVE_METRICS.dialled_leads.reconciliationStatus, 'NOT_VERIFIED');
});
