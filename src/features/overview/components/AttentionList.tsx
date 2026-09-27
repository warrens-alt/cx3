import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { formatTableNumber } from '../../../lib/formatters';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';

export interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  value: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  path: string;
}

interface AttentionListProps {
  items?: AttentionItem[];
  isAdmin: boolean;
}

export default function AttentionList({ items = [], isAdmin }: AttentionListProps) {
  const scoped = useScopedNavigationTarget();
  const displayItems = items.slice(0, 5);

  const severityDot = (sev: string) => {
    switch (sev) {
      case 'critical':
      case 'high':
        return 'bg-semantic-neg';
      case 'medium':
        return 'bg-semantic-warn';
      default:
        return 'bg-brand-primary';
    }
  };

  return (
    <section className="cx-card p-5 flex flex-col justify-between" aria-label="Exceptions needing attention">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={16} className="text-semantic-warn shrink-0" aria-hidden="true" />
            <h2 className="text-base font-bold text-text-main">Needs attention</h2>
          </div>
          <Link
            to={scoped('/exceptions')}
            className="text-xs font-semibold text-brand-primary hover:underline inline-flex items-center gap-1"
          >
            <span>View all ({items.length})</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        <p className="text-xs text-text-sec mb-4">
          Measured populations with actionable operational exceptions.
        </p>

        {displayItems.length > 0 ? (
          <ul className="space-y-2.5" role="list">
            {displayItems.map(item => (
              <li key={item.id}>
                <Link
                  to={
                    isAdmin
                      ? scoped(`/lead-explorer?drill=${encodeURIComponent(item.id)}`)
                      : scoped(item.path)
                  }
                  className="p-2.5 rounded-lg border border-border-subtle bg-surface-subtle hover:bg-surface-sec hover:border-brand-primary/40 transition-colors flex items-center justify-between gap-3 text-xs group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${severityDot(item.severity)}`} />
                    <div className="min-w-0">
                      <div className="font-semibold text-text-main truncate group-hover:text-brand-primary">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-text-mute truncate">{item.detail}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-sm cx-tabular text-text-main">
                      {formatTableNumber(item.value)}
                    </span>
                    <ChevronRight size={14} className="text-text-mute group-hover:text-brand-primary transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-center text-xs text-text-mute space-y-1">
            <CheckCircle2 size={24} className="text-semantic-pos mb-1" />
            <span className="font-medium text-text-sec">No active exceptions</span>
            <span>All monitored populations are within normal operational thresholds.</span>
          </div>
        )}
      </div>

      <div className="pt-3 mt-4 border-t border-border-subtle text-[11px] text-text-mute flex items-center justify-between">
        <span>Click item to inspect evidence</span>
        <Link to={scoped('/exceptions')} className="hover:underline text-text-sec font-medium">
          Manage queue →
        </Link>
      </div>
    </section>
  );
}
