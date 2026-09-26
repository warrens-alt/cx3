import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  UserCheck,
  Clock,
  Plus,
  CheckCircle,
  AlertTriangle,
  SlidersHorizontal,
  KeyRound,
  History,
  X,
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import type { UserProfile, UserRole, UserStatus, AccessInvite, AuditLogEntry } from '../types/auth';
import { UsersDirectoryTab } from '../components/users/UsersDirectoryTab';
import { AccessInvitesTab } from '../components/users/AccessInvitesTab';
import { AccessPoliciesTab } from '../components/users/AccessPoliciesTab';
import { AuditLogTab } from '../components/users/AuditLogTab';
import { PreAuthorizeModal } from '../components/users/PreAuthorizeModal';
import { TenantScopeModal } from '../components/users/TenantScopeModal';

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
    updatePlatformConfig,
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
            lastLoginAt: new Date().toISOString(),
          },
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
  }, [isAdmin, currentUser]);

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
        allowedDomains: policyDomain.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
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
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
              {pendingCount}
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
        <UsersDirectoryTab
          users={filteredUsers}
          loading={loadingUsers}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          currentUser={currentUser}
          onApprove={handleApproveUser}
          onStatusChange={handleStatusChange}
          onRoleChange={handleRoleChange}
          onDelete={handleDeleteUser}
          onEditTenants={(user) => {
            setEditingTenantsUser(user);
            setSelectedTenants(user.allowedTenants || ['*']);
          }}
        />
      )}

      {/* TAB 2: PRE-AUTHORIZED INVITES */}
      {activeTab === 'invites' && (
        <AccessInvitesTab
          invites={invitesList}
          onOpenInviteModal={() => setInviteModalOpen(true)}
          onRevokeInvite={handleRevokeInvite}
        />
      )}

      {/* TAB 3: ACCESS POLICIES */}
      {activeTab === 'policies' && (
        <AccessPoliciesTab
          policyApproval={policyApproval}
          setPolicyApproval={setPolicyApproval}
          policyDefaultRole={policyDefaultRole}
          setPolicyDefaultRole={setPolicyDefaultRole}
          policyDomain={policyDomain}
          setPolicyDomain={setPolicyDomain}
          policySaving={policySaving}
          policySuccess={policySuccess}
          onSavePolicies={handleSavePolicies}
        />
      )}

      {/* TAB 4: AUDIT LOG */}
      {activeTab === 'audit' && <AuditLogTab auditList={auditList} />}

      {/* MODAL: PRE-AUTHORIZE INVITE */}
      <PreAuthorizeModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        email={newInviteEmail}
        setEmail={setNewInviteEmail}
        role={newInviteRole}
        setRole={setNewInviteRole}
        tenants={newInviteTenants}
        setTenants={setNewInviteTenants}
        submitting={inviteSubmitting}
        onSubmit={handleCreateInviteSubmit}
      />

      {/* MODAL: EDIT WORKSPACE CLIENTS FOR USER */}
      <TenantScopeModal
        user={editingTenantsUser}
        onClose={() => setEditingTenantsUser(null)}
        selectedTenants={selectedTenants}
        setSelectedTenants={setSelectedTenants}
        submitting={tenantSubmitting}
        onSave={handleSaveTenants}
      />
    </div>
  );
}
