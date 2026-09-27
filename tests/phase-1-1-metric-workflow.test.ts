import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { analyticsRouter } from '../server/api';
import { fetchAuthoritativeMetrics } from '../src/lib/offernetClient';
import { getRawLeads } from '../server/analytics/investigation/records';
import { getExecutiveOverview } from '../server/analytics/overview/service';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { AUTHORITATIVE_METRICS, METRIC_REGISTRY_VERSION } from '../contracts/metricRegistry';
import { scopedAnalysisRows } from '../src/lib/analysisExport';

function createTestApiApp(role = 'admin', tenant = 'default_tenant', denyAuth = false) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (denyAuth) {
      return next();
    }
    res.locals.principal = {
      subject: 'test-agent',
      email: 'test@bastionflowe.com',
      role,
      tenants: [tenant, 'mtn', 'mondo', 'ontact_blc'],
    };
    next();
  });
  app.use('/api/analytics', analyticsRouter);
  return app;
}

// ---------------------------------------------------------------------------
// 1. fetchAuthoritativeMetrics Contract & Validation Tests
// ---------------------------------------------------------------------------

test('Phase 1.1: fetchAuthoritativeMetrics validates authoritative envelope and all 15 metrics', async () => {
  const app = createTestApiApp('admin', 'default_tenant');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetchAuthoritativeMetrics({ baseUrl: `http://127.0.0.1:${port}` });
    assert.equal(res.success, true);
    assert.equal(res.version, METRIC_REGISTRY_VERSION);
    assert.equal(res.totalMetrics, 15);
    assert.ok(res.data);
    assert.equal(Object.keys(res.data).length, 15);

    // Three primary operational measures
    const fetched = res.data.fetched_leads;
    assert.ok(fetched);
    assert.equal(fetched.id, 'fetched_leads');
    assert.equal(fetched.businessLabel, 'Fetched leads');
    assert.equal(fetched.countingGrain, 'lead');
    assert.equal(fetched.unit, 'records');
    assert.equal(fetched.denominator, null);
    assert.equal(fetched.reconciliationStatus, 'NOT_VERIFIED');

    const delivered = res.data.delivered_leads;
    assert.ok(delivered);
    assert.equal(delivered.id, 'delivered_leads');
    assert.equal(delivered.businessLabel, 'Delivered leads');
    assert.equal(delivered.countingGrain, 'lead');
    assert.equal(delivered.unit, 'records');
    assert.equal(delivered.reconciliationStatus, 'NOT_VERIFIED');

    const deliveryRate = res.data.delivery_rate;
    assert.ok(deliveryRate);
    assert.equal(deliveryRate.id, 'delivery_rate');
    assert.equal(deliveryRate.businessLabel, 'Delivered / fetched');
    assert.equal(deliveryRate.numerator, 'delivered_leads');
    assert.equal(deliveryRate.denominator, 'fetched_leads');
    assert.equal(deliveryRate.unit, 'percent');
    assert.equal(deliveryRate.reconciliationStatus, 'NOT_VERIFIED');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('Phase 1.1: fetchAuthoritativeMetrics rejects malformed payloads and does not fabricate success', async () => {
  const app = express();
  let responsePayload: any = {};
  let statusCode = 200;

  app.get('/api/analytics/metrics/registry', (_req, res) => {
    res.status(statusCode).json(responsePayload);
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Missing explicit success=true (e.g. empty object {})
    responsePayload = {};
    statusCode = 200;
    await assert.rejects(
      fetchAuthoritativeMetrics({ baseUrl, forceRefresh: true }),
      /missing explicit success = true|not successful/i
    );

    // 2. Explicit success=false with error
    responsePayload = { success: false, error: 'Database catalog unavailable' };
    await assert.rejects(
      fetchAuthoritativeMetrics({ baseUrl, forceRefresh: true }),
      /Database catalog unavailable/
    );

    // 3. Missing definition version
    responsePayload = { success: true, totalMetrics: 0, data: {} };
    await assert.rejects(
      fetchAuthoritativeMetrics({ baseUrl, forceRefresh: true }),
      /missing or invalid definition version/i
    );

    // 4. Unsupported version format or legacy v1 version
    responsePayload = { success: true, version: 'cx.metric.1.0.0', totalMetrics: 0, data: {} };
    await assert.rejects(
      fetchAuthoritativeMetrics({ baseUrl, forceRefresh: true }),
      /Unsupported legacy metric definition version/i
    );

    // 5. totalMetrics not matching dictionary count
    responsePayload = {
      success: true,
      version: 'cx.metric.2.0.0',
      totalMetrics: 5,
      data: {},
    };
    await assert.rejects(
      fetchAuthoritativeMetrics({ baseUrl, forceRefresh: true }),
      /totalMetrics \(5\) does not match dictionary count \(0\)/i
    );

    // 6. data is array instead of dictionary object
    responsePayload = {
      success: true,
      version: 'cx.metric.2.0.0',
      totalMetrics: 0,
      data: [],
    };
    await assert.rejects(
      fetchAuthoritativeMetrics({ baseUrl, forceRefresh: true }),
      /data must be a non-array metric dictionary/i
    );

    // 7. Metric entry key does not match entry ID
    responsePayload = {
      success: true,
      version: 'cx.metric.2.0.0',
      totalMetrics: 1,
      data: {
        fetched_leads: {
          id: 'mismatched_id',
          businessLabel: 'Fetched',
          unit: 'records',
          countingGrain: 'lead',
          version: 'cx.metric.2.0.0',
        },
      },
    };
    await assert.rejects(
      fetchAuthoritativeMetrics({ baseUrl, forceRefresh: true }),
      /Metric entry key "fetched_leads" does not match metric id "mismatched_id"/
    );

    // 8. Metric entry missing required consumer fields (e.g. countingGrain)
    responsePayload = {
      success: true,
      version: 'cx.metric.2.0.0',
      totalMetrics: 1,
      data: {
        fetched_leads: {
          id: 'fetched_leads',
          businessLabel: 'Fetched leads',
          unit: 'records',
          version: 'cx.metric.2.0.0',
        },
      },
    };
    await assert.rejects(
      fetchAuthoritativeMetrics({ baseUrl, forceRefresh: true }),
      /Metric "fetched_leads" is missing a valid countingGrain/
    );

    // 9. HTTP 401/500 error
    statusCode = 503;
    responsePayload = { error: 'Service Unavailable' };
    await assert.rejects(
      fetchAuthoritativeMetrics({ baseUrl, forceRefresh: true }),
      /Service Unavailable/
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('Phase 1.1: fetchAuthoritativeMetrics honors AbortSignal cancellation', async () => {
  const app = express();
  app.get('/api/analytics/metrics/registry', async (_req, res) => {
    // Deliberate delay to allow cancellation
    setTimeout(() => {
      res.json({ success: true, version: 'cx.metric.2.0.0', totalMetrics: 0, data: {} });
    }, 150);
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const controller = new AbortController();
    const promise = fetchAuthoritativeMetrics({ baseUrl, forceRefresh: true, signal: controller.signal });
    controller.abort();
    await assert.rejects(promise, (err: any) => err.name === 'AbortError' || err.message?.includes('aborted'));
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

// ---------------------------------------------------------------------------
// 2. getRawLeads Query Refactoring & Evidence Count Tests
// ---------------------------------------------------------------------------

test('Phase 1.1: getRawLeads uses dedicated CTEs to deduplicate before total_count calculation', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  const queries: any[] = [];
  t.mock.method(client, 'query', async (options: any) => {
    queries.push(options);
    // Simulate single row result returned by evidence_stats with total_count and evidence_rows
    return [[
      {
        total_count: 85,
        evidence_rows: [
          { lead_id: 'lead-1', consumer_id: 101, fetched: '2026-09-02T10:00:00Z', vendor: 'V1', fetched_ts: '2026-09-02T10:00:00Z' },
          { lead_id: 'lead-2', consumer_id: 102, fetched: '2026-09-02T09:00:00Z', vendor: 'V1', fetched_ts: '2026-09-02T09:00:00Z' },
        ],
      },
    ]];
  });

  const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-15', limit: 15, offset: 0 };
  const result = await getRawLeads(scope);

  assert.equal(result.rows.length, 2);
  assert.equal(result.totalCount, 85);
  assert.equal(result.limit, 15);
  assert.equal(result.offset, 0);

  // Helper fields like fetched_ts and full_evidence_total must be stripped from public rows
  assert.equal(result.rows[0].fetched_ts, undefined);
  assert.equal(result.rows[0].full_evidence_total, undefined);
  assert.equal(result.rows[0].lead_id, 'lead-1');

  // Verify the refactored SQL CTE structure
  const query = queries[0].query;
  assert.ok(query.includes('qualified_evidence AS'), 'Query must contain qualified_evidence CTE');
  assert.ok(query.includes('evidence_stats AS'), 'Query must contain evidence_stats CTE');
  assert.ok(query.includes('SELECT COUNT(*) AS total_count FROM qualified_evidence'), 'total_count must be calculated FROM qualified_evidence');
  assert.ok(query.includes('evidence_page AS'), 'Query must contain evidence_page CTE');
  assert.ok(query.includes('ORDER BY fetched_ts DESC NULLS LAST, lead_id ASC'), 'Ordering must include unique lead_id tie-breaker');
  assert.ok(query.includes('SELECT AS STRUCT * EXCEPT(fetched_ts) FROM evidence_page'), 'Array selection must exclude helper fields');
});

test('Phase 1.1: getRawLeads returns correct full total when offset is beyond available records', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  t.mock.method(client, 'query', async () => {
    // When offset > total, evidence_stats still returns total_count but evidence_rows is empty
    return [[
      {
        total_count: 42,
        evidence_rows: [],
      },
    ]];
  });

  const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-15', limit: 50, offset: 100 };
  const result = await getRawLeads(scope);

  assert.equal(result.rows.length, 0);
  assert.equal(result.totalCount, 42);
  assert.equal(result.offset, 100);
});

test('Phase 1.1: getRawLeads handles genuinely empty population cleanly', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  t.mock.method(client, 'query', async () => {
    return [[
      {
        total_count: 0,
        evidence_rows: [],
      },
    ]];
  });

  const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-15', limit: 50, offset: 0 };
  const result = await getRawLeads(scope);

  assert.equal(result.rows.length, 0);
  assert.equal(result.totalCount, 0);
});

test('Phase 1.1: getRawLeads applies approved predicates consistently for Fetched, Delivered, and vendor filters', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  const queries: any[] = [];
  t.mock.method(client, 'query', async (options: any) => {
    queries.push(options);
    return [[{ total_count: 0, evidence_rows: [] }]];
  });

  const baseScope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-15' };

  // 1. Fetched funnel stage
  await getRawLeads({ ...baseScope, drill: 'funnel-stage', drillValue: 'fetched' });
  assert.ok(queries.at(-1).query.includes('AND (TRUE)'), 'Fetched stage includes all scoped leads');

  // 2. Delivered funnel stage
  await getRawLeads({ ...baseScope, drill: 'funnel-stage', drillValue: 'delivered' });
  assert.ok(queries.at(-1).query.includes('AND (m.is_delivered)'), 'Delivered stage filters to delivered leads');

  // 3. Dialled funnel stage
  await getRawLeads({ ...baseScope, drill: 'funnel-stage', drillValue: 'dialled' });
  assert.ok(queries.at(-1).query.includes('AND (m.is_dialled)'), 'Dialled stage filters to dialled leads');

  // 4. Vendor filter is applied in scoped_leads CTE before lead normalisation
  await getRawLeads({ ...baseScope, vendor: 'PartnerVendor' });
  const vendorQuery = queries.at(-1).query;
  assert.ok(vendorQuery.includes('WHERE LOWER(h.vendor) = LOWER(@vendor)'), 'Vendor filter applied in scoped_leads CTE');
  assert.equal(queries.at(-1).params.vendor, 'PartnerVendor');
});

// ---------------------------------------------------------------------------
// 3. getRawLeads Strict Evidence Response Validation Tests
// ---------------------------------------------------------------------------

test('Phase 1.1: getRawLeads strictly rejects malformed upstream evidence response envelopes', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  let mockResult: any = [];

  t.mock.method(client, 'query', async () => [mockResult]);
  const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-15', limit: 50, offset: 0 };

  // 1. Empty outer array [] (SQL promises exactly 1 aggregate row)
  mockResult = [];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /invalid evidence query response shape/i.test(err.message));

  // 2. Multiple rows returned
  mockResult = [
    { total_count: 10, evidence_rows: [] },
    { total_count: 10, evidence_rows: [] },
  ];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /invalid evidence query response shape/i.test(err.message));

  // 3. Non-object aggregate row
  mockResult = ['invalid'];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /non-object evidence aggregate row/i.test(err.message));

  // 4. Missing required fields
  mockResult = [{}];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /missing required total_count or evidence_rows/i.test(err.message));

  // 5. Null or missing total_count
  mockResult = [{ total_count: null, evidence_rows: [] }];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /missing or null evidence total_count/i.test(err.message));

  // 6. Negative total_count
  mockResult = [{ total_count: -5, evidence_rows: [] }];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /invalid total_count/i.test(err.message));

  // 7. Fractional total_count
  mockResult = [{ total_count: 10.5, evidence_rows: [] }];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /invalid total_count/i.test(err.message));

  // 8. Non-numeric string total_count
  mockResult = [{ total_count: 'not-a-number', evidence_rows: [] }];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /non-integer total_count string/i.test(err.message));

  // 9. evidence_rows is not an array
  mockResult = [{ total_count: 10, evidence_rows: 'not-array' }];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /non-array evidence_rows/i.test(err.message));

  // 10. Duplicate lead IDs in page array
  mockResult = [{
    total_count: 2,
    evidence_rows: [
      { lead_id: 'lead-1', consumer_id: 101, fetched: '2026-09-02T10:00:00Z' },
      { lead_id: 'lead-1', consumer_id: 101, fetched: '2026-09-02T10:00:00Z' },
    ],
  }];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /duplicate lead_id "lead-1"/i.test(err.message));

  // 11. Page rows > limit
  mockResult = [{
    total_count: 50,
    evidence_rows: Array.from({ length: 11 }, (_, i) => ({ lead_id: `l-${i}`, fetched: '2026-09-01T00:00:00Z' })),
  }];
  await assert.rejects(getRawLeads({ ...scope, limit: 10 }), (err: any) => err.status === 502 && /exceeds requested limit/i.test(err.message));

  // 12. page rows > 0 when total_count is 0
  mockResult = [{
    total_count: 0,
    evidence_rows: [{ lead_id: 'l-1', fetched: '2026-09-01T00:00:00Z' }],
  }];
  await assert.rejects(getRawLeads(scope), (err: any) => err.status === 502 && /total_count is 0/i.test(err.message));

  // 13. page rows > 0 when offset >= total_count
  mockResult = [{
    total_count: 5,
    evidence_rows: [{ lead_id: 'l-1', fetched: '2026-09-01T00:00:00Z' }],
  }];
  await assert.rejects(getRawLeads({ ...scope, offset: 10 }), (err: any) => err.status === 502 && /beyond total_count/i.test(err.message));
});

test('Phase 1.1: getRawLeads accepts valid BigQuery numeric string representations and wrappers', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);

  // BigQuery integer string representation
  t.mock.method(client, 'query', async () => [[
    {
      total_count: '42',
      evidence_rows: [{ lead_id: 'lead-42', consumer_id: 42, fetched: '2026-09-05T00:00:00Z' }],
    },
  ]]);
  const resString = await getRawLeads({ clientId: 'default_tenant', limit: 10, offset: 0 });
  assert.equal(resString.totalCount, 42);
  assert.equal(resString.rows.length, 1);

  // BigQuery Integer object wrapper { value: '108' }
  t.mock.method(client, 'query', async () => [[
    {
      total_count: { value: '108' },
      evidence_rows: [{ lead_id: 'lead-108', consumer_id: 108, fetched: '2026-09-05T00:00:00Z' }],
    },
  ]]);
  const resWrapper = await getRawLeads({ clientId: 'default_tenant', limit: 10, offset: 0 });
  assert.equal(resWrapper.totalCount, 108);
  assert.equal(resWrapper.rows.length, 1);
});

// ---------------------------------------------------------------------------
// 4. Complete Workflow Integration for the Three Operational Measures
// ---------------------------------------------------------------------------

test('Phase 1.1: Complete workflow for Fetched leads, Delivered leads, and Delivered / fetched', async t => {
  // Authorised client + period + filters
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  t.mock.method(client, 'query', async (options: any) => {
    if (options.query.includes('qualified_evidence AS')) {
      // Differentiate between fetched and delivered drills
      if (options.query.includes('AND (m.is_delivered)')) {
        // Delivered evidence: exactly 8 leads, all delivered
        return [[
          {
            total_count: 8,
            evidence_rows: [
              {
                lead_id: 'lead-1',
                consumer_id: 1001,
                source: 'Affiliate',
                vendor: 'V1',
                grade: 'A',
                delivered_time: '2026-09-05T08:15:00Z',
                first_call_time: '2026-09-05T08:20:00Z',
                total_calls: 2,
                last_dialer_status: 'ANSWERED',
                dialled: true,
                contacted: true,
                sale: false,
                activated: false,
                revenue: null,
                fetched: '2026-09-05T08:00:00Z',
              },
              {
                lead_id: 'lead-2',
                consumer_id: 1002,
                source: 'Direct',
                vendor: 'V1',
                grade: 'B',
                delivered_time: '2026-09-05T08:45:00Z',
                first_call_time: '2026-09-05T08:50:00Z',
                total_calls: 1,
                last_dialer_status: 'CONNECTED',
                dialled: true,
                contacted: true,
                sale: true,
                activated: true,
                revenue: 1500,
                fetched: '2026-09-05T08:30:00Z',
              },
            ],
          },
        ]];
      }
      // Fetched evidence: exactly 10 leads, includes delivered and undelivered leads
      return [[
        {
          total_count: 10,
          evidence_rows: [
            {
              lead_id: 'lead-1',
              consumer_id: 1001,
              source: 'Affiliate',
              vendor: 'V1',
              grade: 'A',
              delivered_time: '2026-09-05T08:15:00Z',
              first_call_time: '2026-09-05T08:20:00Z',
              total_calls: 2,
              last_dialer_status: 'ANSWERED',
              dialled: true,
              contacted: true,
              sale: false,
              activated: false,
              revenue: null,
              fetched: '2026-09-05T08:00:00Z',
            },
            {
              lead_id: 'lead-2',
              consumer_id: 1002,
              source: 'Direct',
              vendor: 'V1',
              grade: 'B',
              delivered_time: '2026-09-05T08:45:00Z',
              first_call_time: '2026-09-05T08:50:00Z',
              total_calls: 1,
              last_dialer_status: 'CONNECTED',
              dialled: true,
              contacted: true,
              sale: true,
              activated: true,
              revenue: 1500,
              fetched: '2026-09-05T08:30:00Z',
            },
            {
              lead_id: 'lead-3',
              consumer_id: 1003,
              source: 'Web',
              vendor: 'V2',
              grade: 'C',
              delivered_time: null,
              first_call_time: null,
              total_calls: 0,
              last_dialer_status: null,
              dialled: false,
              contacted: false,
              sale: false,
              activated: false,
              revenue: null,
              fetched: '2026-09-05T09:00:00Z',
            },
          ],
        },
      ]];
    }
    // Overview query mock
    return [[
      {
        fetched_leads: 10,
        delivered_leads: 8,
        dialled_leads: 4,
        contacted_leads: 2,
        sale_leads: 1,
        activated_leads: 1,
        total_revenue: 1500,
        daily_trends: [],
        backlog_by_vendor: [],
      },
    ]];
  });

  const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-15' };

  // Step 1: Overview values
  const overview = await getExecutiveOverview(scope, { includeDiagnostics: false });
  assert.equal(overview.kpis.fetchedLeads, 10);
  assert.equal(overview.kpis.deliveredLeads, 8);
  assert.equal(overview.kpis.deliveryRate, 80); // (8 / 10) * 100 = 80.0%
  assert.equal(overview.timezone, 'Africa/Johannesburg');
  assert.equal(overview.definitionVersion, METRIC_REGISTRY_VERSION);
  assert.ok(typeof overview.generatedAt === 'string' && overview.generatedAt.length > 0);

  // Step 2: About this metric authoritative definitions
  const fetchedDef = AUTHORITATIVE_METRICS.fetched_leads;
  assert.equal(fetchedDef.id, 'fetched_leads');
  assert.equal(fetchedDef.businessLabel, 'Fetched leads');
  assert.equal(fetchedDef.countingGrain, 'lead');
  assert.equal(fetchedDef.dateBasis, 'intake_cohort');

  const deliveredDef = AUTHORITATIVE_METRICS.delivered_leads;
  assert.equal(deliveredDef.id, 'delivered_leads');
  assert.equal(deliveredDef.businessLabel, 'Delivered leads');
  assert.equal(deliveredDef.countingGrain, 'lead');

  const deliveryRateDef = AUTHORITATIVE_METRICS.delivery_rate;
  assert.equal(deliveryRateDef.id, 'delivery_rate');
  assert.equal(deliveryRateDef.businessLabel, 'Delivered / fetched');
  assert.equal(deliveryRateDef.numerator, 'delivered_leads');
  assert.equal(deliveryRateDef.denominator, 'fetched_leads');
  assert.equal(deliveryRateDef.unit, 'percent');

  // Step 3: Matching evidence population
  const fetchedEvidence = await getRawLeads({ ...scope, drill: 'funnel-stage', drillValue: 'fetched' });
  assert.equal(fetchedEvidence.totalCount, 10, 'Fetched evidence total must match Overview fetchedLeads');
  assert.equal(fetchedEvidence.rows.length, 3);

  const deliveredEvidence = await getRawLeads({ ...scope, drill: 'funnel-stage', drillValue: 'delivered' });
  assert.equal(deliveredEvidence.totalCount, 8, 'Delivered evidence total must match Overview deliveredLeads');
  assert.equal(deliveredEvidence.rows.length, 2);
  // Verify that all records in delivered evidence are indeed delivered
  for (const row of deliveredEvidence.rows) {
    assert.ok(row.delivered_time, `Lead ${row.lead_id} in delivered evidence must have a delivered timestamp`);
  }

  // Step 4: Correctly labelled export built directly from the delivered evidence rows
  const headers = ['Lead ID', 'Consumer ID', 'Fetched', 'Source', 'Vendor', 'Grade', 'Delivered', 'First dial', 'Calls', 'Latest disposition', 'Dialled', 'RPC', 'Sale', 'Activated', 'Revenue'];
  const exportRows = deliveredEvidence.rows.map(row => [
    row.lead_id,
    row.consumer_id,
    row.fetched,
    row.source,
    row.vendor,
    row.grade,
    row.delivered_time ? 'Yes' : 'No',
    row.first_call_time || '—',
    row.total_calls ?? 0,
    row.last_dialer_status || '—',
    row.dialled ? 'Yes' : 'No',
    row.contacted ? 'Yes' : 'No',
    row.sale ? 'Yes' : 'No',
    row.activated ? 'Yes' : 'No',
    row.revenue,
  ]);
  const rawRows = [headers, ...exportRows];

  const exportScope = {
    clientId: 'default_tenant',
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    filters: { drill: 'funnel-stage', drillValue: 'delivered' },
    validationStatus: 'NOT_VERIFIED',
    dateBasis: 'intake_cohort',
    definitions: `Administrator record export. Investigation: Funnel stage: Delivered leads. Current page 1 (${deliveredEvidence.rows.length} records of ${deliveredEvidence.totalCount} in scope); one row per scoped lead.`,
    truncated: deliveredEvidence.rows.length < deliveredEvidence.totalCount,
  };

  const exported = scopedAnalysisRows(rawRows, exportScope);
  assert.equal(exported.length, deliveredEvidence.rows.length + 1, 'Exported rows count must match header + evidence rows');
  const header = exported[0];
  assert.ok(header.includes('Scope client'));
  assert.ok(header.includes('Period start'));
  assert.ok(header.includes('Period end'));
  assert.ok(header.includes('Filters'));
  assert.ok(header.includes('Validation status'));
  assert.ok(header.includes('Metric definitions'));
  assert.ok(header.includes('Detail truncated'));

  const dataRow1 = exported[1];
  assert.equal(dataRow1[0], 'lead-1');
  assert.equal(dataRow1[6], 'Yes', 'Delivered status must be Yes for delivered evidence');
  assert.equal(dataRow1[dataRow1.length - 1], true, 'Truncated flag must be accurately captured');
  assert.equal(dataRow1[dataRow1.length - 3], 'intake_cohort', 'Date basis must match authoritative metric');
  assert.equal(dataRow1[dataRow1.length - 4], 'NOT_VERIFIED', 'Validation status must be NOT_VERIFIED');
  assert.ok(String(dataRow1[dataRow1.length - 2]).includes('8 in scope'), 'Metric definitions must describe the true 8-lead population');
});
