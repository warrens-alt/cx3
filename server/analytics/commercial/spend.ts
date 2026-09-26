import type { OffernetQueryParams } from '../common/types';
import { getExecutiveOverview } from '../overview/service';
import { getClientCampaignAnalytics } from '../campaigns/performance';

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
