import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const sharedRootEntry = path.resolve(__dirname, 'packages/shared/src/index.ts');
const sharedBlobChannel = path.resolve(__dirname, 'packages/shared/src/modules/blob/channel.ts');
const sharedTestingFixtures = path.resolve(
  __dirname,
  'packages/shared/src/__tests__/fixtures/index.ts',
);
const coverageEnabled = process.argv.includes('--coverage');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@coop\/shared\/contracts$/,
        replacement: path.resolve(__dirname, 'packages/shared/src/contracts/index.ts'),
      },
      { find: /^@coop\/shared\/blob-channel$/, replacement: sharedBlobChannel },
      { find: /^@coop\/shared\/testing$/, replacement: sharedTestingFixtures },
      { find: /^@coop\/shared$/, replacement: sharedRootEntry },
      { find: /^@coop\/api$/, replacement: path.resolve(__dirname, 'packages/api/config.ts') },
    ],
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
