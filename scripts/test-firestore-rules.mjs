import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const version = '1.22.0';
const expectedSha256 = '9b6498b7f62714d67f48f59b3818883cd682dbcd46b9f59511de81c97bb5166c';
const filename = `cloud-firestore-emulator-v${version}.jar`;
const downloadUrl = `https://storage.googleapis.com/firebase-preview-drop/emulator/${filename}`;
const project = 'demo-cx3-access';
const root = fileURLToPath(new URL('../', import.meta.url));
const cache = process.env.CX3_FIRESTORE_EMULATOR_CACHE || path.join(tmpdir(), 'cx3-firebase-emulators');
const jar = path.join(cache, filename);
const shutdown = new AbortController();
const children = new Set();
let receivedSignal;

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function emulatorJar() {
  await mkdir(cache, { recursive: true });
  try {
    if (await digest(jar) !== expectedSha256) throw new Error(`Emulator checksum mismatch: ${jar}. Remove this cached file and retry.`);
    return jar;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const partial = `${jar}.${process.pid}.download`;
  try {
    console.log(`Downloading official Firestore emulator ${version}…`);
    const response = await fetch(downloadUrl, { signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(180_000)]) });
    if (!response.ok || !response.body) throw new Error(`Emulator download failed: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial, { flags: 'wx' }), { signal: shutdown.signal });
    if (await digest(partial) !== expectedSha256) throw new Error('Downloaded emulator checksum does not match the pinned SHA256');
    await rename(partial, jar);
    return jar;
  } finally {
    await rm(partial, { force: true });
  }
}

async function availablePort() {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    return server.address().port;
  } finally {
    if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

function launch(command, args, options = {}) {
  shutdown.signal.throwIfAborted();
  const child = spawn(command, args, { cwd: root, detached: process.platform !== 'win32', ...options });
  const managed = { child, result: undefined };
  children.add(managed);
  managed.done = new Promise(resolve => {
    const finish = result => {
      if (managed.result) return;
      managed.result = result;
      resolve(result);
    };
    child.once('error', error => finish({ error }));
    child.once('exit', (code, signal) => finish({ code, signal }));
  });
  return managed;
}

function terminate(managed, signal = 'SIGTERM') {
  if (!managed.child.pid) return;
  try {
    if (process.platform === 'win32') {
      // Include node --test's child process when stopping an interrupted run.
      spawnSync('taskkill', ['/pid', String(managed.child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-managed.child.pid, signal);
    }
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

async function stop(managed) {
  terminate(managed);
  const result = await Promise.race([managed.done, delay(5_000, null, { ref: false })]);
  if (result === null) {
    terminate(managed, 'SIGKILL');
    await managed.done;
  }
  children.delete(managed);
}

const signalHandlers = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map(signal => {
  const handler = () => {
    receivedSignal = signal;
    shutdown.abort(new Error(`Rules tests interrupted by ${signal}`));
    for (const managed of children) terminate(managed);
  };
  process.on(signal, handler);
  return [signal, handler];
}));
const cleanupOnExit = () => {
  for (const managed of children) terminate(managed, 'SIGKILL');
};
process.once('exit', cleanupOnExit);
const signalExitCode = () => ({ SIGINT: 130, SIGTERM: 143, SIGHUP: 129 })[receivedSignal] || 1;

let emulatorOutput = '';
try {
  await emulatorJar();
  shutdown.signal.throwIfAborted();
  const port = await availablePort();
  const host = `127.0.0.1:${port}`;
  const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
  console.log(`Starting Firestore emulator ${version} on ${host} for ${project} (requires Java 21+).`);
  const emulator = launch(java, ['-jar', jar, '--host', '127.0.0.1', '--port', String(port),
    '--project_id', project, '--single_project_mode', '--single_project_mode_error', '--rules', path.join(root, 'firestore.rules')],
  { stdio: ['ignore', 'pipe', 'pipe'] });
  const collectOutput = chunk => { emulatorOutput = (emulatorOutput + chunk).slice(-64_000); };
  emulator.child.stdout.on('data', collectOutput);
  emulator.child.stderr.on('data', collectOutput);

  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    shutdown.signal.throwIfAborted();
    if (emulator.result) throw new Error(`Firestore emulator exited before becoming ready: ${emulator.result.error?.message || emulator.result.code}`);
    try {
      const response = await fetch(`http://${host}/`, { signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(1_000)]) });
      await response.body?.cancel();
      if (response.status < 500) { ready = true; break; }
    } catch {
      shutdown.signal.throwIfAborted();
    }
    await delay(100, undefined, { signal: shutdown.signal });
  }
  if (!ready) throw new Error('Firestore emulator did not become ready within 60 seconds');
  const tests = launch(process.execPath, ['--import', 'tsx', '--test', 'tests/firestore-access.emulator.test.ts'], {
    stdio: 'inherit', env: { ...process.env, FIRESTORE_EMULATOR_HOST: host, GCLOUD_PROJECT: project },
  });
  const result = await Promise.race([
    tests.done,
    emulator.done.then(result => { throw new Error(`Firestore emulator stopped during the test run: ${result.error?.message || result.code}`); }),
  ]);
  if (result.error) throw result.error;
  process.exitCode = result.code ?? 1;
} catch (error) {
  console.error(error.message);
  if (emulatorOutput) console.error(emulatorOutput);
  process.exitCode = signalExitCode();
} finally {
  await Promise.all([...children].map(stop));
  for (const [signal, handler] of signalHandlers) process.off(signal, handler);
  process.off('exit', cleanupOnExit);
  if (receivedSignal) process.exitCode = signalExitCode();
}
