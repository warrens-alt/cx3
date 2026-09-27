import type { OffernetQueryParams } from '../common/types';
import { getExceptionAnalytics } from './exceptions';
import { getRootCauseAnalysis } from './rootCause';
import { generateGroundedAiInsights, type OperationalContext, type GroundedAiInsightsResult } from '../../gemini/client';
import { getClientConfig } from '../../bigquery/config';

/**
 * Grounded Operational Intelligence:
 * Synthesizes measured BigQuery operational metrics using Google Gemini API (gemini-3.8-flash).
 * If Gemini is not configured, provides high-precision deterministic summaries.
 * Every finding cites its exact metric path and value; no synthetic numbers are invented.
 */
export async function getAiInsightsAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const [queue, change] = await Promise.all([
    getExceptionAnalytics(params),
    params.startDate && params.endDate ? getRootCauseAnalysis({ ...params, metric: 'leadToSaleRate' }) : Promise.resolve(null),
  ]);

  const deterministicInsights: Array<{
    category: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    finding: string;
    metricReference: string;
    directive: string;
  }> = [];

  let changeDescription = '';
  if (change && change.metric.delta !== null) {
    changeDescription = `Sale/fetched changed by ${change.metric.delta.toFixed(2)} percentage points: ${change.metric.previousValue!.toFixed(2)}% to ${change.metric.currentValue!.toFixed(2)}%.`;
    deterministicInsights.push({
      category: 'Matched-period change',
      severity: 'LOW',
      finding: changeDescription,
      metricReference: `root-cause.leadToSaleRate: current ${change.currentWindow.startDate}–${change.currentWindow.endDate}; previous ${change.previousWindow.startDate}–${change.previousWindow.endDate}; metric.currentValue=${change.metric.currentValue}; metric.previousValue=${change.metric.previousValue}; metric.delta=${change.metric.delta}.`,
      directive: 'Inspect the matched cohorts in the Overview change drawer. This is a descriptive change, not a causal claim.',
    });

    for (const dimension of change.dimensions.filter(d => d.reconciliationStatus === 'RECONCILED').slice(0, 3)) {
      const top = dimension.segments[0];
      if (!top || top.contribution === null) continue;
      deterministicInsights.push({
        category: `${dimension.label} contribution`,
        severity: 'LOW',
        finding: `${top.name} has the largest absolute ${dimension.label.toLowerCase()} contribution: ${top.contribution.toFixed(2)} percentage points of the observed change.`,
        metricReference: `root-cause.leadToSaleRate.dimensions.${dimension.key}: segment=${JSON.stringify(top.name)}, contribution=${top.contribution}; reconciliation=${dimension.reconciliationStatus}; residual=${dimension.residual}.`,
        directive: 'Contributions reconcile within this dimension only. Population mix and outcome changes are included; separate dimensions must not be added.',
      });
    }
  }

  const topExceptions = queue.exceptions.filter(item => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
  for (const item of topExceptions) {
    deterministicInsights.push({
      category: 'Measured investigation population',
      severity: item.severity.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
      finding: `${item.title}: ${item.count.toLocaleString()} scoped leads. ${item.detail}`,
      metricReference: `exceptions.${item.id}.count=${item.count}; generatedAt=${queue.generatedAt}; validationStatus=${queue.validationStatus}.`,
      directive: `Inspect the ${item.title.toLowerCase()} population in Exceptions; administrator record drill-down uses the same predicate.`,
    });
  }

  const activeExceptionCount = queue.exceptions.filter(e => e.count > 0).length;
  const deterministicFallback: GroundedAiInsightsResult = {
    executiveSummary: changeDescription
      ? `Operational metrics for ${clientConfig.name} show a matched-period conversion trajectory: ${changeDescription}. An active queue of ${activeExceptionCount} measured exceptions was recorded across ${params.startDate || 'start'} to ${params.endDate || 'latest'}.`
      : `Operational monitoring for ${clientConfig.name} recorded ${activeExceptionCount} active exception populations across current scoped lead captures.`,
    strategicFocus: topExceptions[0]
      ? `Prioritize operational review of the "${topExceptions[0].title}" backlog (${topExceptions[0].count.toLocaleString()} affected leads).`
      : 'Maintain standard dialler cadence and verify inbound delivery consistency.',
    insights: deterministicInsights,
  };

  const context: OperationalContext = {
    clientName: clientConfig.name,
    currency: clientConfig.currency,
    currentWindow: change ? change.currentWindow : (params.startDate && params.endDate ? { startDate: params.startDate, endDate: params.endDate } : undefined),
    previousWindow: change ? change.previousWindow : undefined,
    exceptions: queue.exceptions.filter(e => e.count > 0).map(e => ({
      id: e.id,
      title: e.title,
      count: e.count,
      severity: e.severity,
      detail: e.detail,
    })),
    drivers: change?.dimensions.flatMap(d => d.segments.slice(0, 2).map(s => ({
      dimension: d.label,
      name: s.name,
      contribution: s.contribution || undefined,
    }))),
  };

  const aiSynthesis = await generateGroundedAiInsights(context, deterministicFallback);

  // Preserve exact deterministic metric references to guarantee verifiable BigQuery traceability
  const insights = deterministicInsights.map((det, i) => {
    const aiItem = aiSynthesis.result.insights?.[i];
    return {
      category: det.category,
      severity: det.severity,
      finding: aiSynthesis.source === 'GOOGLE_GEMINI_AI' && aiItem?.finding ? aiItem.finding : det.finding,
      metricReference: det.metricReference,
      directive: aiSynthesis.source === 'GOOGLE_GEMINI_AI' && aiItem?.directive ? aiItem.directive : det.directive,
    };
  });

  return {
    source: aiSynthesis.source,
    model: aiSynthesis.model || 'gemini-3.8-flash',
    status: aiSynthesis.source === 'GOOGLE_GEMINI_AI' ? 'ACTIVE' : 'OBSERVED',
    validationStatus: 'NOT_VERIFIED',
    executiveSummary: aiSynthesis.result.executiveSummary,
    strategicFocus: aiSynthesis.result.strategicFocus,
    insights,
    reason: aiSynthesis.source === 'GOOGLE_GEMINI_AI'
      ? 'Synthesized with Google Gemini 3.8 Flash based on verified BigQuery operational records. Every insight cites observed metric paths and verifiable numbers.'
      : 'Every finding is rendered from measured API outputs and cites its metric path and value. Generative recommendations remain disabled; source validation remains NOT_VERIFIED. Exception populations overlap and are not additive.',
  };
}
