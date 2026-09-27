import { fetchOffernetJson } from './offernetClient';
import type { WarehouseAnalyticsOverview } from '../../server/analytics/warehouse/warehouseAnalytics';
import type { DictionaryObject } from '../../contracts/warehouseDictionary';

export type { WarehouseAnalyticsOverview, DictionaryObject };

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
