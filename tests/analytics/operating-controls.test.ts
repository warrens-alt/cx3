import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperatingControlsQuery, buildOperatingControlsResult } from '../../server/analytics/contact/operatingControls';
import { operationalLeadCtes } from '../../server/analytics/common/leadMetrics';

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

const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-30' };
const operating = { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };

test('operating-controls: canonical normalization preserves unrecorded, zero and maximum cumulative call counts', () => {
  const { query } = buildOperatingControlsQuery(scope);
  assert.ok(query.includes(`WITH ${operationalLeadCtes(scope)},`));
  assert.match(query, /CASE WHEN SAFE_CAST\(hlc.total_calls AS INT64\) >= 0 THEN SAFE_CAST\(hlc.total_calls AS INT64\) END AS total_calls/);
  assert.match(query, /MAX\(total_calls\) AS recorded_call_count/);
  assert.doesNotMatch(query, /COALESCE\(SAFE_CAST\(hlc.total_calls|MAX\(GREATEST\(total_calls/);
  assert.match(query, /WHEN recorded_call_count IS NULL THEN 'Unrecorded'\s+WHEN recorded_call_count = 0 THEN '0 calls'/);
  assert.match(query, /COUNTIF\(recorded_call_count IS NULL\) AS unrecorded_call_leads/);
  assert.match(query, /COUNTIF\(recorded_call_count = 0\) AS zero_call_leads/);
});

test('operating-controls: unknown call evidence is visible within the unchanged qualified dialled denominator', () => {
  const result = buildOperatingControlsResult({ total_leads: 10, delivered_leads: 9, dialled_leads: 8,
    unrecorded_call_leads: 3, dialled_unrecorded_call_leads: 2, zero_call_leads: 1, one_call_leads: 2, multi_call_leads: 4,
    attempts: [{ bucket: 'Unrecorded', leads: 3, contacted: 1, sales: 0 }, { bucket: '0 calls', leads: 1, contacted: 0, sales: 0 }],
    vendor_controls: [{ vendor: 'A', leads: 10, dialled: 8, unrecorded_call_leads: 3, dialled_unrecorded_call_leads: 2, zero_call_leads: 1, one_call_leads: 2 }],
  }, {}, operating);
  assert.equal(result.summary.unrecordedCallLeads, 3);
  assert.equal(result.summary.zeroCallLeads, 1);
  assert.equal(result.summary.dialledUnrecordedCallLeads, 2);
  assert.equal(result.summary.dialledUnrecordedCallSharePct, 25);
  assert.equal(result.summary.singleAttemptSharePct, 25);
  assert.equal(result.summary.multiAttemptSharePct, 50);
  assert.deepEqual(result.attemptBuckets.map(row => [row.bucket, row.leads]), [['Unrecorded', 3], ['0 calls', 1]]);
  assert.equal(result.vendorControls[0].unrecordedCallLeads, 3);
  assert.equal(result.vendorControls[0].zeroCallLeads, 1);
  assert.equal(result.vendorControls[0].dialledUnrecordedCallLeads, 2);
  assert.equal(result.vendorControls[0].dialledUnrecordedCallSharePct, 25);
  assert.equal(result.vendorControls[0].oneCallSharePct, 25);
});

test('operating-controls: missing completeness fields remain unavailable while recorded zero remains zero', () => {
  const missing = buildOperatingControlsResult({ dialled_leads: 4 }, {}, operating);
  assert.equal(missing.summary.unrecordedCallLeads, null);
  assert.equal(missing.summary.dialledUnrecordedCallLeads, null);
  assert.equal(missing.summary.dialledUnrecordedCallSharePct, null);
  const zero = buildOperatingControlsResult({ dialled_leads: 4, unrecorded_call_leads: 0, dialled_unrecorded_call_leads: 0, zero_call_leads: 0 }, {}, operating);
  assert.equal(zero.summary.unrecordedCallLeads, 0);
  assert.equal(zero.summary.dialledUnrecordedCallLeads, 0);
  assert.equal(zero.summary.dialledUnrecordedCallSharePct, 0);
});

test('operating-controls: explicit non-RPC and qualified chronology control membership', () => {
  const { query } = buildOperatingControlsQuery(scope);
  assert.equal((query.match(/recorded_call_count >= 5 AND is_rpc IS FALSE/g) || []).length, 2);
  assert.match(query, /CASE WHEN COUNTIF\(is_rpc\) > 0 THEN TRUE WHEN COUNTIF\(is_rpc IS NULL\) > 0 THEN NULL ELSE FALSE END AS is_rpc/);
  assert.match(query, /COUNTIF\(is_dialled AND recorded_call_count = 1\) AS one_call_leads/);
  assert.match(query, /COUNTIF\(is_dialled AND recorded_call_count >= 2\) AS multi_call_leads/);
  assert.match(query, /COUNTIF\(is_delivered AND NOT is_dialled\) AS awaiting_first_dial/);
  assert.match(query, /WHEN first_call_ts < delivered_ts THEN 'Invalid timing'/);
});

test('operating-controls: tenant/vendor scope and unsupported dimension rejection survive normalization reuse', () => {
  const { query, queryParams } = buildOperatingControlsQuery({ ...scope, clientId: 'mtn', vendor: 'Tenant vendor' });
  assert.match(query, /LOWER\(hlc.vendor\) = LOWER\(@vendor\)/);
  assert.equal(queryParams.vendor, 'Tenant vendor');
  assert.equal(queryParams.scopeTimezone, queryParams.tenantTimezone);
  assert.throws(() => buildOperatingControlsQuery({ ...scope, clientId: 'mtn', grade: 'A' }), /UNSUPPORTED_FILTER/);
  assert.throws(() => buildOperatingControlsQuery({ ...scope, agent: 'A' }), /UNSUPPORTED_FILTER/);
});
