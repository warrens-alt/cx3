import 'dotenv/config';
import fs from 'node:fs';
import express from 'express';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const currentFileHref = typeof import.meta !== 'undefined' && import.meta?.url ? import.meta.url : '';
const isAlreadyBundled = currentFileHref.endsWith('.mjs') || currentFileHref.endsWith('.cjs');

export async function createApp() {
  const isTsxDev = Boolean(
    process.env.TSX_ACTIVE ||
    process.env.npm_lifecycle_event === 'dev' ||
    process.execArgv.some(a => a.includes('tsx'))
  );
  const bundledServer = path.join(process.cwd(), 'dist', 'server', 'server.mjs');

  if (!isAlreadyBundled && !isTsxDev && fs.existsSync(bundledServer)) {
    const bundled = await import(pathToFileURL(bundledServer).href);
    return bundled.createApp();
  }

  const { mountApi } = await import('./server/apiApp.ts').catch(() => import('./server/apiApp'));
  const app = express();
  await mountApi(app);
  const isProduction = process.env.NODE_ENV === 'production' || (!isTsxDev && process.env.NODE_ENV !== 'development');

  if (isProduction) {
    const configuredClientDir = process.env.CLIENT_DIR
      ? path.resolve(process.env.CLIENT_DIR)
      : fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
      ? path.join(process.cwd(), 'dist')
      : fs.existsSync(path.join(process.cwd(), 'dist', 'client', 'index.html'))
      ? path.join(process.cwd(), 'dist', 'client')
      : path.join(process.cwd(), 'build');
    const hasClientBuild = fs.existsSync(path.join(configuredClientDir, 'index.html'));

    if (!hasClientBuild) {
      if (process.env.API_ONLY === 'true') {
        app.get(/.*/, (req, res) => {
          if (req.path.startsWith('/api')) {
            return res.status(404).json({ success: false, error: 'Unknown API endpoint' });
          }
          res.status(503).json({ success: false, error: 'API-only mode: production client assets are not deployed' });
        });
        return app;
      }
      throw new Error(`Production client assets are missing at ${configuredClientDir}. Build client assets before starting or configure CLIENT_DIR.`);
    }

    // Ensure server files, source files, and credentials cannot be served as assets
    app.use((req, res, next) => {
      const lower = req.path.toLowerCase();
      if (
        lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs') ||
        lower.endsWith('.map') || lower.includes('.env') || lower.includes('package.json') ||
        lower.includes('package-lock.json') || lower.includes('tsconfig') || lower.includes('server.mjs')
      ) {
        return res.status(404).end();
      }
      next();
    });

    app.use(express.static(configuredClientDir, {
      dotfiles: 'deny',
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));
    app.get(/.*/, (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, error: 'Unknown API endpoint' });
      }
      if (path.extname(req.path) || req.path.split('/').some(p => p.startsWith('.'))) {
        return res.status(404).end();
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(path.join(configuredClientDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  return app;
}

export function validatePortNumber(raw: unknown, source: string): number {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new Error(`Invalid ${source}: empty port value`);
  }
  const str = String(raw).trim();
  if (!/^\d+$/.test(str)) {
    throw new Error(`Invalid ${source}: "${raw}" is not a valid integer port`);
  }
  const port = Number(str);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${source}: "${raw}" is out of TCP port range (1-65535)`);
  }
  return port;
}

export function resolvePort(argv: string[] = process.argv, env: NodeJS.ProcessEnv = process.env): number {
  // Precedence:
  // 1. Explicit command-line flag: --port <value>
  // 2. Explicit environment variable: PORT (including PORT=8080)
  // 3. Fallback: DEFAULT_APP_PORT (if configured) or local development default (3000)
  const portIndex = argv.indexOf('--port');
  if (portIndex !== -1) {
    if (portIndex + 1 >= argv.length || argv[portIndex + 1].startsWith('-')) {
      throw new Error('Missing value for --port argument');
    }
    return validatePortNumber(argv[portIndex + 1], 'command-line --port');
  }

  if (env.PORT !== undefined && env.PORT.trim() !== '') {
    return validatePortNumber(env.PORT, 'PORT environment variable');
  }

  if (env.DEFAULT_APP_PORT !== undefined && env.DEFAULT_APP_PORT.trim() !== '') {
    return validatePortNumber(env.DEFAULT_APP_PORT, 'DEFAULT_APP_PORT environment variable');
  }

  return 3000;
}

export async function startServer() {
  const app = await createApp();
  const port = resolvePort();
  return new Promise<express.Application>((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`ConversionX listening on ${port}`);
      resolve(app);
    });
    server.once('error', (error) => {
      console.error('Server startup failed:', error.message);
      process.exitCode = 1;
      reject(error);
    });
  });
}

const entryFileHref = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
const isMain = currentFileHref === entryFileHref;

if (isMain) {
  const isTsxDev = Boolean(
    process.env.TSX_ACTIVE ||
    process.env.npm_lifecycle_event === 'dev' ||
    process.execArgv.some(a => a.includes('tsx'))
  );
  const bundledServer = path.join(process.cwd(), 'dist', 'server', 'server.mjs');

  if (!isAlreadyBundled && !isTsxDev && fs.existsSync(bundledServer)) {
    import(pathToFileURL(bundledServer).href)
      .then(bundled => bundled.startServer())
      .catch((error) => {
        console.error('Server startup failed:', error);
        process.exitCode = 1;
      });
  } else {
    startServer().catch((error) => {
      console.error('Server startup failed:', error);
      process.exitCode = 1;
    });
  }
}
