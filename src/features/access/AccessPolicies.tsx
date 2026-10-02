import React from 'react';
import { CheckCircle } from 'lucide-react';

interface AccessPoliciesProps {
  policyApproval: boolean;
  setPolicyApproval: (value: boolean) => void;
  policyDefaultRole: 'analyst' | 'viewer';
  setPolicyDefaultRole: (value: 'analyst' | 'viewer') => void;
  policyDomain: string;
  setPolicyDomain: (value: string) => void;
  policySaving: boolean;
  policySuccess: boolean;
  handleSavePolicies: (event: React.FormEvent) => Promise<void>;
}

/** Controlled presentation; the access page owns subscriptions and mutations. */
export function AccessPolicies({
  policyApproval,
  setPolicyApproval,
  policyDefaultRole,
  setPolicyDefaultRole,
  policyDomain,
  setPolicyDomain,
  policySaving,
  policySuccess,
  handleSavePolicies,
}: AccessPoliciesProps) {
  return (
    <div className="bg-surface rounded-lg border border-border-subtle shadow-sm p-6 max-w-2xl space-y-6">
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-base font-bold text-text-main">Access Control & Registration Rules</h2>
        <p className="text-xs text-text-sec">
          Draft policy values. The current saved policy is not loaded here. Verify the intended settings before saving; these defaults are not evidence of the active policy.
        </p>
      </div>

      <form onSubmit={handleSavePolicies} className="space-y-5 text-xs sm:text-sm">
        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={policyApproval}
              onChange={(e) => setPolicyApproval(e.target.checked)}
              className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-border-strong"
            />
            <div>
              <div className="font-semibold text-text-main">Require Admin Approval For New Sign-Ins</div>
              <div className="text-xs text-text-sec">
                When enabled, uninvited Google accounts cannot browse metrics until an administrator activates them.
              </div>
            </div>
          </label>
        </div>

        <div className="space-y-1.5 pt-2">
          <label className="block font-semibold text-text-main">Default Role For Approved Accounts</label>
          <select
            aria-label="Default role"
            value={policyDefaultRole}
            onChange={(e) => setPolicyDefaultRole(e.target.value as 'analyst' | 'viewer')}
            className="w-full max-w-xs px-3 py-2 border border-border-strong rounded-lg text-xs bg-surface text-text-main"
          >
            <option value="viewer">Viewer (Read-Only Dashboards)</option>
            <option value="analyst">Analyst (Full Analytics & Filters)</option>
          </select>
        </div>

        <div className="space-y-1.5 pt-2">
          <label className="block font-semibold text-text-main">Corporate Email Domain Whitelist</label>
          <input
            type="text"
            placeholder="bastionflowe.com, partner.com"
            value={policyDomain}
            onChange={(e) => setPolicyDomain(e.target.value)}
            className="w-full px-3 py-2 border border-border-strong rounded-lg text-xs bg-surface text-text-main"
          />
          <p className="text-[11px] text-text-sec">
            Comma-separated domains for team auto-classification.
          </p>
        </div>

        <div className="pt-4 border-t border-border-subtle flex items-center gap-3">
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
}
