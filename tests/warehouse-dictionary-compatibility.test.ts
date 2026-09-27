import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FLAT_LEAD_VIEW_NAMES, FLAT_LEAD_TENANT_TABLES, flatLeadColumns, SHARED_SOURCE_COLUMNS, leadSourceEvidence } from '../contracts/warehouseSchemaSnapshot';
import { SOURCE_TABLE_CONTRACT } from '../contracts/physicalSources';
import { leadSourceRelation, assertLeadSourceDimensions } from '../server/bigquery/leadSource';
import { getClientConfig } from '../server/bigquery/config';
import { getBaseSemanticLayer } from '../server/bigquery/views';
import { flatSchema, type TableMetadata } from '../server/bigquery/sourceAccess';
import { compileSourceMetrics } from '../server/bigquery/sourceMetrics';
import { sourceCatalogue } from '../server/bigquery/sourceCatalog';
import { sourceDateFilter } from '../server/bigquery/sourceDateFilter';
import { operationalLeadCtes } from '../server/analytics/common/leadMetrics';
import { withAnalyticsScope } from '../server/analyticsContext';

const scope = { clientId: 'default_tenant', startDate: '2026-09-01', endDate: '2026-09-26' };
const metadata = (columns: Record<string, string>, type = 'TABLE'): TableMetadata => ({ type, schema: { fields: Object.entries(columns).map(([name, type]) => ({ name, type })) } });

test('physical parameters match the uploaded shared-source dictionary, with no invented ID or created_at', () => {
  for (const contract of Object.values(SOURCE_TABLE_CONTRACT)) {
    const columns = SHARED_SOURCE_COLUMNS[contract.table.split('.').at(-1)!];
    assert.ok(columns);
    for (const [key, value] of Object.entries(contract.fields)) {
      if (typeof value === 'string') assert.ok(value in columns, `${key}: ${value} is absent`);
    }
    assert.equal(contract.fields.id, null);
    assert.equal(contract.fields.createdAt, null);
  }
  assert.equal(SHARED_SOURCE_COLUMNS.lead_ledger_platform_insights.date, 'DATE');
  assert.equal(SHARED_SOURCE_COLUMNS.lead_ledger_all_vicidial_insights.call_start_date, 'STRING');
});

test('all eight flat tenant sources project only supplied columns and never read another tenant table', () => {
  assert.equal(FLAT_LEAD_VIEW_NAMES.length, 8);
  for (const [id, table] of Object.entries(FLAT_LEAD_TENANT_TABLES)) {
    const client = getClientConfig(id);
    assert.equal(client.semanticMappings.tables.leads, table);
    const sql = leadSourceRelation(client);
    const columns = flatLeadColumns(table);
    for (const match of sql.matchAll(/src\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) assert.ok(match[1] in columns, `${id}: ${match[1]}`);
    assert.match(sql, /CAST\(NULL AS STRING\) AS offershop_grade/);
    assert.match(sql, /CAST\(NULL AS BOOL\) AS valid_lead/);
    assert.match(sql, /\[STRUCT\(src\.vendor AS vendor/);
    assert.doesNotMatch(sql, /src\.hlc_details|clustered_lead_ledger|SELECT \*/);
    assert.equal(leadSourceEvidence(table).physicalLayout, 'flat_vendor_transaction');
  }
});

test('flat source adapter feeds both operational and legacy views while master keeps its nested table', () => {
  assert.match(operationalLeadCtes({ clientId: 'mtn', startDate: scope.startDate, endDate: scope.endDate }), /FROM `dashboards-422710\.lead_ledger\.view_lead_ledger_mtn_lead_submit_open` src/);
  const sql = getBaseSemanticLayer(getClientConfig('mtn'));
  assert.match(sql, /AS hlc_details/);
  assert.match(sql, /CAST\(NULL AS ARRAY<STRUCT<partner STRING, timestamp TIMESTAMP>>\)/);
  assert.doesNotMatch(sql, /FROM `[^`]*lead_ledger_all_vicidial_insights`|FROM `[^`]*tbl_blc_activations`/);
  assert.equal(leadSourceRelation(getClientConfig('default_tenant')), '`dashboards-422710.lead_ledger.clustered_lead_ledger`');
});

test('missing dimensions fail before a query instead of silently using null placeholders as filters', () => {
  assert.throws(() => assertLeadSourceDimensions('mtn', { grade: 'Gold' }), /UNSUPPORTED_FILTER/);
  assert.doesNotThrow(() => assertLeadSourceDimensions('default_tenant', { grade: 'Gold' }));
  assert.throws(() => withAnalyticsScope({ ...scope, clientId: 'mtn', filters: { medium: { operator: 'in', values: ['paid'] } } }, () => getBaseSemanticLayer(getClientConfig('mtn'))), /UNSUPPORTED_FILTER/);
});

test('source inspection of a flat tenant filters vendor directly and retains missing validation metrics', () => {
  const table = FLAT_LEAD_TENANT_TABLES.mtn;
  const result = compileSourceMetrics('leads', { ...scope, clientId: 'mtn', filters: { vendor: { operator: 'in', values: ['MTN'] } } }, metadata(flatLeadColumns(table), 'VIEW'));
  assert.match(result.query, /CAST\(s\.`vendor` AS STRING\)/);
  assert.doesNotMatch(result.query, /UNNEST/);
  assert.equal(result.available[result.metrics.findIndex(metric => metric.id === 'valid_leads')], false);
});

test('native date predicates preserve UTC, inclusive end dates and sentinel rejection without wrapping DATE columns', () => {
  const result = compileSourceMetrics('marketing', scope, metadata(SHARED_SOURCE_COLUMNS.lead_ledger_platform_insights));
  assert.match(result.query, /s\.`date` BETWEEN DATE\(@startDate\) AND DATE\(@endDate\)/);
  assert.doesNotMatch(result.query, /TRIM\(CAST\(s\.`date`/);
  assert.equal(result.dateFilterStrategy, 'native_date_range');
  assert.match(sourceDateFilter('s.`date`', 'TIMESTAMP').sql, /INTERVAL 1 DAY/);
  assert.match(sourceDateFilter('s.`date`', 'DATE').sql, /1900, 1970/);
  assert.match(sourceDateFilter('s.`date`', 'STRING').sql, /SAFE_CAST/);
});

test('case-insensitive schema lookup preserves actual names, nested repetition and exact field count', () => {
  const fields = flatSchema([{ name: 'Channel_Campaign_Name', type: 'STRING' }, { name: 'HLC_DETAILS', type: 'RECORD', mode: 'REPEATED', fields: [{ name: 'Vendor', type: 'STRING' }] }]);
  assert.equal(fields.size, 3);
  assert.ok(fields.has('channel_campaign_name'));
  assert.equal(fields.get('hlc_details.vendor')?.repeated, true);
  assert.ok([...fields.keys()].includes('Channel_Campaign_Name'));
});

test('catalogue metadata is concurrent, failures stay isolated and a view without row-count metadata is unknown', async () => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const started: string[] = [];
  const pending = sourceCatalogue('default_tenant', {
    async listTables() { started.push('inventory'); await barrier; return []; },
    async metadata(table) { started.push(table); await barrier; return { type: 'VIEW', schema: { fields: [{ name: 'fetched', type: 'STRING' }] } }; },
    async execute() { throw new Error('Catalogue must not scan data'); },
  });
  await Promise.resolve();
  assert.equal(started.length, 9);
  release();
  const report = await pending;
  assert.equal(report.sources[0].rowCount, null);
  assert.equal(report.sources[0].rowCountStatus, 'UNAVAILABLE');
  assert.equal(report.inventoryComplete, true);
});

test('source limitations are visible without an extra API request or automatic filter removal', () => {
  const source = readFileSync('src/components/SourceCapabilityNotice.tsx', 'utf8');
  assert.match(source, /Schema reference/);
  assert.match(source, /not a live data cutoff/);
  assert.match(source, /Remove unsupported/);
  assert.doesNotMatch(source, /fetch\(|useEffect/);
});
