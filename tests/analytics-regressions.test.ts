import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateCliCsv, getCliPerformance, setTenantImport, clearTenantImport } from '../server/bigquery/cli_analytics';
import { exportData } from '../server/bigquery/export';
import type { SourceAccess } from '../server/bigquery/sourceAccess';

const tenantId = 'default_tenant';
const header = 'cli_number,campaign_code,report_date,total_calls,distinct_leads,contact_count,sale_count';
const importAccess: SourceAccess = {
  metadata: async () => ({ type: 'TABLE', schema: { fields: [] } }),
  listTables: async () => [],
  execute: async () => { throw new Error('Imported reports must not issue a warehouse query'); },
};

test('CLI CSV preserves empty optional fields and therefore keeps RPC and sale counts in their columns', () => {
  const result = parseAndValidateCliCsv(`${header}\n0875501001,MTN_DIRECT,2026-09-20,100,,25,5`);
  assert.deepEqual(result.errors, []);
  assert.equal(result.records.length, 1);
  const row = result.records[0];
  assert.equal(row.distinctLeads, null);
  assert.equal(row.contactCount, '25');
  assert.equal(row.saleCount, '5');
  assert.equal(row.contactRate, '25.00');
  assert.equal(row.salePerCallRate, '5.00');
});

test('CLI CSV handles BOM, CRLF, spaces, quoted commas, escaped quotes and embedded newlines', () => {
  const result = parseAndValidateCliCsv(`\uFEFF${header}\r\n0875501001,"MTN, ""Direct""\nCampaign",2026-09-20,100,,25,5\r\n0875501002,MTN Direct,2026-09-20,100,90,20,4\r\n`);
  assert.deepEqual(result.errors, []);
  assert.equal(result.records[0].campaign, 'MTN, "Direct"\nCampaign');
  assert.equal(result.records[0].saleCount, '5');
  assert.equal(result.records[1].campaign, 'MTN Direct');
  assert.equal(result.records[1].contactCount, '20');
});

test('CLI CSV rejects malformed quotes, duplicate headers and short/long records without partial imports', () => {
  for (const csv of [
    `${header}\n0875501001,"unclosed,2026-09-20,100,,25,5`,
    `${header}\n0875501001,"closed"junk,2026-09-20,100,,25,5`,
    `${header}\n0875501001,Campaign,2026-09-20,100,25,5`,
    `${header}\n0875501001,Campaign,2026-09-20,100,,25,5,extra`,
    `${header},sale_count\n0875501001,Campaign,2026-09-20,100,,25,5,5`,
  ]) {
    const result = parseAndValidateCliCsv(csv);
    assert.ok(result.errors.length > 0, csv);
    assert.equal(result.records.length, 0, csv);
  }
});

function installFixture() {
  const parsed = parseAndValidateCliCsv([
    'cli_number,campaign_code,report_date,total_calls,contact_count,sale_count,vendor,avg_lead_age_days,answered_count',
    '0875501001,MTN_DIRECT,2026-09-20,100,25,5,MTN,1,0',
    '0875501002,MTN_DIRECT,2026-09-20,300,225,15,MTN,3,0',
    '0875501003,BLC_DIRECT,2026-09-20,1000,500,100,BLC,20,900',
    '0875501004,MTN_DIRECT,2026-09-21,1000,500,100,MTN,30,900',
  ].join('\n'));
  assert.deepEqual(parsed.errors, []);
  setTenantImport(tenantId, { ...parsed, uploadedAt: '2026-09-26T00:00:00Z', filename: 'regression.csv' });
}

const scope = {
  clientId: tenantId, startDate: '2026-09-20', endDate: '2026-09-20',
  filters: { vendor: { operator: 'in' as const, values: ['MTN'] } },
};

test('imported CLI records, summary, trend and lead age all use the selected date and vendor population', async () => {
  installFixture();
  try {
    const report = await getCliPerformance(scope, importAccess);
    assert.deepEqual(report.cliPerformance.map(row => row.cli), ['0875501001', '0875501002']);
    assert.equal(report.summary.totalCalls, '400');
    assert.equal(report.trend.length, 1);
    assert.equal(report.trend[0].date, '2026-09-20');
    assert.equal(report.trend[0].totalCalls, 400);
    assert.equal(report.trend[0].contactRate, 62.5);
    assert.equal(report.trend[0].answeredRate, 0, 'Known zero must not become unavailable');
    assert.equal(report.leadAgeBands.avgLeadAgeDays, '2.50');
    const empty = await getCliPerformance({ ...scope, startDate: '2026-09-22', endDate: '2026-09-22' }, importAccess);
    assert.deepEqual(empty.trend, []);
    assert.equal(empty.leadAgeBands.avgLeadAgeDays, null);
  } finally { clearTenantImport(tenantId); }
});

test('imported CLI equality/exclusion filters apply and unsupported dimensions fail closed', async () => {
  installFixture();
  try {
    const report = await getCliPerformance({ ...scope, filters: { cli: { operator: 'equals', value: '0875501002' } } }, importAccess);
    assert.deepEqual(report.cliPerformance.map(row => row.cli), ['0875501002']);
    const excluded = await getCliPerformance({ ...scope, filters: { campaign: { operator: 'not_equals', value: 'MTN_DIRECT' } } }, importAccess);
    assert.deepEqual(excluded.cliPerformance.map(row => row.cli), ['0875501003']);
    await assert.rejects(getCliPerformance({ ...scope, filters: { source: { operator: 'equals', value: 'Facebook' } } }, importAccess), /does not support/);
  } finally { clearTenantImport(tenantId); }
});

test('CLI export matches report scope, enforces limits and reports truncation accurately', async () => {
  installFixture();
  try {
    const result = await exportData({ ...scope, grain: 'cli', limit: 1 }, importAccess);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]['CLI Number'], '0875501001');
    assert.equal(result.metadata.rowCount, 1);
    assert.equal(result.metadata.truncated, true);
    assert.equal(result.metadata.startDate, scope.startDate);
    assert.deepEqual({ ...result.metadata.filters }, scope.filters);
    const complete = await exportData({ ...scope, grain: 'cli', limit: 2 }, importAccess);
    assert.deepEqual(complete.rows.map(row => row['CLI Number']), ['0875501001', '0875501002']);
    assert.equal(complete.metadata.truncated, false);
    assert.ok(complete.csv.includes('Report Date'));
  } finally { clearTenantImport(tenantId); }
});

test('CLI export applies literal CLI-or-campaign substring search before truncating imported rows', async () => {
  installFixture();
  try {
    const byCli = await exportData({ ...scope, grain: 'cli', limit: 1, search: '  1002  ' }, importAccess);
    assert.deepEqual(byCli.rows.map(row => row['CLI Number']), ['0875501002']);
    assert.equal(byCli.metadata.truncated, false);
    assert.equal(byCli.metadata.search, '1002');
    const byCampaign = await exportData({ ...scope, grain: 'cli', search: 'mTn_dIr' }, importAccess);
    assert.deepEqual(byCampaign.rows.map(row => row['CLI Number']), ['0875501001', '0875501002']);
    const literalPercent = await exportData({ ...scope, grain: 'cli', search: '%' }, importAccess);
    assert.deepEqual(literalPercent.rows, []);
    assert.equal(literalPercent.metadata.truncated, false);
    await assert.rejects(exportData({ ...scope, grain: 'cli', search: 'x'.repeat(201) }, importAccess), /Invalid search/);
  } finally { clearTenantImport(tenantId); }
});

function liveAccess(execute: SourceAccess['execute']): SourceAccess {
  return { ...importAccess, execute, metadata: async () => ({ type: 'TABLE', schema: {
    fields: ['cli', 'campaign_id', 'vendor', 'call_start_date', 'is_rpc', 'is_sale', 'length_in_sec']
      .map(name => ({ name, type: name.startsWith('is_') ? 'BOOLEAN' : name === 'length_in_sec' ? 'INTEGER' : 'STRING' })),
  } }) };
}

test('CLI export resolves live rows before stale imports and propagates live query failures', async () => {
  installFixture();
  try {
    const result = await exportData({ ...scope, grain: 'cli', limit: 1 }, liveAccess(async options => {
      assert.equal(options.params?.cliRowLimit, 2);
      assert.equal(options.params?.startDate, '2026-09-20');
      assert.equal(options.params?.filter_vendor_0, 'MTN');
      return { jobId: 'test-job', rows: [
        { cli: '0800000001', campaign: 'LIVE', vendor: 'MTN', total_calls: '20', contact_count: '5', sale_count: '1' },
        { cli: '0800000002', campaign: 'LIVE', vendor: 'MTN', total_calls: '10', contact_count: '2', sale_count: '0' },
      ] };
    }));
    assert.equal(result.rows[0]['CLI Number'], '0800000001');
    assert.equal(result.metadata.dataSource, 'LIVE BIGQUERY');
    assert.equal(result.metadata.truncated, true);
    await assert.rejects(exportData({ ...scope, grain: 'cli' }, liveAccess(async () => { throw new Error('Warehouse query failed'); })), /Warehouse query failed/);
  } finally { clearTenantImport(tenantId); }
});

test('CLI export reports unavailable source rather than producing a successful empty import export', async () => {
  clearTenantImport(tenantId);
  await assert.rejects(exportData({ ...scope, grain: 'cli' }, importAccess), error => error instanceof Error && 'status' in error && error.status === 422);
});

test('live CLI export sends literal search to the warehouse WHERE clause before grouping and row limits', async () => {
  const result = await exportData({ ...scope, grain: 'cli', limit: 1, search: ' LIVE_% ' }, liveAccess(async options => {
    assert.equal(options.params?.cliSearch, 'live_%');
    assert.equal(options.params?.cliRowLimit, 2);
    assert.match(options.query, /STRPOS\(LOWER\(COALESCE\(NULLIF\(CAST\(s\.`cli` AS STRING\)/);
    assert.match(options.query, /OR STRPOS\(LOWER\(COALESCE\(NULLIF\(CAST\(s\.`campaign_id` AS STRING\)/);
    assert.ok(options.query.indexOf('@cliSearch') < options.query.indexOf('GROUP BY'));
    assert.ok(options.query.indexOf('@cliSearch') < options.query.indexOf('LIMIT @cliRowLimit'));
    assert.ok(!options.query.includes('LIKE @cliSearch'));
    return { jobId: 'filtered-job', rows: [{ cli: '0800000001', campaign: 'LIVE_%', vendor: 'MTN', total_calls: '20', contact_count: '5', sale_count: '1' }] };
  }));
  assert.equal(result.rows.length, 1);
  assert.equal(result.metadata.search, 'live_%');
  assert.equal(result.metadata.truncated, false);
});
