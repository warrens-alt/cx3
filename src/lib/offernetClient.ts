import type { MatchedPeriodWindow, MetricComparison } from '../../contracts/periodComparison';
import type { AttributedEconomics, SpendReconciliation } from '../../contracts/commercial';
import type { ExceptionAnalyticsData, ExceptionPopulation } from '../../contracts/exceptionAnalytics';

export type { MatchedPeriodWindow, MetricComparison, AttributedEconomics, SpendReconciliation, ExceptionAnalyticsData, ExceptionPopulation };

export interface OperatingControlsData {
  summary: {
    unrecordedCallLeads?: number;
    totalLeads: number;
    deliveredLeads: number;
    dialledLeads: number;
    zeroCallLeads: number;
    oneCallLeads: number;
    multiCallLeads: number;
    highAttemptNoRpcLeads: number;
    singleAttemptSharePct: number | null;
    multiAttemptSharePct: number | null;
    dispositionCompletenessPct: number | null;
    afterHoursLeads: number;
    afterHoursSharePct: number | null;
    weekendLeads: number;
    weekendSharePct: number | null;
    sla15Rate: number | null;
    sla60Rate: number | null;
    awaitingFirstDial: number;
    oldestDeliveryWait: string;
    captureToDialMedian: string;
    captureToDialP90: string;
    captureWithin15mRate: number | null;
    captureWithin60mRate: number | null;
    activationBacklog14d: number;
    afterHoursRpcRate: number | null;
    operatingHoursRpcRate: number | null;
    afterHoursSaleRate: number | null;
    operatingHoursSaleRate: number | null;
  };
  attemptBuckets: Array<{
    bucket: string;
    leads: number;
    sharePct: number | null;
    contacted: number;
    contactRate: number | null;
    sales: number;
    saleRate: number | null;
    activations: number;
  }>;
  slaBands: Array<{
    band: string;
    leads: number;
    sharePct: number | null;
    contactRate: number | null;
    saleRate: number | null;
  }>;
  activationAgeing: Array<{ bucket: string; leads: number }>;
  hourlyFlow: Array<{ hour: number; captured: number; firstDials: number }>;
  dailyTurnaround: Array<{
    date: string;
    leads: number;
    dialled: number;
    undialled: number;
    median: string;
    p90: string;
    within15mRate: number | null;
    within60mRate: number | null;
  }>;
  vendorControls: Array<{
    vendor: string;
    leads: number;
    oneCallSharePct: number | null;
    highAttemptNoRpc: number;
    dispositionCompletenessPct: number | null;
    sla15Rate: number | null;
    medianFirstDial: string;
    rpcRate: number | null;
    leadToSaleRate: number | null;
  }>;
  dataCompleteness: {
    missingSource: number;
    missingGrade: number;
    missingVendor: number;
    missingDisposition: number;
  };
  operatingContext: {
    timezone: string;
    start: string;
    end: string;
    workdays: number[];
  };
  methodology: {
    callCount: string;
    vendor: string;
    operatingHours: string;
    captureTurnaround: string;
    realtimeDialler: string;
  };
  validationStatus: string;
}

export interface OverviewData {
  kpis: {
    fetchedLeads: number;
    deliveredLeads: number;
    deliveryRate: number | null;
    dialledLeads: number;
    dialRate: number | null;
    contactedLeads: number;
    contactRate: number | null;
    qualifiedLeads: number | null;
    saleLeads: number;
    leadToSaleRate: number | null;
    contactToSaleRate: number | null;
    activatedLeads: number;
    activationRate: number | null;
    totalCalls: number | null;
    recordedCallsSubtotal?: number;
    unrecordedCallLeads?: number;
    callsPerLead: number | null;
    callsPerDialledLead: number | null;
    revenue: number | null;
    directCost: number | null;
    deliveryAgentCost: number | null;
    allocatedCost: number | null;
    totalCost: number | null;
    contribution: number | null;
    marginPct: number | null;
    costPerSale: number | null;
    costPerActivation: number | null;
    revenuePerLead: number | null;
    breakEvenSales: number | null;
    actualVsBreakEven: number | null;
  };
  funnelStages: Array<{
    key: string;
    name: string;
    volume: number;
    rate: number | null;
    loss: number;
    transitionRate: number | null;
  }>;
  funnelLeak: { from: string; to: string; loss: number; rate: number | null };
  dailyTrends: Array<{
    date: string;
    leads: number;
    delivered: number;
    dialled: number;
    contacted: number;
    sales: number;
    activations: number;
    revenue: number | null;
  }>;
  backlog: {
    awaitingFirstDial: number;
    over60Minutes: number;
    buckets: Array<{ bucket: string; count: number; severity: string }>;
    byVendor: Array<{ vendor: string; awaiting_first_dial: number; over_60m: number }>;
  };
  sla: {
    firstDialTargetMinutes: number;
    complianceRate: number | null;
    medianDeliveryToDial: string;
    p90DeliveryToDial: string;
  };
  attention: Array<{
    id: string;
    title: string;
    value: number;
    severity: 'high' | 'medium' | 'low';
    detail: string;
    path: string;
  }>;
  comparison: {
    fetchedDelta: number | null;
    deliveryRateDelta: number | null;
    dialRateDelta: number | null;
    contactRateDelta: number | null;
    saleRateDelta: number | null;
    activationRateDelta: number | null;
    revenueDelta: number | null;
    contributionDelta: null;
  } | null;
  comparisonWindow: { startDate: string; endDate: string } | null;
  commercialStatus: string;
  commercialReason: string;
  validationStatus: string;
  currency: string;
  clientName: string;
  timezone?: string;
  generatedAt?: string;
  definitionVersion?: string;
}

export interface RootCauseData {
  metric: {
    id: 'fetchedLeads' | 'deliveryRate' | 'dialRate' | 'contactRate' | 'leadToSaleRate' | 'activationRate';
    label: string;
    kind: 'volume' | 'rate';
    currentValue: number | null;
    previousValue: number | null;
    delta: number | null;
    deltaUnit: 'leads' | 'pp';
  };
  currentWindow: { startDate: string; endDate: string };
  previousWindow: { startDate: string; endDate: string };
  dimensions: Array<{
    key: 'vendor' | 'source' | 'grade' | 'leadAge';
    label: string;
    reconciliationStatus?: string;
    residual?: number | null;
    segments: Array<{
      name: string;
      currentValue: number | null;
      previousValue: number | null;
      currentNumerator: number;
      currentDenominator: number;
      previousNumerator: number;
      previousDenominator: number;
      contribution: number | null;
      shareOfDelta: number | null;
    }>;
  }>;
  drivers: Array<{
    name: string;
    dimension: 'vendor' | 'source' | 'grade' | 'leadAge';
    dimensionLabel: string;
    currentValue: number | null;
    previousValue: number | null;
    contribution: number | null;
    shareOfDelta: number | null;
  }>;
  methodology: string;
  validationStatus: string;
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
    delivered: number;
    dialled: number;
    contacted: number;
    sales: number;
    activations: number;
  }>;
  byGrade: Array<{
    grade: string;
    leads: number;
    delivered: number;
    dialled: number;
    contacted: number;
    sales: number;
    activations: number;
  }>;
}

export interface SpeedToLeadData {
  timingStages: Array<{
    stage: string;
    description: string;
    avgSec: number | null;
    medianSec: number | null;
    p75Sec: number | null;
    p90Sec: number | null;
    avg: string;
    median: string;
    p75: string;
    p90: string;
  }>;
  cohorts: Array<{
    cohort: string;
    leads: number;
    contacted: number;
    contactRate: number | null;
    sales: number;
    saleRate: number | null;
    activations: number;
    activationRate: number | null;
  }>;
  afterHours: Array<{
    type: string;
    leads: number;
    contactRate: number | null;
    saleRate: number | null;
    avgTimeToFirstDial: string;
  }>;
  operatingContext?: {
    timezone: string;
    start: string;
    end: string;
    workdays: number[];
  };
}

export interface ContactStrategyData {
  attemptPerformance: Array<{
    bucket: string;
    leads: number;
    sharePct: number | null;
    contacted: number;
    contactRate: number | null;
    sales: number;
    saleRate: number | null;
    activations: number;
    activationRate: number | null;
    revenue: number;
    callCost: number | null;
    marginalSales: number | null;
    marginalCostPerSale: number | null;
  }>;
  attemptCadence: Array<{
    transition: string;
    avgSpacing: string;
    marginalRpcYield: string;
    costBenefitRatio: string;
  }>;
  summary?: {
    totalLeads: number;
    dialledLeads: number;
    unrecordedCallLeads: number;
    zeroCallLeads: number;
    oneCallLeads: number;
    singleAttemptSharePct: number | null;
    multiAttemptLeads: number;
    multiAttemptSharePct: number | null;
    fivePlusCallLeads: number;
    fivePlusNoRpcLeads: number;
  };
  methodology?: string;
  noAnswerAnalysis: {
    status: string;
    reason: string;
    stopThresholdRecommendation: string | null;
    diminishingReturnsCutoff: string | null;
    callbackFollowupRate: string | null;
    callbackSaleConversion: string | null;
  };
}

export interface VendorQualityData {
  commercialStatus?: string;
  commercialReason?: string;
  vendors: Array<{
    vendor: string;
    leads: number;
    deliveryRate: number | null;
    dialRate: number | null;
    contactRate: number | null;
    saleRate: number | null;
    activationRate: number | null;
    medianFirstDial: string;
    medianFirstDialSec: number | null;
    callsPerLead: number | null;
    invalidRate: number | null;
    revenue: number;
    directCost: number | null;
    deliveryCost: number | null;
    contribution: number | null;
    marginPct: number | null;
  }>;
  sources: Array<{
    source: string;
    leads: number;
    delivered: number;
    dialled: number;
    contacted: number;
    sales: number;
    activations: number;
    deliveryRate: number | null;
    dialRate: number | null;
    contactRate: number | null;
    leadToSaleRate: number | null;
    activationRate: number | null;
    invalidRate: number | null;
  }>;
  grades: Array<{
    grade: string;
    leads: number;
    contacted: number;
    sales: number;
    activations: number;
    contactRate: number | null;
    leadToSaleRate: number | null;
    activationRate: number | null;
  }>;
  vetting: Array<{
    vetting_color: string;
    leads: number;
    contacted: number;
    sales: number;
    activations: number;
    contactRate: number | null;
    leadToSaleRate: number | null;
    activationRate: number | null;
  }>;
}

export interface TemporalData {
  heatmap: Array<{
    dayIndex: number;
    dayName: string;
    hour: number;
    volume: number;
    dialled?: number | null;
    rpcUnknownLeads?: number | null;
    dialledRpcUnknownLeads?: number | null;
    contactRate: number | null;
    saleRate: number | null;
    activationRate: number | null;
  }>;
  peakWindows: Array<{
    window: string;
    contactRate: string;
    saleIndex: string;
    verdict: string;
  }>;
  operatingComparison?: Array<{
    type: string;
    leads: number;
    contactRate: number | null;
    saleRate: number | null;
  }>;
  operatingContext?: {
    timezone: string;
    start: string;
    end: string;
    workdays: number[];
  };
  timeDimension?: string;
}

export interface SalesActivationData {
  reconciliation: {
    totalSales: number;
    billableSales: number;
    salesWithRecordedRevenue?: number;
    unbilledSales: number;
    unrecordedRevenueSales?: number;
    totalActivations: number;
    activationRate: number | null;
    realizedRevenue: number | null;
    avgTimeToSale: string;
    avgTimeToActivation: string;
    medianTimeToSale?: string;
    medianTimeToActivation?: string;
  };
  maturationCurve: Array<{
    day: string;
    activationSharePct: number | null;
    cumulativePct: number;
  }>;
  maturationStatus: string;
  maturationReason: string;
  byVendor: Array<{
    dimension?: string;
    segment?: string;
    vendor: string;
    sales: number;
    activations: number;
    revenue: number | null;
    unrecorded_revenue_sales?: number;
  }>;
  bySource?: Array<{
    dimension: string;
    segment: string;
    sales: number;
    activations: number;
    revenue: number | null;
    unrecorded_revenue_sales?: number;
  }>;
  byGrade?: Array<{
    dimension: string;
    segment: string;
    sales: number;
    activations: number;
    revenue: number | null;
    unrecorded_revenue_sales?: number;
  }>;
  activationAgeing?: Array<{
    bucket: string;
    sales: number;
  }>;
  revenueEvidence?: string;
  segmentMethodology?: string;
  clientId?: string;
  clientName?: string;
  currency?: string;
  timezone?: string;
  generatedAt?: string;
  metadata?: {
    clientId?: string;
    clientName?: string;
    currency?: string;
    timezone?: string;
    generatedAt?: string;
    dateBasis?: string;
  };
}

export interface CommercialData {
  mediaComparison?: CampaignData['comparison'];
  attributionComparison?: { window: MatchedPeriodWindow | null; spend: MetricComparison; costPerSale: MetricComparison; costPerActivation: MetricComparison; fetched: MetricComparison; sales: MetricComparison; reason: string };
  status: string;
  reason: string;
  economics?: AttributedEconomics;
  attribution?: MarketingAttributionData;
  reconciliation?: SpendReconciliation | null;
  revenueReason?: string;
  grainDiagnostics?: { rowCount: number; distinctGrainCount: number; duplicateGrainRows: number; missingGrainRows?: number; missingSpendRows?: number; fields?: string[] } | null;
  baseline: {
    volume: number | null;
    cpl: number | null;
    cpc: number | null;
    cpm: number | null;
    mediaSpend: number | null;
    conversionRate: number | null;
    revenuePerSale: number | null;
    revenuePerLead?: number | null;
    revenuePerActivation?: number | null;
    fixedOverhead: number | null;
    revenue: number | null;
    totalCost: number | null;
    contribution: number | null;
    marginPct: number | null;
    costPerSale: number | null;
    costPerActivation: number | null;
    breakEvenVolume: number | null;
    blendedCostPerFetchedLead: number | null;
    blendedCostPerSale: number | null;
    blendedCostPerActivation: number | null;
    revenueToMediaSpendRatio: number | null;
  };
  media: {
    status: string;
    reason: string;
    spendSourceColumn: string | null;
    spendSourceTable: string | null;
    platformLeads: number | null;
    platformClicks: number | null;
    platformImpressions: number | null;
    platformReach?: number | null;
    platformOutboundClicks?: number | null;
  };
  currency: string;
  pAndLBreakdown: Array<{
    item: string;
    amount: number;
    type: string;
  }>;
}

export interface DataIntegrityData {
  overallHealthScore: number | null;
  healthGrade: string;
  validationStatus: string;
  reason: string;
  totalRecordsAudited: number;
  sources?: SourceObservabilityData['sources'];
  checks: Array<{
    checkName: string;
    category: string;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN' | 'UNAVAILABLE';
    evidence: string;
    discrepancyCount: number | null;
    detail: string;
  }>;
}

export interface AgentPerformanceData {
  metricAvailabilityReason?: string;
  rankingStatus?: string;
  rankingReason?: string;
  agents: Array<{
    agentId: string;
    vendor: string;
    totalCalls: number;
    uniqueLeads: number;
    contactCount: number | null;
    contactRate: number | null;
    salesCount: number | null;
    rpcSalesCount: number | null;
    saleRate: number | null;
    totalTalkTime: string | null;
    avgHandleTime: string | null;
    callbacksBooked: number | null;
    performanceTier: string | null;
    fieldCoverage?: Record<'rpc' | 'sale' | 'callback' | 'duration' | 'saleAmongRpc', { observedCalls: number | null; totalCalls: number | null }>;
  }>;
}

export interface CampaignData {
  denominatorDiagnostics?: Array<{ metric: string; missingRows: number; rows: number }>;
  reconciliation?: SpendReconciliation;
  reachDefinition?: string;
  funnelStatus?: { status: string; reason: string };
  detailScope?: {
    totalCampaignGroups: number;
    displayedCampaignGroups: number;
    rowLimit: number;
    truncated: boolean;
  };
  metricDefinitions?: {
    cpl: { label: string; numerator: string; denominator: string };
    ledgerCpl: { status: string; reason: string };
  };
  status?: string;
  reason?: string;
  mappingStatus?: string;
  grainStatus?: string;
  grainDiagnostics?: {
    rowCount: number;
    distinctGrainCount: number;
    duplicateGrainRows: number;
    missingGrainRows?: number;
    missingSpendRows?: number;
    fields: string[];
  };
  attribution?: {
    status: string;
    reason?: string | null;
  };
  summary: {
    spend: number | null;
    impressions: number | null;
    reach: number | null;
    frequency: number | null;
    clicks: number | null;
    outboundClicks: number | null;
    leads: number | null;
    ctr: number | null;
    outboundCtr: number | null;
    clickToLeadRate: number | null;
    cpc: number | null;
    cpm: number | null;
    cpl: number | null;
  } | null;
  comparisonReason?: string | null;
  comparison?: {
    spendDelta?: number | null;
    leadsDelta?: number | null;
    spendDeltaPct: number | null;
    cpcDeltaPct: number | null;
    cpmDeltaPct: number | null;
    cplDeltaPct: number | null;
    ctrDeltaPp: number | null;
    leadsDeltaPct: number | null;
    previousStartDate: string;
    previousEndDate: string;
  } | null;
  spendSource?: {
    status: string;
    column: string | null;
    table: string | null;
    reason?: string | null;
  };
  budgetSource?: {
    status: string;
    column: string | null;
    table: string | null;
  };
  campaigns: Array<{
    client: string;
    channel: string;
    campaign: string;
    adset: string;
    spend: number | null;
    latestBudget: number | null;
    impressions: number | null;
    reach: number | null;
    frequency: number | null;
    clicks: number | null;
    outboundClicks: number | null;
    ctr: number | null;
    outboundCtr: number | null;
    clickToLeadRate: number | null;
    leads: number | null;
    cpc: number | null;
    cpm: number | null;
    cpl: number | null;
  }>;
}

export interface MarketingDiscoveryData {
  status: string;
  reason: string;
  contract: null | {
    table: string;
    mappingStatus: string;
    configuredClientNames: string[];
    fields: {
      clientName: string;
      date: string;
      channel: string;
      campaign: string;
      adset: string;
      impressions: string;
      reach: string | null;
      clicks: string;
      outboundClicks: string | null;
      leads: string;
    };
    approvedSpendFields: string[];
    resolvedSpendField: string | null;
    resolvedBudgetField: string | null;
    attribution: {
      status: string;
      marketingSourceField?: string;
      leadSourceField?: string;
      marketingCampaignField?: string;
      leadCampaignField?: string;
      notes?: string;
    };
  };
  schema: null | {
    columns: string[];
    missingRequired: string[];
  };
  availableClientNames: Array<{
    value: string;
    rows: number;
    earliestDate: string | null;
    latestDate: string | null;
  }>;
}

export interface MarketingRootCauseData {
  status: string;
  reason?: string;
  metric: null | {
    id: 'spend' | 'cpc' | 'cpm' | 'cpl' | 'ctr' | 'leads';
    label: string;
    unit: 'currency' | 'pp' | 'leads';
    currentValue: number | null;
    previousValue: number | null;
    delta: number | null;
  };
  currentWindow?: { startDate: string; endDate: string };
  previousWindow?: { startDate: string; endDate: string };
  dimensions: Array<{
    key: 'channel' | 'campaign' | 'adset';
    label: string;
    segments: Array<{
      name: string;
      currentValue: number | null;
      previousValue: number | null;
      delta: number | null;
    }>;
  }>;
  drivers: Array<{
    name: string;
    dimension: 'channel' | 'campaign' | 'adset';
    dimensionLabel: string;
    currentValue: number | null;
    previousValue: number | null;
    delta: number | null;
  }>;
  methodology?: string;
  validationStatus?: string;
}

export interface MarketingAttributionData {
  economics?: AttributedEconomics;
  detailScope?: { totalKeys: number; displayedKeys: number; rowLimit: number; truncated: boolean };
  reconciliationStatus?: string;
  validationStatus?: string;
  status: string;
  reason: string;
  summary?: {
    totalSpend: number;
    matchedSpend: number;
    unmatchedMarketingSpend: number;
    matchedSpendSharePct: number | null;
    matchedKeys: number;
    marketingOnlyKeys: number;
    operationsOnlyKeys: number;
  } | null;
  grain?: {
    status: string;
    rowCount: number;
    distinctGrainCount: number;
    duplicateGrainRows: number;
  };
  contract?: {
    status: string;
    marketingSourceField?: string;
    leadSourceField?: string;
    marketingCampaignField?: string;
    leadCampaignField?: string;
    notes?: string;
  };
  rows: Array<{
    key: string;
    hasMarketing: boolean;
    hasOperations: boolean;
    spend: number | null;
    platformLeads: number;
    fetched: number;
    delivered: number;
    dialled: number;
    rpc: number;
    sales: number;
    activations: number;
    recordedRevenue: number | null;
    spendPerFetchedLead: number | null;
    spendPerSale: number | null;
    spendPerActivation: number | null;
  }>;
}

export interface SourceObservabilityData {
  status: string;
  generatedAt: string;
  sources: Array<{
    key: string;
    label: string;
    status: string;
    table: string | null;
    latestRecordAt: string | null;
    ageHours: number | null;
    rowCount: number | null;
    detail: string;
  }>;
}

export interface AiInsightsData {
  scope?: { clientId: string; startDate?: string | null; endDate?: string | null; filters?: Record<string, unknown>; drill?: string | null; drillValue?: string | null; metric?: string | null; search?: string | null; segmentVendor?: string | null; segmentSource?: string | null; segmentGrade?: string | null; segmentLeadAge?: string | null; dateBasis: string; countingGrain: string };
  populationCount?: number | null;
  generatedAt?: string;
  metricReferences?: string[];
  limitations?: string[];
  requestedQuestion?: string | null;
  source: string;
  model?: string;
  status?: string;
  reason?: string;
  validationStatus?: string;
  executiveSummary?: string;
  strategicFocus?: string;
  insights: Array<{
    category: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    finding: string;
    metricReference: string;
    directive: string;
  }>;
}

export interface GoogleApiStatusData {
  timestamp: string;
  workspace: string;
  clientId: string;
  bigquery: {
    status: 'Connected' | 'Degraded' | 'Error';
    latestData: string | null;
    freshnessVerified: boolean;
    latencyMs?: number;
    projectId: string;
    dataset: string;
    table: string;
    engine: string;
    maxBytesBilledCeiling: string;
    error?: string;
  };
  gemini: {
    status: 'Connected' | 'Not Configured' | 'Error';
    model: string;
    hasKey: boolean;
    latencyMs?: number;
    error?: string;
  };
  identity: {
    authMode: string;
    oAuthClientId?: string;
    provider: string;
    authenticatedPrincipal: string;
  };
}

export interface RawLeadsData {
  segmentVendor?: string | null;
  segmentSource?: string | null;
  segmentGrade?: string | null;
  segmentLeadAge?: string | null;
  rows: Array<Record<string, any>>;
  totalCount?: number | null;
  limit: number;
  offset: number;
  drill: string | null;
  drillValue: string | null;
  search?: string | null;
  clientId?: string;
  startDate?: string | null;
  endDate?: string | null;
  vendor?: string | null;
  source?: string | null;
  medium?: string | null;
  grade?: string | null;
  filters?: Record<string, any>;
  timezone?: string;
  dateBasis?: string;
  definitionVersion?: string;
  metricId?: string;
  countingGrain?: string;
  validationStatus?: string;
  sourceCutoff?: string | null;
  generatedAt?: string;
  metadata?: Record<string, any>;
}

export interface LeadTimelineData {
  leadId: string;
  consumerId: number;
  vendor: string;
  source: string;
  grade: string;
  callEvidence?: { status: string; rowLimit: number; displayedCalls: number; reason: string };
  events: Array<{
    stage: string;
    title: string;
    timestamp: string | null;
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
const CACHE_MAX_ENTRIES = 200;

function pruneOffernetCache(now = Date.now()) {
  for (const [key, entry] of memoryCache) {
    if (now - entry.timestamp >= CACHE_TTL_MS) memoryCache.delete(key);
  }
  if (memoryCache.size <= CACHE_MAX_ENTRIES) return;
  const oldest = [...memoryCache.entries()]
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .slice(0, memoryCache.size - CACHE_MAX_ENTRIES);
  oldest.forEach(([key]) => memoryCache.delete(key));
}

export function invalidateOffernetCache() {
  memoryCache.clear();
  inFlightRequests.clear();
}

export async function fetchOffernetJson<T>(url: string, forceRefresh = false, signal?: AbortSignal): Promise<T> {
  const now = Date.now();
  pruneOffernetCache(now);
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
      const response = await fetch(url, { credentials: 'same-origin', signal });
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
      if (result && typeof result === 'object' && json.metadata) {
        if (!('generatedAt' in (result as any)) && json.metadata.generatedAt) {
          (result as any).generatedAt = json.metadata.generatedAt;
        }
        if (!('timezone' in (result as any)) && json.metadata.timezone) {
          (result as any).timezone = json.metadata.timezone;
        }
        if (!('clientId' in (result as any)) && json.metadata.clientId) {
          (result as any).clientId = json.metadata.clientId;
        }
        if (!('metadata' in (result as any))) {
          (result as any).metadata = json.metadata;
        }
      }
      memoryCache.set(url, { data: result, timestamp: Date.now() });
      pruneOffernetCache();
      return result;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, fetchPromise);
  return fetchPromise;
}

export async function fetchOperatingControls(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<OperatingControlsData> {
  return fetchOffernetJson<OperatingControlsData>(`/api/analytics/offernet/operating-controls${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchOverview(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<OverviewData> {
  return fetchOffernetJson<OverviewData>(`/api/analytics/offernet/overview${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchExceptions(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<ExceptionAnalyticsData> {
  return fetchOffernetJson<ExceptionAnalyticsData>(`/api/analytics/offernet/exceptions${buildQueryString(params)}`, forceRefresh, signal);
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

export async function askGeminiAnalytics(
  question: string,
  params: Record<string, any> = {},
  signal?: AbortSignal
): Promise<{ answer: string; model: string; citations: string[] }> {
  const query = buildQueryString(params);
  const response = await fetch(`/api/analytics/google/ask${query}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!response.ok) {
    let msg = `Request failed: ${response.status}`;
    try {
      const j = await response.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  const json = await response.json();
  return json.data;
}

export async function fetchGoogleApiStatus(
  params: Record<string, any> = {},
  forceRefresh = false,
  signal?: AbortSignal
): Promise<GoogleApiStatusData> {
  return fetchOffernetJson<GoogleApiStatusData>(`/api/analytics/google/status${buildQueryString(params)}`, forceRefresh, signal);
}

export async function fetchRawLeads(params: Record<string, any> = {}, forceRefresh = false, signal?: AbortSignal): Promise<RawLeadsData> {
  const { baseUrl, ...queryParams } = params;
  return fetchOffernetJson<RawLeadsData>(`${baseUrl || ''}/api/analytics/offernet/raw-leads${buildQueryString(queryParams)}`, forceRefresh, signal);
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

export { fetchOffershopFlow, fetchOffershopStage, simulateOffershopRule, fetchContactDispositions } from './offernet/client';
export type { ContactDispositionsData } from '../../contracts/vendorDispositions';
export type { AuthoritativeMetricDefinition } from '../../contracts/metricRegistry';

export interface AuthoritativeMetricsEnvelope {
  success: true;
  version: string;
  totalMetrics: number;
  data: Record<string, import('../../contracts/metricRegistry').AuthoritativeMetricDefinition>;
}

export async function fetchAuthoritativeMetrics(
  paramsOrForceRefresh: Record<string, any> | boolean = false,
  forceRefreshOrSignal?: boolean | AbortSignal,
  optionalSignal?: AbortSignal
): Promise<AuthoritativeMetricsEnvelope> {
  let params: Record<string, any> = {};
  let forceRefresh = false;
  let signal: AbortSignal | undefined;

  if (typeof paramsOrForceRefresh === 'boolean') {
    forceRefresh = paramsOrForceRefresh;
    if (forceRefreshOrSignal instanceof AbortSignal) {
      signal = forceRefreshOrSignal;
    }
  } else if (paramsOrForceRefresh && typeof paramsOrForceRefresh === 'object') {
    params = paramsOrForceRefresh;
    if (typeof params.forceRefresh === 'boolean') forceRefresh = params.forceRefresh;
    if (params.signal instanceof AbortSignal) signal = params.signal;
    if (typeof forceRefreshOrSignal === 'boolean') forceRefresh = forceRefreshOrSignal;
    else if (forceRefreshOrSignal instanceof AbortSignal) signal = forceRefreshOrSignal;
    if (optionalSignal instanceof AbortSignal) signal = optionalSignal;
  } else {
    if (typeof forceRefreshOrSignal === 'boolean') forceRefresh = forceRefreshOrSignal;
    else if (forceRefreshOrSignal instanceof AbortSignal) signal = forceRefreshOrSignal;
    if (optionalSignal instanceof AbortSignal) signal = optionalSignal;
  }

  const { baseUrl, forceRefresh: _fr, signal: _sig, ...queryParams } = params;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams).sort(([a], [b]) => a.localeCompare(b))) {
    if (value !== undefined && value !== null && value !== '') {
      q.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }
  const queryString = q.toString() ? `?${q.toString()}` : '';
  const url = `${baseUrl || ''}/api/analytics/metrics/registry${queryString}`;

  const now = Date.now();
  pruneOffernetCache(now);
  if (!forceRefresh && memoryCache.has(url)) {
    const entry = memoryCache.get(url)!;
    if (now - entry.timestamp < CACHE_TTL_MS) {
      return entry.data as AuthoritativeMetricsEnvelope;
    }
  }

  if (!forceRefresh && inFlightRequests.has(url)) {
    return inFlightRequests.get(url) as Promise<AuthoritativeMetricsEnvelope>;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, { credentials: 'same-origin', signal });
      if (!response.ok) {
        let errorMsg = `Server request failed with status ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.error) errorMsg = errJson.error;
        } catch {
          // ignore json parse error
        }
        throw Object.assign(new Error(errorMsg), { status: response.status });
      }

      let json: any;
      try {
        json = await response.json();
      } catch {
        throw new Error('Invalid metric registry: response is not valid JSON');
      }

      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        throw new Error('Invalid metric registry: response envelope must be a non-null object');
      }

      if (json.success !== true) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Invalid metric registry: envelope missing explicit success = true');
      }

      if (typeof json.version !== 'string' || !json.version.trim()) {
        throw new Error('Invalid metric registry: missing or invalid definition version string');
      }

      const versionMatch = json.version.trim().match(/^cx\.metric\.(\d+)\.(\d+)\.(\d+)$/);
      if (!versionMatch) {
        throw new Error(`Unsupported metric definition version format: "${json.version}"`);
      }
      const majorVersion = Number(versionMatch[1]);
      if (majorVersion < 2) {
        throw new Error(`Unsupported legacy metric definition version: "${json.version}" (requires v2+)`);
      }

      if (typeof json.totalMetrics !== 'number' || !Number.isInteger(json.totalMetrics) || json.totalMetrics < 0) {
        throw new Error('Invalid metric registry: totalMetrics must be a non-negative integer');
      }

      if (!json.data || typeof json.data !== 'object' || Array.isArray(json.data)) {
        throw new Error('Invalid metric registry: data must be a non-array metric dictionary');
      }

      const metricEntries = Object.entries(json.data);
      if (metricEntries.length !== json.totalMetrics) {
        throw new Error(`Invalid metric registry: totalMetrics (${json.totalMetrics}) does not match dictionary count (${metricEntries.length})`);
      }

      for (const [key, entry] of metricEntries) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          throw new Error(`Invalid metric definition entry for key "${key}": must be an object`);
        }
        const metric = entry as Record<string, any>;
        if (metric.id !== key) {
          throw new Error(`Metric entry key "${key}" does not match metric id "${metric.id}"`);
        }
        if (typeof metric.businessLabel !== 'string' || !metric.businessLabel.trim()) {
          throw new Error(`Metric "${key}" is missing a valid businessLabel`);
        }
        if (typeof metric.unit !== 'string' || !metric.unit.trim()) {
          throw new Error(`Metric "${key}" is missing a valid unit`);
        }
        if (typeof metric.countingGrain !== 'string' || !metric.countingGrain.trim()) {
          throw new Error(`Metric "${key}" is missing a valid countingGrain`);
        }
        if (typeof metric.version !== 'string' || !metric.version.trim()) {
          throw new Error(`Metric "${key}" is missing a valid definition version`);
        }
      }

      const validated: AuthoritativeMetricsEnvelope = {
        success: true,
        version: json.version.trim(),
        totalMetrics: json.totalMetrics,
        data: json.data as Record<string, import('../../contracts/metricRegistry').AuthoritativeMetricDefinition>,
      };

      memoryCache.set(url, { data: validated, timestamp: Date.now() });
      pruneOffernetCache();
      return validated;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, fetchPromise);
  return fetchPromise;
}
