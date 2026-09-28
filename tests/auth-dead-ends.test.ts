import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { authAccess } from '../src/lib/authAccess';
import type { UserProfile } from '../src/types/auth';

test('absence of administrator marker for an ordinary viewer is not an admin service failure', () => {
  const viewerIdentity = { uid: 'viewer1', email: 'viewer@example.test', emailVerified: true };
  const viewerProfile: UserProfile = {
    uid: 'viewer1',
    email: 'viewer@example.test',
    role: 'viewer',
    status: 'active',
    allowedTenants: ['mtn'],
  };

  // When hasAdminMarker is false for an ordinary viewer:
  const access = authAccess(viewerIdentity, viewerProfile, false);
  assert.equal(access.isActive, true);
  assert.equal(access.isViewer, true);
  assert.equal(access.isAdmin, false);
  assert.equal(access.isPending, false);
  assert.equal(access.isSuspended, false);
});

test('admin authority requires both active admin profile and authority marker', () => {
  const adminIdentity = { uid: 'admin1', email: 'admin@example.test', emailVerified: true };
  const adminProfile: UserProfile = {
    uid: 'admin1',
    email: 'admin@example.test',
    role: 'admin',
    status: 'active',
    allowedTenants: ['*'],
  };

  // With marker -> isAdmin = true
  assert.equal(authAccess(adminIdentity, adminProfile, true).isAdmin, true);

  // Without marker -> isAdmin = false (not treated as crash, but marker absent)
  assert.equal(authAccess(adminIdentity, adminProfile, false).isAdmin, false);
});

test('missing profile or suspended profile denies active status without indefinite spinner', () => {
  const identity = { uid: 'user1', email: 'user@example.test', emailVerified: true };

  // Missing profile
  const missingProfileAccess = authAccess(identity, null, false);
  assert.equal(missingProfileAccess.isActive, false);
  assert.equal(missingProfileAccess.isAdmin, false);

  // Suspended profile
  const suspendedProfile: UserProfile = {
    uid: 'user1',
    email: 'user@example.test',
    role: 'viewer',
    status: 'suspended',
    allowedTenants: ['mtn'],
  };
  const suspendedAccess = authAccess(identity, suspendedProfile, false);
  assert.equal(suspendedAccess.isActive, false);
  assert.equal(suspendedAccess.isSuspended, true);
});

test('AuthGate implements explicit recoverable UI states without indefinite spinner dead ends', () => {
  const gateSource = fs.readFileSync('src/components/AuthGate.tsx', 'utf8');

  // Verify explicit handling of service failure
  assert.match(gateSource, /SERVICE_FAILURE|authError/);
  assert.match(gateSource, /Access Service Unavailable/);
  assert.match(gateSource, /retryAuth/);
  assert.match(gateSource, /signOut/);

  // Verify explicit handling of missing profile
  assert.match(gateSource, /MISSING_PROFILE|!profile/);
  assert.match(gateSource, /Account Profile Not Found/);

  // Verify accessible alert semantics
  assert.match(gateSource, /role="alert"/);

  // Verify that indefinite fallback spinner (div with animate-spin as final return) is eliminated
  assert.doesNotMatch(gateSource, /\/\/ Fallback while state resolves\s*return\s*\(\s*<div[^>]*animate-spin/);
});

test('AuthContext exports AuthAccessState and provides safe retry without listener leaks', () => {
  const authContextSource = fs.readFileSync('src/lib/AuthContext.tsx', 'utf8');

  // Exports AuthAccessState
  assert.match(authContextSource, /export type AuthAccessState/);
  assert.match(authContextSource, /SERVICE_FAILURE/);
  assert.match(authContextSource, /MISSING_PROFILE/);
  assert.match(authContextSource, /INITIAL_LOADING/);

  // Exposes retryAuth and authError
  assert.match(authContextSource, /retryAuth/);
  assert.match(authContextSource, /authError/);

  // Clean listener teardown on generation or retry
  assert.match(authContextSource, /clearSubscriptions\(\)/);
  assert.match(authContextSource, /unsubscribeAuth\(\)/);
  assert.match(authContextSource, /\[retryCount\]/);
});
