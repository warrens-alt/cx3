import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperatingControlsResult } from '../../server/analytics/contact/operatingControls';

test('operating-controls: normal population returns precise rates and durations', () => {
  const row = {
    total_leads: 500,
    delivered_leads: 480,
    dialled_leads: 400,
    one_call_leads: 100,
    multi_call_leads: 300,
    high_attempt_no_rpc_leads: 20,
    disposition_complete_leads: 380,
    after_hours_leads: 100,
    after_hours_rpc: 30,
    after_hours_sales: 5,
    operating_hours_leads: 400,
    operating_hours_rpc: 200,
    operating_hours_sales: 30,
    weekend_leads: 50,
    sla_15m_leads: 360,
    sla_60m_leads: 420,
    capture_sla_15m_leads: 300,
    capture_sla_60m_leads: 400,
    awaiting_first_dial: 80,
    oldest_delivery_wait_sec: 1800,
    capture_to_dial_median_sec: 240,
    capture_to_dial_p90_sec: 1200,
    activation_backlog_14d: 15,
    attempts: [
      { bucket: '1 call', leads: 100, contacted: 25, sales: 2 },
      { bucket: '2-4 calls', leads: 250, contacted: 150, sales: 20 },
      { bucket: '5+ calls', leads: 50, contacted: 10, sales: 1 },
    ],
    sla_bands: [
      { band: '0-15m', leads: 300, contacted: 180, sales: 25 },
      { band: '15-60m', leads: 100, contacted: 40, sales: 5 },
      { band: '60m+', leads: 100, contacted: 20, sales: 2 },
    ],
    daily_turnaround: [
      { date: '2026-09-20', leads: 200, dialled: 190, undialled: 10, median_sec: 300, p90_sec: 900, within_15m: 160, within_60m: 185 },
    ],
    vendor_controls: [
      { vendor: 'Vendor A', dialled: 200, delivered: 220, leads: 250, contacted: 120, sales: 15, one_call_leads: 40, missing_disposition: 10, sla_15m_leads: 180, median_first_dial_sec: 240 },
    ],
  };

  const clientConfig = { timezone: 'Africa/Johannesburg' };
  const operating = { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };

  const result = buildOperatingControlsResult(row, clientConfig, operating);

  assert.equal(result.summary.totalLeads, 500);
  assert.equal(result.summary.singleAttemptSharePct, 25.0); // 100 / 400 dialled = 25.0%
  assert.equal(result.summary.multiAttemptSharePct, 75.0);  // 300 / 400 dialled = 75.0%
  assert.equal(result.summary.dispositionCompletenessPct, 95.0); // 380 / 400 dialled = 95.0%
  assert.equal(result.summary.afterHoursSharePct, 20.0);   // 100 / 500 = 20.0%
  assert.equal(result.summary.weekendSharePct, 10.0);      // 50 / 500 = 10.0%
  assert.equal(result.summary.sla15Rate, 75.0);            // 360 / 480 delivered = 75.0%
  assert.equal(result.summary.captureToDialMedian, '4m');
  assert.equal(result.summary.captureToDialP90, '20m');
  assert.equal(result.summary.oldestDeliveryWait, '30m');

  // Vendor controls
  const vA = result.vendorControls[0];
  assert.equal(vA.vendor, 'Vendor A');
  assert.equal(vA.oneCallSharePct, 20.0); // 40 / 200 dialled
  assert.equal(vA.sla15Rate, 81.8);       // 180 / 220 delivered
  assert.equal(vA.rpcRate, 60.0);         // 120 / 200 dialled
  assert.equal(vA.leadToSaleRate, 6.0);   // 15 / 250 leads
  assert.equal(vA.medianFirstDial, '4m');
});

test('operating-controls: empty/zero population returns null rates and dash latency', () => {
  const row = {
    total_leads: 0,
    delivered_leads: 0,
    dialled_leads: 0,
    one_call_leads: 0,
    multi_call_leads: 0,
    high_attempt_no_rpc_leads: 0,
    disposition_complete_leads: 0,
    after_hours_leads: 0,
    weekend_leads: 0,
    sla_15m_leads: 0,
    capture_to_dial_median_sec: null,
    capture_to_dial_p90_sec: null,
    oldest_delivery_wait_sec: null,
    attempts: [],
    sla_bands: [],
    daily_turnaround: [],
    vendor_controls: [],
  };

  const clientConfig = { timezone: 'Africa/Johannesburg' };
  const operating = { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };

  const result = buildOperatingControlsResult(row, clientConfig, operating);

  assert.equal(result.summary.singleAttemptSharePct, null);
  assert.equal(result.summary.multiAttemptSharePct, null);
  assert.equal(result.summary.dispositionCompletenessPct, null);
  assert.equal(result.summary.afterHoursSharePct, null);
  assert.equal(result.summary.sla15Rate, null);
  assert.equal(result.summary.captureToDialMedian, '—');
  assert.equal(result.summary.captureToDialP90, '—');
  assert.equal(result.summary.oldestDeliveryWait, '—');
});
