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
    targetType: 'string' | 'number' | 'boolean' | 'date';
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
    { targetField: 'clientCode', jsonPath: '$.client_code', targetType: 'string', required: true },
    { targetField: 'durationSec', jsonPath: '$.duration', targetType: 'number', required: false },
    { targetField: 'disposition', jsonPath: '$.status', targetType: 'string', required: false },
    { targetField: 'agentId', jsonPath: '$.agent_id', targetType: 'string', required: false, sensitive: true },
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
    { targetField: 'tenant', jsonPath: '$.tenant', targetType: 'string', required: true },
    { targetField: 'amount', jsonPath: '$.amount', targetType: 'number', required: false },
    { targetField: 'currency', jsonPath: '$.currency', targetType: 'string', required: false },
  ],
};

export function extractRecordFromRawPayload(
  rawRow: { unique_id?: string; timestamp?: string; raw_data: any },
  mapping: RawPayloadMappingDefinition
): ExtractedBusinessRecord {
  const payload = typeof rawRow.raw_data === 'string' ? JSON.parse(rawRow.raw_data) : (rawRow.raw_data || {});
  const extractedFields: Record<string, any> = {};

  for (const field of mapping.fieldMappings) {
    const rawVal = getNestedValue(payload, field.jsonPath);
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
    case 'number':
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    case 'boolean':
      return Boolean(val);
    case 'string':
      return String(val);
    case 'date':
      return String(val);
    default:
      return val;
  }
}
