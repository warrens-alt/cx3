import { SOURCE_DEFINITIONS, SOURCE_ROLES, type SourceRole } from '../../contracts/sourceCoverage';
import { METRICS } from '../../contracts/reporting';
import { getClientConfig } from './config';
import { flatSchema, sourceMetricFieldAvailable, safeSourceError, type SourceAccess, type TableMetadata } from './sourceAccess';

export function sourceTable(clientId: string, role: SourceRole | string): string | null {
  const client = getClientConfig(clientId);
  const tables = client.semanticMappings.tables as Record<string, string | undefined>;
  return tables[role] || null;
}

export function metricTableLineage(clientId: string) {
  const versioned = METRICS.map(m => ({
    metricId: m.id,
    label: m.label,
    requiredFacts: m.requires,
    tables: m.requires.map(fact => ({ fact, table: null })),
  }));

  const client = getClientConfig(clientId);
  const legacy = Object.entries(client.semanticMappings.tables).map(([role, table]) => ({
    role,
    table,
  }));

  return { versioned, legacy };
}

export async function sourceCatalogue(clientId: string, access: SourceAccess) {
  const client = getClientConfig(clientId);
  const sources: any[] = [];
  const inventory: any[] = [];
  let inventoryComplete = true;
  let allTables: string[] = [];

  for (const dataset of client.bigQueryDatasets) {
    try {
      const tables = await access.listTables(client.bigQueryProject, dataset);
      allTables.push(...tables);
      inventory.push({ dataset, status: 'AVAILABLE', tableCount: tables.length });
    } catch (err: unknown) {
      inventoryComplete = false;
      inventory.push({ dataset, ...safeSourceError(err) });
    }
  }

  const configuredTables = new Set<string>();

  for (const role of SOURCE_ROLES) {
    const def = SOURCE_DEFINITIONS[role];
    const table = sourceTable(clientId, role);
    if (!table) {
      sources.push({
        role,
        label: def.label,
        table: null,
        status: 'UNCONFIGURED',
        parameterContract: {
          dateField: def.dateField,
          dateMeaning: def.dateMeaning,
          filterFields: def.filters,
          requiredIdentityFields: def.requiredIdentityFields,
        },
        rowCount: null,
        populated: null,
        metrics: [],
      });
      continue;
    }

    configuredTables.add(table);

    try {
      const meta = await access.metadata(table);
      const schemaFields = meta.schema?.fields || [];
      const fields = flatSchema(schemaFields);

      // Check date field compatibility
      const dateType = fields.get(def.dateField);
      let status = 'SCHEMA_PRESENT';
      let reason: string | undefined;

      if (!dateType || dateType.repeated || !['STRING', 'TIMESTAMP', 'DATETIME', 'DATE'].includes(dateType.type)) {
        status = 'SCHEMA_GAP';
        reason = `Incompatible date fields: ${def.dateField}`;
      }

      const metrics = def.metrics.map(m => {
        if (!m.field) {
          return { id: m.id, label: m.label, status: 'AVAILABLE' };
        }
        const fieldMeta = fields.get(m.field);
        if (!fieldMeta) {
          return { id: m.id, label: m.label, status: 'FIELD_MISSING' };
        }
        if (fieldMeta.repeated || ['RECORD', 'STRUCT', 'JSON', 'BYTES', 'GEOGRAPHY'].includes(fieldMeta.type)) {
          return { id: m.id, label: m.label, status: 'FIELD_UNSUPPORTED' };
        }
        return { id: m.id, label: m.label, status: 'AVAILABLE' };
      });

      sources.push({
        role,
        label: def.label,
        table,
        status,
        reason,
        parameterContract: {
          dateField: def.dateField,
          dateMeaning: def.dateMeaning,
          filterFields: def.filters,
          requiredIdentityFields: def.requiredIdentityFields,
        },
        rowCount: meta.numRows !== undefined && meta.numRows !== null ? String(meta.numRows) : '0',
        populated: null,
        metrics,
      });
    } catch (err: unknown) {
      const failure = safeSourceError(err);
      sources.push({
        role,
        label: def.label,
        table,
        ...failure,
        parameterContract: {
          dateField: def.dateField,
          dateMeaning: def.dateMeaning,
          filterFields: def.filters,
          requiredIdentityFields: def.requiredIdentityFields,
        },
        rowCount: null,
        populated: null,
        metrics: def.metrics.map(m => ({ id: m.id, label: m.label, status: failure.status })),
      });
    }
  }

  const unmappedTables = allTables.filter(t => !configuredTables.has(t));

  return {
    sources,
    inventory,
    inventoryComplete,
    unmappedTables,
    validationStatus: 'NOT_VERIFIED',
  };
}
