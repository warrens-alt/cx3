import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommercialResult } from '../../server/analytics/commercial/spend';

test('commercial: observed spend derives blended ratios without fabricating full profitability', () => {
  const overview = {
    currency: 'ZAR',
    kpis: {
      fetchedLeads: 1000,
      saleLeads: 50,
      activatedLeads: 30,
      revenue: 60000,
      leadToSaleRate: 5.0,
    },
  };

  const campaignData = {
    summary: {
      spend: 25000,
      cpl: 25.0,
      cpc: 2.5,
      cpm: 100.0,
      leads: 1000,
      clicks: 10000,
      impressions: 250000,
    },
    spendSource: {
      status: 'OBSERVED',
      column: 'spend',
      table: 'marketing_spend_table',
    },
  };

  const result = buildCommercialResult(overview, campaignData, 'Observed media spend available');

  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.baseline.mediaSpend, 25000);
  assert.equal(result.baseline.revenue, 60000);
  assert.equal(result.baseline.blendedCostPerFetchedLead, 25.0); // 25000 / 1000 = R25.00
  assert.equal(result.baseline.blendedCostPerSale, 500.0);        // 25000 / 50 = R500.00
  assert.equal(result.baseline.blendedCostPerActivation, 833.33); // 25000 / 30 = R833.33
  assert.equal(result.baseline.revenueToMediaSpendRatio, 2.4);    // 60000 / 25000 = 2.40x

  // Profitability/overheads remain strictly withheld
  assert.equal(result.baseline.totalCost, null);
  assert.equal(result.baseline.contribution, null);
  assert.equal(result.baseline.marginPct, null);
});

test('commercial: spend field unavailable returns null/— and does not substitute budget', () => {
  const overview = {
    currency: 'ZAR',
    kpis: {
      fetchedLeads: 500,
      saleLeads: 20,
      activatedLeads: 10,
      revenue: 20000,
      leadToSaleRate: 4.0,
    },
  };

  const campaignData = {
    summary: {
      spend: null, // Spend unavailable
      cpl: null,
      cpc: null,
      cpm: null,
      leads: 500,
      clicks: 2000,
      impressions: 50000,
    },
    spendSource: {
      status: 'UNAVAILABLE',
      column: null,
      table: null,
    },
  };

  const result = buildCommercialResult(overview, campaignData, 'No spend column mapped');

  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.baseline.mediaSpend, null);
  assert.equal(result.baseline.blendedCostPerFetchedLead, null);
  assert.equal(result.baseline.blendedCostPerSale, null);
  assert.equal(result.baseline.blendedCostPerActivation, null);
  assert.equal(result.baseline.revenueToMediaSpendRatio, null);
});

test('commercial: real measured zero spend returns 0', () => {
  const overview = {
    currency: 'ZAR',
    kpis: {
      fetchedLeads: 100,
      saleLeads: 5,
      activatedLeads: 2,
      revenue: 5000,
      leadToSaleRate: 5.0,
    },
  };

  const campaignData = {
    summary: {
      spend: 0, // Genuine R0 spend
      cpl: 0,
      cpc: 0,
      cpm: 0,
      leads: 100,
      clicks: 500,
      impressions: 10000,
    },
    spendSource: {
      status: 'OBSERVED',
      column: 'spend',
      table: 'marketing_spend_table',
    },
  };

  const result = buildCommercialResult(overview, campaignData, 'Observed zero spend');
  assert.equal(result.baseline.mediaSpend, 0);
  assert.equal(result.baseline.blendedCostPerFetchedLead, 0);
});
