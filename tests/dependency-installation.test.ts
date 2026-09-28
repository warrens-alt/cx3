import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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
