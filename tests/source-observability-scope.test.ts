import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { BLC_SOURCES } from '../contracts/blcReporting';
import { getSourceObservability } from '../server/analytics/integrity/sourceObservability';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig, tenantVendorScopeValues } from '../server/bigquery/config';
import { activationSourceIsOwned, sourceTenantPredicate } from '../server/bigquery/sourceTenantScope';
import { validTimestampSql } from '../server/bigquery/integrity';
import { readOnlyQueryOptions } from '../server/bigquery/readOnly';
import type { TableMetadata } from '../server/bigquery/sourceAccess';

const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
const row = { latest_record_at: { value: '2026-09-26T00:00:00Z' }, row_count: 17, missing_timestamp_rows: 1, age_hours: 1 };
const activationSource = BLC_SOURCES.activationRegister;
const aggregate = {
  source_rows: '17', distinct_references: '15', missing_references: '1',
  latest_register_at: '2026-09-26T00:00:00.000000Z', missing_timestamp_rows: '1',
};

/** Mock both SDK boundaries used by sourceAccess, not just the legacy query API. */
function mockActivationWarehouse(t: TestContext, options: {
  metadataError?: unknown; queryError?: unknown; rows?: any[]; metadata?: TableMetadata;
} = {}) {
  const [project, dataset, table] = activationSource.table.split('.');
  const metadataClient = getBigQueryClient(project);
  const metadataReads: string[] = [];
  const queries: string[] = [];
  t.mock.method(metadataClient, 'dataset', ((datasetId: string) => {
    assert.equal(datasetId, dataset);
    return { table: (tableId: string) => {
      assert.equal(tableId, table);
      return { getMetadata: async () => {
        metadataReads.push(activationSource.table);
        if (options.metadataError) throw options.metadataError;
        return [options.metadata ?? {
          type: 'TABLE',
          schema: { fields: Object.entries(activationSource.fields).map(([name, type]) => ({ name, type })) },
        }];
      } };
    } };
  }) as any);
  t.mock.method(client, 'createQueryJob', (async (request: { query: string }) => {
    queries.push(request.query);
    readOnlyQueryOptions({ query: request.query });
    if (options.queryError) throw options.queryError;
    return [{
      id: 'synthetic-activation-job',
      getQueryResults: async () => [options.rows ?? [{ ...aggregate }]],
      getMetadata: async () => [{ statistics: { query: {} } }],
    }];
  }) as any);
  return { metadataReads, queries };
}

test('missing tenant vendor mapping never submits a global shared-call freshness query', async t => {
  const activation = mockActivationWarehouse(t);
  const config = getClientConfig('mtn');
  const original = config.semanticMappings.partners;
  config.semanticMappings.partners = [];
  t.after(() => { config.semanticMappings.partners = original; });
  const queries: string[] = [];
  t.mock.method(client, 'query', async options => { queries.push(options.query); return [[row]]; });
  const result = await getSourceObservability({ clientId: 'mtn' });
  assert.ok(!queries.some(query => query.includes(config.semanticMappings.tables.calls!)));
  const calls = result.sources.find(source => source.key === 'calls')!;
  assert.equal(calls.status, 'MAPPING_REQUIRED');
  assert.equal(calls.rowCount, null);
  assert.equal(calls.latestRecordAt, null);
  assert.equal(calls.ageHours, null);
  assert.match(calls.detail, /ownership mapping/);
  assert.equal(activation.metadataReads.length, 0);
  assert.equal(activation.queries.length, 0);
});

test('mapped tenant call freshness binds ownership and rejects sentinel timestamps', async t => {
  const activation = mockActivationWarehouse(t);
  const queries: { query: string; params: Record<string, unknown> }[] = [];
  t.mock.method(client, 'query', async options => { queries.push(options); return [[row]]; });
  const config = getClientConfig('mtn');
  const result = await getSourceObservability({ clientId: 'mtn' });
  const calls = queries.find(options => options.query.includes(config.semanticMappings.tables.calls!))!;
  assert.match(calls.query, /LOWER\(TRIM\(vendor\)\) IN UNNEST\(@tenantVendors\)/);
  assert.deepEqual(calls.params.tenantVendors, tenantVendorScopeValues(config));
  assert.ok(calls.query.includes(validTimestampSql('call_start_date')));
  const leads = queries.find(options => options.query.includes(config.semanticMappings.tables.leads!))!;
  assert.ok(leads.query.includes(validTimestampSql('l.fetched')));
  assert.equal(result.sources.find(source => source.key === 'calls')!.rowCount, 17);
  assert.equal(activation.metadataReads.length, 0);
  assert.equal(activation.queries.length, 0);
});

test('merely configuring another tenant with the activation table does not establish ownership', async t => {
  const activation = mockActivationWarehouse(t);
  const config = getClientConfig('mtn');
  const original = config.semanticMappings.tables.activations;
  const activationTable = getClientConfig('blc').semanticMappings.tables.activations!;
  config.semanticMappings.tables.activations = activationTable;
  t.after(() => { config.semanticMappings.tables.activations = original; });
  const queries: string[] = [];
  t.mock.method(client, 'query', async options => { queries.push(options.query); return [[row]]; });
  const result = await getSourceObservability({ clientId: 'mtn' });
  assert.equal(activationSourceIsOwned('mtn'), false);
  assert.throws(() => sourceTenantPredicate('mtn', 'activations', { type: 'TABLE' }, {}), /ownership is not established/);
  assert.ok(!queries.some(query => query.includes(activationTable)));
  assert.equal(activation.metadataReads.length, 0);
  assert.equal(activation.queries.length, 0);
  const activations = result.sources.find(source => source.key === 'activations')!;
  assert.equal(activations.status, 'MAPPING_REQUIRED');
  assert.equal(activations.table, null);
  assert.equal(activations.rowCount, null);
  assert.equal(activations.latestRecordAt, null);
  assert.equal(activations.ageHours, null);
  assert.match(activations.detail, /ownership mapping/);
  assert.ok(!result.sources.some(source => source.key === 'activationLifecycle'));
});

test('unrelated tenant without an activation mapping remains unavailable without source access', async t => {
  const activation = mockActivationWarehouse(t);
  const config = getClientConfig('mtn');
  const original = config.semanticMappings.tables.activations;
  config.semanticMappings.tables.activations = undefined;
  t.after(() => { config.semanticMappings.tables.activations = original; });
  t.mock.method(client, 'query', async () => [[row]]);
  const result = await getSourceObservability({ clientId: 'mtn' });
  const source = result.sources.find(item => item.key === 'activations')!;
  assert.equal(source.status, 'UNAVAILABLE');
  assert.equal(source.table, null);
  assert.equal(source.rowCount, null);
  assert.equal(activation.metadataReads.length, 0);
  assert.equal(activation.queries.length, 0);
  assert.ok(!result.sources.some(item => item.key === 'activationLifecycle'));
});

test('master and BLC alias retain the approved activation source and sentinel guard in one shared read', async t => {
  const activation = mockActivationWarehouse(t);
  const legacyQueries: string[] = [];
  t.mock.method(client, 'query', async options => { legacyQueries.push(options.query); return [[row]]; });
  for (const clientId of ['default_tenant', 'blc']) {
    assert.equal(activationSourceIsOwned(clientId), true);
    assert.equal(sourceTenantPredicate(clientId, 'activations', { type: 'TABLE' }, {}), null);
    const result = await getSourceObservability({ clientId });
    const source = result.sources.find(item => item.key === 'activations')!;
    const lifecycle = result.sources.find(item => item.key === 'activationLifecycle')!;
    assert.equal(source.status, 'OBSERVED');
    assert.equal(source.rowCount, 17);
    assert.equal(source.latestRecordAt, aggregate.latest_register_at);
    assert.equal(source.missingTimestampRows, 1);
    assert.equal(lifecycle.lifecycle?.sourceRows, '17');
    assert.equal(lifecycle.lifecycle?.repeatedTransactionReferenceRows, '1');
    assert.equal(lifecycle.lifecycle?.canonical, false);
    assert.equal(lifecycle.status, 'FIELDS_MISSING');
    assert.equal(lifecycle.latestRecordAt, null);
    assert.equal(lifecycle.ageHours, null);
  }
  assert.deepEqual(activation.metadataReads, [activationSource.table, activationSource.table]);
  assert.equal(activation.queries.length, 2);
  assert.ok(activation.queries.every(query => query.includes(validTimestampSql('s.`date_created`'))));
  assert.ok(activation.queries.every(query => query.includes(`\`${activationSource.table}\``)));
  assert.ok(!legacyQueries.some(query => query.includes(activationSource.table)));
});

test('freshness failures expose only a fixed diagnostic, with unknown evidence instead of zeroes', async t => {
  const secret = 'synthetic-private-request-token';
  const error = Object.assign(new Error(`Request Authorization: Bearer ${secret}; SQL with private row values`), { code: 403 });
  const activation = mockActivationWarehouse(t, { metadataError: error });
  t.mock.method(client, 'query', async () => { throw error; });
  const result = await getSourceObservability({ clientId: 'default_tenant' });
  for (const key of ['leads', 'calls', 'marketing', 'activations']) {
    const source = result.sources.find(source => source.key === key)!;
    assert.equal(source.status, 'ACCESS_DENIED');
    assert.equal(source.rowCount, null);
    assert.equal(source.latestRecordAt, null);
    assert.equal(source.ageHours, null);
    assert.match(source.detail, /Verify the runtime identity/);
  }
  assert.equal(activation.metadataReads.length, 1);
  assert.equal(activation.queries.length, 0);
  const lifecycle = result.sources.find(source => source.key === 'activationLifecycle')!;
  assert.equal(lifecycle.status, 'SOURCE_UNAVAILABLE');
  assert.equal(lifecycle.lifecycle?.metadataStatus, 'ACCESS_DENIED');
  assert.equal(lifecycle.lifecycle?.queryStatus, 'NOT_CHECKED');
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(!JSON.stringify(result).includes('Authorization'));
});

test('aggregate query denial preserves schema observations without fabricated activation counts', async t => {
  const activation = mockActivationWarehouse(t, { queryError: { code: 403, message: 'private-query-token' } });
  t.mock.method(client, 'query', async () => [[row]]);
  const result = await getSourceObservability({ clientId: 'blc' });
  const source = result.sources.find(item => item.key === 'activations')!;
  const lifecycle = result.sources.find(item => item.key === 'activationLifecycle')!;
  assert.equal(source.status, 'ACCESS_DENIED');
  assert.equal(source.rowCount, null);
  assert.equal(source.latestRecordAt, null);
  assert.equal(source.ageHours, null);
  assert.equal(lifecycle.status, 'SOURCE_UNAVAILABLE');
  assert.equal(lifecycle.lifecycle?.metadataStatus, 'OBSERVED');
  assert.equal(lifecycle.lifecycle?.queryStatus, 'ACCESS_DENIED');
  assert.equal(lifecycle.lifecycle?.canonical, false);
  assert.equal(activation.metadataReads.length, 1);
  assert.equal(activation.queries.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /private-query-token|synthetic-activation-job/);
});

for (const scenario of [
  { name: 'empty', rows: [{ source_rows: '0', distinct_references: '0', missing_references: '0', latest_register_at: null, missing_timestamp_rows: '0' }], status: 'EMPTY', count: 0 },
  { name: 'malformed', rows: [], status: 'INVALID_RESPONSE', count: null },
]) {
  test(`activation integration distinguishes ${scenario.name} results from unavailable evidence`, async t => {
    const activation = mockActivationWarehouse(t, { rows: scenario.rows });
    t.mock.method(client, 'query', async () => [[row]]);
    const result = await getSourceObservability({ clientId: 'blc' });
    const source = result.sources.find(item => item.key === 'activations')!;
    const lifecycle = result.sources.find(item => item.key === 'activationLifecycle')!;
    assert.equal(source.status, scenario.status);
    assert.equal(source.rowCount, scenario.count);
    assert.equal(source.latestRecordAt, null);
    assert.equal(source.ageHours, null);
    assert.equal(lifecycle.lifecycle?.canonical, false);
    assert.equal(lifecycle.lifecycle?.sourceRows, scenario.count === 0 ? '0' : null);
    assert.equal(activation.metadataReads.length, 1);
    assert.equal(activation.queries.length, 1);
  });
}
