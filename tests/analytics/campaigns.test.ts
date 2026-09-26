import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignRowsAndSummary } from '../../server/analytics/campaigns/performance';

test('campaigns: normal marketing population derives CTR, CPC, CPM and CPL', () => {
  const rows = [
    {
      client_name: 'Client Alpha',
      channel: 'Facebook',
      campaign_name: 'Summer_Sale',
      adset_name: 'Retargeting',
      impressions: 10000,
      reach: 8000,
      clicks: 400,
      outbound_clicks: 300,
      recorded_leads: 30,
      recorded_spend: 1200,
      latest_budget: 2000,
    },
    {
      client_name: 'Client Alpha',
      channel: 'Google',
      campaign_name: 'Search_Brand',
      adset_name: 'Exact',
      impressions: 5000,
      reach: 4000,
      clicks: 500,
      outbound_clicks: 450,
      recorded_leads: 50,
      recorded_spend: 1500,
      latest_budget: 2500,
    },
  ];

  const resolved = {
    spendColumn: 'spend',
    budgetColumn: 'budget',
    reachColumn: 'reach',
    outboundClicksColumn: 'outbound_clicks',
  };
  const grainStatus = 'VALID';

  const result = buildCampaignRowsAndSummary(rows, resolved, grainStatus);

  assert.equal(result.hasSpend, true);
  assert.equal(result.campaigns.length, 2);

  const c1 = result.campaigns[0];
  assert.equal(c1.ctr, 4.0); // 400 / 10000 = 4.00%
  assert.equal(c1.outboundCtr, 3.0); // 300 / 10000 = 3.00%
  assert.equal(c1.clickToLeadRate, 10.0); // 30 / 300 = 10.00%
  assert.equal(c1.cpc, 3.0); // 1200 / 400 = R3.00
  assert.equal(c1.cpm, 120.0); // (1200 / 10000) * 1000 = R120.00
  assert.equal(c1.cpl, 40.0); // 1200 / 30 = R40.00
  assert.equal(c1.frequency, 1.25); // 10000 / 8000 = 1.25

  // Summary totals
  assert.equal(result.summary.spend, 2700);
  assert.equal(result.summary.impressions, 15000);
  assert.equal(result.summary.clicks, 900);
  assert.equal(result.summary.leads, 80);
  assert.equal(result.summary.ctr, 6.0); // 900 / 15000 = 6.00%
  assert.equal(result.summary.cpc, 3.0); // 2700 / 900 = R3.00
});

test('campaigns: spend withheld when spend grain is invalid / duplicate', () => {
  const rows = [
    {
      client_name: 'Client Alpha',
      impressions: 1000,
      clicks: 50,
      recorded_leads: 5,
      recorded_spend: 500,
    },
  ];

  const resolved = { spendColumn: 'spend' };
  const grainStatus = 'DUPLICATE_GRAIN';

  const result = buildCampaignRowsAndSummary(rows, resolved, grainStatus);

  // When grainStatus is not VALID, hasSpend must be false and spend must be null!
  assert.equal(result.hasSpend, false);
  assert.equal(result.campaigns[0].spend, null);
  assert.equal(result.campaigns[0].cpc, null);
  assert.equal(result.campaigns[0].cpl, null);
  assert.equal(result.summary.spend, null);
});

test('campaigns: zero impressions yields null CTR, never false 0%', () => {
  const rows = [
    {
      client_name: 'Client Alpha',
      impressions: 0,
      reach: 0,
      clicks: 0,
      outbound_clicks: null,
      recorded_leads: 0,
      recorded_spend: null,
    },
  ];

  const resolved = {};
  const grainStatus = 'VALID';

  const result = buildCampaignRowsAndSummary(rows, resolved, grainStatus);
  assert.equal(result.campaigns[0].ctr, null);
  assert.equal(result.campaigns[0].frequency, null);
  assert.equal(result.summary.ctr, null);
});
