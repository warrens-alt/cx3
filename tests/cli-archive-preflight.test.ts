import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCliArchive, parseOptions, type CheckDependencies } from '../scripts/check-cli-archive';

function fake(overrides: Partial<CheckDependencies> = {}): CheckDependencies {
  return {
    readFile: async () => new TextEncoder().encode('synthetic fixture'),
    validate: async () => ({ status: 'VALIDATED', rowCount: 1, duplicateRows: 0,
      startDate: '2026-01-01', endDate: '2026-01-01', anomalyCount: 0 }),
    storage: async () => { throw new Error('Unexpected network operation'); },
    ...overrides,
  };
}
test('preflight help has no file, credential or network side effects', async () => {
  const die = async () => { throw new Error('Side effect'); };
  const result = await checkCliArchive(['--help'], { readFile: die, validate: die, storage: die });
  assert.equal(result.exitCode, 0);
  assert.match(result.help!, /NOT proof of write permissions/);
});
test('preflight rejects ambiguous arguments and never echoes secret flags', async () => {
  for (const args of [[], ['--file'], ['--storage'], ['--client', 'default_tenant'],
    ['--storage', '--client', '../escape'], ['--file', 'x', '--file', 'y'],
    ['--token', 'secret-value'], ['--help', '--storage']]) {
    const result = await checkCliArchive(args, fake());
    assert.equal(result.exitCode, 2);
    assert.equal(result.result?.error?.code, 'INVALID_ARGUMENTS');
    assert.ok(!JSON.stringify(result).includes('secret-value'));
  }
});
test('preflight file-only validation does not contact storage or expose CSV values', async () => {
  const result = await checkCliArchive(['--file', '/private/report.csv'], fake());
  assert.equal(result.exitCode, 0);
  assert.equal(result.result?.file?.rowCount, 1);
  assert.equal(result.result?.liveImport, 'NOT_PERFORMED');
  assert.ok(!JSON.stringify(result).includes('/private/'));
  assert.ok(!JSON.stringify(result).includes('synthetic fixture'));
});
test('preflight enforces byte limits before validation', async () => {
  const result = await checkCliArchive(['--file', 'large.csv'], fake({
    readFile: async () => new Uint8Array(48 * 1024 + 1),
    validate: async () => { throw new Error('Should not parse'); },
  }));
  assert.equal(result.result?.error?.code, 'CLI_UPLOAD_TOO_LARGE');
});
test('preflight rejects invalid UTF-8 rather than replacing bytes', async () => {
  const result = await checkCliArchive(['--file', 'bad.csv'], fake({ readFile: async () => new Uint8Array([255]) }));
  assert.equal(result.result?.error?.code, 'INVALID_UTF8');
});
test('preflight redacts OS errors and unexpected validation payloads', async () => {
  const secret = 'PRIVATE_KEY_AND_REPORT_CONTENT';
  for (const overrides of [{ readFile: async () => { throw new Error(secret); } },
    { validate: async () => { throw new Error(secret); } }]) {
    const result = await checkCliArchive(['--file', 'x.csv'], fake(overrides));
    assert.equal(result.exitCode, 2);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
});
test('preflight preserves completed file validation when storage is unconfigured', async () => {
  const result = await checkCliArchive(['--file', 'x.csv', '--storage', '--client', 'default_tenant'], fake({
    storage: async client => { assert.equal(client, 'default_tenant'); return { status: 'NOT_CONFIGURED', writeAccess: 'NOT_TESTED' }; },
  }));
  assert.equal(result.exitCode, 2);
  assert.equal(result.result?.file?.status, 'VALIDATED');
  assert.equal(result.result?.storage?.status, 'NOT_CONFIGURED');
});
test('preflight distinguishes readable empty storage from a proved import', async () => {
  const result = await checkCliArchive(['--storage', '--client', 'default_tenant'], fake({
    storage: async () => ({ status: 'READ_CHECK_PASSED', archivePresent: false, active: false,
      rowCount: 0, importCount: 0, writeAccess: 'NOT_TESTED' }),
  }));
  assert.equal(result.exitCode, 0);
  assert.equal(result.result?.storage?.writeAccess, 'NOT_TESTED');
  assert.equal(result.result?.liveImport, 'NOT_PERFORMED');
  assert.equal(result.result?.deployment, 'NOT_VERIFIED');
});
test('preflight retains safe storage diagnostic codes without leaking upstream messages', async () => {
  const result = await checkCliArchive(['--storage', '--client', 'default_tenant'], fake({
    storage: async () => { throw Object.assign(new Error('secret bucket and token'), { code: 'CLI_STORAGE_ACCESS' }); },
  }));
  assert.equal(result.exitCode, 2);
  assert.equal(result.result?.error?.code, 'CLI_STORAGE_ACCESS');
  assert.ok(!JSON.stringify(result).includes('secret bucket'));
});
test('preflight stops before storage when CSV validation fails', async () => {
  const result = await checkCliArchive(['--file', 'x.csv', '--storage', '--client', 'default_tenant'], fake({
    validate: async () => { throw Object.assign(new Error('invalid'), { code: 'INVALID_CLI_CSV' }); },
  }));
  assert.equal(result.result?.error?.code, 'INVALID_CLI_CSV');
});
test('preflight parses a combined bounded check without an implicit client', () => {
  assert.deepEqual(parseOptions(['--file', 'x.csv', '--storage', '--client', 'blc']),
    { help: false, storage: true, file: 'x.csv', client: 'blc' });
});

test('preflight default path validates a synthetic CSV with the production validators', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'cx-cli-preflight-'));
  try {
    const path = join(dir, 'report.csv');
    await writeFile(path, 'report_date,cli_number,campaign_code,total_calls,contact_count,sale_count\n2026-01-01,27000000000,SYNTHETIC,10,2,1\n');
    const result = await checkCliArchive(['--file', path]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.result?.file?.rowCount, 1);
    assert.equal(result.result?.file?.startDate, '2026-01-01');
    assert.ok(!JSON.stringify(result).includes('27000000000'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('preflight default path rejects customer-level columns without using storage', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'cx-cli-preflight-'));
  try {
    const path = join(dir, 'report.csv');
    await writeFile(path, 'report_date,cli_number,campaign_code,total_calls,contact_count,sale_count,email\n2026-01-01,27000000000,SYNTHETIC,10,2,1,nobody@example.invalid\n');
    const result = await checkCliArchive(['--file', path]);
    assert.equal(result.exitCode, 2);
    assert.equal(result.result?.error?.code, 'INVALID_CLI_CSV');
    assert.ok(!JSON.stringify(result).includes('nobody@example.invalid'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
