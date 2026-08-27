import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repositoryRoot = new URL('.', import.meta.url).pathname;

export default defineConfig({
  root: resolve(repositoryRoot, 'apps/copilotkit-web'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(repositoryRoot, 'apps/web/copilot'),
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022'
  },
  server: {
    host: '127.0.0.1',
    port: 4180,
    strictPort: true,
    fs: {
      allow: [repositoryRoot]
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 4180,
    strictPort: true
  }
});
