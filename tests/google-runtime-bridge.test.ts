import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createApiBridge, isApiRequest, previewApiPlugin } from '../server/viteApiBridge';
import { applyServerEnvironment } from '../server/viteEnvironment';

async function serve(t: test.TestContext, handler: http.RequestListener) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

test('bridge scopes exact API paths, including health with query, not similarly prefixed assets', () => {
  for (const url of ['/api', '/api/', '/api?x=1', '/api/health', '/API/health']) assert.ok(isApiRequest(url));
  for (const url of [undefined, '/', '/apiary', '/api-docs', '/assets/api.js']) assert.equal(isApiRequest(url), false);
});

test('simultaneous API reads share one initialisation and reuse the host API', async t => {
  let initialisations = 0;
  const bridge = createApiBridge(async () => {
    initialisations++;
    await new Promise(r => setTimeout(r, 15));
    return (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); };
  });
  const origin = await serve(t, (req, res) => bridge(req, res, () => res.end('frontend')));
  assert.equal(await (await fetch(origin + '/apiary')).text(), 'frontend');
  assert.equal(initialisations, 0);
  const responses = await Promise.all(Array.from({ length: 6 }, () => fetch(origin + '/api/health')));
  for (const response of responses) assert.deepEqual(await response.json(), { ok: true });
  await (await fetch(origin + '/api/health?fresh=1')).arrayBuffer();
  assert.equal(initialisations, 1);
});

test('initialisation rejection is JSON 503 without private error text or a retry storm', async t => {
  let attempts = 0;
  const bridge = createApiBridge(async () => { attempts++; throw new Error('PRIVATE_FIXTURE_CREDENTIAL'); });
  const origin = await serve(t, (req, res) => bridge(req, res, () => res.end('SPA must not handle API errors')));
  for (let i = 0; i < 2; i++) {
    const response = await fetch(origin + '/api/health');
    assert.equal(response.status, 503);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    const text = await response.text();
    assert.match(text, /API_INITIALISATION_FAILED/);
    assert.doesNotMatch(text, /PRIVATE_FIXTURE_CREDENTIAL|SPA must/);
  }
  assert.equal(attempts, 1);
});

test('unhandled API route cannot escape to Vite HTML fallback', async t => {
  const bridge = createApiBridge(async () => (_req, _res, next) => next());
  const origin = await serve(t, (req, res) => bridge(req, res, () => res.end('SPA')));
  const response = await fetch(origin + '/api/missing');
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { success: false, error: 'Unknown API endpoint' });
});

test('private server settings preserve injected values and do not alter NODE_ENV/browser exposure', () => {
  const env: NodeJS.ProcessEnv = { BIGQUERY_CREDENTIALS: 'injected-fixture', CX_AUTH_MODE: '' };
  applyServerEnvironment({ BIGQUERY_CREDENTIALS: 'file-fixture', CX_AUTH_MODE: 'firebase',
    GEMINI_API_KEY: 'server-fixture', CX_MAX_CONCURRENT_QUERIES_GLOBAL: '7',
    NODE_ENV: 'development', VITE_LEAK: 'not-copied', PATH: 'not-copied' }, env);
  assert.deepEqual(env, { BIGQUERY_CREDENTIALS: 'injected-fixture', CX_AUTH_MODE: '',
    GEMINI_API_KEY: 'server-fixture', CX_MAX_CONCURRENT_QUERIES_GLOBAL: '7' });
});

test('both Vite host hooks exist; built preview pins production without selecting another auth provider', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAuth = process.env.CX_AUTH_MODE;
  try {
    process.env.NODE_ENV = 'development';
    process.env.CX_AUTH_MODE = 'iap';
    const plugin = previewApiPlugin();
    assert.equal(typeof plugin.configureServer, 'function');
    assert.equal(typeof plugin.configurePreviewServer, 'function');
    let handlers = 0;
    (plugin.configurePreviewServer as Function)({ middlewares: { use: () => { handlers++; } } });
    assert.equal(handlers, 1);
    assert.equal(process.env.NODE_ENV, 'production');
    assert.equal(process.env.CX_AUTH_MODE, 'iap');
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
    if (originalAuth === undefined) delete process.env.CX_AUTH_MODE; else process.env.CX_AUTH_MODE = originalAuth;
  }
});
