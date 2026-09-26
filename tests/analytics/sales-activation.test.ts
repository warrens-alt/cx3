import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesActivationResult } from '../../server/analytics/outcomes/salesActivation';

test('sales-activation: normal outcomes calculate reconciliation and turnaround correctly', () => {
  const data = {
    total_sales: 100,
    billable_sales: 85,
    unbilled_sales: 15,
    total_activations: 70,
    realized_revenue: 140000,
    avg_time_to_sale_sec: 3600 * 2, // 2 hours
    avg_time_to_activation_sec: 86400 * 3, // 3 days
    vendors: [
      { vendor: 'Vendor A', sales: 60, activations: 45, revenue: 90000 },
      { vendor: 'Vendor B', sales: 40, activations: 25, revenue: 50000 },
    ],
  };

  const result = buildSalesActivationResult(data);

  assert.equal(result.reconciliation.totalSales, 100);
  assert.equal(result.reconciliation.billableSales, 85);
  assert.equal(result.reconciliation.unbilledSales, 15);
  assert.equal(result.reconciliation.totalActivations, 70);
  assert.equal(result.reconciliation.activationRate, 70.0); // 70 / 100 = 70.0%
  assert.equal(result.reconciliation.realizedRevenue, 140000);
  assert.equal(result.reconciliation.avgTimeToSale, '2.0h');
  assert.equal(result.reconciliation.avgTimeToActivation, '3.0d');

  // Maturation is safely UNAVAILABLE without unverified assumptions
  assert.equal(result.maturationStatus, 'UNAVAILABLE');
  assert.ok(result.maturationReason.includes('withheld'));
});

test('sales-activation: zero sales population yields null activationRate and dash timings', () => {
  const data = {
    total_sales: 0,
    billable_sales: 0,
    unbilled_sales: 0,
    total_activations: 0,
    realized_revenue: 0,
    avg_time_to_sale_sec: null,
    avg_time_to_activation_sec: null,
    vendors: [],
  };

  const result = buildSalesActivationResult(data);

  assert.equal(result.reconciliation.activationRate, null);
  assert.equal(result.reconciliation.avgTimeToSale, '—');
  assert.equal(result.reconciliation.avgTimeToActivation, '—');
});
