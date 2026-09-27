import React from 'react';
import { BadgeCheck, CheckCircle2, Clock3, DollarSign, AlertCircle, Info, ExternalLink } from 'lucide-react';
import type { AdaptedSalesActivation } from '../model/salesActivationAdapter';
import { formatWorkspaceCurrency } from '../model/salesActivationAdapter';
import { formatTableNumber, formatPercent } from '../../../lib/formatters';

interface SalesOutcomeSummaryProps {
  model: AdaptedSalesActivation;
  onInspect: (metricKey: 'sales' | 'activations' | 'unactivated' | 'revenue') => void;
}

export default function SalesOutcomeSummary({ model, onInspect }: SalesOutcomeSummaryProps) {
  const { summary } = model;

  return (
    <section className="cx-command-metrics cx-outcome-metrics" aria-label="Outcome summary">
      {/* 1. Recorded Sales */}
      <article
        className="cx-command-metric cx-clickable-metric cursor-pointer hover:border-action/40 transition-colors"
        onClick={() => onInspect('sales')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onInspect('sales'); }}
        aria-label="Recorded sales summary"
      >
        <div className="flex items-center justify-between text-text-sec">
          <span className="font-semibold text-xs text-text-sec">Recorded sales</span>
          <BadgeCheck size={16} className="text-action" />
        </div>
        <strong className="text-2xl font-bold text-text-main tracking-tight my-1">
          {formatTableNumber(summary.totalSales)}
        </strong>
        <div className="text-xs text-text-mute flex items-center justify-between">
          <span>Observed sale events in intake cohort</span>
          <span className="text-action font-medium flex items-center gap-0.5">Inspect <ExternalLink size={10}/></span>
        </div>
      </article>

      {/* 2. Recorded Activations */}
      <article
        className="cx-command-metric cx-clickable-metric cursor-pointer hover:border-semantic-pos/40 transition-colors"
        onClick={() => onInspect('activations')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onInspect('activations'); }}
        aria-label="Recorded activations summary"
      >
        <div className="flex items-center justify-between text-text-sec">
          <span className="font-semibold text-xs text-text-sec">Recorded activations</span>
          <CheckCircle2 size={16} className="text-semantic-pos" />
        </div>
        <strong className="text-2xl font-bold text-text-main tracking-tight my-1">
          {formatTableNumber(summary.totalActivations)}
        </strong>
        <div className="text-xs text-text-mute flex items-center justify-between">
          <span>
            {summary.activationRatio !== null ? (
              <span className="font-semibold text-semantic-pos">
                {formatPercent(summary.activationRatio)}
              </span>
            ) : '—'} activation / sale ratio
          </span>
          <span className="text-semantic-pos font-medium flex items-center gap-0.5">Inspect <ExternalLink size={10}/></span>
        </div>
      </article>

      {/* 3. Sales Without Recorded Activation */}
      <article
        className="cx-command-metric cx-clickable-metric cursor-pointer hover:border-semantic-warn/40 transition-colors"
        onClick={() => onInspect('unactivated')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onInspect('unactivated'); }}
        aria-label="Sales without recorded activation summary"
      >
        <div className="flex items-center justify-between text-text-sec">
          <span className="font-semibold text-xs text-text-sec">Sales without activation</span>
          <Clock3 size={16} className="text-semantic-warn" />
        </div>
        <strong className="text-2xl font-bold text-text-main tracking-tight my-1">
          {summary.salesWithoutActivation !== null ? formatTableNumber(summary.salesWithoutActivation) : '—'}
        </strong>
        <div className="text-xs text-text-mute flex items-center justify-between">
          <span>
            {summary.validPendingActivation !== null ? `${formatTableNumber(summary.validPendingActivation)} pending queue` : 'Unavailable'}
            {summary.invalidFutureSales > 0 ? ` • ${summary.invalidFutureSales} future error` : ''}
          </span>
          <span className="text-semantic-warn font-medium flex items-center gap-0.5">Inspect <ExternalLink size={10}/></span>
        </div>
      </article>

      {/* 4. Source-Recorded Revenue & Completeness */}
      <article
        className="cx-command-metric cx-clickable-metric cursor-pointer hover:border-action/40 transition-colors"
        onClick={() => onInspect('revenue')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onInspect('revenue'); }}
        aria-label="Source-recorded revenue summary"
      >
        <div className="flex items-center justify-between text-text-sec">
          <span className="font-semibold text-xs text-text-sec">Source-recorded revenue</span>
          <DollarSign size={16} className="text-semantic-purple" />
        </div>
        <strong className="text-2xl font-bold text-text-main tracking-tight my-1">
          {formatWorkspaceCurrency(summary.realizedRevenue, summary.currency)}
        </strong>
        <div className="text-xs text-text-mute flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-[11px]">
            <span>
              {summary.salesWithRecordedRevenue !== null ? `${formatTableNumber(summary.salesWithRecordedRevenue)} with revenue` : '—'}
              {' • '}
              {formatTableNumber(summary.unbilledSales)} zero
              {' • '}
              {formatTableNumber(summary.unrecordedRevenueSales)} missing
            </span>
            <span className="text-semantic-purple font-medium flex items-center gap-0.5">Inspect <ExternalLink size={10}/></span>
          </div>
        </div>
      </article>
    </section>
  );
}
