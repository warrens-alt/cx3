import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// Local real-HTTP acceptance of AI Studio's possible launch modes. No real
// credentials, valid identity tokens, warehouse reads or deployment operations.
const root = fileURLToPath(new URL('../', import.meta.url));
async function port() {
  const server = net.createServer(); server.listen(0, '127.0.0.1');
  await once(server, 'listening'); const result = server.address().port;
  await new Promise(resolve => server.close(resolve)); return result;
}
const modes = [
  { name: 'AI Studio Express development', args: p => ['node_modules/tsx/dist/cli.mjs', 'server.ts', '--port', p], env: { NODE_ENV: 'development', CX_AUTH_MODE: 'firebase' }, status: 401 },
  { name: 'AI Studio direct Vite development', args: p => ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', p, '--strictPort'], env: { NODE_ENV: 'development', CX_AUTH_MODE: 'firebase' }, status: 401 },
  { name: 'Vite built preview', args: p => ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', p, '--strictPort'], env: { NODE_ENV: 'development', CX_AUTH_MODE: 'firebase', CX_ALLOW_DEV_AUTH: 'true' }, status: 401 },
  { name: 'Cloud Run Node bundle without NODE_ENV', args: () => ['dist/server/server.mjs'], env: { CX_AUTH_MODE: 'firebase', CX_ALLOW_DEV_AUTH: 'true' }, status: 401 },
  { name: 'Node bundle preserves default IAP boundary', args: () => ['dist/server/server.mjs'], env: { CX_ALLOW_DEV_AUTH: 'true' }, status: 503 },
];
for (const mode of modes) {
  const p = String(await port());
  const child = spawn(process.execPath, mode.args(p), { cwd: root,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
      DOTENV_CONFIG_PATH: '/nonexistent-cx3-smoke.env', PORT: p, DISABLE_HMR: 'true',
      CX_ALLOW_DEV_AUTH: 'false', ENABLE_CLI_SAMPLE_DATA: 'false', ...mode.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; let spawnError;
  child.on('error', e => { spawnError = e; });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', x => { output = (output + x.toString()).slice(-10000); });
  const closed = new Promise(r => child.once('close', r));
  const get = path => fetch(`http://127.0.0.1:${p}${path}`, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(3000) });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (spawnError) throw spawnError;
      assert.equal(child.exitCode, null, output);
      try { const r = await get('/api/health'); const j = await r.json(); ready = r.status === 200 && j.service === 'ConversionX' && j.status === 'ok'; } catch {}
      if (ready) break; await delay(100);
    }
    assert.ok(ready, `${mode.name}: API failed to become ready\n${output}`);
    const checks = await Promise.all(Array.from({ length: 5 }, () => get('/api/health?probe=concurrent')));
    for (const response of checks) assert.equal((await response.json()).service, 'ConversionX');
    for (const path of ['/api/analytics/clients', '/api/unknown']) {
      const r = await get(path); assert.equal(r.status, mode.status, `${mode.name}: ${path}`);
      assert.match(r.headers.get('content-type') || '', /application\/json/);
      assert.equal((await r.json()).success, false);
    }
    if (mode.status === 401) {
      const r = await fetch(`http://127.0.0.1:${p}/api/analytics/clients`, { headers: { Authorization: 'Bearer invalid-token' }, signal: AbortSignal.timeout(3000) });
      assert.equal(r.status, 401); await r.arrayBuffer();
    }
    for (const path of ['/', '/sales-activation']) {
      const r = await fetch(`http://127.0.0.1:${p}${path}`, { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(3000) }); assert.equal(r.status, 200, `${mode.name}: frontend ${path}`);
      assert.match(r.headers.get('content-type') || '', /text\/html/);
      assert.match(await r.text(), /id="root"/);
    }
    console.log(`[google-runtime] PASS ${mode.name}: health, concurrent API, anonymous/invalid identity rejection, frontend routes`);
  } finally {
    child.kill('SIGTERM');
    if (!await Promise.race([closed.then(() => true), delay(2500).then(() => false)])) { child.kill('SIGKILL'); await closed; }
  }
}
