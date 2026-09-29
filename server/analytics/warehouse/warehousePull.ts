import { getBigQueryClient, type AnalyticsBigQueryClient } from '../../bigquery/client';
import { RequestError } from '../../bigquery/filters';
import { getClientConfig, tableIdentifier } from '../../bigquery/config';
import { ALL_WAREHOUSE_OBJECTS, getWarehouseObject } from '../../bigquery/warehouseRegistry';
import type { DictionaryObject } from '../../../contracts/warehouseDictionary';

export interface WarehouseTableInfo {
  tableName: string; tableType: 'TABLE' | 'VIEW'; description: string;
  recordCountEstimate?: number; isUserProjectTable?: boolean; family?: string; disposition?: string;
  columnCount?: number; columns?: Array<{ name: string; type: string }>; dateFields: string[];
}
export interface WarehouseDatasetInfo { datasetId: string; name: string; tables: WarehouseTableInfo[] }
export interface WarehouseProjectInfo { projectId: string; name: string; isCurrentProject: boolean; datasets: WarehouseDatasetInfo[] }
export interface WarehouseReadAccess { clientId: string; role: string; tenants: string[] }
export interface PullTableDataOptions {
  project: string; dataset: string; table: string; limit?: number; offset?: number;
  startDate?: string; endDate?: string; dateField?: string; syncToCloudSql?: boolean;
  access?: WarehouseReadAccess;
}
export interface PulledTableColumn { name: string; type: string }
export interface PulledTableDataResult {
  project: string; dataset: string; table: string; totalRows: number;
  columns: PulledTableColumn[]; rows: Record<string, unknown>[]; limit: number; offset: number;
  latencyMs: number; bytesProcessed: string | null; queryJobId: string | null; pulledAt: string;
  syncedToCloudSql: false; syncedCount: 0; provenance: 'LIVE_BIGQUERY';
  metadata: {
    clientId: string; startDate: string; endDate: string; dateField: string; timezone: string;
    latestEventAtInWindow: string | null; sourceIngestedAt: null; freshnessStatus: 'NOT_VERIFIED';
    validationStatus: 'NOT_VERIFIED'; ordering: string; pagination: string; redactedFields: string[];
    totalRowsScope: 'selected_date_window';
  };
}

export function assertWarehouseReadAccess(access: WarehouseReadAccess | undefined): string {
  if (!access || access.role !== 'admin') throw new RequestError('Administrator access is required for raw warehouse inspection.', 403);
  const config = getClientConfig(access.clientId);
  if (config.id !== 'default_tenant' || !access.tenants.includes('default_tenant')) {
    throw new RequestError('Raw warehouse inspection requires explicit Offernet Master access. Use the tenant-scoped analytical reports for vendor workspaces.', 403);
  }
  return config.id;
}

/** Registry metadata is not a live row count, source approval or permission grant. */
export function buildAllProjectsAndTables(): WarehouseProjectInfo[] {
  return [...new Set(ALL_WAREHOUSE_OBJECTS.map(o => o.project))].map(projectId => ({
    projectId, name: projectId, isCurrentProject: false,
    datasets: [...new Set(ALL_WAREHOUSE_OBJECTS.filter(o => o.project === projectId).map(o => o.dataset))].map(datasetId => ({
      datasetId, name: datasetId,
      tables: ALL_WAREHOUSE_OBJECTS.filter(o => o.project === projectId && o.dataset === datasetId).map(o => ({
        tableName: o.tableName, tableType: o.tableType,
        description: `Catalogue: ${o.analyticalGrain}. Current schema and access are checked only when reading.`,
        family: o.family, disposition: o.disposition, columnCount: o.columns.length,
        columns: o.columns.map(c => ({ name: c.name, type: c.type })), dateFields: o.dateFields,
      })),
    })),
  }));
}
// Kept as a compatibility export; contents are catalogue metadata, not verified access.
export const VERIFIED_PROJECTS_AND_TABLES = buildAllProjectsAndTables();

export interface ObservedField { name: string; type: string; mode?: string; fields?: ObservedField[] }
const scalarTypes = new Set(['STRING', 'DATE', 'DATETIME', 'TIMESTAMP', 'INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC', 'BOOLEAN', 'BOOL']);
const column = (name: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new RequestError('Invalid warehouse field identifier.', 400);
  return `\`${name}\``;
};
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function warehouseWindow(start?: string, end?: string, now = new Date()) {
  if (!start && !end) {
    end = now.toISOString().slice(0, 10);
    start = new Date(Date.parse(`${end}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10);
  }
  if (!start || !end || !validDate(start) || !validDate(end)) throw new RequestError('Provide valid startDate and endDate (YYYY-MM-DD).', 400);
  const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (days < 1 || days > 366) throw new RequestError('Warehouse reads require an ordered window of at most 366 days.', 400);
  return { startDate: start, endDate: end };
}
function safeInteger(value: unknown, fallback: number, max: number, min: number) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new RequestError('Invalid warehouse pagination.', 400);
  return n;
}
export function resolveWarehouseObject(options: PullTableDataOptions): DictionaryObject {
  const obj = getWarehouseObject(options.project, options.dataset, options.table);
  if (!obj) throw new RequestError('This exact table is not registered for warehouse inspection.', 403);
  if (['restricted_detail', 'backup_duplicate', 'retired'].includes(obj.disposition)) {
    throw new RequestError('This restricted or duplicate source is not enabled for generic inspection. Use its approved analytical view.', 403);
  }
  return obj;
}
export function buildWarehouseReadPlan(options: PullTableDataOptions, fields: ObservedField[], now = new Date()) {
  const clientId = assertWarehouseReadAccess(options.access);
  const obj = resolveWarehouseObject(options);
  if (options.syncToCloudSql) throw new RequestError('Warehouse inspection is read-only. Legacy mixed-provenance sync is disabled; no source rows were written.', 409);
  const dates = warehouseWindow(options.startDate, options.endDate, now);
  const limit = safeInteger(options.limit, 50, 500, 1), offset = safeInteger(options.offset, 0, 100000, 0);
  const preferred = obj.tableName === 'lead_ledger_all_vicidial_insights_time_to_dial' ? 'first_dial_date' : obj.dateFields[0];
  const dateField = options.dateField || preferred;
  const observed = fields.find(f => f.name === dateField);
  if (!dateField || !obj.dateFields.includes(dateField) || !observed || observed.mode === 'REPEATED' || !['DATE', 'DATETIME', 'TIMESTAMP', 'STRING'].includes(observed.type.toUpperCase())) {
    throw new RequestError('DATE_MAPPING_REQUIRED: Choose a registered date field present in the readable live schema. No unbounded or unordered fallback is used.', 422);
  }
  const allowed = new Set([...obj.columns.map(c => c.name), ...obj.dateFields]);
  const redactedFields: string[] = [];
  const selected = fields.filter(f => {
    const sensitive = obj.sensitiveFields.includes(f.name) || /(?:^|_)(?:email|phone|mobile|surname|first_name|full_name|idno|password|secret|token|raw_data|comments)(?:_|$)/i.test(f.name);
    const safe = allowed.has(f.name) && !sensitive && f.mode !== 'REPEATED' && scalarTypes.has(f.type.toUpperCase());
    if (!safe) redactedFields.push(f.name);
    return safe;
  });
  if (!selected.length) throw new RequestError('No approved scalar fields are available for this preview.', 422);
  const projection = selected.map(f => `CAST(src.${column(f.name)} AS STRING) AS ${column(f.name)}`).join(', ');
  const names = selected.map(f => column(f.name)).join(', ');
  const event = `SAFE_CAST(src.${column(dateField)} AS TIMESTAMP)`;
  const query = `WITH scoped AS (
    SELECT ${projection}, ${event} AS _cx_event_at
    FROM ${tableIdentifier(`${obj.project}.${obj.dataset}.${obj.tableName}`)} src
    WHERE ${event} IS NOT NULL AND CAST(src.${column(dateField)} AS STRING) NOT LIKE '1900%' AND CAST(src.${column(dateField)} AS STRING) NOT LIKE '1970%'
      AND ${event} >= TIMESTAMP(@startDate, 'UTC')
      AND ${event} < TIMESTAMP(DATE_ADD(DATE(@endDate), INTERVAL 1 DAY), 'UTC')
  ) SELECT (SELECT CAST(COUNT(*) AS STRING) FROM scoped) AS total_rows,
    (SELECT FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', MAX(_cx_event_at), 'UTC') FROM scoped) AS latest_event_at,
    ARRAY(SELECT AS STRUCT ${names} FROM scoped
      ORDER BY _cx_event_at DESC, TO_JSON_STRING(STRUCT(${names})) ASC LIMIT @limit OFFSET @offset) AS records`;
  return { query, params: { ...dates, limit, offset }, dates, limit, offset, dateField, clientId, redactedFields,
    columns: selected.map(f => ({ name: f.name, type: f.type })) };
}

/** Never synthesize records, skip ADC, hide query errors or turn a sample count into a total. */
export async function pullWarehouseTableData(options: PullTableDataOptions,
  clientFactory: (project: string) => AnalyticsBigQueryClient = getBigQueryClient,
): Promise<PulledTableDataResult> {
  assertWarehouseReadAccess(options.access);
  resolveWarehouseObject(options);
  if (options.syncToCloudSql) throw new RequestError('Warehouse inspection is read-only; legacy sync is disabled.', 409);
  warehouseWindow(options.startDate, options.endDate);
  const started = Date.now();
  try {
    const client = clientFactory(options.project); // Supports ADC as well as explicit credentials.
    const [metadata] = await client.dataset(options.dataset).table(options.table).getMetadata();
    const plan = buildWarehouseReadPlan(options, metadata.schema?.fields || []);
    const [job] = await client.createQueryJob({ query: plan.query, params: plan.params, useQueryCache: false });
    const [results] = await job.getQueryResults({ autoPaginate: false, maxResults: 1 });
    const row = results[0];
    if (!row || !Array.isArray(row.records)) throw new RequestError('The warehouse returned an invalid result shape.', 502);
    const totalRows = Number(row.total_rows);
    if (!Number.isSafeInteger(totalRows) || totalRows < 0) throw new RequestError('The warehouse row count exceeds safe numeric limits or is invalid.', 502);
    if (row.records.length !== Math.min(plan.limit, Math.max(0, totalRows - plan.offset))) throw new RequestError('The warehouse returned incomplete page data. No partial result was substituted.', 502);
    const [jobMeta] = await job.getMetadata();
    return {
      project: options.project, dataset: options.dataset, table: options.table,
      totalRows, columns: plan.columns, rows: row.records, limit: plan.limit, offset: plan.offset,
      latencyMs: Date.now() - started, bytesProcessed: jobMeta.statistics?.query?.totalBytesProcessed == null ? null : String(jobMeta.statistics.query.totalBytesProcessed),
      queryJobId: job.id || null, pulledAt: new Date().toISOString(), syncedToCloudSql: false, syncedCount: 0,
      provenance: 'LIVE_BIGQUERY', metadata: {
        clientId: plan.clientId, ...plan.dates, dateField: plan.dateField, timezone: 'UTC',
        latestEventAtInWindow: row.latest_event_at || null, sourceIngestedAt: null, freshnessStatus: 'NOT_VERIFIED',
        validationStatus: 'NOT_VERIFIED', totalRowsScope: 'selected_date_window', redactedFields: plan.redactedFields,
        ordering: `${plan.dateField} descending; projected-value tie-break. Identical projected rows retain source multiplicity.`,
        pagination: 'Each page is a new query snapshot; changing upstream data may move rows. This preview is not a complete export.',
      },
    };
  } catch (error: unknown) {
    if (error instanceof RequestError) throw error;
    const code = Number((error as { code?: unknown })?.code);
    if ([401, 403].includes(code)) throw new RequestError('WAREHOUSE_ACCESS_DENIED: The server identity cannot read this source or execute its query.', 403);
    if (code === 404) throw new RequestError('WAREHOUSE_SOURCE_NOT_FOUND: The configured table or an upstream view dependency is unavailable.', 404);
    throw new RequestError('WAREHOUSE_QUERY_FAILED: No records were substituted. Check the runtime identity, source schema, query location and byte-billing limit.', 502);
  }
}
