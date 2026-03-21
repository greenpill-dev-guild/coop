const { defineConfig, devices } = require('@playwright/test');

const attachedDevMode = process.env.COOP_PLAYWRIGHT_DEV === '1';
const appBaseUrl = process.env.COOP_PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3001';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: appBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: attachedDevMode
    ? undefined
    : [
        {
          command: 'bun run --filter @coop/app dev --host 127.0.0.1 --port 3001 --strictPort',
          url: 'http://127.0.0.1:3001',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'HOST=127.0.0.1 PORT=4444 bun run --filter @coop/api dev',
          url: 'http://127.0.0.1:4444',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
