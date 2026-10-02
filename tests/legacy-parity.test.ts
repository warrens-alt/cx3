import test from 'node:test';
import assert from 'node:assert/strict';
import type { ContactDispositionsData } from '../contracts/vendorDispositions';
import { dispositionComparison, vendorOutcomeExportRows, vendorSummaryExportRows } from '../src/features/contact/model/dispositionComparison';

function report(mode: ContactDispositionsData['mode'] = 'lead_status'): ContactDispositionsData {
  return {
    mode,
    vendorSummaries: [
      { vendor: 'A', totalPopulation: 20, dialledCount: 10, zeroCallCount: 0, unrecordedActivityCount: 2, conflictingCount: 1,
        recordedDispositionCount: 8, missingDispositionCount: 2, unmappedDispositionCount: 3,
        dispositionCoveragePct: 80, mappingCoveragePct: null, rpcCount: 4, saleCount: 1, callbackCount: 0 },
      { vendor: 'B', totalPopulation: 4, dialledCount: 0,
        recordedDispositionCount: 0, missingDispositionCount: 0, unmappedDispositionCount: 0,
        dispositionCoveragePct: null, mappingCoveragePct: null, rpcCount: 0, saleCount: 0, callbackCount: 0 },
    ],
    breakdown: [
      { vendor: 'A', approvedGroup: 'NO_ANSWER', count: 3 },
      { vendor: 'A', approvedGroup: 'NO_ANSWER', count: 2 },
      { vendor: 'A', approvedGroup: 'CONTACTED_RPC', count: 4 },
    ],
  } as ContactDispositionsData;
}

test('restored vendor summary export keeps every supplied coverage count and missing is not zero', () => {
  const rows = vendorSummaryExportRows(report());
  const fields = Object.fromEntries(rows[0].map((name, index) => [String(name), index]));
  for (const [name, value] of Object.entries({ 'Zero Call Count': 0, 'Unrecorded Activity Count': 2, 'Conflicting Count': 1,
    'Recorded Dispositions': 8, 'Missing Dispositions': 2, 'Unmapped Dispositions': 3 })) {
    assert.equal(rows[1][fields[name]], value, name);
  }
  assert.equal(rows[2][fields['Zero Call Count']], null);
  assert.equal(rows[1][fields['Mapping Coverage %']], null);
  assert.equal(rows[1][fields['Callback Count']], 0);
});

test('restored outcome CSV uses the same lead denominator and rounded presentation as the canonical chart', () => {
  const data = report();
  const chart = dispositionComparison(data);
  const csv = vendorOutcomeExportRows(data);
  assert.equal(chart.chartRows[0].countRow.NO_ANSWER, 5);
  assert.equal(chart.chartRows[0].pctRow.NO_ANSWER, 50);
  assert.equal(csv[0][2], 'Dialled Lead Denominator');
  assert.equal(csv[1][2], 10);
  assert.equal(csv[1][csv[0].indexOf('No Answer / Ringing %')], '50%');
  assert.equal(chart.chartRows[1].pctRow.NO_ANSWER, null);
  assert.equal(csv[2][csv[0].indexOf('No Answer / Ringing %')], null);
  assert.equal(csv[2][csv[0].indexOf('No Answer / Ringing Count')], 0);
});

test('call event comparison uses its own population and does not export lead-status-only counts', () => {
  const data = report('call_records');
  const chart = dispositionComparison(data);
  const csv = vendorOutcomeExportRows(data);
  assert.equal(chart.chartRows[0].pctRow.NO_ANSWER, 25);
  assert.equal(csv[0][2], 'Call Event Denominator');
  assert.equal(csv[1][2], 20);
  assert.equal(csv[1][csv[0].indexOf('No Answer / Ringing %')], '25%');
  assert.equal(vendorSummaryExportRows(data)[0].includes('Zero Call Count'), false);
});

test('outcome export retains every returned vendor without changing the report or applying chart Top-N', () => {
  const data = report();
  data.vendorSummaries = Array.from({ length: 12 }, (_, index) => ({ ...data.vendorSummaries[0], vendor: `Vendor ${index}` }));
  data.breakdown = data.vendorSummaries.map(row => ({ ...data.breakdown[0], vendor: row.vendor }));
  const original = structuredClone(data);
  assert.equal(vendorOutcomeExportRows(data).length, 13);
  assert.equal(dispositionComparison(data).chartRows.length, 12);
  assert.deepEqual(data, original);
});
