import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsRouter } from '../server/api';
import { requireAdmin } from '../server/security';

// Dispatch the registered synchronous endpoint without opening a network socket.
// This checks the actual response envelope, including metadata omitted by service tests.
test('validation endpoint identifies reference provenance and keeps selected scope separate from measured evidence', () => {
  const route = analyticsRouter.stack.find(layer => layer.route?.path === '/validation')!.route;
  assert.equal(route.stack[0].handle, requireAdmin);
  let response: any;
  const scope = { clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-30', filters: { vendor: { operator: 'in', values: ['A'] } } };
  route.stack.at(-1).handle({}, { locals: { scope }, json(body: unknown) { response = body; } });
  assert.equal(response.success, true);
  assert.equal(response.metadata.validationStatus, 'NOT_VERIFIED');
  assert.equal(response.metadata.evidenceKind, 'HISTORICAL_REFERENCE');
  assert.equal(response.metadata.dataAsOf, null);
  assert.deepEqual(response.metadata.source, { type: 'historical_reference', liveWarehouseRead: false });
  assert.deepEqual(response.metadata.requestScope, { clientId: scope.clientId, startDate: scope.startDate, endDate: scope.endDate, appliedFilters: scope.filters });
  for (const key of ['clientId', 'clientName', 'startDate', 'endDate', 'appliedFilters', 'dateBasis', 'sourceDependencies']) {
    assert.equal(response.metadata[key], undefined, `${key} must not imply the reference was measured for this request`);
  }
  assert.equal(response.data.tenant, null);
  assert.equal(response.data.verifiedAt, null);
  assert.equal(response.data.reconciledAt, null);
  assert.equal(response.data.currentWarehouseEvidenceStatus, 'UNAVAILABLE');
  assert.ok(response.data.metrics.every((metric: any) => metric.status === 'NOT_VERIFIED'));
});
