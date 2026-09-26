import { type SourceMetric, type SourceRole, SOURCE_ROLES } from '../../contracts/sourceCoverage';
import { conditionSql, RequestError, validateScope, type QueryScope, type Scalar } from './filters';
import { flatSchema, sourceAccess, sourceMetricFieldAvailable, type SourceAccess, type TableMetadata } from './sourceAccess';
import { sourceTable } from './sourceCatalog';
import { tableIdentifier } from './config';
import { validTimestampSql } from './integrity';
import { sourceTenantPredicate } from './sourceTenantScope';
import { definitionForSource } from './sourceDefinition';
import { sourceDateFilter } from './sourceDateFilter';

export interface CompiledSourceMetrics {
  query: string; params: Record<string, Scalar>; metrics: SourceMetric[]; available: boolean[];
  table: string; dateField: string; dateFilterStrategy: string; grouping: string | null;
}
const atom = (name: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new RequestError('Invalid configured field identifier', 503);
  return `s.\`${name}\``;
};
const text = (field: string) => `NULLIF(TRIM(CAST(${atom(field)} AS STRING)), '')`;
function normalized(metric: SourceMetric) {
  if (!metric.field) return 'NULL';
  const value = text(metric.field);
  if (metric.operation === 'sum') return `SAFE_CAST(${value} AS NUMERIC)`;
  if (metric.operation === 'true') return `CASE LOWER(${value}) WHEN 'true' THEN TRUE WHEN '1' THEN TRUE WHEN 'false' THEN FALSE WHEN '0' THEN FALSE ELSE NULL END`;
  if (metric.operation === 'timestamp') return validTimestampSql(atom(metric.field));
  return value;
}
export function compileSourceMetrics(role: SourceRole, input: QueryScope, meta: TableMetadata, grouping: string | null = null): CompiledSourceMetrics {
  const scope = validateScope(input), table = sourceTable(scope.clientId, role);
  if (!table) throw new RequestError('This source is not configured', 422);
  const def = definitionForSource(role, table);
  const fields = flatSchema(meta.schema?.fields || []), dateField = def.dateField;
  const dateType = fields.get(dateField);
  if (!dateType || dateType.repeated || !['STRING', 'TIMESTAMP', 'DATETIME', 'DATE'].includes(dateType.type)) throw new RequestError(`A compatible ${dateField} mapping is required to honour reporting dates`, 422);
  if (!scope.startDate || !scope.endDate) throw new RequestError('Explicit source-metric startDate and endDate are required');
  if (Date.parse(scope.endDate) - Date.parse(scope.startDate) > 365 * 86400000) throw new RequestError('Select at most 366 inclusive days');
  if (grouping && (role !== 'marketing' || !['channel'].includes(grouping))) throw new RequestError('Unsupported source grouping');
  if (grouping && !sourceMetricFieldAvailable(grouping, fields)) throw new RequestError(`The ${grouping} field is not available`, 422);
  const params: Record<string, Scalar> = { startDate: scope.startDate, endDate: scope.endDate };
  const dateFilter = sourceDateFilter(atom(dateField), dateType.type);
  const clauses = [dateFilter.sql];
  const ownership = sourceTenantPredicate(scope.clientId, role, meta, params);
  if (ownership) clauses.push(ownership);
  for (const [key, condition] of Object.entries(scope.filters || {})) {
    const field = def.filters[key as keyof typeof def.filters];
    if (!field || !fields.has(field)) throw new RequestError(`${def.label} has no verified ${key} mapping. That filter cannot be silently ignored.`, 422);
    if (field === 'hlc_details.vendor') {
      const hlc = meta.schema?.fields?.find(item => item.name.toLowerCase() === 'hlc_details');
      const vendor = hlc?.fields?.find(item => item.name.toLowerCase() === 'vendor');
      if (hlc?.mode?.toUpperCase() !== 'REPEATED' || !['RECORD', 'STRUCT'].includes(hlc.type.toUpperCase())) throw new RequestError('HLC evidence requires a repeated record field', 422);
      if (!vendor || !sourceMetricFieldAvailable('vendor', flatSchema([vendor]))) throw new RequestError('HLC evidence requires a compatible scalar vendor field', 422);
      clauses.push(`EXISTS (SELECT 1 FROM UNNEST(s.hlc_details) h WHERE ${conditionSql('CAST(h.vendor AS STRING)', condition, `source_filter_${key}`, params)})`);
    } else {
      if (!sourceMetricFieldAvailable(field, fields)) throw new RequestError('A compatible scalar filter mapping is required', 422);
      clauses.push(conditionSql(`CAST(${atom(field)} AS STRING)`, condition, `source_filter_${key}`, params));
    }
  }
  const metrics = def.metrics, available = metrics.map(metric => sourceMetricFieldAvailable(metric.field, fields));
  const parts = metrics.flatMap((metric, i) => {
    if (!available[i]) return ['value', 'valid', 'invalid', 'missing'].map(part => `CAST(NULL AS STRING) AS m${i}_${part}`);
    const value = metric.field ? normalized(metric) : 'NULL';
    const aggregate = metric.operation === 'count' ? 'COUNT(*)' : metric.operation === 'sum' ? `IF(COUNT(*)=0, NUMERIC '0', SUM(${value}))` : metric.operation === 'distinct' ? `COUNT(DISTINCT ${value})` : metric.operation === 'true' ? `COUNTIF(${value} IS TRUE)` : `COUNTIF(${value} IS NOT NULL)`;
    return [`CAST(${aggregate} AS STRING) AS m${i}_value`, `CAST(${metric.field ? `COUNTIF(${value} IS NOT NULL)` : 'COUNT(*)'} AS STRING) AS m${i}_valid`,
      `CAST(${metric.field ? `COUNTIF(${text(metric.field)} IS NOT NULL AND ${value} IS NULL)` : '0'} AS STRING) AS m${i}_invalid`,
      `CAST(${metric.field ? `COUNTIF(${text(metric.field)} IS NULL)` : '0'} AS STRING) AS m${i}_missing`];
  });
  const group = grouping ? `CAST(${atom(grouping)} AS STRING)` : 'CAST(NULL AS STRING)';
  return { table, dateField, dateFilterStrategy: dateFilter.strategy, grouping, metrics, available, params,
    query: `SELECT ${grouping ? `GROUPING(${group}) = 1` : 'TRUE'} AS is_total, ${grouping ? group : 'CAST(NULL AS STRING)'} AS group_key,
    ${parts.join(',\n    ')}
    FROM ${tableIdentifier(table)} s WHERE ${clauses.join(' AND ')}
    ${grouping ? `GROUP BY GROUPING SETS ((), (${group}))` : ''} LIMIT 5002`,
  };
}
export async function getSourceMetrics(roleText: string, input: QueryScope, access: SourceAccess = sourceAccess(input.clientId), grouping: string | null = null) {
  if (!SOURCE_ROLES.includes(roleText as SourceRole)) throw new RequestError('Unknown source role', 404);
  const role = roleText as SourceRole, table = sourceTable(input.clientId, role);
  if (!table) throw new RequestError('No configured source table', 422);
  const def = definitionForSource(role, table);
  const compiled = compileSourceMetrics(role, input, await access.metadata(table), grouping);
  const result = await access.execute({ query: compiled.query, params: compiled.params });
  if (result.rows.length > 5001) throw new RequestError('Too many source groups; no partial totals were returned', 413);
  let totalRow = result.rows.find(row => row.is_total === true);
  if (!totalRow) {
    if (result.rows.length !== 0) throw new RequestError('Missing or duplicated source aggregate', 502);
    totalRow = { is_total: true, group_key: null };
    compiled.metrics.forEach((_metric, i) => { for (const key of ['value', 'valid', 'missing', 'invalid']) totalRow![`m${i}_${key}`] = '0'; });
  } else if (result.rows.filter(row => row.is_total === true).length !== 1) throw new RequestError('Missing or duplicated source aggregate', 502);
  const format = (row: Record<string, any>) => compiled.metrics.map((metric, i) => {
    const value = row[`m${i}_value`], missing = row[`m${i}_missing`], invalid = row[`m${i}_invalid`];
    for (const item of [value, missing, invalid, row[`m${i}_valid`]]) if (item != null && (typeof item !== 'string' || !/^-?\d+(\.\d+)?$/.test(item))) throw new RequestError('Source precision contract violated', 502);
    for (const count of [missing, invalid, row[`m${i}_valid`]]) if (count != null && !/^\d+$/.test(count)) throw new RequestError('Source row-count contract violated', 502);
    const mapped = compiled.available[i], partial = mapped && ((missing != null && BigInt(missing) > 0n) || (invalid != null && BigInt(invalid) > 0n));
    return { id: metric.id, label: metric.label, unit: metric.unit, sourceField: metric.field ?? null,
      value: !mapped || (metric.operation === 'sum' && partial) ? null : value ?? null,
      recordedSubtotal: mapped && metric.operation === 'sum' ? value ?? null : null,
      status: !mapped ? 'UNAVAILABLE' : partial ? 'PARTIAL' : 'MEASURED',
      validRows: row[`m${i}_valid`] ?? null, missingRows: missing ?? null, invalidRows: invalid ?? null,
      reason: !mapped ? 'Mapped field is absent or has an unsupported schema.' : partial ? 'Some selected records have missing or unparseable values; no complete numeric total is claimed.' : null,
      note: metric.note ?? null,
    };
  });
  return { role, table, dateBasis: def.dateMeaning, dateField: compiled.dateField,
    dateFilterStrategy: compiled.dateFilterStrategy, partitionPruningVerified: false,
    parameterContract: { dateField: def.dateField, dateMeaning: def.dateMeaning, filterFields: def.filters, requiredIdentityFields: def.requiredIdentityFields },
    timezone: 'UTC', timezoneVerified: false, scope: validateScope(input), metrics: format(totalRow),
    groups: result.rows.filter(row => row.is_total !== true).map(row => ({ group: row.group_key, metrics: format(row) })),
    dateCoverage: 'NOT_MEASURED', populationNote: 'Only records with a usable timestamp inside the selected source-date window are included. Records with missing or invalid date values cannot be assigned to that period; their source-wide coverage is not measured here.',
    rowGrain: 'physical_source_row', truncated: false, queryJobId: result.jobId, referencedTables: result.referencedTables, bytesProcessed: result.bytesProcessed,
    generatedAt: new Date().toISOString(), validationStatus: 'NOT_INDEPENDENTLY_RECONCILED', warning: def.warning,
  };
}
