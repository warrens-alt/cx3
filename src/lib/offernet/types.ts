import type { MatchedPeriodWindow, MetricComparison } from '../../../contracts/periodComparison';
import type { AttributedEconomics, SpendReconciliation } from '../../../contracts/commercial';
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
  source: string;
  status?: string;
  reason?: string;
  insights: Array<{
    category: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    finding: string;
    metricReference: string;
    directive: string;
  }>;
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
