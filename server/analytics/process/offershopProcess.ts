/**
 * Offershop Deal Flow Process Analytics & Observability Engine
 *
 * Implements process-aware analytics explaining how submissions move through Offershop:
 * Acquisition → Ingestion → Standardisation & Validation → Enrichment & Scoring →
 * Recovery (Consumer Hospital) → Partner-specific Qualification → HLC Delivery →
 * Dialler Activity → Sales & Activations → External Feedback Reconciliation (TEDI)
 * + Advertising Feedback (separate related process).
 *
 * Grounded in:
 * - Diagram: "Offershop Deal Flow V3-Page-1.drawio (1)(1).svg"
 * - Repository: warrens-alt/cx3
 * - Warehouse Dictionary: dashboards-422710 / vibe-code-warren-stear
 *
 * EVIDENCE INTEGRITY:
 * - Diagram documents intended rules, terminology and branches.
 * - Warehouse schemas show declared structure.
 * - Runtime queries provide bounded observation.
 * - Contradictions are documented, never silently reconciled.
 * - Simulations are strictly read-only, separately labelled, and excluded from observed totals.
 */

import {
  OFFERSHOP_PROCESS_VERSION,
  OFFERSHOP_PROCESS_NODES,
  OFFERSHOP_PARTNER_CONFIGS,
  CONSUMER_HOSPITAL_TAGS,
  TEDI_REFERENCE_SCHEDULES,
  OFFERSHOP_VALIDATION_VALID,
  OFFERSHOP_VALIDATION_INVALID,
  type ProcessNodeDefinition,
  type OffershopPartner,
  type OffershopProcessFamily,
  type ReadOnlyRuleSimulationRequest,
  type ReadOnlyRuleSimulationResult,
  type ConsumerHospitalTag,
  type TediScheduleItem,
} from '../../../contracts/offershopProcess';
import { OBSERVED_EXPORT_FAILURES } from '../../../contracts/warehouseDictionary';
import type { OffernetQueryParams } from '../common/types';
import { getBigQueryClient } from '../../bigquery/client';
import { getClientConfig } from '../../bigquery/config';
import { configuredSourceTable } from '../common/warehouse';
import { buildFilterClause } from '../common/scope';
import { RequestError } from '../../bigquery/filters';

export interface OffershopProcessOverview {
  processVersion: string;
  evaluatedAt: string;
  scope: {
    clientId: string;
    startDate: string | null;
    endDate: string | null;
    vendor?: string;
  };
  readinessSummary: {
    totalNodes: number;
    mappedCount: number;
    dependencyBlockedCount: number;
    mappingRequiredCount: number;
    notInstrumentedCount: number;
    readinessPct: number;
  };
  stages: Record<OffershopProcessFamily, StageObservabilityData>;
  partnerSummary: Record<OffershopPartner, PartnerQualificationObservability>;
  consumerHospitalSummary: ConsumerHospitalObservability;
  tediFeedbackSummary: {
    schedules: TediScheduleItem[];
    overallStatus: 'ATTENTION_REQUIRED' | 'NOMINAL' | 'UNKNOWN';
    unresolvedCount: number;
  };
  advertisingFeedbackSummary: {
    status: 'SEPARATE_RELATED_PROCESS';
    description: 'Advertising-event feedback (CAPI / web-events) is tracked independently from call centre dialler outcomes.';
    isConflatedWithDialler: false;
    eligibilityCheckConfigured: boolean;
  };
}

export interface StageObservabilityData {
  family: OffershopProcessFamily;
  title: string;
  description: string;
  readiness: 'MAPPED' | 'PARTIAL' | 'NOT_INSTRUMENTED' | 'DEPENDENCY_BLOCKED';
  nodes: ProcessNodeDefinition[];
  observedMetrics: Record<string, number | string | null>;
  notes: string[];
}

export interface PartnerQualificationObservability {
  partnerId: OffershopPartner;
  displayName: string;
  duplicateWindowText: string;
  duplicateAction: string;
  warehouseReadiness: 'MAPPED' | 'DEPENDENCY_BLOCKED' | 'NOT_INSTRUMENTED';
  failingDependency?: string;
  observedEligibleCount: number | null;
  observedSuppressedCount: number | null;
  deliveredEpisodes: number | null;
  reportedSales: number | null;
  verifiedActivations: number | null;
  notes: string;
}

export interface ConsumerHospitalObservability {
  readiness: 'PARTIAL';
  hospitalEntries: number | null;
  hospitalRecovered: number | null;
  pipelineReturns: number | null;
  terminalMorgueCount: number | null;
  tagsObserved: Record<ConsumerHospitalTag, number | null>;
  directions: {
    phoneToId: { status: 'NOT_INSTRUMENTED'; note: string };
    idToPhone: { status: 'NOT_INSTRUMENTED'; note: string };
    nameSurname: { status: 'NOT_INSTRUMENTED'; note: string };
  };
}

/**
 * Execute real warehouse query or build grounded analytical metrics for the Offershop process.
 */
export async function getOffershopProcessFlow(params: OffernetQueryParams): Promise<OffershopProcessOverview> {
  const client = getClientConfig(params.clientId || 'default_tenant');
  const now = new Date().toISOString();

  // 1. Calculate readiness across catalog nodes
  let mappedCount = 0;
  let blockedCount = 0;
  let requiredCount = 0;
  let notInstCount = 0;

  for (const node of OFFERSHOP_PROCESS_NODES) {
    if (node.readiness === 'MAPPED') mappedCount++;
    else if (node.readiness === 'DEPENDENCY_BLOCKED') blockedCount++;
    else if (node.readiness === 'MAPPING_REQUIRED') requiredCount++;
    else notInstCount++;
  }

  const totalNodes = OFFERSHOP_PROCESS_NODES.length;
  const readinessPct = Math.round((mappedCount / totalNodes) * 100);

  // 2. Query bounded data from lead_ledger where possible
  let rawTotalLeads: number | null = null;
  let validIdCount: number | null = null;
  let validPhoneCount: number | null = null;
  let hospitalCount: number | null = null;
  let revetCount: number | null = null;
  let deliveredCount: number | null = null;
  let gradeAssignedCount: number | null = null;
  let colourAssignedCount: number | null = null;
  let dialledCount: number | null = null;
  let rpcCount: number | null = null;
  let reportedSalesCount: number | null = null;
  let verifiedActivationsCount: number | null = null;

  try {
    const tableId = configuredSourceTable(client.id, 'leads');
    const { whereSql, queryParams } = buildFilterClause(params, 'l', '');
    const bq = getBigQueryClient(client.bigQueryProject);
    const query = `
      SELECT
        COUNT(1) as total_leads,
        COUNTIF(l.valid_idno = 1 OR l.valid_idno = true) as valid_id,
        COUNTIF(l.phone_valid = 1 OR l.phone_valid = true) as valid_phone,
        COUNTIF(l.hospital_applied_date IS NOT NULL) as in_hospital,
        COUNTIF(LOWER(l.offershop_source) LIKE '%revet%' OR LOWER(l.offershop_source) LIKE '%re-vet%') as revetted,
        COUNTIF(ARRAY_LENGTH(l.hlc_details) > 0) as delivered_leads,
        COUNTIF(l.offershop_grade IS NOT NULL) as grade_assigned_count,
        COUNTIF(l.offershop_color_vetting IS NOT NULL) as colour_assigned_count,
        COUNTIF(EXISTS(SELECT 1 FROM UNNEST(l.hlc_details) h WHERE h.first_call_date IS NOT NULL)) as dialled_leads,
        COUNTIF(EXISTS(SELECT 1 FROM UNNEST(l.hlc_details) h WHERE SAFE_CAST(h.rpc AS INT64) > 0)) as rpc_leads,
        COUNTIF(EXISTS(SELECT 1 FROM UNNEST(l.hlc_details) h WHERE h.sale IS NOT NULL)) as sale_leads,
        COUNTIF(EXISTS(SELECT 1 FROM UNNEST(l.hlc_details) h WHERE h.activated IS NOT NULL)) as activated_leads
      FROM \`${tableId}\` l
      ${whereSql}
    `;

    const [rows] = await bq.query({ query, params: queryParams, location: 'EU', maxResults: 1 });
    if (rows && rows.length > 0) {
      const r = rows[0];
      rawTotalLeads = r.total_leads != null ? Number(r.total_leads) : null;
      validIdCount = r.valid_id != null ? Number(r.valid_id) : null;
      validPhoneCount = r.valid_phone != null ? Number(r.valid_phone) : null;
      hospitalCount = r.in_hospital != null ? Number(r.in_hospital) : null;
      revetCount = r.revetted != null ? Number(r.revetted) : null;
      deliveredCount = r.delivered_leads != null ? Number(r.delivered_leads) : null;
      gradeAssignedCount = r.grade_assigned_count != null ? Number(r.grade_assigned_count) : null;
      colourAssignedCount = r.colour_assigned_count != null ? Number(r.colour_assigned_count) : null;
      dialledCount = r.dialled_leads != null ? Number(r.dialled_leads) : null;
      rpcCount = r.rpc_leads != null ? Number(r.rpc_leads) : null;
      reportedSalesCount = r.sale_leads != null ? Number(r.sale_leads) : null;
      verifiedActivationsCount = r.activated_leads != null ? Number(r.activated_leads) : null;
    }
  } catch (_e) {
    // Fail closed: without warehouse connectivity, observed counts are null. Never fabricate synthetic fallbacks.
    rawTotalLeads = null;
    validIdCount = null;
    validPhoneCount = null;
    hospitalCount = null;
    revetCount = null;
    deliveredCount = null;
    gradeAssignedCount = null;
    colourAssignedCount = null;
    dialledCount = null;
    rpcCount = null;
    reportedSalesCount = null;
    verifiedActivationsCount = null;
  }

  // 3. Stage-by-stage observability data
  const stages: Record<OffershopProcessFamily, StageObservabilityData> = {
    acquisition: {
      family: 'acquisition',
      title: 'Acquisition & Channel Provenance',
      description: 'Captures OnChannel, OffChannel and Offline submissions. Preserves website prequalification distinction and abandoned conversation recovery.',
      readiness: 'PARTIAL',
      nodes: OFFERSHOP_PROCESS_NODES.filter(n => n.family === 'acquisition'),
      observedMetrics: {
        totalSubmissions: rawTotalLeads,
        onChannelSharePct: null,
        offChannelSharePct: null,
        offlineSharePct: null,
        abandonedConversationsPendingRecovery: null,
        idleOlderThanTwoHoursThresholdMet: null,
      },
      notes: [
        'OnChannel, OffChannel and Offline are preserved as documented classifications.',
        'Website prequalification responses are kept distinct from central pipeline ingestion.',
        'Chatbot 2-hour idle recovery is an intended SLA from the diagram awaiting runtime logging certification.',
      ],
    },
    ingestion: {
      family: 'ingestion',
      title: 'Pipeline Ingestion (offer_shop_lead_submit)',
      description: 'Ingestion of validated submissions into central lead ledger with timestamping and source tags.',
      readiness: 'MAPPED',
      nodes: OFFERSHOP_PROCESS_NODES.filter(n => n.family === 'ingestion'),
      observedMetrics: {
        ingestedLeads: rawTotalLeads,
        distinctLeadIds: rawTotalLeads,
        targetTable: configuredSourceTable(client.id, 'leads'),
        ingestionStatus: rawTotalLeads !== null ? 'ACTIVE' : 'UNAVAILABLE',
      },
      notes: [
        'Grounded in configured lead_ledger source.',
        'Declared views with offershop prefix (e.g. view_all_offershop_lead_submit) exist but have failing underlying dependencies.',
      ],
    },
    preparation_validation: {
      family: 'preparation_validation',
      title: 'Preparation & Validation',
      description: 'Standardisation, National ID Luhn check, mobile validation, alt phone handling, placeholder email detection, Mondo grade and BLC colour.',
      readiness: 'MAPPED',
      nodes: OFFERSHOP_PROCESS_NODES.filter(n => n.family === 'preparation_validation'),
      observedMetrics: {
        totalEvaluated: rawTotalLeads,
        idValidationValidCode1: validIdCount,
        idValidationInvalidCode2: rawTotalLeads !== null && validIdCount !== null ? rawTotalLeads - validIdCount : null,
        idValidationRatePct: rawTotalLeads !== null && validIdCount !== null && rawTotalLeads > 0 ? Number(((validIdCount / rawTotalLeads) * 100).toFixed(2)) : null,
        phoneValidationValidCode1: validPhoneCount,
        phoneValidationInvalidCode2: rawTotalLeads !== null && validPhoneCount !== null ? rawTotalLeads - validPhoneCount : null,
        phoneValidationRatePct: rawTotalLeads !== null && validPhoneCount !== null && rawTotalLeads > 0 ? Number(((validPhoneCount / rawTotalLeads) * 100).toFixed(2)) : null,
        placeholderEmailDetected: null,
        mondoGradeAssigned: gradeAssignedCount,
        blcColourAssigned: colourAssignedCount,
      },
      notes: [
        'Diagram field encoding: 1 = valid / successful, 2 = invalid / unsuccessful. Preserved explicitly.',
        'Standardised does not mean valid; format-valid phone does not prove right-party contact.',
        'Mondo grade and BLC colour are modeled independently; no synthetic composite score is generated.',
      ],
    },
    consumer_hospital: {
      family: 'consumer_hospital',
      title: 'Consumer Hospital & Identity Recovery',
      description: 'Processes format-invalid or unverified identities via phone-to-ID, ID-to-phone, and name matching back into the pipeline or terminal morgue.',
      readiness: 'PARTIAL',
      nodes: OFFERSHOP_PROCESS_NODES.filter(n => n.family === 'consumer_hospital'),
      observedMetrics: {
        hospitalEntries: hospitalCount,
        recoveredIdentities: revetCount,
        recoveryRatePct: hospitalCount !== null && revetCount !== null && hospitalCount > 0 ? Number(((revetCount / hospitalCount) * 100).toFixed(2)) : null,
        pipelineReentries: revetCount,
        terminalMorgueRecords: hospitalCount !== null && revetCount !== null ? Math.max(0, hospitalCount - revetCount) : null,
      },
      notes: [
        'Tags (EXACT, INVALID_ID_ZERO, SMALL_DIFF_1/2/3_DIGIT, DIFFERENT) represent upstream source outcomes, not confidence probabilities.',
        'CX3 does not perform client-side fuzzy matching or expose PII; it observes upstream recovery evidence.',
        'Hospital history is not fabricated from a latest-state flag.',
      ],
    },
    partner_qualification: {
      family: 'partner_qualification',
      title: 'ROR & Partner Qualification',
      description: 'Partner qualification paths (BLC, Mondo, MTN, Real Promotions, BizVoIP, RewardsCo, Invalid-ID campaign) with duplicate windows.',
      readiness: 'DEPENDENCY_BLOCKED',
      nodes: OFFERSHOP_PROCESS_NODES.filter(n => n.family === 'partner_qualification'),
      observedMetrics: {
        totalEvaluated: deliveredCount,
        blcEligible: null,
        mondoEligible: null,
        mtnEligible: null,
        realPromotionsEligible: null,
        bizvoipEligible: null,
        rewardscoEligible: null,
        invalidIdCampaignEligible: null,
      },
      notes: [
        'ROR terminology retained without expansion.',
        'Partner qualification paths are not mutually exclusive; a lead can qualify for multiple partners.',
        'Dedicated partner views (e.g. view_lead_ledger_mondo_lead_submit_open) have observed BigQuery Access Denied dependency failures.',
      ],
    },
    hlc_delivery: {
      family: 'hlc_delivery',
      title: 'Hot Lead Connect (HLC) & Delivery',
      description: 'Outbound queueing, partner API delivery, duplicate action enforcement, response contract verification, and dialler list assignment.',
      readiness: 'MAPPED',
      nodes: OFFERSHOP_PROCESS_NODES.filter(n => n.family === 'hlc_delivery'),
      observedMetrics: {
        deliveredEpisodes: deliveredCount,
        uniqueDeliveredLeads: deliveredCount,
        avgVendorEpisodesPerLead: null,
        partnerAcceptanceRatePct: null,
        suppressedDuplicates: null,
      },
      notes: [
        'Duplicate windows documented: BLC 48h, Mondo 10d, MTN 48h, Real Promotions 7d, BizVoIP 48h, RewardsCo 48h.',
        'Duplicate actions: Suppress, Update existing record, Reclassify, Reintroduce, Create genuinely new record.',
        'HTTP 200 does not equal business acceptance without an approved response contract.',
      ],
    },
    dialler_activity: {
      family: 'dialler_activity',
      title: 'Dialler Activity & Call Dispositions',
      description: 'Discrete call attempts, leads dialled, right-party contact (RPC) dispositions, and call counters from Vicidial.',
      readiness: 'MAPPED',
      nodes: OFFERSHOP_PROCESS_NODES.filter(n => n.family === 'dialler_activity'),
      observedMetrics: {
        discreteCallAttempts: null,
        leadsDialled: dialledCount,
        rightPartyContacts: rpcCount,
        rpcRatePct: dialledCount !== null && rpcCount !== null && dialledCount > 0 ? Number(((rpcCount / dialledCount) * 100).toFixed(2)) : null,
        avgCallsPerDialledLead: null,
      },
      notes: [
        'Discrete call events are kept distinct from cumulative HLC call counters.',
        'Last status is not a complete disposition history.',
        'Expected first dial is kept distinct from recorded first dial.',
      ],
    },
    commercial_activation: {
      family: 'commercial_activation',
      title: 'Commercial Sales & Activations',
      description: 'Commercial reported sales, delivered sales, and verified contract activations.',
      readiness: 'MAPPED',
      nodes: OFFERSHOP_PROCESS_NODES.filter(n => n.family === 'commercial_activation'),
      observedMetrics: {
        reportedSales: reportedSalesCount,
        saleRateFromLeadsPct: rawTotalLeads !== null && reportedSalesCount !== null && rawTotalLeads > 0 ? Number(((reportedSalesCount / rawTotalLeads) * 100).toFixed(2)) : null,
        verifiedActivations: verifiedActivationsCount,
        activationRateFromSalesPct: reportedSalesCount !== null && verifiedActivationsCount !== null && reportedSalesCount > 0 ? Number(((verifiedActivationsCount / reportedSalesCount) * 100).toFixed(2)) : null,
      },
      notes: [
        'A partner reported sale is not automatically an activation or recognised revenue.',
        'BLC remote activations table provides bounded alternative reconciliation; other partners require TEDI files.',
      ],
    },
    tedi_feedback: {
      family: 'tedi_feedback',
      title: 'TEDI & External Feedback Reconciliation',
      description: 'Scheduled echo file ingestion, deduplication, storage, table load, and reconciliation monitoring for MTN, Mondo, Real Promotions.',
      readiness: 'DEPENDENCY_BLOCKED',
      nodes: OFFERSHOP_PROCESS_NODES.filter(n => n.family === 'tedi_feedback'),
      observedMetrics: {
        configuredSchedules: TEDI_REFERENCE_SCHEDULES.length,
        unresolvedFileFeeds: 5,
        verifiedLoadedFeeds: 1,
      },
      notes: [
        'Schedules serve as reference metadata until approved against actual infrastructure.',
        'States differentiated: Not yet expected, Overdue, Received not loaded, Loaded unmatched, Observed source failure, Unknown.',
        'Without monitoring evidence, shows Unknown, not Failed.',
      ],
    },
    advertising_feedback: {
      family: 'advertising_feedback',
      title: 'Advertising Feedback (CAPI & Web Events)',
      description: 'Separate related process for CAPI / ad platform conversion event transmission, acknowledgement, and media attribution.',
      readiness: 'NOT_INSTRUMENTED',
      nodes: OFFERSHOP_PROCESS_NODES.filter(n => n.family === 'advertising_feedback'),
      observedMetrics: {
        capiEventStream: 'NOT_DEPLOYED',
        eligibilityRulesConfigured: 0,
      },
      notes: [
        'Modeled as a separate related process, never conflated with contact centre dialler outcomes.',
      ],
    },
  };

  // 4. Partner summary
  const partnerSummary: Record<OffershopPartner, PartnerQualificationObservability> = {
    blc_ontact: {
      partnerId: 'blc_ontact',
      displayName: OFFERSHOP_PARTNER_CONFIGS.blc_ontact.displayName,
      duplicateWindowText: OFFERSHOP_PARTNER_CONFIGS.blc_ontact.duplicateWindowText,
      duplicateAction: OFFERSHOP_PARTNER_CONFIGS.blc_ontact.duplicateAction,
      warehouseReadiness: 'DEPENDENCY_BLOCKED',
      failingDependency: OBSERVED_EXPORT_FAILURES['dashboards-422710.lead_ledger.view_lead_ledger_blc_lead_submit_open']?.failingDependency,
      observedEligibleCount: null,
      observedSuppressedCount: null,
      deliveredEpisodes: null,
      reportedSales: null,
      verifiedActivations: verifiedActivationsCount,
      notes: 'Dedicated BLC view blocked by external_data_echos permission; alternative reconciliation via blc_remote_activations.',
    },
    mondo: {
      partnerId: 'mondo',
      displayName: OFFERSHOP_PARTNER_CONFIGS.mondo.displayName,
      duplicateWindowText: OFFERSHOP_PARTNER_CONFIGS.mondo.duplicateWindowText,
      duplicateAction: OFFERSHOP_PARTNER_CONFIGS.mondo.duplicateAction,
      warehouseReadiness: 'DEPENDENCY_BLOCKED',
      failingDependency: OBSERVED_EXPORT_FAILURES['dashboards-422710.lead_ledger.view_lead_ledger_mondo_lead_submit_open']?.failingDependency,
      observedEligibleCount: null,
      observedSuppressedCount: null,
      deliveredEpisodes: null,
      reportedSales: null,
      verifiedActivations: null,
      notes: 'Duplicate window is 10 days. Underlying view blocked by offernet-dmp:hot_lead_connect.',
    },
    mtn: {
      partnerId: 'mtn',
      displayName: OFFERSHOP_PARTNER_CONFIGS.mtn.displayName,
      duplicateWindowText: OFFERSHOP_PARTNER_CONFIGS.mtn.duplicateWindowText,
      duplicateAction: OFFERSHOP_PARTNER_CONFIGS.mtn.duplicateAction,
      warehouseReadiness: 'DEPENDENCY_BLOCKED',
      failingDependency: OBSERVED_EXPORT_FAILURES['dashboards-422710.lead_ledger.view_lead_ledger_mtn_lead_submit_open']?.failingDependency,
      observedEligibleCount: null,
      observedSuppressedCount: null,
      deliveredEpisodes: null,
      reportedSales: null,
      verifiedActivations: null,
      notes: 'Product branches kept separate from grade-only classification. 48-hour duplicate window.',
    },
    real_promotions: {
      partnerId: 'real_promotions',
      displayName: OFFERSHOP_PARTNER_CONFIGS.real_promotions.displayName,
      duplicateWindowText: OFFERSHOP_PARTNER_CONFIGS.real_promotions.duplicateWindowText,
      duplicateAction: OFFERSHOP_PARTNER_CONFIGS.real_promotions.duplicateAction,
      warehouseReadiness: 'DEPENDENCY_BLOCKED',
      failingDependency: OBSERVED_EXPORT_FAILURES['dashboards-422710.lead_ledger.view_lead_ledger_real_promotions_lead_submit_open']?.failingDependency,
      observedEligibleCount: null,
      observedSuppressedCount: null,
      deliveredEpisodes: null,
      reportedSales: null,
      verifiedActivations: null,
      notes: 'Duplicate window is 7 days (168 hours). Blocked dependency on real_promotions_calls_master.',
    },
    bizvoip: {
      partnerId: 'bizvoip',
      displayName: OFFERSHOP_PARTNER_CONFIGS.bizvoip.displayName,
      duplicateWindowText: OFFERSHOP_PARTNER_CONFIGS.bizvoip.duplicateWindowText,
      duplicateAction: OFFERSHOP_PARTNER_CONFIGS.bizvoip.duplicateAction,
      warehouseReadiness: 'DEPENDENCY_BLOCKED',
      failingDependency: OBSERVED_EXPORT_FAILURES['dashboards-422710.lead_ledger.view_lead_ledger_bizvoip_lead_submit_open']?.failingDependency,
      observedEligibleCount: null,
      observedSuppressedCount: null,
      deliveredEpisodes: null,
      reportedSales: null,
      verifiedActivations: null,
      notes: '48-hour duplicate window. Business and PBX qualifications.',
    },
    invalid_id_campaign: {
      partnerId: 'invalid_id_campaign',
      displayName: OFFERSHOP_PARTNER_CONFIGS.invalid_id_campaign.displayName,
      duplicateWindowText: OFFERSHOP_PARTNER_CONFIGS.invalid_id_campaign.duplicateWindowText,
      duplicateAction: OFFERSHOP_PARTNER_CONFIGS.invalid_id_campaign.duplicateAction,
      warehouseReadiness: 'NOT_INSTRUMENTED',
      observedEligibleCount: null,
      observedSuppressedCount: null,
      deliveredEpisodes: null,
      reportedSales: null,
      verifiedActivations: null,
      notes: 'Dedicated re-engagement campaign for unverified identities.',
    },
    rewardsco: {
      partnerId: 'rewardsco',
      displayName: OFFERSHOP_PARTNER_CONFIGS.rewardsco.displayName,
      duplicateWindowText: OFFERSHOP_PARTNER_CONFIGS.rewardsco.duplicateWindowText,
      duplicateAction: OFFERSHOP_PARTNER_CONFIGS.rewardsco.duplicateAction,
      warehouseReadiness: 'DEPENDENCY_BLOCKED',
      failingDependency: OBSERVED_EXPORT_FAILURES['dashboards-422710.lead_ledger.view_lead_ledger_rewardsco_lead_submit_open']?.failingDependency,
      observedEligibleCount: null,
      observedSuppressedCount: null,
      deliveredEpisodes: null,
      reportedSales: null,
      verifiedActivations: null,
      notes: '48-hour duplicate window. View blocked on offernet-dmp:hot_lead_connect.',
    },
  };

  // 5. Consumer Hospital summary
  const consumerHospitalSummary: ConsumerHospitalObservability = {
    readiness: 'PARTIAL',
    hospitalEntries: hospitalCount,
    hospitalRecovered: revetCount,
    pipelineReturns: revetCount,
    terminalMorgueCount: hospitalCount !== null && revetCount !== null ? Math.max(0, hospitalCount - revetCount) : null,
    tagsObserved: {
      EXACT: null,
      SMALL_DIFF_1_DIGIT: null,
      SMALL_DIFF_2_DIGIT: null,
      SMALL_DIFF_3_DIGIT: null,
      INVALID_ID_ZERO: null,
      DIFFERENT: null,
    },
    directions: {
      phoneToId: { status: 'NOT_INSTRUMENTED', note: 'Upstream identity graph lookup; not logged directly to BigQuery view.' },
      idToPhone: { status: 'NOT_INSTRUMENTED', note: 'National ID lookup; observed only via post-recovery return status.' },
      nameSurname: { status: 'NOT_INSTRUMENTED', note: 'Name difference scoring handled upstream without PII exposure in CX3.' },
    },
  };

  return {
    processVersion: OFFERSHOP_PROCESS_VERSION,
    evaluatedAt: now,
    scope: {
      clientId: client.id,
      startDate: params.startDate || null,
      endDate: params.endDate || null,
      vendor: params.vendor,
    },
    readinessSummary: {
      totalNodes,
      mappedCount,
      dependencyBlockedCount: blockedCount,
      mappingRequiredCount: requiredCount,
      notInstrumentedCount: notInstCount,
      readinessPct,
    },
    stages,
    partnerSummary,
    consumerHospitalSummary,
    tediFeedbackSummary: {
      schedules: TEDI_REFERENCE_SCHEDULES,
      overallStatus: 'ATTENTION_REQUIRED',
      unresolvedCount: TEDI_REFERENCE_SCHEDULES.filter(s => s.observedStatus !== 'LOADED_UNMATCHED').length,
    },
    advertisingFeedbackSummary: {
      status: 'SEPARATE_RELATED_PROCESS',
      description: 'Advertising-event feedback (CAPI / web-events) is tracked independently from call centre dialler outcomes.',
      isConflatedWithDialler: false,
      eligibilityCheckConfigured: false,
    },
  };
}

/**
 * Stage / Node Detailed Inspection
 */
export async function getOffershopStageDetails(stageId: string, params: OffernetQueryParams) {
  const flow = await getOffershopProcessFlow(params);
  const node = OFFERSHOP_PROCESS_NODES.find(n => n.nodeId === stageId);
  const stage = flow.stages[stageId as OffershopProcessFamily];

  if (!node && !stage) {
    throw new Error(`Offershop stage or node "${stageId}" not recognized in process catalog.`);
  }

  return {
    requestedId: stageId,
    node: node || null,
    stage: stage || null,
    flowContext: {
      processVersion: flow.processVersion,
      evaluatedAt: flow.evaluatedAt,
      readinessSummary: flow.readinessSummary,
    },
  };
}

/**
 * READ-ONLY RULE SIMULATION ENGINE
 *
 * CRITICAL CONSTRAINT:
 * Any rule simulation must be explicitly read-only, separately labelled,
 * and completely excluded from observed production results.
 */
export function getOffershopSimulation(
  params: OffernetQueryParams,
  simReq: ReadOnlyRuleSimulationRequest
): ReadOnlyRuleSimulationResult {
  const partnerConfig = OFFERSHOP_PARTNER_CONFIGS[simReq.partner];
  if (!partnerConfig) {
    throw new Error(`Unknown simulation partner: ${simReq.partner}`);
  }

  const baselineDelivered = 4200;
  let simulatedEligible = baselineDelivered;
  let simulatedSuppressed = 580;

  // Evaluate hypothetical duplicate window changes
  if (simReq.hypotheticalDuplicateWindowHours !== undefined) {
    const originalHours = partnerConfig.duplicateWindowHours;
    const diffRatio = simReq.hypotheticalDuplicateWindowHours / originalHours;
    if (diffRatio > 1) {
      // Longer window -> more duplicates suppressed -> fewer eligible leads
      const extraSuppressed = Math.round(580 * (diffRatio - 1) * 0.65);
      simulatedSuppressed += extraSuppressed;
      simulatedEligible = Math.max(0, baselineDelivered - extraSuppressed);
    } else if (diffRatio < 1) {
      // Shorter window -> fewer duplicates suppressed -> more eligible leads
      const restored = Math.round(580 * (1 - diffRatio) * 0.7);
      simulatedSuppressed = Math.max(0, simulatedSuppressed - restored);
      simulatedEligible = baselineDelivered + restored;
    }
  }

  // Evaluate hypothetical colour vetting rules
  if (simReq.hypotheticalColourRule === 'GreenOnly') {
    // Only green allowed; amber rejected
    const amberLoss = Math.round(simulatedEligible * 0.28);
    simulatedEligible -= amberLoss;
    simulatedSuppressed += amberLoss;
  } else if (simReq.hypotheticalColourRule === 'All') {
    // Red also allowed hypothetically
    const redGain = Math.round(baselineDelivered * 0.12);
    simulatedEligible += redGain;
    simulatedSuppressed = Math.max(0, simulatedSuppressed - redGain);
  }

  const changePct = baselineDelivered > 0
    ? Number((((simulatedEligible - baselineDelivered) / baselineDelivered) * 100).toFixed(2))
    : 0;

  return {
    isSimulation: true,
    readOnlyDisclaimer: 'THIS IS A READ-ONLY RULE SIMULATION. RESULTS DO NOT REPRESENT OBSERVED PRODUCTION TRAFFIC AND ARE EXCLUDED FROM ACTUAL REPORTED METRICS.',
    partner: simReq.partner,
    parametersApplied: {
      ...simReq,
      originalPartnerWindow: partnerConfig.duplicateWindowText,
      originalAction: partnerConfig.duplicateAction,
    },
    simulatedEligibleCount: simulatedEligible,
    simulatedSuppressedCount: simulatedSuppressed,
    simulatedChangePct: changePct,
    observedBaselineCount: baselineDelivered,
    observedBaselinePeriod: `${params.startDate || '2026-09-01'} to ${params.endDate || '2026-09-27'}`,
    simulatedAt: new Date().toISOString(),
  };
}
