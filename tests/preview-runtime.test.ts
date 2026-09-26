import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveFirebasePreviewPrincipal } from '../server/firebasePreviewAuth';

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

test('verified Firebase preview viewer receives only active profile tenants', async context => {
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

  const principal = await resolveFirebasePreviewPrincipal(jwt({ sub: uid, email, email_verified: true }));
  assert.deepEqual(principal, { subject: uid, email, role: 'viewer', tenants: ['mondo', 'mtn'] });
});

test('Firebase preview admin requires its authority marker and receives configured workspaces', async context => {
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

  const principal = await resolveFirebasePreviewPrincipal(jwt({ sub: uid, email, email_verified: true }));
  assert.equal(principal.role, 'admin');
  assert.ok(principal.tenants.includes('default_tenant'));
  assert.ok(principal.tenants.includes('mtn'));
});

test('inactive Firebase preview profile fails closed', async context => {
  const uid = 'inactive-user';
  const email = 'inactive@example.test';
  context.mock.method(globalThis, 'fetch', async () => documentResponse(200, {
    uid: s(uid), email: s(email), status: s('suspended'), role: s('viewer'),
    allowedTenants: list(['mtn']),
  }));
  await assert.rejects(
    resolveFirebasePreviewPrincipal(jwt({ sub: uid, email, email_verified: true })),
    /not active/,
  );
});
