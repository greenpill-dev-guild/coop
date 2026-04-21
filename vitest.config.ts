import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const sharedRootEntry = path.resolve(__dirname, 'packages/shared/src/index.ts');
const sharedAppEntry = path.resolve(__dirname, 'packages/shared/src/app-entry.ts');
const sharedSyncConfig = path.resolve(__dirname, 'packages/shared/src/sync-config.ts');
const coverageEnabled = process.argv.includes('--coverage');
const defaultTestTimeoutMs = 20_000;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@coop\/shared\/app$/, replacement: sharedAppEntry },
      {
        find: /^@coop\/shared\/contracts$/,
        replacement: path.resolve(__dirname, 'packages/shared/src/contracts/index.ts'),
      },
      { find: /^@coop\/shared\/sync-config$/, replacement: sharedSyncConfig },
      { find: /^@coop\/shared$/, replacement: sharedRootEntry },
      { find: /^@coop\/api$/, replacement: path.resolve(__dirname, 'packages/api/config.ts') },
    ],
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: coverageEnabled ? false : undefined,
    // Several Dexie, privacy, and popup integration suites are legitimately
    // slower than 10s under parallel smoke/core-loop validation.
    testTimeout: defaultTestTimeoutMs,
    hookTimeout: defaultTestTimeoutMs,
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
        // Orphaned duplicate of runtime/agent/runner-skills-*.ts. Zero external
        // consumers (see .plans/features/production-readiness/eval/implementation-notes.md
        // 2026-04-19 entry). Excluded from the staged-launch coverage gate;
        // flagged for deletion in a follow-up source-ownership lane.
        'packages/extension/src/runtime/skills/**',
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
