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
    <div className="flex flex-wrap items-center justify-between gap-4 py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-lg text-xs mb-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span>Release:</span>
          <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
            {releaseId || 'Live Telemetry Mode'}
          </span>
        </div>

        {cutoff && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Cutoff:</span>
            <span className="font-mono">{new Date(cutoff).toLocaleDateString()}</span>
          </div>
        )}

        <AppliedScope />
      </div>

      {busy && (
        <div className="flex items-center gap-1.5 text-blue-600 animate-pulse font-medium">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Updating facts...</span>
        </div>
      )}
    </div>
  );
}
