import { randomUUID } from 'node:crypto';
import { AGGREGATE_SNAPSHOT_VERSION, METRIC_BY_ID, METRIC_VERSION, MODEL_VERSION, REPORT_MAX_ROWS, REPORT_RESULT_VERSION, type EvidenceMetricResult, type EvidenceReportResult, type MetricDefinition, type ReleaseManifest, type VersionedReportRequest } from '../../contracts/reporting';
import { compareExactDecimal, exactDecimal, exactPercent } from '../../contracts/exactDecimal';
import { RequestError } from '../bigquery/filters';
import { requireTenant, type Principal } from '../securityPolicy';
import { fingerprint, REPORT_DEFINITION_HASH } from './fingerprint';
import { compileSnapshotReport } from './query';
import { validateRelease } from './release';
import type { ReportRepository } from './repository';
import { reportRequest, reportScopeHash } from './scope';

export function reportingPrincipal(principal: Principal | undefined): Principal {
  if (!principal?.subject || !Array.isArray(principal.tenants)) throw new RequestError('Verified identity is required', 401);
  return principal;
}

function unavailable(metric: MetricDefinition, request: VersionedReportRequest, release: ReleaseManifest, reason: string, completeness: EvidenceMetricResult['completeness'] = 'UNAVAILABLE'): EvidenceMetricResult {
  return { metricId: metric.id, group: null, value: null, numerator: null, denominator: null, unit: metric.unit, calculationStatus: 'UNAVAILABLE', completeness, reason,
    evidence: { grain: metric.grain, dateBasis: request.dateBasis, definitionVersion: release.metricVersion, releaseId: release.releaseId,
      numeratorDefinition: metric.numeratorLabel, denominatorDefinition: metric.denominatorLabel,
      sources: metric.requires.map(fact => ({ fact, snapshot: release.snapshots[fact], coverage: release.sources.find(source => source.fact === fact)! })),
      mappingStatus: release.execution ? 'APPROVED_RELEASE_CONTRACT' : 'UNAVAILABLE', reconciliationStatus: 'NOT_VERIFIED', businessMeaningStatus: 'NOT_VERIFIED', evidenceStatus: completeness === 'PARTIAL' ? 'PARTIAL' : 'UNAVAILABLE' } };
}

function metricAvailability(metric: MetricDefinition, request: VersionedReportRequest, release: ReleaseManifest): EvidenceMetricResult | null {
  if (!release.execution!.supportedMetrics.includes(metric.id) || !metric.dateBases.includes(request.dateBasis)) return unavailable(metric, request, release, 'Metric is not supported by this release for the requested date basis.');
  const sources = metric.requires.map(fact => release.sources.find(source => source.fact === fact)!);
  if (sources.some(source => source.status === 'UNAVAILABLE')) return unavailable(metric, request, release, 'Required source evidence is unavailable.');
  if (sources.some(source => source.status !== 'COMPLETE' || !source.completeThrough || Date.parse(source.completeThrough) < Date.parse(request.observationCutoff) || !source.earliestAvailable || Date.parse(source.earliestAvailable) > Date.parse(request.startDate))) return unavailable(metric, request, release, 'Required source coverage is incomplete for this exact period and observation cutoff; the value is withheld.', 'PARTIAL');
  return null;
}

function decimal(raw: unknown, field: string, integer = false): string | null {
  if (raw === null) return null;
  const result = exactDecimal(raw);
  if (result === null || result.length > 80 || (integer && !/^\d+$/.test(result))) throw new RequestError(`Invalid exact ${field} in aggregate snapshot`, 503);
  return result;
}

function validateRows(rows: Record<string, unknown>[], request: VersionedReportRequest, release: ReleaseManifest, eligible: string[]): { totals: EvidenceMetricResult[]; groups: EvidenceMetricResult[] } {
  if (rows.length > REPORT_MAX_ROWS) throw new RequestError('Aggregate snapshot exceeds the bounded result size; no truncated report is returned', 422);
  const totals: EvidenceMetricResult[] = [], groups: EvidenceMetricResult[] = [], seen = new Set<string>();
  for (const row of rows) {
    if (row.tenant_id !== request.tenantId || row.release_id !== request.releaseId || row.scope_hash !== reportScopeHash(request) || typeof row.metric_id !== 'string' || !eligible.includes(row.metric_id)) throw new RequestError('Aggregate snapshot identity or scope mismatch', 503);
    const metric = METRIC_BY_ID[row.metric_id];
    if (row.definition_version !== release.metricVersion || row.unit !== metric.unit || row.grain !== metric.grain || row.date_basis !== request.dateBasis) throw new RequestError('Aggregate snapshot definition metadata mismatch', 503);
    if (typeof row.is_total !== 'boolean' || (row.is_total && row.group_key !== null) || (!row.is_total && (request.grouping === 'none' || typeof row.group_key !== 'string' || !row.group_key.trim() || row.group_key.length > 256))) throw new RequestError('Invalid aggregate snapshot group identity', 503);
    const key = JSON.stringify([metric.id, row.is_total, row.group_key]);
    if (seen.has(key)) throw new RequestError('Duplicate immutable metric row', 503);
    seen.add(key);
    if (!['COMPLETE', 'PARTIAL', 'UNAVAILABLE'].includes(row.completeness as string) || (row.reason !== null && (typeof row.reason !== 'string' || row.reason.length > 1000))) throw new RequestError('Invalid aggregate evidence state', 503);
    const integer = metric.aggregation !== 'decimal_sum';
    const value = decimal(row.value, 'value', metric.unit === 'records'), numerator = decimal(row.numerator, 'numerator', integer), denominator = decimal(row.denominator, 'denominator', true);
    let result = unavailable(metric, request, release, typeof row.reason === 'string' ? row.reason : 'Required immutable evidence is unavailable.', row.completeness as EvidenceMetricResult['completeness']);
    result.group = row.group_key as string | null;
    if (row.completeness === 'COMPLETE') {
      if (numerator === null || (metric.aggregation === 'ratio' && denominator === null) || (metric.aggregation !== 'ratio' && denominator !== null)) throw new RequestError('Missing or invalid numerator/denominator evidence', 503);
      if (metric.aggregation === 'ratio') {
        if (compareExactDecimal(numerator, denominator!) > 0) throw new RequestError('Ratio numerator exceeds its contracted denominator', 503);
        // The output contract uses exact decimal percentages rounded once to nine places.
        const expected = exactPercent(numerator, denominator, 9);
        if ((expected === null) !== (value === null) || (expected !== null && compareExactDecimal(value!, expected) !== 0)) throw new RequestError('Aggregate ratio disagrees with the registered numerator/denominator contract', 503);
      } else if (value === null || compareExactDecimal(value, numerator) !== 0) throw new RequestError('Aggregate value disagrees with its registered numerator', 503);
      result = { ...result, value, numerator, denominator, calculationStatus: value === null ? 'UNAVAILABLE' : 'CHECKED', reason: value === null ? 'Zero denominator; percentage is unavailable.' : row.reason as string | null,
        evidence: { ...result.evidence, evidenceStatus: value === null ? 'UNAVAILABLE' : 'OBSERVED' } };
    } else if (value !== null || numerator !== null || denominator !== null) throw new RequestError('Incomplete aggregate evidence must withhold values', 503);
    (row.is_total ? totals : groups).push(result);
  }
  if (eligible.some(id => !totals.some(row => row.metricId === id))) throw new RequestError('Immutable snapshot is missing a requested metric total for this exact scope', 422);
  return { totals, groups };
}

/** Stable evidence content excludes delivery time, query IDs, replay signatures and execution IDs. */
export function immutableReportContent(report: EvidenceReportResult) {
  return { contractVersion: report.contractVersion, generationContract: report.generationContract, request: report.request, manifestHash: report.manifestHash, scopeHash: report.scopeHash, status: report.status, totals: report.totals, groups: report.groups };
}

export async function executeReport(repo: ReportRepository, principal: Principal | undefined, input: unknown): Promise<EvidenceReportResult> {
  const authority = reportingPrincipal(principal);
  const request = reportRequest(input);
  requireTenant(authority, request.tenantId);
  if (!repo.configured) throw new RequestError('Approved reporting dataset is not configured', 503);
  const raw = await repo.release(request.tenantId, request.releaseId);
  if (!raw) throw new RequestError('No approved release available', 404);
  const release = validateRelease(raw);
  if (release.tenantId !== request.tenantId || release.releaseId !== request.releaseId) throw new RequestError('Release identity mismatch', 503);
  if (release.status !== 'PUBLISHED') throw new RequestError('Reporting release was revoked', 410);
  const unsupported = !release.execution ? 'No approved aggregate snapshot execution contract is attached to this release. Canonical fact mappings cannot be inferred.'
    : release.modelVersion !== MODEL_VERSION || release.metricVersion !== METRIC_VERSION || release.execution.definitionHash !== REPORT_DEFINITION_HASH ? 'The release definition version is not supported by this reader.' : null;
  if (!unsupported && (!release.checks.length || release.checks.some(check => check.status !== 'PASS'))) throw new RequestError('Published release lacks passed structural checks', 503);
  if (Date.parse(request.observationCutoff) > Date.parse(release.cutoff)) throw new RequestError('Observation cutoff exceeds the immutable release cutoff', 422);
  if (!unsupported && (!release.execution!.supportedDateBases.includes(request.dateBasis) || !release.execution!.supportedGroupings.includes(request.grouping) || Object.keys(request.filters).some(key => !release.execution!.supportedFilters.includes(key as keyof VersionedReportRequest['filters'])))) throw new RequestError('Scope or filter is not supported by this approved release', 422);
  const definitions = request.metrics.map(id => METRIC_BY_ID[id]);
  const report: EvidenceReportResult = {
    contractVersion: REPORT_RESULT_VERSION, status: unsupported ? 'NOT_SUPPORTED' : 'UNAVAILABLE', message: unsupported,
    queryJobId: 'unavailable', queryEvidence: { durationMs: 0, bytesProcessed: null, cacheHit: null, subqueryCount: 0, completion: 'NOT_RUN' },
    engineHash: release.engineHash, executionId: randomUUID(), token: null, request, releaseId: release.releaseId, modelVersion: release.modelVersion, metricVersion: release.metricVersion,
    releaseCutoff: release.cutoff, sourceBatchIds: release.sourceBatchIds, totals: [], groups: [], metricDefinitions: definitions, generatedAt: new Date().toISOString(), validation: release.checks, sources: release.sources,
    scopeHash: reportScopeHash(request), manifestHash: fingerprint(release), resultHash: '', generationContract: AGGREGATE_SNAPSHOT_VERSION, snapshot: release.execution?.snapshot || null,
    replay: { status: 'NOT_REPLAYABLE', expiresAt: null, reason: 'No executable immutable result is available.' },
    evidence: { observed: false, mapped: !!release.execution && !unsupported, scoped: true, reproduced: 'NOT_RUN', independentlyReconciled: 'NOT_VERIFIED', businessVerified: 'NOT_VERIFIED' },
  };
  const eligible: string[] = [];
  for (const metric of definitions) {
    const withheld = unsupported ? unavailable(metric, request, release, unsupported) : metricAvailability(metric, request, release);
    if (withheld) report.totals.push(withheld); else eligible.push(metric.id);
  }
  if (eligible.length) {
    await repo.assertSnapshots(release);
    const result = await repo.query(compileSnapshotReport(request, release, eligible));
    const validated = validateRows(result.rows, request, release, eligible);
    report.totals.push(...validated.totals); report.groups = validated.groups;
    report.queryJobId = result.jobId;
    report.queryEvidence = result.evidence || { durationMs: 0, bytesProcessed: null, cacheHit: null, subqueryCount: 0, completion: 'COMPLETED' };
    report.status = report.totals.some(row => row.calculationStatus === 'CHECKED') ? 'AVAILABLE' : 'UNAVAILABLE';
    report.evidence.observed = report.status === 'AVAILABLE';
    report.replay = { status: 'NOT_CONFIGURED', expiresAt: null, reason: 'Replay signing is not configured.' };
  }
  const compare = (a: EvidenceMetricResult, b: EvidenceMetricResult) => a.metricId < b.metricId ? -1 : a.metricId > b.metricId ? 1 : (a.group || '') < (b.group || '') ? -1 : (a.group || '') > (b.group || '') ? 1 : 0;
  report.totals.sort(compare); report.groups.sort(compare);
  if (!report.message && report.status === 'UNAVAILABLE') report.message = 'Required metric evidence is unavailable for this exact release and scope.';
  report.resultHash = fingerprint(immutableReportContent(report));
  return report;
}
