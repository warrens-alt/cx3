import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseReconciliationArgs, compileReconciliationQuery, compareReconciliation, runReconciliation } from '../scripts/reconcile-operational-metrics';
import { readOnlyQueryOptions } from '../server/bigquery/readOnly';
import { getClientConfig } from '../server/bigquery/config';
const args = ['--client', 'mtn', '--start', '2026-09-01', '--end', '2026-09-30'];

test('reconciliation CLI requires explicit tenant and valid bounded dates; help is offline', () => {
  assert.equal(parseReconciliationArgs(['--help']), null);
  assert.throws(() => parseReconciliationArgs([]), /--client is required/);
  assert.throws(() => parseReconciliationArgs(args.slice(2)), /--client is required/);
  assert.throws(() => parseReconciliationArgs(['--client','unknown',...args.slice(2)]), /Unknown or inactive/);
  for (const dates of [['2026-02-30','2026-03-01'],['2026-09-30','2026-09-01'],['2025-01-01','2026-09-01']]) {
    assert.throws(() => parseReconciliationArgs(['--client','mtn','--start', dates[0], '--end', dates[1]]));
  }
  assert.throws(() => parseReconciliationArgs([...args,'--client','mtn']), /only once/);
  assert.throws(() => parseReconciliationArgs([...args,'--campaign','x']), /Unknown option/);
  assert.throws(() => parseReconciliationArgs([...args,'--vendor','all']), /Omit --vendor/);
  assert.throws(() => parseReconciliationArgs([...args,'--grade','Gold']), /UNSUPPORTED_FILTER/);
});

for (const tenant of ['default_tenant','mtn','blc','mondo','rewardsco']) test(`independent query respects configured ${tenant} source and capture cohort`, () => {
  const options = parseReconciliationArgs(['--client',tenant,...args.slice(2),'--source','approved-source','--vendor','a-vendor'])!;
  const compiled = compileReconciliationQuery(options.scope, '2026-10-02T10:00:00Z');
  assert.match(compiled.query, new RegExp(getClientConfig(tenant).semanticMappings.tables.leads.replaceAll('.', '\\.')));
  assert.match(compiled.query, /DATE\(SAFE_CAST\(l.fetched AS TIMESTAMP\), @scopeTimezone\)/);
  assert.equal(compiled.params.scopeTimezone, getClientConfig(tenant).timezone);
  assert.equal(compiled.params.vendor, 'a-vendor');
  assert.equal(compiled.params.source, 'approved-source');
  assert.match(compiled.query, /LOWER\(hlc.vendor\) = LOWER\(@vendor\)/);
  assert.doesNotMatch(compiled.query, /operational_leads|operational_raw/);
  assert.equal(readOnlyQueryOptions(compiled).useLegacySql, false);
  assert.equal(readOnlyQueryOptions(compiled).maximumBytesBilled, process.env.BIGQUERY_MAX_BYTES_BILLED || '1000000000');
});

test('independent reconciliation preserves all chronology, unknown, financial and exact precision evidence', () => {
  const { query } = compileReconciliationQuery(parseReconciliationArgs(args)!.scope, '2026-10-02T10:00:00Z');
  for (const term of ['1900|1970','SAFE_CAST(NULLIF(TRIM','MAX(calls)','COUNTIF(rpc IS NULL)','calls IS NULL','calls = 0','rpc IS FALSE','delivery >= capture','dial >= delivery','activation < sale','sale >= capture AND activation >= sale','vendor_key IS NOT NULL','transaction_key IS NOT NULL','currency = @currency','variants = 1','COUNTIF(eligible IS NOT TRUE)','COUNTIF(complete_revenue IS NULL)','knownRevenueSubtotal','eligibleRevenueKeys','duplicateRevenueRowsCollapsed','APPROX_QUANTILES','backlogOver15m','backlogOver60m']) assert.ok(query.includes(term), term);
  assert.match(query, /CAST\(COUNT\(\*\) AS STRING\) AS fetched/);
  assert.match(query, /THEN NULL ELSE SUM\(complete_revenue\) END AS STRING/);
  assert.doesNotMatch(query, /COALESCE\(calls|COALESCE\(amount|COALESCE\(rpc/);
  const script = readFileSync(new URL('../scripts/reconcile-operational-metrics.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /^import .*operationalLeadCtes/m);
});

test('comparison is scope-only and rejects unsafe integers/missing populations instead of zero substitution', () => {
  const base = { fetched: '1', qualifiedDelivered: '1', qualifiedDialled: '0', rpc: '0', recordedSales: '0', recordedActivations: '0', callCountUnrecorded: '1' };
  const kpis = { fetchedLeads: 1, deliveredLeads: 1, dialledLeads: 0, contactedLeads: 0, saleLeads: 0, activatedLeads: 0, unrecordedCallLeads: 1 };
  assert.ok(compareReconciliation(base, { kpis }).every(row => row.status === 'RECONCILED_FOR_SCOPE'));
  assert.equal(compareReconciliation({ ...base, fetched: '2' }, { kpis })[0].difference, '-1');
  assert.equal(compareReconciliation({ ...base, fetched: '9007199254740993' }, { kpis: { ...kpis, fetchedLeads: 9007199254740992 } })[0].status, 'UNAVAILABLE');
  assert.equal(compareReconciliation({ ...base, fetched: null }, { kpis })[0].difference, null);
});

test('dry-run does not run a service or warehouse result query; source denial cannot broaden scope', async () => {
  const options = parseReconciliationArgs([...args,'--dry-run','--compare-service'])!;
  let dryRuns = 0, queries = 0, services = 0;
  const deps = { client: { dryRun: async () => { dryRuns++; return { totalBytesProcessed: 100 }; }, createQueryJob: async () => { queries++; throw new Error('Denied configured source'); } } as any,
    service: (async () => { services++; throw new Error('Must not execute'); }) as any };
  const result = await runReconciliation(options, deps);
  assert.equal(result.reconciliationStatus, 'LIVE_RECONCILIATION_PENDING');
  assert.equal(dryRuns, 1); assert.equal(queries, 0); assert.equal(services, 0);
  await assert.rejects(runReconciliation({ ...options, dryRun: false }, deps), /Denied configured source/);
  assert.equal(queries, 1); assert.equal(services, 0);
});

test('opt-in reconciliation emits scope-specific evidence, job identity and exact monetary strings', async () => {
  const options = parseReconciliationArgs([...args, '--compare-service'])!;
  const metrics = { fetched: '2', qualifiedDelivered: '1', qualifiedDialled: '1', rpc: '0', recordedSales: '1', recordedActivations: '1', callCountUnrecorded: '1', completeRevenueTotal: null, knownRevenueSubtotal: '12345678901234567890.123456789' };
  let comparisons = 0;
  const result = await runReconciliation(options, {
    client: { createQueryJob: async (request: any) => {
      readOnlyQueryOptions(request);
      assert.equal(request.params.startDate, options.scope.startDate);
      return [{ id: 'synthetic-read-only-job', getQueryResults: async () => [[metrics]] }];
    } } as any,
    service: (async (scope: any, settings: any) => {
      comparisons++;
      assert.deepEqual(scope, options.scope);
      assert.equal(settings.includeDiagnostics, false);
      return { kpis: { fetchedLeads: 2, deliveredLeads: 1, dialledLeads: 1, contactedLeads: 0, saleLeads: 1, activatedLeads: 1, unrecordedCallLeads: 1 } };
    }) as any,
  });
  assert.equal(comparisons, 1);
  assert.equal(result.reconciliationStatus, 'RECONCILED_FOR_SCOPE');
  assert.equal(result.validationStatus, 'NOT_VERIFIED');
  assert.equal(result.sourceContractStatus, 'BUSINESS_MEANING_NOT_VERIFIED');
  assert.equal(result.tenant, 'mtn');
  assert.deepEqual(result.sourceTables, [getClientConfig('mtn').semanticMappings.tables.leads]);
  assert.equal('warehouseQueryId' in result && result.warehouseQueryId, 'synthetic-read-only-job');
  assert.equal('metrics' in result && result.metrics.knownRevenueSubtotal, '12345678901234567890.123456789');
  assert.equal('metrics' in result && result.metrics.completeRevenueTotal, null);
  assert.equal(result.truncation, false);
});
