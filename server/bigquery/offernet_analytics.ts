import { getBigQueryClient } from './client';
import { getClientConfig, tableIdentifier, type MarketingSourceContract } from './config';
import { RequestError } from './filters';

function configuredSourceTable(clientId: string, role: 'leads' | 'calls' | 'timeToDial' | 'activations' | 'marketing') {
  const config = getClientConfig(clientId);
  const table = config.semanticMappings.tables[role];
  if (!table) throw new RequestError(`No configured ${role} source table exists for tenant ${config.id}`, 422);
  return tableIdentifier(table);
}

export interface OffernetQueryParams {
  clientId: string;
  startDate?: string;
  endDate?: string;
  period?: 'today' | 'wtd' | 'mtd' | 'wow' | 'mom' | 'matched_mom' | 'custom';
  vendor?: string;
  source?: string;
  medium?: string;
  grade?: string;
  agent?: string;
  campaign?: string;
  search?: string;
  drill?: string;
  drillValue?: string;
  metric?: string;
  limit?: number;
  offset?: number;
}

// Format seconds into human readable duration
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

// Build standard WHERE filter clause for clustered_lead_ledger queries
function buildFilterClause(params: OffernetQueryParams, alias = 'l', hlcAlias = 'hlc') {
  const conditions: string[] = [
    `${alias}.fetched NOT LIKE '1900%'`,
    `${alias}.fetched NOT LIKE '1970%'`,
    `${alias}.fetched IS NOT NULL`
  ];
  const queryParams: Record<string, any> = {};

  if (params.startDate) {
    conditions.push(`DATE(SAFE_CAST(${alias}.fetched AS TIMESTAMP)) >= @startDate`);
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push(`DATE(SAFE_CAST(${alias}.fetched AS TIMESTAMP)) <= @endDate`);
    queryParams.endDate = params.endDate;
  }

  // Tenant / Client mapping filter if tenant targets specific vendors
  const clientConfig = getClientConfig(params.clientId);
  if (clientConfig.id !== 'default_tenant' && clientConfig.id !== 'offernet_master') {
    const tenantVendors = clientConfig.semanticMappings.partners || [];
    if (tenantVendors.length > 0) {
      conditions.push(`EXISTS (SELECT 1 FROM UNNEST(${alias}.hlc_details) h WHERE LOWER(h.vendor) IN UNNEST(@tenantVendors))`);
      if (hlcAlias) {
        conditions.push(`LOWER(${hlcAlias}.vendor) IN UNNEST(@tenantVendors)`);
      }
      queryParams.tenantVendors = tenantVendors.map(v => v.toLowerCase());
    }
  }

  const cleanVendor = params.vendor && !['all', 'all vendors', 'undefined', 'null'].includes(params.vendor.trim().toLowerCase()) 
    ? params.vendor.trim() 
    : undefined;

  if (cleanVendor) {
    conditions.push(`EXISTS (SELECT 1 FROM UNNEST(${alias}.hlc_details) h WHERE LOWER(h.vendor) = LOWER(@vendor))`);
    if (hlcAlias) {
      conditions.push(`LOWER(${hlcAlias}.vendor) = LOWER(@vendor)`);
    }
    queryParams.vendor = cleanVendor;
  }

  const cleanSource = params.source && !['all', 'all sources', 'undefined', 'null'].includes(params.source.trim().toLowerCase()) 
    ? params.source.trim() 
    : undefined;
  if (cleanSource) {
    conditions.push(`LOWER(${alias}.offershop_source) = LOWER(@source)`);
    queryParams.source = cleanSource;
  }

  const cleanMedium = params.medium && !['all', 'undefined', 'null'].includes(params.medium.trim().toLowerCase()) 
    ? params.medium.trim() 
    : undefined;
  if (cleanMedium) {
    conditions.push(`LOWER(${alias}.offernet_medium) = LOWER(@medium)`);
    queryParams.medium = cleanMedium;
  }

  const cleanGrade = params.grade && !['all', 'all grades', 'undefined', 'null'].includes(params.grade.trim().toLowerCase()) 
    ? params.grade.trim() 
    : undefined;
  if (cleanGrade) {
    conditions.push(`LOWER(${alias}.offershop_grade) = LOWER(@grade)`);
    queryParams.grade = cleanGrade;
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    queryParams
  };
}

function parseConfiguredTable(table: string) {
  const match = /^([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/.exec(table);
  if (!match) throw new RequestError('Configured marketing table identifier is invalid', 500);
  return { project: match[1], dataset: match[2], table: match[3] };
}

function safeWarehouseColumn(column: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
    throw new RequestError('Unsafe warehouse column identifier', 500);
  }
  return `\`${column}\``;
}

function safeAliasedColumn(alias: string, column: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias)) throw new RequestError('Unsafe warehouse alias', 500);
  return `${alias}.${safeWarehouseColumn(column)}`;
}

const marketingContractCache = new Map<string, { expiresAt: number; value: any }>();
const MARKETING_CONTRACT_CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveMarketingContract(
  client: ReturnType<typeof getBigQueryClient>,
  contract: MarketingSourceContract,
) {
  const cached = marketingContractCache.get(contract.table);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const parsed = parseConfiguredTable(contract.table);
  const [rows] = await client.query({
    query: `
      SELECT column_name
      FROM \`${parsed.project}.${parsed.dataset}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = @tableName
    `,
    params: { tableName: parsed.table },
  });

  const byLower = new Map<string, string>(
    rows.map((row: any) => [String(row.column_name || '').toLowerCase(), String(row.column_name || '')]),
  );

  const requiredFields = [
    contract.clientNameField,
    contract.dateField,
    contract.channelField,
    contract.campaignField,
    contract.adsetField,
    contract.impressionsField,
    contract.clicksField,
    contract.leadsField,
  ];
  const missingRequired = requiredFields.filter(field => !byLower.has(field.toLowerCase()));
  const spendColumn = contract.approvedSpendFields.map(name => byLower.get(name.toLowerCase())).find(Boolean) || null;
  const budgetColumn = contract.approvedBudgetFields.map(name => byLower.get(name.toLowerCase())).find(Boolean) || null;
  const reachColumn = contract.reachField ? byLower.get(contract.reachField.toLowerCase()) || null : null;
  const outboundClicksColumn = contract.outboundClicksField ? byLower.get(contract.outboundClicksField.toLowerCase()) || null : null;

  const value = {
    table: contract.table,
    columns: Array.from(byLower.values()).sort(),
    missingRequired,
    spendColumn,
    budgetColumn,
    reachColumn,
    outboundClicksColumn,
  };
  marketingContractCache.set(contract.table, { expiresAt: Date.now() + MARKETING_CONTRACT_CACHE_TTL_MS, value });
  return value;
}

function marketingSpendExpression(contract: MarketingSourceContract, spendColumn: string | null) {
  if (!spendColumn) return null;
  const identifier = safeWarehouseColumn(spendColumn);
  const unit = contract.spendUnitByField[spendColumn.toLowerCase()] || contract.spendUnitByField[spendColumn] || 'currency';
  const numeric = `SAFE_CAST(REGEXP_REPLACE(CAST(${identifier} AS STRING), r'[^0-9.-]', '') AS FLOAT64)`;
  return unit === 'micros' ? `(${numeric} / 1000000)` : numeric;
}

function marketingTenantFilter(contract: MarketingSourceContract) {
  if (contract.mappingStatus === 'MASTER') return { sql: '', params: {} as Record<string, any> };
  if (contract.mappingStatus !== 'MAPPED' || !contract.clientNames.length) {
    throw new RequestError('Marketing client mapping is unresolved for this tenant', 422);
  }
  return {
    sql: `LOWER(${safeWarehouseColumn(contract.clientNameField)}) IN UNNEST(@marketingClientNames)`,
    params: { marketingClientNames: contract.clientNames.map(value => value.toLowerCase()) },
  };
}

async function validateMarketingSpendGrain(
  client: ReturnType<typeof getBigQueryClient>,
  contract: MarketingSourceContract,
  conditions: string[],
  params: Record<string, any>,
) {
  const grainFields = contract.spendGrainFields.map(safeWarehouseColumn);
  const grainExpression = `TO_JSON_STRING(STRUCT(${grainFields.join(', ')}))`;
  const [rows] = await client.query({
    query: `
      SELECT
        COUNT(*) AS row_count,
        COUNT(DISTINCT ${grainExpression}) AS distinct_grain_count,
        COUNT(*) - COUNT(DISTINCT ${grainExpression}) AS duplicate_grain_rows
      FROM \`${contract.table}\`
      WHERE ${conditions.join(' AND ')}
    `,
    params,
  });
  const row = rows[0] || {};
  const duplicateGrainRows = Number(row.duplicate_grain_rows || 0);
  return {
    status: duplicateGrainRows > 0 ? 'DUPLICATE_GRAIN' as const : 'VALID' as const,
    rowCount: Number(row.row_count || 0),
    distinctGrainCount: Number(row.distinct_grain_count || 0),
    duplicateGrainRows,
  };
}

export async function getMarketingSourceDiscovery(params: Pick<OffernetQueryParams, 'clientId'>) {
  const clientConfig = getClientConfig(params.clientId);
  const contract = clientConfig.marketing;
  if (!contract || !clientConfig.capabilities.marketing) {
    return {
      status: 'UNAVAILABLE',
      reason: 'No marketing contract is configured for this tenant.',
      contract: null,
      schema: null,
      availableClientNames: [],
    };
  }

  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const resolved = await resolveMarketingContract(client, contract);
  const clientNameField = safeWarehouseColumn(contract.clientNameField);
  const dateField = safeWarehouseColumn(contract.dateField);
  const [nameRows] = resolved.missingRequired.includes(contract.clientNameField)
    ? [[]]
    : await client.query({
        query: `
          SELECT
            CAST(${clientNameField} AS STRING) AS client_name,
            COUNT(*) AS rows,
            MIN(DATE(${dateField})) AS earliest_date,
            MAX(DATE(${dateField})) AS latest_date
          FROM \`${contract.table}\`
          WHERE ${clientNameField} IS NOT NULL
          GROUP BY 1
          ORDER BY rows DESC
          LIMIT 200
        `,
      });

  return {
    status: resolved.missingRequired.length ? 'INVALID_CONTRACT' : contract.mappingStatus,
    reason: resolved.missingRequired.length
      ? `Configured marketing fields are missing from the API table: ${resolved.missingRequired.join(', ')}`
      : contract.mappingStatus === 'UNRESOLVED'
        ? 'Choose and configure the approved client_name values for this tenant before tenant-level campaign reporting is enabled.'
        : 'Marketing API-table contract is structurally valid.',
    contract: {
      table: contract.table,
      mappingStatus: contract.mappingStatus,
      configuredClientNames: contract.clientNames,
      fields: {
        clientName: contract.clientNameField,
        date: contract.dateField,
        channel: contract.channelField,
        campaign: contract.campaignField,
        adset: contract.adsetField,
        impressions: contract.impressionsField,
        reach: contract.reachField || null,
        clicks: contract.clicksField,
        outboundClicks: contract.outboundClicksField || null,
        leads: contract.leadsField,
      },
      approvedSpendFields: contract.approvedSpendFields,
      resolvedSpendField: resolved.spendColumn,
      resolvedBudgetField: resolved.budgetColumn,
      attribution: contract.attribution,
    },
    schema: {
      columns: resolved.columns,
      missingRequired: resolved.missingRequired,
    },
    availableClientNames: nameRows.map((row: any) => ({
      value: row.client_name,
      rows: Number(row.rows || 0),
      earliestDate: row.earliest_date?.value || row.earliest_date || null,
      latestDate: row.latest_date?.value || row.latest_date || null,
    })),
  };
}


export async function getOperatingControlsAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);
  const operating = clientConfig.operationalConfig?.operatingHours || { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };
  const timezone = clientConfig.timezone || 'Africa/Johannesburg';
  const paramsWithOperating = {
    ...queryParams,
    tenantTimezone: timezone,
    operatingStart: operating.start.length === 5 ? operating.start + ':00' : operating.start,
    operatingEnd: operating.end.length === 5 ? operating.end + ':00' : operating.end,
    operatingWorkdays: operating.workdays,
  };

  const query = `
    WITH raw AS (
      SELECT
        l.lead_id,
        SAFE_CAST(l.fetched AS TIMESTAMP) AS fetched_ts,
        COALESCE(l.offershop_source, '') AS source,
        COALESCE(l.offershop_grade, '') AS grade,
        hlc.vendor,
        SAFE_CAST(hlc.delivered AS TIMESTAMP) AS delivered_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) AS first_call_ts,
        COALESCE(SAFE_CAST(hlc.total_calls AS INT64), 0) AS total_calls,
        COALESCE(hlc.last_dialer_status, '') AS last_dialer_status,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
        SAFE_CAST(hlc.sale AS TIMESTAMP) AS sale_ts,
        SAFE_CAST(hlc.activated AS TIMESTAMP) AS activation_ts
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    lead_level AS (
      SELECT
        lead_id,
        ANY_VALUE(fetched_ts) AS fetched_ts,
        ANY_VALUE(source) AS source,
        ANY_VALUE(grade) AS grade,
        COALESCE(
          ARRAY_AGG(vendor IGNORE NULLS ORDER BY IF(delivered_ts IS NULL, 1, 0), delivered_ts ASC LIMIT 1)[SAFE_OFFSET(0)],
          'Unknown'
        ) AS vendor,
        COUNTIF(delivered_ts IS NOT NULL) > 0 AS is_delivered,
        COUNTIF(first_call_ts IS NOT NULL) > 0 AS is_dialled,
        COUNTIF(is_rpc) > 0 AS is_rpc,
        COUNTIF(is_sale) > 0 AS is_sale,
        COUNTIF(is_activated) > 0 AS is_activated,
        MAX(GREATEST(total_calls, 0)) AS recorded_call_count,
        COUNTIF(first_call_ts IS NOT NULL AND TRIM(last_dialer_status) != '') > 0 AS has_disposition,
        MIN(delivered_ts) AS first_delivery_ts,
        MIN(first_call_ts) AS first_call_ts,
        MIN(CASE WHEN is_sale THEN sale_ts END) AS sale_ts,
        MIN(CASE WHEN is_activated THEN activation_ts END) AS activation_ts
      FROM raw
      GROUP BY lead_id
    ),
    classified AS (
      SELECT
        *,
        TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) AS delivery_to_dial_sec,
        TIMESTAMP_DIFF(first_call_ts, fetched_ts, SECOND) AS capture_to_dial_sec,
        CASE
          WHEN fetched_ts IS NULL THEN NULL
          WHEN CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) NOT IN UNNEST(@operatingWorkdays) THEN TRUE
          WHEN FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) < @operatingStart THEN TRUE
          WHEN FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) >= @operatingEnd THEN TRUE
          ELSE FALSE
        END AS is_after_hours,
        CASE
          WHEN fetched_ts IS NULL THEN FALSE
          WHEN CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) IN (6, 7) THEN TRUE
          ELSE FALSE
        END AS is_weekend,
        CASE
          WHEN recorded_call_count <= 0 THEN '0 calls'
          WHEN recorded_call_count = 1 THEN '1 call'
          WHEN recorded_call_count = 2 THEN '2 calls'
          WHEN recorded_call_count = 3 THEN '3 calls'
          WHEN recorded_call_count = 4 THEN '4 calls'
          ELSE '5+ calls'
        END AS attempt_bucket,
        CASE
          WHEN NOT is_delivered THEN 'Not delivered'
          WHEN NOT is_dialled THEN 'Undialled'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) < 0 THEN 'Invalid timing'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 900 THEN '0–15m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 1800 THEN '15–30m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 3600 THEN '30–60m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 21600 THEN '1–6h'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 86400 THEN '6–24h'
          ELSE '24h+'
        END AS sla_band,
        CASE
          WHEN NOT is_sale OR is_activated OR sale_ts IS NULL THEN NULL
          WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 3 THEN '0–3d'
          WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 7 THEN '4–7d'
          WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 14 THEN '8–14d'
          WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) <= 30 THEN '15–30d'
          ELSE '30d+'
        END AS activation_age_bucket
      FROM lead_level
    ),
    summary AS (
      SELECT
        COUNT(*) AS total_leads,
        COUNTIF(is_delivered) AS delivered_leads,
        COUNTIF(is_dialled) AS dialled_leads,
        COUNTIF(recorded_call_count = 0) AS zero_call_leads,
        COUNTIF(recorded_call_count = 1) AS one_call_leads,
        COUNTIF(recorded_call_count >= 2) AS multi_call_leads,
        COUNTIF(recorded_call_count >= 5 AND NOT is_rpc) AS high_attempt_no_rpc_leads,
        COUNTIF(is_dialled AND has_disposition) AS disposition_complete_leads,
        COUNTIF(is_after_hours) AS after_hours_leads,
        COUNTIF(is_weekend) AS weekend_leads,
        COUNTIF(is_delivered AND is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 900) AS sla_15m_leads,
        COUNTIF(is_delivered AND is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 3600) AS sla_60m_leads,
        COUNTIF(is_delivered AND NOT is_dialled) AS awaiting_first_dial,
        MAX(CASE WHEN is_delivered AND NOT is_dialled AND first_delivery_ts IS NOT NULL
          THEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), first_delivery_ts, SECOND) END) AS oldest_delivery_wait_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND capture_to_dial_sec >= 0 THEN capture_to_dial_sec END, 100)[OFFSET(50)] AS capture_to_dial_median_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND capture_to_dial_sec >= 0 THEN capture_to_dial_sec END, 100)[OFFSET(90)] AS capture_to_dial_p90_sec,
        COUNTIF(is_dialled AND capture_to_dial_sec BETWEEN 0 AND 900) AS capture_sla_15m_leads,
        COUNTIF(is_dialled AND capture_to_dial_sec BETWEEN 0 AND 3600) AS capture_sla_60m_leads,
        COUNTIF(is_sale AND NOT is_activated AND sale_ts IS NOT NULL AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) > 14) AS activation_backlog_14d,
        COUNTIF(is_after_hours AND is_rpc) AS after_hours_rpc,
        COUNTIF(NOT is_after_hours AND is_rpc) AS operating_hours_rpc,
        COUNTIF(is_after_hours AND is_sale) AS after_hours_sales,
        COUNTIF(NOT is_after_hours AND is_sale) AS operating_hours_sales,
        COUNTIF(NOT is_after_hours) AS operating_hours_leads,
        COUNTIF(source = '') AS missing_source,
        COUNTIF(grade = '') AS missing_grade,
        COUNTIF(vendor = 'Unknown') AS missing_vendor,
        COUNTIF(is_dialled AND NOT has_disposition) AS missing_disposition
      FROM classified
    ),
    attempts AS (
      SELECT
        attempt_bucket AS bucket,
        CASE attempt_bucket
          WHEN '0 calls' THEN 0 WHEN '1 call' THEN 1 WHEN '2 calls' THEN 2
          WHEN '3 calls' THEN 3 WHEN '4 calls' THEN 4 ELSE 5 END AS bucket_order,
        COUNT(*) AS leads,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales,
        COUNTIF(is_activated) AS activations
      FROM classified
      GROUP BY attempt_bucket
    ),
    sla AS (
      SELECT
        sla_band AS band,
        CASE sla_band
          WHEN '0–15m' THEN 1 WHEN '15–30m' THEN 2 WHEN '30–60m' THEN 3
          WHEN '1–6h' THEN 4 WHEN '6–24h' THEN 5 WHEN '24h+' THEN 6
          WHEN 'Undialled' THEN 7 WHEN 'Not delivered' THEN 8 ELSE 9 END AS sort_order,
        COUNT(*) AS leads,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales
      FROM classified
      GROUP BY sla_band
    ),
    activation_age AS (
      SELECT activation_age_bucket AS bucket, COUNT(*) AS leads
      FROM classified
      WHERE activation_age_bucket IS NOT NULL
      GROUP BY activation_age_bucket
    ),
    hourly_flow AS (
      SELECT
        hour_of_day AS hour,
        SUM(captured) AS captured,
        SUM(first_dials) AS first_dials
      FROM (
        SELECT
          CAST(FORMAT_TIMESTAMP('%H', fetched_ts, @tenantTimezone) AS INT64) AS hour_of_day,
          COUNT(*) AS captured,
          0 AS first_dials
        FROM classified
        WHERE fetched_ts IS NOT NULL
        GROUP BY hour_of_day
        UNION ALL
        SELECT
          CAST(FORMAT_TIMESTAMP('%H', first_call_ts, @tenantTimezone) AS INT64) AS hour_of_day,
          0 AS captured,
          COUNT(*) AS first_dials
        FROM classified
        WHERE first_call_ts IS NOT NULL
        GROUP BY hour_of_day
      )
      GROUP BY hour_of_day
    ),
    daily_turnaround AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(fetched_ts, @tenantTimezone)) AS date,
        COUNT(*) AS leads,
        COUNTIF(is_dialled) AS dialled,
        COUNTIF(NOT is_dialled) AS undialled,
        APPROX_QUANTILES(CASE WHEN is_dialled AND capture_to_dial_sec >= 0 THEN capture_to_dial_sec END, 100)[OFFSET(50)] AS median_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND capture_to_dial_sec >= 0 THEN capture_to_dial_sec END, 100)[OFFSET(90)] AS p90_sec,
        COUNTIF(is_dialled AND capture_to_dial_sec BETWEEN 0 AND 900) AS within_15m,
        COUNTIF(is_dialled AND capture_to_dial_sec BETWEEN 0 AND 3600) AS within_60m
      FROM classified
      WHERE fetched_ts IS NOT NULL
      GROUP BY date
    ),
    vendor_controls AS (
      SELECT
        vendor,
        COUNT(*) AS leads,
        COUNTIF(is_dialled) AS dialled,
        COUNTIF(recorded_call_count = 1) AS one_call_leads,
        COUNTIF(recorded_call_count >= 5 AND NOT is_rpc) AS high_attempt_no_rpc,
        COUNTIF(is_dialled AND NOT has_disposition) AS missing_disposition,
        COUNTIF(is_delivered AND is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 900) AS sla_15m_leads,
        COUNTIF(is_delivered) AS delivered,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales,
        APPROX_QUANTILES(CASE WHEN is_dialled AND delivery_to_dial_sec >= 0 THEN delivery_to_dial_sec END, 100)[OFFSET(50)] AS median_first_dial_sec
      FROM classified
      GROUP BY vendor
      ORDER BY leads DESC
      LIMIT 20
    )
    SELECT
      summary.*,
      ARRAY(SELECT AS STRUCT * FROM attempts ORDER BY bucket_order) AS attempts,
      ARRAY(SELECT AS STRUCT * FROM sla ORDER BY sort_order) AS sla_bands,
      ARRAY(SELECT AS STRUCT * FROM activation_age) AS activation_ageing,
      ARRAY(SELECT AS STRUCT * FROM hourly_flow ORDER BY hour) AS hourly_flow,
      ARRAY(SELECT AS STRUCT * FROM daily_turnaround ORDER BY date) AS daily_turnaround,
      ARRAY(SELECT AS STRUCT * FROM vendor_controls) AS vendor_controls
    FROM summary
  `;

  const [rows] = await client.query({ query, params: paramsWithOperating });
  const row = rows[0] || {};
  const total = Number(row.total_leads || 0);
  const dialled = Number(row.dialled_leads || 0);
  const delivered = Number(row.delivered_leads || 0);
  const afterHours = Number(row.after_hours_leads || 0);
  const operatingHours = Number(row.operating_hours_leads || 0);
  const awaitingFirstDial = Number(row.awaiting_first_dial || 0);
  const captureMedianSec = row.capture_to_dial_median_sec === null || row.capture_to_dial_median_sec === undefined ? null : Number(row.capture_to_dial_median_sec);
  const captureP90Sec = row.capture_to_dial_p90_sec === null || row.capture_to_dial_p90_sec === undefined ? null : Number(row.capture_to_dial_p90_sec);

  const attemptBuckets = (row.attempts || []).map((item: any) => {
    const leads = Number(item.leads || 0);
    const contacted = Number(item.contacted || 0);
    const sales = Number(item.sales || 0);
    const activations = Number(item.activations || 0);
    return {
      bucket: item.bucket,
      leads,
      sharePct: total > 0 ? Number(((leads / total) * 100).toFixed(1)) : 0,
      contacted,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      sales,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activations,
    };
  });

  const slaBands = (row.sla_bands || []).map((item: any) => {
    const leads = Number(item.leads || 0);
    const contacted = Number(item.contacted || 0);
    const sales = Number(item.sales || 0);
    return {
      band: item.band,
      leads,
      sharePct: total > 0 ? Number(((leads / total) * 100).toFixed(1)) : 0,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
    };
  });

  const vendorControls = (row.vendor_controls || []).map((item: any) => {
    const leads = Number(item.leads || 0);
    const vendorDialled = Number(item.dialled || 0);
    const vendorDelivered = Number(item.delivered || 0);
    const contacted = Number(item.contacted || 0);
    const sales = Number(item.sales || 0);
    const oneCall = Number(item.one_call_leads || 0);
    const missingDisposition = Number(item.missing_disposition || 0);
    const sla15 = Number(item.sla_15m_leads || 0);
    return {
      vendor: item.vendor,
      leads,
      oneCallSharePct: vendorDialled > 0 ? Number(((oneCall / vendorDialled) * 100).toFixed(1)) : 0,
      highAttemptNoRpc: Number(item.high_attempt_no_rpc || 0),
      dispositionCompletenessPct: vendorDialled > 0 ? Number((((vendorDialled - missingDisposition) / vendorDialled) * 100).toFixed(1)) : 0,
      sla15Rate: vendorDelivered > 0 ? Number(((sla15 / vendorDelivered) * 100).toFixed(1)) : 0,
      medianFirstDial: formatDuration(item.median_first_dial_sec === null ? null : Number(item.median_first_dial_sec)),
      rpcRate: vendorDialled > 0 ? Number(((contacted / vendorDialled) * 100).toFixed(1)) : 0,
      leadToSaleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
    };
  });

  return {
    summary: {
      totalLeads: total,
      deliveredLeads: delivered,
      dialledLeads: dialled,
      zeroCallLeads: Number(row.zero_call_leads || 0),
      oneCallLeads: Number(row.one_call_leads || 0),
      multiCallLeads: Number(row.multi_call_leads || 0),
      highAttemptNoRpcLeads: Number(row.high_attempt_no_rpc_leads || 0),
      singleAttemptSharePct: dialled > 0 ? Number(((Number(row.one_call_leads || 0) / dialled) * 100).toFixed(1)) : 0,
      multiAttemptSharePct: dialled > 0 ? Number(((Number(row.multi_call_leads || 0) / dialled) * 100).toFixed(1)) : 0,
      dispositionCompletenessPct: dialled > 0 ? Number(((Number(row.disposition_complete_leads || 0) / dialled) * 100).toFixed(1)) : 0,
      afterHoursLeads: afterHours,
      afterHoursSharePct: total > 0 ? Number(((afterHours / total) * 100).toFixed(1)) : 0,
      weekendLeads: Number(row.weekend_leads || 0),
      weekendSharePct: total > 0 ? Number(((Number(row.weekend_leads || 0) / total) * 100).toFixed(1)) : 0,
      sla15Rate: delivered > 0 ? Number(((Number(row.sla_15m_leads || 0) / delivered) * 100).toFixed(1)) : 0,
      sla60Rate: delivered > 0 ? Number(((Number(row.sla_60m_leads || 0) / delivered) * 100).toFixed(1)) : 0,
      awaitingFirstDial,
      oldestDeliveryWait: formatDuration(row.oldest_delivery_wait_sec === null || row.oldest_delivery_wait_sec === undefined ? null : Number(row.oldest_delivery_wait_sec)),
      captureToDialMedian: formatDuration(captureMedianSec),
      captureToDialP90: formatDuration(captureP90Sec),
      captureWithin15mRate: total > 0 ? Number(((Number(row.capture_sla_15m_leads || 0) / total) * 100).toFixed(1)) : 0,
      captureWithin60mRate: total > 0 ? Number(((Number(row.capture_sla_60m_leads || 0) / total) * 100).toFixed(1)) : 0,
      activationBacklog14d: Number(row.activation_backlog_14d || 0),
      afterHoursRpcRate: afterHours > 0 ? Number(((Number(row.after_hours_rpc || 0) / afterHours) * 100).toFixed(1)) : 0,
      operatingHoursRpcRate: operatingHours > 0 ? Number(((Number(row.operating_hours_rpc || 0) / operatingHours) * 100).toFixed(1)) : 0,
      afterHoursSaleRate: afterHours > 0 ? Number(((Number(row.after_hours_sales || 0) / afterHours) * 100).toFixed(2)) : 0,
      operatingHoursSaleRate: operatingHours > 0 ? Number(((Number(row.operating_hours_sales || 0) / operatingHours) * 100).toFixed(2)) : 0,
    },
    attemptBuckets,
    slaBands,
    activationAgeing: row.activation_ageing || [],
    hourlyFlow: (row.hourly_flow || []).map((item: any) => ({
      hour: Number(item.hour || 0),
      captured: Number(item.captured || 0),
      firstDials: Number(item.first_dials || 0),
    })),
    dailyTurnaround: (row.daily_turnaround || []).map((item: any) => {
      const leads = Number(item.leads || 0);
      return {
        date: item.date,
        leads,
        dialled: Number(item.dialled || 0),
        undialled: Number(item.undialled || 0),
        median: formatDuration(item.median_sec === null ? null : Number(item.median_sec)),
        p90: formatDuration(item.p90_sec === null ? null : Number(item.p90_sec)),
        within15mRate: leads > 0 ? Number(((Number(item.within_15m || 0) / leads) * 100).toFixed(1)) : 0,
        within60mRate: leads > 0 ? Number(((Number(item.within_60m || 0) / leads) * 100).toFixed(1)) : 0,
      };
    }),
    vendorControls,
    dataCompleteness: {
      missingSource: Number(row.missing_source || 0),
      missingGrade: Number(row.missing_grade || 0),
      missingVendor: Number(row.missing_vendor || 0),
      missingDisposition: Number(row.missing_disposition || 0),
    },
    operatingContext: {
      timezone,
      start: operating.start,
      end: operating.end,
      workdays: operating.workdays,
    },
    methodology: {
      callCount: 'Call-count controls use the maximum recorded HLC/vendor total_calls value per lead. They are descriptive and are not event-level attempt attribution.',
      vendor: 'Vendor controls use the first recorded delivered vendor per lead to keep each lead exclusive in the comparison.',
      operatingHours: 'Operating-hours classification uses the tenant timezone and configured operating window.',
      captureTurnaround: 'Capture-to-first-dial measures lead fetched/API-entry time to the first recorded dial. Delivery-to-first-dial remains a separate downstream handoff metric.',
      realtimeDialler: 'Live agent state, hopper priority, dial level, drop rate and hopper-reset events require the VICIdial real-time/API source and are not inferred from historical BigQuery rows.',
    },
    validationStatus: 'NOT_VERIFIED',
  };
}

// 1. EXECUTIVE OVERVIEW
export async function getExecutiveOverview(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const clientConfig = getClientConfig(params.clientId);
  const { whereSql, queryParams } = buildFilterClause(params);

  const mainQuery = `
    WITH lead_records AS (
      SELECT
        l.lead_id,
        DATE(SAFE_CAST(l.fetched AS TIMESTAMP)) AS fetched_date,
        hlc.vendor,
        hlc.delivered,
        hlc.first_call_date,
        hlc.last_dialer_status,
        hlc.total_calls,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        SAFE_CAST(hlc.sale AS TIMESTAMP) AS sale_ts,
        SAFE_CAST(hlc.activated AS TIMESTAMP) AS activation_ts,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
        hlc.delivered IS NOT NULL AND hlc.delivered NOT LIKE '1900%' AND hlc.delivered NOT LIKE '1970%' AS is_delivered,
        hlc.first_call_date IS NOT NULL AND hlc.first_call_date NOT LIKE '1900%' AND hlc.first_call_date NOT LIKE '1970%' AS is_dialled,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) AS delivery_to_dial_sec,
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) AS delivery_age_sec,
        COALESCE(hlc.revenue_generated, 0) AS revenue
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    summary AS (
      SELECT
        COUNT(DISTINCT lead_id) AS fetched_leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered_leads,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled_leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted_leads,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sale_leads,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activated_leads,
        SUM(revenue) AS total_revenue,
        SUM(COALESCE(total_calls, 0)) AS total_calls_recorded
      FROM lead_records
    ),
    daily_trends AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', fetched_date) AS date,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations,
        ROUND(SUM(revenue), 2) AS revenue
      FROM lead_records
      WHERE fetched_date IS NOT NULL
      GROUP BY fetched_date
      ORDER BY fetched_date DESC
      LIMIT 60
    ),
    operational AS (
      SELECT
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled THEN lead_id END) AS awaiting_first_dial,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec BETWEEN 0 AND 900 THEN lead_id END) AS backlog_0_15m,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 900 AND delivery_age_sec <= 1800 THEN lead_id END) AS backlog_15_30m,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 1800 AND delivery_age_sec <= 3600 THEN lead_id END) AS backlog_30_60m,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 3600 AND delivery_age_sec <= 21600 THEN lead_id END) AS backlog_1_6h,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 21600 AND delivery_age_sec <= 43200 THEN lead_id END) AS backlog_6_12h,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 43200 AND delivery_age_sec <= 86400 THEN lead_id END) AS backlog_12_24h,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 86400 THEN lead_id END) AS backlog_24h_plus,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 3600 THEN lead_id END) AS backlog_over_60m,
        COUNT(DISTINCT CASE WHEN is_dialled AND delivery_to_dial_sec BETWEEN 0 AND 900 THEN lead_id END) AS dialled_within_15m,
        COUNT(DISTINCT CASE WHEN is_dialled AND (last_dialer_status IS NULL OR TRIM(last_dialer_status) = '') THEN lead_id END) AS dialled_missing_disposition,
        COUNT(DISTINCT CASE WHEN is_sale AND NOT is_activated AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), sale_ts, DAY) >= 14 THEN lead_id END) AS sales_unactivated_14d,
        APPROX_QUANTILES(CASE WHEN is_dialled AND delivery_to_dial_sec >= 0 THEN delivery_to_dial_sec END, 100)[OFFSET(50)] AS median_delivery_to_dial_sec,
        APPROX_QUANTILES(CASE WHEN is_dialled AND delivery_to_dial_sec >= 0 THEN delivery_to_dial_sec END, 100)[OFFSET(90)] AS p90_delivery_to_dial_sec
      FROM lead_records
    ),
    backlog_vendor AS (
      SELECT
        COALESCE(vendor, 'Unknown') AS vendor,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled THEN lead_id END) AS awaiting_first_dial,
        COUNT(DISTINCT CASE WHEN is_delivered AND NOT is_dialled AND delivery_age_sec > 3600 THEN lead_id END) AS over_60m
      FROM lead_records
      GROUP BY vendor
      HAVING awaiting_first_dial > 0
      ORDER BY over_60m DESC, awaiting_first_dial DESC
      LIMIT 8
    )
    SELECT
      summary.*,
      operational.*,
      ARRAY(SELECT AS STRUCT * FROM daily_trends ORDER BY date) AS daily_trends,
      ARRAY(SELECT AS STRUCT * FROM backlog_vendor) AS backlog_by_vendor
    FROM summary
    CROSS JOIN operational
  `;

  const [rows] = await client.query({ query: mainQuery, params: queryParams });
  const data = rows[0] || {};

  const fetched = Number(data.fetched_leads || 0);
  const delivered = Number(data.delivered_leads || 0);
  const dialled = Number(data.dialled_leads || 0);
  const contacted = Number(data.contacted_leads || 0);
  const sales = Number(data.sale_leads || 0);
  const activated = Number(data.activated_leads || 0);
  const revenue = Number(data.total_revenue || 0);
  const totalCalls = Number(data.total_calls_recorded || 0);

  const rates = {
    deliveryRate: fetched > 0 ? Number(((delivered / fetched) * 100).toFixed(1)) : 0,
    dialRate: delivered > 0 ? Number(((dialled / delivered) * 100).toFixed(1)) : 0,
    contactRate: dialled > 0 ? Number(((contacted / dialled) * 100).toFixed(1)) : 0,
    leadToSaleRate: fetched > 0 ? Number(((sales / fetched) * 100).toFixed(2)) : 0,
    contactToSaleRate: contacted > 0 ? Number(((sales / contacted) * 100).toFixed(1)) : 0,
    activationRate: sales > 0 ? Number(((activated / sales) * 100).toFixed(1)) : 0,
  };

  const funnelStages = [
    { key: 'fetched', name: 'Fetched', volume: fetched, rate: 100 },
    { key: 'delivered', name: 'Delivered', volume: delivered, rate: rates.deliveryRate },
    { key: 'dialled', name: 'Dialled', volume: dialled, rate: rates.dialRate },
    { key: 'rpc', name: 'RPC', volume: contacted, rate: rates.contactRate },
    { key: 'sales', name: 'Sales', volume: sales, rate: rates.leadToSaleRate },
    { key: 'activated', name: 'Activated', volume: activated, rate: rates.activationRate },
  ].map((stage, index, stages) => {
    const previous = index === 0 ? null : stages[index - 1];
    const loss = previous ? Math.max(previous.volume - stage.volume, 0) : 0;
    const transitionRate = previous && previous.volume > 0 ? Number(((stage.volume / previous.volume) * 100).toFixed(1)) : 100;
    return { ...stage, loss, transitionRate };
  });

  const transitions = funnelStages.slice(1).map((stage, index) => ({
    from: funnelStages[index].name,
    to: stage.name,
    loss: stage.loss,
    rate: stage.transitionRate,
  }));
  const largestLeak = transitions.reduce((largest, current) => current.loss > largest.loss ? current : largest, transitions[0] || { from: 'Fetched', to: 'Delivered', loss: 0, rate: 0 });

  const backlogBuckets = [
    { bucket: '0–15m', count: Number(data.backlog_0_15m || 0), severity: 'normal' },
    { bucket: '15–30m', count: Number(data.backlog_15_30m || 0), severity: 'normal' },
    { bucket: '30–60m', count: Number(data.backlog_30_60m || 0), severity: 'attention' },
    { bucket: '1–6h', count: Number(data.backlog_1_6h || 0), severity: 'warning' },
    { bucket: '6–12h', count: Number(data.backlog_6_12h || 0), severity: 'warning' },
    { bucket: '12–24h', count: Number(data.backlog_12_24h || 0), severity: 'critical' },
    { bucket: '24h+', count: Number(data.backlog_24h_plus || 0), severity: 'critical' },
  ];

  const slaCompliance = delivered > 0
    ? Number(((Number(data.dialled_within_15m || 0) / delivered) * 100).toFixed(1))
    : 0;

  const attention = [
    {
      id: 'awaiting-first-dial',
      title: 'Delivered leads awaiting first dial',
      value: Number(data.awaiting_first_dial || 0),
      severity: Number(data.backlog_over_60m || 0) > 0 ? 'high' : 'medium',
      detail: `${Number(data.backlog_over_60m || 0).toLocaleString()} have been waiting longer than 60 minutes.`,
      path: '/speed-to-lead',
    },
    {
      id: 'missing-disposition',
      title: 'Dialled leads missing disposition',
      value: Number(data.dialled_missing_disposition || 0),
      severity: Number(data.dialled_missing_disposition || 0) > 0 ? 'medium' : 'low',
      detail: 'Dial attempts exist but no latest disposition is recorded.',
      path: '/data-integrity',
    },
    {
      id: 'unactivated-sales',
      title: 'Sales without activation after 14 days',
      value: Number(data.sales_unactivated_14d || 0),
      severity: Number(data.sales_unactivated_14d || 0) > 0 ? 'medium' : 'low',
      detail: 'Recorded sales are at least 14 days old and have no activation timestamp.',
      path: '/sales-activation',
    },
  ].filter(item => item.value > 0);

  let comparison: null | {
    fetchedDelta: number | null;
    deliveryRateDelta: number | null;
    dialRateDelta: number | null;
    contactRateDelta: number | null;
    saleRateDelta: number | null;
    activationRateDelta: number | null;
    revenueDelta: number | null;
    contributionDelta: null;
  } = null;
  let comparisonWindow: { startDate: string; endDate: string } | null = null;

  if (params.startDate && params.endDate) {
    const startMs = Date.parse(params.startDate + 'T00:00:00Z');
    const endMs = Date.parse(params.endDate + 'T00:00:00Z');
    const days = Math.floor((endMs - startMs) / 86400000) + 1;
    if (days > 0 && days <= 366) {
      const previousEnd = new Date(startMs - 86400000);
      const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
      const previousParams = {
        ...params,
        startDate: previousStart.toISOString().slice(0, 10),
        endDate: previousEnd.toISOString().slice(0, 10),
      };
      comparisonWindow = { startDate: previousParams.startDate, endDate: previousParams.endDate };
      const previousScope = buildFilterClause(previousParams);
      const previousQuery = `
        WITH base AS (
          SELECT
            l.lead_id,
            hlc.delivered,
            hlc.first_call_date,
            SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
            hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
            hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
            COALESCE(hlc.revenue_generated, 0) AS revenue
          FROM ${configuredSourceTable(params.clientId, 'leads')} l
          LEFT JOIN UNNEST(l.hlc_details) hlc
          ${previousScope.whereSql}
        )
        SELECT
          COUNT(DISTINCT lead_id) AS fetched,
          COUNT(DISTINCT CASE WHEN delivered IS NOT NULL AND delivered NOT LIKE '1900%' AND delivered NOT LIKE '1970%' THEN lead_id END) AS delivered,
          COUNT(DISTINCT CASE WHEN first_call_date IS NOT NULL AND first_call_date NOT LIKE '1900%' AND first_call_date NOT LIKE '1970%' THEN lead_id END) AS dialled,
          COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
          COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
          COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activated,
          SUM(revenue) AS revenue
        FROM base
      `;
      const [previousRows] = await client.query({ query: previousQuery, params: previousScope.queryParams });
      const previous = previousRows[0] || {};
      const pf = Number(previous.fetched || 0), pd = Number(previous.delivered || 0), pdi = Number(previous.dialled || 0);
      const pc = Number(previous.contacted || 0), ps = Number(previous.sales || 0), pa = Number(previous.activated || 0), pr = Number(previous.revenue || 0);
      const pctDelta = (current: number, prior: number) => prior > 0 ? Number((((current - prior) / prior) * 100).toFixed(1)) : null;
      const ppDelta = (current: number, prior: number) => Number((current - prior).toFixed(1));
      comparison = {
        fetchedDelta: pctDelta(fetched, pf),
        deliveryRateDelta: ppDelta(rates.deliveryRate, pf > 0 ? (pd / pf) * 100 : 0),
        dialRateDelta: ppDelta(rates.dialRate, pd > 0 ? (pdi / pd) * 100 : 0),
        contactRateDelta: ppDelta(rates.contactRate, pdi > 0 ? (pc / pdi) * 100 : 0),
        saleRateDelta: Number((rates.leadToSaleRate - (pf > 0 ? (ps / pf) * 100 : 0)).toFixed(2)),
        activationRateDelta: ppDelta(rates.activationRate, ps > 0 ? (pa / ps) * 100 : 0),
        revenueDelta: pctDelta(revenue, pr),
        contributionDelta: null,
      };
    }
  }

  return {
    kpis: {
      fetchedLeads: fetched,
      deliveredLeads: delivered,
      deliveryRate: rates.deliveryRate,
      dialledLeads: dialled,
      dialRate: rates.dialRate,
      contactedLeads: contacted,
      contactRate: rates.contactRate,
      qualifiedLeads: 0,
      saleLeads: sales,
      leadToSaleRate: rates.leadToSaleRate,
      contactToSaleRate: rates.contactToSaleRate,
      activatedLeads: activated,
      activationRate: rates.activationRate,
      totalCalls,
      callsPerLead: fetched > 0 ? Number((totalCalls / fetched).toFixed(1)) : 0,
      callsPerDialledLead: dialled > 0 ? Number((totalCalls / dialled).toFixed(1)) : 0,
      revenue,
      directCost: null,
      deliveryAgentCost: null,
      allocatedCost: null,
      totalCost: null,
      contribution: null,
      marginPct: null,
      costPerSale: null,
      costPerActivation: null,
      revenuePerLead: fetched > 0 ? Number((revenue / fetched).toFixed(2)) : 0,
      breakEvenSales: null,
      actualVsBreakEven: null
    },
    funnelStages,
    funnelLeak: largestLeak,
    dailyTrends: data.daily_trends || [],
    backlog: {
      awaitingFirstDial: Number(data.awaiting_first_dial || 0),
      over60Minutes: Number(data.backlog_over_60m || 0),
      buckets: backlogBuckets,
      byVendor: data.backlog_by_vendor || [],
    },
    sla: {
      firstDialTargetMinutes: 15,
      complianceRate: slaCompliance,
      medianDeliveryToDial: formatDuration(Number(data.median_delivery_to_dial_sec || 0)),
      p90DeliveryToDial: formatDuration(Number(data.p90_delivery_to_dial_sec || 0)),
    },
    attention,
    comparison,
    comparisonWindow,
    commercialStatus: 'UNAVAILABLE',
    commercialReason: 'Commercial costs and profitability are withheld until an approved rate-card contract is configured.',
    validationStatus: 'NOT_VERIFIED',
    currency: clientConfig.currency || 'ZAR',
    clientName: clientConfig.name
  };
}

// Deterministic root-cause decomposition for matched periods.
// Dimensions are reduced to one value per lead so each dimension reconciles to the selected metric.
export async function getRootCauseAnalysis(params: OffernetQueryParams) {
  const allowedMetrics = new Set(['fetchedLeads', 'deliveryRate', 'dialRate', 'contactRate', 'leadToSaleRate', 'activationRate']);
  const metric = params.metric || 'leadToSaleRate';
  if (!allowedMetrics.has(metric)) throw new RequestError('Unsupported root-cause metric', 422);
  if (!params.startDate || !params.endDate) throw new RequestError('Root-cause analysis requires an explicit startDate and endDate', 422);

  const startMs = Date.parse(params.startDate + 'T00:00:00Z');
  const endMs = Date.parse(params.endDate + 'T00:00:00Z');
  const days = Math.floor((endMs - startMs) / 86400000) + 1;
  if (!Number.isFinite(days) || days <= 0 || days > 366) throw new RequestError('Root-cause date range must be between 1 and 366 days', 422);

  const previousEnd = new Date(startMs - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  const previousStartDate = previousStart.toISOString().slice(0, 10);
  const previousEndDate = previousEnd.toISOString().slice(0, 10);

  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const baseScope = buildFilterClause({ ...params, startDate: undefined, endDate: undefined, metric: undefined });
  const queryParams = {
    ...baseScope.queryParams,
    currentStartDate: params.startDate,
    currentEndDate: params.endDate,
    previousStartDate,
    previousEndDate,
  };

  const query = `
    WITH scoped_rows AS (
      SELECT
        l.lead_id,
        DATE(SAFE_CAST(l.fetched AS TIMESTAMP)) AS fetched_date,
        COALESCE(l.offershop_source, 'Unknown') AS source,
        COALESCE(l.offershop_grade, 'Unknown') AS grade,
        hlc.vendor,
        SAFE_CAST(hlc.delivered AS TIMESTAMP) AS delivered_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) AS first_call_ts,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${baseScope.whereSql}
    ),
    lead_level AS (
      SELECT
        lead_id,
        fetched_date,
        ANY_VALUE(source) AS source,
        ANY_VALUE(grade) AS grade,
        COALESCE(
          ARRAY_AGG(vendor IGNORE NULLS ORDER BY IF(delivered_ts IS NULL, 1, 0), delivered_ts ASC LIMIT 1)[SAFE_OFFSET(0)],
          'Unknown'
        ) AS vendor,
        COUNTIF(delivered_ts IS NOT NULL) > 0 AS is_delivered,
        COUNTIF(first_call_ts IS NOT NULL) > 0 AS is_dialled,
        COUNTIF(is_rpc) > 0 AS is_rpc,
        COUNTIF(is_sale) > 0 AS is_sale,
        COUNTIF(is_activated) > 0 AS is_activated,
        MIN(delivered_ts) AS first_delivery_ts,
        MIN(first_call_ts) AS first_call_ts
      FROM scoped_rows
      WHERE fetched_date BETWEEN @previousStartDate AND @currentEndDate
      GROUP BY lead_id, fetched_date
    ),
    periodized AS (
      SELECT
        *,
        CASE
          WHEN fetched_date BETWEEN @currentStartDate AND @currentEndDate THEN 'current'
          WHEN fetched_date BETWEEN @previousStartDate AND @previousEndDate THEN 'previous'
          ELSE NULL
        END AS period,
        CASE
          WHEN first_delivery_ts IS NULL THEN 'Not delivered'
          WHEN first_call_ts IS NULL THEN 'Undialled'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) < 0 THEN 'Invalid timing'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 300 THEN '0–5m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 900 THEN '5–15m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 1800 THEN '15–30m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 3600 THEN '30–60m'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 21600 THEN '1–6h'
          WHEN TIMESTAMP_DIFF(first_call_ts, first_delivery_ts, SECOND) <= 86400 THEN '6–24h'
          ELSE '24h+'
        END AS lead_age
      FROM lead_level
    ),
    dimensional AS (
      SELECT period, 'vendor' AS dimension, vendor AS segment,
        COUNT(*) AS fetched, COUNTIF(is_delivered) AS delivered, COUNTIF(is_dialled) AS dialled,
        COUNTIF(is_rpc) AS rpc, COUNTIF(is_sale) AS sales, COUNTIF(is_activated) AS activated
      FROM periodized WHERE period IS NOT NULL GROUP BY period, vendor
      UNION ALL
      SELECT period, 'source', source,
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, source
      UNION ALL
      SELECT period, 'grade', grade,
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, grade
      UNION ALL
      SELECT period, 'leadAge', lead_age,
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, lead_age
      UNION ALL
      SELECT period, 'overall', 'All',
        COUNT(*), COUNTIF(is_delivered), COUNTIF(is_dialled), COUNTIF(is_rpc), COUNTIF(is_sale), COUNTIF(is_activated)
      FROM periodized WHERE period IS NOT NULL GROUP BY period
    )
    SELECT * FROM dimensional
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const numeric = (row: any, key: string) => Number(row?.[key] || 0);
  const parts = (row: any) => {
    switch (metric) {
      case 'fetchedLeads': return { numerator: numeric(row, 'fetched'), denominator: 1, kind: 'volume' as const };
      case 'deliveryRate': return { numerator: numeric(row, 'delivered'), denominator: numeric(row, 'fetched'), kind: 'rate' as const };
      case 'dialRate': return { numerator: numeric(row, 'dialled'), denominator: numeric(row, 'delivered'), kind: 'rate' as const };
      case 'contactRate': return { numerator: numeric(row, 'rpc'), denominator: numeric(row, 'dialled'), kind: 'rate' as const };
      case 'activationRate': return { numerator: numeric(row, 'activated'), denominator: numeric(row, 'sales'), kind: 'rate' as const };
      default: return { numerator: numeric(row, 'sales'), denominator: numeric(row, 'fetched'), kind: 'rate' as const };
    }
  };
  const value = (row: any) => {
    const p = parts(row);
    if (p.kind === 'volume') return p.numerator;
    return p.denominator > 0 ? Number(((p.numerator / p.denominator) * 100).toFixed(2)) : 0;
  };

  const currentOverall = rows.find((row: any) => row.dimension === 'overall' && row.period === 'current') || {};
  const previousOverall = rows.find((row: any) => row.dimension === 'overall' && row.period === 'previous') || {};
  const currentValue = value(currentOverall);
  const previousValue = value(previousOverall);
  const delta = Number((currentValue - previousValue).toFixed(2));
  const currentParts = parts(currentOverall);
  const previousParts = parts(previousOverall);

  const labels: Record<string, string> = {
    fetchedLeads: 'Fetched leads',
    deliveryRate: 'Delivery rate',
    dialRate: 'Dial coverage',
    contactRate: 'RPC rate',
    leadToSaleRate: 'Sale / fetched',
    activationRate: 'Activation / sale',
  };
  const dimensionLabels: Record<string, string> = {
    vendor: 'Vendor',
    source: 'Source',
    grade: 'Grade',
    leadAge: 'First-dial age',
  };

  const dimensions = ['vendor', 'source', 'grade', 'leadAge'].map(dimension => {
    const current = new Map(rows.filter((row: any) => row.dimension === dimension && row.period === 'current').map((row: any) => [String(row.segment), row]));
    const previous = new Map(rows.filter((row: any) => row.dimension === dimension && row.period === 'previous').map((row: any) => [String(row.segment), row]));
    const names = Array.from(new Set([...current.keys(), ...previous.keys()]));

    const segments = names.map(name => {
      const currentRow: any = current.get(name) || {};
      const previousRow: any = previous.get(name) || {};
      const cp = parts(currentRow), pp = parts(previousRow);
      const currentSegmentValue = value(currentRow);
      const previousSegmentValue = value(previousRow);
      const contribution = cp.kind === 'volume'
        ? cp.numerator - pp.numerator
        : Number(((
            (currentParts.denominator > 0 ? cp.numerator / currentParts.denominator : 0)
            - (previousParts.denominator > 0 ? pp.numerator / previousParts.denominator : 0)
          ) * 100).toFixed(2));
      return {
        name,
        currentValue: currentSegmentValue,
        previousValue: previousSegmentValue,
        currentNumerator: cp.numerator,
        currentDenominator: cp.kind === 'volume' ? cp.numerator : cp.denominator,
        previousNumerator: pp.numerator,
        previousDenominator: pp.kind === 'volume' ? pp.numerator : pp.denominator,
        contribution,
        shareOfDelta: delta !== 0 ? Number(((contribution / delta) * 100).toFixed(1)) : null,
      };
    }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    return {
      key: dimension,
      label: dimensionLabels[dimension],
      segments: segments.slice(0, 12),
    };
  });

  const drivers = dimensions
    .flatMap(dimension => dimension.segments.slice(0, 4).map(segment => ({ ...segment, dimension: dimension.key, dimensionLabel: dimension.label })))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 8);

  return {
    metric: {
      id: metric,
      label: labels[metric],
      kind: metric === 'fetchedLeads' ? 'volume' : 'rate',
      currentValue,
      previousValue,
      delta,
      deltaUnit: metric === 'fetchedLeads' ? 'leads' : 'pp',
    },
    currentWindow: { startDate: params.startDate, endDate: params.endDate },
    previousWindow: { startDate: previousStartDate, endDate: previousEndDate },
    dimensions,
    drivers,
    methodology: metric === 'fetchedLeads'
      ? 'Segment contributions are current lead volume minus matched-period lead volume.'
      : 'Segment contribution is the change in that segment numerator divided by the full-period denominator, so contributions within each exclusive dimension reconcile to the overall percentage-point change.',
    validationStatus: 'NOT_VERIFIED',
  };
}

// 2. FUNNEL INTELLIGENCE
export async function getFunnelIntelligence(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH base AS (
      SELECT 
        l.lead_id,
        SAFE_CAST(l.fetched AS TIMESTAMP) as fetched_ts,
        SAFE_CAST(hlc.delivered AS TIMESTAMP) as delivered_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) as first_dial_ts,
        COALESCE(hlc.vendor, 'Unknown') as vendor,
        COALESCE(l.offershop_source, 'Unknown') as source,
        COALESCE(l.offershop_grade, 'Standard') as grade,
        SAFE_CAST(hlc.sale AS TIMESTAMP) as sale_ts,
        SAFE_CAST(hlc.activated AS TIMESTAMP) as activation_ts,
        SAFE_CAST(hlc.rpc AS INT64) > 0 as is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as is_activated,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.delivered AS TIMESTAMP), SAFE_CAST(l.fetched AS TIMESTAMP), SECOND) as fetch_to_delivery_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) as delivery_to_first_dial_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.sale AS TIMESTAMP), SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SECOND) as dial_to_sale_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.activated AS TIMESTAMP), SAFE_CAST(hlc.sale AS TIMESTAMP), SECOND) as sale_to_act_sec
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    velocity AS (
      SELECT 
        AVG(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 86400 THEN fetch_to_delivery_sec END) as avg_fetch_delivery_sec,
        AVG(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END) as avg_deliv_dial_sec,
        AVG(CASE WHEN dial_to_sale_sec BETWEEN 0 AND 2592000 THEN dial_to_sale_sec END) as avg_dial_to_sale_sec,
        AVG(CASE WHEN sale_to_act_sec BETWEEN 0 AND 2592000 THEN sale_to_act_sec END) as avg_sale_to_act_sec
      FROM base
    ),
    by_vendor AS (
      SELECT 
        vendor,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN delivered_ts IS NOT NULL THEN lead_id END) as delivered,
        COUNT(DISTINCT CASE WHEN first_dial_ts IS NOT NULL THEN lead_id END) as dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM base
      GROUP BY vendor
      ORDER BY leads DESC
      LIMIT 12
    ),
    by_source AS (
      SELECT 
        source,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN delivered_ts IS NOT NULL THEN lead_id END) as delivered,
        COUNT(DISTINCT CASE WHEN first_dial_ts IS NOT NULL THEN lead_id END) as dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM base
      GROUP BY source
      ORDER BY leads DESC
      LIMIT 10
    ),
    by_grade AS (
      SELECT 
        grade,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN delivered_ts IS NOT NULL THEN lead_id END) as delivered,
        COUNT(DISTINCT CASE WHEN first_dial_ts IS NOT NULL THEN lead_id END) as dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM base
      GROUP BY grade
      ORDER BY leads DESC
      LIMIT 8
    )
    SELECT 
      (SELECT AS STRUCT * FROM velocity) as velocity,
      ARRAY(SELECT AS STRUCT * FROM by_vendor) as vendors,
      ARRAY(SELECT AS STRUCT * FROM by_source) as sources,
      ARRAY(SELECT AS STRUCT * FROM by_grade) as grades
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || { velocity: {}, vendors: [], sources: [], grades: [] };

  return {
    velocity: {
      fetchToDelivery: formatDuration(data.velocity?.avg_fetch_delivery_sec),
      deliveryToFirstDial: formatDuration(data.velocity?.avg_deliv_dial_sec),
      firstDialToContact: 'Unavailable',
      contactToSale: formatDuration(data.velocity?.avg_dial_to_sale_sec),
      saleToActivation: formatDuration(data.velocity?.avg_sale_to_act_sec)
    },
    byVendor: data.vendors || [],
    bySource: data.sources || [],
    byGrade: data.grades || []
  };
}

// 3. SPEED TO LEAD
export async function getSpeedToLeadAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);
  const operating = clientConfig.operationalConfig?.operatingHours || { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };
  queryParams.tenantTimezone = clientConfig.timezone || 'Africa/Johannesburg';
  queryParams.operatingStart = operating.start.length === 5 ? operating.start + ':00' : operating.start;
  queryParams.operatingEnd = operating.end.length === 5 ? operating.end + ':00' : operating.end;
  queryParams.operatingWorkdays = operating.workdays;

  const query = `
    WITH stage_timings AS (
      SELECT 
        l.lead_id,
        SAFE_CAST(l.fetched AS TIMESTAMP) as fetched_ts,
        SAFE_CAST(hlc.delivered AS TIMESTAMP) as delivered_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) as first_dial_ts,
        SAFE_CAST(hlc.rpc AS INT64) > 0 as is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as is_activated,
        
        -- Calculated latencies (in seconds)
        TIMESTAMP_DIFF(SAFE_CAST(hlc.attempted_to_deliver AS TIMESTAMP), SAFE_CAST(l.fetched AS TIMESTAMP), SECOND) as capture_to_fetch_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.delivered AS TIMESTAMP), SAFE_CAST(l.fetched AS TIMESTAMP), SECOND) as fetch_to_delivery_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) as delivery_to_first_dial_sec,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(l.fetched AS TIMESTAMP), SECOND) as capture_to_first_dial_sec,
        
        -- Tenant-local operating-hours flag.
        CAST(FORMAT_TIMESTAMP('%u', SAFE_CAST(l.fetched AS TIMESTAMP), @tenantTimezone) AS INT64) NOT IN UNNEST(@operatingWorkdays)
          OR FORMAT_TIMESTAMP('%H:%M:%S', SAFE_CAST(l.fetched AS TIMESTAMP), @tenantTimezone) < @operatingStart
          OR FORMAT_TIMESTAMP('%H:%M:%S', SAFE_CAST(l.fetched AS TIMESTAMP), @tenantTimezone) >= @operatingEnd AS is_after_hours
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    cohorts AS (
      SELECT 
        CASE 
          WHEN capture_to_first_dial_sec <= 300 THEN '0–5 min'
          WHEN capture_to_first_dial_sec <= 900 THEN '5–15 min'
          WHEN capture_to_first_dial_sec <= 1800 THEN '15–30 min'
          WHEN capture_to_first_dial_sec <= 3600 THEN '30–60 min'
          WHEN capture_to_first_dial_sec <= 21600 THEN '1–6 hrs'
          WHEN capture_to_first_dial_sec <= 43200 THEN '6–12 hrs'
          WHEN capture_to_first_dial_sec <= 86400 THEN '12–24 hrs'
          ELSE '24+ hrs'
        END as age_cohort,
        CASE 
          WHEN capture_to_first_dial_sec <= 300 THEN 1
          WHEN capture_to_first_dial_sec <= 900 THEN 2
          WHEN capture_to_first_dial_sec <= 1800 THEN 3
          WHEN capture_to_first_dial_sec <= 3600 THEN 4
          WHEN capture_to_first_dial_sec <= 21600 THEN 5
          WHEN capture_to_first_dial_sec <= 43200 THEN 6
          WHEN capture_to_first_dial_sec <= 86400 THEN 7
          ELSE 8
        END as sort_order,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations
      FROM stage_timings
      WHERE capture_to_first_dial_sec > 0
      GROUP BY 1, 2
      ORDER BY sort_order ASC
    ),
    after_hours AS (
      SELECT 
        is_after_hours,
        COUNT(DISTINCT lead_id) as leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) as contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations,
        AVG(CASE WHEN capture_to_first_dial_sec > 0 THEN capture_to_first_dial_sec END) as avg_dial_sec
      FROM stage_timings
      GROUP BY is_after_hours
    ),
    percentiles AS (
      SELECT 
        -- Stage 1: Capture -> Fetch
        ROUND(AVG(CASE WHEN capture_to_fetch_sec BETWEEN 0 AND 3600 THEN capture_to_fetch_sec END), 0) as avg_cap_fetch,
        APPROX_QUANTILES(CASE WHEN capture_to_fetch_sec BETWEEN 0 AND 3600 THEN capture_to_fetch_sec END, 100)[OFFSET(50)] as med_cap_fetch,
        APPROX_QUANTILES(CASE WHEN capture_to_fetch_sec BETWEEN 0 AND 3600 THEN capture_to_fetch_sec END, 100)[OFFSET(75)] as p75_cap_fetch,
        APPROX_QUANTILES(CASE WHEN capture_to_fetch_sec BETWEEN 0 AND 3600 THEN capture_to_fetch_sec END, 100)[OFFSET(90)] as p90_cap_fetch,

        -- Stage 2: Fetch -> Delivery
        ROUND(AVG(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 7200 THEN fetch_to_delivery_sec END), 0) as avg_fetch_deliv,
        APPROX_QUANTILES(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 7200 THEN fetch_to_delivery_sec END, 100)[OFFSET(50)] as med_fetch_deliv,
        APPROX_QUANTILES(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 7200 THEN fetch_to_delivery_sec END, 100)[OFFSET(75)] as p75_fetch_deliv,
        APPROX_QUANTILES(CASE WHEN fetch_to_delivery_sec BETWEEN 0 AND 7200 THEN fetch_to_delivery_sec END, 100)[OFFSET(90)] as p90_fetch_deliv,

        -- Stage 3: Delivery -> First Dial
        ROUND(AVG(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END), 0) as avg_deliv_dial,
        APPROX_QUANTILES(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END, 100)[OFFSET(50)] as med_deliv_dial,
        APPROX_QUANTILES(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END, 100)[OFFSET(75)] as p75_deliv_dial,
        APPROX_QUANTILES(CASE WHEN delivery_to_first_dial_sec BETWEEN 0 AND 604800 THEN delivery_to_first_dial_sec END, 100)[OFFSET(90)] as p90_deliv_dial,

        -- Stage 4: Capture -> First Dial
        ROUND(AVG(CASE WHEN capture_to_first_dial_sec BETWEEN 0 AND 604800 THEN capture_to_first_dial_sec END), 0) as avg_cap_dial,
        APPROX_QUANTILES(CASE WHEN capture_to_first_dial_sec BETWEEN 0 AND 604800 THEN capture_to_first_dial_sec END, 100)[OFFSET(50)] as med_cap_dial,
        APPROX_QUANTILES(CASE WHEN capture_to_first_dial_sec BETWEEN 0 AND 604800 THEN capture_to_first_dial_sec END, 100)[OFFSET(75)] as p75_cap_dial,
        APPROX_QUANTILES(CASE WHEN capture_to_first_dial_sec BETWEEN 0 AND 604800 THEN capture_to_first_dial_sec END, 100)[OFFSET(90)] as p90_cap_dial
      FROM stage_timings
    )
    SELECT 
      (SELECT AS STRUCT * FROM percentiles) as percentiles,
      ARRAY(SELECT AS STRUCT * FROM cohorts) as cohorts,
      ARRAY(SELECT AS STRUCT * FROM after_hours) as after_hours
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || { percentiles: {}, cohorts: [], after_hours: [] };
  const p = data.percentiles || {};

  // Formatted stages include only durations directly supported by source timestamps.
  const numberOrNull = (value: unknown): number | null => value === null || value === undefined ? null : Number(value);
  const timingStages = [
    {
      stage: 'Capture → Fetch',
      description: 'Lead generation ingestion & schema validation',
      avgSec: numberOrNull(p.avg_cap_fetch),
      medianSec: numberOrNull(p.med_cap_fetch),
      p75Sec: numberOrNull(p.p75_cap_fetch),
      p90Sec: numberOrNull(p.p90_cap_fetch),
      avg: formatDuration(numberOrNull(p.avg_cap_fetch)),
      median: formatDuration(numberOrNull(p.med_cap_fetch)),
      p75: formatDuration(numberOrNull(p.p75_cap_fetch)),
      p90: formatDuration(numberOrNull(p.p90_cap_fetch))
    },
    {
      stage: 'Fetch → Delivery',
      description: 'Routing dispatch to recorded delivery',
      avgSec: numberOrNull(p.avg_fetch_deliv),
      medianSec: numberOrNull(p.med_fetch_deliv),
      p75Sec: numberOrNull(p.p75_fetch_deliv),
      p90Sec: numberOrNull(p.p90_fetch_deliv),
      avg: formatDuration(numberOrNull(p.avg_fetch_deliv)),
      median: formatDuration(numberOrNull(p.med_fetch_deliv)),
      p75: formatDuration(numberOrNull(p.p75_fetch_deliv)),
      p90: formatDuration(numberOrNull(p.p90_fetch_deliv))
    },
    {
      stage: 'Delivery → First Dial',
      description: 'Recorded delivery to first recorded dial',
      avgSec: numberOrNull(p.avg_deliv_dial),
      medianSec: numberOrNull(p.med_deliv_dial),
      p75Sec: numberOrNull(p.p75_deliv_dial),
      p90Sec: numberOrNull(p.p90_deliv_dial),
      avg: formatDuration(numberOrNull(p.avg_deliv_dial)),
      median: formatDuration(numberOrNull(p.med_deliv_dial)),
      p75: formatDuration(numberOrNull(p.p75_deliv_dial)),
      p90: formatDuration(numberOrNull(p.p90_deliv_dial))
    },
    {
      stage: 'Capture → First Dial',
      description: 'Lead capture to first recorded dial',
      avgSec: numberOrNull(p.avg_cap_dial),
      medianSec: numberOrNull(p.med_cap_dial),
      p75Sec: numberOrNull(p.p75_cap_dial),
      p90Sec: numberOrNull(p.p90_cap_dial),
      avg: formatDuration(numberOrNull(p.avg_cap_dial)),
      median: formatDuration(numberOrNull(p.med_cap_dial)),
      p75: formatDuration(numberOrNull(p.p75_cap_dial)),
      p90: formatDuration(numberOrNull(p.p90_cap_dial))
    }
  ];

  const cohorts = (data.cohorts || []).map((c: any) => {
    const leads = Number(c.leads || 0);
    const contacted = Number(c.contacted || 0);
    const sales = Number(c.sales || 0);
    const activations = Number(c.activations || 0);
    return {
      cohort: c.age_cohort,
      leads,
      contacted,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      sales,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activations,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0
    };
  });

  const afterHours = (data.after_hours || []).map((a: any) => {
    const leads = Number(a.leads || 0);
    const contacted = Number(a.contacted || 0);
    const sales = Number(a.sales || 0);
    return {
      type: a.is_after_hours ? 'Outside configured operating hours' : `Operating hours (${operating.start}–${operating.end})`,
      leads,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      avgTimeToFirstDial: formatDuration(a.avg_dial_sec)
    };
  });

  return {
    timingStages,
    cohorts,
    afterHours,
    operatingContext: {
      timezone: clientConfig.timezone,
      start: operating.start,
      end: operating.end,
      workdays: operating.workdays,
    }
  };
}

// 4. CONTACT STRATEGY
export async function getContactStrategyAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH raw AS (
      SELECT
        l.lead_id,
        COALESCE(SAFE_CAST(hlc.total_calls AS INT64), 0) AS total_calls,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
        COALESCE(hlc.revenue_generated, 0) AS revenue
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    lead_level AS (
      SELECT
        lead_id,
        MAX(GREATEST(total_calls, 0)) AS call_count,
        COUNTIF(is_rpc) > 0 AS is_rpc,
        COUNTIF(is_sale) > 0 AS is_sale,
        COUNTIF(is_activated) > 0 AS is_activated,
        MAX(revenue) AS revenue
      FROM raw
      GROUP BY lead_id
    ),
    brackets AS (
      SELECT
        CASE
          WHEN call_count = 0 THEN '0 calls'
          WHEN call_count = 1 THEN '1 call'
          WHEN call_count = 2 THEN '2 calls'
          WHEN call_count = 3 THEN '3 calls'
          WHEN call_count = 4 THEN '4 calls'
          ELSE '5+ calls'
        END AS attempt_bucket,
        CASE
          WHEN call_count = 0 THEN 0
          WHEN call_count = 1 THEN 1
          WHEN call_count = 2 THEN 2
          WHEN call_count = 3 THEN 3
          WHEN call_count = 4 THEN 4
          ELSE 5
        END AS bucket_order,
        COUNT(*) AS leads,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales,
        COUNTIF(is_activated) AS activations,
        ROUND(SUM(revenue), 2) AS revenue
      FROM lead_level
      GROUP BY 1, 2
      ORDER BY bucket_order
    )
    SELECT * FROM brackets
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const totalLeads = rows.reduce((acc: number, row: any) => acc + Number(row.leads || 0), 0);
  const attemptPerformance = rows.map((row: any) => {
    const leads = Number(row.leads || 0);
    const contacted = Number(row.contacted || 0);
    const sales = Number(row.sales || 0);
    const activations = Number(row.activations || 0);
    return {
      bucket: row.attempt_bucket,
      leads,
      sharePct: totalLeads > 0 ? Number(((leads / totalLeads) * 100).toFixed(1)) : 0,
      contacted,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      sales,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activations,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
      revenue: Number(row.revenue || 0),
      callCost: null,
      marginalSales: null,
      marginalCostPerSale: null
    };
  });

  const oneCall = attemptPerformance.find(row => row.bucket === '1 call');
  const multiCallLeads = attemptPerformance
    .filter(row => !['0 calls', '1 call'].includes(row.bucket))
    .reduce((sum, row) => sum + row.leads, 0);
  const highAttempt = attemptPerformance.find(row => row.bucket === '5+ calls');

  return {
    attemptPerformance,
    attemptCadence: [],
    summary: {
      totalLeads,
      zeroCallLeads: attemptPerformance.find(row => row.bucket === '0 calls')?.leads || 0,
      oneCallLeads: oneCall?.leads || 0,
      singleAttemptSharePct: totalLeads > 0 ? Number((((oneCall?.leads || 0) / totalLeads) * 100).toFixed(1)) : 0,
      multiAttemptLeads: multiCallLeads,
      multiAttemptSharePct: totalLeads > 0 ? Number(((multiCallLeads / totalLeads) * 100).toFixed(1)) : 0,
      fivePlusCallLeads: highAttempt?.leads || 0,
      fivePlusNoRpcLeads: highAttempt ? Math.max(highAttempt.leads - highAttempt.contacted, 0) : 0,
    },
    noAnswerAnalysis: {
      status: 'UNAVAILABLE',
      reason: 'Event-level attempt spacing, callback completion and redial economics are not independently validated. Recommendations are withheld.',
      stopThresholdRecommendation: null,
      diminishingReturnsCutoff: null,
      callbackFollowupRate: null,
      callbackSaleConversion: null
    },
    methodology: 'Buckets are exclusive per lead using the maximum recorded HLC total_calls value. They describe observed call-count populations and do not identify which specific attempt produced the outcome.'
  };
}

// 5. VENDOR & LEAD QUALITY
export async function getVendorQualityAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH base AS (
      SELECT
        l.lead_id,
        COALESCE(hlc.vendor, 'Unknown') AS vendor,
        COALESCE(l.offershop_source, 'Unknown') AS source,
        COALESCE(l.offershop_grade, 'Standard') AS grade,
        COALESCE(l.offershop_color_vetting, 'Unvetted') AS vetting,
        l.valid_idno,
        l.phone_valid,
        hlc.delivered IS NOT NULL AND hlc.delivered NOT LIKE '1900%' AND hlc.delivered NOT LIKE '1970%' AS is_delivered,
        hlc.first_call_date IS NOT NULL AND hlc.first_call_date NOT LIKE '1900%' AND hlc.first_call_date NOT LIKE '1970%' AS is_dialled,
        SAFE_CAST(hlc.rpc AS INT64) > 0 AS is_rpc,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' AS is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' AS is_activated,
        COALESCE(hlc.total_calls, 0) AS total_calls,
        COALESCE(hlc.revenue_generated, 0) AS revenue,
        TIMESTAMP_DIFF(SAFE_CAST(hlc.first_call_date AS TIMESTAMP), SAFE_CAST(hlc.delivered AS TIMESTAMP), SECOND) AS deliv_to_dial_sec
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    vendor_matrix AS (
      SELECT
        vendor,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations,
        COUNT(DISTINCT CASE WHEN valid_idno = '0' OR valid_idno = 'false' OR phone_valid = '0' OR phone_valid = 'false' THEN lead_id END) AS invalid_leads,
        SUM(total_calls) AS total_calls,
        ROUND(SUM(revenue), 2) AS revenue,
        APPROX_QUANTILES(CASE WHEN deliv_to_dial_sec >= 0 THEN deliv_to_dial_sec END, 100)[OFFSET(50)] AS med_first_dial_sec
      FROM base
      GROUP BY vendor
      ORDER BY leads DESC
      LIMIT 15
    ),
    source_matrix AS (
      SELECT
        source,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_delivered THEN lead_id END) AS delivered,
        COUNT(DISTINCT CASE WHEN is_dialled THEN lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations,
        COUNT(DISTINCT CASE WHEN valid_idno = '0' OR valid_idno = 'false' OR phone_valid = '0' OR phone_valid = 'false' THEN lead_id END) AS invalid_leads
      FROM base
      GROUP BY source
      ORDER BY leads DESC
      LIMIT 15
    ),
    grade_matrix AS (
      SELECT
        grade,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations
      FROM base
      GROUP BY grade
      ORDER BY leads DESC
      LIMIT 10
    ),
    vetting_matrix AS (
      SELECT
        CASE
          WHEN vetting LIKE 'Orange%' THEN 'Orange'
          WHEN vetting LIKE 'Charcoal%' THEN 'Charcoal'
          WHEN vetting LIKE 'Blue%' THEN 'Blue'
          WHEN vetting LIKE 'Green%' THEN 'Green'
          ELSE 'Other / Unvetted'
        END AS vetting_color,
        COUNT(DISTINCT lead_id) AS leads,
        COUNT(DISTINCT CASE WHEN is_rpc THEN lead_id END) AS contacted,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) AS activations
      FROM base
      GROUP BY 1
      ORDER BY leads DESC
    )
    SELECT
      ARRAY(SELECT AS STRUCT * FROM vendor_matrix) AS vendors,
      ARRAY(SELECT AS STRUCT * FROM source_matrix) AS sources,
      ARRAY(SELECT AS STRUCT * FROM grade_matrix) AS grades,
      ARRAY(SELECT AS STRUCT * FROM vetting_matrix) AS vetting
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || { vendors: [], sources: [], grades: [], vetting: [] };

  const vendors = (data.vendors || []).map((v: any) => {
    const leads = Number(v.leads || 0), delivered = Number(v.delivered || 0), dialled = Number(v.dialled || 0);
    const contacted = Number(v.contacted || 0), sales = Number(v.sales || 0), activations = Number(v.activations || 0);
    const invalid = Number(v.invalid_leads || 0), totalCalls = Number(v.total_calls || 0), revenue = Number(v.revenue || 0);
    const medianFirstDialSec = v.med_first_dial_sec === null || v.med_first_dial_sec === undefined ? null : Number(v.med_first_dial_sec);
    return {
      vendor: v.vendor,
      leads,
      deliveryRate: leads > 0 ? Number(((delivered / leads) * 100).toFixed(1)) : 0,
      dialRate: delivered > 0 ? Number(((dialled / delivered) * 100).toFixed(1)) : 0,
      contactRate: dialled > 0 ? Number(((contacted / dialled) * 100).toFixed(1)) : 0,
      saleRate: contacted > 0 ? Number(((sales / contacted) * 100).toFixed(2)) : 0,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
      medianFirstDial: formatDuration(medianFirstDialSec),
      medianFirstDialSec,
      callsPerLead: leads > 0 ? Number((totalCalls / leads).toFixed(1)) : 0,
      invalidRate: leads > 0 ? Number(((invalid / leads) * 100).toFixed(1)) : 0,
      revenue,
      directCost: null,
      deliveryCost: null,
      contribution: null,
      marginPct: null
    };
  });

  const sources = (data.sources || []).map((s: any) => {
    const leads = Number(s.leads || 0), delivered = Number(s.delivered || 0), dialled = Number(s.dialled || 0);
    const contacted = Number(s.contacted || 0), sales = Number(s.sales || 0), activations = Number(s.activations || 0), invalid = Number(s.invalid_leads || 0);
    return {
      source: s.source,
      leads,
      delivered,
      dialled,
      contacted,
      sales,
      activations,
      deliveryRate: leads > 0 ? Number(((delivered / leads) * 100).toFixed(1)) : 0,
      dialRate: delivered > 0 ? Number(((dialled / delivered) * 100).toFixed(1)) : 0,
      contactRate: dialled > 0 ? Number(((contacted / dialled) * 100).toFixed(1)) : 0,
      leadToSaleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
      invalidRate: leads > 0 ? Number(((invalid / leads) * 100).toFixed(1)) : 0,
    };
  });

  const outcomeRates = (row: any, labelKey: 'grade' | 'vetting_color') => {
    const leads = Number(row.leads || 0), contacted = Number(row.contacted || 0), sales = Number(row.sales || 0), activations = Number(row.activations || 0);
    return {
      [labelKey]: row[labelKey],
      leads,
      contacted,
      sales,
      activations,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      leadToSaleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
      activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0,
    };
  };

  return {
    vendors,
    sources,
    grades: (data.grades || []).map((row: any) => outcomeRates(row, 'grade')),
    vetting: (data.vetting || []).map((row: any) => outcomeRates(row, 'vetting_color')),
    commercialStatus: 'UNAVAILABLE',
    commercialReason: 'Vendor contribution and margin are withheld until approved cost contracts are configured.'
  };
}

// 6. TEMPORAL INTELLIGENCE (Day x Hour Heatmaps)
export async function getTemporalAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);
  const operating = clientConfig.operationalConfig?.operatingHours || { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };
  queryParams.tenantTimezone = clientConfig.timezone || 'Africa/Johannesburg';
  queryParams.operatingStart = operating.start.length === 5 ? operating.start + ':00' : operating.start;
  queryParams.operatingEnd = operating.end.length === 5 ? operating.end + ':00' : operating.end;
  queryParams.operatingWorkdays = operating.workdays;

  const query = `
    WITH lead_level AS (
      SELECT
        l.lead_id,
        ANY_VALUE(SAFE_CAST(l.fetched AS TIMESTAMP)) AS fetched_ts,
        COUNTIF(SAFE_CAST(hlc.rpc AS INT64) > 0) > 0 AS is_rpc,
        COUNTIF(hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '') > 0 AS is_sale,
        COUNTIF(hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '') > 0 AS is_activated
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
      GROUP BY l.lead_id
    ),
    classified AS (
      SELECT
        *,
        CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) AS iso_day,
        CAST(FORMAT_TIMESTAMP('%H', fetched_ts, @tenantTimezone) AS INT64) AS hour_of_day,
        CAST(FORMAT_TIMESTAMP('%u', fetched_ts, @tenantTimezone) AS INT64) NOT IN UNNEST(@operatingWorkdays)
          OR FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) < @operatingStart
          OR FORMAT_TIMESTAMP('%H:%M:%S', fetched_ts, @tenantTimezone) >= @operatingEnd AS is_after_hours
      FROM lead_level
    ),
    matrix AS (
      SELECT
        iso_day,
        hour_of_day,
        COUNT(*) AS volume,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales,
        COUNTIF(is_activated) AS activations
      FROM classified
      GROUP BY iso_day, hour_of_day
    ),
    operating_summary AS (
      SELECT
        is_after_hours,
        COUNT(*) AS leads,
        COUNTIF(is_rpc) AS contacted,
        COUNTIF(is_sale) AS sales
      FROM classified
      GROUP BY is_after_hours
    )
    SELECT
      ARRAY(SELECT AS STRUCT * FROM matrix) AS matrix,
      ARRAY(SELECT AS STRUCT * FROM operating_summary) AS operating_summary
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || { matrix: [], operating_summary: [] };
  const rowsByCell = data.matrix || [];
  const isoDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const heatmap: any[] = [];

  for (let d = 1; d <= 7; d++) {
    for (let h = 0; h < 24; h++) {
      const match = rowsByCell.find((row: any) => Number(row.iso_day) === d && Number(row.hour_of_day) === h);
      const volume = match ? Number(match.volume || 0) : 0;
      const contacted = match ? Number(match.contacted || 0) : 0;
      const sales = match ? Number(match.sales || 0) : 0;
      const activations = match ? Number(match.activations || 0) : 0;
      heatmap.push({
        dayIndex: d,
        dayName: isoDays[d - 1],
        hour: h,
        volume,
        contactRate: volume > 0 ? Number(((contacted / volume) * 100).toFixed(1)) : 0,
        saleRate: volume > 0 ? Number(((sales / volume) * 100).toFixed(2)) : 0,
        activationRate: sales > 0 ? Number(((activations / sales) * 100).toFixed(1)) : 0
      });
    }
  }

  const peakWindows = heatmap
    .filter(cell => cell.volume > 0)
    .sort((a, b) => (b.contactRate - a.contactRate) || (b.volume - a.volume))
    .slice(0, 6)
    .map(cell => ({
      window: `${cell.dayName} ${String(cell.hour).padStart(2, '0')}:00–${String((cell.hour + 1) % 24).padStart(2, '0')}:00`,
      contactRate: `${cell.contactRate.toFixed(1)}%`,
      saleIndex: cell.saleRate.toFixed(2),
      verdict: 'Observed high-contact capture window'
    }));

  const operatingComparison = (data.operating_summary || []).map((row: any) => {
    const leads = Number(row.leads || 0);
    const contacted = Number(row.contacted || 0);
    const sales = Number(row.sales || 0);
    return {
      type: row.is_after_hours ? 'Outside configured operating hours' : 'Inside configured operating hours',
      leads,
      contactRate: leads > 0 ? Number(((contacted / leads) * 100).toFixed(1)) : 0,
      saleRate: leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0,
    };
  });

  return {
    heatmap,
    peakWindows,
    operatingComparison,
    operatingContext: {
      timezone: clientConfig.timezone,
      start: operating.start,
      end: operating.end,
      workdays: operating.workdays,
    },
    timeDimension: 'Lead capture time'
  };
}

// 7. SALES & ACTIVATION INTELLIGENCE
export async function getSalesActivationAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    WITH sales_data AS (
      SELECT 
        l.lead_id,
        hlc.vendor,
        hlc.transaction_id,
        SAFE_CAST(l.fetched AS TIMESTAMP) as fetched_ts,
        SAFE_CAST(hlc.first_call_date AS TIMESTAMP) as dial_ts,
        SAFE_CAST(hlc.sale AS TIMESTAMP) as sale_ts,
        SAFE_CAST(hlc.activated AS TIMESTAMP) as activation_ts,
        hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as is_sale,
        hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as is_activated,
        COALESCE(hlc.revenue_generated, 0) as revenue
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${whereSql}
    ),
    summary AS (
      SELECT 
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as total_sales,
        COUNT(DISTINCT CASE WHEN is_sale AND revenue > 0 THEN lead_id END) as billable_sales,
        COUNT(DISTINCT CASE WHEN is_sale AND (revenue = 0 OR revenue IS NULL) THEN lead_id END) as unbilled_sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as total_activations,
        SUM(revenue) as realized_revenue,
        AVG(CASE WHEN is_sale THEN TIMESTAMP_DIFF(sale_ts, fetched_ts, SECOND) END) as avg_time_to_sale_sec,
        AVG(CASE WHEN is_activated THEN TIMESTAMP_DIFF(activation_ts, sale_ts, SECOND) END) as avg_time_to_activation_sec
      FROM sales_data
    ),
    by_vendor AS (
      SELECT 
        vendor,
        COUNT(DISTINCT CASE WHEN is_sale THEN lead_id END) as sales,
        COUNT(DISTINCT CASE WHEN is_activated THEN lead_id END) as activations,
        ROUND(SUM(revenue), 2) as revenue
      FROM sales_data
      WHERE vendor IS NOT NULL
      GROUP BY vendor
      ORDER BY sales DESC
      LIMIT 10
    )
    SELECT 
      summary.*,
      ARRAY(SELECT AS STRUCT * FROM by_vendor) as vendors
    FROM summary
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const data = rows[0] || {};

  const totalSales = Number(data.total_sales || 0);
  const billable = Number(data.billable_sales || 0);
  const activations = Number(data.total_activations || 0);

  // A maturation curve requires a separately validated activation-event model.
  // Do not substitute a static benchmark for observed cohort evidence.
  const maturationCurve: Array<{ day: string; activationSharePct: number; cumulativePct: number }> = [];

  return {
    reconciliation: {
      totalSales,
      billableSales: billable,
      unbilledSales: Number(data.unbilled_sales || 0),
      totalActivations: activations,
      activationRate: totalSales > 0 ? Number(((activations / totalSales) * 100).toFixed(1)) : 0,
      realizedRevenue: Number(data.realized_revenue || 0),
      avgTimeToSale: formatDuration(data.avg_time_to_sale_sec),
      avgTimeToActivation: formatDuration(data.avg_time_to_activation_sec)
    },
    maturationCurve,
    maturationStatus: 'UNAVAILABLE',
    maturationReason: 'Activation maturation is withheld until event-level activation joins are independently validated.',
    byVendor: data.vendors || []
  };
}

// 8. COMMERCIAL INTELLIGENCE
export async function getCommercialAnalytics(params: OffernetQueryParams) {
  const overview = await getExecutiveOverview(params);
  const kpis = overview.kpis;

  let campaignData: Awaited<ReturnType<typeof getClientCampaignAnalytics>> | null = null;
  let mediaReason = 'Media spend is unavailable for this scope.';
  const campaignCompatible = !params.vendor && !params.source && !params.medium && !params.grade && !params.agent;

  if (campaignCompatible) {
    try {
      campaignData = await getClientCampaignAnalytics(params);
      mediaReason = campaignData.reason || mediaReason;
    } catch (error) {
      mediaReason = error instanceof Error ? error.message : mediaReason;
    }
  } else {
    mediaReason = 'Media spend is not shown while operational vendor/source/grade/agent filters are active because those filters are not yet reconciled to the marketing source.';
  }

  const mediaSpend = campaignData?.summary?.spend ?? null;
  const platformCpl = campaignData?.summary?.cpl ?? null;
  const platformCpc = campaignData?.summary?.cpc ?? null;
  const platformCpm = campaignData?.summary?.cpm ?? null;
  const spendObserved = mediaSpend !== null;

  const blendedCostPerFetchedLead = spendObserved && kpis.fetchedLeads > 0
    ? Number((mediaSpend / kpis.fetchedLeads).toFixed(2))
    : null;
  const blendedCostPerSale = spendObserved && kpis.saleLeads > 0
    ? Number((mediaSpend / kpis.saleLeads).toFixed(2))
    : null;
  const blendedCostPerActivation = spendObserved && kpis.activatedLeads > 0
    ? Number((mediaSpend / kpis.activatedLeads).toFixed(2))
    : null;
  const revenueToMediaSpendRatio = spendObserved && mediaSpend > 0
    ? Number((kpis.revenue / mediaSpend).toFixed(2))
    : null;

  return {
    status: spendObserved ? 'PARTIAL' : 'UNAVAILABLE',
    reason: spendObserved
      ? 'Observed media spend and platform CPC/CPM/CPL are available. Blended cost-per-fetched-lead/sale/activation and recorded-revenue-to-media-spend are period-level cross-source ratios and are not attribution or full profitability. Telephony, commission, overhead and other operating costs remain withheld.'
      : 'Profitability and media efficiency remain unavailable until an approved incurred-spend source is present for this scope.',
    baseline: {
      volume: kpis.fetchedLeads,
      cpl: platformCpl,
      cpc: platformCpc,
      cpm: platformCpm,
      mediaSpend,
      conversionRate: kpis.leadToSaleRate,
      revenuePerSale: kpis.saleLeads > 0 ? Number((kpis.revenue / kpis.saleLeads).toFixed(2)) : null,
      fixedOverhead: null,
      revenue: kpis.revenue,
      totalCost: null,
      contribution: null,
      marginPct: null,
      costPerSale: null,
      costPerActivation: null,
      breakEvenVolume: null,
      blendedCostPerFetchedLead,
      blendedCostPerSale,
      blendedCostPerActivation,
      revenueToMediaSpendRatio
    },
    media: {
      status: campaignData?.spendSource?.status || 'UNAVAILABLE',
      reason: mediaReason,
      spendSourceColumn: campaignData?.spendSource?.column || null,
      spendSourceTable: campaignData?.spendSource?.table || null,
      platformLeads: campaignData?.summary?.leads || 0,
      platformClicks: campaignData?.summary?.clicks || 0,
      platformImpressions: campaignData?.summary?.impressions || 0,
    },
    currency: overview.currency,
    pAndLBreakdown: [
      { item: 'Recorded Revenue', amount: kpis.revenue, type: 'recorded_revenue' },
      ...(spendObserved ? [{ item: 'Observed Media Spend', amount: -mediaSpend, type: 'observed_media_spend' }] : []),
    ]
  };
}

export async function getSourceObservability(params: Pick<OffernetQueryParams, 'clientId'>) {
  const clientConfig = getClientConfig(params.clientId);
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const sources: Array<{
    key: string;
    label: string;
    status: string;
    table: string | null;
    latestRecordAt: string | null;
    ageHours: number | null;
    rowCount: number | null;
    detail: string;
  }> = [];

  const pushFreshness = async (
    key: string,
    label: string,
    table: string | undefined,
    timestampExpression: string,
    whereSql = '',
    queryParams: Record<string, any> = {},
    tableAlias = '',
  ) => {
    if (!table) {
      sources.push({ key, label, status: 'UNAVAILABLE', table: null, latestRecordAt: null, ageHours: null, rowCount: null, detail: 'No source table is configured.' });
      return;
    }
    try {
      const [rows] = await client.query({
        query: `
          SELECT
            MAX(${timestampExpression}) AS latest_record_at,
            COUNT(*) AS row_count,
            TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(${timestampExpression}), HOUR) AS age_hours
          FROM \`${table}\` ${tableAlias}
          ${whereSql}
        `,
        params: queryParams,
      });
      const row = rows[0] || {};
      const latest = row.latest_record_at?.value || row.latest_record_at || null;
      const ageHours = row.age_hours === null || row.age_hours === undefined ? null : Number(row.age_hours);
      sources.push({
        key,
        label,
        status: latest ? 'OBSERVED' : 'EMPTY',
        table,
        latestRecordAt: latest ? String(latest) : null,
        ageHours,
        rowCount: Number(row.row_count || 0),
        detail: latest ? 'Freshness is observed directly from the configured source table.' : 'No usable source timestamp was observed.',
      });
    } catch (error) {
      sources.push({
        key,
        label,
        status: 'ERROR',
        table,
        latestRecordAt: null,
        ageHours: null,
        rowCount: null,
        detail: error instanceof Error ? error.message : 'Source freshness query failed.',
      });
    }
  };

  const leadScope = buildFilterClause({ clientId: params.clientId }, 'l', '');
  await pushFreshness(
    'leads',
    'Lead ledger',
    clientConfig.semanticMappings.tables.leads,
    'SAFE_CAST(l.fetched AS TIMESTAMP)',
    leadScope.whereSql,
    leadScope.queryParams,
    'l',
  );

  const callTable = clientConfig.semanticMappings.tables.calls;
  const callConditions = ["call_start_date IS NOT NULL"];
  const callParams: Record<string, any> = {};
  if (clientConfig.id !== 'default_tenant') {
    const partners = clientConfig.semanticMappings.partners || [];
    if (partners.length) {
      callConditions.push('LOWER(vendor) IN UNNEST(@tenantVendors)');
      callParams.tenantVendors = partners.map(value => value.toLowerCase());
    }
  }
  await pushFreshness(
    'calls',
    'Dialler calls',
    callTable,
    'SAFE_CAST(call_start_date AS TIMESTAMP)',
    `WHERE ${callConditions.join(' AND ')}`,
    callParams,
  );

  const contract = clientConfig.marketing;
  if (!contract || !clientConfig.capabilities.marketing) {
    sources.push({
      key: 'marketing',
      label: 'Marketing API',
      status: 'UNAVAILABLE',
      table: contract?.table || null,
      latestRecordAt: null,
      ageHours: null,
      rowCount: null,
      detail: 'No marketing API-table contract is configured for this tenant.',
    });
  } else if (contract.mappingStatus === 'UNRESOLVED' || (contract.mappingStatus === 'MAPPED' && !contract.clientNames.length)) {
    sources.push({
      key: 'marketing',
      label: 'Marketing API',
      status: 'MAPPING_REQUIRED',
      table: contract.table,
      latestRecordAt: null,
      ageHours: null,
      rowCount: null,
      detail: 'Source exists, but tenant client_name mapping is not approved.',
    });
  } else {
    const tenantFilter = marketingTenantFilter(contract);
    const marketingConditions = tenantFilter.sql ? `WHERE ${tenantFilter.sql}` : '';
    await pushFreshness(
      'marketing',
      'Marketing API',
      contract.table,
      `SAFE_CAST(${safeWarehouseColumn(contract.dateField)} AS TIMESTAMP)`,
      marketingConditions,
      tenantFilter.params,
    );
  }

  if (clientConfig.semanticMappings.tables.activations) {
    await pushFreshness(
      'activations',
      'Activation source',
      clientConfig.semanticMappings.tables.activations,
      'SAFE_CAST(date_created AS TIMESTAMP)',
    );
  } else {
    sources.push({
      key: 'activations',
      label: 'Activation source',
      status: 'UNAVAILABLE',
      table: null,
      latestRecordAt: null,
      ageHours: null,
      rowCount: null,
      detail: 'No separate activation lifecycle table is contracted for this tenant; nested operational activation timestamps remain the available source.',
    });
  }

  sources.push({
    key: 'diallerRealtime',
    label: 'VICIdial real-time / hopper API',
    status: 'UNCONFIGURED',
    table: null,
    latestRecordAt: null,
    ageHours: null,
    rowCount: null,
    detail: 'Required for live agent states, hopper priority/levels, dial level, drop rate and hopper-reset events. Historical BigQuery call rows do not provide this live control-plane state.',
  });

  sources.push({
    key: 'activationLifecycle',
    label: 'BLC Rubix / activation lifecycle contract',
    status: 'CONTRACT_REQUIRED',
    table: clientConfig.semanticMappings.tables.activations || null,
    latestRecordAt: null,
    ageHours: null,
    rowCount: null,
    detail: 'Contract ID, Rubix status, activation status, activation timestamp and deal/color need a reconciled record-level source contract before CX3 treats lifecycle stages as canonical.',
  });

  return {
    status: 'OBSERVED',
    generatedAt: new Date().toISOString(),
    sources,
  };
}

// 9. DATA INTEGRITY (DATA HEALTH)
export async function getDataIntegrityAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const { whereSql, queryParams } = buildFilterClause(params);

  const query = `
    SELECT
      COUNT(DISTINCT l.lead_id) AS total_leads,
      COUNTIF(l.fetched LIKE '1900%' OR l.fetched LIKE '1970%' OR l.fetched IS NULL) AS sentinel_fetch_dates,
      COUNTIF(l.standardised_idno IS NULL OR l.valid_idno = '0' OR l.valid_idno = 'false') AS invalid_id_numbers,
      COUNTIF(l.standardised_mobile IS NULL OR l.phone_valid = '0' OR l.phone_valid = 'false') AS invalid_mobile_numbers,
      COUNTIF(hlc.vendor IS NULL OR hlc.vendor = '') AS unassigned_vendor_leads,
      COUNTIF(hlc.delivered IS NOT NULL AND (hlc.last_dialer_status IS NULL OR hlc.last_dialer_status = '')) AS missing_dispositions,
      COUNTIF(l.consumer_id IS NULL OR l.consumer_id = 0) AS unmatched_consumer_ids
    FROM ${configuredSourceTable(params.clientId, 'leads')} l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    ${whereSql}
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const d = rows[0] || {};
  const total = Number(d.total_leads || 0);

  const observedCheck = (checkName: string, category: string, discrepancyCount: number, detail: string) => ({
    checkName,
    category,
    status: discrepancyCount === 0 ? 'HEALTHY' as const : 'WARNING' as const,
    evidence: 'OBSERVED',
    discrepancyCount,
    detail
  });

  const invalidValidation = Number(d.invalid_id_numbers || 0) + Number(d.invalid_mobile_numbers || 0);
  const checks = [
    observedCheck(
      'Missing Dispositions',
      'Dialler Telephony',
      Number(d.missing_dispositions || 0),
      `${Number(d.missing_dispositions || 0).toLocaleString()} delivered records have no recorded dialler disposition.`
    ),
    observedCheck(
      'Unmatched Consumer IDs',
      'Data Lineage',
      Number(d.unmatched_consumer_ids || 0),
      `${Number(d.unmatched_consumer_ids || 0).toLocaleString()} lead records have no usable consumer identifier.`
    ),
    observedCheck(
      'Missing / Sentinel Capture Timestamps',
      'Temporal Integrity',
      Number(d.sentinel_fetch_dates || 0),
      `${Number(d.sentinel_fetch_dates || 0).toLocaleString()} records have missing, 1900, or 1970 capture timestamps.`
    ),
    observedCheck(
      'Unassigned Vendor Records',
      'Routing',
      Number(d.unassigned_vendor_leads || 0),
      `${Number(d.unassigned_vendor_leads || 0).toLocaleString()} expanded HLC records have no vendor value.`
    ),
    observedCheck(
      'ID / Mobile Validation Gaps',
      'Lead Vetting',
      invalidValidation,
      total > 0
        ? `${invalidValidation.toLocaleString()} validation gaps observed across ${total.toLocaleString()} distinct leads.`
        : 'No lead records were available in the selected scope.'
    )
  ];

  const sourceObservability = await getSourceObservability({ clientId: params.clientId });

  return {
    overallHealthScore: null,
    healthGrade: 'NOT_VERIFIED',
    validationStatus: 'NOT_VERIFIED',
    reason: 'Observed discrepancy counts are shown without an invented enterprise health score. Thresholds require approved data-quality contracts.',
    checks,
    totalRecordsAudited: total,
    sources: sourceObservability.sources
  };
}

// 10. AGENT PERFORMANCE
export async function getAgentPerformanceAnalytics(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const clientConfig = getClientConfig(params.clientId);

  if (params.source || params.medium || params.grade || params.campaign) {
    throw new RequestError('Agent performance supports date, tenant and vendor scope only until cross-source call joins are validated.', 422);
  }

  const conditions = ["user IS NOT NULL AND user != ''"];
  const queryParams: Record<string, any> = {};

  if (params.startDate) {
    conditions.push('DATE(SAFE_CAST(call_start_date AS TIMESTAMP)) >= @startDate');
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push('DATE(SAFE_CAST(call_start_date AS TIMESTAMP)) <= @endDate');
    queryParams.endDate = params.endDate;
  }

  if (clientConfig.id !== 'default_tenant') {
    const tenantVendors = clientConfig.semanticMappings.partners || [];
    if (!tenantVendors.length) throw new RequestError('No approved call-vendor mapping exists for this tenant', 422);
    conditions.push('LOWER(vendor) IN UNNEST(@tenantVendors)');
    queryParams.tenantVendors = tenantVendors.map(value => value.toLowerCase());
  }

  const cleanVendor = params.vendor && !['all', 'all vendors', 'undefined', 'null'].includes(params.vendor.trim().toLowerCase())
    ? params.vendor.trim()
    : undefined;
  if (cleanVendor) {
    conditions.push('LOWER(vendor) = LOWER(@vendor)');
    queryParams.vendor = cleanVendor;
  }

  const query = `
    SELECT
      user AS agent_id,
      vendor,
      COUNT(*) AS total_calls,
      COUNT(DISTINCT dialer_lead_id) AS unique_leads,
      COUNTIF(is_rpc = true) AS rpc_count,
      COUNTIF(is_sale = true) AS sale_count,
      SUM(length_in_sec) AS total_talk_time_sec,
      ROUND(AVG(length_in_sec), 1) AS avg_duration_sec,
      COUNTIF(is_callback = true) AS callbacks_booked
    FROM ${configuredSourceTable(params.clientId, 'calls')}
    WHERE ${conditions.join(' AND ')}
    GROUP BY user, vendor
    ORDER BY total_calls DESC
    LIMIT 100
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const agents = rows.map((r: any) => {
    const calls = Number(r.total_calls || 0);
    const uniqueLeads = Number(r.unique_leads || 0);
    const rpcs = Number(r.rpc_count || 0);
    const sales = Number(r.sale_count || 0);
    const talkSec = Number(r.total_talk_time_sec || 0);

    return {
      agentId: r.agent_id,
      vendor: r.vendor,
      totalCalls: calls,
      uniqueLeads,
      contactCount: rpcs,
      contactRate: calls > 0 ? Number(((rpcs / calls) * 100).toFixed(1)) : 0,
      salesCount: sales,
      saleRate: rpcs > 0 ? Number(((sales / rpcs) * 100).toFixed(2)) : 0,
      totalTalkTime: formatDuration(talkSec),
      avgHandleTime: `${Math.round(Number(r.avg_duration_sec || 0))}s`,
      callbacksBooked: Number(r.callbacks_booked || 0),
      performanceTier: null
    };
  });

  return {
    agents,
    rankingStatus: 'UNAVAILABLE',
    rankingReason: 'Performance tiers are withheld until an approved agent-performance scoring contract exists.'
  };
}

// 11. CLIENT & CAMPAIGN ANALYSIS
export async function getClientCampaignAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const contract = clientConfig.marketing;

  if (!contract || !clientConfig.capabilities.marketing) {
    return {
      campaigns: [],
      summary: null,
      comparison: null,
      status: 'UNAVAILABLE',
      reason: 'No approved marketing API-table contract is configured for this tenant.',
      mappingStatus: 'UNAVAILABLE',
      grainStatus: 'UNAVAILABLE',
      spendSource: { status: 'UNAVAILABLE', column: null, table: contract?.table || null, reason: 'No approved marketing contract is configured.' },
      budgetSource: { status: 'UNAVAILABLE', column: null, table: contract?.table || null },
      attribution: { status: 'UNCONFIGURED', reason: 'No marketing attribution contract is configured.' },
    };
  }

  if (params.vendor || params.source || params.medium || params.grade || params.agent) {
    throw new RequestError('Campaign reporting supports date and campaign scope until cross-source attribution is explicitly configured.', 422);
  }

  if (contract.mappingStatus === 'UNRESOLVED' || (contract.mappingStatus === 'MAPPED' && !contract.clientNames.length)) {
    return {
      campaigns: [],
      summary: null,
      comparison: null,
      status: 'UNAVAILABLE',
      reason: 'Marketing API-table mapping is unresolved for this tenant. An administrator must approve the tenant client_name values before spend is enabled.',
      mappingStatus: contract.mappingStatus,
      grainStatus: 'NOT_RUN',
      spendSource: { status: 'UNAVAILABLE', column: null, table: contract.table, reason: 'Tenant client_name mapping is unresolved.' },
      budgetSource: { status: 'UNAVAILABLE', column: null, table: contract.table },
      attribution: { status: contract.attribution.status, reason: contract.attribution.notes || null },
    };
  }

  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const resolved = await resolveMarketingContract(client, contract);
  if (resolved.missingRequired.length) {
    return {
      campaigns: [],
      summary: null,
      comparison: null,
      status: 'INVALID_CONTRACT',
      reason: `Configured marketing API-table fields are missing: ${resolved.missingRequired.join(', ')}`,
      mappingStatus: contract.mappingStatus,
      grainStatus: 'NOT_RUN',
      spendSource: { status: 'UNAVAILABLE', column: null, table: contract.table, reason: 'Marketing contract validation failed.' },
      budgetSource: { status: 'UNAVAILABLE', column: null, table: contract.table },
      attribution: { status: contract.attribution.status, reason: contract.attribution.notes || null },
    };
  }

  const tenantFilter = marketingTenantFilter(contract);
  const clientField = safeWarehouseColumn(contract.clientNameField);
  const dateField = safeWarehouseColumn(contract.dateField);
  const channelField = safeWarehouseColumn(contract.channelField);
  const campaignField = safeWarehouseColumn(contract.campaignField);
  const adsetField = safeWarehouseColumn(contract.adsetField);
  const impressionsField = safeWarehouseColumn(contract.impressionsField);
  const reachField = resolved.reachColumn ? safeWarehouseColumn(resolved.reachColumn) : null;
  const clicksField = safeWarehouseColumn(contract.clicksField);
  const outboundClicksField = resolved.outboundClicksColumn ? safeWarehouseColumn(resolved.outboundClicksColumn) : null;
  const leadsField = safeWarehouseColumn(contract.leadsField);
  const spendValue = marketingSpendExpression(contract, resolved.spendColumn);
  const budgetValue = resolved.budgetColumn
    ? `SAFE_CAST(REGEXP_REPLACE(CAST(${safeWarehouseColumn(resolved.budgetColumn)} AS STRING), r'[^0-9.-]', '') AS FLOAT64)`
    : null;

  const conditions = [`${clientField} IS NOT NULL`];
  const queryParams: Record<string, any> = { ...tenantFilter.params };
  if (tenantFilter.sql) conditions.push(tenantFilter.sql);
  if (params.startDate) {
    conditions.push(`DATE(${dateField}) >= @startDate`);
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push(`DATE(${dateField}) <= @endDate`);
    queryParams.endDate = params.endDate;
  }
  if (params.campaign) {
    conditions.push(`LOWER(CAST(${campaignField} AS STRING)) = LOWER(@campaign)`);
    queryParams.campaign = params.campaign;
  }

  const grainFields = contract.spendGrainFields.map(safeWarehouseColumn);
  const grainExpression = `TO_JSON_STRING(STRUCT(${grainFields.join(', ')}))`;
  const grainQuery = `
    SELECT
      COUNT(*) AS row_count,
      COUNT(DISTINCT ${grainExpression}) AS distinct_grain_count,
      COUNT(*) - COUNT(DISTINCT ${grainExpression}) AS duplicate_grain_rows
    FROM \`${contract.table}\`
    WHERE ${conditions.join(' AND ')}
  `;
  const [grainRows] = await client.query({ query: grainQuery, params: queryParams });
  const grain = grainRows[0] || {};
  const duplicateGrainRows = Number(grain.duplicate_grain_rows || 0);
  const grainStatus = duplicateGrainRows > 0 ? 'DUPLICATE_GRAIN' : 'VALID';

  const query = `
    SELECT
      CAST(${clientField} AS STRING) AS client_name,
      CAST(${channelField} AS STRING) AS channel,
      CAST(${campaignField} AS STRING) AS campaign_name,
      CAST(${adsetField} AS STRING) AS adset_name,
      SUM(SAFE_CAST(${impressionsField} AS FLOAT64)) AS impressions,
      ${reachField ? `SUM(SAFE_CAST(${reachField} AS FLOAT64))` : 'CAST(NULL AS FLOAT64)'} AS reach,
      SUM(SAFE_CAST(${clicksField} AS FLOAT64)) AS clicks,
      ${outboundClicksField ? `SUM(SAFE_CAST(${outboundClicksField} AS FLOAT64))` : 'CAST(NULL AS FLOAT64)'} AS outbound_clicks,
      SUM(SAFE_CAST(${leadsField} AS FLOAT64)) AS recorded_leads,
      ${spendValue && grainStatus === 'VALID' ? `SUM(${spendValue})` : 'CAST(NULL AS FLOAT64)'} AS recorded_spend,
      ${budgetValue ? `ARRAY_AGG(${budgetValue} IGNORE NULLS ORDER BY ${dateField} DESC LIMIT 1)[SAFE_OFFSET(0)]` : 'CAST(NULL AS FLOAT64)'} AS latest_budget
    FROM \`${contract.table}\`
    WHERE ${conditions.join(' AND ')}
    GROUP BY 1, 2, 3, 4
    ORDER BY recorded_leads DESC
    LIMIT 250
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const hasSpend = Boolean(resolved.spendColumn && grainStatus === 'VALID');

  const campaigns = rows.map((row: any) => {
    const impressions = Number(row.impressions || 0);
    const reach = row.reach === null || row.reach === undefined ? null : Number(row.reach || 0);
    const clicks = Number(row.clicks || 0);
    const outboundClicks = row.outbound_clicks === null || row.outbound_clicks === undefined ? null : Number(row.outbound_clicks || 0);
    const leads = Number(row.recorded_leads || 0);
    const spend = hasSpend && row.recorded_spend !== null ? Number(row.recorded_spend || 0) : null;
    const latestBudget = resolved.budgetColumn && row.latest_budget !== null ? Number(row.latest_budget || 0) : null;

    return {
      client: row.client_name,
      channel: row.channel || 'Unknown',
      campaign: row.campaign_name || 'Unknown',
      adset: row.adset_name || 'Unknown',
      spend,
      latestBudget,
      impressions,
      reach,
      frequency: reach !== null && reach > 0 ? Number((impressions / reach).toFixed(2)) : null,
      clicks,
      outboundClicks,
      ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
      outboundCtr: outboundClicks !== null && impressions > 0 ? Number(((outboundClicks / impressions) * 100).toFixed(2)) : null,
      clickToLeadRate: outboundClicks !== null && outboundClicks > 0 ? Number(((leads / outboundClicks) * 100).toFixed(2)) : clicks > 0 ? Number(((leads / clicks) * 100).toFixed(2)) : null,
      leads,
      cpc: spend !== null && clicks > 0 ? Number((spend / clicks).toFixed(2)) : null,
      cpm: spend !== null && impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : null,
      cpl: spend !== null && leads > 0 ? Number((spend / leads).toFixed(2)) : null,
    };
  });

  const totals = campaigns.reduce((acc, row) => {
    acc.impressions += row.impressions;
    if (row.reach !== null) acc.reach += row.reach;
    acc.clicks += row.clicks;
    if (row.outboundClicks !== null) acc.outboundClicks += row.outboundClicks;
    acc.leads += row.leads;
    if (row.spend !== null) acc.spend += row.spend;
    return acc;
  }, { spend: 0, impressions: 0, reach: 0, clicks: 0, outboundClicks: 0, leads: 0 });

  const summary = {
    spend: hasSpend ? Number(totals.spend.toFixed(2)) : null,
    impressions: totals.impressions,
    reach: resolved.reachColumn ? totals.reach : null,
    frequency: resolved.reachColumn && totals.reach > 0 ? Number((totals.impressions / totals.reach).toFixed(2)) : null,
    clicks: totals.clicks,
    outboundClicks: resolved.outboundClicksColumn ? totals.outboundClicks : null,
    leads: totals.leads,
    ctr: totals.impressions > 0 ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0,
    outboundCtr: resolved.outboundClicksColumn && totals.impressions > 0 ? Number(((totals.outboundClicks / totals.impressions) * 100).toFixed(2)) : null,
    clickToLeadRate: resolved.outboundClicksColumn && totals.outboundClicks > 0
      ? Number(((totals.leads / totals.outboundClicks) * 100).toFixed(2))
      : totals.clicks > 0 ? Number(((totals.leads / totals.clicks) * 100).toFixed(2)) : null,
    cpc: hasSpend && totals.clicks > 0 ? Number((totals.spend / totals.clicks).toFixed(2)) : null,
    cpm: hasSpend && totals.impressions > 0 ? Number(((totals.spend / totals.impressions) * 1000).toFixed(2)) : null,
    cpl: hasSpend && totals.leads > 0 ? Number((totals.spend / totals.leads).toFixed(2)) : null,
  };

  let comparison: null | {
    spendDeltaPct: number | null;
    cpcDeltaPct: number | null;
    cpmDeltaPct: number | null;
    cplDeltaPct: number | null;
    ctrDeltaPp: number | null;
    leadsDeltaPct: number | null;
    previousStartDate: string;
    previousEndDate: string;
  } = null;
  let comparisonReason: string | null = null;

  if (params.startDate && params.endDate) {
    const startMs = Date.parse(params.startDate + 'T00:00:00Z');
    const endMs = Date.parse(params.endDate + 'T00:00:00Z');
    const days = Math.floor((endMs - startMs) / 86400000) + 1;

    if (days > 0 && days <= 366) {
      const previousEnd = new Date(startMs - 86400000);
      const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
      const previousStartDate = previousStart.toISOString().slice(0, 10);
      const previousEndDate = previousEnd.toISOString().slice(0, 10);
      const priorConditions = [`${clientField} IS NOT NULL`];
      const priorParams: Record<string, any> = {
        ...tenantFilter.params,
        previousStartDate,
        previousEndDate,
      };
      if (tenantFilter.sql) priorConditions.push(tenantFilter.sql);
      priorConditions.push(`DATE(${dateField}) >= @previousStartDate`, `DATE(${dateField}) <= @previousEndDate`);
      if (params.campaign) {
        priorConditions.push(`LOWER(CAST(${campaignField} AS STRING)) = LOWER(@campaign)`);
        priorParams.campaign = params.campaign;
      }

      const priorGrain = await validateMarketingSpendGrain(client, contract, priorConditions, priorParams);
      if (priorGrain.status !== 'VALID') {
        comparisonReason = `Matched-period comparison withheld because the prior period contains ${priorGrain.duplicateGrainRows.toLocaleString()} duplicate rows at the approved spend grain.`;
      } else {
        const priorQuery = `
          SELECT
            SUM(SAFE_CAST(${impressionsField} AS FLOAT64)) AS impressions,
            SUM(SAFE_CAST(${clicksField} AS FLOAT64)) AS clicks,
            SUM(SAFE_CAST(${leadsField} AS FLOAT64)) AS recorded_leads,
            ${spendValue && grainStatus === 'VALID' ? `SUM(${spendValue})` : 'CAST(NULL AS FLOAT64)'} AS recorded_spend
          FROM \`${contract.table}\`
          WHERE ${priorConditions.join(' AND ')}
        `;

        const [priorRows] = await client.query({ query: priorQuery, params: priorParams });
        const prior = priorRows[0] || {};
        const priorSpend = hasSpend && prior.recorded_spend !== null ? Number(prior.recorded_spend || 0) : null;
        const priorImpressions = Number(prior.impressions || 0);
        const priorClicks = Number(prior.clicks || 0);
        const priorLeads = Number(prior.recorded_leads || 0);
        const priorCtr = priorImpressions > 0 ? (priorClicks / priorImpressions) * 100 : 0;
        const priorCpc = priorSpend !== null && priorClicks > 0 ? priorSpend / priorClicks : null;
        const priorCpm = priorSpend !== null && priorImpressions > 0 ? (priorSpend / priorImpressions) * 1000 : null;
        const priorCpl = priorSpend !== null && priorLeads > 0 ? priorSpend / priorLeads : null;
        const pct = (current: number | null, previous: number | null) =>
          current !== null && previous !== null && previous !== 0
            ? Number((((current - previous) / previous) * 100).toFixed(1))
            : null;

        comparison = {
          spendDeltaPct: pct(summary.spend, priorSpend),
          cpcDeltaPct: pct(summary.cpc, priorCpc),
          cpmDeltaPct: pct(summary.cpm, priorCpm),
          cplDeltaPct: pct(summary.cpl, priorCpl),
          ctrDeltaPp: Number((summary.ctr - priorCtr).toFixed(2)),
          leadsDeltaPct: pct(summary.leads, priorLeads),
          previousStartDate,
          previousEndDate,
        };
      }
    }
  }

  const reason = grainStatus !== 'VALID'
    ? `Spend is withheld because the API table violates the configured spend grain with ${duplicateGrainRows.toLocaleString()} duplicate rows.`
    : hasSpend
      ? `Recorded media spend is sourced from the approved API-table field ${resolved.spendColumn}. CPC, CPM and CPL are derived from the same spend population.`
      : 'No approved spend field from the tenant marketing contract exists in the current API-table schema. Budget remains a separate planning value.';

  return {
    campaigns,
    summary,
    comparison,
    comparisonReason,
    status: grainStatus !== 'VALID' ? 'INVALID_GRAIN' : hasSpend ? 'OBSERVED' : 'PARTIAL',
    reason,
    mappingStatus: contract.mappingStatus,
    grainStatus,
    grainDiagnostics: {
      rowCount: Number(grain.row_count || 0),
      distinctGrainCount: Number(grain.distinct_grain_count || 0),
      duplicateGrainRows,
      fields: contract.spendGrainFields,
    },
    spendSource: {
      status: hasSpend ? 'OBSERVED' : 'UNAVAILABLE',
      column: resolved.spendColumn,
      table: contract.table,
      reason: hasSpend ? null : reason,
    },
    budgetSource: {
      status: resolved.budgetColumn ? 'OBSERVED_PLANNING_FIELD' : 'UNAVAILABLE',
      column: resolved.budgetColumn,
      table: contract.table,
    },
    attribution: {
      status: contract.attribution.status,
      reason: contract.attribution.notes || (
        contract.attribution.status === 'ACTIVE'
          ? 'Marketing-to-lead attribution contract is active.'
          : 'Cross-source attribution has not been configured.'
      ),
    },
  };
}

export async function getMarketingRootCauseAnalysis(params: OffernetQueryParams) {
  const allowedMetrics = new Set(['spend', 'cpc', 'cpm', 'cpl', 'ctr', 'leads']);
  const metric = params.metric || 'cpl';
  if (!allowedMetrics.has(metric)) throw new RequestError('Unsupported marketing root-cause metric', 422);
  if (!params.startDate || !params.endDate) {
    throw new RequestError('Marketing root-cause analysis requires an explicit startDate and endDate', 422);
  }

  const clientConfig = getClientConfig(params.clientId);
  const contract = clientConfig.marketing;
  if (!contract || !clientConfig.capabilities.marketing) {
    return { status: 'UNAVAILABLE', reason: 'No approved marketing contract exists for this tenant.', metric: null, dimensions: [], drivers: [] };
  }
  if (contract.mappingStatus === 'UNRESOLVED' || (contract.mappingStatus === 'MAPPED' && !contract.clientNames.length)) {
    return { status: 'UNAVAILABLE', reason: 'Marketing client mapping is unresolved for this tenant.', metric: null, dimensions: [], drivers: [] };
  }

  const currentCampaign = await getClientCampaignAnalytics(params);
  if (!currentCampaign.summary) {
    return { status: currentCampaign.status, reason: currentCampaign.reason, metric: null, dimensions: [], drivers: [] };
  }
  if (['spend', 'cpc', 'cpm', 'cpl'].includes(metric) && currentCampaign.summary.spend === null) {
    return { status: 'UNAVAILABLE', reason: currentCampaign.reason, metric: null, dimensions: [], drivers: [] };
  }

  const startMs = Date.parse(params.startDate + 'T00:00:00Z');
  const endMs = Date.parse(params.endDate + 'T00:00:00Z');
  const days = Math.floor((endMs - startMs) / 86400000) + 1;
  if (!Number.isFinite(days) || days <= 0 || days > 366) throw new RequestError('Marketing root-cause date range must be between 1 and 366 days', 422);

  const previousEnd = new Date(startMs - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  const previousStartDate = previousStart.toISOString().slice(0, 10);
  const previousEndDate = previousEnd.toISOString().slice(0, 10);

  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const resolved = await resolveMarketingContract(client, contract);
  const tenantFilter = marketingTenantFilter(contract);
  const dateField = safeWarehouseColumn(contract.dateField);
  const channelField = safeWarehouseColumn(contract.channelField);
  const campaignField = safeWarehouseColumn(contract.campaignField);
  const adsetField = safeWarehouseColumn(contract.adsetField);
  const impressionsField = safeWarehouseColumn(contract.impressionsField);
  const clicksField = safeWarehouseColumn(contract.clicksField);
  const leadsField = safeWarehouseColumn(contract.leadsField);
  const spendValue = marketingSpendExpression(contract, resolved.spendColumn);
  const queryParams: Record<string, any> = {
    ...tenantFilter.params,
    currentStartDate: params.startDate,
    currentEndDate: params.endDate,
    previousStartDate,
    previousEndDate,
  };
  const conditions = [
    `DATE(${dateField}) BETWEEN @previousStartDate AND @currentEndDate`,
    ...(tenantFilter.sql ? [tenantFilter.sql] : []),
  ];
  if (params.campaign) {
    conditions.push(`LOWER(CAST(${campaignField} AS STRING)) = LOWER(@campaign)`);
    queryParams.campaign = params.campaign;
  }

  const query = `
    WITH base AS (
      SELECT
        DATE(${dateField}) AS report_date,
        COALESCE(CAST(${channelField} AS STRING), 'Unknown') AS channel,
        COALESCE(CAST(${campaignField} AS STRING), 'Unknown') AS campaign,
        COALESCE(CAST(${adsetField} AS STRING), 'Unknown') AS adset,
        SAFE_CAST(${impressionsField} AS FLOAT64) AS impressions,
        SAFE_CAST(${clicksField} AS FLOAT64) AS clicks,
        SAFE_CAST(${leadsField} AS FLOAT64) AS leads,
        ${spendValue ? spendValue : 'CAST(NULL AS FLOAT64)'} AS spend
      FROM \`${contract.table}\`
      WHERE ${conditions.join(' AND ')}
    ),
    periodized AS (
      SELECT
        *,
        CASE
          WHEN report_date BETWEEN @currentStartDate AND @currentEndDate THEN 'current'
          WHEN report_date BETWEEN @previousStartDate AND @previousEndDate THEN 'previous'
          ELSE NULL
        END AS period
      FROM base
    ),
    dimensional AS (
      SELECT period, 'channel' AS dimension, channel AS segment,
        SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(leads) AS leads
      FROM periodized WHERE period IS NOT NULL GROUP BY period, channel
      UNION ALL
      SELECT period, 'campaign', campaign,
        SUM(spend), SUM(impressions), SUM(clicks), SUM(leads)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, campaign
      UNION ALL
      SELECT period, 'adset', adset,
        SUM(spend), SUM(impressions), SUM(clicks), SUM(leads)
      FROM periodized WHERE period IS NOT NULL GROUP BY period, adset
      UNION ALL
      SELECT period, 'overall', 'All',
        SUM(spend), SUM(impressions), SUM(clicks), SUM(leads)
      FROM periodized WHERE period IS NOT NULL GROUP BY period
    )
    SELECT * FROM dimensional
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const value = (row: any) => {
    const spend = row?.spend === null || row?.spend === undefined ? null : Number(row.spend || 0);
    const impressions = Number(row?.impressions || 0);
    const clicks = Number(row?.clicks || 0);
    const leads = Number(row?.leads || 0);
    switch (metric) {
      case 'spend': return spend;
      case 'cpc': return spend !== null && clicks > 0 ? Number((spend / clicks).toFixed(2)) : null;
      case 'cpm': return spend !== null && impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : null;
      case 'cpl': return spend !== null && leads > 0 ? Number((spend / leads).toFixed(2)) : null;
      case 'ctr': return impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
      default: return leads;
    }
  };

  const currentOverall = rows.find((row: any) => row.dimension === 'overall' && row.period === 'current') || {};
  const previousOverall = rows.find((row: any) => row.dimension === 'overall' && row.period === 'previous') || {};
  const currentValue = value(currentOverall);
  const previousValue = value(previousOverall);
  const delta = currentValue !== null && previousValue !== null
    ? Number((currentValue - previousValue).toFixed(2))
    : null;

  const labels: Record<string, string> = {
    spend: 'Media spend',
    cpc: 'CPC',
    cpm: 'CPM',
    cpl: 'CPL',
    ctr: 'CTR',
    leads: 'Recorded leads',
  };
  const units: Record<string, string> = {
    spend: 'currency',
    cpc: 'currency',
    cpm: 'currency',
    cpl: 'currency',
    ctr: 'pp',
    leads: 'leads',
  };

  const dimensionLabels: Record<string, string> = {
    channel: 'Channel',
    campaign: 'Campaign',
    adset: 'Adset',
  };

  const dimensions = ['channel', 'campaign', 'adset'].map(dimension => {
    const current = new Map(rows.filter((row: any) => row.dimension === dimension && row.period === 'current').map((row: any) => [String(row.segment), row]));
    const previous = new Map(rows.filter((row: any) => row.dimension === dimension && row.period === 'previous').map((row: any) => [String(row.segment), row]));
    const names = Array.from(new Set([...current.keys(), ...previous.keys()]));
    const segments = names.map(name => {
      const currentMetric = value(current.get(name) || {});
      const previousMetric = value(previous.get(name) || {});
      return {
        name,
        currentValue: currentMetric,
        previousValue: previousMetric,
        delta: currentMetric !== null && previousMetric !== null ? Number((currentMetric - previousMetric).toFixed(2)) : null,
      };
    }).sort((a, b) => Math.abs(Number(b.delta || 0)) - Math.abs(Number(a.delta || 0)));

    return { key: dimension, label: dimensionLabels[dimension], segments: segments.slice(0, 15) };
  });

  const drivers = dimensions
    .flatMap(dimension => dimension.segments.slice(0, 5).map(segment => ({ ...segment, dimension: dimension.key, dimensionLabel: dimension.label })))
    .filter(driver => driver.delta !== null)
    .sort((a, b) => Math.abs(Number(b.delta || 0)) - Math.abs(Number(a.delta || 0)))
    .slice(0, 10);

  return {
    status: 'OBSERVED',
    metric: {
      id: metric,
      label: labels[metric],
      unit: units[metric],
      currentValue,
      previousValue,
      delta,
    },
    currentWindow: { startDate: params.startDate, endDate: params.endDate },
    previousWindow: { startDate: previousStartDate, endDate: previousEndDate },
    dimensions,
    drivers,
    methodology: 'Media drivers compare observed segment metrics between equal-length periods. Segment deltas are diagnostic changes, not additive causal contribution scores.',
    validationStatus: 'NOT_VERIFIED',
  };
}

export async function getMarketingAttributionAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const contract = clientConfig.marketing;
  if (!contract || !clientConfig.capabilities.marketing) {
    return { status: 'UNAVAILABLE', reason: 'No marketing contract is configured.', rows: [], summary: null };
  }
  const incompatibleScope = ['vendor', 'source', 'medium', 'grade', 'agent', 'campaign']
    .filter(key => Boolean((params as Record<string, unknown>)[key]));
  if (incompatibleScope.length) {
    return {
      status: 'UNAVAILABLE',
      reason: `Attribution is withheld because the active reporting scope includes operational dimensions that are not reconciled to the marketing source: ${incompatibleScope.join(', ')}.`,
      rows: [],
      contract: contract.attribution,
    };
  }

  if (contract.attribution.status !== 'ACTIVE') {
    return {
      status: 'UNAVAILABLE',
      reason: contract.attribution.notes || 'Marketing-to-lead attribution is not configured.',
      rows: [],
      summary: null,
      contract: contract.attribution,
    };
  }

  const unsupportedScope = [
    ['vendor', params.vendor],
    ['medium', params.medium],
    ['grade', params.grade],
    ['agent', params.agent],
    ['campaign', params.campaign],
  ].filter(([, value]) => Boolean(value)).map(([key]) => key);
  if (unsupportedScope.length) {
    return {
      status: 'UNAVAILABLE',
      reason: `Attribution is withheld because the selected ${unsupportedScope.join(', ')} filter(s) do not have an approved equivalent marketing-side mapping.`,
      rows: [],
      summary: null,
      contract: contract.attribution,
    };
  }

  const marketingSourceField = contract.attribution.marketingSourceField;
  const leadSourceField = contract.attribution.leadSourceField;
  if (!marketingSourceField || !leadSourceField) {
    return { status: 'INVALID_CONTRACT', reason: 'Active attribution requires both marketingSourceField and leadSourceField.', rows: [], summary: null };
  }

  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const resolved = await resolveMarketingContract(client, contract);
  if (resolved.missingRequired.length) {
    return {
      status: 'INVALID_CONTRACT',
      reason: `Configured marketing fields are missing: ${resolved.missingRequired.join(', ')}`,
      rows: [],
      contract: contract.attribution,
    };
  }
  const spendValue = marketingSpendExpression(contract, resolved.spendColumn);
  if (!spendValue) {
    return { status: 'UNAVAILABLE', reason: 'Attribution requires an approved observed spend field.', rows: [], summary: null };
  }

  const tenantFilter = marketingTenantFilter(contract);
  const marketingDate = safeWarehouseColumn(contract.dateField);
  const marketingSource = safeWarehouseColumn(marketingSourceField);
  const leadSource = safeAliasedColumn('l', leadSourceField);
  const conditions = [...(tenantFilter.sql ? [tenantFilter.sql] : [])];
  const queryParams: Record<string, any> = { ...tenantFilter.params };

  if (params.startDate) {
    conditions.push(`DATE(${marketingDate}) >= @startDate`);
    queryParams.startDate = params.startDate;
  }
  if (params.endDate) {
    conditions.push(`DATE(${marketingDate}) <= @endDate`);
    queryParams.endDate = params.endDate;
  }
  if (params.source) {
    conditions.push(`LOWER(TRIM(CAST(${marketingSource} AS STRING))) = LOWER(@attributionSource)`);
    queryParams.attributionSource = params.source;
  }

  const marketingConditions = conditions.length ? conditions : ['TRUE'];
  const grain = await validateMarketingSpendGrain(client, contract, marketingConditions, queryParams);
  if (grain.status !== 'VALID') {
    return {
      status: 'INVALID_GRAIN',
      reason: `Attribution is withheld because the selected marketing population contains ${grain.duplicateGrainRows.toLocaleString()} duplicate rows at the approved spend grain.`,
      rows: [],
      summary: null,
      contract: contract.attribution,
      grain,
    };
  }

  const operationalScope = buildFilterClause({
    ...params,
    source: undefined,
    vendor: undefined,
    medium: undefined,
    grade: undefined,
    agent: undefined,
    campaign: undefined,
  });
  const operationalWhere = params.source
    ? `${operationalScope.whereSql} AND LOWER(TRIM(CAST(${leadSource} AS STRING))) = LOWER(@attributionSource)`
    : operationalScope.whereSql;

  const query = `
    WITH marketing AS (
      SELECT
        LOWER(TRIM(CAST(${marketingSource} AS STRING))) AS join_key,
        SUM(${spendValue}) AS spend,
        SUM(SAFE_CAST(${safeWarehouseColumn(contract.leadsField)} AS FLOAT64)) AS platform_leads
      FROM \`${contract.table}\`
      WHERE ${marketingConditions.join(' AND ')}
      GROUP BY join_key
    ),
    operations AS (
      SELECT
        LOWER(TRIM(CAST(${leadSource} AS STRING))) AS join_key,
        COUNT(DISTINCT l.lead_id) AS fetched,
        COUNT(DISTINCT CASE WHEN hlc.delivered IS NOT NULL AND hlc.delivered NOT LIKE '1900%' AND hlc.delivered NOT LIKE '1970%' THEN l.lead_id END) AS delivered,
        COUNT(DISTINCT CASE WHEN hlc.first_call_date IS NOT NULL AND hlc.first_call_date NOT LIKE '1900%' AND hlc.first_call_date NOT LIKE '1970%' THEN l.lead_id END) AS dialled,
        COUNT(DISTINCT CASE WHEN SAFE_CAST(hlc.rpc AS INT64) > 0 THEN l.lead_id END) AS rpc,
        COUNT(DISTINCT CASE WHEN hlc.sale IS NOT NULL AND hlc.sale != '' AND hlc.sale NOT LIKE '1900%' AND hlc.sale NOT LIKE '1970%' THEN l.lead_id END) AS sales,
        COUNT(DISTINCT CASE WHEN hlc.activated IS NOT NULL AND hlc.activated != '' AND hlc.activated NOT LIKE '1900%' AND hlc.activated NOT LIKE '1970%' THEN l.lead_id END) AS activations,
        SUM(COALESCE(hlc.revenue_generated, 0)) AS recorded_revenue
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      LEFT JOIN UNNEST(l.hlc_details) hlc
      ${operationalWhere}
      GROUP BY join_key
    )
    SELECT
      COALESCE(marketing.join_key, operations.join_key) AS join_key,
      marketing.join_key IS NOT NULL AS has_marketing,
      operations.join_key IS NOT NULL AS has_operations,
      marketing.spend,
      marketing.platform_leads,
      operations.fetched,
      operations.delivered,
      operations.dialled,
      operations.rpc,
      operations.sales,
      operations.activations,
      operations.recorded_revenue
    FROM marketing
    FULL OUTER JOIN operations USING (join_key)
    ORDER BY COALESCE(marketing.spend, 0) DESC
    LIMIT 250
  `;

  const [rows] = await client.query({
    query,
    params: { ...queryParams, ...operationalScope.queryParams },
  });

  const mappedRows = rows.map((row: any) => {
    const spend = row.spend === null || row.spend === undefined ? null : Number(row.spend || 0);
    const fetched = Number(row.fetched || 0);
    const sales = Number(row.sales || 0);
    const activations = Number(row.activations || 0);
    return {
      key: row.join_key || 'Unmatched',
      hasMarketing: Boolean(row.has_marketing),
      hasOperations: Boolean(row.has_operations),
      spend,
      platformLeads: Number(row.platform_leads || 0),
      fetched,
      delivered: Number(row.delivered || 0),
      dialled: Number(row.dialled || 0),
      rpc: Number(row.rpc || 0),
      sales,
      activations,
      recordedRevenue: Number(row.recorded_revenue || 0),
      spendPerFetchedLead: spend !== null && fetched > 0 ? Number((spend / fetched).toFixed(2)) : null,
      spendPerSale: spend !== null && sales > 0 ? Number((spend / sales).toFixed(2)) : null,
      spendPerActivation: spend !== null && activations > 0 ? Number((spend / activations).toFixed(2)) : null,
    };
  });

  const totalSpend = mappedRows.reduce((sum, row) => sum + (row.spend || 0), 0);
  const matchedSpend = mappedRows
    .filter(row => row.hasMarketing && row.hasOperations)
    .reduce((sum, row) => sum + (row.spend || 0), 0);
  const unmatchedMarketingSpend = mappedRows
    .filter(row => row.hasMarketing && !row.hasOperations)
    .reduce((sum, row) => sum + (row.spend || 0), 0);

  return {
    status: 'OBSERVED_UNRECONCILED',
    reason: 'Rows use the explicitly configured marketing-to-lead attribution key. Only source scope is propagated across both populations; unsupported cross-source filters are withheld. Results remain NOT_VERIFIED until key coverage and semantics are reconciled.',
    contract: contract.attribution,
    grain,
    summary: {
      totalSpend: Number(totalSpend.toFixed(2)),
      matchedSpend: Number(matchedSpend.toFixed(2)),
      unmatchedMarketingSpend: Number(unmatchedMarketingSpend.toFixed(2)),
      matchedSpendSharePct: totalSpend > 0 ? Number(((matchedSpend / totalSpend) * 100).toFixed(1)) : null,
      matchedKeys: mappedRows.filter(row => row.hasMarketing && row.hasOperations).length,
      marketingOnlyKeys: mappedRows.filter(row => row.hasMarketing && !row.hasOperations).length,
      operationsOnlyKeys: mappedRows.filter(row => !row.hasMarketing && row.hasOperations).length,
    },
    rows: mappedRows,
  };
}

// 12. AI OPERATIONAL INSIGHTS (Gemini API with @google/genai)
export async function getAiInsightsAnalytics(_params: OffernetQueryParams) {
  return {
    insights: [],
    source: 'disabled',
    status: 'UNAVAILABLE',
    reason: 'AI operational summaries are disabled until every upstream metric supplied to the model is independently validated.'
  };
}

// 13. RAW DATA EXPLORER & LEAD TIMELINE
export async function getRawLeads(params: OffernetQueryParams) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const limit = Math.min(Math.max(Number(params.limit) || 50, 10), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const { whereSql, queryParams } = buildFilterClause(params);

  let searchCondition = '';
  if (params.search) {
    searchCondition = `AND (
      LOWER(l.lead_id) LIKE LOWER(@search)
      OR CAST(l.consumer_id AS STRING) LIKE @search
      OR LOWER(hlc.vendor) LIKE LOWER(@search)
      OR LOWER(l.offershop_source) LIKE LOWER(@search)
      OR LOWER(hlc.last_dialer_status) LIKE LOWER(@search)
    )`;
    queryParams.search = `%${params.search}%`;
  }

  const validDelivered = "(h.delivered IS NOT NULL AND h.delivered NOT LIKE '1900%' AND h.delivered NOT LIKE '1970%')";
  const validDialled = "(h.first_call_date IS NOT NULL AND h.first_call_date NOT LIKE '1900%' AND h.first_call_date NOT LIKE '1970%')";
  const validSale = "(h.sale IS NOT NULL AND h.sale != '' AND h.sale NOT LIKE '1900%' AND h.sale NOT LIKE '1970%')";
  const validActivation = "(h.activated IS NOT NULL AND h.activated != '' AND h.activated NOT LIKE '1900%' AND h.activated NOT LIKE '1970%')";
  let drillCondition = '';

  if (params.drill) {
    const drill = params.drill;
    const value = params.drillValue || '';
    if (drill === 'awaiting-first-dial') {
      drillCondition = `AND EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered})
        AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDialled})`;
    } else if (drill === 'missing-disposition') {
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE ${validDialled} AND (h.last_dialer_status IS NULL OR TRIM(h.last_dialer_status) = '')
      )`;
    } else if (drill === 'unactivated-sales') {
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE ${validSale}
          AND NOT ${validActivation}
          AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.sale AS TIMESTAMP), DAY) >= 14
      )`;
    } else if (drill === 'high-attempt-no-rpc') {
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE COALESCE(SAFE_CAST(h.total_calls AS INT64), 0) >= 5
      )
      AND NOT EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE SAFE_CAST(h.rpc AS INT64) > 0
      )`;
    } else if (drill === 'one-call-only') {
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE COALESCE(SAFE_CAST(h.total_calls AS INT64), 0) = 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE COALESCE(SAFE_CAST(h.total_calls AS INT64), 0) > 1
      )`;
    } else if (drill === 'sla-breach') {
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE ${validDelivered}
          AND (
            (${validDialled} AND TIMESTAMP_DIFF(SAFE_CAST(h.first_call_date AS TIMESTAMP), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) > 900)
            OR (NOT ${validDialled} AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) > 900)
          )
      )`;
    } else if (drill === 'backlog-age') {
      const bucketSql: Record<string, string> = {
        '0–15m': 'BETWEEN 0 AND 900',
        '15–30m': '> 900 AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) <= 1800',
        '30–60m': '> 1800 AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) <= 3600',
        '1–6h': '> 3600 AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) <= 21600',
        '6–12h': '> 21600 AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) <= 43200',
        '12–24h': '> 43200 AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) <= 86400',
        '24h+': '> 86400',
      };
      const suffix = bucketSql[value];
      if (!suffix) throw new RequestError('Unsupported backlog drill bucket', 422);
      drillCondition = `AND EXISTS (
        SELECT 1 FROM UNNEST(l.hlc_details) h
        WHERE ${validDelivered}
          AND NOT ${validDialled}
          AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND) ${suffix}
      )`;
    } else if (drill === 'funnel-stage') {
      const conditions: Record<string, string> = {
        'fetched': 'TRUE',
        'delivered': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered})`,
        'dialled': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDialled})`,
        'rpc': 'EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE SAFE_CAST(h.rpc AS INT64) > 0)',
        'sales': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validSale})`,
        'activated': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validActivation})`,
      };
      const condition = conditions[value];
      if (!condition) throw new RequestError('Unsupported funnel-stage drill', 422);
      drillCondition = `AND ${condition}`;
    } else if (drill === 'lead-age') {
      const timing = "TIMESTAMP_DIFF(SAFE_CAST(h.first_call_date AS TIMESTAMP), SAFE_CAST(h.delivered AS TIMESTAMP), SECOND)";
      const conditions: Record<string, string> = {
        'Not delivered': `NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered})`,
        'Undialled': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered}) AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDialled})`,
        'Invalid timing': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} < 0)`,
        '0–5m': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} BETWEEN 0 AND 300)`,
        '5–15m': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 300 AND ${timing} <= 900)`,
        '15–30m': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 900 AND ${timing} <= 1800)`,
        '30–60m': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 1800 AND ${timing} <= 3600)`,
        '1–6h': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 3600 AND ${timing} <= 21600)`,
        '6–24h': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 21600 AND ${timing} <= 86400)`,
        '24h+': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered} AND ${validDialled} AND ${timing} > 86400)`,
      };
      const condition = conditions[value];
      if (!condition) throw new RequestError('Unsupported lead-age drill bucket', 422);
      drillCondition = `AND ${condition}`;
    } else if (drill === 'funnel-loss') {
      const conditions: Record<string, string> = {
        'fetched-to-delivered': `NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered})`,
        'delivered-to-dialled': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDelivered}) AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDialled})`,
        'dialled-to-rpc': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validDialled}) AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE SAFE_CAST(h.rpc AS INT64) > 0)`,
        'rpc-to-sales': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE SAFE_CAST(h.rpc AS INT64) > 0) AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validSale})`,
        'sales-to-activated': `EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validSale}) AND NOT EXISTS (SELECT 1 FROM UNNEST(l.hlc_details) h WHERE ${validActivation})`,
      };
      const condition = conditions[value];
      if (!condition) throw new RequestError('Unsupported funnel-loss drill', 422);
      drillCondition = `AND ${condition}`;
    } else {
      throw new RequestError('Unsupported drill-down population', 422);
    }
  }

  const query = `
    SELECT
      l.lead_id,
      l.consumer_id,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', SAFE_CAST(l.fetched AS TIMESTAMP)) as fetched,
      COALESCE(l.offershop_source, 'Unknown') as source,
      COALESCE(l.offernet_medium, 'Unknown') as medium,
      COALESCE(l.offershop_grade, 'Standard') as grade,
      COALESCE(l.offershop_color_vetting, 'Unvetted') as vetting,
      l.valid_lead,
      l.valid_idno,
      l.phone_valid,
      hlc.vendor,
      hlc.transaction_id,
      hlc.status,
      hlc.last_dialer_status,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', SAFE_CAST(hlc.delivered AS TIMESTAMP)) as delivered_time,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', SAFE_CAST(hlc.first_call_date AS TIMESTAMP)) as first_call_time,
      COALESCE(hlc.total_calls, 0) as total_calls,
      hlc.first_call_date IS NOT NULL AND hlc.first_call_date NOT LIKE '1900%' AND hlc.first_call_date NOT LIKE '1970%' as dialled,
      SAFE_CAST(hlc.rpc AS INT64) > 0 as contacted,
      hlc.sale NOT LIKE '1970%' AND hlc.sale NOT LIKE '1900%' AND hlc.sale IS NOT NULL AND hlc.sale != '' as sale,
      hlc.activated NOT LIKE '1970%' AND hlc.activated NOT LIKE '1900%' AND hlc.activated IS NOT NULL AND hlc.activated != '' as activated,
      COALESCE(hlc.revenue_generated, 0) as revenue
    FROM ${configuredSourceTable(params.clientId, 'leads')} l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    ${whereSql}
    ${searchCondition}
    ${drillCondition}
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY l.lead_id
      ORDER BY SAFE_CAST(hlc.delivered AS TIMESTAMP) DESC NULLS LAST
    ) = 1
    ORDER BY SAFE_CAST(l.fetched AS TIMESTAMP) DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const [rows] = await client.query({ query, params: queryParams });
  return {
    rows,
    limit,
    offset,
    drill: params.drill || null,
    drillValue: params.drillValue || null,
  };
}

// LEAD TIMELINE MODAL DATA
export async function getLeadTimeline(leadId: string, params: Pick<OffernetQueryParams, 'clientId' | 'vendor'>) {
  const client = getBigQueryClient(getClientConfig(params.clientId).bigQueryProject);
  const clientConfig = getClientConfig(params.clientId);
  const conditions = ['l.lead_id = @leadId'];
  const queryParams: Record<string, any> = { leadId };
  const callConditions = ['CAST(dialer_lead_id AS STRING) = @leadId'];

  if (clientConfig.id !== 'default_tenant') {
    const tenantVendors = clientConfig.semanticMappings.partners || [];
    if (!tenantVendors.length) throw new RequestError('No approved vendor mapping exists for this tenant', 422);
    conditions.push('LOWER(hlc.vendor) IN UNNEST(@tenantVendors)');
    callConditions.push('LOWER(vendor) IN UNNEST(@tenantVendors)');
    queryParams.tenantVendors = tenantVendors.map(value => value.toLowerCase());
  }

  const cleanVendor = params.vendor && !['all', 'all vendors', 'undefined', 'null'].includes(params.vendor.trim().toLowerCase())
    ? params.vendor.trim()
    : undefined;
  if (cleanVendor) {
    conditions.push('LOWER(hlc.vendor) = LOWER(@vendor)');
    callConditions.push('LOWER(vendor) = LOWER(@vendor)');
    queryParams.vendor = cleanVendor;
  }

  const query = `
    SELECT
      l.lead_id,
      l.consumer_id,
      l.fetched,
      l.offershop_source,
      l.offernet_medium,
      l.offershop_grade,
      l.offershop_color_vetting,
      l.valid_idno,
      l.phone_valid,
      hlc.*
    FROM ${configuredSourceTable(params.clientId, 'leads')} l
    LEFT JOIN UNNEST(l.hlc_details) hlc
    WHERE ${conditions.join(' AND ')}
    ORDER BY SAFE_CAST(hlc.delivered AS TIMESTAMP) DESC
    LIMIT 1
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const row = rows[0];
  if (!row) return null;

  let vicidialCalls: any[] = [];
  try {
    const [callRows] = await client.query({
      query: `
        SELECT
          call_start_date,
          call_end_date,
          length_in_sec,
          user,
          status_name,
          is_rpc,
          is_sale,
          is_callback,
          called_count
        FROM ${configuredSourceTable(params.clientId, 'calls')}
        WHERE ${callConditions.join(' AND ')}
        ORDER BY SAFE_CAST(call_start_date AS TIMESTAMP) ASC
        LIMIT 500
      `,
      params: queryParams
    });
    vicidialCalls = callRows;
  } catch {
    vicidialCalls = [];
  }

  const events: any[] = [];

  if (row.fetched && !String(row.fetched).startsWith('1900') && !String(row.fetched).startsWith('1970')) {
    events.push({
      stage: 'Captured',
      title: 'Lead Captured & Ingested',
      timestamp: row.fetched,
      status: 'SUCCESS',
      details: `Source: ${row.offershop_source || 'Unknown'} | Medium: ${row.offernet_medium || 'Unknown'} | Grade: ${row.offershop_grade || 'Unknown'}`
    });
  }

  if (row.delivered && !String(row.delivered).startsWith('1900') && !String(row.delivered).startsWith('1970')) {
    events.push({
      stage: 'Delivered',
      title: `Delivery recorded for ${row.vendor || 'Unknown'}`,
      timestamp: row.delivered,
      status: 'SUCCESS',
      details: `Transaction ID: ${row.transaction_id || 'N/A'}`
    });
  }

  if (vicidialCalls.length > 0) {
    vicidialCalls.forEach((call, index) => {
      events.push({
        stage: `Attempt ${call.called_count || index + 1}`,
        title: `Dial attempt ${call.called_count || index + 1} (${call.status_name || 'Disposition recorded'})`,
        timestamp: call.call_start_date,
        status: call.is_rpc ? 'SUCCESS' : 'INFO',
        details: `Agent: ${call.user || 'Unknown'} | Duration: ${call.length_in_sec || 0}s | RPC: ${call.is_rpc ? 'Yes' : 'No'} | Sale flag: ${call.is_sale ? 'Yes' : 'No'}`
      });
    });
  } else if (row.first_call_date && !String(row.first_call_date).startsWith('1900') && !String(row.first_call_date).startsWith('1970')) {
    events.push({
      stage: 'Dialled',
      title: `First dial timestamp recorded (${row.last_dialer_status || 'No disposition'})`,
      timestamp: row.first_call_date,
      status: 'INFO',
      details: `Cumulative call counter: ${row.total_calls ?? 'Unknown'}`
    });
  }

  if (Number(row.rpc || 0) > 0 || vicidialCalls.some(call => call.is_rpc)) {
    events.push({
      stage: 'Contacted',
      title: 'Right Party Contact flag recorded',
      timestamp: row.first_call_date || row.delivered,
      status: 'INFO',
      details: 'RPC evidence is shown as recorded by the source system; no additional customer-verification claim is inferred.'
    });
  }

  if (row.sale && !String(row.sale).startsWith('1900') && !String(row.sale).startsWith('1970')) {
    events.push({
      stage: 'Sale',
      title: 'Sale timestamp recorded',
      timestamp: row.sale,
      status: 'INFO',
      details: `Recorded revenue field: ZAR ${Number(row.revenue_generated || 0).toLocaleString()}`
    });
  }

  if (row.activated && !String(row.activated).startsWith('1900') && !String(row.activated).startsWith('1970')) {
    events.push({
      stage: 'Activated',
      title: 'Activation timestamp recorded',
      timestamp: row.activated,
      status: 'INFO',
      details: 'Activation is reported exactly as represented in the source row; provisioning or collection is not inferred.'
    });
  }

  return {
    leadId: row.lead_id,
    consumerId: row.consumer_id,
    vendor: row.vendor,
    source: row.offershop_source,
    grade: row.offershop_grade,
    events: events.sort((a, b) => Date.parse(a.timestamp || '') - Date.parse(b.timestamp || ''))
  };
}

