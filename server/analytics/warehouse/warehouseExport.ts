import { ALL_WAREHOUSE_OBJECTS } from '../../bigquery/warehouseRegistry';
import {
  EXPORT_MANIFEST_EVIDENCE,
  OBSERVED_EXPORT_FAILURES,
  RAW_JSON_SOURCES,
  CANDIDATE_SPEND_SOURCES,
  WAREHOUSE_SNAPSHOT_DATE,
  type DictionaryObject,
  type DictionaryColumn,
} from '../../../contracts/warehouseDictionary';
import { getWarehouseCrossDatasetAnalytics } from './warehouseAnalytics';

export interface EnrichedColumn extends DictionaryColumn {
  isCandidateKey: boolean;
  isDateField: boolean;
  isSensitive: boolean;
}

export interface EnrichedTableExport {
  project: string;
  dataset: string;
  tableName: string;
  fullTableId: string;
  tableType: 'TABLE' | 'VIEW';
  family: string;
  disposition: string;
  analyticalGrain: string;
  columnsCount: number;
  dateFields: string[];
  candidateKeys: string[];
  sensitiveFields: string[];
  ownershipField?: string;
  schema: EnrichedColumn[];
  dataEvidence: {
    status: 'EXPORTED' | 'RESTRICTED' | 'AWAITING_INTERPRETATION' | 'ONLINE';
    historicalExportRows: number | null;
    failingDependency?: string | null;
    errorReason?: string | null;
    ownerActionRequired?: string | null;
  };
}

export interface WarehouseExportBundle {
  exportMetadata: {
    generatedAt: string;
    environment: string;
    scope: 'all_google_projects_datasets_and_tables';
    warehouseSnapshotDate: string;
    totalProjects: number;
    totalDatasets: number;
    totalObjects: number;
    totalTables: number;
    totalViews: number;
    totalDeclaredColumns: number;
    registeredSchemaColumns: number;
    totalExportEvidenceRows: number;
  };
  projects: Array<{
    projectId: string;
    role: 'primary_warehouse' | 'event_telemetry' | 'external_dependency';
    status: string;
    location: string;
    datasets: string[];
    totalObjects: number;
    description: string;
  }>;
  datasets: Array<{
    project: string;
    dataset: string;
    fullDatasetId: string;
    status: string;
    totalObjects: number;
    tablesCount: number;
    viewsCount: number;
    totalColumns: number;
    families: string[];
    sampleObjects: string[];
    description: string;
  }>;
  tables: EnrichedTableExport[];
  schemas: Record<string, EnrichedColumn[]>;
  tableDataAndTelemetry: {
    ontactDiallerTelemetry: {
      source: string;
      totalObservationsSampled: number;
      durationVerificationRatePct: number;
      averageCallDurationSec: number;
      topCallResults: Array<{ result: string; count: number }>;
    };
    onvestTouchpointTelemetry: {
      source: string;
      totalReportRows: number;
      fetchedLeadsTotal: number;
      acceptedLeadsTotal: number;
      qualifiedLeadsTotal: number;
      validPhoneIdTotal: number;
      amountSpentRawSum: string;
    };
    waterfallTimelines: Array<{
      tableName: string;
      title: string;
      client: string;
      disposition: string;
      family: string;
      columnsCount: number;
      estimatedVolume: number;
      conversionRateEstimatePct: number;
      keyStages: string[];
      dependencyStatus: 'NATIVE_TABLE' | 'DEPENDENCY_PROTECTED';
    }>;
    touchpointCampaigns: Array<{
      sourceKey: string;
      label: string;
      dataset: string;
      impressions: number;
      clicks: number;
      outboundClicks: number;
      amountSpentEstimate: string;
      leadsDelivered: number;
      channels: string[];
      grain: string;
    }>;
    exportManifestEvidence: typeof EXPORT_MANIFEST_EVIDENCE;
    observedViewFailures: typeof OBSERVED_EXPORT_FAILURES;
  };
}

/**
 * Escapes values for standard RFC 4180 CSV representation.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Enriches a DictionaryObject into an EnrichedTableExport with schema flags and data evidence.
 */
export function enrichTableObject(obj: DictionaryObject): EnrichedTableExport {
  const fullTableId = `${obj.project}.${obj.dataset}.${obj.tableName}`;
  const failure = OBSERVED_EXPORT_FAILURES[fullTableId];

  let status: 'EXPORTED' | 'RESTRICTED' | 'AWAITING_INTERPRETATION' | 'ONLINE' = 'ONLINE';
  let historicalExportRows: number | null = 50;

  if (failure) {
    status = 'RESTRICTED';
    historicalExportRows = null;
  } else if (obj.disposition === 'raw_awaiting_interpretation') {
    status = 'AWAITING_INTERPRETATION';
  } else if (obj.tableType === 'TABLE') {
    status = 'EXPORTED';
  }

  const schema: EnrichedColumn[] = obj.columns.map(col => ({
    ...col,
    isCandidateKey: obj.candidateKeys.includes(col.name),
    isDateField: obj.dateFields.includes(col.name),
    isSensitive: obj.sensitiveFields.includes(col.name),
  }));

  return {
    project: obj.project,
    dataset: obj.dataset,
    tableName: obj.tableName,
    fullTableId,
    tableType: obj.tableType,
    family: obj.family,
    disposition: obj.disposition,
    analyticalGrain: obj.analyticalGrain,
    columnsCount: obj.columns.length,
    dateFields: obj.dateFields,
    candidateKeys: obj.candidateKeys,
    sensitiveFields: obj.sensitiveFields,
    ownershipField: obj.ownershipField,
    schema,
    dataEvidence: {
      status,
      historicalExportRows,
      failingDependency: failure?.failingDependency || null,
      errorReason: failure?.errorReason || null,
      ownerActionRequired: failure?.ownerActionRequired || null,
    },
  };
}

/**
 * Builds the comprehensive export bundle for all Google Cloud BigQuery projects, datasets, tables, and schemes.
 */
export async function buildWarehouseExportBundle(options: {
  clientId?: string;
  projectFilter?: string;
  datasetFilter?: string;
  tableFilter?: string;
  includeSchemas?: boolean;
  includeData?: boolean;
} = {}): Promise<WarehouseExportBundle> {
  const analytics = await getWarehouseCrossDatasetAnalytics(options.clientId || 'default_tenant');

  let rawObjects = [...ALL_WAREHOUSE_OBJECTS];
  if (options.projectFilter && options.projectFilter !== 'all') {
    rawObjects = rawObjects.filter(o => o.project === options.projectFilter);
  }
  if (options.datasetFilter && options.datasetFilter !== 'all') {
    rawObjects = rawObjects.filter(o => o.dataset === options.datasetFilter || `${o.project}.${o.dataset}` === options.datasetFilter);
  }
  if (options.tableFilter && options.tableFilter.trim()) {
    const q = options.tableFilter.toLowerCase().trim();
    rawObjects = rawObjects.filter(o => o.tableName.toLowerCase().includes(q));
  }

  const tables = rawObjects.map(enrichTableObject);

  const schemas: Record<string, EnrichedColumn[]> = {};
  for (const t of tables) {
    schemas[t.fullTableId] = t.schema;
  }

  const totalDeclaredColumns = EXPORT_MANIFEST_EVIDENCE.totalDeclaredColumns;
  const registeredSchemaColumns = tables.reduce((acc, t) => acc + t.columnsCount, 0);

  return {
    exportMetadata: {
      generatedAt: new Date().toISOString(),
      environment: 'production_federation',
      scope: 'all_google_projects_datasets_and_tables',
      warehouseSnapshotDate: WAREHOUSE_SNAPSHOT_DATE,
      totalProjects: analytics.kpis.totalProjects,
      totalDatasets: analytics.kpis.totalDatasets,
      totalObjects: tables.length,
      totalTables: tables.filter(t => t.tableType === 'TABLE').length,
      totalViews: tables.filter(t => t.tableType === 'VIEW').length,
      totalDeclaredColumns,
      registeredSchemaColumns,
      totalExportEvidenceRows: EXPORT_MANIFEST_EVIDENCE.totalRowsExported,
    },
    projects: analytics.projects,
    datasets: analytics.datasets.map(d => ({
      ...d,
      fullDatasetId: `${d.project}.${d.dataset}`,
    })),
    tables,
    schemas,
    tableDataAndTelemetry: {
      ontactDiallerTelemetry: analytics.rawTelemetrySummary.ontactDialler,
      onvestTouchpointTelemetry: analytics.rawTelemetrySummary.onvestTouchpoints,
      waterfallTimelines: analytics.waterfallSummary.timelines,
      touchpointCampaigns: analytics.touchpointsSummary.sources,
      exportManifestEvidence: EXPORT_MANIFEST_EVIDENCE,
      observedViewFailures: OBSERVED_EXPORT_FAILURES,
    },
  };
}

/**
 * Generates the complete, uncorrupted Schema Catalog CSV containing all declared columns
 * across all Google Cloud tables and views (all 1,848 declared columns).
 */
export function generateWarehouseSchemaCsv(tables: DictionaryObject[] = ALL_WAREHOUSE_OBJECTS): string {
  const headers = [
    'Project',
    'Dataset',
    'Table Name',
    'Table Type',
    'Column Name',
    'Data Type',
    'Ordinal Position',
    'Nullable',
    'Candidate Key',
    'Date Field',
    'Sensitive Field',
    'Analytical Grain',
    'Family',
    'Disposition',
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const table of tables) {
    for (const col of table.columns) {
      const isCandidateKey = table.candidateKeys.includes(col.name);
      const isDateField = table.dateFields.includes(col.name);
      const isSensitive = table.sensitiveFields.includes(col.name);

      rows.push([
        escapeCsvCell(table.project),
        escapeCsvCell(table.dataset),
        escapeCsvCell(table.tableName),
        escapeCsvCell(table.tableType),
        escapeCsvCell(col.name),
        escapeCsvCell(col.type),
        escapeCsvCell(col.ordinalPosition),
        escapeCsvCell(col.nullable ? 'YES' : 'NO'),
        escapeCsvCell(isCandidateKey ? 'YES' : 'NO'),
        escapeCsvCell(isDateField ? 'YES' : 'NO'),
        escapeCsvCell(isSensitive ? 'YES' : 'NO'),
        escapeCsvCell(table.analyticalGrain),
        escapeCsvCell(table.family),
        escapeCsvCell(table.disposition),
      ].join(','));
    }
  }

  return rows.join('\r\n');
}

/**
 * Generates the Table & Dataset Inventory CSV (all 65 tables/views).
 */
export function generateWarehouseInventoryCsv(tables: DictionaryObject[] = ALL_WAREHOUSE_OBJECTS): string {
  const headers = [
    'Project',
    'Dataset',
    'Table Name',
    'Table Type',
    'Family',
    'Disposition',
    'Total Columns',
    'Analytical Grain',
    'Candidate Keys',
    'Date Fields',
    'Sensitive Fields',
    'Ownership Field',
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const table of tables) {
    rows.push([
      escapeCsvCell(table.project),
      escapeCsvCell(table.dataset),
      escapeCsvCell(table.tableName),
      escapeCsvCell(table.tableType),
      escapeCsvCell(table.family),
      escapeCsvCell(table.disposition),
      escapeCsvCell(table.columns.length),
      escapeCsvCell(table.analyticalGrain),
      escapeCsvCell(table.candidateKeys.join('; ')),
      escapeCsvCell(table.dateFields.join('; ')),
      escapeCsvCell(table.sensitiveFields.join('; ')),
      escapeCsvCell(table.ownershipField || 'N/A'),
    ].join(','));
  }

  return rows.join('\r\n');
}

/**
 * Generates an operational data and telemetry summary CSV.
 */
export function generateWarehouseDataCsv(bundle: WarehouseExportBundle): string {
  const rows: string[] = [];

  // Section 1: Waterfall Timelines
  rows.push('--- WATERFALL CONVERSION TIMELINES ---');
  rows.push(['Table Name', 'Client', 'Estimated Volume', 'Conversion Rate %', 'Stages', 'Dependency Status'].map(escapeCsvCell).join(','));
  for (const wt of bundle.tableDataAndTelemetry.waterfallTimelines) {
    rows.push([
      escapeCsvCell(wt.tableName),
      escapeCsvCell(wt.client),
      escapeCsvCell(wt.estimatedVolume),
      escapeCsvCell(wt.conversionRateEstimatePct),
      escapeCsvCell(wt.keyStages.join(' -> ')),
      escapeCsvCell(wt.dependencyStatus),
    ].join(','));
  }
  rows.push('');

  // Section 2: Touchpoint Campaign Performance
  rows.push('--- TOUCHPOINT MARKETING CAMPAIGNS ---');
  rows.push(['Source Key', 'Label', 'Dataset', 'Impressions', 'Clicks', 'Outbound Clicks', 'Spend Estimate (ZAR)', 'Leads Delivered'].map(escapeCsvCell).join(','));
  for (const tc of bundle.tableDataAndTelemetry.touchpointCampaigns) {
    rows.push([
      escapeCsvCell(tc.sourceKey),
      escapeCsvCell(tc.label),
      escapeCsvCell(tc.dataset),
      escapeCsvCell(tc.impressions),
      escapeCsvCell(tc.clicks),
      escapeCsvCell(tc.outboundClicks),
      escapeCsvCell(tc.amountSpentEstimate),
      escapeCsvCell(tc.leadsDelivered),
    ].join(','));
  }
  rows.push('');

  // Section 3: Telemetry Streams
  rows.push('--- RAW EVENT TELEMETRY STREAMS ---');
  rows.push(['Stream Source', 'Metric', 'Observed Value'].map(escapeCsvCell).join(','));
  const od = bundle.tableDataAndTelemetry.ontactDiallerTelemetry;
  rows.push([escapeCsvCell(od.source), 'Observations Sampled', escapeCsvCell(od.totalObservationsSampled)].join(','));
  rows.push([escapeCsvCell(od.source), 'Duration Verification Rate %', escapeCsvCell(od.durationVerificationRatePct)].join(','));
  rows.push([escapeCsvCell(od.source), 'Average Call Duration (Sec)', escapeCsvCell(od.averageCallDurationSec)].join(','));

  const ot = bundle.tableDataAndTelemetry.onvestTouchpointTelemetry;
  rows.push([escapeCsvCell(ot.source), 'Sample Report Rows', escapeCsvCell(ot.totalReportRows)].join(','));
  rows.push([escapeCsvCell(ot.source), 'Fetched Leads Total', escapeCsvCell(ot.fetchedLeadsTotal)].join(','));
  rows.push([escapeCsvCell(ot.source), 'Accepted Leads Total', escapeCsvCell(ot.acceptedLeadsTotal)].join(','));
  rows.push([escapeCsvCell(ot.source), 'Qualified Leads Total', escapeCsvCell(ot.qualifiedLeadsTotal)].join(','));
  rows.push([escapeCsvCell(ot.source), 'Amount Spent Raw Sum (ZAR)', escapeCsvCell(ot.amountSpentRawSum)].join(','));

  return rows.join('\r\n');
}
