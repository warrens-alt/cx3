import type { getBigQueryClient } from '../../bigquery/client';
import type { MarketingSourceContract } from '../../bigquery/config';
import { RequestError } from '../../bigquery/filters';
import { parseConfiguredTable, safeWarehouseColumn } from './warehouse';

export const marketingContractCache = new Map<string, { expiresAt: number; value: any }>();
export const MARKETING_CONTRACT_CACHE_TTL_MS = 5 * 60 * 1000;

export async function resolveMarketingContract(
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

export function marketingSpendExpression(contract: MarketingSourceContract, spendColumn: string | null) {
  if (!spendColumn) return null;
  const identifier = safeWarehouseColumn(spendColumn);
  const unit = contract.spendUnitByField[spendColumn.toLowerCase()] || contract.spendUnitByField[spendColumn] || 'currency';
  const numeric = `SAFE_CAST(REGEXP_REPLACE(CAST(${identifier} AS STRING), r'[^0-9.-]', '') AS FLOAT64)`;
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
