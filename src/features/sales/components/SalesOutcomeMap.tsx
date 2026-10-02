import React from 'react';
import { Clock3, CircleDollarSign, ShieldCheck } from 'lucide-react';
import type { AdaptedSalesActivation } from '../model/salesActivationAdapter';
import { formatTableNumber, formatPercent } from '../../../lib/formatters';
import OutcomeBranchMap from '../../../shared/visuals/OutcomeBranchMap';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';

interface SalesOutcomeMapProps {
  model: AdaptedSalesActivation;
  onInspect: (metric: 'sales' | 'activations' | 'unactivated' | 'revenue') => void;
}

export default function SalesOutcomeMap({ model, onInspect }: SalesOutcomeMapProps) {
  const { summary } = model;
  return <section className="cx-sales-evidence-map enterprise-card" aria-label="Outcome evidence map">
    <header><div><span className="cx-command-section-kicker">Outcome evidence map</span>
      <h2>What is recorded after sale</h2>
      <p>This view does not imply that every population is a nested transition. Select a population to inspect its exact evidence.</p>
    </div><ShieldCheck size={18} aria-hidden="true" /></header>
    <OutcomeBranchMap
      anchor={{ key: 'sales', label: 'Recorded sales', value: formatTableNumber(summary.totalSales), detail: 'Observed sale population in the intake cohort', Icon: lifecyclePresentation.sales.Icon, color: lifecyclePresentation.sales.color }}
      branches={[
        { key: 'activations', label: 'Recorded activations', value: formatTableNumber(summary.totalActivations), detail: summary.activationRatio == null ? 'Activation / sale ratio unavailable' : `${formatPercent(summary.activationRatio)} activation / sale ratio · independent counts`, Icon: lifecyclePresentation.activated.Icon, color: lifecyclePresentation.activated.color },
        { key: 'unactivated', label: 'Awaiting activation evidence', value: summary.salesWithoutActivation == null ? '—' : formatTableNumber(summary.salesWithoutActivation), detail: summary.validPendingActivation == null ? 'Queue evidence unavailable' : `${formatTableNumber(summary.validPendingActivation)} valid pending · ${formatTableNumber(summary.invalidFutureSales)} future anomalies`, Icon: Clock3, color: 'var(--cx-warning)', available: summary.salesWithoutActivation != null },
        { key: 'revenue', label: 'Sales with recorded revenue', value: summary.salesWithRecordedRevenue == null ? '—' : formatTableNumber(summary.salesWithRecordedRevenue), detail: `${formatTableNumber(summary.unbilledSales)} explicit zero · ${formatTableNumber(summary.unrecordedRevenueSales)} missing`, Icon: CircleDollarSign, color: 'var(--cx-text-secondary)', available: summary.salesWithRecordedRevenue != null },
      ]}
      onSelect={key => onInspect(key as Parameters<typeof onInspect>[0])}
    />
  </section>;
}
