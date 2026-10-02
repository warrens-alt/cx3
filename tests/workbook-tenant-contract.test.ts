import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllClients, getClientConfig } from '../server/bigquery/config';
import { getBigQueryClient } from '../server/bigquery/client';
import { getOperatingControlsAnalytics } from '../server/analytics/contact/operatingControls';
import { getSpeedToLeadAnalytics } from '../server/analytics/contact/speedToLead';
import { getTemporalAnalytics } from '../server/analytics/temporal/service';

// Approved non-personal configuration from reference workbook 4_Tenant_Config,
// rows 4–12. Preserve canonical application IDs and exact configured view names.
const expected = [
  ['default_tenant', 'default_tenant', '08:00', '17:30', [1, 2, 3, 4, 5], 'clustered_lead_ledger', ['*']],
  ['mtn', 'mtn', '08:00', '17:30', [1, 2, 3, 4, 5], 'view_lead_ledger_mtn_lead_submit_open', ['MTN', 'MTN SA']],
  ['mondo', 'mondo', '08:00', '17:30', [1, 2, 3, 4, 5], 'view_lead_ledger_mondo_lead_submit_open', ['Mondo', 'Mondo Deals']],
  ['blc', 'ontact_blc', '08:00', '17:00', [1, 2, 3, 4, 5], 'view_lead_ledger_blc_lead_submit_open', ['BLC', 'BLC 1Life']],
  ['bizvoip', 'vodacom_bizvoip', '08:30', '17:00', [1, 2, 3, 4, 5], 'view_lead_ledger_bizvoip_lead_submit_open', ['BizVoIP']],
  ['rewardsco', 'rewardsco', '08:00', '18:00', [1, 2, 3, 4, 5, 6], 'view_lead_ledger_rewardsco_lead_submit_open', ['Rewardsco']],
  ['realpromotions', 'real_promotions', '08:00', '17:30', [1, 2, 3, 4, 5], 'view_lead_ledger_real_promotions_lead_submit_open', ['Real Promotions']],
  ['oneplan', 'oneplan', '08:00', '17:00', [1, 2, 3, 4, 5], 'view_lead_leadger_oneplan_lead_submit_open', ['OnePlan']],
  ['affiliate', 'affiliate', '08:00', '17:30', [1, 2, 3, 4, 5], 'view_lead_ledger_affiliate_lead_submit_open', undefined],
] as const;

test('all nine tenant contracts match workbook operating windows, aliases and spend mappings', () => {
  assert.deepEqual(getAllClients().map(client => client.id).sort(), expected.map(row => row[1]).sort());
  for (const [alias, id, start, end, workdays, source, clientNames] of expected) {
    const config = getClientConfig(alias);
    assert.equal(config.id, id);
    assert.equal(config.timezone, 'Africa/Johannesburg');
    assert.deepEqual(config.operationalConfig?.operatingHours, { start, end, workdays });
    assert.equal(config.semanticMappings.tables.leads, `dashboards-422710.lead_ledger.${source}`);
    assert.deepEqual(config.marketing?.clientNames, clientNames);
  }
  assert.equal(getClientConfig('affiliate').capabilities.marketing, false);
});

test('operating reports bind the tenant ISO calendar and return its exact operating context', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  const submitted: { query: string; params: Record<string, unknown> }[] = [];
  t.mock.method(client, 'query', async options => { submitted.push(options); return [[{}]]; });
  for (const [alias, , start, end, workdays] of expected) {
    for (const report of [getOperatingControlsAnalytics, getSpeedToLeadAnalytics, getTemporalAnalytics]) {
      const result = await report({ clientId: alias, startDate: '2026-09-21', endDate: '2026-09-27' });
      assert.deepEqual(result.operatingContext, { timezone: 'Africa/Johannesburg', start, end, workdays });
      const { query, params } = submitted.at(-1)!;
      assert.equal(params.tenantTimezone, 'Africa/Johannesburg');
      assert.equal(params.operatingStart, `${start}:00`);
      assert.equal(params.operatingEnd, `${end}:00`);
      assert.deepEqual(params.operatingWorkdays, workdays);
      // GoogleSQL %u is Monday=1..Sunday=7; DAYOFWEEK would shift this contract.
      assert.match(query, /FORMAT_TIMESTAMP\('%u',[\s\S]*?@tenantTimezone\)/);
      assert.doesNotMatch(query, /EXTRACT\(DAYOFWEEK/);
      assert.match(query, /@operatingWorkdays/);
      assert.match(query, /< @operatingStart/);
      assert.match(query, />= @operatingEnd/);
    }
  }
  assert.equal(submitted.length, 27);
});
