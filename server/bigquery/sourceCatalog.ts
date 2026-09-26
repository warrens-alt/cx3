import { SOURCE_ROLES, type SourceRole } from '../../contracts/sourceCoverage';
import { METRICS } from '../../contracts/reporting';
import { getClientConfig } from './config';
import { flatSchema, safeSourceError, type SourceAccess } from './sourceAccess';
import { definitionForSource } from './sourceDefinition';

export function sourceTable(clientId: string, role: SourceRole | string): string | null {
  const client = getClientConfig(clientId);
  const tables = client.semanticMappings.tables as Record<string, string | undefined>;
  return tables[role] || null;
}
export function metricTableLineage(clientId: string) {
  const versioned = METRICS.map(m => ({ metricId: m.id, label: m.label, requiredFacts: m.requires, tables: m.requires.map(fact => ({ fact, table: null })) }));
  const client = getClientConfig(clientId);
  const legacy = Object.entries(client.semanticMappings.tables).map(([role, table]) => ({ role, table }));
  return { versioned, legacy };
}

/** Independent metadata reads run concurrently; no data scans or guessed row totals. */
export async function sourceCatalogue(clientId: string, access: SourceAccess) {
  const client = getClientConfig(clientId);
  const configuredTables = new Set(SOURCE_ROLES.map(role => sourceTable(clientId, role)).filter((table): table is string => Boolean(table)));
  const inventoryWork = Promise.all(client.bigQueryDatasets.map(async dataset => {
    try {
      const tables = await access.listTables(client.bigQueryProject, dataset);
      return { summary: { dataset, status: 'AVAILABLE', tableCount: tables.length }, tables, complete: true };
    } catch (error) {
      return { summary: { dataset, ...safeSourceError(error) }, tables: [] as string[], complete: false };
    }
  }));
  const sourceWork = Promise.all(SOURCE_ROLES.map(async role => {
    const table = sourceTable(clientId, role);
    const def = definitionForSource(role, table);
    const base = {
      role, label: def.label, table,
      parameterContract: { dateField: def.dateField, dateMeaning: def.dateMeaning, filterFields: def.filters, requiredIdentityFields: def.requiredIdentityFields },
      populated: null,
    };
    if (!table) return { ...base, status: 'UNCONFIGURED', rowCount: null, rowCountStatus: 'UNAVAILABLE', metrics: [] };
    try {
      const meta = await access.metadata(table);
      const fields = flatSchema(meta.schema?.fields || []);
      const date = fields.get(def.dateField);
      const compatibleDate = date && !date.repeated && ['STRING', 'TIMESTAMP', 'DATETIME', 'DATE'].includes(date.type);
      const metrics = def.metrics.map(metric => {
        const field = metric.field ? fields.get(metric.field) : undefined;
        return { id: metric.id, label: metric.label, status: !metric.field ? 'AVAILABLE' : !field ? 'FIELD_MISSING' : field.repeated || ['RECORD', 'STRUCT', 'JSON', 'BYTES', 'GEOGRAPHY'].includes(field.type) ? 'FIELD_UNSUPPORTED' : 'AVAILABLE' };
      });
      const rawRows = meta.numRows == null ? null : String(meta.numRows);
      // Views typically have no numRows; unknown is not an empty source.
      const rowCount = rawRows !== null && /^\d+$/.test(rawRows) ? rawRows : null;
      return { ...base, status: compatibleDate ? 'SCHEMA_PRESENT' : 'SCHEMA_GAP',
        reason: compatibleDate ? undefined : `Incompatible date fields: ${def.dateField}`,
        rowCount, rowCountStatus: rowCount === null ? 'UNAVAILABLE' : 'METADATA_ESTIMATE',
        metrics,
      };
    } catch (error) {
      const failure = safeSourceError(error);
      return { ...base, ...failure, rowCount: null, rowCountStatus: 'UNAVAILABLE', metrics: def.metrics.map(metric => ({ id: metric.id, label: metric.label, status: failure.status })) };
    }
  }));
  const [inventoryResults, sources] = await Promise.all([inventoryWork, sourceWork]);
  return {
    sources,
    inventory: inventoryResults.map(item => item.summary),
    inventoryComplete: inventoryResults.every(item => item.complete),
    unmappedTables: [...new Set(inventoryResults.flatMap(item => item.tables))].filter(table => !configuredTables.has(table)),
    validationStatus: 'NOT_VERIFIED',
  };
}
