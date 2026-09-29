import { fetchAnalyticsJson, readAnalyticsResponse } from './analyticsRequest';
export type { WarehouseProjectInfo, WarehouseDatasetInfo, WarehouseTableInfo, PulledTableColumn, PulledTableDataResult } from '../../server/analytics/warehouse/warehousePull';
import type { WarehouseProjectInfo, PulledTableDataResult } from '../../server/analytics/warehouse/warehousePull';

export async function fetchWarehouseProjectsAndTables(clientId: string, signal?: AbortSignal): Promise<WarehouseProjectInfo[]> {
  const response = await fetchAnalyticsJson<WarehouseProjectInfo[]>(`/api/analytics/warehouse/projects-and-tables?${new URLSearchParams({ clientId })}`, signal);
  return response.data;
}
export async function pullWarehouseTableData(options: {
  clientId: string; project: string; dataset: string; table: string; limit?: number; offset?: number;
  startDate: string; endDate: string; dateField?: string;
}, signal?: AbortSignal): Promise<PulledTableDataResult> {
  const response = await fetch('/api/analytics/warehouse/pull-data', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(options),
  });
  const result = (await readAnalyticsResponse<PulledTableDataResult>(response)).data;
  if (result.provenance !== 'LIVE_BIGQUERY' || result.metadata?.clientId !== options.clientId) throw new Error('The source response does not establish a live query for this workspace. No rows were displayed.');
  return result;
}
