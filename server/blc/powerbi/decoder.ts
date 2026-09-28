import type {
  RubixCompletenessStatus,
  RubixQueryType,
  RubixReportRow,
  RubixReportSummary,
} from '../../../contracts/rubixPowerBi';

export interface DecodedPowerBiResult {
  rows: RubixReportRow[];
  summary: RubixReportSummary;
  completenessStatus: RubixCompletenessStatus;
  truncation: boolean;
  warnings: string[];
}

export interface SchemaColumn {
  name: string;
  type?: number;
  dictName?: string;
}

/**
 * Decodes a raw Power BI SemanticQueryDataShapeCommand HTTP response.
 * Safely handles:
 * - Group headers PH, Schema S, Data Matrix DM0
 * - Repeat bitmasks R
 * - Value dictionaries ValueDicts (D0, D1, etc.)
 * - Subtotal / Grand total row detection and exclusion
 * - Explicit nulls and empty matrices
 * - Semantic errors inside HTTP 200 bodies
 */
export function decodePowerBiResponse(
  rawResponse: unknown,
  queryType: RubixQueryType
): DecodedPowerBiResult {
  if (!rawResponse || typeof rawResponse !== 'object') {
    throw new Error('SCHEMA_UNSUPPORTED: Response is not a valid JSON object');
  }

  const root = rawResponse as Record<string, unknown>;

  // Check for semantic error inside response
  if (root.error) {
    const msg = typeof root.error === 'object' && root.error !== null
      ? (root.error as Record<string, unknown>).message || JSON.stringify(root.error)
      : String(root.error);
    throw new Error(`UPSTREAM_ERROR: Power BI semantic error: ${msg}`);
  }

  const results = root.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('SCHEMA_UNSUPPORTED: Missing results array in Power BI response');
  }

  const firstResult = results[0];
  if (!firstResult || typeof firstResult !== 'object') {
    throw new Error('SCHEMA_UNSUPPORTED: Invalid first result in Power BI response');
  }

  if (firstResult.error) {
    const msg = typeof firstResult.error === 'object' && firstResult.error !== null
      ? (firstResult.error as Record<string, unknown>).message || JSON.stringify(firstResult.error)
      : String(firstResult.error);
    throw new Error(`UPSTREAM_ERROR: Power BI result error: ${msg}`);
  }

  const resultObj = firstResult.result;
  if (!resultObj || typeof resultObj !== 'object') {
    throw new Error('SCHEMA_UNSUPPORTED: Missing result object in Power BI response');
  }

  const dataObj = resultObj.data as Record<string, unknown> | undefined;
  if (!dataObj || typeof dataObj !== 'object') {
    throw new Error('SCHEMA_UNSUPPORTED: Missing data object in Power BI response');
  }

  const dsr = dataObj.dsr as Record<string, unknown> | undefined;
  if (!dsr || typeof dsr !== 'object') {
    throw new Error('SCHEMA_UNSUPPORTED: Missing dsr object in Power BI response');
  }

  const dsArray = dsr.DS;
  if (!Array.isArray(dsArray) || dsArray.length === 0) {
    // Empty result set
    return {
      rows: [],
      summary: createEmptySummary(),
      completenessStatus: 'COMPLETE',
      truncation: false,
      warnings: [],
    };
  }

  const ds0 = dsArray[0] as Record<string, unknown>;
  const isCompleteFlag = ds0.IC;
  const hasAdditionalData = ds0.HAD;

  const completenessStatus: RubixCompletenessStatus =
    isCompleteFlag === true && !hasAdditionalData
      ? 'COMPLETE'
      : isCompleteFlag === false || hasAdditionalData
      ? 'PARTIAL'
      : 'UNKNOWN';

  const truncation = completenessStatus === 'PARTIAL';
  const warnings: string[] = [];
  if (truncation) {
    warnings.push('Power BI result reached data-reduction window limit; results may be truncated.');
  }

  const valueDicts = (ds0.ValueDicts || {}) as Record<string, string[]>;
  const primaryHierarchies = ds0.PH;
  if (!Array.isArray(primaryHierarchies) || primaryHierarchies.length === 0) {
    return {
      rows: [],
      summary: createEmptySummary(),
      completenessStatus,
      truncation,
      warnings,
    };
  }

  const ph0 = primaryHierarchies[0] as Record<string, unknown>;
  const dm0 = ph0.DM0;
  if (!Array.isArray(dm0) || dm0.length === 0) {
    return {
      rows: [],
      summary: createEmptySummary(),
      completenessStatus,
      truncation,
      warnings,
    };
  }

  // Parse rows with schema inheritance and repeat masks
  let currentSchema: SchemaColumn[] = [];
  let previousRowValues: unknown[] = [];
  const decodedRows: RubixReportRow[] = [];

  for (let rowIndex = 0; rowIndex < dm0.length; rowIndex++) {
    const rawRow = dm0[rowIndex] as Record<string, unknown>;

    // Update schema if row defines one
    if (Array.isArray(rawRow.S)) {
      currentSchema = rawRow.S.map((colDef: unknown) => {
        const c = colDef as Record<string, unknown>;
        return {
          name: String(c.N || ''),
          type: typeof c.T === 'number' ? c.T : undefined,
          dictName: typeof c.DN === 'string' ? c.DN : undefined,
        };
      });
    }

    const rawCells = Array.isArray(rawRow.C) ? [...rawRow.C] : [];
    const repeatMask = typeof rawRow.R === 'number' ? rawRow.R : 0;

    // Resolve repeat masks: bit k set means column k repeats from previousRowValues[k]
    const fullRowValues: unknown[] = [];
    let cellCursor = 0;

    const columnCount = currentSchema.length > 0 ? currentSchema.length : (rawCells.length + (repeatMask ? 3 : 0));

    for (let colIdx = 0; colIdx < columnCount; colIdx++) {
      const isRepeated = (repeatMask & (1 << colIdx)) !== 0;
      if (isRepeated && previousRowValues[colIdx] !== undefined) {
        fullRowValues[colIdx] = previousRowValues[colIdx];
      } else if (cellCursor < rawCells.length) {
        fullRowValues[colIdx] = rawCells[cellCursor++];
      } else {
        fullRowValues[colIdx] = null;
      }
    }

    previousRowValues = [...fullRowValues];

    // Check if this row is a subtotal / grand-total row (e.g. rollups, null grouping, or Ø flag)
    const isSubtotal = rawRow['Ø'] === true || rawRow.isSubtotal === true || isRowSubtotal(fullRowValues, queryType);

    // Map to typed RubixReportRow based on queryType
    const row = mapRowToTyped(fullRowValues, currentSchema, valueDicts, queryType, isSubtotal);
    if (row) {
      decodedRows.push(row);
    }
  }

  // Calculate summary excluding subtotals
  const detailRows = decodedRows.filter(r => !r.isSubtotal);
  const summary = calculateSummary(detailRows);

  return {
    rows: decodedRows,
    summary,
    completenessStatus,
    truncation,
    warnings,
  };
}

function resolveCellValue(val: unknown, colDef?: SchemaColumn, dicts: Record<string, string[]> = {}): string | null {
  if (val === null || val === undefined) return null;
  if (colDef?.dictName && dicts[colDef.dictName] && typeof val === 'number') {
    const resolved = dicts[colDef.dictName][val];
    return resolved !== undefined ? resolved : String(val);
  }
  return String(val);
}

function parseMeasureCount(val: unknown): { count: number; rawCount: string } {
  if (val === null || val === undefined) return { count: 0, rawCount: '0' };
  const rawCount = String(val).trim();
  const num = Number(rawCount);
  return {
    count: isNaN(num) ? 0 : Math.round(num),
    rawCount,
  };
}

function isRowSubtotal(values: unknown[], queryType: RubixQueryType): boolean {
  // If first grouping column is null in a grouped breakdown, it is a subtotal/grand total
  if (values.length >= 2 && (values[0] === null || values[0] === undefined)) {
    return true;
  }
  return false;
}

function mapRowToTyped(
  values: unknown[],
  schema: SchemaColumn[],
  dicts: Record<string, string[]>,
  queryType: RubixQueryType,
  isSubtotal: boolean
): RubixReportRow | null {
  if (values.length === 0) return null;

  if (queryType.endsWith('_over_time')) {
    // Column 0: date, Column 1: count
    const rawDate = resolveCellValue(values[0], schema[0], dicts);
    const date = rawDate ? normalizeDateString(rawDate) : undefined;
    const { count, rawCount } = parseMeasureCount(values[1]);
    return {
      date,
      count,
      rawCount,
      isSubtotal,
    };
  }

  if (queryType.endsWith('_by_team')) {
    // Column 0: team_name, Column 1: count
    const team = resolveCellValue(values[0], schema[0], dicts) || 'Unassigned';
    const { count, rawCount } = parseMeasureCount(values[1]);
    return {
      team,
      count,
      rawCount,
      isSubtotal,
    };
  }

  if (queryType.endsWith('_by_segment')) {
    // Column 0: segment, Column 1: count
    const segment = resolveCellValue(values[0], schema[0], dicts) || 'Unknown';
    const { count, rawCount } = parseMeasureCount(values[1]);
    return {
      segment,
      count,
      rawCount,
      isSubtotal,
    };
  }

  if (queryType.endsWith('_by_agent_and_team')) {
    // Column 0: team_name, Column 1: full_name, Column 2: count
    const team = resolveCellValue(values[0], schema[0], dicts) || 'Unassigned';
    const agent = resolveCellValue(values[1], schema[1], dicts) || 'Unknown';
    const { count, rawCount } = parseMeasureCount(values[2]);
    return {
      team,
      agent,
      count,
      rawCount,
      isSubtotal,
    };
  }

  // Fallback generic mapping
  const { count, rawCount } = parseMeasureCount(values[values.length - 1]);
  return {
    count,
    rawCount,
    isSubtotal,
  };
}

function normalizeDateString(dateStr: string): string {
  // Format datetime strings '2026-03-01T00:00:00' -> '2026-03-01'
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 10);
  }
  return dateStr;
}

function createEmptySummary(): RubixReportSummary {
  return {
    totalCount: 0,
    rowCount: 0,
    minDate: null,
    maxDate: null,
    distinctTeams: 0,
    distinctSegments: 0,
    distinctAgents: 0,
  };
}

function calculateSummary(rows: RubixReportRow[]): RubixReportSummary {
  let totalCount = 0;
  const dates: string[] = [];
  const teams = new Set<string>();
  const segments = new Set<string>();
  const agents = new Set<string>();

  for (const row of rows) {
    totalCount += row.count;
    if (row.date) dates.push(row.date);
    if (row.team) teams.add(row.team);
    if (row.segment) segments.add(row.segment);
    if (row.agent) agents.add(row.agent);
  }

  dates.sort();
  const minDate = dates.length > 0 ? dates[0] : null;
  const maxDate = dates.length > 0 ? dates[dates.length - 1] : null;

  return {
    totalCount,
    rowCount: rows.length,
    minDate,
    maxDate,
    distinctTeams: teams.size,
    distinctSegments: segments.size,
    distinctAgents: agents.size,
  };
}
