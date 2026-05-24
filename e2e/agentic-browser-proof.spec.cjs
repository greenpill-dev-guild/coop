const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir } = require('./helpers/extension-build.cjs');

const repoRoot = path.resolve(__dirname, '..');
const proofDir = path.join(repoRoot, 'output/playwright/agentic-browser-proof');
const reportPath = path.join(proofDir, 'report.json');

function relative(filePath) {
  return path.relative(repoRoot, filePath);
}

function slug(value) {
  return (
    value
      .replace(/^\/+/, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'home'
  );
}

async function captureAriaSnapshot(page, filePath) {
  const body = page.locator('body');
  if (typeof body.ariaSnapshot === 'function') {
    const snapshot = await body.ariaSnapshot({ timeout: 5000 });
    fs.writeFileSync(filePath, `${snapshot}\n`);
    return relative(filePath);
  }

  const fallback = await page.evaluate(() =>
    [...document.querySelectorAll('main, nav, header, button, a, input, textarea, select, [role]')]
      .map((element) => ({
        role: element.getAttribute('role') || element.tagName.toLowerCase(),
        name:
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      }))
      .filter((entry) => entry.role || entry.name)
      .slice(0, 160),
  );
  fs.writeFileSync(filePath.replace(/\.yml$/, '.json'), `${JSON.stringify(fallback, null, 2)}\n`);
  return relative(filePath.replace(/\.yml$/, '.json'));
}

async function captureSurface(page, options) {
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize(options.viewport);
  if (options.reducedMotion) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  }
  await page.goto(options.url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(options.readySelector, { timeout: options.timeout || 15000 });
  await page.waitForTimeout(350);

  const id = `${options.surface}-${slug(options.route || options.url)}-${options.viewport.width}`;
  const screenshotPath = path.join(proofDir, `${id}.png`);
  const ariaPath = path.join(proofDir, `${id}.aria.yml`);

  await page.screenshot({ path: screenshotPath, fullPage: true });
  const accessibilitySummary = await captureAriaSnapshot(page, ariaPath);

  const runtime = await page.evaluate(() => {
    const modelContext = 'modelContext' in navigator ? navigator.modelContext : undefined;
    const declarativeTools = [
      ...document.querySelectorAll('form[toolname], form[tooldescription]'),
    ].map((form) => ({
      name: form.getAttribute('toolname') || '',
      description: form.getAttribute('tooldescription') || '',
    }));
    const roleSummary = [
      ...document.querySelectorAll('main, nav, header, button, a, input, textarea, select, [role]'),
    ]
      .map((element) => ({
        role: element.getAttribute('role') || element.tagName.toLowerCase(),
        name:
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      }))
      .filter((entry) => entry.role || entry.name)
      .slice(0, 120);
    return {
      title: document.title,
      hasMainOrShell: Boolean(
        document.querySelector(
          'main, [role="main"], .popup-app, .coop-shell, .sidepanel-shell, [data-qa="receiver-shell"]',
        ),
      ),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      horizontalOverflow:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) >
        window.innerWidth + 1,
      viewportWidth: window.innerWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      roleSummary,
      webMcp: {
        status:
          Boolean(modelContext) || declarativeTools.length > 0 ? 'detected' : 'not_configured',
        navigatorModelContext: Boolean(modelContext),
        registerToolType: typeof modelContext?.registerTool,
        declarativeTools,
      },
    };
  });

  const consoleErrors = consoleMessages.filter((message) => message.type === 'error');
  const violations = [];
  if (!runtime.hasMainOrShell) violations.push('missing main/shell landmark');
  if (runtime.horizontalOverflow) violations.push('horizontal overflow');
  if (consoleErrors.length) violations.push(`${consoleErrors.length} console error(s)`);
  if (pageErrors.length) violations.push(`${pageErrors.length} page error(s)`);
  if (options.reducedMotion && !runtime.reducedMotion) violations.push('reduced motion not active');

  return {
    surface: options.surface,
    route: options.route || options.url,
    viewport: options.viewport,
    title: runtime.title,
    reducedMotion: runtime.reducedMotion,
    horizontalOverflow: runtime.horizontalOverflow,
    viewportWidth: runtime.viewportWidth,
    scrollWidth: runtime.scrollWidth,
    roleSummary: runtime.roleSummary,
    consoleMessages,
    pageErrors,
    webMcp: runtime.webMcp,
    artifacts: {
      screenshot: relative(screenshotPath),
      accessibilitySummary,
    },
    violations,
  };
}

async function launchExtensionContext() {
  ensureExtensionBuilt();
  const userDataDir = path.join(os.tmpdir(), `coop-agentic-browser-proof-${Date.now()}`);
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  return {
    context,
    extensionId: new URL(worker.url()).host,
    userDataDir,
  };
}

test.describe
  .serial('agentic browser proof report', () => {
    const report = {
      generatedAt: '',
      proofBoundary:
        'Advisory rendered proof for app, receiver PWA, Popup, and Sidepanel surfaces. Runtime WebMCP remains strategy-only unless explicitly approved.',
      surfaces: [],
    };

    test.beforeAll(async ({ isMobile }) => {
      test.skip(
        isMobile,
        'Agentic browser proof runs on the desktop Chromium project and creates its own mobile context.',
      );
      fs.rmSync(proofDir, { recursive: true, force: true });
      fs.mkdirSync(proofDir, { recursive: true });
      report.generatedAt = new Date().toISOString();
    });

    test.afterAll(async () => {
      const hardCount = report.surfaces.reduce(
        (sum, surface) => sum + surface.violations.length,
        0,
      );
      fs.writeFileSync(reportPath, `${JSON.stringify({ ...report, hardCount }, null, 2)}\n`);
    });

    test('captures app and receiver PWA proof', async ({ browser, page }) => {
      const appResult = await captureSurface(page, {
        surface: 'app',
        route: '/',
        url: '/',
        readySelector: 'main, [data-qa="public-install-action"]',
        viewport: { width: 1280, height: 900 },
      });
      report.surfaces.push(appResult);
      expect(appResult.violations).toEqual([]);

      const receiverContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      });
      const receiverPage = await receiverContext.newPage();
      try {
        const receiverResult = await captureSurface(receiverPage, {
          surface: 'receiver-pwa',
          route: '/app/receiver',
          url: '/app/receiver?presentation=pwa&qa=reset,mock-media',
          readySelector: '[data-qa="receiver-shell"]',
          viewport: { width: 390, height: 844 },
          reducedMotion: true,
        });
        report.surfaces.push(receiverResult);
        expect(receiverResult.violations).toEqual([]);
      } finally {
        await receiverContext.close();
      }
    });

    test('captures extension popup and sidepanel proof', async () => {
      const extension = await launchExtensionContext();
      try {
        const popupPage = await extension.context.newPage();
        const popupResult = await captureSurface(popupPage, {
          surface: 'popup',
          route: 'popup.html',
          url: `chrome-extension://${extension.extensionId}/popup.html`,
          readySelector: '.popup-app',
          viewport: { width: 360, height: 520 },
        });
        report.surfaces.push(popupResult);
        await popupPage.close();
        expect(popupResult.violations).toEqual([]);

        const sidepanelPage = await extension.context.newPage();
        const sidepanelResult = await captureSurface(sidepanelPage, {
          surface: 'sidepanel',
          route: 'sidepanel.html',
          url: `chrome-extension://${extension.extensionId}/sidepanel.html`,
          readySelector: '.coop-shell, .sidepanel-shell, [class*="shell"]',
          viewport: { width: 440, height: 800 },
        });
        report.surfaces.push(sidepanelResult);
        await sidepanelPage.close();
        expect(sidepanelResult.violations).toEqual([]);
      } finally {
        await extension.context.close().catch(() => {});
        fs.rmSync(extension.userDataDir, { recursive: true, force: true });
      }
    });
  });
