import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseSourceCheckArgs, runSourceCheck } from '../scripts/check-source-api';
import { safeSourceError, type SourceAccess } from '../server/bigquery/sourceAccess';

const dates = ['--start', '2026-09-01', '--end', '2026-09-26'];

test('source-check CLI starts and displays help without constructing a warehouse client', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-source-api.ts', '--help'], {
    encoding: 'utf8', env: { ...process.env, BIGQUERY_CREDENTIALS: 'invalid-synthetic-credentials' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Read-only, date-bound source checks/);
  assert.doesNotMatch(result.stdout + result.stderr, /invalid-synthetic-credentials|SyntaxError|does not provide an export/);
});

test('source-check CLI rejects malformed arguments and excessive scope before warehouse access', () => {
  for (const args of [[], ['--start'], [...dates, '--tenant'], [...dates, '--out'],
    [...dates, '--unknown', 'x'], [...dates, '--start', '2026-09-01'],
    ['--start', '2026-02-30', '--end', '2026-09-26'],
    ['--start', '2026-09-26', '--end', '2026-09-01'],
    ['--start', '2025-01-01', '--end', '2026-09-26'], [...dates, '--tenant', 'unknown-tenant']]) {
    assert.throws(() => parseSourceCheckArgs(args));
  }
  assert.equal(parseSourceCheckArgs([...dates, '--tenant', 'blc'])?.scope.clientId, 'ontact_blc');
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-source-api.ts', '--start'], {
    encoding: 'utf8', env: { ...process.env, BIGQUERY_CREDENTIALS: 'invalid-synthetic-credentials' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing value for --start/);
  assert.doesNotMatch(result.stderr, /credentials|export|SyntaxError/);
});

test('source diagnostics classify warehouse failures without leaking error payloads', () => {
  const secret = 'synthetic-token-that-must-not-leak';
  for (const [code, status] of [[403, 'ACCESS_DENIED'], [404, 'NOT_FOUND'], [401, 'AUTHENTICATION_REQUIRED'],
    [429, 'RATE_LIMITED'], [422, 'INVALID_REQUEST'], ['ENOTFOUND', 'UNAVAILABLE']] as const) {
    const result = safeSourceError(Object.assign(new Error(`Authorization: Bearer ${secret}`), {
      code, request: { headers: { authorization: secret } }, sql: `SELECT '${secret}'`,
    }));
    assert.equal(result.status, status);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-token|Authorization|SELECT/);
  }
});

test('offline source checks produce incomplete redacted evidence rather than throwing or inventing zero rows', async () => {
  const failure = Object.assign(new Error('Network unavailable; synthetic-secret-in-error'), { code: 'ENOTFOUND' });
  let queries = 0;
  const access: SourceAccess = {
    listTables: async () => { throw failure; },
    metadata: async () => { throw failure; },
    execute: async () => { queries++; throw failure; },
  };
  const result = await runSourceCheck(parseSourceCheckArgs(dates)!, access);
  assert.equal(result.sourceDataReconciled, false);
  assert.equal(result.catalogue.inventoryComplete, false);
  assert.equal(result.checks.length, 5);
  assert.ok(result.checks.every(check => check.status === 'UNAVAILABLE'));
  assert.ok(result.catalogue.sources.every(source => source.rowCount === null));
  assert.equal(queries, 0);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-secret-in-error/);
});

test('credential initialization failure is readable and redacted without contacting the warehouse', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-source-api.ts', ...dates], {
    encoding: 'utf8', env: { ...process.env, BIGQUERY_CREDENTIALS: 'invalid-synthetic-credentials' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Warehouse source unavailable/);
  assert.doesNotMatch(result.stdout + result.stderr, /invalid-synthetic-credentials|SyntaxError/);
});
