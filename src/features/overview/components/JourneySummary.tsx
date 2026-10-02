import React from 'react';
import { lifecyclePresentation, type LifecycleStage } from '../../../shared/visuals/lifecyclePresentation';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Info } from 'lucide-react';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';

export interface FunnelStageItem {
  key: string;
  name: string;
  volume: number | null;
  transitionRate?: number | null;
  loss?: number | null;
}

export interface JourneySummaryProps {
  stages?: FunnelStageItem[];
  funnelLeak?: { from: string; to: string; loss: number; rate: number | null };
  isAdmin: boolean;
  onInspectStage?: (stage: FunnelStageItem, index: number) => void;
  onInspectLoss?: (from: string, to: string, loss: number, lossKey: string) => void;
}

const stagePresentation: Record<string, { label: string; series: string }> = {
  fetched: { label: 'Fetched', series: 'fetched' },
  delivered: { label: 'Delivered', series: 'delivered' },
  dialled: { label: 'Dialled', series: 'dialled' },
  rpc: { label: 'RPC', series: 'rpc' },
  sales: { label: 'Recorded sale', series: 'sales' },
  activated: { label: 'Activated', series: 'activation' },
};
const lossKeys = new Set(['fetched-to-delivered', 'delivered-to-dialled', 'dialled-to-rpc', 'rpc-to-sales', 'sales-to-activated']);
const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const labelFor = (stage: FunnelStageItem) => stagePresentation[stage.key]?.label || stage.name;

export default function JourneySummary({ stages = [], funnelLeak, isAdmin, onInspectStage, onInspectLoss }: JourneySummaryProps) {
  const scoped = useScopedNavigationTarget();
  // Scale the independent marks only. Stage counts and supplied transition evidence remain unchanged.
  const maxVolume = Math.max(0, ...stages.flatMap(stage => finite(stage.volume) ? [stage.volume] : []));
  const transitions = stages.slice(1).flatMap((stage, offset) => {
    const previous = stages[offset];
    const key = `${previous.key}-to-${stage.key}`;
    return finite(stage.loss) ? [{ previous, stage, loss: stage.loss, key }] : [];
  });
  const hasLeak = funnelLeak && finite(funnelLeak.loss);

  return (
    <section className="cx-overview-journey" aria-label="Lead-to-activation journey and lifecycle progression">
      <header className="cx-overview-journey-heading">
        <div><h2>Lead journey</h2><p>Independently observed stages; each bar uses the same count scale.</p></div>
        <Link to={scoped('/funnel')}>Explore journey <ArrowRight size={13} aria-hidden="true" /></Link>
      </header>

      {stages.length ? <ol className="cx-overview-lifecycle-rail" aria-label="Lifecycle stage progression">
        {stages.map((stage, index) => {
          const label = labelFor(stage);
          const Icon = lifecyclePresentation[stage.key as LifecycleStage]?.Icon;
          const hasVolume = finite(stage.volume);
          const width = hasVolume && maxVolume > 0 ? Math.max(0, stage.volume / maxVolume * 100) : 0;
          const count = <>{formatTableNumber(stage.volume)}</>;
          return <li key={stage.key} data-series={stagePresentation[stage.key]?.series} data-stage={stage.key}>
            <div className="cx-overview-stage-heading">
              <span>{Icon && <Icon size={15} aria-hidden="true" />} {label}</span>
              {onInspectStage && <Info size={14} aria-hidden="true" />}
            </div>
            {onInspectStage ? <button type="button" className="cx-metric-primary cx-overview-stage-count" onClick={() => onInspectStage(stage, index)} aria-label={`Inspect ${label} evidence: ${formatTableNumber(stage.volume)}`}>{count}</button>
              : <strong className="cx-overview-stage-count">{count}</strong>}
            <div className="cx-overview-stage-track" data-evidence={!hasVolume ? 'unavailable' : stage.volume === 0 ? 'zero' : 'observed'} aria-hidden="true">
              {hasVolume && <span style={{ width: `${width}%` }} />}
            </div>
            <p className="cx-overview-stage-context">{index === 0 ? 'Intake population' : finite(stage.transitionRate) ? `${formatPercent(stage.transitionRate)} from prior stage` : 'Transition rate unavailable'}</p>
            {index < stages.length - 1 && <ChevronRight className="cx-overview-stage-arrow" size={15} aria-hidden="true" />}
          </li>;
        })}
      </ol> : <p className="cx-overview-journey-empty">No lifecycle counts are supplied for this scope.</p>}

      {(transitions.length > 0 || hasLeak) && <details className="cx-overview-transition-evidence">
        <summary>Transition evidence</summary>
        <p>Returned transition counts describe leads that did not progress. They are separate from the independently observed stage totals above.</p>
        {hasLeak && <p><strong>Largest measured leakage:</strong> {funnelLeak.from} → {funnelLeak.to}: {formatTableNumber(funnelLeak.loss)} leads. {finite(funnelLeak.rate) ? `${formatPercent(funnelLeak.rate)} progressed.` : 'Progression rate unavailable.'}</p>}
        {transitions.length > 0 && <ul>{transitions.map(({ previous, stage, loss, key }) => <li key={key}>
          <span>{labelFor(previous)} → {labelFor(stage)}</span>
          <strong>{formatTableNumber(loss)} leads</strong>
          {lossKeys.has(key) && onInspectLoss && <button type="button" onClick={() => onInspectLoss(previous.name, stage.name, loss, key)} aria-label={`Inspect ${labelFor(previous)} to ${labelFor(stage)} loss evidence`}>Inspect evidence <ArrowRight size={12} aria-hidden="true" /></button>}
        </li>)}</ul>}
      </details>}
    </section>
  );
}
