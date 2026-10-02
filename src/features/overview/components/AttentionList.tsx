import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';
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

  return (
    <section className="cx-attention-panel cx-report-panel" aria-label="Exceptions needing attention">
      <div>
        <header className="cx-report-panel-heading">
          <div><h2>Needs attention</h2><p>Measured populations with actionable operational exceptions.</p></div>
          <Link
            to={scoped('/exceptions')}
            className="text-xs font-semibold text-brand-primary hover:underline inline-flex items-center gap-1"
          >
            <span>View all ({items.length})</span>
            <ArrowRight size={12} />
          </Link>
        </header>

        {displayItems.length > 0 ? (
          <ol className="cx-attention-list">
            {displayItems.map((item, index) => (
              <li key={item.id}>
                <Link
                  to={
                    isAdmin
                      ? scoped(`/lead-explorer?drill=${encodeURIComponent(item.id)}`)
                      : scoped(item.path)
                  }
                  data-severity={item.severity}
                  className="cx-attention-row"
                >
                  <span className="cx-attention-rank" aria-hidden="true">{index + 1}</span>
                  <div className="cx-attention-copy">
                    <div className="cx-attention-title">
                      {item.title}
                    </div>
                    <div className="cx-attention-detail">{item.detail}</div>
                  </div>
                  <span className="cx-attention-severity">{item.severity}</span>
                  <span className="cx-attention-value cx-tabular">
                    {formatTableNumber(item.value)}
                  </span>
                  <ChevronRight size={14} className="cx-attention-action" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-center text-xs text-text-mute space-y-1">
            <CheckCircle2 size={24} className="text-semantic-pos mb-1" />
            <span className="font-medium text-text-sec">No active exceptions</span>
            <span>All monitored populations are within normal operational thresholds.</span>
          </div>
        )}
      </div>

      <div className="cx-attention-footer">
        <span>Click item to inspect evidence</span>
        <Link to={scoped('/exceptions')} className="hover:underline text-text-sec font-medium">
          Manage queue →
        </Link>
      </div>
    </section>
  );
}
