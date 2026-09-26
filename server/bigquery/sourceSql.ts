import type { TenantConfiguration } from './config';
import { tableIdentifier } from './config';
import { RequestError } from './filters';

export function configuredRelation(client: TenantConfiguration, role: string): string {
  const tables = client.semanticMappings.tables as Record<string, string | undefined>;
  const table = tables[role];
  if (!table) {
    return '(SELECT NULL WHERE FALSE)';
  }

  // Validate that table belongs to configured project and datasets
  const parts = table.split('.');
  if (parts.length === 3) {
    const [project, dataset] = parts;
    if (project !== client.bigQueryProject || !client.bigQueryDatasets.includes(dataset)) {
      throw new RequestError(`Configured table ${table} does not belong to tenant scope`, 403);
    }
  }

  return tableIdentifier(table);
}
