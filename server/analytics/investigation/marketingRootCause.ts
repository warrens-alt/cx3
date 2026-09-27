import { matchedPeriodWindow } from '../../../contracts/periodComparison';
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
import { getClientCampaignAnalytics } from '../campaigns/performance';
import type { OffernetQueryParams } from '../common/types';

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

  const currentCampaign = await getClientCampaignAnalytics(params, { includeDetails: false });
  if (!currentCampaign.summary) {
    return { status: currentCampaign.status, reason: currentCampaign.reason, metric: null, dimensions: [], drivers: [] };
  }
  if (currentCampaign.summary[metric as keyof typeof currentCampaign.summary] == null) {
    return { status: 'UNAVAILABLE', reason: currentCampaign.reason, metric: null, dimensions: [], drivers: [] };
  }

  if (currentCampaign.grainStatus !== 'VALID' || currentCampaign.comparisonReason) {
    return { status: 'NOT_VERIFIED', reason: currentCampaign.comparisonReason || currentCampaign.reason, metric: null, dimensions: [], drivers: [] };
  }
  const window = matchedPeriodWindow(params.startDate, params.endDate);
  if (!window) throw new RequestError('Marketing root-cause date range must be between 1 and 366 days', 422);
  const { startDate: previousStartDate, endDate: previousEndDate } = window.previous;

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

  for (const [value, field, parameter] of [[params.channel, channelField, 'channel'], [params.adset, adsetField, 'adset']] as const) {
    if (value) { conditions.push(`LOWER(CAST(${field} AS STRING)) = LOWER(@${parameter})`); queryParams[parameter] = value; }
  }

  const grainKey = `TO_JSON_STRING(STRUCT(${contract.spendGrainFields.map(safeWarehouseColumn).join(', ')}))`;
  const query = `
    WITH scoped_marketing AS (
      SELECT
        * EXCEPT(channel_adset_name),
        COALESCE(NULLIF(TRIM(channel_adset_name), ''), CASE WHEN LOWER(channel) = 'google' THEN '[google_campaign_grain]' ELSE NULL END) AS channel_adset_name
      FROM \`${contract.table}\`
      WHERE ${conditions.join(' AND ')}
    ),
    base AS (
      SELECT
        DATE(${dateField}) AS report_date,
        ${grainKey} AS grain_key,
        (${marketingMissingGrainExpression(contract)}) AS incomplete_grain,
        COALESCE(CAST(${channelField} AS STRING), 'Unknown') AS channel,
        COALESCE(CAST(${campaignField} AS STRING), 'Unknown') AS campaign,
        COALESCE(CAST(${adsetField} AS STRING), 'Unknown') AS adset,
        SAFE_CAST(${impressionsField} AS NUMERIC) AS impressions,
        SAFE_CAST(${clicksField} AS NUMERIC) AS clicks,
        SAFE_CAST(${leadsField} AS NUMERIC) AS leads,
        ${spendValue ? spendValue : 'CAST(NULL AS FLOAT64)'} AS spend
      FROM scoped_marketing
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
    snapshot_guard AS (
      SELECT period,
        COUNT(*) - COUNT(DISTINCT grain_key) AS duplicate_grain_rows,
        COUNTIF(incomplete_grain) AS incomplete_grain_rows,
        COUNTIF(spend IS NULL) AS missing_spend_rows,
        COUNTIF(impressions IS NULL OR impressions < 0) AS missing_impressions_rows,
        COUNTIF(clicks IS NULL OR clicks < 0) AS missing_clicks_rows,
        COUNTIF(leads IS NULL OR leads < 0) AS missing_leads_rows
      FROM periodized WHERE period IS NOT NULL GROUP BY period
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
    SELECT dimensional.*, snapshot_guard.* EXCEPT(period) FROM dimensional JOIN snapshot_guard USING (period)
  `;

  const [rows] = await client.query({ query, params: queryParams });
  if (rows.some((row: any) => Number(row.duplicate_grain_rows || 0) > 0 || Number(row.incomplete_grain_rows || 0) > 0)) {
    return { status: 'INVALID_GRAIN', reason: 'Media diagnostic snapshot contains duplicate or incomplete spend grain keys; drivers are withheld.', metric: null, dimensions: [], drivers: [] };
  }
  const requirements: Record<string, string[]> = { spend: ['missing_spend_rows'], cpc: ['missing_spend_rows', 'missing_clicks_rows'],
    cpm: ['missing_spend_rows', 'missing_impressions_rows'], cpl: ['missing_spend_rows', 'missing_leads_rows'], ctr: ['missing_clicks_rows', 'missing_impressions_rows'], leads: ['missing_leads_rows'] };
  if (rows.some((row: any) => requirements[metric].some(field => Number(row[field] || 0) > 0))) {
    return { status: 'UNAVAILABLE', reason: 'Requested media metric has missing or invalid numerator/denominator observations in the current or prior diagnostic snapshot.', metric: null, dimensions: [], drivers: [] };
  }
  const value = (row: any) => {
    const spend = row?.spend === null || row?.spend === undefined ? null : Number(row.spend || 0);
    const impressions = row?.impressions == null ? null : Number(row.impressions);
    const clicks = row?.clicks == null ? null : Number(row.clicks);
    const leads = row?.leads == null ? null : Number(row.leads);
    switch (metric) {
      case 'spend': return spend;
      case 'cpc': return spend !== null && clicks > 0 ? Number((spend / clicks).toFixed(2)) : null;
      case 'cpm': return spend !== null && impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : null;
      case 'cpl': return spend !== null && leads > 0 ? Number((spend / leads).toFixed(2)) : null;
      case 'ctr': return clicks !== null && impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null;
      default: return leads;
    }
  };

  const currentOverall = rows.find((row: any) => row.dimension === 'overall' && row.period === 'current') || {};
  const previousOverall = rows.find((row: any) => row.dimension === 'overall' && row.period === 'previous') || {};
  const currentValue = value(currentOverall);
  const previousValue = value(previousOverall);
  if (currentValue === null || previousValue === null) return { status: 'UNAVAILABLE', reason: 'The requested metric requires observed current and prior values with valid positive denominators.', metric: null, dimensions: [], drivers: [] };
  const delta = currentValue !== null && previousValue !== null
    ? Number((currentValue - previousValue).toFixed(2))
    : null;

  const labels: Record<string, string> = {
    spend: 'Media spend',
    cpc: 'CPC',
    cpm: 'CPM',
    cpl: 'Platform CPL',
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
