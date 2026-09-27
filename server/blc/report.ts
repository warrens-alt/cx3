import { BLC_REPORT_VERSION, BLC_SOURCES, isBlcSourceId, type BlcReport, type BlcSourceId } from '../../contracts/blcReporting';
import { validateScope, RequestError, type QueryScope, type Scalar } from '../bigquery/filters';
import { conditionSql } from '../bigquery/filters';
import { getClientConfig, tableIdentifier, tenantVendorScopeValues } from '../bigquery/config';
import { activationSourceIsOwned } from '../bigquery/sourceTenantScope';
import { flatSchema, safeSourceError, type SourceAccess } from '../bigquery/sourceAccess';
import { sourceDateFilter } from '../bigquery/sourceDateFilter';
import { validTimestampSql } from '../bigquery/integrity';

const LIMITATIONS = [
  'Live query results are source evidence, not reconciled business metrics.',
  'Counts are physical rows and distinct nonblank source references, not necessarily unique customers or net activations.',
  'The reporting period uses the selected source date field, not a shared cross-source cohort.',
  'Existing source-date parsing uses UTC. Source timezone semantics are not certified.',
  'Rows with missing, invalid or sentinel source dates are excluded by the date filter; they are not counted as zero-valued events.',
  'Latest source date is the maximum observed within this selection, not a verified refresh timestamp.',
  'No financial totals, key-equivalence assumptions, record exports or cross-source joins are performed.',
];
const column = (name: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new RequestError('Invalid configured BLC column', 503);
  return `s.\`${name}\``;
};
const text = (name: string) => `NULLIF(TRIM(CAST(${column(name)} AS STRING)), '')`;
const compatibleType = (actual: string) => (({ INTEGER: 'INT64', DECIMAL: 'NUMERIC', BIGDECIMAL: 'BIGNUMERIC', BOOLEAN: 'BOOL' } as Record<string, string>)[actual] || actual);

/** Ownership and supported filters are validated before any metadata or data access. */
export function validateBlcRequest(input: QueryScope, sourceId: unknown): { scope: QueryScope & { startDate: string; endDate: string }; sourceId: BlcSourceId } {
  const scope = validateScope(input);
  const client = getClientConfig(scope.clientId);
  if (!activationSourceIsOwned(client.id)) throw new RequestError('BLC source access is not configured for this workspace', 403);
  if (!isBlcSourceId(sourceId)) throw new RequestError('Unknown BLC reporting source', 404);
  if (!scope.startDate || !scope.endDate) throw new RequestError('Select both start and end dates for BLC reporting', 422);
  if ((Date.parse(scope.endDate) - Date.parse(scope.startDate)) / 86400000 >= 366) {
    throw new RequestError('BLC source reports support at most 366 inclusive days per request', 422);
  }
  const source = BLC_SOURCES[sourceId];
  const permittedVendors = new Set(tenantVendorScopeValues(getClientConfig('ontact_blc')));
  for (const [key, f] of Object.entries(scope.filters || {})) {
    if (key === 'vendor') {
      const values = f.operator === 'equals' ? [f.value] : f.operator === 'in' ? f.values || [] : [];
      if (!values.length || values.some(value => typeof value !== 'string' || !permittedVendors.has(value.trim().toLowerCase()))) {
        throw new RequestError('BLC reporting requires a BLC-only vendor selection or no vendor filter', 422);
      }
    } else if (key === 'source' && source.supportsSourceFilter && ['equals', 'in', 'not_equals'].includes(f.operator)) {
      // Applied to the already configured offershop_source field below.
    } else {
      throw new RequestError(`This BLC source cannot apply the ${key} filter. Remove it or choose a compatible source.`, 422);
    }
  }
  return { sourceId, scope: { ...scope, clientId: client.id, startDate: scope.startDate, endDate: scope.endDate } };
}

export function buildBlcQuery(input: QueryScope, requestedSource: unknown): { query: string; params: Record<string, Scalar> } {
  const { sourceId, scope } = validateBlcRequest(input, requestedSource);
  const source = BLC_SOURCES[sourceId];
  const params: Record<string, Scalar> = { startDate: scope.startDate, endDate: scope.endDate };
  const predicates = [sourceDateFilter(column(source.dateField), source.fields[source.dateField]).sql];
  if (scope.filters?.source) predicates.push(conditionSql(column('offershop_source'), scope.filters.source, 'blc_source', params));
  if (source.supportsSourceFilter) {
    // Defense in depth: even a changed view cannot widen this report beyond BLC.
    predicates.push(conditionSql(`LOWER(TRIM(${column('vendor')}))`,
      { operator: 'in', values: tenantVendorScopeValues(getClientConfig('ontact_blc')) }, 'blc_owner', params));
  }
  const fields = Object.keys(source.fields);
  const projection = fields.map(name => `${column(name)} AS \`${name}\``).join(', ');
  const query = `WITH scoped AS (
    SELECT ${projection} FROM ${tableIdentifier(source.table)} s
    WHERE ${predicates.join(' AND ')}
  )
  SELECT
    CAST(COUNT(*) AS STRING) AS source_rows,
    CAST(COUNT(DISTINCT ${text(source.keyField)}) AS STRING) AS distinct_references,
    CAST(COUNTIF(${text(source.keyField)} IS NULL) AS STRING) AS missing_references,
    CAST(MAX(DATE(${validTimestampSql(column(source.dateField))})) AS STRING) AS latest_source_date,
    ARRAY(SELECT AS STRUCT CAST(DATE(${validTimestampSql(column(source.dateField))}) AS STRING) AS date,
      CAST(COUNT(*) AS STRING) AS source_rows FROM scoped s GROUP BY date ORDER BY date LIMIT 367) AS daily,
    ARRAY(SELECT AS STRUCT ${text(source.breakdownField)} AS label,
      CAST(COUNT(*) AS STRING) AS source_rows FROM scoped s GROUP BY label
      ORDER BY COUNT(*) DESC, label LIMIT 201) AS breakdown,
    [${fields.map(name => `STRUCT('${name}' AS field, CAST(COUNTIF(${text(name)} IS NOT NULL) AS STRING) AS populated_rows)`).join(',\n    ')}] AS field_coverage
  FROM scoped s`;
  return { query, params };
}

function count(value: unknown): string {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  throw new Error('BLC report returned an invalid exact count');
}
function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('BLC report returned an invalid label');
  return value;
}

export async function getBlcReport(input: QueryScope, requestedSource: unknown, access: SourceAccess, now = () => new Date()): Promise<BlcReport> {
  const { sourceId, scope } = validateBlcRequest(input, requestedSource);
  const source = BLC_SOURCES[sourceId];
  const report: BlcReport = {
    version: BLC_REPORT_VERSION, sourceId, source, scope: { ...scope, filters: scope.filters || {} },
    status: 'UNAVAILABLE', checkedAt: now().toISOString(), metadataAccessible: false, querySucceeded: false,
    validationStatus: 'NOT_VERIFIED', freshnessVerified: false, latestSourceDate: null, message: null,
    missingFields: [], observedFields: [], summary: null, daily: [], breakdown: [], breakdownTruncated: false,
    fieldCoverage: [], queryEvidence: null, limitations: [...LIMITATIONS, source.note],
  };
  try {
    const meta = await access.metadata(source.table);
    report.metadataAccessible = true;
    const schema = flatSchema(meta.schema?.fields || []);
    for (const [name, expected] of Object.entries(source.fields)) {
      const observed = schema.get(name);
      const compatible = Boolean(observed && !observed.repeated && compatibleType(observed.type) === expected);
      if (!compatible) report.missingFields.push(name);
      report.observedFields.push({ name, type: observed?.type || 'NOT_OBSERVED', compatible });
    }
    if (report.missingFields.length) return { ...report, status: 'SCHEMA_MISMATCH', message: 'The source schema differs from the recorded contract. No data query ran. Ask the data owner to verify the listed fields.' };
    const result = await access.execute(buildBlcQuery(scope, sourceId));
    if (result.rows.length !== 1) throw new Error('Expected one BLC aggregate result');
    const row = result.rows[0];
    if (!Array.isArray(row.daily) || !Array.isArray(row.breakdown) || !Array.isArray(row.field_coverage)) throw new Error('Invalid aggregate arrays');
    const summary = { sourceRows: count(row.source_rows), distinctReferences: count(row.distinct_references), missingReferences: count(row.missing_references) };
    const daily = row.daily.map((r: any) => ({ date: nullableText(r.date) || '', sourceRows: count(r.source_rows) }));
    const breakdown = row.breakdown.map((r: any) => ({ label: nullableText(r.label), sourceRows: count(r.source_rows) }));
    const fieldCoverage = row.field_coverage.map((r: any) => ({ field: nullableText(r.field) || '', populatedRows: count(r.populated_rows) }));
    if (daily.some((r: { date: string }) => !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) || daily.length > 366 ||
        fieldCoverage.length !== Object.keys(source.fields).length ||
        new Set(fieldCoverage.map((r: { field: string }) => r.field)).size !== fieldCoverage.length ||
        fieldCoverage.some((r: { field: string; populatedRows: string }) => !Object.hasOwn(source.fields, r.field) || BigInt(r.populatedRows) > BigInt(summary.sourceRows)) ||
        BigInt(summary.distinctReferences) + BigInt(summary.missingReferences) > BigInt(summary.sourceRows) ||
        daily.reduce((total: bigint, r: { sourceRows: string }) => total + BigInt(r.sourceRows), 0n) !== BigInt(summary.sourceRows)) {
      throw new Error('BLC aggregate validation failed');
    }
    return { ...report, status: summary.sourceRows === '0' ? 'EMPTY' : 'READY', checkedAt: now().toISOString(), querySucceeded: true,
      latestSourceDate: nullableText(row.latest_source_date), summary, daily,
      breakdown: breakdown.slice(0, 200), breakdownTruncated: breakdown.length > 200, fieldCoverage,
      queryEvidence: { jobId: result.jobId, bytesProcessed: result.bytesProcessed ?? null },
      message: summary.sourceRows === '0' ? 'The query succeeded and returned no dated rows in this selection. This is not evidence that the whole source is empty.' : null };
  } catch (error) {
    const safe = safeSourceError(error);
    return { ...report, checkedAt: now().toISOString(), status: safe.status as BlcReport['status'], message: safe.error };
  }
}
