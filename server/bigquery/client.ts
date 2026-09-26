import { BigQuery, type Query } from '@google-cloud/bigquery';
import { vendorScope } from '../analyticsContext';
import { tableIdentifier } from './config';
import { readOnlyQueryOptions } from './readOnly';
import { trackAnalyticalWork } from '../analyticalWork';
const clients = new Map<string, AnalyticsBigQueryClient>();
export function guardedQueryOptions(options: Query): Query {
  const queryStr = typeof options === 'string' ? options : (options.query || '');
  const baseParams = typeof options === 'object' && options.params && !Array.isArray(options.params) ? options.params : {};
  return readOnlyQueryOptions({
    ...(typeof options === 'object' ? options : {}),
    query: queryStr,
    params: { ...baseParams, ...vendorScope().params },
  });
}
/** Keep the SDK behind one scoped query boundary so older reporting modules receive the same vendor bindings. */
export class AnalyticsBigQueryClient {
  constructor(private readonly bq: BigQuery) {}
  query(options: Query) { return trackAnalyticalWork(() => this.bq.query(guardedQueryOptions(options))); }
  createQueryJob(options: Query) { return this.bq.createQueryJob(guardedQueryOptions(options)); }
  getDatasets() { return this.bq.getDatasets(); }
  dataset(datasetId: string) { return this.bq.dataset(datasetId); }
}
export function getBigQueryClient(projectId: string): AnalyticsBigQueryClient {
  if (!clients.has(projectId)) {
    let credentials;
    if (process.env.BIGQUERY_CREDENTIALS) {
      try { credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS); }
      catch { throw new Error('BIGQUERY_CREDENTIALS is invalid; refusing a silent identity fallback'); }
    }
    clients.set(projectId, new AnalyticsBigQueryClient(new BigQuery({ projectId, credentials })));
  }
  return clients.get(projectId)!;
}
export async function checkBigQueryHealth(projectId: string, datasetId: string, tableId: string, client = getBigQueryClient(projectId)) {
  const [rows] = await client.query({ query: `SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', MAX(SAFE_CAST(fetched AS TIMESTAMP)), 'UTC') AS latest FROM ${tableIdentifier(`${projectId}.${datasetId}.${tableId}`)}` });
  return { status: 'Connected', latestData: rows[0]?.latest || null, freshnessVerified: false };
}
