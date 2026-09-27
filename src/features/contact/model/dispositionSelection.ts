import {
  type DetailedDispositionRow,
  type ContactDispositionsData,
  type VendorDispositionSummaryItem,
  presentMappingStatus,
} from '../../../../contracts/vendorDispositions';
import {
  type DispositionExportMetadata,
  type AnalysisCell,
  buildDispositionExportRows,
  serializeCsv,
} from '../../../lib/analysisExport';

export interface DispositionSelectionParams {
  vendor: string;
  groupFilter?: string | null;
  searchQuery?: string | null;
}

export interface EffectiveRequestContext {
  clientId?: string;
  startDate?: string | null;
  endDate?: string | null;
  filters?: Record<string, any>;
  timezone?: string;
  userRole?: string;
  userEmail?: string;
}

export interface SelectedDispositionExportResult {
  filename: string;
  selectedRows: DetailedDispositionRow[];
  dataRows: AnalysisCell[][];
  metadata: DispositionExportMetadata;
  fullRows: AnalysisCell[][];
  csv: string;
  isEmptyMatch: boolean;
  preSearchGroupCount: number;
  totalVendorVolume: number;
  selectedVolume: number;
}

/**
 * Pure selection filter shared identically by the drawer table and export builder.
 * Preserves exact row order, stable raw identities, and standard matching rules.
 */
export function filterDispositionRows(
  rows: DetailedDispositionRow[],
  groupFilter?: string | null,
  searchQuery?: string | null
): DetailedDispositionRow[] {
  let list = [...rows];
  const activeGroup = groupFilter && groupFilter !== 'ALL' ? groupFilter : null;
  if (activeGroup) {
    list = list.filter((r) => r.approvedGroup === activeGroup);
  }
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(
      (r) =>
        r.rawDisposition.toLowerCase().includes(q) ||
        (r.rawDescription && r.rawDescription.toLowerCase().includes(q)) ||
        r.approvedGroupLabel.toLowerCase().includes(q)
    );
  }
  return list;
}

/**
 * Computes group totals pre-search for a vendor's rows to serve as the true denominator
 * for Share of Group %, independent of any applied text search.
 */
export function calculateGroupTotals(rows: DetailedDispositionRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.approvedGroup, (map.get(r.approvedGroup) || 0) + r.count);
  }
  return map;
}

/**
 * Production selection and export builder derived from a single successful disposition report.
 * Validates required analytical fields with no fallback substitutions.
 * Distinguishes all five population metrics unambiguously.
 */
export function buildVendorSelectedExport(params: {
  report: ContactDispositionsData | null | undefined;
  requestContext: EffectiveRequestContext;
  selection: DispositionSelectionParams;
}): SelectedDispositionExportResult {
  const { report, requestContext, selection } = params;

  if (!report) {
    throw new Error('Cannot export: No disposition report data is available.');
  }

  // Analytical field validation: missing fields prevent auditable export with readable error; no fallbacks!
  if (!report.reportVersion || typeof report.reportVersion !== 'string' || !report.reportVersion.trim()) {
    throw new Error('Cannot export: Missing required reportVersion in disposition report.');
  }
  if (!report.mode || (report.mode !== 'lead_status' && report.mode !== 'call_records')) {
    throw new Error('Cannot export: Missing or invalid mode in disposition report.');
  }
  if (!report.dateBasis || typeof report.dateBasis !== 'string' || !report.dateBasis.trim()) {
    throw new Error('Cannot export: Missing required dateBasis in disposition report.');
  }
  if (!report.countingGrain || typeof report.countingGrain !== 'string' || !report.countingGrain.trim()) {
    throw new Error('Cannot export: Missing required countingGrain in disposition report.');
  }
  if (
    report.summary === undefined ||
    report.summary === null ||
    typeof report.summary.totalEntities !== 'number' ||
    isNaN(report.summary.totalEntities)
  ) {
    throw new Error('Cannot export: Missing required totalEntities population in disposition report summary.');
  }
  if (!report.evaluatedAt || typeof report.evaluatedAt !== 'string' || !report.evaluatedAt.trim()) {
    throw new Error('Cannot export: Missing required evaluatedAt timestamp in disposition report.');
  }
  if (!selection.vendor || typeof selection.vendor !== 'string' || !selection.vendor.trim()) {
    throw new Error('Cannot export: Missing required vendor selection.');
  }

  // Scope validation: client must be present and must not contradict
  const resolvedClientId = report.clientId || requestContext.clientId;
  if (!resolvedClientId || typeof resolvedClientId !== 'string' || !resolvedClientId.trim()) {
    throw new Error('Cannot export: Missing required clientId in disposition report and request context.');
  }
  if (report.clientId && requestContext.clientId && report.clientId !== requestContext.clientId) {
    throw new Error(`Cannot export: Report clientId "${report.clientId}" contradicts request clientId "${requestContext.clientId}".`);
  }

  const vendorSummary = report.vendorSummaries?.find((v) => v.vendor === selection.vendor);
  if (!vendorSummary) {
    throw new Error(`Cannot export: Vendor "${selection.vendor}" was not found in disposition report summary.`);
  }

  const isCallMode = report.mode === 'call_records';
  const effectiveGroup = selection.groupFilter && selection.groupFilter !== 'ALL' ? selection.groupFilter : 'ALL';
  const effectiveSearch = selection.searchQuery ? selection.searchQuery.trim() : '';

  // 1. All rows for this vendor from report.breakdown
  const allVendorRows = (report.breakdown || []).filter((r) => r.vendor === selection.vendor);
  const totalVendorVolume = allVendorRows.reduce((sum, r) => sum + r.count, 0);

  // 2. Pre-search group totals for accurate share of group calculation
  const groupTotals = calculateGroupTotals(allVendorRows);
  const preSearchGroupCount =
    effectiveGroup !== 'ALL'
      ? groupTotals.get(effectiveGroup) || 0
      : totalVendorVolume;

  // 3. Derived filtered rows using the identical selector
  const selectedRows = filterDispositionRows(allVendorRows, effectiveGroup, effectiveSearch);
  const selectedVolume = selectedRows.reduce((sum, r) => sum + r.count, 0);
  const isEmptyMatch = selectedRows.length === 0;

  // 4. Vendor base and definitions
  // In call_records: base is total call events recorded for this vendor
  // In lead_status: base is dialled lead-vendor pairs for this vendor
  const vendorBase = isCallMode ? vendorSummary.totalPopulation : vendorSummary.dialledCount;
  const denominatorDefinition = isCallMode
    ? `Total call events recorded for vendor ${selection.vendor} in selected period`
    : `Dialled lead–vendor pairs for vendor ${selection.vendor} in capture cohort`;

  // 5. Build tabular data rows matching drawer table order and columns
  const headers: string[] = [
    'Vendor',
    'Raw Disposition Code',
    'Description',
    'Approved Outcome Group',
    'Volume',
    'Share of Group %',
    'Share of Vendor %',
    'Mapping Status',
    'RPC',
    'Sales',
    'Callbacks',
    ...(isCallMode ? ['Avg Duration (sec)', 'Valid Duration Count', 'Latest Observation'] : []),
  ];

  const dataRows: AnalysisCell[][] = [
    headers,
    ...selectedRows.map((r) => {
      const grpTotal = groupTotals.get(r.approvedGroup) || 0;
      const shareOfGrp = grpTotal > 0 ? (r.count / grpTotal) * 100 : null;
      const shareOfVendor = r.percentOfBase;
      const statusPres = presentMappingStatus(r);

      return [
        r.vendor,
        r.rawDisposition,
        r.rawDescription || '—',
        r.approvedGroupLabel,
        r.count,
        shareOfGrp !== null ? `${shareOfGrp.toFixed(1)}%` : '—',
        shareOfVendor !== null && shareOfVendor !== undefined ? `${shareOfVendor}%` : '—',
        statusPres.label, // Unified label identical to drawer table
        r.rpcCount,
        r.saleCount,
        r.callbackCount,
        ...(isCallMode
          ? [r.avgDurationSec ?? '—', r.validDurationCount ?? '—', r.latestObservation ?? '—']
          : []),
      ];
    }),
  ];

  // 6. Filename reflecting precise selection scope
  const groupSlug = effectiveGroup !== 'ALL' ? `_${effectiveGroup.toLowerCase()}` : '';
  const searchSlug = effectiveSearch ? '_filtered' : '';
  const filename = `raw_dispositions_${selection.vendor}${groupSlug}${searchSlug}_${report.mode}_${resolvedClientId}`;

  // 7. Unambiguous metadata distinguishing all 5 population metrics
  const metadata: DispositionExportMetadata = {
    clientId: resolvedClientId,
    startDate: requestContext.startDate || null,
    endDate: requestContext.endDate || null,
    filters: requestContext.filters || {},
    mode: report.mode,
    dateBasis: report.dateBasis,
    countingGrain: report.countingGrain,
    totalPopulation: report.summary.totalEntities, // Full report population (not selected rows sum!)
    reportPopulation: report.summary.totalEntities,
    vendorPopulation: vendorSummary.totalPopulation,
    vendorBase,
    preSearchGroupPopulation: preSearchGroupCount,
    selectedVolume,
    returnedRowCount: selectedRows.length,
    denominatorDefinition,
    isTruncated: false,
    taxonomyVersion: report.reportVersion,
    userRole: requestContext.userRole || 'authenticated',
    userEmail: requestContext.userEmail || undefined,
    generatedAt: report.evaluatedAt, // Exact report evaluation timestamp
    inspectedVendor: selection.vendor,
    activeGroupFilter: effectiveGroup,
    searchQuery: effectiveSearch || null,
    exportScope: 'VENDOR_SELECTED_BREAKDOWN',
  };

  const fullRows = buildDispositionExportRows(dataRows, metadata);
  const csv = serializeCsv(fullRows);

  return {
    filename,
    selectedRows,
    dataRows,
    metadata,
    fullRows,
    csv,
    isEmptyMatch,
    preSearchGroupCount,
    totalVendorVolume,
    selectedVolume,
  };
}
