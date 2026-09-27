import { BigQuery, type Query } from '@google-cloud/bigquery';
import { vendorScope } from '../analyticsContext';
import { tableIdentifier } from './config';
import { readOnlyQueryOptions, readOnlyDryRunQueryOptions } from './readOnly';
import { trackAnalyticalWork } from '../analyticalWork';

const clients = new Map<string, AnalyticsBigQueryClient>();

export function parseBigQueryCredentials(raw: string): any {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }
  // Try base64 decoding if the credentials string does not start with JSON brace
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
    if (decoded.startsWith('{')) {
      return JSON.parse(decoded);
    }
  } catch {
    // fall back to direct JSON parse attempt
  }
  return JSON.parse(trimmed);
}

export function guardedQueryOptions(options: Query): Query {
  const queryStr = typeof options === 'string' ? options : (options.query || '');
  const baseParams = typeof options === 'object' && options.params && !Array.isArray(options.params) ? options.params : {};
  return readOnlyQueryOptions({
    ...(typeof options === 'object' ? options : {}),
    query: queryStr,
    params: { ...baseParams, ...vendorScope().params },
  });
}

export function guardedDryRunQueryOptions(options: Query): Query {
  const queryStr = typeof options === 'string' ? options : (options.query || '');
  const baseParams = typeof options === 'object' && options.params && !Array.isArray(options.params) ? options.params : {};
  return readOnlyDryRunQueryOptions({
    ...(typeof options === 'object' ? options : {}),
    query: queryStr,
    params: { ...baseParams, ...vendorScope().params },
  });
}

/** Keep the SDK behind one scoped query boundary so older reporting modules receive the same vendor bindings. */
export class AnalyticsBigQueryClient {
  constructor(private readonly bq: BigQuery) {}

  query(options: Query) {
    return trackAnalyticalWork(() => this.bq.query(guardedQueryOptions(options)));
  }

  createQueryJob(options: Query) {
    return this.bq.createQueryJob(guardedQueryOptions(options));
  }

  async dryRun(options: Query): Promise<{ totalBytesProcessed: number | null }> {
    const guarded = guardedDryRunQueryOptions(options);
    const [job] = await this.bq.createQueryJob(guarded);
    const metadata = job.metadata;
    const bytes = metadata?.statistics?.totalBytesProcessed;
    return {
      totalBytesProcessed: bytes ? Number(bytes) : null,
    };
  }

  getDatasets() {
    return this.bq.getDatasets();
  }

  dataset(datasetId: string) {
    return this.bq.dataset(datasetId);
  }

  get projectId(): string {
    return this.bq.projectId;
  }
}

export function getBigQueryClient(projectId: string): AnalyticsBigQueryClient {
  if (!clients.has(projectId)) {
    let credentials;
    if (process.env.BIGQUERY_CREDENTIALS) {
      try {
        credentials = parseBigQueryCredentials(process.env.BIGQUERY_CREDENTIALS);
      } catch {
        throw new Error('BIGQUERY_CREDENTIALS is invalid; refusing a silent identity fallback');
      }
    }
    clients.set(projectId, new AnalyticsBigQueryClient(new BigQuery({ projectId, credentials })));
  }
  return clients.get(projectId)!;
}

export interface BigQueryHealthResult {
  status: 'Connected' | 'Degraded' | 'Error';
  latestData: string | null;
  freshnessVerified: boolean;
  latencyMs?: number;
  projectId: string;
  dataset: string;
  table: string;
  engine: string;
  maxBytesBilledCeiling: string;
  error?: string;
}

export async function checkBigQueryHealth(
  projectId: string,
  datasetId: string,
  tableId: string,
  client = getBigQueryClient(projectId)
): Promise<BigQueryHealthResult> {
  const start = Date.now();
  try {
    const [rows] = await client.query({
      query: `SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', MAX(SAFE_CAST(fetched AS TIMESTAMP)), 'UTC') AS latest FROM ${tableIdentifier(`${projectId}.${datasetId}.${tableId}`)}`,
    });
    const latencyMs = Date.now() - start;
    return {
      status: 'Connected',
      latestData: rows[0]?.latest || null,
      freshnessVerified: false,
      latencyMs,
      projectId,
      dataset: datasetId,
      table: tableId,
      engine: 'Google BigQuery',
      maxBytesBilledCeiling: process.env.BIGQUERY_MAX_BYTES_BILLED || '1000000000',
    };
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    return {
      status: 'Error',
      latestData: null,
      freshnessVerified: false,
      latencyMs,
      projectId,
      dataset: datasetId,
      table: tableId,
      engine: 'Google BigQuery',
      maxBytesBilledCeiling: process.env.BIGQUERY_MAX_BYTES_BILLED || '1000000000',
      error: error?.message || 'BigQuery query failed',
    };
  }
}
