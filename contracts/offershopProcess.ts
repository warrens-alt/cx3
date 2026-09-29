/**
 * Offershop Deal Flow V3 - Authoritative Process Contract
 *
 * Grounded in:
 * - Diagram: "Offershop Deal Flow V3-Page-1.drawio (1)(1).svg"
 * - Repository: warrens-alt/cx3
 * - Warehouse dictionary snapshot: dashboards-422710 & vibe-code-warren-stear
 *
 * EVIDENCE BOUNDARIES:
 * - The diagram documents intended processes, terminology, branches and example rules.
 * - Current code shows implemented behaviour, not proof of successful deployment.
 * - Warehouse schemas show declared structure, not verified semantics or completeness.
 * - Exported samples show bounded historical observations, not production totals.
 * - Authorised runtime queries provide scoped observations, not automatic certification.
 *
 * Contradictions between these sources are preserved and documented, never silently reconciled.
 */

export const OFFERSHOP_PROCESS_VERSION = 'cx.offershop.process.3.0.0';

/**
 * Diagram field validation encoding.
 * 1 = valid / successful
 * 2 = invalid / unsuccessful
 * NEVER use JavaScript truthiness.
 */
export type OffershopValidationCode = 1 | 2;
export const OFFERSHOP_VALIDATION_VALID: OffershopValidationCode = 1;
export const OFFERSHOP_VALIDATION_INVALID: OffershopValidationCode = 2;

export function parseOffershopValidationCode(val: unknown): OffershopValidationCode | null {
  if (val === 1 || val === '1') return OFFERSHOP_VALIDATION_VALID;
  if (val === 2 || val === '2') return OFFERSHOP_VALIDATION_INVALID;
  return null;
}

export function isOffershopValid(code: OffershopValidationCode | null | undefined): boolean {
  return code === OFFERSHOP_VALIDATION_VALID;
}

/**
 * Documented process classifications for incoming supply.
 * Note: These are distinct from marketing channel/platform fields.
 */
export type OffershopSupplyClassification = 'OnChannel' | 'OffChannel' | 'Offline';

/**
 * Documented supply channels.
 */
export type OffershopSupplyChannel =
  | 'website_prequalification'
  | 'messenger_whatsapp_conversation'
  | 'platform_leads'
  | 'offline_cold_list';

/**
 * Consumer Hospital recovery directions documented in Deal Flow V3.
 */
export type ConsumerHospitalRecoveryDirection =
  | 'phone_to_id'
  | 'id_to_phone'
  | 'name_surname';

/**
 * Consumer Hospital outcome tags documented in Deal Flow V3.
 * Preserved as source outcomes, not confidence probabilities.
 */
export type ConsumerHospitalTag =
  | 'EXACT'
  | 'INVALID_ID_ZERO'
  | 'SMALL_DIFF_1_DIGIT'
  | 'SMALL_DIFF_2_DIGIT'
  | 'SMALL_DIFF_3_DIGIT'
  | 'DIFFERENT';

export const CONSUMER_HOSPITAL_TAGS: readonly ConsumerHospitalTag[] = [
  'EXACT',
  'INVALID_ID_ZERO',
  'SMALL_DIFF_1_DIGIT',
  'SMALL_DIFF_2_DIGIT',
  'SMALL_DIFF_3_DIGIT',
  'DIFFERENT',
] as const;

/**
 * ROR (Right of Refusal) Partner scope as depicted in diagram.
 */
export type OffershopPartner =
  | 'blc_ontact'
  | 'mondo'
  | 'mtn'
  | 'real_promotions'
  | 'bizvoip'
  | 'invalid_id_campaign'
  | 'rewardsco';

export const OFFERSHOP_PARTNERS: readonly OffershopPartner[] = [
  'blc_ontact',
  'mondo',
  'mtn',
  'real_promotions',
  'bizvoip',
  'invalid_id_campaign',
  'rewardsco',
] as const;

export interface PartnerConfig {
  id: OffershopPartner;
  displayName: string;
  duplicateWindowText: string;
  duplicateWindowHours: number;
  duplicateAction: DuplicateAction;
  intendedRules: string[];
  evidenceSource: string;
  warehouseTenantId: string;
  specificExclusions: string[];
}

export type DuplicateAction =
  | 'SUPPRESS'
  | 'UPDATE_EXISTING'
  | 'RECLASSIFY'
  | 'REINTRODUCE'
  | 'CREATE_NEW';

/**
 * Documented duplicate windows and actions from the diagram.
 * Awaiting runtime/version confirmation; not automatic active configuration.
 */
export const OFFERSHOP_PARTNER_CONFIGS: Record<OffershopPartner, PartnerConfig> = {
  blc_ontact: {
    id: 'blc_ontact',
    displayName: 'BLC / ONtact',
    duplicateWindowText: '48 hours',
    duplicateWindowHours: 48,
    duplicateAction: 'UPDATE_EXISTING',
    intendedRules: [
      'Duplicate window: 48 hours',
      'BLC Colour Vetting check (Green/Amber pass, Red fails to hospital or alternative)',
      'Income and employment threshold check',
      'Delivery queueing into BLC remote dialler'
    ],
    evidenceSource: 'Diagram: BLC Deal Flow section & Lead Ledger view_lead_ledger_blc_lead_submit_open',
    warehouseTenantId: 'ontact_blc',
    specificExclusions: ['Red colour vetting', 'Prior submission within 48h unless NEWRC status'],
  },
  mondo: {
    id: 'mondo',
    displayName: 'Mondo',
    duplicateWindowText: '10 days',
    duplicateWindowHours: 240,
    duplicateAction: 'SUPPRESS',
    intendedRules: [
      'Duplicate window: 10 days',
      'Mondo Grade classification (independent classification, not combined quality score)',
      'Daily exclusion and fraud list checks',
      'Credit vetting and network approval'
    ],
    evidenceSource: 'Diagram: Mondo ROR Qualification & Lead Ledger view_lead_ledger_mondo_lead_submit_open',
    warehouseTenantId: 'mondo',
    specificExclusions: ['Mondo daily fraud list', 'Daily exclusion files', 'Under-18 age'],
  },
  mtn: {
    id: 'mtn',
    displayName: 'MTN',
    duplicateWindowText: '48 hours',
    duplicateWindowHours: 48,
    duplicateAction: 'UPDATE_EXISTING',
    intendedRules: [
      'Duplicate window: 48 hours',
      'Product branches separate from grade-only classification',
      'Subscriber status and SIM-only vs contract eligibility',
      'HLC delivery with MTN contract transaction logging'
    ],
    evidenceSource: 'Diagram: MTN Product Routing & Lead Ledger view_lead_ledger_mtn_lead_submit_open',
    warehouseTenantId: 'mtn',
    specificExclusions: ['Active blacklisted MSISDN', 'Non-South African national ID'],
  },
  real_promotions: {
    id: 'real_promotions',
    displayName: 'Real Promotions',
    duplicateWindowText: '7 days',
    duplicateWindowHours: 168,
    duplicateAction: 'SUPPRESS',
    intendedRules: [
      'Duplicate window: 7 days (168 hours)',
      'Regional coverage and field agent campaign availability',
      'Age and residential qualification checks'
    ],
    evidenceSource: 'Diagram: Real Promotions Branch & view_lead_ledger_real_promotions_lead_submit_open',
    warehouseTenantId: 'real_promotions',
    specificExclusions: ['Outside coverage footprint', 'Duplicate within 7 days'],
  },
  bizvoip: {
    id: 'bizvoip',
    displayName: 'BizVoIP',
    duplicateWindowText: '48 hours',
    duplicateWindowHours: 48,
    duplicateAction: 'SUPPRESS',
    intendedRules: [
      'Duplicate window: 48 hours',
      'Business / commercial registration and PBX requirements',
      'Sole prop vs corporate vetting'
    ],
    evidenceSource: 'Diagram: BizVoIP Telco Branch & view_lead_ledger_bizvoip_lead_submit_open',
    warehouseTenantId: 'vodacom_bizvoip',
    specificExclusions: ['Residential inquiries without business usage', 'Duplicate within 48h'],
  },
  invalid_id_campaign: {
    id: 'invalid_id_campaign',
    displayName: 'Invalid-ID Campaign',
    duplicateWindowText: '48 hours',
    duplicateWindowHours: 48,
    duplicateAction: 'RECLASSIFY',
    intendedRules: [
      'Duplicate window: 48 hours',
      'Dedicated handling for records failing Luhn / format verification that hospital could not recover',
      'Specialised agent outreach for identification correction'
    ],
    evidenceSource: 'Diagram: Invalid-ID Campaign Dedicated Branch',
    warehouseTenantId: 'default_tenant',
    specificExclusions: ['Confirmed fraudulent identity tags'],
  },
  rewardsco: {
    id: 'rewardsco',
    displayName: 'RewardsCo',
    duplicateWindowText: '48 hours',
    duplicateWindowHours: 48,
    duplicateAction: 'SUPPRESS',
    intendedRules: [
      'Duplicate window: 48 hours',
      'Partner API acceptance contract verification',
      'Consumer consent timestamp verification'
    ],
    evidenceSource: 'Diagram: RewardsCo Outbound Delivery & view_lead_ledger_rewardsco_lead_submit_open',
    warehouseTenantId: 'rewardsco',
    specificExclusions: ['Duplicate submission within 48 hours'],
  },
};

/**
 * Process Family structure as defined in the Offershop Deal Flow specification.
 */
export type OffershopProcessFamily =
  | 'acquisition'
  | 'ingestion'
  | 'preparation_validation'
  | 'consumer_hospital'
  | 'partner_qualification'
  | 'hlc_delivery'
  | 'dialler_activity'
  | 'commercial_activation'
  | 'tedi_feedback'
  | 'advertising_feedback';

export type MappingReadiness =
  | 'MAPPED'
  | 'NOT_INSTRUMENTED'
  | 'MAPPING_REQUIRED'
  | 'DEPENDENCY_BLOCKED';

export interface ProcessNodeDefinition {
  nodeId: string;
  originalLabel: string;
  family: OffershopProcessFamily;
  partnerScope: OffershopPartner[] | 'all';
  intendedRule: string;
  evidenceSource: 'diagram' | 'warehouse_schema' | 'runtime_query' | 'sample_export' | 'manual_spec';
  mappedSourceId?: string;
  mappedTable?: string;
  mappedField?: string;
  entityGrain: string;
  approvedIdentifiers: string[];
  businessTimestampField?: string;
  businessTimezone: string;
  observedOutcomeFields: string[];
  mappingVersion: string;
  ruleVersion: string;
  readiness: MappingReadiness;
  unresolvedDependencies: string[];
  notes: string;
}

/**
 * Master catalog of Diagram Node IDs mapped to observable evidence.
 */
export const OFFERSHOP_PROCESS_NODES: ProcessNodeDefinition[] = [
  // 1. Acquisition & Ingestion
  {
    nodeId: 'ACQ-01',
    originalLabel: 'Website Prequalification & OnChannel Form Submit',
    family: 'acquisition',
    partnerScope: 'all',
    intendedRule: 'Website prequalification responses collected and evaluated prior to ingestion.',
    evidenceSource: 'diagram',
    mappedSourceId: 'onvest_global_lp_ingestion_settings',
    mappedTable: 'onvest_global_lp_ingestion_settings (referenced in diagram)',
    entityGrain: 'prequalification_response',
    approvedIdentifiers: ['session_id', 'client_token'],
    businessTimestampField: 'created_at',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['prequal_status', 'channel_type'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPING_REQUIRED',
    unresolvedDependencies: ['Warehouse access to onvest_global_lp_ingestion_settings pending'],
    notes: 'Preserves distinction between prequalification responses and pipeline submission.',
  },
  {
    nodeId: 'ACQ-02',
    originalLabel: 'OffChannel Conversations (Messenger & WhatsApp)',
    family: 'acquisition',
    partnerScope: 'all',
    intendedRule: 'Conversations active or abandoned. Documented recovery condition: last message older than two hours.',
    evidenceSource: 'diagram',
    mappedSourceId: 'offchannel_conversations',
    entityGrain: 'conversation_thread',
    approvedIdentifiers: ['conversation_id', 'wa_id'],
    businessTimestampField: 'last_message_at',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['is_completed', 'is_abandoned', 'idle_seconds'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'NOT_INSTRUMENTED',
    unresolvedDependencies: ['Chatbot message event logging table not deployed in current BigQuery dataset'],
    notes: 'A conversation is not automatically a submitted lead; abandonment is not permanent loss.',
  },
  {
    nodeId: 'ACQ-03',
    originalLabel: 'Platform Leads (Direct Media Forms)',
    family: 'acquisition',
    partnerScope: 'all',
    intendedRule: 'Direct form submissions from ad platforms (Facebook Instant Forms, etc.).',
    evidenceSource: 'diagram',
    mappedSourceId: 'platform_leads_stream',
    mappedTable: 'dashboards-422710.lead_ledger.view_lead_ledger_platform_insights',
    entityGrain: 'platform_lead_action',
    approvedIdentifiers: ['platform_lead_id'],
    businessTimestampField: 'created_time',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['campaign_id', 'adset_id'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'DEPENDENCY_BLOCKED',
    unresolvedDependencies: ['Underlying view_dashboard_waterfall_report_onvest returns Access Denied'],
    notes: 'Platform lead actions are not ledger leads; budget is not incurred spend.',
  },
  {
    nodeId: 'ACQ-04',
    originalLabel: 'Offline Cold-List Supply',
    family: 'acquisition',
    partnerScope: 'all',
    intendedRule: 'Batch ingested files retain origin and batch provenance.',
    evidenceSource: 'diagram',
    mappedSourceId: 'cold_list_batch',
    entityGrain: 'batch_file_record',
    approvedIdentifiers: ['batch_id', 'record_index'],
    businessTimestampField: 'batch_ingested_at',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['origin_supplier', 'batch_id'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'NOT_INSTRUMENTED',
    unresolvedDependencies: ['Batch metadata manifest not present in analytics warehouse'],
    notes: 'Offline cold-list supply must retain its own origin and batch provenance.',
  },
  {
    nodeId: 'ING-01',
    originalLabel: 'Central Pipeline Ingestion (offer_shop_lead_submit)',
    family: 'ingestion',
    partnerScope: 'all',
    intendedRule: 'Ingestion of validated submissions into central lead ledger with timestamping.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedField: 'offershop_source',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['offershop_source', 'offernet_medium', 'fetched'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Primary ledger table. Underlying views with offershop prefix exist in declared dictionary.',
  },

  // 2. Preparation & Validation
  {
    nodeId: 'PREP-01',
    originalLabel: 'Field Standardisation',
    family: 'preparation_validation',
    partnerScope: 'all',
    intendedRule: 'Canonical formatting for national ID, mobile number, alternative phone, email.',
    evidenceSource: 'warehouse_schema',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'standardised_idno, standardised_mobile, standardised_alt_phone, standardised_email',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['standardised_idno', 'standardised_mobile', 'standardised_email'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Standardised does not mean valid. Sensitive fields masked in public views.',
  },
  {
    nodeId: 'VAL-01',
    originalLabel: 'National ID Validity Check',
    family: 'preparation_validation',
    partnerScope: 'all',
    intendedRule: 'Luhn algorithm and date-of-birth consistency check. Encoded 1=valid, 2=invalid.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'valid_idno',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['valid_idno'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Diagram uses 1=valid, 2=invalid. Preserve explicit encoding.',
  },
  {
    nodeId: 'VAL-02',
    originalLabel: 'Phone Number Validity Check',
    family: 'preparation_validation',
    partnerScope: 'all',
    intendedRule: 'Length, mobile prefix, E.164 parsing. Encoded 1=valid, 2=invalid.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'phone_valid',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['phone_valid'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'A format-valid phone number does not prove right-party contact.',
  },
  {
    nodeId: 'VAL-03',
    originalLabel: 'Alternative Phone Number Handling',
    family: 'preparation_validation',
    partnerScope: 'all',
    intendedRule: 'Evaluation and promotion of secondary contact where primary is invalid or unreachable.',
    evidenceSource: 'warehouse_schema',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'standardised_alt_phone',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['standardised_alt_phone'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Preserve distinction between primary mobile and alternative contact.',
  },
  {
    nodeId: 'VAL-04',
    originalLabel: 'Placeholder Email Detection',
    family: 'preparation_validation',
    partnerScope: 'all',
    intendedRule: 'Detection of dummy or synthetic email addresses generated for form completion.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'standardised_email',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['is_placeholder_email'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Placeholder email does not mean verified customer email.',
  },
  {
    nodeId: 'SCR-01',
    originalLabel: 'Mondo Grade Classification',
    family: 'preparation_validation',
    partnerScope: ['mondo'],
    intendedRule: 'Mondo credit and eligibility tier evaluation. Independent classification.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'offershop_grade',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id'],
    businessTimestampField: 'offershop_grade_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['offershop_grade', 'offershop_grade_date'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Keep Mondo grade and BLC colour as independent classifications; do not combine into synthetic quality score.',
  },
  {
    nodeId: 'SCR-02',
    originalLabel: 'BLC Colour Vetting',
    family: 'preparation_validation',
    partnerScope: ['blc_ontact'],
    intendedRule: 'BLC Colour tier classification (Green, Amber, Red). Independent classification.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'offershop_color_vetting',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id'],
    businessTimestampField: 'offershop_color_vetting_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['offershop_color_vetting', 'offershop_color_vetting_date'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Independent classification with its own observed timestamp.',
  },

  // 3. Consumer Hospital
  {
    nodeId: 'HOSP-01',
    originalLabel: 'Consumer Hospital Routing',
    family: 'consumer_hospital',
    partnerScope: 'all',
    intendedRule: 'Routing of invalid or unverified identities into recovery queues.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'hospital_applied_date',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'hospital_applied_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['hospital_applied_date', 'hospital_outcome'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Do not invent a hospital history from only a latest-state flag.',
  },
  {
    nodeId: 'HOSP-02',
    originalLabel: 'Phone-to-ID Recovery',
    family: 'consumer_hospital',
    partnerScope: 'all',
    intendedRule: 'Look up verified ID from historical consumer identity register using valid phone.',
    evidenceSource: 'diagram',
    entityGrain: 'recovery_attempt',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'recovery_timestamp',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['recovery_tag', 'recovered_idno'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'NOT_INSTRUMENTED',
    unresolvedDependencies: ['Consumer hospital transaction logs not exposed in analytics warehouse dataset'],
    notes: 'Tags: EXACT, INVALID_ID_ZERO, SMALL_DIFF_1_DIGIT, SMALL_DIFF_2_DIGIT, SMALL_DIFF_3_DIGIT, DIFFERENT.',
  },
  {
    nodeId: 'HOSP-03',
    originalLabel: 'ID-to-Phone Recovery',
    family: 'consumer_hospital',
    partnerScope: 'all',
    intendedRule: 'Look up active phone number from national ID register using format-verified ID.',
    evidenceSource: 'diagram',
    entityGrain: 'recovery_attempt',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'recovery_timestamp',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['recovery_tag', 'recovered_phone'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'NOT_INSTRUMENTED',
    unresolvedDependencies: ['Hospital match register table access required'],
    notes: 'Possible fraud flag is not proof of fraud; preserve as source outcome.',
  },
  {
    nodeId: 'HOSP-04',
    originalLabel: 'Name/Surname Reference Matching',
    family: 'consumer_hospital',
    partnerScope: 'all',
    intendedRule: 'Discrepancy reconciliation for typographical name differences.',
    evidenceSource: 'diagram',
    entityGrain: 'recovery_attempt',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'recovery_timestamp',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['recovery_tag'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'NOT_INSTRUMENTED',
    unresolvedDependencies: ['Fuzzy identity matching is performed upstream; CX3 must observe upstream evidence without exposing personal data'],
    notes: 'Do not implement new client-side fuzzy matching or expose PII.',
  },
  {
    nodeId: 'HOSP-05',
    originalLabel: 'Pipeline Return & Re-entry',
    family: 'consumer_hospital',
    partnerScope: 'all',
    intendedRule: 'Successfully recovered leads re-enter the standard partner qualification waterfall.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'offershop_source',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'hospital_applied_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['offershop_source'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Observed when offershop_source indicates revet/re-entry.',
  },
  {
    nodeId: 'HOSP-06',
    originalLabel: 'Morgue / Mortuary Terminal Outcomes',
    family: 'consumer_hospital',
    partnerScope: 'all',
    intendedRule: 'Unresolved identities reaching maximum recovery retries without match.',
    evidenceSource: 'diagram',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id'],
    businessTimestampField: 'hospital_applied_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['terminal_mortuary_flag'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'NOT_INSTRUMENTED',
    unresolvedDependencies: ['Hospital disposition log not partitioned to analytics'],
    notes: 'Preserves the terminal morgue status without guessing counts.',
  },

  // 4. ROR and Partner Qualification
  {
    nodeId: 'ROR-01',
    originalLabel: 'ROR Evaluation & Partner Routing',
    family: 'partner_qualification',
    partnerScope: 'all',
    intendedRule: 'Partner qualification ordering and rules of engagement evaluation.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'hlc_details.vendor',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['hlc_details.vendor'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Retain ROR terminology without inventing expansion. Leads can be eligible for multiple paths without being additive.',
  },
  {
    nodeId: 'PART-BLC',
    originalLabel: 'BLC / ONtact Qualification Branch',
    family: 'partner_qualification',
    partnerScope: ['blc_ontact'],
    intendedRule: 'Colour check: Green/Amber pass, Red fail. 48-hour duplicate window check.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.view_lead_ledger_blc_lead_submit_open',
    mappedTable: 'view_lead_ledger_blc_lead_submit_open',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'offershop_color_vetting_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['offershop_color_vetting'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'DEPENDENCY_BLOCKED',
    unresolvedDependencies: ['Access Denied on underlying offernet-dmp:external_data_echos.extrnal_data_echos_blc_activations_master'],
    notes: 'Dedicated BLC view is blocked at warehouse layer; falls back to clustered_lead_ledger.',
  },
  {
    nodeId: 'PART-MONDO',
    originalLabel: 'Mondo Qualification Branch',
    family: 'partner_qualification',
    partnerScope: ['mondo'],
    intendedRule: 'Grade check, daily exclusion check, 10-day duplicate window check.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.view_lead_ledger_mondo_lead_submit_open',
    mappedTable: 'view_lead_ledger_mondo_lead_submit_open',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'offershop_grade_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['offershop_grade'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'DEPENDENCY_BLOCKED',
    unresolvedDependencies: ['Access Denied on underlying offernet-dmp:hot_lead_connect.mondo_lead_submit'],
    notes: 'Duplicate window is 10 days (240 hours).',
  },
  {
    nodeId: 'PART-MTN',
    originalLabel: 'MTN Qualification Branch',
    family: 'partner_qualification',
    partnerScope: ['mtn'],
    intendedRule: 'Product branches separate from grade-only classification. 48-hour duplicate window.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.view_lead_ledger_mtn_lead_submit_open',
    mappedTable: 'view_lead_ledger_mtn_lead_submit_open',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['hlc_details.vendor'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'DEPENDENCY_BLOCKED',
    unresolvedDependencies: ['Access Denied on offernet-dmp:external_data_echos.extrnal_data_echos_mtn_activation_master'],
    notes: 'Keep MTN product branches separate from grade-only classification.',
  },
  {
    nodeId: 'PART-REAL',
    originalLabel: 'Real Promotions Qualification Branch',
    family: 'partner_qualification',
    partnerScope: ['real_promotions'],
    intendedRule: 'Age and regional coverage qualification. 7-day (168-hour) duplicate window.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.view_lead_ledger_real_promotions_lead_submit_open',
    mappedTable: 'view_lead_ledger_real_promotions_lead_submit_open',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['hlc_details.vendor'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'DEPENDENCY_BLOCKED',
    unresolvedDependencies: ['Access Denied on offernet-dmp:external_data_echos.extrnal_data_echos_real_promotions_calls_master'],
    notes: 'Duplicate window is 7 days.',
  },
  {
    nodeId: 'PART-BIZ',
    originalLabel: 'BizVoIP Qualification Branch',
    family: 'partner_qualification',
    partnerScope: ['bizvoip'],
    intendedRule: 'Business registration criteria. 48-hour duplicate window.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.view_lead_ledger_bizvoip_lead_submit_open',
    mappedTable: 'view_lead_ledger_bizvoip_lead_submit_open',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id', 'consumer_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['hlc_details.vendor'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'DEPENDENCY_BLOCKED',
    unresolvedDependencies: ['Access Denied on offernet-dmp:external_data_echos.extrnal_data_echos_bizvoip_vicidial_log'],
    notes: 'Duplicate window is 48 hours.',
  },
  {
    nodeId: 'PART-INVID',
    originalLabel: 'Invalid-ID Campaign Qualification Branch',
    family: 'partner_qualification',
    partnerScope: ['invalid_id_campaign'],
    intendedRule: 'Dedicated campaign for format-unverified ID leads. 48-hour duplicate window.',
    evidenceSource: 'diagram',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['valid_idno'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'NOT_INSTRUMENTED',
    unresolvedDependencies: ['Dedicated campaign tag not segregated in warehouse lead ledger view'],
    notes: 'Preserves dedicated branch for invalid-ID re-engagement.',
  },
  {
    nodeId: 'PART-RC',
    originalLabel: 'RewardsCo Qualification Branch',
    family: 'partner_qualification',
    partnerScope: ['rewardsco'],
    intendedRule: 'Direct API qualification and 48-hour duplicate suppression.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.view_lead_ledger_rewardsco_lead_submit_open',
    mappedTable: 'view_lead_ledger_rewardsco_lead_submit_open',
    entityGrain: 'lead_id',
    approvedIdentifiers: ['lead_id'],
    businessTimestampField: 'fetched',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['hlc_details.vendor'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'DEPENDENCY_BLOCKED',
    unresolvedDependencies: ['Access Denied on offernet-dmp:hot_lead_connect.rewardsco_lead_submit'],
    notes: 'Duplicate window is 48 hours.',
  },

  // 5. Hot Lead Connect (HLC) and Delivery
  {
    nodeId: 'HLC-01',
    originalLabel: 'HLC Delivery Queueing & Transmission',
    family: 'hlc_delivery',
    partnerScope: 'all',
    intendedRule: 'Outbound HTTP payload formulation and partner endpoint transmission.',
    evidenceSource: 'warehouse_schema',
    mappedSourceId: 'dashboards-422710.lead_ledger.clustered_lead_ledger',
    mappedTable: 'clustered_lead_ledger',
    mappedField: 'hlc_details.vendor, hlc_details.transaction_id, hlc_details.date_created',
    entityGrain: 'delivery_episode',
    approvedIdentifiers: ['hlc_details.transaction_id', 'lead_id', 'hlc_details.vendor'],
    businessTimestampField: 'hlc_details.date_created',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['hlc_details.vendor', 'hlc_details.transaction_id'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'A single lead may produce multiple repeated vendor delivery episodes in hlc_details.',
  },
  {
    nodeId: 'HLC-02',
    originalLabel: 'Partner Response Contract Evaluation',
    family: 'hlc_delivery',
    partnerScope: 'all',
    intendedRule: 'Validate partner business acceptance vs HTTP transport success. Preserve returned vendor lead ID.',
    evidenceSource: 'diagram',
    entityGrain: 'delivery_response',
    approvedIdentifiers: ['hlc_details.transaction_id', 'partner_lead_id'],
    businessTimestampField: 'response_timestamp',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['partner_response_code', 'partner_business_accepted'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'NOT_INSTRUMENTED',
    unresolvedDependencies: ['Raw HTTP response payload echo not persisted in analytics lead ledger'],
    notes: 'Do not interpret HTTP 200 as business acceptance without an approved response contract.',
  },
  {
    nodeId: 'HLC-03',
    originalLabel: 'Dialler Destination List Assignment',
    family: 'hlc_delivery',
    partnerScope: 'all',
    intendedRule: 'Assignment of accepted leads into dialler campaign lists (e.g. list_id in Vicidial).',
    evidenceSource: 'warehouse_schema',
    mappedSourceId: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights',
    mappedTable: 'lead_ledger_all_vicidial_insights',
    mappedField: 'list_id',
    entityGrain: 'list_assignment',
    approvedIdentifiers: ['list_id', 'dialer_lead_id'],
    businessTimestampField: 'entry_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['list_id', 'campaign_id'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Observed through Vicidial lead list_id.',
  },

  // 6. Dialler Activity & Commercial Outcomes
  {
    nodeId: 'DIAL-01',
    originalLabel: 'Dialler Call Events Observation',
    family: 'dialler_activity',
    partnerScope: 'all',
    intendedRule: 'Discrete dialler attempt event observation. Unique call events != raw records.',
    evidenceSource: 'warehouse_schema',
    mappedSourceId: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights',
    mappedTable: 'lead_ledger_all_vicidial_insights',
    mappedField: 'dialer_uniqueid, call_start_date, call_end_date, length_in_sec',
    entityGrain: 'call_event',
    approvedIdentifiers: ['dialer_uniqueid', 'dialer_lead_id'],
    businessTimestampField: 'call_start_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['status', 'call_start_date', 'length_in_sec'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'A cumulative call counter is not an individual call event; last status is not disposition history.',
  },
  {
    nodeId: 'DIAL-02',
    originalLabel: 'Right-Party Contact (RPC) Classification',
    family: 'dialler_activity',
    partnerScope: 'all',
    intendedRule: 'Identification of human conversation with intended contact.',
    evidenceSource: 'diagram',
    mappedSourceId: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights',
    mappedTable: 'lead_ledger_all_vicidial_insights',
    mappedField: 'status',
    entityGrain: 'call_event',
    approvedIdentifiers: ['dialer_uniqueid'],
    businessTimestampField: 'call_start_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['is_rpc'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'Format-valid phone does not prove RPC.',
  },
  {
    nodeId: 'COMM-01',
    originalLabel: 'Reported Commercial Sales',
    family: 'commercial_activation',
    partnerScope: 'all',
    intendedRule: 'Reported sale transactions from dialler dispositions.',
    evidenceSource: 'warehouse_schema',
    mappedSourceId: 'dashboards-422710.lead_ledger.lead_ledger_all_vicidial_insights',
    mappedTable: 'lead_ledger_all_vicidial_insights',
    mappedField: 'status',
    entityGrain: 'sale_transaction',
    approvedIdentifiers: ['dialer_uniqueid', 'dialer_lead_id'],
    businessTimestampField: 'call_start_date',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['status'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'A partner sale is not automatically an activation or recognised revenue.',
  },
  {
    nodeId: 'COMM-02',
    originalLabel: 'Verified Activations',
    family: 'commercial_activation',
    partnerScope: ['blc_ontact'],
    intendedRule: 'Downstream activation verification from telco echo logs.',
    evidenceSource: 'warehouse_schema',
    mappedSourceId: 'dashboards-422710.lead_ledger.blc_remote_activations',
    mappedTable: 'blc_remote_activations',
    mappedField: 'activations, revenue, contract_key',
    entityGrain: 'activation_record',
    approvedIdentifiers: ['contract_key'],
    businessTimestampField: 'date_created',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['activations', 'revenue'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPED',
    unresolvedDependencies: [],
    notes: 'BLC remote activations table provides alternative reconciliation for BLC; other partners require TEDI files.',
  },

  // 7. TEDI & External Feedback
  {
    nodeId: 'TEDI-01',
    originalLabel: 'TEDI Connection & Expected File Schedule',
    family: 'tedi_feedback',
    partnerScope: 'all',
    intendedRule: 'Daily / weekly ingestion schedule check against actual file delivery.',
    evidenceSource: 'diagram',
    entityGrain: 'feedback_batch_schedule',
    approvedIdentifiers: ['schedule_id', 'expected_batch_date'],
    businessTimestampField: 'scheduled_time',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['status'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'MAPPING_REQUIRED',
    unresolvedDependencies: ['TEDI ingestion job registry not directly exposed as queryable BigQuery table'],
    notes: 'Without monitoring evidence, show Unknown, not Failed.',
  },
  {
    nodeId: 'TEDI-02',
    originalLabel: 'Partner Feedback Ingestion (MTN, Mondo, Real Promotions)',
    family: 'tedi_feedback',
    partnerScope: ['mtn', 'mondo', 'real_promotions'],
    intendedRule: 'Receipt, file deduplication, upload, ingestion session, table load.',
    evidenceSource: 'diagram',
    mappedSourceId: 'offernet-dmp.external_data_echos',
    entityGrain: 'file_ingest_event',
    approvedIdentifiers: ['file_name', 'batch_id'],
    businessTimestampField: 'ingest_timestamp',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['file_status', 'row_count'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'DEPENDENCY_BLOCKED',
    unresolvedDependencies: ['Roles/bigquery.dataViewer required on offernet-dmp:external_data_echos'],
    notes: 'MTN activation, calls and disposition files modeled separately.',
  },

  // 8. Advertising Feedback (Related Process)
  {
    nodeId: 'ADV-01',
    originalLabel: 'Advertising Feedback (CAPI & Web Events)',
    family: 'advertising_feedback',
    partnerScope: 'all',
    intendedRule: 'CAPI event eligibility, transmission attempt, acknowledgement, attribution as a separate related process.',
    evidenceSource: 'diagram',
    entityGrain: 'capi_event',
    approvedIdentifiers: ['event_id', 'lead_id'],
    businessTimestampField: 'event_time',
    businessTimezone: 'Africa/Johannesburg',
    observedOutcomeFields: ['event_status', 'ad_attribution_id'],
    mappingVersion: '1.0.0',
    ruleVersion: 'V3-Page-1',
    readiness: 'NOT_INSTRUMENTED',
    unresolvedDependencies: ['CAPI event log table not deployed to analytics BigQuery project'],
    notes: 'Advertising-event feedback is modeled as a separate related process, never conflated with dialler outcomes.',
  },
];

/**
 * TEDI schedule monitoring states.
 */
export type TediFeedbackStatus =
  | 'NOT_YET_EXPECTED'
  | 'OVERDUE'
  | 'RECEIVED_NOT_LOADED'
  | 'LOADED_UNMATCHED'
  | 'OBSERVED_SOURCE_FAILURE'
  | 'UNKNOWN';

export interface TediScheduleItem {
  partner: OffershopPartner;
  fileType: 'activations' | 'calls' | 'dispositions' | 'exclusions';
  expectedCadence: 'daily' | 'weekly' | 'monthly';
  expectedTimeUtc: string;
  observedStatus: TediFeedbackStatus;
  lastReceivedTimestamp: string | null;
  lastLoadedTimestamp: string | null;
  notes: string;
}

export const TEDI_REFERENCE_SCHEDULES: TediScheduleItem[] = [
  {
    partner: 'mtn',
    fileType: 'activations',
    expectedCadence: 'daily',
    expectedTimeUtc: '06:00',
    observedStatus: 'UNKNOWN',
    lastReceivedTimestamp: null,
    lastLoadedTimestamp: null,
    notes: 'MTN activation master file. Underlying table in offernet-dmp is blocked with Access Denied.',
  },
  {
    partner: 'mtn',
    fileType: 'calls',
    expectedCadence: 'daily',
    expectedTimeUtc: '07:00',
    observedStatus: 'UNKNOWN',
    lastReceivedTimestamp: null,
    lastLoadedTimestamp: null,
    notes: 'MTN calls echo master. Access Denied on external_data_echos.',
  },
  {
    partner: 'mtn',
    fileType: 'dispositions',
    expectedCadence: 'daily',
    expectedTimeUtc: '07:30',
    observedStatus: 'UNKNOWN',
    lastReceivedTimestamp: null,
    lastLoadedTimestamp: null,
    notes: 'MTN disposition master file. Awaiting monitoring contract.',
  },
  {
    partner: 'mondo',
    fileType: 'exclusions',
    expectedCadence: 'daily',
    expectedTimeUtc: '05:00',
    observedStatus: 'UNKNOWN',
    lastReceivedTimestamp: null,
    lastLoadedTimestamp: null,
    notes: 'Mondo daily exclusion and fraud check file. Dependency on offernet-dmp:hot_lead_connect is blocked.',
  },
  {
    partner: 'real_promotions',
    fileType: 'calls',
    expectedCadence: 'weekly',
    expectedTimeUtc: 'Monday 08:00',
    observedStatus: 'UNKNOWN',
    lastReceivedTimestamp: null,
    lastLoadedTimestamp: null,
    notes: 'Real Promotions calls master file. Access Denied on external_data_echos.',
  },
  {
    partner: 'blc_ontact',
    fileType: 'activations',
    expectedCadence: 'daily',
    expectedTimeUtc: '06:30',
    observedStatus: 'LOADED_UNMATCHED',
    lastReceivedTimestamp: '2026-09-27T01:37:00Z',
    lastLoadedTimestamp: '2026-09-27T01:37:00Z',
    notes: 'Alternative reconciliation data exists in blc_remote_activations table, but direct activations master view is blocked.',
  },
];

/**
 * READ-ONLY RULE SIMULATION CONTRACT
 * CRITICAL: Any rule simulation must be explicitly read-only, separately labelled,
 * and excluded from observed results.
 */
export interface ReadOnlyRuleSimulationRequest {
  partner: OffershopPartner;
  hypotheticalDuplicateWindowHours?: number;
  hypotheticalIncomeThreshold?: number;
  hypotheticalColourRule?: 'GreenOnly' | 'GreenAndAmber' | 'All';
  hypotheticalMondoGrade?: string[];
  simulationScope: {
    startDate?: string;
    endDate?: string;
  };
}

export interface ReadOnlyRuleSimulationResult {
  isSimulation: true;
  readOnlyDisclaimer: 'THIS IS A READ-ONLY RULE SIMULATION. RESULTS DO NOT REPRESENT OBSERVED PRODUCTION TRAFFIC AND ARE EXCLUDED FROM ACTUAL REPORTED METRICS.';
  partner: OffershopPartner;
  parametersApplied: Record<string, unknown>;
  simulatedEligibleCount: number | null;
  simulatedSuppressedCount: number | null;
  simulatedChangePct: number | null;
  observedBaselineCount: number | null;
  observedBaselinePeriod: string;
  simulatedAt: string;
  status: 'BASELINE_REQUIRED';
  reason: string;
}
