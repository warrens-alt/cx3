import React from 'react';
import { Search, X, ArrowUpDown, Filter } from 'lucide-react';
import type { CliPerformanceRecord } from '../../../contracts/cliPerformance';
import { exactNumber } from '../../../contracts/format';

interface CliRecordsTableProps {
  paginatedRecords: CliPerformanceRecord[];
  searchCli: string;
  setSearchCli: (q: string) => void;
  selectedCampaign: string;
  setSelectedCampaign: (c: string) => void;
  selectedVendor: string;
  campaignOptions: string[];
  vendorOptions: string[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  handleSort: (field: string) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  totalFiltered: number;
  onVendorChange: (vendor: string) => void;
}

export const CliRecordsTable: React.FC<CliRecordsTableProps> = ({
  paginatedRecords,
  searchCli,
  setSearchCli,
  selectedCampaign,
  setSelectedCampaign,
  selectedVendor,
  campaignOptions,
  vendorOptions,
  sortField,
  sortDirection,
  handleSort,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  totalPages,
  totalFiltered,
  onVendorChange,
}) => {
  return (
    <section aria-label="CLI Performance Records" className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
      {/* Table Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[260px]">
          {/* CLI Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchCli}
              onChange={e => {
                setSearchCli(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search CLI number or campaign…"
              className="w-full text-xs pl-8 pr-7 py-1.5 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#3562B3]"
            />
            {searchCli && (
              <button
                type="button"
                onClick={() => setSearchCli('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Campaign Filter */}
          {campaignOptions.length > 1 && (
            <select
              value={selectedCampaign}
              onChange={e => {
                setSelectedCampaign(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 text-slate-700 min-h-[34px] max-w-full"
            >
              <option value="all">All Campaigns ({campaignOptions.length})</option>
              {campaignOptions.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {/* Vendor Filter */}
          {vendorOptions.length > 1 && (
            <select
              value={selectedVendor}
              onChange={e => onVendorChange(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 text-slate-700 min-h-[34px] max-w-full"
            >
              <option value="all">All Vendors ({vendorOptions.length})</option>
              {vendorOptions.map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto" role="region" aria-label="CLI performance records" tabIndex={0}>
        <table className="enterprise-table w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <th
                scope="col"
                onClick={() => handleSort('cli')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-left font-semibold"
              >
                <div className="flex items-center gap-1">
                  <span>CLI Number</span>
                  <ArrowUpDown size={11} className={sortField === 'cli' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('campaign')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-left font-semibold"
              >
                <div className="flex items-center gap-1">
                  <span>Campaign</span>
                  <ArrowUpDown size={11} className={sortField === 'campaign' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('totalCalls')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Total Calls</span>
                  <ArrowUpDown size={11} className={sortField === 'totalCalls' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('distinctLeads')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Dialed Leads</span>
                  <ArrowUpDown size={11} className={sortField === 'distinctLeads' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('asrRate')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>ASR %</span>
                  <ArrowUpDown size={11} className={sortField === 'asrRate' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('answeredRate')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Answer %</span>
                  <ArrowUpDown size={11} className={sortField === 'answeredRate' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('contactRate')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold text-[#315EAD]"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>RPC %</span>
                  <ArrowUpDown size={11} className={sortField === 'contactRate' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('saleCount')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold text-emerald-800"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Sales</span>
                  <ArrowUpDown size={11} className={sortField === 'saleCount' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('salePerCallRate')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold text-emerald-800"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Sale/Call %</span>
                  <ArrowUpDown size={11} className={sortField === 'salePerCallRate' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('salePerContactRate')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Sale/RPC %</span>
                  <ArrowUpDown size={11} className={sortField === 'salePerContactRate' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('durationGe5mPct')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>&gt;= 5m %</span>
                  <ArrowUpDown size={11} className={sortField === 'durationGe5mPct' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('avgDurationSeconds')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Avg Sec</span>
                  <ArrowUpDown size={11} className={sortField === 'avgDurationSeconds' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
              <th
                scope="col"
                onClick={() => handleSort('avgLeadAgeDays')}
                className="cursor-pointer hover:bg-slate-100 px-3 py-2 text-right font-semibold"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Lead Age</span>
                  <ArrowUpDown size={11} className={sortField === 'avgLeadAgeDays' ? 'text-[#3562B3]' : 'text-slate-300'} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRecords.map(r => (
              <tr key={r.cli} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2.5 font-mono font-medium text-slate-900">
                  <div className="flex items-center gap-1.5">
                    <span>{r.cli}</span>
                    {r.hasAnomalies && (
                      <span
                        title={r.anomalies.join('; ')}
                        className="bg-amber-100 text-amber-800 text-[10px] px-1 rounded font-sans cursor-help"
                      >
                        Flag
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-slate-600 max-w-[160px] truncate" title={r.campaign}>
                  {r.campaign}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-800">
                  {exactNumber(r.totalCalls)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                  {exactNumber(r.distinctLeads)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                  {r.asrRate ? `${r.asrRate}%` : <span className="text-slate-400">N/A</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                  {r.answeredRate ? `${r.answeredRate}%` : <span className="text-slate-400">N/A</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#315EAD]">
                  {r.contactRate === null ? 'Unavailable' : `${r.contactRate}%`}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-800">
                  {exactNumber(r.saleCount)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-800">
                  {r.salePerCallRate === null ? 'Unavailable' : `${r.salePerCallRate}%`}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                  {r.salePerContactRate ? `${r.salePerContactRate}%` : <span className="text-slate-400">N/A</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                  {r.durationGe5mPct === null ? 'Unavailable' : `${r.durationGe5mPct}%`}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                  {r.avgDurationSeconds === null ? 'Unavailable' : `${r.avgDurationSeconds}s`}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                  {r.avgLeadAgeDays ? `${r.avgLeadAgeDays}d` : <span className="text-slate-400">N/A</span>}
                </td>
              </tr>
            ))}

            {!paginatedRecords.length && (
              <tr>
                <td colSpan={13} className="text-center py-8 text-slate-400 text-xs">
                  No CLI records match the current filter selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalFiltered > 0 && (
        <div className="flex items-center justify-between pt-3 text-xs text-slate-500 border-t border-slate-100 flex-wrap gap-2">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, totalFiltered)} of {totalFiltered} CLIs
          </div>
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-slate-200 rounded px-1.5 py-1 text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="cx-button-secondary text-xs py-1 px-2.5 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-2 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="cx-button-secondary text-xs py-1 px-2.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
