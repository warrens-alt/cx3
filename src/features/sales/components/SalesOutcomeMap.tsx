import React from 'react';
import { BadgeCheck, CheckCircle2, Clock3, CircleDollarSign, ShieldCheck } from 'lucide-react';
import type { AdaptedSalesActivation } from '../model/salesActivationAdapter';
import { formatTableNumber, formatPercent } from '../../../lib/formatters';

interface SalesOutcomeMapProps {
  model: AdaptedSalesActivation;
  onInspect: (metric: 'sales' | 'activations' | 'unactivated' | 'revenue') => void;
}

function clampPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export default function SalesOutcomeMap({ model, onInspect }: SalesOutcomeMapProps) {
  const { summary } = model;
  const activationPct = clampPct(summary.activationRatio);
  const revenueCoverage = summary.salesWithRecordedRevenue == null || summary.totalSales <= 0
    ? null
    : (summary.salesWithRecordedRevenue / summary.totalSales) * 100;
  const pendingShare = summary.salesWithoutActivation == null || summary.totalSales <= 0
    ? null
    : (summary.salesWithoutActivation / summary.totalSales) * 100;

  const items = [
    {
      key: 'sales' as const,
      label: 'Recorded sales',
      value: formatTableNumber(summary.totalSales),
      context: 'Observed sale population in the intake cohort',
      pct: 100,
      icon: BadgeCheck,
      tone: 'sales',
    },
    {
      key: 'activations' as const,
      label: 'Recorded activations',
      value: formatTableNumber(summary.totalActivations),
      context: summary.activationRatio == null ? 'Activation / sale ratio unavailable' : `${formatPercent(summary.activationRatio)} activation / sale ratio`,
      pct: activationPct,
      icon: CheckCircle2,
      tone: 'activation',
    },
    {
      key: 'unactivated' as const,
      label: 'Awaiting activation evidence',
      value: summary.salesWithoutActivation == null ? '—' : formatTableNumber(summary.salesWithoutActivation),
      context: summary.validPendingActivation == null ? 'Queue evidence unavailable' : `${formatTableNumber(summary.validPendingActivation)} valid pending · ${formatTableNumber(summary.invalidFutureSales)} future anomalies`,
      pct: clampPct(pendingShare),
      icon: Clock3,
      tone: 'pending',
    },
    {
      key: 'revenue' as const,
      label: 'Sales with recorded revenue',
      value: summary.salesWithRecordedRevenue == null ? '—' : formatTableNumber(summary.salesWithRecordedRevenue),
      context: `${formatTableNumber(summary.unbilledSales)} explicit zero · ${formatTableNumber(summary.unrecordedRevenueSales)} missing`,
      pct: clampPct(revenueCoverage),
      icon: CircleDollarSign,
      tone: 'revenue',
    },
  ];

  return (
    <section className="cx-sales-evidence-map enterprise-card" aria-label="Outcome evidence map">
      <header>
        <div>
          <span className="cx-command-section-kicker">Outcome evidence map</span>
          <h2>What is recorded after sale</h2>
          <p>Independent evidence populations for the selected intake cohort. This view does not imply that every population is a nested transition.</p>
        </div>
        <ShieldCheck size={18} aria-hidden="true" />
      </header>

      <div className="cx-sales-evidence-grid">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className="cx-sales-evidence-item"
              data-tone={item.tone}
              onClick={() => onInspect(item.key)}
            >
              <div className="cx-sales-evidence-item-head">
                <span className="cx-sales-evidence-icon"><Icon size={16} aria-hidden="true" /></span>
                <span>{item.label}</span>
              </div>
              <strong>{item.value}</strong>
              <div className="cx-sales-evidence-track" aria-hidden="true">
                <span style={{ width: `${item.pct}%` }} />
              </div>
              <small>{item.context}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
