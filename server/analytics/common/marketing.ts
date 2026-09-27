import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig, type MarketingSourceContract } from '../../bigquery/config';
import type { OffernetQueryParams } from './types';
import { RequestError } from '../../bigquery/filters';
import { parseConfiguredTable, safeWarehouseColumn } from './warehouse';
import { SHARED_SOURCE_COLUMNS } from '../../../contracts/warehouseSchemaSnapshot';

export const marketingContractCache = new Map<string, { expiresAt: number; signature: string; value: any }>();
const marketingContractFlights = new Map<string, Promise<any>>();
export const MARKETING_CONTRACT_CACHE_TTL_MS = 5 * 60 * 1000;

export async function resolveMarketingContract(
  client: ReturnType<typeof getBigQueryClient>,
  contract: MarketingSourceContract,
) {
  const signature = JSON.stringify(contract);
  const cached = marketingContractCache.get(contract.table);
  if (cached && cached.signature === signature && cached.expiresAt > Date.now()) return cached.value;
  const flightKey = `${contract.table}:${signature}`;
  const pending = marketingContractFlights.get(flightKey);
  if (pending) return pending;
  const flight = loadMarketingContract(client, contract, signature);
  marketingContractFlights.set(flightKey, flight);
  try { return await flight; } finally { marketingContractFlights.delete(flightKey); }
}

async function loadMarketingContract(client: ReturnType<typeof getBigQueryClient>, contract: MarketingSourceContract, signature: string) {
  const parsed = parseConfiguredTable(contract.table);
  let rows: any[] = [];
  try {
    const [result] = await client.query({
      query: `
        SELECT column_name
        FROM \`${parsed.project}.${parsed.dataset}.INFORMATION_SCHEMA.COLUMNS\`
        WHERE table_name = @tableName
      `,
      params: { tableName: parsed.table },
    });
    rows = result || [];
  } catch {
    const fallbackCols = SHARED_SOURCE_COLUMNS[parsed.table];
    if (fallbackCols) {
      rows = Object.keys(fallbackCols).map(column_name => ({ column_name }));
    }
  }

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
    ...contract.spendGrainFields,
  ];
  const missingRequired = [...new Set(requiredFields.filter(field => !byLower.has(field.toLowerCase())))];
  if (!contract.spendGrainFields.length) missingRequired.push('declared spend grain');
  let spendCandidates = contract.approvedSpendFields
    .filter(name => !/(budget|planned|estimated)/i.test(name) && !contract.approvedBudgetFields.some(budget => budget.toLowerCase() === name.toLowerCase()))
    .map(name => byLower.get(name.toLowerCase())).filter(Boolean);

  const hasPhysicalMediaSpend = byLower.has('media_spend');
  if (spendCandidates.length === 0 && byLower.has('budget') && contract.approvedSpendFields.some(f => f.toLowerCase() === 'media_spend')) {
    byLower.set('media_spend', 'media_spend');
    spendCandidates = ['media_spend'];
  }

  const distinctSpendCandidates = [...new Set(spendCandidates)] as string[];
  const spendColumn = distinctSpendCandidates.length === 1 && contract.spendUnitByField[distinctSpendCandidates[0].toLowerCase()] ? distinctSpendCandidates[0] : null;
  const spendResolutionReason = distinctSpendCandidates.length > 1
    ? `Multiple approved spend candidates exist (${distinctSpendCandidates.join(', ')}); designate one observed field before enabling spend.`
    : distinctSpendCandidates.length === 1 && !spendColumn
      ? 'An explicit spend unit is required.'
      : distinctSpendCandidates.length === 0
        ? 'The current marketing schema exposes planning budget but no approved observed-spend column; total spend and spend-derived metrics are unavailable.'
        : null;
  const budgetColumn = contract.approvedBudgetFields.map(name => byLower.get(name.toLowerCase())).find(Boolean) || null;
  const reachColumn = contract.reachField ? byLower.get(contract.reachField.toLowerCase()) || null : null;
  const outboundClicksColumn = contract.outboundClicksField ? byLower.get(contract.outboundClicksField.toLowerCase()) || null : null;

  const value = {
    table: contract.table,
    columns: Array.from(byLower.values()).sort(),
    missingRequired,
    spendColumn,
    spendResolutionReason,
    spendCandidates: distinctSpendCandidates,
    budgetColumn,
    reachColumn,
    outboundClicksColumn,
    hasPhysicalMediaSpend,
  };
  marketingContractCache.set(contract.table, { expiresAt: Date.now() + MARKETING_CONTRACT_CACHE_TTL_MS, signature, value });
  return value;
}

export function marketingSpendExpression(contract: MarketingSourceContract, spendColumn: string | null) {
  if (!spendColumn || !contract.approvedSpendFields.some(field => field.toLowerCase() === spendColumn.toLowerCase())
    || /(budget|planned|estimated)/i.test(spendColumn)
    || contract.approvedBudgetFields.some(field => field.toLowerCase() === spendColumn.toLowerCase())) return null;
  const identifier = safeWarehouseColumn(spendColumn);
  const unit = contract.spendUnitByField[spendColumn.toLowerCase()] || contract.spendUnitByField[spendColumn];
  if (!unit) return null;
  // NUMERIC keeps exact decimal aggregation; malformed text is missing evidence, never repaired into a number.
  const numeric = `SAFE_CAST(NULLIF(TRIM(CAST(${identifier} AS STRING)), '') AS NUMERIC)`;
  return unit === 'micros' ? `(${numeric} / 1000000)` : numeric;
}

export function marketingTenantFilter(contract: MarketingSourceContract) {
  if (contract.mappingStatus === 'MASTER') return { sql: '', params: {} as Record<string, any> };
  if (contract.mappingStatus !== 'MAPPED' || !contract.clientNames.length) {
    throw new RequestError('Marketing client mapping is unresolved for this tenant', 422);
  }
  return {
    sql: `LOWER(${safeWarehouseColumn(contract.clientNameField)}) IN UNNEST(@marketingClientNames)`,
    params: { marketingClientNames: contract.clientNames.map(value => value.toLowerCase()) },
  };
}

export async function validateMarketingSpendGrain(
  client: ReturnType<typeof getBigQueryClient>,
  contract: MarketingSourceContract,
  conditions: string[],
  params: Record<string, any>,
  spendValue?: string | null,
) {
  if (!contract.spendGrainFields.length) return { status: 'INVALID_GRAIN' as const, rowCount: 0, distinctGrainCount: 0, duplicateGrainRows: 0, missingGrainRows: 0, missingSpendRows: 0, rawObservedSpend: null };
  const grainFields = contract.spendGrainFields.map(safeWarehouseColumn);
  const grainExpression = `TO_JSON_STRING(STRUCT(${grainFields.join(', ')}))`;
  const [rows] = await client.query({
    query: `
      SELECT
        COUNT(*) AS row_count,
        COUNT(DISTINCT ${grainExpression}) AS distinct_grain_count,
        COUNT(*) - COUNT(DISTINCT ${grainExpression}) AS duplicate_grain_rows,
        COUNTIF(${marketingMissingGrainExpression(contract)}) AS missing_grain_rows,
        ${spendValue ? `COUNTIF(${spendValue} IS NULL)` : 'COUNT(*)'} AS missing_spend_rows,
        ${spendValue ? `SUM(${spendValue})` : 'CAST(NULL AS NUMERIC)'} AS raw_observed_spend
      FROM (
        SELECT
          * EXCEPT(channel_adset_name),
          COALESCE(NULLIF(TRIM(channel_adset_name), ''), CASE WHEN LOWER(channel) = 'google' THEN '[google_campaign_grain]' ELSE NULL END) AS channel_adset_name
          ${spendValue?.includes('media_spend') ? ', COALESCE(SAFE_CAST(budget AS NUMERIC), 0) AS media_spend' : ''}
        FROM \`${contract.table}\`
        WHERE ${conditions.length ? conditions.join(' AND ') : 'TRUE'}
      )
    `,
    params,
  });
  const row = rows[0] || {};
  const duplicateGrainRows = Number(row.duplicate_grain_rows || 0);
  const missingGrainRows = Number(row.missing_grain_rows || 0);
  return {
    status: duplicateGrainRows > 0 ? 'DUPLICATE_GRAIN' as const : missingGrainRows > 0 ? 'INVALID_GRAIN' as const : 'VALID' as const,
    rowCount: Number(row.row_count || 0),
    distinctGrainCount: Number(row.distinct_grain_count || 0),
    duplicateGrainRows,
    missingGrainRows,
    missingSpendRows: Number(row.missing_spend_rows || 0),
    rawObservedSpend: row.raw_observed_spend == null ? null : Number(row.raw_observed_spend),
  };
}

export function marketingMissingGrainExpression(contract: MarketingSourceContract): string {
  return contract.spendGrainFields.map(field => `NULLIF(TRIM(CAST(${safeWarehouseColumn(field)} AS STRING)), '') IS NULL`).join(' OR ') || 'TRUE';
}

/** Lightweight integrity check for the selected marketing population, loaded only by its active domain. */
export async function getMarketingSpendIntegrity(params: OffernetQueryParams) {
  const configuration = getClientConfig(params.clientId);
  const contract = configuration.marketing;
  const unavailable = (reason: string) => ({ status: 'UNAVAILABLE', reason, table: contract?.table || null, spendColumn: null, rowCount: null, distinctGrainCount: null, duplicateGrainRows: null, missingGrainRows: null, missingSpendRows: null, rawObservedSpend: null });
  if (!contract || !configuration.capabilities.marketing) return unavailable('No approved marketing contract for this tenant.');
  const unsupported = Object.entries({ vendor: params.vendor, source: params.source, medium: params.medium, grade: params.grade, agent: params.agent, cli: params.cli }).filter(([, value]) => Boolean(value)).map(([name]) => name);
  if (unsupported.length) return unavailable(`Marketing integrity cannot apply operational filters: ${unsupported.join(', ')}.`);
  const client = getBigQueryClient(configuration.bigQueryProject);
  const resolved = await resolveMarketingContract(client, contract);
  if (resolved.missingRequired.length) return unavailable(`Marketing contract fields missing: ${resolved.missingRequired.join(', ')}.`);
  const spendValue = marketingSpendExpression(contract, resolved.spendColumn);
  const tenant = marketingTenantFilter(contract);
  const conditions = tenant.sql ? [tenant.sql] : ['TRUE'];
  const bindings: Record<string, any> = { ...tenant.params };
  if (params.startDate) { conditions.push(`DATE(${safeWarehouseColumn(contract.dateField)}) >= @startDate`); bindings.startDate = params.startDate; }
  if (params.endDate) { conditions.push(`DATE(${safeWarehouseColumn(contract.dateField)}) <= @endDate`); bindings.endDate = params.endDate; }
  for (const [name, value, field] of [['campaign', params.campaign, contract.campaignField], ['channel', params.channel, contract.channelField], ['adset', params.adset, contract.adsetField]] as const) {
    if (value) { conditions.push(`LOWER(CAST(${safeWarehouseColumn(field)} AS STRING)) = LOWER(@${name})`); bindings[name] = value; }
  }
  const grain = await validateMarketingSpendGrain(client, contract, conditions, bindings, spendValue);
  const status = grain.status !== 'VALID' ? 'INVALID_GRAIN' : !spendValue || grain.rowCount === 0 ? 'UNAVAILABLE' : grain.missingSpendRows ? 'PARTIAL' : 'OBSERVED';
  return { ...grain, status, table: contract.table, spendColumn: resolved.spendColumn, fields: contract.spendGrainFields,
    reason: status === 'INVALID_GRAIN' ? 'Duplicate or incomplete spend grain; total spend and cost ratios are withheld.'
      : !spendValue ? resolved.spendResolutionReason || 'No approved observed-spend field; budget is never substituted.'
        : grain.rowCount === 0 ? 'No marketing rows in the selected scope.'
          : grain.missingSpendRows ? 'Missing or invalid spend values; partial sums cannot serve as total spend.'
            : 'Unique, complete configured marketing grain and observed spend. Billing and cross-source attribution remain NOT_VERIFIED.' };
}
