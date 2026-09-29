import React from 'react';
import { Database } from 'lucide-react';
import type { SourceObservabilityData } from '../../../lib/offernetClient';
import { formatTableNumber } from '../../../lib/formatters';
import { statusLabel } from '../../../lib/statusPresentation';

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

export default function SourceEvidenceMatrix({ sources }: { sources: Source[] | undefined }) {
  return <section className="cx-trust-panel" id="source-evidence" aria-labelledby="source-evidence-heading">
    <header className="cx-trust-heading"><div><h2 id="source-evidence-heading">Source evidence at a glance</h2>
      <p>All tenant-owned records, not just the selected capture cohort. Connection, timestamps and validation are separate observations.</p></div><Database size={18} aria-hidden="true" /></header>
    {!sources?.length ? <p className="cx-trust-empty">{sources ? 'No source observations returned for this workspace.' : 'Source observations were not supplied in this response.'}</p> :
      <div className="cx-trust-table-scroll" role="region" aria-label="Source evidence matrix" tabIndex={0}>
        <table className="cx-trust-table cx-source-evidence-table">
          <caption className="sr-only">Source status, latest record, returned age and rows. No health score or freshness SLA is inferred.</caption>
          <thead><tr><th scope="col">Source</th><th scope="col">Reported status</th><th scope="col">Latest record</th><th scope="col">Age (hours)</th><th scope="col">Source rows</th><th scope="col">Evidence & limitations</th></tr></thead>
          <tbody>{sources.map((source, index) => <tr key={`${source.key}-${index}`}>
            <th scope="row">{source.label}<small className="cx-trust-source-path">{source.table || 'No table configured'}</small></th>
            <td><EvidenceStatus status={source.status} /></td>
            <td>{source.latestRecordAt ? <time dateTime={source.latestRecordAt}>{source.latestRecordAt}</time> : <span className="cx-trust-unavailable">Not recorded</span>}</td>
            <td className="cx-trust-number">{source.ageHours == null ? <span className="cx-trust-unavailable">Unavailable</span> : formatTableNumber(source.ageHours)}</td>
            <td className="cx-trust-number">{source.rowCount == null ? <span className="cx-trust-unavailable">Unavailable</span> : formatTableNumber(source.rowCount)}</td>
            <td className="cx-trust-detail-cell">{source.detail || 'No additional source explanation was returned.'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    <p className="cx-trust-note">Timestamps are shown as returned. Source row counts have different grains and must not be added together. An observed record is not proof of a current feed or a verified report.</p>
  </section>;
}
