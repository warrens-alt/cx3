import React from 'react';
import { ArrowDownRight, ArrowUpRight, ArrowRight, Search } from 'lucide-react';
import type { MarketingRootCauseData } from '../../lib/offernetClient';
type MediaMetric = NonNullable<MarketingRootCauseData['metric']>['id'];

function Delta({ value, unit = '%' }: { value: number | null | undefined; unit?: string }) {
  if (value == null || !Number.isFinite(value)) return null;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`cx-command-change ${value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted'}`}><Icon size={12}/>{value > 0 ? '+' : ''}{value}{unit}</span>;
}

export default function MediaMetricCard({
  label,
  value,
  note,
  delta,
  metric,
  onInvestigate,
  onInspect,
  canCompare,
}: {
  label: string;
  value: string;
  note: string;
  delta?: number | null;
  metric: MediaMetric;
  onInvestigate: (metric: MediaMetric) => void;
  onInspect: () => void;
  canCompare: boolean;
}) {
  return (
    <article className="cx-command-metric cx-metric-card flex flex-col justify-between">
      <div>
        <span>{label}</span>
        <button type="button" className="cx-metric-primary" aria-label={`Inspect evidence: ${label}`} onClick={onInspect}><strong>{value}</strong></button>
        <div><small>{note}</small><Delta value={delta}/></div>
      </div>
        {canCompare && delta != null && Number.isFinite(delta) && value !== "—" && (
        <button
          type="button"
          className="cx-why-btn cx-metric-context-action"
          onClick={() => onInvestigate(metric)}
          title={`Investigate why ${label.toLowerCase()} changed`}
        >
          <span>Why changed?</span>
          <Search size={10} aria-hidden="true" />
        </button>
        )}
      <ArrowRight className="cx-metric-chevron" size={14} aria-hidden="true" />
    </article>
  );
}
