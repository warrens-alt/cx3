import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { R2CliArchiveBackend, configuredR2CliArchive, type CliR2Bucket, type CliR2Object } from '../server/cliImports/r2';
import { importCliArchive, prepareCliImport, pauseCliArchive, cliTenantObjectName, MAX_CLI_ARCHIVE_BYTES } from '../server/cliImports/archive';

class MemoryR2 implements CliR2Bucket {
  data = new Map<string, { text: string; etag: string }>();
  conditions: Headers[] = [];
  async get(key: string): Promise<CliR2Object | null> {
    const value = this.data.get(key);
    return value ? { size: Buffer.byteLength(value.text), etag: value.etag, body: new Response(value.text).body! } : null;
  }
  async put(key: string, text: string, options: Parameters<CliR2Bucket['put']>[2]) {
    this.conditions.push(options.onlyIf);
    const old = this.data.get(key);
    if (options.onlyIf.get('If-None-Match') === '*' && old) return null;
    if (options.onlyIf.has('If-Match') && options.onlyIf.get('If-Match') !== (old ? `"${old.etag}"` : null)) return null;
    assert.equal(options.httpMetadata.cacheControl, 'private, no-store');
    const etag = createHash('md5').update(text).digest('hex');
    this.data.set(key, { text, etag });
    return { etag };
  }
}
const csv = (day: string, calls = 100) => `report_date,cli_number,campaign_code,total_calls,contact_count,sale_count\n${day},27100000001,TEST,${calls},20,3`;
const prepared = (day: string, calls = 100) => prepareCliImport(csv(day, calls), 'synthetic.csv');

test('R2 requires explicit provider, binding and private-bucket confirmation without storage access', () => {
  const bucket = new MemoryR2();
  for (const env of [{}, { CX_CLI_STORAGE_PROVIDER: 'r2' }, { CX_CLI_STORAGE_PROVIDER: 'r2', CLI_REPORTS: bucket }]) {
    assert.throws(() => configuredR2CliArchive(env), { status: 503 });
  }
  assert.ok(configuredR2CliArchive({ CX_CLI_STORAGE_PROVIDER: 'r2', CLI_REPORTS: bucket, CX_CLI_R2_PRIVATE_CONFIRMED: 'true' }));
  assert.equal(bucket.data.size, 0);
});
test('native R2 missing object is empty; thrown access failures are not empty and are redacted', async () => {
  const bucket = new MemoryR2();
  assert.deepEqual(await new R2CliArchiveBackend(bucket).read('tenant'), { archive: null, generation: '0' });
  bucket.get = async () => { throw new Error('sensitive upstream response'); };
  await assert.rejects(new R2CliArchiveBackend(bucket).read('tenant'), (error: any) => error.code === 'CLI_R2_UNAVAILABLE' && !error.message.includes('sensitive'));
});
test('initial and subsequent R2 writes use conditional headers, never unconditional writes', async () => {
  const bucket = new MemoryR2(), backend = new R2CliArchiveBackend(bucket);
  await importCliArchive(backend, 'tenant', prepared('2026-09-20'), 'test-admin');
  const first = await backend.read('tenant');
  assert.ok(first.generation.startsWith('r2:'));
  await importCliArchive(backend, 'tenant', prepared('2026-09-21'), 'test-admin');
  assert.equal(bucket.conditions[0].get('If-None-Match'), '*');
  assert.equal(bucket.conditions[1].get('If-Match'), `"${first.generation.slice(3)}"`);
  assert.equal((await backend.read('tenant')).archive!.rows.length, 2);
});
test('renamed reports are idempotent and conflicting reports leave the R2 object unchanged', async () => {
  const bucket = new MemoryR2(), backend = new R2CliArchiveBackend(bucket);
  await importCliArchive(backend, 'tenant', prepared('2026-09-20'), 'test-admin');
  const duplicate = await importCliArchive(backend, 'tenant', prepareCliImport(csv('2026-09-20'), 'renamed.csv'), 'test-admin');
  assert.equal(duplicate.insertedCount, 0);
  assert.equal(duplicate.duplicate, true);
  const before = await backend.read('tenant');
  await assert.rejects(importCliArchive(backend, 'tenant', prepared('2026-09-20', 200), 'test-admin'), { code: 'CLI_ROW_CONFLICT' });
  assert.deepEqual(await backend.read('tenant'), before);
});
test('two R2-backed instances retain both concurrent uploads', async () => {
  const bucket = new MemoryR2();
  await Promise.all([
    importCliArchive(new R2CliArchiveBackend(bucket), 'tenant', prepared('2026-09-20'), 'admin-1'),
    importCliArchive(new R2CliArchiveBackend(bucket), 'tenant', prepared('2026-09-21'), 'admin-2'),
  ]);
  assert.equal((await new R2CliArchiveBackend(bucket).read('tenant')).archive!.rows.length, 2);
  assert.ok(bucket.conditions.length >= 3);
});
test('tenant namespaces, pause/resume and fresh-instance persistence are preserved with R2', async () => {
  const bucket = new MemoryR2(), backend = new R2CliArchiveBackend(bucket);
  await importCliArchive(backend, 'tenant', prepared('2026-09-20'), 'test-admin');
  assert.equal((await backend.read('other')).archive, null);
  await pauseCliArchive(backend, 'tenant', 'test-admin');
  const fresh = new R2CliArchiveBackend(bucket);
  assert.equal((await fresh.read('tenant')).archive!.active, false);
  const resumed = await importCliArchive(fresh, 'tenant', prepared('2026-09-20'), 'test-admin');
  assert.equal(resumed.insertedCount, 0);
  assert.equal(resumed.archive.rows.length, 1);
  assert.equal(resumed.archive.active, true);
});
test('invalid R2 ETags, malformed data and oversized objects fail closed', async () => {
  const bucket = new MemoryR2();
  for (const value of [
    { text: '{}', etag: '' },
    { text: 'not json', etag: 'valid-etag' },
    { text: '{}', etag: 'valid-etag' },
  ]) {
    bucket.data.set(cliTenantObjectName('tenant'), value);
    await assert.rejects(new R2CliArchiveBackend(bucket).read('tenant'));
  }
  bucket.get = async () => ({ size: MAX_CLI_ARCHIVE_BYTES + 1, etag: 'valid', body: new Response('small').body! });
  await assert.rejects(new R2CliArchiveBackend(bucket).read('tenant'), { code: 'CLI_ARCHIVE_TOO_LARGE' });
});
test('R2 stream bounds are enforced even when the declared size is wrong', async () => {
  const bucket = new MemoryR2();
  bucket.get = async () => ({ size: 1, etag: 'valid', body: new Response(new Uint8Array(MAX_CLI_ARCHIVE_BYTES + 1)).body! });
  await assert.rejects(new R2CliArchiveBackend(bucket).read('tenant'), { code: 'CLI_ARCHIVE_TOO_LARGE' });
});
test('R2 rejects tenant traversal and invalid revisions before I/O, and validates write acknowledgements', async () => {
  const bucket = new MemoryR2(), backend = new R2CliArchiveBackend(bucket);
  await assert.rejects(backend.read('../other'), { code: 'INVALID_TENANT' });
  const { archive } = await importCliArchive(backend, 'tenant', prepared('2026-09-20'), 'test-admin');
  const writes = bucket.conditions.length;
  await assert.rejects(backend.compareAndSwap('tenant', '123', archive), { code: 'CLI_R2_ETAG' });
  assert.equal(bucket.conditions.length, writes);
  bucket.put = async () => undefined as any;
  await assert.rejects(backend.compareAndSwap('tenant', '0', archive), { code: 'CLI_R2_UNAVAILABLE' });
});
test('a foreign tenant snapshot and invalid UTF-8 cannot be hydrated', async () => {
  const bucket = new MemoryR2(), backend = new R2CliArchiveBackend(bucket);
  await importCliArchive(backend, 'tenant', prepared('2026-09-20'), 'test-admin');
  bucket.data.set(cliTenantObjectName('other'), bucket.data.get(cliTenantObjectName('tenant'))!);
  await assert.rejects(backend.read('other'), { code: 'CLI_ARCHIVE_INVALID' });
  bucket.get = async () => ({ size: 2, etag: 'valid', body: new Response(new Uint8Array([0xc3, 0x28])).body! });
  await assert.rejects(backend.read('tenant'), { code: 'CLI_ARCHIVE_INVALID' });
});
