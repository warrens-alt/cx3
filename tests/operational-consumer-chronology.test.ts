import test from 'node:test';
import assert from 'node:assert/strict';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { getExecutiveOverview } from '../server/analytics/overview/service';
import { getVendorQualityAnalytics } from '../server/analytics/performance/vendor';
import { getSpeedToLeadAnalytics } from '../server/analytics/contact/speedToLead';
import { getContactStrategyAnalytics } from '../server/analytics/contact/strategy';
import { getSalesActivationAnalytics } from '../server/analytics/outcomes/salesActivation';
const scope = { clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-30' };
const client = getBigQueryClient(getClientConfig(scope.clientId).bigQueryProject);

test('canonical consumer RPC rates and duration populations use qualified events', async t => {
  const sql: string[] = [];
  t.mock.method(client, 'query', async options => { sql.push(options.query); return [[{}]]; });
  await getExecutiveOverview(scope);
  await getVendorQualityAnalytics(scope);
  await getSpeedToLeadAnalytics(scope);
  await getContactStrategyAnalytics(scope);
  await getSalesActivationAnalytics(scope);
  for (const query of sql.slice(0, 4)) {
    assert.match(query, /is_qualified_rpc/);
    assert.doesNotMatch(query, /CASE WHEN is_rpc THEN lead_id|COUNTIF\(is_rpc\) AS contacted/);
  }
  assert.match(sql[0], /is_dialled AND delivery_to_dial_sec BETWEEN/);
  assert.match(sql[1], /CASE WHEN is_dialled AND deliv_to_dial_sec >= 0/);
  assert.match(sql[2], /has_recorded_first_dial AND NOT is_dialled THEN 'Invalid \/ unrecorded timing'/);
  assert.match(sql[4], /WHEN is_qualified_activation AND activation_ts >= sale_ts/);
});

test('missing aggregate response cannot become an observed empty population', async t => {
  let requests = 0;
  t.mock.method(client, 'query', async () => { requests++; return [[]]; });
  for (const service of [getExecutiveOverview, getVendorQualityAnalytics, getSpeedToLeadAnalytics, getSalesActivationAnalytics]) {
    await assert.rejects(service(scope), /aggregate evidence is unavailable/);
  }
  assert.equal(requests, 4, 'no failed source can trigger a broader query');
});

test('overview without transition evidence does not infer funnel loss by subtraction', async t => {
  t.mock.method(client, 'query', async () => [[{ fetched_leads: 10, delivered_leads: 8, dialled_leads: 6, sale_leads: 7, activated_leads: 9 }]]);
  const result = await getExecutiveOverview(scope, { includeDiagnostics: false });
  assert.equal(result.funnelLeak, null);
  assert.ok(result.funnelStages.slice(1).every(stage => stage.loss === null && stage.transitionRate === null));
  assert.equal(result.kpis.activatedLeads, 9, 'independent recorded activation remains intact');
});
