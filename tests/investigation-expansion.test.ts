import test from 'node:test';
import assert from 'node:assert/strict';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { getExceptionAnalytics } from '../server/analytics/investigation/exceptions';
import { EXCEPTION_DEFINITIONS, exceptionPredicate } from '../server/analytics/investigation/exceptionPredicates';
import { getRawLeads } from '../server/analytics/investigation/records';
import { buildFactualTimeline, timelineTimestamp, getLeadTimeline } from '../server/analytics/investigation/timeline';
import { getRootCauseAnalysis } from '../server/analytics/investigation/rootCause';
import { getAgentPerformanceAnalytics } from '../server/analytics/agents/activity';
import { getCliPerformance, computeCliSummary, parseAndValidateCliCsv } from '../server/bigquery/cli_analytics';
import type { SourceAccess } from '../server/bigquery/sourceAccess';

const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
const scope = { clientId: 'default_tenant', startDate: '2026-09-08', endDate: '2026-09-14' };

test('exception counts, trend and every exact drill share the same scoped lead predicates', async t => {
  const queries: any[] = [];
  t.mock.method(client, 'query', async (options: any) => {
    queries.push(options);
    if (options.query?.includes('qualified_evidence AS')) {
      return [[{ total_count: 0, evidence_rows: [] }]];
    }
    return [[
      { id: 'zero-call-leads', comparison_period: 'current', vendor: 'A', source: 'Paid', affected_count: 3 },
      { id: 'zero-call-leads', comparison_period: 'current', vendor: 'B', source: 'Paid', affected_count: 2 },
      { id: 'zero-call-leads', comparison_period: 'previous', vendor: 'A', source: 'Paid', affected_count: 4 },
    ]];
  });
  const result = await getExceptionAnalytics({ ...scope, vendor: 'A' });
  const zero = result.exceptions.find(item => item.id === 'zero-call-leads')!;
  assert.equal(zero.count, 5);
  assert.equal(zero.previousCount, 4);
  assert.equal(zero.absoluteChange, 1);
  assert.equal(zero.percentageChange, 25);
  assert.deepEqual(zero.bySource, [{ name: 'Paid', count: 5 }]);
  assert.deepEqual(result.comparison?.previous, { startDate: '2026-09-01', endDate: '2026-09-07' });
  assert.equal(queries[0].params.vendor, 'A');
  for (const definition of EXCEPTION_DEFINITIONS) {
    const predicate = exceptionPredicate(definition.id)!;
    assert.ok(queries[0].query.includes(predicate));
    await getRawLeads({ ...scope, vendor: 'A', drill: definition.id });
    assert.ok(queries.at(-1).query.includes(`AND (${predicate})`), definition.id);
  }
  assert.match(exceptionPredicate('high-attempt-no-rpc')!, /is_rpc IS FALSE/);
  assert.match(exceptionPredicate('zero-call-leads')!, /recorded_call_count = 0/);
  await assert.rejects(getRawLeads({ ...scope, drill: 'arbitrary-sql' }), /Unsupported drill/);
});

test('factual timeline retains zero durations, unknown outcomes and undated RPC without inventing timestamps', () => {
  const events = buildFactualTimeline({ fetched: { value: '2026-09-01T10:00:00Z' }, first_call_date: '2026-09-01T12:00:00Z',
    delivered: '1970-01-01', rpc: 1, sale: '2026-09-03T00:00:00Z', revenue_generated: null }, [
    { call_start_date: '2026-09-01T12:00:00Z', length_in_sec: 0, is_rpc: false, is_sale: null },
    { call_start_date: 'invalid', length_in_sec: null, is_rpc: 'false', is_sale: false },
  ]);
  assert.equal(events.some(event => event.stage === 'Delivered'), false);
  assert.match(events.find(event => event.stage === 'Call row 1')!.details, /Duration: 0s.*RPC: No.*Sale flag: Unavailable/);
  assert.match(events.find(event => event.stage === 'Call row 2')!.details, /Duration: Unavailable.*RPC: No/);
  assert.equal(events.find(event => event.stage === 'RPC')!.timestamp, null);
  assert.match(events.find(event => event.stage === 'Sale')!.details, /revenue: Unavailable/);
  assert.equal(timelineTimestamp('1900-01-01'), null);
  assert.equal(timelineTimestamp('not-a-date'), null);
  const rpc = buildFactualTimeline({}, [{ is_rpc: true, call_start_date: '2026-09-01T11:00:00Z' }]).find(event => event.stage === 'RPC')!;
  assert.equal(rpc.timestamp, '2026-09-01T11:00:00.000Z');
  assert.match(rpc.details, /call start/);
});

test('root-cause retains every segment, uses normalized lead grain, and reconciles without rounded drift', async t => {
  const rows: any[] = [];
  for (const period of ['current', 'previous']) {
    for (const dimension of ['vendor', 'source', 'grade', 'leadAge']) {
      for (let i = 0; i < 15; i++) rows.push({ period, dimension, segment: `segment-${i}`, fetched: 10, sales: period === 'current' ? 1 : 2 });
    }
    rows.push({ period, dimension: 'overall', fetched: 150, sales: period === 'current' ? 15 : 30 });
  }
  let query = '';
  t.mock.method(client, 'query', async options => { query = options.query; return [rows]; });
  const result = await getRootCauseAnalysis(scope);
  assert.equal(result.metric.delta, -10);
  assert.match(query, /DATE\(m\.fetched_ts, @rootCauseTimezone\)/);
  assert.match(query, /operational_leads/);
  for (const dimension of result.dimensions) {
    assert.equal(dimension.segments.length, 15);
    assert.equal(dimension.reconciliationStatus, 'RECONCILED');
    assert.ok(Math.abs(dimension.segments.reduce((sum, row) => sum + row.contribution!, 0) + 10) < 1e-9);
  }
  assert.ok(result.drivers.every(driver => driver.dimension === 'vendor'));
});

test('empty comparison denominators and incomplete RPC observations withhold root-cause rates', async t => {
  let rows: any[] = [];
  t.mock.method(client, 'query', async () => [rows]);
  const empty = await getRootCauseAnalysis(scope);
  assert.equal(empty.metric.currentValue, null);
  assert.equal(empty.metric.delta, null);
  assert.deepEqual(empty.drivers, []);
  rows = ['current', 'previous'].map(period => ({ period, dimension: 'overall', fetched: 10, dialled: 5, rpc: 1, unknown_rpc: 1 }));
  const rpc = await getRootCauseAnalysis({ ...scope, metric: 'contactRate' });
  assert.equal(rpc.metric.currentValue, null);
  assert.equal(rpc.metric.delta, null);
});

test('agent day/hour groups use one tenant-local call query and exact agent scope', async t => {
  let query: any;
  t.mock.method(client, 'query', async options => { query = options; return [[{ dimension: 'hour', bucket: '9', agent_id: 'A', vendor: 'B', total_calls: 1, unique_leads: 1 }]]; });
  const result = await getAgentPerformanceAnalytics({ ...scope, agent: 'A' });
  assert.equal(result.agents.length, 0);
  assert.equal(result.breakdowns.hour[0].bucket, '9');
  assert.equal(query.params.agent, 'A');
  assert.match(query.query, /CAST\(user AS STRING\) = @agent/);
  assert.match(query.query, /@agentTimezone/);
  assert.match(query.query, /PARTITION BY d.dimension/);
});

function cliAccess(row: Record<string, any>, inspect?: (query: string) => void): SourceAccess {
  return { listTables: async () => [], metadata: async () => ({ type: 'TABLE', schema: { fields:
    ['cli', 'campaign_id', 'vendor', 'call_start_date', 'is_rpc', 'is_sale', 'length_in_sec', 'dialer_lead_id', 'status_name'].map(name => ({ name, type: 'STRING' })) } }),
    execute: async options => { inspect?.(options.query); return { rows: [row], jobId: 'fixture' }; } };
}
const cliRecord = { cli: '0871000001', campaign: 'A', vendor: 'B', total_calls: 4, distinct_leads: 3,
  rpc_observed_calls: 4, sale_observed_calls: 4, contact_count: 2, sale_count: 2, rpc_sale_count: 1,
  total_duration: null, avg_duration: null, duration_ge_1m: null, duration_ge_5m: null, duration_ge_15m: null };

test('CLI preserves missing durations, counts sold RPC calls, deduplicates summary leads and returns measured breakdowns', async () => {
  const result = await getCliPerformance({ ...scope, filters: {} }, cliAccess({ records: [cliRecord, { ...cliRecord, cli: '0871000002' }],
    daily: [{ ...cliRecord, report_date: '2026-09-08' }], scope_distinct_leads: 3, scope_calls: 8,
    breakdowns: [{ dimension: 'hour', bucket: '9', cli: '0871000001', calls: 4, rpc: 2, sales: 2 }] }, query => {
    assert.match(query, /IF\(COUNTIF\(duration_sec IS NULL\) = 0/);
    assert.match(query, /COUNT\(DISTINCT lead_id\).*scope_distinct_leads/s);
  }));
  assert.equal(result.summary!.distinctLeads, '3');
  assert.equal(result.summary!.salePerContactRate, '50.00');
  assert.equal(result.cliPerformance[0].callsPerSale, '2.00');
  assert.equal(result.durationBands.under1mCount, null);
  assert.equal(result.trend[0].date, '2026-09-08');
  assert.equal(result.diagnostics!.breakdowns[0].rpc, 2);
});

test('CLI real zero duration remains zero; no sale gives no calls/sale and unknown outcomes fail closed', async () => {
  const zero = { ...cliRecord, sale_count: 0, rpc_sale_count: 0, total_duration: 0, avg_duration: 0, duration_ge_1m: 0, duration_ge_5m: 0, duration_ge_15m: 0 };
  const result = await getCliPerformance({ ...scope, filters: {} }, cliAccess({ records: [zero], daily: [] }));
  assert.equal(result.cliPerformance[0].totalDurationSeconds, '0');
  assert.equal(result.cliPerformance[0].callsPerSale, null);
  assert.equal(result.durationBands.under1mCount, '4');
  await assert.rejects(getCliPerformance({ ...scope, filters: {} }, cliAccess({ records: [{ ...zero, rpc_observed_calls: 3 }] })), /outcome evidence is incomplete/);
});

test('live CLI comparison scans the preceding equal period but scopes current records and trends independently', async () => {
  const result = await getCliPerformance({ ...scope, filters: {} }, cliAccess({ records: [cliRecord],
    daily: [{ ...cliRecord, report_date: '2026-09-08' }, { ...cliRecord, report_date: '2026-09-01', contact_count: 1, sale_count: 1 }],
    scope_distinct_leads: 3, scope_calls: 4, breakdowns: [] }, query => {
    assert.match(query, />= @scanStartDate/);
    assert.match(query, /FROM scoped_calls WHERE report_date BETWEEN @startDate AND @endDate GROUP BY cli/);
  }));
  assert.deepEqual(result.periodComparison!.previousPeriod, { start: '2026-09-01', end: '2026-09-07' });
  assert.equal(result.periodComparison!.metrics.contactRate.delta, '25');
  assert.equal(result.periodComparison!.metrics.sales.delta, '1');
  assert.equal(result.trend.length, 1);
  assert.equal(result.trend[0].date, '2026-09-08');
  assert.equal(computeCliSummary([]).contactRate, null);
  assert.equal(computeCliSummary([]).salePerCallRate, null);
});

test('production timeline withholds unapproved call-ID associations and includes bounded ledger vendor histories', async t => {
  const queries: any[] = [];
  t.mock.method(client, 'query', async options => {
    queries.push(options);
    return [[{ lead_id: 'L', vendor: 'A', fetched: '2026-09-01T08:00:00Z', delivered: '2026-09-01T09:00:00Z' },
      { lead_id: 'L', vendor: 'B', fetched: '2026-09-01T08:00:00Z', delivered: '2026-09-02T09:00:00Z' }]];
  });
  const result = await getLeadTimeline('L', { clientId: 'default_tenant' });
  assert.equal(queries.length, 1);
  assert.ok(!queries[0].query.includes('dialer_lead_id'));
  assert.match(queries[0].query, /LIMIT 201/);
  assert.match(queries[0].query, /FORMAT_TIMESTAMP\('%Y-%m-%dT%H:%M:%SZ'/);
  assert.equal(result!.callEvidence.status, 'CONTRACT_REQUIRED');
  assert.equal(result!.events.filter(event => event.stage === 'Captured').length, 1);
  assert.equal(result!.events.filter(event => event.stage === 'Delivered').length, 2);
});

test('CLI imports reject malformed or missing required count values without synthetic zeros or partial imports', () => {
  const header = 'cli_number,campaign_code,report_date,total_calls,distinct_leads,contact_count,sale_count';
  for (const values of ['100,80,,5', '100,80,20,', '100,80,twenty,5', '100,abc,20,5', '100,120,20,5', '100,80,-2,5', '100x,80,20,5', '100,80,20,2.5']) {
    const result = parseAndValidateCliCsv(`${header}\n0871000001,A,2026-09-01,100,80,20,5\n0871000002,A,2026-09-01,${values}`);
    assert.ok(result.errors.length > 0, values);
    assert.equal(result.records.length, 0, 'Invalid evidence must not produce a partial successful import');
  }
  const missing = parseAndValidateCliCsv(`${header}\n0871000001,A,2026-09-01,100,,0,0`).records[0];
  assert.equal(missing.distinctLeads, null);
  assert.equal(missing.callsPerLead, null);
  assert.equal(missing.contactCount, '0');
  const zero = parseAndValidateCliCsv(`${header}\n0871000001,A,2026-09-01,0,0,0,0`).records[0];
  assert.equal(zero.distinctLeads, '0');
  assert.equal(zero.contactRate, null);
  assert.equal(zero.salePerCallRate, null);
  assert.equal(zero.callsPerLead, null);
});

test('R2 closeout: getRawLeads executes lifecycle-segment drill with correct dimension predicate, parameter binding, and blank/null semantics', async t => {
  const queries: any[] = [];
  t.mock.method(client, 'query', async (options: any) => {
    queries.push(options);
    return [[{ total_count: 0, evidence_rows: [] }]];
  });

  // 1. Vendor dimension with parameter binding
  await getRawLeads({ ...scope, drill: 'lifecycle-segment', drillValue: 'vendor:CallForce' });
  const vendorQuery = queries.at(-1);
  assert.ok(vendorQuery.query.includes("COALESCE(NULLIF(TRIM(m.vendor), ''), 'Unrecorded') = @lifecycleSegmentValue"));
  assert.equal(vendorQuery.params.lifecycleSegmentValue, 'CallForce');

  // 2. Unrecorded bucket uses exact unrecorded semantics through parameter binding
  await getRawLeads({ ...scope, drill: 'lifecycle-segment', drillValue: 'vendor:Unrecorded' });
  const unrecQuery = queries.at(-1);
  assert.ok(unrecQuery.query.includes("COALESCE(NULLIF(TRIM(m.vendor), ''), 'Unrecorded') = @lifecycleSegmentValue"));
  assert.equal(unrecQuery.params.lifecycleSegmentValue, 'Unrecorded');

  // 3. Literal lowercase unrecorded does not redirect to missing records and binds lowercase
  await getRawLeads({ ...scope, drill: 'lifecycle-segment', drillValue: 'vendor:unrecorded' });
  const lowerUnrecQuery = queries.at(-1);
  assert.ok(lowerUnrecQuery.query.includes("COALESCE(NULLIF(TRIM(m.vendor), ''), 'Unrecorded') = @lifecycleSegmentValue"));
  assert.equal(lowerUnrecQuery.params.lifecycleSegmentValue, 'unrecorded');

  // 4. Segment values containing colons survive encoding
  await getRawLeads({ ...scope, drill: 'lifecycle-segment', drillValue: 'source:Google:Organic:Search' });
  const colonQuery = queries.at(-1);
  assert.ok(colonQuery.query.includes("COALESCE(NULLIF(TRIM(m.source), ''), 'Unrecorded') = @lifecycleSegmentValue"));
  assert.equal(colonQuery.params.lifecycleSegmentValue, 'Google:Organic:Search');

  // 5. Source and grade dimensions
  await getRawLeads({ ...scope, drill: 'lifecycle-segment', drillValue: 'source:Google Ads' });
  assert.ok(queries.at(-1).query.includes("COALESCE(NULLIF(TRIM(m.source), ''), 'Unrecorded') = @lifecycleSegmentValue"));
  assert.equal(queries.at(-1).params.lifecycleSegmentValue, 'Google Ads');

  await getRawLeads({ ...scope, drill: 'lifecycle-segment', drillValue: 'grade:Grade A' });
  assert.ok(queries.at(-1).query.includes("COALESCE(NULLIF(TRIM(m.grade), ''), 'Unrecorded') = @lifecycleSegmentValue"));
  assert.equal(queries.at(-1).params.lifecycleSegmentValue, 'Grade A');

  // 6. Direct dimension aliases (lifecycle-vendor, lifecycle-source, lifecycle-grade)
  await getRawLeads({ ...scope, drill: 'lifecycle-vendor', drillValue: 'CallForce' });
  assert.ok(queries.at(-1).query.includes("COALESCE(NULLIF(TRIM(m.vendor), ''), 'Unrecorded') = @lifecycleSegmentValue"));
  assert.equal(queries.at(-1).params.lifecycleSegmentValue, 'CallForce');

  await getRawLeads({ ...scope, drill: 'lifecycle-source', drillValue: 'Unrecorded' });
  assert.ok(queries.at(-1).query.includes("COALESCE(NULLIF(TRIM(m.source), ''), 'Unrecorded') = @lifecycleSegmentValue"));
  assert.equal(queries.at(-1).params.lifecycleSegmentValue, 'Unrecorded');

  await getRawLeads({ ...scope, drill: 'lifecycle-grade', drillValue: 'Grade B' });
  assert.ok(queries.at(-1).query.includes("COALESCE(NULLIF(TRIM(m.grade), ''), 'Unrecorded') = @lifecycleSegmentValue"));
  assert.equal(queries.at(-1).params.lifecycleSegmentValue, 'Grade B');

  // 7. Rejection of unsupported dimensions
  await assert.rejects(
    getRawLeads({ ...scope, drill: 'lifecycle-segment', drillValue: 'campaign:BlackFriday' }),
    (err: any) => err.status === 422 && /unsupported lifecycle segment dimension/i.test(err.message)
  );

  // 8. Rejection of malformed drill value
  await assert.rejects(
    getRawLeads({ ...scope, drill: 'lifecycle-segment', drillValue: 'invalid' }),
    (err: any) => err.status === 422 && /invalid lifecycle segment drill/i.test(err.message)
  );
});

