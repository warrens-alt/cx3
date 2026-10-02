import type { OffernetQueryParams } from '../common/types';
import { getExceptionAnalytics } from './exceptions';
import { getRootCauseAnalysis } from './rootCause';
import { generateGroundedAiInsights, type OperationalContext, type GroundedAiInsightsResult } from '../../gemini/client';
import { getClientConfig } from '../../bigquery/config';
import { getBigQueryClient } from '../../bigquery/client';
import { RequestError } from '../../bigquery/filters';
import { buildQualifiedInvestigationEvidence } from './records';
import { driverFirstDialAgeSql } from './exceptionPredicates';
import { investigationReasonFor } from '../../../contracts/investigation';

/**
 * Grounded Operational Intelligence:
 * Synthesizes measured BigQuery operational metrics using Google Gemini API (gemini-3.8-flash).
 * If Gemini is not configured, provides high-precision deterministic summaries.
 * Every finding cites its exact metric path and value; no synthetic numbers are invented.
 */
export function isInvestigationScopedRequest(params: OffernetQueryParams): boolean {
  return Boolean(params.drill || params.drillValue || params.metric || params.search || params.question || params.segmentVendor !== undefined || params.segmentSource !== undefined || params.segmentGrade !== undefined || params.segmentLeadAge !== undefined);
}

export async function getAiInsightsAnalytics(params: OffernetQueryParams) {
  if (isInvestigationScopedRequest(params)) {
    return getScopedInvestigationInsights(params);
  }
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
      ? 'Synthesized with Google Gemini 3.8 Flash based on measured BigQuery operational records. Source validation remains NOT_VERIFIED; references identify supplied metric evidence.'
      : 'Every finding is rendered from measured API outputs and cites its metric path and value. Generative recommendations remain disabled; source validation remains NOT_VERIFIED. Exception populations overlap and are not additive.',
  };
}

/** Aggregate-only synthesis: exact record qualification, no lead identifiers or raw evidence sent to the model. */
async function getScopedInvestigationInsights(params: OffernetQueryParams) {
  if (params.drillValue && !params.drill) throw new RequestError('Investigation drillValue requires a supported drill predicate', 422);
  const { qualifiedSql, queryParams, normalizedParams, effectiveFilters, clientConfig } = buildQualifiedInvestigationEvidence(params);
  const [rows] = await getBigQueryClient(clientConfig.bigQueryProject).query({
    query: `${qualifiedSql},
      investigation_population AS (
        SELECT m.* FROM operational_leads m JOIN qualified_evidence q USING (lead_id)
      )
      SELECT COUNT(*) AS population_count,
        COUNTIF(recorded_call_count IS NULL) AS missing_call_counters,
        COUNTIF(is_rpc IS NULL) AS unknown_rpc,
        ARRAY(SELECT AS STRUCT COALESCE(NULLIF(TRIM(vendor), ''), 'Unrecorded') AS name, COUNT(*) AS count
          FROM investigation_population GROUP BY name ORDER BY count DESC, name LIMIT 5) AS vendors,
        ARRAY(SELECT AS STRUCT COALESCE(NULLIF(TRIM(source), ''), 'Unrecorded') AS name, COUNT(*) AS count
          FROM investigation_population GROUP BY name ORDER BY count DESC, name LIMIT 5) AS sources,
        ARRAY(SELECT AS STRUCT (${driverFirstDialAgeSql('p')}) AS name, COUNT(*) AS count
          FROM investigation_population p GROUP BY name ORDER BY count DESC, name) AS first_dial_ages
      FROM investigation_population`,
    params: queryParams,
  });
  const aggregate = rows?.[0];
  if (!Array.isArray(rows) || rows.length !== 1 || !aggregate || typeof aggregate !== 'object') {
    throw new RequestError('Upstream warehouse returned invalid investigation synthesis aggregates', 502);
  }
  const count = (value: unknown): number => {
    const raw = value && typeof value === 'object' && 'value' in value ? (value as { value: unknown }).value : value;
    if (!['number', 'string', 'bigint'].includes(typeof raw) || !/^\d+$/.test(String(raw))) {
      throw new RequestError('Upstream warehouse returned unavailable investigation count', 502);
    }
    const numeric = Number(raw);
    if (!Number.isSafeInteger(numeric) || numeric < 0) throw new RequestError('Upstream warehouse returned invalid investigation count', 502);
    return numeric;
  };
  const populationCount = count(aggregate.population_count);
  const missingCallCounters = count(aggregate.missing_call_counters);
  const unknownRpc = count(aggregate.unknown_rpc);
  if (missingCallCounters > populationCount || unknownRpc > populationCount) {
    throw new RequestError('Investigation evidence counts exceed the scoped population', 502);
  }
  const breakdown = (key: string) => {
    const supplied = aggregate[key];
    if (!Array.isArray(supplied)) throw new RequestError(`Upstream warehouse omitted investigation ${key}`, 502);
    const groups = supplied.map((item: { name: unknown; count: unknown }) => {
      if (!item || typeof item.name !== 'string' || !item.name) throw new RequestError('Upstream warehouse returned invalid investigation segment', 502);
      return { name: item.name, count: count(item.count) };
    });
    if (new Set(groups.map(item => item.name)).size !== groups.length || groups.reduce((sum, item) => sum + item.count, 0) > populationCount) {
      throw new RequestError('Investigation segment counts do not match the scoped population', 502);
    }
    return groups;
  };
  const vendors = breakdown('vendors');
  const sources = breakdown('sources');
  const firstDialAges = breakdown('first_dial_ages');
  if (firstDialAges.reduce((sum, item) => sum + item.count, 0) !== populationCount) {
    throw new RequestError('Investigation first-dial age population does not reconcile', 502);
  }
  const generatedAt = new Date().toISOString();
  const scope = {
    clientId: normalizedParams.clientId,
    startDate: normalizedParams.startDate || null,
    endDate: normalizedParams.endDate || null,
    filters: effectiveFilters,
    drill: normalizedParams.drill || null,
    drillValue: normalizedParams.drillValue || null,
    metric: normalizedParams.metric || null,
    search: normalizedParams.search || null,
    segmentVendor: normalizedParams.segmentVendor || null,
    segmentSource: normalizedParams.segmentSource || null,
    segmentGrade: normalizedParams.segmentGrade || null,
    segmentLeadAge: normalizedParams.segmentLeadAge || null,
    dateBasis: 'intake_cohort',
    countingGrain: 'lead',
  };
  const limitations = [
    'Source validation remains NOT_VERIFIED. Missing evidence does not establish a negative outcome.',
    'This synthesis includes the exact selected predicate, reporting scope, global filters, search and additive investigation segments.',
    'Vendor and source concentrations contain at most the five largest segments. Different dimensions describe the same population and must not be added.',
    'First-dial age is delivery to first dial; unavailable delivery or dial evidence is shown separately. It is not undialled backlog age.',
    'No selected-metric value, matched-period comparison, causal evidence, individual call history or record identifiers were supplied to this synthesis. A selected metric is retained as context only.',
  ];
  const qualification = investigationReasonFor(normalizedParams.drill, normalizedParams.drillValue);
  const deterministicInsights: GroundedAiInsightsResult['insights'] = [{
    category: 'Selected investigation population', severity: 'LOW',
    finding: `${populationCount.toLocaleString()} leads match this exact investigation scope.${qualification ? ` ${qualification.label}.` : ''}`,
    metricReference: `investigation.populationCount=${populationCount}; generatedAt=${generatedAt}; validationStatus=NOT_VERIFIED.`,
    directive: 'Inspect supporting records and their inclusion reasons before drawing conclusions.',
  }, {
    category: 'Evidence limitations', severity: 'LOW',
    finding: `${missingCallCounters.toLocaleString()} scoped leads have unavailable cumulative call counters; ${unknownRpc.toLocaleString()} have unavailable RPC evidence. These are separate, potentially overlapping evidence gaps.`,
    metricReference: `investigation.missingCallCounters=${missingCallCounters}; investigation.unknownRpc=${unknownRpc}.`,
    directive: 'Keep unavailable evidence distinct from recorded zero calls or an explicitly false RPC flag.',
  }];
  for (const [dimension, segments] of [['vendor', vendors], ['source', sources], ['firstDialAge', firstDialAges]] as const) {
    const top = segments[0];
    if (!top) continue;
    deterministicInsights.push({
      category: `${dimension} concentration`, severity: 'LOW',
      finding: `${top.name}: ${top.count.toLocaleString()} leads in the selected investigation population.`,
      metricReference: `investigation.${dimension}[${JSON.stringify(top.name)}].count=${top.count}; populationCount=${populationCount}.`,
      directive: 'This describes current concentration within this scope. It does not establish change or causation.',
    });
  }
  const metricReferences = deterministicInsights.map(item => item.metricReference);
  const deterministicFallback: GroundedAiInsightsResult = {
    executiveSummary: `${populationCount.toLocaleString()} leads match this investigation in ${clientConfig.name}. The supplied evidence is NOT_VERIFIED and supports descriptive population review only.`,
    strategicFocus: populationCount ? 'Inspect the scoped records and evidence gaps; unsupported outcomes and causal conclusions remain unknown.' : 'No records match this scope. Review the selected filters and predicate without assuming missing evidence equals zero outcomes.',
    insights: deterministicInsights,
  };
  const ai = await generateGroundedAiInsights({
    clientName: clientConfig.name,
    currency: clientConfig.currency,
    currentWindow: { startDate: normalizedParams.startDate, endDate: normalizedParams.endDate },
    investigation: { scope, question: normalizedParams.question, validationStatus: 'NOT_VERIFIED', metricReferences, limitations },
    overviewMetrics: { populationCount, missingCallCounters, unknownRpc, vendors, sources, firstDialAges },
  }, deterministicFallback);
  // Deterministic observations stay primary. Synthesis has separate summary fields and supplied references.
  return {
    source: ai.source,
    model: ai.model || null,
    status: ai.source === 'GOOGLE_GEMINI_AI' ? 'ACTIVE' : 'OBSERVED',
    validationStatus: 'NOT_VERIFIED',
    executiveSummary: ai.result.executiveSummary,
    strategicFocus: ai.result.strategicFocus,
    insights: deterministicInsights,
    reason: ai.source === 'GOOGLE_GEMINI_AI'
      ? 'AI synthesis received only the scoped aggregates and references shown here. Interpret it alongside deterministic findings and evidence limitations.'
      : 'Deterministic synthesis of the exact investigation population. No generative model response was used.',
    scope, populationCount, generatedAt, metricReferences, limitations,
    requestedQuestion: normalizedParams.question || null,
  };
}
