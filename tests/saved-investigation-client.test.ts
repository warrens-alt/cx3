import test from 'node:test';
import assert from 'node:assert/strict';
import { createSavedInvestigation, updateSavedInvestigation, deleteSavedInvestigation, listSavedInvestigations, savedInvestigationDraftFromDefinition } from '../src/lib/savedInvestigations';
import { SAVED_INVESTIGATION_VERSION, type SavedInvestigationDraft, type SavedInvestigationDefinition } from '../contracts/savedAnalysis';
import { updateAnalyticalSession, _resetAnalyticalSessionForTesting } from '../src/lib/analyticalSession';

const identity = { uid: 'owner-a', role: 'viewer', status: 'active', allowedTenants: ['tenant-a', 'tenant-b'], isAdmin: false, isActive: true };
const draft = (): SavedInvestigationDraft => ({ version: SAVED_INVESTIGATION_VERSION, report: 'investigation', name: 'Awaiting first dial', scope: { tenantId: 'tenant-a', startDate: null, endDate: '2026-09-30', dateBasis: 'intake_cohort', countingGrain: 'lead', filters: { vendor: { operator: 'equals', value: 'Vendor A' } } }, investigation: { drill: 'awaiting-first-dial', segmentSource: 'Paid:Social' }, release: { mode: 'current_observations', releaseId: null } });
const definition = (input = draft()): SavedInvestigationDefinition => ({ ...input, id: 'saved-1', ownerSubject: 'owner-a', createdAt: '2026-10-02T08:00:00.000Z', updatedAt: '2026-10-02T08:00:00.000Z', revision: 1 });
const response = (data: unknown) => Response.json({ success: true, data });
const mismatch = { name: 'ApiRequestError', status: 502, code: 'SAVED_DEFINITION_MISMATCH' };

test.beforeEach(() => { _resetAnalyticalSessionForTesting(); updateAnalyticalSession(identity); });
test.afterEach(() => { _resetAnalyticalSessionForTesting(); });

test('create posts only a validated definition snapshot and does not serialize mutable later UI changes', async t => {
  let complete!: (value: Response) => void;
  let request: { path: string; options: RequestInit } | undefined;
  t.mock.method(globalThis, 'fetch', (path, options) => { request = { path: String(path), options: options! }; return new Promise<Response>(resolve => { complete = resolve; }); });
  const input = draft(), expected = structuredClone(input);
  const pending = createSavedInvestigation(input);
  input.scope.filters.vendor!.value = 'Other workspace selection'; input.name = 'Changed while pending';
  complete(response(definition(expected)));
  const saved = await pending;
  assert.equal(request!.path, '/api/saved-analyses');
  assert.equal(request!.options.method, 'POST'); assert.equal(request!.options.credentials, 'same-origin'); assert.equal(request!.options.cache, 'no-store');
  assert.deepEqual(JSON.parse(String(request!.options.body)), { clientId: 'tenant-a', definition: expected });
  assert.deepEqual(savedInvestigationDraftFromDefinition(saved), expected);
  assert.deepEqual(Object.keys(JSON.parse(String(request!.options.body)).definition).sort(), ['investigation', 'name', 'release', 'report', 'scope', 'version']);
});

test('invalid or private drafts and cross-tenant updates issue no storage request', async t => {
  const requests: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (...args) => { requests.push(args); return response(definition()); });
  const invalid = [
    { ...draft(), search: 'PRIVATE' },
    { ...draft(), ownerSubject: 'other-owner' },
    { ...draft(), scope: { ...draft().scope, filters: { lead_id: { operator: 'equals', value: 'PRIVATE' } } } },
    { ...draft(), scope: { ...draft().scope, tenantId: '' } },
    { ...draft(), scope: { ...draft().scope, filters: { vendor: { operator: 'equals', value: 'A', records: ['PRIVATE'] } } } },
  ];
  for (const input of invalid) await assert.rejects(createSavedInvestigation(input as SavedInvestigationDraft));
  await assert.rejects(updateSavedInvestigation(definition(), { ...draft(), scope: { ...draft().scope, tenantId: 'tenant-b' } }), /different workspace/);
  await assert.rejects(deleteSavedInvestigation({ ...definition(), revision: 0 }));
  await assert.rejects(listSavedInvestigations(''));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createSavedInvestigation(draft(), controller.signal), { name: 'AbortError' });
  assert.equal(requests.length, 0);
});

test('create refuses a response that changes the saved population or initial revision', async t => {
  let returned: unknown;
  t.mock.method(globalThis, 'fetch', async () => response(returned));
  for (const mutate of [
    (value: SavedInvestigationDefinition) => { value.scope.tenantId = 'tenant-b'; },
    (value: SavedInvestigationDefinition) => { value.scope.startDate = '2026-09-01'; },
    (value: SavedInvestigationDefinition) => { value.scope.filters = {}; },
    (value: SavedInvestigationDefinition) => { delete value.investigation.segmentSource; },
    (value: SavedInvestigationDefinition) => { value.investigation.drill = 'one-call-only'; },
    (value: SavedInvestigationDefinition) => { value.revision = 2; },
  ]) {
    const candidate = definition(); mutate(candidate); returned = candidate;
    await assert.rejects(createSavedInvestigation(draft()), mismatch);
  }
});

test('update binds owner, identifier, original creation time and next revision to the submitted definition', async t => {
  const old = definition();
  const input = { ...draft(), name: 'Renamed investigation' };
  const valid = { ...definition(input), updatedAt: '2026-10-02T09:00:00.000Z', revision: 2 };
  let returned: unknown = valid;
  let captured: { path: string; body: unknown } | undefined;
  t.mock.method(globalThis, 'fetch', async (path, init) => { captured = { path: String(path), body: JSON.parse(String(init?.body)) }; return response(returned); });
  assert.deepEqual(await updateSavedInvestigation(old, input), valid);
  assert.equal(captured!.path, '/api/saved-analyses/saved-1');
  assert.deepEqual(captured!.body, { clientId: 'tenant-a', definition: input, revision: 1 });
  for (const change of [
    { id: 'other-id' }, { ownerSubject: 'another-owner' }, { createdAt: '2026-10-02T07:00:00.000Z' }, { revision: 1 }, { revision: 3 }, { name: 'Unrequested name' },
  ]) { returned = { ...valid, ...change }; await assert.rejects(updateSavedInvestigation(old, input), mismatch); }
});

test('lists fail closed for foreign tenants, duplicate definitions, mixed ownership or partial invalid schema', async t => {
  let data: unknown;
  t.mock.method(globalThis, 'fetch', async () => response(data));
  const a = definition(), b = { ...definition(), id: 'saved-2' };
  data = { configured: true, definitions: [a, b], limit: 50 };
  assert.deepEqual((await listSavedInvestigations('tenant-a')).definitions, [a, b]);
  for (const invalid of [
    { configured: true, definitions: [{ ...a, scope: { ...a.scope, tenantId: 'tenant-b' } }], limit: 50 },
    { configured: true, definitions: [a, a], limit: 50 },
    { configured: true, definitions: [a, { ...b, ownerSubject: 'someone-else' }], limit: 50 },
    { configured: true, definitions: [a, { ...b, search: 'PRIVATE' }], limit: 50 },
    { configured: false, definitions: [a], limit: 50 },
    { configured: true, definitions: [a, b], limit: 1 },
    { configured: true, definitions: [], limit: 0 },
  ]) { data = invalid; await assert.rejects(listSavedInvestigations('tenant-a'), mismatch); }
  data = { configured: false, definitions: [], limit: 50 };
  assert.deepEqual(await listSavedInvestigations('tenant-a'), data);
});

test('delete sends the exact tenant and revision and requires affirmative completion', async t => {
  let captured: { path: string; method: string | undefined } | undefined;
  let data: unknown = { deleted: true };
  t.mock.method(globalThis, 'fetch', async (path, init) => { captured = { path: String(path), method: init?.method }; return response(data); });
  await deleteSavedInvestigation(definition());
  assert.equal(captured!.path, '/api/saved-analyses/saved-1?clientId=tenant-a&revision=1'); assert.equal(captured!.method, 'DELETE');
  for (const invalid of [{}, { deleted: false }, { deleted: 'true' }]) { data = invalid; await assert.rejects(deleteSavedInvestigation(definition()), mismatch); }
});

test('late list, create, update and delete responses cannot succeed after an analytical identity boundary changes', async t => {
  let complete!: (value: Response) => void;
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>(resolve => { complete = resolve; }));
  const calls: Array<[() => Promise<unknown>, unknown]> = [
    [() => listSavedInvestigations('tenant-a'), { configured: true, definitions: [definition()], limit: 50 }],
    [() => createSavedInvestigation(draft()), definition()],
    [() => updateSavedInvestigation(definition(), draft()), { ...definition(), revision: 2 }],
    [() => deleteSavedInvestigation(definition()), { deleted: true }],
  ];
  for (const [call, data] of calls) {
    updateAnalyticalSession(identity);
    const pending = call();
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    updateAnalyticalSession({ ...identity, uid: 'owner-b' });
    complete(response(data)); await rejected;
  }
});

test('revocation and scope-request cancellation suppress late responses even when fetch ignores cancellation', async t => {
  let complete!: (value: Response) => void;
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>(resolve => { complete = resolve; }));
  const controller = new AbortController();
  const pending = listSavedInvestigations('tenant-a', controller.signal);
  const cancelled = assert.rejects(pending, { name: 'AbortError' });
  controller.abort(); complete(response({ configured: true, definitions: [definition()], limit: 50 })); await cancelled;
  const revoked = listSavedInvestigations('tenant-a');
  const denied = assert.rejects(revoked, { name: 'AbortError' });
  updateAnalyticalSession({ ...identity, allowedTenants: ['tenant-b'] });
  complete(response({ configured: true, definitions: [definition()], limit: 50 })); await denied;
});

test('HTTP authorization and revision conflicts remain errors after a previous successful read', async t => {
  let status = 200;
  t.mock.method(globalThis, 'fetch', async () => status === 200 ? response({ configured: true, definitions: [definition()], limit: 50 }) : Response.json({ success: false, error: status === 403 ? 'Tenant access denied' : 'Definition changed' }, { status, headers: { 'x-request-id': 'saved-request-1' } }));
  assert.equal((await listSavedInvestigations('tenant-a')).definitions.length, 1);
  status = 403; await assert.rejects(listSavedInvestigations('tenant-a'), { name: 'ApiRequestError', status: 403, requestId: 'saved-request-1' });
  status = 409; await assert.rejects(updateSavedInvestigation(definition(), draft()), { name: 'ApiRequestError', status: 409 });
});

test('malformed response envelopes and unsuccessful HTTP-200 bodies fail with typed API errors', async t => {
  let body: unknown;
  t.mock.method(globalThis, 'fetch', async () => Response.json(body));
  for (const malformed of [null, [], true, 'not an envelope']) {
    body = malformed;
    await assert.rejects(listSavedInvestigations('tenant-a'), mismatch);
  }
  body = { success: false, error: 'Storage did not confirm success' };
  await assert.rejects(listSavedInvestigations('tenant-a'), { name: 'ApiRequestError', status: 502 });
});
