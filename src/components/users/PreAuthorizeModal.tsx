import React from 'react';
import { X } from 'lucide-react';
import type { UserRole } from '../../types/auth';
import { AVAILABLE_TENANTS } from './userConstants';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

interface PreAuthorizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  setEmail: (email: string) => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  tenants: string[];
  setTenants: React.Dispatch<React.SetStateAction<string[]>>;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const PreAuthorizeModal: React.FC<PreAuthorizeModalProps> = ({
  isOpen,
  onClose,
  email,
  setEmail,
  role,
  setRole,
  tenants,
  setTenants,
  submitting,
  onSubmit,
}) => {
  const dialogRef = useDialogAccessibility<HTMLDivElement>(Boolean(isOpen), onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Pre-Authorize User"
        className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-base text-slate-900">Pre-Authorize User</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 rounded-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block font-semibold text-slate-800">Google Account Email</label>
            <input
              type="email"
              required
              placeholder="colleague@bastionflowe.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-semibold text-slate-800">Pre-assigned Role</label>
            <select
              aria-label="Pre-assigned role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
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
                  checked={tenants.includes('*')}
                  onChange={(e) => {
                    if (e.target.checked) setTenants(['*']);
                    else setTenants(['default_tenant']);
                  }}
                  className="rounded text-blue-600"
                />
                <span>All Workspaces (*)</span>
              </label>
              {!tenants.includes('*') &&
                AVAILABLE_TENANTS.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer pl-4 text-slate-700">
                    <input
                      type="checkbox"
                      checked={tenants.includes(t.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTenants((prev) => [...prev, t.id]);
                        } else {
                          setTenants((prev) => prev.filter((id) => id !== t.id));
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
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-sm disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save Pre-Authorization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
