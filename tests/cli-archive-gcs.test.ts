import test from 'node:test';
import assert from 'node:assert/strict';
import { GcsCliArchiveBackend } from '../server/cliImports/gcs';
import { prepareCliImport, importCliArchive, MAX_CLI_ARCHIVE_BYTES, type CliArchiveBackend, type CliArchive } from '../server/cliImports/archive';
const privateBucket = { iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' } };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
async function fixture(): Promise<CliArchive> {
  let saved: CliArchive | null = null;
  const backend: CliArchiveBackend = { read: async () => ({ archive: saved, generation: '0' }), compareAndSwap: async (_t, _g, a) => { saved = a; return true; } };
  return (await importCliArchive(backend, 'tenant_a', prepareCliImport('report_date,cli_number,campaign_code,total_calls,contact_count,sale_count\n2026-09-22,27000000001,TEST,100,10,2', 'synthetic.csv'), 'test-user')).archive;
}
test('GCS backend checks privacy before reading object data', async () => {
  let calls = 0;
  const backend = new GcsCliArchiveBackend('synthetic-private-bucket', async () => { calls++; return json({ iamConfiguration: {} }); });
  await assert.rejects(backend.read('tenant_a'), { code: 'CLI_STORAGE_NOT_PRIVATE' });
  assert.equal(calls, 1);
});
test('403 is an access failure, not an empty archive', async () => {
  const backend = new GcsCliArchiveBackend('synthetic-private-bucket', async url => url.includes('fields=') ? json(privateBucket) : json({}, 403));
  await assert.rejects(backend.read('tenant_a'), { code: 'CLI_STORAGE_ACCESS' });
});
test('404 means no archive only after bucket access and privacy were checked', async () => {
  const backend = new GcsCliArchiveBackend('synthetic-private-bucket', async url => url.includes('fields=') ? json(privateBucket) : json({}, 404));
  assert.deepEqual(await backend.read('tenant_a'), { archive: null, generation: '0' });
});
test('generation header is required for safe read-modify-write', async () => {
  const archive = await fixture();
  const backend = new GcsCliArchiveBackend('synthetic-private-bucket', async url => url.includes('fields=') ? json(privateBucket) : json(archive));
  await assert.rejects(backend.read('tenant_a'), { code: 'CLI_STORAGE_GENERATION' });
});
test('valid private archive loads with its generation', async () => {
  const archive = await fixture();
  const backend = new GcsCliArchiveBackend('synthetic-private-bucket', async url => url.includes('fields=') ? json(privateBucket) : json(archive, 200, { 'x-goog-generation': '42' }));
  const result = await backend.read('tenant_a');
  assert.equal(result.generation, '42'); assert.equal(result.archive!.rows.length, 1);
});
test('writes carry an exact generation precondition and 412 becomes a retryable conflict', async () => {
  const archive = await fixture();
  let sawWrite = false;
  const backend = new GcsCliArchiveBackend('synthetic-private-bucket', async (url, init) => {
    if (url.includes('fields=')) return json(privateBucket);
    sawWrite = true;
    assert.equal(new URL(url).searchParams.get('ifGenerationMatch'), '42');
    assert.equal(init?.method, 'POST');
    assert.equal(JSON.parse(init!.body as string).tenantId, 'tenant_a');
    return json({}, 412);
  });
  assert.equal(await backend.compareAndSwap('tenant_a', '42', archive), false);
  assert.equal(sawWrite, true);
});
test('oversized storage bodies are refused before JSON parsing', async () => {
  const backend = new GcsCliArchiveBackend('synthetic-private-bucket', async url => url.includes('fields=') ? json(privateBucket)
    : json({}, 200, { 'x-goog-generation': '42', 'content-length': String(MAX_CLI_ARCHIVE_BYTES + 1) }));
  await assert.rejects(backend.read('tenant_a'), { code: 'CLI_ARCHIVE_TOO_LARGE' });
});
