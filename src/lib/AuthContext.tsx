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
  onSnapshot,
  collection,
  serverTimestamp,
  query,
  orderBy,
  limit,
  addDoc
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import type { UserProfile, UserRole, UserStatus, AccessInvite, AuditLogEntry, PlatformConfig } from '../types/auth';

const SUPER_ADMIN_EMAIL = 'warrens@bastionflowe.com';

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
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        let userSnap;
        try {
          userSnap = await getDoc(userRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
        }

        const isSuperAdmin = currentUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

        if (!userSnap.exists()) {
          // Check for pre-existing invite for this email
          let assignedRole: UserRole = 'viewer';
          let assignedStatus: UserStatus = 'pending';
          let assignedTenants: string[] = ['*'];

          if (isSuperAdmin) {
            assignedRole = 'admin';
            assignedStatus = 'active';
            assignedTenants = ['*'];
          } else {
            // Check invite collection
            try {
              const inviteRef = doc(db, 'accessInvites', (currentUser.email || '').toLowerCase().replace(/[^a-z0-9]/g, '_'));
              const inviteSnap = await getDoc(inviteRef);
              if (inviteSnap.exists()) {
                const inviteData = inviteSnap.data() as AccessInvite;
                assignedRole = inviteData.role || 'analyst';
                assignedStatus = 'active';
                assignedTenants = inviteData.allowedTenants || ['*'];
              }
            } catch {
              // fallback
            }
          }

          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: (currentUser.email || '').toLowerCase(),
            displayName: currentUser.displayName || (isSuperAdmin ? 'Warren Stear' : currentUser.email?.split('@')[0] || 'User'),
            photoURL: currentUser.photoURL ? currentUser.photoURL.substring(0, 1024) : null,
            role: assignedRole,
            status: assignedStatus,
            allowedTenants: assignedTenants,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          };

          try {
            await setDoc(userRef, newProfile);
          } catch (err) {
            console.warn('Initial profile creation note:', err);
            setProfile(newProfile);
          }

          if (isSuperAdmin) {
            try {
              await setDoc(doc(db, 'admins', currentUser.uid), {
                uid: currentUser.uid,
                email: (currentUser.email || '').toLowerCase(),
                createdAt: new Date().toISOString()
              }, { merge: true });
            } catch (err) {
              console.warn('Admin marker write notice:', err);
            }
          }

          await logAudit('USER_REGISTERED', currentUser.email || '', `First login registered with status: ${assignedStatus}, role: ${assignedRole}`);
        } else {
          // Existing user - update last login timestamp and enforce super admin if applicable
          const existingData = userSnap.data() as UserProfile;
          const updates: Record<string, any> = {
            lastLoginAt: new Date().toISOString()
          };
          if (currentUser.displayName && currentUser.displayName !== existingData.displayName) {
            updates.displayName = currentUser.displayName;
          }
          if (currentUser.photoURL && currentUser.photoURL !== existingData.photoURL) {
            updates.photoURL = currentUser.photoURL.substring(0, 1024);
          }

          // Always guarantee super-admin rights for warrens@bastionflowe.com
          if (isSuperAdmin && (existingData.role !== 'admin' || existingData.status !== 'active')) {
            updates.role = 'admin';
            updates.status = 'active';
            updates.allowedTenants = ['*'];
          }

          try {
            await updateDoc(userRef, updates);
          } catch (err) {
            console.warn('Profile update notice:', err);
          }

          if (isSuperAdmin) {
            try {
              await setDoc(doc(db, 'admins', currentUser.uid), {
                uid: currentUser.uid,
                email: (currentUser.email || '').toLowerCase(),
                createdAt: new Date().toISOString()
              }, { merge: true });
            } catch {
              // ignore
            }
          }
        }

        // Attach real-time listener to user's profile
        unsubscribeProfile = onSnapshot(
          userRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              setProfile(data);
            } else if (isSuperAdmin) {
              setProfile({
                uid: currentUser.uid,
                email: currentUser.email || 'warrens@bastionflowe.com',
                displayName: currentUser.displayName || 'Warren Stear',
                photoURL: currentUser.photoURL || null,
                role: 'admin',
                status: 'active',
                allowedTenants: ['*'],
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString()
              });
            } else {
              setProfile(null);
            }
            setLoading(false);
          },
          (error) => {
            console.warn('User profile sync notice:', error);
            if (isSuperAdmin) {
              setProfile({
                uid: currentUser.uid,
                email: currentUser.email || 'warrens@bastionflowe.com',
                displayName: currentUser.displayName || 'Warren Stear',
                photoURL: currentUser.photoURL || null,
                role: 'admin',
                status: 'active',
                allowedTenants: ['*'],
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString()
              });
            }
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('Auth initialization error:', err);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
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

  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isAnalyst = profile?.role === 'analyst' || isAdmin;
  const isViewer = profile?.role === 'viewer' || isAnalyst;
  const isActive = profile?.status === 'active' || (Boolean(user) && user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
  const isPending = profile?.status === 'pending' && !isActive;
  const isSuspended = profile?.status === 'suspended' && !isActive;

  const hasClientAccess = (clientId: string): boolean => {
    if (!profile) return false;
    if (isAdmin) return true;
    if (!profile.allowedTenants || profile.allowedTenants.includes('*')) return true;
    return profile.allowedTenants.includes(clientId);
  };

  // Administrative actions
  const updateUserRole = async (uid: string, role: UserRole) => {
    if (!isAdmin) throw new Error('Unauthorized');
    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, { role, updatedAt: new Date().toISOString() });
      if (role === 'admin') {
        await setDoc(doc(db, 'admins', uid), { uid, createdAt: new Date().toISOString() }, { merge: true });
      } else {
        await deleteDoc(doc(db, 'admins', uid)).catch(() => {});
      }
      await logAudit('UPDATE_USER_ROLE', uid, `Role changed to: ${role}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const updateUserStatus = async (uid: string, status: UserStatus) => {
    if (!isAdmin) throw new Error('Unauthorized');
    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, { status, updatedAt: new Date().toISOString() });
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
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'admins', uid)).catch(() => {});
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
