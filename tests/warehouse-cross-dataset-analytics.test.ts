import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { getWarehouseCrossDatasetAnalytics, searchWarehouseTables } from '../server/analytics/warehouse/warehouseAnalytics';
import { getClientConfig, getAllClients } from '../server/bigquery/config';
import { analyticsRouter } from '../server/api';

test('getWarehouseCrossDatasetAnalytics aggregates all 2 projects, 4 datasets, and 65 tables', async () => {
  const analytics = await getWarehouseCrossDatasetAnalytics('default_tenant');

  assert.ok(analytics);
  assert.equal(analytics.kpis.totalProjects, 2);
  assert.equal(analytics.kpis.totalDatasets, 4);
  assert.equal(analytics.kpis.totalWarehouseObjects, 65);
  assert.equal(analytics.kpis.totalTables, 18);
  assert.equal(analytics.kpis.totalViews, 47);
  assert.equal(analytics.kpis.totalDeclaredColumns, 1848);

  // Projects assertions
  assert.equal(analytics.projects.length, 2);
  const dashboardsProj = analytics.projects.find(p => p.projectId === 'dashboards-422710');
  assert.ok(dashboardsProj);
  assert.equal(dashboardsProj.role, 'primary_warehouse');
  assert.deepEqual(dashboardsProj.datasets, ['lead_ledger', 'watfall_report', 'vibe_coding_data']);

  const warrenProj = analytics.projects.find(p => p.projectId === 'vibe-code-warren-stear');
  assert.ok(warrenProj);
  assert.equal(warrenProj.role, 'event_telemetry');
  assert.deepEqual(warrenProj.datasets, ['analytics_warehouse']);

  // Datasets assertions
  assert.equal(analytics.datasets.length, 4);
  const leadLedger = analytics.datasets.find(d => d.dataset === 'lead_ledger');
  assert.ok(leadLedger);
  assert.equal(leadLedger.totalObjects, 35);
  assert.equal(leadLedger.tablesCount, 12);
  assert.equal(leadLedger.viewsCount, 23);

  const watfall = analytics.datasets.find(d => d.dataset === 'watfall_report');
  assert.ok(watfall);
  assert.equal(watfall.totalObjects, 18);

  const vibeCoding = analytics.datasets.find(d => d.dataset === 'vibe_coding_data');
  assert.ok(vibeCoding);
  assert.equal(vibeCoding.totalObjects, 10);

  const analyticsWh = analytics.datasets.find(d => d.dataset === 'analytics_warehouse');
  assert.ok(analyticsWh);
  assert.equal(analyticsWh.totalObjects, 2);

  // Waterfall timelines
  assert.equal(analytics.waterfallSummary.totalWaterfallObjects, 18);
  assert.equal(analytics.waterfallSummary.timelines.length, 18);

  // Touchpoints
  assert.ok(analytics.touchpointsSummary.sources.length >= 4);
  assert.equal(analytics.touchpointsSummary.totalTrackedImpressions, null);
  assert.equal(analytics.evidence.status, 'CATALOGUE_ONLY');
  assert.equal(analytics.evidence.liveDataQueried, false);
  assert.equal(analytics.kpis.totalObservedRecordsEstimate, null);
  assert.ok(analytics.projects.every(p => p.status === 'NOT_CHECKED'));

  // Raw telemetry
  assert.equal(analytics.rawTelemetrySummary.ontactDialler.totalObservationsSampled, null);
  assert.equal(analytics.rawTelemetrySummary.onvestTouchpoints.fetchedLeadsTotal, null);

  // Table inventory preview
  assert.equal(analytics.tableInventoryPreview.length, 65);
});

test('searchWarehouseTables filters accurately by dataset, family, and freeform text', () => {
  // All 65
  const all = searchWarehouseTables();
  assert.equal(all.length, 65);

  // Filter by dataset
  const leadLedgerOnly = searchWarehouseTables(undefined, 'lead_ledger');
  assert.equal(leadLedgerOnly.length, 35);

  const watfallOnly = searchWarehouseTables(undefined, 'watfall_report');
  assert.equal(watfallOnly.length, 18);

  const vibeCodingOnly = searchWarehouseTables(undefined, 'vibe_coding_data');
  assert.equal(vibeCodingOnly.length, 10);

  const rawJsonOnly = searchWarehouseTables(undefined, 'analytics_warehouse');
  assert.equal(rawJsonOnly.length, 2);

  // Filter by family
  const rawFamily = searchWarehouseTables(undefined, undefined, 'raw_json');
  assert.equal(rawFamily.length, 2);

  // Search by query
  const mtnSearch = searchWarehouseTables('mtn');
  assert.ok(mtnSearch.length >= 2);
  assert.ok(mtnSearch.some(t => t.tableName.includes('mtn')));

  const vicidialSearch = searchWarehouseTables('vicidial');
  assert.ok(vicidialSearch.length >= 3);
});

test('all client tenants include expanded datasets in config', () => {
  const defaultClient = getClientConfig('default_tenant');
  assert.ok(defaultClient.bigQueryDatasets.includes('lead_ledger'));
  assert.ok(defaultClient.bigQueryDatasets.includes('watfall_report'));
  assert.ok(defaultClient.bigQueryDatasets.includes('vibe_coding_data'));
  assert.ok(defaultClient.bigQueryDatasets.includes('analytics_warehouse'));

  for (const client of getAllClients()) {
    assert.ok(client.bigQueryDatasets.includes('lead_ledger'));
    assert.ok(client.bigQueryDatasets.includes('watfall_report'));
    assert.ok(client.bigQueryDatasets.includes('vibe_coding_data'));
  }
});

function createAnalyticsApp() {
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

test('HTTP GET /api/analytics/warehouse/overview returns explicit catalogue-only evidence', async () => {
  const app = createAnalyticsApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const url = `http://127.0.0.1:${port}/api/analytics/warehouse/overview?clientId=default_tenant`;

  try {
    const res = await fetch(url);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.kpis.totalProjects, 2);
    assert.equal(body.data.kpis.totalDatasets, 4);
    assert.equal(body.data.kpis.totalWarehouseObjects, 65);
    assert.equal(body.data.waterfallSummary.timelines.length, 18);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('HTTP GET /api/analytics/warehouse/tables returns filtered search results', async () => {
  const app = createAnalyticsApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    // 1. All tables
    const resAll = await fetch(`http://127.0.0.1:${port}/api/analytics/warehouse/tables?clientId=default_tenant`);
    assert.equal(resAll.status, 200);
    const bodyAll = await resAll.json();
    assert.equal(bodyAll.success, true);
    assert.equal(bodyAll.count, 65);
    assert.equal(bodyAll.data.length, 65);

    // 2. Filter by dataset
    const resWatfall = await fetch(`http://127.0.0.1:${port}/api/analytics/warehouse/tables?clientId=default_tenant&dataset=watfall_report`);
    assert.equal(resWatfall.status, 200);
    const bodyWatfall = await resWatfall.json();
    assert.equal(bodyWatfall.count, 18);

    // 3. Search query
    const resSearch = await fetch(`http://127.0.0.1:${port}/api/analytics/warehouse/tables?clientId=default_tenant&search=vicidial`);
    assert.equal(resSearch.status, 200);
    const bodySearch = await resSearch.json();
    assert.ok(bodySearch.count >= 3);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
