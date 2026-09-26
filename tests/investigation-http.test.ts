import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { analyticsRouter } from '../server/api';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';

test('HTTP exceptions preserve supported scope while record access and tenant scope remain administrator governed', async t => {
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  const queries: any[] = [];
  t.mock.method(client, 'query', async options => { queries.push(options); return [[]]; });
  const app = express();
  app.use((_req, res, next) => { res.locals.principal = { subject: 'exception-viewer', role: 'viewer', tenants: ['default_tenant'] }; next(); });
  app.use('/api/analytics', analyticsRouter);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/analytics`;
    const params = new URLSearchParams({ clientId: 'default_tenant', startDate: '2026-09-08', endDate: '2026-09-14', vendor: 'MTN', source: 'web' });
    const response = await fetch(`${base}/offernet/exceptions?${params}`);
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.metadata.validationStatus, 'NOT_VERIFIED');
    assert.equal(body.metadata.dateBasis, 'lead_capture_cohort');
    assert.equal(body.data.exceptions.length, 13);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].params.vendor, 'MTN');
    assert.equal(queries[0].params.source, 'web');
    assert.equal(queries[0].params.startDate, '2026-09-01');
    assert.equal(queries[0].params.currentStartDate, '2026-09-08');
    for (const path of ['raw-leads', 'lead-timeline/L']) assert.equal((await fetch(`${base}/offernet/${path}?${params}`)).status, 403);
    assert.equal((await fetch(`${base}/offernet/exceptions?clientId=mtn`)).status, 403);
    params.set('campaign', 'unsupported');
    assert.equal((await fetch(`${base}/offernet/exceptions?${params}`)).status, 422);
    assert.equal(queries.length, 1, 'Denied requests must not query warehouse sources');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
