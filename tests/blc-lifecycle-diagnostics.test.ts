import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { BLC_SOURCES } from '../contracts/blcReporting';
import { BLC_LIFECYCLE_REQUIREMENTS } from '../contracts/blcLifecycle';
import { getBlcLifecycleDiagnostics, buildBlcLifecycleQuery, blcLifecycleSourceCards } from '../server/blc/lifecycleDiagnostics';
import type { SourceAccess, TableMetadata } from '../server/bigquery/sourceAccess';
import { readOnlyQueryOptions } from '../server/bigquery/readOnly';
import { getClientConfig } from '../server/bigquery/config';
import BlcLifecycleCard from '../src/components/BlcLifecycleCard';

const checkedAt = () => new Date('2026-09-02T08:00:00Z');
const registerMeta: TableMetadata = { type: 'TABLE', schema: { fields: Object.entries(BLC_SOURCES.activationRegister.fields).map(([name, type]) => ({ name, type })) } };
const aggregate = { source_rows: '12', distinct_references: '8', missing_references: '2', latest_register_at: '2026-09-01T08:00:00.000000Z', missing_timestamp_rows: '1' };
function fixture(options: { meta?: TableMetadata; rows?: any[]; metadataError?: unknown; queryError?: unknown } = {}) {
  const calls: Array<{ type: string; value: string }> = [];
  const access: SourceAccess = {
    metadata: async table => { calls.push({ type: 'metadata', value: table }); if (options.metadataError) throw options.metadataError; return options.meta ?? registerMeta; },
    execute: async ({ query }) => { calls.push({ type: 'query', value: query }); readOnlyQueryOptions({ query }); if (options.queryError) throw options.queryError; return { rows: options.rows ?? [{ ...aggregate }], jobId: 'private-job-not-for-export' }; },
    listTables: async () => { throw new Error('Enumeration is forbidden'); },
  };
  return { calls, access, run: (clientId = 'ontact_blc') => getBlcLifecycleDiagnostics(clientId, () => access, checkedAt) };
}

test('actual observations replace placeholder facts but do not approve lifecycle semantics', async () => {
  const f = fixture(); const d = await f.run();
  assert.equal(d.querySucceeded, true); assert.equal(d.queryStatus, 'OBSERVED');
  assert.equal(d.sourceRows, '12'); assert.equal(d.repeatedTransactionReferenceRows, '2');
  assert.equal(d.lifecycleStatus, 'FIELDS_MISSING'); assert.equal(d.canonical, false);
  assert.equal(d.sourceRefreshedAt, null); assert.equal(d.freshnessStatus, 'NOT_VERIFIED');
  assert.equal(d.fieldChecks.filter(c => c.status === 'MISSING').length, 4);
  assert.equal(d.fieldChecks.find(c => c.id === 'dealColour')?.status, 'OBSERVED_UNVERIFIED');
  assert.deepEqual(f.calls.map(c => c.type), ['metadata', 'query']);
  assert.equal(f.calls[0].value, BLC_SOURCES.activationRegister.table);
  assert.doesNotMatch(JSON.stringify(d), /private-job|expected_ontact_revenue/);
});

test('successful empty source has measured zeros, not unavailable placeholders', async () => {
  const d = await fixture({ rows: [{ source_rows: '0', distinct_references: '0', missing_references: '0', latest_register_at: null, missing_timestamp_rows: '0' }] }).run();
  assert.equal(d.queryStatus, 'EMPTY'); assert.equal(d.querySucceeded, true);
  assert.equal(d.sourceRows, '0'); assert.equal(d.latestRegisterAt, null); assert.equal(d.canonical, false);
});

test('all candidate columns still require record-level mapping and reconciliation', async () => {
  const fields = [...registerMeta.schema!.fields!];
  for (const requirement of BLC_LIFECYCLE_REQUIREMENTS) if (!fields.some(f => f.name === requirement.candidates[0])) fields.push({ name: requirement.candidates[0], type: 'STRING' });
  const d = await fixture({ meta: { type: 'TABLE', schema: { fields } } }).run();
  assert.equal(d.lifecycleStatus, 'VALIDATION_REQUIRED'); assert.equal(d.canonical, false);
  assert.equal(d.sourceRefreshedAt, null);
});

test('unrelated tenants never construct a BLC access provider or receive its card', async () => {
  let accessed = false;
  const d = await getBlcLifecycleDiagnostics('mtn', () => { accessed = true; throw new Error('Must not access'); }, checkedAt);
  assert.equal(accessed, false); assert.equal(d.applicable, false); assert.equal(d.sourceTable, null);
  assert.deepEqual(blcLifecycleSourceCards(d).map(c => c.key), ['activations']);
});

test('master and BLC aliases remain restricted to the same allowlisted source', async () => {
  for (const tenant of ['default_tenant', 'default', 'ontact_blc', 'blc']) {
    const f = fixture(); const d = await f.run(tenant);
    assert.equal(d.sourceTable, BLC_SOURCES.activationRegister.table);
    assert.equal(f.calls.filter(c => c.type === 'query').length, 1);
  }
});

test('changed or absent source configuration fails closed without access', async () => {
  const tables = getClientConfig('ontact_blc').semanticMappings.tables;
  const original = tables.activations;
  try {
    for (const table of [undefined, 'dashboards-422710.lead_ledger.clustered_lead_ledger']) {
      tables.activations = table;
      const f = fixture(); const d = await f.run();
      assert.equal(f.calls.length, 0); assert.equal(d.querySucceeded, false);
      assert.equal(d.queryStatus, table ? 'SOURCE_NOT_APPROVED' : 'UNCONFIGURED');
    }
  } finally { tables.activations = original; }
});

for (const [code, status] of [[401, 'AUTHENTICATION_REQUIRED'], [403, 'ACCESS_DENIED'], [404, 'NOT_FOUND'], [429, 'RATE_LIMITED']] as const) {
  test(`metadata ${code} stays distinct from a missing lifecycle field`, async () => {
    const f = fixture({ metadataError: { code, message: 'secret raw SQL and key' } }); const d = await f.run();
    assert.equal(d.metadataStatus, status); assert.equal(d.queryStatus, 'NOT_CHECKED');
    assert.equal(d.lifecycleStatus, 'SOURCE_UNAVAILABLE'); assert.equal(d.sourceRows, null);
    assert.ok(d.fieldChecks.every(c => c.status === 'NOT_CHECKED'));
    assert.equal(f.calls.length, 1); assert.doesNotMatch(JSON.stringify(d), /secret/);
  });
}

test('missing schema blocks queries rather than reporting every field missing', async () => {
  const f = fixture({ meta: { type: 'TABLE' } }); const d = await f.run();
  assert.equal(d.metadataStatus, 'SCHEMA_UNAVAILABLE'); assert.equal(f.calls.length, 1);
  assert.ok(d.fieldChecks.every(c => c.status === 'NOT_CHECKED'));
});

test('query denial preserves metadata evidence, with no zero counts or fallback', async () => {
  const f = fixture({ queryError: { code: 403, message: 'private-token' } }); const d = await f.run();
  assert.equal(d.metadataStatus, 'OBSERVED'); assert.equal(d.queryStatus, 'ACCESS_DENIED');
  assert.equal(d.sourceRows, null); assert.equal(d.querySucceeded, false); assert.equal(f.calls.length, 2);
  assert.doesNotMatch(JSON.stringify(d), /private-token/);
});

test('repeated candidate columns are not treated as scalar lifecycle fields', async () => {
  const meta: TableMetadata = { type: 'TABLE', schema: { fields: [...registerMeta.schema!.fields!, { name: 'rubix_status', type: 'STRING', mode: 'REPEATED' }] } };
  const d = await fixture({ meta }).run();
  assert.equal(d.fieldChecks.find(c => c.id === 'rubixStatus')?.status, 'TYPE_UNSUPPORTED');
  assert.equal(d.lifecycleStatus, 'FIELDS_MISSING');
});

test('missing physical date/reference fields still allow only honest row observations', async () => {
  const meta: TableMetadata = { type: 'TABLE', schema: { fields: [{ name: 'color', type: 'STRING' }] } };
  const query = buildBlcLifecycleQuery(meta);
  assert.doesNotMatch(query, /s\.`(transaction_id|date_created)`/);
  const d = await fixture({ meta, rows: [{ source_rows: '12', distinct_references: null, missing_references: null, latest_register_at: null, missing_timestamp_rows: null }] }).run();
  assert.equal(d.querySucceeded, true); assert.equal(d.queryStatus, 'TIMESTAMP_UNAVAILABLE');
  assert.equal(d.sourceRows, '12'); assert.equal(d.missingRegisterTimestampRows, null);
});

test('case-insensitive scalar metadata uses the fixed column allowlist', () => {
  const meta: TableMetadata = { type: 'TABLE', schema: { fields: [{ name: 'TRANSACTION_ID', type: 'INTEGER' }, { name: 'DATE_CREATED', type: 'TIMESTAMP' }, { name: 'x`; DROP TABLE y', type: 'STRING' }] } };
  const query = buildBlcLifecycleQuery(meta); readOnlyQueryOptions({ query });
  assert.match(query, /COUNT\(DISTINCT/); assert.match(query, /FORMAT_TIMESTAMP/);
  assert.doesNotMatch(query, /DROP|JOIN|SUM|WHERE|expected_ontact_revenue/);
  assert.equal((query.match(/FROM /g) || []).length, 1);
});

for (const bad of [
  { source_rows: 12 }, { source_rows: 'NaN' }, { source_rows: '-1' },
  { missing_references: '13' }, { distinct_references: '11', missing_references: '2' },
  { missing_timestamp_rows: '13' }, { latest_register_at: 'invalid' },
  { latest_register_at: null, missing_timestamp_rows: '1' },
  { missing_timestamp_rows: '12' }, { distinct_references: undefined },
]) {
  test(`malformed aggregate is unavailable: ${JSON.stringify(bad)}`, async () => {
    const d = await fixture({ rows: [{ ...aggregate, ...bad }] }).run();
    assert.equal(d.queryStatus, 'INVALID_RESPONSE'); assert.equal(d.sourceRows, null);
    assert.equal(d.querySucceeded, false); assert.equal(d.lifecycleStatus, 'SOURCE_UNAVAILABLE');
  });
}

test('zero or multiple aggregate result rows do not masquerade as an empty source', async () => {
  for (const rows of [[], [aggregate, aggregate]]) {
    const d = await fixture({ rows }).run(); assert.equal(d.queryStatus, 'INVALID_RESPONSE'); assert.equal(d.sourceRows, null);
  }
});

test('large counts remain exact and are not rounded in legacy card projection', async () => {
  const d = await fixture({ rows: [{ ...aggregate, source_rows: '9007199254740993', distinct_references: '9007199254740990' }] }).run();
  assert.equal(d.sourceRows, '9007199254740993'); assert.equal(d.repeatedTransactionReferenceRows, '1');
  assert.equal(blcLifecycleSourceCards(d)[0].rowCount, null);
  assert.equal(blcLifecycleSourceCards(d)[1].lifecycle?.sourceRows, '9007199254740993');
});

test('both cards share a read and the lifecycle card does not duplicate freshness chart data', async () => {
  const f = fixture(); const d = await f.run(); const cards = blcLifecycleSourceCards(d);
  assert.equal(f.calls.filter(c => c.type === 'query').length, 1);
  assert.equal(cards[0].rowCount, 12); assert.equal(cards[0].ageHours, 24);
  assert.equal(cards[1].latestRecordAt, null); assert.equal(cards[1].ageHours, null);
  assert.equal(cards[1].lifecycle?.latestRegisterAt, aggregate.latest_register_at);
  const source = fs.readFileSync('server/analytics/integrity/sourceObservability.ts', 'utf8');
  assert.equal((source.match(/await getBlcLifecycleDiagnostics\(/g) || []).length, 1);
  assert.doesNotMatch(source, /status: 'CONTRACT_REQUIRED'/);
  assert.doesNotMatch(source, /await pushFreshness\(\s*'activations'/);
});

test('UI separates observed source facts from unresolved readiness and preserves navigation scope', async () => {
  const d = await fixture().run();
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(BlcLifecycleCard, {
    source: blcLifecycleSourceCards(d)[1], reportHref: '/sales-activation?clientId=ontact_blc&startDate=2026-09-01',
  })));
  assert.match(html, /Physical source rows/); assert.match(html, /fields missing/);
  assert.match(html, /not a Rubix API connection check/); assert.match(html, /Source refresh timestamp/);
  assert.match(html, /not inferred from register dates/); assert.match(html, /role="region"/);
  assert.match(html, /clientId=ontact_blc/); assert.doesNotMatch(html, /No freshness timestamp|text-emerald|>READY</);
});

test('UI explains old-backend diagnostics without inventing rows or missing fields', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(BlcLifecycleCard, { source: {}, reportHref: '/sales-activation' })));
  assert.match(html, /updated backend is deployed/); assert.doesNotMatch(html, /fields missing|Physical source rows/);
});
