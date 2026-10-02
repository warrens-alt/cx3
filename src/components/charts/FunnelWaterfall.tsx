import React, { useState } from 'react';
import { formatPercent, formatTableNumber } from '../../lib/formatters';
import { ChartToolbar } from './ChartToolbar';
import { Layers, BarChart2 } from 'lucide-react';
import { evidenceBarWidth } from '../../shared/visuals/EvidenceBars';

export interface FunnelStep {
  label: string;
  value: number | null;
  population?: number | null;
  rate?: number | null;
  dropoff?: number | null;
  evidence?: string;
  isTerminal?: boolean;
  costMetric?: string;
  metric?: string;
  itemNo?: number;
}

interface FunnelWaterfallProps {
  title: string;
  subtitle?: string;
  auditTitle?: string;
  auditContext?: any;
  auditGrain?: string;
  steps: FunnelStep[];
}

/** Each row is a supplied transition intersection, not an adjacent nested stage count. */
export function FunnelWaterfall({ title, subtitle, steps, auditTitle, auditContext, auditGrain }: FunnelWaterfallProps) {
  const [viewMode, setViewMode] = useState<'bars' | 'flow'>('bars');
  const maxValue = Math.max(1, ...steps.flatMap(step => step.value != null && Number.isFinite(step.value) && step.value >= 0 ? [step.value] : []));

  return <div className="enterprise-card p-5 h-full flex flex-col">
    <ChartToolbar visualData={steps} title={title} subtitle={subtitle} auditTitle={auditTitle} auditContext={auditContext} auditGrain={auditGrain}>
      <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-0.5 text-xs" role="group" aria-label="Transition evidence view">
        <button type="button" onClick={() => setViewMode('bars')} aria-pressed={viewMode === 'bars'} className="inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded" title="Transition bars"><BarChart2 className="w-3.5 h-3.5"/><span>Bars</span></button>
        <button type="button" onClick={() => setViewMode('flow')} aria-pressed={viewMode === 'flow'} className="inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded" title="Transition evidence cards"><Layers className="w-3.5 h-3.5"/><span>Flow</span></button>
      </div>
    </ChartToolbar>
    {!steps.length ? <p className="text-xs text-text-mute py-8">No transition evidence supplied for this scope.</p> : <>
      <p className="text-xs text-text-mute mb-4">Each transition uses its own supplied parent population, qualified intersection, rate and loss. Independent stage populations may overlap differently; adjacent rows do not establish an end-to-end conversion or total loss.</p>
      <div className="flex-1 flex flex-col gap-3">
        {steps.map(step => {
          const width = evidenceBarWidth(step.value, maxValue);
          return <article key={step.label} className="rounded-lg border border-border-subtle bg-surface p-3" aria-label={step.label}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><strong className="text-xs text-text-main">{step.label}</strong>{step.costMetric && <span className="text-xs text-text-mute ml-2">{step.costMetric}</span>}</div>
              <span className="text-xs font-mono text-text-main">Qualified intersection: {formatTableNumber(step.value)}</span>
            </div>
            {viewMode === 'bars' && <div className="h-3 my-3 rounded bg-surface-sec overflow-hidden" data-evidence-state={width === null ? 'unavailable' : step.value === 0 ? 'zero' : 'observed'}>
              {width !== null && <div className="h-full bg-[#315BCB] rounded" style={{ width: `${width}%` }}/>}
            </div>}
            <dl className={`grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-text-mute ${viewMode === 'flow' ? 'mt-3' : ''}`}>
              <div><dt>Parent population</dt><dd className="font-mono text-text-main">{formatTableNumber(step.population)}</dd></div>
              <div><dt>Supplied conversion rate</dt><dd className="font-mono text-text-main">{step.rate == null ? 'Unavailable' : formatPercent(step.rate)}</dd></div>
              <div><dt>Supplied transition loss</dt><dd className="font-mono text-text-main">{step.dropoff == null ? 'Unavailable' : formatTableNumber(step.dropoff)}</dd></div>
            </dl>
            {step.evidence && <p className="text-xs text-text-mute mt-2">{step.evidence}</p>}
          </article>;
        })}
      </div>
    </>}
  </div>;
}
