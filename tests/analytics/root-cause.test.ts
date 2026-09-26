import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRootCauseResult } from '../../server/analytics/investigation/rootCause';

test('root-cause: normal period comparison calculates segment contributions reconciling to delta', () => {
  const rows = [
    // Overall current & previous
    { dimension: 'overall', segment: 'All', period: 'current', fetched: 1000, delivered: 900, dialled: 800, rpc: 400, sales: 50, activated: 35 },
    { dimension: 'overall', segment: 'All', period: 'previous', fetched: 1000, delivered: 900, dialled: 800, rpc: 400, sales: 30, activated: 20 },
    // Vendors
    { dimension: 'vendor', segment: 'Vendor A', period: 'current', fetched: 500, sales: 30 },
    { dimension: 'vendor', segment: 'Vendor A', period: 'previous', fetched: 500, sales: 15 },
    { dimension: 'vendor', segment: 'Vendor B', period: 'current', fetched: 500, sales: 20 },
    { dimension: 'vendor', segment: 'Vendor B', period: 'previous', fetched: 500, sales: 15 },
  ];

  const result = buildRootCauseResult(
    rows,
    'leadToSaleRate',
    '2026-09-08',
    '2026-09-14',
    '2026-09-01',
    '2026-09-07'
  );

  assert.equal(result.metric.id, 'leadToSaleRate');
  assert.equal(result.metric.currentValue, 5.0); // 50 / 1000 = 5.00%
  assert.equal(result.metric.previousValue, 3.0);// 30 / 1000 = 3.00%
  assert.equal(result.metric.delta, 2.0);        // +2.00 pp

  const vendorDim = result.dimensions.find(d => d.key === 'vendor')!;
  const vA = vendorDim.segments.find(s => s.name === 'Vendor A')!;
  const vB = vendorDim.segments.find(s => s.name === 'Vendor B')!;

  // Vendor A went from 15 to 30 sales: contribution = (30 - 15) / 1000 = +1.50 pp
  assert.equal(vA.contribution, 1.5);
  // Vendor B went from 15 to 20 sales: contribution = (20 - 15) / 1000 = +0.50 pp
  assert.equal(vB.contribution, 0.5);

  // Exact additive reconciliation: 1.5 + 0.5 = 2.0 pp delta
  assert.equal(Number((vA.contribution + vB.contribution).toFixed(2)), result.metric.delta);
});

test('root-cause: zero denominator returns null values and null delta', () => {
  const rows = [
    { dimension: 'overall', segment: 'All', period: 'current', fetched: 0, sales: 0 },
    { dimension: 'overall', segment: 'All', period: 'previous', fetched: 0, sales: 0 },
  ];

  const result = buildRootCauseResult(
    rows,
    'leadToSaleRate',
    '2026-09-08',
    '2026-09-14',
    '2026-09-01',
    '2026-09-07'
  );

  assert.equal(result.metric.currentValue, null);
  assert.equal(result.metric.previousValue, null);
  assert.equal(result.metric.delta, null);
});
