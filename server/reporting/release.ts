import { RequestError } from '../bigquery/filters';
import { AGGREGATE_SNAPSHOT_VERSION, FACTS, METRIC_BY_ID, type ReleaseManifest } from '../../contracts/reporting';

const nonEmpty = (value: unknown, field: string, max = 256): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new RequestError(`Missing or invalid ${field} in release manifest`, 503);
  }
  return value;
};

const iso = (value: unknown, field: string): string => {
  const text = nonEmpty(value, field, 64);
  if (!Number.isFinite(Date.parse(text))) throw new RequestError(`Invalid ${field} in release manifest`, 503);
  return text;
};

const snapshot = (value: unknown, field: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestError(`Missing ${field} snapshot in release manifest`, 503);
  }
  const entry = value as Record<string, unknown>;
  const table = nonEmpty(entry.table, `${field}.table`, 300);
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(table)) {
    throw new RequestError(`Invalid ${field}.table in release manifest`, 503);
  }
  iso(entry.createdAt, `${field}.createdAt`);
  iso(entry.snapshotTime, `${field}.snapshotTime`);
};

export function validateRelease(raw: unknown): ReleaseManifest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RequestError('Invalid release manifest format', 503);
  }

  const release = raw as Record<string, any>;
  nonEmpty(release.releaseId, 'releaseId', 80);
  if (!/^[A-Za-z0-9_-]+$/.test(release.releaseId)) throw new RequestError('Invalid releaseId in manifest', 503);
  nonEmpty(release.tenantId, 'tenantId', 80);
  if (!/^[A-Za-z0-9_-]+$/.test(release.tenantId)) throw new RequestError('Invalid tenantId in manifest', 503);
  nonEmpty(release.modelVersion, 'modelVersion', 80);
  nonEmpty(release.metricVersion, 'metricVersion', 80);
  nonEmpty(release.engineHash, 'engineHash', 128);
  if (release.status !== 'PUBLISHED' && release.status !== 'REVOKED') {
    throw new RequestError('Invalid release status in manifest', 503);
  }
  iso(release.builtAt, 'builtAt');
  iso(release.cutoff, 'cutoff');
  nonEmpty(release.approvedBy, 'approvedBy');
  nonEmpty(release.approvalReference, 'approvalReference');

  if (!Array.isArray(release.sourceBatchIds) || release.sourceBatchIds.some((id: unknown) => typeof id !== 'string' || !id)) {
    throw new RequestError('Invalid sourceBatchIds in release manifest', 503);
  }

  if (!release.snapshots || typeof release.snapshots !== 'object' || Array.isArray(release.snapshots)) {
    throw new RequestError('Invalid snapshots in release manifest', 503);
  }
  for (const fact of FACTS) snapshot(release.snapshots[fact], `snapshots.${fact}`);

  if (!release.provenance || typeof release.provenance !== 'object' || Array.isArray(release.provenance)) {
    throw new RequestError('Invalid provenance in release manifest', 503);
  }
  for (const key of ['records', 'batches', 'contracts'] as const) snapshot(release.provenance[key], `provenance.${key}`);

  if (!Array.isArray(release.sources)) throw new RequestError('Invalid sources in release manifest', 503);
  const seenFacts = new Set<string>();
  for (const source of release.sources) {
    if (!source || typeof source !== 'object' || !FACTS.includes(source.fact)) throw new RequestError('Invalid source evidence in release manifest', 503);
    if (seenFacts.has(source.fact)) throw new RequestError('Duplicate source evidence in release manifest', 503);
    seenFacts.add(source.fact);
    if (!['COMPLETE', 'PARTIAL', 'UNAVAILABLE'].includes(source.status)) throw new RequestError('Invalid source status in release manifest', 503);
    nonEmpty(source.contractVersion, 'source.contractVersion', 80);
    nonEmpty(source.owner, 'source.owner');
    nonEmpty(source.approvalReference, 'source.approvalReference');
    if (source.completeThrough !== null) iso(source.completeThrough, 'source.completeThrough');
    if (source.earliestAvailable !== null) iso(source.earliestAvailable, 'source.earliestAvailable');
  }
  if (seenFacts.size !== FACTS.length) throw new RequestError('Release manifest must include source evidence for every fact', 503);

  if (!Array.isArray(release.checks)) throw new RequestError('Invalid checks in release manifest', 503);
  for (const check of release.checks) {
    if (!check || typeof check !== 'object') throw new RequestError('Invalid check evidence in release manifest', 503);
    nonEmpty(check.id, 'check.id', 128);
    if (!['PASS', 'FAIL', 'NOT_RUN'].includes(check.status)) throw new RequestError('Invalid check status in release manifest', 503);
    if (typeof check.observed !== 'string' || typeof check.expected !== 'string') throw new RequestError('Invalid check values in release manifest', 503);
    nonEmpty(check.jobId, 'check.jobId', 256);
  }

  if (release.execution !== undefined) {
    const execution = release.execution;
    if (!execution || typeof execution !== 'object' || Array.isArray(execution)) throw new RequestError('Invalid execution contract in release manifest', 503);
    if (execution.contractVersion !== AGGREGATE_SNAPSHOT_VERSION) throw new RequestError('Unsupported release execution contract', 503);
    if (!/^[a-f0-9]{64}$/.test(execution.definitionHash)) throw new RequestError('Invalid execution definition hash', 503);
    snapshot(execution.snapshot, 'execution.snapshot');
    for (const [name, allowed] of Object.entries({ supportedMetrics: Object.keys(METRIC_BY_ID), supportedDateBases: ['capture_cohort', 'event_date'], supportedGroupings: ['none', 'source', 'vendor', 'capture_month'], supportedFilters: ['vendor', 'source', 'medium'] })) {
      const values = execution[name];
      if (!Array.isArray(values) || (name !== 'supportedFilters' && !values.length) || values.length > allowed.length || new Set(values).size !== values.length || values.some(value => typeof value !== 'string' || !allowed.includes(value))) throw new RequestError(`Invalid execution ${name}`, 503);
    }
  }

  return release as ReleaseManifest;
}
