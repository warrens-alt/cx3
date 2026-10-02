import React from 'react';
import { Search, X, Shield, Mail, Clock, UserX, Check, Trash2 } from 'lucide-react';
import type { UserProfile, UserRole, UserStatus } from '../../types/auth';
import { AVAILABLE_TENANTS } from './accessPresentation';

interface UserDirectoryProps {
  currentUserId: string | undefined;
  filteredUsers: UserProfile[];
  loadingUsers: boolean;
  directoryError: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: 'all' | UserStatus;
  setStatusFilter: (value: 'all' | UserStatus) => void;
  roleFilter: 'all' | UserRole;
  setRoleFilter: (value: 'all' | UserRole) => void;
  handleRoleChange: (user: UserProfile, role: UserRole) => Promise<void>;
  handleStatusChange: (user: UserProfile, status: UserStatus) => Promise<void>;
  handleApproveUser: (user: UserProfile) => Promise<void>;
  handleDeleteUser: (user: UserProfile) => Promise<void>;
  onEditTenants: (user: UserProfile) => void;
}

/** Controlled presentation; the access page owns subscriptions and mutations. */
export function UserDirectory({
  currentUserId,
  filteredUsers,
  loadingUsers,
  directoryError,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  roleFilter,
  setRoleFilter,
  handleRoleChange,
  handleStatusChange,
  handleApproveUser,
  handleDeleteUser,
  onEditTenants,
}: UserDirectoryProps) {
  return (
    <div className="bg-surface rounded-lg border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4 sm:p-5">
      {/* Controls bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="Search loaded user directory"
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
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-surface"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="pending">Pending Approval</option>
            <option value="suspended">Suspended Only</option>
          </select>

          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-surface"
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

            {directoryError && <tr><td colSpan={6} className="px-4 py-8 text-center" role="alert">User directory unavailable. Account roles and access scopes could not be loaded.</td></tr>}
            {!loadingUsers && !directoryError && filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No users match the search filter.
                </td>
              </tr>
            )}

            {!loadingUsers &&
              filteredUsers.map((user) => {
                const isSelf = user.uid === currentUserId;
                const isSuper = user.email.toLowerCase() === 'warrens@bastionflowe.com';
                const allowed = user.allowedTenants || [];
                const tenantScopeReported = Array.isArray(user.allowedTenants);
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
                          className="px-2.5 py-1 border border-slate-200 rounded-md text-xs font-semibold bg-surface cursor-pointer hover:border-slate-300"
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
                        {!tenantScopeReported ? <span>Not reported</span> : hasAllTenants ? (
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
                          onClick={() => onEditTenants(user)}
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
                        : 'Not reported'}
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
  );
}
