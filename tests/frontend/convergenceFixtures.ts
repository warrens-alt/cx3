// Populated synthetic browser evidence grounded in regression fixtures and query contracts.
// This file is test-only: it is not imported by the application or production build.
// Preserve unavailable/null entries; these payloads establish no live-source verification.
import type { JourneyData } from '../../src/features/journey/model/useJourneyModel';
import type { CampaignData, SalesActivationData, VendorQualityData } from '../../src/lib/offernetClient';
import { DISPOSITION_REPORT_VERSION, type ContactDispositionsData } from '../../contracts/vendorDispositions';
import { OFFERSHOP_PROCESS_VERSION, OFFERSHOP_PROCESS_NODES, TEDI_REFERENCE_SCHEDULES } from '../../contracts/offershopProcess';
import type { OffershopProcessOverview } from '../../server/analytics/process/offershopProcess';

// tests/journey-and-contact-contracts.test.ts: independent totals vs transition intersections.
// The two vendor rows overlap (11 vendor memberships vs 10 distinct fetched leads).
export const convergenceJourneyPayload: JourneyData = {
  velocity: {
    fetchToDelivery: '10s',
    deliveryToFirstDial: '20s',
    firstDialToContact: 'Unavailable',
    contactToSale: '30s',
    saleToActivation: '40s',
  },
  byVendor: [
    { vendor: 'VendorA', leads: 6, delivered: 5, dialled: 4, contacted: 3, sales: 2, activations: 1 },
    { vendor: 'VendorB', leads: 5, delivered: 4, dialled: 3, contacted: 2, sales: 2, activations: 1 },
    // Note: vendor rows sum to 11 leads (overlapping), establishing why summing byVendor rows is invalid!
  ],
  bySource: [],
  byGrade: [],
  lifecycle: {
    period: null,
    comparisons: {
      fetched: { current: 10, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      delivered: { current: 8, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      dialled: { current: 7, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      rpc: { current: 4, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      sales: { current: 3, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      activations: { current: 2, previous: null, kind: 'count', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      deliveryRate: { current: 80.0, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      dialRate: { current: 87.5, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      rpcRate: { current: 57.14, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      saleRate: { current: 30.0, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
      activationRate: { current: 66.67, previous: null, kind: 'rate', absoluteChange: null, percentageChange: null, percentagePointChange: null },
    },
    transitions: [
      { from: 'Capture', to: 'Delivery', population: 10, converted: 8, lost: 2, conversionRate: 80.0, lossRate: 20.0, deteriorationPp: null, status: 'OBSERVED' },
      { from: 'Delivery', to: 'Dial', population: 8, converted: 6, lost: 2, conversionRate: 75.0, lossRate: 25.0, deteriorationPp: null, status: 'NON_NESTED' },
      { from: 'Dial', to: 'RPC', population: 7, converted: 4, lost: 3, conversionRate: 57.14, lossRate: 42.86, deteriorationPp: null, status: 'OBSERVED' },
      { from: 'RPC', to: 'Sale', population: 4, converted: 2, lost: 2, conversionRate: 50.0, lossRate: 50.0, deteriorationPp: null, status: 'NON_NESTED' },
      { from: 'Sale', to: 'Activation', population: 3, converted: 2, lost: 1, conversionRate: 66.67, lossRate: 33.33, deteriorationPp: null, status: 'OBSERVED' },
    ],
    largestLeakage: null,
    largestDeterioration: null,
    segments: {},
    priorSegments: {},
    rateContributions: {},
    velocity: { captureToDeliverySec: 10, deliveryToDialSec: 20, dialToSaleSec: 30, saleToActivationSec: 40 },
    validationStatus: 'NOT_VERIFIED',
    methodology: 'Test',
    unsupportedDimensions: [],
  },
};

// scripts/build-ledger-timeline-fixture.mjs: existing populated contact-effort response.
// Revenue, cost and individual-call sequence evidence remain explicitly unavailable.
export const convergenceContactPayload = {attemptPerformance:[{bucket:'0 calls',leads:20,sharePct:20,contacted:0,contactRate:0,sales:0,saleRate:0,activations:0,activationRate:0,revenue:null,callCost:null,marginalSales:null,marginalCostPerSale:null},{bucket:'1 call',leads:80,sharePct:80,contacted:12,contactRate:15,sales:10,saleRate:12.5,activations:0,activationRate:0,revenue:null,callCost:null,marginalSales:null,marginalCostPerSale:null}],attemptCadence:[],summary:{totalLeads:100,dialledLeads:80,unrecordedCallLeads:0,zeroCallLeads:20,oneCallLeads:80,singleAttemptSharePct:100,multiAttemptLeads:0,multiAttemptSharePct:0,fivePlusCallLeads:0,fivePlusNoRpcLeads:0},methodology:'Synthetic returned effort evidence; missing is not zero.',noAnswerAnalysis:{status:'UNAVAILABLE',reason:'Individual synthetic call times are not supplied',stopThresholdRecommendation:null,diminishingReturnsCutoff:null,callbackFollowupRate:null,callbackSaleConversion:null}};

// tests/sales-activation-contracts.test.ts: independent outcomes and all ageing buckets.
// The unactivated population is the returned 35, not total sales minus activations.
export const convergenceSalesPayload: SalesActivationData = {
  reconciliation: {
    totalSales: 100,
    billableSales: 80,
    salesWithRecordedRevenue: 85,
    unbilledSales: 15,
    unrecordedRevenueSales: 0,
    totalActivations: 70,
    activationRate: 70.0,
    realizedRevenue: 150000,
    avgTimeToSale: '2.5h',
    avgTimeToActivation: '3.2d',
    medianTimeToSale: '1.2h',
    medianTimeToActivation: '2.0d',
  },
  maturationCurve: [],
  maturationStatus: 'UNAVAILABLE',
  maturationReason: 'Activation maturation is withheld until event-level activation joins are independently validated.',
  byVendor: [
    { vendor: 'Partner A', sales: 60, activations: 45, revenue: 90000, unrecorded_revenue_sales: 0 },
    { vendor: 'Partner B', sales: 40, activations: 25, revenue: 60000, unrecorded_revenue_sales: 0 },
  ],
  bySource: [
    { dimension: 'source', segment: 'Google PPC', sales: 70, activations: 50, revenue: 105000, unrecorded_revenue_sales: 0 },
    { dimension: 'source', segment: 'Facebook', sales: 30, activations: 20, revenue: 45000, unrecorded_revenue_sales: 0 },
  ],
  byGrade: [
    { dimension: 'grade', segment: 'Tier 1', sales: 80, activations: 60, revenue: 120000, unrecorded_revenue_sales: 0 },
    { dimension: 'grade', segment: 'Tier 2', sales: 20, activations: 10, revenue: 30000, unrecorded_revenue_sales: 0 },
  ],
  activationAgeing: [
    { bucket: '0–3d', sales: 12 },
    { bucket: '4–7d', sales: 8 },
    { bucket: '8–14d', sales: 6 },
    { bucket: '15–30d', sales: 4 },
    { bucket: '30d+', sales: 3 },
    { bucket: 'Invalid future sale', sales: 2 },
  ],
  revenueEvidence: 'Recorded revenue is the sum of available source values.',
  segmentMethodology: 'One lead per segment.',
};

// tests/journey-and-contact-contracts.test.ts: raw disposition and mapping-state fixture.
// Only clientId is adapted to the authorised synthetic browser workspace below.
const dispositionFixture: ContactDispositionsData = {
  reportVersion: DISPOSITION_REPORT_VERSION,
  mode: 'lead_status',
  modeHeading: 'Current recorded status for the selected capture cohort',
  modeDescription: 'Reconciles repeated HLC records deterministically per lead-vendor pair.',
  dateBasis: 'lead_capture_cohort',
  countingGrain: 'lead_vendor_pairs',
  clientId: 'tenant-omega',
  timezone: 'Africa/Johannesburg',
  summary: {
    totalEntities: 500,
    dialledEntities: 400,
    zeroCallEntities: 60,
    unrecordedActivityEntities: 40,
    conflictingEntities: 20,
    recordedDispositions: 350,
    missingDispositions: 50,
    unmappedDispositions: 30,
    dispositionCoveragePct: 87.5,
    mappingCoveragePct: 91.4,
    rpcCount: 150,
    saleCount: 50,
    callbackCount: 30,
  },
  vendorSummaries: [
    {
      vendor: 'CallForce',
      totalPopulation: 300,
      dialledCount: 250,
      recordedDispositionCount: 220,
      missingDispositionCount: 30,
      unmappedDispositionCount: 20,
      dispositionCoveragePct: 88.0,
      mappingCoveragePct: 90.9,
      rpcCount: 100,
      saleCount: 35,
      callbackCount: 20,
      sourceTable: 'clustered_lead_ledger.hlc_details',
      dateBasis: 'lead_capture_cohort',
      latestObservedFeedback: null,
      coverageLimitations: [],
    },
    {
      vendor: 'Mondo',
      totalPopulation: 200,
      dialledCount: 150,
      recordedDispositionCount: 130,
      missingDispositionCount: 20,
      unmappedDispositionCount: 10,
      dispositionCoveragePct: 86.7,
      mappingCoveragePct: 92.3,
      rpcCount: 50,
      saleCount: 15,
      callbackCount: 10,
      sourceTable: 'clustered_lead_ledger.hlc_details',
      dateBasis: 'lead_capture_cohort',
      latestObservedFeedback: null,
      coverageLimitations: [],
    },
  ],
  breakdown: [
    {
      vendor: 'CallForce',
      rawDisposition: 'RPC_HUMAN',
      rawDescription: 'Right Party Contact Human',
      approvedGroup: 'CONTACTED_RPC',
      approvedGroupLabel: 'Contacted / RPC',
      count: 60,
      percentOfBase: 24.0,
      distinctLeadVendorPairs: 60,
      rpcCount: 60,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'APPROVED',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'RPC_CALLBACK',
      rawDescription: 'Customer Requested Callback',
      approvedGroup: 'CONTACTED_RPC',
      approvedGroupLabel: 'Contacted / RPC',
      count: 40,
      percentOfBase: 16.0,
      distinctLeadVendorPairs: 40,
      rpcCount: 40,
      saleCount: 0,
      callbackCount: 20,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'APPROVED',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'SALE_MADE',
      rawDescription: 'Sale Closed Deal',
      approvedGroup: 'REPORTED_SALE',
      approvedGroupLabel: 'Reported Sale',
      count: 35,
      percentOfBase: 14.0,
      distinctLeadVendorPairs: 35,
      rpcCount: 35,
      saleCount: 35,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'APPROVED',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'UNMAPPED_RAW_X',
      rawDescription: 'Unknown code from CallForce',
      approvedGroup: 'UNMAPPED',
      approvedGroupLabel: 'Unmapped Disposition',
      count: 20,
      percentOfBase: 8.0,
      distinctLeadVendorPairs: 20,
      rpcCount: 0,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      isUnmapped: true,
      mappingStatus: 'UNMAPPED',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'MISSING_DISPOSITION',
      rawDescription: 'Missing disposition code',
      approvedGroup: 'MISSING_DISPOSITION',
      approvedGroupLabel: 'Missing Disposition',
      count: 30,
      percentOfBase: 12.0,
      distinctLeadVendorPairs: 30,
      rpcCount: 0,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'MISSING',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'CONFLICTING_EVIDENCE',
      rawDescription: 'Contradictory status observations',
      approvedGroup: 'CONFLICTING_EVIDENCE',
      approvedGroupLabel: 'Conflicting Evidence',
      count: 20,
      percentOfBase: 8.0,
      distinctLeadVendorPairs: 20,
      rpcCount: 5,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'CONFLICTING',
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'UNKNOWN_CUSTOM_CODE',
      rawDescription: 'Unclassified operational code',
      approvedGroup: 'OTHER',
      approvedGroupLabel: 'Other',
      count: 10,
      percentOfBase: 4.0,
      distinctLeadVendorPairs: 10,
      rpcCount: 0,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: undefined, // Absent status
    },
    {
      vendor: 'CallForce',
      rawDisposition: 'CONTRADICTORY_CODE',
      rawDescription: 'Marked approved but flagged unmapped',
      approvedGroup: 'OTHER',
      approvedGroupLabel: 'Other',
      count: 5,
      percentOfBase: 2.0,
      distinctLeadVendorPairs: 5,
      rpcCount: 0,
      saleCount: 0,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      isUnmapped: true,
      mappingStatus: 'APPROVED', // Contradictory fields!
    },
    {
      vendor: 'Mondo',
      rawDisposition: 'SALE',
      rawDescription: 'Approved Deal',
      approvedGroup: 'REPORTED_SALE',
      approvedGroupLabel: 'Reported Sale',
      count: 15,
      percentOfBase: 10.0,
      distinctLeadVendorPairs: 15,
      rpcCount: 15,
      saleCount: 15,
      callbackCount: 0,
      avgDurationSec: null,
      validDurationCount: null,
      latestObservation: null,
      mappingStatus: 'APPROVED',
    },
  ],
  matrix: [],
  trends: [],
  comparableGroups: [],
  capabilities: {
    leadStatusSupported: true,
    callRecordsSupported: true,
    supportedFilters: [],
    unsupportedFilters: [],
  },
  methodology: 'Test',
  evaluatedAt: '2026-09-27T10:00:00.000Z',
};
export const convergenceDispositionPayload: ContactDispositionsData = {
  ...dispositionFixture,
  clientId: 'synthetic-a',
};

// Existing normal and zero-denominator cases from tests/analytics/vendor-performance.test.ts.
// These are the returned fixture measures, not new production fallback values.
export const convergenceVendorPayload: VendorQualityData = {
  vendors: [
    { vendor: 'LeadDialler SA', leads: 1000, deliveryRate: 95, dialRate: 84.2, contactRate: 50, saleRate: 12.5, activationRate: 80,
      medianFirstDial: '3m', medianFirstDialSec: 180, callsPerLead: 2.5, invalidRate: 2, revenue: 60000, directCost: null, deliveryCost: null, contribution: null, marginPct: null },
    { vendor: 'Empty Vendor', leads: 0, deliveryRate: null, dialRate: null, contactRate: null, saleRate: null, activationRate: null,
      medianFirstDial: '—', medianFirstDialSec: null, callsPerLead: null, invalidRate: null, revenue: 0, directCost: null, deliveryCost: null, contribution: null, marginPct: null },
  ],
  sources: [{ source: 'Google_Ads', leads: 500, delivered: 480, dialled: 400, contacted: 220, sales: 30, activations: 25, deliveryRate: 96, dialRate: 83.3, contactRate: 55, leadToSaleRate: 6, activationRate: 83.3, invalidRate: 2 }],
  grades: [{ grade: 'Gold', leads: 300, contacted: 180, sales: 25, activations: 20, contactRate: 60, leadToSaleRate: 8.33, activationRate: 80 }],
  vetting: [{ vetting_color: 'Green', leads: 400, contacted: 260, sales: 35, activations: 30, contactRate: 65, leadToSaleRate: 8.75, activationRate: 85.7 }],
  commercialStatus: 'UNAVAILABLE', commercialReason: 'Synthetic fixture: approved cost contracts unavailable.',
};

// Existing normal population from tests/analytics/campaigns.test.ts.
// Source mapping is active but campaign-grain operational attribution is unavailable.
export const convergenceCampaignPayload: CampaignData = {
  status: 'PARTIAL', reason: 'Synthetic platform observations; operational attribution unavailable.', mappingStatus: 'MAPPED', grainStatus: 'VALID',
  attribution: { status: 'ACTIVE', reason: 'Synthetic source mapping only; no campaign-grain matched population.' },
  funnelStatus: { status: 'UNAVAILABLE', reason: 'Campaign/adset outcomes require approved equivalence at this detail grain.' },
  spendSource: { status: 'OBSERVED', column: 'spend', table: 'synthetic.marketing' },
  summary: { spend: 2700, impressions: 15000, reach: 12000, frequency: 1.25, clicks: 900, outboundClicks: 750, leads: 80, ctr: 6, outboundCtr: 5, clickToLeadRate: 10.67, cpc: 3, cpm: 180, cpl: 33.75 },
  campaigns: [
    { client: 'Client Alpha', channel: 'Facebook', campaign: 'Summer_Sale', adset: 'Retargeting', spend: 1200, latestBudget: 2000, impressions: 10000, reach: 8000, frequency: 1.25, clicks: 400, outboundClicks: 300, leads: 30, ctr: 4, outboundCtr: 3, clickToLeadRate: 10, cpc: 3, cpm: 120, cpl: 40 },
    { client: 'Client Alpha', channel: 'Google', campaign: 'Search_Brand', adset: 'Exact', spend: 1500, latestBudget: 2500, impressions: 5000, reach: 4000, frequency: 1.25, clicks: 500, outboundClicks: 450, leads: 50, ctr: 10, outboundCtr: 9, clickToLeadRate: 11.11, cpc: 3, cpm: 300, cpl: 30 },
  ],
};

// No populated Routing regression fixture exists. These explicitly synthetic rows use
// only the aliases returned by getRoutingIntelligenceStats in server/bigquery/queries.ts.
// The two partner rows overlap by design; they are not a distinct cohort total.
// Revenue and billable-sale observations are not supplied and remain unavailable.
export const convergenceRoutingPayload = {
  overview: {
    total_leads: 100, total_routed_leads: 80, routed_lead_share_pct: 80,
    single_route_leads: 40, multi_route_leads: 40, handoff_leads: 64,
    missing_handoff_leads: 16, handoff_rate_pct: 80, missing_handoff_rate_pct: 20,
    routed_sale_leads: 8, routed_billable_sale_leads: null,
    routed_sale_rate_pct: 10, routed_billable_sale_rate_pct: null,
    routed_revenue: null, total_revenue: null, rev_per_routed_lead: null,
    avg_routing_depth: 1.5,
  },
  depthBreakdown: [
    { depth_bucket: '0 Routes (Unrouted)', routing_depth: 0, leads: 20, lead_share_pct: 20,
      handoff_rate_pct: 0, delivery_rate_pct: 0, call_rate_pct: 0, rpc_rate_pct: 0,
      sale_rate_pct: 0, billable_sale_rate_pct: null, total_revenue: null, rev_per_lead: null },
    { depth_bucket: '1 Partner Route', routing_depth: 1, leads: 40, lead_share_pct: 40,
      handoff_rate_pct: 80, delivery_rate_pct: 60, call_rate_pct: 50, rpc_rate_pct: 20,
      sale_rate_pct: 10, billable_sale_rate_pct: null, total_revenue: null, rev_per_lead: null },
    { depth_bucket: '2 Partner Routes', routing_depth: 2, leads: 40, lead_share_pct: 40,
      handoff_rate_pct: 80, delivery_rate_pct: 60, call_rate_pct: 50, rpc_rate_pct: 20,
      sale_rate_pct: 10, billable_sale_rate_pct: null, total_revenue: null, rev_per_lead: null },
  ],
  partnerHandoff: [
    { partner: 'Synthetic route A', routed_leads: 80, first_route_leads: 80, cascade_route_leads: 0,
      avg_cascade_delay_sec: null, handoff_leads: 64, missing_handoff_leads: 16,
      handoff_rate_pct: 80, delivery_rate_pct: 60, sale_rate_pct: 10,
      billable_sale_rate_pct: null, total_revenue: null, rev_per_lead: null, avg_handoff_latency_sec: 30 },
    { partner: 'Synthetic route B', routed_leads: 40, first_route_leads: 0, cascade_route_leads: 40,
      avg_cascade_delay_sec: 120, handoff_leads: 32, missing_handoff_leads: 8,
      handoff_rate_pct: 80, delivery_rate_pct: 60, sale_rate_pct: 10,
      billable_sale_rate_pct: null, total_revenue: null, rev_per_lead: null, avg_handoff_latency_sec: 45 },
  ],
  topRoutePaths: [
    { route_path: 'Synthetic route A', partner_count: 1, leads: 40, share_pct: 50,
      deliv_pct: 60, call_pct: 50, sale_pct: 10, billable_sale_pct: null, total_revenue: null, rev_per_lead: null },
    { route_path: 'Synthetic route A -> Synthetic route B', partner_count: 2, leads: 40, share_pct: 50,
      deliv_pct: 60, call_pct: 50, sale_pct: 10, billable_sale_pct: null, total_revenue: null, rev_per_lead: null },
  ],
  missingSample: [
    { lead_id: 'SYNTHETIC-ROUTING-LEAD-0001-long-identifier', consumer_id: 'SYNTHETIC-CONSUMER-0001',
      partner: 'Synthetic route A', ror_timestamp: '2026-09-28T09:02:00Z', route_sequence: 1,
      source: 'synthetic-source', medium: 'synthetic-medium', capture_timestamp: '2026-09-28T09:00:00Z' },
    { lead_id: 'SYNTHETIC-ROUTING-LEAD-0002', consumer_id: null,
      partner: 'Synthetic route B', ror_timestamp: '2026-09-28T10:04:00Z', route_sequence: 2,
      source: null, medium: null, capture_timestamp: '2026-09-28T10:00:00Z' },
  ],
};

// Exact getOffershopProcessFlow response for the existing query mock in
// tests/offershop-process-api.test.ts: 3 leads and ID/phone valid, invalid, unknown
// counts of 1 each. Only scope and evaluatedAt are fixed for the synthetic browser.
// Catalog nodes and TEDI schedules retain the existing process contract verbatim.
// Uninstrumented observed metrics, partner eligibility and recovery tags stay null.
export const convergenceProcessPayload: OffershopProcessOverview = {
  "processVersion": OFFERSHOP_PROCESS_VERSION,
  "evaluatedAt": "2026-09-28T12:00:00.000Z",
  "scope": {
    "clientId": "synthetic-a",
    "startDate": "2026-09-28",
    "endDate": "2026-09-28"
  },
  "readinessSummary": {
    "totalNodes": 36,
    "mappedCount": 17,
    "dependencyBlockedCount": 8,
    "mappingRequiredCount": 2,
    "notInstrumentedCount": 9,
    "readinessPct": 47
  },
  "stages": {
    "acquisition": {
      "family": "acquisition",
      "title": "Acquisition & Channel Provenance",
      "description": "Captures OnChannel, OffChannel and Offline submissions. Preserves website prequalification distinction and abandoned conversation recovery.",
      "readiness": "PARTIAL",
      "nodes": OFFERSHOP_PROCESS_NODES.filter(node => node.family === 'acquisition'),
      "observedMetrics": {
        "totalSubmissions": 3,
        "onChannelSharePct": null,
        "offChannelSharePct": null,
        "offlineSharePct": null,
        "abandonedConversationsPendingRecovery": null,
        "idleOlderThanTwoHoursThresholdMet": null
      },
      "notes": [
        "OnChannel, OffChannel and Offline are preserved as documented classifications.",
        "Website prequalification responses are kept distinct from central pipeline ingestion.",
        "Chatbot 2-hour idle recovery is an intended SLA from the diagram awaiting runtime logging certification."
      ]
    },
    "ingestion": {
      "family": "ingestion",
      "title": "Pipeline Ingestion (offer_shop_lead_submit)",
      "description": "Ingestion of validated submissions into central lead ledger with timestamping and source tags.",
      "readiness": "MAPPED",
      "nodes": OFFERSHOP_PROCESS_NODES.filter(node => node.family === 'ingestion'),
      "observedMetrics": {
        "ingestedLeads": 3,
        "distinctLeadIds": 3,
        "targetTable": "`dashboards-422710.lead_ledger.clustered_lead_ledger`",
        "ingestionStatus": "ACTIVE"
      },
      "notes": [
        "Grounded in configured lead_ledger source.",
        "Declared views with offershop prefix (e.g. view_all_offershop_lead_submit) exist but have failing underlying dependencies."
      ]
    },
    "preparation_validation": {
      "family": "preparation_validation",
      "title": "Preparation & Validation",
      "description": "Standardisation, National ID Luhn check, mobile validation, alt phone handling, placeholder email detection, Mondo grade and BLC colour.",
      "readiness": "MAPPED",
      "nodes": OFFERSHOP_PROCESS_NODES.filter(node => node.family === 'preparation_validation'),
      "observedMetrics": {
        "totalEvaluated": 3,
        "idValidationValidCode1": 1,
        "idValidationInvalidCode2": 1,
        "idValidationUnknown": 1,
        "idValidationRatePct": 33.33,
        "phoneValidationValidCode1": 1,
        "phoneValidationInvalidCode2": 1,
        "phoneValidationUnknown": 1,
        "phoneValidationRatePct": 33.33,
        "placeholderEmailDetected": null,
        "mondoGradeAssigned": null,
        "blcColourAssigned": null
      },
      "notes": [
        "Diagram field encoding: 1 = valid / successful, 2 = invalid / unsuccessful. Preserved explicitly.",
        "Standardised does not mean valid; format-valid phone does not prove right-party contact. Unknown codes are not invalid. Conflicting repeated lead snapshots require separate review.",
        "Mondo grade and BLC colour are modeled independently; no synthetic composite score is generated."
      ]
    },
    "consumer_hospital": {
      "family": "consumer_hospital",
      "title": "Consumer Hospital & Identity Recovery",
      "description": "Processes format-invalid or unverified identities via phone-to-ID, ID-to-phone, and name matching back into the pipeline or terminal morgue.",
      "readiness": "PARTIAL",
      "nodes": OFFERSHOP_PROCESS_NODES.filter(node => node.family === 'consumer_hospital'),
      "observedMetrics": {
        "hospitalEntries": null,
        "recoveredIdentities": null,
        "recoveryRatePct": null,
        "pipelineReentries": null,
        "terminalMorgueRecords": null
      },
      "notes": [
        "Tags (EXACT, INVALID_ID_ZERO, SMALL_DIFF_1/2/3_DIGIT, DIFFERENT) represent upstream source outcomes, not confidence probabilities.",
        "CX3 does not perform client-side fuzzy matching or expose PII; it observes upstream recovery evidence.",
        "Hospital history is not fabricated from a latest-state flag."
      ]
    },
    "partner_qualification": {
      "family": "partner_qualification",
      "title": "ROR & Partner Qualification",
      "description": "Partner qualification paths (BLC, Mondo, MTN, Real Promotions, BizVoIP, RewardsCo, Invalid-ID campaign) with duplicate windows.",
      "readiness": "DEPENDENCY_BLOCKED",
      "nodes": OFFERSHOP_PROCESS_NODES.filter(node => node.family === 'partner_qualification'),
      "observedMetrics": {
        "totalEvaluated": null,
        "blcEligible": null,
        "mondoEligible": null,
        "mtnEligible": null,
        "realPromotionsEligible": null,
        "bizvoipEligible": null,
        "rewardscoEligible": null,
        "invalidIdCampaignEligible": null
      },
      "notes": [
        "ROR terminology retained without expansion.",
        "Partner qualification paths are not mutually exclusive; a lead can qualify for multiple partners.",
        "Dedicated partner views (e.g. view_lead_ledger_mondo_lead_submit_open) have observed BigQuery Access Denied dependency failures."
      ]
    },
    "hlc_delivery": {
      "family": "hlc_delivery",
      "title": "Hot Lead Connect (HLC) & Delivery",
      "description": "Outbound queueing, partner API delivery, duplicate action enforcement, response contract verification, and dialler list assignment.",
      "readiness": "MAPPED",
      "nodes": OFFERSHOP_PROCESS_NODES.filter(node => node.family === 'hlc_delivery'),
      "observedMetrics": {
        "deliveredEpisodes": null,
        "uniqueDeliveredLeads": null,
        "avgVendorEpisodesPerLead": null,
        "partnerAcceptanceRatePct": null,
        "suppressedDuplicates": null
      },
      "notes": [
        "Duplicate windows documented: BLC 48h, Mondo 10d, MTN 48h, Real Promotions 7d, BizVoIP 48h, RewardsCo 48h.",
        "Duplicate actions: Suppress, Update existing record, Reclassify, Reintroduce, Create genuinely new record.",
        "HTTP 200 does not equal business acceptance without an approved response contract."
      ]
    },
    "dialler_activity": {
      "family": "dialler_activity",
      "title": "Dialler Activity & Call Dispositions",
      "description": "Discrete call attempts, leads dialled, right-party contact (RPC) dispositions, and call counters from Vicidial.",
      "readiness": "MAPPED",
      "nodes": OFFERSHOP_PROCESS_NODES.filter(node => node.family === 'dialler_activity'),
      "observedMetrics": {
        "discreteCallAttempts": null,
        "leadsDialled": null,
        "rightPartyContacts": null,
        "rpcRatePct": null,
        "avgCallsPerDialledLead": null
      },
      "notes": [
        "Discrete call events are kept distinct from cumulative HLC call counters.",
        "Last status is not a complete disposition history.",
        "Expected first dial is kept distinct from recorded first dial."
      ]
    },
    "commercial_activation": {
      "family": "commercial_activation",
      "title": "Commercial Sales & Activations",
      "description": "Commercial reported sales, delivered sales, and verified contract activations.",
      "readiness": "MAPPED",
      "nodes": OFFERSHOP_PROCESS_NODES.filter(node => node.family === 'commercial_activation'),
      "observedMetrics": {
        "reportedSales": null,
        "saleRateFromLeadsPct": null,
        "verifiedActivations": null,
        "activationRateFromSalesPct": null
      },
      "notes": [
        "A partner reported sale is not automatically an activation or recognised revenue.",
        "BLC remote activations table provides bounded alternative reconciliation; other partners require TEDI files."
      ]
    },
    "tedi_feedback": {
      "family": "tedi_feedback",
      "title": "TEDI & External Feedback Reconciliation",
      "description": "Scheduled echo file ingestion, deduplication, storage, table load, and reconciliation monitoring for MTN, Mondo, Real Promotions.",
      "readiness": "DEPENDENCY_BLOCKED",
      "nodes": OFFERSHOP_PROCESS_NODES.filter(node => node.family === 'tedi_feedback'),
      "observedMetrics": {
        "configuredSchedules": 6,
        "unresolvedFileFeeds": 5,
        "verifiedLoadedFeeds": 1
      },
      "notes": [
        "Schedules serve as reference metadata until approved against actual infrastructure.",
        "States differentiated: Not yet expected, Overdue, Received not loaded, Loaded unmatched, Observed source failure, Unknown.",
        "Without monitoring evidence, shows Unknown, not Failed."
      ]
    },
    "advertising_feedback": {
      "family": "advertising_feedback",
      "title": "Advertising Feedback (CAPI & Web Events)",
      "description": "Separate related process for CAPI / ad platform conversion event transmission, acknowledgement, and media attribution.",
      "readiness": "NOT_INSTRUMENTED",
      "nodes": OFFERSHOP_PROCESS_NODES.filter(node => node.family === 'advertising_feedback'),
      "observedMetrics": {
        "capiEventStream": "NOT_DEPLOYED",
        "eligibilityRulesConfigured": 0
      },
      "notes": [
        "Modeled as a separate related process, never conflated with contact centre dialler outcomes."
      ]
    }
  },
  "partnerSummary": {
    "blc_ontact": {
      "partnerId": "blc_ontact",
      "displayName": "BLC / ONtact",
      "duplicateWindowText": "48 hours",
      "duplicateAction": "UPDATE_EXISTING",
      "warehouseReadiness": "DEPENDENCY_BLOCKED",
      "failingDependency": "offernet-dmp.external_data_echos.extrnal_data_echos_blc_activations_master",
      "observedEligibleCount": null,
      "observedSuppressedCount": null,
      "deliveredEpisodes": null,
      "reportedSales": null,
      "verifiedActivations": null,
      "notes": "Dedicated BLC view blocked by external_data_echos permission; alternative reconciliation via blc_remote_activations."
    },
    "mondo": {
      "partnerId": "mondo",
      "displayName": "Mondo",
      "duplicateWindowText": "10 days",
      "duplicateAction": "SUPPRESS",
      "warehouseReadiness": "DEPENDENCY_BLOCKED",
      "failingDependency": "offernet-dmp.hot_lead_connect.mondo_lead_submit",
      "observedEligibleCount": null,
      "observedSuppressedCount": null,
      "deliveredEpisodes": null,
      "reportedSales": null,
      "verifiedActivations": null,
      "notes": "Duplicate window is 10 days. Underlying view blocked by offernet-dmp:hot_lead_connect."
    },
    "mtn": {
      "partnerId": "mtn",
      "displayName": "MTN",
      "duplicateWindowText": "48 hours",
      "duplicateAction": "UPDATE_EXISTING",
      "warehouseReadiness": "DEPENDENCY_BLOCKED",
      "failingDependency": "offernet-dmp.external_data_echos.extrnal_data_echos_mtn_activation_master",
      "observedEligibleCount": null,
      "observedSuppressedCount": null,
      "deliveredEpisodes": null,
      "reportedSales": null,
      "verifiedActivations": null,
      "notes": "Product branches kept separate from grade-only classification. 48-hour duplicate window."
    },
    "real_promotions": {
      "partnerId": "real_promotions",
      "displayName": "Real Promotions",
      "duplicateWindowText": "7 days",
      "duplicateAction": "SUPPRESS",
      "warehouseReadiness": "DEPENDENCY_BLOCKED",
      "failingDependency": "offernet-dmp.external_data_echos.extrnal_data_echos_real_promotions_calls_master",
      "observedEligibleCount": null,
      "observedSuppressedCount": null,
      "deliveredEpisodes": null,
      "reportedSales": null,
      "verifiedActivations": null,
      "notes": "Duplicate window is 7 days (168 hours). Blocked dependency on real_promotions_calls_master."
    },
    "bizvoip": {
      "partnerId": "bizvoip",
      "displayName": "BizVoIP",
      "duplicateWindowText": "48 hours",
      "duplicateAction": "SUPPRESS",
      "warehouseReadiness": "DEPENDENCY_BLOCKED",
      "failingDependency": "offernet-dmp.external_data_echos.extrnal_data_echos_bizvoip_vicidial_log",
      "observedEligibleCount": null,
      "observedSuppressedCount": null,
      "deliveredEpisodes": null,
      "reportedSales": null,
      "verifiedActivations": null,
      "notes": "48-hour duplicate window. Business and PBX qualifications."
    },
    "invalid_id_campaign": {
      "partnerId": "invalid_id_campaign",
      "displayName": "Invalid-ID Campaign",
      "duplicateWindowText": "48 hours",
      "duplicateAction": "RECLASSIFY",
      "warehouseReadiness": "NOT_INSTRUMENTED",
      "observedEligibleCount": null,
      "observedSuppressedCount": null,
      "deliveredEpisodes": null,
      "reportedSales": null,
      "verifiedActivations": null,
      "notes": "Dedicated re-engagement campaign for unverified identities."
    },
    "rewardsco": {
      "partnerId": "rewardsco",
      "displayName": "RewardsCo",
      "duplicateWindowText": "48 hours",
      "duplicateAction": "SUPPRESS",
      "warehouseReadiness": "DEPENDENCY_BLOCKED",
      "failingDependency": "offernet-dmp.hot_lead_connect.rewardsco_lead_submit",
      "observedEligibleCount": null,
      "observedSuppressedCount": null,
      "deliveredEpisodes": null,
      "reportedSales": null,
      "verifiedActivations": null,
      "notes": "48-hour duplicate window. View blocked on offernet-dmp:hot_lead_connect."
    }
  },
  "consumerHospitalSummary": {
    "readiness": "PARTIAL",
    "hospitalEntries": null,
    "hospitalRecovered": null,
    "pipelineReturns": null,
    "terminalMorgueCount": null,
    "tagsObserved": {
      "EXACT": null,
      "SMALL_DIFF_1_DIGIT": null,
      "SMALL_DIFF_2_DIGIT": null,
      "SMALL_DIFF_3_DIGIT": null,
      "INVALID_ID_ZERO": null,
      "DIFFERENT": null
    },
    "directions": {
      "phoneToId": {
        "status": "NOT_INSTRUMENTED",
        "note": "Upstream identity graph lookup; not logged directly to BigQuery view."
      },
      "idToPhone": {
        "status": "NOT_INSTRUMENTED",
        "note": "National ID lookup; observed only via post-recovery return status."
      },
      "nameSurname": {
        "status": "NOT_INSTRUMENTED",
        "note": "Name difference scoring handled upstream without PII exposure in CX3."
      }
    }
  },
  "tediFeedbackSummary": {
    "schedules": TEDI_REFERENCE_SCHEDULES,
    "overallStatus": "ATTENTION_REQUIRED",
    "unresolvedCount": 5
  },
  "advertisingFeedbackSummary": {
    "status": "SEPARATE_RELATED_PROCESS",
    "description": "Advertising-event feedback (CAPI / web-events) is tracked independently from call centre dialler outcomes.",
    "isConflatedWithDialler": false,
    "eligibilityCheckConfigured": false
  }
};

export const convergencePayloads = {
  '/api/analytics/offernet/funnel': convergenceJourneyPayload,
  '/api/analytics/offernet/contact-strategy': convergenceContactPayload,
  '/api/analytics/offernet/contact-dispositions': convergenceDispositionPayload,
  '/api/analytics/offernet/sales-activation': convergenceSalesPayload,
  '/api/analytics/offernet/vendor-quality': convergenceVendorPayload,
  '/api/analytics/offernet/campaigns': convergenceCampaignPayload,
  '/api/analytics/routing': convergenceRoutingPayload,
  '/api/analytics/offernet/offershop-flow': convergenceProcessPayload,
};
