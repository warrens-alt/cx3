import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALL_SOURCE_FIELDS,
  MARKETING_SOURCE_FIELDS,
  OFFERNET_SOURCE_TABLES,
  SOURCE_TABLE_CONTRACT,
  TIME_TO_DIAL_SOURCE_FIELDS,
} from '../contracts/physicalSources';
import { SOURCE_DEFINITIONS } from '../contracts/sourceCoverage';
import { getAllClients, getClientConfig } from '../server/bigquery/config';
import { findCliColumn } from '../server/bigquery/cli_analytics';

test('the three shared BigQuery tables are locked to the approved physical source contract', () => {
  const master = getClientConfig('default_tenant');
  assert.equal(master.semanticMappings.tables.marketing, OFFERNET_SOURCE_TABLES.marketing);
  assert.equal(master.semanticMappings.tables.calls, OFFERNET_SOURCE_TABLES.calls);
  assert.equal(master.semanticMappings.tables.timeToDial, OFFERNET_SOURCE_TABLES.timeToDial);
  assert.equal(master.semanticMappings.tables.cliPerformance, OFFERNET_SOURCE_TABLES.calls);

  assert.equal(SOURCE_TABLE_CONTRACT.marketing.table, OFFERNET_SOURCE_TABLES.marketing);
  assert.equal(SOURCE_TABLE_CONTRACT.calls.table, OFFERNET_SOURCE_TABLES.calls);
  assert.equal(SOURCE_TABLE_CONTRACT.timeToDial.table, OFFERNET_SOURCE_TABLES.timeToDial);
});

test('all tenant configs reuse the same call, timing and marketing physical tables', () => {
  for (const tenant of getAllClients()) {
    assert.equal(tenant.semanticMappings.tables.calls, OFFERNET_SOURCE_TABLES.calls, tenant.id);
    assert.equal(tenant.semanticMappings.tables.timeToDial, OFFERNET_SOURCE_TABLES.timeToDial, tenant.id);
    assert.equal(tenant.semanticMappings.tables.cliPerformance, OFFERNET_SOURCE_TABLES.calls, tenant.id);
    assert.equal(tenant.semanticMappings.tables.marketing, OFFERNET_SOURCE_TABLES.marketing, tenant.id);
  }
});

test('marketing parameters and spend grain are sourced from one canonical contract', () => {
  const marketing = getClientConfig('default_tenant').marketing!;
  assert.equal(marketing.table, OFFERNET_SOURCE_TABLES.marketing);
  assert.equal(marketing.clientNameField, MARKETING_SOURCE_FIELDS.clientName);
  assert.equal(marketing.dateField, MARKETING_SOURCE_FIELDS.date);
  assert.equal(marketing.channelField, MARKETING_SOURCE_FIELDS.channel);
  assert.equal(marketing.campaignField, MARKETING_SOURCE_FIELDS.campaign);
  assert.equal(marketing.adsetField, MARKETING_SOURCE_FIELDS.adset);
  assert.equal(marketing.impressionsField, MARKETING_SOURCE_FIELDS.impressions);
  assert.equal(marketing.reachField, MARKETING_SOURCE_FIELDS.reach);
  assert.equal(marketing.clicksField, MARKETING_SOURCE_FIELDS.clicks);
  assert.equal(marketing.outboundClicksField, MARKETING_SOURCE_FIELDS.outboundClicks);
  assert.equal(marketing.leadsField, MARKETING_SOURCE_FIELDS.platformLeads);
  assert.deepEqual(marketing.spendGrainFields, [...MARKETING_SOURCE_FIELDS.spendGrain]);
  assert.deepEqual(SOURCE_DEFINITIONS.marketing.requiredIdentityFields, [...MARKETING_SOURCE_FIELDS.spendGrain]);
});

test('VICIdial source parameters drive call coverage and CLI discovery', () => {
  assert.equal(SOURCE_DEFINITIONS.calls.dateField, CALL_SOURCE_FIELDS.date);
  assert.equal(SOURCE_DEFINITIONS.calls.filters.vendor, CALL_SOURCE_FIELDS.vendor);
  assert.deepEqual(SOURCE_DEFINITIONS.calls.requiredIdentityFields, [CALL_SOURCE_FIELDS.leadId, CALL_SOURCE_FIELDS.vendor]);
  assert.equal(SOURCE_DEFINITIONS.calls.metrics.find(metric => metric.id === 'rpc_rows')?.field, CALL_SOURCE_FIELDS.rpc);
  assert.equal(SOURCE_DEFINITIONS.calls.metrics.find(metric => metric.id === 'sale_rows')?.field, CALL_SOURCE_FIELDS.sale);
  assert.equal(SOURCE_DEFINITIONS.calls.metrics.find(metric => metric.id === 'duration_seconds')?.field, CALL_SOURCE_FIELDS.durationSeconds);

  const fields = new Map<string, { type: string }>([
    [CALL_SOURCE_FIELDS.vendor, { type: 'STRING' }],
    [CALL_SOURCE_FIELDS.date, { type: 'TIMESTAMP' }],
    [CALL_SOURCE_FIELDS.cliCandidates[0], { type: 'STRING' }],
  ]);
  assert.equal(findCliColumn(fields), CALL_SOURCE_FIELDS.cliCandidates[0]);
});

test('time-to-dial remains source-only until an identity contract exists', () => {
  assert.equal(SOURCE_DEFINITIONS.timeToDial.dateField, TIME_TO_DIAL_SOURCE_FIELDS.date);
  assert.deepEqual(SOURCE_DEFINITIONS.timeToDial.requiredIdentityFields, []);
  assert.deepEqual(SOURCE_DEFINITIONS.timeToDial.filters, {});
  assert.equal(SOURCE_TABLE_CONTRACT.timeToDial.crossSourceJoin, 'CONTRACT_REQUIRED');
  assert.match(SOURCE_DEFINITIONS.timeToDial.warning, /not silently merged/);
});
