import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const manifest = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));

test('deployment uses one npm lockfile instead of triggering another automatic installer', () => {
  assert.match(manifest.packageManager, /^npm@10\.\d+\.\d+$/);
  assert.equal(lock.lockfileVersion, 3);
  for (const filename of ['bun.lock', 'bun.lockb', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json']) {
    assert.equal(existsSync(new URL(filename, root)), false,
      `${filename} changes dependency selection; keep package-lock.json authoritative.`);
  }
  const ignored = read('.gitignore').split(/\r?\n/);
  assert.ok(ignored.includes('/bun.lock'));
  assert.ok(ignored.includes('/bun.lockb'));
});

test('npm root dependency declarations match the committed lock without regenerated resolutions', () => {
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.version, manifest.version);
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
  assert.deepEqual(lock.packages[''].engines, manifest.engines);
});

test('Cloudflare selects the maintained Node 22 line and CI installs the npm lock', () => {
  assert.equal(read('.node-version').trim(), '22');
  assert.match(read('.github/workflows/ci.yml'), /npm ci --ignore-scripts --no-audit/);
  assert.match(read('.github/workflows/cloudflare-validation.yml'), /npm ci --ignore-scripts --no-audit/);
  assert.equal(manifest.scripts.build, 'node scripts/build.mjs');
});

// Exercise the consumers whose security overrides cross their declared ranges.
// Firestore's gRPC transport is covered by the local rules-emulator suite.
test('Drizzle loader still transforms TypeScript with the patched esbuild dependency', async () => {
  const require = createRequire(import.meta.url);
  const drizzleRequire = createRequire(require.resolve('drizzle-kit'));
  const loaderRequire = createRequire(drizzleRequire.resolve('@esbuild-kit/esm-loader'));
  const { transform, transformSync } = loaderRequire('@esbuild-kit/core-utils');
  const source = 'const count: number = 42; export const value = count;';
  const filename = new URL('dependency-loader-fixture.ts', import.meta.url).pathname;
  const commonjs = transformSync(source, filename);
  const context = { module: { exports: {} as { value?: number } } };
  runInNewContext(commonjs.code, context);
  assert.equal(context.module.exports.value, 42);
  assert.ok(commonjs.map.sources.some((path: string) => path.endsWith('dependency-loader-fixture.ts')));

  const esm = await transform(source, filename);
  const loaded = await import(`data:text/javascript;base64,${Buffer.from(esm.code).toString('base64')}`);
  assert.equal(loaded.value, 42);
});

test('Google Storage transport still creates multipart boundaries with patched CommonJS UUID', async () => {
  const require = createRequire(import.meta.url);
  const storageRequire = createRequire(require.resolve('@google-cloud/storage'));
  const { Gaxios } = storageRequire('gaxios');
  const client = new Gaxios();
  let body = '';
  let boundary = '';
  const response = await client.request({
    url: 'https://storage.example.test/upload',
    method: 'POST',
    multipart: [
      { headers: { 'Content-Type': 'application/json' }, content: '{"name":"fixture.txt"}' },
      { headers: { 'Content-Type': 'text/plain' }, content: 'synthetic file content' },
    ],
    // Consume the prepared request without sending anything to a remote service.
    adapter: async (options: any) => {
      boundary = options.headers['Content-Type'].split('boundary=')[1];
      for await (const chunk of options.body) body += chunk.toString();
      return { data: 'accepted', status: 200, statusText: 'OK', headers: {}, config: options };
    },
  });
  assert.equal(response.data, 'accepted');
  assert.match(boundary, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.ok(body.includes(`--${boundary}\r\nContent-Type: application/json`));
  assert.ok(body.includes('{"name":"fixture.txt"}'));
  assert.ok(body.includes('synthetic file content'));
  assert.ok(body.includes(`--${boundary}--`));
});
