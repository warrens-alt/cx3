import React from 'react';
import { Plus } from 'lucide-react';
import type { AccessInvite } from '../../types/auth';
import type { SubscriptionState } from './accessPresentation';

interface AccessInvitesProps {
  invitesList: AccessInvite[];
  inviteState: SubscriptionState;
  handleRevokeInvite: (inviteId: string, email: string) => Promise<void>;
  setInviteModalOpen: (open: boolean) => void;
}

/** Controlled presentation; the access page owns subscriptions and mutations. */
export function AccessInvites({
  invitesList,
  inviteState,
  handleRevokeInvite,
  setInviteModalOpen,
}: AccessInvitesProps) {
  return (
    <div className="bg-surface rounded-lg border border-border-subtle p-5 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border-subtle pb-4">
        <div>
          <h2 className="text-sm font-bold text-text-main">Pre-Authorized Access Whitelist</h2>
          <p className="text-xs text-text-sec">
            Invitations preassign an analyst or viewer role and client workspaces at first Google sign-in. Accounts still require administrator approval; an invitation does not grant administrator authority.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg cx-button-primary text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Email</span>
        </button>
      </div>

      <div className="overflow-x-auto border border-border-subtle rounded-lg">
        <table className="w-full text-left text-xs text-text-sec">
          <thead className="bg-surface-subtle border-b border-border-subtle text-[11px] font-semibold text-text-sec uppercase">
            <tr>
              <th className="px-4 py-3">Email Address</th>
              <th className="px-4 py-3">Pre-assigned Role</th>
              <th className="px-4 py-3">Workspaces</th>
              <th className="px-4 py-3">Authorized By</th>
              <th className="px-4 py-3 text-right">Revoke</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {inviteState !== 'loaded' && <tr><td colSpan={5} className="px-4 py-8 text-center" role={inviteState === 'error' ? 'alert' : 'status'}>{inviteState === 'error' ? 'Invitations unavailable. The subscription failed.' : 'Loading invitations…'}</td></tr>}
            {inviteState === 'loaded' && invitesList.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-mute">
                  No pre-authorized invites configured. New users will be placed in the pending approval queue.
                </td>
              </tr>
            )}
            {invitesList.map((inv) => (
              <tr key={inv.id} className="hover:bg-surface-subtle">
                <td className="px-4 py-3 font-semibold text-text-main">{inv.email}</td>
                <td className="px-4 py-3">
                  <span className="uppercase text-[11px] font-bold px-2 py-0.5 rounded bg-surface-subtle text-text-main">
                    {inv.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {inv.allowedTenants.includes('*') ? 'All Workspaces (*)' : inv.allowedTenants.join(', ')}
                </td>
                <td className="px-4 py-3 text-text-sec">{inv.invitedBy}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleRevokeInvite(inv.id, inv.email)}
                    className="text-xs text-semantic-neg hover:text-semantic-neg font-medium cursor-pointer"
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
}
