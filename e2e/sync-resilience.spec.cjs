const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir } = require('./helpers/extension-build.cjs');
const { createMockMemberIdentity } = require('./helpers/mock-auth.cjs');

const closeTimeoutMs = 15_000;
const degradedSyncNote =
  'No signaling server connection. Shared sync is currently limited to this browser profile.';

function withTimeout(promise, timeoutMs, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function isBenignCloseError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if (error.code === 'ENOENT') {
    return true;
  }

  return (
    error instanceof Error &&
    /Target page, context or browser has been closed|Browser has been closed/i.test(error.message)
  );
}

async function closeContextSafely(context) {
  if (!context) {
    return;
  }

  try {
    await Promise.allSettled(
      context.pages().map((page) =>
        withTimeout(page.close(), closeTimeoutMs, 'sync resilience page.close').catch((error) => {
          if (!isBenignCloseError(error)) {
            throw error;
          }
        }),
      ),
    );

    await withTimeout(
      context.close({ reason: 'sync resilience e2e teardown' }),
      closeTimeoutMs,
      'sync resilience context.close',
    );
  } catch (error) {
    if (isBenignCloseError(error)) {
      return;
    }

    const browser = context.browser();
    if (!browser) {
      throw error;
    }

    try {
      await withTimeout(
        browser.close({ reason: 'force sync resilience e2e teardown' }),
        closeTimeoutMs,
        'sync resilience browser.close fallback',
      );
    } catch (browserError) {
      if (isBenignCloseError(browserError)) {
        return;
      }
      throw browserError;
    }
  }
}

function syncCoopPayload(coopName) {
  return {
    coopName,
    purpose: 'Keep sync state legible across popup reloads and recovery flows.',
    creatorDisplayName: 'Sync Tester',
    captureMode: 'manual',
    seedContribution: 'I bring deterministic sync health coverage for popup recovery.',
    setupInsights: {
      summary: 'Need explicit browser coverage for sync degradation and recovery.',
      crossCuttingPainPoints: [
        'Degraded sync states can regress without a browser-backed popup check.',
      ],
      crossCuttingOpportunities: [
        'Persist runtime health and verify the popup rehydrates it after reload.',
      ],
      lenses: [
        {
          lens: 'capital-formation',
          currentState: 'Shared opportunity routing depends on local-first sync health.',
          painPoints: 'Transport regressions can look healthy until a member reloads the popup.',
          improvements: 'Verify degraded and recovered sync states in a real extension session.',
        },
        {
          lens: 'impact-reporting',
          currentState: 'Members need accurate sync visibility before publishing evidence.',
          painPoints: 'Local-only fallbacks are easy to miss without browser coverage.',
          improvements: 'Surface signaling degradation directly in the popup status badge.',
        },
        {
          lens: 'governance-coordination',
          currentState: 'Weekly review depends on shared state surviving popup reopen.',
          painPoints: 'A reopened popup can hide stale runtime-health state.',
          improvements: 'Confirm the popup rehydrates sync warnings after reopen.',
        },
        {
          lens: 'knowledge-garden-resources',
          currentState: 'Members trust the popup to explain when sync is local-only.',
          painPoints: 'Recovery paths need explicit rehearsal after a degraded period.',
          improvements: 'Reset runtime health and confirm the popup returns to healthy state.',
        },
      ],
    },
  };
}

async function launchPopupProfile(userDataDir) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });

  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 360, height: 520 });
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.waitForLoadState('domcontentloaded');
  await popupPage.waitForSelector('.popup-app', { timeout: 30_000 });

  return {
    context,
    extensionId,
    popupPage,
  };
}

async function openPopup(context, extensionId) {
  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 360, height: 520 });
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.waitForLoadState('domcontentloaded');
  await popupPage.waitForSelector('.popup-app', { timeout: 30_000 });
  return popupPage;
}

async function seedSyncCoop(popupPage, coopName) {
  const { member: creator, session } = createMockMemberIdentity({
    displayName: 'Sync Tester',
    role: 'creator',
  });
  const authResponse = await popupPage.evaluate(async (payload) => {
    return chrome.runtime.sendMessage({
      type: 'set-auth-session',
      payload,
    });
  }, session);

  if (!authResponse?.ok) {
    throw new Error(authResponse?.error ?? 'Could not seed sync resilience auth session.');
  }

  const response = await popupPage.evaluate(
    async (payload) => {
      return chrome.runtime.sendMessage({
        type: 'create-coop',
        payload,
      });
    },
    { ...syncCoopPayload(coopName), creator },
  );

  if (!response?.ok) {
    throw new Error(response?.error ?? 'Could not create sync resilience test coop.');
  }

  await popupPage.reload();
  await popupPage.waitForLoadState('domcontentloaded');
  await popupPage.waitForSelector('.popup-app', { timeout: 30_000 });
}

async function reportSyncHealth(popupPage, payload) {
  const response = await popupPage.evaluate(async (message) => {
    return chrome.runtime.sendMessage({
      type: 'report-sync-health',
      payload: message,
    });
  }, payload);

  if (!response?.ok) {
    throw new Error(response?.error ?? 'Could not update runtime sync health.');
  }
}

async function getDashboard(popupPage) {
  const response = await popupPage.evaluate(async () => {
    return chrome.runtime.sendMessage({ type: 'get-dashboard' });
  });

  return response?.ok ? response.data : null;
}

test.describe('sync resilience', () => {
  test.describe.configure({ timeout: 120_000 });

  test.skip(
    ({ isMobile }) => isMobile,
    'Sync resilience automation runs only on the desktop Chromium project.',
  );

  test.beforeAll(() => {
    ensureExtensionBuilt();
  });

  test('persists degraded local-only sync status across popup reopen and recovers cleanly', async () => {
    const profile = await launchPopupProfile(
      path.join(os.tmpdir(), `coop-sync-resilience-${Date.now()}`),
    );

    try {
      await seedSyncCoop(profile.popupPage, `Sync Resilience ${Date.now()}`);
      await expect(profile.popupPage.getByText('Idle', { exact: true })).toBeVisible({
        timeout: 30_000,
      });

      await reportSyncHealth(profile.popupPage, {
        syncError: true,
        note: degradedSyncNote,
      });
      await profile.popupPage.reload();
      await profile.popupPage.waitForLoadState('domcontentloaded');

      await expect(profile.popupPage.getByText('Local', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect
        .poll(async () => (await getDashboard(profile.popupPage))?.summary?.syncDetail)
        .toBe(degradedSyncNote);

      await profile.popupPage.close();
      const reopenedPopup = await openPopup(profile.context, profile.extensionId);

      await expect(reopenedPopup.getByText('Local', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect
        .poll(async () => (await getDashboard(reopenedPopup))?.summary?.syncDetail)
        .toBe(degradedSyncNote);

      await reportSyncHealth(reopenedPopup, {
        syncError: false,
      });
      await reopenedPopup.reload();
      await reopenedPopup.waitForLoadState('domcontentloaded');

      await expect(reopenedPopup.getByText('Idle', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect
        .poll(async () => (await getDashboard(reopenedPopup))?.summary?.syncLabel)
        .toBe('Healthy');
    } finally {
      await closeContextSafely(profile.context);
    }
  });
});
