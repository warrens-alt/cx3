import { getClientConfig, tableIdentifier, type TenantConfiguration } from './config';
import { RequestError } from './filters';
import { currentAnalyticsScope } from '../analyticsContext';
import { isFlatLeadSource } from '../../contracts/warehouseSchemaSnapshot';

const missingTopLevelStrings = [
  'offernet_medium', 'standardised_idno', 'standardised_mobile', 'standardised_alt_phone',
  'standardised_email', 'valid_idno', 'validate_idno', 'phone_valid', 'validate_mobile',
  'hospital_applied', 'hospital_applied_date', 'offershop_color_vetting',
  'offershop_color_vetting_date', 'offershop_grade', 'offershop_grade_date',
];
const transactionStrings = [
  'attempted_to_deliver', 'delivered', 'expected_first_dial', 'first_call_date',
  'last_call_date', 'last_dialer_status', 'sale', 'activated', 'currency',
];
const transactionNumbers = [
  'new_dialer_lead', 'last_call_length_in_sec', 'total_calls_length_in_sec', 'total_calls', 'rpc',
];

/** The dictionary is a structural contract, not permission to read another source. */
export function assertLeadSourceDimensions(clientId: string, dimensions: object): void {
  const config = getClientConfig(clientId);
  if (!isFlatLeadSource(config.semanticMappings.tables.leads)) return;
  const values = dimensions as Record<string, unknown>;
  const supplied = (value: unknown) => value != null && (typeof value !== 'string' || !['', 'all', 'all grades', 'undefined', 'null'].includes(value.trim().toLowerCase()));
  const unsupported = ['grade', 'medium', 'vetting', 'valid_idno', 'phone_valid', 'partner', 'ror_partner']
    .filter(key => supplied(values[key]));
  if (unsupported.length) throw new RequestError(
    `UNSUPPORTED_FILTER: ${unsupported.join(', ')} is not supplied by this tenant's lead view. Remove that filter or configure an approved source with the required fields.`, 422,
  );
}

/**
 * Project only known columns from the configured flat tenant view. Each physical
 * transaction is wrapped as one HLC record; downstream lead aggregation is unchanged.
 * No master-table fallback, enrichment join, invented grade or inferred ID equivalence.
 */
export function leadSourceRelation(client: TenantConfiguration): string {
  const physical = client.semanticMappings.tables.leads;
  if (!isFlatLeadSource(physical)) return tableIdentifier(physical);
  const ambient = currentAnalyticsScope();
  if (ambient?.clientId === client.id) assertLeadSourceDimensions(client.id, ambient.filters || {});
  const partners = client.semanticMappings.partners || [];
  if (partners.some(partner => !/^[a-z0-9_]+$/i.test(partner))) throw new RequestError('Invalid configured routing partner', 503);
  const nullColumns = [...missingTopLevelStrings, ...partners.map(partner => `ror_${partner.toLowerCase()}`)]
    .map(field => `CAST(NULL AS STRING) AS ${field}`);
  return `(SELECT src.lead_id, src.consumer_id, src.offershop_source, src.fetched,
    ${nullColumns.join(',\n    ')}, CAST(NULL AS BOOL) AS valid_lead,
    [STRUCT(src.vendor AS vendor, CAST(src.transaction_id AS STRING) AS transaction_id,
      CAST(NULL AS STRING) AS status,
      ${transactionStrings.map(field => `src.${field} AS ${field}`).join(',\n      ')},
      ${transactionNumbers.map(field => `src.${field} AS ${field}`).join(',\n      ')},
      SAFE_CAST(src.revenue_generated AS NUMERIC) AS revenue_generated)] AS hlc_details
    FROM ${tableIdentifier(physical)} src)`;
}
