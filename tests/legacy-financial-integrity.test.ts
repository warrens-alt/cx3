import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getBaseSemanticLayer, completeLegacyRevenueSumSql } from '../server/bigquery/views';
import { getClientConfig } from '../server/bigquery/config';

const sql = getBaseSemanticLayer(getClientConfig('default_tenant'));
const eligibility = sql.match(/SELECT \*, (.*?) AS revenue_eligible\s+FROM ranked_transactions/s)![1];
const contribution = sql.match(/(IF\(t\.revenue_eligible AND t\.transaction_rank = 1, t\.hlc_revenue_generated, NULL\)) AS revenue/)![1].replace(/^IF\(/, 'IIF(');
const aggregate = completeLegacyRevenueSumSql().replace(/COUNTIF\((.*?)\) > 0/, 'SUM(CASE WHEN $1 THEN 1 ELSE 0 END) > 0');

test('legacy revenue rejects incomplete keys and currency while collapsing identical duplicates without inventing row zeros', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE source (lead_id TEXT, hlc_vendor TEXT, hlc_transaction_id TEXT, revenue_value_variants INTEGER, hlc_revenue_generated NUMERIC, hlc_revenue_currency TEXT, transaction_rank INTEGER)');
    const insert = db.prepare('INSERT INTO source VALUES (?, ?, ?, ?, ?, ?, ?)');
    const base = ['L1', 'V1', 'T1', 1, 10, 'ZAR', 1] as const;
    const evaluate = (rows: unknown[][]) => {
      db.exec('DELETE FROM source');
      for (const row of rows) insert.run(...row as any[]);
      return db.prepare(`WITH t AS (SELECT *, ${eligibility} AS revenue_eligible FROM source), contributions AS (
        SELECT ${contribution} AS revenue, t.hlc_revenue_generated AS source_recorded_revenue,
          t.revenue_eligible AND t.transaction_rank > 1 AS revenue_duplicate_collapsed FROM t
        ) SELECT ${aggregate} AS total, COUNT(*) AS source_rows, SUM(source_recorded_revenue) AS raw_amounts,
        SUM(revenue IS NULL AND revenue_duplicate_collapsed) AS collapsed_null_rows FROM contributions`).get()!;
    };
    assert.equal(evaluate([[...base]]).total, 10);
    assert.equal(evaluate([[...base.slice(0, 4), 0, 'ZAR', 1]]).total, 0);
    for (const [index, value] of [[0, null], [1, null], [1, ' '], [2, null], [2, ''], [4, null], [5, null], [5, 'USD']] as const) {
      const row: unknown[] = [...base]; row[index] = value;
      // Source normalisation turns blank transaction keys into NULL before this projection.
      if (index === 2 && value === '') row[index] = null;
      assert.equal(evaluate([row]).total, null, `missing/mismatched field ${index}: ${value}`);
    }
    const duplicate = evaluate([[...base], [...base.slice(0, 6), 2]]);
    assert.equal(duplicate.total, 10);
    assert.equal(duplicate.source_rows, 2);
    assert.equal(duplicate.raw_amounts, 20, 'both recorded source amounts remain evidence');
    assert.equal(duplicate.collapsed_null_rows, 1, 'duplicate contribution is NULL, never a fabricated observed zero');
    const conflicting = evaluate([['L1', 'V1', 'T1', 2, 10, 'ZAR', 1], ['L1', 'V1', 'T1', 2, 11, 'ZAR', 2]]);
    assert.equal(conflicting.total, null);
    assert.equal(conflicting.collapsed_null_rows, 0, 'conflicting keys cannot be ignored as eligible duplicates');
    assert.equal(evaluate([[...base], ['L2', 'V1', 'T2', 1, null, 'ZAR', 1]]).total, null, 'partial amount does not become a complete total');
  } finally { db.close(); }
});

test('legacy financial SQL uses NUMERIC and recorded currencies with no expected-activation revenue substitution', () => {
  assert.match(sql, /COUNT\(DISTINCT TO_JSON_STRING\(STRUCT\(hlc_revenue_generated AS amount, hlc_revenue_currency AS currency\)\)\)/);
  assert.match(sql, /OVER \(PARTITION BY lead_id, hlc_vendor, hlc_transaction_id\) AS revenue_value_variants/);
  assert.match(sql, /t\.hlc_revenue_currency AS currency/);
  assert.match(sql, /source_recorded_revenue, NULL\)\) AS hlc_1_revenue_generated/);
  assert.match(sql, /SAFE_CAST\(hlc.revenue_generated AS NUMERIC\)/);
  assert.doesNotMatch(sql, /COALESCE\(a\.revenue, t\.hlc_revenue_generated/);
  assert.doesNotMatch(sql, /revenue_generated AS FLOAT64/);
  assert.match(sql, /COUNTIF\(revenue IS NULL AND revenue_duplicate_collapsed IS NOT TRUE\)/);
  assert.doesNotMatch(sql, /COALESCE\(v\.total_calls, t\.vendor_hlc_calls, 0\)/);
  assert.match(sql, /CASE WHEN SAFE_CAST\(hlc.total_calls AS INT64\) >= 0/);
});
