import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareCliImport, importCliArchive, pauseCliArchive, cliArchiveStatus, cliTenantObjectName,
  cliRowsToCsv, validateCliArchive, MAX_CLI_UPLOAD_BYTES, type CliArchive, type CliArchiveBackend,
} from '../server/cliImports/archive';

class MemoryBackend implements CliArchiveBackend {
  states = new Map<string, { archive: CliArchive; generation: string }>();
  writes = 0;
  conflicts = 0;
  async read(tenant: string) {
    const item = this.states.get(tenant);
    return item ? structuredClone(item) : { archive: null, generation: '0' };
  }
  async compareAndSwap(tenant: string, generation: string, archive: CliArchive) {
    if (this.conflicts > 0) { this.conflicts--; return false; }
    if ((this.states.get(tenant)?.generation || '0') !== generation) return false;
    this.states.set(tenant, { archive: structuredClone(archive), generation: String(Number(generation) + 1) });
    this.writes++; return true;
  }
}
const headers = 'report_date,cli_number,campaign_code,total_calls,contact_count,sale_count';
const row = (date = '2026-09-22', calls = '100') => `${date},27000000001,TEST,${calls},10,2`;
const prepare = (data = row(), name = 'test.csv') => prepareCliImport(`${headers}\n${data}`, name);
const actor = 'synthetic-test-user';

test('successive daily uploads preserve previous dates and history', async () => {
  const store = new MemoryBackend();
  await importCliArchive(store, 'tenant_a', prepare(), actor);
  const next = await importCliArchive(store, 'tenant_a', prepare(row('2026-09-23')), actor);
  assert.equal(next.archive.rows.length, 2);
  assert.equal(next.archive.imports.length, 2);
  assert.deepEqual(cliArchiveStatus(next.archive).dates, ['2026-09-22', '2026-09-23']);
});
test('identical, renamed and reordered reports are idempotent', async () => {
  const store = new MemoryBackend();
  await importCliArchive(store, 'tenant_a', prepare(`${row()}\n${row('2026-09-23')}`), actor);
  const result = await importCliArchive(store, 'tenant_a', prepare(`${row('2026-09-23')}\r\n${row()}`, 'renamed.csv'), actor);
  assert.equal(result.duplicate, true);
  assert.equal(result.insertedCount, 0);
  assert.equal(result.duplicateCount, 2);
  assert.equal(store.writes, 1);
});
test('overlapping equal rows are skipped while new dates are appended', async () => {
  const store = new MemoryBackend();
  await importCliArchive(store, 'tenant_a', prepare(), actor);
  const result = await importCliArchive(store, 'tenant_a', prepare(`${row()}\n${row('2026-09-23')}`), actor);
  assert.equal(result.insertedCount, 1);
  assert.equal(result.duplicateCount, 1);
});
test('changed rows cause a whole-import conflict, not a silent overwrite or partial write', async () => {
  const store = new MemoryBackend();
  await importCliArchive(store, 'tenant_a', prepare(), actor);
  await assert.rejects(importCliArchive(store, 'tenant_a', prepare(`${row('2026-09-23')}\n${row('2026-09-22', '101')}`), actor), { code: 'CLI_ROW_CONFLICT' });
  assert.equal(store.writes, 1);
  assert.equal((await store.read('tenant_a')).archive!.rows.length, 1);
});
test('same upload in different tenants is stored independently', async () => {
  const store = new MemoryBackend();
  await importCliArchive(store, 'tenant_a', prepare(), actor);
  await importCliArchive(store, 'tenant_b', prepare(), actor);
  assert.notEqual(cliTenantObjectName('tenant_a'), cliTenantObjectName('tenant_b'));
  assert.equal(store.states.size, 2);
});
test('concurrent instances append without lost updates', async () => {
  const store = new MemoryBackend();
  await Promise.all([
    importCliArchive(store, 'tenant_a', prepare(), actor),
    importCliArchive(store, 'tenant_a', prepare(row('2026-09-23')), actor),
  ]);
  assert.equal((await store.read('tenant_a')).archive!.rows.length, 2);
});
test('concurrent duplicate uploads count once', async () => {
  const store = new MemoryBackend();
  await Promise.all([importCliArchive(store, 'tenant_a', prepare(), actor), importCliArchive(store, 'tenant_a', prepare(), actor)]);
  assert.equal(store.writes, 1);
});
test('generation retries are bounded', async () => {
  const store = new MemoryBackend(); store.conflicts = 6;
  await assert.rejects(importCliArchive(store, 'tenant_a', prepare(), actor), { code: 'CLI_ARCHIVE_BUSY' });
  assert.equal(store.conflicts, 1);
  assert.equal(store.writes, 0);
});
test('pause preserves history and re-upload reactivates without duplicating rows', async () => {
  const store = new MemoryBackend();
  await importCliArchive(store, 'tenant_a', prepare(), actor);
  await pauseCliArchive(store, 'tenant_a', actor);
  assert.equal((await store.read('tenant_a')).archive!.active, false);
  const restored = await importCliArchive(store, 'tenant_a', prepare(), actor);
  assert.equal(restored.archive.active, true);
  assert.equal(restored.archive.imports.length, 1);
  assert.equal(restored.insertedCount, 0);
});
test('customer-level headers and a substituted phone_number are rejected', () => {
  assert.throws(() => prepareCliImport(`${headers},email\n${row()},person@example.invalid`, 'test.csv'), { code: 'INVALID_CLI_CSV' });
  assert.throws(() => prepareCliImport(`${headers.replace('cli_number', 'phone_number')}\n${row()}`, 'test.csv'), { code: 'INVALID_CLI_CSV' });
});
test('strict CSV validation rejects malformed rows, duplicate headers and invalid dates', () => {
  for (const csv of [`${headers}\n${row()},extra`, `${headers},total_calls\n${row()},100`, `${headers}\n${row('2026-02-30')}`, `${headers}\n${row().replace('TEST', '"broken')}`]) {
    assert.throws(() => prepareCliImport(csv, 'test.csv'), { code: 'INVALID_CLI_CSV' });
  }
});
test('quoted campaign commas and BOM are preserved; canonical roundtrip is stable', () => {
  const prepared = prepareCliImport(`\uFEFF${headers}\r\n${row().replace('TEST', '"TEST, DEMO"')}`, '../safe.csv');
  assert.equal(prepared.filename, 'safe.csv');
  assert.equal(prepared.rows[0].values[2], 'TEST, DEMO');
  assert.equal(prepareCliImport(cliRowsToCsv(prepared.rows), 'other.csv').id, prepared.id);
});
test('duplicate rows within a file are collapsed and conflicting duplicates rejected', () => {
  assert.equal(prepare(`${row()}\n${row()}`).duplicateCount, 1);
  assert.throws(() => prepare(`${row()}\n${row('2026-09-22', '101')}`), { code: 'CLI_ROW_CONFLICT' });
});
test('vendor-split and unsplit rows cannot be combined for the same reporting population', async () => {
  const store = new MemoryBackend();
  await importCliArchive(store, 'tenant_a', prepare(), actor);
  const split = prepareCliImport(`${headers},vendor\n${row()},SYNTHETIC_VENDOR`, 'split.csv');
  await assert.rejects(importCliArchive(store, 'tenant_a', split, actor), { code: 'CLI_ROW_CONFLICT' });
});
test('oversized files fail before storage and tenant paths cannot be injected', () => {
  assert.throws(() => prepareCliImport('x'.repeat(MAX_CLI_UPLOAD_BYTES + 1), 'test.csv'), { code: 'CLI_UPLOAD_TOO_LARGE' });
  assert.throws(() => cliTenantObjectName('../other'), { code: 'INVALID_TENANT' });
});
test('archive tenant mismatch and key corruption fail closed', async () => {
  const store = new MemoryBackend();
  const { archive } = await importCliArchive(store, 'tenant_a', prepare(), actor);
  assert.throws(() => validateCliArchive(archive, 'tenant_b'), { code: 'CLI_ARCHIVE_INVALID' });
  const corrupt = structuredClone(archive); corrupt.rows[0].key = 'wrong';
  assert.throws(() => validateCliArchive(corrupt, 'tenant_a'), { code: 'CLI_ARCHIVE_INVALID' });
});
test('source percentages are not rescaled and legitimate non-nested sale counts are not clamped', () => {
  const prepared = prepareCliImport(`${headers},sale_pct\n2026-09-22,27000000001,TEST,100,2,4,2.000`, 'anomaly.csv');
  assert.equal(prepared.rows[0].values[10], '4');
  assert.equal(prepared.rows[0].values[11], '2.000');
});
