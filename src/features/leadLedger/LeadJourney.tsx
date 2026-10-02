import React, { useId, useMemo, useRef, useState } from 'react';
import CopyEvidenceButton from '../../shared/evidence/CopyEvidenceButton';
import { buildLedgerTimeline, type LedgerTimelineEvent } from './timeline';

type Props = {
  row: Readonly<Record<string, unknown>>;
  validationStatus?: string;
  onViewSource: (fields: string[]) => void;
};
const dateLabel = (timestamp: string) => new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const timeLabel = (timestamp: string) => new Date(timestamp).toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' });
const valueText = (value: unknown) => value == null || value === '' ? 'Unavailable' : String(value);

/** Uses the selected, already-loaded analytical row. Interactions are local state only. */
export default function LeadJourney({ row, validationStatus, onViewSource }: Props) {
  const journey = useMemo(() => buildLedgerTimeline(row), [row]);
  const [mode, setMode] = useState<'journey' | 'events'>('journey');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const evidence = useRef<HTMLElement>(null);
  const id = useId();
  const selected = journey.milestones.find(event => event.id === selectedId);
  const validation = validationStatus === 'NOT_VERIFIED' ? 'Not verified' : validationStatus || 'Validation not supplied';
  const dates = [...new Set(journey.timedEvents.map(event => event.timestamp!.slice(0, 10)))];
  const selectEvent = (event: LedgerTimelineEvent) => {
    setSelectedId(event.id);
    requestAnimationFrame(() => {
      evidence.current?.focus({ preventScroll: true });
      evidence.current?.scrollIntoView({ block: 'nearest' });
    });
  };
  const eventButton = (event: LedgerTimelineEvent, compact = false) => <button type="button" className="cx-journey-event" data-stage={event.kind} data-certainty={event.timestampStatus} aria-pressed={selectedId === event.id} aria-controls={`${id}-evidence`} onClick={() => selectEvent(event)}>
    <span className="cx-journey-node" aria-hidden="true" />
    <strong>{event.title}</strong>
    {event.timestamp ? <time dateTime={event.timestamp}>{!compact && <span>{dateLabel(event.timestamp)}</span>}<span>{timeLabel(event.timestamp)}</span></time> : <span className="cx-journey-untimed">Timestamp unavailable</span>}
    <small>{event.timestampStatus === 'observed' ? 'Observed timestamp' : 'Recorded · untimed'}</small>
  </button>;
  const copy = selected ? [`Lead ID: ${valueText(row.lead_id)}`, selected.title, selected.timestamp || 'Timestamp unavailable', `Validation: ${validation}`, 'Layer: Normalised operational evidence', selected.description, ...selected.evidenceFields.map(field => `${field.label}: ${valueText(field.value)}`)].join('\n') : '';

  return <div className="cx-ledger-journey">
    <div className="cx-journey-summary">
      <div><span>Furthest recorded stage</span><strong>{journey.currentStage?.title || 'Unavailable'}</strong></div>
      <div><span>Recorded attempts</span><strong>{journey.calls.count ?? 'Unavailable'}</strong></div>
      {journey.duration && <div><span>Observed time span</span><strong>{journey.duration.label}</strong></div>}
    </div>
    <p className="cx-journey-caption">Normalised lifecycle evidence · times in UTC. Lifecycle positions do not establish the order of untimed outcomes.</p>
    <div className="cx-journey-tabs" role="tablist" aria-label="Lead journey views" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'journey' : event.key === 'End' ? 'events' : mode === 'journey' ? 'events' : 'journey';
      setMode(next); document.getElementById(`${id}-${next}-tab`)?.focus();
    }}>{(['journey', 'events'] as const).map(value => <button key={value} type="button" role="tab" id={`${id}-${value}-tab`} aria-selected={mode === value} aria-controls={`${id}-${value}-panel`} tabIndex={mode === value ? 0 : -1} onClick={() => setMode(value)}>{value === 'journey' ? 'Journey' : 'Events'}</button>)}</div>

    {!journey.timedEvents.length && <div className="cx-journey-empty"><h3>Timeline unavailable</h3><p>This lead has source records, but the current dataset does not provide enough timestamped lifecycle evidence to construct a chronological timeline.</p><button type="button" className="cx-button-secondary" onClick={() => onViewSource([])}>View source evidence</button></div>}
    <section role="tabpanel" id={`${id}-journey-panel`} aria-labelledby={`${id}-journey-tab`} hidden={mode !== 'journey'} tabIndex={0}>
      {journey.timedEvents.length > 0 ? <>
        <ol className="cx-journey-spine" aria-label="Recorded lifecycle milestones">{journey.milestones.map((event, index) => {
          const transition = journey.transitions.find(item => item.toId === event.id);
          return <li key={event.id} data-stage={event.kind} data-connector={transition?.state || 'start'}>
            {index > 0 && <span className="cx-journey-elapsed" aria-label={`${journey.milestones[index - 1].title} to ${event.title}: ${transition?.label || 'Time unavailable'}`}>{transition?.label || 'Time unavailable'}</span>}
            {eventButton(event)}
          </li>;
        })}</ol>
        <p className="cx-journey-key"><span><i data-filled="true" />Observed time</span><span><i />Recorded, time unavailable</span></p>
      </> : journey.untimedEvents.length > 0 ? <div className="cx-journey-undated"><h3>Recorded stages · timestamps unavailable</h3><ul>{journey.untimedEvents.map(event => <li key={event.id}>{eventButton(event)}</li>)}</ul></div> : null}
      <details className="cx-journey-calls">
        <summary><span>Calls {journey.calls.count == null ? '· count unavailable' : `×${journey.calls.count}`}</span><small>Recorded aggregate · inspect evidence</small></summary>
        <p>{journey.calls.count == null ? 'Call count unavailable' : `${journey.calls.count} recorded attempts`}</p>
        <p>Individual timestamps unavailable. RPC attempt number unavailable.</p>
        <p>{journey.calls.limitation}</p>
        <dl>{journey.calls.evidenceFields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{valueText(field.value)}</dd></div>)}</dl>
        <button type="button" className="cx-button-secondary" onClick={() => onViewSource(['HLC Total Calls', 'HLC First Call Date', 'HLC Last Call Date', 'HLC Last Dialer Status', 'HLC RPC'])}>View call source fields</button>
      </details>
      <dl className="cx-journey-outcomes">{journey.outcomes.map(outcome => <div key={outcome.kind}><dt>{outcome.title}</dt><dd>{outcome.state === 'recorded' ? 'Recorded' : outcome.state === 'not-recorded' ? 'Not recorded in returned evidence' : 'Evidence unavailable'}</dd></div>)}</dl>
    </section>

    <section role="tabpanel" id={`${id}-events-panel`} aria-labelledby={`${id}-events-tab`} hidden={mode !== 'events'} tabIndex={0}>
      <p className="cx-journey-caption">Available snapshot milestones, not a complete call or status history.</p>
      {dates.map(date => <section className="cx-journey-date" key={date}><h3>{dateLabel(date + 'T00:00:00Z')} <small>UTC</small></h3><ol>{journey.timedEvents.filter(event => event.timestamp!.startsWith(date)).map(event => <li key={event.id}>{eventButton(event, true)}</li>)}</ol></section>)}
      {journey.untimedEvents.length > 0 && <section className="cx-journey-undated"><h3>Timestamp unavailable</h3><p>These recorded outcomes have no known chronological order.</p><ul>{journey.untimedEvents.map(event => <li key={event.id}>{eventButton(event)}</li>)}</ul></section>}
    </section>

    <section ref={evidence} className="cx-journey-evidence" id={`${id}-evidence`} aria-label="Selected event evidence" tabIndex={-1}>
      {selected ? <><p className="cx-ledger-eyebrow">EVENT EVIDENCE</p><h3>{selected.title}</h3><p>{selected.timestamp ? `${dateLabel(selected.timestamp)} · ${timeLabel(selected.timestamp)} UTC` : 'Timestamp unavailable'} · {validation}</p><p>{selected.description}</p><dl>{selected.evidenceFields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{valueText(field.value)}</dd></div>)}</dl><div className="cx-journey-evidence-actions"><button type="button" className="cx-button-secondary" onClick={() => onViewSource(selected.sourceFields)}>View source fields</button><CopyEvidenceButton value={copy} label="Copy evidence" /></div><p className="cx-journey-caption">Normalised fields are shown above. Source evidence retains original field names and separate source records; a source match is not reconciliation.</p></> : <p>Select a milestone to inspect its supporting evidence.</p>}
    </section>

    {journey.anomalies.length > 0 && <section className="cx-journey-anomalies" aria-label="Timeline anomalies"><h3>Timestamp anomalies</h3>{journey.anomalies.map((anomaly, index) => <p key={index}><strong>{anomaly.field}</strong>: {valueText(anomaly.value)} — {anomaly.message}</p>)}</section>}
    <details className="cx-journey-context"><summary>Record context &amp; evidence limitations</summary><p>Representative vendor and disposition describe the returned row, not ownership or a specific attempt at every milestone.</p><dl>{['vendor', 'transaction_id', 'source', 'offershop_source', 'last_dialer_status', 'grade', 'vetting'].filter(field => row[field] != null && row[field] !== '').map(field => <div key={field}><dt>{field.replaceAll('_', ' ')}</dt><dd>{String(row[field])}</dd></div>)}</dl><p>Stage ownership and agent handoffs are unavailable in the loaded analytical evidence.</p><ul>{journey.limitations.map(limitation => <li key={limitation}>{limitation}</li>)}</ul></details>
  </div>;
}
