import React from 'react';
import { Database, AlertTriangle } from 'lucide-react';

export function EmptyState({ title = 'No data available', message = 'There are no records matching your current filter criteria.', action }: { title?: string, message?: string, action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[300px] border border-dashed border-border-strong rounded-xl bg-surface/50">
      <div className="w-12 h-12 rounded-full bg-surface-sec flex items-center justify-center text-text-mute mb-4 border border-border-subtle">
        <Database className="w-6 h-6" />
      </div>
      <h3 className="text-[16px] font-medium text-text-main mb-1">{title}</h3>
      <p className="text-[13px] text-text-sec max-w-sm mb-6">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Analysis Unavailable', message = 'The requested query could not be completed.', onRetry }: { title?: string, message?: string, onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[300px] border border-dashed border-semantic-neg-bg rounded-xl bg-semantic-neg-bg/30">
      <div className="w-12 h-12 rounded-full bg-semantic-neg-bg flex items-center justify-center text-semantic-neg mb-4 border border-semantic-neg/20">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-[16px] font-medium text-text-main mb-1">{title}</h3>
      <p className="text-[13px] text-text-sec max-w-sm mb-6">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 bg-surface border border-border-strong rounded text-[13px] font-medium text-text-main hover:bg-surface-sec transition-colors shadow-sm">
          Retry Analysis
        </button>
      )}
    </div>
  );
}
