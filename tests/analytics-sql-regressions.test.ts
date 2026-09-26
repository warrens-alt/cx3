import test from 'node:test';
import assert from 'node:assert/strict';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { validTimestampSql } from '../server/bigquery/integrity';
import { getOperatingControlsAnalytics } from '../server/analytics/contact/operatingControls';
import { getFunnelIntelligence } from '../server/analytics/funnel/service';
import { getCohortStats } from '../server/bigquery/legacy/cohorts';
import { getRawLeads } from '../server/analytics/investigation/records';

const clientId = 'default_tenant';
const client = getBigQueryClient(getClientConfig(clientId).bigQueryProject);

test('operational and funnel SQL normalize sentinel timestamps before success flags and latency arithmetic', async context => {
  const queries: string[] = [];
  context.mock.method(client, 'query', async (options: any) => {
    queries.push(options.query);
    return [[{}]] as any;
  });
  await getOperatingControlsAnalytics({ clientId });
  await getFunnelIntelligence({ clientId });
  for (const query of queries) {
    // This is the query submitted by each real service, not a disconnected SQL helper.
    for (const field of ['delivered', 'first_call_date', 'sale', 'activated']) {
      assert.ok(query.includes(validTimestampSql(`hlc.${field}`)), field);
      assert.ok(!query.includes(`SAFE_CAST(hlc.${field} AS TIMESTAMP)`), `Unnormalized ${field} allows 1970/1900 to qualify as an event`);
    }
    assert.match(query, /CASE WHEN REGEXP_CONTAINS\(TRIM\(CAST\(hlc\.delivered AS STRING\)\), r'\^\(1900\|1970\)\(-\|\$\)'\) THEN NULL/);
  }
  assert.ok(queries[0].includes(`${validTimestampSql('hlc.delivered')} AS delivered_ts`));
  assert.ok(queries[0].includes(`${validTimestampSql('hlc.first_call_date')} AS first_call_ts`));
  assert.ok(queries[1].includes('TIMESTAMP_DIFF(first_call_ts, delivered_ts, SECOND)'));
  assert.match(queries[1], /FROM operational_leads/);
});

test('maturation queries use each outcome event timestamp rather than dating all outcomes to the first call', async context => {
  const queries: string[] = [];
  context.mock.method(client, 'query', async (options: any) => {
    queries.push(options.query);
    return [[{ cohort: '2026-09-01', size: 1, m_d0: 0, m_d1: 0, m_d3: 0, m_d7: 1, m_d14: 1, m_d30: 1 }]] as any;
  });
  for (const [metricType, timestamp, flag] of [
    ['sale', 'sale_timestamp', 'has_sale'],
    ['activation', 'activation_timestamp', 'has_activation'],
    ['rpc', 'rpc_timestamp', 'has_rpc'],
    ['call_coverage', 'first_call_timestamp', 'has_call'],
  ]) {
    const result = await getCohortStats({ clientId, cohortType: 'daily', metricType });
    const reportProjection = queries.at(-1)!.split('as cohort,')[1];
    assert.ok(reportProjection.includes(`TIMESTAMP_DIFF(${timestamp}, capture_timestamp, DAY) <= 0`));
    assert.ok(reportProjection.includes(`${timestamp} >= capture_timestamp`), 'Exclude outcomes recorded before capture');
    assert.ok(reportProjection.includes(`${timestamp} <= CURRENT_TIMESTAMP()`), 'Exclude future events');
    assert.ok(reportProjection.includes(`COUNTIF(${flag} AND ${timestamp} IS NULL) > 0 THEN NULL`), 'Do not replace missing event timing with a zero rate');
    if (metricType !== 'call_coverage') assert.ok(!reportProjection.includes('TIMESTAMP_DIFF(first_call_timestamp'));
    assert.equal(result[0].metrics.d0, 0);
    assert.equal(result[0].metrics.d7, 100);
  }
});

test('revenue maturation and outcomes without event timestamps remain unavailable', async context => {
  let query = '';
  context.mock.method(client, 'query', async (options: any) => {
    query = options.query;
    return [[{ cohort: '2026-09-01', size: 1, missing_event_timestamps: 1, m_d0: null, m_d1: null, m_d3: null, m_d7: null, m_d14: null, m_d30: null }]] as any;
  });
  const revenue = await getCohortStats({ clientId, metricType: 'revenue' });
  assert.ok(query.includes('CAST(NULL AS INT64) AS m_d0'));
  assert.equal(revenue[0].maturationStatus, 'UNAVAILABLE');
  assert.match(revenue[0].maturationReason!, /dated revenue events/);
  assert.deepEqual(Object.values(revenue[0].metrics), [null, null, null, null, null, null]);
  const sale = await getCohortStats({ clientId, metricType: 'sale' });
  assert.equal(sale[0].maturationStatus, 'UNAVAILABLE');
  assert.match(sale[0].maturationReason!, /no event timestamp/);
  await assert.rejects(getCohortStats({ clientId, metricType: 'unknown' }), /Unsupported cohort metric/);
});

test('all record drills operate on the vendor-scoped HLC array, including negative existence tests', async context => {
  const queries: Array<{ query: string; params: Record<string, unknown> }> = [];
  context.mock.method(client, 'query', async (options: any) => {
    queries.push(options);
    return [[]] as any;
  });
  for (const [drill, drillValue] of [
    ['awaiting-first-dial', ''], ['missing-disposition', ''], ['unactivated-sales', ''],
    ['high-attempt-no-rpc', ''], ['one-call-only', ''], ['sla-breach', ''],
    ['backlog-age', '24h+'], ['funnel-stage', 'sales'], ['lead-age', 'Undialled'],
    ['funnel-loss', 'delivered-to-dialled'],
  ]) {
    await getRawLeads({ clientId, vendor: 'B', drill, drillValue });
    const submitted = queries.at(-1)!;
    assert.equal(submitted.params.vendor, 'B');
    const [scopeCte, report] = submitted.query.split('    SELECT\n      l.lead_id,');
    assert.match(scopeCte, /WITH scoped_leads AS/);
    assert.match(scopeCte, /ARRAY\(SELECT AS STRUCT h\.\* FROM UNNEST\(l\.hlc_details\) h\s+WHERE LOWER\(h\.vendor\) = LOWER\(@vendor\)\) AS hlc_details/);
    assert.match(report, /FROM scoped_leads l/);
    assert.ok(!report.includes(getClientConfig(clientId).semanticMappings.tables.leads));
  }
  // A's call cannot affect the lead rollup after the scoped CTE has retained only B.
  assert.match(queries[0].query, /JOIN operational_leads m ON l.lead_id = m.lead_id/);
  assert.match(queries[0].query, /AND \(m.is_delivered AND NOT m.is_dialled\)/);
});
