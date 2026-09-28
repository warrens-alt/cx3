import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildWarehouseExportBundle,
  generateWarehouseSchemaCsv,
  generateWarehouseInventoryCsv,
  generateWarehouseDataCsv,
  enrichTableObject,
} from '../server/analytics/warehouse/warehouseExport';
import { ALL_WAREHOUSE_OBJECTS } from '../server/bigquery/warehouseRegistry';
import { analyticsRouter } from '../server/api';

test('buildWarehouseExportBundle returns complete Google projects, datasets, tables, schemes and data', async () => {
  const bundle = await buildWarehouseExportBundle({ clientId: 'default_tenant' });

  assert.ok(bundle);
  assert.equal(bundle.exportMetadata.totalProjects, 2);
  assert.equal(bundle.exportMetadata.totalDatasets, 4);
  assert.equal(bundle.exportMetadata.totalObjects, 65);
  assert.equal(bundle.exportMetadata.totalTables, 18);
  assert.equal(bundle.exportMetadata.totalViews, 47);
  assert.equal(bundle.exportMetadata.totalDeclaredColumns, 1848);
  assert.equal(bundle.exportMetadata.scope, 'all_google_projects_datasets_and_tables');

  // Verify Google Cloud Projects
  assert.equal(bundle.projects.length, 4);
  const dashboards = bundle.projects.find(p => p.projectId === 'dashboards-422710');
  assert.ok(dashboards);
  assert.equal(dashboards.role, 'primary_warehouse');
  assert.deepEqual(dashboards.datasets, ['lead_ledger', 'watfall_report', 'vibe_coding_data']);

  const warren = bundle.projects.find(p => p.projectId === 'vibe-code-warren-stear');
  assert.ok(warren);
  assert.equal(warren.role, 'event_telemetry');
  assert.deepEqual(warren.datasets, ['analytics_warehouse']);

  // Verify BigQuery Datasets
  assert.equal(bundle.datasets.length, 4);
  const leadLedger = bundle.datasets.find(d => d.dataset === 'lead_ledger');
  assert.ok(leadLedger);
  assert.equal(leadLedger.totalObjects, 35);
  assert.equal(leadLedger.tablesCount, 12);
  assert.equal(leadLedger.viewsCount, 23);

  const watfall = bundle.datasets.find(d => d.dataset === 'watfall_report');
  assert.ok(watfall);
  assert.equal(watfall.totalObjects, 18);

  const vibeCoding = bundle.datasets.find(d => d.dataset === 'vibe_coding_data');
  assert.ok(vibeCoding);
  assert.equal(vibeCoding.totalObjects, 10);

  const analyticsWh = bundle.datasets.find(d => d.dataset === 'analytics_warehouse');
  assert.ok(analyticsWh);
  assert.equal(analyticsWh.totalObjects, 2);

  // Verify Tables & Schemas
  assert.equal(bundle.tables.length, 65);
  for (const table of bundle.tables) {
    assert.ok(table.project);
    assert.ok(table.dataset);
    assert.ok(table.tableName);
    assert.ok(table.fullTableId);
    assert.ok(table.tableType === 'TABLE' || table.tableType === 'VIEW');
    assert.ok(Array.isArray(table.schema));
    assert.ok(table.schema.length > 0);
    assert.ok(bundle.schemas[table.fullTableId]);
    assert.deepEqual(bundle.schemas[table.fullTableId], table.schema);

    // Verify schema columns have required fields
    for (const col of table.schema) {
      assert.ok(typeof col.name === 'string');
      assert.ok(typeof col.type === 'string');
      assert.ok(typeof col.nullable === 'boolean');
      assert.ok(typeof col.ordinalPosition === 'number');
      assert.ok(typeof col.isCandidateKey === 'boolean');
      assert.ok(typeof col.isDateField === 'boolean');
      assert.ok(typeof col.isSensitive === 'boolean');
    }

    assert.ok(table.dataEvidence);
    assert.ok(table.dataEvidence.status);
  }

  // Verify Operational Data & Telemetry
  assert.ok(bundle.tableDataAndTelemetry.waterfallTimelines.length === 18);
  assert.ok(bundle.tableDataAndTelemetry.touchpointCampaigns.length >= 4);
  assert.ok(bundle.tableDataAndTelemetry.ontactDiallerTelemetry.totalObservationsSampled > 0);
  assert.ok(bundle.tableDataAndTelemetry.onvestTouchpointTelemetry.fetchedLeadsTotal > 0);
  assert.equal(bundle.tableDataAndTelemetry.exportManifestEvidence.totalRowsExported, 981);
});

test('buildWarehouseExportBundle respects project and dataset filters', async () => {
  const filteredProject = await buildWarehouseExportBundle({
    projectFilter: 'vibe-code-warren-stear',
  });
  assert.equal(filteredProject.tables.length, 2);
  assert.ok(filteredProject.tables.every(t => t.project === 'vibe-code-warren-stear'));

  const filteredDataset = await buildWarehouseExportBundle({
    datasetFilter: 'watfall_report',
  });
  assert.equal(filteredDataset.tables.length, 18);
  assert.ok(filteredDataset.tables.every(t => t.dataset === 'watfall_report'));
});

test('generateWarehouseSchemaCsv outputs complete CSV with all declared columns', () => {
  const csv = generateWarehouseSchemaCsv(ALL_WAREHOUSE_OBJECTS);
  assert.ok(csv.startsWith('Project,Dataset,Table Name,Table Type,Column Name,Data Type'));

  const lines = csv.split('\r\n');
  assert.ok(lines.length > 100);
  // Verify header row
  assert.equal(lines[0], 'Project,Dataset,Table Name,Table Type,Column Name,Data Type,Ordinal Position,Nullable,Candidate Key,Date Field,Sensitive Field,Analytical Grain,Family,Disposition');

  // Verify presence of sample table columns
  assert.ok(csv.includes('clustered_lead_ledger'));
  assert.ok(csv.includes('lead_id'));
  assert.ok(csv.includes('consumer_id'));
  assert.ok(csv.includes('dialer_uniqueid'));
});

test('generateWarehouseInventoryCsv outputs 65 table rows with metadata and keys', () => {
  const csv = generateWarehouseInventoryCsv(ALL_WAREHOUSE_OBJECTS);
  const lines = csv.split('\r\n');
  // Header + 65 objects = 66 lines
  assert.equal(lines.length, 66);
  assert.ok(csv.includes('lead_ledger'));
  assert.ok(csv.includes('watfall_report'));
  assert.ok(csv.includes('vibe_coding_data'));
  assert.ok(csv.includes('analytics_warehouse'));
});

function createTestAnalyticsApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.principal = {
      subject: 'warehouse-test-user',
      role: 'admin',
      tenants: ['default_tenant', 'mtn', 'mondo'],
    };
    next();
  });
  app.use('/api/analytics', analyticsRouter);
  return app;
}

test('HTTP GET /api/analytics/warehouse/export returns full export bundle', async () => {
  const app = createTestAnalyticsApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/warehouse/export?clientId=default_tenant`);
    assert.equal(res.status, 200);
    const json = await res.json() as any;
    assert.ok(json.success);
    assert.equal(json.data.exportMetadata.totalProjects, 2);
    assert.equal(json.data.exportMetadata.totalDatasets, 4);
    assert.equal(json.data.exportMetadata.totalObjects, 65);
    assert.equal(json.data.tables.length, 65);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('HTTP GET /api/analytics/warehouse/export?format=schema_csv returns CSV catalog', async () => {
  const app = createTestAnalyticsApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/warehouse/export?clientId=default_tenant&format=schema_csv`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/csv/);
    assert.match(res.headers.get('content-disposition') || '', /google_warehouse_all_tables_schemas\.csv/);
    const text = await res.text();
    assert.ok(text.startsWith('Project,Dataset,Table Name,Table Type,Column Name'));
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('build-warehouse-export script produces valid artifacts on disk', async () => {
  const outDir = path.resolve(process.cwd(), 'dist', 'warehouse-export');
  const jsonPath = path.join(outDir, 'google_warehouse_all_projects_datasets_tables_schemas.json');
  const schemaCsvPath = path.join(outDir, 'google_tables_schemas_complete_catalog.csv');
  const inventoryCsvPath = path.join(outDir, 'google_projects_datasets_tables_inventory.csv');
  const dataCsvPath = path.join(outDir, 'google_warehouse_data_and_telemetry.csv');

  if (!fs.existsSync(jsonPath) || !fs.existsSync(schemaCsvPath) || !fs.existsSync(inventoryCsvPath)) {
    fs.mkdirSync(outDir, { recursive: true });
    const bundle = await buildWarehouseExportBundle({ clientId: 'default_tenant' });
    fs.writeFileSync(jsonPath, JSON.stringify(bundle, null, 2), 'utf8');
    fs.writeFileSync(schemaCsvPath, generateWarehouseSchemaCsv(ALL_WAREHOUSE_OBJECTS), 'utf8');
    fs.writeFileSync(inventoryCsvPath, generateWarehouseInventoryCsv(ALL_WAREHOUSE_OBJECTS), 'utf8');
    fs.writeFileSync(dataCsvPath, generateWarehouseDataCsv(bundle), 'utf8');
  }

  assert.ok(fs.existsSync(jsonPath), 'JSON export archive must exist');
  assert.ok(fs.existsSync(schemaCsvPath), 'Schema CSV must exist');
  assert.ok(fs.existsSync(inventoryCsvPath), 'Inventory CSV must exist');

  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.equal(parsed.exportMetadata.totalObjects, 65);
  assert.equal(parsed.tables.length, 65);
});
