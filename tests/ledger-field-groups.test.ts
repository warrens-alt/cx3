import test from 'node:test';
import assert from 'node:assert/strict';
import { LEDGER_COLUMNS, LEDGER_HEADERS } from '../contracts/leadLedgerReplica';
import { LEDGER_RAW_FIELD_GROUPS } from '../src/features/leadLedger/fieldGroups';

test('raw ledger groups retain all 63 source headers exactly once', () => {
  const grouped = LEDGER_RAW_FIELD_GROUPS.flatMap(group => group.columns);
  assert.equal(grouped.length, 63);
  assert.equal(new Set(grouped.map(column => column.label)).size, 63);
  assert.deepEqual(grouped.map(column => column.label).sort(), [...LEDGER_HEADERS].sort());
  assert.deepEqual(LEDGER_RAW_FIELD_GROUPS.map(group => [group.label, group.columns.length]), [
    ['Identity', 6], ['Acquisition', 3], ['Qualification / vetting', 11], ['Delivery', 20],
    ['Contact', 9], ['Outcomes', 3], ['Commercial', 3], ['Remaining source fields', 8],
  ]);
});

test('grouping reuses original column definitions and their relative source order', () => {
  for (const group of LEDGER_RAW_FIELD_GROUPS) {
    const indices = group.columns.map(column => LEDGER_COLUMNS.indexOf(column));
    assert.ok(indices.every(index => index >= 0));
    assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
  }
  assert.deepEqual(LEDGER_HEADERS.slice(0, 6), ['Vendors', 'Lead ID', 'Total Revenue', 'Consumer ID', 'Offershop Source', 'Fetched']);
  assert.equal(LEDGER_HEADERS[62], 'HLC CURRENCY');
});

test('unclassified source fields remain visible under their exact source labels', () => {
  assert.deepEqual(LEDGER_RAW_FIELD_GROUPS.at(-1)?.columns.map(column => column.label), [
    'DEBT CONSOLIDATION', 'FUNERAL INSURANCE', 'INCOME', 'MEDICAL INSURANCE QUOTE',
    'MOTOR WARRANTY', 'ONLINE TRADING', 'OWN VEHICLE', 'PERSONAL LOAN',
  ]);
});
