const { defineConfig, devices } = require('@playwright/test');

const attachedDevMode = process.env.COOP_PLAYWRIGHT_DEV === '1';
const reuseExistingServer = process.env.COOP_PLAYWRIGHT_REUSE_EXISTING_SERVER === '1';
const appOnlyWebServer = process.env.COOP_PLAYWRIGHT_APP_ONLY === '1';
const appPort = process.env.COOP_PLAYWRIGHT_APP_PORT || process.env.COOP_DEV_APP_PORT || '3001';
const apiPort = process.env.COOP_PLAYWRIGHT_API_PORT || process.env.COOP_DEV_API_PORT || '4444';
const appBaseUrl = process.env.COOP_PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${appPort}`;
const webServers = [
  {
    command: `bun run --filter @coop/app dev --host 127.0.0.1 --port ${appPort} --strictPort`,
    url: `http://127.0.0.1:${appPort}`,
    reuseExistingServer,
    timeout: 120_000,
  },
];

if (!appOnlyWebServer) {
  webServers.push({
    command: `HOST=127.0.0.1 PORT=${apiPort} bun run --filter @coop/api dev`,
    url: `http://127.0.0.1:${apiPort}`,
    reuseExistingServer,
    timeout: 120_000,
  });
}

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: appBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
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
  webServer: attachedDevMode ? undefined : webServers,
});
