import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Filter, Download, ExternalLink, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { useDialogAccessibility } from '../../../hooks/useDialogAccessibility';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import {
  APPROVED_DISPOSITION_GROUPS,
  presentMappingStatus,
  type ApprovedDispositionGroup,
  type DispositionReportingMode,
  type DetailedDispositionRow,
  type VendorDispositionSummaryItem,
} from '../../../../contracts/vendorDispositions';
import {
  filterDispositionRows,
  calculateGroupTotals,
} from '../model/dispositionSelection';
import { Link } from 'react-router-dom';

interface VendorOutcomeInspectorProps {
  open: boolean;
  onClose: () => void;
  vendor: string | null;
  mode: DispositionReportingMode;
  vendorSummary: VendorDispositionSummaryItem | null;
  rawRows: DetailedDispositionRow[];
  initialGroupFilter?: string;
  onGroupFilterChange?: (group: string) => void;
  onFilterReportByVendor?: (vendor: string) => void;
  onExportVendorRaw?: (vendor: string) => void;
  onExportSelectedBreakdown?: (params: {
    vendor: string;
    groupFilter: string;
    searchQuery: string;
    rows: DetailedDispositionRow[];
  }) => void;
  reportVersion?: string;
  dateBasis?: string;
  countingGrain?: string;
  evaluatedAt?: string;
  timezone?: string;
  reportContext?: {
    reportVersion?: string;
    dateBasis?: string;
    countingGrain?: string;
    evaluatedAt?: string;
    timezone?: string;
    clientId?: string;
  };
  exportError?: string | null;
  onClearExportError?: () => void;
  explorerPath?: string | { pathname: string; search: string };
}

export default function VendorOutcomeInspector({
  open,
  onClose,
  vendor,
  mode,
  vendorSummary,
  rawRows,
  initialGroupFilter = 'ALL',
  onGroupFilterChange,
  onFilterReportByVendor,
  onExportVendorRaw,
  onExportSelectedBreakdown,
  reportVersion,
  dateBasis,
  countingGrain,
  evaluatedAt,
  timezone,
  reportContext,
  exportError,
  onClearExportError,
  explorerPath,
}: VendorOutcomeInspectorProps) {
  const dialogRef = useDialogAccessibility<HTMLDivElement>(open, onClose);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState(initialGroupFilter || 'ALL');

  // Derive selection from current URL/props whenever history or external group selection changes
  useEffect(() => {
    setGroupFilter(initialGroupFilter || 'ALL');
  }, [initialGroupFilter]);

  // Reset transient search query whenever switching vendors to prevent lingering stale query
  useEffect(() => {
    setSearchQuery('');
  }, [vendor]);

  const handleGroupSelect = (newGroup: string) => {
    setGroupFilter(newGroup);
    onGroupFilterChange?.(newGroup);
  };

  const isCallMode = mode === 'call_records';

  // Effective report context derived from props
  const effectiveVersion = reportContext?.reportVersion || reportVersion;
  const effectiveDateBasis = reportContext?.dateBasis || dateBasis;
  const effectiveGrain = reportContext?.countingGrain || countingGrain;
  const effectiveEvaluatedAt = reportContext?.evaluatedAt || evaluatedAt;

  // Readable labels derived from returned grain
  const grainBadgeLabel = useMemo(() => {
    if (effectiveGrain === 'lead_vendor_pairs') return 'Lead–vendor pair grain';
    if (effectiveGrain === 'dialler_records') return 'Dialler records grain';
    if (effectiveGrain === 'call_event') return 'Call events grain';
    if (effectiveGrain) return `${effectiveGrain.replace(/_/g, ' ')} grain`;
    return isCallMode ? 'Dialler records grain' : 'Lead–vendor pair grain';
  }, [effectiveGrain, isCallMode]);

  const totalPopulationLabel = useMemo(() => {
    if (effectiveGrain === 'lead_vendor_pairs') return 'Total Lead–Vendor Pairs';
    if (effectiveGrain === 'dialler_records') return 'Total Dialler Records';
    return isCallMode ? 'Total Dialler Records' : 'Total Lead–Vendor Pairs';
  }, [effectiveGrain, isCallMode]);

  const dialledBaseLabel = useMemo(() => {
    if (effectiveGrain === 'lead_vendor_pairs') return 'Dialled Pairs (Base)';
    if (effectiveGrain === 'dialler_records') return 'Dialled Records (Base)';
    return isCallMode ? 'Dialled Records (Base)' : 'Dialled Pairs (Base)';
  }, [effectiveGrain, isCallMode]);

  // Group total counts pre-search for calculating share of group
  const groupTotals = useMemo(() => calculateGroupTotals(rawRows), [rawRows]);

  // Production filtered rows shared with export builder
  const filteredRows = useMemo(() => {
    return filterDispositionRows(rawRows, groupFilter, searchQuery);
  }, [rawRows, groupFilter, searchQuery]);

  // Available groups for dropdown
  const availableGroups = useMemo(() => {
    const set = new Set<ApprovedDispositionGroup>();
    for (const r of rawRows) {
      if (r.approvedGroup) set.add(r.approvedGroup);
    }
    return Array.from(set);
  }, [rawRows]);

  const isUnknownGroup = Boolean(
    groupFilter && groupFilter !== 'ALL' && !availableGroups.includes(groupFilter as any)
  );

  if (!open || !vendor) return null;

  // Explicit unavailable state for vendors not represented in current authorized report
  if (!vendorSummary) {
    return (
      <div
        className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendor-inspector-unavailable-title"
          className="w-full max-w-xl h-full bg-surface border-l border-border shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-200"
        >
          <div className="flex items-start justify-between pb-4 border-b border-border-subtle">
            <div>
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
                <AlertCircle size={14} />
                <span>Inspection Unavailable</span>
              </div>
              <h2 id="vendor-inspector-unavailable-title" className="text-lg font-bold text-text-main mt-1">
                Vendor Selection Unavailable
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-text-mute hover:text-text-main hover:bg-surface-subtle rounded-md transition-colors cursor-pointer"
              aria-label="Close unavailable inspection"
            >
              <X size={18} />
            </button>
          </div>

          <div className="py-6 space-y-4 flex-1">
            <div
              className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-text-main space-y-2"
              role="alert"
            >
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                The requested vendor &quot;{vendor}&quot; is not represented in the authorised report.
              </p>
              <p className="text-text-sec">
                No recorded disposition evidence exists for this vendor in the active workspace and reporting period. The inspector cannot open an unrepresented vendor or silently widen scope.
              </p>
            </div>
            <p className="text-xs text-text-mute">
              Dismiss this inspection to return to the active report summary.
            </p>
          </div>

          <div className="pt-4 border-t border-border-subtle flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-text-sec bg-surface border border-border-subtle rounded-md hover:bg-surface-subtle hover:text-text-main transition-colors cursor-pointer"
            >
              Dismiss inspection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleTriggerExport = () => {
    if (onExportSelectedBreakdown) {
      onExportSelectedBreakdown({
        vendor,
        groupFilter,
        searchQuery,
        rows: filteredRows,
      });
    } else if (onExportVendorRaw) {
      onExportVendorRaw(vendor);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-inspector-title"
        className="w-full max-w-3xl h-full bg-surface border-l border-border shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-surface-sec sticky top-0 z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary font-mono">
                  {isCallMode ? 'Call-Event Dispositions' : 'Lead-Status Dispositions'}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-surface border border-border-subtle text-text-sec">
                  {grainBadgeLabel}
                </span>
              </div>
              <h2 id="vendor-inspector-title" className="text-xl font-bold text-text-main mt-1">
                {vendor} Raw Disposition Breakdown
              </h2>
              <p className="text-xs text-text-sec mt-0.5">
                {isCallMode
                  ? 'Recorded disposition breakdown for dialler records in the selected period.'
                  : 'Recorded status breakdown for lead-vendor pairs in the selected cohort.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-text-mute hover:text-text-main hover:bg-surface rounded-md transition-colors cursor-pointer"
              aria-label="Close raw disposition inspector"
            >
              <X size={18} />
            </button>
          </div>

          {/* Metric Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <div className="p-2.5 bg-surface rounded border border-border-subtle">
              <span className="text-[10px] uppercase font-semibold text-text-mute block">
                {totalPopulationLabel}
              </span>
              <span className="text-lg font-bold text-text-main cx-tabular mt-0.5 block">
                {formatTableNumber(vendorSummary.totalPopulation)}
              </span>
            </div>

            <div className="p-2.5 bg-surface rounded border border-border-subtle">
              <span className="text-[10px] uppercase font-semibold text-text-mute block">
                {dialledBaseLabel}
              </span>
              <span className="text-lg font-bold text-text-main cx-tabular mt-0.5 block">
                {formatTableNumber(vendorSummary.dialledCount)}
              </span>
            </div>

            <div className="p-2.5 bg-surface rounded border border-border-subtle">
              <span className="text-[10px] uppercase font-semibold text-text-mute block">
                Disposition Coverage
              </span>
              <span className="text-lg font-bold text-text-main cx-tabular mt-0.5 block">
                {formatPercent(vendorSummary.dispositionCoveragePct)}
              </span>
            </div>

            <div className="p-2.5 bg-surface rounded border border-border-subtle">
              <span className="text-[10px] uppercase font-semibold text-text-mute block">
                Mapping Coverage
              </span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 cx-tabular mt-0.5 block">
                {formatPercent(vendorSummary.mappingCoveragePct)}
              </span>
            </div>
          </div>

          {/* Consumed Report Metadata Context Strip */}
          {(effectiveDateBasis || effectiveGrain || effectiveVersion || effectiveEvaluatedAt) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border-subtle text-[11px] text-text-mute font-mono">
              {effectiveDateBasis && (
                <span>
                  Date basis: <strong className="text-text-sec font-sans">{effectiveDateBasis}</strong>
                </span>
              )}
              {effectiveGrain && (
                <span>
                  Grain: <strong className="text-text-sec font-sans">{effectiveGrain}</strong>
                </span>
              )}
              {effectiveVersion && (
                <span>
                  Version: <strong className="text-text-sec font-sans">{effectiveVersion}</strong>
                </span>
              )}
              {effectiveEvaluatedAt && (
                <span>
                  Evaluated:{' '}
                  <strong className="text-text-sec font-sans">
                    {effectiveEvaluatedAt.replace('T', ' ').replace(/\..+/, '')}
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 text-sm text-text-main">
          {/* Accessible Export Error Alert */}
          {exportError && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-700 dark:text-red-400 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{exportError}</span>
              </div>
              {onClearExportError && (
                <button
                  type="button"
                  onClick={onClearExportError}
                  className="p-1 hover:bg-red-500/20 rounded cursor-pointer"
                  aria-label="Dismiss export error"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Controls: Search, Filter, Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-2.5 top-2.5 text-text-mute" />
                <input
                  type="search"
                  placeholder="Filter by raw code or description…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Filter raw dispositions"
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-text-main focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <select
                value={groupFilter}
                onChange={(e) => handleGroupSelect(e.target.value)}
                aria-label="Filter by outcome group"
                className="text-xs bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-main focus:outline-hidden focus:ring-1 focus:ring-brand-primary cursor-pointer"
              >
                <option value="ALL">All Outcome Groups</option>
                {isUnknownGroup && (
                  <option value={groupFilter} disabled>
                    {APPROVED_DISPOSITION_GROUPS[groupFilter as ApprovedDispositionGroup]?.label || groupFilter} (Not recorded)
                  </option>
                )}
                {availableGroups.map((g) => (
                  <option key={g} value={g}>
                    {APPROVED_DISPOSITION_GROUPS[g]?.label || g}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {onFilterReportByVendor && (
                <button
                  type="button"
                  onClick={() => onFilterReportByVendor(vendor)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border-subtle hover:bg-surface-subtle text-xs font-medium text-text-main rounded-lg transition-colors cursor-pointer"
                  title={`Apply global vendor filter for ${vendor}`}
                >
                  <Filter size={12} />
                  <span>Filter report by this vendor</span>
                </button>
              )}

              <button
                type="button"
                disabled={filteredRows.length === 0}
                onClick={handleTriggerExport}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  filteredRows.length === 0
                    ? 'bg-surface-subtle text-text-mute cursor-not-allowed border border-border-subtle'
                    : 'bg-brand-primary text-white hover:bg-brand-hover cursor-pointer'
                }`}
                title={
                  filteredRows.length === 0
                    ? 'No raw disposition codes match the current filter'
                    : 'Export the currently visible filtered breakdown as CSV'
                }
              >
                <Download size={12} />
                <span>Export selected breakdown</span>
              </button>
            </div>
          </div>

          {/* Unknown group notice */}
          {isUnknownGroup && (
            <div
              role="alert"
              className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>
                  {`Outcome group "${APPROVED_DISPOSITION_GROUPS[groupFilter as ApprovedDispositionGroup]?.label || groupFilter}" is not recorded for ${vendor}.`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleGroupSelect('ALL')}
                className="underline font-semibold cursor-pointer shrink-0"
              >
                Show all groups
              </button>
            </div>
          )}

          {/* Raw Codes Table - Harmonized with CSV Export */}
          <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-subtle/50 text-text-mute font-semibold">
                    <th className="px-3.5 py-2.5">Raw Code</th>
                    <th className="px-3.5 py-2.5">Description</th>
                    <th className="px-3.5 py-2.5">Outcome Group</th>
                    <th className="px-3.5 py-2.5 text-right">Volume</th>
                    <th className="px-3.5 py-2.5 text-right">Share of Group %</th>
                    <th className="px-3.5 py-2.5 text-right">Share of Vendor %</th>
                    <th className="px-3.5 py-2.5">Mapping Status</th>
                    <th className="px-3.5 py-2.5 text-right">RPC</th>
                    <th className="px-3.5 py-2.5 text-right">Sales</th>
                    <th className="px-3.5 py-2.5 text-right">Callbacks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-main">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-text-sec">
                        No raw disposition codes match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r, idx) => {
                      const groupConfig = APPROVED_DISPOSITION_GROUPS[r.approvedGroup];
                      const grpTotal = groupTotals.get(r.approvedGroup) || 0;
                      const shareOfGroup = grpTotal > 0 ? (r.count / grpTotal) * 100 : null;
                      const statusPres = presentMappingStatus(r);

                      return (
                        <tr key={`${r.rawDisposition}-${idx}`} className="hover:bg-surface-subtle/40 transition-colors">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-text-main">
                            {r.rawDisposition}
                          </td>
                          <td className="px-3.5 py-2.5 text-text-sec max-w-xs truncate" title={r.rawDescription}>
                            {r.rawDescription || '—'}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold"
                              style={{
                                backgroundColor: `${groupConfig?.color || '#94a3b8'}20`,
                                color: groupConfig?.color || '#475569',
                              }}
                            >
                              {r.approvedGroupLabel}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right cx-tabular font-bold text-text-main">
                            {formatTableNumber(r.count)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right cx-tabular font-medium text-text-sec">
                            {shareOfGroup !== null ? `${shareOfGroup.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right cx-tabular font-medium text-text-sec">
                            {r.percentOfBase !== null && r.percentOfBase !== undefined ? `${r.percentOfBase}%` : '—'}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                                statusPres.status === 'APPROVED'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : statusPres.status === 'UNMAPPED'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : statusPres.status === 'MISSING'
                                  ? 'text-red-700 dark:text-red-400'
                                  : statusPres.status === 'CONFLICTING'
                                  ? 'text-amber-600 dark:text-amber-500'
                                  : 'text-text-mute'
                              }`}
                            >
                              {statusPres.status === 'APPROVED' && <ShieldCheck size={11} />}
                              {statusPres.status === 'UNMAPPED' && <AlertCircle size={11} />}
                              {statusPres.status === 'MISSING' && <AlertCircle size={11} />}
                              {statusPres.status === 'CONFLICTING' && <AlertCircle size={11} />}
                              {statusPres.status === 'UNAVAILABLE' && <Info size={11} />}
                              <span>{statusPres.label}</span>
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right cx-tabular text-text-sec">
                            {formatTableNumber(r.rpcCount)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right cx-tabular font-semibold text-brand-primary">
                            {formatTableNumber(r.saleCount)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right cx-tabular text-text-sec">
                            {formatTableNumber(r.callbackCount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Evidence Destination & Broader Scope Navigation */}
          <div className="p-4 bg-surface-subtle/50 rounded-lg border border-border-subtle space-y-3">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-brand-primary shrink-0 mt-0.5" />
              <div className="text-xs text-text-sec">
                <span className="font-semibold text-text-main block">
                  Recorded Aggregate Raw Disposition Evidence
                </span>
                <p className="mt-0.5">
                  This raw code breakdown reflects recorded aggregate dispositions for {vendor}. Individual records are restricted by role authorization, and record-level inspection requires active vendor scope.
                </p>
              </div>
            </div>

            {explorerPath && (
              <div className="pt-2 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-text-mute">
                  To inspect records for {vendor}, first apply the vendor filter above.
                </span>

                <Link
                  to={explorerPath}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border-subtle text-text-main rounded-lg text-xs font-medium hover:bg-surface-subtle transition-colors shrink-0"
                >
                  <span>Open Broader Lead Explorer</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-sec flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-text-sec bg-surface border border-border-subtle rounded-md hover:bg-surface-subtle hover:text-text-main transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
