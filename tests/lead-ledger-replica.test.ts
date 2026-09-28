import test from 'node:test';
import assert from 'node:assert/strict';
import { LEDGER_COLUMNS, LEDGER_HEADERS, analyseLedgerLead, ledgerTimestamp, ledgerCsvCell, ledgerCsvRow, type LedgerRow } from '../contracts/leadLedgerReplica';
import { buildLedgerQuery, inspectLedgerSchema, selectLedgerTable, validateLedgerWindow, MASTER_LEDGER, RICH_LEDGER, type SchemaField } from '../server/leadLedger/query';
import { prepareLedgerExport, type LedgerQueryJob } from '../server/leadLedger/stream';
import { LedgerCsvVerifier, receiveLedgerCsv } from '../src/features/leadLedger/download';

const now = Date.parse('2026-09-28T00:00:00Z');
const row = (values: Partial<LedgerRow> = {}): LedgerRow => ({ ...Object.fromEntries(LEDGER_HEADERS.map(header => [header, null])), 'Lead ID': 'lead-1', 'Consumer ID': 'consumer-1', 'Fetched': '2026-07-01 10:00:00', ...values });
const fullSchema: SchemaField[] = [
  ...LEDGER_COLUMNS.filter(c => c.scope === 'lead').map(c => ({ name: c.field, type: 'STRING' })),
  { name: 'hlc_details', type: 'RECORD', fields: LEDGER_COLUMNS.filter(c => c.scope === 'hlc').map(c => ({ name: c.field, type: 'STRING' })) },
];
const master = { id: 'default_tenant', dataSourceMode: 'separate', semanticMappings: { tables: { leads: MASTER_LEDGER } } };
const scope = { clientId: 'default_tenant', startDate: '2026-07-01', endDate: '2026-07-31', filters: {} };
const source = inspectLedgerSchema(RICH_LEDGER, fullSchema, true);
function fakeJob(pages: Record<string, unknown>[][], total = pages.reduce((sum, page) => sum + page.length, 0)) {
  const requested: string[] = [];
  let cancelled = 0;
  const job: LedgerQueryJob = {
    id: 'one-query-snapshot',
    async getQueryResults(options) {
      assert.equal(options.autoPaginate, false);
      const index = Number(options.pageToken || 0); requested.push(String(index));
      return [pages[index], index + 1 < pages.length ? { pageToken: String(index + 1) } : null, { totalRows: String(total), jobComplete: true }];
    },
    async cancel() { cancelled++; },
  };
  return { job, requested, get cancelled() { return cancelled; } };
}
async function consume(generator: AsyncGenerator<string>) { let output = ''; for await (const chunk of generator) output += chunk; return output; }

test('the compatibility contract has exactly 63 unique ordered headers and 43/18/2 fields', () => {
  assert.equal(LEDGER_HEADERS.length, 63); assert.equal(new Set(LEDGER_HEADERS).size, 63);
  assert.deepEqual(LEDGER_HEADERS.slice(0, 6), ['Vendors', 'Lead ID', 'Total Revenue', 'Consumer ID', 'Offershop Source', 'Fetched']);
  assert.equal(LEDGER_HEADERS[62], 'HLC CURRENCY');
  assert.deepEqual(['lead', 'hlc', 'derived'].map(scope => LEDGER_COLUMNS.filter(c => c.scope === scope).length), [43, 18, 2]);
});
test('rich source is opt-in and cannot cross tenant boundaries', () => {
  assert.equal(selectLedgerTable(master).table, MASTER_LEDGER);
  assert.throws(() => selectLedgerTable(master, 'rich'), /not approved/);
  assert.equal(selectLedgerTable(master, 'rich', true).table, RICH_LEDGER);
  assert.throws(() => selectLedgerTable({ ...master, id: 'mtn' }, 'rich', true), /not approved/);
  assert.throws(() => selectLedgerTable({ ...master, dataSourceMode: 'shared' }), /row-security/);
  assert.throws(() => selectLedgerTable(master, 'user_supplied_table'), /Unsupported/);
});
test('live schema exposes 63 or 55 fields without inventing product interests', () => {
  assert.equal(source.coverage.compatible, true);
  const extra = ['income', 'personal_loan', 'debt_consolidation', 'funeral_insurance', 'online_trading', 'own_vehicle', 'motor_warranty', 'medical_insurance_quote'];
  const partial = inspectLedgerSchema(MASTER_LEDGER, fullSchema.filter(f => !extra.includes(f.name!)), false);
  assert.equal(partial.coverage.available.length, 55); assert.equal(partial.coverage.missing.length, 8);
  assert.match(buildLedgerQuery(partial, scope).query, /CAST\(NULL AS STRING\) AS c22/);
});
test('flat vendor source never joins the master or supplies unsupported grade filters', () => {
  const flat = inspectLedgerSchema('dashboards-422710.lead_ledger.tenant_view', [{ name: 'lead_id' }, { name: 'fetched' }, { name: 'vendor' }, { name: 'transaction_id' }], false);
  const query = buildLedgerQuery(flat, scope).query;
  assert.equal(flat.flat, true); assert.doesNotMatch(query, /UNNEST|clustered_lead_ledger/);
  assert.throws(() => buildLedgerQuery(flat, { ...scope, filters: { grade: { operator: 'equals', value: 'A' } } }), /unavailable/);
});
test('left expansion, all-vendor totals and selected-vendor rows have separate scope', () => {
  const plan = buildLedgerQuery(source, { ...scope, filters: { vendor: { operator: 'in', values: ['MTN'] } } });
  assert.match(plan.query, /LEFT JOIN UNNEST/);
  assert.ok(plan.query.indexOf('COUNT(DISTINCT NULLIF(TRIM(c45)') < plan.query.indexOf('WHERE c45 IN'));
  assert.match(plan.query, /PARTITION BY _lead_key, COALESCE\(NULLIF\(TRIM\(c62\)/);
  assert.match(plan.query, /lead_only_rows/);
});
test('search and filters are parameterized, unsupported analytical filters fail closed', () => {
  const hostile = "x' OR TRUE --";
  const plan = buildLedgerQuery(source, { ...scope, filters: { source: { operator: 'equals', value: hostile } } }, { search: hostile });
  assert.doesNotMatch(plan.query, /x' OR TRUE/); assert.ok(Object.values(plan.params).includes(hostile));
  assert.throws(() => buildLedgerQuery(source, { ...scope, filters: { sale: { operator: 'equals', value: true } } }), /not supported/);
  assert.throws(() => inspectLedgerSchema('bad`table', fullSchema, false), /Invalid/);
});
test('date windows and page controls cannot silently become unbounded', () => {
  assert.throws(() => validateLedgerWindow({ clientId: 'mtn' }), /Select/);
  assert.throws(() => validateLedgerWindow({ ...scope, endDate: '2026-02-31' }), /valid/);
  assert.throws(() => validateLedgerWindow({ ...scope, endDate: '2025-01-01' }), /ordered/);
  assert.throws(() => buildLedgerQuery(source, scope, { limit: 101 }), /pagination/);
  assert.throws(() => buildLedgerQuery(source, scope, { offset: -1 }), /pagination/);
  assert.throws(() => buildLedgerQuery(source, scope, { search: 'a'.repeat(201) }), /200/);
});
test('complete export has no SQL LIMIT and no call/activation enrichment', () => {
  const plan = buildLedgerQuery(source, scope, {}, true);
  assert.doesNotMatch(plan.query, /\bLIMIT\b|vicidial|tbl_blc_activations/);
  assert.match(plan.query, /AS `HLC Status`/); assert.match(plan.query, /AS `Total Revenue`/);
  assert.match(plan.query, /REGEXP_CONTAINS/); assert.doesNotMatch(plan.query, /l\.`(?:idno|mobile_number|first_name)`/);
});
test('placeholder, invalid and future timestamps do not become observed events', () => {
  for (const value of ['', '1900-01-01 00:00:00', '1970-01-01 07:00:00']) assert.equal(ledgerTimestamp(value, now).state, 'missing');
  for (const value of ['2026-02-31 12:00:00', '2026-07-01 25:00:00', 'not-a-date']) assert.equal(ledgerTimestamp(value, now).state, 'invalid');
  assert.equal(ledgerTimestamp('2027-01-01 00:00:00', now).state, 'future');
  assert.equal(ledgerTimestamp('2026-07-01 12:00:00', now).timestamp, '2026-07-01T12:00:00.000Z');
});
test('all conflicting records survive, with chronology and missing disposition exceptions', () => {
  const a = row({ 'HLC Vendor': 'Vendor A', 'HLC Transaction ID': 'x', 'HLC First Call Date': '2026-07-01 10:00:00', 'HLC Delivered': '2026-07-02 10:00:00' });
  const b = { ...a, 'HLC Sale': '2026-07-03 10:00:00', 'HLC Last Dialer Status': 'Sale' };
  const lead = analyseLedgerLead('lead-1', [a, b], now);
  assert.equal(lead.records.length, 2);
  assert.ok(lead.issues.includes('CONFLICTING_TRANSACTION_KEY'));
  assert.ok(lead.issues.includes('FIRST_CALL_BEFORE_DELIVERY'));
  assert.ok(lead.issues.includes('MISSING_DISPOSITION_WITH_CALL_EVIDENCE'));
  assert.equal(lead.records[1].raw['HLC Sale'], b['HLC Sale']);
});
test('lead-only records and unresolved consumer IDs remain explicit', () => {
  const lead = analyseLedgerLead('lead-only', [row({ 'Consumer ID': '0' })], now);
  assert.equal(lead.records.length, 1); assert.ok(lead.issues.includes('UNRESOLVED_CONSUMER_ID'));
  assert.equal(lead.records[0].raw['HLC Vendor'], null);
});
test('CSV quoting protects formulas and preserves quoted multiline values', () => {
  assert.equal(ledgerCsvCell('=1+1'), '"\'=1+1"'); assert.equal(ledgerCsvCell('-12.50'), '"-12.50"');
  assert.equal(ledgerCsvCell('a,"b"\nc'), '"a,""b""\nc"');
  assert.equal(ledgerCsvCell(null), '""');
});
test('stream exports 99,822 source rows through one job without the old 50,000 cap', async () => {
  const record = row({ 'HLC Vendor': 'Synthetic Vendor' });
  const pages = Array.from({ length: 100 }, (_, i) => Array(i === 99 ? 822 : 1000).fill(record));
  const fixture = fakeJob(pages), prepared = await prepareLedgerExport(fixture.job);
  assert.equal(prepared.expectedRows, 99822);
  const verifier = new LedgerCsvVerifier(); let chunks = 0;
  for await (const chunk of prepared.csv) { verifier.push(chunk); chunks++; }
  verifier.finish(99822); assert.equal(chunks, 101); assert.equal(fixture.requested.length, 100);
});
test('export ceiling rejects entire result before returning a partial file', async () => {
  const fixture = fakeJob([[row()]], 50001);
  await assert.rejects(prepareLedgerExport(fixture.job, 50000), /No partial export/);
  assert.equal(fixture.cancelled, 1);
});
test('short export, repeated tokens and missing columns cannot complete successfully', async () => {
  const short = fakeJob([[row()]], 2);
  await assert.rejects(consume((await prepareLedgerExport(short.job)).csv), /Incomplete export/);
  const malformed = fakeJob([[{ 'Lead ID': 'x' }]]);
  await assert.rejects(consume((await prepareLedgerExport(malformed.job)).csv), /63-column/);
  const repeated: LedgerQueryJob = { async getQueryResults() { return [[row()], { pageToken: 'same' }, { totalRows: '5' }]; } };
  await assert.rejects(consume((await prepareLedgerExport(repeated)).csv), /Repeated export page/);
});
test('aborted exports cancel the query job', async () => {
  const fixture = fakeJob([[row()], [row()]]), controller = new AbortController();
  const prepared = await prepareLedgerExport(fixture.job, 1000, controller.signal);
  await prepared.csv.next(); controller.abort();
  await assert.rejects(prepared.csv.next(), /cancelled/); assert.ok(fixture.cancelled > 0);
});
test('browser verifier handles quoted multiline fields across arbitrary chunks', () => {
  const csv = '\uFEFF' + LEDGER_HEADERS.map(ledgerCsvCell).join(',') + '\r\n' + ledgerCsvRow(row({ 'HLC Status': 'a,"b"\nc' }));
  const verifier = new LedgerCsvVerifier(); for (const character of csv) verifier.push(character); verifier.finish(1);
  assert.throws(() => verifier.finish(2), /integrity/);
});
test('browser only produces a blob after the exact expected row count is received', async () => {
  const csv = '\uFEFF' + LEDGER_HEADERS.map(ledgerCsvCell).join(',') + '\r\n' + ledgerCsvRow(row());
  const response = (rows: string) => new Response(csv, { headers: { 'Content-Type': 'text/csv', 'X-Export-Truncated': 'false', 'X-Export-Row-Count': rows } });
  const result = await receiveLedgerCsv(response('1'), new AbortController().signal, () => undefined);
  assert.equal(result.rows, 1); assert.ok(result.blob.size > 0);
  await assert.rejects(receiveLedgerCsv(response('2'), new AbortController().signal, () => undefined), /integrity/);
  await assert.rejects(receiveLedgerCsv(new Response('<html>error</html>'), new AbortController().signal, () => undefined), /complete CSV/);
});
