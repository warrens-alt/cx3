import React, { useId } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { formatTableNumber } from '../../lib/formatters';

export interface EvidenceBarItem {
  key: string;
  label: string;
  value: number | null | undefined;
  displayValue?: string;
  detail?: string;
  color?: string;
}

/** Geometry only. Never substitute zero for absent evidence or inflate a small bar. */
export function evidenceBarWidth(value: number | null | undefined, maximum: number): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (value === 0) return 0;
  return Number.isFinite(maximum) && maximum > 0 ? Math.min(100, value / maximum * 100) : null;
}

export default function EvidenceBars({ title, description, items, onSelect, maximum, scaleNote, centered = false }: {
  title: string;
  description: string;
  items: EvidenceBarItem[];
  onSelect?: (key: string) => void;
  maximum?: number;
  scaleNote?: string;
  centered?: boolean;
}) {
  const id = useId();
  const scale = maximum ?? Math.max(0, ...items.map(item =>
    typeof item.value === 'number' && Number.isFinite(item.value) && item.value >= 0 ? item.value : 0));
  return <section className="cx-evidence-bars" aria-labelledby={`${id}-title`}>
    <header className="cx-viz-panel-heading"><div><h3 id={`${id}-title`}>{title}</h3><p id={`${id}-description`}>{description}</p></div></header>
    {!items.length ? <p className="cx-viz-empty">No observations returned for this selection.</p> :
      <ul className={centered ? 'cx-evidence-bar-list is-centered' : 'cx-evidence-bar-list'} aria-describedby={`${id}-description`}>
        {items.map(item => {
          const width = evidenceBarWidth(item.value, scale);
          const value = width === null ? 'Unavailable' : item.displayValue ?? formatTableNumber(item.value);
          const content = <>
            <span className="cx-evidence-bar-label">{item.label}{item.detail && <small>{item.detail}</small>}</span>
            <span className="cx-evidence-bar-track" aria-hidden="true" data-state={width === null ? 'unknown' : width === 0 ? 'zero' : 'observed'}>
              {width !== null && <span className="cx-evidence-bar-fill" style={{ width: `${width}%`, background: item.color || 'var(--cx-action)' }} />}
            </span>
            <span className="cx-evidence-bar-value">{value}{onSelect && <ArrowUpRight size={13} aria-hidden="true" />}</span>
          </>;
          return <li key={item.key}>{onSelect ? <button type="button" className="cx-evidence-bar-row" onClick={() => onSelect(item.key)} aria-label={`Inspect ${item.label}: ${value}`}>
            {content}
          </button> : <div className="cx-evidence-bar-row">{content}</div>}</li>;
        })}
      </ul>}
    {scaleNote && <p className="cx-viz-footnote">{scaleNote}</p>}
  </section>;
}
