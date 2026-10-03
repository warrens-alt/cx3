import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('[build] Starting production build...');

const distDir = path.join(rootDir, 'dist');
const distHtml = path.join(distDir, 'index.html');
const distAssets = path.join(distDir, 'assets');
const distBrand = path.join(distDir, 'brand');

// 1. Resolve and execute Vite build
let viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
if (!fs.existsSync(viteBin)) {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
  } catch {}
}

console.log('[build] Compiling client assets with Vite...');
const buildEnv = { ...process.env, NODE_ENV: 'production' };
if (fs.existsSync(viteBin)) {
  execFileSync(process.execPath, [viteBin, 'build'], { cwd: rootDir, stdio: 'inherit', env: buildEnv });
} else {
  console.log('[build] Falling back to npx vite build...');
  execFileSync('npx', ['vite', 'build'], { cwd: rootDir, stdio: 'inherit', env: buildEnv });
}

if (!fs.existsSync(distHtml) || fs.statSync(distHtml).size === 0) {
  throw new Error('[build] Vite build failed to produce valid dist/index.html');
}
if (!fs.existsSync(distAssets) || fs.readdirSync(distAssets).length === 0) {
  throw new Error('[build] Vite build failed to produce assets in dist/assets');
}

// 2. Mirror client artifacts across all recognized output directories (dist/client, build, out)
const distClientDir = path.join(distDir, 'client');
const buildDir = path.join(rootDir, 'build');
const outDir = path.join(rootDir, 'out');

for (const clientDir of [distClientDir, buildDir, outDir]) {
  fs.mkdirSync(clientDir, { recursive: true });
  fs.copyFileSync(distHtml, path.join(clientDir, 'index.html'));
  fs.rmSync(path.join(clientDir, 'assets'), { recursive: true, force: true });
  fs.cpSync(distAssets, path.join(clientDir, 'assets'), { recursive: true, force: true });
  fs.rmSync(path.join(clientDir, 'brand'), { recursive: true, force: true });
  if (fs.existsSync(distBrand)) {
    fs.cpSync(distBrand, path.join(clientDir, 'brand'), { recursive: true, force: true });
  }
}

// 3. Bundle server.ts with esbuild for production Node execution
console.log('[build] Bundling server.ts with esbuild...');
const distServerDir = path.join(distDir, 'server');
const buildServerDir = path.join(buildDir, 'server');
fs.mkdirSync(distServerDir, { recursive: true });
fs.mkdirSync(buildServerDir, { recursive: true });

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

await esbuild.build({
  ...serverOptions,
  format: 'cjs',
  define: { 'import.meta': '__cxImportMeta' },
  banner: { js: "const __cxImportMeta = { url: require('node:url').pathToFileURL(__filename).href };" },
  outfile: path.join(distServerDir, 'server.cjs'),
});

// Copy server bundle to root dist and build for multi-runner compatibility
for (const filename of ['server.mjs', 'server.mjs.map', 'server.cjs', 'server.cjs.map']) {
  const src = path.join(distServerDir, filename);
  fs.copyFileSync(src, path.join(distDir, filename));
  fs.copyFileSync(src, path.join(buildServerDir, filename));
  fs.copyFileSync(src, path.join(buildDir, filename));
}

// 4. Compile warehouse export artifacts (non-fatal)
try {
  console.log('[build] Compiling warehouse export artifacts...');
  const tsxBin = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (fs.existsSync(tsxBin)) {
    execFileSync(process.execPath, [tsxBin, path.join(rootDir, 'scripts', 'build-warehouse-export.ts')], { cwd: rootDir, stdio: 'inherit' });
  } else {
    execFileSync('npx', ['tsx', path.join(rootDir, 'scripts', 'build-warehouse-export.ts')], { cwd: rootDir, stdio: 'inherit' });
  }

  const whDist = path.join(distDir, 'warehouse-export');
  const whBuild = path.join(buildDir, 'warehouse-export');
  if (fs.existsSync(whDist)) {
    fs.mkdirSync(whBuild, { recursive: true });
    fs.cpSync(whDist, whBuild, { recursive: true, force: true });
  }
} catch (exportErr) {
  console.warn('[build] Non-fatal warehouse export notice:', exportErr.message);
}

// 5. Verification checks
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
console.log(' - dist/client/, build/, out/ (populated with index.html, assets and brand)');
console.log(' - dist/server/server.mjs, build/server/server.mjs');
console.log(' - dist/server.mjs, build/server.mjs (compatibility copies)');
console.log('[build] Build completed successfully with valid non-empty artifacts.');
