import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function previewApiBridge(): Plugin {
  return {
    name: 'conversionx-preview-api',
    apply: 'serve',
    async configureServer(viteServer) {
      const express = (await import('express')).default;
      const { mountApi } = await import('./server/apiApp');
      const api = express();
      await mountApi(api);

      // AI Studio can launch Vite directly. Without this bridge /api requests
      // fall through to index.html and misleadingly return HTTP 200.
      viteServer.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) return next();
        api(req as any, res as any, next as any);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [previewApiBridge(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/@tanstack')) {
              return 'vendor-tanstack';
            }
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
