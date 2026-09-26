import { VisualTable } from './visuals/DataVisual';
import React, { useState } from 'react';
import { formatTableNumber } from '../lib/formatters';
import { X, Download, Table as TableIcon } from 'lucide-react';
import { useClient } from '../lib/ClientContext';
import { useFilters } from '../lib/FilterContext';
import { useAnalyticsData } from '../lib/useAnalyticsData';
import { recordsCsv, saveBlob } from '../lib/analyticsRequest';
import { DataState } from './DataState';
import Modal from './Modal';
import { useAuth } from '../lib/AuthContext';

interface DataAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  defaultGrain?: string;
  contextFilters?: Record<string, any>;
}

function columnGroup(key: string): string {
  const hlc = key.match(/^hlc_(\d+)_/);
  if (hlc) return `HLC ${hlc[1]}`;
  if (['lead_id', 'consumer_id', 'capture_date', 'capture_timestamp', 'source', 'medium'].includes(key)) return 'Lead';
  if (['valid_lead', 'valid_idno', 'phone_valid', 'grade', 'vetting', 'sentinel_capture'].includes(key)) return 'Quality';
  if (['has_delivery', 'has_call', 'has_rpc', 'has_sale', 'has_activation', 'total_calls', 'first_call_timestamp', 'last_call_timestamp', 'total_revenue'].includes(key)) return 'Outcomes';
  if (key.startsWith('report_')) return 'Reporting context';
  return 'Other';
}

export default function DataAuditDrawer({ isOpen, onClose, title, defaultGrain = 'lead', contextFilters = {} }: DataAuditDrawerProps) {
  const { selectedClient, clientConfig } = useClient();
  const { isAdmin } = useAuth();
  const { startDate, endDate, filters } = useFilters();
  const [grain, setGrain] = useState(defaultGrain);
  const [activeGroups, setActiveGroups] = useState<string[]>(['Lead', 'Quality', 'Outcomes', 'Other', 'HLC 1']);
  const query = useAnalyticsData<Record<string, unknown>[]>('export', { grain, format: 'json' }, { enabled: isOpen && isAdmin, contextFilters });
  const responseError = query.error || (query.data !== null && (!Array.isArray(query.data) || query.data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) ? 'The record response is incomplete. Please retry.' : null);
  const data = !responseError && Array.isArray(query.data) ? query.data : [];
  const scopeKey = JSON.stringify([selectedClient, startDate, endDate, filters, contextFilters, grain]);
  const [pageState, setPage] = useState({ scopeKey, value: 1 });
  const page = pageState.scopeKey === scopeKey ? pageState.value : 1;
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * pageSize;
  const allColumns = [...new Set(data.flatMap(row => Object.keys(row)))];
  const allGroups = [...new Set(allColumns.map(columnGroup))];
  // A record identifier stays visible even when its column group is hidden.
  const columns = allColumns.filter(key => key === 'lead_id' || activeGroups.includes(columnGroup(key)));
  const uniqueLeads = new Set(data.map(row => row.lead_id).filter(value => value !== null && value !== undefined)).size;
  const busy = query.loading || query.fetching;
  const toggleGroup = (group: string) => setActiveGroups(previous => previous.includes(group) ? previous.filter(item => item !== group) : [...previous, group]);

  if (!isOpen) return null;
  if (!isAdmin) {
    return <Modal open onClose={onClose} label={title} className="w-[min(36rem,calc(100vw-2rem))]">
      <div className="p-6 space-y-3">
        <h2 className="text-lg font-bold text-text-main">Record access is restricted</h2>
        <p className="text-sm text-text-sec">Consumer-level lead and transaction records require administrator access under the ConversionX data-governance contract.</p>
        <div className="flex justify-end"><button type="button" onClick={onClose} className="cx-button-secondary">Close</button></div>
      </div>
    </Modal>;
  }
  return <Modal open onClose={onClose} label={title} className="w-[min(64rem,calc(100vw-2rem))]">
    <div className="flex flex-col max-h-[80dvh] min-w-0">
      <header className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-border-subtle bg-surface-sec">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2"><TableIcon className="w-5 h-5 text-[#3562B3] shrink-0" />{title}</h2>
          <p className="text-sm text-text-sec mt-1">Supporting records · {clientConfig?.name} · capture dates {startDate} to {endDate}. Active and chart filters apply.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close supporting records" className="cx-icon-button shrink-0"><X size={20} /></button>
      </header>
      <div className="p-4 border-b border-border-subtle flex flex-wrap items-end gap-4 text-sm">
        <label className="flex flex-col gap-1"><span className="font-medium">Record unit</span>
          <select value={grain} onChange={event => setGrain(event.target.value)} className="bg-white border rounded px-3 py-2">
            <option value="lead">Unique lead</option><option value="transaction">Lead × vendor transaction</option>
          </select>
        </label>
        <div><span className="block text-text-sec">Returned records</span><strong>{busy ? 'Loading…' : responseError ? 'Unavailable' : formatTableNumber(data.length)}</strong></div>
        <div><span className="block text-text-sec">Unique lead identifiers</span><strong>{busy ? 'Loading…' : responseError ? 'Unavailable' : formatTableNumber(uniqueLeads)}</strong></div>
        <div className="flex-1" />
        <button type="button" disabled={busy || !!responseError || !data.length}
          onClick={() => saveBlob(new Blob([recordsCsv(data)], { type: 'text/csv;charset=utf-8' }), `conversionx-${grain}-loaded-records.csv`)}
          className="cx-button-secondary"><Download size={16} />Export all loaded records</button>
      </div>
      <div className="overflow-auto p-4 sm:p-6 space-y-4">
        {query.loading || responseError ? <DataState loading={query.loading} error={responseError} retry={query.refetch} /> : !data.length ?
          <p role="status" className="py-8 text-text-sec">No records matched this record unit and reporting scope. Adjust the filters or dates to try again.</p> : <>
          {query.fetching && <p role="status">Updating records for the same scope… Export is paused until the update finishes.</p>}
          <p className="text-sm text-text-sec">{formatTableNumber(data.length)} returned records. {query.metadata?.truncated === true ? 'The API row limit was reached; this is a partial response. Narrow the scope for a more complete extract.' : 'This loaded response is not a certification of source completeness.'} Exports include all loaded rows and reporting-context columns, independently of pagination or column visibility.</p>
          {query.metadata?.generatedAt && <p className="text-sm text-text-sec">Response generated: {String(query.metadata.generatedAt)}. Source freshness is not established by this timestamp.</p>}
          <fieldset className="flex flex-wrap gap-2"><legend className="text-sm font-semibold mb-2">Visible column groups</legend>
            {allGroups.map(group => <button key={group} type="button" aria-pressed={activeGroups.includes(group)} onClick={() => toggleGroup(group)}
              className={`cx-button-secondary ${activeGroups.includes(group) ? 'bg-[#EDF5FC] border-[#3562B3] text-[#315EAD]' : ''}`}>{group}</button>)}
          </fieldset>
          <div className="border rounded-lg overflow-auto" tabIndex={0} role="region" aria-label="Supporting records table">
            <VisualTable visual={{ id: 'legacy.audit', data }} initialView="table" className="w-full text-left border-collapse text-sm whitespace-nowrap">
              <thead className="bg-surface-sec"><tr>{columns.map(key => <th key={key} scope="col" className="p-3 font-semibold border-b">{key}</th>)}</tr></thead>
              <tbody>{data.slice(offset, offset + pageSize).map((row, index) => <tr key={`${row.lead_id ?? 'record'}-${row.transaction_id ?? offset + index}`} className="border-b border-border-subtle">
                {columns.map(key => <td key={key} className="p-3 text-text-main">{row[key] === null || row[key] === undefined ? <span className="text-text-sec">Unavailable</span> : typeof row[key] === 'boolean' ? (row[key] ? 'True' : 'False') : typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key])}</td>)}
              </tr>)}</tbody>
            </VisualTable>
          </div>
          <nav aria-label="Supporting records pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>Showing {offset + 1}–{Math.min(offset + pageSize, data.length)} of {formatTableNumber(data.length)} loaded records</span>
            <div className="flex gap-2"><button type="button" className="cx-button-secondary" disabled={currentPage === 1 || busy} onClick={() => setPage({ scopeKey, value: currentPage - 1 })}>Previous records</button>
              <button type="button" className="cx-button-secondary" disabled={currentPage === pageCount || busy} onClick={() => setPage({ scopeKey, value: currentPage + 1 })}>Next records</button></div>
          </nav>
        </>}
      </div>
    </div>
  </Modal>;
}
