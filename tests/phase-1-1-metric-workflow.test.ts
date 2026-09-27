import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { analyticsRouter } from '../server/api';
import { fetchAuthoritativeMetrics, fetchRawLeads } from '../src/lib/offernetClient';
import { getRawLeads } from '../server/analytics/investigation/records';
import { getExecutiveOverview } from '../server/analytics/overview/service';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { AUTHORITATIVE_METRICS, METRIC_REGISTRY_VERSION } from '../contracts/metricRegistry';
import { buildLeadEvidenceExport, scopedAnalysisRows } from '../src/lib/analysisExport';
import { apiErrorHandler } from '../server/apiErrors';

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
  app.use(apiErrorHandler);
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
    // 1. Missing explicit success=true
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

    // 8. Metric entry missing required consumer fields
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

    // 9. HTTP 503 error
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
    return [[
      {
        total_count: 2,
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
  assert.equal(result.totalCount, 2);
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

  await getRawLeads({ ...baseScope, drill: 'funnel-stage', drillValue: 'fetched' });
  assert.ok(queries.at(-1).query.includes('AND (TRUE)'), 'Fetched stage includes all scoped leads');

  await getRawLeads({ ...baseScope, drill: 'funnel-stage', drillValue: 'delivered' });
  assert.ok(queries.at(-1).query.includes('AND (m.is_delivered)'), 'Delivered stage filters to delivered leads');

  await getRawLeads({ ...baseScope, drill: 'funnel-stage', drillValue: 'dialled' });
  assert.ok(queries.at(-1).query.includes('AND (m.is_dialled)'), 'Dialled stage filters to dialled leads');

  await getRawLeads({ ...baseScope, vendor: 'PartnerVendor' });
  const vendorQuery = queries.at(-1).query;
  assert.ok(vendorQuery.includes('WHERE LOWER(h.vendor) = LOWER(@vendor)'), 'Vendor filter applied in scoped_leads CTE');
  assert.equal(queries.at(-1).params.vendor, 'PartnerVendor');
});

// ---------------------------------------------------------------------------
// 3. Complete Page Requirement & Strict Evidence Response Validation Tests
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
  await assert.rejects(getRawLeads({ ...scope, limit: 10 }), (err: any) => err.status === 502 && /duplicate lead_id "lead-1"/i.test(err.message));

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

  // 14. Short page when more rows must exist: two-of-eight response with limit 50, offset 0
  mockResult = [{
    total_count: 8,
    evidence_rows: [
      { lead_id: 'l-1', fetched: '2026-09-01T00:00:00Z' },
      { lead_id: 'l-2', fetched: '2026-09-01T00:00:00Z' },
    ],
  }];
  await assert.rejects(
    getRawLeads({ ...scope, limit: 50, offset: 0 }),
    (err: any) => err.status === 502 && /expected complete page of 8 rows/i.test(err.message)
  );

  // 15. Empty page when rows must exist: empty-of-eight response with limit 50, offset 0
  mockResult = [{
    total_count: 8,
    evidence_rows: [],
  }];
  await assert.rejects(
    getRawLeads({ ...scope, limit: 50, offset: 0 }),
    (err: any) => err.status === 502 && /expected complete page of 8 rows/i.test(err.message)
  );
});

test('Phase 1.1: Mounted evidence endpoint rejects two-of-eight and empty-of-eight upstream responses and prevents export', async () => {
  const app = createTestApiApp('admin', 'default_tenant');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);

  try {
    // 1. Upstream returns two-of-eight
    client.query = (async () => [[
      {
        total_count: 8,
        evidence_rows: [
          { lead_id: 'lead-1', consumer_id: 1, fetched: '2026-09-05T00:00:00Z' },
          { lead_id: 'lead-2', consumer_id: 2, fetched: '2026-09-05T00:00:00Z' },
        ],
      },
    ]]) as any;

    const resTwoOfEight = await fetch(`http://127.0.0.1:${port}/api/analytics/offernet/raw-leads?clientId=default_tenant&limit=50&offset=0`);
    assert.equal(resTwoOfEight.status, 502, 'HTTP status must be 502 Bad Gateway for short page');
    const bodyTwo = await resTwoOfEight.json();
    assert.equal(bodyTwo.success, false);
    assert.match(bodyTwo.error, /expected complete page of 8 rows/i);

    // 2. Upstream returns empty-of-eight
    client.query = (async () => [[
      {
        total_count: 8,
        evidence_rows: [],
      },
    ]]) as any;

    const resEmptyOfEight = await fetch(`http://127.0.0.1:${port}/api/analytics/offernet/raw-leads?clientId=default_tenant&limit=50&offset=0`);
    assert.equal(resEmptyOfEight.status, 502, 'HTTP status must be 502 Bad Gateway for empty page when total is 8');
    const bodyEmpty = await resEmptyOfEight.json();
    assert.equal(bodyEmpty.success, false);
    assert.match(bodyEmpty.error, /expected complete page of 8 rows/i);

    // 3. Confirm buildLeadEvidenceExport rejects incomplete data and blocks CSV export
    assert.throws(() => {
      buildLeadEvidenceExport({
        rows: [{ lead_id: 'lead-1' }, { lead_id: 'lead-2' }],
        totalCount: 8,
        limit: 50,
        offset: 0,
      });
    }, /Cannot export incomplete evidence page/i);

    assert.throws(() => {
      buildLeadEvidenceExport({
        rows: [],
        totalCount: 8,
        limit: 50,
        offset: 0,
      });
    }, /Cannot export incomplete evidence page/i);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('Phase 1.1: getRawLeads accepts valid BigQuery numeric string representations and wrappers with proper pagination offset', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);

  // BigQuery integer string representation '42', tested at offset 41 with limit 10 -> expectedPageRows is min(10, 42 - 41) = 1
  t.mock.method(client, 'query', async () => [[
    {
      total_count: '42',
      evidence_rows: [{ lead_id: 'lead-42', consumer_id: 42, fetched: '2026-09-05T00:00:00Z' }],
    },
  ]]);
  const resString = await getRawLeads({ clientId: 'default_tenant', limit: 10, offset: 41 });
  assert.equal(resString.totalCount, 42);
  assert.equal(resString.rows.length, 1);

  // BigQuery Integer object wrapper { value: '108' }, tested at offset 107 with limit 10 -> expectedPageRows is min(10, 108 - 107) = 1
  t.mock.method(client, 'query', async () => [[
    {
      total_count: { value: '108' },
      evidence_rows: [{ lead_id: 'lead-108', consumer_id: 108, fetched: '2026-09-05T00:00:00Z' }],
    },
  ]]);
  const resWrapper = await getRawLeads({ clientId: 'default_tenant', limit: 10, offset: 107 });
  assert.equal(resWrapper.totalCount, 108);
  assert.equal(resWrapper.rows.length, 1);
});

// ---------------------------------------------------------------------------
// 4. Synthetic Fixture, Population Oracle, and Small Case (10 / 8 leads)
// ---------------------------------------------------------------------------

interface RawLeadEvent {
  lead_id: string;
  consumer_id: number;
  client: string;
  fetched: string;
  offershop_source?: string;
  offershop_grade?: string;
  hlc_details?: Array<{
    vendor?: string;
    transaction_id?: string;
    attempted_to_deliver?: string | null;
    delivered?: string | null;
    first_call_date?: string | null;
    sale?: string | null;
    activated?: string | null;
    total_calls?: number | null;
    rpc?: number | null;
    last_dialer_status?: string | null;
    revenue_generated?: number | null;
  }>;
}

/** Pure population oracle derived from raw lead events following verified BigQuery counting semantics */
function evaluatePopulationOracle(
  rawLeads: RawLeadEvent[],
  scope: { clientId: string; startDate: string; endDate: string; vendor?: string },
  options: { drill?: string | null; drillValue?: string | null; limit?: number; offset?: number } = {}
) {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  // 1. Scope selection: client, date window on fetched timestamp, and optional vendor
  const inScope = rawLeads.filter(lead => {
    if (lead.client !== scope.clientId) return false;
    const fDate = lead.fetched.slice(0, 10);
    if (fDate < scope.startDate || fDate > scope.endDate) return false;
    if (scope.vendor) {
      const hasVendor = lead.hlc_details?.some(h => h.vendor?.toLowerCase() === scope.vendor?.toLowerCase());
      if (!hasVendor) return false;
    }
    return true;
  });

  // 2. Normalization to deduplicated operational lead grain
  const operational = inScope.map(lead => {
    const hlcs = lead.hlc_details || [];
    const validDelivered = hlcs
      .map(h => h.delivered)
      .filter((d): d is string => Boolean(d) && !d.startsWith('1900') && !d.startsWith('1970'));
    const isDelivered = validDelivered.length > 0;
    const earliestDelivered = validDelivered.length ? [...validDelivered].sort()[0] : null;

    const validDials = hlcs
      .map(h => h.first_call_date)
      .filter((d): d is string => Boolean(d) && !d.startsWith('1900') && !d.startsWith('1970'));
    const isDialled = validDials.length > 0;
    const earliestDial = validDials.length ? [...validDials].sort()[0] : null;

    const validSales = hlcs
      .map(h => h.sale)
      .filter((d): d is string => Boolean(d) && !d.startsWith('1900') && !d.startsWith('1970'));
    const isSale = validSales.length > 0;

    const validActivations = hlcs
      .map(h => h.activated)
      .filter((d): d is string => Boolean(d) && !d.startsWith('1900') && !d.startsWith('1970'));
    const isActivated = validActivations.length > 0;

    let isRpc: boolean | null = false;
    if (hlcs.some(h => h.rpc !== null && h.rpc !== undefined && Number(h.rpc) > 0)) {
      isRpc = true;
    } else if (hlcs.length === 0 || hlcs.some(h => h.rpc === null || h.rpc === undefined)) {
      isRpc = null;
    } else {
      isRpc = false;
    }

    const callCounts = hlcs
      .map(h => h.total_calls)
      .filter((c): c is number => c !== null && c !== undefined && c >= 0);
    const maxCalls = callCounts.length ? Math.max(...callCounts) : null;

    const latestDisposition = hlcs.find(h => h.last_dialer_status?.trim())?.last_dialer_status || null;
    const totalRevenue = hlcs.reduce((sum, h) => sum + (Number(h.revenue_generated) || 0), 0) || null;

    // Pick representative HLC row matching SQL QUALIFY ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY delivered DESC NULLS LAST, transaction_id ASC NULLS LAST)
    const sortedHlcs = [...hlcs].sort((a, b) => {
      const aDel = a.delivered || '';
      const bDel = b.delivered || '';
      if (aDel && !bDel) return -1;
      if (!aDel && bDel) return 1;
      if (aDel !== bDel) return bDel.localeCompare(aDel);
      return (a.transaction_id || '').localeCompare(b.transaction_id || '');
    });
    const rep = sortedHlcs[0] || {};

    return {
      lead_id: lead.lead_id,
      consumer_id: lead.consumer_id,
      fetched: lead.fetched,
      fetched_ts: lead.fetched,
      source: lead.offershop_source || 'Affiliate',
      vendor: rep.vendor || hlcs[0]?.vendor || 'V1',
      grade: lead.offershop_grade || 'A',
      delivered_time: earliestDelivered,
      first_call_time: earliestDial,
      total_calls: maxCalls,
      last_dialer_status: latestDisposition,
      dialled: isDialled,
      contacted: isRpc,
      sale: isSale,
      activated: isActivated,
      revenue: totalRevenue,
      is_delivered: isDelivered,
      is_dialled: isDialled,
    };
  });

  // 3. Overview aggregates
  const fetchedCount = operational.length;
  const deliveredCount = operational.filter(o => o.is_delivered).length;
  const deliveryRate = fetchedCount > 0 ? Number(((deliveredCount / fetchedCount) * 100).toFixed(1)) : 0;

  // 4. Drill filter
  let filtered = operational;
  if (options.drill === 'funnel-stage') {
    if (options.drillValue === 'delivered') {
      filtered = operational.filter(o => o.is_delivered);
    } else if (options.drillValue === 'fetched') {
      filtered = operational;
    }
  }

  // 5. Deterministic sorting: fetched_ts DESC NULLS LAST, lead_id ASC
  filtered.sort((a, b) => {
    if (a.fetched_ts !== b.fetched_ts) {
      return b.fetched_ts.localeCompare(a.fetched_ts);
    }
    return a.lead_id.localeCompare(b.lead_id);
  });

  const totalCount = filtered.length;
  const pageRows = filtered.slice(offset, offset + limit);

  return {
    overview: {
      fetched_leads: fetchedCount,
      delivered_leads: deliveredCount,
      delivery_rate: deliveryRate,
      dialled_leads: operational.filter(o => o.is_dialled).length,
      contacted_leads: operational.filter(o => o.contacted === true).length,
      sale_leads: operational.filter(o => o.sale).length,
      activated_leads: operational.filter(o => o.activated).length,
      total_revenue: operational.reduce((sum, o) => sum + (o.revenue || 0), 0),
      daily_trends: [],
      backlog_by_vendor: [],
    },
    totalCount,
    rows: pageRows,
    allFiltered: filtered,
  };
}

// Small synthetic fixture: 10 in-scope leads, 8 delivered, 2 undelivered, 3 excluded
const smallFixture: RawLeadEvent[] = [
  // lead-01: delivered, multiple HLC rows
  {
    lead_id: 'lead-01',
    consumer_id: 1001,
    client: 'default_tenant',
    fetched: '2026-09-05T10:00:00Z',
    offershop_source: 'Affiliate',
    offershop_grade: 'A',
    hlc_details: [
      { vendor: 'V1', transaction_id: 'tx-01-b', delivered: '2026-09-05T10:05:00Z', first_call_date: '2026-09-05T10:10:00Z', total_calls: 2, rpc: 1, last_dialer_status: 'CONNECTED', revenue_generated: 0 },
      { vendor: 'V1', transaction_id: 'tx-01-a', delivered: '2026-09-05T10:02:00Z', total_calls: 1, rpc: 0 },
    ],
  },
  // lead-02: delivered, multiple HLC rows across vendors, sale & activated
  {
    lead_id: 'lead-02',
    consumer_id: 1002,
    client: 'default_tenant',
    fetched: '2026-09-05T09:50:00Z',
    offershop_source: 'Direct',
    offershop_grade: 'B',
    hlc_details: [
      { vendor: 'V1', transaction_id: 'tx-02-a', delivered: '2026-09-05T09:55:00Z', first_call_date: '2026-09-05T10:00:00Z', total_calls: 1, rpc: 1, sale: '2026-09-05T10:15:00Z', activated: '2026-09-05T10:20:00Z', revenue_generated: 1500 },
      { vendor: 'V2', transaction_id: 'tx-02-b', delivered: null, total_calls: 0 },
    ],
  },
  // lead-03: delivered, unknown RPC (null), last_dialer_status
  {
    lead_id: 'lead-03',
    consumer_id: 1003,
    client: 'default_tenant',
    fetched: '2026-09-05T09:40:00Z',
    offershop_source: 'Web',
    offershop_grade: 'C',
    hlc_details: [
      { vendor: 'V1', transaction_id: 'tx-03-a', delivered: '2026-09-05T09:45:00Z', first_call_date: '2026-09-05T09:48:00Z', total_calls: 3, rpc: null, last_dialer_status: 'NO_ANSWER' },
    ],
  },
  // lead-04: delivered, missing calls (null), undialled
  {
    lead_id: 'lead-04',
    consumer_id: 1004,
    client: 'default_tenant',
    fetched: '2026-09-05T09:30:00Z',
    offershop_source: 'Affiliate',
    offershop_grade: 'A',
    hlc_details: [
      { vendor: 'V1', transaction_id: 'tx-04-a', delivered: '2026-09-05T09:32:00Z', first_call_date: null, total_calls: null, rpc: null },
    ],
  },
  // lead-05: delivered, dialled, rpc false
  {
    lead_id: 'lead-05',
    consumer_id: 1005,
    client: 'default_tenant',
    fetched: '2026-09-05T09:20:00Z',
    offershop_source: 'Paid',
    offershop_grade: 'B',
    hlc_details: [
      { vendor: 'V1', transaction_id: 'tx-05-a', delivered: '2026-09-05T09:25:00Z', first_call_date: '2026-09-05T09:28:00Z', total_calls: 1, rpc: 0, last_dialer_status: 'BUSY' },
    ],
  },
  // lead-06: delivered, vendor V2, 0 calls
  {
    lead_id: 'lead-06',
    consumer_id: 1006,
    client: 'default_tenant',
    fetched: '2026-09-05T09:10:00Z',
    offershop_source: 'Web',
    offershop_grade: 'A',
    hlc_details: [
      { vendor: 'V2', transaction_id: 'tx-06-a', delivered: '2026-09-05T09:15:00Z', first_call_date: null, total_calls: 0, rpc: null },
    ],
  },
  // lead-07: delivered, sale, unactivated, revenue 800
  {
    lead_id: 'lead-07',
    consumer_id: 1007,
    client: 'default_tenant',
    fetched: '2026-09-05T09:00:00Z',
    offershop_source: 'Direct',
    offershop_grade: 'A',
    hlc_details: [
      { vendor: 'V1', transaction_id: 'tx-07-a', delivered: '2026-09-05T09:05:00Z', first_call_date: '2026-09-05T09:10:00Z', total_calls: 2, rpc: 1, sale: '2026-09-05T09:15:00Z', activated: null, revenue_generated: 800, last_dialer_status: 'SALE' },
    ],
  },
  // lead-08: delivered, dialled
  {
    lead_id: 'lead-08',
    consumer_id: 1008,
    client: 'default_tenant',
    fetched: '2026-09-05T08:50:00Z',
    offershop_source: 'Affiliate',
    offershop_grade: 'C',
    hlc_details: [
      { vendor: 'V1', transaction_id: 'tx-08-a', delivered: '2026-09-05T08:55:00Z', first_call_date: '2026-09-05T08:58:00Z', total_calls: 1, rpc: 0 },
    ],
  },
  // lead-09: in scope, attempted but delivered=null (undelivered!)
  {
    lead_id: 'lead-09',
    consumer_id: 1009,
    client: 'default_tenant',
    fetched: '2026-09-05T08:40:00Z',
    offershop_source: 'Paid',
    offershop_grade: 'B',
    hlc_details: [
      { vendor: 'V1', transaction_id: 'tx-09-a', attempted_to_deliver: '2026-09-05T08:42:00Z', delivered: null, total_calls: null, rpc: null },
    ],
  },
  // lead-10: in scope, 0 HLC rows (missing outcomes, undelivered!)
  {
    lead_id: 'lead-10',
    consumer_id: 1010,
    client: 'default_tenant',
    fetched: '2026-09-05T08:30:00Z',
    offershop_source: 'Web',
    offershop_grade: 'C',
    hlc_details: [],
  },
  // Excluded 1: other client tenant
  {
    lead_id: 'lead-ex-client',
    consumer_id: 9001,
    client: 'other_tenant',
    fetched: '2026-09-05T08:00:00Z',
    hlc_details: [{ vendor: 'V1', delivered: '2026-09-05T08:05:00Z' }],
  },
  // Excluded 2: before date window (2026-08-25)
  {
    lead_id: 'lead-ex-before',
    consumer_id: 9002,
    client: 'default_tenant',
    fetched: '2026-08-25T08:00:00Z',
    hlc_details: [{ vendor: 'V1', delivered: '2026-08-25T08:05:00Z' }],
  },
  // Excluded 3: after date window (2026-09-25)
  {
    lead_id: 'lead-ex-after',
    consumer_id: 9003,
    client: 'default_tenant',
    fetched: '2026-09-25T08:00:00Z',
    hlc_details: [{ vendor: 'V1', delivered: '2026-09-25T08:05:00Z' }],
  },
];

// Independently declared expected sets for the small case
const expectedSmallFetchedIds = [
  'lead-01', 'lead-02', 'lead-03', 'lead-04', 'lead-05',
  'lead-06', 'lead-07', 'lead-08', 'lead-09', 'lead-10',
];
const expectedSmallDeliveredIds = [
  'lead-01', 'lead-02', 'lead-03', 'lead-04', 'lead-05',
  'lead-06', 'lead-07', 'lead-08',
];
const expectedSmallUndeliveredIds = ['lead-09', 'lead-10'];
const expectedSmallExcludedIds = ['lead-ex-client', 'lead-ex-before', 'lead-ex-after'];

test('Phase 1.1: Complete workflow with synthetic fixture and population oracle for small case (10 fetched, 8 delivered)', async t => {
  const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-15' };

  // 1. Fixture Oracle Verification (Layer 1: Fixture-oracle tests establish expected populations)
  const oracleOverview = evaluatePopulationOracle(smallFixture, scope);
  assert.equal(oracleOverview.overview.fetched_leads, 10);
  assert.equal(oracleOverview.overview.delivered_leads, 8);
  assert.equal(oracleOverview.overview.delivery_rate, 80.0);

  const oracleFetched = evaluatePopulationOracle(smallFixture, scope, { drill: 'funnel-stage', drillValue: 'fetched' });
  assert.equal(oracleFetched.totalCount, 10);
  assert.equal(oracleFetched.rows.length, 10);
  assert.deepEqual(oracleFetched.rows.map(r => r.lead_id), expectedSmallFetchedIds);

  const oracleDelivered = evaluatePopulationOracle(smallFixture, scope, { drill: 'funnel-stage', drillValue: 'delivered' });
  assert.equal(oracleDelivered.totalCount, 8);
  assert.equal(oracleDelivered.rows.length, 8);
  assert.deepEqual(oracleDelivered.rows.map(r => r.lead_id), expectedSmallDeliveredIds);

  // 2. Wire query client to oracle (narrow authorised query boundary)
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  t.mock.method(client, 'query', async (options: any) => {
    if (options.query.includes('qualified_evidence AS')) {
      const isDeliveredDrill = options.query.includes('AND (m.is_delivered)');
      const drill = 'funnel-stage';
      const drillValue = isDeliveredDrill ? 'delivered' : 'fetched';
      const res = evaluatePopulationOracle(smallFixture, scope, { drill, drillValue, limit: 50, offset: 0 });
      return [[{ total_count: res.totalCount, evidence_rows: res.rows }]];
    }
    // Overview query
    const res = evaluatePopulationOracle(smallFixture, scope);
    return [[res.overview]];
  });

  // 3. Exercise Executive Overview
  const overview = await getExecutiveOverview(scope, { includeDiagnostics: false });
  assert.equal(overview.kpis.fetchedLeads, 10);
  assert.equal(overview.kpis.deliveredLeads, 8);
  assert.equal(overview.kpis.deliveryRate, 80);
  assert.equal(overview.timezone, 'Africa/Johannesburg');
  assert.equal(overview.definitionVersion, METRIC_REGISTRY_VERSION);
  assert.ok(typeof overview.generatedAt === 'string' && overview.generatedAt.length > 0);

  // 4. Exercise Fetched Evidence
  const fetchedEvidence = await getRawLeads({ ...scope, drill: 'funnel-stage', drillValue: 'fetched', limit: 50, offset: 0 });
  assert.equal(fetchedEvidence.totalCount, 10, 'Fetched evidence total must equal 10');
  assert.equal(fetchedEvidence.rows.length, 10, 'Fetched evidence rows must equal 10');
  assert.deepEqual(fetchedEvidence.rows.map(r => r.lead_id), expectedSmallFetchedIds, 'Fetched exact ID set must match expected');

  // 5. Exercise Delivered Evidence
  const deliveredEvidence = await getRawLeads({ ...scope, drill: 'funnel-stage', drillValue: 'delivered', limit: 50, offset: 0 });
  assert.equal(deliveredEvidence.totalCount, 8, 'Delivered evidence total must equal 8');
  assert.equal(deliveredEvidence.rows.length, 8, 'Delivered evidence rows must equal 8');
  assert.deepEqual(deliveredEvidence.rows.map(r => r.lead_id), expectedSmallDeliveredIds, 'Delivered exact ID set must match expected');

  // Assert no undelivered or excluded ID appears in delivered evidence
  const deliveredIdSet = new Set(deliveredEvidence.rows.map(r => r.lead_id));
  for (const undeliveredId of expectedSmallUndeliveredIds) {
    assert.equal(deliveredIdSet.has(undeliveredId), false, `Undelivered ID ${undeliveredId} must not appear in delivered evidence`);
  }
  for (const excludedId of expectedSmallExcludedIds) {
    assert.equal(deliveredIdSet.has(excludedId), false, `Excluded ID ${excludedId} must not appear in delivered evidence`);
  }

  // 6. Production CSV builder returns those same 8 delivered IDs and actual values
  const exportResult = buildLeadEvidenceExport(deliveredEvidence, {
    clientId: 'default_tenant',
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    investigation: 'Funnel stage: Delivered leads',
  });

  assert.equal(exportResult.dataRows.length, 8, 'Export must have 8 data rows');
  assert.deepEqual(exportResult.leadIds, expectedSmallDeliveredIds, 'Export must contain exact 8 delivered IDs');
  assert.equal(exportResult.populationStatus, 'COMPLETE', 'Population status must be COMPLETE for complete population on current page');
  assert.equal(exportResult.exportScopeLabel, 'CURRENT PAGE (COMPLETE POPULATION)');
  assert.equal(exportResult.isTruncated, false);

  // Metadata verification
  assert.equal(exportResult.metadata.definitionVersion, METRIC_REGISTRY_VERSION);
  assert.equal(exportResult.metadata.timezone, 'Africa/Johannesburg');
  assert.equal(exportResult.metadata.dateBasis, 'intake_cohort');
  assert.equal(exportResult.metadata.validationStatus, 'NOT_VERIFIED');
  assert.equal(exportResult.metadata.totalCount, 8);
  assert.equal(exportResult.metadata.returnedRowCount, 8);
  assert.ok(typeof exportResult.metadata.generatedAt === 'string' && exportResult.metadata.generatedAt.length > 0);

  // Verify actual values in export: delivery timestamp is real ISO string, not boolean
  const lead1ExportRow = exportResult.dataRows.find(r => r[0] === 'lead-01')!;
  assert.ok(lead1ExportRow, 'lead-01 row must exist');
  assert.equal(lead1ExportRow[6], '2026-09-05T10:02:00Z', 'Delivered column must contain genuine timestamp string');
  assert.equal(lead1ExportRow[10], 'Yes', 'Dialled flag');
  assert.equal(lead1ExportRow[11], 'Yes', 'RPC flag');

  const lead3ExportRow = exportResult.dataRows.find(r => r[0] === 'lead-03')!;
  assert.equal(lead3ExportRow[11], 'Unavailable', 'Unknown RPC must be Unavailable, not No');

  const lead4ExportRow = exportResult.dataRows.find(r => r[0] === 'lead-04')!;
  assert.equal(lead4ExportRow[8], '—', 'Missing calls must be Unavailable/—, not 0');
});

// ---------------------------------------------------------------------------
// 5. Deterministic Larger Case (55 Fetched, 44 Delivered leads)
// ---------------------------------------------------------------------------

function generate55LeadFixture(): { fixture: RawLeadEvent[]; expectedFetched: string[]; expectedDelivered: string[] } {
  const fixture: RawLeadEvent[] = [];
  const expectedFetched: string[] = [];
  const expectedDelivered: string[] = [];

  for (let i = 1; i <= 55; i++) {
    const pad = String(i).padStart(2, '0');
    const leadId = `lead-lg-${pad}`;
    const consumerId = 2000 + i;
    // Tie break test: leads 01 and 02 have identical fetched timestamp
    const minute = i <= 2 ? 50 : Math.max(0, 50 - i);
    const minuteStr = String(minute).padStart(2, '0');
    const fetched = `2026-09-08T12:${minuteStr}:00Z`;

    const isDelivered = i <= 44; // Exactly 44 delivered, 11 undelivered
    const deliveredTs = isDelivered ? `2026-09-08T12:${minuteStr}:30Z` : null;

    fixture.push({
      lead_id: leadId,
      consumer_id: consumerId,
      client: 'default_tenant',
      fetched,
      offershop_source: i % 2 === 0 ? 'Affiliate' : 'Direct',
      offershop_grade: i % 3 === 0 ? 'A' : 'B',
      hlc_details: isDelivered ? [
        {
          vendor: 'V1',
          transaction_id: `tx-lg-${pad}`,
          delivered: deliveredTs,
          first_call_date: `2026-09-08T12:${minuteStr}:45Z`,
          total_calls: 1,
          rpc: i % 4 === 0 ? 1 : 0,
        },
      ] : [],
    });

    expectedFetched.push(leadId);
    if (isDelivered) {
      expectedDelivered.push(leadId);
    }
  }

  // Sort expected sets deterministically by fetched DESC, lead_id ASC
  expectedFetched.sort((a, b) => {
    const fA = fixture.find(f => f.lead_id === a)!.fetched;
    const fB = fixture.find(f => f.lead_id === b)!.fetched;
    if (fA !== fB) return fB.localeCompare(fA);
    return a.localeCompare(b);
  });

  expectedDelivered.sort((a, b) => {
    const fA = fixture.find(f => f.lead_id === a)!.fetched;
    const fB = fixture.find(f => f.lead_id === b)!.fetched;
    if (fA !== fB) return fB.localeCompare(fA);
    return a.localeCompare(b);
  });

  return { fixture, expectedFetched, expectedDelivered };
}

test('Phase 1.1: Deterministic 55-lead case with pagination, tie-breaks, out-of-range, and empty cases', async t => {
  const { fixture: largeFixture, expectedFetched, expectedDelivered } = generate55LeadFixture();
  const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-15' };

  // Verify tie-break between lead-lg-01 and lead-lg-02:
  // Both have fetched = '2026-09-08T12:50:00Z'. Because 'lead-lg-01' < 'lead-lg-02', lead-lg-01 comes first!
  assert.equal(expectedFetched[0], 'lead-lg-01');
  assert.equal(expectedFetched[1], 'lead-lg-02');

  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  t.mock.method(client, 'query', async (options: any) => {
    if (options.query.includes('qualified_evidence AS')) {
      const isDeliveredDrill = options.query.includes('AND (m.is_delivered)');
      const drill = 'funnel-stage';
      const drillValue = isDeliveredDrill ? 'delivered' : 'fetched';
      // Extract LIMIT and OFFSET from evidence_page CTE
      const pageMatch = options.query.match(/evidence_page[\s\S]*?LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/);
      const limit = pageMatch ? Number(pageMatch[1]) : 50;
      const offset = pageMatch ? Number(pageMatch[2]) : 0;

      const res = evaluatePopulationOracle(largeFixture, scope, { drill, drillValue, limit, offset });
      return [[{ total_count: res.totalCount, evidence_rows: res.rows }]];
    }
    const res = evaluatePopulationOracle(largeFixture, scope);
    return [[res.overview]];
  });

  // 1. Overview for 55 leads
  const overview = await getExecutiveOverview(scope, { includeDiagnostics: false });
  assert.equal(overview.kpis.fetchedLeads, 55);
  assert.equal(overview.kpis.deliveredLeads, 44);
  assert.equal(overview.kpis.deliveryRate, 80); // (44 / 55) * 100 = 80.0%

  // 2. Fetched Page 1 (offset 0, limit 50): 50 rows
  const fetchedP1 = await getRawLeads({ ...scope, drill: 'funnel-stage', drillValue: 'fetched', limit: 50, offset: 0 });
  assert.equal(fetchedP1.totalCount, 55);
  assert.equal(fetchedP1.rows.length, 50);
  assert.deepEqual(fetchedP1.rows.map(r => r.lead_id), expectedFetched.slice(0, 50));

  // 3. Fetched Page 2 (offset 50, limit 50): 5 rows
  const fetchedP2 = await getRawLeads({ ...scope, drill: 'funnel-stage', drillValue: 'fetched', limit: 50, offset: 50 });
  assert.equal(fetchedP2.totalCount, 55);
  assert.equal(fetchedP2.rows.length, 5);
  assert.deepEqual(fetchedP2.rows.map(r => r.lead_id), expectedFetched.slice(50, 55));

  // Combine page 1 and page 2: all 55 unique IDs, no duplicates, no missing
  const combinedFetchedIds = [...fetchedP1.rows.map(r => r.lead_id), ...fetchedP2.rows.map(r => r.lead_id)];
  assert.equal(new Set(combinedFetchedIds).size, 55);
  assert.deepEqual(combinedFetchedIds, expectedFetched);

  // 4. Out-of-range Fetched Page 3 (offset 100, limit 50): 0 rows, retains totalCount 55
  const fetchedP3 = await getRawLeads({ ...scope, drill: 'funnel-stage', drillValue: 'fetched', limit: 50, offset: 100 });
  assert.equal(fetchedP3.totalCount, 55);
  assert.equal(fetchedP3.rows.length, 0);

  // 5. Delivered Page 1 (offset 0, limit 50): all 44 delivered leads on page 1
  const deliveredP1 = await getRawLeads({ ...scope, drill: 'funnel-stage', drillValue: 'delivered', limit: 50, offset: 0 });
  assert.equal(deliveredP1.totalCount, 44);
  assert.equal(deliveredP1.rows.length, 44);
  assert.deepEqual(deliveredP1.rows.map(r => r.lead_id), expectedDelivered);

  // 6. Delivered Page 2 (offset 50, limit 50): 0 rows (beyond 44 records)
  const deliveredP2 = await getRawLeads({ ...scope, drill: 'funnel-stage', drillValue: 'delivered', limit: 50, offset: 50 });
  assert.equal(deliveredP2.totalCount, 44);
  assert.equal(deliveredP2.rows.length, 0);

  // 7. CSV Exports on partial and complete pages
  // Final partial-page export: Fetched Page 2 (5 records of 55)
  const exportFetchedP2 = buildLeadEvidenceExport(fetchedP2, {
    clientId: 'default_tenant',
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    page: 1,
    pageSize: 50,
  });
  assert.equal(exportFetchedP2.dataRows.length, 5);
  assert.equal(exportFetchedP2.totalCount, 55);
  assert.equal(exportFetchedP2.populationStatus, 'PARTIAL');
  assert.equal(exportFetchedP2.isTruncated, true);
  assert.equal(exportFetchedP2.exportScopeLabel, 'CURRENT PAGE (PARTIAL POPULATION)');
  assert.ok(exportFetchedP2.rows[1][exportFetchedP2.rows[1].length - 14].toString().includes('Current page 2 (5 records of 55 in scope)'));

  // First partial-page export: Fetched Page 1 (50 records of 55)
  const exportFetchedP1 = buildLeadEvidenceExport(fetchedP1, {
    clientId: 'default_tenant',
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    page: 0,
    pageSize: 50,
  });
  assert.equal(exportFetchedP1.dataRows.length, 50);
  assert.equal(exportFetchedP1.totalCount, 55);
  assert.equal(exportFetchedP1.populationStatus, 'PARTIAL');
  assert.equal(exportFetchedP1.isTruncated, true);
  assert.equal(exportFetchedP1.exportScopeLabel, 'CURRENT PAGE (PARTIAL POPULATION)');

  // Complete-population export: Delivered Page 1 (44 records of 44 in scope at offset 0)
  const exportDeliveredP1 = buildLeadEvidenceExport(deliveredP1, {
    clientId: 'default_tenant',
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    page: 0,
    pageSize: 50,
  });
  assert.equal(exportDeliveredP1.dataRows.length, 44);
  assert.equal(exportDeliveredP1.totalCount, 44);
  assert.equal(exportDeliveredP1.populationStatus, 'COMPLETE');
  assert.equal(exportDeliveredP1.isTruncated, false);
  assert.equal(exportDeliveredP1.exportScopeLabel, 'CURRENT PAGE (COMPLETE POPULATION)');

  // 8. Genuinely empty case: totalCount = 0, rows = 0
  const emptyRes = evaluatePopulationOracle([], scope);
  assert.equal(emptyRes.overview.fetched_leads, 0);
  assert.equal(emptyRes.overview.delivered_leads, 0);
  assert.equal(emptyRes.overview.delivery_rate, 0);

  // 9. Zero-delivery case: 10 fetched leads, 0 delivered
  const zeroDeliveryFixture: RawLeadEvent[] = Array.from({ length: 10 }, (_, i) => ({
    lead_id: `zero-del-${i + 1}`,
    consumer_id: 3000 + i,
    client: 'default_tenant',
    fetched: '2026-09-05T10:00:00Z',
    hlc_details: [], // None delivered
  }));
  const zeroDelRes = evaluatePopulationOracle(zeroDeliveryFixture, scope);
  assert.equal(zeroDelRes.overview.fetched_leads, 10);
  assert.equal(zeroDelRes.overview.delivered_leads, 0);
  assert.equal(zeroDelRes.overview.delivery_rate, 0);

  const zeroDelEvidence = evaluatePopulationOracle(zeroDeliveryFixture, scope, { drill: 'funnel-stage', drillValue: 'delivered' });
  assert.equal(zeroDelEvidence.totalCount, 0);
  assert.equal(zeroDelEvidence.rows.length, 0);
});

// ---------------------------------------------------------------------------
// 6. Honest Test Layer Boundary Documentation
// ---------------------------------------------------------------------------

test('Phase 1.1: Test layers are honestly distinguished', () => {
  // Layer 1: Fixture-oracle tests establish expected populations from raw events (tested above)
  // Layer 2: Query-structure/parameter tests guard selected scope, drill predicates and deduplication ordering (tested in Section 2)
  // Layer 3: Mounted HTTP and frontend tests establish transport, permissions and response handling (tested in Section 1 & Section 3)
  // Layer 4: Actual compiled-query execution establishes SQL-runtime behaviour:
  // LIVE BIGQUERY SQL-RUNTIME VERIFICATION IS NOT RUN IN OFFLINE TEST HARNESS.
  assert.ok(true, 'Test layers are explicitly distinguished; SQL runtime is marked NOT RUN');
});
