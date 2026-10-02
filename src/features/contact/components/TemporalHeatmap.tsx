import React, { useState } from 'react';
import ChartFrame from '../../../shared/visuals/ChartFrame';
import ReportingScopeSummary from '../../../shared/reporting/ReportingScopeSummary';
import { formatPercent, formatTableNumber } from '../../../lib/formatters';
import type { TemporalData } from '../../../lib/offernetClient';

export type TemporalMetric = 'contactRate' | 'saleRate' | 'activationRate' | 'volume';
export const temporalMetricLabels: Record<TemporalMetric, string> = {
  contactRate: 'RPC rate', saleRate: 'Sale rate', activationRate: 'Activation / sale', volume: 'Volume',
};
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hours = Array.from({ length: 24 }, (_, index) => index);
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const formatValue = (value: number | null | undefined, metric: TemporalMetric) => value == null || !Number.isFinite(value)
  ? 'Unavailable' : metric === 'volume' ? formatTableNumber(value) : formatPercent(value, metric === 'saleRate' ? 2 : 1);

/** Visual intensity only. Null and observed zero remain different states. */
export function temporalIntensity(value: number | null | undefined, maximum: number): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (value === 0) return 0;
  return Math.max(1, Math.min(5, Math.ceil(value / Math.max(maximum, value) * 5)));
}

/** Overlay hourly overlap with the returned schedule; it does not classify individual events. */
export function operatingHourCoverage(context: TemporalData['operatingContext'], day: number, hour: number): 'inside' | 'partial' | 'outside' | 'unavailable' {
  const parseMinute = (value: string) => {
    if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) return NaN;
    const hour = Number(value.slice(0, 2));
    const minute = Number(value.slice(3, 5));
    return hour < 24 && minute < 60 ? hour * 60 + minute : NaN;
  };
  if (!context || !Array.isArray(context.workdays)) return 'unavailable';
  const start = parseMinute(context.start);
  const end = parseMinute(context.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1440 || start >= end) return 'unavailable';
  if (!context.workdays.includes(day)) return 'outside';
  const overlap = Math.max(0, Math.min((hour + 1) * 60, end) - Math.max(hour * 60, start));
  return overlap === 60 ? 'inside' : overlap > 0 ? 'partial' : 'outside';
}

export default function TemporalHeatmap({ rows, metric, basis, operatingContext, controls }: {
  rows: TemporalData['heatmap']; metric: TemporalMetric; basis: string; operatingContext?: TemporalData['operatingContext']; controls?: React.ReactNode;
}) {
  const [selectedKey, setSelectedKey] = useState('Monday-0');
  const cells = new Map(rows.map(row => [`${row.dayName}-${row.hour}`, row]));
  const observedValues = rows.map(row => row[metric]).filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
  const maximum = Math.max(0, ...observedValues);
  const selected = cells.get(selectedKey);
  const [selectedDay, selectedHour] = selectedKey.split('-');
  const label = temporalMetricLabels[metric];
  const operatingAvailable = operatingHourCoverage(operatingContext, 1, 0) !== 'unavailable';
  const selectedWindow = operatingHourCoverage(operatingContext, days.indexOf(selectedDay) + 1, Number(selectedHour));
  const moveCell = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -24, ArrowDown: 24 };
    const next = event.key === 'Home' ? index - index % 24 : event.key === 'End' ? index - index % 24 + 23 : offsets[event.key] == null ? null : index + offsets[event.key];
    if (next === null) return;
    event.preventDefault();
    if (next >= 0 && next < 168) event.currentTarget.closest('.cx-temporal-grid')?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };

  return <div id="temporal-matrix"><ChartFrame className="cx-temporal-hero" title="Day × hour matrix"
    subtitle={`${basis} time · ${operatingContext?.timezone || 'Tenant timezone unavailable'}`}
    controls={controls} scope={<ReportingScopeSummary />}
    footer="Arrow keys move between cells · exact observations below">
    <div className="cx-temporal-legend" aria-label="Heatmap legend">
      <span>Observed zero</span><i data-level="0" aria-hidden="true" />
      <span>Low</span>{[1, 2, 3, 4, 5].map(level => <i data-level={level} key={level} aria-hidden="true" />)}<span>{observedValues.length ? `${formatValue(maximum, metric)} max` : 'No observed values'}</span>
      <i data-empty="true" aria-hidden="true" /><span>Unavailable</span>
    </div>
    <p className="cx-temporal-operating-note">{operatingAvailable ? <><span aria-hidden="true" className="cx-operating-key" /> {operatingContext!.start}–{operatingContext!.end} operating hours · dotted edge = partial hour.</> : 'Operating-hours overlay unavailable.'}</p>
    <div className="cx-temporal-scroll" role="region" aria-label="Day and hour performance matrix. Use arrow keys to inspect adjacent cells." tabIndex={0}>
      <div className="cx-temporal-grid">
        <div className="cx-temporal-corner">Day / hour</div>
        {hours.map(hour => <div key={hour} className="cx-temporal-hour" data-selected={Number(selectedHour) === hour} aria-label={`${hourLabel(hour)}${Number(selectedHour) === hour ? ' · selected hour' : ''}`}>{String(hour).padStart(2, '0')}</div>)}
        {days.map((day, dayIndex) => <React.Fragment key={day}>
          <div className="cx-temporal-day" data-selected={selectedDay === day} aria-label={`${day}${selectedDay === day ? ' · selected day' : ''}`}>{day.slice(0, 3)}</div>
          {hours.map(hour => {
            const key = `${day}-${hour}`;
            const row = cells.get(key);
            const value = row?.[metric];
            const intensity = temporalIntensity(value, maximum);
            const text = `${day} ${hourLabel(hour)} · ${label}: ${formatValue(value, metric)} · Leads: ${formatTableNumber(row?.volume)} · RPC rate: ${formatPercent(row?.contactRate)} · Sale rate: ${formatPercent(row?.saleRate, 2)}`;
            return <button type="button" key={key} className="cx-temporal-cell" data-empty={intensity === null} data-level={intensity ?? undefined}
              data-operating={operatingHourCoverage(operatingContext, dayIndex + 1, hour)} data-selected={selectedKey === key}
              data-selected-day={selectedDay === day} data-selected-hour={Number(selectedHour) === hour}
              aria-label={text} aria-pressed={selectedKey === key} title={text} tabIndex={selectedKey === key ? 0 : -1}
              onFocus={() => setSelectedKey(key)} onClick={() => setSelectedKey(key)} onKeyDown={event => moveCell(event, dayIndex * 24 + hour)}>
              {intensity === null ? '—' : metric === 'volume' ? formatTableNumber(value) : formatPercent(value, 0)}
            </button>;
          })}
        </React.Fragment>)}
      </div>
    </div>
    <section className="cx-temporal-cell-detail" role="status" aria-live="polite" aria-label="Selected time window">
      <div className="cx-temporal-selection-title"><span>Selected window</span><strong>{selectedDay} · {hourLabel(Number(selectedHour))}–{hourLabel((Number(selectedHour) + 1) % 24)}</strong><small>{basis} time · {operatingContext?.timezone || 'Timezone unavailable'}</small></div>
      <dl>
        <div><dt>Leads</dt><dd>{formatTableNumber(selected?.volume)}</dd></div>
        <div><dt>RPC rate</dt><dd>{formatValue(selected?.contactRate, 'contactRate')}</dd></div>
        <div><dt>Sale rate</dt><dd>{formatValue(selected?.saleRate, 'saleRate')}</dd></div>
        {metric === 'activationRate' && <div><dt>Activation / sale</dt><dd>{formatValue(selected?.activationRate, 'activationRate')}</dd></div>}
        <div><dt>Operating window</dt><dd>{selectedWindow === 'inside' ? 'Inside' : selectedWindow === 'partial' ? 'Partial hour' : selectedWindow === 'outside' ? 'Outside' : 'Unavailable'}</dd></div>
      </dl>
    </section>
  </ChartFrame></div>;
}
