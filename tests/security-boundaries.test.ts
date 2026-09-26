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
  for (const drill of ['awaiting-first-dial', 'missing-disposition', 'unactivated-sales', 'sla-breach', 'backlog-age', 'funnel-loss', 'funnel-stage', 'lead-age']) {
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
