import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVendorQualityResult } from '../../server/analytics/performance/vendor';

test('vendor-performance: normal vendor dataset calculates rates and turnaround correctly', () => {
  const data = {
    vendors: [
      {
        vendor: 'LeadDialler SA',
        leads: 1000,
        delivered: 950,
        dialled: 800,
        contacted: 400,
        sales: 50,
        activations: 40,
        invalid_leads: 20,
        total_calls: 2500,
        revenue: 60000,
        med_first_dial_sec: 180,
      },
    ],
    sources: [
      {
        source: 'Google_Ads',
        leads: 500,
        delivered: 480,
        dialled: 400,
        contacted: 220,
        sales: 30,
        activations: 25,
        invalid_leads: 10,
      },
    ],
    grades: [
      { grade: 'Gold', leads: 300, contacted: 180, sales: 25, activations: 20 },
    ],
    vetting: [
      { vetting_color: 'Green', leads: 400, contacted: 260, sales: 35, activations: 30 },
    ],
  };

  const result = buildVendorQualityResult(data);

  const v = result.vendors[0];
  assert.equal(v.vendor, 'LeadDialler SA');
  assert.equal(v.deliveryRate, 95.0); // 950 / 1000
  assert.equal(v.dialRate, 84.2);     // 800 / 950
  assert.equal(v.contactRate, 50.0);  // 400 / 800
  assert.equal(v.saleRate, 12.5);     // 50 / 400 RPC = 12.50%
  assert.equal(v.activationRate, 80.0); // 40 / 50 = 80.0%
  assert.equal(v.medianFirstDial, '3m');
  assert.equal(v.medianFirstDialSec, 180);
  assert.equal(v.callsPerLead, 2.5);  // 2500 / 1000
  assert.equal(v.invalidRate, 2.0);   // 20 / 1000

  // Sources
  const s = result.sources[0];
  assert.equal(s.deliveryRate, 96.0);
  assert.equal(s.leadToSaleRate, 6.0); // 30 / 500 = 6.00%
  assert.equal(s.activationRate, 83.3);// 25 / 30 = 83.3%

  // Grades and vetting
  assert.equal(result.grades[0].contactRate, 60.0); // 180 / 300
  assert.equal(result.vetting[0].contactRate, 65.0); // 260 / 400
});

test('vendor-performance: empty or zero vendor leads yields null rates, never false 0%', () => {
  const data = {
    vendors: [
      {
        vendor: 'Empty Vendor',
        leads: 0,
        delivered: 0,
        dialled: 0,
        contacted: 0,
        sales: 0,
        activations: 0,
        invalid_leads: 0,
        total_calls: 0,
        revenue: 0,
        med_first_dial_sec: null,
      },
    ],
    sources: [],
    grades: [],
    vetting: [],
  };

  const result = buildVendorQualityResult(data);
  const v = result.vendors[0];

  assert.equal(v.deliveryRate, null);
  assert.equal(v.dialRate, null);
  assert.equal(v.contactRate, null);
  assert.equal(v.saleRate, null);
  assert.equal(v.activationRate, null);
  assert.equal(v.callsPerLead, null);
  assert.equal(v.invalidRate, null);
  assert.equal(v.medianFirstDial, '—'); // Never 0s
  assert.equal(v.medianFirstDialSec, null);
});
