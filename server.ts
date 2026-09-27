import 'dotenv/config';
import fs from 'node:fs';
import express from 'express';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function createApp() {
  const { mountApi } = await import('./server/apiApp');
  const app = express();
  await mountApi(app);

  const isTsxDev = Boolean(
    process.env.TSX_ACTIVE ||
    process.env.npm_lifecycle_event === 'dev' ||
    process.execArgv.some(a => a.includes('tsx'))
  );
  const isProduction = process.env.NODE_ENV === 'production' || (!isTsxDev && process.env.NODE_ENV !== 'development');

  if (isProduction) {
    const configuredClientDir = process.env.CLIENT_DIR
      ? path.resolve(process.env.CLIENT_DIR)
      : path.join(process.cwd(), 'dist', 'client');
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

export async function startServer() {
  const app = await createApp();
  const port = Math.min(Math.max(Number(process.env.PORT) || 3000, 1), 65535);
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

const currentFileHref = import.meta.url;
const entryFileHref = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
const isMain = currentFileHref === entryFileHref;

if (isMain) {
  const isTsFile = currentFileHref.endsWith('.ts');
  const bundlePath = fs.existsSync(path.join(process.cwd(), 'dist', 'server.mjs'))
    ? path.join(process.cwd(), 'dist', 'server.mjs')
    : path.join(process.cwd(), 'dist', 'server', 'server.mjs');

  if (isTsFile && fs.existsSync(bundlePath) && process.env.NODE_ENV === 'production' && !process.env.TSX_ACTIVE) {
    const bundleUrl = pathToFileURL(bundlePath).href;
    const serverModule = await import(/* @vite-ignore */ bundleUrl);
    if (typeof serverModule.startServer === 'function') {
      await serverModule.startServer();
    } else if (typeof serverModule.createApp === 'function') {
      const app = await serverModule.createApp();
      const port = Math.min(Math.max(Number(process.env.PORT) || 3000, 1), 65535);
      app.listen(port, '0.0.0.0', () => console.log(`ConversionX listening on ${port}`));
    }
  } else {
    startServer().catch((error) => {
      console.error('Server startup failed:', error);
      process.exitCode = 1;
    });
  }
}
