import test from 'node:test';
import assert from 'node:assert/strict';
import { getAgentPerformanceAnalytics } from '../server/analytics/agents/activity';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig, tenantVendorScopeValues } from '../server/bigquery/config';
import { validTimestampSql } from '../server/bigquery/integrity';

const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
const observed = {
  agent_id: 'synthetic-agent', vendor: 'synthetic-vendor', total_calls: 4, unique_leads: 3,
  rpc_observed_calls: 4, rpc_count: 2, sale_observed_calls: 4, sale_count: 3,
  rpc_sale_observed_calls: 2, rpc_sale_count: 1,
  duration_observed_calls: 4, total_talk_time_sec: 120, avg_duration_sec: 30,
  callback_observed_calls: 4, callbacks_booked: 0,
};

test('unrecorded agent outcomes and durations remain unavailable without changing observed call totals', async t => {
  t.mock.method(client, 'query', async () => [[{
    ...observed, rpc_observed_calls: 0, rpc_count: 0, sale_observed_calls: 0, sale_count: 0,
    rpc_sale_observed_calls: 0, rpc_sale_count: 0, callback_observed_calls: 0, callbacks_booked: 0,
    duration_observed_calls: 0, total_talk_time_sec: null, avg_duration_sec: null,
  }]]);
  const result = await getAgentPerformanceAnalytics({ clientId: 'default_tenant' });
  const agent = result.agents[0];
  assert.equal(agent.totalCalls, 4);
  assert.equal(agent.uniqueLeads, 3);
  for (const field of ['contactCount', 'contactRate', 'salesCount', 'rpcSalesCount', 'saleRate', 'callbacksBooked', 'totalTalkTime', 'avgHandleTime'] as const) {
    assert.equal(agent[field], null, field);
  }
  assert.deepEqual(agent.fieldCoverage.rpc, { observedCalls: 0, totalCalls: 4 });
  assert.deepEqual(agent.fieldCoverage.saleAmongRpc, { observedCalls: 0, totalCalls: null });
  assert.match(result.metricAvailabilityReason, /Missing or invalid observations remain unavailable/);
  assert.equal(agent.performanceTier, null);
  assert.equal(result.rankingStatus, 'UNAVAILABLE');
});

test('measured false flags and zero duration retain genuine zeroes, with no zero-denominator conversion', async t => {
  t.mock.method(client, 'query', async () => [[{
    ...observed, rpc_count: 0, sale_count: 0, rpc_sale_count: 0, rpc_sale_observed_calls: 0,
    total_talk_time_sec: 0, avg_duration_sec: 0,
  }]]);
  const { agents: [agent] } = await getAgentPerformanceAnalytics({ clientId: 'default_tenant' });
  assert.equal(agent.contactCount, 0);
  assert.equal(agent.contactRate, 0);
  assert.equal(agent.salesCount, 0);
  assert.equal(agent.rpcSalesCount, 0);
  assert.equal(agent.saleRate, null);
  assert.equal(agent.callbacksBooked, 0);
  assert.equal(agent.totalTalkTime, '0s');
  assert.equal(agent.avgHandleTime, '0s');
  assert.deepEqual(agent.fieldCoverage.duration, { observedCalls: 4, totalCalls: 4 });
});

test('RPC conversion excludes non-RPC sales and preserves independently observed metrics', async t => {
  t.mock.method(client, 'query', async () => [[observed, {
    ...observed, agent_id: 'partially-observed-agent', sale_observed_calls: 3,
    callback_observed_calls: 3, duration_observed_calls: 3,
  }]]);
  const { agents: [complete, partial] } = await getAgentPerformanceAnalytics({ clientId: 'default_tenant' });
  assert.equal(complete.salesCount, 3);
  assert.equal(complete.contactCount, 2);
  assert.equal(complete.rpcSalesCount, 1);
  assert.equal(complete.saleRate, 50, 'Three overall sales divided by two RPCs would incorrectly report 150%');
  assert.equal(complete.contactRate, 50);
  assert.equal(complete.totalTalkTime, '2m');
  assert.equal(complete.avgHandleTime, '30s');
  assert.equal(partial.salesCount, null);
  assert.equal(partial.callbacksBooked, null);
  assert.equal(partial.totalTalkTime, null);
  assert.equal(partial.avgHandleTime, null);
  assert.equal(partial.rpcSalesCount, 1, 'Sales flags are complete for the RPC population');
  assert.equal(partial.saleRate, 50);
  assert.deepEqual(partial.fieldCoverage.sale, { observedCalls: 3, totalCalls: 4 });
});

test('incomplete RPC flags or missing sales flags on RPC calls withhold conversion', async t => {
  t.mock.method(client, 'query', async () => [[
    { ...observed, rpc_observed_calls: 3 },
    { ...observed, rpc_sale_observed_calls: 1 },
  ]]);
  const { agents: [unknownContact, unknownSale] } = await getAgentPerformanceAnalytics({ clientId: 'default_tenant' });
  assert.equal(unknownContact.contactCount, null);
  assert.equal(unknownContact.contactRate, null);
  assert.equal(unknownContact.rpcSalesCount, null);
  assert.equal(unknownContact.saleRate, null);
  assert.equal(unknownSale.contactCount, 2);
  assert.equal(unknownSale.rpcSalesCount, null);
  assert.equal(unknownSale.saleRate, null);
});

test('real agent SQL measures field coverage, rejects invalid duration and retains tenant/vendor scope', async t => {
  let query = '';
  let queryParams: Record<string, unknown> = {};
  t.mock.method(client, 'query', async options => {
    query = options.query;
    queryParams = options.params;
    return [[]];
  });
  const result = await getAgentPerformanceAnalytics({ clientId: 'mtn', vendor: 'MTN', startDate: '2026-09-01', endDate: '2026-09-26' });
  assert.deepEqual(result.agents, []);
  for (const field of ['rpc', 'sale', 'callback']) {
    assert.match(query, new RegExp(`COUNTIF\\(${field}_flag IS NOT NULL\\) AS ${field}_observed_calls`));
  }
  assert.match(query, /COUNTIF\(rpc_flag AND sale_flag IS NOT NULL\) AS rpc_sale_observed_calls/);
  assert.match(query, /COUNTIF\(rpc_flag AND sale_flag\) AS rpc_sale_count/);
  assert.match(query, /raw_duration >= 0 AND NOT IS_INF\(raw_duration\) AND NOT IS_NAN\(raw_duration\)/);
  assert.ok(query.includes(validTimestampSql('call_start_date')));
  assert.match(query, /LOWER\(vendor\) IN UNNEST\(@tenantVendors\)/);
  assert.match(query, /LOWER\(vendor\) = LOWER\(@vendor\)/);
  assert.deepEqual(queryParams.tenantVendors, tenantVendorScopeValues(getClientConfig('mtn')));
  assert.equal(queryParams.vendor, 'MTN');
  assert.equal(queryParams.startDate, '2026-09-01');
  assert.equal(queryParams.endDate, '2026-09-26');
  await assert.rejects(getAgentPerformanceAnalytics({ clientId: 'mtn', source: 'unsupported' }), /supports date, tenant and vendor scope only/);
});
