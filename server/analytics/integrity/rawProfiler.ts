import { getBigQueryClient } from '../../bigquery/client';
import type { RawSourceProfileResult, SourceProfileOptions } from '../../bigquery/warehouseRegistry';
import { RAW_JSON_SOURCES } from '../../../contracts/warehouseDictionary';

const SENSITIVE_KEY_PATTERN = /(email|token|secret|password|bearer|auth|ssn|id_number|idno|phone|mobile|cell|card|cvv)/i;
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
      SAFE.JSON_KEYS(raw_data, 1) AS level_1_keys,
      SAFE.JSON_KEYS(raw_data, 2) AS level_2_keys
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
    // Return explicit dependency / unprofiled error result rather than throwing 500 or fabricating fake live data
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
  const redact = options.redactDynamicKeys !== false;
  const keyCounts = new Map<string, { type: string; count: number }>();
  const detectedDynamicKeys: string[] = [];
  const recordArrayCandidates: string[] = [];
  let rootShape: 'object' | 'array' | 'scalar' | 'null' = 'null';
  let hasObject = false;
  let hasArray = false;

  for (const row of rows) {
    const type = String(row.json_root_type || 'null').toLowerCase();
    if (type === 'object') hasObject = true;
    if (type === 'array') hasArray = true;

    const keys: string[] = Array.isArray(row.level_1_keys) ? row.level_1_keys : [];
    for (const rawKey of keys) {
      if (DYNAMIC_KEY_PATTERN.test(rawKey)) {
        detectedDynamicKeys.push(redact ? '[REDACTED_DYNAMIC_KEY]' : rawKey);
        continue;
      }
      const isSensitive = SENSITIVE_KEY_PATTERN.test(rawKey);
      const displayKey = isSensitive && redact ? `[REDACTED_${rawKey.toUpperCase()}]` : rawKey;
      const current = keyCounts.get(displayKey) || { type: 'unknown', count: 0 };
      current.count += 1;
      keyCounts.set(displayKey, current);

      // Detect potential child record collections
      if (/records|items|data|rows|leads|calls|events|payloads/i.test(rawKey)) {
        if (!recordArrayCandidates.includes(displayKey)) {
          recordArrayCandidates.push(displayKey);
        }
      }
    }
  }

  rootShape = hasObject && hasArray ? 'object' : hasArray ? 'array' : hasObject ? 'object' : 'null';
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
    rowCountEstimate: rows.length,
    scannedBytesEstimate: null,
    outerTimestampSemantics: 'outer_record_timestamp',
    topLevelKeys: Array.from(keyCounts.entries()).map(([key, stat]) => ({
      key,
      type: stat.type,
      nullCount: rows.length - stat.count,
    })),
    jsonStructureFindings: {
      envelopeType,
      topLevelShape: rootShape,
      recordArrayCandidates,
      scalarVsArrayDrift,
      detectedDynamicKeys: Array.from(new Set(detectedDynamicKeys)),
    },
    sampleRecordsAnalyzed: rows.length,
    status: 'PROFILED',
    dependencies: [],
  };
}
