import React from 'react';
import { CheckCircle } from 'lucide-react';

interface AccessPoliciesTabProps {
  policyApproval: boolean;
  setPolicyApproval: (approval: boolean) => void;
  policyDefaultRole: 'analyst' | 'viewer';
  setPolicyDefaultRole: (role: 'analyst' | 'viewer') => void;
  policyDomain: string;
  setPolicyDomain: (domain: string) => void;
  policySaving: boolean;
  policySuccess: boolean;
  onSavePolicies: (e: React.FormEvent) => void;
}

export const AccessPoliciesTab: React.FC<AccessPoliciesTabProps> = ({
  policyApproval,
  setPolicyApproval,
  policyDefaultRole,
  setPolicyDefaultRole,
  policyDomain,
  setPolicyDomain,
  policySaving,
  policySuccess,
  onSavePolicies,
}) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-2xl space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-base font-bold text-slate-900">Access Control & Registration Rules</h2>
        <p className="text-xs text-slate-500">
          Govern default behavior when any user signs in with Google.
        </p>
      </div>

      <form onSubmit={onSavePolicies} className="space-y-5 text-xs sm:text-sm">
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
  );
};
