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
        <div>
          <h2 className="text-base font-semibold text-text-main">BLC source reporting</h2>
          <p className="text-sm text-text-sec mt-1">
            Inspect one read-only warehouse source at a time. Separate from the workspace’s cohort totals.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md border border-border-subtle bg-surface hover:bg-surface-subtle text-text-main transition-colors shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--cx-action)]"
        aria-expanded={expanded}
        aria-controls="blc-source-content"
        onClick={() => setExpanded(value => !value)}
      >
        {expanded ? 'Close source report' : 'Open source report'}
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </div>
    {expanded && (
      <div id="blc-source-content" className="border-t border-border p-4 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="text-sm text-text-sec flex flex-col gap-1 max-w-full font-medium">
            Reporting source
            <select
              className="rounded-md border border-border-subtle bg-surface text-text-main px-3 py-2 text-xs sm:text-sm max-w-full font-sans cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[var(--cx-action)]"
              value={sourceId}
              onChange={event => setSourceId(event.target.value as BlcSourceId)}
            >
              {BLC_SOURCE_IDS.map(id => (
                <option key={id} value={id}>
                  {BLC_SOURCES[id].label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md border border-border-subtle bg-surface hover:bg-surface-subtle text-text-main transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              disabled={query.loading}
              onClick={() => void query.loadData(true)}
            >
              <RefreshCw size={14} className={query.loading ? 'animate-spin' : ''} />
              <span>Refresh BLC report</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md border border-border-subtle bg-surface hover:bg-surface-subtle text-text-main transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              disabled={!usable}
              onClick={() => {
                if (report?.querySucceeded) {
                  saveBlob(
                    new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
                    `CX3-BLC-${sourceId}-${startDate}-${endDate}.json`
                  );
                }
              }}
            >
              <Download size={14} />
              <span>Export source report</span>
            </button>
          </div>
        </div>
        <div className="bg-surface-subtle border border-border-subtle rounded-md p-3 text-xs sm:text-sm space-y-1">
          <p>
            <strong>Date basis:</strong> {BLC_SOURCES[sourceId].dateBasis}
          </p>
          <p>
            <strong>Selection:</strong> {startDate || 'Start date required'} to {endDate || 'End date required'} · existing source-date parser (UTC)
          </p>
          <p className="text-text-sec">{BLC_SOURCES[sourceId].note}</p>
          <code className="block text-[11px] font-mono break-all text-text-mute pt-1">
            {BLC_SOURCES[sourceId].table}
          </code>
        </div>
        {query.loading && (
          <p role="status" className="text-xs sm:text-sm text-text-sec flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin text-[var(--cx-action)]" />
            <span>Checking source schema and reading the selected date window…</span>
          </p>
        )}
        {query.error && (
          <p role="alert" className="text-xs sm:text-sm text-red-700 border border-red-200 bg-red-50 p-3 rounded-md">
            {query.error}
          </p>
        )}
        {report && (
          <>
            <div className="flex flex-wrap gap-2 items-center text-xs sm:text-sm" aria-live="polite">
              <span className="font-semibold text-text-main">
                {report.status === 'READY'
                  ? 'Query returned data'
                  : report.status === 'EMPTY'
                  ? 'Query succeeded · no dated rows'
                  : report.status.replaceAll('_', ' ')}
              </span>
              <span className="px-2 py-0.5 rounded text-xs border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium">
                Not reconciled · freshness not verified
              </span>
              <span className="text-text-sec text-xs">Checked: {report.checkedAt}</span>
            </div>
            {report.message && (
              <p
                role={report.querySucceeded ? 'status' : 'alert'}
                className="text-xs sm:text-sm p-3 bg-surface-subtle rounded-md border border-border-subtle"
              >
                {report.message}
              </p>
            )}
            {report.missingFields.length > 0 && (
              <p className="text-xs sm:text-sm text-text-sec">
                Missing or incompatible fields: <code>{report.missingFields.join(', ')}</code>. No fallback source was queried.
              </p>
            )}
            {usable && report.summary && (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    ['Dated source rows', report.summary.sourceRows],
                    [`Distinct ${report.source.keyField} references`, report.summary.distinctReferences],
                    ['Rows missing that reference', report.summary.missingReferences],
                  ].map(([label, value]) => (
                    <div key={label} className="border-l-2 border-[var(--cx-action)] pl-3">
                      <dt className="text-xs sm:text-sm text-text-sec">{label}</dt>
                      <dd className="text-2xl font-semibold tabular-nums text-text-main mt-1 font-mono">
                        {formatBlcCount(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs sm:text-sm text-text-sec">
                  Latest source date in this selection: <strong>{report.latestSourceDate || 'Unavailable'}</strong>. This is not the source refresh time.
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <section>
                    <h3 className="text-xs sm:text-sm font-semibold text-text-main mb-2">
                      Source rows by {report.source.breakdownField}
                    </h3>
                    {report.breakdownTruncated && (
                      <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 mb-2">
                        Showing the top 200 groups. Group coverage is incomplete; overall selection totals cover the selected window.
                      </p>
                    )}
                    <div className="max-h-80 overflow-auto rounded border border-border-subtle">
                      <table className="w-full text-xs sm:text-sm">
                        <caption className="sr-only">BLC source rows by reporting dimension</caption>
                        <thead className="bg-surface-subtle text-text-sec sticky top-0">
                          <tr>
                            <th scope="col" className="text-left p-2.5 font-semibold">
                              {report.source.breakdownField}
                            </th>
                            <th scope="col" className="text-right p-2.5 font-semibold">
                              Source rows
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.breakdown.map((row, index) => (
                            <tr key={`${row.label}-${index}`} className="border-t border-border-subtle hover:bg-surface-subtle/50 transition-colors">
                              <td className="p-2.5 break-words">
                                <span className="font-medium text-text-main">
                                  {row.label === null ? 'Missing value' : row.label}
                                </span>
                                <div className="mt-1 h-1.5 w-full bg-surface-subtle rounded-full overflow-hidden" aria-hidden="true">
                                  <div
                                    className="h-full bg-[var(--cx-action)] rounded-full transition-all duration-300"
                                    style={{ width: relativeWidth(row.sourceRows, maximum) }}
                                  />
                                </div>
                              </td>
                              <td className="p-2.5 text-right tabular-nums font-mono font-semibold text-text-main whitespace-nowrap">
                                {formatBlcCount(row.sourceRows)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xs sm:text-sm font-semibold text-text-main mb-2">
                      Dated source rows
                    </h3>
                    <div className="max-h-80 overflow-auto rounded border border-border-subtle">
                      <table className="w-full text-xs sm:text-sm">
                        <caption className="sr-only">Daily groups using {report.source.dateField}</caption>
                        <thead className="bg-surface-subtle text-text-sec sticky top-0">
                          <tr>
                            <th scope="col" className="text-left p-2.5 font-semibold">
                              {report.source.dateField}
                            </th>
                            <th scope="col" className="text-right p-2.5 font-semibold">
                              Source rows
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.daily.map(row => (
                            <tr key={row.date} className="border-t border-border-subtle hover:bg-surface-subtle/50 transition-colors">
                              <td className="p-2.5 font-mono text-xs">{row.date}</td>
                              <td className="p-2.5 text-right tabular-nums font-mono font-semibold text-text-main whitespace-nowrap">
                                {formatBlcCount(row.sourceRows)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
                <details className="border-t border-border-subtle pt-3">
                  <summary className="cursor-pointer text-xs sm:text-sm font-semibold text-text-main hover:text-[var(--cx-action)] transition-colors">
                    Field coverage and source definitions
                  </summary>
                  <p className="text-xs sm:text-sm text-text-sec my-2">
                    Nonblank values among dated rows in this selection. Populated is not the same as valid. Financial fields are not added to revenue totals.
                  </p>
                  <div className="overflow-auto border border-border-subtle rounded max-h-72">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-surface-subtle text-text-sec sticky top-0">
                        <tr>
                          <th scope="col" className="text-left p-2.5 font-semibold">Field</th>
                          <th scope="col" className="text-left p-2.5 font-semibold">Declared type</th>
                          <th scope="col" className="text-right p-2.5 font-semibold">Populated rows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.fieldCoverage.map(row => (
                          <tr key={row.field} className="border-t border-border-subtle hover:bg-surface-subtle/50 transition-colors">
                            <td className="p-2.5 font-mono text-xs text-text-main font-medium">{row.field}</td>
                            <td className="p-2.5 text-text-sec text-xs">{report.source.fields[row.field]}</td>
                            <td className="p-2.5 text-right tabular-nums font-mono font-semibold text-text-main">{formatBlcCount(row.populatedRows)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
            <details className="text-xs sm:text-sm text-text-sec">
              <summary className="cursor-pointer font-medium hover:text-text-main transition-colors">
                Read-only scope and limitations
              </summary>
              <ul className="list-disc pl-5 space-y-1 mt-2 text-xs leading-relaxed">
                {report.limitations.map(note => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    )}
  </section>;
}
