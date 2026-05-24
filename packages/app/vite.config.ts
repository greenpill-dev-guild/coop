import path from 'node:path';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.ANALYZE === 'true'
      ? [
          visualizer({
            filename: path.resolve(__dirname, '../../stats-app.html'),
            template: 'treemap',
            gzipSize: true,
            open: false,
          }),
        ]
      : []),
  ],
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: [
      {
        find: /^@coop\/shared\/app$/,
        replacement: path.resolve(__dirname, '../shared/src/app-entry.ts'),
      },
      {
        find: /^@coop\/shared\/sync-config$/,
        replacement: path.resolve(__dirname, '../shared/src/sync-config.ts'),
      },
      {
        find: /^@coop\/shared$/,
        replacement: path.resolve(__dirname, '../shared/src/index.ts'),
      },
      {
        find: /^@coop\/api$/,
        replacement: path.resolve(__dirname, '../api/config.ts'),
      },
    ],
  },
  build: {
    sourcemap: 'hidden',
    target: 'es2022',
  },
  server: {
    port: 3101,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: ['local.coop.town'],
  },
  preview: {
    port: 3101,
    host: '0.0.0.0',
    strictPort: true,
  },
});
