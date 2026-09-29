import { getOffershopProcessFlow } from '../server/analytics/process/offershopProcess';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWarehouseCrossDatasetAnalytics } from '../server/analytics/warehouse/warehouseAnalytics';
import { assertWarehouseReadAccess, buildWarehouseReadPlan, pullWarehouseTableData, warehouseWindow, type PullTableDataOptions } from '../server/analytics/warehouse/warehousePull';
import { getRubixPowerBiConfig } from '../server/blc/powerbi/config';
import { RubixPowerBiService } from '../server/blc/powerbi/service';
import { validationValue, validationSql } from '../contracts/validation';
import { operationalLeadCtes, operationalLeadSelectSql, completeRevenueSumSql } from '../server/analytics/common/leadMetrics';
import { getContactStrategyAnalytics } from '../server/analytics/contact/strategy';
import { getExecutiveOverview } from '../server/analytics/overview/service';
import { getBigQueryClient } from '../server/bigquery/client';
import { readAnalyticsResponse } from '../src/lib/analyticsRequest';
import { checkDeployment } from '../scripts/check-deployment.mjs';

const access = { clientId: 'default_tenant', role: 'admin', tenants: ['default_tenant'] };
const options: PullTableDataOptions = { project: 'dashboards-422710', dataset: 'lead_ledger', table: 'clustered_lead_ledger', startDate: '2026-07-01', endDate: '2026-07-31', access };
const fields = [{ name: 'lead_id', type: 'STRING' }, { name: 'consumer_id', type: 'INT64' }, { name: 'fetched', type: 'STRING' }, { name: 'standardised_idno', type: 'STRING' }, { name: 'hlc_details', type: 'RECORD', mode: 'REPEATED' }, { name: 'secret', type: 'STRING' }];

test('warehouse catalogue never substitutes business measures or claims connectivity', async () => {
  const result = await getWarehouseCrossDatasetAnalytics('default_tenant');
  assert.equal(result.evidence.liveDataQueried, false);
  assert.equal(result.kpis.totalObservedRecordsEstimate, null);
  assert.equal(result.waterfallSummary.averageStageRetentionPct, null);
  assert.ok(result.waterfallSummary.timelines.every(t => t.estimatedVolume === null && t.conversionRateEstimatePct === null));
  assert.equal(result.touchpointsSummary.combinedEstimatedSpend, null);
  assert.deepEqual(result.rawTelemetrySummary.ontactDialler.topCallResults, []);
  assert.ok(result.projects.every(p => p.status === 'NOT_CHECKED'));
});

test('raw preview requires explicit administrator and master entitlement, not a forged selection', () => {
  for (const candidate of [undefined, { ...access, role: 'viewer' }, { ...access, tenants: ['mtn'] }, { ...access, clientId: 'mtn' }, { ...access, tenants: ['*'] }]) {
    assert.throws(() => assertWarehouseReadAccess(candidate), (e: any) => e.status === 403);
  }
  assert.equal(assertWarehouseReadAccess(access), 'default_tenant');
});

test('warehouse dates are bounded, strict and explicit UTC; no unordered all-time fallback', () => {
  assert.deepEqual(warehouseWindow(undefined, undefined, new Date('2026-09-29T20:00:00Z')), { startDate: '2026-09-23', endDate: '2026-09-29' });
  for (const [start, end] of [['2026-13-01','2026-13-02'], ['2026-02-30','2026-03-01'], ['2026-08-02','2026-08-01'], ['2024-01-01','2026-09-29'], ['2026-09-01', undefined]]) {
    assert.throws(() => warehouseWindow(start, end), (e: any) => e.status === 400);
  }
  const plan = buildWarehouseReadPlan(options, fields);
  assert.match(plan.query, /ORDER BY _cx_event_at DESC, TO_JSON_STRING/);
  assert.match(plan.query, /TIMESTAMP\(@startDate, 'UTC'\)/);
  assert.match(plan.query, /CAST\(COUNT\(\*\) AS STRING\)/);
  assert.doesNotMatch(plan.query, /SELECT \*/);
  assert.deepEqual(plan.columns.map(c => c.name), ['lead_id', 'consumer_id', 'fetched']);
  assert.ok(plan.redactedFields.includes('standardised_idno'));
});

test('unregistered tables, absent date mappings, repeated dates and legacy writes are rejected', () => {
  assert.throws(() => buildWarehouseReadPlan({ ...options, table: 'injected_table' }, fields), (e: any) => e.status === 403);
  assert.throws(() => buildWarehouseReadPlan({ ...options, syncToCloudSql: true }, fields), (e: any) => e.status === 409);
  assert.throws(() => buildWarehouseReadPlan({ ...options, dateField: 'consumer_id' }, fields), (e: any) => e.status === 422);
  assert.throws(() => buildWarehouseReadPlan(options, fields.filter(f => f.name !== 'fetched')), (e: any) => e.status === 422);
  assert.throws(() => buildWarehouseReadPlan(options, fields.map(f => ({ ...f, mode: 'REPEATED' }))), (e: any) => e.status === 422);
  assert.throws(() => buildWarehouseReadPlan({ ...options, offset: 0.5 }, fields));
});

function mockClient(records: unknown[], total: string, fail?: number) {
  const calls: any[] = [];
  const client: any = {
    dataset: () => ({ table: () => ({ getMetadata: async () => { if (fail) throw { code: fail }; return [{ schema: { fields } }]; } }) }),
    createQueryJob: async (query: any) => { calls.push(query); return [{ id: 'test-query', getQueryResults: async () => [[{ total_rows: total, latest_event_at: records.length ? '2026-07-31T09:00:00Z' : null, records }]], getMetadata: async () => [{ statistics: { query: { totalBytesProcessed: '12' } } }] }]; },
  };
  return { client, calls };
}

test('live reader attempts attached identity access, retains exact strings and exposes a single query snapshot', async () => {
  const { client, calls } = mockClient([{ lead_id: '0003', consumer_id: '9007199254740993', fetched: '2026-07-31' }], '1');
  let attempted = false;
  const result = await pullWarehouseTableData(options, () => { attempted = true; return client; });
  assert.equal(attempted, true); assert.equal(calls.length, 1); assert.equal(calls[0].useQueryCache, false);
  assert.equal(result.rows[0].consumer_id, '9007199254740993');
  assert.equal(result.metadata.sourceIngestedAt, null); assert.equal(result.metadata.freshnessStatus, 'NOT_VERIFIED');
  assert.equal(result.provenance, 'LIVE_BIGQUERY'); assert.equal(result.syncedToCloudSql, false);
  assert.equal(result.totalRows, 1);
});

test('empty live window is measured zero, while query errors and incomplete pages are not fake success', async () => {
  const empty = await pullWarehouseTableData(options, () => mockClient([], '0').client);
  assert.equal(empty.totalRows, 0); assert.equal(empty.metadata.latestEventAtInWindow, null);
  for (const code of [403, 404, 500]) await assert.rejects(pullWarehouseTableData(options, () => mockClient([], '0', code).client), (e: any) => e.status === (code === 500 ? 502 : code));
  await assert.rejects(pullWarehouseTableData(options, () => mockClient([], '1').client), /incomplete page/);
  await assert.rejects(pullWarehouseTableData({ ...options, syncToCloudSql: true }, () => { throw new Error('Must not access storage'); }), /read-only/);
});

test('validation uses 1/2 codes separately from booleans and outcome counters', () => {
  for (const input of [1, '1', true, 'true']) assert.equal(validationValue(input), true);
  for (const input of [2, '2', false, 'false']) assert.equal(validationValue(input), false);
  for (const input of [0, '0', null, undefined, '', 'invalid', 3]) assert.equal(validationValue(input), null);
  const sql = validationSql('valid_idno');
  assert.match(sql, /WHEN '2' THEN FALSE/); assert.doesNotMatch(sql, /WHEN '0'/);
});

test('revenue query resolves exact financial duplicates per transaction and withholds conflicts/missing currency', () => {
  const sql = operationalLeadCtes({ clientId: 'default_tenant', startDate: '2026-07-01', endDate: '2026-07-31' });
  assert.match(sql, /SAFE_CAST\(hlc.revenue_generated AS NUMERIC\)/);
  assert.match(sql, /GROUP BY lead_id, vendor, revenue_vendor, revenue_transaction_id/);
  assert.match(sql, /COUNT\(DISTINCT TO_JSON_STRING\(STRUCT\(revenue AS amount, revenue_currency AS currency\)\)\)/);
  assert.match(sql, /value_variants = 1 AND amount IS NOT NULL AND currency = 'ZAR'/);
  assert.match(sql, /COUNTIF\(eligible IS NOT TRUE\) > 0, NULL, SUM\(amount\)/);
  assert.match(sql, /known_revenue_subtotal/);
  assert.doesNotMatch(sql, /MAX\(revenue\)|COALESCE\(.*revenue.*, 0\)/);
  assert.match(completeRevenueSumSql(), /COUNTIF\(revenue IS NULL\) > 0 THEN NULL/);
  assert.match(operationalLeadSelectSql('current_operational_raw', true, 'USD'), /currency = 'USD'/);
});

test('actual Overview and Contact service queries use the same normalized financial population', async context => {
  const client = getBigQueryClient('dashboards-422710'); const queries: string[] = [];
  context.mock.method(client, 'query', async (request: any) => { queries.push(request.query); return [[{}]] as any; });
  const scope = { clientId: 'default_tenant', startDate: '2026-07-01', endDate: '2026-07-31' };
  await getExecutiveOverview(scope, { includeDiagnostics: false });
  await getContactStrategyAnalytics(scope);
  for (const sql of queries) { assert.match(sql, /financial_keys AS/); assert.match(sql, /COUNTIF\(revenue IS NULL\) > 0 THEN NULL/); assert.doesNotMatch(sql, /max_recorded_revenue/); }
});

test('HTML and malformed POST/GET API responses are explicit deployment errors', async () => {
  await assert.rejects(readAnalyticsResponse(new Response('<html>private server body</html>', { headers: { 'Content-Type': 'text/html' } })), (e: any) => e.code === 'API_INVALID_RESPONSE' && !e.message.includes('private server body'));
  await assert.rejects(readAnalyticsResponse(Response.json({ success: true })), /envelope/);
  assert.equal((await readAnalyticsResponse(Response.json({ success: true, data: 0 }))).data, 0);
  await assert.rejects(readAnalyticsResponse(Response.json({ error: 'Denied' }, { status: 403 })), (e: any) => e.status === 403);
});

test('deployment checker uses JSON fetch rather than browser navigation and never claims warehouse validation', async () => {
  const requests: any[] = [];
  const good = await checkDeployment('https://example.invalid', async (url: URL, init: RequestInit) => { requests.push(init); return url.pathname.endsWith('health') ? Response.json({ status: 'ok', service: 'ConversionX' }) : Response.json({ error: 'Authentication required' }, { status: 401 }); });
  assert.equal(good.passed, true); assert.equal(good.warehouseVerified, false);
  assert.ok(requests.every(r => r.headers.Accept === 'application/json' && r.redirect === 'error'));
  const bad = await checkDeployment('https://example.invalid', async () => new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }));
  assert.equal(bad.passed, false);
  await assert.rejects(checkDeployment('https://user:secret@example.invalid/'));
});

test('Rubix defaults disabled; a key is configuration, not proof of a live service', () => {
  assert.equal(getRubixPowerBiConfig({}).enabled, false);
  const configured = new RubixPowerBiService(getRubixPowerBiConfig({ RUBIX_POWERBI_ENABLED: 'true', RUBIX_POWERBI_RESOURCE_KEY: 'synthetic-test-key' }));
  assert.equal(configured.getStatus().status, 'CONFIGURED_NOT_CHECKED');
});

test('Rubix upstream failure never falls back to business fixtures, even with the legacy option', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'unavailable' }, { status: 503 }));
  const config = { ...getRubixPowerBiConfig({ RUBIX_POWERBI_ENABLED: 'true', RUBIX_POWERBI_RESOURCE_KEY: 'synthetic' }), allowOfflineEvidence: true };
  const service = new RubixPowerBiService(config);
  const report = await service.executeReport('activation_by_team', { startDate: '2026-07-01', endDate: '2026-07-02' }, {}, { clientId: 'blc', isAdmin: false });
  assert.deepEqual(report.rows, []); assert.equal(report.summary.totalCount, null);
  assert.equal(report.metadata.provenance, 'UNAVAILABLE'); assert.equal(report.metadata.queryStatus, 'UPSTREAM_ERROR');
  const recon = await service.getReconciliation({ startDate: '2026-07-01', endDate: '2026-07-02' }, { clientId: 'blc', isAdmin: true });
  assert.equal(recon.reconciliationStatus, 'UNVERIFIED'); assert.equal(recon.variance.deltaCount, null); assert.equal(recon.warehouseActivations.verifiedMandates, null);
});

test('production-facing warehouse and Rubix modules contain no record generators or fixed business totals', () => {
  for (const path of ['server/analytics/warehouse/warehouseAnalytics.ts','server/analytics/warehouse/warehousePull.ts','server/blc/powerbi/service.ts']) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /generateWarehouseTableDataEvidence|generateRubixPowerBiEvidence|OFFLINE_EVIDENCE_REPRESENTATION|14850000|1,851,900|warehouseTotal = 85/);
  }
  assert.match(readFileSync('server/analytics/contact/dispositions.ts','utf8'), /USE_DISPOSITION_FIXTURES === 'true' && process.env.NODE_ENV !== 'production'/);
});


test('process source SQL is not double-quoted and missing validity is not subtracted into invalidity', async context => {
  const client = getBigQueryClient('dashboards-422710'); let sql = '';
  context.mock.method(client, 'query', async (request: any) => { sql = request.query; return [[{ total_leads: 5, valid_id: 1, invalid_id: 2, unknown_id: 2 }]] as any; });
  const result = await getOffershopProcessFlow({ clientId: 'default_tenant', startDate: '2026-07-01', endDate: '2026-07-31' });
  assert.match(sql, /FROM `dashboards-422710.lead_ledger.clustered_lead_ledger` l/);
  assert.doesNotMatch(sql, /FROM ``/);
  assert.match(sql, /COUNT\(DISTINCT l.lead_id\)/);
  assert.equal(result.stages.preparation_validation.observedMetrics.idValidationInvalidCode2, 2);
  assert.equal(result.stages.preparation_validation.observedMetrics.idValidationUnknown, 2);
});

test('live Rubix zero counts remain zero, malformed counts fail, and staff names are masked by role', async context => {
  const provider = (cells: unknown[]) => ({ results: [{ result: { data: { dsr: { DS: [{ IC: true, PH: [{ DM0: [{ S: [{ N: 'team' }, { N: 'agent' }, { N: 'count' }], C: cells }] }] }] } } } }] });
  let value: unknown = 0; let requests = 0;
  context.mock.method(globalThis, 'fetch', async () => { requests++; return Response.json(provider(['QA team', 'Alex Fixture', value])); });
  const service = new RubixPowerBiService(getRubixPowerBiConfig({ RUBIX_POWERBI_ENABLED: 'true', RUBIX_POWERBI_RESOURCE_KEY: 'synthetic' }));
  const dates = { startDate: '2026-07-01', endDate: '2026-07-02' };
  const viewer = await service.executeReport('activation_by_agent_and_team', dates, {}, { clientId: 'blc', isAdmin: false, subject: 'viewer' });
  assert.equal(viewer.summary.totalCount, 0); assert.match(viewer.rows[0].agent || '', /\*\*\*/);
  assert.equal(viewer.metadata.provenance, 'LIVE_POWERBI');
  const admin = await service.executeReport('activation_by_agent_and_team', dates, {}, { clientId: 'blc', isAdmin: true, subject: 'admin' });
  assert.equal(admin.rows[0].agent, 'Alex Fixture'); assert.equal(requests, 2);
  value = 'not a count';
  const invalid = await service.executeReport('activation_by_agent_and_team', dates, {}, { clientId: 'blc', isAdmin: true, subject: 'another-admin' });
  assert.deepEqual(invalid.rows, []); assert.equal(invalid.metadata.queryStatus, 'UPSTREAM_ERROR'); assert.equal(invalid.summary.totalCount, null);
});
