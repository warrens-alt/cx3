import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type User,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import type { UserProfile, UserRole, UserStatus, AccessInvite, PlatformConfig } from '../types/auth';
import { authAccess, isBootstrapAdmin } from './authAccess';
import { changeUserAccess, removeUserAccess, saveBootstrapProfile } from './authAdministration';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isAnalyst: boolean;
  isViewer: boolean;
  isActive: boolean;
  isPending: boolean;
  isSuspended: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  hasClientAccess: (clientId: string) => boolean;
  // Admin functions
  updateUserRole: (uid: string, role: UserRole) => Promise<void>;
  updateUserStatus: (uid: string, status: UserStatus) => Promise<void>;
  updateUserTenants: (uid: string, tenants: string[]) => Promise<void>;
  deleteUserAccount: (uid: string) => Promise<void>;
  createInvite: (email: string, role: UserRole, allowedTenants: string[]) => Promise<void>;
  deleteInvite: (inviteId: string) => Promise<void>;
  updatePlatformConfig: (config: Partial<PlatformConfig>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasAdminMarker, setHasAdminMarker] = useState(false);

  // Helper to record audit logs
  const logAudit = async (action: string, targetEmail: string, details: string) => {
    if (!auth.currentUser) return;
    try {
      const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        actorEmail: auth.currentUser.email || 'unknown',
        actorUid: auth.currentUser.uid,
        action,
        targetEmail,
        details,
        timestamp: new Date().toISOString()
      });
    } catch {
      // Non-blocking for audit
    }
  };

  useEffect(() => {
    let generation = 0;
    let disposed = false;
    let subscriptions: (() => void)[] = [];
    const clearSubscriptions = () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
      subscriptions = [];
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async currentUser => {
      const currentGeneration = ++generation;
      const isCurrent = () => !disposed && currentGeneration === generation;
      clearSubscriptions();
      setLoading(true);
      setUser(currentUser);
      setProfile(null);
      setHasAdminMarker(false);
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!isCurrent()) return;
        const bootstrap = isBootstrapAdmin(currentUser);
        const timestamp = new Date().toISOString();
        if (!userSnap.exists()) {
          let role: UserRole = bootstrap ? 'admin' : 'viewer';
          let allowedTenants = bootstrap ? ['*'] : [];
          if (!bootstrap) {
            try {
              const inviteId = (currentUser.email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
              const invite = await getDoc(doc(db, 'accessInvites', inviteId));
              if (!isCurrent()) return;
              if (invite.exists()) {
                const data = invite.data() as AccessInvite;
                // An invite never activates an account or grants administrator authority.
                role = data.role === 'viewer' ? 'viewer' : 'analyst';
                allowedTenants = data.allowedTenants || [];
              }
            } catch {
              // Registration still creates a pending account when no invite is readable.
            }
          }
          if (!isCurrent()) return;
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: (currentUser.email || '').toLowerCase(),
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            photoURL: currentUser.photoURL?.substring(0, 1024) || null,
            role,
            status: bootstrap ? 'active' : 'pending',
            allowedTenants,
            createdAt: timestamp,
            lastLoginAt: timestamp,
          };
          if (bootstrap) await saveBootstrapProfile(db, newProfile);
          else await setDoc(userRef, newProfile);
          if (!isCurrent()) return;
          await logAudit('USER_REGISTERED', currentUser.email || '', `First login registered with status: ${newProfile.status}, role: ${role}`);
        } else {
          const existing = userSnap.data() as UserProfile;
          const updates = {
            lastLoginAt: timestamp,
            ...(currentUser.displayName ? { displayName: currentUser.displayName } : {}),
            ...(currentUser.photoURL ? { photoURL: currentUser.photoURL.substring(0, 1024) } : {}),
          };
          if (bootstrap) {
            await saveBootstrapProfile(db, {
              ...existing, ...updates, role: 'admin', status: 'active', allowedTenants: ['*'],
            });
          } else {
            await updateDoc(userRef, updates);
          }
        }
        if (!isCurrent()) return;

        let profileReady = false;
        let markerReady = false;
        const finishLoading = () => {
          if (isCurrent() && profileReady && markerReady) setLoading(false);
        };
        subscriptions.push(onSnapshot(userRef, snapshot => {
          if (!isCurrent()) return;
          setProfile(snapshot.exists() ? snapshot.data() as UserProfile : null);
          profileReady = true;
          finishLoading();
        }, error => {
          if (!isCurrent()) return;
          console.warn('User profile sync failed:', error);
          setProfile(null);
          profileReady = true;
          finishLoading();
        }));
        subscriptions.push(onSnapshot(doc(db, 'admins', currentUser.uid), snapshot => {
          if (!isCurrent()) return;
          setHasAdminMarker(snapshot.exists());
          markerReady = true;
          finishLoading();
        }, error => {
          if (!isCurrent()) return;
          console.warn('Administrator authority sync failed:', error);
          setHasAdminMarker(false);
          markerReady = true;
          finishLoading();
        }));
      } catch (error) {
        if (!isCurrent()) return;
        // No locally invented active/admin profile on denied writes or sync failure.
        console.error('Auth initialization failed:', error);
        setProfile(null);
        setHasAdminMarker(false);
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
      generation++;
      unsubscribeAuth();
      clearSubscriptions();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        console.error('Google sign-in error:', error);
        throw error;
      }
    }
  };

  const signOut = async () => {
    if (user?.email) {
      await logAudit('USER_LOGOUT', user.email, 'User logged out of application');
    }
    await fbSignOut(auth);
    setProfile(null);
  };

  const { isAdmin, isAnalyst, isViewer, isActive, isPending, isSuspended } = authAccess(user, profile, hasAdminMarker);

  const hasClientAccess = (clientId: string): boolean => {
    if (!isActive || !profile) return false;
    if (isAdmin) return true;
    return Boolean(profile.allowedTenants?.includes('*') || profile.allowedTenants?.includes(clientId));
  };

  // Administrative actions
  const updateUserRole = async (uid: string, role: UserRole) => {
    if (!isAdmin) throw new Error('Unauthorized');
    try {
      await changeUserAccess(db, uid, { role });
      await logAudit('UPDATE_USER_ROLE', uid, `Role changed to: ${role}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const updateUserStatus = async (uid: string, status: UserStatus) => {
    if (!isAdmin) throw new Error('Unauthorized');
    try {
      await changeUserAccess(db, uid, { status });
      await logAudit('UPDATE_USER_STATUS', uid, `Status changed to: ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const updateUserTenants = async (uid: string, tenants: string[]) => {
    if (!isAdmin) throw new Error('Unauthorized');
    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, { allowedTenants: tenants, updatedAt: new Date().toISOString() });
      await logAudit('UPDATE_USER_TENANTS', uid, `Allowed tenants updated to: ${tenants.join(', ')}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const deleteUserAccount = async (uid: string) => {
    if (!isAdmin) throw new Error('Unauthorized');
    try {
      await removeUserAccess(db, uid);
      await logAudit('DELETE_USER', uid, 'User account deleted by admin');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
  };

  const createInvite = async (email: string, role: UserRole, allowedTenants: string[]) => {
    if (!isAdmin) throw new Error('Unauthorized');
    const sanitizedId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const inviteRef = doc(db, 'accessInvites', sanitizedId);
    try {
      const inviteData: AccessInvite = {
        id: sanitizedId,
        email: email.toLowerCase(),
        role,
        allowedTenants,
        invitedBy: user?.email || 'admin',
        createdAt: new Date().toISOString()
      };
      await setDoc(inviteRef, inviteData);
      await logAudit('CREATE_INVITE', email, `Pre-authorized access invite created for role: ${role}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `accessInvites/${sanitizedId}`);
    }
  };

  const deleteInvite = async (inviteId: string) => {
    if (!isAdmin) throw new Error('Unauthorized');
    try {
      await deleteDoc(doc(db, 'accessInvites', inviteId));
      await logAudit('DELETE_INVITE', inviteId, 'Access invite revoked');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `accessInvites/${inviteId}`);
    }
  };

  const updatePlatformConfig = async (config: Partial<PlatformConfig>) => {
    if (!isAdmin) throw new Error('Unauthorized');
    const configRef = doc(db, 'platformConfig', 'global');
    try {
      await setDoc(configRef, {
        ...config,
        id: 'global',
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'admin'
      }, { merge: true });
      await logAudit('UPDATE_PLATFORM_CONFIG', 'global', `Platform access policy updated`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'platformConfig/global');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        isAnalyst,
        isViewer,
        isActive,
        isPending,
        isSuspended,
        signInWithGoogle,
        signOut,
        hasClientAccess,
        updateUserRole,
        updateUserStatus,
        updateUserTenants,
        deleteUserAccount,
        createInvite,
        deleteInvite,
        updatePlatformConfig
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
