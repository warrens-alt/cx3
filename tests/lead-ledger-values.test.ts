import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLeadLedgerDataRows, LEAD_LEDGER_COLUMNS, ledgerCalls, ledgerOutcome, ledgerValidation } from '../src/lib/leadLedgerValues';

test('Ledger validation preserves numeric/string 1 and 2 without classifying absent or unknown codes as invalid', () => {
  for (const value of [1, '1', true]) assert.equal(ledgerValidation(value), 'Valid (1)');
  for (const value of [2, '2', false]) assert.equal(ledgerValidation(value), 'Invalid (2)');
  for (const value of [null, undefined, '', ' ', 0, '0', 3, 'garbage']) assert.equal(ledgerValidation(value), 'Unavailable');
});

test('Ledger outcomes distinguish false from unknown and never apply JavaScript truthiness to strings', () => {
  for (const value of [true, 1, '1', 'true']) assert.equal(ledgerOutcome(value), 'TRUE');
  for (const value of [false, 0, '0', 'false']) assert.equal(ledgerOutcome(value), 'FALSE');
  for (const value of [null, undefined, '', ' ', 2, '2', 'no evidence']) assert.equal(ledgerOutcome(value), 'Unavailable');
});

test('Ledger calls retain measured zero and exact integer strings without fabricating unavailable counts', () => {
  assert.equal(ledgerCalls(0), 0);
  assert.equal(ledgerCalls('0'), '0');
  assert.equal(ledgerCalls('9007199254740993'), '9007199254740993');
  for (const value of [null, undefined, '', ' ', NaN, Infinity, -1, 0.5, false, {}, 9007199254740992]) {
    assert.equal(ledgerCalls(value), 'Unavailable');
  }
});

test('Ledger production row mapper keeps exact column order, identifiers, known zero and unknown evidence', () => {
  const input = [
    { lead_id: '0000123', consumer_id: '9007199254740993', valid_idno: '1', phone_valid: null, contacted: null, total_calls: null, sale: false, activated: false, revenue: '0.00', source: '=1+1' },
    { lead_id: '0000124', valid_idno: '2', phone_valid: 3, dialled: false, contacted: 'false', total_calls: 0, sale: true, activated: null, revenue: null },
  ];
  const copy = JSON.stringify(input);
  const rows = buildLeadLedgerDataRows(input);
  assert.equal(LEAD_LEDGER_COLUMNS.length, 17);
  assert.ok(rows.every(row => row.length === LEAD_LEDGER_COLUMNS.length));
  assert.deepEqual(rows[0], ['0000123', '9007199254740993', '', '=1+1', '', '', '', '', 'Valid (1)', 'Unavailable', 'Unavailable', 'Unavailable', 'Unavailable', '', 'FALSE', 'FALSE', '0.00']);
  assert.equal(rows[1][8], 'Invalid (2)');
  assert.equal(rows[1][9], 'Unavailable');
  assert.equal(rows[1][10], 'FALSE');
  assert.equal(rows[1][11], 'FALSE');
  assert.equal(rows[1][12], 0);
  assert.equal(rows[1][14], 'TRUE');
  assert.equal(rows[1][15], 'Unavailable');
  assert.equal(rows[1][16], '');
  assert.equal(JSON.stringify(input), copy);
});
