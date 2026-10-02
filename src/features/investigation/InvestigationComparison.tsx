import React from 'react';
import { formatTableNumber } from '../../lib/formatters';

type Period = { startDate: string; endDate: string };
const available = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const windowText = (window?: Period) => window ? `${window.startDate} – ${window.endDate}` : 'Period not supplied';

/** Two observed period values only. No interpolated daily points or inferred comparison. */
export default function InvestigationComparison({ label, current, previous, suffix, currentWindow, previousWindow }: {
  label: string; current: number | null | undefined; previous: number | null | undefined; suffix: string;
  currentWindow?: Period; previousWindow?: Period;
}) {
  const values = [current, previous].filter(available);
  const maximum = Math.max(1, ...values.map(Math.abs));
  const signed = values.some(value => value < 0);
  const rows = [{ key: 'current', label: 'Current period', value: current, window: currentWindow }, { key: 'previous', label: 'Matched previous', value: previous, window: previousWindow }];
  const display = (value: number | null | undefined) => available(value) ? `${formatTableNumber(value)}${suffix}` : 'Unavailable';
  return <figure className="cx-investigation-comparison" aria-label={`${label}: matched-period comparison`}>
    <figcaption><strong>Matched-period comparison</strong><span>Returned period values · daily comparison points are not supplied</span></figcaption>
    <div className="cx-investigation-comparison-plot" data-signed={signed}>
      {rows.map(row => <div className="cx-investigation-comparison-row" key={row.key} data-period={row.key} data-state={!available(row.value) ? 'unavailable' : row.value === 0 ? 'zero' : 'observed'}>
        <div><span>{row.label}</span><small>{windowText(row.window)}</small></div>
        <div className="cx-investigation-comparison-mark" tabIndex={0} role="img" aria-label={`${row.label}: ${display(row.value)}; ${windowText(row.window)}`} title={`${row.label}: ${display(row.value)} · ${windowText(row.window)}`}>
          <div className="cx-investigation-comparison-track" aria-hidden="true">{available(row.value) && <i style={{ width: `${Math.abs(row.value) / maximum * (signed ? 50 : 100)}%`, left: signed ? `${row.value < 0 ? 50 - Math.abs(row.value) / maximum * 50 : 50}%` : '0%' }} />}</div>
        </div>
        <strong>{display(row.value)}</strong>
      </div>)}
    </div>
    <details className="cx-investigation-comparison-table"><summary>Exact comparison values</summary><table><caption>{label} · returned values</caption><thead><tr><th scope="col">Period</th><th scope="col">Dates</th><th scope="col">Value</th></tr></thead><tbody>{rows.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{windowText(row.window)}</td><td>{display(row.value)}</td></tr>)}</tbody></table></details>
  </figure>;
}
