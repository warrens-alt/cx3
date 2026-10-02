import {
  APPROVED_DISPOSITION_GROUPS,
  type ApprovedDispositionGroup,
  type ContactDispositionsData,
} from '../../../../contracts/vendorDispositions';
import type { AnalysisCell } from '../../../lib/analysisExport';

const OUTCOME_GROUPS_ORDER: ApprovedDispositionGroup[] = [
  'REPORTED_SALE', 'CONTACTED_RPC', 'CALLBACK_REQUESTED', 'NOT_INTERESTED',
  'NO_ANSWER', 'BUSY', 'VOICEMAIL', 'INVALID_WRONG_NUMBER', 'DO_NOT_CONTACT',
  'TECHNICAL_FAILURE', 'OTHER', 'UNMAPPED', 'MISSING_DISPOSITION', 'CONFLICTING_EVIDENCE',
];

/** One presentation model for the existing chart and its complete scoped export. */
export function dispositionComparison(data: ContactDispositionsData | undefined) {
  if (!data?.vendorSummaries || !data.breakdown) return { chartRows: [], activeGroups: [] };
  const totals = new Map<string, Map<ApprovedDispositionGroup, number>>();
  const present = new Set<ApprovedDispositionGroup>();
  for (const row of data.breakdown) {
    const groups = totals.get(row.vendor) || new Map<ApprovedDispositionGroup, number>();
    groups.set(row.approvedGroup, (groups.get(row.approvedGroup) || 0) + row.count);
    totals.set(row.vendor, groups);
    present.add(row.approvedGroup);
  }
  const activeGroups = OUTCOME_GROUPS_ORDER.filter(group => present.has(group));
  const chartRows = data.vendorSummaries.map(vendor => {
    const groups = totals.get(vendor.vendor) || new Map<ApprovedDispositionGroup, number>();
    // Preserve the canonical chart's declared denominators and displayed precision.
    const base = data.mode === 'call_records' ? vendor.totalPopulation : vendor.dialledCount;
    const countRow: Record<string, any> = { vendor: vendor.vendor, totalPopulation: vendor.totalPopulation, dialledCount: vendor.dialledCount, base };
    const pctRow: Record<string, any> = { ...countRow };
    for (const group of activeGroups) {
      const count = groups.get(group) || 0;
      countRow[group] = count;
      pctRow[group] = base > 0 ? Number(((count / base) * 100).toFixed(1)) : null;
      pctRow[`${group}_count`] = count;
    }
    return { vendor: vendor.vendor, countRow, pctRow, totalVolume: base };
  });
  return { chartRows, activeGroups };
}

export function vendorSummaryExportRows(data: ContactDispositionsData): AnalysisCell[][] {
  const isCallMode = data.mode === 'call_records';
  return [
    ['Vendor', isCallMode ? 'Total Calls' : 'Total Leads', isCallMode ? 'Dialled Calls' : 'Dialled Leads',
      ...(!isCallMode ? ['Zero Call Count', 'Unrecorded Activity Count', 'Conflicting Count'] : []),
      'Recorded Dispositions', 'Missing Dispositions', 'Unmapped Dispositions',
      'Disposition Coverage %', 'Mapping Coverage %', 'RPC Count', 'Sale Count', 'Callback Count'],
    ...data.vendorSummaries.map(vendor => [vendor.vendor, vendor.totalPopulation, vendor.dialledCount,
      ...(!isCallMode ? [vendor.zeroCallCount ?? null, vendor.unrecordedActivityCount ?? null, vendor.conflictingCount ?? null] : []),
      vendor.recordedDispositionCount, vendor.missingDispositionCount, vendor.unmappedDispositionCount,
      vendor.dispositionCoveragePct === null ? null : `${vendor.dispositionCoveragePct}%`,
      vendor.mappingCoveragePct === null ? null : `${vendor.mappingCoveragePct}%`,
      vendor.rpcCount, vendor.saleCount, vendor.callbackCount]),
  ];
}

export function vendorOutcomeExportRows(data: ContactDispositionsData): AnalysisCell[][] {
  const { chartRows, activeGroups } = dispositionComparison(data);
  return [
    ['Vendor', 'Total Population', data.mode === 'call_records' ? 'Call Event Denominator' : 'Dialled Lead Denominator',
      ...activeGroups.map(group => `${APPROVED_DISPOSITION_GROUPS[group].label} Count`),
      ...activeGroups.map(group => `${APPROVED_DISPOSITION_GROUPS[group].label} %`)],
    ...chartRows.map(row => [row.vendor, row.countRow.totalPopulation, row.countRow.base,
      ...activeGroups.map(group => row.countRow[group]),
      ...activeGroups.map(group => row.pctRow[group] === null ? null : `${row.pctRow[group]}%`)]),
  ];
}
