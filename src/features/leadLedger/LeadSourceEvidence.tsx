import React, { useEffect, useRef } from 'react';
import type { LedgerCell, LedgerLead } from '../../../contracts/leadLedgerReplica';
import { LEDGER_RAW_FIELD_GROUPS } from './fieldGroups';
const text = (value: LedgerCell | undefined) => value == null || value === '' ? 'Not recorded' : String(value);
const issueText = (value: string) => value.replace(/_/g, ' ').toLowerCase();

function SourceFields({ raw, labels }: { raw: LedgerLead['records'][number]['raw']; labels: readonly string[] }) {
  return <dl className="cx-ledger-evidence">{labels.map(label => <div key={label}><dt>{label}</dt><dd>{text(raw[label])}</dd></div>)}</dl>;
}
function RecordHeading({ record, index }: { record: LedgerLead['records'][number]; index: number }) {
  return <header className="cx-ledger-record-heading"><h3>Source record {index + 1}</h3><dl><div><dt>Vendor</dt><dd>{text(record.raw['HLC Vendor'])}</dd></div><div><dt>Transaction</dt><dd>{text(record.raw['HLC Transaction ID'])}</dd></div></dl></header>;
}
export default function LeadSourceEvidence({ lead, focusFields = [] }: { lead: LedgerLead; focusFields?: string[] }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusFields.length) return;
    const frame = requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLElement>('[data-source-highlight="true"]');
      if (target?.getClientRects().length) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest' }); }
    });
    return () => cancelAnimationFrame(frame);
  }, [focusFields]);
  const first = lead.records[0]?.raw || {};
  return <div ref={root} className="cx-ledger-inspector-sections">
    <details className="cx-ledger-inspector-section" open>
      <summary>Lead summary</summary>
      <div className="cx-ledger-section-body"><p>Summary from the first returned source record. Other source records remain available below.</p><SourceFields raw={first} labels={['Lead ID', 'Consumer ID', 'Offershop Source', 'Fetched', 'Offershop Grade', 'Offershop Color Vetting']} /></div>
    </details>
    <details className="cx-ledger-inspector-section">
      <summary>Original timestamp fields</summary>
      <div className="cx-ledger-section-body"><p>Snapshot milestones, not a complete call or status-change history. Naive timestamps are interpreted as UTC.</p>
        {lead.records.map((record, index) => <article className="cx-ledger-record" key={index}>
          <RecordHeading record={record} index={index} />
          <ol className="cx-ledger-events">{record.events.filter(event => event.state !== 'missing').sort((a, b) => (a.timestamp || a.raw).localeCompare(b.timestamp || b.raw)).map(event => <li key={event.label}><strong>{event.label}</strong><span>{event.raw}</span><small>{event.state === 'observed' ? 'Recorded timestamp' : `${event.state} — excluded from observed events`}</small></li>)}</ol>
          {!record.events.some(event => event.state !== 'missing') && <p>No non-placeholder milestones recorded.</p>}
        </article>)}
      </div>
    </details>
    <details className="cx-ledger-inspector-section">
      <summary>Vendor evidence</summary>
      <div className="cx-ledger-section-body"><p>Each source record is retained as reported, including repeated transaction keys. Missing outcome evidence is not a confirmed negative.</p>
        {lead.records.map((record, index) => <article className="cx-ledger-record" key={index}><RecordHeading record={record} index={index} /><SourceFields raw={record.raw} labels={['HLC Status', 'HLC Last Dialer Status', 'HLC Total Calls', 'HLC RPC', 'HLC Sale', 'HLC Activated']} /></article>)}
      </div>
    </details>
    <details className="cx-ledger-inspector-section">
      <summary>Commercial evidence</summary>
      <div className="cx-ledger-section-body"><p>Raw reported amounts are retained without rounding. Repeated lead totals are not additive; missing amounts remain unrecorded.</p>
        {lead.records.map((record, index) => <article className="cx-ledger-record" key={index}><RecordHeading record={record} index={index} /><SourceFields raw={record.raw} labels={['HLC Revenue Generated', 'HLC CURRENCY', 'Total Revenue']} /></article>)}
      </div>
    </details>
    <details className="cx-ledger-inspector-section">
      <summary>Exceptions / warnings{lead.issues.length > 0 ? ` (${lead.issues.length} types)` : ''}</summary>
      <div className="cx-ledger-section-body">
        {lead.issues.length > 0 ? <p className="cx-ledger-warning">{lead.issues.map(issueText).join(' · ')}</p> : <p>No exception codes were supplied for this lead.</p>}
        {lead.records.map((record, index) => record.issues.length > 0 && <article className="cx-ledger-record" key={index}><RecordHeading record={record} index={index} /><p className="cx-ledger-warning">{record.issues.map(issueText).join(' · ')}</p></article>)}
      </div>
    </details>
    <details className="cx-ledger-inspector-section" open={focusFields.length > 0 || undefined}>
      <summary>View all 63 raw source fields</summary>
      <div className="cx-ledger-section-body"><p>Raw source value: exact returned content under its original field name. These are not necessarily canonical analytical fields. Source records are kept separate.</p>
        {lead.records.map((record, index) => <article className="cx-ledger-record cx-ledger-raw-record" data-source-record={index} key={index}>
          <RecordHeading record={record} index={index} />
          {LEDGER_RAW_FIELD_GROUPS.map(group => <section className="cx-ledger-field-group" key={group.label} aria-label={`${group.label} · source record ${index + 1}`}><h4>{group.label}<span>{group.columns.length} fields</span></h4><dl className="cx-ledger-fields">{group.columns.map(column => <div key={column.label} data-raw-field={column.label} data-source-highlight={focusFields.includes(column.label)} tabIndex={focusFields.includes(column.label) ? -1 : undefined}><dt>{column.label}</dt><dd aria-label={`Raw source value for ${column.label}`}>{text(record.raw[column.label])}</dd></div>)}</dl></section>)}
        </article>)}
      </div>
    </details>
  </div>;
}
