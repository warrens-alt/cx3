import test from 'node:test';
import assert from 'node:assert/strict';
import { getBigQueryClient } from '../server/bigquery/client';
import { getClientConfig } from '../server/bigquery/config';
import { validTimestampSql } from '../server/bigquery/integrity';
import { operationalLeadCtes, metricPercent } from '../server/analytics/common/leadMetrics';
import { getExecutiveOverview } from '../server/analytics/overview/service';
import { getOperatingControlsAnalytics } from '../server/analytics/contact/operatingControls';
import { getContactStrategyAnalytics } from '../server/analytics/contact/strategy';
import { getSpeedToLeadAnalytics } from '../server/analytics/contact/speedToLead';
import { getSalesActivationAnalytics } from '../server/analytics/outcomes/salesActivation';
import { getVendorQualityAnalytics } from '../server/analytics/performance/vendor';
import { getTemporalAnalytics } from '../server/analytics/temporal/service';
import { getDataIntegrityAnalytics } from '../server/analytics/integrity/completeness';
import { getRawLeads } from '../server/analytics/investigation/records';

// Synthetic scenarios independently calculated from the reviewed metric definitions.
// The oracle below does not execute BigQuery SQL. Submitted-query assertions test the
// production compiler boundary; real warehouse execution is a separate validation step.
type Hlc = { vendor: string; calls: number | null; rpc: number | null; delivered?: string; dial?: string; sale?: string; activation?: string; disposition?: string };
type Lead = { id: string; fetched: string; outcomes: Hlc[] };
const captured = '2026-09-01T08:00:00Z';
const delivered = '2026-09-01T08:01:00Z';
const firstDial = '2026-09-01T08:06:00Z';
const fixture: Lead[] = [
  // The extra undialled snapshot must not put A back in a first-dial backlog.
  { id: 'A', fetched: captured, outcomes: [
    { vendor: 'V1', calls: 1, rpc: null, delivered },
    { vendor: 'V1', calls: 3, rpc: 1, delivered, dial: firstDial, disposition: 'RPC' },
    { vendor: 'V2', calls: 2, rpc: 0, delivered },
  ] },
  { id: 'B', fetched: captured, outcomes: [{ vendor: 'V1', calls: 1, rpc: 0, delivered, dial: firstDial }] },
  { id: 'C', fetched: captured, outcomes: [{ vendor: 'V1', calls: null, rpc: null, delivered }] },
  // Sentinel pairs must not count as two events with a legitimate zero latency.
  { id: 'D', fetched: captured, outcomes: [{ vendor: 'V1', calls: 0, rpc: 0, delivered: '1900-01-01', dial: '1970-01-01', sale: 'not-a-date' }] },
  // A recorded zero is not enough to prove no RPC when other evidence is missing.
  { id: 'E', fetched: captured, outcomes: [{ vendor: 'V1', calls: 5, rpc: 0, delivered, dial: firstDial }, { vendor: 'V1', calls: 5, rpc: null, delivered }] },
  { id: 'F', fetched: captured, outcomes: [{ vendor: 'V1', calls: 5, rpc: 0, delivered, dial: firstDial }] },
];
const timestamp = (value?: string): number | null => {
  if (!value || /^(1900|1970)(-|$)/.test(value.trim())) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
};
function oracle(leads: Lead[], vendor?: string) {
  return leads.flatMap(lead => {
    const rows = vendor ? lead.outcomes.filter(row => row.vendor === vendor) : lead.outcomes;
    if (vendor && !rows.length) return [];
    const minimum = (field: 'delivered' | 'dial' | 'sale' | 'activation') => {
      const values = rows.map(row => timestamp(row[field])).filter((value): value is number => value !== null);
      return values.length ? Math.min(...values) : null;
    };
    const counts = rows.map(row => row.calls).filter((value): value is number => value !== null && value >= 0);
    const rpc = rows.some(row => row.rpc !== null && row.rpc > 0) ? true : !rows.length || rows.some(row => row.rpc === null || row.rpc < 0) ? null : false;
    const delivery = minimum('delivered'), dial = minimum('dial');
    return [{ id: lead.id, calls: counts.length ? Math.max(...counts) : null, rpc, delivery, dial,
      sale: minimum('sale'), activation: minimum('activation'),
      latency: delivery !== null && dial !== null && dial >= delivery ? (dial - delivery) / 1000 : null,
      disposition: rows.some(row => timestamp(row.dial) !== null && Boolean(row.disposition?.trim())) }];
  });
}
const scope = { clientId: 'default_tenant' };
const client = getBigQueryClient(getClientConfig(scope.clientId).bigQueryProject);

test('synthetic multi-HLC oracle has exclusive lead populations, max counters and unknown RPC', () => {
  const leads = oracle(fixture);
  assert.equal(leads.length, 6);
  assert.deepEqual(leads.map(row => row.calls), [3, 1, null, 0, 5, 5]);
  assert.deepEqual(leads.map(row => row.rpc), [true, false, null, false, null, false]);
  assert.deepEqual(leads.filter(row => row.delivery !== null && row.dial === null).map(row => row.id), ['C']);
  assert.deepEqual(leads.filter(row => row.calls !== null && row.calls >= 5 && row.rpc === false).map(row => row.id), ['F']);
  assert.deepEqual(leads.filter(row => row.dial !== null && !row.disposition).map(row => row.id), ['B', 'E', 'F']);
  assert.equal(leads.reduce((sum, row) => sum + (row.calls ?? 0), 0), 14);
  assert.deepEqual(oracle(fixture, 'V2').map(row => ({ id: row.id, calls: row.calls, dial: row.dial })), [{ id: 'A', calls: 2, dial: null }]);
  assert.equal(leads[3].sale, null);
  assert.equal(leads[3].latency, null);
});

test('timing oracle excludes negative/sentinel durations while retaining zero and slow valid calls', () => {
  const leads = oracle([
    { id: 'negative', fetched: captured, outcomes: [{ vendor: 'V', calls: 1, rpc: 0, delivered: firstDial, dial: delivered }] },
    { id: 'zero', fetched: captured, outcomes: [{ vendor: 'V', calls: 1, rpc: 0, delivered, dial: delivered }] },
    { id: 'slow', fetched: captured, outcomes: [{ vendor: 'V', calls: 1, rpc: 0, delivered, dial: '2026-09-11T08:01:00Z' }] },
    { id: 'malformed', fetched: captured, outcomes: [{ vendor: 'V', calls: -1, rpc: -1, delivered: 'invalid', dial: firstDial }] },
  ]);
  assert.deepEqual(leads.map(row => row.latency), [null, 0, 864000, null]);
  assert.equal(leads[3].calls, null);
  assert.equal(leads[3].rpc, null);
});

test('production lead compiler retains timestamp validation, filter scope and mixed unknown evidence', () => {
  const sql = operationalLeadCtes({ ...scope, vendor: 'V2', source: 'test', startDate: '2026-09-01', endDate: '2026-09-30' });
  assert.match(sql, /MAX\(total_calls\) AS recorded_call_count/);
  assert.match(sql, /CASE WHEN COUNTIF\(is_rpc\) > 0 THEN TRUE WHEN COUNTIF\(is_rpc IS NULL\) > 0 THEN NULL ELSE FALSE END AS is_rpc/);
  assert.match(sql, /WHERE lead_id IS NOT NULL\s+GROUP BY lead_id/);
  assert.match(sql, /LOWER\(hlc.vendor\) = LOWER\(@vendor\)/);
  assert.match(sql, /LOWER\(l.offershop_source\) = LOWER\(@source\)/);
  assert.match(sql, /CASE WHEN SAFE_CAST\(hlc.total_calls AS INT64\) >= 0/);
  assert.ok(!sql.includes('COALESCE(SAFE_CAST(hlc.total_calls'));
  for (const field of ['fetched', 'hlc.delivered', 'hlc.first_call_date', 'hlc.sale', 'hlc.activated', 'hlc.attempted_to_deliver']) {
    assert.ok(sql.includes(validTimestampSql(field === 'fetched' ? 'l.fetched' : field)), field);
  }
  assert.match(operationalLeadCtes(scope, true), /GROUP BY lead_id, vendor/);
});

test('overview uses max cumulative controls and preserves unavailable counters and empty ratios', async context => {
  const values = oracle(fixture);
  let sql = '';
  context.mock.method(client, 'query', async (request: any) => {
    if (request.query.includes('AS total_calls_recorded')) sql = request.query;
    return [[{
      fetched_leads: values.length,
      delivered_leads: values.filter(row => row.delivery !== null).length,
      dialled_leads: values.filter(row => row.dial !== null).length,
      contacted_leads: values.filter(row => row.rpc === true).length,
      total_calls_recorded: null, recorded_calls_subtotal: 14, unrecorded_call_leads: 1,
      awaiting_first_dial: 1, dialled_missing_disposition: 3,
      median_delivery_to_dial_sec: 300, p90_delivery_to_dial_sec: 300,
    }]] as any;
  });
  const output = await getExecutiveOverview(scope);
  assert.equal(output.kpis.fetchedLeads, 6);
  assert.equal(output.kpis.deliveryRate, 83.3);
  assert.equal(output.kpis.dialRate, 80);
  assert.equal(output.kpis.contactRate, 25);
  assert.equal(output.kpis.totalCalls, null);
  assert.equal(output.kpis.recordedCallsSubtotal, 14);
  assert.equal(output.kpis.callsPerLead, null);
  assert.equal(output.kpis.activationRate, null);
  assert.equal(output.kpis.qualifiedLeads, null);
  assert.equal(output.backlog.awaitingFirstDial, 1);
  assert.match(sql, /FROM operational_leads/);
  assert.match(sql, /SUM\(recorded_call_count\)/);
  assert.ok(!sql.includes('SUM(COALESCE(total_calls'));
  assert.equal(metricPercent(0, 10), 0);
  assert.equal(metricPercent(0, 0), null);
});

test('contact strategy uses dialled denominator and excludes unrecorded RPC from no-RPC controls', async context => {
  const values = oracle(fixture);
  const buckets = new Map<string, any>();
  for (const row of values) {
    const bucket = row.calls === null ? 'Unrecorded' : row.calls === 1 ? '1 call' : row.calls >= 5 ? '5+ calls' : `${row.calls} calls`;
    const totals = buckets.get(bucket) ?? { attempt_bucket: bucket, leads: 0, dialled: 0, contacted: 0, no_rpc: 0, rpc_unrecorded: 0 };
    totals.leads++;
    totals.dialled += Number(row.dial !== null);
    totals.contacted += Number(row.rpc === true);
    totals.no_rpc += Number(row.rpc === false);
    totals.rpc_unrecorded += Number(row.rpc === null);
    buckets.set(bucket, totals);
  }
  let sql = '';
  context.mock.method(client, 'query', async (request: any) => { sql = request.query; return [[...buckets.values()]] as any; });
  const output = await getContactStrategyAnalytics(scope);
  assert.equal(output.summary.singleAttemptSharePct, 25);
  assert.equal(output.summary.dialledLeads, 4);
  assert.equal(output.summary.unrecordedCallLeads, 1);
  assert.equal(output.summary.zeroCallLeads, 1);
  assert.equal(output.summary.fivePlusNoRpcLeads, 1);
  assert.equal(output.attemptPerformance.find(row => row.bucket === 'Unrecorded')!.contactRate, null);
  assert.match(sql, /COUNTIF\(is_rpc IS FALSE\) AS no_rpc/);
  assert.match(sql, /WHEN call_count IS NULL THEN 'Unrecorded'/);
});

test('latency services use one normalized lead interval and preserve zero/missing measurements', async context => {
  const queries: string[] = [];
  context.mock.method(client, 'query', async (request: any) => {
    queries.push(request.query);
    return [[{ percentiles: { avg_cap_fetch: null, med_deliv_dial: 0, p90_deliv_dial: 864000 }, after_hours: [{ is_after_hours: null, leads: 1, dialled: 0, contacted: 0 }] }]] as any;
  });
  const speed = await getSpeedToLeadAnalytics(scope);
  assert.equal(speed.timingStages[0].stage, 'Capture → Delivery Attempt');
  assert.equal(speed.timingStages[0].avgSec, null);
  assert.equal(speed.timingStages[2].medianSec, 0);
  assert.equal(speed.timingStages[2].p90Sec, 864000);
  assert.equal(speed.afterHours[0].type, 'Unrecorded capture time');
  assert.equal(speed.afterHours[0].contactRate, null);
  assert.match(queries[0], /FROM operational_leads/);
  assert.match(queries[0], /WHEN NOT is_dialled THEN 'Undialled'/);
  assert.match(queries[0], /capture_to_first_dial_sec IS NULL OR capture_to_first_dial_sec < 0/);
  assert.match(queries[0], /CASE WHEN delivery_to_first_dial_sec >= 0/);
  assert.ok(!queries[0].includes('delivery_to_first_dial_sec BETWEEN 0 AND 604800'));
  await getSalesActivationAnalytics(scope);
  assert.match(queries[1], /sale_ts >= fetched_ts/);
  assert.match(queries[1], /activation_ts >= sale_ts/);
  assert.match(queries[1], /FROM operational_leads/);
});

test('operational drills share selected vendor lead grain and strict completed-day backlog boundary', async context => {
  const queries: string[] = [];
  context.mock.method(client, 'query', async (request: any) => { queries.push(request.query); return [[{}]] as any; });
  await getOperatingControlsAnalytics(scope);
  assert.match(queries[0], /TIMESTAMP_DIFF\(CURRENT_TIMESTAMP\(\), sale_ts, DAY\) > 14/);
  assert.match(queries[0], /recorded_call_count >= 5 AND is_rpc IS FALSE/);
  const expected: Record<string, string> = {
    'awaiting-first-dial': 'm.is_delivered AND NOT m.is_dialled',
    'missing-disposition': 'm.is_dialled AND NOT m.has_disposition',
    'unactivated-sales': 'm.is_sale AND NOT m.is_activated AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), m.sale_ts, DAY) > 14',
    'high-attempt-no-rpc': 'm.recorded_call_count >= 5 AND m.is_rpc IS FALSE',
    'one-call-only': 'm.is_dialled AND m.recorded_call_count = 1',
  };
  for (const [drill, predicate] of Object.entries(expected)) {
    await getRawLeads({ ...scope, vendor: 'V2', drill });
    const query = queries.at(-1)!;
    assert.ok(query.includes(`AND (${predicate})`), drill);
    assert.match(query, /JOIN operational_leads m ON l.lead_id = m.lead_id/);
    assert.match(query, /FROM scoped_leads l/);
    assert.equal(query.split(getClientConfig(scope.clientId).semanticMappings.tables.leads).length - 1, 1, 'Shared scoped source avoids adding a second physical table reference');
  }
  const now = Date.parse('2026-09-26T12:00:00Z');
  const aged = [14, 14.999, 15].map(days => Math.trunc((now - (now - days * 86400000)) / 86400000) > 14);
  assert.deepEqual(aged, [false, false, true]);
});

test('vendor, temporal and integrity report correct denominators, nulls and distinct lead evidence', async context => {
  const queries: string[] = [];
  context.mock.method(client, 'query', async (request: any) => {
    queries.push(request.query);
    if (request.query.includes('vendor_matrix AS')) return [[{ vendors: [{ vendor: 'V', leads: 10, delivered: 8, dialled: 4, contacted: 2, sales: 1, total_calls: null }], grades: [{ grade: 'G', leads: 10, dialled: 4, contacted: 2 }] }]] as any;
    if (request.query.includes('operating_summary AS')) return [[{ matrix: [{ iso_day: 1, hour_of_day: 8, volume: 10, dialled: 4, contacted: 2 }], operating_summary: [{ is_after_hours: null, leads: 1, dialled: 0 }] }]] as any;
    if (request.query.includes('lead_quality AS (')) return [[{ total_leads: 2, invalid_id_numbers: 1, invalid_mobile_numbers: 1, invalid_lead_flags: 1, unrecorded_validation_flags: 1 }]] as any;
    return [[{}]] as any;
  });
  const vendor = await getVendorQualityAnalytics(scope);
  assert.equal(vendor.vendors[0].dialRate, 50);
  assert.equal(vendor.vendors[0].contactRate, 50);
  assert.equal(vendor.vendors[0].callsPerLead, null);
  assert.equal(vendor.grades[0].contactRate, 50);
  assert.match(queries[0], /GROUP BY lead_id, vendor/);
  const temporal = await getTemporalAnalytics(scope);
  assert.equal(temporal.heatmap.find(row => row.dayIndex === 1 && row.hour === 8)!.contactRate, 50);
  assert.equal(temporal.operatingComparison[0].type, 'Unrecorded capture time');
  assert.equal(temporal.operatingComparison[0].contactRate, null);
  const integrity = await getDataIntegrityAnalytics(scope);
  const captureCheck = integrity.checks.find(check => check.checkName === 'Missing / Sentinel Capture Timestamps')!;
  assert.equal(captureCheck.status, 'UNAVAILABLE');
  assert.equal(captureCheck.discrepancyCount, null);
  const integritySql = queries.find(query => query.includes('lead_quality AS ('))!;
  assert.match(integritySql, /GROUP BY l.lead_id/);
  assert.match(integritySql, /LOWER\(TRIM\(l.valid_idno\)\) IN \('0', 'false'\)/);
  assert.match(integritySql, /l.valid_lead IS FALSE/);
  assert.match(integritySql, /COUNTIF\(is_dialled AND NOT has_disposition\)/);
});

test('campaign summary includes groups beyond the 250 detail limit and uses weighted full-scope ratios', async context => {
  const { getClientCampaignAnalytics } = await import('../server/analytics/campaigns/performance');
  const { marketingContractCache } = await import('../server/analytics/common/marketing');
  const contract = getClientConfig(scope.clientId).marketing!;
  marketingContractCache.delete(contract.table);
  context.after(() => marketingContractCache.delete(contract.table));
  // The final group has little lead volume but significant spend; truncating it changes every cost ratio.
  const allGroups = Array.from({ length: 251 }, (_, index) => ({
    client_name: 'Synthetic Client', channel: 'Synthetic Channel', campaign_name: `Campaign ${index}`, adset_name: 'Group',
    impressions: 100, reach: 50, clicks: 10, outbound_clicks: 5,
    recorded_leads: index === 250 ? 1 : 2,
    recorded_spend: index === 250 ? 10000 : 10,
    latest_budget: 999999,
  }));
  const totals = allGroups.reduce((sum, row) => ({ impressions: sum.impressions + row.impressions, reach: sum.reach + row.reach,
    clicks: sum.clicks + row.clicks, outbound_clicks: sum.outbound_clicks + row.outbound_clicks,
    recorded_leads: sum.recorded_leads + row.recorded_leads, recorded_spend: sum.recorded_spend + row.recorded_spend }),
    { impressions: 0, reach: 0, clicks: 0, outbound_clicks: 0, recorded_leads: 0, recorded_spend: 0 });
  let duplicateRows = 0;
  const queries: Array<{ query: string; params: any }> = [];
  context.mock.method(client, 'query', async (request: any) => {
    queries.push(request);
    if (request.query.includes('INFORMATION_SCHEMA.COLUMNS')) {
      return [[contract.clientNameField, contract.dateField, contract.channelField, contract.campaignField, contract.adsetField,
        contract.impressionsField, contract.clicksField, contract.leadsField, contract.reachField, contract.outboundClicksField,
        contract.approvedSpendFields[0], contract.approvedBudgetFields[0]].filter(Boolean).map(column_name => ({ column_name }))] as any;
    }
    if (request.query.includes('AS campaign_group_count')) return [[{ row_count: 251, distinct_grain_count: 251, duplicate_grain_rows: duplicateRows, campaign_group_count: 251, campaign_aggregation_spend: totals.recorded_spend, campaign_details: allGroups.slice(0, 250), ...totals }]] as any;
    return [allGroups.slice(0, 250)] as any;
  });
  const result = await getClientCampaignAnalytics({ ...scope, campaign: 'Synthetic Campaign' });
  assert.equal(result.campaigns.length, 250);
  assert.equal(result.summary!.spend, 12500);
  assert.equal(result.summary!.leads, 501);
  assert.equal(result.summary!.cpc, 4.98);
  assert.equal(result.summary!.cpl, 24.95);
  assert.deepEqual(result.detailScope, { totalCampaignGroups: 251, displayedCampaignGroups: 250, rowLimit: 250, truncated: true });
  assert.match(result.metricDefinitions!.cpl.denominator, /platform lead events/);
  assert.equal(result.metricDefinitions!.ledgerCpl.status, 'UNAVAILABLE');
  const fullTotalsQuery = queries.find(row => row.query.includes('AS campaign_group_count'))!;
  const detailQuery = queries.find(row => row.query.includes('LIMIT 250'))!;
  assert.match(fullTotalsQuery.query, /ARRAY\(SELECT AS STRUCT \* FROM campaign_spend[\s\S]*LIMIT 250\) AS campaign_details/);
  assert.match(fullTotalsQuery.query.trim(), /FROM scoped_marketing$/);
  assert.match(fullTotalsQuery.query, /SUM\(/);
  assert.match(fullTotalsQuery.query, /LOWER\(CAST\(`Channel_Campaign_Name` AS STRING\)\) = LOWER\(@campaign\)/);
  assert.equal(fullTotalsQuery.params.campaign, detailQuery.params.campaign);
  assert.equal(fullTotalsQuery.params.campaign, 'Synthetic Campaign');
  duplicateRows = 1;
  const invalid = await getClientCampaignAnalytics(scope);
  assert.equal(invalid.status, 'INVALID_GRAIN');
  assert.equal(invalid.summary!.spend, null);
  assert.equal(invalid.summary!.cpc, null);
  assert.equal(invalid.summary!.cpl, null);
  assert.ok(invalid.campaigns.every(row => row.spend === null));
});
