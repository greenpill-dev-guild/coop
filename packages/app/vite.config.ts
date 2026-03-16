import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@coop/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@coop/api': path.resolve(__dirname, '../api/config.ts'),
    },
  },
  build: {
    sourcemap: 'hidden',
    target: 'es2022',
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  preview: {
    port: 3001,
    host: '0.0.0.0',
  },
});
