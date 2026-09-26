import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function OperationalError({ message, onRetry, retrying = false }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return <section className="cx-feedback cx-feedback-error" role="alert">
    <AlertTriangle size={20} aria-hidden="true" />
    <div><h2>This view couldn’t be loaded</h2><p>{message}</p><small>Your reporting selection is preserved.</small></div>
    <button type="button" className="cx-button-secondary" onClick={onRetry} disabled={retrying}><RefreshCw size={14} aria-hidden="true" />{retrying ? 'Retrying…' : 'Try again'}</button>
  </section>;
}

export function OperationalEmpty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="cx-feedback cx-feedback-empty"><Inbox size={22} aria-hidden="true" /><div><h3>{title}</h3><p>{children}</p></div></div>;
}

export function OverviewSkeleton() {
  return <div className="cx-overview-skeleton cx-command-loading" role="status" aria-label="Loading overview" aria-busy="true">
    <span className="sr-only">Loading the selected overview…</span>
    <div className="cx-skeleton-metrics" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <div key={index}><i /><b /><i /></div>)}</div>
    <div className="cx-skeleton-panels" aria-hidden="true"><div /><div /></div>
  </div>;
}
