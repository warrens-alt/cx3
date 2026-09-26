import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import type { OffernetQueryParams } from '../common/types';
import { configuredSourceTable, safeWarehouseColumn, safeAliasedColumn } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';
import {
  resolveMarketingContract,
  marketingSpendExpression,
  marketingTenantFilter,
  validateMarketingSpendGrain,
} from '../common/marketing';

export async function getMarketingAttributionAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const contract = clientConfig.marketing;
  if (!contract || !clientConfig.capabilities.marketing) {
    return { status: 'UNAVAILABLE', reason: 'No marketing contract is configured.', rows: [], summary: null };
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
