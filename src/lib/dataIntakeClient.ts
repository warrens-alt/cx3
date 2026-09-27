import type { RawSourceProfileResult } from '../../server/bigquery/warehouseRegistry';
import type { DictionaryObject } from '../../contracts/warehouseDictionary';

export interface SourceInventoryData {
  totalObjects: number;
  datasetCounts: Record<string, number>;
  tableTypeCounts: Record<string, number>;
  rawJsonSources: string[];
  candidateSpendSources: string[];
  objects: DictionaryObject[];
}

export interface SourceMappingsData {
  activeMappings: any[];
  candidateSpendSources: string[];
  quarantinePolicy: {
    unresolvedTenantAction: string;
    sensitiveFieldPolicy: string;
    allowCrossTenantAggregation: boolean;
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let msg = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error) msg = parsed.error;
    } catch {}
    throw new Error(msg);
  }
  const body = await res.json();
  return body.data;
}

export async function fetchSourceInventory(clientId: string): Promise<SourceInventoryData> {
  return requestJson<SourceInventoryData>(`/api/analytics/sources/inventory?clientId=${encodeURIComponent(clientId)}`);
}

export async function fetchSourceMappings(clientId: string): Promise<SourceMappingsData> {
  return requestJson<SourceMappingsData>(`/api/analytics/sources/mappings?clientId=${encodeURIComponent(clientId)}`);
}

export async function profileRawSource(clientId: string, sourceId: string, limit = 20): Promise<RawSourceProfileResult> {
  return requestJson<RawSourceProfileResult>(`/api/analytics/sources/profile`, {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      sourceId,
      limit,
      redactDynamicKeys: true,
    }),
  });
}

