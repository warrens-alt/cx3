import React, { useState } from 'react';
import ChartFrame from './ChartFrame';
import ReportingScopeSummary from '../reporting/ReportingScopeSummary';
import { AlertTriangle, ArrowRight, CircleHelp } from 'lucide-react';
import type { LifecycleTransition } from '../../../contracts/lifecycleAnalytics';
import { formatPercent, formatTableNumber } from '../../lib/formatters';
import { evidenceBarWidth } from './EvidenceBars';
import { lifecyclePresentation, type LifecycleStage } from './lifecyclePresentation';

export interface LifecyclePopulation { key: LifecycleStage; name?: string; volume: number | null | undefined }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const transitionStage: Record<string, LifecycleStage> = { Capture: 'fetched', Fetched: 'fetched', Delivery: 'delivered', Delivered: 'delivered', Dial: 'dialled', Dialled: 'dialled', RPC: 'rpc', Sale: 'sales', Sales: 'sales', Activation: 'activated', Activated: 'activated' };

export function LifecycleNode({ stage, maximum, onSelect, selected = false }: { stage: LifecyclePopulation; maximum: number; onSelect?: () => void; selected?: boolean }) {
  const presentation = lifecyclePresentation[stage.key];
  const Icon = presentation.Icon;
  const width = evidenceBarWidth(stage.volume, maximum);
  const content = <><span className="cx-lifecycle-node-heading"><span className="cx-lifecycle-node-icon"><Icon size={18} aria-hidden="true" /></span><span className="cx-lifecycle-node-label">{presentation.label}</span></span>
    <strong>{width === null ? 'Unavailable' : formatTableNumber(stage.volume)}</strong>
    <span className="cx-lifecycle-node-track" aria-hidden="true" data-state={width === null ? 'unknown' : width === 0 ? 'zero' : 'observed'}>{width !== null && <span style={{ width: `${width}%` }} />}</span></>;
  return onSelect ? <button type="button" className="cx-lifecycle-node" onClick={onSelect} aria-pressed={selected} aria-label={`Inspect ${stage.name || presentation.label}: ${width === null ? 'Unavailable' : formatTableNumber(stage.volume)}`}>{content}</button> : <div className="cx-lifecycle-node">{content}</div>;
}

export default function LifecyclePath({ title = 'Lead lifecycle populations', stages, transitions = [], compact = false, onSelectStage, onSelectTransition, action }: {
  title?: string; stages: LifecyclePopulation[]; transitions?: LifecycleTransition[]; compact?: boolean;
  onSelectStage?: (key: LifecycleStage) => void;
  onSelectTransition?: (transition: LifecycleTransition, lossKey: string) => void;
  action?: React.ReactNode;
}) {
  const [selectedStage, setSelectedStage] = useState<LifecycleStage | null>(null);
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null);
  const maximum = Math.max(0, ...stages.flatMap(stage => finite(stage.volume) ? [stage.volume] : []));
  return <ChartFrame title={title} subtitle="Independent populations · qualified transitions" actions={action} focusable={!compact} scope={<ReportingScopeSummary/>}
    className={`cx-lifecycle-path${compact ? ' is-compact' : ' cx-analytical-canvas'}`}>
    {!stages.length ? <p className="cx-viz-empty">No lifecycle counts are supplied.</p> : <ol className="cx-lifecycle-path-stages">
      {stages.map((stage, index) => {
        const next = stages[index + 1];
        const transition = next ? transitions.find(item => transitionStage[item.from] === stage.key && transitionStage[item.to] === next.key) : undefined;
        const known = transition && finite(transition.population) && finite(transition.converted);
        const state = transition?.status === 'NON_NESTED' ? 'non-nested' : known ? 'observed' : 'unavailable';
        const width = known ? evidenceBarWidth(transition.converted, transition.population) : null;
        const validWidth = width !== null && transition!.population > 0 && transition!.converted <= transition!.population;
        return <li key={stage.key} data-stage={stage.key} data-selected={selectedStage === stage.key || undefined} data-transition={next ? state : undefined} style={{ '--cx-stage-color': lifecyclePresentation[stage.key].color } as React.CSSProperties}>
          <LifecycleNode stage={stage} maximum={maximum} selected={selectedStage === stage.key} onSelect={onSelectStage ? () => { setSelectedStage(stage.key); setSelectedTransition(null); onSelectStage(stage.key); } : undefined} />
          {next && <div className="cx-lifecycle-connection" data-state={state} data-selected={selectedTransition === `${stage.key}-to-${next.key}` || undefined}>
            <span className="cx-lifecycle-connection-rule" aria-hidden="true"><ArrowRight size={13} /></span>
            <div className="cx-lifecycle-connection-heading"><span>To {lifecyclePresentation[next.key].label}</span><strong>{finite(transition?.conversionRate) ? formatPercent(transition.conversionRate) : 'Unavailable'}</strong></div>
            {known && <><span className="cx-lifecycle-intersection">{formatTableNumber(transition.converted)} of {formatTableNumber(transition.population)} with both events</span>
              {!compact && <span className="cx-transition-track" aria-hidden="true" data-state={validWidth ? 'observed' : 'unknown'}>{validWidth && <span style={{ width: `${width}%`, background: lifecyclePresentation[next.key].color }} />}</span>}
              {!compact && (finite(transition.lost) ? transition.lost > 0 && onSelectTransition ? <button type="button" className="cx-lifecycle-loss" aria-pressed={selectedTransition === `${stage.key}-to-${next.key}`} onClick={() => { setSelectedTransition(`${stage.key}-to-${next.key}`); setSelectedStage(null); onSelectTransition(transition, `${stage.key}-to-${next.key}`); }} aria-label={`Inspect ${transition.from} to ${transition.to}: ${transition.lost} without progression`}>{formatTableNumber(transition.lost)} no recorded progression <ArrowRight size={12} aria-hidden="true" /></button> : <span className="cx-lifecycle-loss">{formatTableNumber(transition.lost)} no recorded progression</span> : <span className="cx-lifecycle-loss">No progression count unavailable</span>)}</>}
            {state === 'non-nested' && <small className="cx-lifecycle-state"><AlertTriangle size={12} aria-hidden="true" />{compact ? 'Non-nested' : 'Non-nested: downstream recorded events also exist outside this qualified transition.'}</small>}
            {state === 'unavailable' && <small className="cx-lifecycle-state"><CircleHelp size={12} aria-hidden="true" />Transition intersections are unavailable.</small>}
          </div>}
        </li>;
      })}
    </ol>}
    {(selectedStage || selectedTransition) && <p className="cx-selection-summary" role="status">Selected · {selectedStage ? lifecyclePresentation[selectedStage].label : selectedTransition?.split('-to-').map(key => lifecyclePresentation[key as LifecycleStage].label).join(' → ')}</p>}
    {!compact && <details className="cx-visual-methodology"><summary>How to read this path</summary><p>Stage bars share a count scale. These populations do not form a guaranteed sequential funnel; a recorded sale does not prove a recorded RPC. Connectors show qualified transition evidence.</p></details>}
  </ChartFrame>;
}
