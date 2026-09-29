import { fetchAnalyticsJson } from './analyticsRequest';

export interface WarehouseTableInfo {
  tableName: string;
  tableType: 'TABLE' | 'VIEW';
  description: string;
  recordCountEstimate?: number;
  isUserProjectTable?: boolean;
  family?: string;
  disposition?: string;
  columnCount?: number;
  columns?: Array<{ name: string; type: string }>;
}

export interface WarehouseDatasetInfo {
  datasetId: string;
  name: string;
  tables: WarehouseTableInfo[];
}

export interface WarehouseProjectInfo {
  projectId: string;
  name: string;
  isCurrentProject: boolean;
  datasets: WarehouseDatasetInfo[];
}

export interface PulledTableColumn {
  name: string;
  type: string;
}

export interface PulledTableDataResult {
  project: string;
  dataset: string;
  table: string;
  totalRows: number;
  columns: PulledTableColumn[];
  rows: Record<string, any>[];
  limit: number;
  offset: number;
  latencyMs: number;
  bytesProcessed: string;
  queryJobId: string;
  pulledAt: string;
  syncedToCloudSql: boolean;
  syncedCount?: number;
  provenance?: 'LIVE_BIGQUERY' | 'OFFLINE_EVIDENCE_REPRESENTATION';
}

export interface CloudSqlSyncedRecord {
  id: number;
  project: string;
  dataset: string;
  tableName: string;
  recordKey?: string;
  data: Record<string, any>;
  syncedAt: string;
  syncedBy?: string;
}

export async function fetchWarehouseProjectsAndTables(
  signal?: AbortSignal
): Promise<WarehouseProjectInfo[]> {
  const res = await fetchAnalyticsJson<WarehouseProjectInfo[]>(
    '/api/analytics/warehouse/projects-and-tables',
    signal
  );
  return res.data || [];
}

export async function pullWarehouseTableData(
  options: {
    project: string;
    dataset: string;
    table: string;
    limit?: number;
    offset?: number;
    syncToCloudSql?: boolean;
  },
  signal?: AbortSignal
): Promise<PulledTableDataResult> {
  const res = await fetch('/api/analytics/warehouse/pull-data', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

export async function fetchSyncedCloudSqlRecords(
  options: {
    project?: string;
    dataset?: string;
    tableName?: string;
    limit?: number;
    offset?: number;
  } = {},
  signal?: AbortSignal
): Promise<{ data: CloudSqlSyncedRecord[]; count: number }> {
  const params = new URLSearchParams();
  if (options.project) params.set('project', options.project);
  if (options.dataset) params.set('dataset', options.dataset);
  if (options.tableName) params.set('tableName', options.tableName);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));

  const res = await fetchAnalyticsJson<CloudSqlSyncedRecord[]>(
    `/api/analytics/cloudsql/synced-records?${params.toString()}`,
    signal
  );
  return {
    data: res.data || [],
    count: (res as any).count || (res.data ? res.data.length : 0),
  };
}
