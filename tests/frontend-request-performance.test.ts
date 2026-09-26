import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { buildQueryString, CACHE_TTL_MS, fetchOffernetJson, inFlightRequests, invalidateOffernetCache, memoryCache } from '../src/lib/offernet/cache';
import { fetchOverview, fetchOperatingControls } from '../src/lib/offernet/client';
import { operationalQueryOptions, operationalQueryView } from '../src/lib/operationalQueries';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) }) as Response;

test('equivalent scopes share one pending fetch even when both consumers request a refresh', async context => {
  invalidateOffernetCache();
  const pending = deferred<Response>();
  const calls: string[] = [];
  context.mock.method(globalThis, 'fetch', async (url: any) => { calls.push(String(url)); return pending.promise; });
  const first = fetchOverview({ clientId: 'one', startDate: '2026-09-01' }, true);
  const second = fetchOverview({ startDate: '2026-09-01', clientId: 'one' }, true);
  await settle();
  assert.equal(calls.length, 1);
  pending.resolve(response({ identity: 'same' }));
  assert.deepEqual(await first, { identity: 'same' });
  assert.deepEqual(await second, { identity: 'same' });
  assert.equal(inFlightRequests.size, 0);
  assert.equal(memoryCache.size, 1);
  assert.equal(buildQueryString({ z: 0, a: false, b: '', c: undefined }), '?a=false&z=0');
  invalidateOffernetCache();
});

test('invalidation fences older completions and cannot clear a newer in-flight request', async context => {
  invalidateOffernetCache();
  const firstResponse = deferred<Response>(), secondResponse = deferred<Response>();
  const requests: AbortSignal[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: any, init?: RequestInit) => {
    requests.push(init!.signal!);
    // Deliberately ignore abort to reproduce a transport/body completion racing invalidation.
    return requests.length === 1 ? firstResponse.promise : secondResponse.promise;
  });
  const old = fetchOffernetJson('/report', true);
  const rejected = assert.rejects(old, { name: 'AbortError' });
  await settle();
  invalidateOffernetCache();
  assert.equal(requests[0].aborted, true);
  const current = fetchOffernetJson('/report', true);
  await settle();
  firstResponse.resolve(response({ revision: 'old' }));
  await rejected;
  assert.equal(memoryCache.has('/report'), false);
  assert.equal(inFlightRequests.size, 1, 'Old cleanup must not delete the replacement');
  const joined = fetchOffernetJson('/report', true);
  await settle();
  assert.equal(requests.length, 2, 'A third consumer joins the replacement instead of fetching again');
  secondResponse.resolve(response({ revision: 'current' }));
  assert.deepEqual(await current, { revision: 'current' });
  assert.deepEqual(await joined, { revision: 'current' });
  assert.deepEqual(memoryCache.get('/report')?.data, { revision: 'current' });
  invalidateOffernetCache();
});

test('one cancelled observer does not abort another consumer, and the last departure stops the fetch', async context => {
  invalidateOffernetCache();
  const pending = deferred<Response>();
  let transportSignal!: AbortSignal;
  context.mock.method(globalThis, 'fetch', async (_url: any, init?: RequestInit) => {
    transportSignal = init!.signal!;
    return pending.promise;
  });
  const a = new AbortController(), b = new AbortController();
  const first = fetchOffernetJson('/shared', true, a.signal);
  const firstCancelled = assert.rejects(first, { name: 'AbortError' });
  const second = fetchOffernetJson('/shared', true, b.signal);
  const secondCancelled = assert.rejects(second, { name: 'AbortError' });
  await settle();
  a.abort();
  await firstCancelled;
  assert.equal(transportSignal.aborted, false);
  b.abort();
  await secondCancelled;
  assert.equal(transportSignal.aborted, true);
  assert.equal(inFlightRequests.size, 0);
  pending.resolve(response({ late: true }));
  await settle();
  assert.equal(memoryCache.has('/shared'), false);
});

test('an obsolete query scope cancels the actual endpoint fetch and a current scope stays independent', async context => {
  invalidateOffernetCache();
  const pending = new Map<string, ReturnType<typeof deferred<Response>>>();
  const signals = new Map<string, AbortSignal>();
  context.mock.method(globalThis, 'fetch', async (url: any, init?: RequestInit) => {
    const client = new URL(String(url), 'https://test.invalid').searchParams.get('clientId')!;
    const wait = deferred<Response>();
    pending.set(client, wait);
    signals.set(client, init!.signal!);
    return wait.promise;
  });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const options = (clientId: string) => operationalQueryOptions('overview', { clientId }, fetchOverview);
  const observer = new QueryObserver(client, options('old'));
  const unsubscribe = observer.subscribe(() => {});
  try {
    await settle();
    observer.setOptions(options('current'));
    await settle();
    assert.equal(signals.get('old')!.aborted, true);
    assert.equal(signals.get('current')!.aborted, false);
    assert.equal(operationalQueryView(observer.getCurrentResult()).data, null);
    pending.get('current')!.resolve(response({ current: true }));
    await settle();
    assert.deepEqual(observer.getCurrentResult().data, { current: true });
    pending.get('old')!.resolve(response({ current: false }));
    await settle();
    assert.deepEqual(observer.getCurrentResult().data, { current: true });
  } finally { unsubscribe(); client.clear(); invalidateOffernetCache(); }
});

test('refresh requests bypass resolved values, preserve HTTP status and can retry after failure', async context => {
  invalidateOffernetCache();
  let attempts = 0;
  context.mock.method(globalThis, 'fetch', async () => {
    attempts++;
    if (attempts === 2) return { ok: false, status: 403, json: async () => ({ error: 'Scope denied' }) } as Response;
    return response({ attempt: attempts });
  });
  assert.deepEqual(await fetchOperatingControls({ clientId: 'one' }), { attempt: 1 });
  assert.deepEqual(await fetchOperatingControls({ clientId: 'one' }), { attempt: 1 });
  await assert.rejects(fetchOperatingControls({ clientId: 'one' }, true), { message: 'Scope denied', status: 403 });
  assert.equal(inFlightRequests.size, 0);
  assert.equal(memoryCache.size, 0, 'A rejected refresh must not leave old resolved data available to other consumers');
  assert.deepEqual(await fetchOperatingControls({ clientId: 'one' }, true), { attempt: 3 });
  assert.equal(attempts, 3);
  invalidateOffernetCache();
});

test('expired cache values refetch and loading state distinguishes initial load from refresh without hiding errors', async context => {
  invalidateOffernetCache();
  memoryCache.set('/expired', { data: 'old', timestamp: Date.now() - CACHE_TTL_MS });
  context.mock.method(globalThis, 'fetch', async () => response('current'));
  assert.equal(await fetchOffernetJson('/expired'), 'current');
  assert.deepEqual(operationalQueryView({ data: undefined, isFetching: true, error: null }), {
    data: null, loading: true, initialLoading: true, refreshing: false, error: null,
  });
  assert.deepEqual(operationalQueryView({ data: 123, isFetching: true, error: null }), {
    data: 123, loading: true, initialLoading: false, refreshing: true, error: null,
  });
  assert.equal(operationalQueryView({ data: 123, isFetching: false, error: new Error('Scope denied') }).data, null);
  invalidateOffernetCache();
});

test('refresh during an initial view load shares the healthy requests, then later refresh bypasses resolved cache', async context => {
  invalidateOffernetCache();
  const transports: Array<{ signal: AbortSignal; reply: ReturnType<typeof deferred<Response>> }> = [];
  context.mock.method(globalThis, 'fetch', async (_url: any, init?: RequestInit) => {
    const reply = deferred<Response>();
    const signal = init!.signal!;
    signal.addEventListener('abort', () => reply.reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    transports.push({ signal, reply });
    return reply.promise;
  });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const overview = new QueryObserver(client, operationalQueryOptions('overview', { clientId: 'one' }, fetchOverview));
  const controls = new QueryObserver(client, operationalQueryOptions('operating-controls', { clientId: 'one' }, fetchOperatingControls));
  const unsubscribeOverview = overview.subscribe(() => {});
  const unsubscribeControls = controls.subscribe(() => {});
  // Matches the page's onRefresh callback: each query owns its freshness and cancellation.
  const onRefresh = async () => { await Promise.all([overview.refetch(), controls.refetch()]); };
  try {
    await settle();
    assert.equal(transports.length, 2);
    assert.equal(overview.getCurrentResult().data, undefined);
    assert.equal(controls.getCurrentResult().data, undefined);
    const initialRefresh = Promise.resolve().then(onRefresh);
    await settle();
    assert.equal(transports.length, 2, 'Initial refresh reuses the pending request for each endpoint');
    assert.ok(transports.every(transport => !transport.signal.aborted), 'Refresh must not invalidate and abort pending transports');
    transports[0].reply.resolve(response({ fetchedLeads: 7 }));
    transports[1].reply.resolve(response({ deliveredLeads: 6 }));
    await initialRefresh;
    assert.equal(overview.getCurrentResult().status, 'success');
    assert.equal(controls.getCurrentResult().status, 'success');
    assert.deepEqual(overview.getCurrentResult().data, { fetchedLeads: 7 });
    assert.deepEqual(controls.getCurrentResult().data, { deliveredLeads: 6 });

    const subsequentRefresh = onRefresh();
    await settle();
    assert.equal(transports.length, 4, 'After resolution both query functions bypass the fresh secondary cache');
    transports[2].reply.resolve(response({ fetchedLeads: 9 }));
    transports[3].reply.resolve(response({ deliveredLeads: 8 }));
    await subsequentRefresh;
    assert.deepEqual(overview.getCurrentResult().data, { fetchedLeads: 9 });
    assert.deepEqual(controls.getCurrentResult().data, { deliveredLeads: 8 });
  } finally {
    unsubscribeOverview(); unsubscribeControls(); client.clear(); invalidateOffernetCache();
  }
});
