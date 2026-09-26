import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPercent, formatRatioPercent, formatTableNumber } from '../src/lib/formatters';
import { formatOperatingWindow, sumRecordedValues } from '../src/lib/metricPresentation';

test('unknown telemetry cannot become a complete total or a zero percentage', () => {
  assert.equal(sumRecordedValues([12, null, 3]), null);
  assert.equal(sumRecordedValues([12, undefined]), null);
  assert.equal(sumRecordedValues([12, Number.NaN]), null);
  assert.equal(sumRecordedValues([]), null);
  assert.equal(formatTableNumber(sumRecordedValues([12, null])), '—');
  assert.equal(formatRatioPercent(null, 20), '—');
  assert.equal(formatRatioPercent(0, 0), '—');
});

test('recorded zeros and percentages below one remain measured values', () => {
  assert.equal(sumRecordedValues([0, 0]), 0);
  assert.equal(sumRecordedValues([12, 0, 3]), 15);
  assert.equal(formatTableNumber(0), '0');
  assert.equal(formatPercent(0), '0.0%');
  assert.equal(formatPercent(0.5), '0.5%');
  assert.equal(formatRatioPercent(1, 200), '0.5%');
  assert.equal(formatPercent(null), '—');
});

test('operating windows expose configured ISO weekdays, exact hours and timezone', () => {
  assert.equal(formatOperatingWindow({ start: '08:00', end: '18:00', timezone: 'Africa/Johannesburg', workdays: [1, 2, 3, 4, 5, 6] }), 'Mon–Sat · 08:00–18:00 (Africa/Johannesburg)');
  assert.equal(formatOperatingWindow({ start: '08:30', end: '17:00', timezone: 'Africa/Johannesburg', workdays: [5, 1, 3, 1, 7] }), 'Mon, Wed, Fri, Sun · 08:30–17:00 (Africa/Johannesburg)');
  assert.equal(formatOperatingWindow({ start: '09:00', end: '16:00', timezone: 'UTC', workdays: [] }), 'No configured workdays · 09:00–16:00 (UTC)');
});
