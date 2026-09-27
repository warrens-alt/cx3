import { getBigQueryClient } from '../../bigquery/client';
import type { RawSourceProfileResult, SourceProfileOptions } from '../../bigquery/warehouseRegistry';
import { RAW_JSON_SOURCES } from '../../../contracts/warehouseDictionary';

const SENSITIVE_KEY_PATTERN = /(email|token|secret|password|bearer|auth|ssn|id_number|idno|phone|mobile|cell|card|cvv|first_name|last_name|surname|address)/i;
const DYNAMIC_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^\d{9,16}$|^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

export async function profileRawJsonSource(
  sourceTable: string,
  options: SourceProfileOptions = {}
): Promise<RawSourceProfileResult> {
  const parts = sourceTable.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid fully-qualified source identifier: ${sourceTable}`);
  }
  const [project, dataset, table] = parts;

  if (!RAW_JSON_SOURCES.includes(sourceTable as any)) {
    throw new Error(`Source ${sourceTable} is not an authorised raw JSON source for intake profiling.`);
  }

  const limit = Math.min(Math.max(1, options.limit || 20), 100);
  const client = getBigQueryClient(project);

  const query = `
    SELECT
      unique_id,
      source,
      timestamp,
      JSON_TYPE(raw_data) AS json_root_type,
      raw_data
    FROM \`${project}.${dataset}.${table}\`
    WHERE raw_data IS NOT NULL
    LIMIT @limit
  `;

  try {
    const [rows] = await client.query({
      query,
      params: { limit },
    });

    return analyzeProfileRows(sourceTable, project, dataset, table, rows, options);
  } catch (err: any) {
    return {
      sourceId: sourceTable,
      project,
      dataset,
      table,
      profiledAt: new Date().toISOString(),
      rowCountEstimate: null,
      scannedBytesEstimate: null,
      outerTimestampSemantics: 'outer_record_timestamp',
      topLevelKeys: [],
      jsonStructureFindings: {
        envelopeType: 'unknown',
        topLevelShape: 'null',
        recordArrayCandidates: [],
        scalarVsArrayDrift: false,
        detectedDynamicKeys: [],
      },
      sampleRecordsAnalyzed: 0,
      samplingMethod: 'FIRST_N_ROWS_BOUNDED_SAMPLE',
      samplingLimitations: 'Profiling failed to execute against the target warehouse source.',
      status: 'ERROR',
      error: err?.message || 'BigQuery query execution failed for raw source profiling',
      dependencies: [
        `Cross-project read permission on ${project}.${dataset}.${table}`,
        'ADC or Service Account with bigquery.jobs.create and bigquery.tables.getData permissions',
      ],
    };
  }
}

export function analyzeProfileRows(
  sourceTable: string,
  project: string,
  dataset: string,
  table: string,
  rows: any[],
  options: SourceProfileOptions = {}
): RawSourceProfileResult {
  // Ordinary callers cannot disable redaction. All payload text is untrusted data.
  const redact = true;
  const keyStats = new Map<string, {
    types: Set<string>;
    presentCount: number;
    explicitNullCount: number;
    sampleValues: string[];
  }>();
  const detectedDynamicKeys: string[] = [];
  const recordArrayCandidates: string[] = [];
  let hasObject = false;
  let hasArray = false;

  for (const row of rows) {
    const rootType = String(row.json_root_type || 'null').toLowerCase();
    if (rootType === 'object') hasObject = true;
    if (rootType === 'array') hasArray = true;

    let payload: Record<string, any> = {};
    try {
      if (typeof row.raw_data === 'string') {
        payload = JSON.parse(row.raw_data);
      } else if (row.raw_data && typeof row.raw_data === 'object') {
        payload = row.raw_data;
      }
    } catch {
      payload = {};
    }

    if (payload && typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).length > 0) {
      hasObject = true;
      for (const [rawKey, val] of Object.entries(payload)) {
        if (DYNAMIC_KEY_PATTERN.test(rawKey)) {
          detectedDynamicKeys.push(redact ? '[REDACTED_DYNAMIC_KEY]' : rawKey);
          continue;
        }

        const isSensitive = SENSITIVE_KEY_PATTERN.test(rawKey);
        const displayKey = isSensitive && redact ? `[REDACTED_${rawKey.toUpperCase()}]` : rawKey;
        const current = keyStats.get(displayKey) || {
          types: new Set<string>(),
          presentCount: 0,
          explicitNullCount: 0,
          sampleValues: [],
        };

        current.presentCount += 1;
        if (val === null || val === undefined) {
          current.explicitNullCount += 1;
          current.types.add('null');
        } else if (Array.isArray(val)) {
          current.types.add('array');
          // Infer record array collection boundaries ONLY from actual array value contents,
          // never from field-name regexes (e.g. Fetched_Leads is a number, not a record array).
          if ((val.length > 0 && typeof val[0] === 'object' && val[0] !== null) || ['records', 'items', 'events', 'batch'].includes(rawKey.toLowerCase())) {
            if (!recordArrayCandidates.includes(displayKey)) {
              recordArrayCandidates.push(displayKey);
            }
          }
        } else if (typeof val === 'number') {
          current.types.add('number');
          if (current.sampleValues.length < 3) current.sampleValues.push(String(val));
        } else if (typeof val === 'boolean') {
          current.types.add('boolean');
          if (current.sampleValues.length < 3) current.sampleValues.push(String(val));
        } else if (typeof val === 'object') {
          current.types.add('object');
        } else {
          current.types.add('string');
          if (!isSensitive && current.sampleValues.length < 3) {
            const strVal = String(val).slice(0, 50);
            current.sampleValues.push(strVal);
          }
        }

        keyStats.set(displayKey, current);
      }
    } else if (Array.isArray(row.level_1_keys) && row.level_1_keys.length > 0) {
      hasObject = true;
      for (const rawKey of row.level_1_keys) {
        if (DYNAMIC_KEY_PATTERN.test(rawKey)) {
          detectedDynamicKeys.push(redact ? '[REDACTED_DYNAMIC_KEY]' : rawKey);
          continue;
        }

        const isSensitive = SENSITIVE_KEY_PATTERN.test(rawKey);
        const displayKey = isSensitive && redact ? `[REDACTED_${rawKey.toUpperCase()}]` : rawKey;
        const isArrayCandidate = ['records', 'items', 'events', 'batch'].includes(rawKey.toLowerCase()) || rawKey.toLowerCase().endsWith('_list') || rawKey.toLowerCase().endsWith('_array');
        if (isArrayCandidate && !recordArrayCandidates.includes(displayKey)) {
          recordArrayCandidates.push(displayKey);
        }

        const current = keyStats.get(displayKey) || {
          types: new Set<string>(),
          presentCount: 0,
          explicitNullCount: 0,
          sampleValues: [],
        };
        current.presentCount += 1;
        if (isArrayCandidate) {
          current.types.add('array');
        } else {
          current.types.add('unknown');
        }
        keyStats.set(displayKey, current);
      }
    } else if (Array.isArray(payload)) {
      hasArray = true;
    }
  }

  const rootShape: 'object' | 'array' | 'scalar' | 'null' = hasObject && hasArray
    ? 'object'
    : hasArray
      ? 'array'
      : hasObject
        ? 'object'
        : 'null';
  const scalarVsArrayDrift = hasObject && hasArray;

  let envelopeType: 'event' | 'snapshot' | 'batch_array' | 'unknown' = 'unknown';
  if (recordArrayCandidates.length > 0 || rootShape === 'array') {
    envelopeType = 'batch_array';
  } else if (hasObject) {
    envelopeType = 'event';
  }

  return {
    sourceId: sourceTable,
    project,
    dataset,
    table,
    profiledAt: new Date().toISOString(),
    rowCountEstimate: null, // Replaced rowCountEstimate = rows.length with explicit null (unknown warehouse count)
    scannedBytesEstimate: null,
    outerTimestampSemantics: 'outer_record_timestamp',
    topLevelKeys: Array.from(keyStats.entries()).map(([key, stat]) => {
      const typeStr = Array.from(stat.types).filter(t => t !== 'null').join(' | ') || 'null';
      return {
        key,
        type: typeStr,
        nullCount: stat.explicitNullCount,
        missingCount: rows.length - stat.presentCount,
        explicitNullCount: stat.explicitNullCount,
        sampleValues: stat.sampleValues,
      };
    }),
    jsonStructureFindings: {
      envelopeType,
      topLevelShape: rootShape,
      recordArrayCandidates,
      scalarVsArrayDrift,
      detectedDynamicKeys: Array.from(new Set(detectedDynamicKeys)),
    },
    sampleRecordsAnalyzed: rows.length,
    samplingMethod: 'FIRST_N_ROWS_BOUNDED_SAMPLE',
    samplingLimitations: 'Sample limited to at most 100 rows from recent ingestion. Inferred types, collection boundaries, dynamic keys, and null counts reflect inspected sample rows only; warehouse-wide row counts remain distinct.',
    status: 'PROFILED',
    dependencies: [],
  };
}
