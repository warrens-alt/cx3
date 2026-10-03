import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// Credential-free smoke checks only. No authenticated warehouse/API request,
// import, external-service configuration or deployment is performed here.
const root = fileURLToPath(new URL('../', import.meta.url));
const entries = ['dist/server/server.mjs', 'dist/server.mjs', 'dist/server/server.cjs', 'dist/server.cjs'];
const launches = [
  ...entries.map(entry => ({ entry, clientDir: null })),
  ...['build', 'out'].map(clientDir => ({ entry: entries[0], clientDir })),
];
const expectedHtml = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
const expectedBrand = readFileSync(resolve(root, 'public/brand/conversionx-grey.png'));
const assetPath = expectedHtml.match(/(?:src|href)="(\/assets\/[^"?]+\.js)"/)?.[1];
assert.ok(assetPath, 'The production HTML must reference a compiled JavaScript asset');
assert.equal(existsSync(resolve(root, 'server.js')), false, 'The build must not generate a root launcher');

async function unusedPort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return port;
}

for (const { entry, clientDir } of launches) {
  const label = `${entry} (${clientDir ? `CLIENT_DIR=${clientDir}` : 'default dist/client'})`;
  const port = await unusedPort();
  // Do not inherit tokens, credential paths or integration enablement flags.
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    NODE_ENV: 'production',
    CX_AUTH_MODE: 'firebase',
    CX_ALLOW_DEV_AUTH: 'false',
    PORT: String(port),
    ...(clientDir ? { CLIENT_DIR: resolve(root, clientDir) } : {}),
  };
  const child = spawn(process.execPath, [resolve(root, entry)], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let spawnError;
  child.once('error', error => { spawnError = error; });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => { output = (output + chunk.toString()).slice(-12000); });
  }
  const exited = new Promise(resolveExit => child.once('close', resolveExit));
  const request = path => fetch(`http://127.0.0.1:${port}${path}`, {
    redirect: 'error', signal: AbortSignal.timeout(3000),
  });
  try {
    let ready = false;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      assert.equal(child.exitCode, null, `${label} exited before becoming ready: ${output}`);
      try {
        const response = await request('/api/health');
        const body = await response.json();
        ready = response.status === 200 && body.status === 'ok' && body.service === 'ConversionX';
      } catch { /* Startup may not have bound the loopback port yet. */ }
      if (ready) break;
      await delay(100);
    }
    assert.ok(ready, `${label} did not become ready: ${output}`);
    for (const path of ['/', '/sales-activation']) {
      const response = await request(path);
      assert.equal(response.status, 200, `${label}: ${path}`);
      assert.equal(await response.text(), expectedHtml);
      assert.match(response.headers.get('cache-control') || '', /no-cache/);
    }
    const asset = await request(assetPath);
    assert.equal(asset.status, 200);
    assert.ok((await asset.text()).length > 0);
    assert.match(asset.headers.get('cache-control') || '', /immutable/);
    const brand = await request('/brand/conversionx-grey.png');
    assert.equal(brand.status, 200, `${label}: canonical brand asset must be served`);
    assert.match(brand.headers.get('content-type') || '', /^image\/png(?:;|$)/i, `${label}: brand asset must be a PNG`);
    assert.deepEqual(Buffer.from(await brand.arrayBuffer()), expectedBrand, `${label}: brand bytes must match the supplied asset`);
    for (const path of [
      '/api/analytics/cli-performance?clientId=default_tenant',
      '/api/analytics/offernet/raw-leads?clientId=default_tenant',
    ]) {
      const response = await request(path);
      assert.equal(response.status, 401, `${label} must reject unauthenticated ${path}`);
      await response.arrayBuffer();
    }
    for (const path of ['/server/server.mjs', '/server.cjs', '/server.mjs.map', '/package.json', '/.env']) {
      const response = await request(path);
      assert.equal(response.status, 404, `${label} must not serve ${path}`);
      await response.arrayBuffer();
    }
    console.log(`[production-smoke] PASS ${label}: startup, assets, brand, SPA, authentication and private-file boundaries`);
  } catch (error) {
    console.error(`[production-smoke] FAIL ${label}\n${output}`);
    throw error;
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    const stopped = await Promise.race([exited.then(() => true), delay(2000).then(() => false)]);
    if (!stopped) {
      child.kill('SIGKILL');
      await exited;
    }
  }
}
