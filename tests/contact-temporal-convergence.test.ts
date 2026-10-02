import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CallEffortDistribution from '../src/features/contact/components/CallEffortDistribution';
import LatencyDistribution, { latencyAppearance } from '../src/features/contact/components/LatencyDistribution';
import TemporalHeatmap, { operatingHourCoverage, temporalIntensity } from '../src/features/contact/components/TemporalHeatmap';
import type { ContactStrategyData, SpeedToLeadData, TemporalData } from '../src/lib/offernetClient';

const render = (component: React.ReactNode) => renderToStaticMarkup(component);
const row = { dayIndex: 1, dayName: 'Monday', hour: 8, volume: 12, contactRate: 42.1, saleRate: 3.21, activationRate: null };
const operatingContext = { timezone: 'Africa/Johannesburg', start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };

test('call-effort unrecorded count has a distinct appearance and keeps exact zero in its own row', () => {
  const rows = [{ bucket: '0 calls', leads: 0, contactRate: null, saleRate: 0 }, { bucket: 'Unrecorded', leads: 11, contactRate: null, saleRate: null }] as ContactStrategyData['attemptPerformance'];
  const html = render(React.createElement(CallEffortDistribution, { rows }));
  assert.match(html, /data-appearance="unrecorded"/);
  assert.match(html, /data-state="zero"/);
  assert.match(html, /Call count unavailable/);
  assert.match(html, /RPC .*Sale 0.00%/);
  assert.match(html, />11</);
});

test('latency distribution retains invalid and undialled cohorts alongside returned timed cohorts', () => {
  const rows = ['0–5 min', '24+ hrs', 'Undialled', 'Invalid / unrecorded timing'].map((cohort, i) => ({ cohort, leads: i, contactRate: null, saleRate: i === 0 ? 0 : null })) as SpeedToLeadData['cohorts'];
  const before = JSON.stringify(rows);
  const html = render(React.createElement(LatencyDistribution, { rows }));
  for (const row of rows) assert.ok(html.includes(row.cohort));
  assert.match(html, /data-appearance="queue"/);
  assert.match(html, /data-appearance="invalid"/);
  assert.match(html, /Capture to first dial/);
  assert.match(html, /aria-label="Latency distribution measure"/);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(latencyAppearance('24+ hrs'), undefined);
  assert.equal(latencyAppearance('Unrecorded latency'), 'unrecorded');
});

test('temporal intensity keeps unavailable, zero, and returned rate above 100 distinct', () => {
  for (const value of [null, undefined, NaN, Infinity, -1]) assert.equal(temporalIntensity(value, 100), null);
  assert.equal(temporalIntensity(0, 100), 0);
  assert.equal(temporalIntensity(0.1, 100), 1);
  assert.equal(temporalIntensity(100, 250), 2);
  assert.equal(temporalIntensity(250, 250), 5);
});

test('operating overlay marks partial hours and preserves unavailable configurations', () => {
  assert.equal(operatingHourCoverage(operatingContext, 1, 7), 'outside');
  assert.equal(operatingHourCoverage(operatingContext, 1, 8), 'inside');
  assert.equal(operatingHourCoverage(operatingContext, 1, 17), 'partial');
  assert.equal(operatingHourCoverage(operatingContext, 1, 18), 'outside');
  assert.equal(operatingHourCoverage(operatingContext, 7, 8), 'outside');
  assert.equal(operatingHourCoverage(undefined, 1, 8), 'unavailable');
  assert.equal(operatingHourCoverage({ ...operatingContext, start: '18:00', end: '08:00' }, 1, 8), 'unavailable');
  assert.equal(operatingHourCoverage({ ...operatingContext, end: '17:99' }, 1, 8), 'unavailable');
});

test('temporal heatmap has 168 keyboard-selectable cells and exact accessible values without filling missing data', () => {
  const rows: TemporalData['heatmap'] = [row, { ...row, hour: 9, contactRate: 0, volume: 0 }];
  const before = JSON.stringify(rows);
  const html = render(React.createElement(TemporalHeatmap, { rows, metric: 'contactRate', basis: 'Capture', operatingContext }));
  assert.equal((html.match(/class="cx-temporal-cell"/g) || []).length, 168);
  assert.equal((html.match(/data-empty="true"/g) || []).length, 167); // 166 missing cells plus legend.
  assert.equal((html.match(/tabindex="0"/g) || []).length, 2); // Scrolling region and roving active cell.
  assert.match(html, /Monday 08:00 · RPC rate: 42.1%/);
  assert.match(html, /Sale rate: 3.21%/);
  assert.match(html, /Monday 09:00 · RPC rate: 0.0%/);
  assert.match(html, /Monday 10:00 · RPC rate: Unavailable/);
  assert.match(html, /Africa\/Johannesburg/);
  assert.match(html, /data-operating="partial"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.equal(JSON.stringify(rows), before);
});

test('empty heatmap has an intentional unavailable state and no invented zero cells', () => {
  const html = render(React.createElement(TemporalHeatmap, { rows: [], metric: 'volume', basis: 'First dial' }));
  assert.equal((html.match(/data-empty="true"/g) || []).length, 169); // 168 cells plus legend.
  assert.doesNotMatch(html, /data-operating="inside"/);
  assert.match(html, /Operating-hours overlay unavailable/);
  assert.match(html, /Tenant timezone unavailable/);
  assert.match(html, /No observed values/);
  assert.doesNotMatch(html, />0 max</);
});
