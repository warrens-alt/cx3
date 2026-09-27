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

export interface SourceReadinessItem {
  key: string;
  project: string;
  dataset: string;
  tableName: string;
  tableType: 'TABLE' | 'VIEW';
  family: string;
  disposition: string;
  analyticalGrain: string;
  columnsCount: number;
  historicalExport: {
    status: 'SUCCESS' | 'RESTRICTED';
    rowsExported: number;
    exportedAt: string;
    failingDependency: string | null;
    errorReason: string | null;
    ownerActionRequired: string;
  };
  currentApplicationProbe: {
    status: string;
    jobIdentity: string;
    accessible: boolean;
    checkedAt: string;
  };
}

export interface SourceReadinessData {
  manifest: {
    exportedAt: string;
    scope: string;
    totalProjects: number;
    totalDatasets: number;
    totalObjects: number;
    totalTables: number;
    totalViews: number;
    totalDeclaredColumns: number;
    totalRowsExported: number;
    rowLimitPerSource: number;
    successfulSourcesCount: number;
    restrictedSourcesCount: number;
    datasetCoverage: Record<string, { successful: number; total: number }>;
    note: string;
  };
  jobExecutionIdentity: string;
  totalSources: number;
  successfulSources: number;
  restrictedSources: number;
  sources: SourceReadinessItem[];
}

export interface SourceReadinessCheckResult {
  sourceKey: string;
  status: 'ACCESSIBLE' | 'ACCESS_DENIED' | 'RESOURCE_NOT_FOUND' | 'LOCATION_MISMATCH' | 'QUERY_ERROR';
  probeDurationMs: number;
  checkedAt: string;
  jobIdentity: string;
  message?: string;
  error?: string;
  historicalFailingDependency?: string | null;
  ownerActionRequired: string;
}

export interface OntactSummaryData {
  source: string;
  evidenceMode: 'LIVE_WAREHOUSE' | 'HANDOVER_SAMPLE';
  totalObservations: number;
  countingBasis: string;
  averageDurationSec: number;
  timingValidation: {
    durationVerifiedCount: number;
    durationMismatchCount: number;
    durationVerificationRatePct: number;
    statusDisagreementCount: number;
    statusDisagreementRatePct: number;
    observedWallClockUtcOffsetHours: number;
    note: string;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  callResultBreakdown: Array<{ result: string; count: number }>;
  listBreakdown: Array<{ listId: string; count: number }>;
  campaignBreakdown: Array<{ campaignId: string; count: number }>;
}

export interface OnvestTouchpointsData {
  source: string;
  evidenceMode: 'LIVE_WAREHOUSE' | 'HANDOVER_SAMPLE';
  clientScopedTenant: string;
  totalReportsCount: number;
  datesCoveredCount: number;
  stageComparison: {
    fetchedLeads: number;
    qualifiedLeads: number;
    acceptedLeads: number;
    validPhoneId: number;
    note: string;
  };
  spendDiagnostics: {
    rawAmountSpentSum: string;
    currencyStatus: string;
    spendPolicyNote: string;
  };
  reachPolicy: string;
  sourcesBreakdown: Array<{
    source: string;
    reportsCount: number;
    sampleReportDates: string[];
    totalFetched: number;
    totalAccepted: number;
    totalQualified: number;
  }>;
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

export async function fetchSourceReadiness(clientId: string): Promise<SourceReadinessData> {
  return requestJson<SourceReadinessData>(`/api/analytics/sources/readiness?clientId=${encodeURIComponent(clientId)}`);
}

export async function checkSourceReadiness(clientId: string, sourceKey: string): Promise<SourceReadinessCheckResult> {
  return requestJson<SourceReadinessCheckResult>(`/api/analytics/sources/check-readiness`, {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      sourceKey,
    }),
  });
}

export async function fetchOntactSummary(clientId: string, limit = 50): Promise<OntactSummaryData> {
  return requestJson<OntactSummaryData>(`/api/analytics/sources/ontact/summary?clientId=${encodeURIComponent(clientId)}&limit=${limit}`);
}

export async function fetchOnvestTouchpoints(clientId: string): Promise<OnvestTouchpointsData> {
  return requestJson<OnvestTouchpointsData>(`/api/analytics/sources/onvest/touchpoints?clientId=${encodeURIComponent(clientId)}`);
}

