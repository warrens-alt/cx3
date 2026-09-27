import React, { useState } from 'react';
import { formatKpiValue, formatTableNumber } from '../../lib/formatters';
import { ChartToolbar } from './ChartToolbar';
import { Layers, BarChart2, TrendingDown, ArrowRight } from 'lucide-react';

export interface FunnelStep {
  label: string;
  value: number;
  rate?: number; // relative to previous or overall
  dropoff?: number;
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

export function FunnelWaterfall({ 
  title, 
  subtitle, 
  steps, 
  auditTitle, 
  auditContext, 
  auditGrain 
}: FunnelWaterfallProps) {
  const [viewMode, setViewMode] = useState<'bars' | 'flow'>('bars');

  if (!steps || steps.length === 0) return null;
  
  const maxVal = Math.max(...steps.map(s => s.value)) || 1;
  const topOfFunnel = steps[0]?.value ?? 0;
  const bottomOfFunnel = steps[steps.length - 1]?.value || 0;
  const overallConversionPct = topOfFunnel > 0 ? ((bottomOfFunnel / topOfFunnel) * 100).toFixed(1) + '%' : 'Unavailable';

  // Find the stage with the highest absolute drop-off
  let maxDropoffStage = '';
  let maxDropoffVal = 0;
  for (let i = 1; i < steps.length; i++) {
    const drop = steps[i - 1].value - steps[i].value;
    if (drop > maxDropoffVal) {
      maxDropoffVal = drop;
      maxDropoffStage = `${steps[i - 1].label} → ${steps[i].label}`;
    }
  }

  return (
    <div className="enterprise-card p-5 h-full flex flex-col">
      <ChartToolbar 
        visualData={steps}
        title={title} 
        subtitle={subtitle} 
        auditTitle={auditTitle} 
        auditContext={auditContext} 
        auditGrain={auditGrain} 
      >
        <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('bars')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded transition-colors ${
              viewMode === 'bars' 
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-2xs font-semibold' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Waterfall Bars"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Bars</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('flow')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium rounded transition-colors ${
              viewMode === 'flow' 
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-2xs font-semibold' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Flow Progression"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Flow</span>
          </button>
        </div>
      </ChartToolbar>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Stage ratios describe observed population progression across conversion milestones.
      </p>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 bg-slate-50/80 dark:bg-slate-900/60 p-3.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
        <div className="bg-white dark:bg-slate-800 p-2.5 rounded border border-slate-100 dark:border-slate-700/80 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            End-to-End Conversion
          </span>
          <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-lg tabular-nums">
            {overallConversionPct}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">{steps[steps.length - 1]?.label || 'Terminal'} / {steps[0]?.label || 'Inbound'}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 p-2.5 rounded border border-slate-100 dark:border-slate-700/80 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Total Funnel Fall-off
          </span>
          <span className="font-bold text-rose-700 dark:text-rose-400 font-mono text-lg tabular-nums">
            {formatKpiValue(topOfFunnel - bottomOfFunnel)}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">Leads dropped before {steps[steps.length - 1]?.label || 'conversion'}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 p-2.5 rounded border border-slate-100 dark:border-slate-700/80 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Highest Drop Milestone
          </span>
          <span className="font-bold text-slate-900 dark:text-slate-100 block truncate text-sm mt-0.5" title={maxDropoffStage}>
            {maxDropoffStage || 'None recorded'}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">Primary conversion bottleneck</span>
        </div>
      </div>
      
      {viewMode === 'bars' ? (
        <div className="flex-1 flex flex-col justify-between py-1 space-y-3.5 overflow-y-auto">
          {steps.map((step, idx) => {
            const isFirst = idx === 0;
            const pctOfMax = (step.value / maxVal) * 100;
            const pctOfTop = topOfFunnel > 0 ? ((step.value / topOfFunnel) * 100).toFixed(1) + '% of first stage' : 'First-stage denominator unavailable';
            const dropoffFromPrev = idx > 0 ? steps[idx - 1].value - step.value : 0;
            const retentionRate = idx > 0 && steps[idx - 1].value > 0
              ? ((step.value / steps[idx - 1].value) * 100).toFixed(1)
              : null;
            
            // Color progression: Deep Navy -> Ocean Blue -> Vibrant Emerald for terminal
            const barBg = step.isTerminal 
              ? 'bg-emerald-600' 
              : idx === 0 
                ? 'bg-[#0F1E2E]' 
                : idx < 4 
                  ? 'bg-[#1E3A52]' 
                  : 'bg-[#315BCB]';

            const isBarWide = pctOfMax > 18;
            const costCode = step.costMetric;

            return (
              <div key={step.label} className="relative flex items-center group">
                <div className="w-44 shrink-0 pr-3">
                  <div className="text-xs font-semibold text-text-main leading-snug flex items-center gap-1.5 truncate" title={step.label}>
                    <span className="truncate">{step.label}</span>
                    {costCode && (
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        · {costCode}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-mute font-mono">
                    {pctOfTop}
                  </div>
                </div>
                
                <div className="flex-1 h-9 relative flex items-center bg-surface-sec/70 rounded-lg overflow-hidden">
                  <div 
                    className={`h-full rounded-lg transition-all duration-500 ease-out ${barBg}`} 
                    style={{ width: `${Math.max(pctOfMax, 2)}%` }}
                  />
                  <div className={`absolute ${isBarWide ? 'left-3 text-white' : 'left-[calc(2%+8px)] text-text-main'} font-semibold text-xs drop-shadow-xs z-10 flex items-center gap-1.5 tabular-nums`}>
                    <span>{formatTableNumber(step.value)}</span>
                  </div>
                </div>

                {!isFirst && dropoffFromPrev > 0 && (
                  <div className="ml-3 w-32 shrink-0 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 font-mono whitespace-nowrap">
                      <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                      -{formatKpiValue(dropoffFromPrev)}
                    </span>
                    {retentionRate && (
                      <span className="block text-xs text-text-mute mt-0.5 tabular-nums">
                        {retentionRate}% of previous
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flow Progression Cards View */
        <div className="flex-1 flex flex-col justify-between py-2 space-y-2.5 overflow-y-auto">
          {steps.map((step, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === steps.length - 1;
            const dropoffFromPrev = idx > 0 ? steps[idx - 1].value - step.value : 0;
            const stepConv = idx > 0 && steps[idx - 1].value > 0
              ? ((step.value / steps[idx - 1].value) * 100).toFixed(1)
              : null;

            const costCode = step.costMetric;

            return (
              <div key={step.label} className="relative flex flex-col">
                <div className={`p-3.5 rounded-lg border transition-all ${
                  step.isTerminal 
                    ? 'bg-emerald-50/70 border-emerald-200' 
                    : 'bg-surface border-border-subtle hover:border-[#315BCB]/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-surface-sec text-text-sec text-xs font-mono font-bold flex items-center justify-center border border-border-subtle">
                        {idx + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-text-main">{step.label}</span>
                      {costCode && (
                        <span className="text-[10px] font-mono text-slate-500">
                          · {costCode}
                        </span>
                      )}
                      {step.isTerminal && (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 font-mono">
                          · Terminal Conversion
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-text-main">
                        {formatTableNumber(step.value)}
                      </span>
                      <span className="text-xs text-text-mute ml-1.5 font-mono">
                        ({topOfFunnel > 0 ? ((step.value / topOfFunnel) * 100).toFixed(1) + '% of first stage' : 'Unavailable'})
                      </span>
                    </div>
                  </div>

                  {!isFirst && (
                    <div className="mt-2.5 pt-2 border-t border-border-subtle/50 flex items-center justify-between text-xs">
                      <span className="text-text-sec">
                        Relative to previous stage: <strong className="text-[#315EAD] font-mono">{stepConv === null ? 'Unavailable' : stepConv + '%'}</strong>
                      </span>
                      {dropoffFromPrev > 0 && (
                        <span className="text-rose-600 font-mono font-medium">
                          Stage decrease: {formatTableNumber(dropoffFromPrev)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {!isLast && (
                  <div className="flex justify-center my-0.5 text-text-mute">
                    <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
