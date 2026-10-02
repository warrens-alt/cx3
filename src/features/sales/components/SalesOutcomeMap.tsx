import React from 'react';
import { Clock3, CircleDollarSign } from 'lucide-react';
import type { AdaptedSalesActivation } from '../model/salesActivationAdapter';
import { formatTableNumber, formatPercent } from '../../../lib/formatters';
import ChartFrame from '../../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../../shared/reporting/ReportingScopeSummary';
import OutcomeBranchMap from '../../../shared/visuals/OutcomeBranchMap';
import { lifecyclePresentation } from '../../../shared/visuals/lifecyclePresentation';

interface SalesOutcomeMapProps {
  model: AdaptedSalesActivation;
  onInspect: (metric: 'sales' | 'activations' | 'unactivated' | 'revenue') => void;
}

export default function SalesOutcomeMap({ model, onInspect }: SalesOutcomeMapProps) {
  const { summary } = model;
  return <ChartFrame title="What is recorded after sale" subtitle="Independent populations · select to inspect" className="cx-sales-evidence-map cx-analytical-canvas" scope={<ReportingScopeSummary />} footer={<details className="cx-chart-methodology"><summary>Outcome methodology</summary><p>This view does not imply that every population is a nested transition. Recorded sales, activations, and revenue evidence remain independently observed populations within the selected intake cohort.</p></details>}>
    <OutcomeBranchMap
      anchor={{ key: 'sales', label: 'Recorded sales', value: formatTableNumber(summary.totalSales), detail: 'Observed sale population in the intake cohort', Icon: lifecyclePresentation.sales.Icon, color: lifecyclePresentation.sales.color }}
      branches={[
        { key: 'activations', label: 'Recorded activations', value: formatTableNumber(summary.totalActivations), detail: summary.activationRatio == null ? 'Activation / sale ratio unavailable' : `${formatPercent(summary.activationRatio)} activation / sale ratio · independent counts`, Icon: lifecyclePresentation.activated.Icon, color: lifecyclePresentation.activated.color },
        { key: 'unactivated', label: 'Awaiting activation evidence', value: summary.salesWithoutActivation == null ? '—' : formatTableNumber(summary.salesWithoutActivation), detail: summary.validPendingActivation == null ? 'Queue evidence unavailable' : `${formatTableNumber(summary.validPendingActivation)} valid pending · ${formatTableNumber(summary.invalidFutureSales)} future anomalies`, Icon: Clock3, color: 'var(--cx-warning)', available: summary.salesWithoutActivation != null },
        { key: 'revenue', label: 'Sales with recorded revenue', value: summary.salesWithRecordedRevenue == null ? '—' : formatTableNumber(summary.salesWithRecordedRevenue), detail: `${formatTableNumber(summary.unbilledSales)} explicit zero · ${formatTableNumber(summary.unrecordedRevenueSales)} missing`, Icon: CircleDollarSign, color: 'var(--cx-text-secondary)', available: summary.salesWithRecordedRevenue != null },
      ]}
      onSelect={key => onInspect(key as Parameters<typeof onInspect>[0])}
    />
  </ChartFrame>;
}
