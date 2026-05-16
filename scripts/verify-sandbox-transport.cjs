#!/usr/bin/env node
/*
 * Sandbox iframe transport probe.
 *
 * We dropped `allow-same-origin` from the sandbox CSP (commit cb34004) to
 * satisfy MV3's ban on combining it with `'unsafe-eval'`. Sandbox iframes
 * without `allow-same-origin` run as a unique opaque origin. That means:
 *
 *   - blob: URLs created in the parent context may not be fetchable from
 *     inside the sandbox
 *   - chrome-extension:// URLs may or may not be fetchable
 *   - data: URLs SHOULD always work because they're inline
 *
 * This probe tests all three, so we know which transport to use when
 * stamping observation.payload.imageUrl for the demo arc.
 *
 * Loads the unpacked extension, opens agent-sandbox.html, and runs each
 * fetch from inside that frame. Reports results to stdout and writes a
 * JSON summary to .plans/evidence/2026-05-16-sandbox-transport-probe.json.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'packages/extension/dist/chrome-mv3');
const evidenceDir = path.join(rootDir, '.plans/evidence');
const summaryJson = path.join(evidenceDir, '2026-05-16-sandbox-transport-probe.json');

async function main() {
  if (!fs.existsSync(path.join(extensionDir, 'manifest.json'))) {
    throw new Error(`Missing manifest at ${extensionDir}. Build first.`);
  }
  fs.mkdirSync(evidenceDir, { recursive: true });

  const userDataDir = path.join(os.tmpdir(), `coop-transport-${Date.now()}`);
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chrome',
      headless: false,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
      viewport: { width: 1280, height: 720 },
    });
  } catch {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: false,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
      viewport: { width: 1280, height: 720 },
    });
  }

  const results = {
    timestamp: new Date().toISOString(),
    extensionId: null,
    probes: {},
  };

  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 60_000 });
    results.extensionId = new URL(worker.url()).host;

    // Create a parent page that will mint a blob URL we then try to fetch
    // from inside the sandbox.
    const parent = await context.newPage();
    await parent.goto(`chrome-extension://${results.extensionId}/popup.html`, {
      waitUntil: 'domcontentloaded',
    });

    // Mint a blob URL in the parent (popup) context — this is the typical
    // path a "Screenshot" or "Audio" capture would take.
    const parentBlobUrl = await parent.evaluate(() => {
      const blob = new Blob(['hello from parent'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      return url;
    });
    console.log(`[transport] parent minted blob URL: ${parentBlobUrl}`);

    // A data URL for a 1x1 PNG (always works, control)
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    // Now open the sandbox and run the fetches from there
    const sandboxPage = await context.newPage();
    await sandboxPage.goto(`chrome-extension://${results.extensionId}/agent-sandbox.html`, {
      waitUntil: 'domcontentloaded',
    });
    await sandboxPage.waitForTimeout(500);

    // Probe 1: chrome-extension:// URL (control — same scheme, sandbox origin)
    results.probes.chromeExtensionUrl = await sandboxPage.evaluate(async (url) => {
      try {
        const r = await fetch(url);
        return { ok: r.ok, status: r.status };
      } catch (e) {
        return { error: e?.message ? e.message : String(e) };
      }
    }, `chrome-extension://${results.extensionId}/icons/icon-128.png`);
    console.log(
      `[transport] chrome-extension URL: ${JSON.stringify(results.probes.chromeExtensionUrl)}`,
    );

    // Probe 2: blob URL minted in parent context (the risky one)
    results.probes.parentBlobUrl = await sandboxPage.evaluate(async (url) => {
      try {
        const r = await fetch(url);
        const text = r.ok ? await r.text() : null;
        return { ok: r.ok, status: r.status, text };
      } catch (e) {
        return { error: e?.message ? e.message : String(e) };
      }
    }, parentBlobUrl);
    console.log(`[transport] parent blob URL: ${JSON.stringify(results.probes.parentBlobUrl)}`);

    // Probe 3: data URL (control — should always work)
    results.probes.dataUrl = await sandboxPage.evaluate(async (url) => {
      try {
        const r = await fetch(url);
        return { ok: r.ok, status: r.status, contentType: r.headers.get('content-type') };
      } catch (e) {
        return { error: e?.message ? e.message : String(e) };
      }
    }, dataUrl);
    console.log(`[transport] data URL: ${JSON.stringify(results.probes.dataUrl)}`);

    // Probe 4: blob URL minted INSIDE the sandbox (worker creates its own)
    results.probes.sandboxBlobUrl = await sandboxPage.evaluate(async () => {
      try {
        const blob = new Blob(['hello from sandbox'], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const r = await fetch(url);
        const text = r.ok ? await r.text() : null;
        URL.revokeObjectURL(url);
        return { ok: r.ok, status: r.status, text };
      } catch (e) {
        return { error: e?.message ? e.message : String(e) };
      }
    });
    console.log(
      `[transport] sandbox-minted blob URL: ${JSON.stringify(results.probes.sandboxBlobUrl)}`,
    );

    // Probe 5: origin and document.domain to confirm sandboxing posture
    results.probes.origin = await sandboxPage.evaluate(() => ({
      origin: location.origin,
      href: location.href,
      isSecureContext: window.isSecureContext,
    }));
    console.log(`[transport] sandbox origin: ${JSON.stringify(results.probes.origin)}`);

    await parent.close().catch(() => {});
    await sandboxPage.close().catch(() => {});
  } finally {
    fs.writeFileSync(summaryJson, JSON.stringify(results, null, 2));
    console.log(`[transport] wrote summary → ${summaryJson}`);
    await context.close().catch(() => {});
  }

  console.log('\n========== TRANSPORT PROBE SUMMARY ==========');
  console.log(`Extension ID:           ${results.extensionId}`);
  console.log(`Sandbox origin:         ${results.probes.origin?.origin}`);
  console.log(
    `chrome-extension URL:   ${results.probes.chromeExtensionUrl?.ok ? 'WORKS' : 'BLOCKED'}`,
  );
  console.log(`parent-minted blob URL: ${results.probes.parentBlobUrl?.ok ? 'WORKS' : 'BLOCKED'}`);
  console.log(`data: URL:              ${results.probes.dataUrl?.ok ? 'WORKS' : 'BLOCKED'}`);
  console.log(`sandbox-minted blob:    ${results.probes.sandboxBlobUrl?.ok ? 'WORKS' : 'BLOCKED'}`);
  console.log('=============================================\n');

  if (!results.probes.parentBlobUrl?.ok && !results.probes.chromeExtensionUrl?.ok) {
    console.log('CONCLUSION: must use data: URLs (inline base64) for image transport,');
    console.log('or send binary across postMessage and let the sandbox mint its own blob URL.');
  } else if (!results.probes.parentBlobUrl?.ok) {
    console.log('CONCLUSION: parent blob URLs are blocked; pass binary via postMessage.');
  } else {
    console.log('CONCLUSION: parent blob URLs work; image stamping can use URL.createObjectURL.');
  }
}

main().catch((err) => {
  console.error('[transport] fatal:', err);
  process.exitCode = 2;
});
