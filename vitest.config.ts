import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const sharedRootEntry = path.resolve(__dirname, 'packages/shared/src/index.ts');
const sharedAppEntry = path.resolve(__dirname, 'packages/shared/src/app-entry.ts');
const appImporterSegment = `${path.sep}packages${path.sep}app${path.sep}`;
const testImporterSegment = `${path.sep}__tests__${path.sep}`;
const coverageEnabled = process.argv.includes('--coverage');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'app-shared-entry-alias',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source !== '@coop/shared') {
          return null;
        }

        return importer?.includes(appImporterSegment) && !importer.includes(testImporterSegment)
          ? sharedAppEntry
          : sharedRootEntry;
      },
    },
  ],
  resolve: {
    alias: {
      '@coop/shared/contracts': path.resolve(__dirname, 'packages/shared/src/contracts/index.ts'),
      '@coop/api': path.resolve(__dirname, 'packages/api/config.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: coverageEnabled ? false : undefined,
    testTimeout: coverageEnabled ? 20_000 : 10_000,
    hookTimeout: coverageEnabled ? 20_000 : 10_000,
    include: [
      'packages/app/src/**/*.test.{ts,tsx}',
      'packages/extension/src/**/*.test.{ts,tsx}',
      'packages/shared/src/**/*.test.{ts,tsx}',
      'packages/api/**/*.test.{ts,tsx}',
      'scripts/__tests__/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    globals: true,
    coverage: {
      provider: 'v8',
      all: true,
      include: [
        'packages/app/src/**/*.{ts,tsx}',
        'packages/extension/src/runtime/**/*.{ts,tsx}',
        'packages/extension/src/views/**/*.{ts,tsx}',
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
