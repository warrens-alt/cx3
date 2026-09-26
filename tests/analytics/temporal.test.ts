import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTemporalResult } from '../../server/analytics/temporal/service';

test('temporal: normal hourly volume generates 168 cells and top peak windows', () => {
  const data = {
    matrix: [
      { iso_day: 1, hour_of_day: 9, volume: 100, contacted: 55, sales: 8, activations: 6 },
      { iso_day: 1, hour_of_day: 10, volume: 150, contacted: 90, sales: 15, activations: 12 },
      { iso_day: 2, hour_of_day: 14, volume: 80, contacted: 48, sales: 6, activations: 4 },
    ],
    operating_summary: [
      { is_after_hours: false, leads: 500, contacted: 280, sales: 40 },
      { is_after_hours: true, leads: 80, contacted: 20, sales: 2 },
    ],
  };

  const clientConfig = { timezone: 'Africa/Johannesburg' };
  const operating = { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };

  const result = buildTemporalResult(data, clientConfig, operating);

  // Exactly 7 days * 24 hours = 168 cells in matrix
  assert.equal(result.heatmap.length, 168);

  const mon10 = result.heatmap.find(c => c.dayIndex === 1 && c.hour === 10)!;
  assert.equal(mon10.volume, 150);
  assert.equal(mon10.contactRate, 60.0); // 90 / 150 = 60.0%
  assert.equal(mon10.saleRate, 10.0);    // 15 / 150 = 10.00%
  assert.equal(mon10.activationRate, 80.0); // 12 / 15 = 80.0%

  // Top peak windows sort by contactRate desc
  assert.ok(result.peakWindows.length > 0);
  assert.equal(result.peakWindows[0].contactRate, '60.0%');

  // Operating comparison
  assert.equal(result.operatingComparison[0].contactRate, 56.0); // 280 / 500 = 56.0%
});

test('temporal: 0 volume hours have null contactRate and saleRate, never 0%', () => {
  const data = {
    matrix: [],
    operating_summary: [],
  };

  const clientConfig = { timezone: 'Africa/Johannesburg' };
  const operating = { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };

  const result = buildTemporalResult(data, clientConfig, operating);

  // Empty cell
  const emptyCell = result.heatmap[0];
  assert.equal(emptyCell.volume, 0);
  assert.equal(emptyCell.contactRate, null);
  assert.equal(emptyCell.saleRate, null);
  assert.equal(emptyCell.activationRate, null);

  // Peak windows ignore zero volume cells
  assert.equal(result.peakWindows.length, 0);
});
