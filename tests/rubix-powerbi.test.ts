import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import {
  RUBIX_POWERBI_VERSION,
  RUBIX_QUERY_TYPES,
  RUBIX_DATASET_ID,
  RUBIX_REPORT_ID,
  RUBIX_MODEL_ID,
  RUBIX_ENTITY,
  RUBIX_COMPANY_PREDICATE,
} from '../contracts/rubixPowerBi';
import { createRubixPowerBiRouter } from '../server/blc/powerbi/router';
import { RubixPowerBiService } from '../server/blc/powerbi/service';

test('Rubix PowerBI contracts expose expected constants', () => {
  assert.equal(RUBIX_POWERBI_VERSION, '2026-09-29.2');
  assert.equal(RUBIX_QUERY_TYPES.length, 8);
  assert.ok(RUBIX_QUERY_TYPES.includes('activation_over_time'));
  assert.ok(RUBIX_QUERY_TYPES.includes('capture_complete_by_agent_and_team'));
  assert.equal(RUBIX_DATASET_ID, '59cef14d-8dd0-4016-a349-c227162a0fee');
  assert.equal(RUBIX_REPORT_ID, 'fe973424-23fd-433a-a81f-0f08416228ef');
  assert.equal(RUBIX_MODEL_ID, 598641);
  assert.equal(RUBIX_ENTITY, 'blue_label_reporting wow_data');
  assert.equal(RUBIX_COMPANY_PREDICATE, 'ONtact');
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

    // 6. Report Query: activation_by_team
    const repRes = await fetch(`${baseUrl}/report?queryType=activation_by_team`);
    assert.equal(repRes.status, 200);
    const repBody = await repRes.json();
    assert.equal(repBody.success, true);
    assert.equal(repBody.data.metadata.queryType, 'activation_by_team');
    assert.equal(repBody.data.metadata.appliedScope.companyFilter, 'ONtact');
    assert.equal(repBody.data.rows.length, 0);
    assert.equal(repBody.data.summary.totalCount, null);
    assert.equal(repBody.data.summary.distinctTeams, null);
    assert.equal(repBody.data.metadata.queryStatus, 'DISABLED');

    // 7. Report Query: Staff Privacy Masking for Viewers
    principalOverride = { subject: 'viewer1', tenants: ['blc'], role: 'viewer' };
    const staffViewerRes = await fetch(`${baseUrl}/report?queryType=activation_by_agent_and_team`);
    assert.equal(staffViewerRes.status, 200);
    const staffViewerBody = await staffViewerRes.json();
    assert.deepEqual(staffViewerBody.data.rows, []);
    assert.equal(staffViewerBody.data.metadata.provenance, 'UNAVAILABLE');

    // 8. Report Query: Staff Details Unmasked for Admins
    principalOverride = { subject: 'admin1', tenants: ['blc'], role: 'admin' };
    const staffAdminRes = await fetch(`${baseUrl}/report?queryType=activation_by_agent_and_team`);
    assert.equal(staffAdminRes.status, 200);
    const staffAdminBody = await staffAdminRes.json();
    assert.deepEqual(staffAdminBody.data.rows, []);
    assert.equal(staffAdminBody.data.metadata.provenance, 'UNAVAILABLE');

    // 9. Unsupported Filter Detection
    scopeOverride = {
      clientId: 'blc',
      startDate: '2026-09-01',
      endDate: '2026-09-02',
      filters: { vendor: 'MTN', campaign: 'BlueSpring' },
    };
    const unsuppRes = await fetch(`${baseUrl}/report?queryType=activation_by_team`);
    assert.equal(unsuppRes.status, 200);
    const unsuppBody = await unsuppRes.json();
    assert.equal(unsuppBody.data.metadata.queryStatus, 'UNSUPPORTED_FILTER');
    assert.ok(unsuppBody.data.metadata.warnings[0].includes('vendor'));

    // 10. Cross-Source Reconciliation Endpoint
    scopeOverride = { clientId: 'blc', startDate: '2026-09-01', endDate: '2026-09-02', filters: {} };
    const reconRes = await fetch(`${baseUrl}/reconciliation`);
    assert.equal(reconRes.status, 200);
    const reconBody = await reconRes.json();
    assert.equal(reconBody.success, true);
    assert.equal(reconBody.data.reconciliationStatus, 'UNVERIFIED');
    assert.equal(reconBody.data.warehouseActivations.verifiedMandates, null);
    assert.equal(reconBody.data.powerBiActivations.totalReported, null);
    assert.equal(reconBody.data.variance.deltaCount, null);
    assert.ok(reconBody.data.variance.explanation.includes('cannot be inferred'));
    assert.ok(reconBody.data.variance.reconciliationNotes.length >= 4);
  } finally {
    server.close();
  }
});
