import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFunnelResult } from '../../server/analytics/funnel/service';

test('funnel: velocity durations formatted accurately', () => {
  const data = {
    velocity: {
      avg_fetch_delivery_sec: 45,
      avg_deliv_dial_sec: 300,
      avg_dial_to_sale_sec: 14400,
      avg_sale_to_act_sec: 86400 * 2,
    },
    vendors: [
      { vendor: 'Vendor A', leads: 500, delivered: 480, dialled: 400, contacted: 200, sales: 25, activations: 15 },
    ],
    sources: [
      { source: 'web_portal', leads: 300, delivered: 290, dialled: 250, contacted: 120, sales: 15, activations: 10 },
    ],
    grades: [
      { grade: 'Platinum', leads: 100, delivered: 100, dialled: 95, contacted: 70, sales: 12, activations: 9 },
    ],
  };

  const result = buildFunnelResult(data);

  assert.equal(result.velocity.fetchToDelivery, '45s');
  assert.equal(result.velocity.deliveryToFirstDial, '5m');
  assert.equal(result.velocity.firstDialToContact, 'Unavailable');
  assert.equal(result.velocity.contactToSale, '4.0h');
  assert.equal(result.velocity.saleToActivation, '2.0d');
  assert.equal(result.byVendor.length, 1);
  assert.equal(result.bySource.length, 1);
  assert.equal(result.byGrade.length, 1);
});

test('funnel: missing or null velocity timestamps become dash, not zero', () => {
  const data = {
    velocity: {
      avg_fetch_delivery_sec: null,
      avg_deliv_dial_sec: null,
      avg_dial_to_sale_sec: null,
      avg_sale_to_act_sec: null,
    },
    vendors: [],
    sources: [],
    grades: [],
  };

  const result = buildFunnelResult(data);

  assert.equal(result.velocity.fetchToDelivery, '—');
  assert.equal(result.velocity.deliveryToFirstDial, '—');
  assert.equal(result.velocity.contactToSale, '—');
  assert.equal(result.velocity.saleToActivation, '—');
});
