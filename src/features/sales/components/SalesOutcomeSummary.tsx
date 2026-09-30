import React from 'react';
import { BadgeCheck, CheckCircle2, Clock3, DollarSign, ArrowRight } from 'lucide-react';
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
        className="cx-command-metric hover:border-action/40 transition-colors flex flex-col justify-between"
        aria-label="Recorded sales summary"
      >
        <div>
          <div className="flex items-center justify-between text-text-sec">
            <span className="font-semibold text-xs text-text-sec uppercase tracking-wider">Recorded sales</span>
            <BadgeCheck size={16} className="text-action" />
          </div>
          <button
            type="button"
            onClick={() => onInspect('sales')}
            className="text-left block hover:text-action transition-colors my-1.5 cursor-pointer w-full"
            title="Inspect recorded sales"
          >
            <strong className="text-2xl font-bold font-mono tracking-tight text-text-main tabular-nums block">
              {formatTableNumber(summary.totalSales)}
            </strong>
          </button>
          <div className="text-xs text-text-mute mt-1">
            <span>Observed sale events in intake cohort</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-2.5 mt-3 border-t border-border-subtle">

          <button
            type="button"
            className="inline-flex items-center gap-1 text-text-sec hover:text-action font-medium transition-colors cursor-pointer ml-auto"
            onClick={() => onInspect('sales')}
            title="Inspect sales records"
          >
            <span>Inspect evidence</span>
            <ArrowRight size={10} aria-hidden="true" />
          </button>
        </div>
      </article>

      {/* 2. Recorded Activations */}
      <article
        className="cx-command-metric hover:border-semantic-pos/40 transition-colors flex flex-col justify-between"
        aria-label="Recorded activations summary"
      >
        <div>
          <div className="flex items-center justify-between text-text-sec">
            <span className="font-semibold text-xs text-text-sec uppercase tracking-wider">Recorded activations</span>
            <CheckCircle2 size={16} className="text-semantic-pos" />
          </div>
          <button
            type="button"
            onClick={() => onInspect('activations')}
            className="text-left block hover:text-semantic-pos transition-colors my-1.5 cursor-pointer w-full"
            title="Inspect recorded activations"
          >
            <strong className="text-2xl font-bold font-mono tracking-tight text-text-main tabular-nums block">
              {formatTableNumber(summary.totalActivations)}
            </strong>
          </button>
          <div className="text-xs text-text-mute mt-1">
            <span>
              {summary.activationRatio !== null ? (
                <span className="font-semibold text-semantic-pos">
                  {formatPercent(summary.activationRatio)}
                </span>
              ) : '—'}{' '}
              activation / sale ratio
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-2.5 mt-3 border-t border-border-subtle">

          <button
            type="button"
            className="inline-flex items-center gap-1 text-text-sec hover:text-action font-medium transition-colors cursor-pointer ml-auto"
            onClick={() => onInspect('activations')}
            title="Inspect activation records"
          >
            <span>Inspect evidence</span>
            <ArrowRight size={10} aria-hidden="true" />
          </button>
        </div>
      </article>

      {/* 3. Sales Without Recorded Activation */}
      <article
        className="cx-command-metric hover:border-semantic-warn/40 transition-colors flex flex-col justify-between"
        aria-label="Sales without recorded activation summary"
      >
        <div>
          <div className="flex items-center justify-between text-text-sec">
            <span className="font-semibold text-xs text-text-sec uppercase tracking-wider">Sales without activation</span>
            <Clock3 size={16} className="text-semantic-warn" />
          </div>
          <button
            type="button"
            onClick={() => onInspect('unactivated')}
            className="text-left block hover:text-semantic-warn transition-colors my-1.5 cursor-pointer w-full"
            title="Inspect unactivated sales"
          >
            <strong className="text-2xl font-bold font-mono tracking-tight text-text-main tabular-nums block">
              {summary.salesWithoutActivation !== null ? formatTableNumber(summary.salesWithoutActivation) : '—'}
            </strong>
          </button>
          <div className="text-xs text-text-mute mt-1">
            <span>
              {summary.validPendingActivation !== null ? `${formatTableNumber(summary.validPendingActivation)} pending queue` : 'Unavailable'}
              {summary.invalidFutureSales > 0 ? ` • ${summary.invalidFutureSales} future error` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-2.5 mt-3 border-t border-border-subtle">

          <button
            type="button"
            className="inline-flex items-center gap-1 text-text-sec hover:text-action font-medium transition-colors cursor-pointer ml-auto"
            onClick={() => onInspect('unactivated')}
            title="Inspect pending records"
          >
            <span>Inspect evidence</span>
            <ArrowRight size={10} aria-hidden="true" />
          </button>
        </div>
      </article>

      {/* 4. Source-Recorded Revenue & Completeness */}
      <article
        className="cx-command-metric hover:border-action/40 transition-colors flex flex-col justify-between"
        aria-label="Source-recorded revenue summary"
      >
        <div>
          <div className="flex items-center justify-between text-text-sec">
            <span className="font-semibold text-xs text-text-sec uppercase tracking-wider">Source-recorded revenue</span>
            <DollarSign size={16} className="text-semantic-purple" />
          </div>
          <button
            type="button"
            onClick={() => onInspect('revenue')}
            className="text-left block hover:text-action transition-colors my-1.5 cursor-pointer w-full"
            title="Inspect recorded revenue"
          >
            <strong className="text-2xl font-bold font-mono tracking-tight text-text-main tabular-nums block">
              {formatWorkspaceCurrency(summary.realizedRevenue, summary.currency)}
            </strong>
          </button>
          <div className="text-xs text-text-mute mt-1">
            <span>
              {summary.salesWithRecordedRevenue !== null ? `${formatTableNumber(summary.salesWithRecordedRevenue)} with revenue` : '—'}
              {' • '}
              {formatTableNumber(summary.unbilledSales)} zero
              {' • '}
              {formatTableNumber(summary.unrecordedRevenueSales)} missing
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-2.5 mt-3 border-t border-border-subtle">

          <button
            type="button"
            className="inline-flex items-center gap-1 text-text-sec hover:text-action font-medium transition-colors cursor-pointer ml-auto"
            onClick={() => onInspect('revenue')}
            title="Inspect revenue breakdown"
          >
            <span>Inspect evidence</span>
            <ArrowRight size={10} aria-hidden="true" />
          </button>
        </div>
      </article>
    </section>
  );
}

