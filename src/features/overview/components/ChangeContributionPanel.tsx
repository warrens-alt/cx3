import React, { useMemo } from 'react';
import { ArrowRight, BarChart3, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Layers, HelpCircle } from 'lucide-react';
import { decomposeOutcomeChange, type OutcomeChangeDecomposition } from '../../../../contracts/periodComparison';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import type { OverviewData } from '../../../lib/offernetClient';
import type { LifecycleExtension } from '../../../../contracts/lifecycleAnalytics';
import { useScopedNavigationTarget } from '../../../hooks/useScopedNavigationTarget';
import type { RootMetric } from '../model/useOverviewModel';

export interface ChangeContributionPanelProps {
  data: OverviewData & LifecycleExtension;
  onInvestigateMetric?: (metric: RootMetric) => void;
  className?: string;
}

export default function ChangeContributionPanel({
  data,
  onInvestigateMetric,
  className = '',
}: ChangeContributionPanelProps) {
  const scoped = useScopedNavigationTarget();
  const comparison = data.comparison;
  const comparisonWindow = data.comparisonWindow;

  // Outcome decomposition for Sales = Fetched Leads × Lead-to-Sale Rate
  const decomposition: OutcomeChangeDecomposition | null = useMemo(() => {
    if (!comparisonWindow || !data.kpis) return null;
    const currentLeads = data.kpis.fetchedLeads;
    const currentSaleRate = data.kpis.leadToSaleRate; // in percent e.g. 8.0
    if (currentLeads == null || currentSaleRate == null) return null;

    // Retrieve prior values from comparison or calculate from deltas
    const currentSales = data.kpis.saleLeads ?? Math.round((currentLeads * currentSaleRate) / 100);

    // Delta of volume in percent e.g. fetchedDelta = +20%
    const fetchedDeltaPct = comparison?.fetchedDelta;
    // Delta of sale rate in pp e.g. saleRateDelta = -2.0 pp
    const saleRateDeltaPp = comparison?.saleRateDelta;

    let priorLeads: number | null = null;
    let priorSaleRatePct: number | null = null;

    // Try finding prior in lifecycle comparisons if available
    const compFetched = (data.lifecycle as any)?.comparisons?.fetched;
    const compSaleRate = (data.lifecycle as any)?.comparisons?.saleRate;
    if (compFetched?.previous != null && compSaleRate?.previous != null) {
      priorLeads = Number(compFetched.previous);
      priorSaleRatePct = Number(compSaleRate.previous);
    } else if (fetchedDeltaPct != null && Number.isFinite(fetchedDeltaPct)) {
      priorLeads = Math.round(currentLeads / (1 + fetchedDeltaPct / 100));
      if (saleRateDeltaPp != null && Number.isFinite(saleRateDeltaPp)) {
        priorSaleRatePct = currentSaleRate - saleRateDeltaPp;
      }
    }

    if (priorLeads == null || priorSaleRatePct == null) return null;

    // Ratios as unrounded fractions (e.g. 0.10, 0.08)
    const r0 = priorSaleRatePct / 100;
    const r1 = currentSaleRate / 100;
    const n0 = priorLeads;
    const n1 = currentLeads;

    return decomposeOutcomeChange(n0, r0, n1, r1);
  }, [data.kpis, comparison, comparisonWindow, data.lifecycle]);

  if (!decomposition || !comparisonWindow) {
    return null;
  }

  const maxMagnitude = Math.max(
    1,
    Math.abs(decomposition.volumeContribution),
    Math.abs(decomposition.rateContribution),
    Math.abs(decomposition.outcomeDelta)
  );

  const volSign = decomposition.volumeContribution >= 0 ? '+' : '';
  const rateSign = decomposition.rateContribution >= 0 ? '+' : '';
  const deltaSign = decomposition.outcomeDelta >= 0 ? '+' : '';

  return (
    <section
      className={`cx-card p-5 space-y-4 ${className}`}
      aria-label="What contributed to the change?"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-text-sec">
            <span className="font-semibold text-action uppercase tracking-wider">Outcome shift analysis</span>
            <span className="text-text-muted" aria-hidden="true">·</span>
            <span className="font-medium text-text-muted">Reconciled decomposition</span>
          </div>
          <h2 className="text-base font-bold text-text-main mt-0.5">
            What contributed to the change?
          </h2>
          <p className="text-xs text-text-sec mt-0.5 max-w-2xl leading-relaxed">
            Order-neutral decomposition of recorded sales shift vs matched period ({comparisonWindow.startDate} – {comparisonWindow.endDate}).
            Separates demand volume shift from operational conversion rate shift without conflating disparate units.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
            {decomposition.status} (Residual: {decomposition.residual.toFixed(2)})
          </span>
        </div>
      </div>

      {/* Visual Contribution Breakdown Rail */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Factor 1: Intake Volume Contribution */}
        <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec">
              <span className="font-semibold text-text-main">Volume shift impact</span>
              <span className="text-[11px] font-mono text-text-muted">ΔN = {formatTableNumber(decomposition.n1 - decomposition.n0)} leads</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <strong className={`text-2xl font-bold font-mono tabular-nums ${decomposition.volumeContribution >= 0 ? 'text-semantic-pos' : 'text-semantic-neg'}`}>
                {volSign}{formatTableNumber(Math.round(decomposition.volumeContribution))}
              </strong>
              <span className="text-xs text-text-sec">sales attributed to lead volume</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-snug">
              Lead intake changed from {formatTableNumber(decomposition.n0)} to {formatTableNumber(decomposition.n1)}.
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border-subtle">
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${decomposition.volumeContribution >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, (Math.abs(decomposition.volumeContribution) / maxMagnitude) * 100)}%` }}
              />
            </div>
            {onInvestigateMetric && (
              <button
                type="button"
                onClick={() => onInvestigateMetric('fetchedLeads')}
                className="text-[11px] font-medium text-action hover:text-action-hover inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Investigate lead volume shift</span>
                <ArrowRight size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Factor 2: Conversion Rate Contribution */}
        <div className="p-3.5 rounded-lg border border-border-subtle bg-surface-subtle flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec">
              <span className="font-semibold text-text-main">Conversion rate impact</span>
              <span className="text-[11px] font-mono text-text-muted">Δr = {((decomposition.r1 - decomposition.r0) * 100).toFixed(1)} pp</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <strong className={`text-2xl font-bold font-mono tabular-nums ${decomposition.rateContribution >= 0 ? 'text-semantic-pos' : 'text-semantic-neg'}`}>
                {rateSign}{formatTableNumber(Math.round(decomposition.rateContribution))}
              </strong>
              <span className="text-xs text-text-sec">sales attributed to conversion efficiency</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-snug">
              Conversion changed from {formatPercent(decomposition.r0 * 100)} to {formatPercent(decomposition.r1 * 100)}.
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border-subtle">
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${decomposition.rateContribution >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, (Math.abs(decomposition.rateContribution) / maxMagnitude) * 100)}%` }}
              />
            </div>
            {onInvestigateMetric && (
              <button
                type="button"
                onClick={() => onInvestigateMetric('leadToSaleRate')}
                className="text-[11px] font-medium text-action hover:text-action-hover inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Investigate conversion rate shift</span>
                <ArrowRight size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Total Outcome Shift */}
        <div className="p-3.5 rounded-lg border border-border-subtle bg-surface flex flex-col justify-between space-y-3 shadow-2xs">
          <div>
            <div className="flex items-center justify-between text-xs text-text-sec">
              <span className="font-semibold text-text-main">Net outcome shift (Sales)</span>
              <span className="text-[11px] font-mono text-text-muted">O1 − O0</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <strong className={`text-2xl font-bold font-mono tabular-nums ${decomposition.outcomeDelta >= 0 ? 'text-semantic-pos' : 'text-semantic-neg'}`}>
                {deltaSign}{formatTableNumber(Math.round(decomposition.outcomeDelta))}
              </strong>
              <span className="text-xs text-text-sec">net change in recorded sales</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-snug">
              Total sales moved from {formatTableNumber(Math.round(decomposition.o0))} to {formatTableNumber(Math.round(decomposition.o1))}.
            </p>
          </div>

          <div className="pt-2 border-t border-border-subtle">
            <span className="text-[11px] font-mono text-text-sec block">
              Sum of components: {volSign}{Math.round(decomposition.volumeContribution)} + ({rateSign}{Math.round(decomposition.rateContribution)}) = {deltaSign}{Math.round(decomposition.sum)}
            </span>
          </div>
        </div>
      </div>

      {/* Reconciled Arithmetic Table */}
      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-subtle border-b border-border-subtle text-text-sec font-semibold">
              <th className="py-2.5 px-3">Decomposition factor</th>
              <th className="py-2.5 px-3">Baseline ({comparisonWindow.startDate})</th>
              <th className="py-2.5 px-3">Current period ({data.comparisonWindow?.endDate ? 'Current' : 'Active'})</th>
              <th className="py-2.5 px-3">Observed factor shift</th>
              <th className="py-2.5 px-3 text-right">Reconciled impact on sales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle font-mono text-text-main">
            <tr>
              <td className="py-2 px-3 font-sans font-medium text-text-main">
                1. Acquired demand volume (N)
              </td>
              <td className="py-2 px-3 tabular-nums">{formatTableNumber(decomposition.n0)} leads</td>
              <td className="py-2 px-3 tabular-nums">{formatTableNumber(decomposition.n1)} leads</td>
              <td className="py-2 px-3 tabular-nums">
                {decomposition.n1 >= decomposition.n0 ? '+' : ''}{formatTableNumber(decomposition.n1 - decomposition.n0)} leads ({(((decomposition.n1 - decomposition.n0) / decomposition.n0) * 100).toFixed(1)}%)
              </td>
              <td className={`py-2 px-3 text-right font-bold tabular-nums ${decomposition.volumeContribution >= 0 ? 'text-semantic-pos' : 'text-semantic-neg'}`}>
                {volSign}{decomposition.volumeContribution.toFixed(1)} sales
              </td>
            </tr>
            <tr>
              <td className="py-2 px-3 font-sans font-medium text-text-main">
                2. Lead-to-sale conversion rate (r)
              </td>
              <td className="py-2 px-3 tabular-nums">{formatPercent(decomposition.r0 * 100)}</td>
              <td className="py-2 px-3 tabular-nums">{formatPercent(decomposition.r1 * 100)}</td>
              <td className="py-2 px-3 tabular-nums">
                {decomposition.r1 >= decomposition.r0 ? '+' : ''}{((decomposition.r1 - decomposition.r0) * 100).toFixed(1)} pp
              </td>
              <td className={`py-2 px-3 text-right font-bold tabular-nums ${decomposition.rateContribution >= 0 ? 'text-semantic-pos' : 'text-semantic-neg'}`}>
                {rateSign}{decomposition.rateContribution.toFixed(1)} sales
              </td>
            </tr>
            <tr className="bg-surface-subtle font-semibold">
              <td className="py-2.5 px-3 font-sans text-text-main">
                Total observed outcome shift (O)
              </td>
              <td className="py-2.5 px-3 tabular-nums">{formatTableNumber(Math.round(decomposition.o0))} sales</td>
              <td className="py-2.5 px-3 tabular-nums">{formatTableNumber(Math.round(decomposition.o1))} sales</td>
              <td className="py-2.5 px-3 tabular-nums">
                {deltaSign}{formatTableNumber(Math.round(decomposition.outcomeDelta))} sales
              </td>
              <td className={`py-2.5 px-3 text-right font-bold tabular-nums ${decomposition.outcomeDelta >= 0 ? 'text-semantic-pos' : 'text-semantic-neg'}`}>
                {deltaSign}{decomposition.sum.toFixed(1)} sales
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <span>Methodology: {decomposition.method}</span>
        <span className="font-mono text-[10px]">Unrounded ratios preserved</span>
      </div>
    </section>
  );
}
