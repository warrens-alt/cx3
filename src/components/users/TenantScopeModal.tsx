import React from 'react';
import { X } from 'lucide-react';
import type { UserProfile } from '../../types/auth';
import { AVAILABLE_TENANTS } from './userConstants';

interface TenantScopeModalProps {
  user: UserProfile | null;
  onClose: () => void;
  selectedTenants: string[];
  setSelectedTenants: React.Dispatch<React.SetStateAction<string[]>>;
  submitting: boolean;
  onSave: () => void;
}

export const TenantScopeModal: React.FC<TenantScopeModalProps> = ({
  user,
  onClose,
  selectedTenants,
  setSelectedTenants,
  submitting,
  onSave,
}) => {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Manage Workspace Scopes</h3>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-sm disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Update Client Access'}
          </button>
        </div>
      </div>
    </div>
  );
};
