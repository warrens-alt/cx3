import type { OffernetQueryParams } from '../common/types';
import { getExceptionAnalytics } from './exceptions';
import { getRootCauseAnalysis } from './rootCause';

/** Deterministic measured summaries: no language model manufactures numbers or causal explanations. */
export async function getAiInsightsAnalytics(params: OffernetQueryParams) {
  const [queue, change] = await Promise.all([
    getExceptionAnalytics(params),
    params.startDate && params.endDate ? getRootCauseAnalysis({ ...params, metric: 'leadToSaleRate' }) : Promise.resolve(null),
  ]);
  const insights: Array<{ category: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; finding: string; metricReference: string; directive: string }> = [];
  if (change && change.metric.delta !== null) {
    insights.push({ category: 'Matched-period change', severity: 'LOW',
      finding: `Sale / fetched changed by ${change.metric.delta.toFixed(2)} percentage points: ${change.metric.previousValue!.toFixed(2)}% to ${change.metric.currentValue!.toFixed(2)}%.`,
      metricReference: `root-cause.leadToSaleRate: current ${change.currentWindow.startDate}–${change.currentWindow.endDate}; previous ${change.previousWindow.startDate}–${change.previousWindow.endDate}; metric.currentValue=${change.metric.currentValue}; metric.previousValue=${change.metric.previousValue}; metric.delta=${change.metric.delta}.`,
      directive: 'Inspect the matched cohorts in the Overview change drawer. This is a descriptive change, not a causal claim.' });
    for (const dimension of change.dimensions.filter(dimension => dimension.reconciliationStatus === 'RECONCILED').slice(0, 3)) {
      const top = dimension.segments[0];
      if (!top || top.contribution === null) continue;
      insights.push({ category: `${dimension.label} contribution`, severity: 'LOW',
        finding: `${top.name} has the largest absolute ${dimension.label.toLowerCase()} contribution: ${top.contribution.toFixed(2)} percentage points of the observed change.`,
        metricReference: `root-cause.leadToSaleRate.dimensions.${dimension.key}: segment=${JSON.stringify(top.name)}, contribution=${top.contribution}; reconciliation=${dimension.reconciliationStatus}; residual=${dimension.residual}.`,
        directive: 'Contributions reconcile within this dimension only. Population mix and outcome changes are included; separate dimensions must not be added.' });
    }
  }
  for (const item of queue.exceptions.filter(item => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 5)) {
    insights.push({ category: 'Measured investigation population', severity: item.severity.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
      finding: `${item.title}: ${item.count.toLocaleString()} scoped leads. ${item.detail}`,
      metricReference: `exceptions.${item.id}.count=${item.count}; generatedAt=${queue.generatedAt}; validationStatus=${queue.validationStatus}.`,
      directive: `Inspect the ${item.title.toLowerCase()} population in Exceptions; administrator record drill-down uses the same predicate.` });
  }
  return { insights, source: 'DETERMINISTIC_MEASURED_ANALYTICS', status: 'OBSERVED', validationStatus: 'NOT_VERIFIED',
    reason: 'Every finding is rendered from measured API outputs and cites its metric path and value. Generative recommendations remain disabled; source validation remains NOT_VERIFIED. Exception populations overlap and are not additive.' };
}
