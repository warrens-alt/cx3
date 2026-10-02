import React from 'react';
import LifecyclePath from '../../../shared/visuals/LifecyclePath';
import { ArrowRight, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { LifecycleTransition } from '../../../../contracts/lifecycleAnalytics';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import type { JourneyStageItem } from '../model/journeyAdapter';

export type StageItem = JourneyStageItem;

interface JourneyProgressionProps {
  stages?: StageItem[];
  transitions?: LifecycleTransition[];
  totalPopulation?: number | null;
  onInspectStage?: (stage: StageItem) => void;
  onInspectTransition?: (from: string, to: string, lost: number, lossKey: string) => void;
}

const LOSS_KEYS: Record<string, string> = {
  'Capture → Delivery': 'fetched-to-delivered',
  'Delivery → Dial': 'delivered-to-dialled',
  'Dial → RPC': 'dialled-to-rpc',
  'RPC → Sale': 'rpc-to-sales',
  'Sale → Activation': 'sales-to-activated',
};

export default function JourneyProgression({
  stages = [],
  transitions = [],
  onInspectStage,
  onInspectTransition,
}: JourneyProgressionProps) {
  if ((!stages || stages.length === 0) && (!transitions || transitions.length === 0)) {
    return (
      <div className="p-6 bg-surface rounded-xl border border-border-subtle text-center text-text-sec text-sm">
        Lifecycle progression data is unavailable for the selected reporting period.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LifecyclePath stages={stages} transitions={transitions}
        onSelectStage={onInspectStage ? key => { const stage = stages.find(item => item.key === key); if (stage) onInspectStage(stage); } : undefined}
        onSelectTransition={onInspectTransition ? (transition, key) => onInspectTransition(transition.from, transition.to, transition.lost!, key) : undefined}
      />

      {/* 2. Transition Definitions Table */}
      {transitions.length > 0 && (
        <details className="cx-report-disclosure">
          <summary>View exact transition evidence</summary>
          <div className="px-5 py-3.5 border-b border-border-subtle bg-surface-sec flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider">
                Observed Transition Evidence
              </h3>
              <p className="text-xs text-text-sec mt-0.5">
                Exact leads meeting both boundary stage events. Null or unrecorded outcomes are not proven failures.
              </p>
            </div>
          </div>

          <div className="cx-viz-table-scroll overflow-x-auto" role="region" aria-label="Transition evidence table" tabIndex={0}>
            <table className="cx-viz-table w-full text-left text-xs border-collapse"><caption className="sr-only">Observed transition evidence. Lost leads means no recorded progression, not a confirmed failure.</caption>
              <thead>
                <tr className="border-b border-border-subtle bg-surface-subtle/40 text-text-mute font-semibold">
                  <th scope="col" className="px-4 py-2.5">Transition Stage</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Prior Base</th>
                  <th scope="col" className="px-4 py-2.5 text-right">With Both Events</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Conversion Rate</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Lost Leads</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Loss Rate</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Prior Δ</th>
                  <th scope="col" className="px-4 py-2.5">Observation Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-text-main">
                {transitions.map((t) => {
                  const lossKey = LOSS_KEYS[`${t.from} → ${t.to}`] || `${t.from.toLowerCase()}-to-${t.to.toLowerCase()}`;
                  const isLostKnown = t.lost !== null && t.lost !== undefined;
                  const hasLoss = isLostKnown && (t.lost as number) > 0;

                  return (
                    <tr key={`${t.from}-${t.to}`} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span>{t.from}</span>
                          <ArrowRight size={12} className="text-text-mute" />
                          <span>{t.to}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right cx-tabular font-medium">
                        {t.population !== null && t.population !== undefined ? formatTableNumber(t.population) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right cx-tabular font-bold text-text-main">
                        {t.converted !== null && t.converted !== undefined ? formatTableNumber(t.converted) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right cx-tabular font-semibold text-brand-primary">
                        {t.conversionRate !== null && t.conversionRate !== undefined ? formatPercent(t.conversionRate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right cx-tabular font-medium text-amber-700 dark:text-amber-400">
                        {!isLostKnown ? '—' : hasLoss ? `−${formatTableNumber(t.lost as number)}` : '0'}
                      </td>
                      <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                        {t.lossRate !== null && t.lossRate !== undefined ? formatPercent(t.lossRate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right cx-tabular text-text-mute">
                        {t.deteriorationPp !== null && t.deteriorationPp !== undefined
                          ? `${t.deteriorationPp > 0 ? '+' : ''}${t.deteriorationPp.toFixed(1)} pp`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {t.status === 'NON_NESTED' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300">
                            <AlertCircle size={11} />
                            Non-nested
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 size={11} />
                            Observed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasLoss && onInspectTransition && (
                          <button
                            type="button"
                            onClick={() => onInspectTransition(t.from, t.to, t.lost as number, lossKey)}
                            className="px-2.5 py-1 text-[11px] font-medium text-brand-primary hover:bg-brand-soft rounded transition-colors cursor-pointer"
                          >
                            Inspect loss
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
