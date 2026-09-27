import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createSourceRouter } from '../server/bigquery/sourceRouter';
import { RequestError } from '../server/bigquery/filters';
import type { SourceAccess } from '../server/bigquery/sourceAccess';

function createControlledSourceAccess(overrides?: {
  ontactRows?: any[];
  onvestRows?: any[];
  shouldThrow?: boolean;
}): () => SourceAccess {
  return () => ({
    async metadata() {
      return { type: 'TABLE', numRows: '100' };
    },
    async listTables() {
      return [];
    },
    async execute(options: { query: string; params?: Record<string, any> }) {
      if (overrides?.shouldThrow) {
        throw new Error('Connection refused: BigQuery backend unavailable');
      }
      if (options.query.includes('ontact_raw_data')) {
        return {
          rows: overrides?.ontactRows ?? [
            {
              unique_id: 'call-1',
              source: 'ontact',
              timestamp: '2026-09-27T08:00:00Z',
              raw_data: JSON.stringify({
                uniqueid: 'call-1',
                client_code: 'ontact_blc',
                start_epoch: 1790496000,
                end_epoch: 1790496120,
                length_in_sec: 120,
                call_date: '2026-09-27 10:00:00',
                status: 'SALE',
                call_result: 'SALE',
                campaign_id: 'camp_alpha',
                list_id: 'list_100',
              }),
            },
            {
              unique_id: 'call-2',
              source: 'ontact',
              timestamp: '2026-09-27T08:05:00Z',
              raw_data: JSON.stringify({
                uniqueid: 'call-2',
                client_code: 'ontact_blc',
                start_epoch: 1790496300,
                end_epoch: 1790496360,
                length_in_sec: 60,
                call_date: '2026-09-27 10:05:00',
                status: 'NA',
                call_result: 'NA',
                campaign_id: 'camp_alpha',
                list_id: 'list_100',
              }),
            },
          ],
          jobId: 'test-job-ontact',
        };
      }
      if (options.query.includes('onvest_raw_data')) {
        return {
          rows: overrides?.onvestRows ?? [
            {
              unique_id: 'onvest-1',
              source: 'onvest',
              timestamp: '2026-09-26T12:00:00Z',
              raw_data: JSON.stringify({
                event_id: 'ev-1',
                date: '2026-09-26',
                offershop_source: 'offershop_test',
                Amount_Spent: '1250.50',
                Fetched_Leads: 100,
                Accepted_Leads: 95,
                Qualified_Leads: 90,
                Total_Leads_WithValid_Phone_ID: 85,
                Clicks: 300,
                Impressions: '5000',
                Reach: '4200',
                Outbound_Clicks: '280',
                MTN_Dialed_Leads: 80,
                MTN_Sales: 12,
              }),
            },
          ],
          jobId: 'test-job-onvest',
        };
      }
      return { rows: [], jobId: 'test-job-empty' };
    },
  });
}

function createTestApp(
  role = 'admin',
  tenant = 'default_tenant',
  denyTenant = false,
  accessProvider: () => SourceAccess = createControlledSourceAccess(),
) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.principal = {
      subject: 'test-user',
      role,
      tenants: denyTenant ? [] : [tenant, 'mtn', 'mondo', 'ontact_blc'],
    };
    next();
  });
  app.use('/api/analytics', createSourceRouter(accessProvider));
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err instanceof RequestError ? err.status : 500).json({
      success: false,
      error: err.message,
    });
  });
  return app;
}

test('GET /sources/readiness returns all 65 declared objects and historical export manifest evidence', async () => {
  const app = createTestApp('admin');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const url = `http://127.0.0.1:${port}/api/analytics/sources/readiness?clientId=default_tenant`;

  try {
    const res = await fetch(url);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    const data = body.data;

    assert.equal(data.totalSources, 65);
    assert.equal(data.successfulSources, 20);
    assert.equal(data.restrictedSources, 45);
    assert.equal(data.manifest.totalObjects, 65);
    assert.equal(data.manifest.totalTables, 18);
    assert.equal(data.manifest.totalViews, 47);
    assert.equal(data.manifest.totalDeclaredColumns, 1848);

    // Verify dedicated tenant view failure note exists
    const mtnView = data.sources.find((s: any) => s.tableName === 'view_lead_ledger_mtn_lead_submit_open');
    assert.ok(mtnView);
    assert.equal(mtnView.historicalExport.status, 'RESTRICTED');
    assert.match(mtnView.historicalExport.failingDependency, /offernet-dmp\.external_data_echos/);
    assert.match(mtnView.historicalExport.ownerActionRequired, /roles\/bigquery\.dataViewer/);

    // Verify non-admin redacts internal failing dependency details
    const viewerApp = createTestApp('viewer');
    const viewerServer = viewerApp.listen(0, '127.0.0.1');
    await once(viewerServer, 'listening');
    const viewerPort = (viewerServer.address() as any).port;
    try {
      const viewerRes = await fetch(`http://127.0.0.1:${viewerPort}/api/analytics/sources/readiness?clientId=default_tenant`);
      assert.equal(viewerRes.status, 200);
      const viewerBody = await viewerRes.json();
      const viewerMtn = viewerBody.data.sources.find((s: any) => s.tableName === 'view_lead_ledger_mtn_lead_submit_open');
      assert.equal(viewerMtn.historicalExport.failingDependency, null);
      assert.equal(viewerMtn.historicalExport.errorReason, 'Source restricted or dependency unavailable in export');
    } finally {
      viewerServer.closeAllConnections();
      await new Promise<void>(resolve => viewerServer.close(() => resolve()));
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('POST /sources/check-readiness requires admin role and validates sourceKey', async () => {
  const adminApp = createTestApp('admin');
  const server = adminApp.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/analytics/sources/check-readiness`;

  try {
    // Missing sourceKey -> 400
    const resBad = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'default_tenant' }),
    });
    assert.equal(resBad.status, 400);

    // Malformed sourceKey -> 400
    const resMalformed = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'default_tenant', sourceKey: 'invalid-key' }),
    });
    assert.equal(resMalformed.status, 400);

    // Check with non-admin -> 403
    const viewerApp = createTestApp('viewer');
    const vServer = viewerApp.listen(0, '127.0.0.1');
    await once(vServer, 'listening');
    const vPort = (vServer.address() as any).port;
    try {
      const vRes = await fetch(`http://127.0.0.1:${vPort}/api/analytics/sources/check-readiness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'default_tenant', sourceKey: 'dashboards-422710.lead_ledger.view_lead_ledger_mtn_lead_submit_open' }),
      });
      assert.equal(vRes.status, 403);
    } finally {
      vServer.closeAllConnections();
      await new Promise<void>(resolve => vServer.close(() => resolve()));
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('GET /sources/ontact/summary returns timing verification, SAST offset notes and breakdown partitions', async () => {
  const app = createTestApp('admin');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const url = `http://127.0.0.1:${port}/api/analytics/sources/ontact/summary?clientId=default_tenant`;

  try {
    const res = await fetch(url);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    const data = body.data;

    assert.equal(data.source, 'vibe-code-warren-stear.analytics_warehouse.ontact_raw_data');
    assert.ok(data.totalObservations > 0);
    assert.match(data.countingBasis, /Raw dialler observations/);
    assert.ok(data.averageDurationSec >= 0);

    // Timing validation
    assert.ok(data.timingValidation);
    assert.equal(data.timingValidation.observedWallClockUtcOffsetHours, 2);
    assert.match(data.timingValidation.note, /call_date is 2 hours ahead of start_epoch/);
    assert.ok(data.timingValidation.durationVerifiedCount >= 0);
    assert.ok(data.timingValidation.durationVerificationRatePct >= 0);

    // Breakdowns
    assert.ok(Array.isArray(data.statusBreakdown));
    assert.ok(Array.isArray(data.callResultBreakdown));
    assert.ok(Array.isArray(data.listBreakdown));
    assert.ok(Array.isArray(data.campaignBreakdown));
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('GET /sources/onvest/touchpoints rejects campaign filter, isolates tenant, and provides aligned stage bars', async () => {
  const app = createTestApp('admin');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/analytics/sources/onvest/touchpoints`;

  try {
    // 1. Rejects campaign query param with 422
    const resCampaign = await fetch(`${baseUrl}?clientId=default_tenant&campaign=summer_promo`);
    assert.equal(resCampaign.status, 422);
    const errBody = await resCampaign.json();
    assert.match(errBody.error, /Campaign filtering is unsupported/);

    // 2. Successful execution without campaign filter
    const res = await fetch(`${baseUrl}?clientId=mtn`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    const data = body.data;

    assert.equal(data.clientScopedTenant, 'mtn');
    assert.ok(data.totalReportsCount > 0);
    assert.ok(data.datesCoveredCount > 0);

    // 3. Stage comparison - independent aligned bars, not clamped funnel
    assert.ok(data.stageComparison);
    assert.ok(data.stageComparison.fetchedLeads >= 0);
    assert.match(data.stageComparison.note, /Aligned independent stage bars/);

    // 4. Spend diagnostics - unapproved currency
    assert.ok(data.spendDiagnostics);
    assert.equal(data.spendDiagnostics.currencyStatus, 'UNAPPROVED');
    assert.match(data.spendDiagnostics.spendPolicyNote, /Budget remains a separate planning value/);

    // 5. Non-additive reach notice
    assert.match(data.reachPolicy, /non-additive across dates or sources/);

    // 6. Sources breakdown
    assert.ok(Array.isArray(data.sourcesBreakdown));
    assert.ok(data.sourcesBreakdown.some((s: any) => s.source.includes('offershop')));
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('GET /sources/ontact/summary rejects non-admin viewer with 403', async () => {
  const viewerApp = createTestApp('viewer');
  const server = viewerApp.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/sources/ontact/summary?clientId=default_tenant`);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Admin access required/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('GET /sources/ontact/summary rejects tenant without approved ONtact ownership with 403', async () => {
  const adminApp = createTestApp('admin');
  const server = adminApp.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/sources/ontact/summary?clientId=mtn`);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /does not have approved source ownership/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('GET /sources/ontact/summary returns 503 safe error when warehouse query fails', async () => {
  const failingApp = createTestApp('admin', 'default_tenant', false, createControlledSourceAccess({ shouldThrow: true }));
  const server = failingApp.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/sources/ontact/summary?clientId=default_tenant`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.requestId);
    assert.match(body.error, /Warehouse source/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('GET /sources/ontact/summary handles valid empty observations cleanly', async () => {
  const emptyApp = createTestApp('admin', 'default_tenant', false, createControlledSourceAccess({ ontactRows: [] }));
  const server = emptyApp.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/sources/ontact/summary?clientId=default_tenant`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.totalObservations, 0);
    assert.equal(body.data.averageDurationSec, 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('GET /sources/onvest/touchpoints returns 503 safe error when warehouse query fails', async () => {
  const failingApp = createTestApp('admin', 'mtn', false, createControlledSourceAccess({ shouldThrow: true }));
  const server = failingApp.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/sources/onvest/touchpoints?clientId=mtn`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.requestId);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
