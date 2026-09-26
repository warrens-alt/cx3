import React from 'react';
import { Plus } from 'lucide-react';
import type { AccessInvite } from '../../types/auth';

interface AccessInvitesTabProps {
  invites: AccessInvite[];
  onOpenInviteModal: () => void;
  onRevokeInvite: (id: string, email: string) => void;
}

export const AccessInvitesTab: React.FC<AccessInvitesTabProps> = ({
  invites,
  onOpenInviteModal,
  onRevokeInvite,
}) => {
  return (
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
          onClick={onOpenInviteModal}
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
            {invites.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No pre-authorized invites configured. New users will be placed in the pending approval queue.
                </td>
              </tr>
            )}
            {invites.map((inv) => (
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
                    onClick={() => onRevokeInvite(inv.id, inv.email)}
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
  );
};
