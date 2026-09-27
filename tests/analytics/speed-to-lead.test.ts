import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpeedToLeadResult } from '../../server/analytics/contact/speedToLead';

test('speed-to-lead: normal cohorts and percentiles return precise timings and rates', () => {
  const data = {
    percentiles: {
      avg_cap_fetch: 15,
      med_cap_fetch: 10,
      p75_cap_fetch: 20,
      p90_cap_fetch: 35,
      avg_deliv_dial: 120,
      med_deliv_dial: 90,
      p75_deliv_dial: 300,
      p90_deliv_dial: 600,
    },
    cohorts: [
      { age_cohort: '0-5m', leads: 400, contacted: 240, sales: 30, activations: 21 },
      { age_cohort: '5-15m', leads: 200, contacted: 90, sales: 8, activations: 5 },
    ],
    after_hours: [
      { is_after_hours: false, leads: 500, contacted: 300, sales: 35, avg_dial_sec: 180 },
      { is_after_hours: true, leads: 100, contacted: 30, sales: 3, avg_dial_sec: 7200 },
    ],
  };

  const clientConfig = { timezone: 'Africa/Johannesburg' };
  const operating = { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };

  const result = buildSpeedToLeadResult(data, clientConfig, operating);

  // Timing stages
  const capFetch = result.timingStages.find(s => s.stage === 'Capture → Delivery Attempt' || s.stage === 'Capture → Fetch')!;
  assert.equal(capFetch.medianSec, 10);
  assert.equal(capFetch.median, '10s');
  assert.equal(capFetch.p90, '35s');

  const delivDial = result.timingStages.find(s => s.stage === 'Delivery → First Dial')!;
  assert.equal(delivDial.avgSec, 120);
  assert.equal(delivDial.avg, '2m');
  assert.equal(delivDial.p90, '10m');

  // Cohorts
  const c1 = result.cohorts[0];
  assert.equal(c1.contactRate, 60.0); // 240 / 400 = 60.0%
  assert.equal(c1.saleRate, 7.5);     // 30 / 400 = 7.50%
  assert.equal(c1.activationRate, 70.0); // 21 / 30 = 70.0%

  // After hours
  assert.equal(result.afterHours[0].avgTimeToFirstDial, '3m');
  assert.equal(result.afterHours[1].avgTimeToFirstDial, '2.0h');
});

test('speed-to-lead: null timestamps and zero cohorts do not produce false 0s', () => {
  const data = {
    percentiles: {
      avg_cap_fetch: null,
      med_cap_fetch: null,
      p75_cap_fetch: null,
      p90_cap_fetch: null,
      avg_deliv_dial: null,
      med_deliv_dial: null,
      p75_deliv_dial: null,
      p90_deliv_dial: null,
    },
    cohorts: [
      { age_cohort: 'empty', leads: 0, contacted: 0, sales: 0, activations: 0 },
    ],
    after_hours: [
      { is_after_hours: true, leads: 0, contacted: 0, sales: 0, avg_dial_sec: null },
    ],
  };

  const clientConfig = { timezone: 'Africa/Johannesburg' };
  const operating = { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };

  const result = buildSpeedToLeadResult(data, clientConfig, operating);

  const capFetch = result.timingStages.find(s => s.stage === 'Capture → Delivery Attempt' || s.stage === 'Capture → Fetch')!;
  assert.equal(capFetch.avgSec, null);
  assert.equal(capFetch.avg, '—');
  assert.equal(capFetch.median, '—');

  // Empty cohorts return null rates, never 0%
  assert.equal(result.cohorts[0].contactRate, null);
  assert.equal(result.cohorts[0].saleRate, null);
  assert.equal(result.cohorts[0].activationRate, null);

  assert.equal(result.afterHours[0].contactRate, null);
  assert.equal(result.afterHours[0].avgTimeToFirstDial, '—');
});
