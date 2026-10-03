import React, { useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { lifecyclePresentation } from '../../shared/visuals/lifecyclePresentation';
import CopyEvidenceButton from '../../shared/evidence/CopyEvidenceButton';
import { buildLedgerTimeline, type LedgerTimelineEvent } from './timeline';
import type { LeadTimelineData } from '../../lib/offernetClient';
import AuditEvidenceButton from '../../shared/evidence/AuditEvidenceButton';
import type { AuditScope } from '../../shared/evidence/auditPresentation';
import { recordEventAuditEvidence } from './recordAuditEvidence';

type Props = {
  row: Readonly<Record<string, unknown>>;
  validationStatus?: string;
  onViewSource?: (fields: string[]) => void;
  sourceEvents?: LeadTimelineData['events'];
  onPinEvent?: (event: LedgerTimelineEvent) => void;
  auditScope?: AuditScope;
};
const dateLabel = (timestamp: string) => new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const timeLabel = (timestamp: string) => new Date(timestamp).toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' });
const valueText = (value: unknown) => value == null || value === '' ? 'Unavailable' : String(value);
const timelineStages = { capture: 'fetched', delivery: 'delivered', call: 'dialled', rpc: 'rpc', sale: 'sales', activation: 'activated' } as const;

function revealEventEvidence(panel: HTMLElement) {
  const heading = panel.querySelector<HTMLElement>('.cx-journey-evidence-heading') || panel;
  const dossier = panel.closest<HTMLElement>('.cx-lead-dossier');
  const dossierHeading = dossier?.querySelector<HTMLElement>(':scope > .cx-dossier-heading');
  const scrollsWithinDossier = dossier && dossier.scrollHeight > dossier.clientHeight + 1;
  if (scrollsWithinDossier) {
    // Measure the live header: long identifiers can add several wrapped lines.
    const headerHeight = dossierHeading?.getBoundingClientRect().height || 0;
    dossier.scrollTop += panel.getBoundingClientRect().top - dossier.getBoundingClientRect().top - dossier.clientTop - headerHeight - 12;
  }
  if (dossier?.classList.contains('is-focused')) return;
  const main = panel.closest<HTMLElement>('.cx-main');
  if (!main) {
    if (!scrollsWithinDossier) heading.scrollIntoView({ block: 'start', inline: 'nearest' });
    return;
  }
  const viewport = main.getBoundingClientRect();
  let visibleTop = viewport.top;
  main.querySelectorAll<HTMLElement>('.cx-scope-controls,.cx-investigation-context[data-compact="true"]').forEach(rail => {
    const style = getComputedStyle(rail);
    const bounds = rail.getBoundingClientRect();
    if (style.position === 'sticky' && bounds.top <= viewport.top + (Number.parseFloat(style.top) || 0) + 1) {
      visibleTop = Math.max(visibleTop, bounds.bottom);
    }
  });
  if (scrollsWithinDossier && dossierHeading) visibleTop = Math.max(visibleTop, dossierHeading.getBoundingClientRect().bottom);
  const bounds = heading.getBoundingClientRect();
  if (bounds.top < visibleTop + 12 || bounds.bottom > viewport.bottom - 12) {
    main.scrollTop += bounds.top - visibleTop - 12;
  }
}

/** Uses the selected, already-loaded analytical row. Interactions are local state only. */
export default function LeadJourney({ row, validationStatus, onViewSource, sourceEvents, onPinEvent, auditScope }: Props) {
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
      const panel = evidence.current;
      if (!panel) return;
      panel.focus({ preventScroll: true });
      revealEventEvidence(panel);
      // Outer scrolling can compact the reporting scope and resize its sticky rail.
      requestAnimationFrame(() => { if (panel.isConnected) revealEventEvidence(panel); });
    });
  };
  const eventButton = (event: LedgerTimelineEvent, compact = false) => {
    const stage = lifecyclePresentation[timelineStages[event.kind]];
    const Icon = stage.Icon;
    const anomalies = journey.anomalies.filter(anomaly => anomaly.field.endsWith(`→ ${event.kind}`) || event.evidenceFields.some(field => field.label === anomaly.field));
    return <button type="button" className={`cx-journey-event${selectedId === event.id ? ' cx-selected-state' : ''}`} data-stage={event.kind} data-certainty={event.timestampStatus} data-anomaly={anomalies.length > 0 || undefined} style={{ '--journey-stage': stage.color } as React.CSSProperties} aria-pressed={selectedId === event.id} aria-controls={`${id}-evidence`} onClick={() => selectEvent(event)}>
    {event.timestamp && <span className="cx-journey-time-column"><time dateTime={event.timestamp}><span>{timeLabel(event.timestamp)}</span>{!compact && <span>{dateLabel(event.timestamp)}</span>}</time></span>}
    <span className="cx-journey-node" aria-hidden="true"><Icon size={16} /></span>
    <span className="cx-journey-event-copy"><strong>{event.title}</strong>
    <small>{event.timestampStatus === 'observed' ? 'Observed timestamp' : 'Recorded, timestamp unavailable'}</small>
    {anomalies.map((anomaly, index) => <span className="cx-journey-inline-anomaly" key={index}><AlertTriangle size={12} aria-hidden="true"/><span>{anomaly.message}</span></span>)}
    {selectedId === event.id && <span className="cx-journey-selected-label">Selected event</span>}</span>
  </button>;
  };
  const copy = selected ? [`Lead ID: ${valueText(row.lead_id)}`, selected.title, selected.timestamp || 'Timestamp unavailable', `Validation: ${validation}`, 'Layer: Normalised operational evidence', selected.description, ...selected.evidenceFields.map(field => `${field.label}: ${valueText(field.value)}`)].join('\n') : '';

  return <div className="cx-ledger-journey">
    <div className="cx-journey-summary">
      <div><span>Furthest recorded stage</span><strong>{journey.currentStage?.title || 'Unavailable'}</strong></div>
      <div><span>Recorded attempts</span><strong>{journey.calls.count ?? 'Unavailable'}</strong></div>
      {journey.duration && <div><span>Observed time span</span><strong>{journey.duration.label}</strong></div>}
    </div>
    <p className="cx-journey-caption">Normalised lifecycle evidence · times in UTC. Untimed outcomes are shown separately from the observed chronology.</p>
    <div className="cx-journey-tabs" role="tablist" aria-label="Timeline views" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'journey' : event.key === 'End' ? 'events' : mode === 'journey' ? 'events' : 'journey';
      setMode(next); document.getElementById(`${id}-${next}-tab`)?.focus();
    }}>{(['journey', 'events'] as const).map(value => <button key={value} type="button" role="tab" id={`${id}-${value}-tab`} aria-selected={mode === value} aria-controls={`${id}-${value}-panel`} tabIndex={mode === value ? 0 : -1} onClick={() => setMode(value)}>{value === 'journey' ? 'Chronology' : 'Event log'}</button>)}</div>

    {!journey.timedEvents.length && <div className="cx-journey-empty"><h3>Timeline unavailable</h3><p>This lead has source records, but the current dataset does not provide enough timestamped lifecycle evidence to construct a chronological timeline.</p>{onViewSource && <button type="button" className="cx-button-secondary" onClick={() => onViewSource([])}>View source evidence</button>}</div>}
    <section className="cx-journey-forensic-canvas cx-analytical-canvas" role="tabpanel" id={`${id}-journey-panel`} aria-labelledby={`${id}-journey-tab`} hidden={mode !== 'journey'} tabIndex={0}>
      {journey.timedEvents.length > 0 ? <>
        <ol className="cx-journey-spine" aria-label="Observed chronology">{journey.timedEvents.map((event, index) => {
          const previous = journey.timedEvents[index - 1];
          const transition = journey.transitions.find(item => item.toId === event.id && item.fromId === previous?.id);
          return <li key={event.id} data-stage={event.kind} data-connector={transition?.state || (index > 0 ? 'unavailable' : 'start')}>
            {index > 0 && <span className="cx-journey-elapsed" aria-label={`${previous.title} to ${event.title}: ${transition?.label || 'Time unavailable'}`}>{transition?.label || 'Time unavailable'}</span>}
            {eventButton(event)}
          </li>;
        })}</ol>
        <p className="cx-journey-key"><span><i data-filled="true" />Observed time</span>{journey.anomalies.length > 0 && <span><AlertTriangle size={12} aria-hidden="true"/>Chronology anomaly</span>}</p>
      </> : null}
      {journey.untimedEvents.length > 0 && <section className="cx-journey-undated" aria-label="Recorded stages without timestamps"><h3>Recorded stages — time unavailable</h3><p>Lifecycle positions only. These outcomes have no known chronological order.</p><ul>{journey.untimedEvents.map(event => <li key={event.id}>{eventButton(event)}</li>)}</ul></section>}
      <details className="cx-journey-calls">
        <summary><span>Calls {journey.calls.count == null ? '· count unavailable' : `×${journey.calls.count}`}</span><small>Recorded aggregate · inspect evidence</small></summary>
        <p>{journey.calls.count == null ? 'Call count unavailable' : `${journey.calls.count} recorded attempts`}</p>
        <p>Individual timestamps unavailable. RPC attempt number unavailable.</p>
        <p>{journey.calls.limitation}</p>
        <dl>{journey.calls.evidenceFields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{valueText(field.value)}</dd></div>)}</dl>
        {onViewSource && <button type="button" className="cx-button-secondary" onClick={() => onViewSource(['HLC Total Calls', 'HLC First Call Date', 'HLC Last Call Date', 'HLC Last Dialer Status', 'HLC RPC'])}>View call source fields</button>}
      </details>
      <dl className="cx-journey-outcomes">{journey.outcomes.map(outcome => { const stage = lifecyclePresentation[timelineStages[outcome.kind]]; const Icon = stage.Icon; return <div key={outcome.kind} data-state={outcome.state}><dt><Icon size={14} aria-hidden="true" style={{ color: outcome.state === 'recorded' ? stage.color : undefined }}/>{outcome.title}</dt><dd>{outcome.state === 'recorded' ? 'Recorded' : outcome.state === 'not-recorded' ? 'Not recorded in returned evidence' : 'Evidence unavailable'}</dd></div>; })}</dl>
    </section>

    <section className="cx-journey-forensic-canvas cx-analytical-canvas" role="tabpanel" id={`${id}-events-panel`} aria-labelledby={`${id}-events-tab`} hidden={mode !== 'events'} tabIndex={0}>
      <p className="cx-journey-caption">Available snapshot milestones, not a complete call or status history.</p>
      {dates.map(date => <section className="cx-journey-date" key={date}><h3>{dateLabel(date + 'T00:00:00Z')} <small>UTC</small></h3><ol>{journey.timedEvents.filter(event => event.timestamp!.startsWith(date)).map(event => <li key={event.id}>{eventButton(event, true)}</li>)}</ol></section>)}
      {journey.untimedEvents.length > 0 && <section className="cx-journey-undated"><h3>Recorded stages — time unavailable</h3><p>These recorded outcomes have no known chronological order.</p><ul>{journey.untimedEvents.map(event => <li key={event.id}>{eventButton(event)}</li>)}</ul></section>}
    </section>

    {sourceEvents && <details className="cx-journey-context"><summary>Supporting source milestones ({sourceEvents.length})</summary><p>Scoped warehouse milestones retain their original transaction evidence. They are separate from the lead-level journey and do not establish a complete call history.</p><ol className="cx-dossier-source-events">{sourceEvents.map((event, index) => <li key={`${event.stage}-${event.timestamp}-${index}`}><strong>{event.title}</strong><time>{event.timestamp || 'Timestamp unavailable'}</time><p>{event.details}</p></li>)}</ol></details>}

    <section ref={evidence} className="cx-journey-evidence" id={`${id}-evidence`} aria-label="Selected event evidence" tabIndex={-1}>
      {selected ? <>
        <header className="cx-journey-evidence-heading"><div><span>Selected event</span><h3>{selected.title}</h3></div></header>
        <div className="cx-journey-evidence-status"><span>{selected.timestampStatus === 'observed' ? 'Observed timestamp' : 'Recorded · untimed'}</span><span className="cx-journey-evidence-state">Validation: {validation}</span></div>
        <p className="cx-journey-evidence-time">{selected.timestamp ? <time dateTime={selected.timestamp}>{dateLabel(selected.timestamp)} · {timeLabel(selected.timestamp)} UTC</time> : 'Timestamp unavailable'}</p>
        <p>{selected.description}</p>
        <section className="cx-journey-normalized-fields" aria-label="Normalized event evidence"><h4>Normalized evidence</h4><dl>{selected.evidenceFields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{valueText(field.value)}</dd></div>)}</dl></section>
        <section className="cx-journey-source-fields" aria-label="Original event source fields"><h4>Original source fields</h4><ul>{selected.sourceFields.map(field => <li key={field}>{field}</li>)}</ul></section>
        <div className="cx-journey-evidence-actions"><AuditEvidenceButton key={selected.id} compact={false} content={recordEventAuditEvidence(row, selected, journey, validationStatus, auditScope, onViewSource)} />{onViewSource && <button type="button" className="cx-button-secondary" onClick={() => onViewSource(selected.sourceFields)}>View source fields</button>}{onPinEvent && <button type="button" className="cx-button-secondary" onClick={() => onPinEvent(selected)}>Pin timeline event</button>}<CopyEvidenceButton value={copy} label="Copy evidence" /></div>
        <p className="cx-journey-caption">Layer: normalised operational evidence. Original source values remain separate; a source match is not reconciliation.</p>
      </> : <p>Select a milestone to inspect its supporting evidence.</p>}
    </section>

    {journey.anomalies.length > 0 && <section className="cx-journey-anomalies" aria-label="Timeline anomalies"><h3>Timestamp anomalies</h3>{journey.anomalies.map((anomaly, index) => <p key={index}><strong>{anomaly.field}</strong>: {valueText(anomaly.value)} — {anomaly.message}</p>)}</section>}
    <details className="cx-journey-context"><summary>Record context &amp; evidence limitations</summary><p>Representative vendor and disposition describe the returned row, not ownership or a specific attempt at every milestone.</p><dl>{['vendor', 'transaction_id', 'source', 'offershop_source', 'last_dialer_status', 'grade', 'vetting'].filter(field => row[field] != null && row[field] !== '').map(field => <div key={field}><dt>{field.replaceAll('_', ' ')}</dt><dd>{String(row[field])}</dd></div>)}</dl><p>Stage ownership and agent handoffs are unavailable in the loaded analytical evidence.</p><ul>{journey.limitations.map(limitation => <li key={limitation}>{limitation}</li>)}</ul></details>
  </div>;
}
