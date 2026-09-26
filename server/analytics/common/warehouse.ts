import { getClientConfig, tableIdentifier } from '../../bigquery/config';
import { RequestError } from '../../bigquery/filters';

export function configuredSourceTable(
  clientId: string,
  role: 'leads' | 'calls' | 'timeToDial' | 'activations' | 'marketing'
): string {
  const config = getClientConfig(clientId);
  const table = config.semanticMappings.tables[role];
  if (!table) throw new RequestError(`No configured ${role} source table exists for tenant ${config.id}`, 422);
  return tableIdentifier(table);
}

export function parseConfiguredTable(table: string): { project: string; dataset: string; table: string } {
  const match = /^([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/.exec(table);
  if (!match) throw new RequestError('Configured marketing table identifier is invalid', 500);
  return { project: match[1], dataset: match[2], table: match[3] };
}

export function safeWarehouseColumn(column: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
    throw new RequestError('Unsafe warehouse column identifier', 500);
  }
  return `\`${column}\``;
}

export function safeAliasedColumn(alias: string, column: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias)) throw new RequestError('Unsafe warehouse alias', 500);
  return `${alias}.${safeWarehouseColumn(column)}`;
}
