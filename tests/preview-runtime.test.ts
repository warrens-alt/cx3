import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveFirebasePrincipal } from '../server/firebasePreviewAuth';
import { configuredAuthMode } from '../server/security';

const jwt = (payload: Record<string, unknown>) =>
  `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

const documentResponse = (status: number, fields?: Record<string, unknown>) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ fields }),
}) as Response;

const s = (value: string) => ({ stringValue: value });
const list = (values: string[]) => ({ arrayValue: { values: values.map(s) } });

test('AI Studio Preview has a Vite API bridge instead of returning the SPA for /api', () => {
  const vite = fs.readFileSync('vite.config.ts', 'utf8');
  const main = fs.readFileSync('src/main.tsx', 'utf8');
  const transport = fs.readFileSync('src/lib/apiFetch.ts', 'utf8');
  assert.match(vite, /conversionx-preview-api/);
  assert.match(vite, /req\.url\?\.startsWith\('\/api'\)/);
  assert.match(vite, /mountApi/);
  assert.match(main, /installAuthenticatedApiFetch\(\)/);
  assert.match(transport, /Authorization/);
  assert.match(transport, /getIdToken/);
});

test('verified Firebase viewer receives only active profile tenants', async context => {
  const uid = 'preview-user';
  const email = 'viewer@example.test';
  context.mock.method(globalThis, 'fetch', async (input: any) => {
    const url = String(input);
    if (url.includes(`/documents/users/${uid}`)) {
      return documentResponse(200, {
        uid: s(uid), email: s(email), status: s('active'), role: s('viewer'),
        allowedTenants: list(['mtn', 'mondo', 'unknown']),
      });
    }
    return documentResponse(404);
  });

  const principal = await resolveFirebasePrincipal(jwt({ sub: uid, email, email_verified: true }));
  assert.deepEqual(principal, { subject: uid, email, role: 'viewer', tenants: ['mondo', 'mtn'] });
});

test('Firebase admin requires its authority marker and receives configured workspaces', async context => {
  const uid = 'preview-admin';
  const email = 'admin@example.test';
  context.mock.method(globalThis, 'fetch', async (input: any) => {
    const url = String(input);
    if (url.includes(`/documents/users/${uid}`)) {
      return documentResponse(200, {
        uid: s(uid), email: s(email), status: s('active'), role: s('admin'),
        allowedTenants: list(['*']),
      });
    }
    if (url.includes(`/documents/admins/${uid}`)) {
      return documentResponse(200, { uid: s(uid), email: s(email) });
    }
    return documentResponse(404);
  });

  const principal = await resolveFirebasePrincipal(jwt({ sub: uid, email, email_verified: true }));
  assert.equal(principal.role, 'admin');
  assert.ok(principal.tenants.includes('default_tenant'));
  assert.ok(principal.tenants.includes('mtn'));
});

test('inactive Firebase profile fails closed', async context => {
  const uid = 'inactive-user';
  const email = 'inactive@example.test';
  context.mock.method(globalThis, 'fetch', async () => documentResponse(200, {
    uid: s(uid), email: s(email), status: s('suspended'), role: s('viewer'),
    allowedTenants: list(['mtn']),
  }));
  await assert.rejects(
    resolveFirebasePrincipal(jwt({ sub: uid, email, email_verified: true })),
    /not active/,
  );
});

test('installAuthenticatedApiFetch does not crash when fetch has only a getter', async () => {
  const { installAuthenticatedApiFetch, _resetInstalledForTesting } = await import('../src/lib/apiFetch');
  _resetInstalledForTesting();
  const originalFetch = globalThis.fetch;
  try {
    // Configure globalThis.fetch to have only a getter (simulating Window.prototype.fetch)
    Object.defineProperty(globalThis, 'fetch', {
      get() {
        return originalFetch;
      },
      configurable: true,
      enumerable: true,
    });

    // Calling installAuthenticatedApiFetch must not throw
    assert.doesNotThrow(() => {
      installAuthenticatedApiFetch();
    });
    // And globalThis.fetch should now be the wrapped function
    assert.equal(typeof globalThis.fetch, 'function');
  } finally {
    _resetInstalledForTesting();
    try {
      globalThis.fetch = originalFetch;
    } catch {
      Object.defineProperty(globalThis, 'fetch', {
        value: originalFetch,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  }
});



test('production defaults to IAP while Cloudflare Firebase mode requires explicit configuration', () => {
  assert.equal(configuredAuthMode({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), 'iap');
  assert.equal(configuredAuthMode({ NODE_ENV: 'production', CX_AUTH_MODE: 'firebase' } as NodeJS.ProcessEnv), 'firebase');
  assert.equal(configuredAuthMode({ NODE_ENV: 'development' } as NodeJS.ProcessEnv), 'firebase');
  assert.equal(configuredAuthMode({ NODE_ENV: 'development', CX_AUTH_MODE: 'iap' } as NodeJS.ProcessEnv), 'iap');
  assert.throws(
    () => configuredAuthMode({ NODE_ENV: 'production', CX_AUTH_MODE: 'open' } as NodeJS.ProcessEnv),
    /CX_AUTH_MODE must be either iap or firebase/,
  );
});
