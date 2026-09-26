import { doc, runTransaction, writeBatch, type Firestore } from 'firebase/firestore';
import type { UserProfile, UserRole, UserStatus } from '../types/auth';

/** Read and change the profile together with its authority marker. A concurrent
 * role/status change retries the transaction instead of resurrecting stale access. */
export async function changeUserAccess(db: Firestore, uid: string, changes: { role?: UserRole; status?: UserStatus }) {
  const userRef = doc(db, 'users', uid);
  const adminRef = doc(db, 'admins', uid);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists()) throw new Error('User profile no longer exists');
    const profile = { ...snapshot.data(), ...changes } as UserProfile;
    const timestamp = new Date().toISOString();
    transaction.update(userRef, { ...changes, updatedAt: timestamp });
    if (profile.role === 'admin' && profile.status === 'active') {
      transaction.set(adminRef, { uid, email: profile.email, assignedAt: timestamp });
    } else {
      transaction.delete(adminRef);
    }
  });
}

export async function removeUserAccess(db: Firestore, uid: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', uid));
  batch.delete(doc(db, 'admins', uid));
  await batch.commit();
}

/** The verified bootstrap identity can establish both documents from an empty
 * database. getAfter() in the rules validates the marker against this profile. */
export async function saveBootstrapProfile(db: Firestore, profile: UserProfile) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', profile.uid), profile);
  batch.set(doc(db, 'admins', profile.uid), {
    uid: profile.uid, email: profile.email, assignedAt: new Date().toISOString(),
  });
  await batch.commit();
}
