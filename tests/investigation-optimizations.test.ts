import test from 'node:test';
import assert from 'node:assert/strict';
import { getBigQueryClient } from '../server/bigquery/client';
import { getAllClients, getClientConfig } from '../server/bigquery/config';
import { withAnalyticsScope } from '../server/analyticsContext';
import { getExceptionAnalytics } from '../server/analytics/investigation/exceptions';
import { getAiInsightsAnalytics } from '../server/analytics/investigation/aiInsights';
import { clearTenantImport, getCliPerformance, parseAndValidateCliCsv, setTenantImport } from '../server/bigquery/cli_analytics';
import { exportData } from '../server/bigquery/export';
import type { SourceAccess } from '../server/bigquery/sourceAccess';

const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
const scope = { clientId: 'default_tenant', startDate: '2026-09-08', endDate: '2026-09-14' };
const queueRows = [{ id: 'zero-call-leads', comparison_period: 'current', vendor: 'A', source: 'Paid', affected_count: 3 }];
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test('overlapping Exceptions and AI reads share one queue query, but the next read is fresh', async t => {
  const pending = gate();
  let queries = 0;
  t.mock.method(client, 'query', async () => { queries++; await pending.promise; return [queueRows]; });
  const params = { clientId: 'default_tenant', vendor: 'A' };
  const queue = getExceptionAnalytics(params);
  const insights = getAiInsightsAnalytics({ vendor: 'A', clientId: 'default_tenant' });
  assert.equal(queries, 1, 'Two overlapping consumers must perform one warehouse queue query');
  pending.release();
  const [result, ai] = await Promise.all([queue, insights]);
  assert.equal(result.exceptions.find(item => item.id === 'zero-call-leads')!.count, 3);
  assert.ok(ai.insights.some(item => item.metricReference.includes('exceptions.zero-call-leads.count=3')));
  await getExceptionAnalytics(params);
  assert.equal(queries, 2, 'Completed results must not be retained for a later refresh');
});

test('exception pending work is isolated by tenant, dates, filters, configuration and ambient scope', async t => {
  const pending = gate();
  let queries = 0;
  t.mock.method(client, 'query', async () => { queries++; await pending.promise; return [queueRows]; });
  const config = getAllClients().find(item => item.id === scope.clientId)!;
  const originalTimezone = config.timezone;
  const originalTable = config.semanticMappings.tables.leads;
  const requests: Array<ReturnType<typeof getExceptionAnalytics>> = [];
  try {
    requests.push(getExceptionAnalytics(scope));
    requests.push(getExceptionAnalytics({ endDate: scope.endDate, startDate: scope.startDate, clientId: scope.clientId }));
    assert.equal(queries, 1, 'Property insertion order must not duplicate equivalent scalar scopes');
    for (const params of [
      { ...scope, clientId: 'mtn' }, { ...scope, startDate: '2026-09-09' }, { ...scope, endDate: '2026-09-13' },
      ...['vendor', 'source', 'medium', 'grade'].map(dimension => ({ ...scope, [dimension]: 'Scoped value' })),
    ]) requests.push(getExceptionAnalytics(params));
    assert.equal(queries, 8);
    config.timezone = 'UTC';
    requests.push(getExceptionAnalytics(scope));
    config.timezone = originalTimezone;
    config.semanticMappings.tables.leads = 'dashboards-422710.lead_ledger.pending_scope_fixture';
    requests.push(getExceptionAnalytics(scope));
    config.semanticMappings.tables.leads = originalTable;
    for (const vendor of ['A', 'B']) {
      requests.push(withAnalyticsScope({ ...scope, filters: { vendor: { operator: 'equals', value: vendor } } }, () => getExceptionAnalytics(scope)));
    }
    assert.equal(queries, 12, 'Configuration changes and ambient vendor scopes must not reuse incompatible pending work');
  } finally {
    config.timezone = originalTimezone;
    config.semanticMappings.tables.leads = originalTable;
    pending.release();
    await Promise.all(requests);
  }
});

test('a shared exception failure is cleared so the next request can retry independently', async t => {
  const pending = gate();
  let queries = 0;
  t.mock.method(client, 'query', async () => {
    queries++;
    if (queries === 1) { await pending.promise; throw new Error('Temporary queue failure'); }
    return [queueRows];
  });
  const first = getExceptionAnalytics(scope);
  const second = getExceptionAnalytics(scope);
  const failures = [assert.rejects(first, /Temporary queue failure/), assert.rejects(second, /Temporary queue failure/)];
  assert.equal(queries, 1);
  pending.release();
  await Promise.all(failures);
  const result = await getExceptionAnalytics(scope);
  assert.equal(queries, 2);
  assert.equal(result.exceptions.find(item => item.id === 'zero-call-leads')!.count, 3);
});

const cliRecord = { cli: '0871000001', campaign: 'A', vendor: 'MTN', total_calls: 4, distinct_leads: 3,
  rpc_observed_calls: 4, sale_observed_calls: 4, contact_count: 2, sale_count: 1, rpc_sale_count: 1,
  total_duration: null, avg_duration: null, duration_ge_1m: null, duration_ge_5m: null, duration_ge_15m: null };
function liveAccess(execute: SourceAccess['execute']): SourceAccess {
  return { listTables: async () => [], execute, metadata: async () => ({ type: 'TABLE', schema: {
    fields: ['cli', 'campaign_id', 'vendor', 'call_start_date', 'is_rpc', 'is_sale', 'length_in_sec', 'dialer_lead_id', 'status_name'].map(name => ({ name, type: 'STRING' })),
  } }) };
}

test('CLI exports retain dashboard row values and tenant filters with one current-period aggregation', async () => {
  const queries: Array<Parameters<SourceAccess['execute']>[0]> = [];
  const access = liveAccess(async options => {
    queries.push(options);
    return { jobId: 'fixture', rows: [{ records: [cliRecord], daily: [{ ...cliRecord, report_date: '2026-09-08' }],
      scope_distinct_leads: 3, scope_calls: 4, breakdowns: [{ dimension: 'hour', bucket: '9', cli: cliRecord.cli, calls: 4, rpc: 2, sales: 1 }] }] };
  });
  const params = { ...scope, clientId: 'mtn', search: '  1001 ', filters: { vendor: { operator: 'equals' as const, value: 'MTN' } } };
  const dashboard = await getCliPerformance(params, access);
  const exported = await exportData({ ...params, grain: 'cli' }, access);
  assert.equal(queries[0].params!.scanStartDate, '2026-09-01');
  assert.equal(queries[1].params!.scanStartDate, '2026-09-08', 'Export must scan 7 selected days rather than 14 including unused comparison days');
  assert.equal(queries[1].params!.endDate, scope.endDate);
  assert.equal((queries[0].query.match(/FROM scoped_calls/g) || []).length, 5);
  assert.equal((queries[1].query.match(/FROM scoped_calls/g) || []).length, 1, 'Export must omit all four unused dashboard aggregate branches');
  assert.doesNotMatch(queries[1].query, /AS (daily|breakdowns|scope_distinct_leads|scope_calls|call_hour|disposition)\b/);
  assert.deepEqual(queries[1].params!.tenantVendors, ['mtn']);
  assert.equal(queries[1].params!.filter_vendor, 'MTN');
  assert.equal(queries[1].params!.cliSearch, '1001');
  assert.match(queries[1].query, /LOWER\(CAST\(s\.`vendor` AS STRING\)\) IN UNNEST\(@tenantVendors\)/);
  assert.match(queries[1].query, /WHERE report_date BETWEEN @startDate AND @endDate GROUP BY cli, campaign, vendor/);
  const row = dashboard.cliPerformance[0];
  assert.deepEqual(exported.rows[0], {
    'CLI Number': row.cli, 'Report Date': row.reportDate, Campaign: row.campaign, Vendor: row.vendor,
    'Total Calls': row.totalCalls, 'Distinct Leads': row.distinctLeads, 'Calls Per Lead': row.callsPerLead,
    'Answered Calls': 'N/A', 'Right Party Contacts': row.contactCount, 'Right Party Contact Rate %': row.contactRate,
    Sales: row.saleCount, 'Sale Rate %': row.salePerCallRate, 'Avg Duration Seconds': null, 'Avg Lead Age Days': 'N/A',
  });
  assert.equal(exported.metadata.truncated, false);
  assert.equal(dashboard.trend.length, 1, 'The default dashboard must retain its diagnostic arrays');
  assert.equal(dashboard.diagnostics!.breakdowns.length, 1);
  assert.ok(dashboard.periodComparison);
});

test('CLI detail mode filters imported records before limiting and leaves dashboard summaries unchanged', async () => {
  const parsed = parseAndValidateCliCsv('cli_number,campaign_code,report_date,total_calls,contact_count,sale_count\n0871,A,2026-09-08,4,2,1\n0872,A,2026-09-08,6,3,1\n0873,B,2026-09-07,8,4,1');
  assert.deepEqual(parsed.errors, []);
  setTenantImport(scope.clientId, { ...parsed, uploadedAt: '2026-09-26T00:00:00Z', filename: 'optimization.csv' });
  const access: SourceAccess = { listTables: async () => [], metadata: async () => ({ type: 'TABLE', schema: { fields: [] } }),
    execute: async () => { throw new Error('Imported records must not query the warehouse'); } };
  try {
    const dashboard = await getCliPerformance(scope, access, { limit: 1 });
    const detail = await getCliPerformance(scope, access, { limit: 1, detailOnly: true });
    assert.equal(dashboard.summary!.totalCalls, '10');
    assert.equal(dashboard.cliPerformance.length, 2);
    assert.deepEqual(detail.cliPerformance, dashboard.cliPerformance.slice(0, 1));
    assert.equal(detail.metadata.truncated, true);
    assert.equal(detail.summary, null);
    assert.deepEqual(detail.trend, []);
    assert.deepEqual(detail.campaigns, []);
    const filtered = await exportData({ ...scope, grain: 'cli', limit: 1, search: '0872' }, access);
    assert.equal(filtered.rows[0]['CLI Number'], '0872');
    assert.equal(filtered.metadata.truncated, false);
  } finally { clearTenantImport(scope.clientId); }
});
