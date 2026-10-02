import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { numberOrNull, ratioOrNull } from '../server/analytics/common/metrics';
import * as legacy from '../server/bigquery/queries';
import { getCohortStats as testedCohorts } from '../server/bigquery/legacy/cohorts';

const scope = { clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-30' };
const bq = getBigQueryClient(getClientConfig(scope.clientId).bigQueryProject);

test('legacy Overview never queries budget as spend or publishes uncertified monetary outputs', async context => {
  const requests: any[] = [];
  context.mock.method(bq, 'query', async (request: any) => {
    requests.push(request);
    return [[{ leads: 2, sales: 1, revenue: '150.50', spend: 999, unbilled_sales: 1 }]] as any;
  });
  const output = await legacy.getOverviewStats(scope);
  assert.equal(requests.length, 3, 'No additional budget or spend lookup');
  assert.ok(requests.every(r => !/SUM\(budget\)/.test(r.query)));
  for (const metric of ['revenue', 'spend', 'cpa', 'roas', 'revenuePerLead', 'revenuePerBillableSale'] as const) assert.equal(output[metric], null, metric);
  assert.equal(output.financialEvidence.status, 'UNAVAILABLE');
  assert.equal(output.trend[0].revenue, null);
  assert.equal(output.sources[0].revenue, null);
  assert.ok(!output.attentionItems.some(item => /unbilled|leakage/i.test(item.title)));
  assert.equal(output.leads, 2);
});

test('legacy source and quality monetary adapters distinguish missing from explicit zero', async context => {
  let amount: string | null = null;
  const requests: any[] = [];
  context.mock.method(bq, 'query', async (request: any) => {
    requests.push(request);
    return [[{ source: 'web', grade: 'A', leads: 2, total: 2, sales: 1, sale_count: 1, total_revenue: amount, revenue: amount }]] as any;
  });
  for (const expected of [null, 0, 125.5]) {
    amount = expected === null ? null : String(expected);
    const sources = await legacy.getSourcesStats(scope);
    const quality = await legacy.getQualityStats(scope);
    assert.equal(sources[0].revenue, expected);
    assert.equal(sources[0].revPerLead, expected === null ? null : expected / 2);
    assert.equal(quality.fullFunnelSummary.revenue, expected);
    assert.equal(quality.fullFunnelByGrade[0].revenue, expected);
  }
  assert.ok(requests.every(r => /COUNTIF\(total_revenue IS NULL\) > 0 THEN NULL ELSE SUM\(total_revenue\) END/.test(r.query)));
});

test('legacy speed buckets and record export retain missing monetary evidence', async context => {
  let query = '';
  context.mock.method(bq, 'query', async (request: any) => {
    query = request.query;
    return [[{ bucket_1_leads: 2, bucket_1_revenue: null, bucket_2_leads: 1, bucket_2_revenue: 0, value: null }]] as any;
  });
  const output = await legacy.getSpeedToLeadStats(scope);
  assert.equal(output.buckets[0].revenue, null);
  assert.equal(output.buckets[0].revPerLead, null);
  assert.equal(output.buckets[1].revenue, 0);
  assert.match(query, /COUNTIF\(IF\(stl_minutes <= 5, rev, 0\) IS NULL AND revenue_duplicate_collapsed IS NOT TRUE/);
  assert.doesNotMatch(query, /IFNULL\(revenue, 0\)/);
  await legacy.getLeads(scope);
  assert.match(query, /CAST\(total_revenue AS STRING\) as value/);
  assert.doesNotMatch(query, /'\$0'/);
});

test('the live cohort service uses the tested chronology and unavailable-revenue-maturation implementation', () => {
  assert.equal(legacy.getCohortStats, testedCohorts);
});

test('legacy SQL has no remaining unguarded direct monetary SUM or missing-money defaults', () => {
  const source = readFileSync('server/bigquery/queries.ts', 'utf8');
  assert.doesNotMatch(source, /SUM\((?:IFNULL\()?total_revenue|SUM\(revenue\)|SUM\(budget\)/);
  assert.doesNotMatch(source, /Number\([^)]*(?:\.revenue|\.total_revenue|_revenue)\)\s*\|\|\s*0/);
  assert.doesNotMatch(source, /getAcquisitionStats/);
});

test('invalid numeric input stays unavailable while zero remains measured', () => {
  for (const value of [null, undefined, '', '  ', 'bad', Number.POSITIVE_INFINITY, 'Infinity']) {
    assert.equal(numberOrNull(value), null);
    assert.equal(ratioOrNull(value, 10), null);
  }
  assert.equal(numberOrNull('0'), 0);
  assert.equal(ratioOrNull('0', 10), 0);
  assert.equal(ratioOrNull(10, 0), null);
});

test('legacy empty denominators, missing effort, and absent comparison stay unavailable', async context => {
  context.mock.method(bq, 'query', async () => [[{}]] as any);
  const overview = await legacy.getOverviewStats(scope);
  for (const field of ['deliveryRate', 'callCoverage', 'rpcRate', 'saleRate', 'leadToSaleRate', 'activationRate'] as const) assert.equal(overview[field], null, field);
  const calls = await legacy.getCallPerformanceStats(scope);
  assert.equal(calls.totalCalls, null);
  assert.equal(calls.avgCalls, null);
  assert.equal(calls.totalDurationSeconds, null);
  assert.equal(calls.avgDurationSec, null);
  assert.equal(calls.chart[0].bucket, 'Unrecorded');
  assert.equal(calls.chart[1].bucket, '0 Calls');
  assert.equal(calls.chart[1].current, 0, 'Complete aggregate has no row for this category');
  assert.ok(calls.chart.every(row => row.previous === null));
  assert.equal((await legacy.getTimeseriesStats(scope))[0].comparison, null);
  const quality = await legacy.getQualityStats(scope);
  assert.equal(quality.avgScore, null);
});

test('legacy missing vendor or tenant source fails explicitly instead of returning an empty success', async context => {
  context.mock.method(bq, 'query', async () => { throw new Error('access denied to selected tenant'); });
  for (const operation of [legacy.getOverviewStats, legacy.getCallPerformanceStats, legacy.getQualityStats, legacy.getOutcomesStats, legacy.getFilterOptions]) {
    await assert.rejects(operation(scope), /access denied to selected tenant/);
  }
});

test('Explore applies complete-money guards and keeps unrecorded effort distinct', async context => {
  const { executeDynamicQuery, ALLOWED_METRICS, getAllowedDimensions } = await import('../server/bigquery/semantic_engine');
  const { EXPLORER_EXPRESSIONS } = await import('../contracts/legacyMetrics');
  let amount: string | null = null;
  let query = '';
  context.mock.method(bq, 'createQueryJob', async (request: any) => {
    query = request.query;
    return [{ metadata: { statistics: { query: {} } }, getQueryResults: async () => [[{
      dim1: 'Unrecorded', value: amount, sample_size: 2, full_leads: 2,
      full_delivered: 2, full_called: 1, full_rpcs: 1, full_sales: 1,
      full_billable_sales: 0, full_activations: 0, full_revenue: amount,
    }]] }] as any;
  });
  for (const expected of [null, 0, 125.5]) {
    amount = expected === null ? null : String(expected);
    const output = await executeDynamicQuery({ ...scope, metric: 'revenue', dimension: 'calls_bucket' });
    assert.equal(output.data[0].value, expected);
    assert.equal(output.data[0].fullFunnel.revenue, expected);
    assert.equal(output.data[0].fullFunnel.revPerLead, expected === null ? null : expected / 2);
  }
  assert.match(query, /COUNTIF\(total_revenue IS NULL\) > 0 THEN NULL/);
  assert.match(getAllowedDimensions('Africa/Johannesburg').calls_bucket, /IS NULL THEN 'Unrecorded'/);
  for (const metric of ['revenue', 'revenue_per_lead', 'revenue_per_sale', 'calls_per_lead']) {
    assert.equal(ALLOWED_METRICS[metric], EXPLORER_EXPRESSIONS[metric]);
  }
});
