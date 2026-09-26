import { downloadCsv } from './formatters';

export type AnalysisCell = string | number | boolean | null | undefined;
export interface AnalysisExportScope {
  clientId: string;
  startDate?: string;
  endDate?: string;
  filters?: unknown;
  validationStatus?: string;
  dateBasis?: string;
  definitions?: string | string[];
  truncated?: boolean;
}

/** Every exported aggregate carries its scope, including zero and unavailable values. */
export function scopedAnalysisRows(rows: AnalysisCell[][], scope: AnalysisExportScope): AnalysisCell[][] {
  if (!rows.length) return [];
  const audit = [scope.clientId, scope.startDate || null, scope.endDate || null,
    JSON.stringify(scope.filters || {}), scope.validationStatus || 'NOT_VERIFIED',
    scope.dateBasis || 'lead_capture_cohort', Array.isArray(scope.definitions) ? scope.definitions.join('; ') : scope.definitions || null, scope.truncated ?? false];
  return [[...rows[0], 'Scope client', 'Period start', 'Period end', 'Filters', 'Validation status',
    'Date basis', 'Metric definitions', 'Detail truncated'], ...rows.slice(1).map(row => [...row, ...audit])];
}

export function downloadAnalysisCsv(filename: string, rows: AnalysisCell[][], scope: AnalysisExportScope) {
  downloadCsv(filename, scopedAnalysisRows(rows, scope));
}
