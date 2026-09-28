import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('[build] Starting production build...');

// 1. Compile client assets with Vite if needed
const distDir = path.join(rootDir, 'dist');
const distHtml = path.join(distDir, 'index.html');
const distAssets = path.join(distDir, 'assets');

if (!fs.existsSync(distHtml) || fs.statSync(distHtml).size === 0) {
  console.log('[build] Compiling client assets with Vite...');
  const viteBin = path.join(rootDir, 'node_modules', '.bin', 'vite');
  if (fs.existsSync(viteBin)) {
    execSync(`"${viteBin}" build`, { cwd: rootDir, stdio: 'inherit' });
  } else {
    execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });
  }
}

if (!fs.existsSync(distHtml) || fs.statSync(distHtml).size === 0) {
  throw new Error('[build] Vite build failed to produce valid dist/index.html');
}

if (!fs.existsSync(distAssets) || fs.readdirSync(distAssets).length === 0) {
  throw new Error('[build] Vite build failed to produce assets in dist/assets');
}

// 2. Populate dist/client
const distClientDir = path.join(distDir, 'client');
fs.mkdirSync(distClientDir, { recursive: true });
fs.copyFileSync(distHtml, path.join(distClientDir, 'index.html'));
fs.rmSync(path.join(distClientDir, 'assets'), { recursive: true, force: true });
fs.cpSync(distAssets, path.join(distClientDir, 'assets'), { recursive: true, force: true });

// 3. Populate build directory (for tools or deployment runners expecting build/)
const buildDir = path.join(rootDir, 'build');
fs.mkdirSync(buildDir, { recursive: true });
fs.copyFileSync(distHtml, path.join(buildDir, 'index.html'));
fs.rmSync(path.join(buildDir, 'assets'), { recursive: true, force: true });
fs.cpSync(distAssets, path.join(buildDir, 'assets'), { recursive: true, force: true });

// 4. Bundle server.ts for Node production runtime
console.log('[build] Bundling server.ts with esbuild...');
const distServerDir = path.join(distDir, 'server');
fs.mkdirSync(distServerDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(rootDir, 'server.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  outfile: path.join(distServerDir, 'server.mjs'),
});

// Provide server.mjs at dist/server.mjs as well for dual compatibility
fs.copyFileSync(path.join(distServerDir, 'server.mjs'), path.join(distDir, 'server.mjs'));
if (fs.existsSync(path.join(distServerDir, 'server.mjs.map'))) {
  fs.copyFileSync(path.join(distServerDir, 'server.mjs.map'), path.join(distDir, 'server.mjs.map'));
}

// Bundle CJS format as well for runtimes expecting CommonJS server bundles
await esbuild.build({
  entryPoints: [path.join(rootDir, 'server.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  outfile: path.join(distDir, 'server.cjs'),
});
fs.copyFileSync(path.join(distDir, 'server.cjs'), path.join(distServerDir, 'server.cjs'));

// 5. Provide root server.js entry delegating to production bundle
const serverJsContent = `// Production entry delegating to compiled server bundle
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const bundled = path.join(process.cwd(), 'dist', 'server', 'server.mjs');
if (fs.existsSync(bundled)) {
  const mod = await import(pathToFileURL(bundled).href);
  if (mod.startServer) {
    mod.startServer().catch(err => {
      console.error('Server startup failed:', err);
      process.exitCode = 1;
    });
  }
}
`;
fs.writeFileSync(path.join(rootDir, 'server.js'), serverJsContent);

// 5. Verification & Summary
const assetCount = fs.readdirSync(distAssets).length;
const htmlSize = fs.statSync(distHtml).size;
const serverBundleSize = fs.statSync(path.join(distServerDir, 'server.mjs')).size;

console.log('[build] Verification passed:');
console.log(` - dist/index.html (${htmlSize} bytes)`);
console.log(` - dist/assets/ (${assetCount} assets)`);
console.log(` - dist/client/ (populated with index.html and assets)`);
console.log(` - build/ (populated with index.html and assets)`);
console.log(` - dist/server/server.mjs (${(serverBundleSize / 1024).toFixed(1)} KB)`);
console.log(` - dist/server.mjs (${(serverBundleSize / 1024).toFixed(1)} KB)`);
console.log('[build] Build completed successfully with valid non-empty artifacts.');
