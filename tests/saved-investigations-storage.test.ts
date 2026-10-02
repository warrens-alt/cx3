import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GcsSavedInvestigationBackend, configuredSavedInvestigationBackend } from '../server/savedAnalyses/gcs';
import { R2SavedInvestigationBackend, configuredR2SavedInvestigationBackend } from '../server/savedAnalyses/r2';
import {
  DurableSavedInvestigationRepository, MAX_SAVED_COLLECTION_BYTES, savedInvestigationObjectName,
  type SavedInvestigationCollection,
} from '../server/savedAnalyses/repository';
import type { CliR2Bucket, CliR2Object } from '../server/cliImports/r2';
import { savedDraft, TestSavedBackend } from './helpers/savedInvestigations';

const privateBucket = { iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' } };
const json = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
async function fixture(): Promise<SavedInvestigationCollection> {
  const backend = new TestSavedBackend();
  await new DurableSavedInvestigationRepository(backend).create('owner-a', 'tenant_a', savedDraft());
  return (await backend.read('owner-a', 'tenant_a')).collection!;
}
class TestR2 implements CliR2Bucket {
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

test('storage selection is explicit and never falls back to CLI, warehouse, another provider or memory', () => {
  assert.equal(configuredSavedInvestigationBackend({}), null);
  assert.equal(configuredSavedInvestigationBackend({ CX_CLI_IMPORT_BUCKET: 'existing', BIGQUERY_CREDENTIALS: '{}' }), null);
  assert.equal(configuredR2SavedInvestigationBackend({}), null);
  for (const env of [
    { CX_SAVED_ANALYSES_BUCKET: 'test-bucket' }, { CX_SAVED_ANALYSES_STORAGE_PROVIDER: 'gcs' },
    { CX_SAVED_ANALYSES_STORAGE_PROVIDER: 'r2', CX_SAVED_ANALYSES_BUCKET: 'test-bucket' },
    { CX_SAVED_ANALYSES_STORAGE_PROVIDER: 'gcs', CX_SAVED_ANALYSES_BUCKET: 'test-bucket', CX_SAVED_ANALYSES_CREDENTIALS: 'not-json' },
  ]) assert.throws(() => configuredSavedInvestigationBackend(env), { status: 503 });
  const bucket = new TestR2();
  for (const env of [
    { SAVED_ANALYSES: bucket }, { CX_SAVED_ANALYSES_STORAGE_PROVIDER: 'r2' },
    { CX_SAVED_ANALYSES_STORAGE_PROVIDER: 'r2', SAVED_ANALYSES: bucket },
    { CX_SAVED_ANALYSES_STORAGE_PROVIDER: 'gcs', SAVED_ANALYSES: bucket, CX_SAVED_ANALYSES_R2_PRIVATE_CONFIRMED: 'true' },
  ]) assert.throws(() => configuredR2SavedInvestigationBackend(env), { status: 503 });
  assert.ok(configuredR2SavedInvestigationBackend({ CX_SAVED_ANALYSES_STORAGE_PROVIDER: 'r2', SAVED_ANALYSES: bucket, CX_SAVED_ANALYSES_R2_PRIVATE_CONFIRMED: 'true' }));
  assert.equal(bucket.data.size, 0);
});

test('object names hash owner and tenant independently and reject invalid scope', () => {
  const name = savedInvestigationObjectName('private-owner', 'tenant_a');
  assert.match(name, /^saved-investigations\/v1\/[a-f0-9]{64}\/[a-f0-9]{64}\.json$/);
  assert.ok(!name.includes('private-owner')); assert.ok(!name.includes('tenant_a'));
  assert.notEqual(name, savedInvestigationObjectName('private-owner', 'tenant_b'));
  assert.notEqual(name, savedInvestigationObjectName('other-owner', 'tenant_a'));
  assert.throws(() => savedInvestigationObjectName('owner', '../tenant'));
  assert.throws(() => savedInvestigationObjectName('', 'tenant_a'));
});

test('GCS checks bucket privacy before accessing definitions; denied access is not an empty collection', async () => {
  let reads = 0;
  const privateFailure = new GcsSavedInvestigationBackend('test-bucket', async () => { reads++; return json({}); });
  await assert.rejects(privateFailure.read('owner-a', 'tenant_a'), { code: 'SAVED_STORAGE_NOT_PRIVATE' });
  assert.equal(reads, 1);
  for (const status of [401, 403, 500]) {
    const denied = new GcsSavedInvestigationBackend('test-bucket', async url => url.includes('fields=') ? json(privateBucket) : json({}, status));
    await assert.rejects(denied.read('owner-a', 'tenant_a'), { status: 503 });
  }
  const missing = new GcsSavedInvestigationBackend('test-bucket', async url => url.includes('fields=') ? json(privateBucket) : json({}, 404));
  assert.deepEqual(await missing.read('owner-a', 'tenant_a'), { collection: null, generation: '0' });
});

test('GCS validates owner/tenant collections and requires the stored object generation', async () => {
  const collection = await fixture();
  const noGeneration = new GcsSavedInvestigationBackend('test-bucket', async url => url.includes('fields=') ? json(privateBucket) : json(collection));
  await assert.rejects(noGeneration.read('owner-a', 'tenant_a'), { code: 'SAVED_STORAGE_GENERATION' });
  const backend = new GcsSavedInvestigationBackend('test-bucket', async url => url.includes('fields=') ? json(privateBucket) : json(collection, 200, { 'x-goog-generation': '42' }));
  assert.deepEqual(await backend.read('owner-a', 'tenant_a'), { collection, generation: '42' });
  await assert.rejects(backend.read('other-owner', 'tenant_a'), { code: 'SAVED_COLLECTION_INVALID' });
  await assert.rejects(backend.read('owner-a', 'tenant_b'), { code: 'SAVED_COLLECTION_INVALID' });
});

test('GCS multipart writes include private cache metadata and exact generation precondition; conflicts stay conditional', async () => {
  const collection = await fixture(); let writes = 0;
  const backend = new GcsSavedInvestigationBackend('test-bucket', async (url, init) => {
    if (url.includes('fields=')) return json(privateBucket);
    writes++;
    const params = new URL(url).searchParams;
    assert.equal(params.get('ifGenerationMatch'), '42'); assert.equal(params.get('uploadType'), 'multipart');
    assert.equal(params.get('name'), savedInvestigationObjectName('owner-a', 'tenant_a'));
    assert.equal(init?.method, 'POST');
    assert.match(String(init?.body), /"cacheControl":"private, no-store"/);
    assert.ok(String(init?.body).includes(JSON.stringify(collection)));
    return json({}, 412);
  });
  assert.equal(await backend.compareAndSwap('owner-a', 'tenant_a', '42', collection), false);
  await assert.rejects(backend.compareAndSwap('owner-a', 'tenant_a', 'not-safe', collection), { code: 'SAVED_STORAGE_GENERATION' });
  await assert.rejects(backend.compareAndSwap('other-owner', 'tenant_a', '42', collection), { code: 'SAVED_COLLECTION_INVALID' });
  assert.equal(writes, 1);
});

test('GCS bounds actual streamed bytes, including incorrect declared lengths and invalid UTF-8', async () => {
  for (const response of [
    () => new Response('{}', { headers: { 'content-length': String(MAX_SAVED_COLLECTION_BYTES + 1), 'x-goog-generation': '42' } }),
    () => new Response(new Uint8Array(MAX_SAVED_COLLECTION_BYTES + 1), { headers: { 'content-length': '1', 'x-goog-generation': '42' } }),
    () => new Response(new Uint8Array([0xc3, 0x28]), { headers: { 'x-goog-generation': '42' } }),
  ]) {
    const backend = new GcsSavedInvestigationBackend('test-bucket', async url => url.includes('fields=') ? json(privateBucket) : response());
    await assert.rejects(backend.read('owner-a', 'tenant_a'), { status: 503 });
  }
});

test('R2 persists across adapter instances, isolates scopes and keeps concurrent creates', async () => {
  const bucket = new TestR2();
  const first = new DurableSavedInvestigationRepository(new R2SavedInvestigationBackend(bucket));
  const second = new DurableSavedInvestigationRepository(new R2SavedInvestigationBackend(bucket));
  const [created] = await Promise.all([first.create('owner-a', 'tenant_a', savedDraft()), second.create('owner-a', 'tenant_a', savedDraft('tenant_a', 'Second'))]);
  assert.equal((await second.list('owner-a', 'tenant_a')).length, 2);
  assert.deepEqual(await first.list('owner-b', 'tenant_a'), []);
  assert.deepEqual(await first.list('owner-a', 'tenant_b'), []);
  assert.equal(bucket.conditions[0].get('If-None-Match'), '*');
  assert.ok(bucket.conditions.some(condition => condition.has('If-Match')));
  const fresh = new DurableSavedInvestigationRepository(new R2SavedInvestigationBackend(bucket));
  await fresh.remove('owner-a', 'tenant_a', created.id, 1);
  assert.equal((await first.list('owner-a', 'tenant_a')).length, 1);
});

test('R2 failures, invalid ETags and invalid acknowledgements cannot claim a save', async () => {
  const bucket = new TestR2(), backend = new R2SavedInvestigationBackend(bucket), collection = await fixture();
  const get = bucket.get.bind(bucket);
  bucket.get = async () => { throw new Error('sensitive credential details'); };
  await assert.rejects(backend.read('owner-a', 'tenant_a'), (error: any) => error.status === 503 && !error.message.includes('sensitive'));
  bucket.get = get;
  for (const etag of ['', 'bad"etag', 'bad etag']) {
    bucket.data.set(savedInvestigationObjectName('owner-a', 'tenant_a'), { text: JSON.stringify(collection), etag });
    await assert.rejects(backend.read('owner-a', 'tenant_a'), { code: 'SAVED_R2_ETAG' });
  }
  await assert.rejects(backend.compareAndSwap('owner-a', 'tenant_a', '42', collection), { code: 'SAVED_R2_ETAG' });
  assert.equal(bucket.conditions.length, 0);
  bucket.put = async () => undefined as any;
  await assert.rejects(backend.compareAndSwap('owner-a', 'tenant_a', '0', collection), { status: 503 });
});

test('R2 rejects foreign-owner data, oversized or truncated streams, invalid JSON and unsafe UTF-8', async () => {
  const collection = await fixture(), bucket = new TestR2(), backend = new R2SavedInvestigationBackend(bucket);
  bucket.data.set(savedInvestigationObjectName('other-owner', 'tenant_a'), { text: JSON.stringify(collection), etag: 'valid' });
  await assert.rejects(backend.read('other-owner', 'tenant_a'), { code: 'SAVED_COLLECTION_INVALID' });
  for (const object of [
    { size: MAX_SAVED_COLLECTION_BYTES + 1, etag: 'valid', body: new Response('{}').body! },
    { size: 1, etag: 'valid', body: new Response(new Uint8Array(MAX_SAVED_COLLECTION_BYTES + 1)).body! },
    { size: 100, etag: 'valid', body: new Response('{}').body! },
    { size: 2, etag: 'valid', body: new Response('no').body! },
    { size: 2, etag: 'valid', body: new Response(new Uint8Array([0xc3, 0x28])).body! },
  ]) {
    bucket.get = async () => object;
    await assert.rejects(backend.read('owner-a', 'tenant_a'), { status: 503 });
  }
});
