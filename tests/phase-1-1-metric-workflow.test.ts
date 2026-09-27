import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { analyticsRouter } from '../server/api';
import { fetchAuthoritativeMetrics } from '../src/lib/offernetClient';
import { getRawLeads } from '../server/analytics/investigation/records';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';

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

test('Phase 1.1: fetchAuthoritativeMetrics preserves envelope with version, count and metrics dictionary', async () => {
  const app = createTestApiApp('admin', 'default_tenant');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;

  try {
    const res = await fetchAuthoritativeMetrics({ baseUrl: `http://127.0.0.1:${port}` });
    assert.equal(res.success, true);
    assert.equal(res.version, 'cx.metric.2.0.0');
    assert.equal(res.totalMetrics, 15);
    assert.ok(res.data);
    assert.equal(Object.keys(res.data).length, 15);
    assert.ok(res.data.fetched_leads);
    assert.ok(res.data.delivered_leads);
    assert.ok(res.data.delivery_rate);
    assert.ok(res.data.sales_per_fetched_rate);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('Phase 1.1: getRawLeads computes totalCount independent of pagination slice', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  const queries: any[] = [];
  t.mock.method(client, 'query', async (options: any) => {
    queries.push(options);
    // Simulate 3 matching rows returned in a slice of limit 2 with full count of 142
    return [[
      { lead_id: 'lead-1', full_evidence_total: 142, consumer_id: 101 },
      { lead_id: 'lead-2', full_evidence_total: 142, consumer_id: 102 },
    ]];
  });

  const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-15', limit: 15, offset: 0 };
  const result = await getRawLeads(scope);

  assert.equal(result.rows.length, 2);
  assert.equal(result.totalCount, 142);
  assert.equal(result.limit, 15);
  assert.equal(result.offset, 0);

  // Verify full_evidence_total is stripped from user-facing row items
  assert.equal(result.rows[0].full_evidence_total, undefined);
  assert.equal(result.rows[0].lead_id, 'lead-1');

  // Verify the SQL contains COUNT(*) OVER()
  assert.ok(queries[0].query.includes('COUNT(*) OVER() as full_evidence_total'));
});

test('Phase 1.1: getRawLeads constructs verified funnel-stage predicates for Fetched and Delivered', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  const queries: any[] = [];
  t.mock.method(client, 'query', async (options: any) => {
    queries.push(options);
    return [[]];
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

  // 4. RPC funnel stage
  await getRawLeads({ ...baseScope, drill: 'funnel-stage', drillValue: 'rpc' });
  assert.ok(queries.at(-1).query.includes('AND (m.is_rpc)'), 'RPC stage filters to RPC leads');

  // 5. Sales funnel stage
  await getRawLeads({ ...baseScope, drill: 'funnel-stage', drillValue: 'sales' });
  assert.ok(queries.at(-1).query.includes('AND (m.is_sale)'), 'Sales stage filters to sale leads');
});
