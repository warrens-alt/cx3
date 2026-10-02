import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { mountApi } from '../server/apiApp';
import { _resetPrincipalCacheForTesting } from '../server/firebasePreviewAuth';

interface Profile {
  uid: string;
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
  status?: string;
  tenants?: string[];
}
const profile = (role: Profile['role'], extra: Partial<Profile> = {}): Profile => ({ uid: `synthetic-${role}`, email: `${role}@example.invalid`, role, ...extra });
const token = (identity: Profile, extra = {}) => `header.${Buffer.from(JSON.stringify({ sub: identity.uid, email: identity.email, email_verified: true, exp: Math.floor(Date.now() / 1000) + 600, ...extra })).toString('base64url')}.signature`;
const auth = (identity: Profile) => ({ Authorization: `Bearer ${token(identity)}` });

async function withApi(context: TestContext, profiles: Profile[], run: (base: string, authorityReads: string[]) => Promise<void>, environment: Record<string, string> = {}) {
  const overrides = { NODE_ENV: 'production', CX_AUTH_MODE: 'firebase', CX_ALLOW_DEV_AUTH: 'false', ...environment };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  _resetPrincipalCacheForTesting();
  const authorityReads: string[] = [];
  const nativeFetch = globalThis.fetch;
  context.mock.method(globalThis, 'fetch', async (input: any, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === '127.0.0.1') return nativeFetch(input, init);
    assert.equal(url.hostname, 'firestore.googleapis.com', 'No warehouse or other external service may be accessed');
    assert.ok(!init?.method || init.method === 'GET', 'Retired APIs cannot cause storage writes');
    authorityReads.push(url.pathname);
    const fields = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { stringValue: value }]));
    const identity = profiles.find(candidate => url.pathname.endsWith(`/users/${candidate.uid}`) || url.pathname.endsWith(`/admins/${candidate.uid}`));
    if (!identity || (url.pathname.includes('/admins/') && identity.role !== 'admin')) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify({ fields: {
      ...fields({ uid: identity.uid, email: identity.email, role: identity.role, status: identity.status || 'active' }),
      allowedTenants: { arrayValue: { values: (identity.tenants || ['mtn']).map(stringValue => ({ stringValue })) } },
    } }), { status: 200 });
  });
  let server: ReturnType<express.Express['listen']> | undefined;
  try {
    const app = express();
    await mountApi(app);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, authorityReads);
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server!.close(() => resolve()));
    }
    _resetPrincipalCacheForTesting();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

async function assertRemoved(base: string, identity: Profile, body = { uid: identity.uid, email: identity.email }, query = '') {
  const listed = await fetch(`${base}/api/users${query}`, { headers: auth(identity) });
  assert.equal(listed.status, 404);
  assert.deepEqual(await listed.json(), { success: false, error: 'Unknown API endpoint' });
  const synced = await fetch(`${base}/api/users/sync${query}`, { method: 'POST', headers: { ...auth(identity), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(synced.status, 404);
  assert.deepEqual(await synced.json(), { success: false, error: 'Unknown API endpoint' });
  assert.equal(synced.headers.get('cache-control'), 'private, no-store');
}

test('removed Cloud SQL APIs retain the authentication boundary for unauthenticated requests', async context => {
  await withApi(context, [], async (base, reads) => {
    assert.equal((await fetch(`${base}/api/users`)).status, 401);
    assert.equal((await fetch(`${base}/api/users/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: 'spoofed', email: 'spoofed@example.invalid' }) })).status, 401);
    assert.deepEqual(reads, []);
  });
  assert.equal(existsSync('src/db/users.ts'), false);
});

for (const role of ['viewer', 'analyst', 'admin'] as const) {
  test(`removed Cloud SQL APIs return 404 for an authenticated ${role}`, async context => {
    const identity = profile(role);
    await withApi(context, [identity], async base => assertRemoved(base, identity));
  });
}

test('spoofed UID or email cannot select an identity or invoke user storage', async context => {
  const identity = profile('viewer');
  await withApi(context, [identity], async (base, reads) => {
    await assertRemoved(base, identity, { uid: 'someone-else', email: identity.email });
    await assertRemoved(base, identity, { uid: identity.uid, email: 'someone-else@example.invalid' });
    assert.ok(reads.length > 0);
    assert.ok(reads.every(path => path.endsWith(`/users/${identity.uid}`)), 'Only the authenticated profile is resolved');
  });
});

test('changing tenant or session cannot restore a retired user API', async context => {
  const first = profile('viewer', { uid: 'session-a', email: 'a@example.invalid', tenants: ['mtn'] });
  const second = profile('analyst', { uid: 'session-b', email: 'b@example.invalid', tenants: ['mondo'] });
  await withApi(context, [first, second], async (base, reads) => {
    await assertRemoved(base, first, { uid: second.uid, email: second.email }, '?clientId=mondo');
    await assertRemoved(base, second, { uid: first.uid, email: first.email }, '?clientId=mtn');
    assert.ok(reads.some(path => path.endsWith('/users/session-a')));
    assert.ok(reads.some(path => path.endsWith('/users/session-b')));
    const signedOut = await fetch(`${base}/api/users?clientId=mtn`);
    assert.equal(signedOut.status, 401);
  });
});

test('suspended, pending and expired principals remain denied before retired endpoints', async context => {
  const identities = ['suspended', 'pending'].map(status => profile('viewer', { uid: `account-${status}`, status }));
  await withApi(context, identities, async base => {
    for (const identity of identities) {
      assert.equal((await fetch(`${base}/api/users`, { headers: auth(identity) })).status, 403);
      assert.equal((await fetch(`${base}/api/users/sync`, { method: 'POST', headers: auth(identity) })).status, 403);
    }
    assert.equal((await fetch(`${base}/api/users`, { headers: { Authorization: `Bearer ${token(identities[0], { exp: 1 })}` } })).status, 401);
  });
});

test('same-origin mutation policy remains active for the retired sync path', async context => {
  const identity = profile('admin');
  await withApi(context, [identity], async base => {
    const response = await fetch(`${base}/api/users/sync`, { method: 'POST', headers: { ...auth(identity), Origin: 'https://other.invalid', 'Sec-Fetch-Site': 'cross-site' } });
    assert.equal(response.status, 403);
  });
});

test('legacy Lead Engine KPI, simulation and browsing APIs are not mounted', async context => {
  const identity = profile('admin');
  await withApi(context, [identity], async base => {
    for (const endpoint of ['projects', 'datasets', 'tables', 'table-schema', 'table-data', 'quality/scorecard', 'quality/cleansing-simulation', 'commercial/simulator', 'settings/status', 'export/dictionary', 'export/leads']) {
      const response = await fetch(`${base}/api/${endpoint}`, { headers: auth(identity) });
      assert.equal(response.status, 404, endpoint);
    }
    for (const endpoint of ['commercial/simulate', 'cache/clear']) {
      const response = await fetch(`${base}/api/${endpoint}`, { method: 'POST', headers: auth(identity) });
      assert.equal(response.status, 404, endpoint);
    }
  });
});

test('development analyst and unknown roles never inherit administrator capability', async context => {
  for (const role of ['viewer', 'analyst', 'unsupported', '']) {
    await withApi(context, [], async base => {
      const response = await fetch(`${base}/api/analytics/validation?clientId=default_tenant`);
      assert.equal(response.status, 403, role || 'unset role');
    }, { NODE_ENV: 'test', CX_ALLOW_DEV_AUTH: 'true', CX_DEV_ROLE: role, CX_DEV_TENANTS: 'default_tenant' });
    context.mock.restoreAll();
  }
  await withApi(context, [], async base => {
    assert.equal((await fetch(`${base}/api/analytics/validation?clientId=default_tenant`)).status, 200);
  }, { NODE_ENV: 'test', CX_ALLOW_DEV_AUTH: 'true', CX_DEV_ROLE: 'admin', CX_DEV_TENANTS: 'default_tenant' });
});
