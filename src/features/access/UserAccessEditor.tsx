import React from 'react';
import { X } from 'lucide-react';
import type { UserProfile, UserRole } from '../../types/auth';
import { AVAILABLE_TENANTS } from './accessPresentation';

interface AccessInviteEditorProps {
  setInviteModalOpen: (open: boolean) => void;
  newInviteEmail: string;
  setNewInviteEmail: (value: string) => void;
  newInviteRole: UserRole;
  setNewInviteRole: (value: UserRole) => void;
  newInviteTenants: string[];
  setNewInviteTenants: React.Dispatch<React.SetStateAction<string[]>>;
  inviteSubmitting: boolean;
  handleCreateInviteSubmit: (event: React.FormEvent) => Promise<void>;
}

/** Controlled presentation; the access page owns subscriptions and mutations. */
export function AccessInviteEditor({
  setInviteModalOpen,
  newInviteEmail,
  setNewInviteEmail,
  newInviteRole,
  setNewInviteRole,
  newInviteTenants,
  setNewInviteTenants,
  inviteSubmitting,
  handleCreateInviteSubmit,
}: AccessInviteEditorProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-lg max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h3 className="font-bold text-base text-text-main">Pre-Authorize User</h3>
          <button
            type="button"
            onClick={() => setInviteModalOpen(false)}
            className="text-text-mute hover:text-text-sec"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreateInviteSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block font-semibold text-text-main">Google Account Email</label>
            <input
              type="email"
              required
              placeholder="colleague@bastionflowe.com"
              value={newInviteEmail}
              onChange={(e) => setNewInviteEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border-strong rounded-lg text-xs bg-surface text-text-main"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-semibold text-text-main">Pre-assigned Role</label>
            <select
              aria-label="Pre-assigned role"
              value={newInviteRole}
              onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-border-strong rounded-lg text-xs bg-surface text-text-main"
            >
              <option value="analyst">Analyst (Full Analytics & Reporting)</option>
              <option value="viewer">Viewer (Read-Only Views)</option>
              <option value="admin">Administrator request (starts as Analyst)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block font-semibold text-text-main">Assigned Client Workspaces</label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto border border-border-subtle rounded-lg p-2.5 bg-surface-subtle">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-text-main">
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
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer pl-4 text-text-sec">
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

          <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setInviteModalOpen(false)}
              className="px-3 py-2 rounded-lg border border-border-subtle text-text-sec font-medium hover:bg-surface-subtle cursor-pointer"
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
  );
}


interface UserAccessEditorProps {
  editingTenantsUser: UserProfile;
  setEditingTenantsUser: (user: UserProfile | null) => void;
  selectedTenants: string[];
  setSelectedTenants: React.Dispatch<React.SetStateAction<string[]>>;
  tenantSubmitting: boolean;
  handleSaveTenants: () => Promise<void>;
}

/** Controlled presentation; the access page owns subscriptions and mutations. */
export function UserAccessEditor({
  editingTenantsUser,
  setEditingTenantsUser,
  selectedTenants,
  setSelectedTenants,
  tenantSubmitting,
  handleSaveTenants,
}: UserAccessEditorProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div>
            <h3 className="font-bold text-base text-text-main">Manage Workspace Scopes</h3>
            <p className="text-xs text-text-sec">{editingTenantsUser.email}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditingTenantsUser(null)}
            className="text-text-mute hover:text-text-sec"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-text-main p-2 bg-selected-bg rounded-lg border border-border-subtle">
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
            <div className="space-y-1.5 max-h-56 overflow-y-auto border border-border-subtle rounded-lg p-3 bg-surface-subtle">
              <div className="text-[11px] font-semibold text-text-sec uppercase pb-1">
                Select Allowed Tenants:
              </div>
              {AVAILABLE_TENANTS.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2.5 cursor-pointer py-1 text-text-sec hover:text-text-main"
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

        <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => setEditingTenantsUser(null)}
            className="px-3 py-2 rounded-lg border border-border-subtle text-text-sec font-medium hover:bg-surface-subtle cursor-pointer"
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
  );
}
