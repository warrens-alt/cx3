import React, { useId } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { formatTableNumber } from '../../lib/formatters';

export interface EvidenceBarItem {
  key: string;
  label: string;
  value: number | null | undefined;
  displayValue?: string;
  detail?: string;
  color?: string;
  appearance?: 'unrecorded' | 'invalid' | 'queue';
}

/** Geometry only. Never substitute zero for absent evidence or inflate a small bar. */
export function evidenceBarWidth(value: number | null | undefined, maximum: number): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (value === 0) return 0;
  return Number.isFinite(maximum) && maximum > 0 ? Math.min(100, value / maximum * 100) : null;
}

export default function EvidenceBars({ title, description, items, onSelect, maximum, scaleNote, centered = false, selectedKey, highlightedKey, onHighlight, selectionLabel = 'Inspect', hideHeading = false }: {
  title: string;
  description: string;
  items: EvidenceBarItem[];
  onSelect?: (key: string) => void;
  maximum?: number;
  scaleNote?: string;
  centered?: boolean;
  selectedKey?: string | null;
  highlightedKey?: string | null;
  onHighlight?: (key: string | null) => void;
  selectionLabel?: string;
  hideHeading?: boolean;
}) {
  const id = useId();
  const scale = maximum ?? Math.max(0, ...items.map(item =>
    typeof item.value === 'number' && Number.isFinite(item.value) && item.value >= 0 ? item.value : 0));
  return <section className="cx-evidence-bars" aria-labelledby={`${id}-title`}>
    <header className={hideHeading ? 'sr-only' : 'cx-viz-panel-heading'}><div><h3 id={`${id}-title`}>{title}</h3><p id={`${id}-description`}>{description}</p></div></header>
    {!items.length ? <p className="cx-viz-empty">No observations returned for this selection.</p> :
      <ul className={centered ? 'cx-evidence-bar-list is-centered' : 'cx-evidence-bar-list'} aria-describedby={`${id}-description`}>
        {items.map(item => {
          const width = evidenceBarWidth(item.value, scale);
          const value = width === null ? 'Unavailable' : item.displayValue ?? formatTableNumber(item.value);
          const content = <>
            <span className="cx-evidence-bar-label">{item.label}{item.detail && <small>{item.detail}</small>}</span>
            <span className="cx-evidence-bar-track" data-appearance={item.appearance} aria-hidden="true" data-state={width === null ? 'unknown' : width === 0 ? 'zero' : 'observed'}>
              {width !== null && <span className="cx-evidence-bar-fill" style={{ width: `${width}%`, background: item.color || 'var(--cx-action)' }} />}
            </span>
            <span className="cx-evidence-bar-value">{value}{onSelect && (selectionLabel === 'Select' ? selectedKey === item.key && <Check size={13} aria-hidden="true" /> : <ArrowUpRight size={13} aria-hidden="true" />)}</span>
          </>;
          const highlighted = highlightedKey ?? selectedKey;
          return <li key={item.key} data-selected={selectedKey === item.key || undefined} data-highlighted={highlighted === item.key || undefined} data-dimmed={Boolean(highlighted && highlighted !== item.key) || undefined}
            onMouseEnter={onHighlight ? () => onHighlight(item.key) : undefined} onMouseLeave={onHighlight ? () => onHighlight(null) : undefined}>
            {onSelect ? <button type="button" className="cx-evidence-bar-row" onClick={() => onSelect(item.key)} aria-label={`${selectionLabel} ${item.label}: ${value}`}
              aria-pressed={selectedKey !== undefined ? selectedKey === item.key : undefined} onFocus={onHighlight ? () => onHighlight(item.key) : undefined} onBlur={onHighlight ? () => onHighlight(null) : undefined}>
            {content}
          </button> : <div className="cx-evidence-bar-row">{content}</div>}</li>;
        })}
      </ul>}
    {scaleNote && <p className="cx-viz-footnote">{scaleNote}</p>}
  </section>;
}
