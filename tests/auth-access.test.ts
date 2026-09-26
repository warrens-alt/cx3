import test from 'node:test';
import assert from 'node:assert/strict';
import { authAccess, isBootstrapAdmin, BOOTSTRAP_ADMIN_UID, BOOTSTRAP_ADMIN_EMAIL } from '../src/lib/authAccess';
import type { UserProfile } from '../src/types/auth';

const identity = { uid: 'operator', email: 'operator@example.test', emailVerified: true };
const profile: UserProfile = { uid: identity.uid, email: identity.email, role: 'admin', status: 'active', allowedTenants: ['mtn'] };

test('bootstrap email requires explicit verified ownership; trusted UID remains usable', () => {
  assert.equal(isBootstrapAdmin({ uid: 'other', email: BOOTSTRAP_ADMIN_EMAIL, emailVerified: false }), false);
  assert.equal(isBootstrapAdmin({ uid: 'other', email: BOOTSTRAP_ADMIN_EMAIL }), false);
  assert.equal(isBootstrapAdmin({ uid: 'other', email: BOOTSTRAP_ADMIN_EMAIL.toUpperCase(), emailVerified: true }), true);
  assert.equal(isBootstrapAdmin({ uid: BOOTSTRAP_ADMIN_UID, emailVerified: false }), true);
});

test('UI authority requires a matching active profile, verified identity and admin marker', () => {
  assert.equal(authAccess(identity, profile, true).isAdmin, true);
  assert.equal(authAccess(identity, profile, false).isAdmin, false);
  assert.equal(authAccess({ ...identity, emailVerified: false }, profile, true).isAdmin, false);
  assert.equal(authAccess(identity, { ...profile, uid: 'different' }, true).isAdmin, false);
  assert.equal(authAccess(identity, { ...profile, role: 'viewer' }, true).isAdmin, false);
  assert.equal(authAccess(identity, null, true).isActive, false);
  for (const status of ['pending', 'suspended'] as const) {
    const access = authAccess(identity, { ...profile, status }, true);
    assert.equal(access.isAdmin, false);
    assert.equal(access.isActive, false);
    assert.equal(access.isViewer, false);
  }
});

test('bootstrap UI authority is never fabricated when its profile read fails', () => {
  const bootstrap = { uid: BOOTSTRAP_ADMIN_UID, emailVerified: true };
  assert.equal(authAccess(bootstrap, null, false).isAdmin, false);
  assert.equal(authAccess(bootstrap, { ...profile, uid: bootstrap.uid }, false).isAdmin, true);
});
