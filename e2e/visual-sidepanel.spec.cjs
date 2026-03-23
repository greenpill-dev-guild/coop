const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir } = require('./helpers/extension-build.cjs');

const closeTimeoutMs = 5000;

function withTimeout(promise, timeoutMs, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function isBenignCloseError(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.code === 'ENOENT') return true;
  return (
    error instanceof Error &&
    /Target page, context or browser has been closed|Browser has been closed/i.test(error.message)
  );
}

async function closeContextSafely(context) {
  if (!context) return;
  try {
    await Promise.allSettled(
      context.pages().map((page) =>
        withTimeout(page.close(), closeTimeoutMs, 'page.close').catch((error) => {
          if (!isBenignCloseError(error)) throw error;
        }),
      ),
    );
    await withTimeout(
      context.close({ reason: 'visual test teardown' }),
      closeTimeoutMs,
      'context.close',
    );
  } catch (error) {
    if (isBenignCloseError(error)) return;
    const browser = context.browser();
    if (!browser) throw error;
    try {
      await withTimeout(browser.close({ reason: 'force teardown' }), closeTimeoutMs);
    } catch (browserError) {
      if (!isBenignCloseError(browserError)) throw browserError;
    }
  }
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    document.body.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
    document.body.style.colorScheme = t;
  }, theme);
  await page.waitForTimeout(200);
}

async function openPanelTab(page, name) {
  await page.getByRole('tab', { name, exact: true }).click();
  await page.waitForTimeout(300);
}

test.describe('sidepanel visual snapshots', () => {
  test.describe.configure({ timeout: 120_000 });

  test.skip(
    ({ isMobile }) => isMobile,
    'Extension visual tests run only on the desktop Chromium project.',
  );

  let context;
  let page;
  let extensionId;

  test.beforeAll(async () => {
    ensureExtensionBuilt();

    const userDataDir = path.join(os.tmpdir(), `coop-visual-sidepanel-${Date.now()}`);
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
    });

    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    extensionId = new URL(worker.url()).host;
  });

  test.afterAll(async () => {
    await closeContextSafely(context);
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    await page.setViewportSize({ width: 440, height: 800 });
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.coop-shell, .sidepanel-shell, [class*="shell"]', {
      timeout: 10_000,
    });
  });

  test.afterEach(async () => {
    if (page) {
      await page.close().catch(() => {});
    }
  });

  const tabs = ['Roost', 'Chickens', 'Coops', 'Nest'];

  for (const theme of ['light', 'dark']) {
    for (const tab of tabs) {
      test(`${tab} tab – ${theme}`, async () => {
        await setTheme(page, theme);
        // The first tab (Roost) is selected by default; click others
        if (tab !== 'Roost') {
          await openPanelTab(page, tab);
        }
        await expect(page).toHaveScreenshot(`sidepanel-${tab.toLowerCase()}-${theme}.png`);
      });
    }
  }
});
