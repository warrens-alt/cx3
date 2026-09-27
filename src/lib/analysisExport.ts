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

  // Enforce strict totalCount: builder cannot invent or fall back from missing totalCount to rows.length
  const rawTotal = typeof result.totalCount === 'number'
    ? result.totalCount
    : typeof context.totalCount === 'number'
    ? context.totalCount
    : null;
  if (rawTotal === null || !Number.isSafeInteger(rawTotal) || rawTotal < 0) {
    throw new Error('Cannot export lead evidence: verified totalCount is required and cannot be inferred from row count');
  }
  const totalCount = rawTotal;

  const limit = result.limit ?? context.pageSize ?? 50;
  const offset = result.offset ?? ((context.page ?? 0) * limit);

  // Validate complete page contract: cannot export a short invalid page
  const expectedPageRows = Math.min(limit, Math.max(0, totalCount - offset));
  if (result.rows.length !== expectedPageRows) {
    throw new Error(
      `Cannot export incomplete evidence page: received ${result.rows.length} rows, expected complete page of ${expectedPageRows} rows for total ${totalCount}, limit ${limit}, offset ${offset}`
    );
  }

  // Enforce strict client context: cannot invent default_tenant when context is missing
  const clientId = result.clientId || result.metadata?.clientId || context.clientId;
  if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
    throw new Error('Cannot export lead evidence: verified clientId is required');
  }

  // Truthful date bounds: preserve null when result ran with unbounded dates; do not allow UI context to substitute
  const startDate = 'startDate' in result
    ? (result.startDate ?? null)
    : ('startDate' in (result.metadata || {}))
    ? (result.metadata?.startDate ?? null)
    : (context.startDate ?? null);

  const endDate = 'endDate' in result
    ? (result.endDate ?? null)
    : ('endDate' in (result.metadata || {}))
    ? (result.metadata?.endDate ?? null)
    : (context.endDate ?? null);

  // Truthful search: preserve null when query ran without search; do not allow UI context to substitute
  const search = 'search' in result
    ? (result.search ?? null)
    : ('search' in (result.metadata || {}))
    ? (result.metadata?.search ?? null)
    : (context.search ?? null);

  // Truthful applied filters: preserve explicitly empty filters {} from server result; do not substitute newer UI filters
  const filters = result.filters !== undefined
    ? result.filters
    : result.metadata?.appliedFilters !== undefined
    ? result.metadata.appliedFilters
    : context.filters !== undefined
    ? context.filters
    : {};

  const drill = result.drill || null;
  const drillValue = result.drillValue || null;
  const investigation = context.investigation || (drill ? (drillValue ? `${drill}: ${drillValue}` : drill) : null);
  const predicate = investigation || (drill ? `${drill}${drillValue ? `=${drillValue}` : ''}` : null);
  const timezone = result.timezone || result.metadata?.timezone || context.timezone || 'Africa/Johannesburg';
  const dateBasis = result.dateBasis || result.metadata?.dateBasis || 'intake_cohort';

  // Enforce strict definitionVersion: builder cannot supply default version when context is missing
  const definitionVersion = result.definitionVersion || result.metadata?.definitionVersion || context.definitionVersion;
  if (!definitionVersion || typeof definitionVersion !== 'string' || !definitionVersion.trim()) {
    throw new Error('Cannot export lead evidence: verified definitionVersion is required');
  }

  const metricId = result.metricId || (drill === 'funnel-stage' && drillValue === 'delivered' ? 'delivered_leads' : drill === 'funnel-stage' && drillValue === 'fetched' ? 'fetched_leads' : drill || 'lead_records');
  const countingGrain = result.countingGrain || 'lead';
  const validationStatus = result.validationStatus || 'NOT_VERIFIED';
  const generatedAt = result.generatedAt || result.metadata?.generatedAt || context.generatedAt || 'Unavailable';
  const sourceCutoff = result.sourceCutoff ?? null;
  const exportCreatedAt = context.exportCreatedAt;

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
