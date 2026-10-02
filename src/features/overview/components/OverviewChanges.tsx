import React from 'react';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import type { RootMetric } from '../model/useOverviewModel';

export interface OverviewChange { label: string; value: number | null; unit: string; metric: RootMetric }

export default function OverviewChanges({ changes, hasComparison, comparisonWindow, onInvestigate }: {
  changes: OverviewChange[];
  hasComparison: boolean;
  comparisonWindow?: { startDate: string; endDate: string } | null;
  onInvestigate: (metric: RootMetric) => void;
}) {
  return <section aria-label="Meaningful outcome changes" className="cx-change-rail cx-report-panel">
    <header className="cx-report-panel-heading"><div><h2>What changed?</h2>
      <p>{hasComparison && comparisonWindow ? `Compared with ${comparisonWindow.startDate} – ${comparisonWindow.endDate}.` : 'Changes use a returned comparison for the selected reporting scope.'}</p>
    </div></header>
    {hasComparison && changes.length > 0 ? <ol className="cx-overview-change-list">
      {changes.map((change, index) => {
        const value = Number(change.value);
        const Icon = value > 0 ? TrendingUp : value === 0 ? ArrowRight : TrendingDown;
        return <li key={change.label}><button type="button" onClick={() => onInvestigate(change.metric)} title={`Investigate ${change.label} shift`}>
          <span className="cx-overview-change-rank" aria-hidden="true">{index + 1}</span><span className="cx-overview-change-label">{change.label}</span>
          <strong className={value > 0 ? 'text-semantic-pos' : value === 0 ? 'text-text-mute' : 'text-semantic-neg'}><Icon size={13} aria-hidden="true" />{value > 0 ? '+' : ''}{change.value}{change.unit}</strong>
          <span className="cx-overview-change-action">Why? <ArrowRight size={12} aria-hidden="true" /></span>
        </button></li>;
      })}
    </ol> : <p className="cx-overview-comparison-empty">{hasComparison ? 'Outcome changes are unavailable for this comparison.' : 'Comparison evidence is unavailable for the selected reporting scope.'}</p>}
  </section>;
}
