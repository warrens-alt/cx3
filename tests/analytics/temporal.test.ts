import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTemporalQuery, buildTemporalResult } from '../../server/analytics/temporal/service';
import { operationalLeadCtes } from '../../server/analytics/common/leadMetrics';
import { getClientConfig } from '../../server/bigquery/config';
import { validTimestampSql } from '../../server/bigquery/integrity';

test('temporal: normal hourly volume generates 168 cells and top peak windows', () => {
  const data = {
    matrix: [
      { iso_day: 1, hour_of_day: 9, volume: 100, dialled: 100, contacted: 55, sales: 8, activations: 6 },
      { iso_day: 1, hour_of_day: 10, volume: 150, dialled: 150, contacted: 90, sales: 15, activations: 12 },
      { iso_day: 2, hour_of_day: 14, volume: 80, dialled: 80, contacted: 48, sales: 6, activations: 4 },
    ],
    operating_summary: [
      { is_after_hours: false, leads: 500, dialled: 500, contacted: 280, sales: 40 },
      { is_after_hours: true, leads: 80, dialled: 80, contacted: 20, sales: 2 },
    ],
  };

  const clientConfig = { timezone: 'Africa/Johannesburg' };
  const operating = { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };

  const result = buildTemporalResult(data, clientConfig, operating);

  // Exactly 7 days * 24 hours = 168 cells in matrix
  assert.equal(result.heatmap.length, 168);

  const mon10 = result.heatmap.find(c => c.dayIndex === 1 && c.hour === 10)!;
  assert.equal(mon10.volume, 150);
  assert.equal(mon10.contactRate, 60.0); // 90 / 150 = 60.0%
  assert.equal(mon10.saleRate, 10.0);    // 15 / 150 = 10.00%
  assert.equal(mon10.activationRate, 80.0); // 12 / 15 = 80.0%

  // Top peak windows sort by contactRate desc
  assert.ok(result.peakWindows.length > 0);
  assert.equal(result.peakWindows[0].contactRate, '60.0%');

  // Operating comparison
  assert.equal(result.operatingComparison[0].contactRate, 56.0); // 280 / 500 = 56.0%
});

test('temporal: 0 volume hours have null contactRate and saleRate, never 0%', () => {
  const data = {
    matrix: [],
    operating_summary: [],
  };

  const clientConfig = { timezone: 'Africa/Johannesburg' };
  const operating = { start: '08:00', end: '17:30', workdays: [1, 2, 3, 4, 5] };

  const result = buildTemporalResult(data, clientConfig, operating);

  // Empty cell
  const emptyCell = result.heatmap[0];
  assert.equal(emptyCell.volume, 0);
  assert.equal(emptyCell.contactRate, null);
  assert.equal(emptyCell.saleRate, null);
  assert.equal(emptyCell.activationRate, null);

  // Peak windows ignore zero volume cells
  assert.equal(result.peakWindows.length, 0);
});

const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-30' };

test('temporal: every operational lead reference is backed by the canonical CTE', () => {
  const { query } = buildTemporalQuery(scope);
  assert.ok(query.includes(`WITH ${operationalLeadCtes(scope)},`));
  assert.equal((query.match(/operational_leads AS \(/g) || []).length, 1);
  assert.ok(query.indexOf('operational_leads AS (') < query.indexOf('FROM operational_leads'));
  assert.doesNotMatch(query, /lead_level AS/);
  assert.match(query, /COUNTIF\(is_dialled AND is_rpc IS TRUE\) AS contacted/);
});

test('temporal: all lifecycle timestamps use the canonical invalid/sentinel-safe parser', () => {
  const { query } = buildTemporalQuery(scope);
  for (const field of ['l.fetched', 'hlc.delivered', 'hlc.first_call_date', 'hlc.sale', 'hlc.activated']) {
    assert.ok(query.includes(validTimestampSql(field)), field);
  }
  assert.match(validTimestampSql('event'), /1900\|1970/);
  assert.match(validTimestampSql('event'), /SAFE_CAST\(NULLIF\(TRIM/);
  assert.doesNotMatch(query, /first_call_date NOT LIKE/);
});

test('temporal: unknown RPC stays distinct and a recorded zero rate stays measured zero', () => {
  const { query } = buildTemporalQuery(scope);
  assert.match(query, /CASE WHEN COUNTIF\(is_rpc\) > 0 THEN TRUE WHEN COUNTIF\(is_rpc IS NULL\) > 0 THEN NULL ELSE FALSE END AS is_rpc/);
  assert.match(query, /COUNTIF\(is_dialled AND is_rpc IS NULL\) AS dialled_rpc_unknown_leads/);
  const result = buildTemporalResult({ matrix: [{ iso_day: 1, hour_of_day: 9, volume: 4, dialled: 4, contacted: 0, rpc_unknown_leads: 3, dialled_rpc_unknown_leads: 3, sales: 0, activations: 0 }] });
  const cell = result.heatmap.find(c => c.dayIndex === 1 && c.hour === 9)!;
  assert.equal(cell.contactRate, 0);
  assert.equal(cell.rpcUnknownLeads, 3);
  assert.equal(cell.dialledRpcUnknownLeads, 3);
  assert.equal(cell.saleRate, 0);
  assert.equal(cell.activationRate, null);
});

test('temporal: unavailable dial evidence is never replaced by intake volume', () => {
  const result = buildTemporalResult({ matrix: [{ iso_day: 1, hour_of_day: 9, volume: 4, contacted: 2 }], operating_summary: [{ leads: 4, contacted: 2 }] });
  assert.equal(result.heatmap.find(c => c.dayIndex === 1 && c.hour === 9)!.contactRate, null);
  assert.equal(result.operatingComparison[0].contactRate, null);
});

test('temporal: three recorded event bases preserve the capture cohort and missing evidence', () => {
  const { query, queryParams } = buildTemporalQuery(scope);
  assert.match(query, /DATE\(SAFE_CAST\(l.fetched AS TIMESTAMP\), @scopeTimezone\) >= @startDate/);
  assert.match(query, /STRUCT\('Capture' AS basis, fetched_ts AS event_ts\), STRUCT\('Delivery', delivered_ts\), STRUCT\('First dial', first_call_ts\)/);
  const eventQuery = query.split('event_matrix AS (')[1].split('operating_summary AS (')[0];
  assert.doesNotMatch(eventQuery, /WHERE|@startDate|@endDate/);
  assert.equal(queryParams.startDate, scope.startDate);
  assert.equal(queryParams.endDate, scope.endDate);
  const event_matrix = ['Capture', 'Delivery', 'First dial'].flatMap(basis => [
    { basis, iso_day: 1, hour_of_day: 23, volume: 6, dialled: 3, contacted: 1, sales: 1, activations: 0, rpc_unknown_leads: 2, dialled_rpc_unknown_leads: 1 },
    { basis, iso_day: null, hour_of_day: null, volume: 4, dialled: 0, contacted: 0, sales: 0, activations: 0, rpc_unknown_leads: 4, dialled_rpc_unknown_leads: 0 },
  ]);
  const result = buildTemporalResult({ matrix: [], event_matrix });
  for (const basis of result.timeBases) {
    assert.equal(basis.cohortLeads, 10);
    assert.equal(basis.recordedTimestampLeads, 6);
    assert.equal(basis.missingTimestampLeads, 4);
    assert.equal(basis.heatmap.reduce((n, r) => n + r.volume, 0), 6);
    assert.equal(basis.byHour[23].contactRate, 33.3);
  }
  assert.match(result.methodology, /observed associations by recorded event timestamp, not causal calling recommendations/);
});

test('temporal: tenant timezone, configured source and vendor filters stay scoped', () => {
  for (const clientId of ['default_tenant', 'mtn', 'ontact_blc', 'mondo', 'rewardsco']) {
    const { query, queryParams } = buildTemporalQuery({ ...scope, clientId, vendor: 'Scoped vendor' });
    const config = getClientConfig(clientId);
    assert.ok(query.includes(config.semanticMappings.tables.leads));
    assert.equal(queryParams.scopeTimezone, config.timezone);
    assert.equal(queryParams.tenantTimezone, config.timezone);
    assert.equal(queryParams.vendor, 'Scoped vendor');
    assert.match(query, /LOWER\(hlc.vendor\) = LOWER\(@vendor\)/);
    for (const format of query.matchAll(/FORMAT_TIMESTAMP\([^\n]+?\)/g)) assert.match(format[0], /@tenantTimezone/);
    if (clientId !== 'default_tenant') assert.ok(!query.includes(getClientConfig('default_tenant').semanticMappings.tables.leads));
  }
});

test('temporal: unsupported source dimensions and unknown tenants fail closed', () => {
  for (const dimension of ['campaign', 'channel', 'adset', 'agent', 'cli']) {
    assert.throws(() => buildTemporalQuery({ ...scope, [dimension]: 'unsupported' }), /UNSUPPORTED_FILTER/);
  }
  assert.throws(() => buildTemporalQuery({ ...scope, clientId: 'mtn', grade: 'A' }), /UNSUPPORTED_FILTER/);
  assert.throws(() => buildTemporalQuery({ ...scope, clientId: 'not-a-tenant' }));
});
