import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(p, 'utf8');

function readAnalytics(): string {
  const facade = read('server/bigquery/offernet_analytics.ts');
  const dir = path.resolve('server/analytics');
  function readAll(d: string): string {
    let out = '';
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const target = path.join(d, ent.name);
      if (ent.isDirectory()) out += '\n' + readAll(target);
      else if (ent.isFile() && ent.name.endsWith('.ts')) out += '\n' + fs.readFileSync(target, 'utf8');
    }
    return out;
  }
  return facade + '\n' + readAll(dir);
}

function readClient(): string {
  const facade = read('src/lib/offernetClient.ts');
  const dir = path.resolve('src/lib/offernet');
  if (!fs.existsSync(dir)) return facade;
  function readAll(d: string): string {
    let out = '';
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const target = path.join(d, ent.name);
      if (ent.isDirectory()) out += '\n' + readAll(target);
      else if (ent.isFile() && ent.name.endsWith('.ts')) out += '\n' + fs.readFileSync(target, 'utf8');
    }
    return out;
  }
  return facade + '\n' + readAll(dir);
}

test('production authentication is fail closed and deployment auth mode is explicit', () => {
  const server = read('server.ts') + read('server/apiApp.ts') + read('server/security.ts');
  assert.ok(server.includes("process.env.NODE_ENV !== 'production' && process.env.CX_ALLOW_DEV_AUTH === 'true'"));
  assert.ok(server.includes(': authenticate();'));
  assert.match(server, /CX_AUTH_MODE/);
  assert.match(server, /env\.NODE_ENV === 'production' \? 'iap' : 'firebase'/);
  assert.match(server, /mode === 'iap'/);
  assert.match(server, /x-goog-iap-jwt-assertion/);
  assert.match(server, /resolveFirebasePrincipal/);
  assert.doesNotMatch(server, /CX_ALLOW_FIREBASE_PREVIEW_AUTH/);
});

test('arbitrary BigQuery browsing is retired', () => {
  const server = read('server.ts') + read('server/apiApp.ts');
  assert.doesNotMatch(server, /app\.get\('\/api\/bq\/(?:projects|datasets|tables|preview|filter-options)'/);
  assert.match(server, /app\.use\('\/api\/bq'[\s\S]*?410/);
});

test('operational analytics are never globally stamped VERIFIED', () => {
  const server = read('server.ts') + read('server/apiApp.ts');
  assert.doesNotMatch(server, /X-Analytics-Status['"],\s*['"]VERIFIED/);
  assert.match(server, /X-Analytics-Status['"],\s*['"]UNVERIFIED/);
});

test('known manufactured analytics are absent', () => {
  const analytics = readAnalytics();
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
  assert.ok(
    pkg.scripts.start === 'node server.ts' || pkg.scripts.start === 'node dist/server/server.mjs',
    `expected start script to target server.ts or dist bundle, got: ${pkg.scripts.start}`
  );
  assert.equal(fs.existsSync('server.js'), false);
});


test('root-cause analysis is metric allow-listed and requires matched dates', () => {
  const analytics = readAnalytics();
  assert.match(analytics, /allowedMetrics = new Set\(\['fetchedLeads', 'deliveryRate', 'dialRate', 'contactRate', 'leadToSaleRate', 'activationRate'\]\)/);
  assert.match(analytics, /Root-cause analysis requires an explicit startDate and endDate/);
  assert.match(analytics, /Unsupported root-cause metric/);
});

test('record drill-down remains admin-only and drill populations are allow-listed', () => {
  const api = read('server/api.ts');
  const analytics = readAnalytics();
  assert.match(api, /analyticsRouter\.get\('\/offernet\/raw-leads', requireAdmin/);
  assert.match(analytics, /Unsupported drill-down population/);
  for (const drill of ['awaiting-first-dial', 'missing-disposition', 'unactivated-sales', 'sla-breach', 'backlog-age', 'funnel-loss', 'funnel-stage', 'lead-age', 'high-attempt-no-rpc', 'one-call-only']) {
    assert.ok(analytics.includes(`case '${drill}':`) || analytics.includes(`'${drill}':`), `missing shared drill allow-list entry: ${drill}`);
  }
});

test('root-cause dimensions are reduced to exclusive lead-level segments', () => {
  const analytics = readAnalytics();
  assert.match(analytics, /lead_level AS/);
  assert.match(analytics, /'vendor' AS dimension/);
  assert.match(analytics, /'source'/);
  assert.match(analytics, /'grade'/);
  assert.match(analytics, /'leadAge'/);
  assert.match(analytics, /contributions within each exclusive dimension reconcile/);
});


test('marketing spend never falls back to budget', () => {
  const config = read('server/bigquery/config.ts');
  const analytics = readAnalytics();
  assert.match(config, /approvedSpendFields/);
  assert.match(config, /approvedBudgetFields/);
  assert.match(analytics, /latest_budget/);
  assert.match(analytics, /Budget remains a separate planning value/);
  assert.doesNotMatch(analytics, /SUM\(budget\)\s+AS\s+(?:recorded_spend|spend|total_spend)/i);
});

test('observed media efficiency is derived only when an approved spend field and valid grain exist', () => {
  const analytics = readAnalytics();
  assert.match(analytics, /const hasSpend = Boolean\(resolved\.spendColumn && grainStatus === 'VALID'\)/);
  assert.match(analytics, /const measuredSpend = hasSpend && totals\.spend !== null/);
  assert.match(analytics, /cpc: measuredSpend && totals\.clicks > 0/);
  assert.match(analytics, /cpm: measuredSpend && totals\.impressions > 0/);
  assert.match(analytics, /cpl: measuredSpend && totals\.leads > 0/);
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
  const analytics = readAnalytics();
  assert.match(analytics, /Marketing API-table mapping is unresolved for this tenant/);
  assert.match(analytics, /marketingTenantFilter\(contract\)/);
  assert.doesNotMatch(analytics, /clientConfig\.id !== 'default_tenant'\)[\s\S]{0,300}Tenant-to-marketing-client mappings are not yet approved/);
});

test('spend grain is validated before incurred spend is returned', () => {
  const analytics = readAnalytics();
  assert.match(analytics, /duplicate_grain_rows/);
  assert.match(analytics, /grainStatus === 'VALID'/);
  assert.match(analytics, /Spend is withheld because the API table violates the configured spend grain/);
});

test('marketing attribution is explicit and fail closed', () => {
  const analytics = readAnalytics();
  assert.match(analytics, /contract\.attribution\.status !== 'ACTIVE'/);
  assert.match(analytics, /Attribution requires an approved observed spend field/);
  assert.match(analytics, /OBSERVED_UNRECONCILED/);
});

test('marketing discovery remains admin-only', () => {
  const api = read('server/api.ts');
  assert.match(api, /analyticsRouter\.get\('\/offernet\/marketing-discovery', requireAdmin/);
});


test('OfferNet operating controls remain lead-level and descriptive', () => {
  const analytics = readAnalytics();
  assert.match(analytics, /export async function getOperatingControlsAnalytics/);
  assert.match(analytics, /lead_level AS/);
  assert.match(analytics, /CASE WHEN SAFE_CAST\(hlc\.total_calls AS INT64\) >= 0 THEN SAFE_CAST\(hlc\.total_calls AS INT64\) END AS total_calls/);
  assert.match(analytics, /MAX\(total_calls\) AS recorded_call_count/);
  assert.match(analytics, /first recorded delivered vendor per lead/);
  assert.match(analytics, /descriptive and are not event-level attempt attribution/);
});

test('contact-strategy call-count buckets are exclusive per lead', () => {
  const strategy = read('server/analytics/contact/strategy.ts');
  const leadMetrics = read('server/analytics/common/leadMetrics.ts');
  assert.match(strategy, /export async function getContactStrategyAnalytics/);
  assert.match(strategy, /lead_level AS/);
  assert.match(strategy, /operationalLeadCtes\(params\)/);
  assert.match(leadMetrics, /GROUP BY lead_id/);
  assert.match(leadMetrics, /MAX\(total_calls\) AS recorded_call_count/);
  assert.match(strategy, /recorded_call_count AS call_count/);
  assert.match(strategy, /do not identify which specific attempt produced the outcome/);
});

test('time-of-day and after-hours analytics use the tenant timezone and configured window', () => {
  const speed = read('server/analytics/contact/speedToLead.ts');
  const temporal = read('server/analytics/temporal/service.ts');
  for (const block of [speed, temporal]) {
    assert.match(block, /@tenantTimezone/);
    assert.match(block, /@operatingStart/);
    assert.match(block, /@operatingEnd/);
    assert.match(block, /@operatingWorkdays/);
  }
  assert.doesNotMatch(speed, /EXTRACT\(HOUR FROM SAFE_CAST\(l\.fetched AS TIMESTAMP\)\) < 8/);
  assert.doesNotMatch(temporal, /EXTRACT\(HOUR FROM SAFE_CAST\(l\.fetched AS TIMESTAMP\)\)/);
});

test('source and grade funnel analytics include delivery and dial coverage from one scoped lead aggregate', async context => {
  const { getFunnelIntelligence } = await import('../server/analytics/funnel/service');
  const { getBigQueryClient } = await import('../server/bigquery/client');
  const { getClientConfig } = await import('../server/bigquery/config');
  const client = getBigQueryClient(getClientConfig('default_tenant').bigQueryProject);
  let query = '';
  context.mock.method(client, 'query', async (request: any) => {
    query = request.query;
    assert.equal(request.params.vendor, 'V1');
    return [[
      { period:'current', dimension:'all', fetched:10, delivered:8, dialled:4, rpc:2, sales:1, activations:0 },
      { period:'current', dimension:'source', segment:'Source A', fetched:10, delivered:8, dialled:4, rpc:2, sales:1, activations:0 },
      { period:'current', dimension:'grade', segment:'Grade A', fetched:10, delivered:8, dialled:4, rpc:2, sales:1, activations:0 },
    ]] as any;
  });
  const result = await getFunnelIntelligence({clientId:'default_tenant',vendor:'V1'});
  assert.deepEqual(result.bySource, [{source:'Source A',leads:10,delivered:8,dialled:4,contacted:2,sales:1,activations:0}]);
  assert.deepEqual(result.byGrade, [{grade:'Grade A',leads:10,delivered:8,dialled:4,contacted:2,sales:1,activations:0}]);
  assert.match(query, /COUNTIF\(is_delivered\) AS delivered/);
  assert.match(query, /COUNTIF\(is_dialled\) AS dialled/);
  assert.match(query, /FROM operational_leads/);
  assert.match(query, /GROUP BY period, dimension, segment/);
  assert.match(query, /LOWER\(hlc.vendor\) = LOWER\(@vendor\)/);
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
  assert.match(cli, /matchedPeriodWindow\(scope.startDate, scope.endDate\)/);
  assert.match(cli, /dailyRows.length <= rowLimit && comparisonWindow/);
  assert.match(cli, /records.some\(record => !record.reportDate\)/);
});

test('CLI imported reports require observed RPC and sale counts and preserve tenant scope', () => {
  const cli = read('server/bigquery/cli_analytics.ts');
  const api = read('server/api.ts');
  const client = readClient();
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
  const analytics = readAnalytics();
  assert.match(analytics, /do not have an approved equivalent marketing-side mapping/);
  assert.match(analytics, /@attributionSource/);
  assert.match(analytics, /source: undefined/);
  assert.match(analytics, /INVALID_GRAIN/);
  assert.match(analytics, /configuredSourceTable\(params\.clientId, 'leads'\)/);
  assert.doesNotMatch(analytics, /incompatibleScope = \['vendor', 'source'/);
});

test('marketing contract exposes reach and outbound-click source fields', () => {
  const config = read('server/bigquery/config.ts');
  const physical = read('contracts/physicalSources.ts');
  const analytics = readAnalytics();
  assert.match(config, /reachField: MARKETING_SOURCE_FIELDS\.reach/);
  assert.match(config, /outboundClicksField: MARKETING_SOURCE_FIELDS\.outboundClicks/);
  assert.match(physical, /reach: 'reach'/);
  assert.match(physical, /outboundClicks: 'outbound_clicks'/);
  assert.match(analytics, /outboundCtr/);
  assert.match(analytics, /clickToLeadRate/);
  assert.match(analytics, /frequency:/);
});

test('BLC register diagnostics use the contracted date_created timestamp and sentinel guards', async () => {
  const { buildBlcLifecycleQuery } = await import('../server/blc/lifecycleDiagnostics');
  const { BLC_SOURCES } = await import('../contracts/blcReporting');
  const { getClientConfig } = await import('../server/bigquery/config');
  const { validTimestampSql } = await import('../server/bigquery/integrity');
  const source = BLC_SOURCES.activationRegister;
  assert.equal(getClientConfig('blc').semanticMappings.tables.activations, source.table);
  const query = buildBlcLifecycleQuery({ type: 'TABLE', schema: {
    fields: Object.entries(source.fields).map(([name, type]) => ({ name, type })),
  } });
  assert.ok(query.includes(validTimestampSql('s.`date_created`')));
  assert.ok(query.includes(`FROM \`${source.table}\` s`));
  assert.match(query, /AS latest_register_at/);
  assert.match(query, /AS missing_timestamp_rows/);
  assert.doesNotMatch(query, /\b(?:JOIN|WHERE|LIMIT)\b/i);
  // Missing schema fields must remain unavailable, not become an inferred date.
  const unavailable = buildBlcLifecycleQuery({ type: 'TABLE', schema: { fields: [] } });
  assert.match(unavailable, /CAST\(NULL AS STRING\) AS latest_register_at/);
  assert.match(unavailable, /CAST\(COUNT\(\*\) AS STRING\) AS source_rows/);
  assert.doesNotMatch(unavailable, /MAX\(/);
});


test('dedicated tenant lead views are not re-filtered by partner keys', () => {
  const analytics = readAnalytics();
  const config = read('server/bigquery/config.ts');
  assert.match(config, /export function tenantVendorScopeValues/);
  assert.match(analytics, /clientConfig\.dataSourceMode === 'shared'/);
  assert.match(analytics, /tenantVendorScopeValues\(clientConfig\)/);
  assert.doesNotMatch(analytics, /const tenantVendors = clientConfig\.semanticMappings\.partners \|\| \[\]/);
});

test('shared call analytics use canonical tenant vendor aliases', () => {
  const cli = read('server/bigquery/cli_analytics.ts');
  const analytics = readAnalytics();
  const config = read('server/bigquery/config.ts');
  assert.match(config, /ROR_PARTNER_TO_VENDOR_MAP/);
  assert.match(config, /values\.add\(mapped\.toLowerCase\(\)\)/);
  assert.match(cli, /tenantVendorScopeValues\(clientConfig\)/);
  assert.match(analytics, /callParams\.tenantVendors = tenantVendors/);
  assert.match(analytics, /queryParams\.tenantVendors = tenantVendors/);
});

test('server/api.ts routes through server/analytics domain services', () => {
  const api = read('server/api.ts');
  assert.match(api, /import \* as offernetAnalytics from '\.\/analytics';/);
  assert.doesNotMatch(api, /from '\.\/bigquery\/offernet_analytics';/);
});