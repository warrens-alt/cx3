import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTemporalHeatmap } from '../src/lib/temporalPresentation';
import type { TemporalData } from '../src/lib/offernetClient';

test('temporal selection never substitutes capture data for an unavailable requested event basis', () => {
  const capture = [{ dayIndex: 1, dayName: 'Monday', hour: 0, volume: 10, contactRate: 0, saleRate: 0, activationRate: null }];
  const delivery = [{ ...capture[0], volume: 7 }];
  const data: TemporalData & { timeBases: Array<{ basis: string; heatmap: TemporalData['heatmap'] }> } = { heatmap: capture, peakWindows: [], timeBases: [{ basis: 'Delivery', heatmap: delivery }] };
  assert.equal(selectTemporalHeatmap(data, 'Capture'), capture);
  assert.equal(selectTemporalHeatmap(data, 'Delivery'), delivery);
  assert.deepEqual(selectTemporalHeatmap(data, 'First dial'), []);
  assert.deepEqual(selectTemporalHeatmap(undefined, 'Capture'), []);
  assert.deepEqual(selectTemporalHeatmap({ ...data, timeBases: [{ basis: 'Capture', heatmap: [] }] }, 'Capture'), []);
});
