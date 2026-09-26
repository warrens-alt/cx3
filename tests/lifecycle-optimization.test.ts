import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleLifecycleDiagnostics, compileLifecycleDiagnostics, getLifecycleDiagnostics } from '../server/analytics/common/lifecycleDiagnostics';
import { getExecutiveOverview, getOperationalCommercialSummary } from '../server/analytics/overview/service';
import { getVendorQualityAnalytics } from '../server/analytics/performance/vendor';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { withAnalyticsScope } from '../server/analyticsContext';
import { matchedPeriodWindow } from '../contracts/periodComparison';

const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-07', vendor: 'V1', source: 'S1', grade: 'A' };
const client = getBigQueryClient(getClientConfig(scope.clientId).bigQueryProject);
const current = { fetched: 100, delivered: 80, dialled: 60, rpc: 30, sales: 20, activations: 10, deliveredDialled: 50, dialledRpc: 30, rpcSale: 18, saleActivated: 10, revenue: 0 };
const previous = { fetched: 100, delivered: 90, dialled: 80, rpc: 40, sales: 30, activations: 20, deliveredDialled: 80, dialledRpc: 40, rpcSale: 30, saleActivated: 20, revenue: null };
const evidence = [
  { period: 'current', dimension: 'all', segment: 'All', ...current },
  { period: 'previous', dimension: 'all', segment: 'All', ...previous },
  ...['vendor', 'source', 'grade', 'captureHour', 'captureDay'].flatMap(dimension => [
    { period: 'current', dimension, segment: 'A', ...current },
    { period: 'previous', dimension, segment: 'A', ...previous },
  ]),
];
const summary = { fetched_leads: 100, delivered_leads: 80, dialled_leads: 60, contacted_leads: 30, sale_leads: 20, activated_leads: 10, total_revenue: 0 };

test('Overview and Vendor each submit one job with scoped current metrics and the same matched-period diagnostics', async context => {
  const requests: any[] = [];
  context.mock.method(client, 'query', async (request: any) => {
    requests.push(request);
    return [[{ ...summary, lifecycle_rows: evidence, vendors: [{ vendor: 'V1', leads: 100, delivered: 80, dialled: 60, contacted: 30, sales: 20, activations: 10, revenue: 0 }] }]] as any;
  });
  const overview = await getExecutiveOverview(scope);
  assert.equal(requests.length, 1, 'Overview used to submit separate dashboard and lifecycle jobs');
  const vendors = await getVendorQualityAnalytics(scope);
  assert.equal(requests.length, 2, 'Vendor also needs only one job, including its lifecycle diagnostics');
  const expected = assembleLifecycleDiagnostics(evidence, matchedPeriodWindow(scope.startDate, scope.endDate));
  assert.deepEqual(overview.lifecycle, expected);
  assert.deepEqual(vendors.lifecycle, expected);
  assert.equal(overview.kpis.revenue, 0);
  assert.equal(overview.kpis.leadToSaleRate, 20);
  assert.equal(overview.funnelStages[2].loss, 30, 'non-nested transitions retain their intersection-based loss');
  assert.equal(vendors.vendors[0].leadToSaleRate, 20);
  for (const request of requests) {
    assert.equal((request.query.match(/LEFT JOIN UNNEST\(l.hlc_details\) hlc/g) || []).length, 1, 'one raw lead-source reference per submitted query');
    assert.equal(request.params.startDate, '2026-08-25');
    assert.equal(request.params.endDate, '2026-09-07');
    assert.equal(request.params.lifecycleCurrentStart, '2026-09-01');
    assert.equal(request.params.vendor, 'V1');
    assert.equal(request.params.source, 'S1');
    assert.equal(request.params.grade, 'A');
    assert.match(request.query, /LOWER\(hlc.vendor\) = LOWER\(@vendor\)/);
    assert.match(request.query, /FROM current_operational_leads/);
    assert.match(request.query, /ARRAY\(SELECT AS STRUCT \* FROM lifecycle_aggregates/);
  }
  assert.match(requests[1].query, /FROM current_operational_raw\s+WHERE lead_id IS NOT NULL\s+GROUP BY lead_id, vendor/);
});

test('current raw rows are filtered before deduplication so repeated lead IDs cannot inherit previous-period evidence', () => {
  const compiled = compileLifecycleDiagnostics(scope);
  const fragment = compiled.currentLeadCtesSql();
  assert.match(fragment, /current_operational_raw AS \(\s+SELECT \* FROM operational_raw\s+WHERE DATE\(fetched_ts, @lifecycleTimezone\) >= DATE\(@lifecycleCurrentStart\)/);
  assert.match(fragment, /FROM current_operational_raw\s+WHERE lead_id IS NOT NULL\s+GROUP BY lead_id/);
  // Independent capture-cohort oracle: grouping before the date predicate would
  // remove the duplicate current lead entirely or carry its earlier sale forward.
  const raw = [
    { id: 'duplicate', localDate: '2026-08-31', sale: true },
    { id: 'duplicate', localDate: '2026-09-01', sale: false },
    { id: 'current-sale', localDate: '2026-09-01', sale: true },
  ];
  const selected = raw.filter(row => row.localDate >= scope.startDate);
  assert.equal(new Set(selected.map(row => row.id)).size, 2);
  assert.equal(new Set(selected.filter(row => row.sale).map(row => row.id)).size, 1);
  const unbounded = compileLifecycleDiagnostics({ clientId: scope.clientId });
  assert.equal(unbounded.currentLeadCtesSql(), 'current_operational_leads AS (SELECT * FROM operational_leads)', 'no comparison needs no second normalization');
  assert.ok(!unbounded.currentLeadCtesSql(true).includes('@lifecycleCurrentStart'));
});

test('Commercial operational summary preserves Overview totals with no diagnostics, quantiles, backlog or trend work', async context => {
  const requests: any[] = [];
  let row: any = summary;
  context.mock.method(client, 'query', async (request: any) => { requests.push(request); return [[row]] as any; });
  const light = await getOperationalCommercialSummary(scope);
  assert.equal(requests.length, 1);
  const full = await getExecutiveOverview(scope, { includeDiagnostics: false });
  for (const key of ['fetchedLeads', 'saleLeads', 'activatedLeads', 'leadToSaleRate', 'revenue'] as const) assert.equal(light.kpis[key], full.kpis[key], key);
  assert.equal(light.currency, full.currency);
  assert.equal(requests[0].params.startDate, scope.startDate, 'Commercial does not scan a previous cohort');
  assert.doesNotMatch(requests[0].query, /APPROX_QUANTILES|CURRENT_TIMESTAMP|daily_trends|backlog_vendor|lifecycle_aggregates|CROSS JOIN UNNEST/);
  row = { fetched_leads: 0, sale_leads: 0, activated_leads: 0, total_revenue: null };
  assert.deepEqual((await getOperationalCommercialSummary(scope)).kpis, { fetchedLeads: 0, saleLeads: 0, activatedLeads: 0, leadToSaleRate: null, revenue: null });
});

test('lifecycle payload serializes all contribution metrics once and preserves full reconciliation', context => {
  const output = assembleLifecycleDiagnostics(evidence, matchedPeriodWindow(scope.startDate, scope.endDate));
  const payload = JSON.stringify(output);
  const legacy = JSON.stringify({ ...output, contributions: output.rateContributions.saleRate });
  assert.equal(Object.hasOwn(output, 'contributions'), false);
  assert.deepEqual(Object.keys(output.rateContributions), ['deliveryRate', 'dialRate', 'rpcRate', 'saleRate', 'activationRate']);
  const before = Buffer.byteLength(legacy), after = Buffer.byteLength(payload);
  assert.ok(after < before);
  context.diagnostic(`Representative fully reconciled fixture: ${before} → ${after} JSON bytes (${((before - after) * 100 / before).toFixed(1)}% smaller); production savings vary by segment cardinality.`);
  for (const metrics of Object.values(output.rateContributions)) for (const decomposition of Object.values(metrics)) {
    assert.equal(decomposition?.status, 'RECONCILED');
    assert.ok(Math.abs(decomposition!.contributions.reduce((sum, row) => sum + row.contributionPp, 0) - decomposition!.deltaPp) < 1e-9);
  }
});

test('pending lifecycle coalescing separates changed filters and ambient scope, and failed jobs are retryable', async context => {
  const requests: any[] = [];
  const release: Array<(value: any) => void> = [];
  context.mock.method(client, 'query', (request: any) => {
    requests.push(request);
    return new Promise(resolve => release.push(resolve));
  });
  const first = getLifecycleDiagnostics(scope);
  const identical = getLifecycleDiagnostics({ grade: 'A', source: 'S1', vendor: 'V1', endDate: scope.endDate, startDate: scope.startDate, clientId: scope.clientId });
  assert.equal(first, identical, 'property order does not prevent safe pending-only sharing');
  const changed = getLifecycleDiagnostics({ ...scope, vendor: 'V2' });
  const ambient = withAnalyticsScope({ clientId: scope.clientId, filters: { vendor: { operator: 'equals', value: 'V3' } } }, () => getLifecycleDiagnostics(scope));
  assert.equal(requests.length, 3);
  release.forEach(resolve => resolve([evidence]));
  await Promise.all([first, identical, changed, ambient]);

  context.mock.method(client, 'query', async () => { throw new Error('transient warehouse failure'); });
  await assert.rejects(getLifecycleDiagnostics(scope), /transient warehouse failure/);
  let retries = 0;
  context.mock.method(client, 'query', async () => { retries++; return [evidence] as any; });
  await getLifecycleDiagnostics(scope);
  assert.equal(retries, 1, 'a failed pending promise never poisons subsequent reads');
});
