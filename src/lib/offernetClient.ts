export interface OverviewData {
  kpis: {
    fetchedLeads: number;
    deliveredLeads: number;
    deliveryRate: number;
    dialledLeads: number;
    dialRate: number;
    contactedLeads: number;
    contactRate: number;
    qualifiedLeads: number;
    saleLeads: number;
    leadToSaleRate: number;
    contactToSaleRate: number;
    activatedLeads: number;
    activationRate: number;
    totalCalls: number;
    callsPerLead: number;
    callsPerDialledLead: number;
    revenue: number;
    directCost: number;
    deliveryAgentCost: number;
    allocatedCost: number;
    totalCost: number;
    contribution: number;
    marginPct: number;
    costPerSale: number;
    costPerActivation: number;
    revenuePerLead: number;
    breakEvenSales: number;
    actualVsBreakEven: number;
  };
  funnelStages: Array<{
    name: string;
    volume: number;
    rate: number;
    dropoffPct: number;
    itemNo?: number;
    costMetric?: string;
  }>;
  dailyTrends: Array<{
    date: string;
    leads: number;
    delivered: number;
    dialled: number;
    contacted: number;
    sales: number;
    activations: number;
    revenue: number;
  }>;
  comparison: {
    fetchedDelta: number;
    deliveryRateDelta: number;
    dialRateDelta: number;
    contactRateDelta: number;
    saleRateDelta: number;
    activationRateDelta: number;
    revenueDelta: number;
    contributionDelta: number;
  };
  currency: string;
  clientName: string;
}

export interface FunnelData {
  velocity: {
    fetchToDelivery: string;
    deliveryToFirstDial: string;
    firstDialToContact: string;
    contactToSale: string;
    saleToActivation: string;
  };
  byVendor: Array<{
    vendor: string;
    leads: number;
    delivered: number;
    dialled: number;
    contacted: number;
    sales: number;
    activations: number;
  }>;
  bySource: Array<{
    source: string;
    leads: number;
    contacted: number;
    sales: number;
    activations: number;
  }>;
  byGrade: Array<{
    grade: string;
    leads: number;
    contacted: number;
    sales: number;
    activations: number;
  }>;
}

export interface SpeedToLeadData {
  timingStages: Array<{
    stage: string;
    description: string;
    avgSec: number;
    medianSec: number;
    p75Sec: number;
    p90Sec: number;
    avg: string;
    median: string;
    p75: string;
    p90: string;
  }>;
  cohorts: Array<{
    cohort: string;
    leads: number;
    contacted: number;
    contactRate: number;
    sales: number;
    saleRate: number;
    activations: number;
    activationRate: number;
  }>;
  afterHours: Array<{
    type: string;
    leads: number;
    contactRate: number;
    saleRate: number;
    avgTimeToFirstDial: string;
  }>;
}

export interface ContactStrategyData {
  attemptPerformance: Array<{
    bucket: string;
    leads: number;
    sharePct: number;
    contacted: number;
    contactRate: number;
    sales: number;
    saleRate: number;
    activations: number;
    activationRate: number;
    revenue: number;
    callCost: number;
    marginalSales: number;
    marginalCostPerSale: number;
  }>;
  attemptCadence: Array<{
    transition: string;
    avgSpacing: string;
    marginalRpcYield: string;
    costBenefitRatio: string;
  }>;
  noAnswerAnalysis: {
    stopThresholdRecommendation: string;
    diminishingReturnsCutoff: string;
    callbackFollowupRate: string;
    callbackSaleConversion: string;
  };
}

export interface VendorQualityData {
  vendors: Array<{
    vendor: string;
    leads: number;
    deliveryRate: number;
    contactRate: number;
    saleRate: number;
    activationRate: number;
    medianFirstDial: string;
    callsPerLead: number;
    invalidRate: number;
    revenue: number;
    directCost: number;
    deliveryCost: number;
    contribution: number;
    marginPct: number;
  }>;
  sources: Array<{
    source: string;
    leads: number;
    contacted: number;
    sales: number;
    activations: number;
    revenue: number;
  }>;
  grades: Array<{
    grade: string;
    leads: number;
    contacted: number;
    sales: number;
    activations: number;
    revenue: number;
  }>;
  vetting: Array<{
    vetting_color: string;
    leads: number;
    contacted: number;
    sales: number;
    activations: number;
  }>;
}

export interface TemporalData {
  heatmap: Array<{
    dayIndex: number;
    dayName: string;
    hour: number;
    volume: number;
    contactRate: number;
    saleRate: number;
    activationRate: number;
  }>;
  peakWindows: Array<{
    window: string;
    contactRate: string;
    saleIndex: string;
    verdict: string;
  }>;
}

export interface SalesActivationData {
  reconciliation: {
    totalSales: number;
    billableSales: number;
    unbilledSales: number;
    totalActivations: number;
    activationRate: number;
    realizedRevenue: number;
    avgTimeToSale: string;
    avgTimeToActivation: string;
  };
  maturationCurve: Array<{
    day: string;
    activationSharePct: number;
    cumulativePct: number;
  }>;
  byVendor: Array<{
    vendor: string;
    sales: number;
    activations: number;
    revenue: number;
  }>;
}

export interface CommercialData {
  baseline: {
    volume: number;
    cpl: number;
    cpc: number;
    conversionRate: number;
    revenuePerSale: number;
    fixedOverhead: number;
    revenue: number;
    totalCost: number;
    contribution: number;
    marginPct: number;
    costPerSale: number;
    costPerActivation: number;
    breakEvenVolume: number;
  };
  currency: string;
  pAndLBreakdown: Array<{
    item: string;
    amount: number;
    type: string;
  }>;
}

export interface DataIntegrityData {
  overallHealthScore: number;
  healthGrade: string;
  totalRecordsAudited: number;
  checks: Array<{
    checkName: string;
    category: string;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
    evidence: string;
    discrepancyCount: number;
    detail: string;
  }>;
}

export interface AgentPerformanceData {
  agents: Array<{
    agentId: string;
    vendor: string;
    totalCalls: number;
    uniqueLeads: number;
    contactCount: number;
    contactRate: number;
    salesCount: number;
    saleRate: number;
    totalTalkTime: string;
    avgHandleTime: string;
    callbacksBooked: number;
    performanceTier: string;
  }>;
}

export interface CampaignData {
  campaigns: Array<{
    client: string;
    channel: string;
    campaign: string;
    adset: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    leads: number;
    cpc: number;
    cpl: number;
  }>;
}

export interface AiInsightsData {
  source: string;
  insights: Array<{
    category: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    finding: string;
    metricReference: string;
    directive: string;
  }>;
}

export interface RawLeadsData {
  rows: Array<Record<string, any>>;
  limit: number;
  offset: number;
}

export interface LeadTimelineData {
  leadId: string;
  consumerId: number;
  vendor: string;
  source: string;
  grade: string;
  events: Array<{
    stage: string;
    title: string;
    timestamp: string;
    status: 'SUCCESS' | 'INFO' | 'WARNING';
    details: string;
  }>;
}

function buildQueryString(params: Record<string, any>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      q.set(key, String(value));
    }
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function invalidateOffernetCache() {
  memoryCache.clear();
  inFlightRequests.clear();
}

export async function fetchOffernetJson<T>(url: string, forceRefresh = false): Promise<T> {
  const now = Date.now();
  if (!forceRefresh && memoryCache.has(url)) {
    const entry = memoryCache.get(url)!;
    if (now - entry.timestamp < CACHE_TTL_MS) {
      return entry.data as T;
    }
  }

  if (!forceRefresh && inFlightRequests.has(url)) {
    return inFlightRequests.get(url) as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) {
        let errorMsg = `Server request failed with status ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson.error) errorMsg = errJson.error;
        } catch {
          // ignore json parse error
        }
        throw new Error(errorMsg);
      }
      const json = await response.json();
      const result = json.data as T;
      memoryCache.set(url, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, fetchPromise);
  return fetchPromise;
}

export async function fetchOverview(params: Record<string, any> = {}, forceRefresh = false): Promise<OverviewData> {
  return fetchOffernetJson<OverviewData>(`/api/analytics/offernet/overview${buildQueryString(params)}`, forceRefresh);
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

export async function fetchCampaigns(params: Record<string, any> = {}, forceRefresh = false): Promise<CampaignData> {
  return fetchOffernetJson<CampaignData>(`/api/analytics/offernet/campaigns${buildQueryString(params)}`, forceRefresh);
}

export async function fetchAiInsights(params: Record<string, any> = {}, forceRefresh = false): Promise<AiInsightsData> {
  return fetchOffernetJson<AiInsightsData>(`/api/analytics/offernet/ai-insights${buildQueryString(params)}`, forceRefresh);
}

export async function fetchRawLeads(params: Record<string, any> = {}, forceRefresh = false): Promise<RawLeadsData> {
  return fetchOffernetJson<RawLeadsData>(`/api/analytics/offernet/raw-leads${buildQueryString(params)}`, forceRefresh);
}

export async function fetchLeadTimeline(leadId: string, forceRefresh = false): Promise<LeadTimelineData> {
  return fetchOffernetJson<LeadTimelineData>(`/api/analytics/offernet/lead-timeline/${encodeURIComponent(leadId)}`, forceRefresh);
}

export async function fetchClientOperationalConfig(forceRefresh = false): Promise<any> {
  return fetchOffernetJson<any>(`/api/analytics/offernet/client-config`, forceRefresh);
}

export async function fetchCliPerformance(params: Record<string, any> = {}, forceRefresh = false): Promise<any> {
  return fetchOffernetJson<any>(`/api/analytics/cli-performance${buildQueryString(params)}`, forceRefresh);
}

export async function importCliReport(csvText: string, filename?: string): Promise<{ success: boolean; message: string; count: number; anomalies: any[] }> {
  const res = await fetch('/api/analytics/cli-performance/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvText, filename }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    const errorMsg = data.errors ? data.errors.join('; ') : data.error || 'Failed to import CLI report';
    throw new Error(errorMsg);
  }
  return data;
}

export async function loadSampleCliDataset(): Promise<{ success: boolean; message: string; count: number }> {
  const res = await fetch('/api/analytics/cli-performance/load-sample', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to load sample benchmark CLI dataset');
  }
  return data;
}

export async function clearCliImport(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/analytics/cli-performance/import', {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to clear imported CLI report');
  }
  return data;
}

