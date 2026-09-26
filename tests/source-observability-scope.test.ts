import test from 'node:test';
import assert from 'node:assert/strict';
import { getSourceObservability } from '../server/analytics/integrity/sourceObservability';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig, tenantVendorScopeValues } from '../server/bigquery/config';
import { activationSourceIsOwned, sourceTenantPredicate } from '../server/bigquery/sourceTenantScope';
import { validTimestampSql } from '../server/bigquery/integrity';

const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
const row = { latest_record_at: { value: '2026-09-26T00:00:00Z' }, row_count: 17, age_hours: 1 };

test('missing tenant vendor mapping never submits a global shared-call freshness query', async t => {
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
});

test('mapped tenant call freshness binds ownership and rejects sentinel timestamps', async t => {
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
});

test('merely configuring another tenant with the activation table does not establish ownership', async t => {
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
  const activations = result.sources.find(source => source.key === 'activations')!;
  assert.equal(activations.status, 'MAPPING_REQUIRED');
  assert.equal(activations.rowCount, null);
  assert.equal(activations.latestRecordAt, null);
});

test('master and BLC alias retain the approved activation source and sentinel guard', async t => {
  const queries: string[] = [];
  t.mock.method(client, 'query', async options => { queries.push(options.query); return [[row]]; });
  const activationTable = getClientConfig('blc').semanticMappings.tables.activations!;
  for (const clientId of ['default_tenant', 'blc']) {
    assert.equal(activationSourceIsOwned(clientId), true);
    assert.equal(sourceTenantPredicate(clientId, 'activations', { type: 'TABLE' }, {}), null);
    const result = await getSourceObservability({ clientId });
    assert.equal(result.sources.find(source => source.key === 'activations')!.rowCount, 17);
  }
  const activationQueries = queries.filter(query => query.includes(activationTable));
  assert.equal(activationQueries.length, 2);
  assert.ok(activationQueries.every(query => query.includes(validTimestampSql('date_created'))));
});

test('freshness failures expose only a fixed diagnostic, with unknown evidence instead of zeroes', async t => {
  const secret = 'synthetic-private-request-token';
  t.mock.method(client, 'query', async () => {
    throw Object.assign(new Error(`Request Authorization: Bearer ${secret}; SQL with private row values`), { code: 403 });
  });
  const result = await getSourceObservability({ clientId: 'default_tenant' });
  for (const key of ['leads', 'calls', 'marketing', 'activations']) {
    const source = result.sources.find(source => source.key === key)!;
    assert.equal(source.status, 'ACCESS_DENIED');
    assert.equal(source.rowCount, null);
    assert.equal(source.latestRecordAt, null);
    assert.equal(source.ageHours, null);
    assert.match(source.detail, /Verify the runtime identity/);
  }
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(!JSON.stringify(result).includes('Authorization'));
});
