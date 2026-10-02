import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContactStrategyResult } from '../../server/analytics/contact/strategy';

test('contact-strategy: normal attempt distribution yields accurate progression rates', () => {
  const rows = [
    { attempt_bucket: '0 calls', leads: 50, dialled: 0, no_rpc: 50, contacted: 0, sales: 0, activations: 0, revenue: 0 },
    { attempt_bucket: '1 call', leads: 200, dialled: 200, no_rpc: 160, contacted: 40, sales: 5, activations: 3, revenue: 5000 },
    { attempt_bucket: '2 calls', leads: 150, dialled: 150, no_rpc: 90, contacted: 60, sales: 8, activations: 6, revenue: 8000 },
    { attempt_bucket: '3-4 calls', leads: 80, dialled: 80, no_rpc: 40, contacted: 40, sales: 6, activations: 4, revenue: 6000 },
    { attempt_bucket: '5+ calls', leads: 20, dialled: 20, no_rpc: 15, contacted: 5, sales: 1, activations: 1, revenue: 1000 },
  ];

  const result = buildContactStrategyResult(rows);

  // Total leads = 50 + 200 + 150 + 80 + 20 = 500 (450 dialled)
  assert.equal(result.summary?.totalLeads, 500);
  assert.equal(result.summary?.dialledLeads, 450);
  assert.equal(result.summary?.zeroCallLeads, 50);
  assert.equal(result.summary?.oneCallLeads, 200);
  assert.equal(result.summary?.singleAttemptSharePct, 44.4); // 200 / 450 dialled = 44.4%
  assert.equal(result.summary?.multiAttemptSharePct, 55.6);  // (150 + 80 + 20) / 450 dialled = 55.6%
  assert.equal(result.summary?.fivePlusCallLeads, 20);
  assert.equal(result.summary?.fivePlusNoRpcLeads, 15);      // 15 explicitly false RPC observations

  // 1 call bucket rates
  const oneCall = result.attemptPerformance.find(p => p.bucket === '1 call')!;
  assert.equal(oneCall.sharePct, 40.0);     // 200 / 500 = 40.0%
  assert.equal(oneCall.contactRate, 20.0);  // 40 / 200 = 20.0%
  assert.equal(oneCall.saleRate, 2.5);      // 5 / 200 = 2.50%
  assert.equal(oneCall.activationRate, 60.0);// 3 / 5 = 60.0%
});

test('contact-strategy: empty or zero denominator does not return false 0% shares', () => {
  const rows: any[] = [];
  const result = buildContactStrategyResult(rows);

  assert.equal(result.summary?.totalLeads, 0);
  assert.equal(result.summary?.singleAttemptSharePct, null);
  assert.equal(result.summary?.multiAttemptSharePct, null);
  assert.equal(result.attemptPerformance.length, 0);
});


test('contact strategy does not reconstruct missing dial/RPC evidence from bucket totals', () => {
  const missing = buildContactStrategyResult([{ attempt_bucket: '5+ calls', leads: 10, contacted: 2 }]);
  assert.equal(missing.summary.dialledLeads, null);
  assert.equal(missing.summary.fivePlusNoRpcLeads, null);
  assert.equal(missing.attemptPerformance[0].rpcUnrecorded, null);
  assert.equal(missing.attemptPerformance[0].contactRate, null);
});
test('one/multi-call share uses qualified dialled intersections and exposes unrecorded denominator', () => {
  const result = buildContactStrategyResult([
    { attempt_bucket: 'Unrecorded', leads: 4, dialled: 2, no_rpc: 0 },
    { attempt_bucket: '1 call', leads: 8, dialled: 3, no_rpc: 1 },
    { attempt_bucket: '2 calls', leads: 6, dialled: 5, no_rpc: 2 },
  ]);
  assert.equal(result.summary.singleAttemptSharePct, 30);
  assert.equal(result.summary.multiAttemptSharePct, 50);
  assert.equal(result.summary.unrecordedDialledCallLeads, 2);
});
