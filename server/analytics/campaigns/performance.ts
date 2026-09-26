import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import { RequestError } from '../../bigquery/filters';
import { safeWarehouseColumn } from '../common/warehouse';
import {
  resolveMarketingContract,
  validateMarketingSpendGrain,
  marketingTenantFilter,
  marketingSpendExpression,
} from '../common/marketing';
import type { OffernetQueryParams } from '../common/types';

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
  const campaignGroupExpression = `TO_JSON_STRING(STRUCT(${clientField}, ${channelField}, ${campaignField}, ${adsetField}))`;
  const detailLimit = 250;
  const grainQuery = `
    SELECT
      COUNT(*) AS row_count,
      COUNT(DISTINCT ${grainExpression}) AS distinct_grain_count,
      COUNT(*) - COUNT(DISTINCT ${grainExpression}) AS duplicate_grain_rows,
      COUNT(DISTINCT ${campaignGroupExpression}) AS campaign_group_count,
      SUM(SAFE_CAST(${impressionsField} AS FLOAT64)) AS impressions,
      ${reachField ? `SUM(SAFE_CAST(${reachField} AS FLOAT64))` : 'CAST(NULL AS FLOAT64)'} AS reach,
      SUM(SAFE_CAST(${clicksField} AS FLOAT64)) AS clicks,
      ${outboundClicksField ? `SUM(SAFE_CAST(${outboundClicksField} AS FLOAT64))` : 'CAST(NULL AS FLOAT64)'} AS outbound_clicks,
      SUM(SAFE_CAST(${leadsField} AS FLOAT64)) AS recorded_leads,
      ${spendValue ? `SUM(${spendValue})` : 'CAST(NULL AS FLOAT64)'} AS recorded_spend
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
    ORDER BY recorded_leads DESC, client_name, channel, campaign_name, adset_name
    LIMIT ${detailLimit}
  `;

  const [rows] = await client.query({ query, params: queryParams });
  const hasSpend = Boolean(resolved.spendColumn && grainStatus === 'VALID');

  const campaigns = rows.map((row: any) => {
    const impressions = Number(row.impressions || 0);
    const reach = row.reach === null || row.reach === undefined ? null : Number(row.reach || 0);
    const clicks = Number(row.clicks || 0);
    const outboundClicks = row.outbound_clicks === null || row.outbound_clicks === undefined ? null : Number(row.outbound_clicks || 0);
    const leads = Number(row.recorded_leads || 0);
    const spend = hasSpend && row.recorded_spend != null ? Number(row.recorded_spend || 0) : null;
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

  // Totals share the exact grain-check scope and are independent of the bounded detail table.
  const totals = {
    impressions: Number(grain.impressions || 0),
    reach: Number(grain.reach || 0),
    clicks: Number(grain.clicks || 0),
    outboundClicks: Number(grain.outbound_clicks || 0),
    leads: Number(grain.recorded_leads || 0),
    spend: grain.recorded_spend == null ? null : Number(grain.recorded_spend),
  };
  const measuredSpend = hasSpend && totals.spend !== null;

  const summary = {
    spend: measuredSpend ? Number(totals.spend!.toFixed(2)) : null,
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
    cpc: measuredSpend && totals.clicks > 0 ? Number((totals.spend! / totals.clicks).toFixed(2)) : null,
    cpm: measuredSpend && totals.impressions > 0 ? Number(((totals.spend! / totals.impressions) * 1000).toFixed(2)) : null,
    cpl: measuredSpend && totals.leads > 0 ? Number((totals.spend! / totals.leads).toFixed(2)) : null,
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
        const priorSpend = hasSpend && prior.recorded_spend != null ? Number(prior.recorded_spend || 0) : null;
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
