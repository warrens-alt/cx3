import React from 'react';
import type { AuditLogEntry } from '../../types/auth';
import type { SubscriptionState } from './accessPresentation';

interface AccessAuditLogProps {
  auditList: AuditLogEntry[];
  auditState: SubscriptionState;
}

/** Controlled presentation; the access page owns subscriptions and mutations. */
export function AccessAuditLog({
  auditList,
  auditState,
}: AccessAuditLogProps) {
  return (
    <div className="bg-surface rounded-lg border border-border-subtle shadow-sm p-5 space-y-4">
      <div className="border-b border-border-subtle pb-3">
        <h2 className="text-sm font-bold text-text-main">Security & Access Audit Trail</h2>
        <p className="text-xs text-text-sec">
          Immutable log of authentication events, privilege grants, and access state changes.
        </p>
      </div>

      <div className="divide-y divide-border-subtle text-xs">
        {auditState !== 'loaded' && <p role={auditState === 'error' ? 'alert' : 'status'}>{auditState === 'error' ? 'Audit log unavailable. The subscription failed.' : 'Loading audit log…'}</p>}
        {auditState === 'loaded' && auditList.length === 0 && (
          <div className="py-6 text-center text-text-mute">No audit events recorded yet.</div>
        )}
        {auditList.map((log) => (
          <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-subtle text-text-main">
                  {log.action}
                </span>
                <span className="text-text-main font-medium">{log.details}</span>
              </div>
              <div className="text-text-sec text-[11px]">
                Actor: <span className="font-semibold">{log.actorEmail}</span>
                {log.targetEmail && (
                  <> &bull; Target: <span className="font-semibold">{log.targetEmail}</span></>
                )}
              </div>
            </div>
            <div className="text-[11px] text-text-mute font-mono shrink-0">
              {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
