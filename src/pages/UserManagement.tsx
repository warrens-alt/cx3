import AnalyticsPageLayout from '../components/AnalyticsPageLayout';
import React, { useState, useEffect } from 'react';
import { Users, Shield, UserCheck, Clock, Plus, CheckCircle, AlertTriangle, SlidersHorizontal, KeyRound, History, X } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import type { UserProfile, UserRole, UserStatus, AccessInvite, AuditLogEntry } from '../types/auth';
import { UserDirectory } from '../features/access/UserDirectory';
import { AccessInvites } from '../features/access/AccessInvites';
import { AccessPolicies } from '../features/access/AccessPolicies';
import { AccessAuditLog } from '../features/access/AccessAuditLog';
import { AccessInviteEditor, UserAccessEditor } from '../features/access/UserAccessEditor';
import type { SubscriptionState } from '../features/access/accessPresentation';

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
  const [directoryError, setDirectoryError] = useState(false);
  const [inviteState, setInviteState] = useState<SubscriptionState>('loading');
  const [auditState, setAuditState] = useState<SubscriptionState>('loading');
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
        setDirectoryError(false);
        setUsersList(users);
        setLoadingUsers(false);
      },
      (error) => {
        console.warn('User directory sync notice:', error);
        setUsersList([]);
        setDirectoryError(true);
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
        setInviteState('loaded');
      },
      (error) => {
        console.warn('Invites subscription notice:', error);
        setInvitesList([]);
        setInviteState('error');
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
        setAuditState('loaded');
      },
      (error) => {
        console.warn('Audit subscription notice:', error);
        setAuditList([]);
        setAuditState('error');
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
        <div className="w-12 h-12 rounded-full bg-semantic-neg-bg text-semantic-neg flex items-center justify-center mx-auto">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-text-main">Administrator Access Required</h1>
        <p className="text-sm text-text-sec">
          Only authorized platform administrators can manage user accounts and access governance policies.
        </p>
      </div>
    );
  }

  return (
    <AnalyticsPageLayout className="cx-access-control-page" title="Access control" description="Manage authenticated Google accounts, role permissions, client tenant scopes, and access requests." actions={
      <button type="button" onClick={() => setInviteModalOpen(true)} className="cx-button-primary">
        <Plus className="w-4 h-4" /><span>Pre-Authorize User</span>
      </button>
    }>
      {actionNotice && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between transition-all ${
            actionNotice.type === 'success'
              ? 'bg-semantic-pos-bg text-semantic-pos border border-semantic-pos/30'
              : 'bg-semantic-neg-bg text-semantic-neg border border-semantic-neg/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-semantic-pos" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-semantic-neg" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 hover:bg-surface-sec rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface p-4 rounded-lg border border-border-subtle space-y-1 hover:border-border-strong transition-all">
          <div className="flex items-center justify-between text-text-sec text-[11px] font-semibold uppercase tracking-wider">
            <span>Total Accounts</span>
            <Users className="w-3.5 h-3.5 text-text-mute" />
          </div>
          <div className="text-2xl font-bold text-text-main font-sans tabular-nums">{loadingUsers ? '…' : directoryError ? 'Unavailable' : totalUsers}</div>
          <p className="text-[10.5px] text-text-sec font-sans">Registered Google accounts</p>
        </div>

        <div className="bg-surface p-4 rounded-lg border border-border-subtle space-y-1 hover:border-border-strong transition-all">
          <div className="flex items-center justify-between text-text-sec text-[11px] font-semibold uppercase tracking-wider">
            <span>Active Users</span>
            <UserCheck className="w-3.5 h-3.5 text-semantic-pos" />
          </div>
          <div className="text-2xl font-bold text-semantic-pos font-sans tabular-nums">{loadingUsers ? '…' : directoryError ? 'Unavailable' : activeCount}</div>
          <p className="text-[10.5px] text-text-sec font-sans">Currently authorized</p>
        </div>

        <button type="button"
          onClick={() => {
            setActiveTab('users');
            setStatusFilter('pending');
          }}
          className={`bg-surface p-4 rounded-lg border  space-y-1 cursor-pointer transition-all ${
            pendingCount > 0 ? 'border-semantic-warn/30 bg-semantic-warn-bg hover:border-semantic-warn' : 'border-border-subtle hover:border-border-strong'
          }`}
        >
          <div className="flex items-center justify-between text-text-sec text-[11px] font-semibold uppercase tracking-wider">
            <span>Pending Approvals</span>
            <Clock className={`w-3.5 h-3.5 ${pendingCount > 0 ? 'text-semantic-warn animate-pulse' : 'text-text-mute'}`} />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold font-sans tabular-nums ${pendingCount > 0 ? 'text-semantic-warn' : 'text-text-main'}`}>
              {loadingUsers ? '…' : directoryError ? 'Unavailable' : pendingCount}
            </span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9.5px] font-semibold bg-semantic-warn-bg text-semantic-warn rounded font-sans">
                ACTION REQUIRED
              </span>
            )}
          </div>
          <p className="text-[10.5px] text-text-sec font-sans">Awaiting access grant</p>
        </button>

        <div className="bg-surface p-4 rounded-lg border border-border-subtle space-y-1 hover:border-border-strong transition-all">
          <div className="flex items-center justify-between text-text-sec text-[11px] font-semibold uppercase tracking-wider">
            <span>Administrators</span>
            <Shield className="w-3.5 h-3.5 text-action" />
          </div>
          <div className="text-2xl font-bold text-action font-sans tabular-nums">{loadingUsers ? '…' : directoryError ? 'Unavailable' : adminCount}</div>
          <p className="text-[10.5px] text-text-sec font-sans">Full platform authority</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border-subtle flex flex-wrap gap-4 text-xs sm:text-sm font-semibold">
        <button
          type="button"
          aria-pressed={activeTab === 'users'}
          onClick={() => setActiveTab('users')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'users'
              ? 'border-action text-action font-bold'
              : 'border-transparent text-text-sec hover:text-text-main'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory ({directoryError ? 'Unavailable' : loadingUsers ? '…' : usersList.length})</span>
          {pendingCount > 0 && (
            <span className="text-[11px] font-semibold text-semantic-warn font-sans">
              ({loadingUsers ? '…' : directoryError ? 'Unavailable' : pendingCount} pending)
            </span>
          )}
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'invites'}
          onClick={() => setActiveTab('invites')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'invites'
              ? 'border-action text-action font-bold'
              : 'border-transparent text-text-sec hover:text-text-main'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Pre-Authorized Invites ({inviteState === 'loaded' ? invitesList.length : inviteState === 'error' ? 'Unavailable' : '…'})</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'policies'}
          onClick={() => setActiveTab('policies')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'policies'
              ? 'border-action text-action font-bold'
              : 'border-transparent text-text-sec hover:text-text-main'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Access Policies</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'audit'}
          onClick={() => setActiveTab('audit')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'audit'
              ? 'border-action text-action font-bold'
              : 'border-transparent text-text-sec hover:text-text-main'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Log ({auditState === 'loaded' ? auditList.length : auditState === 'error' ? 'Unavailable' : '…'})</span>
        </button>
      </div>

      {activeTab === 'users' && (
        <UserDirectory currentUserId={currentUser?.uid} filteredUsers={filteredUsers}
          loadingUsers={loadingUsers} directoryError={directoryError}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          roleFilter={roleFilter} setRoleFilter={setRoleFilter}
          handleRoleChange={handleRoleChange} handleStatusChange={handleStatusChange}
          handleApproveUser={handleApproveUser} handleDeleteUser={handleDeleteUser}
          onEditTenants={(user) => {
            setEditingTenantsUser(user);
            setSelectedTenants(user.allowedTenants || ['*']);
          }} />
      )}
      {activeTab === 'invites' && (
        <AccessInvites invitesList={invitesList} inviteState={inviteState}
          handleRevokeInvite={handleRevokeInvite} setInviteModalOpen={setInviteModalOpen} />
      )}
      {activeTab === 'policies' && (
        <AccessPolicies policyApproval={policyApproval} setPolicyApproval={setPolicyApproval}
          policyDefaultRole={policyDefaultRole} setPolicyDefaultRole={setPolicyDefaultRole}
          policyDomain={policyDomain} setPolicyDomain={setPolicyDomain}
          policySaving={policySaving} policySuccess={policySuccess} handleSavePolicies={handleSavePolicies} />
      )}
      {activeTab === 'audit' && <AccessAuditLog auditList={auditList} auditState={auditState} />}
      {inviteModalOpen && (
        <AccessInviteEditor setInviteModalOpen={setInviteModalOpen}
          newInviteEmail={newInviteEmail} setNewInviteEmail={setNewInviteEmail}
          newInviteRole={newInviteRole} setNewInviteRole={setNewInviteRole}
          newInviteTenants={newInviteTenants} setNewInviteTenants={setNewInviteTenants}
          inviteSubmitting={inviteSubmitting} handleCreateInviteSubmit={handleCreateInviteSubmit} />
      )}
      {editingTenantsUser && (
        <UserAccessEditor editingTenantsUser={editingTenantsUser} setEditingTenantsUser={setEditingTenantsUser}
          selectedTenants={selectedTenants} setSelectedTenants={setSelectedTenants}
          tenantSubmitting={tenantSubmitting} handleSaveTenants={handleSaveTenants} />
      )}
    </AnalyticsPageLayout>
  );
}
