import React from 'react';
import { Database, Clock, RefreshCw } from 'lucide-react';
import AppliedScope from '../AppliedScope';

export interface EvidenceScopeBarProps {
  releaseId?: string;
  cutoff?: string;
  busy?: boolean;
}

export default function EvidenceScopeBar({ releaseId, cutoff, busy }: EvidenceScopeBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-2.5 px-4 bg-surface-subtle border border-border rounded-[var(--cx-radius-md)] text-xs mb-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-text-main font-medium">
          <Database className="w-3.5 h-3.5 text-text-sec" />
          <span>Release:</span>
          <span className="font-mono bg-surface px-1.5 py-0.5 rounded border border-border">
            {releaseId || 'Live Telemetry Mode'}
          </span>
        </div>

        {cutoff && (
          <div className="flex items-center gap-1.5 text-text-sec">
            <Clock className="w-3.5 h-3.5 text-text-mute" />
            <span>Cutoff:</span>
            <span className="font-mono">{new Date(cutoff).toLocaleDateString()}</span>
          </div>
        )}

        <AppliedScope />
      </div>

      {busy && (
        <div className="flex items-center gap-1.5 text-action animate-pulse font-medium">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Updating facts...</span>
        </div>
      )}
    </div>
  );
}
