import { createHmac, timingSafeEqual } from 'node:crypto';
import { AGGREGATE_SNAPSHOT_VERSION, METRIC_BY_ID, REPORT_REPLAY_VERSION, type EvidenceReportResult, type ImmutableReportComparison, type MetricResult, type ReportReplayResult, type SnapshotIdentity } from '../../contracts/reporting';
import { exactDecimal } from '../../contracts/exactDecimal';
import { RequestError } from '../bigquery/filters';
import { requireTenant, type Principal } from '../securityPolicy';
import { canonicalJson, fingerprint, REPORT_DEFINITION_HASH } from './fingerprint';
import { validateRelease } from './release';
import type { ReportRepository } from './repository';
import { allowedKeys, object, reportIdentity, reportRequest } from './scope';
import { executeReport, reportingPrincipal } from './service';

const MAX_TOKEN_BYTES = 56_000;
const MAX_PAYLOAD_BYTES = 40_000;
const REPLAY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
interface ReplayDescriptor {
  contractVersion: typeof REPORT_REPLAY_VERSION;
  generationContract: typeof AGGREGATE_SNAPSHOT_VERSION;
  definitionHash: string; manifestHash: string; snapshot: SnapshotIdentity;
  issuedAt: string; expiresAt: string;
  original: ImmutableReportComparison;
}

function signingKey(value = process.env.CX_REPORT_SIGNING_KEY): string | null {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32 && Buffer.byteLength(value, 'utf8') <= 4096 ? value : null;
}
export function replayConfigured(): boolean { return signingKey() !== null; }

function comparison(report: EvidenceReportResult): ImmutableReportComparison {
  const metric = (row: MetricResult): MetricResult => ({ metricId: row.metricId, group: row.group, value: row.value, numerator: row.numerator, denominator: row.denominator, unit: row.unit, calculationStatus: row.calculationStatus, completeness: row.completeness, reason: row.reason });
  return { resultHash: report.resultHash, generatedAt: report.generatedAt, request: report.request, totals: report.totals.map(metric), groups: report.groups.map(metric) };
}

/** Tokens contain aggregate evidence and approved scope, never credentials, record identities or SQL. */
export function attachReplayToken(report: EvidenceReportResult, keyValue?: string, now = new Date()): EvidenceReportResult {
  const key = signingKey(keyValue);
  if (report.status !== 'AVAILABLE' || !report.snapshot || report.queryEvidence.completion !== 'COMPLETED') return { ...report, token: null, replay: { status: 'NOT_REPLAYABLE', expiresAt: null, reason: 'An available immutable execution is required for replay.' } };
  if (!key) return { ...report, token: null, replay: { status: 'NOT_CONFIGURED', expiresAt: null, reason: 'A server-only signing key of at least 32 bytes must be configured.' } };
  const expiresAt = new Date(now.getTime() + REPLAY_TTL_MS).toISOString();
  const descriptor: ReplayDescriptor = { contractVersion: REPORT_REPLAY_VERSION, generationContract: report.generationContract, definitionHash: REPORT_DEFINITION_HASH, manifestHash: report.manifestHash, snapshot: report.snapshot, issuedAt: now.toISOString(), expiresAt, original: comparison(report) };
  const serialized = canonicalJson(descriptor);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) return { ...report, token: null, replay: { status: 'NOT_REPLAYABLE', expiresAt: null, reason: 'The aggregate evidence exceeds the signed descriptor limit; select fewer metrics or groups.' } };
  const payload = Buffer.from(serialized).toString('base64url');
  const signature = createHmac('sha256', key).update(payload).digest('base64url');
  return { ...report, token: `${payload}.${signature}`, replay: { status: 'AVAILABLE', expiresAt, reason: null } };
}

function decodeToken(token: string, key: string, now: Date): ReplayDescriptor {
  if (Buffer.byteLength(token) > MAX_TOKEN_BYTES || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invalid replay token');
  const [payload, signature] = token.split('.');
  const supplied = Buffer.from(signature, 'base64url'), expected = createHmac('sha256', key).update(payload).digest();
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected) || supplied.toString('base64url') !== signature) throw new Error('Invalid replay signature');
  const decoded = Buffer.from(payload, 'base64url');
  if (decoded.byteLength > MAX_PAYLOAD_BYTES || decoded.toString('base64url') !== payload) throw new Error('Invalid replay payload');
  const raw = object(JSON.parse(decoded.toString('utf8')), 'replay descriptor');
  allowedKeys(raw, ['contractVersion', 'generationContract', 'definitionHash', 'manifestHash', 'snapshot', 'issuedAt', 'expiresAt', 'original'], 'replay descriptor');
  if (raw.contractVersion !== REPORT_REPLAY_VERSION || raw.generationContract !== AGGREGATE_SNAPSHOT_VERSION || raw.definitionHash !== REPORT_DEFINITION_HASH || typeof raw.manifestHash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.manifestHash)) throw new Error('Unsupported replay generation contract');
  const issuedAt = typeof raw.issuedAt === 'string' ? Date.parse(raw.issuedAt) : NaN, expiresAt = typeof raw.expiresAt === 'string' ? Date.parse(raw.expiresAt) : NaN;
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= now.getTime() || issuedAt > now.getTime() + 60_000 || expiresAt <= issuedAt || expiresAt - issuedAt > REPLAY_TTL_MS) throw new Error('Replay token is expired or has invalid validity dates');
  const original = object(raw.original, 'original immutable result');
  allowedKeys(original, ['resultHash', 'generatedAt', 'request', 'totals', 'groups'], 'original immutable result');
  if (typeof original.resultHash !== 'string' || !/^[a-f0-9]{64}$/.test(original.resultHash) || typeof original.generatedAt !== 'string' || !Number.isFinite(Date.parse(original.generatedAt)) || !Array.isArray(original.totals) || !Array.isArray(original.groups) || original.totals.length + original.groups.length > 100) throw new Error('Invalid original immutable result');
  const request = reportRequest(original.request);
  if (canonicalJson(request) !== canonicalJson(original.request)) throw new Error('Replay scope is not canonical');
  const snapshot = object(raw.snapshot, 'snapshot');
  allowedKeys(snapshot, ['table', 'createdAt', 'snapshotTime'], 'snapshot');
  if (typeof snapshot.table !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(snapshot.table) || ['createdAt', 'snapshotTime'].some(key => typeof snapshot[key] !== 'string' || !Number.isFinite(Date.parse(snapshot[key] as string)))) throw new Error('Invalid replay snapshot identity');
  const keys = new Set<string>();
  for (const [total, rows] of [[true, original.totals], [false, original.groups]] as const) {
    for (const value of rows) {
      const row = object(value, 'original metric');
      allowedKeys(row, ['metricId', 'group', 'value', 'numerator', 'denominator', 'unit', 'calculationStatus', 'completeness', 'reason'], 'original metric');
      if (typeof row.metricId !== 'string' || !request.metrics.includes(row.metricId) || row.unit !== METRIC_BY_ID[row.metricId].unit || (total ? row.group !== null : typeof row.group !== 'string' || row.group.length > 256) || !['CHECKED', 'UNAVAILABLE'].includes(row.calculationStatus as string) || !['COMPLETE', 'PARTIAL', 'UNAVAILABLE'].includes(row.completeness as string)) throw new Error('Invalid original metric contract');
      if (['value', 'numerator', 'denominator'].some(field => row[field] !== null && (typeof row[field] !== 'string' || row[field].length > 80 || exactDecimal(row[field]) === null)) || (row.reason !== null && (typeof row.reason !== 'string' || row.reason.length > 1000))) throw new Error('Invalid original metric values');
      const identity = JSON.stringify([total, row.metricId, row.group]);
      if (keys.has(identity)) throw new Error('Duplicate original metric');
      keys.add(identity);
    }
  }
  if (request.metrics.some(id => !(original.totals as MetricResult[]).some(row => row.metricId === id))) throw new Error('Missing original metric');
  return raw as unknown as ReplayDescriptor;
}

export async function replayReport(repo: ReportRepository, principal: Principal | undefined, input: unknown, options: { signingKey?: string; now?: Date } = {}): Promise<ReportReplayResult> {
  const authority = reportingPrincipal(principal);
  const body = object(input, 'replay request');
  allowedKeys(body, ['contractVersion', 'tenantId', 'token'], 'replay request');
  const tenant = reportIdentity(body.tenantId, 'tenantId'); requireTenant(authority, tenant);
  const now = options.now || new Date();
  const result = (status: ReportReplayResult['status'], reason: string, original: ImmutableReportComparison | null = null, replayed: ImmutableReportComparison | null = null): ReportReplayResult => ({ contractVersion: REPORT_REPLAY_VERSION, status, reason, original, replayed, comparedAt: now.toISOString(), comparisonKind: 'IMMUTABLE_REPRODUCTION', reconciliationStatus: 'NOT_VERIFIED', businessMeaningStatus: 'NOT_VERIFIED' });
  if (body.contractVersion !== REPORT_REPLAY_VERSION || typeof body.token !== 'string') return result('REPLAY_INVALID', 'Unsupported replay request version or missing token.');
  const key = signingKey(options.signingKey);
  if (!key) return result('NOT_REPLAYABLE', 'Replay signing is not configured.');
  let descriptor: ReplayDescriptor;
  try { descriptor = decodeToken(body.token, key, now); }
  catch { return result('REPLAY_INVALID', 'Replay signature, expiry or generation contract is invalid.'); }
  if (descriptor.original.request.tenantId !== tenant) throw new RequestError('Replay tenant access denied', 403);
  requireTenant(authority, descriptor.original.request.tenantId);
  if (!repo.configured) return result('RELEASE_UNAVAILABLE', 'The approved reporting dataset is not configured.', descriptor.original);
  try {
    const raw = await repo.release(tenant, descriptor.original.request.releaseId);
    if (!raw) return result('RELEASE_UNAVAILABLE', 'The original immutable release is unavailable.', descriptor.original);
    const release = validateRelease(raw);
    if (release.status !== 'PUBLISHED') return result('RELEASE_UNAVAILABLE', 'The original immutable release is no longer published.', descriptor.original);
    if (fingerprint(release) !== descriptor.manifestHash || fingerprint(release.execution?.snapshot) !== fingerprint(descriptor.snapshot)) return result('REPLAY_INVALID', 'The immutable release manifest or snapshot identity changed; execution was refused.', descriptor.original);
    const report = await executeReport(repo, authority, descriptor.original.request);
    // executeReport loads the release again: detect replacement between lookup and execution as well.
    if (report.manifestHash !== descriptor.manifestHash) return result('REPLAY_INVALID', 'The immutable release changed during replay.', descriptor.original);
    if (report.status !== 'AVAILABLE') return result('NOT_REPLAYABLE', 'Required immutable metric evidence is unavailable.', descriptor.original);
    const replayed = comparison(report);
    return report.resultHash === descriptor.original.resultHash
      ? result('MATCH', 'The immutable result was reproduced exactly. This is reproducibility evidence, not independent source reconciliation.', descriptor.original, replayed)
      : result('MISMATCH', 'The replay differs from the original immutable result; investigate the release and snapshot evidence.', descriptor.original, replayed);
  } catch {
    return result('RELEASE_UNAVAILABLE', 'The original release or its required snapshot evidence could not be read and validated.', descriptor.original);
  }
}
