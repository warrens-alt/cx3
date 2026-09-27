import test from 'node:test';
import assert from 'node:assert/strict';
import { routeCloudflareRequest } from '../server/cloudflare/routing';

test('API requests, including errors, cannot fall through to the SPA or bucket objects', async () => {
  let assetReads = 0;
  const assets = { fetch: async () => { assetReads++; return new Response('SPA'); } };
  for (const path of ['/api', '/api/health', '/API/analytics/cli-performance', '/%61pi/health']) {
    const response = await routeCloudflareRequest(new Request(`https://test.invalid${path}`), async () => new Response('denied', { status: 401 }), assets);
    assert.equal(response.status, 401);
  }
  assert.equal(assetReads, 0);
});
test('only non-API GET and HEAD requests may request static assets', async () => {
  for (const method of ['GET', 'HEAD']) {
    const response = await routeCloudflareRequest(new Request('https://test.invalid/overview', { method }), async () => { throw new Error('API should not run'); }, { fetch: async () => new Response('SPA') });
    assert.equal(response.status, 200);
  }
  const response = await routeCloudflareRequest(new Request('https://test.invalid/cli-reports/archive.json', { method: 'POST' }), async () => new Response('API'), { fetch: async () => { throw new Error('Do not proxy writes'); } });
  assert.equal(response.status, 405);
});
test('missing asset binding and malformed encoding fail explicitly', async () => {
  assert.equal((await routeCloudflareRequest(new Request('https://test.invalid/'), async () => new Response('API'))).status, 503);
  assert.equal((await routeCloudflareRequest(new Request('https://test.invalid/%zz'), async () => new Response('API'))).status, 400);
});
