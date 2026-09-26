import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { changeUserAccess, removeUserAccess, saveBootstrapProfile } from '../src/lib/authAdministration';
import { BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_UID } from '../src/lib/authAccess';
import type { UserProfile } from '../src/types/auth';

// This suite only addresses a local emulator. It never initializes the app's
// Firebase project or calls production Firestore, including when run by npm test.
test('Firestore access lifecycle', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async t => {
  const { initializeTestEnvironment, assertSucceeds, assertFails } = await import('@firebase/rules-unit-testing');
  const environment = await initializeTestEnvironment({
    projectId: 'demo-cx3-access',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
  const profile = (uid: string, overrides: Partial<UserProfile> = {}): UserProfile => ({
    uid, email: `${uid}@example.test`, role: 'viewer', status: 'active', allowedTenants: ['mtn'], ...overrides,
  });
  const authenticated = (uid: string, claims: Record<string, unknown> = {}) => environment.authenticatedContext(uid, {
    email: `${uid}@example.test`, email_verified: true, ...claims,
  }).firestore();
  const seed = async (...profiles: UserProfile[]) => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      const batch = writeBatch(db);
      for (const item of profiles) {
        batch.set(doc(db, 'users', item.uid), item);
        if (item.role === 'admin') batch.set(doc(db, 'admins', item.uid), { uid: item.uid, email: item.email });
      }
      await batch.commit();
    });
  };
  const admin = profile('operator', { role: 'admin' });
  const canAdminister = (db: ReturnType<typeof authenticated>) => getDocs(collection(db, 'users'));

  try {
    await t.test('trusted UID and verified bootstrap email initialize an empty database atomically', async () => {
      for (const [uid, email, verified] of [
        [BOOTSTRAP_ADMIN_UID, 'owner@example.test', false],
        ['verified-bootstrap', BOOTSTRAP_ADMIN_EMAIL.toUpperCase(), true],
      ] as const) {
        await seed();
        const db = authenticated(uid, { email, email_verified: verified });
        await assertSucceeds(saveBootstrapProfile(db as any, profile(uid, {
          email: email.toLowerCase(), role: 'admin', allowedTenants: ['*'],
        })));
        await assertSucceeds(canAdminister(db));
        assert.equal((await getDoc(doc(db, 'admins', uid))).data()?.email, email.toLowerCase());
      }
    });

    await t.test('unverified and missing verification claims cannot claim bootstrap authority', async () => {
      await seed();
      for (const verified of [false, undefined]) {
        const claims: Record<string, unknown> = { email: BOOTSTRAP_ADMIN_EMAIL };
        if (verified !== undefined) claims.email_verified = verified;
        const db = environment.authenticatedContext('untrusted-bootstrap', claims).firestore();
        await assertFails(saveBootstrapProfile(db as any, profile('untrusted-bootstrap', {
          email: BOOTSTRAP_ADMIN_EMAIL, role: 'admin',
        })));
        await assertFails(setDoc(doc(db, 'platformConfig', 'global'), { requireApproval: false }));
      }
    });

    await t.test('ordinary registration stays pending and cannot promote, activate or change tenant scope', async () => {
      await seed(admin);
      const db = authenticated('new-user');
      await assertFails(setDoc(doc(db, 'users', 'new-user'), profile('new-user', { role: 'admin' })));
      await assertSucceeds(setDoc(doc(db, 'users', 'new-user'), profile('new-user', { status: 'pending' })));
      for (const changes of [{ role: 'admin' }, { status: 'active' }, { allowedTenants: ['*'] }]) {
        await assertFails(updateDoc(doc(db, 'users', 'new-user'), changes));
      }
      await assertFails(setDoc(doc(db, 'admins', 'new-user'), { uid: 'new-user', email: 'new-user@example.test' }));
      await assertSucceeds(updateDoc(doc(db, 'users', 'new-user'), { lastLoginAt: new Date().toISOString() }));
    });

    await t.test('first promotion includes email and grants authority only after the atomic commit', async () => {
      await seed(admin, profile('target'));
      const targetDb = authenticated('target');
      await assertFails(canAdminister(targetDb));
      await assertSucceeds(changeUserAccess(authenticated('operator') as any, 'target', { role: 'admin' }));
      assert.equal((await getDoc(doc(targetDb, 'admins', 'target'))).data()?.email, 'target@example.test');
      await assertSucceeds(canAdminister(targetDb));
    });

    await t.test('pending administrators receive no marker until activated', async () => {
      await seed(admin, profile('target', { status: 'pending' }));
      const db = authenticated('operator');
      await assertSucceeds(changeUserAccess(db as any, 'target', { role: 'admin' }));
      assert.equal((await getDoc(doc(db, 'admins', 'target'))).exists(), false);
      await assertFails(canAdminister(authenticated('target')));
      await assertSucceeds(changeUserAccess(db as any, 'target', { status: 'active' }));
      await assertSucceeds(canAdminister(authenticated('target')));
    });

    await t.test('suspension, demotion and deletion revoke existing sessions and remove markers', async () => {
      for (const action of ['suspend', 'demote', 'delete'] as const) {
        await seed(admin, profile('target', { role: 'admin' }));
        const db = authenticated('operator');
        const targetDb = authenticated('target');
        await assertSucceeds(canAdminister(targetDb));
        if (action === 'delete') await assertSucceeds(removeUserAccess(db as any, 'target'));
        else await assertSucceeds(changeUserAccess(db as any, 'target', action === 'suspend' ? { status: 'suspended' } : { role: 'viewer' }));
        assert.equal((await getDoc(doc(db, 'admins', 'target'))).exists(), false);
        await assertFails(canAdminister(targetDb));
        await assertFails(updateDoc(doc(targetDb, 'users', 'operator'), { status: 'suspended' }));
        await assertFails(updateDoc(doc(targetDb, 'users', 'target'), { role: 'admin', status: 'active' }));
        await assertFails(setDoc(doc(targetDb, 'admins', 'target'), { uid: 'target', email: 'target@example.test' }));
      }
    });

    await t.test('a stale marker cannot authorize a suspended, demoted, deleted or unverified account', async () => {
      for (const changes of [{ status: 'suspended' }, { role: 'viewer' }, null] as const) {
        await seed(admin, profile('target', { role: 'admin' }));
        await environment.withSecurityRulesDisabled(async context => {
          const ref = doc(context.firestore(), 'users', 'target');
          if (changes) await updateDoc(ref, changes);
          else await deleteDoc(ref);
        });
        await assertFails(canAdminister(authenticated('target')));
      }
      await seed(admin);
      await assertFails(canAdminister(authenticated('operator', { email_verified: false })));
    });

    await t.test('denied authority mutations do not partially modify the profile', async () => {
      await seed(admin, profile('target'));
      const db = authenticated('target');
      await assertFails(changeUserAccess(db as any, 'target', { role: 'admin' }));
      assert.equal((await getDoc(doc(db, 'users', 'target'))).data()?.role, 'viewer');
      assert.equal((await getDoc(doc(db, 'admins', 'target'))).exists(), false);
    });

    await t.test('invite create, update and delete accept the UI schema and reject mismatched IDs', async () => {
      await seed(admin);
      const db = authenticated('operator');
      const id = 'invited_example_test';
      const ref = doc(db, 'accessInvites', id);
      const data = { id, email: 'invited@example.test', role: 'analyst', allowedTenants: ['mtn'], invitedBy: admin.email, createdAt: new Date().toISOString() };
      await assertSucceeds(setDoc(ref, data));
      await assertSucceeds(updateDoc(ref, { role: 'viewer' }));
      await assertFails(updateDoc(ref, { id: 'different' }));
      await assertFails(deleteDoc(doc(authenticated('ordinary'), 'accessInvites', id)));
      await assertSucceeds(deleteDoc(ref));
      assert.equal((await getDoc(ref)).exists(), false);
    });
  } finally {
    await environment.cleanup();
  }
});
