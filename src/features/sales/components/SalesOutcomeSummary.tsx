import React from 'react';
import { Clock3 } from 'lucide-react';
import TelemetryRail from '../../../shared/visuals/TelemetryRail';
import { lifecyclePresentation, conceptIcons } from '../../../shared/visuals/lifecyclePresentation';
import type { AdaptedSalesActivation } from '../model/salesActivationAdapter';
import { formatWorkspaceCurrency } from '../model/salesActivationAdapter';
import { formatTableNumber, formatPercent } from '../../../lib/formatters';

type OutcomeMetric = 'sales' | 'activations' | 'unactivated' | 'revenue';
interface SalesOutcomeSummaryProps {
  model: AdaptedSalesActivation;
  onInspect: (metricKey: OutcomeMetric) => void;
  /** The outcome map already presents populations on the maintained Sales page. */
  contextOnly?: boolean;
}

export default function SalesOutcomeSummary({ model, onInspect, contextOnly = false }: SalesOutcomeSummaryProps) {
  const { summary } = model;
  const metrics = [
    { ...lifecyclePresentation.sales, key: 'sales' as const, label: 'Recorded sales', aria: 'Recorded sales summary', value: formatTableNumber(summary.totalSales), note: 'Observed sale events in intake cohort' },
    { ...lifecyclePresentation.activated, key: 'activations' as const, label: 'Recorded activations', aria: 'Recorded activations summary', value: formatTableNumber(summary.totalActivations), note: `${formatPercent(summary.activationRatio)} activation / sale ratio` },
    { key: 'unactivated' as const, label: 'Sales without activation', aria: 'Sales without recorded activation summary', value: summary.salesWithoutActivation == null ? '—' : formatTableNumber(summary.salesWithoutActivation), note: summary.validPendingActivation == null ? 'Queue unavailable' : `${formatTableNumber(summary.validPendingActivation)} pending · ${formatTableNumber(summary.invalidFutureSales)} future anomalies`, Icon: Clock3, color: 'var(--cx-warning)' },
    { key: 'revenue' as const, label: 'Source-recorded revenue', aria: 'Source-recorded revenue summary', value: formatWorkspaceCurrency(summary.realizedRevenue, summary.currency), note: 'Source value · not invoice or cash evidence', Icon: conceptIcons.commercial, color: 'var(--cx-text-secondary)' },
  ];
  return <TelemetryRail label={contextOnly ? 'Sales timing and value context' : 'Outcome summary'} className="cx-sales-telemetry">
    {(contextOnly ? metrics.filter(item => item.key === 'revenue') : metrics).map(item => <article key={item.key} className="cx-command-metric" aria-label={item.aria}>
      <span className="cx-sales-telemetry-label"><item.Icon size={15} aria-hidden="true" style={{ color: item.color }} />{item.key === 'sales' ? 'Recorded sales' : item.key === 'activations' ? 'Recorded activations' : item.label}</span>
      <button type="button" className="cx-metric-primary" onClick={() => onInspect(item.key)} aria-label={`Inspect ${item.key === 'revenue' ? 'recorded revenue' : item.key === 'unactivated' ? 'unactivated sales' : item.key === 'sales' ? 'recorded sales' : 'recorded activations'}`}><strong>{item.value}</strong></button>
      <small>{item.note}</small>
    </article>)}
    {contextOnly && <>
      <article className="cx-command-metric"><span className="cx-sales-telemetry-label">Median time to sale</span><strong className="cx-metric-primary">{model.timing.medianTimeToSale}</strong><small>Recorded timing evidence</small></article>
      <article className="cx-command-metric"><span className="cx-sales-telemetry-label">Median time to activation</span><strong className="cx-metric-primary">{model.timing.medianTimeToActivation}</strong><small>Recorded timing evidence</small></article>
    </>}
  </TelemetryRail>;
}
