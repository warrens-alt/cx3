import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryCache } from '../server/cache';
import { stableKey } from '../contracts/stableKey';
import { responseCacheKey, cacheResponse } from '../server/cacheMiddleware';
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

test('cache expiry, capacity-one eviction and actual LRU ordering are bounded', context => {
  let now = 1000; context.mock.method(Date, 'now', () => now);
  const cache = new QueryCache(1); cache.set('one', 1, 1); cache.set('two', 2, 1);
  assert.equal(cache.get('one'), null); assert.equal(cache.get('two'), 2);
  now = 2000; assert.equal(cache.get('two'), null);
  const lru = new QueryCache(2); lru.set('a', 1); lru.set('b', 2); lru.get('a'); lru.set('c', 3);
  assert.equal(lru.get('b'), null); assert.equal(lru.get('a'), 1);
});
test('single-flight deduplicates and rejected work can be retried', async () => {
  const cache = new QueryCache(); const gate = deferred<number>(); let calls = 0;
  const work = () => { calls++; return gate.promise; };
  const a = cache.getOrFetch('same', work, 0); const b = cache.getOrFetch('same', work, 0);
  await Promise.resolve(); assert.equal(calls, 1); gate.resolve(7); assert.deepEqual(await Promise.all([a, b]), [7, 7]);
  assert.equal(cache.get('same'), null);
  await assert.rejects(cache.getOrFetch('bad', () => { throw new Error('sync failure'); }), /sync failure/);
  assert.equal(await cache.getOrFetch('bad', async () => 4), 4);
});
test('invalidated in-flight work cannot repopulate or delete a newer flight', async () => {
  const cache = new QueryCache(); const old = deferred<number>(); const newer = deferred<number>();
  const a = cache.getOrFetch('tenant:one', () => old.promise);
  cache.invalidateNamespace('tenant:');
  const b = cache.getOrFetch('tenant:one', () => newer.promise);
  old.resolve(1); await a; assert.equal(cache.get('tenant:one'), null);
  let duplicate = false;
  const c = cache.getOrFetch('tenant:one', async () => { duplicate = true; return 3; });
  newer.resolve(2); assert.deepEqual(await Promise.all([b, c]), [2, 2]); assert.equal(duplicate, false);
  cache.clear(); assert.equal(cache.get('tenant:one'), null);
});
test('canonical keys retain identity, permission, every filter and array order', () => {
  assert.equal(stableKey({ b: 2, a: 1 }), stableKey({ a: 1, b: 2 }));
  assert.notEqual(stableKey([1, 2]), stableKey([2, 1]));
  const req: any = { baseUrl: '/api/analytics', path: '/offernet/overview', query: { endDate: '2026-09-20', startDate: '2026-09-01' } };
  const res: any = { locals: { scope: { clientId: 'mtn', filters: {} }, principal: { subject: 'a', role: 'viewer', tenants: ['mtn'] } } };
  const key = responseCacheKey(req, res);
  req.query = { startDate: '2026-09-01', endDate: '2026-09-20' }; assert.equal(responseCacheKey(req, res), key);
  res.locals.principal.role = 'admin'; assert.notEqual(responseCacheKey(req, res), key);
  res.locals.principal.role = 'viewer'; req.query.unknownFilter = 'do not ignore'; assert.notEqual(responseCacheKey(req, res), key);
});
test('response middleware does not cache failed payloads', () => {
  const req: any = { method: 'GET', baseUrl: '/api/analytics', path: '/test-failure', query: {} };
  const headers = new Map();
  const res: any = { locals: { principal: { subject: 'error-test', role: 'viewer', tenants: ['mtn'] }, scope: { clientId: 'mtn' } }, statusCode: 200, setHeader: (key: string, value: string) => headers.set(key, value), json: (body: unknown) => body };
  let next = 0; cacheResponse()(req, res, () => { next++; }); res.json({ success: false });
  cacheResponse()(req, res, () => { next++; }); assert.equal(next, 2); assert.equal(headers.get('X-Cache'), 'MISS');
});
