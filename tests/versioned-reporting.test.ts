import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { METRIC_VERSION, REPORT_MAX_ROWS } from '../contracts/reporting';
import { executeReport } from '../server/reporting/service';
import { reportRequest, reportScopeHash } from '../server/reporting/scope';
import { BigQueryReportRepository } from '../server/reporting/repository';
import { createReportingRouter } from '../server/reporting/router';
import { apiErrorHandler } from '../server/apiErrors';
import { sameOriginRequests } from '../server/httpGuards';
import { fixtureRelease, fixtureRepository, fixtureRow, principal, request } from './reporting-fixtures';

test('executor authenticates and authorises explicit tenant before accessing a release', async () => {
  const { repository, calls } = fixtureRepository();
  await assert.rejects(executeReport(repository, undefined, request), { status: 401 });
  await assert.rejects(executeReport(repository, principal, { ...request, tenantId: 'tenant_b' }), { status: 403 });
  await assert.rejects(executeReport(repository, principal, { ...request, tenantId: undefined }), { status: 422 });
  assert.equal(calls.releases, 0);
});

test('requests reject SQL, identities, unsupported filters, unknown metrics and ambiguous versions', () => {
  for (const extra of [{ query: 'SELECT * FROM x' }, { table: 'x.y.z' }, { filters: { lead_id: ['private'] } }, { filters: { grade: ['Gold'] } }, { metrics: ['__proto__'] }, { metrics: ['fetched_leads', 'fetched_leads'] }, { contractVersion: 'unknown' }, { startDate: '2026-02-30' }, { observationCutoff: '2026-09-03T00:00:00+02:00' }, { startDate: '2024-01-01' }, { filters: { vendor: [] } }]) {
    assert.throws(() => reportRequest({ ...request, ...extra }));
  }
  assert.equal(reportScopeHash(reportRequest({ ...request, filters: { vendor: ['B', 'A', 'A'] } })), reportScopeHash(reportRequest({ ...request, filters: { vendor: ['A', 'B'] } })));
  assert.notEqual(reportScopeHash(request), reportScopeHash({ ...request, tenantId: 'tenant_b' }));
});

test('missing, malformed, revoked and unapproved releases fail closed', async () => {
  await assert.rejects(executeReport(fixtureRepository(null).repository, principal, request), { status: 404 });
  for (const change of [{ snapshots: {} }, { checks: [] }, { tenantId: 'tenant_b' }, { status: 'REVOKED' }, { execution: { ...fixtureRelease().execution, supportedFilters: ['lead_id'] } }]) {
    const { repository, calls } = fixtureRepository({ ...fixtureRelease(), ...change } as any);
    await assert.rejects(executeReport(repository, principal, request));
    assert.equal(calls.queries.length, 0);
  }
});

test('legacy manifests and changed definitions return structured NOT_SUPPORTED values', async () => {
  for (const change of [{ execution: undefined }, { metricVersion: 'future-definition' }, { execution: { ...fixtureRelease().execution!, definitionHash: '0'.repeat(64) } }]) {
    const { repository, calls } = fixtureRepository({ ...fixtureRelease(), ...change });
    const report = await executeReport(repository, principal, request);
    assert.equal(report.status, 'NOT_SUPPORTED'); assert.equal(report.totals[0].value, null);
    assert.equal(report.totals[0].calculationStatus, 'UNAVAILABLE'); assert.equal(calls.queries.length, 0);
  }
});

test('partial and unavailable source evidence never becomes zero or checked data', async () => {
  for (const state of ['PARTIAL', 'UNAVAILABLE', 'SHORT_COVERAGE', 'MISSING_EARLIEST'] as const) {
    const release = fixtureRelease();
    if (state === 'SHORT_COVERAGE') release.sources[0].completeThrough = '2026-09-01T00:00:00Z';
    else if (state === 'MISSING_EARLIEST') release.sources[0].earliestAvailable = null;
    else release.sources[0].status = state;
    const { repository, calls } = fixtureRepository(release);
    const result = await executeReport(repository, principal, request);
    assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.totals[0].value, null);
    assert.equal(result.totals[0].completeness, state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'PARTIAL');
    assert.equal(calls.queries.length, 0);
  }
});

test('registered bounded execution preserves exact counts, grain, scope and independent evidence states', async () => {
  const { repository, calls } = fixtureRepository();
  const result = await executeReport(repository, principal, request);
  assert.equal(result.status, 'AVAILABLE'); assert.equal(result.totals[0].value, '9007199254740993');
  assert.equal(result.totals[0].evidence.grain, 'lead'); assert.equal(result.metricVersion, METRIC_VERSION);
  assert.equal(result.totals[0].evidence.sources[0].snapshot.table, 'fixture.reporting.leads');
  assert.equal(result.totals[0].evidence.reconciliationStatus, 'NOT_VERIFIED'); assert.equal(result.evidence.businessVerified, 'NOT_VERIFIED');
  assert.equal(result.evidence.reproduced, 'NOT_RUN'); assert.equal(result.replay.status, 'NOT_CONFIGURED');
  assert.equal(calls.snapshots, 1); assert.equal(calls.queries.length, 1);
  const compiled = calls.queries[0];
  assert.match(compiled.query, /FROM `fixture.reporting.approved_results`/);
  assert.match(compiled.query, /tenant_id = @tenant AND release_id = @release AND scope_hash = @scope/);
  assert.match(compiled.query, new RegExp(`LIMIT ${REPORT_MAX_ROWS + 1}`));
  assert.equal(compiled.params.tenant, request.tenantId); assert.equal(compiled.params.scope, result.scopeHash);
  assert.doesNotMatch(compiled.query, /operational|clustered_lead_ledger|SELECT \*/);
  const second = await executeReport(repository, principal, request);
  assert.equal(second.resultHash, result.resultHash); assert.deepEqual(second.totals, result.totals);
});

test('release scope permissions and cutoff are enforced before snapshot queries', async () => {
  const { repository, calls } = fixtureRepository();
  for (const change of [{ filters: { medium: ['sms'] } }, { grouping: 'capture_month' }, { observationCutoff: '2026-09-04T00:00:00.000Z' }]) {
    await assert.rejects(executeReport(repository, principal, { ...request, ...change }), { status: 422 });
  }
  assert.equal(calls.queries.length, 0);
});

test('invalid or cross-tenant aggregate rows are rejected, never coerced or truncated', async () => {
  for (const change of [{ tenant_id: 'tenant_b' }, { scope_hash: 'wrong' }, { definition_version: 'changed' }, { grain: 'call' }, { unit: 'currency' }, { value: 9007199254740992 }, { numerator: undefined }, { numerator: '2' }, { is_total: false }, { value: 'NaN' }, { denominator: '1' }, { completeness: 'PARTIAL' }]) {
    await assert.rejects(executeReport(fixtureRepository(fixtureRelease(), [{ ...fixtureRow(), ...change }]).repository, principal, request));
  }
  for (const rows of [[], [fixtureRow(), fixtureRow()], Array.from({ length: REPORT_MAX_ROWS + 1 }, () => fixtureRow())]) {
    await assert.rejects(executeReport(fixtureRepository(fixtureRelease(), rows).repository, principal, request));
  }
});

test('ratios validate exact numerator/denominator and keep zero denominator unavailable', async () => {
  const scope = { ...request, metrics: ['call_coverage'] };
  const row = { ...fixtureRow(scope), metric_id: 'call_coverage', grain: 'delivery', unit: 'percent', numerator: '1', denominator: '3', value: '33.333333333' };
  const result = await executeReport(fixtureRepository(fixtureRelease(), [row]).repository, principal, scope);
  assert.equal(result.totals[0].value, '33.333333333');
  await assert.rejects(executeReport(fixtureRepository(fixtureRelease(), [{ ...row, value: '33.33' }]).repository, principal, scope), /ratio disagrees/);
  const zero = await executeReport(fixtureRepository(fixtureRelease(), [{ ...row, numerator: '0', denominator: '0', value: null }]).repository, principal, scope);
  assert.equal(zero.totals[0].value, null); assert.equal(zero.totals[0].calculationStatus, 'UNAVAILABLE');
});

test('repository enforces approved reporting dataset, immutable metadata and BigQuery query ceiling', async () => {
  const priorDataset = process.env.CX_REPORTING_DATASET, priorBudget = process.env.BIGQUERY_MAX_BYTES_BILLED;
  process.env.CX_REPORTING_DATASET = 'fixture.reporting'; process.env.BIGQUERY_MAX_BYTES_BILLED = '900';
  let queryOptions: any, metadataRequests = 0;
  const fake: any = { dataset: () => ({ table: () => ({ getMetadata: async () => { metadataRequests++; return [{ type: 'SNAPSHOT', creationTime: String(Date.parse('2026-09-04T00:00:00Z')), snapshotDefinition: { snapshotTime: '2026-09-03T00:00:00Z' } }]; } }) }),
    createQueryJob: async (options: any) => { queryOptions = options; return [{ id: 'fixture-job', getQueryResults: async () => [[]], getMetadata: async () => [{ statistics: { query: { totalBytesProcessed: '10', cacheHit: false } } }] }]; } };
  try {
    const repository = new BigQueryReportRepository(fake);
    await repository.assertSnapshots(fixtureRelease()); assert.equal(metadataRequests, 10);
    const outside = fixtureRelease(); outside.execution!.snapshot.table = 'other.dataset.results';
    await assert.rejects(repository.assertSnapshots(outside), /outside the approved/);
    const replaced = fixtureRelease(); replaced.execution!.snapshot.createdAt = '2026-09-05T00:00:00Z';
    await assert.rejects(repository.assertSnapshots(replaced), /replaced/);
    const nanoseconds = fixtureRelease(); nanoseconds.execution!.snapshot.snapshotTime = '2026-09-03T00:00:00.000001Z';
    await assert.rejects(repository.assertSnapshots(nanoseconds), /replaced/);
    await repository.query({ query: 'SELECT 1', params: {} }); assert.equal(queryOptions.maximumBytesBilled, '900'); assert.equal(queryOptions.useLegacySql, false);
    await assert.rejects(repository.query({ query: 'DELETE FROM `x.y.z` WHERE true', params: {} }), /Read-only/);
  } finally {
    if (priorDataset === undefined) delete process.env.CX_REPORTING_DATASET; else process.env.CX_REPORTING_DATASET = priorDataset;
    if (priorBudget === undefined) delete process.env.BIGQUERY_MAX_BYTES_BILLED; else process.env.BIGQUERY_MAX_BYTES_BILLED = priorBudget;
  }
});

test('HTTP reporting retains authentication, tenant and origin boundaries', async () => {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { if (req.headers['x-test-auth'] === 'fixture') res.locals.principal = principal; next(); });
  app.use(sameOriginRequests()); app.use('/api/reporting', createReportingRouter(fixtureRepository().repository)); app.use(apiErrorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const send = (body: unknown, headers: Record<string, string> = {}) => fetch(`${origin}/api/reporting`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await send(request)).status, 401);
    assert.equal((await send({ ...request, tenantId: 'tenant_b' }, { 'x-test-auth': 'fixture' })).status, 403);
    assert.equal((await send(request, { 'x-test-auth': 'fixture', Origin: 'https://other.invalid' })).status, 403);
    const response = await send(request, { 'x-test-auth': 'fixture' }); assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, 'AVAILABLE');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
