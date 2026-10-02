import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createSavedInvestigationRouter } from '../server/savedAnalyses/router';
import { apiErrorHandler } from '../server/apiErrors';
import { sameOriginRequests } from '../server/httpGuards';
import { type Principal } from '../server/securityPolicy';
import { type SavedInvestigationBackend } from '../server/savedAnalyses/repository';
import { savedDraft, TestSavedBackend } from './helpers/savedInvestigations';

const viewer: Principal = { subject: 'owner-a', email: 'synthetic@example.invalid', tenants: ['tenant_a', 'tenant_b'], role: 'viewer' };
async function withApp(principal: Principal | null, backend: SavedInvestigationBackend | null, run: (base: string, configurationReads: () => number) => Promise<void>) {
  const app = express(); let configurationReads = 0;
  app.use(express.json({ limit: '64kb' }));
  app.use((_req, res, next) => { if (principal) res.locals.principal = principal; next(); });
  app.use(sameOriginRequests());
  app.use('/api/saved-analyses', createSavedInvestigationRouter(() => { configurationReads++; return backend; }));
  app.use(apiErrorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test address');
  try { await run(`http://127.0.0.1:${address.port}/api/saved-analyses`, () => configurationReads); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
const send = (url: string, method: string, body: unknown, headers = {}) => fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('authentication and tenant gates run before storage resolution for reads and writes', async () => {
  for (const principal of [null, { ...viewer, tenants: ['tenant_b'] }]) {
    const backend = new TestSavedBackend();
    await withApp(principal, backend, async (base, resolutions) => {
      const read = await fetch(`${base}?clientId=tenant_a`);
      assert.equal(read.status, principal ? 403 : 401);
      const write = await send(base, 'POST', { clientId: 'tenant_a', definition: savedDraft() });
      assert.equal(write.status, principal ? 403 : 401);
      assert.equal(resolutions(), 0);
    });
    assert.equal(backend.reads, 0); assert.equal(backend.writes, 0);
  }
});

test('missing, duplicate, mismatched and private request fields are rejected before storage resolution', async () => {
  const backend = new TestSavedBackend();
  await withApp(viewer, backend, async (base, resolutions) => {
    for (const query of ['', '?clientId=tenant_a&clientId=tenant_a', '?clientId=tenant_a&ownerSubject=other', '?clientId=tenant_a&search=private']) {
      assert.ok((await fetch(`${base}${query}`)).status >= 400);
    }
    for (const [query, body] of [
      ['?clientId=tenant_b', { clientId: 'tenant_a', definition: savedDraft() }],
      ['', { clientId: 'tenant_a', ownerSubject: 'other', definition: savedDraft() }],
      ['', { clientId: 'tenant_a', definition: savedDraft('tenant_b') }],
      ['', { clientId: 'tenant_a', definition: { ...savedDraft(), leadId: 'private' } }],
      ['', { clientId: 'tenant_a', definition: { ...savedDraft(), investigation: { search: 'private' } } }],
    ] as const) assert.ok((await send(`${base}${query}`, 'POST', body)).status >= 400);
    assert.equal((await fetch(`${base}?clientId=tenant_a`, { headers: { 'X-Client-Id': 'tenant_b' } })).status, 422);
    assert.equal((await send(base, 'POST', { clientId: 'tenant_a', definition: savedDraft() }, { 'X-Client-Id': 'tenant_b' })).status, 422);
    assert.equal((await fetch(base, { headers: { 'X-Client-Id': 'tenant_a' } })).status, 400);
    assert.equal(resolutions(), 0);
  });
  assert.equal(backend.reads, 0);
});

test('unconfigured storage reports unavailable and never accepts a mutation', async () => {
  await withApp(viewer, null, async base => {
    const list = await fetch(`${base}?clientId=tenant_a`);
    assert.equal(list.status, 200); assert.equal(list.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual((await list.json()).data, { configured: false, definitions: [], limit: 100 });
    const created = await send(base, 'POST', { clientId: 'tenant_a', definition: savedDraft() });
    assert.equal(created.status, 503); assert.equal((await created.json()).code, 'SAVED_STORAGE_NOT_CONFIGURED');
  });
});

test('viewer personal CRUD persists between routers and revision conflicts protect updates/deletes', async () => {
  const backend = new TestSavedBackend(); let original: any;
  await withApp(viewer, backend, async base => {
    const response = await send(base, 'POST', { clientId: 'tenant_a', definition: savedDraft() });
    assert.equal(response.status, 201); original = (await response.json()).data;
    assert.equal(original.ownerSubject, viewer.subject);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  });
  await withApp(viewer, backend, async base => {
    const listed = (await (await fetch(`${base}?clientId=tenant_a`)).json()).data;
    assert.equal(listed.configured, true); assert.deepEqual(listed.definitions, [original]);
    const changed = await send(`${base}/${original.id}`, 'PUT', { clientId: 'tenant_a', revision: 1, definition: savedDraft('tenant_a', 'Updated') });
    assert.equal(changed.status, 200); assert.equal((await changed.json()).data.revision, 2);
    const stale = await send(`${base}/${original.id}`, 'PUT', { clientId: 'tenant_a', revision: 1, definition: savedDraft() });
    assert.equal(stale.status, 409);
    assert.equal((await fetch(`${base}/${original.id}?clientId=tenant_a&revision=1`, { method: 'DELETE' })).status, 409);
    assert.equal((await fetch(`${base}/${original.id}?clientId=tenant_a&revision=2&revision=2`, { method: 'DELETE' })).status, 400);
    assert.equal((await fetch(`${base}/${original.id}?clientId=tenant_a&revision=2`, { method: 'DELETE' })).status, 200);
    assert.deepEqual((await (await fetch(`${base}?clientId=tenant_a`)).json()).data.definitions, []);
  });
});

test('another owner or authorized tenant cannot update or delete an existing ID', async () => {
  const backend = new TestSavedBackend(); let id: string;
  await withApp(viewer, backend, async base => { id = (await (await send(base, 'POST', { clientId: 'tenant_a', definition: savedDraft() })).json()).data.id; });
  for (const [principal, tenant] of [[{ ...viewer, subject: 'owner-b' }, 'tenant_a'], [viewer, 'tenant_b']] as const) {
    await withApp(principal, backend, async base => {
      assert.deepEqual((await (await fetch(`${base}?clientId=${tenant}`)).json()).data.definitions, []);
      assert.equal((await send(`${base}/${id}`, 'PUT', { clientId: tenant, revision: 1, definition: savedDraft(tenant) })).status, 404);
      assert.equal((await fetch(`${base}/${id}?clientId=${tenant}&revision=1`, { method: 'DELETE' })).status, 404);
    });
  }
  assert.equal(backend.writes, 1);
});

test('cross-site mutation is rejected by the existing API origin policy before storage access', async () => {
  const backend = new TestSavedBackend();
  await withApp(viewer, backend, async (base, resolutions) => {
    const response = await send(base, 'POST', { clientId: 'tenant_a', definition: savedDraft() }, { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://other.invalid' });
    assert.equal(response.status, 403); assert.equal(resolutions(), 0);
  });
  assert.equal(backend.reads, 0);
});
