import { fetchOffernetJson } from './offernetClient';
import type { WarehouseAnalyticsOverview } from '../../server/analytics/warehouse/warehouseAnalytics';
import type { DictionaryObject } from '../../contracts/warehouseDictionary';
import type { WarehouseExportBundle, EnrichedTableExport, EnrichedColumn } from '../../server/analytics/warehouse/warehouseExport';

export type {
  WarehouseAnalyticsOverview,
  DictionaryObject,
  WarehouseExportBundle,
  EnrichedTableExport,
  EnrichedColumn,
};

export async function fetchWarehouseOverview(
  clientId: string,
  forceRefresh = false,
  signal?: AbortSignal
): Promise<WarehouseAnalyticsOverview> {
  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
  const result = await fetchOffernetJson<{ success: boolean; data: WarehouseAnalyticsOverview }>(
    `/api/analytics/warehouse/overview${query}`,
    forceRefresh,
    signal
  );
  return (result as any).data || result;
}

export async function fetchWarehouseTables(
  params: { clientId?: string; search?: string; dataset?: string; family?: string } = {},
  forceRefresh = false,
  signal?: AbortSignal
): Promise<DictionaryObject[]> {
  const q = new URLSearchParams();
  if (params.clientId) q.set('clientId', params.clientId);
  if (params.search) q.set('search', params.search);
  if (params.dataset) q.set('dataset', params.dataset);
  if (params.family) q.set('family', params.family);
  const queryStr = q.toString() ? `?${q.toString()}` : '';
  const result = await fetchOffernetJson<{ success: boolean; data: DictionaryObject[]; count: number }>(
    `/api/analytics/warehouse/tables${queryStr}`,
    forceRefresh,
    signal
  );
  return (result as any).data || result;
}

export async function fetchWarehouseExportBundle(
  params: {
    clientId?: string;
    project?: string;
    dataset?: string;
    search?: string;
    includeSchemas?: boolean;
    includeData?: boolean;
  } = {},
  forceRefresh = false,
  signal?: AbortSignal
): Promise<WarehouseExportBundle> {
  const q = new URLSearchParams();
  if (params.clientId) q.set('clientId', params.clientId);
  if (params.project && params.project !== 'all') q.set('project', params.project);
  if (params.dataset && params.dataset !== 'all') q.set('dataset', params.dataset);
  if (params.search) q.set('search', params.search);
  if (params.includeSchemas === false) q.set('includeSchemas', 'false');
  if (params.includeData === false) q.set('includeData', 'false');
  const queryStr = q.toString() ? `?${q.toString()}` : '';
  const result = await fetchOffernetJson<{ success: boolean; data: WarehouseExportBundle }>(
    `/api/analytics/warehouse/export${queryStr}`,
    forceRefresh,
    signal
  );
  return (result as any).data || result;
}

export function downloadBrowserFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadWarehouseBundleJson(bundle: WarehouseExportBundle, customFilename?: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = customFilename || `google_warehouse_export_all_projects_datasets_tables_schemas_${timestamp}.json`;
  downloadBrowserFile(JSON.stringify(bundle, null, 2), filename, 'application/json');
}
