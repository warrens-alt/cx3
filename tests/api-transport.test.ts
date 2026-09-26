import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiRequestError, createApiTransport, type FetchLike } from '../src/lib/apiTransport';
const json = (data: unknown = { rows: 1 }) => new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

test('equivalent analytical requests share network work and independently readable bodies', async () => {
  let calls = 0;
  const gate = deferred<Response>();
  const fetcher = createApiTransport((async () => { calls++; return gate.promise; }) as FetchLike);
  const a = fetcher('/api/analytics/offernet/overview?clientId=mtn&startDate=2026-09-01');
  const b = fetcher('/api/analytics/offernet/overview?startDate=2026-09-01&clientId=mtn');
  await Promise.resolve(); assert.equal(calls, 1);
  gate.resolve(json());
  const [one, two] = await Promise.all([a, b]);
  assert.deepEqual(await one.json(), await two.json());
});
test('different identities and filters never share a flight; completed responses are not retained', async () => {
  let calls = 0;
  const fetcher = createApiTransport((async () => { calls++; return json(); }) as FetchLike);
  const url = '/api/analytics/offernet/overview?clientId=mtn';
  await Promise.all([fetcher(url, { headers: { Authorization: 'Bearer first' } }), fetcher(url, { headers: { Authorization: 'Bearer second' } }), fetcher(`${url}&vendor=other`, { headers: { Authorization: 'Bearer first' } })]);
  assert.equal(calls, 3);
  await fetcher(url, { headers: { Authorization: 'Bearer first' } });
  assert.equal(calls, 4);
});
test('one consumer leaving does not abort another consumer', async () => {
  const gate = deferred<Response>(); let upstream!: AbortSignal;
  const fetcher = createApiTransport((async (_input, init) => { upstream = init!.signal!; return gate.promise; }) as FetchLike);
  const first = new AbortController(); const second = new AbortController();
  const a = fetcher('/api/analytics/offernet/overview?clientId=mtn', { signal: first.signal });
  const b = fetcher('/api/analytics/offernet/overview?clientId=mtn', { signal: second.signal });
  const rejected = assert.rejects(a, error => error instanceof DOMException && error.name === 'AbortError');
  await Promise.resolve(); first.abort(); await rejected;
  assert.equal(upstream.aborted, false);
  gate.resolve(json({ value: 2 })); assert.equal((await (await b).json()).data.value, 2);
});
test('401 and invalid HTTP-200 responses preserve useful, typed failure state', async () => {
  const denied = createApiTransport((async () => new Response(JSON.stringify({ success: false, error: 'Sign in again' }), { status: 401, headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'request-1' } })) as FetchLike);
  await assert.rejects(denied('/api/analytics/clients'), error => error instanceof ApiRequestError && error.status === 401 && error.requestId === 'request-1');
  const html = createApiTransport((async () => new Response('<html>app shell</html>', { headers: { 'Content-Type': 'text/html' } })) as FetchLike);
  await assert.rejects(html('/api/analytics/clients'), error => error instanceof ApiRequestError && error.code === 'API_INVALID_RESPONSE');
  const failure = createApiTransport((async () => new Response(JSON.stringify({ success: false, error: 'Unavailable evidence' }), { headers: { 'Content-Type': 'application/json' } })) as FetchLike);
  await assert.rejects(failure('/api/analytics/clients'), /Unavailable evidence/);
});
test('mutations and CSV exports are not coalesced or parsed as dashboard JSON', async () => {
  let calls = 0;
  const fetcher = createApiTransport((async () => { calls++; return new Response('a,b\n1,2', { headers: { 'Content-Type': 'text/csv' } }); }) as FetchLike);
  const results = await Promise.all([fetcher('/api/analytics/export'), fetcher('/api/analytics/export'), fetcher('/api/analytics/import', { method: 'POST', body: 'one' }), fetcher('/api/analytics/import', { method: 'POST', body: 'two' })]);
  assert.equal(calls, 4); assert.equal(await results[0].text(), 'a,b\n1,2');
});
