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
  definitionVersion?: string;
  timezone?: string;
  generatedAt?: string;
  sourceCutoff?: string | null;
  metricId?: string;
  countingGrain?: string;
  totalCount?: number | null;
  page?: number;
  offset?: number;
  limit?: number;
  appliedSearch?: string | null;
  investigationPredicate?: string | null;
  populationStatus?: string;
}

export interface LeadEvidenceExportContext {
  clientId?: string;
  startDate?: string | null;
  endDate?: string | null;
  filters?: Record<string, any>;
  search?: string | null;
  investigation?: string | null;
  investigationLabel?: string | null;
  timezone?: string;
  definitionVersion?: string;
  totalCount?: number | null;
  generatedAt?: string;
  page?: number;
  pageSize?: number;
  exportCreatedAt?: string;
}

export interface LeadEvidenceExportResult {
  filename: string;
  headers: string[];
  dataRows: AnalysisCell[][];
  rawRows: AnalysisCell[][]; // headers + dataRows without audit context
  rows: AnalysisCell[][]; // headers + dataRows with attached audit context
  leadIds: string[];
  totalCount: number;
  returnedRowCount: number;
  page: number;
  offset: number;
  limit: number;
  isTruncated: boolean;
  populationStatus: 'COMPLETE' | 'PARTIAL' | 'EMPTY';
  exportScopeLabel: string;
  metadata: {
    clientId: string;
    startDate: string | null;
    endDate: string | null;
    filters: Record<string, any>;
    search: string | null;
    predicate: string | null;
    investigationLabel?: string | null;
    timezone: string;
    dateBasis: string;
    metricId: string;
    definitionVersion: string;
    countingGrain: string;
    totalCount: number;
    offset: number;
    limit: number;
    returnedRowCount: number;
    populationStatus: 'COMPLETE' | 'PARTIAL' | 'EMPTY';
    validationStatus: string;
    generatedAt: string;
    sourceCutoff: string | null;
    exportCreatedAt?: string;
  };
  csv: string;
}

export const LEAD_EVIDENCE_COLUMNS = [
  'Lead ID',
  'Consumer ID',
  'Fetched',
  'Source',
  'Vendor',
  'Grade',
  'Delivered',
  'First dial',
  'Calls',
  'Latest disposition',
  'Dialled',
  'RPC',
  'Sale',
  'Activated',
  'Revenue',
] as const;

export const LEAD_EVIDENCE_AUDIT_COLUMNS = [
  'Scope client',
  'Period start',
  'Period end',
  'Filters',
  'Applied search',
  'Investigation predicate',
  'Reporting timezone',
  'Date basis',
  'Metric definitions',
  'Canonical metric',
  'Definition version',
  'Counting grain',
  'Population total',
  'Page offset',
  'Page limit',
  'Current page',
  'Exported row count',
  'Population status',
  'Validation status',
  'Server generated at',
  'Source cutoff',
  'Detail truncated',
] as const;

export function serializeCsv(rows: AnalysisCell[][]): string {
  const quote = (val: any) => {
    if (val === null || val === undefined) return '""';
    const raw = String(val);
    const s = typeof val === 'string' && /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return `"${s}"`;
  };
  return '\uFEFF' + rows.map(r => r.map(quote).join(',')).join('\r\n');
}

/** Pure production builder for lead evidence export with verified result context. */
export function buildLeadEvidenceExport(
  result: {
    rows: Array<Record<string, any>>;
    totalCount?: number | null;
    limit?: number;
    offset?: number;
    drill?: string | null;
    drillValue?: string | null;
    search?: string | null;
    clientId?: string;
    startDate?: string | null;
    endDate?: string | null;
    vendor?: string | null;
    source?: string | null;
    medium?: string | null;
    grade?: string | null;
    filters?: Record<string, any>;
    timezone?: string;
    dateBasis?: string;
    definitionVersion?: string;
    metricId?: string;
    countingGrain?: string;
    validationStatus?: string;
    sourceCutoff?: string | null;
    generatedAt?: string;
    metadata?: Record<string, any>;
  },
  context: LeadEvidenceExportContext = {}
): LeadEvidenceExportResult {
  if (!result || !Array.isArray(result.rows)) {
    throw new Error('Cannot export invalid lead evidence result: rows must be an array');
  }

  // Enforce strict totalCount: builder cannot invent or fall back to UI context or row count
  const rawTotal = typeof result.totalCount === 'number'
    ? result.totalCount
    : (result.metadata && typeof result.metadata.totalCount === 'number')
    ? result.metadata.totalCount
    : null;
  if (rawTotal === null || !Number.isSafeInteger(rawTotal) || rawTotal < 0) {
    throw new Error('Cannot export lead evidence: verified totalCount is required and cannot be inferred from UI context or row count');
  }
  const totalCount = rawTotal;

  // Enforce strict limit: builder cannot supply default limit or fall back to UI pageSize
  const rawLimit = typeof result.limit === 'number'
    ? result.limit
    : (result.metadata && typeof result.metadata.limit === 'number')
    ? result.metadata.limit
    : null;
  if (rawLimit === null || !Number.isSafeInteger(rawLimit) || rawLimit <= 0) {
    throw new Error('Cannot export lead evidence: verified limit is required and cannot be defaulted');
  }
  const limit = rawLimit;

  // Enforce strict offset: builder cannot supply default offset or fall back to UI page calculation
  const rawOffset = typeof result.offset === 'number'
    ? result.offset
    : (result.metadata && typeof result.metadata.offset === 'number')
    ? result.metadata.offset
    : null;
  if (rawOffset === null || !Number.isSafeInteger(rawOffset) || rawOffset < 0) {
    throw new Error('Cannot export lead evidence: verified offset is required and cannot be defaulted');
  }
  const offset = rawOffset;

  // Validate complete page contract: cannot export a short invalid page
  const expectedPageRows = Math.min(limit, Math.max(0, totalCount - offset));
  if (result.rows.length !== expectedPageRows) {
    throw new Error(
      `Cannot export incomplete evidence page: received ${result.rows.length} rows, expected complete page of ${expectedPageRows} rows for total ${totalCount}, limit ${limit}, offset ${offset}`
    );
  }

  // Enforce strict client context: cannot invent default_tenant when context is missing
  const rawClientId = result.clientId || result.metadata?.clientId;
  if (!rawClientId || typeof rawClientId !== 'string' || !rawClientId.trim()) {
    throw new Error('Cannot export lead evidence: verified clientId is required');
  }
  const clientId = rawClientId.trim();

  // Truthful date bounds: must be explicitly present on result as valid string or explicit null; do not allow UI context to substitute
  const hasStartDate = ('startDate' in result && result.startDate !== undefined) || (Boolean(result.metadata) && 'startDate' in result.metadata! && result.metadata!.startDate !== undefined);
  if (!hasStartDate) {
    throw new Error('Cannot export lead evidence: verified startDate is required (explicit date string or null)');
  }
  const startDate = 'startDate' in result ? result.startDate : result.metadata?.startDate;
  if (startDate !== null && (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate))) {
    throw new Error('Cannot export lead evidence: startDate must be a valid YYYY-MM-DD string or null');
  }

  const hasEndDate = ('endDate' in result && result.endDate !== undefined) || (Boolean(result.metadata) && 'endDate' in result.metadata! && result.metadata!.endDate !== undefined);
  if (!hasEndDate) {
    throw new Error('Cannot export lead evidence: verified endDate is required (explicit date string or null)');
  }
  const endDate = 'endDate' in result ? result.endDate : result.metadata?.endDate;
  if (endDate !== null && (typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate))) {
    throw new Error('Cannot export lead evidence: endDate must be a valid YYYY-MM-DD string or null');
  }
  if (startDate !== null && endDate !== null && startDate > endDate) {
    throw new Error('Cannot export lead evidence: startDate cannot be after endDate');
  }

  // Truthful applied filters: must be explicitly present as object (empty {} is valid); absent filters cannot default or substitute UI context
  const hasFilters = ('filters' in result && result.filters !== undefined) || (Boolean(result.metadata) && 'appliedFilters' in result.metadata! && result.metadata!.appliedFilters !== undefined);
  if (!hasFilters) {
    throw new Error('Cannot export lead evidence: verified filters object is required and cannot be absent');
  }
  const filters = ('filters' in result && result.filters !== undefined) ? result.filters : result.metadata?.appliedFilters;
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new Error('Cannot export lead evidence: verified filters must be a non-null object');
  }

  // Truthful search: must be explicitly present on result as string or null; do not allow UI context to substitute
  const hasSearch = ('search' in result && result.search !== undefined) || (Boolean(result.metadata) && 'search' in result.metadata! && result.metadata!.search !== undefined);
  if (!hasSearch) {
    throw new Error('Cannot export lead evidence: verified search context is required (string or null)');
  }
  const search = 'search' in result ? result.search : result.metadata?.search;
  if (search !== null && typeof search !== 'string') {
    throw new Error('Cannot export lead evidence: search must be a string or null');
  }

  // Truthful drill context: must be explicitly present on result as string or null
  const hasDrill = ('drill' in result && result.drill !== undefined) || (Boolean(result.metadata) && 'drill' in result.metadata! && result.metadata!.drill !== undefined);
  if (!hasDrill) {
    throw new Error('Cannot export lead evidence: verified drill context is required (string or null)');
  }
  const drill = 'drill' in result ? result.drill : result.metadata?.drill;
  if (drill !== null && typeof drill !== 'string') {
    throw new Error('Cannot export lead evidence: drill must be a string or null');
  }
  const drillValue = 'drillValue' in result ? (result.drillValue ?? null) : (result.metadata?.drillValue ?? null);
  if (drillValue !== null && typeof drillValue !== 'string') {
    throw new Error('Cannot export lead evidence: drillValue must be a string or null');
  }

  // Machine-readable investigation predicate is derived from result; context.investigation may accompany as a label but not replace it
  const predicate = drill ? (drillValue ? `${drill}=${drillValue}` : drill) : null;
  const investigationLabel = context.investigationLabel || context.investigation || (drill ? (drillValue ? `${drill}: ${drillValue}` : drill) : null);

  // Enforce strict timezone: cannot default to Africa/Johannesburg or fall back to UI context
  const rawTimezone = result.timezone || result.metadata?.timezone;
  if (!rawTimezone || typeof rawTimezone !== 'string' || !rawTimezone.trim()) {
    throw new Error('Cannot export lead evidence: verified timezone is required and cannot be defaulted');
  }
  const timezone = rawTimezone.trim();

  // Enforce strict dateBasis: cannot default to intake_cohort or fall back to UI context
  const rawDateBasis = result.dateBasis || result.metadata?.dateBasis;
  if (!rawDateBasis || typeof rawDateBasis !== 'string' || !rawDateBasis.trim()) {
    throw new Error('Cannot export lead evidence: verified dateBasis is required and cannot be defaulted');
  }
  const dateBasis = rawDateBasis.trim();

  // Enforce strict definitionVersion: builder cannot supply default version or fall back to UI context
  const rawDefVersion = result.definitionVersion || result.metadata?.definitionVersion;
  if (!rawDefVersion || typeof rawDefVersion !== 'string' || !rawDefVersion.trim()) {
    throw new Error('Cannot export lead evidence: verified definitionVersion is required');
  }
  const definitionVersion = rawDefVersion.trim();

  // Enforce strict countingGrain: cannot default to lead or fall back to UI context
  const rawGrain = result.countingGrain || result.metadata?.countingGrain;
  if (!rawGrain || typeof rawGrain !== 'string' || !rawGrain.trim()) {
    throw new Error('Cannot export lead evidence: verified countingGrain is required and cannot be defaulted');
  }
  const countingGrain = rawGrain.trim();

  // Enforce strict metricId: verified metricId required from result
  const rawMetricId = result.metricId || result.metadata?.metricId;
  if (!rawMetricId || typeof rawMetricId !== 'string' || !rawMetricId.trim()) {
    throw new Error('Cannot export lead evidence: verified metricId is required');
  }
  const metricId = rawMetricId.trim();

  // Enforce strict generatedAt: must be verified server-generated ISO timestamp, cannot be Unavailable or unvalidated
  const rawGeneratedAt = result.generatedAt || result.metadata?.generatedAt;
  if (!rawGeneratedAt || typeof rawGeneratedAt !== 'string' || isNaN(Date.parse(rawGeneratedAt))) {
    throw new Error('Cannot export lead evidence: verified server generatedAt timestamp is required');
  }
  const generatedAt = rawGeneratedAt;

  const sourceCutoff = result.sourceCutoff !== undefined ? result.sourceCutoff : (result.metadata?.sourceCutoff ?? null);
  const validationStatus = result.validationStatus || result.metadata?.validationStatus || 'NOT_VERIFIED';
  const exportCreatedAt = context.exportCreatedAt && !isNaN(Date.parse(context.exportCreatedAt)) ? context.exportCreatedAt : undefined;

  const pageNum = Math.floor(offset / limit) + 1;
  const isComplete = totalCount > 0 && result.rows.length === totalCount && offset === 0;
  const isEmpty = totalCount === 0;
  const populationStatus: 'COMPLETE' | 'PARTIAL' | 'EMPTY' = isEmpty ? 'EMPTY' : isComplete ? 'COMPLETE' : 'PARTIAL';
  const exportScopeLabel = isEmpty
    ? 'CURRENT PAGE (EMPTY)'
    : isComplete
    ? 'CURRENT PAGE (COMPLETE POPULATION)'
    : 'CURRENT PAGE (PARTIAL POPULATION)';
  const isTruncated = totalCount > result.rows.length;

  const totalDesc = totalCount != null ? ` of ${totalCount} in scope` : '';
  const predicateDesc = predicate ? `Investigation: ${predicate}. ` : '';
  const popDesc = isComplete ? 'Complete population' : isEmpty ? 'Empty population' : 'Partial population';
  const definitions = `Administrator record export. ${predicateDesc}Current page ${pageNum} (${result.rows.length} records${totalDesc}); ${popDesc}; one row per scoped lead.`;

  const headers = [...LEAD_EVIDENCE_COLUMNS];
  const auditHeaders = [...LEAD_EVIDENCE_AUDIT_COLUMNS];
  const combinedHeaders = [...headers, ...auditHeaders];

  const leadIds: string[] = [];
  const dataRows: AnalysisCell[][] = result.rows.map(row => {
    leadIds.push(String(row.lead_id));
    return [
      row.lead_id,
      row.consumer_id !== null && row.consumer_id !== undefined ? row.consumer_id : '—',
      row.fetched || '—',
      row.source || '—',
      row.vendor || '—',
      row.grade || '—',
      row.delivered_time || '—',
      row.first_call_time || '—',
      row.total_calls !== null && row.total_calls !== undefined ? row.total_calls : '—',
      row.last_dialer_status || 'Unavailable',
      row.dialled ? 'Yes' : 'No',
      row.contacted === null || row.contacted === undefined ? 'Unavailable' : row.contacted ? 'Yes' : 'No',
      row.sale ? 'Yes' : 'No',
      row.activated ? 'Yes' : 'No',
      row.revenue !== null && row.revenue !== undefined ? row.revenue : null,
    ];
  });

  const auditValues: AnalysisCell[] = [
    clientId,
    startDate,
    endDate,
    JSON.stringify(filters || {}),
    search,
    predicate,
    timezone,
    dateBasis,
    definitions,
    metricId,
    definitionVersion,
    countingGrain,
    totalCount,
    offset,
    limit,
    pageNum,
    result.rows.length,
    populationStatus,
    validationStatus,
    generatedAt,
    sourceCutoff ?? 'Unavailable',
    isTruncated,
  ];

  const fullRows: AnalysisCell[][] = [
    combinedHeaders,
    ...dataRows.map(row => [...row, ...auditValues]),
  ];

  const filename = `lead_records_${clientId}_p${pageNum}`;

  return {
    filename,
    headers: combinedHeaders,
    dataRows,
    rawRows: [headers, ...dataRows],
    rows: fullRows,
    leadIds,
    totalCount,
    returnedRowCount: result.rows.length,
    page: pageNum - 1,
    offset,
    limit,
    isTruncated,
    populationStatus,
    exportScopeLabel,
    metadata: {
      clientId,
      startDate,
      endDate,
      filters,
      search,
      predicate,
      investigationLabel: investigationLabel || null,
      timezone,
      dateBasis,
      metricId,
      definitionVersion,
      countingGrain,
      totalCount,
      offset,
      limit,
      returnedRowCount: result.rows.length,
      populationStatus,
      validationStatus,
      generatedAt,
      sourceCutoff,
      exportCreatedAt,
    },
    csv: serializeCsv(fullRows),
  };
}

/** Download helper for lead evidence export */
export function downloadLeadEvidenceCsv(
  result: Parameters<typeof buildLeadEvidenceExport>[0],
  context: LeadEvidenceExportContext = {}
): void {
  const exportResult = buildLeadEvidenceExport(result, context);
  downloadCsv(exportResult.filename, exportResult.rows);
}

/** Every exported aggregate carries its scope, including zero and unavailable values. */
export function scopedAnalysisRows(rows: AnalysisCell[][], scope: AnalysisExportScope): AnalysisCell[][] {
  if (!rows.length) return [];
  const audit = [
    scope.clientId,
    scope.startDate || null,
    scope.endDate || null,
    JSON.stringify(scope.filters || {}),
    scope.validationStatus || 'NOT_VERIFIED',
    scope.dateBasis || 'lead_capture_cohort',
    Array.isArray(scope.definitions) ? scope.definitions.join('; ') : scope.definitions || null,
    scope.truncated ?? false,
  ];
  return [
    [
      ...rows[0],
      'Scope client',
      'Period start',
      'Period end',
      'Filters',
      'Validation status',
      'Date basis',
      'Metric definitions',
      'Detail truncated',
    ],
    ...rows.slice(1).map(row => [...row, ...audit]),
  ];
}

export function downloadAnalysisCsv(filename: string, rows: AnalysisCell[][], scope: AnalysisExportScope) {
  downloadCsv(filename, scopedAnalysisRows(rows, scope));
}
