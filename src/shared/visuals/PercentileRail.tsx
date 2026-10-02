import React, { useId } from 'react';

export interface PercentilePoint { key: string; label: string; value?: number | null; displayValue?: string }
const hasDisplay = (value?: string) => Boolean(value && !/^(?:unavailable|not recorded|[—–-])$/i.test(value.trim()));
const observed = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Only numeric returned observations determine position; missing percentiles are never estimated. */
export default function PercentileRail({ title, description, points, unitLabel = '' }: {
  title: string; description?: string; points: PercentilePoint[]; unitLabel?: string;
}) {
  const id = useId();
  const numeric = points.filter(point => observed(point.value));
  const maximum = Math.max(0, ...numeric.map(point => point.value!));
  const scaled = numeric.length > 0 && points.every(point => observed(point.value) || !hasDisplay(point.displayValue));
  return <section className="cx-percentile-rail" aria-labelledby={id}>
    <header className="cx-viz-panel-heading"><div><h3 id={id}>{title}</h3>{description && <p>{description}</p>}</div></header>
    {scaled && <div className="cx-percentile-scale" aria-hidden="true">
      <div className="cx-percentile-axis"><span>Fast · 0{unitLabel}</span><span>Slow · {maximum}{unitLabel}</span></div>
      <div className="cx-percentile-track">{numeric.map((point, index) => <span className="cx-percentile-mark" key={point.key} style={{ left: `${maximum > 0 ? point.value! / maximum * 100 : 0}%`, top: `${index * 5}px` }} title={`${point.label}: ${point.displayValue || `${point.value}${unitLabel}`}`} />)}</div>
    </div>}
    <dl className="cx-percentile-values">{points.map(point => <div key={point.key} data-state={observed(point.value) || hasDisplay(point.displayValue) ? 'observed' : 'unavailable'}>
      <dt>{point.label}</dt><dd>{(hasDisplay(point.displayValue) ? point.displayValue : null) || (observed(point.value) ? `${point.value}${unitLabel}` : 'Unavailable')}</dd>
    </div>)}</dl>
    {!scaled && <p className="cx-viz-footnote">Reported percentiles · spacing is not a time scale.</p>}
  </section>;
}
