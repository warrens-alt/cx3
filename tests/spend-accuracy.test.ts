import { getMarketingRootCauseAnalysis } from '../server/analytics/investigation/marketingRootCause';
import { getMarketingSourceDiscovery } from '../server/analytics/commercial/discovery';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { commercialRatio, reconcileSpend } from '../contracts/commercial';
import { getClientCampaignAnalytics } from '../server/analytics/campaigns/performance';
import { getMarketingAttributionAnalytics } from '../server/analytics/commercial/attribution';
import { getCommercialAnalytics } from '../server/analytics/commercial/spend';
import { marketingContractCache, marketingSpendExpression, marketingTenantFilter, resolveMarketingContract } from '../server/analytics/common/marketing';
import { getClientConfig } from '../server/bigquery/config';
import { getBigQueryClient } from '../server/bigquery/client';

type Media = { date: string; client: string; channel: string; campaign: string; adset: string; spend: number | null; impressions: number | null; clicks: number | null; leads: number | null };
const mediaRow = (date: string, adset: string, spend: number | null, campaign = 'Campaign A'): Media => ({ date, client: 'MTN', channel: 'Social', campaign, adset, spend, impressions: 1000, clicks: 10, leads: 5 });
const acceptance = [mediaRow('2026-09-01', 'Adset 1', 100), mediaRow('2026-09-01', 'Adset 2', 200), mediaRow('2026-09-02', 'Adset 1', 150)];
const scope = { clientId: 'mtn' };
const grainKey = (row: Media) => JSON.stringify([row.date, row.client, row.channel, row.campaign, row.adset]);
const groupKey = (row: Media) => JSON.stringify([row.client, row.channel, row.campaign, row.adset]);

/** Independent fixture oracle for mocked warehouse rows; SQL structure is asserted separately. These are not live warehouse tests. */
function fixture(context: TestContext, media: Media[], options: { columns?: string[]; attributionRows?: any[] | ((selected: Media[]) => any[]); overrideSummary?: Record<string, unknown>; rootCauseRows?: any[] } = {}) {
  const contract = getClientConfig(scope.clientId).marketing!;
  marketingContractCache.clear(); context.after(() => marketingContractCache.clear());
  const columns = options.columns || [contract.clientNameField, contract.dateField, contract.channelField, contract.campaignField, contract.adsetField, contract.impressionsField, contract.clicksField, contract.leadsField, 'spend', 'budget'];
  const requests: Array<{ query: string; params: any }> = [];
  context.mock.method(getBigQueryClient(getClientConfig(scope.clientId).bigQueryProject), 'query', async (request: any) => {
    requests.push(request);
    if (request.query.includes('INFORMATION_SCHEMA.COLUMNS')) return [columns.map(column_name => ({ column_name }))] as any;
    const p = request.params || {};
    const selected = media.filter(row => (!p.marketingClientNames || p.marketingClientNames.includes(row.client.toLowerCase()))
      && (!p.startDate || row.date >= p.startDate) && (!p.endDate || row.date <= p.endDate)
      && (!p.previousStartDate || row.date >= p.previousStartDate) && (!p.previousEndDate || row.date <= p.previousEndDate)
      && (!p.campaign || row.campaign.toLowerCase() === p.campaign.toLowerCase())
      && (!p.attributionSource || row.campaign.toLowerCase() === p.attributionSource.toLowerCase())
      && (!p.channel || row.channel.toLowerCase() === p.channel.toLowerCase()) && (!p.adset || row.adset.toLowerCase() === p.adset.toLowerCase()));
    const sum = (field: 'spend' | 'impressions' | 'clicks' | 'leads') => selected.reduce((total, row) => total + (row[field] ?? 0), 0);
    const spend = selected.some(row => row.spend !== null) ? sum('spend') : null;
    const grain = { row_count: selected.length, distinct_grain_count: new Set(selected.map(grainKey)).size,
      duplicate_grain_rows: selected.length - new Set(selected.map(grainKey)).size,
      missing_grain_rows: selected.filter(row => !row.adset || !row.client || !row.channel || !row.campaign || !row.date).length, missing_spend_rows: selected.filter(row => row.spend === null).length,
      raw_observed_spend: spend, recorded_spend: spend, campaign_aggregation_spend: spend,
      campaign_group_count: new Set(selected.map(groupKey)).size,
      impressions: selected.some(row => row.impressions !== null) ? sum('impressions') : null, clicks: selected.some(row => row.clicks !== null) ? sum('clicks') : null, recorded_leads: selected.some(row => row.leads !== null) ? sum('leads') : null,
      missing_impressions_rows: selected.filter(row => row.impressions === null).length, missing_clicks_rows: selected.filter(row => row.clicks === null).length, missing_recorded_leads_rows: selected.filter(row => row.leads === null).length, ...options.overrideSummary };
    const groups = new Map<string, any>();
    for (const row of selected) {
      const key = groupKey(row), group = groups.get(key) || { client_name: row.client, channel: row.channel, campaign_name: row.campaign, adset_name: row.adset, recorded_spend: 0, impressions: 0, clicks: 0, recorded_leads: 0, latest_budget: 999999 };
      group.recorded_spend += row.spend ?? 0; group.impressions += row.impressions ?? 0; group.clicks += row.clicks ?? 0; group.recorded_leads += row.leads ?? 0;
      for (const [input, output] of [['impressions', 'impressions'], ['clicks', 'clicks'], ['leads', 'recorded_leads']] as const) group[`missing_${output}_rows`] = (group[`missing_${output}_rows`] || 0) + (row[input] === null ? 1 : 0);
      groups.set(key, group);
    }
    if (request.query.includes('AS campaign_group_count') || (request.query.includes('AS raw_observed_spend') && !request.query.includes('AS detail_rows'))) return [[{ ...grain, ...(request.query.includes('AS campaign_details') ? { campaign_details: [...groups.values()].slice(0, 250) } : {}) }]] as any;
    if (request.query.includes('FROM dimensional JOIN snapshot_guard')) return [options.rootCauseRows || []] as any;
    if (request.query.includes('AS detail_rows')) {
      const detail = typeof options.attributionRows === 'function' ? options.attributionRows(selected) : options.attributionRows || [];
      const matching = detail.filter(row => row.has_marketing && row.has_operations);
      return [[{
        total_spend: detail.reduce((a, row) => a + (row.spend || 0), 0), matched_spend: matching.reduce((a, row) => a + row.spend, 0),
        unmatched_marketing_spend: detail.filter(row => row.has_marketing && !row.has_operations).reduce((a, row) => a + row.spend, 0),
        matched_keys: matching.length, marketing_only_keys: detail.filter(row => row.has_marketing && !row.has_operations).length,
        operations_only_keys: detail.filter(row => !row.has_marketing && row.has_operations).length, total_keys: detail.length, ambiguous_leads: 0, marketing_grain: grain, campaign_aggregation_spend: spend,
        ...Object.fromEntries(['fetched', 'delivered', 'dialled', 'rpc', 'sales', 'activations', 'recorded_revenue'].map(field => [`matched_${field}`, matching.reduce((a, row) => a + (row[field] || 0), 0)])),
        detail_rows: detail.slice(0, 250), ...options.overrideSummary,
      }]] as any;
    }
    if (request.query.includes('AS fetched_leads')) return [[{ fetched_leads: 3, delivered_leads: 3, dialled_leads: 2, contacted_leads: 2, sale_leads: 1, activated_leads: 1, total_revenue: 300 }]] as any;
    if (request.query.includes('GROUP BY 1, 2, 3, 4')) {
      const groups = new Map<string, any>();
      for (const row of selected) {
        const key = groupKey(row), group = groups.get(key) || { client_name: row.client, channel: row.channel, campaign_name: row.campaign, adset_name: row.adset, recorded_spend: 0, impressions: 0, clicks: 0, recorded_leads: 0, latest_budget: 999999 };
        group.recorded_spend += row.spend ?? 0; group.impressions += row.impressions ?? 0; group.clicks += row.clicks ?? 0; group.recorded_leads += row.leads ?? 0;
      for (const [input, output] of [['impressions', 'impressions'], ['clicks', 'clicks'], ['leads', 'recorded_leads']] as const) group[`missing_${output}_rows`] = (group[`missing_${output}_rows`] || 0) + (row[input] === null ? 1 : 0);
      groups.set(key, group);
      }
      return [[...groups.values()].slice(0, 250)] as any;
    }
    return [[grain]] as any;
  });
  return { contract, requests };
}
function enableAttribution(context: TestContext) {
  const previous = process.env.CX_MARKETING_ATTRIBUTION_JSON;
  process.env.CX_MARKETING_ATTRIBUTION_JSON = JSON.stringify({ mtn: { marketingSourceField: 'Channel_Campaign_Name', leadSourceField: 'offershop_source' } });
  context.after(() => { if (previous === undefined) delete process.env.CX_MARKETING_ATTRIBUTION_JSON; else process.env.CX_MARKETING_ATTRIBUTION_JSON = previous; });
}
const joined = (key: string, spend: number | null, fetched: number, extras = {}) => ({ join_key: key, spend, fetched, has_marketing: spend !== null, has_operations: fetched > 0, platform_leads: spend === null ? null : 5, delivered: fetched, dialled: fetched, rpc: fetched, sales: 1, activations: 1, recorded_revenue: 300, ...extras });

test('mandatory R450 fixture reconciles raw, contracted, campaign and commercial totals', async context => {
  const { requests } = fixture(context, acceptance);
  const campaigns = await getClientCampaignAnalytics(scope);
  assert.equal(campaigns.summary!.spend, 450);
  assert.equal(campaigns.summary!.cpc, 15); assert.equal(campaigns.summary!.cpm, 150); assert.equal(campaigns.summary!.cpl, 30);
  assert.equal(campaigns.reconciliation!.status, 'RECONCILED');
  assert.deepEqual([campaigns.reconciliation!.rawObservedSpend, campaigns.reconciliation!.contractedGrainSpend, campaigns.reconciliation!.campaignAggregationSpend, campaigns.reconciliation!.commercialTotalSpend], [450, 450, 450, 450]);
  const commercial = await getCommercialAnalytics(scope);
  assert.equal(commercial.baseline.mediaSpend, 450);
  assert.equal(commercial.baseline.blendedCostPerSale, null, 'No attribution contract means no blended funnel cost');
  const query = requests.find(row => row.query.includes('AS campaign_group_count'))!.query;
  assert.match(query, /campaign_spend AS \([\s\S]*GROUP BY 1/); assert.match(query, /SELECT SUM\(recorded_spend\) FROM campaign_spend/);
  assert.doesNotMatch(query, /JOIN|UNNEST\(l\.hlc_details\)/);
  assert.match(query, /ARRAY\(SELECT AS STRUCT \* FROM campaign_spend[\s\S]*LIMIT 250\) AS campaign_details/);
});

test('mandatory duplicate R100 row yields INVALID_GRAIN, never R550', async context => {
  fixture(context, [...acceptance, acceptance[0]]);
  const result = await getClientCampaignAnalytics(scope);
  assert.equal(result.status, 'INVALID_GRAIN'); assert.equal(result.summary!.spend, null);
  assert.equal(result.grainDiagnostics!.rowCount, 4); assert.equal(result.grainDiagnostics!.distinctGrainCount, 3); assert.equal(result.grainDiagnostics!.duplicateGrainRows, 1);
  assert.equal(result.reconciliation!.rawObservedSpend, 550); assert.equal(result.reconciliation!.commercialTotalSpend, null);
  for (const metric of ['cpc', 'cpm', 'cpl'] as const) assert.equal(result.summary![metric], null);
  assert.ok(result.campaigns.every(row => row.spend === null));
});

test('mandatory R100 marketing row joined to three operational leads remains R100', async context => {
  enableAttribution(context);
  const { requests } = fixture(context, [acceptance[0]], { attributionRows: [joined('campaign a', 100, 3)] });
  const result = await getMarketingAttributionAnalytics(scope);
  assert.equal(result.summary!.totalSpend, 100); assert.equal(result.summary!.matchedSpend, 100);
  assert.equal(result.economics!.spendPerFetchedLead, 33.33); assert.equal(result.economics!.spendPerSale, 100); assert.equal(result.economics!.spendPerActivation, 100);
  const query = requests.find(row => row.query.includes('AS detail_rows'))!.query;
  assert.match(query, /marketing AS \([\s\S]*GROUP BY join_key/);
  assert.match(query, /operations AS \([\s\S]*FROM operation_leads GROUP BY join_key/);
  assert.match(query, /FROM marketing FULL OUTER JOIN operations USING \(join_key\)/);
  assert.match(query, /SUM\(spend\) AS total_spend/);
});

test('matched and unmatched coverage uses all keys before the 250-row detail limit', async context => {
  enableAttribution(context);
  const media = Array.from({ length: 251 }, (_, i) => mediaRow('2026-09-01', 'Adset', 100, `Campaign ${i}`));
  const attributionRows = media.map((row, i) => joined(row.campaign.toLowerCase(), 100, i === 250 ? 0 : 3));
  attributionRows.push(joined('operations only', null, 5));
  fixture(context, media, { attributionRows });
  const result = await getMarketingAttributionAnalytics(scope);
  assert.equal(result.rows.length, 250); assert.equal(result.summary!.totalSpend, 25100); assert.equal(result.summary!.matchedSpend, 25000);
  assert.equal(result.summary!.unmatchedMarketingSpend, 100); assert.equal(result.summary!.matchedKeys, 250);
  assert.equal(result.summary!.marketingOnlyKeys, 1); assert.equal(result.summary!.operationsOnlyKeys, 1);
  assert.equal(result.summary!.matchedSpendSharePct, 99.6); assert.equal(result.detailScope!.truncated, true);
});

test('date, campaign, channel, adset and tenant filters bind the same marketing scope', async context => {
  const { requests } = fixture(context, [...acceptance, { ...acceptance[0], client: 'Other Tenant', spend: 10000 }, mediaRow('2026-09-01', 'Adset 1', 500, 'Campaign B')]);
  const result = await getClientCampaignAnalytics({ ...scope, startDate: '2026-09-01', endDate: '2026-09-01', campaign: 'Campaign A', channel: 'Social', adset: 'Adset 1' });
  assert.equal(result.summary!.spend, 100);
  const summaryQuery = requests.find(row => row.query.includes('AS campaign_group_count'))!;
  assert.deepEqual(summaryQuery.params.marketingClientNames, ['mtn', 'mtn sa']);
  for (const filter of ['campaign', 'channel', 'adset', 'startDate', 'endDate']) assert.ok(summaryQuery.query.includes(`@${filter}`));
  const detail = requests.find(row => row.query.includes('GROUP BY 1, 2, 3, 4'))!;
  assert.deepEqual(detail.params, summaryQuery.params);
  assert.equal(result.comparison!.previousStartDate, '2026-08-31'); assert.equal(result.comparison!.previousEndDate, '2026-08-31');
  assert.equal(result.comparison!.spendDeltaPct, null, 'Empty prior spend is not a zero baseline');
});

test('operational vendor/grade/medium/agent/CLI filters never mix narrowed leads with all media spend', async context => {
  enableAttribution(context); fixture(context, acceptance);
  for (const dimension of ['vendor', 'medium', 'grade', 'agent', 'cli']) {
    await assert.rejects(() => getClientCampaignAnalytics({ ...scope, [dimension]: 'selected' }), /no approved marketing equivalent/);
    const result = await getMarketingAttributionAnalytics({ ...scope, [dimension]: 'selected' });
    assert.equal(result.status, 'UNSUPPORTED_FILTER'); assert.equal(result.economics!.spendPerSale, null);
  }
  const commercial = await getCommercialAnalytics({ ...scope, vendor: 'MTN' });
  assert.equal(commercial.baseline.mediaSpend, null); assert.equal(commercial.baseline.blendedCostPerFetchedLead, null);
});

test('source propagates only with an active key contract; unmapped campaign/channel/adset attribution is withheld', async context => {
  enableAttribution(context);
  const { requests } = fixture(context, acceptance, { attributionRows: [joined('campaign a', 450, 3)] });
  const mapped = await getMarketingAttributionAnalytics({ ...scope, source: 'Campaign A' });
  assert.equal(mapped.summary!.totalSpend, 450);
  const query = requests.find(row => row.query.includes('AS detail_rows'))!;
  assert.equal(query.params.attributionSource, 'Campaign A');
  assert.equal((query.query.match(/= LOWER\(@attributionSource\)/g) || []).length, 2);
  for (const dimension of ['campaign', 'channel', 'adset']) assert.equal((await getMarketingAttributionAnalytics({ ...scope, [dimension]: 'selected' })).status, 'UNSUPPORTED_FILTER');
});

test('null spend, partial missing spend, incomplete grain and empty population fail closed; real zero survives', async context => {
  const media = [...acceptance]; const harness = fixture(context, media);
  media.splice(0, media.length, mediaRow('2026-09-01', 'Adset', null));
  assert.equal((await getClientCampaignAnalytics(scope)).summary!.spend, null);
  media.push(mediaRow('2026-09-01', 'Other', 100));
  let result = await getClientCampaignAnalytics(scope);
  assert.equal(result.summary!.spend, null); assert.equal(result.grainDiagnostics!.missingSpendRows, 1);
  media.splice(0, media.length, mediaRow('2026-09-01', '', 100));
  assert.equal((await getClientCampaignAnalytics(scope)).status, 'INVALID_GRAIN');
  media.splice(0, media.length, mediaRow('2026-09-01', 'Adset', 0));
  result = await getClientCampaignAnalytics(scope); assert.equal(result.summary!.spend, 0); assert.equal(result.summary!.cpc, 0); assert.equal(result.summary!.cpl, 0);
  media.splice(0); result = await getClientCampaignAnalytics(scope); assert.equal(result.summary!.spend, null); assert.equal(result.summary!.ctr, null);
  assert.ok(harness.requests.length);
});

test('financial null/zero semantics and reconciliation disagreement are explicit', () => {
  assert.equal(commercialRatio(0, 10), 0); assert.equal(commercialRatio(100, 0), null); assert.equal(commercialRatio(null, 10), null);
  assert.equal(commercialRatio(100, null), null); assert.equal(commercialRatio(Infinity, 10), null);
  assert.equal(commercialRatio(450, 3000, 1000), 150);
  const result = reconcileSpend({ rowCount: 3, duplicateGrainRows: 0, missingGrainRows: 0, missingSpendRows: 0, rawObservedSpend: 450, campaignAggregationSpend: 550, hasApprovedSpend: true });
  assert.equal(result.status, 'PARTIAL'); assert.equal(result.commercialTotalSpend, null); assert.equal(result.difference, 100);
});

test('budget is never spend; ambiguous approved fields and missing units are rejected', async context => {
  const { contract } = fixture(context, acceptance, { columns: ['client_name', 'date', 'channel', 'Channel_Campaign_Name', 'channel_adset_name', 'impressions', 'clicks', 'actions_lead', 'spend', 'actual_spend', 'budget'] });
  const resolved = await resolveMarketingContract(getBigQueryClient(getClientConfig('mtn').bigQueryProject), contract);
  assert.equal(resolved.spendColumn, null); assert.match(resolved.spendResolutionReason, /Multiple approved spend candidates/);
  assert.equal(marketingSpendExpression(contract, 'budget'), null);
  assert.equal(marketingSpendExpression({ ...contract, approvedSpendFields: ['estimated_cost'] }, 'estimated_cost'), null);
  assert.equal(marketingSpendExpression({ ...contract, spendUnitByField: {} }, 'spend'), null);
  assert.match(marketingSpendExpression(contract, 'spend')!, /AS NUMERIC/);
  assert.doesNotMatch(marketingSpendExpression(contract, 'spend')!, /REGEXP_REPLACE/);
  assert.match(marketingSpendExpression(contract, 'cost_micros')!, /1000000/);
  const selected = await resolveMarketingContract(getBigQueryClient(getClientConfig('mtn').bigQueryProject), { ...contract, approvedSpendFields: ['actual_spend'] });
  assert.equal(selected.spendColumn, 'actual_spend', 'A contract change cannot reuse a stale resolved field');
});

test('tenant mappings fail closed and observed-spend selector accepts only allowlisted fields', context => {
  const contract = getClientConfig('mtn').marketing!;
  assert.throws(() => marketingTenantFilter({ ...contract, mappingStatus: 'UNRESOLVED' }), /unresolved/);
  assert.throws(() => marketingTenantFilter({ ...contract, clientNames: [] }), /unresolved/);
  const previous = process.env.CX_MARKETING_SPEND_FIELD_JSON;
  context.after(() => { if (previous === undefined) delete process.env.CX_MARKETING_SPEND_FIELD_JSON; else process.env.CX_MARKETING_SPEND_FIELD_JSON = previous; });
  process.env.CX_MARKETING_SPEND_FIELD_JSON = JSON.stringify({ mtn: 'spend' });
  assert.deepEqual(getClientConfig('mtn').marketing!.approvedSpendFields, ['spend']);
  process.env.CX_MARKETING_SPEND_FIELD_JSON = JSON.stringify({ mtn: 'budget' });
  assert.throws(() => getClientConfig('mtn'), /already approved/);
});


test('source-filtered commercial spend preserves its exact approved field and source metadata', async context => {
  enableAttribution(context); fixture(context, acceptance, { attributionRows: [joined('campaign a', 450, 3)] });
  const result = await getCommercialAnalytics({ ...scope, source: 'Campaign A' });
  assert.equal(result.baseline.mediaSpend, 450); assert.equal(result.media.spendSourceColumn, 'spend');
  assert.equal(result.media.spendSourceTable, 'dashboards-422710.lead_ledger.lead_ledger_platform_insights');
  assert.equal(result.reconciliation?.status, 'RECONCILED'); assert.equal(result.economics.spendPerSale, 450);
});

test('current and immediately preceding periods compare equal lengths and reject invalid prior grain', async context => {
  const media = [...acceptance, mediaRow('2026-08-30', 'Adset 1', 100), mediaRow('2026-08-31', 'Adset 1', 200)];
  fixture(context, media);
  const params = { ...scope, startDate: '2026-09-01', endDate: '2026-09-02' };
  const result = await getClientCampaignAnalytics(params);
  assert.equal(result.comparison!.previousStartDate, '2026-08-30'); assert.equal(result.comparison!.previousEndDate, '2026-08-31');
  assert.equal(result.comparison!.spendDelta, 150); assert.equal(result.comparison!.spendDeltaPct, 50); assert.equal(result.comparison!.cplDeltaPct, 0);
  media.push(media[3]);
  const invalid = await getClientCampaignAnalytics(params);
  assert.equal(invalid.comparison, null); assert.match(invalid.comparisonReason!, /prior period violates/);
});

test('attribution validates duplicate spend in the same snapshot as joined outcomes', async context => {
  enableAttribution(context);
  fixture(context, [acceptance[0], acceptance[0]], { attributionRows: [joined('campaign a', 200, 3)] });
  const result = await getMarketingAttributionAnalytics(scope);
  assert.equal(result.status, 'INVALID_GRAIN'); assert.equal(result.economics!.spendPerFetchedLead, null);
});

test('missing client keys stay in master population and invalidate the contracted grain', async context => {
  const { requests } = fixture(context, [{ ...acceptance[0], client: '' }]);
  const result = await getClientCampaignAnalytics({ clientId: 'default_tenant' });
  assert.equal(result.status, 'INVALID_GRAIN'); assert.equal(result.summary!.spend, null);
  const query = requests.find(row => row.query.includes('AS campaign_group_count'))!.query;
  assert.doesNotMatch(query, /WHERE `client_name` IS NOT NULL/);
  assert.match(query, /NULLIF\(TRIM\(CAST\(`client_name` AS STRING\)\), ''\) IS NULL/);
});

test('unexpected warehouse errors do not expose SQL or credential diagnostics in commercial API', async context => {
  fixture(context, acceptance);
  context.mock.method(getBigQueryClient(getClientConfig(scope.clientId).bigQueryProject), 'query', async () => { throw new Error('private warehouse SQL and credential diagnostic'); });
  const result = await getCommercialAnalytics(scope);
  assert.equal(result.baseline.mediaSpend, null); assert.equal(result.baseline.revenue, null);
  assert.doesNotMatch(JSON.stringify(result), /private warehouse|credential diagnostic/);
});


test('partial platform denominators withhold affected costs and never become fake zero metrics', async context => {
  const media = [mediaRow('2026-09-01', 'Adset 1', 100), { ...mediaRow('2026-09-02', 'Adset 1', 200), clicks: null, leads: null, impressions: null }];
  const { requests } = fixture(context, media);
  const result = await getClientCampaignAnalytics(scope);
  assert.equal(result.summary!.spend, 300); assert.equal(result.summary!.clicks, null); assert.equal(result.summary!.leads, null);
  assert.equal(result.summary!.impressions, null); assert.equal(result.summary!.cpc, null); assert.equal(result.summary!.cpl, null); assert.equal(result.summary!.cpm, null);
  assert.equal(result.summary!.ctr, null); assert.equal(result.summary!.clickToLeadRate, null);
  assert.equal(result.campaigns[0].cpc, null); assert.equal(result.campaigns[0].cpl, null);
  assert.equal(requests.filter(row => !row.query.includes('INFORMATION_SCHEMA.COLUMNS')).length, 1, 'Details and validation use a single warehouse snapshot');
  assert.match(requests.find(row => row.query.includes('AS campaign_group_count'))!.query, /AS missing_\$\{alias\}_rows|missing_clicks_rows/);
});

test('schema-present outbound-clicks with no observed amounts remain unavailable', async context => {
  fixture(context, acceptance, { columns: ['client_name', 'date', 'channel', 'Channel_Campaign_Name', 'channel_adset_name', 'impressions', 'clicks', 'actions_lead', 'spend', 'outbound_clicks', 'reach'] });
  const result = await getClientCampaignAnalytics(scope);
  assert.equal(result.summary!.outboundClicks, null); assert.equal(result.summary!.outboundCtr, null); assert.equal(result.summary!.reach, null); assert.equal(result.summary!.frequency, null);
  assert.equal(result.summary!.clickToLeadRate, null, 'Do not silently switch to clicks when a configured outbound denominator is missing');
});


test('media root-cause refresh validates its own grain and denominator snapshot with all filters', async context => {
  const rootCauseRows = [
    { period: 'current', dimension: 'overall', spend: 100, clicks: 10, impressions: 1000, leads: 5, duplicate_grain_rows: 0, missing_clicks_rows: 1 },
    { period: 'previous', dimension: 'overall', spend: 100, clicks: 10, impressions: 1000, leads: 5, duplicate_grain_rows: 0, missing_clicks_rows: 0 },
  ];
  const { requests } = fixture(context, [mediaRow('2026-09-01', 'Adset 1', 100), mediaRow('2026-08-31', 'Adset 1', 100)], { rootCauseRows });
  const params = { ...scope, startDate: '2026-09-01', endDate: '2026-09-01', metric: 'cpc', campaign: 'Campaign A', channel: 'Social', adset: 'Adset 1' };
  let result = await getMarketingRootCauseAnalysis(params);
  assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.metric, null); assert.deepEqual(result.drivers, []);
  const query = requests.find(row => row.query.includes('FROM dimensional JOIN snapshot_guard'))!;
  assert.equal(query.params.channel, 'Social'); assert.equal(query.params.adset, 'Adset 1');
  assert.match(query.query, /snapshot_guard AS/); assert.match(query.query, /COUNT\(\*\) - COUNT\(DISTINCT grain_key\)/);
  rootCauseRows[0].missing_clicks_rows = 0; rootCauseRows[1].duplicate_grain_rows = 1;
  result = await getMarketingRootCauseAnalysis(params);
  assert.equal(result.status, 'INVALID_GRAIN'); assert.equal(result.metric, null);
});


test('commercial CPS comparison requires independently valid attribution in both equal-length periods', async context => {
  enableAttribution(context);
  const media = [mediaRow('2026-09-01', 'Adset 1', 100), mediaRow('2026-08-31', 'Adset 1', 50)];
  fixture(context, media, { attributionRows: selected => selected.length ? [joined('campaign a', selected.reduce((sum, row) => sum + (row.spend || 0), 0), 3)] : [] });
  const params = { ...scope, startDate: '2026-09-01', endDate: '2026-09-01' };
  const result = await getCommercialAnalytics(params);
  assert.equal(result.mediaComparison!.spendDelta, 50);
  assert.equal(result.attributionComparison.costPerSale.current, 100); assert.equal(result.attributionComparison.costPerSale.previous, 50);
  assert.equal(result.attributionComparison.costPerSale.absoluteChange, 50); assert.equal(result.attributionComparison.costPerSale.percentageChange, 100);
  assert.equal(result.attributionComparison.window!.days, 1);
  media.push(media[1]);
  const invalid = await getCommercialAnalytics(params);
  assert.equal(invalid.baseline.mediaSpend, 100); assert.equal(invalid.attributionComparison.costPerSale.absoluteChange, null);
  assert.match(invalid.attributionComparison.reason, /Prior matched attribution is unavailable/);
});


test('attribution performs one warehouse data query while retaining an independent raw audit and outcome gate', async context => {
  enableAttribution(context);
  const { requests } = fixture(context, [acceptance[0]], { attributionRows: [joined('campaign a', 100, 3)] });
  const result = await getMarketingAttributionAnalytics({ ...scope, source: 'Campaign A', startDate: '2026-09-01', endDate: '2026-09-01' });
  assert.equal(result.summary!.totalSpend, 100); assert.equal(result.economics!.spendPerFetchedLead, 33.33);
  const dataQueries = requests.filter(row => !row.query.includes('INFORMATION_SCHEMA.COLUMNS'));
  assert.equal(dataQueries.length, 1, 'One snapshot replaces the previous preflight plus joined query');
  const query = dataQueries[0].query;
  assert.match(query, /marketing_audit AS \([\s\S]*SUM\([\s\S]*AS raw_observed_spend[\s\S]*FROM scoped_marketing/);
  assert.match(query, /SELECT AS STRUCT \* FROM marketing_audit/);
  assert.match(query, /AND \(SELECT row_count > 0 AND duplicate_grain_rows = 0 AND missing_grain_rows = 0/);
  assert.match(query, /missing_spend_rows = 0 AND raw_observed_spend IS NOT NULL FROM marketing_audit/);
  assert.deepEqual(dataQueries[0].params.marketingClientNames, ['mtn', 'mtn sa']);
});

test('summary-only campaigns preserve full totals and comparisons while omitting unused detail and budget work', async context => {
  const { requests } = fixture(context, [...acceptance, mediaRow('2026-08-30', 'Adset 1', 100), mediaRow('2026-08-31', 'Adset 1', 200)]);
  const params = { ...scope, startDate: '2026-09-01', endDate: '2026-09-02', campaign: 'Campaign A', channel: 'Social' };
  const detailed = await getClientCampaignAnalytics(params);
  const before = requests.length;
  const compact = await getClientCampaignAnalytics(params, { includeDetails: false });
  assert.deepEqual(compact.summary, detailed.summary); assert.deepEqual(compact.comparison, detailed.comparison);
  assert.deepEqual(compact.reconciliation, detailed.reconciliation); assert.deepEqual(compact.grainDiagnostics, detailed.grainDiagnostics);
  assert.ok(detailed.campaigns.length > 0); assert.deepEqual(compact.campaigns, []);
  const compactQueries = requests.slice(before);
  assert.equal(compactQueries.length, 2, 'Current and prior each retain their own complete audit');
  for (const { query, params: bindings } of compactQueries) {
    assert.doesNotMatch(query, /campaign_details|latest_budget|ARRAY_AGG|`budget`/);
    assert.match(query, /SELECT SUM\(recorded_spend\) FROM campaign_spend/);
    assert.match(query, /duplicate_grain_rows/); assert.match(query, /missing_clicks_rows/);
    assert.equal(bindings.campaign, 'Campaign A'); assert.equal(bindings.channel, 'Social');
  }
});

test('commercial matched-period path uses five analytical queries and no campaign detail arrays', async context => {
  enableAttribution(context);
  const media = [mediaRow('2026-09-01', 'Adset 1', 100), mediaRow('2026-08-31', 'Adset 1', 50)];
  const { requests } = fixture(context, media, { attributionRows: selected => selected.length ? [joined('campaign a', selected.reduce((sum, row) => sum + (row.spend || 0), 0), 3)] : [] });
  const result = await getCommercialAnalytics({ ...scope, startDate: '2026-09-01', endDate: '2026-09-01' });
  assert.equal(result.baseline.mediaSpend, 100); assert.equal(result.attributionComparison.costPerSale.absoluteChange, 50);
  const analytical = requests.filter(row => !row.query.includes('INFORMATION_SCHEMA.COLUMNS'));
  assert.equal(analytical.length, 5, 'Former path used overview + 2 media + 2 current attribution + 2 prior attribution = 7');
  assert.equal(analytical.filter(row => row.query.includes('AS detail_rows')).length, 2);
  const operational = analytical.find(row => row.query.includes('AS fetched_leads'))!;
  assert.doesNotMatch(operational.query, /daily_trends|backlog_vendor|APPROX_QUANTILES|lifecycle_summary|delivery_age_sec/);
  assert.equal(result.baseline.volume, 3); assert.equal(result.baseline.revenue, 300);
  assert.equal(result.baseline.revenuePerSale, 300);
  assert.ok(analytical.every(row => !row.query.includes('AS campaign_details')));
  assert.equal(requests.filter(row => row.query.includes('INFORMATION_SCHEMA.COLUMNS')).length, 1, 'Concurrent contract resolution remains single-flight');
});

test('single-snapshot attribution still rejects partial, missing, inconsistent and unreconciled spend evidence', async context => {
  enableAttribution(context);
  const media = [acceptance[0]];
  const overrides: Record<string, unknown> = {};
  fixture(context, media, { attributionRows: [joined('campaign a', 100, 3)], overrideSummary: overrides });
  media.push(mediaRow('2026-09-01', 'Adset 2', null));
  let result = await getMarketingAttributionAnalytics(scope);
  assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.economics!.spendPerSale, null);
  media.pop(); overrides.marketing_grain = null;
  result = await getMarketingAttributionAnalytics(scope);
  assert.equal(result.status, 'NOT_VERIFIED'); assert.equal(result.summary, null);
  overrides.marketing_grain = { row_count: 1, distinct_grain_count: 2, duplicate_grain_rows: 0, missing_grain_rows: 0, missing_spend_rows: 0, raw_observed_spend: 100 };
  result = await getMarketingAttributionAnalytics(scope);
  assert.equal(result.status, 'NOT_VERIFIED');
  delete overrides.marketing_grain; overrides.total_spend = 150;
  result = await getMarketingAttributionAnalytics(scope);
  assert.equal(result.status, 'NOT_VERIFIED'); assert.equal(result.economics!.spendPerFetchedLead, null);
});

test('marketing discovery SQL executes cleanly without reserved keyword rows error', async () => {
  const result = await getMarketingSourceDiscovery({ clientId: 'default_tenant' });
  assert.ok(result);
  assert.equal(result.status, 'MASTER');
  assert.ok(Array.isArray(result.availableClientNames));
});
