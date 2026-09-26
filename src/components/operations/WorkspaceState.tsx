import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { PageSkeleton } from '../Skeleton';

export interface WorkspaceStateProps {
  loading?: boolean;
  error?: any;
  missingRelease?: string | null;
  scopeError?: any;
  retry?: () => void;
}

export default function WorkspaceState({ loading, error, missingRelease, scopeError, retry }: WorkspaceStateProps) {
  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-900 mb-6 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3>Error Loading Workspace</h3>
        </div>
        <p className="text-sm">{error.message || String(error)}</p>
        {retry && (
          <button
            onClick={retry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Request
          </button>
        )}
      </div>
    );
  }

  if (scopeError) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 mb-6 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3>Scope Filter Error</h3>
        </div>
        <p className="text-sm">{String(scopeError)}</p>
      </div>
    );
  }

  return null;
}
