import type { SourceRole } from '../../contracts/sourceCoverage';
import { CALL_SOURCE_FIELDS } from '../../contracts/physicalSources';
import { getClientConfig, tenantVendorScopeValues } from './config';
import { conditionSql, RequestError, type Scalar } from './filters';
import { flatSchema, type TableMetadata } from './sourceAccess';

/** The separate activation lifecycle table is contracted only to BLC and the master workspace. */
export function activationSourceIsOwned(clientId: string): boolean {
  return ['default_tenant', 'ontact_blc'].includes(getClientConfig(clientId).id);
}

/** Mandatory ownership restrictions are separate from optional caller filters. */
export function sourceTenantPredicate(clientId: string, role: SourceRole, meta: TableMetadata, params: Record<string, Scalar>): string | null {
  const client = getClientConfig(clientId);
  if (client.id === 'default_tenant') return null; // Explicit master-workspace permission is checked by the router.
  const fields = flatSchema(meta.schema?.fields || []);
  const textField = (name: string) => {
    const field = fields.get(name);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || !field || field.repeated || field.type !== 'STRING') {
      throw new RequestError(`A scalar ${name} ownership mapping is required for tenant-scoped ${role} metrics`, 422);
    }
    return `s.\`${name}\``;
  };
  if (role === 'marketing') {
    const contract = client.marketing;
    if (!contract || contract.mappingStatus !== 'MAPPED' || !contract.clientNames.length || contract.clientNames.includes('*')) {
      throw new RequestError('Approved client_name ownership mapping is required for this tenant', 422);
    }
    return conditionSql(textField(contract.clientNameField), { operator: 'in', values: contract.clientNames }, 'tenant_client', params);
  }
  if (role === 'calls') {
    const vendors = tenantVendorScopeValues(client);
    if (!vendors.length) throw new RequestError('Approved vendor ownership mapping is required for this tenant', 422);
    return conditionSql(`LOWER(TRIM(${textField(CALL_SOURCE_FIELDS.vendor)}))`, { operator: 'in', values: vendors }, 'tenant_vendor', params);
  }
  if (role === 'leads' && client.dataSourceMode === 'separate' && client.semanticMappings.tables.leads !== getClientConfig('default_tenant').semanticMappings.tables.leads) {
    return null; // Configured tenant-specific source view, never the master ledger.
  }
  if (role === 'activations' && activationSourceIsOwned(clientId)) return null;
  // Time-to-dial has no reviewed ownership/join mapping; inspecting a schema
  // cannot establish one. Do not substitute a master aggregate for this tenant.
  throw new RequestError(`Tenant ownership is not established for the ${role} source`, 422);
}
