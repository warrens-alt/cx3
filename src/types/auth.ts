export type UserRole = 'admin' | 'analyst' | 'viewer';
export type UserStatus = 'active' | 'pending' | 'suspended';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  role: UserRole;
  status: UserStatus;
  allowedTenants: string[]; // e.g. ['*'] or list of client ids like ['mondo', 'mtn']
  createdAt?: any;
  updatedAt?: any;
  lastLoginAt?: any;
}

export interface AccessInvite {
  id: string;
  email: string;
  role: UserRole;
  allowedTenants: string[];
  invitedBy: string;
  createdAt?: any;
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string;
  actorUid: string;
  action: string;
  targetEmail?: string;
  details: string;
  timestamp?: any;
}

export interface PlatformConfig {
  id: string;
  defaultRole: 'analyst' | 'viewer';
  requireApproval: boolean;
  allowedDomains: string[];
  updatedAt?: any;
  updatedBy?: string;
}
