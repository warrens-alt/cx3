import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { OffernetFilterBar } from '../components/OffernetFilterBar';
import { useClient } from '../lib/ClientContext';
import { extractOffernetFilters, useFilters } from '../lib/FilterContext';
import { fetchRawLeads, type RawLeadsData } from '../lib/offernetClient';
import { useOperationalData } from '../lib/useOperationalData';
import { LeadTimelineModal } from '../components/LeadTimelineModal';
import { downloadCsv, formatTableCurrency, formatTableNumber } from '../lib/formatters';
import { buildLeadLedgerExport } from '../lib/leadLedgerExport';
import { ledgerValidation, ledgerOutcome, ledgerCalls } from '../lib/leadLedgerValues';

export default function LeadLedger() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const queryParams = useMemo(() => ({
    clientId: selectedClient,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...extractOffernetFilters(filters),
    limit: pageSize,
    offset: page * pageSize,
    search: appliedSearch || undefined,
  }), [selectedClient, startDate, endDate, filters, pageSize, page, appliedSearch]);

  const { data, loading, error, loadData } = useOperationalData<RawLeadsData>(
    'LeadLedger',
    queryParams,
    fetchRawLeads
  );

  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentRows = data?.rows || [];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setAppliedSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(0);
  };

  const handleCopyLeadId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportCsv = () => {
    setExportError(null);
    if (loading || error || !data || !currentRows.length) return;
    try {
      // The result, not the currently selected controls, owns export scope and page metadata.
      const exported = buildLeadLedgerExport(data);
      downloadCsv(exported.filename, exported.rows);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'The current evidence page could not be exported.');
    }
  };

  const startRecord = totalCount > 0 ? page * pageSize + 1 : 0;
  const endRecord = Math.min((page + 1) * pageSize, totalCount);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <OffernetFilterBar onRefresh={() => loadData(true)} />
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-[var(--cx-action)]" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Lead Ledger</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[var(--cx-action)] border border-blue-200">
                Operational Ledger
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tenant-scoped analytical records with bounded pagination. Missing evidence remains unavailable; source reconciliation is not implied.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || Boolean(error) || !currentRows.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Download size={13} />
              <span>Export Page CSV</span>
            </button>
          </div>
        </div>

        {/* Security & Access Protection Notice */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-950 flex items-start gap-2.5">
          <ShieldCheck size={16} className="text-[#315BCB] mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-semibold">Tenant-Governed Lead Verification:</span> Rows are fetched through authorized analytical queries bound to the active tenant (<span className="font-mono font-medium">{selectedClient}</span>). Unbounded browsing and arbitrary SQL are forbidden.
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {exportError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
            <span>{exportError}</span>
            <button type="button" onClick={() => setExportError(null)} className="ml-auto" aria-label="Dismiss export error"><X size={16} /></button>
          </div>
        )}
        <p className="text-xs text-slate-500">Page exports retain the 17 Ledger columns and append reporting-scope and page audit fields. Unavailable is not zero, false, or an invalid validation result.</p>

        {/* Search & Navigation Bar */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search lead ID, consumer ID, vendor, source…"
                className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-[var(--cx-action)] focus:border-[var(--cx-action)] bg-slate-50/50"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[var(--cx-action)] hover:bg-[var(--cx-action-hover)] rounded-md transition-colors shadow-xs"
            >
              Search
            </button>
          </form>

          {/* Record Count & Pagination Controls */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <div className="font-medium">
              Showing <span className="font-mono font-semibold text-slate-900">{formatTableNumber(startRecord)}</span>–<span className="font-mono font-semibold text-slate-900">{formatTableNumber(endRecord)}</span> of <span className="font-mono font-semibold text-slate-900">{formatTableNumber(totalCount)}</span>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white text-slate-800 font-medium"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
              <button
                type="button"
                onClick={() => setPage(0)}
                disabled={page === 0 || loading}
                title="First Page"
                className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronsLeft size={15} />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                title="Previous Page"
                className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="px-2 py-0.5 font-medium text-slate-800">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
                title="Next Page"
                className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1 || loading}
                title="Last Page"
                className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronsRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Table Container */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[680px]">
            <table className="w-full text-left border-collapse enterprise-table">
              <thead className="sticky top-0 bg-slate-50/95 border-b border-slate-200 text-xs font-semibold text-slate-700 tracking-normal z-10">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">Lead ID</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">Consumer ID</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">Fetched Date</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">Source</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">Vendor</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">Grade</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">Vetting</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">ID Valid</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">Phone Valid</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 text-center">Dialled</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 text-center">RPC</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 text-right">Calls</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700">Last Status</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 text-center">Sale</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 text-center">Active</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 text-right">Revenue</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-700 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px] leading-[1.45]">
                {loading && !currentRows.length ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-16 text-center text-slate-500 font-sans">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw size={18} className="animate-spin text-[var(--cx-action)]" />
                        <span>Loading lead records…</span>
                      </div>
                    </td>
                  </tr>
                ) : !currentRows.length ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-12 text-center text-slate-500 font-sans">
                      No records match the selected scope and filters.
                    </td>
                  </tr>
                ) : (
                  currentRows.map((row, idx) => {
                    const leadId = String(row.lead_id || '');
                    const isCopied = copiedId === leadId;
                    const idValidation = ledgerValidation(row.valid_idno);
                    const phoneValidation = ledgerValidation(row.phone_valid);
                    const vetting = String(row.vetting || row.offershop_color_vetting || '').toLowerCase();
                    const vettingBadgeClass = vetting.includes('green')
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : vetting.includes('amber')
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : vetting.includes('red')
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200';

                    return (
                      <tr key={leadId || idx} className="hover:bg-blue-50/30 transition-colors">
                        {/* Lead ID */}
                        <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedLeadId(leadId)}
                              className="text-[var(--cx-action)] hover:underline font-mono text-left cursor-pointer"
                              title="Inspect lead timeline"
                            >
                              {leadId || '—'}
                            </button>
                            {leadId && (
                              <button
                                type="button"
                                onClick={e => handleCopyLeadId(leadId, e)}
                                className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                                title="Copy Lead ID"
                              >
                                {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Consumer ID */}
                        <td className="py-2 px-3 text-slate-700 whitespace-nowrap font-mono">
                          {row.consumer_id ?? '—'}
                        </td>

                        {/* Fetched */}
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap font-mono text-xs">
                          {row.fetched ? String(row.fetched).replace('T', ' ').replace('Z', '') : '—'}
                        </td>

                        {/* Source */}
                        <td className="py-2 px-3 text-slate-700 max-w-[140px] truncate" title={row.source || row.offershop_source}>
                          {row.source || row.offershop_source || '—'}
                        </td>

                        {/* Vendor */}
                        <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">
                            {row.vendor || '—'}
                          </span>
                        </td>

                        {/* Grade */}
                        <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                          {row.grade || row.offershop_grade || '—'}
                        </td>

                        {/* Vetting */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium border ${vettingBadgeClass}`}>
                            {row.vetting || row.offershop_color_vetting || 'Unvetted'}
                          </span>
                        </td>

                        {/* ID Valid (1 vs 2) */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          {idValidation}
                        </td>

                        {/* Phone Valid (1 vs 2) */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          {phoneValidation}
                        </td>

                        {/* Dialled */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {ledgerOutcome(row.dialled) === 'TRUE' ? 'Yes' : ledgerOutcome(row.dialled) === 'FALSE' ? 'No' : 'Unavailable'}
                        </td>

                        {/* Contacted / RPC */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {ledgerOutcome(row.contacted) === 'TRUE' ? 'Yes' : ledgerOutcome(row.contacted) === 'FALSE' ? 'No' : 'Unavailable'}
                        </td>

                        {/* Calls */}
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {ledgerCalls(row.total_calls)}
                        </td>

                        {/* Last Status */}
                        <td className="py-2 px-3 text-slate-600 max-w-[120px] truncate" title={row.last_dialer_status}>
                          {row.last_dialer_status || '—'}
                        </td>

                        {/* Sale */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {ledgerOutcome(row.sale) === 'TRUE' ? 'Yes' : ledgerOutcome(row.sale) === 'FALSE' ? 'No' : 'Unavailable'}
                        </td>

                        {/* Activated */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {ledgerOutcome(row.activated) === 'TRUE' ? 'Yes' : ledgerOutcome(row.activated) === 'FALSE' ? 'No' : 'Unavailable'}
                        </td>

                        {/* Revenue */}
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {row.revenue != null ? formatTableCurrency(Number(row.revenue), 'R') : '—'}
                        </td>

                        {/* Action: Inspect */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedLeadId(leadId)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-[var(--cx-action)] hover:text-white transition-colors"
                            title="Inspect Lead Timeline"
                          >
                            <Eye size={11} />
                            <span>Timeline</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Pagination Bar */}
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing records <span className="font-semibold text-slate-900">{formatTableNumber(startRecord)}</span> to <span className="font-semibold text-slate-900">{formatTableNumber(endRecord)}</span> of <span className="font-semibold text-slate-900">{formatTableNumber(totalCount)}</span>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setPage(0)}
                disabled={page === 0 || loading}
                className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium flex items-center gap-1"
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>
              <span className="px-2 font-medium">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1 || loading}
                className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium"
              >
                Last
              </button>
            </div>
          </div>
        </div>

        {/* Lead Timeline Modal */}
        {selectedLeadId && (
          <LeadTimelineModal
            leadId={selectedLeadId}
            onClose={() => setSelectedLeadId(null)}
          />
        )}
      </div>
    </div>
  );
}
