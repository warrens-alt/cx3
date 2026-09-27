/** Offline Worker smoke test: local emulated bindings, no login, cloud writes or real CSV. */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const child = spawn('npx', ['--yes', 'wrangler@4.142.0', 'dev', '--config', 'wrangler.cloudflare.example.jsonc', '--local', '--ip', '127.0.0.1', '--port', '8799'], {
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false', BROWSER: 'none' },
  stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
});
let output = '';
const collect = chunk => { output = (output + chunk.toString()).slice(-12000); };
child.stdout.on('data', collect); child.stderr.on('data', collect);
child.on('error', collect);
const request = (path, init = {}) => fetch(`http://127.0.0.1:8799${path}`, { ...init, signal: AbortSignal.timeout(4000) });
try {
  let ready = false;
  for (let attempt = 0; attempt < 180; attempt++) {
    if (child.exitCode !== null) throw new Error('Local Wrangler exited before readiness');
    try {
      const response = await request('/api/health');
      if (response.ok && (await response.json()).service === 'ConversionX') { ready = true; break; }
    } catch { /* Startup is bounded, and no remote URL is ever polled. */ }
    await delay(500);
  }
  assert.ok(ready, 'Local Worker must boot with no production credentials');
  const index = await request('/overview');
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type') || '', /text\/html/);
  assert.match(await index.text(), /id=["']root["']/);
  for (const [path, init] of [
    ['/api/analytics/cli-performance', {}],
    ['/api/analytics/cli-performance/import/history?clientId=default_tenant', {}],
    ['/api/analytics/cli-performance/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }],
  ]) {
    const response = await request(path, init);
    assert.equal(response.status, 401, 'Unauthenticated APIs must fail before R2 I/O');
    assert.match(response.headers.get('content-type') || '', /application\/json/);
  }
  const badToken = await request('/api/analytics/cli-performance', { headers: { Authorization: 'Bearer not-a-token' } });
  assert.equal(badToken.status, 401);
  console.log('PASS: local Worker boot, frontend assets, authenticated API boundary, invalid-token rejection. No live storage was accessed.');
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (child.pid && child.exitCode === null) {
    try {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch { /* Child may have already exited. */ }
  }
}
