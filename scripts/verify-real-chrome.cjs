#!/usr/bin/env node
/*
 * Headed-Chrome baseline verification for the hackathon submission.
 *
 * Loads the unpacked dist/chrome-mv3 extension into a real installed Chrome
 * (channel: 'chrome', NOT headless), runs:
 *   1. Sandbox CSP probe — `new Function('return 1')()` inside agent-sandbox.html
 *   2. Popup screenshot
 *   3. Sidepanel screenshot
 *   4. Console-error scan across SW + popup + sidepanel + sandbox
 *
 * Output: PNGs under .plans/evidence/<date>-*.png, plus a JSON summary at
 * .plans/evidence/<date>-runtime-summary.json. Caller decides whether to
 * mark task #1 complete based on whether errors[] is empty AND the eval
 * probe returned 1.
 *
 * Errors-panel screenshot (chrome://extensions card) is irreducibly human —
 * the script prints the extension URL so the user can navigate to it.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'packages/extension/dist/chrome-mv3');
const evidenceDir = path.join(rootDir, '.plans/evidence');
const today = new Date().toISOString().slice(0, 10);
const label = process.env.COOP_VERIFY_LABEL || 'baseline';

const popupPng = path.join(evidenceDir, `${today}-popup-${label}.png`);
const sidepanelPng = path.join(evidenceDir, `${today}-sidepanel-${label}.png`);
const sandboxPng = path.join(evidenceDir, `${today}-sandbox-${label}.png`);
const summaryJson = path.join(evidenceDir, `${today}-runtime-summary-${label}.json`);

async function main() {
  if (!fs.existsSync(path.join(extensionDir, 'manifest.json'))) {
    throw new Error(
      `Missing manifest at ${extensionDir}. Run \`cd packages/extension && bun run build\` first.`,
    );
  }
  fs.mkdirSync(evidenceDir, { recursive: true });

  const userDataDir = path.join(os.tmpdir(), `coop-verify-${Date.now()}`);
  const errors = [];
  const consoleByPage = {};
  let extensionId = null;
  let evalProbe = null;
  let sandboxLoaded = false;

  console.log('[verify] Launching real Chrome (channel: chrome, headless: false)');
  console.log(`[verify] Extension dir: ${extensionDir}`);
  console.log(`[verify] User data dir: ${userDataDir}`);

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chrome',
      headless: false,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
      viewport: { width: 1280, height: 720 },
    });
  } catch (launchError) {
    console.error(`[verify] launch failed: ${launchError.message}`);
    console.error(
      `[verify] If 'channel: chrome' is unavailable, retrying with channel: 'chromium'`,
    );
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: false,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
      viewport: { width: 1280, height: 720 },
    });
  }

  const collectError = (label, error) => {
    const message = error?.message ? error.message : String(error);
    errors.push({ surface: label, message });
    console.error(`[verify] ERROR (${label}): ${message}`);
  };

  context.on('weberror', (err) => collectError('context:weberror', err.error()));

  try {
    // Wait for the service worker — first launch can be slow.
    console.log('[verify] Waiting for service worker...');
    let worker = context.serviceWorkers()[0];
    if (!worker) {
      try {
        worker = await context.waitForEvent('serviceworker', { timeout: 60_000 });
      } catch (err) {
        collectError('serviceworker:timeout', err);
      }
    }
    if (worker) {
      extensionId = new URL(worker.url()).host;
      console.log(`[verify] Service worker registered. extensionId=${extensionId}`);
      worker.on('console', (msg) => {
        const entry = `[sw:${msg.type()}] ${msg.text()}`;
        consoleByPage.serviceWorker = consoleByPage.serviceWorker || [];
        consoleByPage.serviceWorker.push(entry);
        if (msg.type() === 'error') {
          errors.push({ surface: 'serviceWorker', message: msg.text() });
        }
      });
      worker.on('pageerror', (err) => collectError('serviceWorker:pageerror', err));
    } else {
      console.error('[verify] No service worker. Cannot derive extensionId; skipping page probes.');
    }

    if (extensionId) {
      // STEP 1 — Sandbox CSP probe (advisor: do this FIRST, before screenshots)
      console.log('[verify] STEP 1: Sandbox CSP probe (new Function probe)');
      const sandboxPage = await context.newPage();
      sandboxPage.on('console', (msg) => {
        const entry = `[sandbox:${msg.type()}] ${msg.text()}`;
        consoleByPage.sandbox = consoleByPage.sandbox || [];
        consoleByPage.sandbox.push(entry);
        if (msg.type() === 'error') {
          errors.push({ surface: 'sandbox', message: msg.text() });
        }
      });
      sandboxPage.on('pageerror', (err) => collectError('sandbox:pageerror', err));
      try {
        await sandboxPage.goto(`chrome-extension://${extensionId}/agent-sandbox.html`, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        sandboxLoaded = true;
        await sandboxPage.waitForTimeout(800);
        evalProbe = await sandboxPage.evaluate(() => {
          try {
            const fn = new Function('return 1');
            return { ok: true, value: fn() };
          } catch (e) {
            return { ok: false, error: e?.message ? e.message : String(e) };
          }
        });
        console.log(`[verify] eval probe: ${JSON.stringify(evalProbe)}`);
        await sandboxPage.screenshot({ path: sandboxPng, fullPage: false });
        console.log(`[verify] saved sandbox screenshot → ${sandboxPng}`);
      } catch (err) {
        collectError('sandbox:goto', err);
      } finally {
        await sandboxPage.close().catch(() => {});
      }

      // STEP 2 — Popup screenshot
      console.log('[verify] STEP 2: Popup screenshot');
      const popupPage = await context.newPage();
      popupPage.on('console', (msg) => {
        const entry = `[popup:${msg.type()}] ${msg.text()}`;
        consoleByPage.popup = consoleByPage.popup || [];
        consoleByPage.popup.push(entry);
        if (msg.type() === 'error') {
          errors.push({ surface: 'popup', message: msg.text() });
        }
      });
      popupPage.on('pageerror', (err) => collectError('popup:pageerror', err));
      try {
        await popupPage.setViewportSize({ width: 420, height: 600 });
        await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        await popupPage.waitForTimeout(1500);
        await popupPage.screenshot({ path: popupPng, fullPage: true });
        console.log(`[verify] saved popup screenshot → ${popupPng}`);
      } catch (err) {
        collectError('popup:goto', err);
      } finally {
        await popupPage.close().catch(() => {});
      }

      // STEP 3 — Sidepanel screenshot
      console.log('[verify] STEP 3: Sidepanel screenshot');
      const sidepanelPage = await context.newPage();
      sidepanelPage.on('console', (msg) => {
        const entry = `[sidepanel:${msg.type()}] ${msg.text()}`;
        consoleByPage.sidepanel = consoleByPage.sidepanel || [];
        consoleByPage.sidepanel.push(entry);
        if (msg.type() === 'error') {
          errors.push({ surface: 'sidepanel', message: msg.text() });
        }
      });
      sidepanelPage.on('pageerror', (err) => collectError('sidepanel:pageerror', err));
      try {
        await sidepanelPage.setViewportSize({ width: 420, height: 800 });
        await sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        await sidepanelPage.waitForTimeout(2000);
        await sidepanelPage.screenshot({ path: sidepanelPng, fullPage: true });
        console.log(`[verify] saved sidepanel screenshot → ${sidepanelPng}`);
      } catch (err) {
        collectError('sidepanel:goto', err);
      } finally {
        await sidepanelPage.close().catch(() => {});
      }
    }
  } finally {
    const summary = {
      timestamp: new Date().toISOString(),
      label,
      extensionId,
      sandboxLoaded,
      evalProbe,
      errorsCount: errors.length,
      errors,
      consoleSurfaces: Object.fromEntries(
        Object.entries(consoleByPage).map(([k, v]) => [k, v.slice(-30)]),
      ),
      artifacts: {
        popupPng,
        sidepanelPng,
        sandboxPng,
      },
    };
    fs.writeFileSync(summaryJson, JSON.stringify(summary, null, 2));
    console.log(`[verify] summary → ${summaryJson}`);
    await context.close().catch(() => {});
  }

  // CRITICAL: report clearly whether the run is clean
  const sandboxOk = evalProbe?.ok && evalProbe.value === 1;
  const errorsClean = errors.length === 0;
  console.log('\n========== VERIFICATION SUMMARY ==========');
  console.log(`Extension ID:    ${extensionId || 'NOT REGISTERED'}`);
  console.log(
    `Sandbox eval:    ${sandboxOk ? 'OK (new Function works)' : `BLOCKED (${JSON.stringify(evalProbe)})`}`,
  );
  console.log(`Errors clean:    ${errorsClean ? 'YES' : `NO (${errors.length} errors)`}`);
  if (!errorsClean) {
    for (const e of errors) console.log(`  - [${e.surface}] ${e.message}`);
  }
  console.log('Artifacts:');
  console.log(`  popup     → ${popupPng}`);
  console.log(`  sidepanel → ${sidepanelPng}`);
  console.log(`  sandbox   → ${sandboxPng}`);
  console.log(`  summary   → ${summaryJson}`);
  console.log('==========================================\n');

  // Exit non-zero if anything is meaningfully broken — caller can gate on this
  if (!extensionId || !sandboxOk || !errorsClean) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[verify] fatal:', err);
  process.exitCode = 2;
});
