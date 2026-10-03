import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { previewApiPlugin } from './server/viteApiBridge';
import { applyServerEnvironment } from './server/viteEnvironment';

function artifactMirrorPlugin() {
  return {
    name: 'conversionx-artifact-mirror',
    closeBundle() {
      const rootDir = process.cwd();
      const distDir = path.join(rootDir, 'dist');
      const distHtml = path.join(distDir, 'index.html');
      const distAssets = path.join(distDir, 'assets');
      const distBrand = path.join(distDir, 'brand');

      if (!fs.existsSync(distHtml)) return;

      const targets = [
        path.join(distDir, 'client'),
        path.join(rootDir, 'build'),
        path.join(rootDir, 'out'),
      ];

      for (const targetDir of targets) {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(distHtml, path.join(targetDir, 'index.html'));
        if (fs.existsSync(distAssets)) {
          const targetAssets = path.join(targetDir, 'assets');
          fs.rmSync(targetAssets, { recursive: true, force: true });
          fs.cpSync(distAssets, targetAssets, { recursive: true, force: true });
        }
        const targetBrand = path.join(targetDir, 'brand');
        fs.rmSync(targetBrand, { recursive: true, force: true });
        if (fs.existsSync(distBrand)) {
          fs.cpSync(distBrand, targetBrand, { recursive: true, force: true });
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  applyServerEnvironment(loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), tailwindcss(), previewApiPlugin(), artifactMirrorPlugin()],
    resolve: {
      dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom',
        'react-dom/client',
        'react-router',
        'react-router-dom',
        '@tanstack/react-query',
        'react-error-boundary',
        'recharts',
        'lucide-react',
      ],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('/pages/Exceptions') ||
              id.includes('Exceptions.tsx') ||
              id.includes('ExceptionWorkbench')
            ) {
              return 'investigation-workbench';
            }
            if (id.includes('node_modules/recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-lucide';
            }
            if (
              id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/scheduler')
            ) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/@tanstack')) {
              return 'vendor-tanstack';
            }
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
          },
          chunkFileNames(chunkInfo) {
            const name = chunkInfo.name.replace(/Exceptions/gi, 'investigations');
            return `assets/${name}-[hash].js`;
          },
          assetFileNames(assetInfo) {
            const rawName = (assetInfo.names?.[0] || assetInfo.name || 'asset').replace(/\.[^/.]+$/, '');
            const sanitized = rawName.replace(/Exceptions/gi, 'investigations');
            return `assets/${sanitized}-[hash][extname]`;
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
