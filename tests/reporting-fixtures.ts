import { AGGREGATE_SNAPSHOT_VERSION, FACTS, METRIC_VERSION, MODEL_VERSION, REPORT_REQUEST_VERSION, type ReleaseManifest, type VersionedReportRequest } from '../contracts/reporting';
import { REPORT_DEFINITION_HASH } from '../server/reporting/fingerprint';
import { reportScopeHash } from '../server/reporting/scope';
import type { ReportRepository } from '../server/reporting/repository';

export const principal = { subject: 'synthetic-viewer', email: 'fixture@example.invalid', role: 'viewer' as const, tenants: ['tenant_a'] };
export const request: VersionedReportRequest = { contractVersion: REPORT_REQUEST_VERSION, releaseId: 'release_fixture', tenantId: 'tenant_a', startDate: '2026-09-01', endDate: '2026-09-02', observationCutoff: '2026-09-03T00:00:00.000Z', dateBasis: 'capture_cohort', grouping: 'none', currency: 'ZAR', metrics: ['fetched_leads'], filters: {} };
export function fixtureRelease(): ReleaseManifest {
  const snapshot = (name: string) => ({ table: `fixture.reporting.${name}`, createdAt: '2026-09-04T00:00:00.000Z', snapshotTime: '2026-09-03T00:00:00.000Z' });
  return { releaseId: request.releaseId, tenantId: request.tenantId, modelVersion: MODEL_VERSION, metricVersion: METRIC_VERSION, engineHash: 'synthetic-publisher-hash', status: 'PUBLISHED', builtAt: '2026-09-04T00:00:00.000Z', cutoff: request.observationCutoff, sourceBatchIds: ['synthetic-batch'],
    snapshots: Object.fromEntries(FACTS.map(fact => [fact, snapshot(fact)])) as ReleaseManifest['snapshots'],
    provenance: { records: snapshot('records'), batches: snapshot('batches'), contracts: snapshot('contracts') },
    sources: FACTS.map(fact => ({ fact, status: 'COMPLETE', contractVersion: 'synthetic.1', completeThrough: request.observationCutoff, earliestAvailable: '2026-01-01T00:00:00.000Z', owner: 'synthetic-source-owner', approvalReference: 'test-only' })),
    checks: [{ id: 'synthetic-structural-check', status: 'PASS', observed: '0', expected: '0', jobId: 'fixture-check' }], approvedBy: 'synthetic-approver', approvalReference: 'test-only',
    execution: { contractVersion: AGGREGATE_SNAPSHOT_VERSION, snapshot: snapshot('approved_results'), definitionHash: REPORT_DEFINITION_HASH, supportedMetrics: ['fetched_leads', 'call_coverage'], supportedDateBases: ['capture_cohort', 'event_date'], supportedGroupings: ['none', 'source', 'vendor'], supportedFilters: ['vendor', 'source'] } };
}
export function fixtureRow(scope = request): Record<string, unknown> {
  return { tenant_id: scope.tenantId, release_id: scope.releaseId, scope_hash: reportScopeHash(scope), metric_id: 'fetched_leads', definition_version: METRIC_VERSION, unit: 'records', grain: 'lead', date_basis: scope.dateBasis, is_total: true, group_key: null, value: '9007199254740993', numerator: '9007199254740993', denominator: null, completeness: 'COMPLETE', reason: null };
}
export function fixtureRepository(release: ReleaseManifest | null = fixtureRelease(), rows = [fixtureRow()]) {
  const calls = { releases: 0, snapshots: 0, queries: [] as any[] };
  const repository: ReportRepository = { configured: true, release: async () => { calls.releases++; return release; }, assertSnapshots: async () => { calls.snapshots++; }, query: async compiled => { calls.queries.push(compiled); return { rows, jobId: 'synthetic-result-job', evidence: { durationMs: 1, bytesProcessed: '100', cacheHit: false, subqueryCount: 0, completion: 'COMPLETED' } }; } };
  return { repository, calls };
}
