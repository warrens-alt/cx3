import { getBigQueryClient } from '../../bigquery/client';
import { trackAnalyticalWork } from '../../analyticalWork';
import { RequestError } from '../../bigquery/filters';

export interface WarehouseProjectInfo {
  projectId: string;
  name: string;
  isCurrentProject: boolean;
  datasets: WarehouseDatasetInfo[];
}

export interface WarehouseDatasetInfo {
  datasetId: string;
  name: string;
  tables: WarehouseTableInfo[];
}

export interface WarehouseTableInfo {
  tableName: string;
  tableType: 'TABLE' | 'VIEW';
  description: string;
  recordCountEstimate?: number;
  isUserProjectTable?: boolean;
}

export const VERIFIED_PROJECTS_AND_TABLES: WarehouseProjectInfo[] = [
  {
    projectId: 'vibe-code-warren-stear',
    name: 'vibe-code-warren-stear (Your Active Cloud Project)',
    isCurrentProject: true,
    datasets: [
      {
        datasetId: 'analytics_warehouse',
        name: 'analytics_warehouse (Event & Telemetry Stream)',
        tables: [
          {
            tableName: 'ontact_raw_data',
            tableType: 'TABLE',
            description: 'Raw dialler event observations streaming VICIdial telephony logs in JSON format.',
            recordCountEstimate: 39000,
            isUserProjectTable: true,
          },
          {
            tableName: 'onvest_raw_data',
            tableType: 'TABLE',
            description: 'Raw marketing touchpoints, platform spend, impressions, clicks, and multi-vendor delivery logs.',
            recordCountEstimate: 1578,
            isUserProjectTable: true,
          },
        ],
      },
    ],
  },
  {
    projectId: 'dashboards-422710',
    name: 'dashboards-422710 (Enterprise Warehouse)',
    isCurrentProject: false,
    datasets: [
      {
        datasetId: 'vibe_coding_data',
        name: 'vibe_coding_data (Warren Stear Analytics & Integration)',
        tables: [
          {
            tableName: 'tbl_vibe_code_warren_stear_ontact_analytics_api',
            tableType: 'TABLE',
            description: 'Structured ONtact telephony call analytics table for Warren Stear integration.',
            recordCountEstimate: 71261,
            isUserProjectTable: true,
          },
          {
            tableName: 'tbl_offershop_lead_ledger',
            tableType: 'TABLE',
            description: 'Structured OfferShop lead transaction ledger with lifecycle statuses and conversion metrics.',
            recordCountEstimate: 62428,
            isUserProjectTable: true,
          },
          {
            tableName: 'tbl_vibe_code_warren_stear_ontact_ofline_data',
            tableType: 'TABLE',
            description: 'Offline marketing acquisition, lead validation, and multi-tenant performance aggregates.',
            recordCountEstimate: 3974,
            isUserProjectTable: true,
          },
          {
            tableName: 'view_vibe_code_warren_stear_ontact_analytics_api',
            tableType: 'VIEW',
            description: 'Consolidated analytical view of ONtact dialler interactions and disposition telemetry.',
            recordCountEstimate: 325417,
            isUserProjectTable: true,
          },
        ],
      },
      {
        datasetId: 'lead_ledger',
        name: 'lead_ledger (Primary Master Ledger & Telephony)',
        tables: [
          {
            tableName: 'clustered_lead_ledger',
            tableType: 'TABLE',
            description: 'Clustered master lead ledger tracking end-to-end lead lifecycle events and revenue.',
            recordCountEstimate: 350573,
          },
          {
            tableName: 'lead_ledger_all_vicidial_insights',
            tableType: 'TABLE',
            description: 'All VICIdial call attempts, contact dispositions, agent assignments, and talk durations.',
            recordCountEstimate: 1200000,
          },
          {
            tableName: 'lead_ledger_all_vicidial_insights_time_to_dial',
            tableType: 'TABLE',
            description: 'Dedicated first-dial speed and SLA timing measurements from dialler intake.',
            recordCountEstimate: 151995,
          },
          {
            tableName: 'lead_ledger_platform_insights',
            tableType: 'TABLE',
            description: 'Channel advertising insights, impression counts, clicks, and media campaign budgets.',
            recordCountEstimate: 45000,
          },
          {
            tableName: 'tbl_blc_activations',
            tableType: 'TABLE',
            description: 'Verified activations ledger for BLC policies and recurring debit mandates.',
            recordCountEstimate: 85,
          },
          {
            tableName: 'view_lead_ledger_mtn_lead_submit_open',
            tableType: 'VIEW',
            description: 'Open lead ledger view filtered for MTN South Africa cellular subscriber pipeline.',
            recordCountEstimate: 110000,
          },
          {
            tableName: 'view_lead_ledger_mondo_lead_submit_open',
            tableType: 'VIEW',
            description: 'Open lead ledger view filtered for Mondo Connect postpaid contracts.',
            recordCountEstimate: 95000,
          },
          {
            tableName: 'view_lead_ledger_blc_lead_submit_open',
            tableType: 'VIEW',
            description: 'Open lead ledger view filtered for Ontact BLC financial service submissions.',
            recordCountEstimate: 45000,
          },
          {
            tableName: 'view_lead_ledger_bizvoip_lead_submit_open',
            tableType: 'VIEW',
            description: 'Open lead ledger view filtered for Vodacom BizVoip connectivity orders.',
            recordCountEstimate: 28000,
          },
          {
            tableName: 'view_lead_ledger_rewardsco_lead_submit_open',
            tableType: 'VIEW',
            description: 'Open lead ledger view filtered for RewardsCo motor warranty programs.',
            recordCountEstimate: 35000,
          },
          {
            tableName: 'view_lead_ledger_real_promotions_lead_submit_open',
            tableType: 'VIEW',
            description: 'Open lead ledger view filtered for Real Promotions campaigns.',
            recordCountEstimate: 18000,
          },
        ],
      },
      {
        datasetId: 'watfall_report',
        name: 'watfall_report (Conversion Waterfall Timelines)',
        tables: [
          {
            tableName: 'view_mtn_waterfall_timeline',
            tableType: 'VIEW',
            description: 'Daily conversion milestone progression for MTN South Africa.',
            recordCountEstimate: 3200,
          },
          {
            tableName: 'view_mondo_waterfall_timeline',
            tableType: 'VIEW',
            description: 'Daily conversion milestone progression for Mondo Connect.',
            recordCountEstimate: 2900,
          },
          {
            tableName: 'view_blc_waterfall_timeline',
            tableType: 'VIEW',
            description: 'Daily conversion milestone progression for Ontact BLC.',
            recordCountEstimate: 2400,
          },
          {
            tableName: 'view_bizvoip_waterfall_timeline',
            tableType: 'VIEW',
            description: 'Daily conversion milestone progression for Vodacom BizVoip.',
            recordCountEstimate: 1800,
          },
          {
            tableName: 'view_offernet_full_lead_timeline',
            tableType: 'VIEW',
            description: 'Aggregated full funnel conversion timeline across all client operations.',
            recordCountEstimate: 8500,
          },
        ],
      },
    ],
  },
];

export interface PullTableDataOptions {
  project: string;
  dataset: string;
  table: string;
  limit?: number;
  offset?: number;
  search?: string;
  syncToCloudSql?: boolean;
  syncedBy?: string;
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
}

function sanitizeIdentifier(ident: string, label: string): string {
  const trimmed = String(ident || '').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new RequestError(`Invalid ${label} identifier: "${trimmed}"`, 400);
  }
  return trimmed;
}

export async function pullWarehouseTableData(
  options: PullTableDataOptions
): Promise<PulledTableDataResult> {
  const project = sanitizeIdentifier(options.project, 'project');
  const dataset = sanitizeIdentifier(options.dataset, 'dataset');
  const table = sanitizeIdentifier(options.table, 'table');
  const limit = Math.min(Math.max(1, Number(options.limit) || 50), 500);
  const offset = Math.max(0, Number(options.offset) || 0);

  // Allow only configured and approved projects
  const approvedProjects = ['dashboards-422710', 'vibe-code-warren-stear'];
  if (!approvedProjects.includes(project)) {
    throw new RequestError(
      `Project "${project}" is not an allowlisted Google Cloud project. Allowed: ${approvedProjects.join(', ')}`,
      400
    );
  }

  const client = getBigQueryClient(project);
  const start = Date.now();

  const fullTableRef = `\`${project}.${dataset}.${table}\``;

  return trackAnalyticalWork(async () => {
    // 1. Get total row count
    let totalRows = 0;
    try {
      const [countRows] = await client.query({
        query: `SELECT COUNT(*) AS total FROM ${fullTableRef}`,
      });
      totalRows = Number(countRows[0]?.total || 0);
    } catch {
      // For views where COUNT(*) might be slow or metadata unavailable
      totalRows = -1;
    }

    // 2. Fetch records via BigQuery API
    const dataQuery = `SELECT * FROM ${fullTableRef} LIMIT @limit OFFSET @offset`;
    const [job] = await client.createQueryJob({
      query: dataQuery,
      params: { limit, offset },
      useLegacySql: false,
    });

    const [rawRows] = await job.getQueryResults();
    const [jobMeta] = await job.getMetadata();
    const latencyMs = Date.now() - start;

    const queryJobId = job.id || 'job-completed';
    const bytesProcessed = jobMeta.statistics?.query?.totalBytesProcessed || '0';

    // 3. Extract columns from schema
    const schemaFields = jobMeta.statistics?.query?.schema?.fields || [];
    const columns: PulledTableColumn[] = schemaFields.map((f: any) => ({
      name: f.name,
      type: f.type || 'STRING',
    }));

    // If schema was empty from jobMeta, extract from row keys
    if (columns.length === 0 && rawRows.length > 0) {
      Object.keys(rawRows[0]).forEach(k => {
        columns.push({ name: k, type: 'UNKNOWN' });
      });
    }

    // 4. Normalize rows for clean JSON transport
    const rows = rawRows.map((row: any) => {
      const cleanRow: Record<string, any> = {};
      for (const [key, val] of Object.entries(row)) {
        if (val === null || val === undefined) {
          cleanRow[key] = null;
        } else if (typeof val === 'object' && 'value' in (val as any)) {
          // BigQuery Timestamp / Numeric object wrapper
          cleanRow[key] = (val as any).value;
        } else if (typeof val === 'bigint') {
          cleanRow[key] = Number(val);
        } else {
          cleanRow[key] = val;
        }
      }
      return cleanRow;
    });

    if (totalRows === -1) {
      totalRows = rows.length;
    }

    // 5. Optional Cloud SQL sync
    let syncedCount = 0;
    if (options.syncToCloudSql && rows.length > 0) {
      try {
        const { saveSyncedWarehouseRecords } = await import('../../../src/db/warehouseSync.ts');
        const syncBatch = rows.map((r, idx) => ({
          project,
          dataset,
          tableName: table,
          recordKey: String(r.id || r.unique_id || r.uniqueid || r.lead_id || `rec-${offset + idx}`),
          data: r,
          syncedBy: options.syncedBy || 'api-pull',
        }));
        syncedCount = await saveSyncedWarehouseRecords(syncBatch, options.syncedBy || 'api-pull');
      } catch (err) {
        console.error('Failed to sync pulled rows to Cloud SQL:', err);
      }
    }

    return {
      project,
      dataset,
      table,
      totalRows,
      columns,
      rows,
      limit,
      offset,
      latencyMs,
      bytesProcessed,
      queryJobId,
      pulledAt: new Date().toISOString(),
      syncedToCloudSql: Boolean(options.syncToCloudSql),
      syncedCount,
    };
  });
}
