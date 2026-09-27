import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  UserCheck,
  UserX,
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  Mail,
  Building,
  KeyRound,
  History,
  Check,
  X,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import type { UserProfile, UserRole, UserStatus, AccessInvite, AuditLogEntry, PlatformConfig } from '../types/auth';

const AVAILABLE_TENANTS = [
  { id: 'default_tenant', name: 'Primary Tenant' },
  { id: 'mondo', name: 'Mondo' },
  { id: 'mtn', name: 'MTN Direct' },
  { id: 'ontact_blc', name: 'On Contact (BLC)' },
  { id: 'vodacom_bizvoip', name: 'Vodacom (Bizvoip)' },
  { id: 'real_promotions', name: 'Real Promotions' },
  { id: 'rewardsco', name: 'Rewards Co' },
  { id: 'oneplan', name: 'Oneplan' }
];

export default function UserManagement() {
  const {
    user: currentUser,
    isAdmin,
    updateUserRole,
    updateUserStatus,
    updateUserTenants,
    deleteUserAccount,
    createInvite,
    deleteInvite,
    updatePlatformConfig
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'users' | 'invites' | 'policies' | 'audit'>('users');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [invitesList, setInvitesList] = useState<AccessInvite[]>([]);
  const [auditList, setAuditList] = useState<AuditLogEntry[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'suspended'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'analyst' | 'viewer'>('all');

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<UserRole>('analyst');
  const [newInviteTenants, setNewInviteTenants] = useState<string[]>(['*']);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Tenant scope editor modal
  const [editingTenantsUser, setEditingTenantsUser] = useState<UserProfile | null>(null);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [tenantSubmitting, setTenantSubmitting] = useState(false);

  // Policy state
  const [policyApproval, setPolicyApproval] = useState(true);
  const [policyDefaultRole, setPolicyDefaultRole] = useState<'analyst' | 'viewer'>('viewer');
  const [policyDomain, setPolicyDomain] = useState('bastionflowe.com');
  const [policySaving, setPolicySaving] = useState(false);
  const [policySuccess, setPolicySuccess] = useState(false);

  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Listen to Users collection
  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribeUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const users: UserProfile[] = [];
        snapshot.forEach((doc) => {
          users.push(doc.data() as UserProfile);
        });
        // Sort: pending first, then admins, then by email
        users.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (b.status === 'pending' && a.status !== 'pending') return 1;
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (b.role === 'admin' && a.role !== 'admin') return 1;
          return (a.email || '').localeCompare(b.email || '');
        });
        setUsersList(users);
        setLoadingUsers(false);
      },
      (error) => {
        console.warn('User directory sync notice:', error);
        setUsersList([
          {
            uid: currentUser?.uid || 'lb9z5IHnOsYRRcqcS7WD5WcURK13',
            email: currentUser?.email || 'warrens@bastionflowe.com',
            displayName: currentUser?.displayName || 'Warren Stear',
            role: 'admin',
            status: 'active',
            allowedTenants: ['*'],
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          }
        ]);
        setLoadingUsers(false);
      }
    );

    const unsubscribeInvites = onSnapshot(
      collection(db, 'accessInvites'),
      (snapshot) => {
        const invites: AccessInvite[] = [];
        snapshot.forEach((doc) => {
          invites.push(doc.data() as AccessInvite);
        });
        setInvitesList(invites);
      },
      (error) => {
        console.warn('Invites subscription notice:', error);
      }
    );

    const unsubscribeAudit = onSnapshot(
      query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50)),
      (snapshot) => {
        const logs: AuditLogEntry[] = [];
        snapshot.forEach((doc) => {
          logs.push(doc.data() as AuditLogEntry);
        });
        setAuditList(logs);
      },
      (error) => {
        console.warn('Audit subscription notice:', error);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeInvites();
      unsubscribeAudit();
    };
  }, [isAdmin]);

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ message, type });
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Actions
  const handleApproveUser = async (user: UserProfile) => {
    try {
      await updateUserStatus(user.uid, 'active');
      showNotice(`Approved access for ${user.email} (${user.role.toUpperCase()})`);
    } catch (err: any) {
      showNotice(err?.message || 'Failed to approve user', 'error');
    }
  };

  const handleStatusChange = async (user: UserProfile, newStatus: UserStatus) => {
    try {
      await updateUserStatus(user.uid, newStatus);
      showNotice(`Updated status to ${newStatus} for ${user.email}`);
    } catch (err: any) {
      showNotice(err?.message || 'Failed to update status', 'error');
    }
  };

  const handleRoleChange = async (user: UserProfile, newRole: UserRole) => {
    try {
      await updateUserRole(user.uid, newRole);
      showNotice(`Updated role to ${newRole.toUpperCase()} for ${user.email}`);
    } catch (err: any) {
      showNotice(err?.message || 'Failed to update role', 'error');
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (!window.confirm(`Are you sure you want to permanently delete user account "${user.email}"?`)) {
      return;
    }
    try {
      await deleteUserAccount(user.uid);
      showNotice(`User account ${user.email} removed.`);
    } catch (err: any) {
      showNotice(err?.message || 'Failed to delete user account', 'error');
    }
  };

  const handleSaveTenants = async () => {
    if (!editingTenantsUser) return;
    try {
      setTenantSubmitting(true);
      await updateUserTenants(editingTenantsUser.uid, selectedTenants.length === 0 ? ['*'] : selectedTenants);
      showNotice(`Updated tenant access for ${editingTenantsUser.email}`);
      setEditingTenantsUser(null);
    } catch (err: any) {
      showNotice(err?.message || 'Failed to update tenant access', 'error');
    } finally {
      setTenantSubmitting(false);
    }
  };

  const handleCreateInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newInviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showNotice('Please enter a valid email address', 'error');
      return;
    }
    try {
      setInviteSubmitting(true);
      await createInvite(cleanEmail, newInviteRole, newInviteTenants);
      showNotice(`Pre-authorized access invitation saved for ${cleanEmail}`);
      setNewInviteEmail('');
      setNewInviteRole('analyst');
      setNewInviteTenants(['*']);
      setInviteModalOpen(false);
    } catch (err: any) {
      showNotice(err?.message || 'Failed to create access invite', 'error');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string, email: string) => {
    try {
      await deleteInvite(inviteId);
      showNotice(`Pre-authorization for ${email} revoked.`);
    } catch (err: any) {
      showNotice(err?.message || 'Failed to revoke invite', 'error');
    }
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPolicySaving(true);
      await updatePlatformConfig({
        requireApproval: policyApproval,
        defaultRole: policyDefaultRole,
        allowedDomains: policyDomain.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
      });
      setPolicySuccess(true);
      showNotice('Platform access governance policies saved.');
      setTimeout(() => setPolicySuccess(false), 3000);
    } catch (err: any) {
      showNotice(err?.message || 'Failed to save policies', 'error');
    } finally {
      setPolicySaving(false);
    }
  };

  // Filtered users
  const filteredUsers = usersList.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      u.email.toLowerCase().includes(q) ||
      (u.displayName && u.displayName.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const totalUsers = usersList.length;
  const activeCount = usersList.filter((u) => u.status === 'active').length;
  const pendingCount = usersList.filter((u) => u.status === 'pending').length;
  const adminCount = usersList.filter((u) => u.role === 'admin').length;

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Administrator Access Required</h1>
        <p className="text-sm text-slate-600">
          Only authorized platform administrators can manage user accounts and access governance policies.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 transition-all duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-display">
              User & Access Control Center
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage authenticated Google accounts, role permissions, client tenant scopes, and access requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="btn-primary !h-8 gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Pre-Authorize User</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between transition-all ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-1 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
            <span>Total Accounts</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{totalUsers}</div>
          <p className="text-[10.5px] text-slate-500 font-mono">Registered Google accounts</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-1 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
            <span>Active Users</span>
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono tabular-nums">{activeCount}</div>
          <p className="text-[10.5px] text-slate-500 font-mono">Currently authorized</p>
        </div>

        <div
          onClick={() => {
            setActiveTab('users');
            setStatusFilter('pending');
          }}
          className={`bg-white p-4 rounded-lg border shadow-2xs space-y-1 cursor-pointer transition-all ${
            pendingCount > 0 ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
            <span>Pending Approvals</span>
            <Clock className={`w-3.5 h-3.5 ${pendingCount > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold font-mono tabular-nums ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {pendingCount}
            </span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9.5px] font-semibold bg-amber-100 text-amber-800 rounded font-mono">
                ACTION REQUIRED
              </span>
            )}
          </div>
          <p className="text-[10.5px] text-slate-500 font-mono">Awaiting access grant</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-1 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
            <span>Administrators</span>
            <Shield className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-700 font-mono tabular-nums">{adminCount}</div>
          <p className="text-[10.5px] text-slate-500 font-mono">Full platform authority</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-xs sm:text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory ({usersList.length})</span>
          {pendingCount > 0 && (
            <span className="text-[11px] font-semibold text-amber-700 font-mono">
              ({pendingCount} pending)
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invites')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'invites'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Pre-Authorized Invites ({invitesList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policies')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'policies'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Access Policies</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Log ({auditList.length})</span>
        </button>
      </div>

      {/* TAB 1: USERS DIRECTORY */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4 sm:p-5">
          {/* Controls bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="pending">Pending Approval</option>
                <option value="suspended">Suspended Only</option>
              </select>

              <select
                aria-label="Filter by role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admins</option>
                <option value="analyst">Analysts</option>
                <option value="viewer">Viewers</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">User & Identity</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Access Status</th>
                  <th className="px-4 py-3">Client Workspaces</th>
                  <th className="px-4 py-3">Last Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingUsers && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Loading user directory…
                    </td>
                  </tr>
                )}

                {!loadingUsers && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No users match the search filter.
                    </td>
                  </tr>
                )}

                {!loadingUsers &&
                  filteredUsers.map((user) => {
                    const isSelf = user.uid === currentUser?.uid;
                    const isSuper = user.email.toLowerCase() === 'warrens@bastionflowe.com';
                    const allowed = user.allowedTenants || ['*'];
                    const hasAllTenants = allowed.includes('*');

                    return (
                      <tr
                        key={user.uid}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          user.status === 'pending' ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* User Identity */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            {user.photoURL ? (
                              <img
                                src={user.photoURL}
                                alt={`${user.displayName || user.email} profile avatar`}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-full border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                                {user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                {user.displayName || 'Unnamed User'}
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                                    You
                                  </span>
                                )}
                                {isSuper && (
                                  <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                                    Super Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-500 text-[11px] truncate flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span>{user.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3.5">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 font-mono">
                              <Shield className="w-3.5 h-3.5 text-purple-600" />
                              Admin
                            </span>
                          ) : (
                            <select
                              aria-label={`Role for ${user.email}`}
                              value={user.role}
                              onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                              disabled={isSelf}
                              className="px-2.5 py-1 border border-slate-200 rounded-md text-xs font-semibold bg-white cursor-pointer hover:border-slate-300"
                            >
                              <option value="admin">Admin</option>
                              <option value="analyst">Analyst</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          {user.status === 'active' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Active
                            </span>
                          )}
                          {user.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 font-mono animate-pulse">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Pending Approval
                            </span>
                          )}
                          {user.status === 'suspended' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 font-mono">
                              <UserX className="w-3.5 h-3.5 text-rose-600" />
                              Suspended
                            </span>
                          )}
                        </td>

                        {/* Client Workspaces */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                            {hasAllTenants ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-medium border border-blue-200">
                                All Workspaces (*)
                              </span>
                            ) : (
                              allowed.slice(0, 2).map((tId) => (
                                <span
                                  key={tId}
                                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium"
                                >
                                  {AVAILABLE_TENANTS.find((t) => t.id === tId)?.name || tId}
                                </span>
                              ))
                            )}
                            {!hasAllTenants && allowed.length > 2 && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                +{allowed.length - 2} more
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTenantsUser(user);
                                setSelectedTenants(user.allowedTenants || ['*']);
                              }}
                              className="text-[11px] text-blue-600 hover:text-blue-800 underline font-medium ml-1 cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </td>

                        {/* Last Active */}
                        <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Never'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {user.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleApproveUser(user)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          )}

                          {user.status === 'active' && !isSelf && !isSuper && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(user, 'suspended')}
                              className="px-2.5 py-1 rounded border border-slate-300 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-medium text-xs transition-colors cursor-pointer"
                            >
                              Suspend
                            </button>
                          )}

                          {user.status === 'suspended' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(user, 'active')}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors cursor-pointer"
                            >
                              Reactivate
                            </button>
                          )}

                          {!isSelf && !isSuper && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              title="Delete account"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer inline-block"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PRE-AUTHORIZED INVITES */}
      {activeTab === 'invites' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pre-Authorized Access Whitelist</h2>
              <p className="text-xs text-slate-500">
                Emails in this whitelist bypass the pending approval queue upon initial Google Sign-In with pre-assigned role & client workspaces.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Email</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Pre-assigned Role</th>
                  <th className="px-4 py-3">Workspaces</th>
                  <th className="px-4 py-3">Authorized By</th>
                  <th className="px-4 py-3 text-right">Revoke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitesList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No pre-authorized invites configured. New users will be placed in the pending approval queue.
                    </td>
                  </tr>
                )}
                {invitesList.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{inv.email}</td>
                    <td className="px-4 py-3">
                      <span className="uppercase text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inv.allowedTenants.includes('*') ? 'All Workspaces (*)' : inv.allowedTenants.join(', ')}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{inv.invitedBy}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRevokeInvite(inv.id, inv.email)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ACCESS POLICIES */}
      {activeTab === 'policies' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-2xl space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Access Control & Registration Rules</h2>
            <p className="text-xs text-slate-500">
              Govern default behavior when any user signs in with Google.
            </p>
          </div>

          <form onSubmit={handleSavePolicies} className="space-y-5 text-xs sm:text-sm">
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyApproval}
                  onChange={(e) => setPolicyApproval(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <div className="font-semibold text-slate-900">Require Admin Approval For New Sign-Ins</div>
                  <div className="text-xs text-slate-500">
                    When enabled, uninvited Google accounts cannot browse metrics until an administrator activates them.
                  </div>
                </div>
              </label>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="block font-semibold text-slate-900">Default Role For Approved Accounts</label>
              <select
                aria-label="Default role"
                value={policyDefaultRole}
                onChange={(e) => setPolicyDefaultRole(e.target.value as any)}
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg text-xs"
              >
                <option value="viewer">Viewer (Read-Only Dashboards)</option>
                <option value="analyst">Analyst (Full Analytics & Filters)</option>
              </select>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="block font-semibold text-slate-900">Corporate Email Domain Whitelist</label>
              <input
                type="text"
                placeholder="bastionflowe.com, partner.com"
                value={policyDomain}
                onChange={(e) => setPolicyDomain(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
              <p className="text-[11px] text-slate-500">
                Comma-separated domains for team auto-classification.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <button
                type="submit"
                disabled={policySaving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-sm disabled:opacity-60"
              >
                {policySaving ? 'Saving Policies…' : 'Save Policies'}
              </button>
              {policySuccess && (
                <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Policies updated successfully!
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Security & Access Audit Trail</h2>
            <p className="text-xs text-slate-500">
              Immutable log of authentication events, privilege grants, and access state changes.
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {auditList.length === 0 && (
              <div className="py-6 text-center text-slate-400">No audit events recorded yet.</div>
            )}
            {auditList.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                      {log.action}
                    </span>
                    <span className="text-slate-900 font-medium">{log.details}</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Actor: <span className="font-semibold">{log.actorEmail}</span>
                    {log.targetEmail && (
                      <> &bull; Target: <span className="font-semibold">{log.targetEmail}</span></>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono shrink-0">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: PRE-AUTHORIZE INVITE */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Pre-Authorize User</h3>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInviteSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-800">Google Account Email</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@bastionflowe.com"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-800">Pre-assigned Role</label>
                <select
                  aria-label="Pre-assigned role"
                  value={newInviteRole}
                  onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="analyst">Analyst (Full Analytics & Reporting)</option>
                  <option value="viewer">Viewer (Read-Only Views)</option>
                  <option value="admin">Administrator (Full Access & User Control)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block font-semibold text-slate-800">Assigned Client Workspaces</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900">
                    <input
                      type="checkbox"
                      checked={newInviteTenants.includes('*')}
                      onChange={(e) => {
                        if (e.target.checked) setNewInviteTenants(['*']);
                        else setNewInviteTenants(['default_tenant']);
                      }}
                      className="rounded text-blue-600"
                    />
                    <span>All Workspaces (*)</span>
                  </label>
                  {!newInviteTenants.includes('*') &&
                    AVAILABLE_TENANTS.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer pl-4 text-slate-700">
                        <input
                          type="checkbox"
                          checked={newInviteTenants.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewInviteTenants((prev) => [...prev, t.id]);
                            } else {
                              setNewInviteTenants((prev) => prev.filter((id) => id !== t.id));
                            }
                          }}
                          className="rounded text-blue-600"
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-sm disabled:opacity-60"
                >
                  {inviteSubmitting ? 'Saving…' : 'Save Pre-Authorization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT WORKSPACE CLIENTS FOR USER */}
      {editingTenantsUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Manage Workspace Scopes</h3>
                <p className="text-xs text-slate-500">{editingTenantsUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTenantsUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 p-2 bg-blue-50/60 rounded-lg border border-blue-100">
                <input
                  type="checkbox"
                  checked={selectedTenants.includes('*')}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedTenants(['*']);
                    else setSelectedTenants(['default_tenant']);
                  }}
                  className="rounded text-blue-600"
                />
                <span>Grant Full Access to All Workspaces (*)</span>
              </label>

              {!selectedTenants.includes('*') && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50/40">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase pb-1">
                    Select Allowed Tenants:
                  </div>
                  {AVAILABLE_TENANTS.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2.5 cursor-pointer py-1 text-slate-700 hover:text-slate-900"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTenants.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTenants((prev) => [...prev, t.id]);
                          } else {
                            setSelectedTenants((prev) => prev.filter((id) => id !== t.id));
                          }
                        }}
                        className="rounded text-blue-600"
                      />
                      <span>{t.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEditingTenantsUser(null)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTenants}
                disabled={tenantSubmitting}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-sm disabled:opacity-60"
              >
                {tenantSubmitting ? 'Saving…' : 'Update Client Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
