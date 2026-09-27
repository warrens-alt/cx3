import { getBigQueryClient } from './client';
import { ALL_WAREHOUSE_OBJECTS } from './warehouseRegistry';
import { OBSERVED_EXPORT_FAILURES } from '../../contracts/warehouseDictionary';
import { RequestError } from './filters';

export interface SourceProbeRecord {
  sourceId: string;
  project: string;
  dataset: string;
  tableName: string;
  tenantId: string;
  ownershipPolicy: string;
  executionPrincipal: string | null;
  billingProject: string;
  datasetLocation: string | null;
  jobId: string | null;
  probeKind: 'BOUNDED_QUERY' | 'DRY_RUN' | 'METADATA';
  status:
    | 'ACCESSIBLE'
    | 'ACCESS_DENIED'
    | 'RESOURCE_NOT_FOUND'
    | 'LOCATION_MISMATCH'
    | 'QUOTA_EXCEEDED'
    | 'TIMEOUT'
    | 'QUERY_ERROR'
    | 'NOT_CHECKED';
  accessible: boolean | null;
  error: string | null;
  probeDurationMs: number | null;
  checkedAt: string | null;
  expiresAt: string | null;
  schemaVersion: string;
  rawErrorDetail?: string | null;
}

export interface ProbeStore {
  get(sourceId: string, tenantId: string): Promise<SourceProbeRecord | null>;
  set(record: SourceProbeRecord): Promise<void>;
  list(tenantId?: string): Promise<SourceProbeRecord[]>;
  invalidate(sourceId?: string, tenantId?: string): Promise<void>;
}

export class InMemoryProbeStore implements ProbeStore {
  private records = new Map<string, SourceProbeRecord>();

  private key(sourceId: string, tenantId: string): string {
    return `${tenantId}:${sourceId}`;
  }

  async get(sourceId: string, tenantId: string): Promise<SourceProbeRecord | null> {
    const key = this.key(sourceId, tenantId);
    const rec = this.records.get(key);
    if (!rec) return null;
    if (rec.expiresAt && Date.parse(rec.expiresAt) <= Date.now()) {
      this.records.delete(key);
      return null;
    }
    return rec;
  }

  async set(record: SourceProbeRecord): Promise<void> {
    this.records.set(this.key(record.sourceId, record.tenantId), record);
  }

  async list(tenantId?: string): Promise<SourceProbeRecord[]> {
    const now = Date.now();
    const result: SourceProbeRecord[] = [];
    for (const [key, rec] of this.records.entries()) {
      if (rec.expiresAt && Date.parse(rec.expiresAt) <= now) {
        this.records.delete(key);
      } else if (!tenantId || rec.tenantId === tenantId) {
        result.push(rec);
      }
    }
    return result;
  }

  async invalidate(sourceId?: string, tenantId?: string): Promise<void> {
    if (sourceId && tenantId) {
      this.records.delete(this.key(sourceId, tenantId));
    } else if (sourceId) {
      for (const [key, rec] of this.records.entries()) {
        if (rec.sourceId === sourceId) this.records.delete(key);
      }
    } else if (tenantId) {
      for (const [key, rec] of this.records.entries()) {
        if (rec.tenantId === tenantId) this.records.delete(key);
      }
    } else {
      this.records.clear();
    }
  }
}

export const defaultProbeStore = new InMemoryProbeStore();
export const PROBE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class ProbeService {
  constructor(
    private readonly store: ProbeStore = defaultProbeStore,
    private readonly clientFactory = getBigQueryClient,
  ) {}

  validateSourceId(sourceId: string): { project: string; dataset: string; tableName: string; objectDef: any } {
    if (!sourceId || typeof sourceId !== 'string') {
      throw new RequestError('sourceId is required (format: project.dataset.table)', 400);
    }
    const parts = sourceId.trim().split('.');
    if (parts.length !== 3 || parts.some(p => !p || !/^[a-zA-Z0-9_-]+$/.test(p))) {
      throw new RequestError('Invalid source ID format. Must be project.dataset.table with valid identifiers.', 400);
    }
    const [project, dataset, tableName] = parts;
    const match = ALL_WAREHOUSE_OBJECTS.find(
      o => o.project === project && o.dataset === dataset && o.tableName === tableName
    );
    if (!match) {
      throw new RequestError(`Unknown or unauthorized warehouse source: ${sourceId}`, 404);
    }
    return { project, dataset, tableName, objectDef: match };
  }

  async probeSource(
    sourceId: string,
    tenantId: string,
    principal: { subject: string; role: string; email?: string },
    options: { probeKind?: 'BOUNDED_QUERY' | 'DRY_RUN' } = {}
  ): Promise<SourceProbeRecord> {
    const { project, dataset, tableName, objectDef } = this.validateSourceId(sourceId);
    const probeKind = options.probeKind || 'BOUNDED_QUERY';
    const client = this.clientFactory(project);
    const startTime = Date.now();
    const checkedAt = new Date().toISOString();
    const expiresAt = new Date(startTime + PROBE_TTL_MS).toISOString();

    let status: SourceProbeRecord['status'] = 'ACCESSIBLE';
    let accessible: boolean | null = true;
    let errorMessage: string | null = null;
    let rawErrorDetail: string | null = null;
    let jobId: string | null = null;

    try {
      if (probeKind === 'DRY_RUN') {
        const dryResult = await client.dryRun({
          query: `SELECT 1 FROM \`${project}.${dataset}.${tableName}\` LIMIT 1`,
        });
        accessible = dryResult.totalBytesProcessed !== null;
      } else {
        const [job] = await client.createQueryJob({
          query: `SELECT 1 FROM \`${project}.${dataset}.${tableName}\` LIMIT 1`,
        });
        jobId = job?.id || null;
        await job.getQueryResults({ maxResults: 1 });
        accessible = true;
      }
    } catch (err: any) {
      accessible = false;
      const rawMsg = String(err?.message || 'Query execution failed');
      rawErrorDetail = rawMsg;
      if (/Access Denied|permission|403/i.test(rawMsg)) {
        status = 'ACCESS_DENIED';
        errorMessage = 'Access Denied: Querying identity does not have permission on dataset/table.';
      } else if (/Not found|404/i.test(rawMsg)) {
        status = 'RESOURCE_NOT_FOUND';
        errorMessage = 'Resource Not Found: Table or underlying view dependency does not exist.';
      } else if (/location|region/i.test(rawMsg)) {
        status = 'LOCATION_MISMATCH';
        errorMessage = 'Location Mismatch: Cross-region dataset join or execution region incompatible.';
      } else if (/quota|rateLimitExceeded/i.test(rawMsg)) {
        status = 'QUOTA_EXCEEDED';
        errorMessage = 'Quota Exceeded: Project or query concurrency quota exceeded.';
      } else if (/timeout|deadline/i.test(rawMsg)) {
        status = 'TIMEOUT';
        errorMessage = 'Timeout: Probe query timed out.';
      } else {
        status = 'QUERY_ERROR';
        errorMessage = 'Query Error: Probe query failed during execution.';
      }
    }

    const durationMs = Date.now() - startTime;
    const record: SourceProbeRecord = {
      sourceId,
      project,
      dataset,
      tableName,
      tenantId,
      ownershipPolicy: objectDef.ownershipField ? `field:${objectDef.ownershipField}` : 'dedicated_tenant_source',
      executionPrincipal: principal.role === 'admin' ? principal.email || principal.subject : null,
      billingProject: project,
      datasetLocation: null,
      jobId: principal.role === 'admin' ? jobId : null,
      probeKind,
      status,
      accessible,
      error: errorMessage,
      probeDurationMs: durationMs,
      checkedAt,
      expiresAt,
      schemaVersion: '2026-09-27',
      rawErrorDetail: principal.role === 'admin' ? rawErrorDetail : null,
    };

    await this.store.set(record);
    return record;
  }

  async getProbeRecord(sourceId: string, tenantId: string): Promise<SourceProbeRecord | null> {
    return this.store.get(sourceId, tenantId);
  }

  async listProbeRecords(tenantId: string): Promise<SourceProbeRecord[]> {
    return this.store.list(tenantId);
  }
}

export const probeService = new ProbeService();
