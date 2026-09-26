import { getBigQueryClient } from './client';
import { getClientConfig } from './config';
import { trackAnalyticalWork } from '../analyticalWork';
import { QueryCache } from '../cache';

export interface SchemaField { name: string; type: string; mode?: string; fields?: SchemaField[] }
export interface TableMetadata { type: string; numRows?: string | null; schema?: { fields?: SchemaField[] } }
export interface SourceAccess {
  metadata: (table: string) => Promise<TableMetadata>;
  listTables: (project: string, dataset: string) => Promise<string[]>;
  execute: (options: { query: string; params?: Record<string, any> }) => Promise<{ rows: any[]; jobId: string; referencedTables?: string[]; bytesProcessed?: string }>;
}
const metadataWork = new QueryCache(64);

/** SDK error payloads may embed credentials, headers or SQL. */
export function safeSourceError(error: unknown): { status: string; error: string } {
  const failure = error && typeof error === 'object' ? error as { status?: unknown; code?: unknown } : {};
  const code = String(failure.status ?? failure.code ?? '');
  if (['401', '16', 'UNAUTHENTICATED'].includes(code)) return { status: 'AUTHENTICATION_REQUIRED', error: 'Warehouse authentication failed. Configure valid Application Default Credentials.' };
  if (['403', '7', 'PERMISSION_DENIED'].includes(code)) return { status: 'ACCESS_DENIED', error: 'Warehouse access denied. Verify the runtime identity has the required read and query permissions.' };
  if (['404', '5', 'NOT_FOUND'].includes(code)) return { status: 'NOT_FOUND', error: 'The configured warehouse source was not found.' };
  if (['400', '422', '3', 'INVALID_ARGUMENT'].includes(code)) return { status: 'INVALID_REQUEST', error: 'The source schema or requested scope is unsupported. Check configured mappings and reporting dates.' };
  if (['429', '8', 'RESOURCE_EXHAUSTED'].includes(code)) return { status: 'RATE_LIMITED', error: 'Warehouse quota or query budget was exceeded. Retry after checking the configured limits.' };
  return { status: 'UNAVAILABLE', error: 'Warehouse source unavailable. Check network connectivity, credentials and source configuration.' };
}
type FieldInfo = { type: string; mode?: string; repeated: boolean };
/** BigQuery column/field identifiers are case-insensitive; retain the original names when iterating. */
class SchemaIndex extends Map<string, FieldInfo> {
  private readonly names = new Map<string, string>();
  override set(key: string, value: FieldInfo): this {
    this.names.set(key.toLowerCase(), key);
    return super.set(key, value);
  }
  override get(key: string): FieldInfo | undefined { return super.get(this.names.get(key.toLowerCase()) ?? key); }
  override has(key: string): boolean { return super.has(this.names.get(key.toLowerCase()) ?? key); }
}
export function flatSchema(fields: SchemaField[], prefix = '', parentRepeated = false): Map<string, FieldInfo> {
  const map = new SchemaIndex();
  for (const field of fields) {
    const isRepeated = parentRepeated || field.mode?.toUpperCase() === 'REPEATED';
    const fullName = prefix ? `${prefix}.${field.name}` : field.name;
    map.set(fullName, { type: field.type.toUpperCase(), mode: field.mode, repeated: isRepeated });
    if (field.fields?.length) for (const [key, value] of flatSchema(field.fields, fullName, isRepeated)) map.set(key, value);
  }
  return map;
}
export function sourceMetricFieldAvailable(field: string | undefined, fields: Map<string, { type: string; repeated: boolean }>): boolean {
  if (!field) return true;
  const entry = fields.get(field);
  if (!entry || entry.repeated) return false;
  return !['RECORD', 'STRUCT', 'JSON', 'BYTES', 'GEOGRAPHY'].includes(entry.type.toUpperCase());
}
export function sourceAccess(clientId: string): SourceAccess {
  const clientConfig = getClientConfig(clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  return {
    async metadata(table: string): Promise<TableMetadata> {
      const parts = table.split('.');
      const [dataset, id] = parts.length === 3 ? [parts[1], parts[2]] : [parts[0], parts[1]];
      const projectId = parts.length === 3 ? parts[0] : clientConfig.bigQueryProject;
      const key = JSON.stringify(['source-metadata', clientConfig.id, projectId, dataset, id]);
      const meta = await metadataWork.getOrFetch<TableMetadata>(key, async () => {
        const [value] = await getBigQueryClient(projectId).dataset(dataset).table(id).getMetadata();
        return value as TableMetadata;
      }, 0);
      return structuredClone(meta);
    },
    async listTables(project: string, dataset: string): Promise<string[]> {
      const key = JSON.stringify(['source-list', clientConfig.id, project, dataset]);
      const tables = await metadataWork.getOrFetch<string[]>(key, async () => {
        const [values] = await getBigQueryClient(project).dataset(dataset).getTables();
        return values.map((table: any) => `${project}.${dataset}.${table.id}`);
      }, 0);
      return [...tables];
    },
    async execute(options: { query: string; params?: Record<string, any> }) {
      return trackAnalyticalWork(async () => {
        const [job] = await client.createQueryJob({ query: options.query, params: options.params, useLegacySql: false });
        const [rows] = await job.getQueryResults();
        const [meta] = await job.getMetadata();
        return { rows, jobId: job.id || 'job', referencedTables: meta.statistics?.query?.referencedTables?.map((table: any) => `${table.projectId}.${table.datasetId}.${table.tableId}`) || [], bytesProcessed: meta.statistics?.query?.totalBytesProcessed || '0' };
      });
    },
  };
}
