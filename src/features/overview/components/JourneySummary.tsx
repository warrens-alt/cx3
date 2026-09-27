import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GitFork, ExternalLink } from 'lucide-react';
import { FunnelWaterfall } from '../../../components/charts/FunnelWaterfall';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';

interface FunnelStageItem {
  key: string;
  name: string;
  volume: number;
  transitionRate?: number | null;
  loss?: number | null;
}

interface JourneySummaryProps {
  stages?: FunnelStageItem[];
  funnelLeak?: {
    from: string;
    to: string;
    loss: number;
    rate: number;
  };
  isAdmin: boolean;
}

const fmt = (v: number | string | null | undefined) => formatTableNumber(v);
const stageLabel = (name: string) => (name === 'RPC' ? 'Contacted' : name);

export default function JourneySummary({ stages = [], funnelLeak, isAdmin }: JourneySummaryProps) {
  const scoped = useScopedNavigationTarget();
  const lossKeys = ['fetched-to-delivered', 'delivered-to-dialled', 'dialled-to-rpc', 'rpc-to-sales', 'sales-to-activated'];

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
        {stages.map((stage, index) => (
          <React.Fragment key={stage.key}>
            <div className="flex-1 min-w-[130px] p-3 rounded-lg bg-surface-subtle border border-border-subtle hover:border-brand-primary/40 transition-colors">
              <div className="text-[11px] font-semibold text-text-mute uppercase tracking-wider">
                {stageLabel(stage.name)}
              </div>
              <div className="text-xl font-bold cx-tabular text-text-main mt-1">
                {fmt(stage.volume)}
              </div>
              {index > 0 && stage.transitionRate != null && (
                <div className="text-[11px] text-text-sec mt-0.5">
                  {formatPercent(stage.transitionRate)} from prior
                </div>
              )}
            </div>

            {index < stages.length - 1 && (
              <div className="flex flex-col items-center justify-center shrink-0 px-1 text-text-mute">
                <ArrowRight size={14} />
                {stage.loss != null && (
                  <span className="text-[10px] font-semibold text-semantic-neg cx-tabular">
                    −{fmt(stage.loss)}
                  </span>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Largest Loss Indicator */}
      {funnelLeak && (
        <div className="my-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-text-main">
          <div className="flex items-center gap-2">
            <GitFork size={15} className="text-semantic-warn" />
            <span>
              <strong>Largest measured leakage: </strong>
              {stageLabel(funnelLeak.from)} → {stageLabel(funnelLeak.to)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-semantic-neg cx-tabular">−{fmt(funnelLeak.loss)} lost</span>
            <span className="text-text-mute">({formatPercent(funnelLeak.rate)} progressed)</span>
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
