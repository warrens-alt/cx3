import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_WAREHOUSE_OBJECTS, getWarehouseObject, getObjectsByDataset } from '../server/bigquery/warehouseRegistry';
import { RAW_JSON_SOURCES, CANDIDATE_SPEND_SOURCES, WAREHOUSE_SNAPSHOT_DATE } from '../contracts/warehouseDictionary';
import { analyzeProfileRows } from '../server/analytics/integrity/rawProfiler';
import { ONTACT_MAPPING_V1, ONVEST_MAPPING_V1, extractRecordFromRawPayload } from '../server/analytics/integrity/rawAdapters';

test('inventory accounts for all 65 declared objects across 2 projects and 4 datasets', () => {
  assert.equal(ALL_WAREHOUSE_OBJECTS.length, 65);
  assert.equal(WAREHOUSE_SNAPSHOT_DATE, '2026-09-27');

  const leadLedger = getObjectsByDataset('dashboards-422710', 'lead_ledger');
  assert.equal(leadLedger.length, 35);

  const watfallReport = getObjectsByDataset('dashboards-422710', 'watfall_report');
  assert.equal(watfallReport.length, 18);

  const vibeCoding = getObjectsByDataset('dashboards-422710', 'vibe_coding_data');
  assert.equal(vibeCoding.length, 10);

  const analyticsWarehouse = getObjectsByDataset('vibe-code-warren-stear', 'analytics_warehouse');
  assert.equal(analyticsWarehouse.length, 2);

  // Table types: 18 tables, 47 views
  const tables = ALL_WAREHOUSE_OBJECTS.filter(o => o.tableType === 'TABLE');
  const views = ALL_WAREHOUSE_OBJECTS.filter(o => o.tableType === 'VIEW');
  assert.equal(tables.length, 18);
  assert.equal(views.length, 47);
});

test('exact spelling of watfall_report and unusual table names are preserved', () => {
  const lewisWaterfall = getWarehouseObject('dashboards-422710', 'watfall_report', 'view_lewis_group_waterfall_report_lewis');
  assert.ok(lewisWaterfall);
  assert.equal(lewisWaterfall.dataset, 'watfall_report');

  const vibeAnalytics = getWarehouseObject('dashboards-422710', 'vibe_coding_data', 'view_vibe-code-warren--stear--ontact--analytics--api');
  assert.ok(vibeAnalytics);
  assert.equal(vibeAnalytics.tableName, 'view_vibe-code-warren--stear--ontact--analytics--api');
});

test('both raw JSON sources declare exact types and outer record timestamp', () => {
  assert.equal(RAW_JSON_SOURCES.length, 2);
  const ontact = getWarehouseObject('vibe-code-warren-stear', 'analytics_warehouse', 'ontact_raw_data')!;
  assert.ok(ontact);
  assert.equal(ontact.family, 'raw_json');
  assert.equal(ontact.disposition, 'raw_awaiting_interpretation');
  assert.deepEqual(ontact.dateFields, ['timestamp']);

  const onvest = getWarehouseObject('vibe-code-warren-stear', 'analytics_warehouse', 'onvest_raw_data')!;
  assert.ok(onvest);
  assert.equal(onvest.family, 'raw_json');
  assert.equal(onvest.disposition, 'raw_awaiting_interpretation');
  assert.deepEqual(onvest.dateFields, ['timestamp']);
});

test('bounded profiler redacts dynamic sensitive keys and identifies envelope shapes', () => {
  const sampleRows = [
    {
      unique_id: 'rec_1',
      source: 'web_hook',
      timestamp: '2026-09-27T10:00:00Z',
      json_root_type: 'object',
      level_1_keys: ['call_id', 'client_code', 'customer_email', '550e8400-e29b-41d4-a716-446655440000', 'records'],
    },
    {
      unique_id: 'rec_2',
      source: 'web_hook',
      timestamp: '2026-09-27T10:01:00Z',
      json_root_type: 'object',
      level_1_keys: ['call_id', 'client_code', 'duration', 'status'],
    },
  ];

  const profile = analyzeProfileRows(
    'vibe-code-warren-stear.analytics_warehouse.ontact_raw_data',
    'vibe-code-warren-stear',
    'analytics_warehouse',
    'ontact_raw_data',
    sampleRows,
    { redactDynamicKeys: true }
  );

  assert.equal(profile.status, 'PROFILED');
  assert.equal(profile.sampleRecordsAnalyzed, 2);
  assert.equal(profile.outerTimestampSemantics, 'outer_record_timestamp');
  assert.equal(profile.jsonStructureFindings.topLevelShape, 'object');
  assert.equal(profile.jsonStructureFindings.envelopeType, 'batch_array');
  assert.ok(profile.jsonStructureFindings.recordArrayCandidates.includes('records'));

  // Verify sensitive key redaction
  const keys = profile.topLevelKeys.map(k => k.key);
  assert.ok(keys.includes('[REDACTED_CUSTOMER_EMAIL]'));
  assert.doesNotMatch(keys.join(','), /customer_email/);
  assert.ok(profile.jsonStructureFindings.detectedDynamicKeys.includes('[REDACTED_DYNAMIC_KEY]'));
});

test('raw adapter enforces tenant ownership and quarantines unassigned records', () => {
  // Valid record for authorized tenant
  const valid = extractRecordFromRawPayload({
    unique_id: 'u_101',
    timestamp: '2026-09-27T12:00:00Z',
    raw_data: {
      call_id: 'c_999',
      client_code: 'MTN',
      duration: 120,
      status: 'ANSWERED',
    },
  }, ONTACT_MAPPING_V1);

  assert.equal(valid.quarantineStatus, 'APPROVED');
  assert.equal(valid.tenantId, 'mtn');
  assert.equal(valid.fields.callId, 'c_999');
  assert.equal(valid.fields.durationSec, 120);

  // Missing/unauthorized tenant ownership -> quarantined to prevent leakage
  const unowned = extractRecordFromRawPayload({
    unique_id: 'u_102',
    timestamp: '2026-09-27T12:01:00Z',
    raw_data: {
      call_id: 'c_1000',
      client_code: 'unauthorized_tenant',
      duration: 45,
    },
  }, ONTACT_MAPPING_V1);

  assert.equal(unowned.quarantineStatus, 'QUARANTINED');
  assert.equal(unowned.tenantId, null);
  assert.match(unowned.quarantineReason!, /tenant ownership/);

  // Missing required identity field -> quarantined
  const missingRequired = extractRecordFromRawPayload({
    unique_id: 'u_103',
    raw_data: {
      client_code: 'mtn',
    },
  }, ONTACT_MAPPING_V1);

  assert.equal(missingRequired.quarantineStatus, 'QUARANTINED');
  assert.match(missingRequired.quarantineReason!, /Missing required field/);
});

test('all 8 candidate spend sources are tracked and isolated against double counting', () => {
  assert.equal(CANDIDATE_SPEND_SOURCES.length, 8);
  for (const table of CANDIDATE_SPEND_SOURCES) {
    const [project, dataset, name] = table.split('.');
    const obj = getWarehouseObject(project, dataset, name);
    assert.ok(obj, `Candidate spend table ${table} must exist in registry`);
    assert.ok(obj.columns.some(c => c.name.toLowerCase() === 'amount_spent'));
    assert.ok(['alternative_reconciliation', 'backup_duplicate'].includes(obj.disposition));
  }
});
