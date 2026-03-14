import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@coop/shared/contracts': path.resolve(__dirname, 'packages/shared/src/contracts/index.ts'),
      '@coop/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@coop/signaling': path.resolve(__dirname, 'packages/signaling/config.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'packages/app/src/**/*.test.{ts,tsx}',
      'packages/extension/src/**/*.test.{ts,tsx}',
      'packages/shared/src/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    globals: true,
    coverage: {
      provider: 'v8',
      all: true,
      include: [
        'packages/app/src/**/*.{ts,tsx}',
        'packages/extension/src/runtime/**/*.{ts,tsx}',
        'packages/shared/src/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        'packages/**/src/**/index.ts',
        'packages/**/src/**/main.tsx',
        'packages/extension/src/runtime/agent-runner.ts',
        'packages/extension/src/runtime/receiver-sync-offscreen.ts',
        'packages/extension/src/runtime/inference-worker.ts',
        'packages/extension/src/runtime/agent-webllm-bridge.ts',
        'packages/extension/src/runtime/agent-webllm-worker.ts',
        'packages/extension/src/runtime/agent-config.ts',
        'packages/shared/src/modules/greengoods/greengoods.ts',
        'packages/shared/src/modules/session/session.ts',
        'packages/extension/src/runtime/agent-models.ts',
        'packages/extension/src/runtime/inference-bridge.ts',
        'packages/app/src/app.tsx',
        'packages/app/src/views/**',
      ],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 70,
      },
    },
  },
});
