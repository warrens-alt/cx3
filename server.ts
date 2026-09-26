import 'dotenv/config';
import fs from 'node:fs';
import express from 'express';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mountApi } from './server/apiApp';

export async function createApp() {
  const app = express();
  await mountApi(app);

  const isTsxDev = Boolean(process.env.TSX_ACTIVE);
  const hasDist = fs.existsSync(path.join(process.cwd(), 'dist', 'client', 'index.html'))
    || fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' || (!isTsxDev && hasDist);

  if (isProduction && hasDist) {
    const clientDirectory = fs.existsSync(path.join(process.cwd(), 'dist', 'client', 'index.html'))
      ? path.join(process.cwd(), 'dist', 'client')
      : path.join(process.cwd(), 'dist');
    app.use(express.static(clientDirectory, {
      dotfiles: 'deny',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));
    app.get(/.*/, (req, res) => {
      if (path.extname(req.path) || req.path.split('/').some(p => p.startsWith('.'))) return res.status(404).end();
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(path.join(clientDirectory, 'index.html'));
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
  const bundlePath = path.join(process.cwd(), 'dist', 'server', 'server.mjs');

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
