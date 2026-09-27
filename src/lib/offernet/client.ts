import type {
  OperatingControlsData,
  OverviewData,
  RootCauseData,
  FunnelData,
  SpeedToLeadData,
  ContactStrategyData,
  VendorQualityData,
  TemporalData,
  SalesActivationData,
  CommercialData,
  DataIntegrityData,
  AgentPerformanceData,
  CampaignData,
  MarketingDiscoveryData,
  MarketingRootCauseData,
  MarketingAttributionData,
  SourceObservabilityData,
  AiInsightsData,
  RawLeadsData,
  LeadTimelineData
} from './types';
import { fetchOffernetJson, buildQueryString } from './cache';
import type { ExceptionAnalyticsData } from '../../../contracts/exceptionAnalytics';
import type { OffershopProcessOverview } from '../../../server/analytics/process/offershopProcess';
import type { ReadOnlyRuleSimulationRequest, ReadOnlyRuleSimulationResult } from '../../../contracts/offershopProcess';

export async function fetchExceptions(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<ExceptionAnalyticsData> {
  return fetchOffernetJson<ExceptionAnalyticsData>(`/api/analytics/offernet/exceptions${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchOperatingControls(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<OperatingControlsData> {
  return fetchOffernetJson<OperatingControlsData>(`/api/analytics/offernet/operating-controls${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchOverview(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<OverviewData> {
  return fetchOffernetJson<OverviewData>(`/api/analytics/offernet/overview${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchRootCause(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<RootCauseData> {
  return fetchOffernetJson<RootCauseData>(`/api/analytics/offernet/root-cause${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchFunnel(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<FunnelData> {
  return fetchOffernetJson<FunnelData>(`/api/analytics/offernet/funnel${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchSpeedToLead(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<SpeedToLeadData> {
  return fetchOffernetJson<SpeedToLeadData>(`/api/analytics/offernet/speed-to-lead${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchContactStrategy(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<ContactStrategyData> {
  return fetchOffernetJson<ContactStrategyData>(`/api/analytics/offernet/contact-strategy${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchVendorQuality(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<VendorQualityData> {
  return fetchOffernetJson<VendorQualityData>(`/api/analytics/offernet/vendor-quality${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchTemporal(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<TemporalData> {
  return fetchOffernetJson<TemporalData>(`/api/analytics/offernet/temporal${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchSalesActivation(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<SalesActivationData> {
  return fetchOffernetJson<SalesActivationData>(`/api/analytics/offernet/sales-activation${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchCommercial(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<CommercialData> {
  return fetchOffernetJson<CommercialData>(`/api/analytics/offernet/commercial${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchDataIntegrity(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<DataIntegrityData> {
  return fetchOffernetJson<DataIntegrityData>(`/api/analytics/offernet/data-integrity${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchAgentPerformance(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<AgentPerformanceData> {
  return fetchOffernetJson<AgentPerformanceData>(`/api/analytics/offernet/agent-performance${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchMarketingDiscovery(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<MarketingDiscoveryData> {
  return fetchOffernetJson<MarketingDiscoveryData>(`/api/analytics/offernet/marketing-discovery${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchMarketingRootCause(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<MarketingRootCauseData> {
  return fetchOffernetJson<MarketingRootCauseData>(`/api/analytics/offernet/marketing-root-cause${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchMarketingAttribution(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<MarketingAttributionData> {
  return fetchOffernetJson<MarketingAttributionData>(`/api/analytics/offernet/marketing-attribution${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchSourceObservability(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<SourceObservabilityData> {
  return fetchOffernetJson<SourceObservabilityData>(`/api/analytics/offernet/source-observability${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchCampaigns(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<CampaignData> {
  return fetchOffernetJson<CampaignData>(`/api/analytics/offernet/campaigns${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchAiInsights(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<AiInsightsData> {
  return fetchOffernetJson<AiInsightsData>(`/api/analytics/offernet/ai-insights${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchRawLeads(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<RawLeadsData> {
  return fetchOffernetJson<RawLeadsData>(`/api/analytics/offernet/raw-leads${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchLeadTimeline(leadId: string, params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<LeadTimelineData> {
  return fetchOffernetJson<LeadTimelineData>(`/api/analytics/offernet/lead-timeline/${encodeURIComponent(leadId)}${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchClientOperationalConfig(forceRefresh = false, signal?: AbortSignal): Promise<any> {
  return fetchOffernetJson<any>(`/api/analytics/offernet/client-config`, forceRefresh, signal);
}

export async function fetchCliPerformance(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<any> {
  return fetchOffernetJson<any>(`/api/analytics/cli-performance${buildQueryString(params)}`, forceRefresh, signal);
}

export async function importCliReport(csvText: string, filename: string | undefined, clientId: string): Promise<{ success: boolean; message: string; count: number; anomalies: any[] }> {
  const res = await fetch('/api/analytics/cli-performance/import', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, csvText, filename }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    const errorMsg = data.errors ? data.errors.join('; ') : data.error || 'Failed to import CLI report';
    throw new Error(errorMsg);
  }
  return data;
}

export async function loadSampleCliDataset(clientId: string): Promise<{ success: boolean; message: string; count: number }> {
  const res = await fetch('/api/analytics/cli-performance/load-sample', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to load sample benchmark CLI dataset');
  }
  return data;
}

export async function clearCliImport(clientId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/analytics/cli-performance/import?clientId=${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to clear imported CLI report');
  }
  return data;
}

export async function fetchOffershopFlow(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<OffershopProcessOverview> {
  return fetchOffernetJson<OffershopProcessOverview>(`/api/analytics/offernet/offershop-flow${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchOffershopStage(stageId: string, params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<any> {
  return fetchOffernetJson<any>(`/api/analytics/offernet/offershop-stage/${encodeURIComponent(stageId)}${buildQueryString(params)}`, forceRefresh, signal);
}

export async function simulateOffershopRule(simulationReq: ReadOnlyRuleSimulationRequest, params: Record<string, any> = {}): Promise<ReadOnlyRuleSimulationResult> {
  const res = await fetch(`/api/analytics/offernet/offershop-simulation${buildQueryString(params)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(simulationReq),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to execute read-only rule simulation');
  }
  return data.data;
}
