import { SOURCE_DEFINITIONS, type SourceDefinition, type SourceRole } from '../../contracts/sourceCoverage';
import { isFlatLeadSource } from '../../contracts/warehouseSchemaSnapshot';

/** Source-row inspection must use physical columns, not the analytical adapter. */
export function definitionForSource(role: SourceRole, table: string | null): SourceDefinition {
  const definition = SOURCE_DEFINITIONS[role];
  if (role !== 'leads' || !table || !isFlatLeadSource(table)) return definition;
  return {
    ...definition,
    filters: { source: 'offershop_source', vendor: 'vendor' },
    requiredIdentityFields: ['lead_id', 'vendor', 'transaction_id'],
    warning: 'This tenant source has flat vendor transaction rows. Source rows are not distinct leads. Grade, medium, validation flags and routing history are not present; no enrichment is inferred.',
  };
}
