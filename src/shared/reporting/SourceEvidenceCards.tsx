import React from 'react';
import { observedTimestamp, sourcePresentation, sourcePurpose, type WorkspaceEvidence } from '../../lib/workspaceReadiness';

export default function SourceEvidenceCards({ report }: { report: WorkspaceEvidence }) {
  return <>
    <p className="cx-readiness-note">Workspace-wide source evidence, independent of the report dates and filters. Checked at <time dateTime={report.checkedAt}>{new Date(report.checkedAt).toISOString()} (UTC)</time>. The latest event time is not the ingestion time or proof that a feed is current.</p>
    {!report.sources.length ? <p role="status">No source evidence was returned. Existing report metrics have not been replaced with zeroes.</p> :
      <div className="cx-readiness-grid">{report.sources.map(source => {
        const presentation = sourcePresentation(source.status);
        return <article key={source.key} className="cx-readiness-card" aria-label={source.label}>
          <header><h3>{source.label}</h3><span className="cx-readiness-badge" data-tone={presentation.tone}>{presentation.label}</span></header>
          <p>{sourcePurpose(source.key)}</p>
          <dl>
            <div><dt>Source rows</dt><dd>{source.rowCount === null ? 'Unavailable' : source.rowCount.toLocaleString()}</dd></div>
            <div><dt>Missing event timestamps</dt><dd>{source.missingTimestampRows === null ? 'Unavailable' : source.missingTimestampRows.toLocaleString()}</dd></div>
            <div className="cx-readiness-wide"><dt>Latest reported event</dt><dd>{observedTimestamp(source.latestRecordAt, report.checkedAt)}</dd></div>
          </dl>
          <p className="cx-readiness-note">{presentation.explanation}</p>
        </article>;
      })}</div>}
  </>;
}
