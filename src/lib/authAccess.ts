import type { UserProfile } from '../types/auth';

// Keep these bootstrap identities aligned with firestore.rules. Ordinary
// administrators must have both an active profile and an authority marker.
export const BOOTSTRAP_ADMIN_UID = 'lb9z5IHnOsYRRcqcS7WD5WcURK13';
export const BOOTSTRAP_ADMIN_EMAIL = 'warrens@bastionflowe.com';

export interface AuthIdentity {
  uid: string;
  email?: string | null;
  emailVerified?: boolean;
}

export function isBootstrapAdmin(identity: AuthIdentity | null): boolean {
  return Boolean(identity && (identity.uid === BOOTSTRAP_ADMIN_UID
    || (identity.emailVerified === true && identity.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL)));
}

export function authAccess(identity: AuthIdentity | null, profile: UserProfile | null, hasAdminMarker: boolean) {
  const ownsProfile = Boolean(identity && profile?.uid === identity.uid);
  const isActive = ownsProfile && profile?.status === 'active';
  const isAdmin = isActive && profile?.role === 'admin'
    && (isBootstrapAdmin(identity) || (identity?.emailVerified === true && hasAdminMarker));
  const isAnalyst = isActive && (profile?.role === 'analyst' || isAdmin);
  const isViewer = isActive && (profile?.role === 'viewer' || isAnalyst);
  return {
    isActive, isAdmin, isAnalyst, isViewer,
    isPending: ownsProfile && profile?.status === 'pending',
    isSuspended: ownsProfile && profile?.status === 'suspended',
  };
}
