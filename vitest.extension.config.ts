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
    include: ['packages/extension/src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    globals: true,
    coverage: {
      provider: 'v8',
      all: true,
      include: [
        'packages/extension/src/background/**/*.{ts,tsx}',
        'packages/extension/src/runtime/**/*.{ts,tsx}',
        'packages/extension/src/views/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        'packages/extension/src/**/index.ts',
        'packages/extension/src/**/main.tsx',
        'packages/extension/src/runtime/agent-runner.ts',
        'packages/extension/src/runtime/inference-worker.ts',
        'packages/extension/src/runtime/agent-webllm-bridge.ts',
        'packages/extension/src/runtime/agent-webllm-worker.ts',
        'packages/extension/src/runtime/agent-config.ts',
        'packages/extension/src/runtime/agent-models.ts',
        'packages/extension/src/runtime/inference-bridge.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
