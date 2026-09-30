import React, { useState, useMemo } from 'react';
import type { AuditScope } from '../../../shared/evidence/auditPresentation';
import type { InspectorContent } from '../../../shared/evidence/InspectorHost';
import {
  Download,
  Filter,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Search,
  ExternalLink,
  ShieldCheck,
  PhoneCall,
  Layers,
  AlertCircle,
  X,
} from 'lucide-react';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import { HorizontalStackedOutcomeChart } from '../../../components/charts/OperationalVisuals';
import UnifiedMetricCard from '../../../components/UnifiedMetricCard';
import {
  APPROVED_DISPOSITION_GROUPS,
  type ApprovedDispositionGroup,
  type DispositionReportingMode,
  type ContactDispositionsData,
  type VendorDispositionSummaryItem,
} from '../../../../contracts/vendorDispositions';

interface VendorDispositionReportProps {
  data?: ContactDispositionsData;
  scope?: AuditScope;
  mode: DispositionReportingMode;
  onModeChange: (mode: DispositionReportingMode) => void;
  onSelectVendor: (vendor: string, group?: string) => void;
  onFilterReportByVendor?: (vendor: string) => void;
  onWhyChanged?: (metric: string) => void;
  onExportSummaryTable?: () => void;
  onExportOutcomeComparison?: () => void;
  exportError?: string | null;
  onClearExportError?: () => void;
}

const OUTCOME_GROUPS_ORDER: ApprovedDispositionGroup[] = [
  'REPORTED_SALE',
  'CONTACTED_RPC',
  'CALLBACK_REQUESTED',
  'NOT_INTERESTED',
  'NO_ANSWER',
  'BUSY',
  'VOICEMAIL',
  'INVALID_WRONG_NUMBER',
  'DO_NOT_CONTACT',
  'TECHNICAL_FAILURE',
  'OTHER',
  'UNMAPPED',
  'MISSING_DISPOSITION',
  'CONFLICTING_EVIDENCE',
];

export default function VendorDispositionReport({
  data,
  scope,
  mode,
  onModeChange,
  onSelectVendor,
  onFilterReportByVendor,
  onWhyChanged,
  onExportSummaryTable,
  onExportOutcomeComparison,
  exportError,
  onClearExportError,
}: VendorDispositionReportProps) {
  const [chartViewMode, setChartViewMode] = useState<'count' | 'percent'>('percent');
  const [showAllVendors, setShowAllVendors] = useState(false);
  const [sortKey, setSortKey] = useState<string>('totalPopulation');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [tableSearch, setTableSearch] = useState('');

  const isCallMode = mode === 'call_records';

  // Group breakdown by vendor + approvedGroup for Horizontal Stacked Bar Chart
  const { chartRows, activeGroups } = useMemo(() => {
    if (!data?.vendorSummaries || !data?.breakdown) {
      return { chartRows: [], activeGroups: [] };
    }

    const vendorGroupTotals = new Map<string, Map<ApprovedDispositionGroup, number>>();
    const presentGroupsSet = new Set<ApprovedDispositionGroup>();

    for (const row of data.breakdown) {
      if (!vendorGroupTotals.has(row.vendor)) {
        vendorGroupTotals.set(row.vendor, new Map());
      }
      const groupMap = vendorGroupTotals.get(row.vendor)!;
      const current = groupMap.get(row.approvedGroup) || 0;
      groupMap.set(row.approvedGroup, current + row.count);
      presentGroupsSet.add(row.approvedGroup);
    }

    const activeGroupsList = OUTCOME_GROUPS_ORDER.filter((g) => presentGroupsSet.has(g));

    const rows = data.vendorSummaries.map((v) => {
      const groupMap = vendorGroupTotals.get(v.vendor) || new Map();
      // Enforce contracted denominator:
      // In call_records mode: total call events is the denominator
      // In lead_status mode: dialled leads is the denominator. If dialledCount is 0, base is 0 (unavailable percentage)
      const base = isCallMode ? v.totalPopulation : v.dialledCount;
      const countRow: Record<string, any> = {
        vendor: v.vendor,
        totalPopulation: v.totalPopulation,
        dialledCount: v.dialledCount,
        base,
      };
      const pctRow: Record<string, any> = {
        vendor: v.vendor,
        totalPopulation: v.totalPopulation,
        dialledCount: v.dialledCount,
        base,
      };

      for (const g of activeGroupsList) {
        const cnt = groupMap.get(g) || 0;
        countRow[g] = cnt;
        pctRow[g] = base > 0 ? Number(((cnt / base) * 100).toFixed(1)) : 0;
        pctRow[`${g}_count`] = cnt;
      }

      return {
        countRow,
        pctRow,
        totalVolume: isCallMode ? v.totalPopulation : v.dialledCount,
        vendor: v.vendor,
      };
    });

    return { chartRows: rows, activeGroups: activeGroupsList };
  }, [data, isCallMode]);

  // Displayed chart rows with Top-N limit
  const displayedChartRows = useMemo(() => {
    const sorted = [...chartRows].sort((a, b) => b.totalVolume - a.totalVolume);
    const slice = showAllVendors || sorted.length <= 8 ? sorted : sorted.slice(0, 8);
    return slice.map((item) => (chartViewMode === 'percent' ? item.pctRow : item.countRow));
  }, [chartRows, showAllVendors, chartViewMode]);

  // Sortable & Filtered Table rows
  const sortedVendorSummaries = useMemo(() => {
    if (!data?.vendorSummaries) return [];
    let list = [...data.vendorSummaries];
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((v) => v.vendor.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let aVal: any = a[sortKey as keyof typeof a];
      let bVal: any = b[sortKey as keyof typeof b];
      if (sortKey === 'vendor') {
        aVal = a.vendor.toLowerCase();
        bVal = b.vendor.toLowerCase();
      }
      if (aVal === null || aVal === undefined) return sortDir === 'asc' ? -1 : 1;
      if (bVal === null || bVal === undefined) return sortDir === 'asc' ? 1 : -1;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [data?.vendorSummaries, sortKey, sortDir, tableSearch]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (!data) return null;

  const summary = data.summary;
  const audit = (title: string, value: string): InspectorContent => ({ type: 'metric', title, value, scope,
    definition: { meaning: `${title} in ${data.modeHeading}. ${data.modeDescription}`, grain: data.countingGrain, dateBasis: data.dateBasis, calculation: data.methodology },
    provenance: { reportVersion: data.reportVersion, evaluatedAt: data.evaluatedAt, dateBasis: data.dateBasis, countingGrain: data.countingGrain, timezone: data.timezone },
    detailLimitation: 'Vendor outcome evidence is available in the report below. This aggregate does not supply an exact supporting-record drill.',
  });

  return (
    <div className="space-y-6">
      {/* 1. Mode Header & Mode Switcher */}
      <div className="bg-surface rounded-xl border border-border-subtle p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
              Reporting Mode
            </span>
            <span className="text-text-muted" aria-hidden="true">·</span>
            <span className="text-[11px] text-text-sec font-medium">
              {data.countingGrain} grain · {data.dateBasis}
            </span>
          </div>
          <h2 className="text-lg font-bold text-text-main mt-1">
            {data.modeHeading}
          </h2>
          <p className="text-xs text-text-sec mt-0.5">
            {data.modeDescription}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-border-subtle p-0.5 bg-surface text-xs font-medium shrink-0">
          <button
            type="button"
            onClick={() => onModeChange('lead_status')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              !isCallMode
                ? 'bg-brand-primary text-white shadow-2xs font-semibold'
                : 'text-text-sec hover:text-text-main'
            }`}
          >
            Lead Status (Cohort)
          </button>
          <button
            type="button"
            onClick={() => onModeChange('call_records')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              isCallMode
                ? 'bg-brand-primary text-white shadow-2xs font-semibold'
                : 'text-text-sec hover:text-text-main'
            }`}
          >
            Call Records (Events)
          </button>
        </div>
      </div>

      {/* 2. Summary KPI Cards */}
      <section aria-label="Disposition summary statistics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <UnifiedMetricCard
          label={isCallMode ? 'Total Calls' : 'Total Population'}
          auditContent={audit(isCallMode ? 'Total Calls' : 'Total Population', formatTableNumber(summary.totalEntities))}
          value={formatTableNumber(summary.totalEntities)}
          note={isCallMode ? 'Observed call events' : 'Delivered cohort leads'}
          onInspect={() => onSelectVendor('ALL')}
          inspectLabel="Inspect all"
        />

        <UnifiedMetricCard
          label={isCallMode ? 'Dialled Calls' : 'Dialled Leads'}
          auditContent={audit(isCallMode ? 'Dialled Calls' : 'Dialled Leads', formatTableNumber(summary.dialledEntities))}
          value={formatTableNumber(summary.dialledEntities)}
          note="Denominator base"
          onInspect={() => onSelectVendor('ALL')}
          inspectLabel="Inspect all"
        />

        <UnifiedMetricCard
          label="Disposition Coverage"
          auditContent={audit('Disposition Coverage', formatPercent(summary.dispositionCoveragePct))}
          value={formatPercent(summary.dispositionCoveragePct)}
          note={`${formatTableNumber(summary.missingDispositions)} missing`}
          onInspect={() => onSelectVendor('ALL')}
          inspectLabel="Inspect all"
        />

        <UnifiedMetricCard
          label="Mapping Coverage"
          auditContent={audit('Mapping Coverage', formatPercent(summary.mappingCoveragePct))}
          value={formatPercent(summary.mappingCoveragePct)}
          note={`${formatTableNumber(summary.unmappedDispositions)} unmapped`}
          onInspect={() => onSelectVendor('ALL')}
          inspectLabel="Inspect all"
        />
      </section>

      {/* 3. Horizontal Stacked Bar Chart */}
      <div className="bg-surface rounded-xl border border-border-subtle p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
          <div>
            <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider">
              Standardized Vendor Outcome Comparison
            </h3>
            <p className="text-xs text-text-sec mt-0.5">
              Standardized outcome composition across authorized vendors.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Count / Percent toggle */}
            <div className="inline-flex rounded-lg border border-border-subtle p-0.5 bg-surface-sec text-xs font-medium">
              <button
                type="button"
                onClick={() => setChartViewMode('percent')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  chartViewMode === 'percent'
                    ? 'bg-surface text-text-main shadow-2xs font-semibold'
                    : 'text-text-mute hover:text-text-main'
                }`}
              >
                % Share
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('count')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  chartViewMode === 'count'
                    ? 'bg-surface text-text-main shadow-2xs font-semibold'
                    : 'text-text-mute hover:text-text-main'
                }`}
              >
                Exact Counts
              </button>
            </div>

            {/* Export Outcome Comparison */}
            {onExportOutcomeComparison && (
              <button
                type="button"
                onClick={onExportOutcomeComparison}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface border border-border-subtle rounded-lg text-xs font-medium text-text-sec hover:text-text-main transition-colors cursor-pointer"
                title="Export outcome comparison CSV"
              >
                <Download size={12} />
                <span>Export visual</span>
              </button>
            )}
          </div>
        </div>

        <HorizontalStackedOutcomeChart
          data={displayedChartRows}
          categoryKey="vendor"
          series={activeGroups.map((g) => ({
            key: g,
            label: APPROVED_DISPOSITION_GROUPS[g]?.label || g,
            color: APPROVED_DISPOSITION_GROUPS[g]?.color || '#94a3b8',
          }))}
          isPercent={chartViewMode === 'percent'}
          onSelect={(vendor, group) => onSelectVendor(vendor, group)}
          tooltipBaseLabel={isCallMode ? 'Total calls' : 'Dialled leads'}
        />

        {chartRows.length > 8 && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowAllVendors((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs text-brand-primary hover:underline font-medium cursor-pointer"
            >
              {showAllVendors ? (
                <>
                  <span>Show top 8 vendors only</span>
                  <ChevronUp size={13} />
                </>
              ) : (
                <>
                  <span>Show all {chartRows.length} vendors</span>
                  <ChevronDown size={13} />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Accessible Export Error Feedback */}
      {exportError && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-700 dark:text-red-400 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{exportError}</span>
          </div>
          {onClearExportError && (
            <button
              type="button"
              onClick={onClearExportError}
              className="p-1 hover:bg-red-500/20 rounded cursor-pointer"
              aria-label="Dismiss export error"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* 4. Sortable Vendor Disposition Table */}
      <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
        <div className="p-4 border-b border-border-subtle bg-surface-sec flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider">
              Vendor Disposition Performance
            </h3>
            <p className="text-xs text-text-sec mt-0.5">
              Sort and inspect individual vendor coverage and raw disposition codes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-text-mute" />
              <input
                type="search"
                placeholder="Search vendor…"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                aria-label="Search vendor summaries"
                className="text-xs pl-8 pr-3 py-1.5 bg-surface border border-border-subtle rounded-lg w-36 sm:w-44 focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {onExportSummaryTable && (
              <button
                type="button"
                onClick={onExportSummaryTable}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-xs font-medium text-text-main hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>Export table</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-subtle/40 text-text-mute font-semibold">
                <th
                  onClick={() => handleSort('vendor')}
                  className="px-4 py-2.5 cursor-pointer hover:text-text-main transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Vendor</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalPopulation')}
                  className="px-4 py-2.5 text-right cursor-pointer hover:text-text-main transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>{isCallMode ? 'Total Calls' : 'Total Population'}</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('dialledCount')}
                  className="px-4 py-2.5 text-right cursor-pointer hover:text-text-main transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>{isCallMode ? 'Dialled Attempts' : 'Dialled Base'}</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('dispositionCoveragePct')}
                  className="px-4 py-2.5 text-right cursor-pointer hover:text-text-main transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Disposition Cov %</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('mappingCoveragePct')}
                  className="px-4 py-2.5 text-right cursor-pointer hover:text-text-main transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Mapping Cov %</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('rpcCount')}
                  className="px-4 py-2.5 text-right cursor-pointer hover:text-text-main transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>RPC Count</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('saleCount')}
                  className="px-4 py-2.5 text-right cursor-pointer hover:text-text-main transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Sale Count</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('callbackCount')}
                  className="px-4 py-2.5 text-right cursor-pointer hover:text-text-main transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Callbacks</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-main">
              {sortedVendorSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-text-sec">
                    No vendors found matching the current search.
                  </td>
                </tr>
              ) : (
                sortedVendorSummaries.map((v) => (
                  <tr key={v.vendor} className="hover:bg-surface-subtle/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-text-main">
                      {v.vendor}
                    </td>
                    <td className="px-4 py-3 text-right cx-tabular font-medium">
                      {formatTableNumber(v.totalPopulation)}
                    </td>
                    <td className="px-4 py-3 text-right cx-tabular font-medium">
                      {formatTableNumber(v.dialledCount)}
                    </td>
                    <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                      {formatPercent(v.dispositionCoveragePct)}
                    </td>
                    <td className="px-4 py-3 text-right cx-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatPercent(v.mappingCoveragePct)}
                    </td>
                    <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                      {formatTableNumber(v.rpcCount)}
                    </td>
                    <td className="px-4 py-3 text-right cx-tabular font-bold text-brand-primary">
                      {formatTableNumber(v.saleCount)}
                    </td>
                    <td className="px-4 py-3 text-right cx-tabular text-text-sec">
                      {formatTableNumber(v.callbackCount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectVendor(v.vendor)}
                          className="px-2.5 py-1 text-[11px] font-medium text-brand-primary hover:bg-brand-soft rounded transition-colors cursor-pointer"
                        >
                          Inspect raw codes
                        </button>
                        {onFilterReportByVendor && (
                          <button
                            type="button"
                            onClick={() => onFilterReportByVendor(v.vendor)}
                            className="p-1 text-text-mute hover:text-text-main hover:bg-surface rounded transition-colors cursor-pointer"
                            title={`Filter report by ${v.vendor}`}
                          >
                            <Filter size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
