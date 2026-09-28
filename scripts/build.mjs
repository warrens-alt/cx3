import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('[build] Starting production build...');

// Always build current sources; an existing index.html is not evidence that the
// assets match this checkout. Use only the locally installed, locked compiler.
const distDir = path.join(rootDir, 'dist');
const distHtml = path.join(distDir, 'index.html');
const distAssets = path.join(distDir, 'assets');
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
if (!fs.existsSync(viteBin)) {
  throw new Error('[build] Local Vite is missing. Install the committed npm lockfile before building.');
}
console.log('[build] Compiling client assets with Vite...');
execFileSync(process.execPath, [viteBin, 'build'], { cwd: rootDir, stdio: 'inherit' });

if (!fs.existsSync(distHtml) || fs.statSync(distHtml).size === 0) {
  throw new Error('[build] Vite build failed to produce valid dist/index.html');
}
if (!fs.existsSync(distAssets) || fs.readdirSync(distAssets).length === 0) {
  throw new Error('[build] Vite build failed to produce assets in dist/assets');
}

// Preserve the existing client output locations used by deployment runners.
const distClientDir = path.join(distDir, 'client');
const buildDir = path.join(rootDir, 'build');
for (const clientDir of [distClientDir, buildDir]) {
  fs.mkdirSync(clientDir, { recursive: true });
  fs.copyFileSync(distHtml, path.join(clientDir, 'index.html'));
  fs.rmSync(path.join(clientDir, 'assets'), { recursive: true, force: true });
  fs.cpSync(distAssets, path.join(clientDir, 'assets'), { recursive: true, force: true });
}

console.log('[build] Bundling server.ts with esbuild...');
const distServerDir = path.join(distDir, 'server');
fs.mkdirSync(distServerDir, { recursive: true });
const serverOptions = {
  entryPoints: [path.join(rootDir, 'server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
};
await esbuild.build({
  ...serverOptions,
  format: 'esm',
  outfile: path.join(distServerDir, 'server.mjs'),
});

// CommonJS has no native import.meta. Supply the actual bundle URL so the
// shared entry-point guard starts the process only when executed directly.
await esbuild.build({
  ...serverOptions,
  format: 'cjs',
  define: { 'import.meta': '__cxImportMeta' },
  banner: { js: "const __cxImportMeta = { url: require('node:url').pathToFileURL(__filename).href };" },
  outfile: path.join(distServerDir, 'server.cjs'),
});

for (const filename of ['server.mjs', 'server.mjs.map', 'server.cjs', 'server.cjs.map']) {
  fs.copyFileSync(path.join(distServerDir, filename), path.join(distDir, filename));
}
// npm start executes the generated ESM bundle directly. Do not create another
// root launcher that silently succeeds when the production bundle is missing.

const assetCount = fs.readdirSync(distAssets).length;
const htmlSize = fs.statSync(distHtml).size;
for (const filename of ['server.mjs', 'server.cjs']) {
  if (fs.statSync(path.join(distServerDir, filename)).size === 0) {
    throw new Error(`[build] Empty server bundle: ${filename}`);
  }
}
console.log('[build] Verification passed:');
console.log(` - dist/index.html (${htmlSize} bytes)`);
console.log(` - dist/assets/ (${assetCount} assets)`);
console.log(' - dist/client/ and build/ (populated with index.html and assets)');
console.log(' - dist/server/server.mjs and dist/server/server.cjs');
console.log(' - dist/server.mjs and dist/server.cjs (compatibility copies)');
console.log('[build] Build completed successfully with valid non-empty artifacts.');
