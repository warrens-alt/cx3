import test from 'node:test';
import assert from 'node:assert/strict';
import { BLC_SOURCES, BLC_SOURCE_IDS, formatBlcCount, isBlcSourceId } from '../contracts/blcReporting';
import { buildBlcQuery, getBlcReport, validateBlcRequest } from '../server/blc/report';
import type { SourceAccess } from '../server/bigquery/sourceAccess';

const scope = { clientId: 'ontact_blc', startDate: '2026-09-01', endDate: '2026-09-02', filters: {} };
function fixture(sourceId: typeof BLC_SOURCE_IDS[number] = 'journey', empty = false): SourceAccess {
  const source = BLC_SOURCES[sourceId];
  return {
    metadata: async () => ({ type: 'VIEW', schema: { fields: Object.entries(source.fields).map(([name, type]) => ({ name, type })) } }),
    listTables: async () => { throw new Error('Unscoped discovery is forbidden'); },
    execute: async () => ({ jobId: 'synthetic-test-job', bytesProcessed: '100', rows: [{
      source_rows: empty ? '0' : '3', distinct_references: empty ? '0' : '2', missing_references: empty ? '0' : '1',
      latest_source_date: empty ? null : '2026-09-02',
      daily: empty ? [] : [{ date: '2026-09-01', source_rows: '1' }, { date: '2026-09-02', source_rows: '2' }],
      breakdown: empty ? [] : [{ label: 'Synthetic group', source_rows: '3' }],
      field_coverage: Object.keys(source.fields).map(field => ({ field, populated_rows: empty ? '0' : '2' })),
    }] }),
  };
}

test('BLC catalog preserves five separate recorded sources and 64 field entries', () => {
  assert.equal(BLC_SOURCE_IDS.length, 5);
  assert.equal(Object.values(BLC_SOURCES).reduce((sum, source) => sum + Object.keys(source.fields).length, 0), 64);
  assert.equal(BLC_SOURCES.remoteActivations.fields.contract_key, 'STRING');
  assert.equal(BLC_SOURCES.activationBridge.fields.contract_key, 'INT64');
  assert.equal(isBlcSourceId('__proto__'), false);
});

test('BLC request permits only BLC or explicitly permitted master workspace and a bounded date range', () => {
  assert.equal(validateBlcRequest({ ...scope, clientId: 'blc' }, 'journey').scope.clientId, 'ontact_blc');
  assert.equal(validateBlcRequest({ ...scope, clientId: 'default_tenant' }, 'journey').scope.clientId, 'default_tenant');
  assert.throws(() => validateBlcRequest({ ...scope, clientId: 'mtn' }, 'journey'), /BLC source access/);
  assert.throws(() => validateBlcRequest(scope, 'unknown'), /Unknown BLC/);
  assert.throws(() => validateBlcRequest({ ...scope, startDate: undefined }, 'journey'), /both start and end/);
  assert.throws(() => validateBlcRequest({ ...scope, startDate: '2024-01-01' }, 'journey'), /366/);
});

test('BLC SQL remains source-specific, parameterized and read-only with no public report scraper', () => {
  for (const id of BLC_SOURCE_IDS) {
    const { query, params } = buildBlcQuery(scope, id);
    assert.match(query, /^WITH scoped AS/);
    assert.ok(query.includes(`\`${BLC_SOURCES[id].table}\``));
    assert.doesNotMatch(query, /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|DROP|ALTER|EXPORT|JOIN)\b|SELECT\s+\*|https?:/i);
    assert.equal(params.startDate, scope.startDate);
    assert.match(query, /LIMIT 201/);
    assert.match(query, /CAST\(COUNT\(\*\) AS STRING\)/);
  }
  const malicious = "a' OR true --";
  const { query, params } = buildBlcQuery({ ...scope, filters: { source: { operator: 'equals', value: malicious } } }, 'journey');
  assert.equal(query.includes(malicious), false);
  assert.equal(params.blc_source, malicious);
  assert.match(query, /blc_owner_0/);
});

test('Unsupported filters never silently disappear or widen BLC reporting', () => {
  assert.throws(() => buildBlcQuery({ ...scope, filters: { vendor: { operator: 'equals', value: 'MTN' } } }, 'journey'), /BLC-only/);
  assert.throws(() => buildBlcQuery({ ...scope, filters: { source: { operator: 'equals', value: 'Example' } } }, 'remoteActivations'), /cannot apply the source/);
  assert.throws(() => buildBlcQuery({ ...scope, filters: { grade: { operator: 'equals', value: 'Gold' } } }, 'journey'), /cannot apply the grade/);
});

test('Schema mismatch prevents a query and reports unavailable rather than zero', async () => {
  let called = false;
  const access = fixture();
  access.metadata = async () => ({ type: 'VIEW', schema: { fields: [{ name: 'fetched', type: 'STRING' }] } });
  access.execute = async () => { called = true; throw new Error('Must not execute'); };
  const result = await getBlcReport(scope, 'journey', access);
  assert.equal(called, false);
  assert.equal(result.status, 'SCHEMA_MISMATCH');
  assert.equal(result.summary, null);
  assert.equal(result.querySucceeded, false);
  assert.ok(result.missingFields.includes('lead_id'));
});

test('Access errors redact sensitive details and never use another source', async () => {
  let queries = 0;
  const access = fixture();
  access.metadata = async () => { throw Object.assign(new Error('private SQL/token/customer information'), { code: 403 }); };
  access.execute = async () => { queries++; throw new Error('Must not execute'); };
  const result = await getBlcReport(scope, 'journey', access);
  assert.equal(result.status, 'ACCESS_DENIED');
  assert.equal(result.summary, null);
  assert.equal(queries, 0);
  assert.equal(JSON.stringify(result).includes('private SQL'), false);
});

test('Valid live results and truly empty selections remain distinct from failures', async () => {
  const ready = await getBlcReport(scope, 'journey', fixture(), () => new Date('2026-09-27T12:00:00Z'));
  assert.equal(ready.status, 'READY');
  assert.equal(ready.summary?.sourceRows, '3');
  assert.equal(ready.validationStatus, 'NOT_VERIFIED');
  assert.equal(ready.freshnessVerified, false);
  assert.equal(ready.checkedAt, '2026-09-27T12:00:00.000Z');
  const empty = await getBlcReport(scope, 'journey', fixture('journey', true));
  assert.equal(empty.status, 'EMPTY');
  assert.equal(empty.querySucceeded, true);
  assert.equal(empty.summary?.sourceRows, '0');
  assert.equal(empty.latestSourceDate, null);
});

test('Other tenants are rejected before metadata or query operations', async () => {
  let touched = false;
  const access = fixture();
  access.metadata = async () => { touched = true; throw new Error('Must not read'); };
  await assert.rejects(() => getBlcReport({ ...scope, clientId: 'mtn' }, 'journey', access), /BLC source access/);
  assert.equal(touched, false);
});

test('Counts and formatting preserve integers larger than Number.MAX_SAFE_INTEGER', () => {
  assert.equal(formatBlcCount('900719925474099312345'), '900,719,925,474,099,312,345');
  assert.equal(formatBlcCount(null), '—');
  assert.equal(formatBlcCount('not a count'), '—');
});

test('Malformed or internally inconsistent results fail closed', async () => {
  const access = fixture();
  const execute = access.execute;
  access.execute = async options => {
    const result = await execute(options);
    result.rows[0].daily[0].source_rows = '100';
    return result;
  };
  const result = await getBlcReport(scope, 'journey', access);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.summary, null);
  assert.equal(result.querySucceeded, false);
});
