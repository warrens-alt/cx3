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

export async function fetchOperatingControls(params: Record<string, any> = {}, forceRefresh = false): Promise<OperatingControlsData> {
  return fetchOffernetJson<OperatingControlsData>(`/api/analytics/offernet/operating-controls${buildQueryString(params)}`, forceRefresh);
}

export async function fetchOverview(params: Record<string, any> = {}, forceRefresh = false): Promise<OverviewData> {
  return fetchOffernetJson<OverviewData>(`/api/analytics/offernet/overview${buildQueryString(params)}`, forceRefresh);
}

export async function fetchRootCause(params: Record<string, any> = {}, forceRefresh = false): Promise<RootCauseData> {
  return fetchOffernetJson<RootCauseData>(`/api/analytics/offernet/root-cause${buildQueryString(params)}`, forceRefresh);
}

export async function fetchFunnel(params: Record<string, any> = {}, forceRefresh = false): Promise<FunnelData> {
  return fetchOffernetJson<FunnelData>(`/api/analytics/offernet/funnel${buildQueryString(params)}`, forceRefresh);
}

export async function fetchSpeedToLead(params: Record<string, any> = {}, forceRefresh = false): Promise<SpeedToLeadData> {
  return fetchOffernetJson<SpeedToLeadData>(`/api/analytics/offernet/speed-to-lead${buildQueryString(params)}`, forceRefresh);
}

export async function fetchContactStrategy(params: Record<string, any> = {}, forceRefresh = false): Promise<ContactStrategyData> {
  return fetchOffernetJson<ContactStrategyData>(`/api/analytics/offernet/contact-strategy${buildQueryString(params)}`, forceRefresh);
}

export async function fetchVendorQuality(params: Record<string, any> = {}, forceRefresh = false): Promise<VendorQualityData> {
  return fetchOffernetJson<VendorQualityData>(`/api/analytics/offernet/vendor-quality${buildQueryString(params)}`, forceRefresh);
}

export async function fetchTemporal(params: Record<string, any> = {}, forceRefresh = false): Promise<TemporalData> {
  return fetchOffernetJson<TemporalData>(`/api/analytics/offernet/temporal${buildQueryString(params)}`, forceRefresh);
}

export async function fetchSalesActivation(params: Record<string, any> = {}, forceRefresh = false): Promise<SalesActivationData> {
  return fetchOffernetJson<SalesActivationData>(`/api/analytics/offernet/sales-activation${buildQueryString(params)}`, forceRefresh);
}

export async function fetchCommercial(params: Record<string, any> = {}, forceRefresh = false): Promise<CommercialData> {
  return fetchOffernetJson<CommercialData>(`/api/analytics/offernet/commercial${buildQueryString(params)}`, forceRefresh);
}

export async function fetchDataIntegrity(params: Record<string, any> = {}, forceRefresh = false): Promise<DataIntegrityData> {
  return fetchOffernetJson<DataIntegrityData>(`/api/analytics/offernet/data-integrity${buildQueryString(params)}`, forceRefresh);
}

export async function fetchAgentPerformance(params: Record<string, any> = {}, forceRefresh = false): Promise<AgentPerformanceData> {
  return fetchOffernetJson<AgentPerformanceData>(`/api/analytics/offernet/agent-performance${buildQueryString(params)}`, forceRefresh);
}

export async function fetchMarketingDiscovery(params: Record<string, any> = {}, forceRefresh = false): Promise<MarketingDiscoveryData> {
  return fetchOffernetJson<MarketingDiscoveryData>(`/api/analytics/offernet/marketing-discovery${buildQueryString(params)}`, forceRefresh);
}

export async function fetchMarketingRootCause(params: Record<string, any> = {}, forceRefresh = false): Promise<MarketingRootCauseData> {
  return fetchOffernetJson<MarketingRootCauseData>(`/api/analytics/offernet/marketing-root-cause${buildQueryString(params)}`, forceRefresh);
}

export async function fetchMarketingAttribution(params: Record<string, any> = {}, forceRefresh = false): Promise<MarketingAttributionData> {
  return fetchOffernetJson<MarketingAttributionData>(`/api/analytics/offernet/marketing-attribution${buildQueryString(params)}`, forceRefresh);
}

export async function fetchSourceObservability(params: Record<string, any> = {}, forceRefresh = false): Promise<SourceObservabilityData> {
  return fetchOffernetJson<SourceObservabilityData>(`/api/analytics/offernet/source-observability${buildQueryString(params)}`, forceRefresh);
}

export async function fetchCampaigns(params: Record<string, any> = {}, forceRefresh = false): Promise<CampaignData> {
  return fetchOffernetJson<CampaignData>(`/api/analytics/offernet/campaigns${buildQueryString(params)}`, forceRefresh);
}

export async function fetchAiInsights(params: Record<string, any> = {}, forceRefresh = false): Promise<AiInsightsData> {
  return fetchOffernetJson<AiInsightsData>(`/api/analytics/offernet/ai-insights${buildQueryString(params)}`, forceRefresh);
}

export async function fetchRawLeads(params: Record<string, any> = {}, forceRefresh = false): Promise<RawLeadsData> {
  return fetchOffernetJson<RawLeadsData>(`/api/analytics/offernet/raw-leads${buildQueryString(params)}`, forceRefresh);
}

export async function fetchLeadTimeline(leadId: string, params: Record<string, any> = {}, forceRefresh = false): Promise<LeadTimelineData> {
  return fetchOffernetJson<LeadTimelineData>(`/api/analytics/offernet/lead-timeline/${encodeURIComponent(leadId)}${buildQueryString(params)}`, forceRefresh);
}

export async function fetchClientOperationalConfig(forceRefresh = false): Promise<any> {
  return fetchOffernetJson<any>(`/api/analytics/offernet/client-config`, forceRefresh);
}

export async function fetchCliPerformance(params: Record<string, any> = {}, forceRefresh = false): Promise<any> {
  return fetchOffernetJson<any>(`/api/analytics/cli-performance${buildQueryString(params)}`, forceRefresh);
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
