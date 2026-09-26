import { compareMetric, matchedPeriodWindow } from '../../../contracts/periodComparison';
import { commercialRatio } from '../../../contracts/commercial';
import { RequestError } from '../../bigquery/filters';
import type { OffernetQueryParams } from '../common/types';
import { getOperationalCommercialSummary } from '../overview/service';
import { getClientCampaignAnalytics } from '../campaigns/performance';
import { getMarketingAttributionAnalytics, unavailableEconomics } from './attribution';

const safeFailure = (error: unknown, fallback: string) => error instanceof RequestError && error.status === 422 ? error.message : fallback;

/** Spend never touches a lead-level join; cross-source ratios require matching approved attribution populations. */
export async function getCommercialAnalytics(params: OffernetQueryParams) {
  const operationalCompatible = !params.campaign && !params.channel && !params.adset;
  const campaignCompatible = !params.vendor && !params.source && !params.medium && !params.grade && !params.agent && !params.cli;
  const [overviewResult, campaignResult, attributionResult] = await Promise.allSettled([
    operationalCompatible ? getOperationalCommercialSummary(params) : Promise.resolve(null),
    campaignCompatible ? getClientCampaignAnalytics(params, { includeDetails: false }) : Promise.resolve(null),
    getMarketingAttributionAnalytics(params),
  ]);
  // An operational query failure must not be turned into a factual zero revenue/lead count.
  const overview = overviewResult.status === 'fulfilled' ? overviewResult.value : null;
  const campaignData = campaignResult.status === 'fulfilled' ? campaignResult.value : null;
  const attribution = attributionResult.status === 'fulfilled' ? attributionResult.value : {
    status: 'UNAVAILABLE', reason: safeFailure(attributionResult.reason, 'Attribution could not be loaded for this scope.'), rows: [], summary: null,
    economics: unavailableEconomics('Attribution unavailable.'),
  };
  const economics = attribution.economics;
  const kpis = overview?.kpis;
  // A source filter can propagate only through the explicitly configured attribution endpoint.
  const mediaSpend = campaignData?.summary?.spend ?? (params.source ? attribution.summary?.totalSpend ?? null : null);
  const spendObserved = mediaSpend !== null;
  const recordedRevenue = kpis?.revenue ?? null;
  const mediaReason = campaignData?.reason || (spendObserved && params.source ? attribution.reason : null) || (campaignResult.status === 'rejected'
    ? safeFailure(campaignResult.reason, 'Marketing evidence could not be loaded for this scope.')
    : !campaignCompatible ? 'Media spend is withheld under operational-only filters without an approved equivalent marketing mapping.' : 'Media spend is unavailable for this scope.');
  const revenueReason = operationalCompatible
    ? overviewResult.status === 'rejected' ? safeFailure(overviewResult.reason, 'Operational evidence could not be loaded for this scope.') : 'Recorded lead-ledger revenue for the selected capture cohort.'
    : 'Recorded cohort revenue is unavailable under campaign/channel/adset filters without equivalent operational dimensions; matched-key revenue is shown separately when available.';
  const reconciliation = campaignData && 'reconciliation' in campaignData ? campaignData.reconciliation : params.source && 'reconciliation' in attribution ? attribution.reconciliation : null;
  const attributionSource = 'spendSource' in attribution ? attribution.spendSource : null;
  const window = matchedPeriodWindow(params.startDate, params.endDate);
  let priorAttribution: Awaited<ReturnType<typeof getMarketingAttributionAnalytics>> | null = null;
  if (window && economics.status === 'AVAILABLE') {
    try { priorAttribution = await getMarketingAttributionAnalytics({ ...params, ...window.previous }); }
    catch { /* Prior evidence is unavailable; never substitute zero or disclose SDK diagnostics. */ }
  }
  const priorEconomics = priorAttribution?.economics;
  const attributionComparison = {
    window,
    spend: compareMetric(attribution.summary?.totalSpend ?? null, priorAttribution?.summary?.totalSpend ?? null, 'currency'),
    costPerSale: compareMetric(economics.spendPerSale, priorEconomics?.spendPerSale ?? null, 'currency'),
    costPerActivation: compareMetric(economics.spendPerActivation, priorEconomics?.spendPerActivation ?? null, 'currency'),
    fetched: compareMetric(economics.fetched, priorEconomics?.fetched ?? null, 'count'),
    sales: compareMetric(economics.sales, priorEconomics?.sales ?? null, 'count'),
    reason: !window ? 'Choose a valid explicit date range for matched-period commercial changes.'
      : economics.status !== 'AVAILABLE' ? 'CPS and operational changes require approved attribution in both matched periods.'
        : priorEconomics?.status !== 'AVAILABLE' ? 'Prior matched attribution is unavailable; CPS and operational changes are withheld.'
          : 'Immediately preceding equal-length capture and marketing periods; matching approved keys are required independently in each period.',
  };


  return {
    status: spendObserved ? 'PARTIAL' : 'UNAVAILABLE',
    reason: spendObserved
      ? 'Observed media spend reconciles at its contracted marketing grain. Funnel costs use only matched approved attribution keys. These are cross-source ratios and are not attribution or full profitability; external billing remains NOT_VERIFIED.'
      : 'Observed spend and its derived costs are unavailable for this scope. Recorded operational revenue remains independent of spend availability.',
    baseline: {
      volume: kpis?.fetchedLeads ?? null,
      cpl: campaignData?.summary?.cpl ?? null, cpc: campaignData?.summary?.cpc ?? null, cpm: campaignData?.summary?.cpm ?? null,
      mediaSpend, conversionRate: kpis?.leadToSaleRate ?? null, revenuePerSale: commercialRatio(recordedRevenue, kpis?.saleLeads),
      revenuePerLead: commercialRatio(recordedRevenue, kpis?.fetchedLeads), revenuePerActivation: commercialRatio(recordedRevenue, kpis?.activatedLeads),
      fixedOverhead: null, revenue: recordedRevenue, totalCost: null, contribution: null, marginPct: null,
      costPerSale: economics.spendPerSale, costPerActivation: economics.spendPerActivation, breakEvenVolume: null,
      // Backward-compatible field names now enforce the same approved matched population as economics.
      blendedCostPerFetchedLead: economics.spendPerFetchedLead, blendedCostPerSale: economics.spendPerSale,
      blendedCostPerActivation: economics.spendPerActivation, revenueToMediaSpendRatio: economics.revenueToSpend,
    },
    revenueReason, economics, attribution, reconciliation,
    mediaComparison: campaignData?.comparison ?? null, attributionComparison,
    grainDiagnostics: campaignData && 'grainDiagnostics' in campaignData ? campaignData.grainDiagnostics : attributionResult.status === 'fulfilled' && 'grain' in attribution ? attribution.grain : null,
    media: {
      status: spendObserved ? 'OBSERVED' : 'UNAVAILABLE', reason: mediaReason,
      spendSourceColumn: campaignData?.spendSource?.column || attributionSource?.column || null, spendSourceTable: campaignData?.spendSource?.table || attributionSource?.table || null,
      platformLeads: campaignData?.summary?.leads ?? null, platformClicks: campaignData?.summary?.clicks ?? null,
      platformImpressions: campaignData?.summary?.impressions ?? null, platformReach: campaignData?.summary?.reach ?? null,
      platformOutboundClicks: campaignData?.summary?.outboundClicks ?? null,
    },
    currency: overview?.currency || 'ZAR',
    pAndLBreakdown: [
      ...(recordedRevenue !== null ? [{ item: 'Recorded Revenue', amount: recordedRevenue, type: 'recorded_revenue' }] : []),
      ...(spendObserved ? [{ item: 'Observed Media Spend', amount: -mediaSpend, type: 'observed_media_spend' }] : []),
    ],
  };
}
