import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseReconciliationEvidence, prepareReconciliationScope, reconciliationCommand, RECONCILIATION_PERSISTENCE, RECONCILIATION_IMPORT_VERSION } from '../contracts/reconciliationEvidence';
import { runReconciliation, RECONCILIATION_VERSION } from '../scripts/reconcile-operational-metrics';

const selected = prepareReconciliationScope({ tenant: 'mtn', startDate: '2026-09-01', endDate: '2026-09-30', filters: {} });
const warehouse = { fetched: '2', qualifiedDelivered: '1', qualifiedDialled: '1', rpc: '0', recordedSales: '1', recordedActivations: '1', callCountUnrecorded: '1', completeRevenueTotal: null, knownRevenueSubtotal: '12345678901234567890.123456789' };
async function artifact(mode: 'dry-run' | 'warehouse' | 'compare' = 'compare') {
  return await runReconciliation({ scope: { clientId: 'mtn', startDate: selected.startDate, endDate: selected.endDate }, compareService: mode === 'compare', dryRun: mode === 'dry-run' }, {
    client: { dryRun: async () => ({ totalBytesProcessed: 123 }), createQueryJob: async () => [{ id: 'synthetic-job', getQueryResults: async () => [[warehouse]] }] } as any,
    service: (async () => ({ kpis: { fetchedLeads: 2, deliveredLeads: 1, dialledLeads: 1, contactedLeads: 0, saleLeads: 1, activatedLeads: 1, unrecordedCallLeads: 1 } })) as any,
  });
}
const parse = (value: unknown) => parseReconciliationEvidence(JSON.stringify(value), selected);

test('readiness imports the existing harness output without changing scope or declaring trusted persistence', async () => {
  assert.equal(RECONCILIATION_IMPORT_VERSION, RECONCILIATION_VERSION);
  const result = parse(await artifact());
  assert.equal(result.state, 'Matched');
  assert.equal(result.declaredStatus, 'RECONCILED_FOR_SCOPE');
  assert.equal(result.provenance, 'OPERATOR_SUPPLIED_UNATTESTED');
  assert.equal(result.metrics.knownRevenueSubtotal, warehouse.knownRevenueSubtotal);
  assert.equal(result.metrics.completeRevenueTotal, null);
  assert.equal(result.comparisons.length, 7);
  assert.deepEqual(result.scope, selected);
  assert.equal(RECONCILIATION_PERSISTENCE.status, 'UNAVAILABLE');
});

test('dry run and warehouse-only imports remain distinct from compared evidence', async () => {
  const dryRun = parse(await artifact('dry-run'));
  assert.equal(dryRun.state, 'Dry-run validated');
  assert.equal(dryRun.declaredStatus, 'LIVE_RECONCILIATION_PENDING');
  assert.equal(dryRun.dryRunBytes, 123);
  assert.deepEqual(dryRun.metrics, {});
  const measured = parse(await artifact('warehouse'));
  assert.equal(measured.state, 'Warehouse measured');
  assert.equal(measured.declaredStatus, 'WAREHOUSE_MEASURED_ONLY');
  assert.deepEqual(measured.comparisons, []);
});

test('exact differences distinguish mismatch and unavailable without converting either to zero', async () => {
  const raw: any = await artifact();
  raw.comparisons[0] = { metric: 'fetched', warehouse: '2', service: '1', difference: '-1', status: 'MISMATCH' };
  raw.reconciliationStatus = 'MISMATCH_OR_UNAVAILABLE';
  assert.equal(parse(raw).state, 'Mismatch detected');
  raw.comparisons[0] = { metric: 'fetched', warehouse: '2', service: null, difference: null, status: 'UNAVAILABLE' };
  const result = parse(raw);
  assert.equal(result.state, 'Unavailable');
  assert.equal(result.comparisons[0].difference, null);
});

test('foreign tenant, period and complete-filter mismatches cannot attach imported results to another scope', async () => {
  const raw: any = await artifact();
  for (const change of [{ tenant: 'mondo' }, { period: { start: '2026-09-02', end: '2026-09-30' } }, { filters: { vendor: 'A' } }]) {
    assert.throws(() => parse({ ...raw, ...change }), /does not match/);
  }
});

test('unsupported versions, missing provenance and fake approval claims fail closed', async () => {
  const raw: any = await artifact();
  for (const change of [{ harnessVersion: 'unknown' }, { definitionVersion: 'old' }, { sourceTables: [] }, { validationStatus: 'VERIFIED' },
    { sourceContractStatus: 'APPROVED' }, { truncation: true }, { countingGrain: 'records' }, { dateBasis: 'SALE_DATE' },
    { generatedAt: 'yesterday' }, { generatedAt: '2026-10-02T24:00:00Z' }, { generatedAt: '2026-02-30T10:00:00Z' },
    { asOf: '2999-01-01T00:00:00Z' }, { maximumBytesBilled: '0' }]) {
    assert.throws(() => parse({ ...raw, ...change }), JSON.stringify(change));
  }
});

test('edited counts, false match claims and incomplete comparisons are rejected', async () => {
  const raw: any = await artifact();
  for (const comparison of [
    { ...raw.comparisons[0], warehouse: '3' }, { ...raw.comparisons[0], service: '4' },
    { ...raw.comparisons[0], difference: '1' }, { ...raw.comparisons[0], status: 'VERIFIED' },
    { ...raw.comparisons[0], service: 2 }, { ...raw.comparisons[0], metric: 'profit' },
  ]) assert.throws(() => parse({ ...raw, comparisons: [comparison, ...raw.comparisons.slice(1)] }));
  assert.throws(() => parse({ ...raw, comparisons: raw.comparisons.slice(1) }), /complete supported/);
  assert.throws(() => parse({ ...raw, comparedMetrics: [] }), /metric list/);
  assert.throws(() => parse({ ...raw, reconciliationStatus: 'WAREHOUSE_MEASURED_ONLY' }), /contradicts/);
});

test('dry runs cannot smuggle measured or reconciled evidence', async () => {
  const raw = await artifact('dry-run');
  assert.throws(() => parse({ ...raw, metrics: warehouse }), /dry run cannot/);
  assert.throws(() => parse({ ...raw, reconciliationStatus: 'RECONCILED_FOR_SCOPE' }), /dry run cannot/);
  assert.throws(() => parse({ ...raw, dryRun: { totalBytesProcessed: -1 } }), /Invalid dry-run/);
});

test('command scope refuses unsupported, private, multiple-value and silently narrowed filters', () => {
  for (const filters of [
    { lead_id: { operator: 'equals', value: 'private' } }, { campaign: { operator: 'equals', value: 'A' } },
    { vendor: { operator: 'in', values: ['A', 'B'] } }, { vendor: { operator: 'not_equals', value: 'A' } },
    { vendor: { operator: 'equals', value: '--dry-run' } }, { vendor: { operator: 'equals', value: 'A\nB' } },
  ]) assert.throws(() => prepareReconciliationScope({ ...selected, filters: filters as any }));
  assert.throws(() => prepareReconciliationScope({ ...selected, filters: {}, unsupportedParameters: ['search'] }), /cannot apply/);
  for (const [startDate, endDate] of [['2026-02-30', '2026-03-01'], ['2026-10-02', '2026-09-01'], ['2024-01-01', '2026-01-01']]) {
    assert.throws(() => prepareReconciliationScope({ ...selected, startDate, endDate, filters: {} }));
  }
});

test('prepared command shell-quotes every dynamic argument without evaluating substitutions', () => {
  const value = "Vendor's $(printf injected); `printf unexpected`";
  const scoped = prepareReconciliationScope({ ...selected, filters: { vendor: { operator: 'equals', value } } });
  const command = reconciliationCommand(scoped, 'compare');
  // set -- parses shell words without invoking npm or the warehouse harness.
  const result = spawnSync('/bin/sh', ['-c', `set -- ${command}; printf '%s\\n' "$@"`], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.deepEqual(result.stdout.trimEnd().split('\n'), ['npm', 'run', 'reconcile:metrics', '--', '--client', 'mtn', '--start', '2026-09-01', '--end', '2026-09-30', '--vendor', value, '--compare-service']);
});

test('admin workflow has no browser execution, persistence or new navigation destination', () => {
  const ui = readFileSync('src/features/trust/components/ReconciliationReadiness.tsx', 'utf8');
  assert.match(ui, /if \(!isAdmin\)/);
  assert.match(ui, /OperatorWorkflow key=/);
  assert.match(ui, /<ReconciliationView/);
  assert.match(ui, /<EvidenceTrace/);
  assert.doesNotMatch(ui, /fetch\(|localStorage|sessionStorage|apiFetch|executeReport/);
  assert.match(readFileSync('src/pages/AdminValidation.tsx', 'utf8'), /<ReconciliationReadiness/);
  assert.doesNotMatch(readFileSync('src/app/routeManifest.tsx', 'utf8'), /reconciliation-readiness/);
});
