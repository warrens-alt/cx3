import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GitFork, Info, ChevronRight } from 'lucide-react';
import { FunnelWaterfall } from '../../../components/charts/FunnelWaterfall';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';

export interface FunnelStageItem {
  key: string;
  name: string;
  volume: number;
  transitionRate?: number | null;
  loss?: number | null;
}

export interface JourneySummaryProps {
  stages?: FunnelStageItem[];
  funnelLeak?: {
    from: string;
    to: string;
    loss: number;
    rate: number;
  };
  isAdmin: boolean;
  onInspectStage?: (stage: FunnelStageItem, index: number) => void;
  onInspectLoss?: (from: string, to: string, loss: number, lossKey: string) => void;
}

const fmt = (v: number | string | null | undefined) => formatTableNumber(v);
const stageLabel = (name: string) => (name === 'RPC' ? 'Contacted' : name);

const LOSS_KEYS = [
  'fetched-to-delivered',
  'delivered-to-dialled',
  'dialled-to-rpc',
  'rpc-to-sales',
  'sales-to-activated',
];

export default function JourneySummary({
  stages = [],
  funnelLeak,
  isAdmin,
  onInspectStage,
  onInspectLoss,
}: JourneySummaryProps) {
  const scoped = useScopedNavigationTarget();

  return (
    <section className="cx-card p-5" aria-label="Lead-to-activation journey and lifecycle progression">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-text-main">Lead-to-activation journey</h2>
          <p className="text-xs text-text-sec mt-0.5">
            Follow leads from intake to activation across independently observed lifecycle stages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <span className="text-xs text-text-mute hidden sm:inline">
              Select any stage or loss to inspect records
            </span>
          )}
          <Link
            to={scoped('/funnel')}
            className="text-xs font-semibold text-brand-primary hover:underline inline-flex items-center gap-1"
          >
            <span>Deep funnel analysis</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Stage Progression Bar */}
      <div
        className="flex items-center gap-2 overflow-x-auto py-2 my-2 scrollbar-none"
        role="region"
        aria-label="Lifecycle stage progression"
        tabIndex={0}
      >
        {stages.map((stage, index) => {
          const lossKey = LOSS_KEYS[index];
          const hasLoss = index < stages.length - 1 && stages[index + 1]?.loss != null;
          const nextLoss = stages[index + 1]?.loss;

          const stageCard = (
            <div className="flex-1 min-w-[130px] p-3 rounded-lg bg-surface-subtle border border-border-subtle hover:border-brand-primary/40 transition-colors flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-text-mute uppercase tracking-wider group-hover:text-text-main">
                  {stageLabel(stage.name)}
                </span>
                {onInspectStage && (
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onInspectStage(stage, index);
                    }}
                    className="text-text-mute hover:text-brand-primary p-0.5 rounded cursor-pointer"
                    title={`Inspect ${stageLabel(stage.name)} evidence`}
                  >
                    <Info size={12} />
                  </button>
                )}
              </div>
              <div className="text-xl font-bold cx-tabular text-text-main mt-1">
                {fmt(stage.volume)}
              </div>
              {index > 0 && stage.transitionRate != null ? (
                <div className="text-[11px] text-text-sec mt-0.5">
                  {formatPercent(stage.transitionRate)} from prior
                </div>
              ) : (
                <div className="text-[11px] text-text-mute mt-0.5">Intake population</div>
              )}
            </div>
          );

          return (
            <React.Fragment key={stage.key}>
              {isAdmin ? (
                <Link
                  to={scoped(`/lead-explorer?drill=funnel-stage&drillValue=${encodeURIComponent(stage.key)}`)}
                  className="flex-1 min-w-[130px] block focus:outline-none"
                  title={`Inspect ${stageLabel(stage.name)} lead records`}
                >
                  {stageCard}
                </Link>
              ) : onInspectStage ? (
                <div
                  onClick={() => onInspectStage(stage, index)}
                  className="flex-1 min-w-[130px] cursor-pointer"
                >
                  {stageCard}
                </div>
              ) : (
                stageCard
              )}

              {/* Arrow and Dropoff indicator between stages */}
              {index < stages.length - 1 && (
                <div className="flex flex-col items-center justify-center shrink-0 px-1 text-text-mute">
                  {isAdmin && hasLoss ? (
                    <Link
                      to={scoped(`/lead-explorer?drill=funnel-loss&drillValue=${encodeURIComponent(lossKey)}`)}
                      className="inline-flex flex-col items-center hover:text-semantic-neg transition-colors p-1 rounded"
                      title={`Inspect ${stageLabel(stage.name)} → ${stageLabel(stages[index + 1]?.name)} dropoff records`}
                    >
                      <ArrowRight size={14} />
                      <span className="text-[10px] font-semibold text-semantic-neg cx-tabular">
                        −{fmt(nextLoss)}
                      </span>
                    </Link>
                  ) : onInspectLoss && hasLoss ? (
                    <button
                      type="button"
                      onClick={() =>
                        onInspectLoss(
                          stageLabel(stage.name),
                          stageLabel(stages[index + 1]?.name),
                          Number(nextLoss || 0),
                          lossKey
                        )
                      }
                      className="inline-flex flex-col items-center hover:text-semantic-neg transition-colors p-1 rounded cursor-pointer"
                      title={`Inspect ${stageLabel(stage.name)} → ${stageLabel(stages[index + 1]?.name)} dropoff`}
                    >
                      <ArrowRight size={14} />
                      <span className="text-[10px] font-semibold text-semantic-neg cx-tabular">
                        −{fmt(nextLoss)}
                      </span>
                    </button>
                  ) : (
                    <>
                      <ArrowRight size={14} />
                      {nextLoss != null && (
                        <span className="text-[10px] font-semibold text-semantic-neg cx-tabular">
                          −{fmt(nextLoss)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Largest Loss Indicator */}
      {funnelLeak && (
        <div className="my-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-text-main">
          <div className="flex items-center gap-2">
            <GitFork size={15} className="text-semantic-warn shrink-0" />
            <span>
              <strong>Largest measured leakage: </strong>
              {stageLabel(funnelLeak.from)} → {stageLabel(funnelLeak.to)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-semantic-neg cx-tabular">−{fmt(funnelLeak.loss)} lost</span>
            <span className="text-text-mute">({formatPercent(funnelLeak.rate)} progressed)</span>
            {isAdmin && (
              <Link
                to={scoped('/lead-explorer?drill=funnel-loss')}
                className="text-brand-primary hover:underline font-medium inline-flex items-center gap-0.5"
              >
                <span>Inspect</span>
                <ChevronRight size={12} />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recharts Waterfall Chart */}
      {stages.length > 1 && (
        <div className="mt-4 pt-4 border-t border-border-subtle">
          <FunnelWaterfall
            title="Lifecycle Stage Waterfall"
            subtitle={
              funnelLeak
                ? `Largest dropoff: ${stageLabel(funnelLeak.from)} → ${stageLabel(funnelLeak.to)} (${fmt(funnelLeak.loss)} leads)`
                : 'Observed progression and dropoff counts in the current scope.'
            }
            steps={stages.map(stage => ({
              label: stageLabel(stage.name),
              value: stage.volume,
              rate: stage.transitionRate ?? undefined,
              dropoff: stage.loss ?? undefined,
            }))}
          />
        </div>
      )}
    </section>
  );
}
