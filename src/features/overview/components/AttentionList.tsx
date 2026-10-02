import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronRight, CircleHelp } from 'lucide-react';
import { formatTableNumber } from '../../../lib/formatters';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';
import { investigationReasonFor } from '../../../../contracts/investigation';

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

export default function AttentionList({ items }: AttentionListProps) {
  const scoped = useScopedNavigationTarget();
  const supplied = Array.isArray(items);
  const displayItems = (items || []).slice(0, 5);

  return (
    <section className="cx-attention-panel cx-report-panel" aria-label="Exceptions needing attention">
      <div>
        <header className="cx-report-panel-heading">
          <div><h2>Needs attention</h2><p>Measured populations with actionable operational exceptions.</p></div>
          <Link
            to={scoped('/investigate')}
            className="text-xs font-semibold text-brand-primary hover:underline inline-flex items-center gap-1"
          >
            <span>{supplied ? `View all (${items.length})` : 'Open inbox'}</span>
            <ArrowRight size={12} />
          </Link>
        </header>

        {displayItems.length > 0 ? (
          <ol className="cx-attention-list">
            {displayItems.map((item, index) => (
              <li key={item.id}>
                <Link
                  to={scoped(investigationReasonFor(item.id) ? `/investigate?drill=${encodeURIComponent(item.id)}` : '/investigate')}
                  aria-label={investigationReasonFor(item.id) ? `Investigate ${item.title}: ${formatTableNumber(item.value)} affected leads` : `Open investigation inbox for ${item.title}`}
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
            {supplied ? <CheckCircle2 size={24} className="text-text-mute mb-1" aria-hidden="true" /> : <CircleHelp size={24} className="text-text-mute mb-1" aria-hidden="true" />}
            <span className="font-medium text-text-sec">{supplied ? 'No affected exceptions returned' : 'Exception evidence unavailable'}</span>
            <span>{supplied ? 'The returned checks do not identify an affected population in this scope.' : 'The Overview response did not supply an exception population.'}</span>
          </div>
        )}
      </div>

      <div className="cx-attention-footer">
        <span>Select an exception to investigate its population</span>
        <Link to={scoped('/investigate')} className="hover:underline text-text-sec font-medium">
          Investigation inbox →
        </Link>
      </div>
    </section>
  );
}
