import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLeadLedgerExport } from '../src/lib/leadLedgerExport';
import { LEAD_EVIDENCE_AUDIT_COLUMNS, serializeCsv } from '../src/lib/analysisExport';
import { LEAD_LEDGER_COLUMNS } from '../src/lib/leadLedgerValues';
import { downloadCsv } from '../src/lib/formatters';

function result() {
  return {
    clientId: 'tenant-a', startDate: null, endDate: null, filters: {}, search: null,
    drill: null, drillValue: null, timezone: 'Africa/Johannesburg', dateBasis: 'intake_cohort',
    definitionVersion: 'fixture-v1', metricId: 'lead_records', countingGrain: 'lead',
    generatedAt: '2026-09-27T21:00:00.000Z', sourceCutoff: null, validationStatus: 'NOT_VERIFIED',
    totalCount: 3, limit: 2, offset: 0,
    rows: [
      { lead_id: '001', valid_idno: '1', phone_valid: null, total_calls: null, contacted: null, revenue: null, source: '=1+1' },
      { lead_id: '002', valid_idno: 2, phone_valid: 2, total_calls: 0, contacted: false, revenue: '0.00', source: 'Quoted, "source"\nnext line' },
    ],
  };
}

test('Ledger export retains its 17 columns then appends the canonical result-bound evidence context', () => {
  const report = result();
  const output = buildLeadLedgerExport(report);
  assert.deepEqual(output.headers, [...LEAD_LEDGER_COLUMNS, ...LEAD_EVIDENCE_AUDIT_COLUMNS]);
  assert.deepEqual(output.leadIds, ['001', '002']);
  assert.equal(output.totalCount, 3);
  assert.equal(output.returnedRowCount, 2);
  assert.equal(output.populationStatus, 'PARTIAL');
  assert.equal(output.metadata.generatedAt, report.generatedAt);
  assert.equal(output.metadata.sourceCutoff, null);
  assert.equal(output.metadata.validationStatus, 'NOT_VERIFIED');
  assert.equal(output.filename, 'cx-lead-ledger-tenant-a-all-all-page1.csv');
  const idx = (name: string) => output.headers.indexOf(name);
  assert.equal(output.rows[1][idx('Contacted (RPC)')], 'Unavailable');
  assert.equal(output.rows[2][idx('Contacted (RPC)')], 'FALSE');
  assert.equal(output.rows[1][idx('Total Calls')], 'Unavailable');
  assert.equal(output.rows[2][idx('Total Calls')], 0);
  assert.equal(output.rows[1][idx('Valid ID')], 'Valid (1)');
  assert.equal(output.rows[1][idx('Valid Phone')], 'Unavailable');
  assert.equal(output.rows[1][idx('Scope client')], 'tenant-a');
  assert.equal(output.rows[1][idx('Population total')], 3);
  assert.equal(output.rows[1][idx('Filters')], '{}');
  assert.equal(output.rows[1][idx('Reporting timezone')], 'Africa/Johannesburg');
  assert.equal(output.csv, serializeCsv(output.rows));
  assert.ok(output.csv.includes("'=1+1"));
  assert.ok(output.csv.includes('Quoted, ""source""\nnext line'));
});

test('Ledger export inherits complete-page validation and rejects missing result context', () => {
  for (const key of ['clientId', 'startDate', 'endDate', 'filters', 'search', 'drill', 'timezone', 'dateBasis', 'definitionVersion', 'metricId', 'countingGrain', 'generatedAt', 'totalCount', 'offset', 'limit']) {
    const report: Record<string, any> = result();
    delete report[key];
    assert.throws(() => buildLeadLedgerExport(report as ReturnType<typeof result>), undefined, key);
  }
  assert.throws(() => buildLeadLedgerExport({ ...result(), rows: result().rows.slice(0, 1) }), /incomplete/);
  assert.throws(() => buildLeadLedgerExport({ ...result(), generatedAt: 'not a timestamp' }), /timestamp/);
  assert.throws(() => buildLeadLedgerExport({ ...result(), countingGrain: 'call_event' }), /one row per scoped lead/);
});

test('Ledger export rejects duplicate or missing identities instead of exporting an invalid page', () => {
  const report = result();
  assert.throws(() => buildLeadLedgerExport({ ...report, rows: [report.rows[0], report.rows[0]] }), /unique/);
  assert.throws(() => buildLeadLedgerExport({ ...report, rows: [{ ...report.rows[0], lead_id: '' }, report.rows[1]] }), /identities/);
});

test('Ledger export distinguishes second-page, complete and empty populations without inventing totals', () => {
  const report = result();
  const second = buildLeadLedgerExport({ ...report, offset: 2, rows: [report.rows[1]] });
  assert.equal(second.page, 1);
  assert.equal(second.metadata.offset, 2);
  assert.equal(second.filename, 'cx-lead-ledger-tenant-a-all-all-page2.csv');
  assert.equal(second.populationStatus, 'PARTIAL');
  assert.equal(buildLeadLedgerExport({ ...report, totalCount: 2 }).populationStatus, 'COMPLETE');
  assert.equal(buildLeadLedgerExport({ ...report, totalCount: 0, rows: [] }).populationStatus, 'EMPTY');
});


// Independent CSV reader for the actual download bytes, including quoted newlines.
function parseDownload(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(cell); cell = '';
    } else if (!quoted && (char === '\r' || char === '\n')) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  assert.equal(quoted, false, 'download must not contain unterminated quotes');
  row.push(cell); rows.push(row);
  return rows;
}

test('Ledger download uses the production serializer and retains exact rows, escaping and audit context', async t => {
  // This exercises Blob/anchor serialization, not a browser session or authenticated UI.
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const blobs: Blob[] = [];
  const deferred: Array<() => void> = [];
  let clicked = 0, appended = 0, removed = 0;
  const anchor = { href: '', download: '', click() { clicked++; } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement(tag: string) { assert.equal(tag, 'a'); return anchor; },
    body: {
      appendChild(element: unknown) { assert.equal(element, anchor); appended++; },
      removeChild(element: unknown) { assert.equal(element, anchor); removed++; },
    },
  } });
  t.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  t.mock.method(URL, 'createObjectURL', (blob: Blob) => { blobs.push(blob); return 'blob:ledger-fixture'; });
  const revoke = t.mock.method(URL, 'revokeObjectURL', () => undefined);
  t.mock.method(globalThis, 'setTimeout', (callback: () => void) => {
    deferred.push(callback); return 0 as unknown as ReturnType<typeof setTimeout>;
  });
  const output = buildLeadLedgerExport(result());
  downloadCsv(output.filename, output.rows);
  assert.equal(clicked, 1); assert.equal(appended, 1); assert.equal(removed, 1);
  assert.equal(anchor.download, 'cx-lead-ledger-tenant-a-all-all-page1.csv');
  assert.equal(anchor.href, 'blob:ledger-fixture');
  assert.equal(blobs.length, 1);
  assert.deepEqual(Array.from(new Uint8Array(await blobs[0].arrayBuffer()).slice(0, 3)), [239, 187, 191]);
  const parsed = parseDownload(await blobs[0].text());
  assert.deepEqual(parsed[0], [...LEAD_LEDGER_COLUMNS, ...LEAD_EVIDENCE_AUDIT_COLUMNS]);
  assert.equal(parsed.length, 3);
  assert.ok(parsed.every(row => row.length === 39));
  const at = (row: number, field: string) => parsed[row][parsed[0].indexOf(field)];
  assert.deepEqual(parsed.slice(1).map(row => row[0]), ['001', '002']);
  assert.equal(at(1, 'Offershop Source'), "'=1+1");
  assert.equal(at(2, 'Offershop Source'), 'Quoted, "source"\nnext line');
  assert.equal(at(1, 'Total Calls'), 'Unavailable');
  assert.equal(at(2, 'Total Calls'), '0');
  assert.equal(at(1, 'Contacted (RPC)'), 'Unavailable');
  assert.equal(at(2, 'Contacted (RPC)'), 'FALSE');
  assert.equal(at(1, 'Valid ID'), 'Valid (1)');
  assert.equal(at(1, 'Valid Phone'), 'Unavailable');
  assert.equal(at(1, 'Scope client'), 'tenant-a');
  assert.equal(at(1, 'Population total'), '3');
  assert.equal(at(1, 'Population status'), 'PARTIAL');
  assert.equal(at(1, 'Reporting timezone'), 'Africa/Johannesburg');
  assert.equal(at(1, 'Server generated at'), '2026-09-27T21:00:00.000Z');
  deferred.forEach(callback => callback());
  assert.equal(revoke.mock.callCount(), 1);
});
