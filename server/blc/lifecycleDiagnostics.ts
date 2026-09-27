import { BLC_SOURCES } from '../../contracts/blcReporting';
import { BLC_LIFECYCLE_REQUIREMENTS, BLC_LIFECYCLE_VERSION, type BlcLifecycleDiagnostics, type LifecycleSourceCard } from '../../contracts/blcLifecycle';
import { getClientConfig, tableIdentifier } from '../bigquery/config';
import { activationSourceIsOwned } from '../bigquery/sourceTenantScope';
import { sourceAccess, flatSchema, safeSourceError, type SourceAccess, type TableMetadata } from '../bigquery/sourceAccess';
import { validTimestampSql } from '../bigquery/integrity';

const SOURCE_TABLE = BLC_SOURCES.activationRegister.table;
const dateTypes = ['STRING', 'DATE', 'DATETIME', 'TIMESTAMP'];
const referenceTypes = ['STRING', 'INT64', 'INTEGER'];
function initial(clientId: string, checkedAt: string): BlcLifecycleDiagnostics {
  const config = getClientConfig(clientId);
  const applicable = activationSourceIsOwned(config.id);
  return {
    version: BLC_LIFECYCLE_VERSION, applicable, sourceTable: applicable ? config.semanticMappings.tables.activations || null : null,
    checkedAt, metadataStatus: 'NOT_CHECKED', queryStatus: 'NOT_CHECKED', querySucceeded: false,
    lifecycleStatus: applicable ? 'SOURCE_UNAVAILABLE' : 'NOT_APPLICABLE', canonical: false,
    sourceRows: null, distinctTransactionReferences: null, missingTransactionReferences: null, repeatedTransactionReferenceRows: null,
    latestRegisterAt: null, missingRegisterTimestampRows: null, sourceRefreshedAt: null, freshnessStatus: 'NOT_VERIFIED',
    fieldChecks: BLC_LIFECYCLE_REQUIREMENTS.map(check => ({ id: check.id, label: check.label, note: check.note, candidates: [...check.candidates], observed: [], status: 'NOT_CHECKED' })),
    message: applicable ? 'Source has not been checked.' : 'This workspace has no authorised BLC activation-register diagnostics.',
  };
}

/** One allowlisted aggregate scan, replacing the previous activation freshness scan. */
export function buildBlcLifecycleQuery(meta: TableMetadata): string {
  const schema = flatSchema(meta.schema?.fields || []);
  const available = (name: string, types: readonly string[]) => {
    const field = schema.get(name);
    return Boolean(field && !field.repeated && types.includes(field.type));
  };
  const reference = available('transaction_id', referenceTypes) ? "NULLIF(TRIM(CAST(s.`transaction_id` AS STRING)), '')" : null;
  const date = available('date_created', dateTypes) ? validTimestampSql('s.`date_created`') : null;
  return `SELECT CAST(COUNT(*) AS STRING) AS source_rows,
    ${reference ? `CAST(COUNT(DISTINCT ${reference}) AS STRING)` : 'CAST(NULL AS STRING)'} AS distinct_references,
    ${reference ? `CAST(COUNTIF(${reference} IS NULL) AS STRING)` : 'CAST(NULL AS STRING)'} AS missing_references,
    ${date ? `FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', MAX(${date}), 'UTC')` : 'CAST(NULL AS STRING)'} AS latest_register_at,
    ${date ? `CAST(COUNTIF(${date} IS NULL) AS STRING)` : 'CAST(NULL AS STRING)'} AS missing_timestamp_rows
    FROM ${tableIdentifier(SOURCE_TABLE)} s`;
}
function exact(value: unknown): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Invalid aggregate count');
  return BigInt(value).toString();
}
const optionalExact = (value: unknown) => value === null ? null : exact(value);
function decode(rows: unknown): Pick<BlcLifecycleDiagnostics, 'sourceRows' | 'distinctTransactionReferences' | 'missingTransactionReferences' | 'repeatedTransactionReferenceRows' | 'latestRegisterAt' | 'missingRegisterTimestampRows'> {
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0] || typeof rows[0] !== 'object') throw new Error('Invalid aggregate result');
  const row = rows[0];
  const sourceRows = exact(row.source_rows);
  const distinctTransactionReferences = optionalExact(row.distinct_references);
  const missingTransactionReferences = optionalExact(row.missing_references);
  const missingRegisterTimestampRows = optionalExact(row.missing_timestamp_rows);
  if ((distinctTransactionReferences === null) !== (missingTransactionReferences === null)) throw new Error('Inconsistent reference counts');
  for (const value of [distinctTransactionReferences, missingTransactionReferences, missingRegisterTimestampRows]) {
    if (value !== null && BigInt(value) > BigInt(sourceRows)) throw new Error('Count exceeds population');
  }
  let repeatedTransactionReferenceRows: string | null = null;
  if (distinctTransactionReferences !== null && missingTransactionReferences !== null) {
    const remaining = BigInt(sourceRows) - BigInt(missingTransactionReferences) - BigInt(distinctTransactionReferences);
    if (remaining < 0n) throw new Error('Inconsistent references');
    repeatedTransactionReferenceRows = remaining.toString();
  }
  const latestRegisterAt = row.latest_register_at;
  if (latestRegisterAt !== null && (typeof latestRegisterAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(latestRegisterAt) || !Number.isFinite(Date.parse(latestRegisterAt)))) throw new Error('Invalid register timestamp');
  if (latestRegisterAt !== null && (sourceRows === '0' || missingRegisterTimestampRows === null || missingRegisterTimestampRows === sourceRows)) throw new Error('Timestamp without a dated population');
  if (latestRegisterAt === null && missingRegisterTimestampRows !== null && missingRegisterTimestampRows !== sourceRows) throw new Error('Dated population without timestamp');
  return { sourceRows, distinctTransactionReferences, missingTransactionReferences, repeatedTransactionReferenceRows, latestRegisterAt, missingRegisterTimestampRows };
}

/** Authorisation is enforced by the calling analytics route; ownership is checked again here. */
export async function getBlcLifecycleDiagnostics(clientId: string, accessProvider: (clientId: string) => SourceAccess = sourceAccess, now = () => new Date()): Promise<BlcLifecycleDiagnostics> {
  const config = getClientConfig(clientId);
  const result = initial(config.id, now().toISOString());
  if (!result.applicable) return result;
  if (!result.sourceTable || result.sourceTable !== SOURCE_TABLE) {
    result.queryStatus = result.sourceTable ? 'SOURCE_NOT_APPROVED' : 'UNCONFIGURED';
    result.message = 'The configured source is not the approved BLC activation register. No metadata or data was queried.';
    return result;
  }
  let access: SourceAccess;
  let meta: TableMetadata;
  try {
    access = accessProvider(config.id);
    meta = await access.metadata(SOURCE_TABLE);
  } catch (error) {
    const failure = safeSourceError(error);
    result.metadataStatus = failure.status;
    result.message = failure.error;
    return result;
  }
  if (!Array.isArray(meta?.schema?.fields)) {
    result.metadataStatus = 'SCHEMA_UNAVAILABLE';
    result.message = 'Source metadata returned no usable schema. Field presence and row counts remain unknown.';
    return result;
  }
  let query: string;
  try {
    const schema = flatSchema(meta.schema.fields);
    result.fieldChecks = BLC_LIFECYCLE_REQUIREMENTS.map(check => {
      const observed = check.candidates.flatMap(name => {
        const field = schema.get(name);
        return field ? [{ name, type: field.type, repeated: field.repeated }] : [];
      });
      return { id: check.id, label: check.label, candidates: [...check.candidates], note: check.note, observed,
        status: !observed.length ? 'MISSING' : observed.some(field => !field.repeated && (check.types as readonly string[]).includes(field.type)) ? 'OBSERVED_UNVERIFIED' : 'TYPE_UNSUPPORTED' };
    });
    query = buildBlcLifecycleQuery(meta);
    result.metadataStatus = 'OBSERVED';
  } catch {
    result.metadataStatus = 'SCHEMA_UNAVAILABLE';
    result.message = 'Source metadata could not be validated. No data query was submitted.';
    return result;
  }
  let rows: unknown;
  try {
    ({ rows } = await access.execute({ query }));
  } catch (error) {
    const failure = safeSourceError(error);
    result.queryStatus = failure.status;
    result.message = failure.error;
    return result;
  }
  try {
    Object.assign(result, decode(rows));
  } catch {
    result.queryStatus = 'INVALID_RESPONSE';
    result.message = 'The source response failed aggregate consistency checks. Counts are unavailable, not zero.';
    return result;
  }
  result.querySucceeded = true;
  result.queryStatus = result.sourceRows === '0' ? 'EMPTY' : result.latestRegisterAt ? 'OBSERVED' : 'TIMESTAMP_UNAVAILABLE';
  result.lifecycleStatus = result.fieldChecks.some(check => check.status !== 'OBSERVED_UNVERIFIED') ? 'FIELDS_MISSING' : 'VALIDATION_REQUIRED';
  result.message = 'Read-only source observations across all BLC register rows, independent of the selected capture cohort. Schema presence is not an approved lifecycle mapping. No joins or canonical activation calculations were changed.';
  return result;
}
const safeNumber = (value: string | null): number | null => value !== null && BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;

/** Legacy activation summary and new diagnostics share one read; no duplicate scan. */
export function blcLifecycleSourceCards(diagnostics: BlcLifecycleDiagnostics): LifecycleSourceCard[] {
  const age = diagnostics.latestRegisterAt ? (Date.parse(diagnostics.checkedAt) - Date.parse(diagnostics.latestRegisterAt)) / 3600000 : null;
  const activation: LifecycleSourceCard = {
    key: 'activations', label: 'Activation source', status: diagnostics.querySucceeded ? diagnostics.queryStatus : diagnostics.queryStatus === 'NOT_CHECKED' ? diagnostics.metadataStatus : diagnostics.queryStatus,
    table: diagnostics.sourceTable, latestRecordAt: diagnostics.latestRegisterAt,
    ageHours: age !== null && Number.isFinite(age) && age >= 0 ? Math.floor(age) : null,
    rowCount: safeNumber(diagnostics.sourceRows),
    detail: 'Register date_created is an observed source timestamp, not a verified activation or ingestion time. ' + diagnostics.message,
    ...(diagnostics.missingRegisterTimestampRows !== null && safeNumber(diagnostics.missingRegisterTimestampRows) !== null ? { missingTimestampRows: safeNumber(diagnostics.missingRegisterTimestampRows)! } : {}),
  };
  if (!diagnostics.applicable) return [{ ...activation, status: 'UNAVAILABLE', detail: 'No separate activation lifecycle table is contracted for this tenant; nested operational activation timestamps remain the available source.' }];
  return [activation, {
    key: 'activationLifecycle', label: 'BLC Rubix / activation lifecycle', status: diagnostics.lifecycleStatus,
    table: diagnostics.sourceTable,
    // Do not put register timestamps into generic freshness charts a second time.
    latestRecordAt: null, ageHours: null, rowCount: null, detail: diagnostics.message, lifecycle: diagnostics,
  }];
}
