import test from 'node:test';
import assert from 'node:assert/strict';
import { transformOverviewData } from '../../server/analytics/overview/service';

test('overview: normal population produces accurate rates and KPIs', () => {
  const current = {
    fetched_leads: 1000,
    delivered_leads: 950,
    dialled_leads: 800,
    contacted_leads: 400,
    sale_leads: 50,
    activated_leads: 35,
    total_revenue: 50000,
    total_calls_recorded: 2400,
    dialled_within_15m: 760,
    median_delivery_to_dial_sec: 180,
    p90_delivery_to_dial_sec: 900,
    awaiting_first_dial: 150,
    backlog_over_60m: 30,
  };

  const result = transformOverviewData(current);

  assert.equal(result.kpis.fetchedLeads, 1000);
  assert.equal(result.kpis.deliveryRate, 95.0); // 950 / 1000 = 95.0%
  assert.equal(result.kpis.dialRate, 84.2);     // 800 / 950 = 84.2%
  assert.equal(result.kpis.contactRate, 50.0);  // 400 / 800 = 50.0%
  assert.equal(result.kpis.leadToSaleRate, 5.0);// 50 / 1000 = 5.00%
  assert.equal(result.kpis.activationRate, 70.0);// 35 / 50 = 70.0%
  assert.equal(result.kpis.callsPerLead, 2.4);  // 2400 / 1000
  assert.equal(result.kpis.callsPerDialledLead, 3.0); // 2400 / 800
  assert.equal(result.kpis.revenuePerLead, 50.0);

  // Latency formatted correctly
  assert.equal(result.sla.medianDeliveryToDial, '3m');
  assert.equal(result.sla.p90DeliveryToDial, '15m');
  assert.equal(result.sla.complianceRate, 80.0); // 760 / 950
});

test('overview: zero numerator with valid denominator produces measured zero (0%)', () => {
  const current = {
    fetched_leads: 500,
    delivered_leads: 500,
    dialled_leads: 400,
    contacted_leads: 0, // 0 RPC out of 400 dialled
    sale_leads: 0,      // 0 sales out of 500 fetched
    activated_leads: 0, // 0 activated
    total_revenue: 0,
    total_calls_recorded: 400,
    dialled_within_15m: 0,
    median_delivery_to_dial_sec: 0, // 0s observed
  };

  const result = transformOverviewData(current);

  assert.equal(result.kpis.contactRate, 0); // 0% contact rate
  assert.equal(result.kpis.leadToSaleRate, 0); // 0% sale rate
  assert.equal(result.sla.complianceRate, 0); // 0% compliance
  assert.equal(result.sla.medianDeliveryToDial, '0s'); // genuine 0s
});

test('overview: zero denominator returns null (unavailable), never false 0%', () => {
  const current = {
    fetched_leads: 0,
    delivered_leads: 0,
    dialled_leads: 0,
    contacted_leads: 0,
    sale_leads: 0,
    activated_leads: 0,
    total_revenue: 0,
    total_calls_recorded: 0,
    dialled_within_15m: null,
    median_delivery_to_dial_sec: null,
    p90_delivery_to_dial_sec: null,
  };

  const result = transformOverviewData(current);

  assert.equal(result.kpis.deliveryRate, null);
  assert.equal(result.kpis.dialRate, null);
  assert.equal(result.kpis.contactRate, null);
  assert.equal(result.kpis.leadToSaleRate, null);
  assert.equal(result.kpis.contactToSaleRate, null);
  assert.equal(result.kpis.activationRate, null);
  assert.equal(result.kpis.callsPerLead, null);
  assert.equal(result.kpis.revenuePerLead, null);

  // Missing warehouse latency returns '—', NEVER 0s
  assert.equal(result.sla.medianDeliveryToDial, '—');
  assert.equal(result.sla.p90DeliveryToDial, '—');
  assert.equal(result.sla.complianceRate, null);
});

test('overview: invalid or negative latency does not convert into 0s duration', () => {
  const current = {
    fetched_leads: 100,
    delivered_leads: 100,
    median_delivery_to_dial_sec: -120, // negative timestamp anomaly
    p90_delivery_to_dial_sec: 'corrupt', // non-numeric
  };

  const result = transformOverviewData(current);
  assert.equal(result.sla.medianDeliveryToDial, '—');
  assert.equal(result.sla.p90DeliveryToDial, '—');
});

test('overview: comparison handles zero and null prior denominator cleanly', () => {
  const current = {
    fetched_leads: 200,
    delivered_leads: 180,
    dialled_leads: 150,
    contacted_leads: 75,
    sale_leads: 10,
    activated_leads: 5,
    total_revenue: 10000,
  };

  // Prior had 0 fetched leads
  const priorZero = {
    fetched: 0,
    delivered: 0,
    dialled: 0,
    contacted: 0,
    sales: 0,
    activated: 0,
    revenue: 0,
  };

  const resultZeroPrior = transformOverviewData(current, priorZero);
  assert.equal(resultZeroPrior.comparison?.fetchedDelta, null);
  assert.equal(resultZeroPrior.comparison?.deliveryRateDelta, null);
  assert.equal(resultZeroPrior.comparison?.saleRateDelta, null);

  // Prior had normal population
  const priorNormal = {
    fetched: 100,
    delivered: 90,
    dialled: 80,
    contacted: 40,
    sales: 4,
    activated: 2,
    revenue: 4000,
  };

  const resultNormalPrior = transformOverviewData(current, priorNormal);
  assert.equal(resultNormalPrior.comparison?.fetchedDelta, 100.0); // +100% volume
  assert.equal(resultNormalPrior.comparison?.deliveryRateDelta, 0.0); // 90.0% vs 90.0% = 0.0 pp
});
