import React, { useState, useMemo } from 'react';
import { X, Search, Filter, Download, ExternalLink, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { useDialogAccessibility } from '../../../hooks/useDialogAccessibility';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import {
  APPROVED_DISPOSITION_GROUPS,
  type ApprovedDispositionGroup,
  type DispositionReportingMode,
  type DetailedDispositionRow,
  type VendorDispositionSummaryItem,
} from '../../../../contracts/vendorDispositions';
import { Link } from 'react-router-dom';

interface VendorOutcomeInspectorProps {
  open: boolean;
  onClose: () => void;
  vendor: string | null;
  mode: DispositionReportingMode;
  vendorSummary: VendorDispositionSummaryItem | null;
  rawRows: DetailedDispositionRow[];
  initialGroupFilter?: string;
  onFilterReportByVendor?: (vendor: string) => void;
  onExportVendorRaw?: (vendor: string) => void;
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
  onFilterReportByVendor,
  onExportVendorRaw,
  explorerPath,
}: VendorOutcomeInspectorProps) {
  const dialogRef = useDialogAccessibility<HTMLDivElement>(open, onClose);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState(initialGroupFilter);

  const isCallMode = mode === 'call_records';

  const filteredRows = useMemo(() => {
    let list = [...rawRows];
    if (groupFilter !== 'ALL') {
      list = list.filter((r) => r.approvedGroup === groupFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.rawDisposition.toLowerCase().includes(q) ||
          (r.rawDescription && r.rawDescription.toLowerCase().includes(q)) ||
          r.approvedGroupLabel.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rawRows, groupFilter, searchQuery]);

  // Available groups for dropdown
  const availableGroups = useMemo(() => {
    const set = new Set<ApprovedDispositionGroup>();
    for (const r of rawRows) {
      if (r.approvedGroup) set.add(r.approvedGroup);
    }
    return Array.from(set);
  }, [rawRows]);

  if (!open || !vendor || !vendorSummary) return null;

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
                  {isCallMode ? 'Call events grain' : 'Lead–vendor pair grain'}
                </span>
              </div>
              <h2 id="vendor-inspector-title" className="text-xl font-bold text-text-main mt-1">
                {vendor} Raw Disposition Breakdown
              </h2>
              <p className="text-xs text-text-sec mt-0.5">
                {isCallMode
                  ? 'All verified call disposition codes recorded during the selected period.'
                  : 'Latest recorded status for leads delivered to this vendor in the capture cohort.'}
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
                {isCallMode ? 'Total Calls' : 'Total Leads'}
              </span>
              <span className="text-lg font-bold text-text-main cx-tabular mt-0.5 block">
                {formatTableNumber(vendorSummary.totalPopulation)}
              </span>
            </div>

            <div className="p-2.5 bg-surface rounded border border-border-subtle">
              <span className="text-[10px] uppercase font-semibold text-text-mute block">
                {isCallMode ? 'Dialled Attempts' : 'Dialled Leads (Base)'}
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
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 text-sm text-text-main">
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
                onChange={(e) => setGroupFilter(e.target.value)}
                aria-label="Filter by outcome group"
                className="text-xs bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-main focus:outline-hidden focus:ring-1 focus:ring-brand-primary cursor-pointer"
              >
                <option value="ALL">All Outcome Groups</option>
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

              {onExportVendorRaw && (
                <button
                  type="button"
                  onClick={() => onExportVendorRaw(vendor)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white hover:bg-brand-hover text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Download size={12} />
                  <span>Export raw CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* Raw Codes Table */}
          <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-subtle/50 text-text-mute font-semibold">
                    <th className="px-3.5 py-2.5">Raw Code</th>
                    <th className="px-3.5 py-2.5">Description</th>
                    <th className="px-3.5 py-2.5">Outcome Group</th>
                    <th className="px-3.5 py-2.5 text-right">Count</th>
                    <th className="px-3.5 py-2.5 text-right">% of Base</th>
                    <th className="px-3.5 py-2.5">Mapping Status</th>
                    <th className="px-3.5 py-2.5 text-right">RPC</th>
                    <th className="px-3.5 py-2.5 text-right">Sales</th>
                    <th className="px-3.5 py-2.5 text-right">Callbacks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-main">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-text-sec">
                        No raw disposition codes match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r, idx) => {
                      const groupConfig = APPROVED_DISPOSITION_GROUPS[r.approvedGroup];
                      const isUnmapped = r.isUnmapped || r.approvedGroup === 'UNMAPPED';

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
                            {r.percentOfBase !== null ? `${r.percentOfBase}%` : '—'}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {isUnmapped ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                <AlertCircle size={11} />
                                Unmapped
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                <ShieldCheck size={11} />
                                Approved
                              </span>
                            )}
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

          {/* Lead Explorer Link for lead_status mode */}
          {!isCallMode && explorerPath && (
            <div className="p-4 bg-surface-subtle/50 rounded-lg border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-text-main block">
                  Inspect Supporting Lead Records
                </span>
                <p className="text-xs text-text-sec mt-0.5">
                  Inspect individual lead records for {vendor} in Lead Explorer with current scope preserved.
                </p>
              </div>

              <Link
                to={explorerPath}
                onClick={onClose}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-semibold hover:bg-brand-hover transition-colors shrink-0"
              >
                <span>Open Lead Explorer</span>
                <ExternalLink size={13} />
              </Link>
            </div>
          )}
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
