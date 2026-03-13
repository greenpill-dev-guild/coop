import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@coop/shared/contracts': path.resolve(__dirname, '../shared/src/contracts/index.ts'),
      '@coop/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
