import { getBigQueryClient } from './client';
import { getClientConfig, tableIdentifier } from './config';
import { RequestError } from './filters';
import { trackAnalyticalWork } from '../analyticalWork';

export interface SchemaField {
  name: string;
  type: string;
  mode?: string;
  fields?: SchemaField[];
}

export interface TableMetadata {
  type: string;
  numRows?: string | null;
  schema?: { fields?: SchemaField[] };
}

export interface SourceAccess {
  metadata: (table: string) => Promise<TableMetadata>;
  listTables: (project: string, dataset: string) => Promise<string[]>;
  execute: (options: { query: string; params?: Record<string, any> }) => Promise<{ rows: any[]; jobId: string; referencedTables?: string[]; bytesProcessed?: string }>;
}

export function flatSchema(fields: SchemaField[], prefix = '', parentRepeated = false): Map<string, { type: string; mode?: string; repeated: boolean }> {
  const map = new Map<string, { type: string; mode?: string; repeated: boolean }>();
  for (const field of fields) {
    const isRepeated = parentRepeated || field.mode === 'REPEATED';
    const fullName = prefix ? `${prefix}.${field.name}` : field.name;
    map.set(fullName, {
      type: field.type.toUpperCase(),
      mode: field.mode,
      repeated: isRepeated,
    });
    if (field.fields && field.fields.length > 0) {
      const nested = flatSchema(field.fields, fullName, isRepeated);
      for (const [k, v] of nested) {
        map.set(k, v);
      }
    }
  }
  return map;
}

export function sourceMetricFieldAvailable(field: string | undefined, fields: Map<string, { type: string; repeated: boolean }>): boolean {
  if (!field) return true;
  const entry = fields.get(field);
  if (!entry) return false;
  if (entry.repeated) return false;
  const unsupported = ['RECORD', 'STRUCT', 'JSON', 'BYTES', 'GEOGRAPHY'];
  if (unsupported.includes(entry.type.toUpperCase())) return false;
  return true;
}

export function sourceAccess(clientId: string): SourceAccess {
  const clientConfig = getClientConfig(clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);

  return {
    async metadata(table: string): Promise<TableMetadata> {
      const parts = table.split('.');
      const [dataset, id] = parts.length === 3 ? [parts[1], parts[2]] : [parts[0], parts[1]];
      const projectId = parts.length === 3 ? parts[0] : clientConfig.bigQueryProject;
      const targetClient = getBigQueryClient(projectId);
      const [meta] = await targetClient.dataset(dataset).table(id).getMetadata();
      return meta;
    },
    async listTables(project: string, dataset: string): Promise<string[]> {
      const targetClient = getBigQueryClient(project);
      const [tables] = await targetClient.dataset(dataset).getTables();
      return tables.map((t: any) => `${project}.${dataset}.${t.id}`);
    },
    async execute(options: { query: string; params?: Record<string, any> }) {
      return trackAnalyticalWork(async () => {
        const [job] = await client.createQueryJob({
          query: options.query,
          params: options.params,
          useLegacySql: false,
        });
        const [rows] = await job.getQueryResults();
        const [meta] = await job.getMetadata();
        return {
          rows,
          jobId: job.id || 'job',
          referencedTables: meta.statistics?.query?.referencedTables?.map((t: any) => `${t.projectId}.${t.datasetId}.${t.tableId}`) || [],
          bytesProcessed: meta.statistics?.query?.totalBytesProcessed || '0',
        };
      });
    },
  };
}
