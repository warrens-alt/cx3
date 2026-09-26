import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('production authentication is fail closed and local bypass is explicit', () => {
  const server = read('server.ts');
  assert.ok(server.includes("process.env.NODE_ENV !== 'production' && process.env.CX_ALLOW_DEV_AUTH === 'true'"));
  assert.ok(server.includes(': authenticate();'));
});

test('arbitrary BigQuery browsing is retired', () => {
  const server = read('server.ts');
  assert.doesNotMatch(server, /app\.get\('\/api\/bq\/(?:projects|datasets|tables|preview|filter-options)'/);
  assert.match(server, /app\.use\('\/api\/bq'[\s\S]*?410/);
});

test('operational analytics are never globally stamped VERIFIED', () => {
  const server = read('server.ts');
  assert.doesNotMatch(server, /X-Analytics-Status['"],\s*['"]VERIFIED/);
  assert.match(server, /X-Analytics-Status['"],\s*['"]UNVERIFIED/);
});

test('known manufactured analytics are absent', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.doesNotMatch(analytics, /overallHealthScore:\s*94\.6/);
  assert.doesNotMatch(analytics, /SUM\(budget\)\s+AS\s+total_spend/i);
  assert.doesNotMatch(analytics, /const unitLeadCost\s*=\s*45/);
  assert.doesNotMatch(analytics, /carrier spam reputation risk by 34/i);
  assert.doesNotMatch(analytics, /Business hours contact rate:\s*31\.4/i);
});

test('new Firebase profiles cannot self-activate', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /data\.status == 'pending'/);
  assert.doesNotMatch(rules, /data\.status in \['pending', 'active'\]/);
});

test('production start executes only the generated dist bundle', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.start, 'node dist/server/server.mjs');
  assert.equal(fs.existsSync('server.js'), false);
});


test('root-cause analysis is metric allow-listed and requires matched dates', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(analytics, /allowedMetrics = new Set\(\['fetchedLeads', 'deliveryRate', 'dialRate', 'contactRate', 'leadToSaleRate', 'activationRate'\]\)/);
  assert.match(analytics, /Root-cause analysis requires an explicit startDate and endDate/);
  assert.match(analytics, /Unsupported root-cause metric/);
});

test('record drill-down remains admin-only and drill populations are allow-listed', () => {
  const api = read('server/api.ts');
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(api, /analyticsRouter\.get\('\/offernet\/raw-leads', requireAdmin/);
  assert.match(analytics, /Unsupported drill-down population/);
  for (const drill of ['awaiting-first-dial', 'missing-disposition', 'unactivated-sales', 'sla-breach', 'backlog-age', 'funnel-loss', 'funnel-stage', 'lead-age', 'high-attempt-no-rpc', 'one-call-only']) {
    assert.ok(analytics.includes(`drill === '${drill}'`), `missing drill allow-list entry: ${drill}`);
  }
});

test('root-cause dimensions are reduced to exclusive lead-level segments', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(analytics, /lead_level AS/);
  assert.match(analytics, /'vendor' AS dimension/);
  assert.match(analytics, /'source'/);
  assert.match(analytics, /'grade'/);
  assert.match(analytics, /'leadAge'/);
  assert.match(analytics, /contributions within each exclusive dimension reconcile/);
});


test('marketing spend never falls back to budget', () => {
  const config = read('server/bigquery/config.ts');
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(config, /approvedSpendFields/);
  assert.match(config, /approvedBudgetFields/);
  assert.match(analytics, /latest_budget/);
  assert.match(analytics, /Budget remains a separate planning value/);
  assert.doesNotMatch(analytics, /SUM\(budget\)\s+AS\s+(?:recorded_spend|spend|total_spend)/i);
});

test('observed media efficiency is derived only when an approved spend field and valid grain exist', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(analytics, /const hasSpend = Boolean\(resolved\.spendColumn && grainStatus === 'VALID'\)/);
  assert.match(analytics, /cpc: hasSpend && totals\.clicks > 0/);
  assert.match(analytics, /cpm: hasSpend && totals\.impressions > 0/);
  assert.match(analytics, /cpl: hasSpend && totals\.leads > 0/);
  assert.match(analytics, /cross-source ratios and are not attribution or full profitability/);
});


test('tenant marketing contracts replace dormant hard-coded cost assumptions', () => {
  const config = read('server/bigquery/config.ts');
  assert.match(config, /interface MarketingSourceContract/);
  assert.match(config, /spendGrainFields/);
  assert.match(config, /CX_MARKETING_CLIENT_MAP_JSON/);
  assert.match(config, /CX_MARKETING_ATTRIBUTION_JSON/);
  assert.doesNotMatch(config, /leadCost\s*:/);
  assert.doesNotMatch(config, /callMinuteCost\s*:/);
  assert.doesNotMatch(config, /baseCommissionPerSale\s*:/);
  assert.doesNotMatch(config, /fixedOverhead\s*:/);
});

test('tenant campaign reporting fails closed until explicit client_name mapping exists', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(analytics, /Marketing API-table mapping is unresolved for this tenant/);
  assert.match(analytics, /marketingTenantFilter\(contract\)/);
  assert.doesNotMatch(analytics, /clientConfig\.id !== 'default_tenant'\)[\s\S]{0,300}Tenant-to-marketing-client mappings are not yet approved/);
});

test('spend grain is validated before incurred spend is returned', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(analytics, /duplicate_grain_rows/);
  assert.match(analytics, /grainStatus === 'VALID'/);
  assert.match(analytics, /Spend is withheld because the API table violates the configured spend grain/);
});

test('marketing attribution is explicit and fail closed', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(analytics, /contract\.attribution\.status !== 'ACTIVE'/);
  assert.match(analytics, /Attribution requires an approved observed spend field/);
  assert.match(analytics, /OBSERVED_UNRECONCILED/);
});

test('marketing discovery remains admin-only', () => {
  const api = read('server/api.ts');
  assert.match(api, /analyticsRouter\.get\('\/offernet\/marketing-discovery', requireAdmin/);
});


test('OfferNet operating controls remain lead-level and descriptive', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(analytics, /export async function getOperatingControlsAnalytics/);
  assert.match(analytics, /lead_level AS/);
  assert.match(analytics, /MAX\(GREATEST\(total_calls, 0\)\) AS recorded_call_count/);
  assert.match(analytics, /first recorded delivered vendor per lead/);
  assert.match(analytics, /descriptive and are not event-level attempt attribution/);
});

test('contact-strategy call-count buckets are exclusive per lead', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  const start = analytics.indexOf('export async function getContactStrategyAnalytics');
  const end = analytics.indexOf('// 5. VENDOR & LEAD QUALITY', start);
  const block = analytics.slice(start, end);
  assert.match(block, /lead_level AS/);
  assert.match(block, /GROUP BY lead_id/);
  assert.match(block, /MAX\(GREATEST\(total_calls, 0\)\) AS call_count/);
  assert.match(block, /do not identify which specific attempt produced the outcome/);
});

test('time-of-day and after-hours analytics use the tenant timezone and configured window', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  const speedStart = analytics.indexOf('export async function getSpeedToLeadAnalytics');
  const speedEnd = analytics.indexOf('// 4. CONTACT STRATEGY', speedStart);
  const temporalStart = analytics.indexOf('export async function getTemporalAnalytics');
  const temporalEnd = analytics.indexOf('// 7. SALES & ACTIVATION INTELLIGENCE', temporalStart);
  const speed = analytics.slice(speedStart, speedEnd);
  const temporal = analytics.slice(temporalStart, temporalEnd);
  for (const block of [speed, temporal]) {
    assert.match(block, /@tenantTimezone/);
    assert.match(block, /@operatingStart/);
    assert.match(block, /@operatingEnd/);
    assert.match(block, /@operatingWorkdays/);
  }
  assert.doesNotMatch(speed, /EXTRACT\(HOUR FROM SAFE_CAST\(l\.fetched AS TIMESTAMP\)\) < 8/);
  assert.doesNotMatch(temporal, /EXTRACT\(HOUR FROM SAFE_CAST\(l\.fetched AS TIMESTAMP\)\)/);
});

test('source and grade funnel analytics include delivery and dial coverage', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  const client = read('src/lib/offernetClient.ts');
  const start = analytics.indexOf('export async function getFunnelIntelligence');
  const end = analytics.indexOf('export async function getRootCauseAnalysis', start);
  const block = analytics.slice(start, end);
  assert.match(block, /by_source AS[\s\S]*delivered_ts IS NOT NULL[\s\S]*first_dial_ts IS NOT NULL/);
  assert.match(block, /by_grade AS[\s\S]*delivered_ts IS NOT NULL[\s\S]*first_dial_ts IS NOT NULL/);
  assert.match(client, /source: string;[\s\S]*delivered: number;[\s\S]*dialled: number;/);
  assert.match(client, /grade: string;[\s\S]*delivered: number;[\s\S]*dialled: number;/);
});


test('record exports and CLI mutations respect admin-only governance', () => {
  const api = read('server/api.ts');
  assert.match(api, /function requireAdminForRecordExport/);
  assert.match(api, /analyticsRouter\.get\('\/export', requireAdminForRecordExport/);
  assert.match(api, /analyticsRouter\.post\('\/cli-performance\/import', requireAdmin/);
  assert.match(api, /analyticsRouter\.post\('\/cli-performance\/load-sample', requireAdmin/);
  assert.match(api, /analyticsRouter\.delete\('\/cli-performance\/import', requireAdmin/);
  assert.match(api, /ENABLE_CLI_SAMPLE_DATA/);
});

test('CLI analytics never synthesize missing production metrics', () => {
  const cli = read('server/bigquery/cli_analytics.ts');
  assert.doesNotMatch(cli, /contactCountNum \* 0\.9/);
  assert.doesNotMatch(cli, /saleCountNum \* 1\.5/);
  assert.doesNotMatch(cli, /saleCountNum \* 0\.4/);
  assert.doesNotMatch(cli, /'142\.5'/);
  assert.doesNotMatch(cli, /'45\.0'/);
  assert.doesNotMatch(cli, /medianLeadAgeDays:\s*'0\.85'/);
  assert.doesNotMatch(cli, /avgLeadAgeDays[^\n]*'1\.18'/);
  assert.doesNotMatch(cli, /currentCalls \* 0\.94/);
  assert.match(cli, /return null;\n}\n\n\/\*\* Generate realistic Benchmark/);
});

test('CLI imported reports require observed RPC and sale counts and preserve tenant scope', () => {
  const cli = read('server/bigquery/cli_analytics.ts');
  const api = read('server/api.ts');
  const client = read('src/lib/offernetClient.ts');
  assert.match(cli, /Missing required RPC\/contact count column/);
  assert.match(cli, /Missing required sale count column/);
  assert.match(cli, /selected date scope cannot be applied safely/);
  assert.match(cli, /tenantVendors/);
  assert.match(api, /req\.method === 'GET' \|\| req\.method === 'DELETE'/);
  assert.match(client, /JSON\.stringify\(\{ clientId, csvText, filename \}\)/);
  assert.match(client, /load-sample'[\s\S]*JSON\.stringify\(\{ clientId \}\)/);
  assert.match(client, /cli-performance\/import\?clientId=/);
});

test('approved tenant data contract is encoded in application configuration', () => {
  const config = read('server/bigquery/config.ts');
  assert.match(config, /view_lead_ledger_mtn_lead_submit_open/);
  assert.match(config, /view_lead_ledger_mondo_lead_submit_open/);
  assert.match(config, /view_lead_ledger_blc_lead_submit_open/);
  assert.match(config, /view_lead_ledger_bizvoip_lead_submit_open/);
  assert.match(config, /view_lead_ledger_rewardsco_lead_submit_open/);
  assert.match(config, /view_lead_ledger_real_promotions_lead_submit_open/);
  assert.match(config, /view_lead_leadger_oneplan_lead_submit_open/);
  assert.match(config, /view_lead_ledger_affiliate_lead_submit_open/);
  assert.match(config, /marketingContract\('MAPPED', \['MTN', 'MTN SA'\]\)/);
  assert.match(config, /marketingContract\('MAPPED', \['BLC', 'BLC 1Life'\]\)/);
  assert.match(config, /start: '08:30', end: '17:00'/);
  assert.match(config, /start: '08:00', end: '18:00', workdays: \[1, 2, 3, 4, 5, 6\]/);
  assert.match(config, /blc: 'ontact_blc'/);
  assert.match(config, /bizvoip: 'vodacom_bizvoip'/);
});

test('marketing attribution supports reconciled source scope and fails closed on unsupported dimensions or invalid spend grain', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(analytics, /do not have an approved equivalent marketing-side mapping/);
  assert.match(analytics, /@attributionSource/);
  assert.match(analytics, /source: undefined/);
  assert.match(analytics, /INVALID_GRAIN/);
  assert.match(analytics, /configuredSourceTable\(params\.clientId, 'leads'\)/);
  assert.doesNotMatch(analytics, /incompatibleScope = \['vendor', 'source'/);
});

test('marketing contract exposes reach and outbound-click source fields', () => {
  const config = read('server/bigquery/config.ts');
  const analytics = read('server/bigquery/offernet_analytics.ts');
  assert.match(config, /reachField: 'reach'/);
  assert.match(config, /outboundClicksField: 'outbound_clicks'/);
  assert.match(analytics, /outboundCtr/);
  assert.match(analytics, /clickToLeadRate/);
  assert.match(analytics, /frequency:/);
});

test('BLC activation source freshness uses the contracted date_created timestamp', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  const config = read('server/bigquery/config.ts');
  assert.match(config, /tenantTables\(CONTRACT_LEAD_VIEWS\.ontact_blc, true\)/);
  assert.match(analytics, /SAFE_CAST\(date_created AS TIMESTAMP\)/);
});


test('dedicated tenant lead views are not re-filtered by partner keys', () => {
  const analytics = read('server/bigquery/offernet_analytics.ts');
  const config = read('server/bigquery/config.ts');
  assert.match(config, /export function tenantVendorScopeValues/);
  assert.match(analytics, /clientConfig\.dataSourceMode === 'shared'/);
  assert.match(analytics, /tenantVendorScopeValues\(clientConfig\)/);
  assert.doesNotMatch(analytics, /const tenantVendors = clientConfig\.semanticMappings\.partners \|\| \[\]/);
});

test('shared call analytics use canonical tenant vendor aliases', () => {
  const cli = read('server/bigquery/cli_analytics.ts');
  const analytics = read('server/bigquery/offernet_analytics.ts');
  const config = read('server/bigquery/config.ts');
  assert.match(config, /ROR_PARTNER_TO_VENDOR_MAP/);
  assert.match(config, /values\.add\(mapped\.toLowerCase\(\)\)/);
  assert.match(cli, /tenantVendorScopeValues\(clientConfig\)/);
  assert.match(analytics, /callParams\.tenantVendors = tenantVendors/);
  assert.match(analytics, /queryParams\.tenantVendors = tenantVendors/);
});
