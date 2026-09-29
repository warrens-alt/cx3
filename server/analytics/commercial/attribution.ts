import { operationalLeadCtes, completeRevenueSumSql, OPERATIONAL_REVENUE_POLICY } from '../common/leadMetrics';
import { reconcileSpend, commercialRatio, type AttributedEconomics } from '../../../contracts/commercial';
import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import { validTimestampSql } from '../../bigquery/integrity';
import type { OffernetQueryParams } from '../common/types';
import { configuredSourceTable, safeWarehouseColumn, safeAliasedColumn } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';
import { resolveMarketingContract, marketingSpendExpression, marketingTenantFilter, marketingMissingGrainExpression } from '../common/marketing';

export const unavailableEconomics = (reason: string): AttributedEconomics => ({
  status: 'UNAVAILABLE', reason, matchedSpend: null, fetched: null, delivered: null, dialled: null, rpc: null, sales: null,
  activations: null, recordedRevenue: null, spendPerFetchedLead: null, spendPerDeliveredLead: null,
  spendPerDialledLead: null, spendPerRpc: null, spendPerSale: null, spendPerActivation: null, revenueToSpend: null,
});

export async function getMarketingAttributionAnalytics(params: OffernetQueryParams) {
  const clientConfig = getClientConfig(params.clientId);
  const contract = clientConfig.marketing;
  const unavailable = (status: string, reason: string) => ({ status, reason, rows: [], summary: null, economics: unavailableEconomics(reason), validationStatus: 'NOT_VERIFIED', reconciliationStatus: 'UNAVAILABLE' });
  if (!contract || !clientConfig.capabilities.marketing) return unavailable('UNAVAILABLE', 'No marketing contract is configured.');
  if (contract.attribution.status !== 'ACTIVE') return { ...unavailable('UNAVAILABLE', contract.attribution.notes || 'Marketing-to-lead attribution is not configured.'), contract: contract.attribution };

  const campaignMapped = Boolean(contract.attribution.marketingCampaignField && contract.attribution.leadCampaignField);
  const unsupportedScope = Object.entries({ vendor: params.vendor, medium: params.medium, grade: params.grade, agent: params.agent, cli: params.cli,
    channel: params.channel, adset: params.adset, campaign: campaignMapped ? undefined : params.campaign }).filter(([, value]) => Boolean(value)).map(([key]) => key);
  if (unsupportedScope.length) return { ...unavailable('UNSUPPORTED_FILTER', `Attribution is withheld because the selected ${unsupportedScope.join(', ')} filter(s) do not have an approved equivalent marketing-side mapping.`), contract: contract.attribution, unsupportedFilters: unsupportedScope };

  const { marketingSourceField, leadSourceField } = contract.attribution;
  if (!marketingSourceField || !leadSourceField) return unavailable('INVALID_CONTRACT', 'Active attribution requires both marketingSourceField and leadSourceField.');
  const client = getBigQueryClient(clientConfig.bigQueryProject);
  const resolved = await resolveMarketingContract(client, contract);
  const attributionFields = [marketingSourceField, ...(campaignMapped ? [contract.attribution.marketingCampaignField!] : [])];
  const missing = [...resolved.missingRequired, ...attributionFields.filter(field => !resolved.columns.some((column: string) => column.toLowerCase() === field.toLowerCase()))];
  if (missing.length) return unavailable('INVALID_CONTRACT', `Configured marketing fields are missing: ${missing.join(', ')}`);
  const spendValue = marketingSpendExpression(contract, resolved.spendColumn);
  if (!spendValue) return unavailable('UNAVAILABLE', 'Attribution requires an approved observed spend field.');

  const tenantFilter = marketingTenantFilter(contract);
  const marketingDate = safeWarehouseColumn(contract.dateField);
  const marketingSource = safeWarehouseColumn(marketingSourceField);
  const leadSource = safeAliasedColumn('l', leadSourceField);
  const conditions = tenantFilter.sql ? [tenantFilter.sql] : ['TRUE'];
  const queryParams: Record<string, any> = { ...tenantFilter.params };
  if (params.startDate) { conditions.push(`DATE(${marketingDate}) >= @startDate`); queryParams.startDate = params.startDate; }
  if (params.endDate) { conditions.push(`DATE(${marketingDate}) <= @endDate`); queryParams.endDate = params.endDate; }
  if (params.source) { conditions.push(`LOWER(TRIM(CAST(${marketingSource} AS STRING))) = LOWER(@attributionSource)`); queryParams.attributionSource = params.source; }
  if (params.campaign && campaignMapped) { conditions.push(`LOWER(TRIM(CAST(${safeWarehouseColumn(contract.attribution.marketingCampaignField!)} AS STRING))) = LOWER(@attributionCampaign)`); queryParams.attributionCampaign = params.campaign; }

  const operationalParams = { ...params, source: undefined, vendor: undefined, medium: undefined, grade: undefined, agent: undefined, campaign: undefined, channel: undefined, adset: undefined, cli: undefined };
  const operationalScope = buildFilterClause(operationalParams);
  const operationalConditions = [operationalScope.whereSql];
  if (params.source) operationalConditions.push(`AND LOWER(TRIM(CAST(${leadSource} AS STRING))) = LOWER(@attributionSource)`);
  if (params.campaign && campaignMapped) operationalConditions.push(`AND LOWER(TRIM(CAST(${safeAliasedColumn('l', contract.attribution.leadCampaignField!)} AS STRING))) = LOWER(@attributionCampaign)`);
  const normalised = (field: string) => `NULLIF(LOWER(TRIM(CAST(${field} AS STRING))), '')`;
  const joinKey = (source: string, campaign?: string) => campaign
    ? `IF(${normalised(source)} IS NULL OR ${normalised(campaign)} IS NULL, NULL, TO_JSON_STRING(STRUCT(${normalised(source)} AS source, ${normalised(campaign)} AS campaign)))`
    : normalised(source);
  const marketingKey = joinKey(marketingSource, campaignMapped ? safeWarehouseColumn(contract.attribution.marketingCampaignField!) : undefined);
  const operationsKey = joinKey(leadSource, campaignMapped ? safeAliasedColumn('l', contract.attribution.leadCampaignField!) : undefined);

  // Both sides collapse independently before the join. Summary aggregates precede the bounded detail array.
  const grainExpression = `TO_JSON_STRING(STRUCT(${contract.spendGrainFields.map(safeWarehouseColumn).join(', ')}))`;
  const campaignGroup = [contract.clientNameField, contract.channelField, contract.campaignField, contract.adsetField].map(safeWarehouseColumn).join(', ');
  const query = `
    WITH attribution_source AS (
      SELECT l.*, ${operationsKey} AS _cx_attribution_key
      FROM ${configuredSourceTable(params.clientId, 'leads')} l
      ${operationalConditions.join(' ')} AND l.lead_id IS NOT NULL
    ), ${operationalLeadCtes(operationalParams, false, 'attribution_source')}, scoped_marketing AS (
      SELECT
        * EXCEPT(channel_adset_name),
        COALESCE(NULLIF(TRIM(channel_adset_name), ''), CASE WHEN LOWER(channel) = 'google' THEN '[google_campaign_grain]' ELSE NULL END) AS channel_adset_name
      FROM \`${contract.table}\`
      WHERE ${conditions.join(' AND ')}
    ), marketing_audit AS (
      SELECT COUNT(*) AS row_count,
        COUNT(DISTINCT ${grainExpression}) AS distinct_grain_count,
        COUNT(*) - COUNT(DISTINCT ${grainExpression}) AS duplicate_grain_rows,
        COUNTIF(${marketingMissingGrainExpression(contract)}) AS missing_grain_rows,
        COUNTIF(${spendValue} IS NULL) AS missing_spend_rows,
        SUM(${spendValue}) AS raw_observed_spend
      FROM scoped_marketing
    ), campaign_spend AS (
      SELECT ${campaignGroup}, SUM(${spendValue}) AS grouped_spend FROM scoped_marketing GROUP BY 1, 2, 3, 4
    ), marketing AS (
      SELECT ${marketingKey} AS join_key, TRUE AS has_marketing,
        SUM(${spendValue}) AS spend, SUM(SAFE_CAST(${safeWarehouseColumn(contract.leadsField)} AS NUMERIC)) AS platform_leads
      FROM scoped_marketing GROUP BY join_key
    ), operation_keys AS (
      SELECT lead_id, ANY_VALUE(_cx_attribution_key) AS join_key,
        COUNT(DISTINCT TO_JSON_STRING(STRUCT(_cx_attribution_key AS attribution_key))) AS key_count
      FROM attribution_source GROUP BY lead_id
    ), operation_leads AS (
      SELECT k.*, o.is_delivered AS delivered, o.is_dialled AS dialled, o.is_rpc AS rpc,
        o.is_sale AS sale, o.is_activated AS activation, o.revenue AS recorded_revenue
      FROM operational_leads o JOIN operation_keys k USING (lead_id)
      WHERE TRUE AND (SELECT row_count > 0 AND duplicate_grain_rows = 0 AND missing_grain_rows = 0
        AND missing_spend_rows = 0 AND raw_observed_spend IS NOT NULL FROM marketing_audit)
    ), operations AS (
      SELECT join_key, TRUE AS has_operations, COUNT(*) AS fetched,
        COUNTIF(delivered) AS delivered, COUNTIF(dialled) AS dialled, COUNTIF(rpc) AS rpc,
        COUNTIF(sale) AS sales, COUNTIF(activation) AS activations, ${completeRevenueSumSql('recorded_revenue')} AS recorded_revenue
      FROM operation_leads GROUP BY join_key
    ), joined AS (
      SELECT COALESCE(marketing.join_key, operations.join_key) AS join_key,
        COALESCE(has_marketing, FALSE) AS has_marketing, COALESCE(has_operations, FALSE) AS has_operations,
        marketing.spend, marketing.platform_leads, operations.fetched, operations.delivered, operations.dialled,
        operations.rpc, operations.sales, operations.activations, operations.recorded_revenue
      FROM marketing FULL OUTER JOIN operations USING (join_key)
    )
    SELECT SUM(spend) AS total_spend,
      (SELECT AS STRUCT * FROM marketing_audit) AS marketing_grain,
      (SELECT SUM(grouped_spend) FROM campaign_spend) AS campaign_aggregation_spend,
      COALESCE(SUM(IF(has_marketing AND has_operations, spend, 0)), 0) AS matched_spend,
      COALESCE(SUM(IF(has_marketing AND NOT has_operations, spend, 0)), 0) AS unmatched_marketing_spend,
      COUNTIF(has_marketing AND has_operations) AS matched_keys,
      COUNTIF(has_marketing AND NOT has_operations) AS marketing_only_keys,
      COUNTIF(NOT has_marketing AND has_operations) AS operations_only_keys,
      COUNT(*) AS total_keys,
      (SELECT COUNTIF(key_count > 1) FROM operation_leads) AS ambiguous_leads,
      SUM(IF(has_marketing AND has_operations, fetched, 0)) AS matched_fetched,
      SUM(IF(has_marketing AND has_operations, delivered, 0)) AS matched_delivered,
      SUM(IF(has_marketing AND has_operations, dialled, 0)) AS matched_dialled,
      SUM(IF(has_marketing AND has_operations, rpc, 0)) AS matched_rpc,
      SUM(IF(has_marketing AND has_operations, sales, 0)) AS matched_sales,
      SUM(IF(has_marketing AND has_operations, activations, 0)) AS matched_activations,
      CASE WHEN COUNTIF(has_marketing AND has_operations AND recorded_revenue IS NULL) > 0 THEN NULL ELSE SUM(IF(has_marketing AND has_operations, recorded_revenue, NULL)) END AS matched_recorded_revenue,
      ARRAY_AGG(STRUCT(join_key, has_marketing, has_operations, spend, platform_leads, fetched, delivered, dialled, rpc, sales, activations, recorded_revenue)
        ORDER BY spend DESC, join_key LIMIT 250) AS detail_rows
    FROM joined
  `;
  const [rows] = await client.query({ query, params: { ...queryParams, ...operationalScope.queryParams } });
  const totals = rows[0] || {};
  // Audit and joined values belong to one query snapshot. Missing audit evidence can never authorize spend.
  const evidence = totals.marketing_grain;
  const countFields = ['row_count', 'distinct_grain_count', 'duplicate_grain_rows', 'missing_grain_rows', 'missing_spend_rows'];
  if (!evidence || countFields.some(field => evidence[field] == null || !Number.isSafeInteger(Number(evidence[field])) || Number(evidence[field]) < 0)
    || Number(evidence.row_count) - Number(evidence.distinct_grain_count) !== Number(evidence.duplicate_grain_rows)
    || Number(evidence.missing_grain_rows) > Number(evidence.row_count) || Number(evidence.missing_spend_rows) > Number(evidence.row_count)) {
    return unavailable('NOT_VERIFIED', 'Attribution snapshot does not contain complete, internally consistent spend-grain evidence.');
  }
  const duplicateGrainRows = Number(evidence.duplicate_grain_rows), missingGrainRows = Number(evidence.missing_grain_rows);
  const grain = {
    status: duplicateGrainRows > 0 ? 'DUPLICATE_GRAIN' : missingGrainRows > 0 ? 'INVALID_GRAIN' : 'VALID',
    rowCount: Number(evidence.row_count), distinctGrainCount: Number(evidence.distinct_grain_count), duplicateGrainRows, missingGrainRows,
    missingSpendRows: Number(evidence.missing_spend_rows), rawObservedSpend: evidence.raw_observed_spend == null ? null : Number(evidence.raw_observed_spend),
  };
  if (grain.status !== 'VALID') return { ...unavailable('INVALID_GRAIN', `Attribution is withheld because the selected marketing population contains ${grain.duplicateGrainRows.toLocaleString()} duplicate rows and ${grain.missingGrainRows.toLocaleString()} incomplete keys at the approved spend grain.`), grain, contract: contract.attribution, reconciliationStatus: 'INVALID_GRAIN' };
  if (grain.missingSpendRows > 0 || grain.rowCount === 0 || grain.rawObservedSpend === null || !Number.isFinite(grain.rawObservedSpend)) return { ...unavailable('UNAVAILABLE', 'Attribution is withheld because selected spend is empty, missing or invalid; partial sums cannot stand in for total spend.'), grain, contract: contract.attribution };
  if (Number(totals.ambiguous_leads || 0) > 0) return { ...unavailable('INVALID_CONTRACT', 'Operational leads contain multiple attribution keys. Outcomes are withheld until the key grain is reconciled.'), grain };
  const totalSpend = totals.total_spend == null ? null : Number(totals.total_spend);
  const matchedSpend = Number(totals.matched_spend || 0);
  const unmatchedMarketingSpend = Number(totals.unmatched_marketing_spend || 0);
  const reconciliationDifference = totalSpend === null ? null : Number((totalSpend - grain.rawObservedSpend).toFixed(6));
  if (totalSpend === null || reconciliationDifference !== 0 || Math.abs(totalSpend - matchedSpend - unmatchedMarketingSpend) > 0.000001) return { ...unavailable('NOT_VERIFIED', 'Attribution spend does not reconcile to the independent raw marketing total. Cross-source ratios are withheld.'), grain, reconciliationStatus: 'NOT_VERIFIED' };
  const reconciliation = reconcileSpend({ rowCount: grain.rowCount, duplicateGrainRows: 0, missingGrainRows: 0, missingSpendRows: 0,
    rawObservedSpend: totalSpend, campaignAggregationSpend: totals.campaign_aggregation_spend == null ? null : Number(totals.campaign_aggregation_spend), hasApprovedSpend: true });
  if (reconciliation.status !== 'RECONCILED') return { ...unavailable('NOT_VERIFIED', reconciliation.reason), grain, reconciliation };
  const n = (field: string) => Number(totals[field] || 0);
  const matchedRevenue = totals.matched_recorded_revenue == null ? null : Number(totals.matched_recorded_revenue);
  const matchedKeys = n('matched_keys');
  const economics: AttributedEconomics = matchedKeys > 0 ? {
    status: 'AVAILABLE', reason: `Uses only approved matching keys. Capture-cohort outcomes and marketing reporting dates remain distinct; association is not causation. ${OPERATIONAL_REVENUE_POLICY}`,
    matchedSpend, fetched: n('matched_fetched'), delivered: n('matched_delivered'), dialled: n('matched_dialled'), rpc: n('matched_rpc'), sales: n('matched_sales'), activations: n('matched_activations'), recordedRevenue: matchedRevenue,
    spendPerFetchedLead: commercialRatio(matchedSpend, n('matched_fetched')), spendPerDeliveredLead: commercialRatio(matchedSpend, n('matched_delivered')),
    spendPerDialledLead: commercialRatio(matchedSpend, n('matched_dialled')), spendPerRpc: commercialRatio(matchedSpend, n('matched_rpc')),
    spendPerSale: commercialRatio(matchedSpend, n('matched_sales')), spendPerActivation: commercialRatio(matchedSpend, n('matched_activations')), revenueToSpend: commercialRatio(matchedRevenue, matchedSpend),
  } : unavailableEconomics('No approved attribution keys match both populations.');
  const mappedRows = (totals.detail_rows || []).map((row: any) => {
    const spend = row.spend == null ? null : Number(row.spend);
    const matched = Boolean(row.has_marketing && row.has_operations);
    return {
      key: row.join_key || (row.has_marketing ? 'Marketing: missing key' : 'Operations: missing key'),
      hasMarketing: Boolean(row.has_marketing), hasOperations: Boolean(row.has_operations), spend,
      platformLeads: Number(row.platform_leads || 0), fetched: Number(row.fetched || 0), delivered: Number(row.delivered || 0), dialled: Number(row.dialled || 0), rpc: Number(row.rpc || 0), sales: Number(row.sales || 0), activations: Number(row.activations || 0),
      recordedRevenue: row.recorded_revenue == null ? null : Number(row.recorded_revenue),
      spendPerFetchedLead: matched ? commercialRatio(spend, Number(row.fetched || 0)) : null,
      spendPerSale: matched ? commercialRatio(spend, Number(row.sales || 0)) : null,
      spendPerActivation: matched ? commercialRatio(spend, Number(row.activations || 0)) : null,
    };
  });
  return {
    status: 'OBSERVED_UNRECONCILED', validationStatus: 'NOT_VERIFIED',
    reason: 'Configured attribution keys join aggregated populations. Full-scope matched and unmatched spend reconcile to the marketing total; external billing and attribution causality are NOT_VERIFIED. Missing keys never match each other.',
    contract: contract.attribution, grain, economics, reconciliation,
    spendSource: { table: contract.table, column: resolved.spendColumn },
    reconciliationStatus: n('marketing_only_keys') || n('operations_only_keys') ? 'PARTIAL' : 'RECONCILED',
    summary: { totalSpend, matchedSpend, unmatchedMarketingSpend, matchedSpendSharePct: commercialRatio(matchedSpend, totalSpend, 100), matchedKeys,
      marketingOnlyKeys: n('marketing_only_keys'), operationsOnlyKeys: n('operations_only_keys') },
    detailScope: { totalKeys: n('total_keys'), displayedKeys: mappedRows.length, rowLimit: 250, truncated: n('total_keys') > mappedRows.length },
    rows: mappedRows,
  };
}
