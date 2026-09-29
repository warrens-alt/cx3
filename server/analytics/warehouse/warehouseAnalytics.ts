import { ALL_WAREHOUSE_OBJECTS } from '../../bigquery/warehouseRegistry';
import {
  EXPORT_MANIFEST_EVIDENCE,
  OBSERVED_EXPORT_FAILURES,
  RAW_JSON_SOURCES,
  CANDIDATE_SPEND_SOURCES,
  WAREHOUSE_SNAPSHOT_DATE,
  type DictionaryObject,
} from '../../../contracts/warehouseDictionary';
import { getClientConfig } from '../../bigquery/config';

export interface DatasetSummary {
  project: string;
  dataset: string;
  totalObjects: number;
  tablesCount: number;
  viewsCount: number;
  totalColumns: number;
  families: string[];
  sampleObjects: string[];
  status: 'CATALOGUE_ONLY';
  description: string;
}

export interface ProjectSummary {
  projectId: string;
  role: 'primary_warehouse' | 'event_telemetry' | 'external_dependency';
  datasets: string[];
  totalObjects: number;
  status: 'NOT_CHECKED';
  location: string;
  description: string;
}

export interface CrossDatasetKpis {
  totalProjects: number;
  totalDatasets: number;
  totalWarehouseObjects: number;
  totalTables: number;
  totalViews: number;
  totalDeclaredColumns: number;
  totalObservedRecordsEstimate: number | null;
  datasetsTracked: string[];
  familiesCovered: string[];
}

export interface WaterfallTimelineMetric {
  tableName: string;
  title: string;
  client: string;
  disposition: string;
  family: string;
  columnsCount: number;
  estimatedVolume: number | null;
  conversionRateEstimatePct: number | null;
  keyStages: string[];
  dependencyStatus: 'NATIVE_TABLE' | 'DEPENDENCY_PROTECTED';
}

export interface TouchpointDatasetMetric {
  sourceKey: string;
  label: string;
  dataset: string;
  impressions: number | null;
  clicks: number | null;
  outboundClicks: number | null;
  amountSpentEstimate: string | null;
  leadsDelivered: number | null;
  channels: string[];
  grain: string;
}

export interface WarehouseAnalyticsOverview {
  generatedAt: string;
  evidence: { status: 'CATALOGUE_ONLY'; snapshotDate: string; liveDataQueried: false; reason: string };
  kpis: CrossDatasetKpis;
  projects: ProjectSummary[];
  datasets: DatasetSummary[];
  waterfallSummary: {
    totalWaterfallObjects: number;
    timelines: WaterfallTimelineMetric[];
    averageStageRetentionPct: number | null;
    highestVolumeTimeline: string | null;
  };
  touchpointsSummary: {
    totalTouchpointSources: number;
    sources: TouchpointDatasetMetric[];
    totalTrackedImpressions: number | null;
    totalTrackedClicks: number | null;
    combinedEstimatedSpend: string | null;
  };
  rawTelemetrySummary: {
    ontactDialler: {
      source: string;
      totalObservationsSampled: number | null;
      durationVerificationRatePct: number | null;
      averageCallDurationSec: number | null;
      topCallResults: Array<{ result: string; count: number }>;
    };
    onvestTouchpoints: {
      source: string;
      totalReportRows: number | null;
      fetchedLeadsTotal: number | null;
      acceptedLeadsTotal: number | null;
      qualifiedLeadsTotal: number | null;
      validPhoneIdTotal: number | null;
      amountSpentRawSum: string | null;
    };
  };
  tableInventoryPreview: Array<{
    project: string;
    dataset: string;
    tableName: string;
    tableType: 'TABLE' | 'VIEW';
    family: string;
    disposition: string;
    columnsCount: number;
    analyticalGrain: string;
    primaryKeyCandidate: string;
    isSpendCandidate: boolean;
    isRawJson: boolean;
  }>;
}

/** A catalogue describes the saved schema, never current business results or access. */
export async function getWarehouseCrossDatasetAnalytics(clientId: string): Promise<WarehouseAnalyticsOverview> {
  getClientConfig(clientId); // Validate the workspace; catalogue metadata is not a data-access grant.
  const objects = ALL_WAREHOUSE_OBJECTS;
  const projectIds = [...new Set(objects.map(o => o.project))];
  const datasets: DatasetSummary[] = [...new Set(objects.map(o => `${o.project}.${o.dataset}`))].map(id => {
    const group = objects.filter(o => `${o.project}.${o.dataset}` === id);
    return {
      project: group[0].project, dataset: group[0].dataset,
      totalObjects: group.length, tablesCount: group.filter(o => o.tableType === 'TABLE').length,
      viewsCount: group.filter(o => o.tableType === 'VIEW').length,
      totalColumns: group.reduce((n, o) => n + o.columns.length, 0),
      families: [...new Set(group.map(o => o.family))], sampleObjects: group.slice(0, 5).map(o => o.tableName),
      status: 'CATALOGUE_ONLY', description: 'Registered schema snapshot; current access, population and ingestion are not checked here.',
    };
  });
  const projects: ProjectSummary[] = projectIds.map(projectId => ({
    projectId, role: projectId === 'dashboards-422710' ? 'primary_warehouse' : 'event_telemetry',
    datasets: datasets.filter(d => d.project === projectId).map(d => d.dataset),
    totalObjects: objects.filter(o => o.project === projectId).length,
    status: 'NOT_CHECKED', location: 'Not verified', description: 'Registered project; use source diagnostics to check authorised access.',
  }));
  const timelines: WaterfallTimelineMetric[] = objects.filter(o => o.dataset === 'watfall_report').map(o => ({
    tableName: o.tableName, title: o.tableName.replace(/_/g, ' '), client: 'Source mapping required',
    disposition: o.disposition, family: o.family, columnsCount: o.columns.length,
    estimatedVolume: null, conversionRateEstimatePct: null, keyStages: [],
    dependencyStatus: o.tableType === 'TABLE' ? 'NATIVE_TABLE' : 'DEPENDENCY_PROTECTED',
  }));
  const sources: TouchpointDatasetMetric[] = objects.filter(o =>
    (CANDIDATE_SPEND_SOURCES as readonly string[]).includes(`${o.project}.${o.dataset}.${o.tableName}`)
  ).map(o => ({
    sourceKey: `${o.project}.${o.dataset}.${o.tableName}`, label: o.tableName, dataset: o.dataset,
    impressions: null, clicks: null, outboundClicks: null, amountSpentEstimate: null,
    leadsDelivered: null, channels: [], grain: o.analyticalGrain,
  }));
  return {
    generatedAt: new Date().toISOString(),
    evidence: { status: 'CATALOGUE_ONLY', snapshotDate: WAREHOUSE_SNAPSHOT_DATE, liveDataQueried: false,
      reason: 'This is a saved schema catalogue, not a live business report. No estimated volumes, spend, conversions or synthetic records are substituted for unavailable evidence.' },
    kpis: {
      totalProjects: projectIds.length, totalDatasets: datasets.length, totalWarehouseObjects: objects.length,
      totalTables: objects.filter(o => o.tableType === 'TABLE').length,
      totalViews: objects.filter(o => o.tableType === 'VIEW').length,
      totalDeclaredColumns: EXPORT_MANIFEST_EVIDENCE.totalDeclaredColumns,
      totalObservedRecordsEstimate: null, datasetsTracked: datasets.map(d => `${d.project}.${d.dataset}`),
      familiesCovered: [...new Set(objects.map(o => o.family))],
    }, projects, datasets,
    waterfallSummary: { totalWaterfallObjects: timelines.length, timelines, averageStageRetentionPct: null, highestVolumeTimeline: null },
    touchpointsSummary: { totalTouchpointSources: sources.length, sources, totalTrackedImpressions: null, totalTrackedClicks: null, combinedEstimatedSpend: null },
    rawTelemetrySummary: {
      ontactDialler: { source: 'vibe-code-warren-stear.analytics_warehouse.ontact_raw_data', totalObservationsSampled: null,
        durationVerificationRatePct: null, averageCallDurationSec: null, topCallResults: [] },
      onvestTouchpoints: { source: 'vibe-code-warren-stear.analytics_warehouse.onvest_raw_data', totalReportRows: null,
        fetchedLeadsTotal: null, acceptedLeadsTotal: null, qualifiedLeadsTotal: null, validPhoneIdTotal: null, amountSpentRawSum: null },
    },
    tableInventoryPreview: objects.map(o => ({
      project: o.project, dataset: o.dataset, tableName: o.tableName, tableType: o.tableType, family: o.family,
      disposition: o.disposition, columnsCount: o.columns.length, analyticalGrain: o.analyticalGrain,
      primaryKeyCandidate: o.candidateKeys.join(', ') || 'Not established',
      isSpendCandidate: (CANDIDATE_SPEND_SOURCES as readonly string[]).includes(`${o.project}.${o.dataset}.${o.tableName}`),
      isRawJson: (RAW_JSON_SOURCES as readonly string[]).includes(`${o.project}.${o.dataset}.${o.tableName}`),
    })),
  };
}

/**
 * Filtered search across all 65 warehouse tables.
 */
export function searchWarehouseTables(query?: string, datasetFilter?: string, familyFilter?: string): DictionaryObject[] {
  let objects = [...ALL_WAREHOUSE_OBJECTS];
  if (datasetFilter && datasetFilter !== 'all') {
    objects = objects.filter(o => o.dataset === datasetFilter || `${o.project}.${o.dataset}` === datasetFilter);
  }
  if (familyFilter && familyFilter !== 'all') {
    objects = objects.filter(o => o.family === familyFilter);
  }
  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    objects = objects.filter(o =>
      o.tableName.toLowerCase().includes(q) ||
      o.dataset.toLowerCase().includes(q) ||
      o.project.toLowerCase().includes(q) ||
      o.analyticalGrain.toLowerCase().includes(q) ||
      o.columns.some(c => c.name.toLowerCase().includes(q))
    );
  }
  return objects;
}

export {
  buildWarehouseExportBundle,
  generateWarehouseSchemaCsv,
  generateWarehouseInventoryCsv,
  generateWarehouseDataCsv,
  enrichTableObject,
  type WarehouseExportBundle,
  type EnrichedTableExport,
  type EnrichedColumn,
} from './warehouseExport';
