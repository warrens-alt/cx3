import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Database, Download, RefreshCw } from 'lucide-react';
import { BLC_SOURCES, BLC_SOURCE_IDS, formatBlcCount, type BlcSourceId, type BlcReport } from '../../../../contracts/blcReporting';
import { useClient } from '../../../lib/ClientContext';
import { useFilters } from '../../../lib/FilterContext';
import { useOperationalData } from '../../../lib/useOperationalData';
import { fetchBlcReport } from '../../../lib/blcReportingClient';
import { saveBlob } from '../../../lib/analyticsRequest';

function relativeWidth(value: string, maximum: bigint): string {
  return maximum > 0n ? `${Number(BigInt(value) * 10000n / maximum) / 100}%` : '0%';
}

export default function BlcReportingPanel() {
  const { selectedClient } = useClient();
  const { startDate, endDate, filters } = useFilters();
  const [expanded, setExpanded] = useState(false);
  const [sourceId, setSourceId] = useState<BlcSourceId>('journey');
  const allowed = ['default_tenant', 'default', 'ontact_blc', 'blc'].includes(selectedClient);
  const params = useMemo(() => ({ clientId: selectedClient, startDate, endDate, filters, sourceId }), [selectedClient, startDate, endDate, filters, sourceId]);
  const query = useOperationalData<BlcReport>('BlcSourceReport', params, fetchBlcReport, allowed && expanded);
  // Never export old-scope or failed-refresh results.
  const report = !query.loading && !query.error ? query.data : null;
  const usable = Boolean(report?.querySucceeded && report.summary);
  const maximum = report?.breakdown.reduce((max, row) => BigInt(row.sourceRows) > max ? BigInt(row.sourceRows) : max, 0n) || 0n;
  if (!allowed) return null;

  return <section className="enterprise-card rounded-lg border border-border bg-surface" aria-label="BLC read-only source reporting">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-3">
        <Database size={20} className="text-action mt-1 shrink-0" aria-hidden="true" />
        <div><h2 className="text-base font-semibold text-text-main">BLC source reporting</h2>
          <p className="text-sm text-text-sec mt-1">Inspect one read-only warehouse source at a time. Separate from the cohort totals above.</p>
        </div>
      </div>
      <button type="button" className="cx-button-secondary flex items-center gap-2 text-sm" aria-expanded={expanded} aria-controls="blc-source-content" onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Close source report' : 'Open source report'}{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </div>
    {expanded && <div id="blc-source-content" className="border-t border-border p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm text-text-sec flex flex-col gap-1 max-w-full">Reporting source
          <select className="rounded-md border border-border bg-surface text-text-main px-3 py-2 max-w-full" value={sourceId} onChange={event => setSourceId(event.target.value as BlcSourceId)}>
            {BLC_SOURCE_IDS.map(id => <option key={id} value={id}>{BLC_SOURCES[id].label}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cx-button-secondary flex items-center gap-2 text-sm" disabled={query.loading} onClick={() => void query.loadData(true)}><RefreshCw size={15} />Refresh BLC report</button>
          <button type="button" className="cx-button-secondary flex items-center gap-2 text-sm" disabled={!usable} onClick={() => {
            if (report?.querySucceeded) saveBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `CX3-BLC-${sourceId}-${startDate}-${endDate}.json`);
          }}><Download size={15} />Export source report</button>
        </div>
      </div>
      <div className="bg-surface-subtle border border-border rounded-md p-3 text-sm space-y-1">
        <p><strong>Date basis:</strong> {BLC_SOURCES[sourceId].dateBasis}</p>
        <p><strong>Selection:</strong> {startDate || 'Start date required'} to {endDate || 'End date required'} · existing source-date parser (UTC)</p>
        <p className="text-text-sec">{BLC_SOURCES[sourceId].note}</p>
        <code className="block text-xs break-all">{BLC_SOURCES[sourceId].table}</code>
      </div>
      {query.loading && <p role="status" className="text-sm text-text-sec">Checking source schema and reading the selected date window…</p>}
      {query.error && <p role="alert" className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 rounded-md">{query.error}</p>}
      {report && <>
        <div className="flex flex-wrap gap-2 items-center text-sm" aria-live="polite">
          <span className="font-semibold text-text-main">{report.status === 'READY' ? 'Query returned data' : report.status === 'EMPTY' ? 'Query succeeded · no dated rows' : report.status.replaceAll('_', ' ')}</span>
          <span className="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-800">Not reconciled · freshness not verified</span>
          <span className="text-text-sec">Checked: {report.checkedAt}</span>
        </div>
        {report.message && <p role={report.querySucceeded ? 'status' : 'alert'} className="text-sm p-3 bg-surface-subtle rounded-md border border-border">{report.message}</p>}
        {report.missingFields.length > 0 && <p className="text-sm text-text-sec">Missing or incompatible fields: <code>{report.missingFields.join(', ')}</code>. No fallback source was queried.</p>}
        {usable && report.summary && <>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              ['Dated source rows', report.summary.sourceRows],
              [`Distinct ${report.source.keyField} references`, report.summary.distinctReferences],
              ['Rows missing that reference', report.summary.missingReferences],
            ].map(([label, value]) => <div key={label} className="border-l-2 border-action pl-3"><dt className="text-sm text-text-sec">{label}</dt><dd className="text-2xl font-semibold tabular-nums text-text-main mt-1">{formatBlcCount(value)}</dd></div>)}
          </dl>
          <p className="text-sm text-text-sec">Latest source date in this selection: <strong>{report.latestSourceDate || 'Unavailable'}</strong>. This is not the source refresh time.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section><h3 className="text-sm font-semibold text-text-main mb-2">Source rows by {report.source.breakdownField}</h3>
              {report.breakdownTruncated && <p className="text-sm text-amber-800 mb-2">Showing the top 200 groups. Group coverage is incomplete; totals above cover the selected window.</p>}
              <div className="max-h-80 overflow-auto rounded border border-border">
                <table className="w-full text-sm"><caption className="sr-only">BLC source rows by reporting dimension</caption><thead className="bg-surface-subtle text-text-sec"><tr><th scope="col" className="text-left p-2">{report.source.breakdownField}</th><th scope="col" className="text-right p-2">Source rows</th></tr></thead>
                  <tbody>{report.breakdown.map((row, index) => <tr key={`${row.label}-${index}`} className="border-t border-border"><td className="p-2 break-words"><span>{row.label === null ? 'Missing value' : row.label}</span><div className="mt-1 h-1 bg-surface-subtle" aria-hidden="true"><div className="h-1 bg-action" style={{ width: relativeWidth(row.sourceRows, maximum) }} /></div></td><td className="p-2 text-right tabular-nums">{formatBlcCount(row.sourceRows)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
            <section><h3 className="text-sm font-semibold text-text-main mb-2">Dated source rows</h3>
              <div className="max-h-80 overflow-auto rounded border border-border"><table className="w-full text-sm"><caption className="sr-only">Daily groups using {report.source.dateField}</caption><thead className="bg-surface-subtle text-text-sec"><tr><th scope="col" className="text-left p-2">{report.source.dateField}</th><th scope="col" className="text-right p-2">Source rows</th></tr></thead><tbody>{report.daily.map(row => <tr key={row.date} className="border-t border-border"><td className="p-2">{row.date}</td><td className="p-2 text-right tabular-nums">{formatBlcCount(row.sourceRows)}</td></tr>)}</tbody></table></div>
            </section>
          </div>
          <details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm font-semibold text-text-main">Field coverage and source definitions</summary>
            <p className="text-sm text-text-sec my-2">Nonblank values among dated rows in this selection. Populated is not the same as valid. Financial fields are not added to revenue totals.</p>
            <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th scope="col" className="text-left p-2">Field</th><th scope="col" className="text-left p-2">Declared type</th><th scope="col" className="text-right p-2">Populated rows</th></tr></thead><tbody>{report.fieldCoverage.map(row => <tr key={row.field} className="border-t border-border"><td className="p-2 font-mono text-xs">{row.field}</td><td className="p-2">{report.source.fields[row.field]}</td><td className="p-2 text-right tabular-nums">{formatBlcCount(row.populatedRows)}</td></tr>)}</tbody></table></div>
          </details>
        </>}
        <details className="text-sm text-text-sec"><summary className="cursor-pointer">Read-only scope and limitations</summary><ul className="list-disc pl-5 space-y-1 mt-2">{report.limitations.map(note => <li key={note}>{note}</li>)}</ul></details>
      </>}
    </div>}
  </section>;
}
