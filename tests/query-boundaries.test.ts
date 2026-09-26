import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { analyticalConcurrency } from '../server/httpGuards';
import { trackAnalyticalWork } from '../server/analyticalWork';
import { guardedQueryOptions } from '../server/bigquery/client';
import { operationalFilterValues } from '../server/offernetScope';
import { compileSourceMetrics } from '../server/bigquery/sourceMetrics';
import type { TableMetadata } from '../server/bigquery/sourceAccess';
import { RequestError } from '../server/bigquery/filters';

const scope = { startDate: '2026-09-01', endDate: '2026-09-26', filters: {} };
const marketing: TableMetadata = { type: 'TABLE', schema: { fields: [
  { name: 'date', type: 'DATE' }, { name: 'channel', type: 'STRING' }, { name: 'client_name', type: 'STRING' },
] } };

test('shared marketing requests retain different mandatory tenant ownership parameters', () => {
  const a = compileSourceMetrics('marketing', { ...scope, clientId: 'mtn' }, marketing);
  const b = compileSourceMetrics('marketing', { ...scope, clientId: 'mondo' }, marketing);
  assert.equal(a.table, b.table);
  assert.match(a.query, /s\.`client_name` IN \(@tenant_client_0, @tenant_client_1\)/);
  assert.equal(a.params.tenant_client_0, 'MTN');
  assert.equal(b.params.tenant_client_0, 'Mondo');
  assert.notDeepEqual(a.params, b.params);
});

test('caller vendor filters narrow rather than replace mandatory call-source ownership', () => {
  const meta: TableMetadata = { type: 'TABLE', schema: { fields: [
    { name: 'call_start_date', type: 'TIMESTAMP' }, { name: 'vendor', type: 'STRING' },
  ] } };
  const compiled = compileSourceMetrics('calls', {
    ...scope, clientId: 'mtn', filters: { vendor: { operator: 'equals', value: 'mondo' } },
  }, meta);
  assert.match(compiled.query, /LOWER\(TRIM\(s\.`vendor`\)\) IN \(@tenant_vendor_0/);
  assert.match(compiled.query, /AND CAST\(s\.`vendor` AS STRING\) = @source_filter_vendor/);
  assert.equal(compiled.params.tenant_vendor_0, 'mtn');
  assert.equal(compiled.params.source_filter_vendor, 'mondo');
});

test('unverified ownership mappings fail closed while an authorized master can query', () => {
  assert.throws(() => compileSourceMetrics('marketing', { ...scope, clientId: 'mtn' }, {
    ...marketing, schema: { fields: marketing.schema!.fields!.filter(field => field.name !== 'client_name') },
  }), /ownership mapping/);
  const timing: TableMetadata = { type: 'TABLE', schema: { fields: [{ name: 'expected_first_dial', type: 'TIMESTAMP' }] } };
  assert.throws(() => compileSourceMetrics('timeToDial', { ...scope, clientId: 'mtn' }, timing), /ownership is not established/);
  assert.doesNotThrow(() => compileSourceMetrics('timeToDial', { ...scope, clientId: 'default_tenant' }, timing));
});

test('operational requests reject unsupported or multi-value conditions before losing their scope', () => {
  assert.deepEqual(operationalFilterValues({ vendor: { operator: 'in', values: ['MTN'] } }, '/offernet/overview'), { vendor: 'MTN' });
  for (const filters of [
    { vendor: { operator: 'in', values: ['MTN', 'Mondo'] } },
    { sale: { operator: 'equals', value: true } },
    { calls: { operator: 'equals', value: 0 } },
    { campaign: { operator: 'equals', value: 'Campaign A' } },
  ] as any[]) {
    assert.throws(() => operationalFilterValues(filters, '/offernet/overview'), error => error instanceof RequestError && error.status === 422);
  }
  assert.deepEqual(operationalFilterValues({ campaign: { operator: 'equals', value: 'Campaign A' } }, '/offernet/campaigns'), { campaign: 'Campaign A' });
});

test('query jobs always receive the configured ceiling and callers can only lower it', t => {
  const previous = process.env.BIGQUERY_MAX_BYTES_BILLED;
  t.after(() => { if (previous === undefined) delete process.env.BIGQUERY_MAX_BYTES_BILLED; else process.env.BIGQUERY_MAX_BYTES_BILLED = previous; });
  process.env.BIGQUERY_MAX_BYTES_BILLED = '1000000000';
  assert.equal(guardedQueryOptions({ query: 'SELECT 1' }).maximumBytesBilled, '1000000000');
  assert.equal(guardedQueryOptions({ query: 'SELECT 1', maximumBytesBilled: '2000000000' }).maximumBytesBilled, '1000000000');
  assert.equal(guardedQueryOptions({ query: 'SELECT 1', maximumBytesBilled: '500000000' }).maximumBytesBilled, '500000000');
  for (const invalid of ['0', '-1', 'unlimited', '1.5']) {
    process.env.BIGQUERY_MAX_BYTES_BILLED = invalid;
    assert.throws(() => guardedQueryOptions({ query: 'SELECT 1' }), /positive INT64/);
  }
});

const response = () => Object.assign(new EventEmitter(), { locals: { principal: { subject: 'fixture' } }, setHeader() {} });
test('a disconnected response holds its concurrency permit until pending work completes', async () => {
  const guard = analyticalConcurrency({ global: 1, perSubject: 1 });
  const first = response();
  let complete!: () => void;
  let running!: Promise<void>;
  guard({} as any, first as any, error => {
    assert.equal(error, undefined);
    running = trackAnalyticalWork(() => new Promise<void>(resolve => { complete = resolve; }));
  });
  first.emit('close');
  let rejected: any;
  guard({} as any, response() as any, error => { rejected = error; });
  assert.equal(rejected.status, 429);
  complete();
  await running;
  const third = response();
  guard({} as any, third as any, error => { assert.equal(error, undefined); });
  third.emit('finish');
});

test('failed sibling work cannot release a permit while another query remains pending', async () => {
  const guard = analyticalConcurrency({ global: 1, perSubject: 1 });
  const first = response();
  let complete!: () => void;
  let remaining!: Promise<void>;
  let failed!: Promise<unknown>;
  guard({} as any, first as any, () => {
    failed = trackAnalyticalWork(async () => {
      remaining = trackAnalyticalWork(() => new Promise<void>(resolve => { complete = resolve; }));
      await Promise.all([remaining, Promise.reject(new Error('synthetic failure'))]);
    }).catch(() => undefined);
  });
  await failed;
  first.emit('finish');
  guard({} as any, response() as any, error => { assert.equal((error as RequestError).status, 429); });
  complete();
  await remaining;
  const next = response();
  guard({} as any, next as any, error => { assert.equal(error, undefined); });
  next.emit('finish');
});
