import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import {
  RUBIX_POWERBI_VERSION,
  RUBIX_QUERY_TYPES,
} from '../contracts/rubixPowerBi';
import { createRubixPowerBiRouter } from '../server/blc/powerbi/router';
import { RubixPowerBiService } from '../server/blc/powerbi/service';

test('Rubix PowerBI contracts expose expected constants', () => {
  assert.equal(RUBIX_POWERBI_VERSION, '2026-09-27.1');
  assert.equal(RUBIX_QUERY_TYPES.length, 8);
  assert.ok(RUBIX_QUERY_TYPES.includes('activation_over_time'));
  assert.ok(RUBIX_QUERY_TYPES.includes('capture_complete_by_agent_and_team'));
});

test('Rubix PowerBI router requires authentication and authorized tenant scope', async () => {
  const service = new RubixPowerBiService();
  const router = createRubixPowerBiRouter(service);
  const app = express();
  app.use(express.json());

  // Mount with mock middleware that injects test credentials
  let principalOverride: any = null;
  let scopeOverride: any = null;

  app.use((_req, res, next) => {
    if (principalOverride) res.locals.principal = principalOverride;
    if (scopeOverride) res.locals.scope = scopeOverride;
    next();
  });

  app.use('/powerbi', router);

  // Error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status || err.statusCode || 500).json({ error: err.message });
  });

  const server = app.listen(0);
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/powerbi`;

  try {
    // 1. Unauthenticated -> 401
    const unauthRes = await fetch(`${baseUrl}/status`);
    assert.equal(unauthRes.status, 401);

    // 2. Authenticated but missing scope -> 400
    principalOverride = { subject: 'user1', tenants: ['blc'], role: 'admin' };
    const noScopeRes = await fetch(`${baseUrl}/status`);
    assert.equal(noScopeRes.status, 400);

    // 3. Unauthorized tenant -> 403
    scopeOverride = { clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-02', filters: {} };
    const wrongTenantRes = await fetch(`${baseUrl}/status`);
    assert.equal(wrongTenantRes.status, 403);

    // 4. Authorized tenant -> 200
    principalOverride = { subject: 'user1', tenants: ['blc'], role: 'admin' };
    scopeOverride = { clientId: 'blc', startDate: '2026-09-01', endDate: '2026-09-02', filters: {} };
    const statusRes = await fetch(`${baseUrl}/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.success, true);
    assert.equal(statusBody.data.provider, 'rubix_powerbi');

    // 5. Capabilities -> 200 with query definitions
    const capRes = await fetch(`${baseUrl}/capabilities`);
    assert.equal(capRes.status, 200);
    const capBody = await capRes.json();
    assert.equal(capBody.success, true);
    assert.equal(capBody.data.capabilities.length, 10);
    assert.ok(capBody.data.supportedFilters.includes('team'));
    assert.ok(capBody.data.unsupportedFilters.includes('vendor'));
  } finally {
    server.close();
  }
});
