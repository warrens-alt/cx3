import test from 'node:test';
import assert from 'node:assert/strict';
import { operationalFilterValues } from '../server/offernetScope';
import { buildFilterClause } from '../server/analytics/common/scope';
import { operationalMetadata } from '../server/analytics/common/lineage';
import { validateFilters } from '../server/bigquery/filters';
import { scopedAnalysisRows } from '../src/lib/analysisExport';
import { redactReportRecords } from '../server/analytics/common/reportAccess';
import { getCohortStats } from '../server/bigquery/legacy/cohorts';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';

test('marketing dimensions are intentionally supported only on marketing-capable surfaces', () => {
  const filters = validateFilters({ campaign: { operator: 'equals', value: 'Campaign A' },
    channel: { operator: 'equals', value: 'Search' }, adset: { operator: 'equals', value: 'Adset 1' } });
  for (const route of ['campaigns', 'commercial', 'marketing-attribution', 'marketing-root-cause']) {
    assert.deepEqual(operationalFilterValues(filters, `/offernet/${route}`), { campaign: 'Campaign A', channel: 'Search', adset: 'Adset 1' });
  }
  for (const route of ['overview', 'funnel', 'exceptions', 'speed-to-lead']) {
    assert.throws(() => operationalFilterValues(filters, `/offernet/${route}`), /cannot apply/);
  }
});

test('direct lead query callers cannot silently drop cross-grain filters', () => {
  for (const dimension of ['campaign', 'channel', 'adset', 'agent', 'cli']) {
    assert.throws(() => buildFilterClause({ clientId: 'mtn', [dimension]: 'requested' }), /UNSUPPORTED_FILTER/);
  }
});

test('capture cohort date and vendor/source filters retain tenant-local scope', () => {
  const { whereSql, queryParams } = buildFilterClause({ clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-02', vendor: 'MTN', source: 'web' });
  assert.match(whereSql, /DATE\(SAFE_CAST\(l.fetched AS TIMESTAMP\), @scopeTimezone\) >= @startDate/);
  assert.match(whereSql, /LOWER\(hlc.vendor\) = LOWER\(@vendor\)/);
  assert.equal(queryParams.scopeTimezone, 'Africa/Johannesburg');
  assert.equal(queryParams.source, 'web');
  assert.equal(queryParams.vendor, 'MTN');
  assert.equal(queryParams.endDate, '2026-09-02');
});

test('aggregate export includes scope and trust metadata without replacing zero or null', () => {
  const rows = scopedAnalysisRows([['Campaign', 'Spend'], ['A', 0], ['B', null]], {
    clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-02',
    filters: { campaign: { operator: 'equals', value: 'A' } }, validationStatus: 'INVALID_GRAIN',
    dateBasis: 'marketing_reporting_date', definitions: 'Observed spend only', truncated: true,
  });
  assert.equal(rows[1][1], 0);
  assert.equal(rows[2][1], null);
  assert.equal(rows[1][2], 'mtn');
  assert.equal(rows[1][6], 'INVALID_GRAIN');
  assert.equal(rows[1].at(-1), true);
  assert.equal(rows[0].length, rows[1].length);
});

test('operational metadata makes metric populations and pending validation inspectable', () => {
  const metadata = operationalMetadata({ clientId: 'mtn', filters: {} }, 'commercial');
  assert.equal(metadata.validationStatus, 'NOT_VERIFIED');
  const metric = metadata.metricDefinitions.find(m => m.id === 'totalSpend');
  assert.ok(metric);
  assert.match(metric.nullMeaning, /Budget is never spend/);
  assert.equal(metadata.timezone, 'Africa/Johannesburg');
});

test('aggregate report samples remain administrator-only without changing summary populations', () => {
  const report = { overview: { leads: 7 }, missingSample: [{ lead_id: 'private' }], repeatConsumersSample: [{ consumer_id: 'private' }] };
  const viewer = redactReportRecords(report, false);
  assert.deepEqual(viewer.overview, report.overview);
  assert.deepEqual(viewer.missingSample, []);
  assert.deepEqual(viewer.repeatConsumersSample, []);
  assert.equal(redactReportRecords(report, true), report);
  assert.equal(report.missingSample.length, 1);
});

test('source-wide metadata never claims to have applied capture-cohort dates', () => {
  const metadata = operationalMetadata({ clientId: 'mtn', startDate: '2026-09-01', endDate: '2026-09-03' }, 'source-observability');
  assert.equal(metadata.startDate, null);
  assert.equal(metadata.dateBasis, 'all_tenant_owned_source_rows');
  assert.deepEqual(metadata.metricDefinitions, []);
});

test('cohort rates preserve empty denominators, real zeros and the displayed-row limit', async context => {
  let supplied: any[] = [{ cohort: 'Empty', size: 0, delivered: 0, called: 0, rpcs: 0, sales: 0, activations: 0, revenue: null, m_d0: 0 }];
  const queries: any[] = [];
  context.mock.method(getBigQueryClient(getClientConfig('mtn').bigQueryProject), 'query', async (request: any) => { queries.push(request); return [supplied] as any; });
  const first = (await getCohortStats({ clientId: 'mtn' }))[0];
  for (const field of ['deliveryRate', 'callRate', 'callCoverage', 'rpcRate', 'saleRate', 'activationRate', 'revenue', 'revPerLead'] as const) assert.equal(first[field], null, field);
  assert.equal(first.metrics.d0, null);
  supplied = Array.from({ length: 17 }, (_, i) => ({ cohort: `C${i}`, size: 10, delivered: 8, called: 5, sales: 2, activations: 1, revenue: 0, m_d0: 0 }));
  const second = await getCohortStats({ clientId: 'mtn' });
  assert.equal(second.length, 16);
  assert.equal(second[0].detailTruncated, true);
  assert.equal(second[0].saleRate, 20);
  assert.equal(second[0].activationRate, 50);
  assert.equal(second[0].revPerLead, 0);
  assert.match(queries[0].query, /LIMIT 17/);
  assert.ok(!queries[0].query.includes('SUM(IFNULL(total_revenue, 0)) as revenue'));
  for (const key of ['agent', 'cli', 'channel', 'adset', 'campaign']) {
    await assert.rejects(() => getCohortStats({ clientId: 'mtn', filters: { [key]: { operator: 'equals', value: 'A' } } }), /not supported at lead grain/);
  }
  assert.equal(queries.length, 2, 'unsupported scopes are rejected before warehouse access');
});
