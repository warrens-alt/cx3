import React, { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Circle, Clock3 } from 'lucide-react';

export interface EvidenceTimelineEvent {
  key: string; label: string; value: string; detail?: string; elapsed?: string;
  state: 'observed' | 'untimed' | 'unavailable' | 'anomaly';
  Icon?: LucideIcon; color?: string; selected?: boolean;
}
/** Ordered evidence, not a continuous time scale. Elapsed labels must be supplied observations. */
export default function EvidenceTimeline({ title, events, onSelect }: {
  title: string; events: EvidenceTimelineEvent[]; onSelect?: (key: string) => void;
}) {
  const id = useId();
  return <ol className="cx-evidence-timeline" aria-label={title} id={id}>
    {events.map(event => {
      const Icon = event.Icon || (event.state === 'anomaly' ? AlertTriangle : event.state === 'unavailable' ? Circle : Clock3);
      const content = <><span className="cx-evidence-timeline-node" aria-hidden="true"><Icon size={18} /></span>
        <span className="cx-evidence-timeline-copy"><span className="cx-evidence-timeline-label">{event.label}</span><strong>{event.value}</strong>{event.detail && <small>{event.detail}</small>}
          {event.state === 'untimed' && <small>Recorded · timestamp unavailable</small>}
          {event.state === 'anomaly' && <small>Chronology anomaly</small>}
        </span></>;
      return <li key={event.key} data-evidence={event.state === 'unavailable' ? 'unavailable' : 'returned'} data-state={event.state} data-selected={event.selected || undefined} style={{ '--cx-event-color': event.color || 'var(--cx-text-muted)' } as React.CSSProperties}>
        {onSelect ? <button type="button" aria-pressed={event.selected} onClick={() => onSelect(event.key)}>{content}</button> : <div>{content}</div>}
        {event.elapsed && <span className="cx-evidence-timeline-elapsed">{event.elapsed}</span>}
      </li>;
    })}
  </ol>;
}
