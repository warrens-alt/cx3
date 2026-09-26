export interface OperatingControlsData {
  summary: {
    totalLeads: number;
    deliveredLeads: number;
    dialledLeads: number;
    zeroCallLeads: number;
    oneCallLeads: number;
    multiCallLeads: number;
    highAttemptNoRpcLeads: number;
    singleAttemptSharePct: number;
    multiAttemptSharePct: number;
    dispositionCompletenessPct: number;
    afterHoursLeads: number;
    afterHoursSharePct: number;
    weekendLeads: number;
    weekendSharePct: number;
    sla15Rate: number;
    sla60Rate: number;
    awaitingFirstDial: number;
    oldestDeliveryWait: string;
    captureToDialMedian: string;
    captureToDialP90: string;
    captureWithin15mRate: number;
    captureWithin60mRate: number;
    activationBacklog14d: number;
    afterHoursRpcRate: number;
    operatingHoursRpcRate: number;
    afterHoursSaleRate: number;
    operatingHoursSaleRate: number;
  };
  attemptBuckets: Array<{
    bucket: string;
    leads: number;
    sharePct: number;
    contacted: number;
    contactRate: number;
    sales: number;
    saleRate: number;
    activations: number;
  }>;
  slaBands: Array<{
    band: string;
    leads: number;
    sharePct: number;
    contactRate: number;
    saleRate: number;
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
    within15mRate: number;
    within60mRate: number;
  }>;
  vendorControls: Array<{
    vendor: string;
    leads: number;
    oneCallSharePct: number;
    highAttemptNoRpc: number;
    dispositionCompletenessPct: number;
    sla15Rate: number;
    medianFirstDial: string;
    rpcRate: number;
    leadToSaleRate: number;
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
    directCost: number | null;
    deliveryAgentCost: number | null;
    allocatedCost: number | null;
    totalCost: number | null;
    contribution: number | null;
    marginPct: number | null;
    costPerSale: number | null;
    costPerActivation: number | null;
    revenuePerLead: number;
    breakEvenSales: number | null;
    actualVsBreakEven: number | null;
  };
  funnelStages: Array<{
    key: string;
    name: string;
    volume: number;
    rate: number;
    loss: number;
    transitionRate: number;
  }>;
  funnelLeak: { from: string; to: string; loss: number; rate: number };
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
  backlog: {
    awaitingFirstDial: number;
    over60Minutes: number;
    buckets: Array<{ bucket: string; count: number; severity: string }>;
    byVendor: Array<{ vendor: string; awaiting_first_dial: number; over_60m: number }>;
  };
  sla: {
    firstDialTargetMinutes: number;
    complianceRate: number;
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
    currentValue: number;
    previousValue: number;
    delta: number;
    deltaUnit: 'leads' | 'pp';
  };
  currentWindow: { startDate: string; endDate: string };
  previousWindow: { startDate: string; endDate: string };
  dimensions: Array<{
    key: 'vendor' | 'source' | 'grade' | 'leadAge';
    label: string;
    segments: Array<{
      name: string;
      currentValue: number;
      previousValue: number;
      currentNumerator: number;
      currentDenominator: number;
      previousNumerator: number;
      previousDenominator: number;
      contribution: number;
      shareOfDelta: number | null;
    }>;
  }>;
  drivers: Array<{
    name: string;
    dimension: 'vendor' | 'source' | 'grade' | 'leadAge';
    dimensionLabel: string;
    currentValue: number;
    previousValue: number;
    contribution: number;
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
    sharePct: number;
    contacted: number;
    contactRate: number;
    sales: number;
    saleRate: number;
    activations: number;
    activationRate: number;
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
    zeroCallLeads: number;
    oneCallLeads: number;
    singleAttemptSharePct: number;
    multiAttemptLeads: number;
    multiAttemptSharePct: number;
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
    deliveryRate: number;
    dialRate: number;
    contactRate: number;
    saleRate: number;
    activationRate: number;
    medianFirstDial: string;
    medianFirstDialSec: number | null;
    callsPerLead: number;
    invalidRate: number;
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
    deliveryRate: number;
    dialRate: number;
    contactRate: number;
    leadToSaleRate: number;
    activationRate: number;
    invalidRate: number;
  }>;
  grades: Array<{
    grade: string;
    leads: number;
    contacted: number;
    sales: number;
    activations: number;
    contactRate: number;
    leadToSaleRate: number;
    activationRate: number;
  }>;
  vetting: Array<{
    vetting_color: string;
    leads: number;
    contacted: number;
    sales: number;
    activations: number;
    contactRate: number;
    leadToSaleRate: number;
    activationRate: number;
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
  operatingComparison?: Array<{
    type: string;
    leads: number;
    contactRate: number;
    saleRate: number;
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
  maturationStatus: string;
  maturationReason: string;
  byVendor: Array<{
    vendor: string;
    sales: number;
    activations: number;
    revenue: number;
  }>;
}

export interface CommercialData {
  status: string;
  reason: string;
  baseline: {
    volume: number;
    cpl: number | null;
    cpc: number | null;
    cpm: number | null;
    mediaSpend: number | null;
    conversionRate: number;
    revenuePerSale: number | null;
    fixedOverhead: number | null;
    revenue: number;
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
    platformLeads: number;
    platformClicks: number;
    platformImpressions: number;
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
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
    evidence: string;
    discrepancyCount: number;
    detail: string;
  }>;
}

export interface AgentPerformanceData {
  rankingStatus?: string;
  rankingReason?: string;
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
    performanceTier: string | null;
  }>;
}

export interface CampaignData {
  status?: string;
  reason?: string;
  mappingStatus?: string;
  grainStatus?: string;
  grainDiagnostics?: {
    rowCount: number;
    distinctGrainCount: number;
    duplicateGrainRows: number;
    fields: string[];
  };
  attribution?: {
    status: string;
    reason?: string | null;
  };
  summary: {
    spend: number | null;
    impressions: number;
    reach: number | null;
    frequency: number | null;
    clicks: number;
    outboundClicks: number | null;
    leads: number;
    ctr: number;
    outboundCtr: number | null;
    clickToLeadRate: number | null;
    cpc: number | null;
    cpm: number | null;
    cpl: number | null;
  } | null;
  comparisonReason?: string | null;
  comparison?: {
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
    impressions: number;
    reach: number | null;
    frequency: number | null;
    clicks: number;
    outboundClicks: number | null;
    ctr: number;
    outboundCtr: number | null;
    clickToLeadRate: number | null;
    leads: number;
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
    recordedRevenue: number;
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
  rows: Array<Record<string, any>>;
  limit: number;
  offset: number;
  drill: string | null;
  drillValue: string | null;
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
