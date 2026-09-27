import { exactDecimal } from '../../../contracts/exactDecimal';

export interface RawPayloadMappingDefinition {
  sourceId: string;
  mappingVersion: string;
  status: 'DISCOVERED' | 'VALIDATED' | 'ACTIVE' | 'QUARANTINED';
  recordBoundary: 'root_object' | 'child_array';
  arrayPath?: string;
  identityField: string;
  tenantOwnership: {
    strategy: 'payload_field' | 'source_parameter' | 'unassigned_quarantine';
    fieldPath?: string;
    allowedTenants?: string[];
  };
  eventTimestampField: string;
  fieldMappings: Array<{
    targetField: string;
    jsonPath: string;
    targetType: 'string' | 'number' | 'integer' | 'decimal' | 'boolean' | 'date';
    required: boolean;
    sensitive?: boolean;
  }>;
}

export interface ExtractedBusinessRecord {
  recordId: string;
  sourceId: string;
  mappingVersion: string;
  tenantId: string | null;
  eventTimestamp: string | null;
  fields: Record<string, string | number | boolean | null>;
  quarantineStatus: 'APPROVED' | 'QUARANTINED';
  quarantineReason?: string;
}

export const ONTACT_MAPPING_V1: RawPayloadMappingDefinition = {
  sourceId: 'vibe-code-warren-stear.analytics_warehouse.ontact_raw_data',
  mappingVersion: 'ontact.v1.0.0',
  status: 'VALIDATED',
  recordBoundary: 'root_object',
  identityField: 'call_id',
  tenantOwnership: {
    strategy: 'payload_field',
    fieldPath: 'client_code',
    allowedTenants: ['mtn', 'mondo', 'ontact_blc', 'vodacom_bizvoip', 'default_tenant'],
  },
  eventTimestampField: 'call_timestamp',
  fieldMappings: [
    { targetField: 'callId', jsonPath: '$.call_id', targetType: 'string', required: true },
    { targetField: 'leadId', jsonPath: '$.lead_id', targetType: 'string', required: false },
    { targetField: 'clientCode', jsonPath: '$.client_code', targetType: 'string', required: false },
    { targetField: 'durationSec', jsonPath: '$.duration', targetType: 'number', required: false },
    { targetField: 'disposition', jsonPath: '$.status', targetType: 'string', required: false },
    { targetField: 'callResult', jsonPath: '$.call_result', targetType: 'string', required: false },
    { targetField: 'vendorLeadCode', jsonPath: '$.vendor_lead_code', targetType: 'string', required: false },
    { targetField: 'startEpoch', jsonPath: '$.start_epoch', targetType: 'integer', required: false },
    { targetField: 'endEpoch', jsonPath: '$.end_epoch', targetType: 'integer', required: false },
    { targetField: 'callDate', jsonPath: '$.call_date', targetType: 'string', required: false },
    { targetField: 'campaignId', jsonPath: '$.campaign_id', targetType: 'string', required: false },
    { targetField: 'listId', jsonPath: '$.list_id', targetType: 'string', required: false },
    { targetField: 'agentId', jsonPath: '$.agent', targetType: 'string', required: false, sensitive: true },
    { targetField: 'user', jsonPath: '$.user', targetType: 'string', required: false },
    { targetField: 'userGroup', jsonPath: '$.user_group', targetType: 'string', required: false },
    { targetField: 'calledCount', jsonPath: '$.called_count', targetType: 'integer', required: false },
    { targetField: 'altDial', jsonPath: '$.alt_dial', targetType: 'string', required: false },
    { targetField: 'sourceProvenance', jsonPath: '$.__source', targetType: 'string', required: false },
    { targetField: 'phoneNumber', jsonPath: '$.phone_number', targetType: 'string', required: false, sensitive: true },
    { targetField: 'comments', jsonPath: '$.comments', targetType: 'string', required: false },
  ],
};

export const ONVEST_MAPPING_V1: RawPayloadMappingDefinition = {
  sourceId: 'vibe-code-warren-stear.analytics_warehouse.onvest_raw_data',
  mappingVersion: 'onvest.v1.0.0',
  status: 'VALIDATED',
  recordBoundary: 'root_object',
  identityField: 'event_id',
  tenantOwnership: {
    strategy: 'payload_field',
    fieldPath: 'tenant',
    allowedTenants: ['mtn', 'mondo', 'ontact_blc', 'vodacom_bizvoip', 'default_tenant'],
  },
  eventTimestampField: 'event_time',
  fieldMappings: [
    { targetField: 'eventId', jsonPath: '$.event_id', targetType: 'string', required: true },
    { targetField: 'leadId', jsonPath: '$.lead_id', targetType: 'string', required: false },
    { targetField: 'tenant', jsonPath: '$.tenant', targetType: 'string', required: false },
    { targetField: 'amount', jsonPath: '$.amount', targetType: 'number', required: false },
    { targetField: 'amountSpent', jsonPath: '$.Amount_Spent', targetType: 'decimal', required: false },
    { targetField: 'currency', jsonPath: '$.currency', targetType: 'string', required: false },
    { targetField: 'date', jsonPath: '$.date', targetType: 'string', required: false },
    { targetField: 'offershopSource', jsonPath: '$.offershop_source', targetType: 'string', required: false },
    { targetField: 'fetchedLeads', jsonPath: '$.Fetched_Leads', targetType: 'integer', required: false },
    { targetField: 'qualifiedLeads', jsonPath: '$.Qualified_Leads', targetType: 'integer', required: false },
    { targetField: 'acceptedLeads', jsonPath: '$.Accepted_Leads', targetType: 'integer', required: false },
    { targetField: 'clicks', jsonPath: '$.Clicks', targetType: 'integer', required: false },
    { targetField: 'impressions', jsonPath: '$.Impressions', targetType: 'string', required: false },
    { targetField: 'reach', jsonPath: '$.Reach', targetType: 'string', required: false },
    { targetField: 'outboundClicks', jsonPath: '$.Outbound_Clicks', targetType: 'string', required: false },
  ],
};

/** All 48 observed physical top-level keys from ontact_raw_data */
export const ONTACT_PHYSICAL_FIELDS = [
  'uniqueid', 'lead_id', 'vendor_lead_code', 'call_date', 'start_epoch', 'end_epoch',
  'length_in_sec', 'call_result', 'status', 'campaign_id', 'list_id', 'agent', 'user',
  'user_group', 'called_count', 'alt_dial', '__source', 'phone_code', 'phone_number',
  'processed', 'term_reason', 'entry_date', 'modify_date', 'source_id', 'gmt_offset_now',
  'called_since_last_reset', 'title', 'first_name', 'middle_initial', 'last_name',
  'address1', 'address2', 'address3', 'city', 'state', 'province', 'postal_code',
  'country_code', 'gender', 'date_of_birth', 'alt_phone', 'email', 'security_phrase',
  'comments', 'last_local_call_time', 'rank', 'owner', 'entry_list_id',
] as const;

/** All 73 observed physical top-level keys from onvest_raw_data */
export const ONVEST_PHYSICAL_FIELDS = [
  'offershop_source', 'date', 'Fetched_Leads', 'Standardised_ID_Number', 'Standardised_Phone_Number',
  'Standardised_AltPhone_Number', 'Standardised_EmailAddress', 'Valid_IDNumber', 'Valid_Phone',
  'Total_Leads_WithValid_Phone_ID', 'Total_Leads_Passed_BLC_Vetting', 'Total_Leads_Failed_InternalDuplicate_Check_BLC',
  'Total_Leads_Failed_BLC_DNCList_BLC', 'Total_Leads_Dedupe_Passed_BLC', 'Total_Leads_Attempted_To_Delivered_OnTact',
  'Total_Leads_Delivered_OnTact', 'Total_Leads_Is_MTN_Lead', 'Total_Leads_Failed_InternalDuplicate_Check_MTN',
  'Total_Leads_Dedupe_Passed_MTN', 'Total_Leads_Device', 'Total_Leads_FWA', 'Total_Leads_SimOnly',
  'Total_Leads_SMS_Verification_1', 'Total_Leads_SMS_Verification_2', 'Total_Leads_SMS_Passed',
  'Total_Leads_Attempted_To_Delivered_MTN', 'Total_Leads_Delivered_MTN', 'Total_Mondo_Grade_Passed_Lead',
  'Total_Leads_Failed_InternalDuplicate_Check_Mondo', 'Total_Leads_Failed_DailyDuplicate_File_Check_Mondo',
  'Total_Leads_Failed_AllProvidersExclude_Check_Mondo', 'Total_Leads_Dedupe_Passed_Mondo',
  'Total_Leads_A', 'Total_Leads_B', 'Total_Leads_U', 'Total_Leads_Attempted_To_Delivered_Mondo',
  'Total_Leads_Delivered_Mondo', 'Total_Leads_Sold_A', 'Total_Leads_Sold_B', 'Total_Leads_Sold_C',
  'Total_Leads_Sold_D', 'Total_Leads_Sold_Other', 'Naga_Processed', 'Naga_DeDupedPassed',
  'Naga_ContactVerified', 'Naga_FileDroppedOnFTP', 'DebtRescua_Processed', 'DebtRescue_DeDupedPassed',
  'DebtRescue_ContactVerified', 'DebtRescue_LeadDelivered', 'Amount_Spent', 'Impressions', 'Reach',
  'Ad_Recall', 'Engagement', 'Video_Views', 'Page_Like', 'Clicks', 'Outbound_Clicks',
  'Conversation_Started', 'Landing_Page_View', 'Add_to_cart', 'Initiate_Checkout', 'Form_Completion',
  'Accepted_Leads', 'Qualified_Leads', 'MTN_Dialed_Leads', 'MTN_Answered_Calls', 'MTN_Right_Party_Contact',
  'MTN_Sales', 'MTN_Delivered_Sales', 'MTN_Activated_Sales', '__source',
] as const;

/** Client-prefixed metric families for ONvest aggregate extraction to prevent cross-tenant exposure */
export const ONVEST_TENANT_METRIC_FAMILIES = {
  mtn: [
    'MTN_Dialed_Leads', 'MTN_Answered_Calls', 'MTN_Right_Party_Contact', 'MTN_Sales',
    'MTN_Delivered_Sales', 'MTN_Activated_Sales', 'Total_Leads_Is_MTN_Lead',
    'Total_Leads_Attempted_To_Delivered_MTN', 'Total_Leads_Delivered_MTN',
    'Total_Leads_SMS_Passed', 'Total_Leads_SMS_Verification_1', 'Total_Leads_SMS_Verification_2',
    'Total_Leads_SimOnly', 'Total_Leads_Device', 'Total_Leads_FWA',
    'Total_Leads_Dedupe_Passed_MTN', 'Total_Leads_Failed_InternalDuplicate_Check_MTN',
  ],
  mondo: [
    'Total_Mondo_Grade_Passed_Lead', 'Total_Leads_Attempted_To_Delivered_Mondo',
    'Total_Leads_Delivered_Mondo', 'Total_Leads_Failed_InternalDuplicate_Check_Mondo',
    'Total_Leads_Failed_DailyDuplicate_File_Check_Mondo', 'Total_Leads_Failed_AllProvidersExclude_Check_Mondo',
    'Total_Leads_Dedupe_Passed_Mondo', 'Total_Leads_A', 'Total_Leads_B', 'Total_Leads_U',
    'Total_Leads_Sold_A', 'Total_Leads_Sold_B', 'Total_Leads_Sold_C', 'Total_Leads_Sold_D',
    'Total_Leads_Sold_Other',
  ],
  ontact_blc: [
    'Total_Leads_Passed_BLC_Vetting', 'Total_Leads_Failed_InternalDuplicate_Check_BLC',
    'Total_Leads_Failed_BLC_DNCList_BLC', 'Total_Leads_Dedupe_Passed_BLC',
    'Total_Leads_Attempted_To_Delivered_OnTact', 'Total_Leads_Delivered_OnTact',
  ],
  naga: [
    'Naga_Processed', 'Naga_DeDupedPassed', 'Naga_ContactVerified', 'Naga_FileDroppedOnFTP',
  ],
  debtrescue: [
    'DebtRescua_Processed', // Exact physical typo preserved
    'DebtRescue_DeDupedPassed', 'DebtRescue_ContactVerified', 'DebtRescue_LeadDelivered',
  ],
} as const;

export const ONVEST_COMMON_METRICS = [
  'date', 'offershop_source', 'Fetched_Leads', 'Accepted_Leads', 'Qualified_Leads',
  'Standardised_ID_Number', 'Standardised_Phone_Number', 'Standardised_AltPhone_Number',
  'Standardised_EmailAddress', 'Valid_IDNumber', 'Valid_Phone', 'Total_Leads_WithValid_Phone_ID',
  'Clicks', 'Impressions', 'Reach', 'Outbound_Clicks', 'Amount_Spent',
  'Conversation_Started', 'Landing_Page_View', 'Add_to_cart', 'Initiate_Checkout',
  'Form_Completion', 'Engagement', 'Video_Views', 'Page_Like', 'Ad_Recall',
] as const;

export function extractRecordFromRawPayload(
  rawRow: { unique_id?: string; timestamp?: string; raw_data: any },
  mapping: RawPayloadMappingDefinition
): ExtractedBusinessRecord {
  const payload = typeof rawRow.raw_data === 'string' ? JSON.parse(rawRow.raw_data) : (rawRow.raw_data || {});
  const extractedFields: Record<string, any> = {};

  for (const field of mapping.fieldMappings) {
    let rawVal = getNestedValue(payload, field.jsonPath);

    // Support fallback aliases between physical and canonical names
    if (rawVal === undefined || rawVal === null) {
      if (field.targetField === 'callId') rawVal = payload.uniqueid ?? payload.call_id;
      else if (field.targetField === 'durationSec') rawVal = payload.length_in_sec ?? payload.duration;
      else if (field.targetField === 'clientCode') rawVal = payload.client_code ?? payload.tenant;
      else if (field.targetField === 'eventId') rawVal = payload.event_id ?? payload.uniqueid ?? rawRow.unique_id;
      else if (field.targetField === 'amount') rawVal = payload.amount ?? payload.Amount_Spent;
    }

    if (rawVal === undefined || rawVal === null) {
      if (field.required) {
        return {
          recordId: String(rawRow.unique_id || 'unknown'),
          sourceId: mapping.sourceId,
          mappingVersion: mapping.mappingVersion,
          tenantId: null,
          eventTimestamp: null,
          fields: {},
          quarantineStatus: 'QUARANTINED',
          quarantineReason: `Missing required field: ${field.targetField} (${field.jsonPath})`,
        };
      }
      extractedFields[field.targetField] = null;
    } else {
      extractedFields[field.targetField] = castValue(rawVal, field.targetType);
    }
  }

  // Tenant ownership resolution
  let tenantId: string | null = null;
  if (mapping.tenantOwnership.strategy === 'payload_field' && mapping.tenantOwnership.fieldPath) {
    const rawTenant = payload[mapping.tenantOwnership.fieldPath];
    if (rawTenant && typeof rawTenant === 'string') {
      const normalized = rawTenant.toLowerCase().trim();
      if (mapping.tenantOwnership.allowedTenants?.includes(normalized)) {
        tenantId = normalized;
      }
    }
  }

  // Fallback tenant resolution via comments or segment hints if present
  if (!tenantId && payload.comments && typeof payload.comments === 'string') {
    const comments = payload.comments.toLowerCase();
    if (comments.includes('mtn')) tenantId = 'mtn';
    else if (comments.includes('mondo')) tenantId = 'mondo';
    else if (comments.includes('blc')) tenantId = 'ontact_blc';
    else if (comments.includes('bizvoip') || comments.includes('vodacom')) tenantId = 'vodacom_bizvoip';
  }

  if (!tenantId) {
    return {
      recordId: String(rawRow.unique_id || 'unknown'),
      sourceId: mapping.sourceId,
      mappingVersion: mapping.mappingVersion,
      tenantId: null,
      eventTimestamp: rawRow.timestamp || null,
      fields: extractedFields,
      quarantineStatus: 'QUARANTINED',
      quarantineReason: 'Unable to resolve tenant ownership; record quarantined to prevent cross-tenant exposure',
    };
  }

  return {
    recordId: String(rawRow.unique_id || 'unknown'),
    sourceId: mapping.sourceId,
    mappingVersion: mapping.mappingVersion,
    tenantId,
    eventTimestamp: rawRow.timestamp || null,
    fields: extractedFields,
    quarantineStatus: 'APPROVED',
  };
}

export interface OntactTimingValidation {
  durationMatchesEpochs: boolean;
  calculatedDurationSec: number | null;
  reportedDurationSec: number | null;
  wallClockTimezoneOffsetHours: number | null;
  statusDisagreement: boolean;
  status: string | null;
  callResult: string | null;
  epochValid: boolean;
}

/** Validates ONtact epoch-duration relationship, local wall clock vs UTC epoch, and status vs call_result */
export function validateOntactTiming(payload: Record<string, any>): OntactTimingValidation {
  const start = typeof payload.start_epoch === 'number' ? payload.start_epoch : Number(payload.start_epoch) || null;
  const end = typeof payload.end_epoch === 'number' ? payload.end_epoch : Number(payload.end_epoch) || null;
  const length = typeof payload.length_in_sec === 'number' ? payload.length_in_sec : (payload.length_in_sec != null ? Number(payload.length_in_sec) : null);

  const epochValid = start !== null && end !== null && end >= start;
  const calculatedDuration = (start !== null && end !== null) ? end - start : null;
  const durationMatches = calculatedDuration !== null && length !== null ? calculatedDuration === length : false;

  let offsetHours: number | null = null;
  if (payload.call_date && start !== null) {
    const wallDate = new Date(String(payload.call_date).replace('T', ' ') + ' UTC');
    const epochDate = new Date(start * 1000);
    if (!isNaN(wallDate.getTime()) && !isNaN(epochDate.getTime())) {
      offsetHours = Math.round((wallDate.getTime() - epochDate.getTime()) / (1000 * 60 * 60));
    }
  }

  const status = payload.status ? String(payload.status) : null;
  const callResult = payload.call_result ? String(payload.call_result) : null;
  const statusDisagreement = Boolean(status && callResult && status !== callResult);

  return {
    durationMatchesEpochs: durationMatches,
    calculatedDurationSec: calculatedDuration,
    reportedDurationSec: length,
    wallClockTimezoneOffsetHours: offsetHours,
    statusDisagreement,
    status,
    callResult,
    epochValid,
  };
}

export interface ExtractedOnvestAggregate {
  date: string | null;
  offershopSource: string | null;
  amountSpent: string | null; // Exact decimal string
  impressions: string | null;
  reach: string | null; // Non-additive
  clicks: number | null;
  outboundClicks: string | null;
  stageCounts: {
    fetchedLeads: number | null;
    acceptedLeads: number | null;
    qualifiedLeads: number | null;
    validPhoneId: number | null;
  };
  isolatedTenantMetrics: Record<string, number | null>;
  quarantinedMetricsCount: number;
}

/** Extracts ONvest aggregate record with strict tenant isolation and exact decimal spend */
export function extractOnvestAggregate(
  rawPayload: Record<string, any>,
  targetTenant: string
): ExtractedOnvestAggregate {
  const normTenant = targetTenant.toLowerCase().trim();
  const allowedFamilyKeys: readonly string[] = normTenant === 'admin' || normTenant === 'all'
    ? Object.values(ONVEST_TENANT_METRIC_FAMILIES).flat()
    : ((ONVEST_TENANT_METRIC_FAMILIES as Record<string, readonly string[]>)[normTenant] || []);

  const isolatedMetrics: Record<string, number | null> = {};
  let quarantinedCount = 0;

  for (const [, keys] of Object.entries(ONVEST_TENANT_METRIC_FAMILIES)) {
    for (const key of keys) {
      if (key in rawPayload) {
        if (allowedFamilyKeys.includes(key)) {
          const val = rawPayload[key];
          isolatedMetrics[key] = castValue(val, 'integer');
        } else {
          quarantinedCount++;
        }
      }
    }
  }

  // Exact decimal parsing for Amount_Spent
  const amountSpent = exactDecimal(rawPayload.Amount_Spent);

  return {
    date: rawPayload.date ? String(rawPayload.date) : null,
    offershopSource: rawPayload.offershop_source ? String(rawPayload.offershop_source) : null,
    amountSpent,
    impressions: rawPayload.Impressions != null ? String(rawPayload.Impressions) : null,
    reach: rawPayload.Reach != null ? String(rawPayload.Reach) : null,
    clicks: castValue(rawPayload.Clicks, 'integer'),
    outboundClicks: rawPayload.Outbound_Clicks != null ? String(rawPayload.Outbound_Clicks) : null,
    stageCounts: {
      fetchedLeads: castValue(rawPayload.Fetched_Leads, 'integer'),
      acceptedLeads: castValue(rawPayload.Accepted_Leads, 'integer'),
      qualifiedLeads: castValue(rawPayload.Qualified_Leads, 'integer'),
      validPhoneId: castValue(rawPayload.Total_Leads_WithValid_Phone_ID, 'integer'),
    },
    isolatedTenantMetrics: isolatedMetrics,
    quarantinedMetricsCount: quarantinedCount,
  };
}

export interface SchemaDriftReport {
  sourceId: string;
  expectedFieldCount: number;
  observedFieldCount: number;
  missingFields: string[];
  unexpectedFields: string[];
  nestedObjects: string[];
  nestedArrays: string[];
  isCompatible: boolean;
}

/** Bounded schema-drift detection for raw JSON sources */
export function detectSchemaDrift(
  payload: Record<string, any>,
  expectedFields: readonly string[],
  sourceId: string
): SchemaDriftReport {
  const observedKeys = Object.keys(payload);
  const expectedSet = new Set(expectedFields);
  const missing = expectedFields.filter(f => !(f in payload));
  const unexpected = observedKeys.filter(f => !expectedSet.has(f));
  const nestedObjects: string[] = [];
  const nestedArrays: string[] = [];

  for (const [k, v] of Object.entries(payload)) {
    if (v !== null && typeof v === 'object') {
      if (Array.isArray(v)) nestedArrays.push(k);
      else nestedObjects.push(k);
    }
  }

  return {
    sourceId,
    expectedFieldCount: expectedFields.length,
    observedFieldCount: observedKeys.length,
    missingFields: missing,
    unexpectedFields: unexpected,
    nestedObjects,
    nestedArrays,
    isCompatible: missing.length === 0 && nestedObjects.length === 0 && nestedArrays.length === 0,
  };
}

function getNestedValue(obj: any, path: string): any {
  if (!path.startsWith('$.')) return obj[path];
  const keys = path.slice(2).split('.');
  let current = obj;
  for (const k of keys) {
    if (current == null) return undefined;
    current = current[k];
  }
  return current;
}

function castValue(val: any, targetType: string): any {
  if (val === null || val === undefined) return null;
  switch (targetType) {
    case 'integer':
      if (typeof val === 'boolean') return null;
      if (typeof val === 'number') return Number.isInteger(val) ? val : null;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return /^-?\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null;
      }
      return null;
    case 'number':
      if (typeof val === 'boolean') return null;
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    case 'decimal':
      return exactDecimal(val);
    case 'boolean':
      if (typeof val === 'boolean') return val;
      if (val === 'true' || val === '1' || val === 1) return true;
      if (val === 'false' || val === '0' || val === 0) return false;
      return null;
    case 'string':
      return String(val);
    case 'date':
      return String(val);
    default:
      return val;
  }
}
