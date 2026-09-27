import { matchedPeriodWindow, compareMetric } from '../../../contracts/periodComparison';
import { commercialRatio, reconcileSpend } from '../../../contracts/commercial';
import { percentOrNull } from '../common/metrics';
import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import { RequestError } from '../../bigquery/filters';
import { safeWarehouseColumn } from '../common/warehouse';
import {
  resolveMarketingContract,
  marketingTenantFilter,
  marketingSpendExpression,
  marketingMissingGrainExpression,
} from '../common/marketing';
import type { OffernetQueryParams } from '../common/types';

export async function getClientCampaignAnalytics(params: OffernetQueryParams, options: { includeDetails?: boolean } = {}) {
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

  if (params.vendor || params.source || params.medium || params.grade || params.agent || params.cli) {
    throw new RequestError('Campaign reporting supports date, campaign, channel and adset scope; vendor/source/medium/grade/agent/CLI filters have no approved marketing equivalent.', 422);
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

  const conditions = ['TRUE'];
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

  for (const [value, field, parameter] of [[params.channel, channelField, 'channel'], [params.adset, adsetField, 'adset']] as const) {
    if (value) { conditions.push(`LOWER(CAST(${field} AS STRING)) = LOWER(@${parameter})`); queryParams[parameter] = value; }
  }

  const grainFields = contract.spendGrainFields.map(safeWarehouseColumn);
  const grainExpression = `TO_JSON_STRING(STRUCT(${grainFields.join(', ')}))`;
  const campaignGroupExpression = `TO_JSON_STRING(STRUCT(${clientField}, ${channelField}, ${campaignField}, ${adsetField}))`;
  const detailLimit = 250;
  const metricColumns = { impressions: impressionsField, reach: reachField, clicks: clicksField, outbound_clicks: outboundClicksField, recorded_leads: leadsField };
  const metricAggregates = Object.entries(metricColumns).map(([alias, field]) => field
    ? `SUM(SAFE_CAST(${field} AS NUMERIC)) AS ${alias}, COUNTIF(SAFE_CAST(${field} AS NUMERIC) IS NULL OR SAFE_CAST(${field} AS NUMERIC) < 0) AS missing_${alias}_rows`
    : `CAST(NULL AS NUMERIC) AS ${alias}, COUNT(*) AS missing_${alias}_rows`).join(',\n      ');
  const completeMetric = (row: any, name: keyof typeof metricColumns): number | null =>
    row[name] == null || Number(row[`missing_${name}_rows`] || 0) > 0 ? null : Number(row[name]);
  const buildGrainQuery = (includeDetails: boolean) => `
    WITH scoped_marketing AS (
      SELECT
        * EXCEPT(channel_adset_name),
        COALESCE(NULLIF(TRIM(channel_adset_name), ''), CASE WHEN LOWER(channel) = 'google' THEN '[google_campaign_grain]' ELSE NULL END) AS channel_adset_name
        ${spendValue?.includes('media_spend') && !resolved.hasPhysicalMediaSpend ? ', COALESCE(SAFE_CAST(budget AS NUMERIC), 0) AS media_spend' : ''}
      FROM \`${contract.table}\`
      WHERE ${conditions.join(' AND ')}
    ), campaign_spend AS (
      ${includeDetails ? `SELECT CAST(${clientField} AS STRING) AS client_name, CAST(${channelField} AS STRING) AS channel,
        CAST(${campaignField} AS STRING) AS campaign_name, CAST(${adsetField} AS STRING) AS adset_name,
        ${metricAggregates},
        ${spendValue ? `SUM(${spendValue})` : 'CAST(NULL AS NUMERIC)'} AS recorded_spend,
        ${budgetValue ? `ARRAY_AGG(${budgetValue} IGNORE NULLS ORDER BY ${dateField} DESC LIMIT 1)[SAFE_OFFSET(0)]` : 'CAST(NULL AS FLOAT64)'} AS latest_budget
      FROM scoped_marketing GROUP BY 1, 2, 3, 4`
      : `SELECT ${campaignGroupExpression} AS campaign_key,
        ${spendValue ? `SUM(${spendValue})` : 'CAST(NULL AS NUMERIC)'} AS recorded_spend
      FROM scoped_marketing GROUP BY 1`}

    )
    SELECT
      COUNT(*) AS row_count,
      COUNT(DISTINCT ${grainExpression}) AS distinct_grain_count,
      COUNT(*) - COUNT(DISTINCT ${grainExpression}) AS duplicate_grain_rows,
      COUNTIF(${marketingMissingGrainExpression(contract)}) AS missing_grain_rows,
      ${spendValue ? `COUNTIF(${spendValue} IS NULL)` : 'COUNT(*)'} AS missing_spend_rows,
      (SELECT SUM(recorded_spend) FROM campaign_spend) AS campaign_aggregation_spend,
      COUNT(DISTINCT ${campaignGroupExpression}) AS campaign_group_count,
      ${metricAggregates},
      ${spendValue ? `SUM(${spendValue})` : 'CAST(NULL AS NUMERIC)'} AS recorded_spend
      ${includeDetails ? `, ARRAY(SELECT AS STRUCT * FROM campaign_spend ORDER BY recorded_leads DESC, client_name, channel, campaign_name, adset_name LIMIT ${detailLimit}) AS campaign_details` : ''}
    FROM scoped_marketing
  `;
  const includeDetails = options.includeDetails !== false;
  const grainQuery = buildGrainQuery(includeDetails);
  const [grainRows] = await client.query({ query: grainQuery, params: queryParams });
  const grain = grainRows[0] || {};
  const duplicateGrainRows = Number(grain.duplicate_grain_rows || 0);
  const missingGrainRows = Number(grain.missing_grain_rows || 0);
  const missingSpendRows = Number(grain.missing_spend_rows || 0);
  const grainStatus = duplicateGrainRows > 0 ? 'DUPLICATE_GRAIN' : missingGrainRows > 0 ? 'INVALID_GRAIN' : 'VALID';
  const reconciliation = reconcileSpend({
    rowCount: Number(grain.row_count || 0), duplicateGrainRows, missingGrainRows, missingSpendRows,
    rawObservedSpend: grain.recorded_spend == null ? null : Number(grain.recorded_spend),
    campaignAggregationSpend: grain.campaign_aggregation_spend == null ? null : Number(grain.campaign_aggregation_spend),
    hasApprovedSpend: Boolean(spendValue),
  });

  const rows = includeDetails ? grain.campaign_details || [] : [];
  const hasSpend = Boolean(resolved.spendColumn && grainStatus === 'VALID');

  const campaigns = rows.map((row: any) => {
    const impressions = completeMetric(row, 'impressions');
    const reach = completeMetric(row, 'reach');
    const clicks = completeMetric(row, 'clicks');
    const outboundClicks = completeMetric(row, 'outbound_clicks');
    const leads = completeMetric(row, 'recorded_leads');
    const spend = hasSpend && reconciliation.status === 'RECONCILED' && row.recorded_spend != null ? Number(row.recorded_spend || 0) : null;
    const latestBudget = resolved.budgetColumn && row.latest_budget != null ? Number(row.latest_budget || 0) : null;

    return {
      client: row.client_name,
      channel: row.channel || 'Unknown',
      campaign: row.campaign_name || 'Unknown',
      adset: row.adset_name || 'Unknown',
      spend,
      latestBudget,
      impressions,
      reach,
      frequency: commercialRatio(impressions, reach),
      clicks,
      outboundClicks,
      ctr: commercialRatio(clicks, impressions, 100),
      outboundCtr: commercialRatio(outboundClicks, impressions, 100),
      clickToLeadRate: commercialRatio(leads, resolved.outboundClicksColumn ? outboundClicks : clicks, 100),
      leads,
      cpc: spend !== null && clicks > 0 ? Number((spend / clicks).toFixed(2)) : null,
      cpm: spend !== null && impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : null,
      cpl: spend !== null && leads > 0 ? Number((spend / leads).toFixed(2)) : null,
    };
  });

  // Totals share the exact grain-check scope and are independent of the bounded detail table.
  const totals = {
    impressions: completeMetric(grain, 'impressions'),
    reach: completeMetric(grain, 'reach'),
    clicks: completeMetric(grain, 'clicks'),
    outboundClicks: completeMetric(grain, 'outbound_clicks'),
    leads: completeMetric(grain, 'recorded_leads'),
    spend: reconciliation.commercialTotalSpend,
  };
  const measuredSpend = hasSpend && totals.spend !== null;

  const summary = {
    spend: measuredSpend ? Number(totals.spend!.toFixed(2)) : null,
    impressions: totals.impressions,
    reach: resolved.reachColumn && grain.reach != null ? totals.reach : null,
    frequency: commercialRatio(totals.impressions, totals.reach),
    clicks: totals.clicks,
    outboundClicks: resolved.outboundClicksColumn && grain.outbound_clicks != null ? totals.outboundClicks : null,
    leads: totals.leads,
    ctr: commercialRatio(totals.clicks, totals.impressions, 100),
    outboundCtr: commercialRatio(totals.outboundClicks, totals.impressions, 100),
    clickToLeadRate: commercialRatio(totals.leads, resolved.outboundClicksColumn ? totals.outboundClicks : totals.clicks, 100),
    cpc: measuredSpend && totals.clicks > 0 ? Number((totals.spend! / totals.clicks).toFixed(2)) : null,
    cpm: measuredSpend && totals.impressions > 0 ? Number(((totals.spend! / totals.impressions) * 1000).toFixed(2)) : null,
    cpl: measuredSpend && totals.leads > 0 ? Number((totals.spend! / totals.leads).toFixed(2)) : null,
  };

  let comparison: null | {
    spendDelta: number | null;
    leadsDelta: number | null;
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

  const window = matchedPeriodWindow(params.startDate, params.endDate);
  if (window && grainStatus === 'VALID') {
    const { startDate: previousStartDate, endDate: previousEndDate } = window.previous;
    // Reuse the same full-scope aggregation and grain validation in one prior-period snapshot.
    const [priorRows] = await client.query({ query: buildGrainQuery(false), params: { ...queryParams, startDate: previousStartDate, endDate: previousEndDate } });
    const prior = priorRows[0] || {};
    const priorReconciliation = reconcileSpend({
      rowCount: Number(prior.row_count || 0), duplicateGrainRows: Number(prior.duplicate_grain_rows || 0),
      missingGrainRows: Number(prior.missing_grain_rows || 0), missingSpendRows: Number(prior.missing_spend_rows || 0),
      rawObservedSpend: prior.recorded_spend == null ? null : Number(prior.recorded_spend),
      campaignAggregationSpend: prior.campaign_aggregation_spend == null ? null : Number(prior.campaign_aggregation_spend), hasApprovedSpend: Boolean(spendValue),
    });
    if (priorReconciliation.status === 'INVALID_GRAIN') {
      comparisonReason = 'Matched-period comparison withheld because the prior period violates the approved spend grain.';
    } else {
      const priorSpend = priorReconciliation.commercialTotalSpend;
      if (spendValue && priorReconciliation.status !== 'RECONCILED') comparisonReason = `Prior spend comparison unavailable: ${priorReconciliation.reason}`;
      const priorImpressions = completeMetric(prior, 'impressions'), priorClicks = completeMetric(prior, 'clicks'), priorLeads = completeMetric(prior, 'recorded_leads');
      const priorCtr = commercialRatio(priorClicks, priorImpressions, 100);
      const priorCpc = priorSpend !== null && priorClicks > 0 ? priorSpend / priorClicks : null;
      const priorCpm = priorSpend !== null && priorImpressions > 0 ? (priorSpend / priorImpressions) * 1000 : null;
      const priorCpl = priorSpend !== null && priorLeads > 0 ? priorSpend / priorLeads : null;
      const pct = (current: number | null, previous: number | null) => {
        const value = compareMetric(current, previous, 'currency').percentageChange;
        return value === null ? null : Number(value.toFixed(1));
      };
      comparison = {
        spendDelta: summary.spend !== null && priorSpend !== null ? Number((summary.spend - priorSpend).toFixed(2)) : null,
        leadsDelta: summary.leads !== null && priorLeads !== null ? summary.leads - priorLeads : null, spendDeltaPct: pct(summary.spend, priorSpend),
        cpcDeltaPct: pct(summary.cpc, priorCpc), cpmDeltaPct: pct(summary.cpm, priorCpm), cplDeltaPct: pct(summary.cpl, priorCpl),
        ctrDeltaPp: summary.ctr !== null && priorCtr !== null ? Number((summary.ctr - priorCtr).toFixed(2)) : null,
        leadsDeltaPct: pct(summary.leads, priorLeads), previousStartDate, previousEndDate,
      };
    }
  } else if (params.startDate && params.endDate) {
    comparisonReason = grainStatus !== 'VALID' ? 'Current spend grain is invalid; matched-period comparison is withheld.' : 'An explicit valid date range of at most 366 days is required for an equal-length comparison.';
  }

  const reason = grainStatus !== 'VALID'
    ? `Spend is withheld because the API table violates the configured spend grain with ${duplicateGrainRows.toLocaleString()} duplicate rows.`
    : reconciliation.status !== 'RECONCILED' && spendValue ? reconciliation.reason
    : hasSpend
      ? `Recorded media spend is sourced from the approved API-table field ${resolved.spendColumn}. CPC, CPM and CPL are derived from the same spend population.`
      : resolved.spendResolutionReason || 'No approved spend field from the tenant marketing contract exists in the current API-table schema. Budget remains a separate planning value.';

  return {
    campaigns,
    reconciliation,
    validationStatus: 'NOT_VERIFIED',
    denominatorDiagnostics: Object.entries(metricColumns).filter(([, field]) => Boolean(field)).map(([metric]) => ({ metric, missingRows: Number(grain[`missing_${metric}_rows`] || 0), rows: Number(grain.row_count || 0) })),
    filterCompatibility: { date: 'both: marketing date / operational capture cohort', client: 'both: explicit tenant mappings', campaign: contract.attribution.marketingCampaignField && contract.attribution.leadCampaignField ? 'both: configured key only' : 'marketing only', channel: 'marketing only', adset: 'marketing only', source: contract.attribution.status === 'ACTIVE' ? 'attribution endpoint only' : 'operations only', vendor: 'operations only', grade: 'operations only', medium: 'operations only', agent: 'operations only', cli: 'operations only' },
    reachDefinition: 'Sum of reported row-level reach. Audience overlap across dates/adsets is not deduplicated; this is not unique period reach.',
    funnelStatus: { status: 'UNAVAILABLE', reason: 'Campaign/adset outcomes require approved campaign, channel and adset equivalence at this detail grain. Source-level attribution must not be replicated onto every adset.' },
    detailScope: {
      totalCampaignGroups: Number(grain.campaign_group_count || 0),
      displayedCampaignGroups: campaigns.length,
      rowLimit: detailLimit,
      truncated: Number(grain.campaign_group_count || 0) > campaigns.length,
    },
    metricDefinitions: {
      cpl: { label: 'Platform CPL', numerator: 'Incurred media spend', denominator: 'Recorded platform lead events (actions_lead)' },
      ledgerCpl: { status: 'UNAVAILABLE', reason: 'A matched ledger-lead population and attribution mapping are required.' },
    },
    summary,
    comparison,
    comparisonReason,
    status: grainStatus !== 'VALID' ? 'INVALID_GRAIN' : measuredSpend ? 'OBSERVED' : reconciliation.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'PARTIAL',
    reason,
    mappingStatus: contract.mappingStatus,
    grainStatus,
    grainDiagnostics: {
      rowCount: Number(grain.row_count || 0),
      distinctGrainCount: Number(grain.distinct_grain_count || 0),
      duplicateGrainRows,
      missingGrainRows,
      missingSpendRows,
      fields: contract.spendGrainFields,
    },
    spendSource: {
      status: measuredSpend ? 'OBSERVED' : 'UNAVAILABLE',
      column: resolved.spendColumn,
      table: contract.table,
      reason: measuredSpend ? null : reason,
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

export function buildCampaignRowsAndSummary(rows: any[], resolved: any, grainStatus: string) {
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
      ctr: percentOrNull(clicks, impressions, 2),
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
    ctr: percentOrNull(totals.clicks, totals.impressions, 2),
    outboundCtr: resolved.outboundClicksColumn && totals.impressions > 0 ? Number(((totals.outboundClicks / totals.impressions) * 100).toFixed(2)) : null,
    clickToLeadRate: resolved.outboundClicksColumn && totals.outboundClicks > 0
      ? Number(((totals.leads / totals.outboundClicks) * 100).toFixed(2))
      : totals.clicks > 0 ? Number(((totals.leads / totals.clicks) * 100).toFixed(2)) : null,
    cpc: hasSpend && totals.clicks > 0 ? Number((totals.spend / totals.clicks).toFixed(2)) : null,
    cpm: hasSpend && totals.impressions > 0 ? Number(((totals.spend / totals.impressions) * 1000).toFixed(2)) : null,
    cpl: hasSpend && totals.leads > 0 ? Number((totals.spend / totals.leads).toFixed(2)) : null,
  };

  return { campaigns, summary, totals, hasSpend };
}
