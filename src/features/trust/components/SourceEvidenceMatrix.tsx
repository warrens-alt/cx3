import React from 'react';
import { Database } from 'lucide-react';
import type { SourceObservabilityData } from '../../../lib/offernetClient';
import { formatTableNumber } from '../../../lib/formatters';
import { statusLabel } from '../../../lib/statusPresentation';
import EvidenceMatrix, { type EvidenceMatrixState } from '../../../shared/visuals/EvidenceMatrix';
import ChartFrame from '../../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../../shared/reporting/ReportingScopeSummary';

type Source = SourceObservabilityData['sources'][number];

/** Appearance only: retain the returned code, never infer health from age or row counts. */
export function sourceStatusTone(status: string): 'observed' | 'attention' | 'neutral' {
  if (['HEALTHY', 'OBSERVED', 'OK', 'AVAILABLE'].includes(status)) return 'observed';
  if (['WARNING', 'CRITICAL', 'MAPPING_REQUIRED', 'TIMESTAMP_CONTRACT_REQUIRED', 'ERROR', 'ACCESS_DENIED'].includes(status)) return 'attention';
  return 'neutral';
}

export function EvidenceStatus({ status }: { status?: string | null }) {
  return <span className="cx-trust-status" data-status={status || 'UNREPORTED'} data-tone={sourceStatusTone(status || '')}>
    <i aria-hidden="true" />{status ? statusLabel(status) : 'Not reported'}
  </span>;
}

function matrixState(status: string): EvidenceMatrixState {
  if (status === 'PARTIAL') return 'partial';
  if (sourceStatusTone(status) === 'observed') return 'observed';
  if (['WARNING', 'CRITICAL', 'ERROR'].includes(status)) return 'issue';
  return status === 'NOT_VERIFIED' ? 'unverified' : 'unavailable';
}

export default function SourceEvidenceMatrix({ sources, renderSourceAction, summaryOnly = false }: { sources: Source[] | undefined; renderSourceAction?: (source: Source) => React.ReactNode; summaryOnly?: boolean }) {
  return <section className="cx-source-observability cx-analytical-canvas" id="source-evidence" aria-labelledby="source-evidence-heading">
    <ChartFrame title="Source evidence at a glance" scope={<><ReportingScopeSummary /><p>These source observations cover all tenant-owned records, independent of the selected capture cohort.</p></>} header={<div><span className="cx-command-section-kicker">Source observations</span><h2 id="source-evidence-heading">Source evidence at a glance</h2><p>All tenant-owned records · independent of the selected capture cohort.</p></div>} actions={<Database size={18} aria-hidden="true" />}>
    <EvidenceMatrix label="Source evidence matrix" columns={[{ key: 'rows', label: 'Returned rows' }, { key: 'status', label: 'Reported status' }, { key: 'time', label: 'Timestamp evidence' }]} emptyLabel={sources ? 'No source observations returned for this workspace.' : 'Source observations were not supplied in this response.'}
      rows={(sources || []).map((source, index) => ({ key: `${source.key}-${index}`, label: source.label, action: renderSourceAction?.(source), cells: {
        rows: { state: source.rowCount == null ? 'unavailable' : 'observed', label: source.rowCount == null ? 'Unavailable' : `${formatTableNumber(source.rowCount)} rows`, detail: 'Source grain; completeness not inferred' },
        status: { state: matrixState(source.status), label: statusLabel(source.status), detail: source.status === 'PARTIAL' ? 'Returned partial state' : undefined },
        time: { state: source.latestRecordAt ? 'observed' : 'unavailable', label: source.latestRecordAt ? 'Timestamp returned' : 'Unavailable', detail: source.ageHours == null ? 'Age unavailable' : `${formatTableNumber(source.ageHours)}h returned age` },
      } }))} />
    {!summaryOnly && Boolean(sources?.length) && <details className="cx-source-exact-evidence"><summary>View exact source evidence</summary>
      <div className="cx-trust-table-scroll" role="region" aria-label="Exact source observations" tabIndex={0}>
        <table className="cx-trust-table cx-source-evidence-table">
          <caption className="sr-only">Source status, latest record, returned age and rows. No health score or freshness SLA is inferred.</caption>
          <thead><tr><th scope="col">Source</th><th scope="col">Reported status</th><th scope="col">Latest record</th><th scope="col">Age (hours)</th><th scope="col">Source rows</th><th scope="col">Evidence & limitations</th></tr></thead>
          <tbody>{sources!.map((source, index) => <tr key={`${source.key}-${index}`}>
            <th scope="row">{source.label}<small className="cx-trust-source-path">{source.table || 'No table configured'}</small>{renderSourceAction?.(source)}</th>
            <td><EvidenceStatus status={source.status} /></td>
            <td>{source.latestRecordAt ? <time dateTime={source.latestRecordAt}>{source.latestRecordAt}</time> : <span className="cx-trust-unavailable">Not recorded</span>}</td>
            <td className="cx-trust-number">{source.ageHours == null ? <span className="cx-trust-unavailable">Unavailable</span> : formatTableNumber(source.ageHours)}</td>
            <td className="cx-trust-number">{source.rowCount == null ? <span className="cx-trust-unavailable">Unavailable</span> : formatTableNumber(source.rowCount)}</td>
            <td className="cx-trust-detail-cell">{source.detail || 'No additional source explanation was returned.'}</td>
          </tr>)}</tbody>
        </table>
      </div></details>}
    <p className="cx-trust-note">Timestamps are shown as returned. Source row counts have different grains and must not be added together. An observed record is not proof of a current feed or a verified report.</p>
    </ChartFrame>
  </section>;
}
