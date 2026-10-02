import { BigQuery } from '@google-cloud/bigquery';
import { RequestError } from '../bigquery/filters';
import { validateRelease } from './release';
import type { QueryExecutionEvidence, ReleaseManifest } from '../../contracts/reporting';
import type { CompiledQuery } from './query';
import { readOnlyQueryOptions } from '../bigquery/readOnly';
import { trackAnalyticalWork } from '../analyticalWork';

/** Preserve sub-millisecond snapshot identity; Date.parse alone silently discards it. */
function timestampNanoseconds(value: unknown): bigint | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const milliseconds = Date.parse(match[1] + match[3]);
  return Number.isFinite(milliseconds) ? BigInt(milliseconds) * 1_000_000n + BigInt((match[2] || '').padEnd(9, '0')) : null;
}
export interface ReportRepository {
  configured: boolean;
  release(tenant: string, releaseId?: string): Promise<ReleaseManifest | null>;
  assertSnapshots(release: ReleaseManifest): Promise<void>;
  query(query: CompiledQuery): Promise<{ rows: Record<string, any>[]; jobId: string; evidence?: QueryExecutionEvidence }>;
}
/** Dedicated read-only repository: no current-data fallback, no ambient legacy filter context. */
export class BigQueryReportRepository implements ReportRepository {
  readonly configured: boolean;
  private readonly dataset: string;
  private readonly bq: Pick<BigQuery, 'createQueryJob' | 'dataset'>;
  private readonly budget: string;
  constructor(client?: Pick<BigQuery, 'createQueryJob' | 'dataset'>) {
    this.dataset = process.env.CX_REPORTING_DATASET || '';
    if (this.dataset && !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_]+$/.test(this.dataset)) throw new Error('Invalid CX_REPORTING_DATASET');
    this.configured = !!this.dataset;
    this.budget = process.env.BIGQUERY_MAX_BYTES_BILLED || '1000000000';
    if (!/^\d+$/.test(this.budget) || BigInt(this.budget) <= 0n) throw new Error('Invalid query budget');
    if (client) this.bq = client;
    else {
      const credentials = process.env.BIGQUERY_CREDENTIALS ? JSON.parse(process.env.BIGQUERY_CREDENTIALS) : undefined;
      this.bq = new BigQuery({ projectId: this.dataset.split('.')[0] || undefined, credentials });
    }
  }
  async release(tenant: string, releaseId?: string) {
    if (!this.configured) return null;
    let result;
    try {
      result = await this.query({ query: `SELECT status, TO_JSON_STRING(manifest) AS manifest FROM \`${this.dataset}.reporting_releases\`
        WHERE tenant_id=@tenant ${releaseId ? 'AND release_id=@releaseId' : "AND status='PUBLISHED'"} ORDER BY published_at DESC LIMIT 2`, params: { tenant, ...(releaseId ? { releaseId } : {}) } });
    } catch (error: any) {
      if (error?.code === 404 || error?.status === 404 || error?.errors?.[0]?.reason === 'notFound' || (typeof error?.message === 'string' && error.message.includes('Not found: Table'))) {
        return null;
      }
      throw error;
    }
    if (!result.rows.length) return null;
    if (releaseId && result.rows.length !== 1) throw new RequestError('Duplicate reporting release IDs', 503);
    if (result.rows[0].status !== 'PUBLISHED') throw new RequestError('Reporting release was revoked', 410);
    let manifest: unknown;
    try {
      if (typeof result.rows[0].manifest !== 'string') throw new Error('Missing manifest');
      manifest = JSON.parse(result.rows[0].manifest);
    } catch { throw new RequestError('Published reporting release contains invalid manifest JSON', 503); }
    const release = validateRelease(manifest);
    if (release.tenantId !== tenant || (releaseId && release.releaseId !== releaseId)) throw new RequestError('Release identity mismatch', 503);
    return release;
  }
  async assertSnapshots(release: ReleaseManifest) {
    await Promise.all([...Object.values(release.snapshots), ...Object.values(release.provenance), ...(release.execution ? [release.execution.snapshot] : [])].map(async s => {
      const [project, dataset, id] = s.table.split('.');
      // Published facts must reside in the separately controlled reporting dataset.
      if (`${project}.${dataset}` !== this.dataset) throw new RequestError('Snapshot is outside the approved reporting dataset', 503);
      const [meta] = await this.bq.dataset(dataset, { projectId: project }).table(id).getMetadata();
      const snapshotTime = meta.snapshotDefinition?.snapshotTime;
      const createdAt = typeof meta.creationTime === 'string' && /^\d+$/.test(meta.creationTime) ? BigInt(meta.creationTime) * 1_000_000n : null;
      const frozenAt = timestampNanoseconds(snapshotTime);
      if (meta.type !== 'SNAPSHOT' || createdAt === null || frozenAt === null || createdAt !== timestampNanoseconds(s.createdAt) || frozenAt !== timestampNanoseconds(s.snapshotTime)) throw new RequestError('Snapshot was replaced, is missing, or is not read-only', 409);
    }));
  }
  async query(compiled: CompiledQuery) {
    return trackAnalyticalWork(async () => {
      const started = Date.now();
      const [job] = await this.bq.createQueryJob(readOnlyQueryOptions(compiled, this.budget));
      // With manual pagination the SDK can return nextQuery for a still-running job.
      // Retain the analytical quota until warehouse completion, then read one bounded page.
      await job.promise();
      const [rows, nextPage] = await job.getQueryResults({ maxResults: 101, autoPaginate: false });
      if (nextPage) throw new RequestError('Reporting result exceeded the bounded response; partial results are not supported', 422);
      const [metadata] = await job.getMetadata();
      const statistics = metadata.statistics?.query;
      const selectStatements = compiled.query.match(/\bSELECT\b/gi)?.length ?? 0;
      return { rows, jobId: job.id || 'unavailable', evidence: {
        durationMs: Date.now() - started,
        bytesProcessed: typeof statistics?.totalBytesProcessed === 'string' ? statistics.totalBytesProcessed : null,
        cacheHit: typeof statistics?.cacheHit === 'boolean' ? statistics.cacheHit : null,
        subqueryCount: Math.max(0, selectStatements - 1),
        completion: 'COMPLETED' as const,
      } };
    });
  }
}
