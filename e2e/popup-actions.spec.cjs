const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir } = require('./helpers/extension-build.cjs');

const closeTimeoutMs = 15_000;
const appBaseUrl =
  process.env.COOP_PLAYWRIGHT_BASE_URL ||
  `http://127.0.0.1:${process.env.COOP_PLAYWRIGHT_APP_PORT || process.env.COOP_DEV_APP_PORT || '3001'}`;

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

  const browser = context.browser();

  try {
    await Promise.allSettled(
      context.pages().map((page) =>
        withTimeout(page.close(), closeTimeoutMs, 'popup actions page.close').catch((error) => {
          if (!isBenignCloseError(error)) {
            throw error;
          }
        }),
      ),
    );

    await withTimeout(
      context.close({ reason: 'popup actions e2e teardown' }),
      closeTimeoutMs,
      'popup actions context.close',
    );

    if (browser) {
      await withTimeout(
        browser.close({ reason: 'popup actions browser.close post-context teardown' }),
        closeTimeoutMs,
        'popup actions browser.close',
      ).catch((error) => {
        if (!isBenignCloseError(error)) {
          throw error;
        }
      });
    }
  } catch (error) {
    if (isBenignCloseError(error)) {
      return;
    }

    if (!browser) {
      throw error;
    }

    try {
      await withTimeout(
        browser.close({ reason: 'force popup actions e2e teardown' }),
        closeTimeoutMs,
        'popup actions browser.close fallback',
      );
    } catch (browserError) {
      if (
        isBenignCloseError(browserError) ||
        (browserError instanceof Error && browserError.message.includes('timed out'))
      ) {
        return;
      }
      throw browserError;
    }
  }
}

function popupCoopPayload(coopName) {
  return {
    coopName,
    purpose: 'Keep popup actions reliable across capture, save, and review flows.',
    creatorDisplayName: 'Popup Tester',
    captureMode: 'manual',
    seedContribution: 'I bring popup action coverage and persistence checks.',
    setupInsights: {
      summary: 'Need stable popup action coverage for capture, notes, and review persistence.',
      crossCuttingPainPoints: ['Popup flows have less browser-level action coverage than sidepanel flows.'],
      crossCuttingOpportunities: ['Exercise popup actions in a real extension session before releases.'],
      lenses: [
        {
          lens: 'capital-formation',
          currentState: 'Popup smoke flows are lightly rehearsed in Chrome.',
          painPoints: 'Capture regressions are easy to miss without browser coverage.',
          improvements: 'Run popup smoke actions against a live extension profile.',
        },
        {
          lens: 'impact-reporting',
          currentState: 'Popup persistence confidence comes mostly from unit tests.',
          painPoints: 'Saved captures need browser-backed confirmation.',
          improvements: 'Verify receiver intake and draft state through the runtime dashboard.',
        },
        {
          lens: 'governance-coordination',
          currentState: 'Popup workflows are reviewed manually.',
          painPoints: 'Failures can leave the popup in a broken state.',
          improvements: 'Confirm the popup still accepts follow-up actions after errors.',
        },
        {
          lens: 'knowledge-garden-resources',
          currentState: 'Local notes and files are checked piecemeal.',
          painPoints: 'Review dialogs need save and cancel confidence in the browser.',
          improvements: 'Cover screenshot, file, and audio edge states end to end.',
        },
      ],
    },
  };
}

async function getDashboard(page) {
  const response = await page.evaluate(async () =>
    chrome.runtime.sendMessage({ type: 'get-dashboard' }),
  );
  return response?.ok ? response.data : null;
}

async function seedPopupCoop(popupPage, coopName) {
  const response = await popupPage.evaluate(async (payload) => {
    return chrome.runtime.sendMessage({
      type: 'create-coop',
      payload,
    });
  }, popupCoopPayload(coopName));

  if (!response?.ok) {
    throw new Error(response?.error ?? 'Could not create popup test coop.');
  }

  const creator = response.data?.members?.[0];
  if (!creator?.address || !creator?.displayName) {
    throw new Error('Popup smoke seed coop did not return a creator member.');
  }

  const authResponse = await popupPage.evaluate(async (payload) => {
    return chrome.runtime.sendMessage({
      type: 'set-auth-session',
      payload,
    });
  }, {
    authMode: creator.authMode ?? 'passkey',
    createdAt: new Date().toISOString(),
    displayName: creator.displayName,
    identityWarning:
      creator.identityWarning ??
      `${creator.displayName}'s passkey is stored on this device profile. Clearing extension data may remove access to this account.`,
    primaryAddress: creator.address,
  });

  if (!authResponse?.ok) {
    throw new Error(authResponse?.error ?? 'Could not seed popup auth session.');
  }

  await popupPage.reload();
  await popupPage.waitForLoadState('domcontentloaded');
  await popupPage.waitForSelector('.popup-app', { timeout: 30_000 });
  await expect(popupPage.getByRole('button', { name: 'Roundup Chickens' })).toBeVisible({
    timeout: 30_000,
  });
}

async function launchPopupProfile(userDataDir, options = {}) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });

  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const popupPage = await context.newPage();

  if (typeof options.beforePopupLoad === 'function') {
    await options.beforePopupLoad(popupPage);
  }

  await popupPage.setViewportSize({ width: 360, height: 520 });
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.waitForLoadState('domcontentloaded');
  await popupPage.waitForSelector('.popup-app', { timeout: 30_000 });

  return {
    context,
    extensionId,
    popupPage,
    worker,
  };
}

async function openStandardPage(context, suffix = '') {
  const page = await context.newPage();
  const targetUrl = `${appBaseUrl}/manual-roundup-fixture.html${suffix}`;
  await page.goto(targetUrl);
  await page.waitForLoadState('domcontentloaded');
  await page.bringToFront();
  return page;
}

async function goHome(popupPage) {
  const homeButton = popupPage.getByRole('button', { name: 'Home' });
  if (await homeButton.count()) {
    await homeButton.click();
  }
}

async function waitForDraftCount(popupPage, count) {
  await expect
    .poll(async () => (await getDashboard(popupPage))?.drafts.length ?? 0, {
      timeout: 30_000,
    })
    .toBe(count);
}

async function waitForReceiverIntakeCount(popupPage, count) {
  await expect
    .poll(async () => (await getDashboard(popupPage))?.receiverIntake.length ?? 0, {
      timeout: 30_000,
    })
    .toBe(count);
}

async function clickWithoutFocusing(locator) {
  await locator.evaluate((button) => button.click());
}

test.describe('popup action smoke', () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    ({ isMobile }) => isMobile,
    'Popup action automation runs only on the desktop Chromium project.',
  );

  test.beforeAll(() => {
    ensureExtensionBuilt();
  });

  test('rounds up one page and captures a second active tab into popup drafts', async () => {
    test.fixme(
      true,
      'Playwright cannot drive Chrome’s real action popup as a page, and a tab-backed popup.html session does not reproduce popup roundup/capture dispatch faithfully enough for this smoke case yet.',
    );

    const profile = await launchPopupProfile(
      path.join(os.tmpdir(), `coop-popup-actions-roundup-${Date.now()}`),
    );

    try {
      await seedPopupCoop(profile.popupPage, `Popup Smoke ${Date.now()}`);
      await openStandardPage(profile.context, '?roundup=1');

      await expect
        .poll(async () => (await getDashboard(profile.popupPage))?.drafts.length ?? 0)
        .toBe(0);

      await clickWithoutFocusing(
        profile.popupPage.getByRole('button', { name: 'Roundup Chickens' }),
      );
      await waitForDraftCount(profile.popupPage, 1);
      await expect
        .poll(async () => {
          return (await getDashboard(profile.popupPage))?.drafts[0]?.title ?? '';
        })
        .toContain('Funding roundup for Coop Town Test');

      await openStandardPage(profile.context, '?active-tab=1');
      await goHome(profile.popupPage);
      await clickWithoutFocusing(profile.popupPage.getByRole('button', { name: 'Capture Tab' }));
      await waitForDraftCount(profile.popupPage, 2);
    } finally {
      await closeContextSafely(profile.context);
    }
  });

  test('opens screenshot review, supports cancel, and saves edited screenshot context', async () => {
    test.fixme(
      true,
      'prepare-visible-screenshot requires the real action-popup activeTab grant, which is not available from the tab-backed popup.html harness Playwright can access here.',
    );

    const profile = await launchPopupProfile(
      path.join(os.tmpdir(), `coop-popup-actions-screenshot-${Date.now()}`),
    );

    try {
      await seedPopupCoop(profile.popupPage, `Popup Screenshot ${Date.now()}`);
      const targetPage = await openStandardPage(profile.context, '?screenshot=1');

      await clickWithoutFocusing(profile.popupPage.getByRole('button', { name: 'Screenshot' }));
      await profile.popupPage.bringToFront();
      await expect(profile.popupPage.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
      await profile.popupPage.getByRole('button', { name: 'Cancel' }).click();
      await expect(profile.popupPage.getByRole('dialog')).toHaveCount(0);

      await targetPage.bringToFront();
      await clickWithoutFocusing(profile.popupPage.getByRole('button', { name: 'Screenshot' }));
      await profile.popupPage.bringToFront();
      await expect(profile.popupPage.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
      await profile.popupPage.getByRole('textbox', { name: 'Title' }).fill('Popup screenshot proof');
      await profile.popupPage
        .getByRole('textbox', { name: 'Context' })
        .fill('Captured from the browser smoke suite for popup persistence coverage.');
      await profile.popupPage.getByRole('button', { name: 'Save to Pocket Coop' }).click();

      await expect(
        profile.popupPage.getByText('Screenshot saved to Pocket Coop finds.'),
      ).toBeVisible({
        timeout: 30_000,
      });
      await expect(profile.popupPage.getByRole('dialog')).toHaveCount(0);
    } finally {
      await closeContextSafely(profile.context);
    }
  });

  test('opens file review, supports cancel, and saves the reviewed file to receiver intake', async () => {
    const profile = await launchPopupProfile(
      path.join(os.tmpdir(), `coop-popup-actions-file-${Date.now()}`),
    );

    try {
      await seedPopupCoop(profile.popupPage, `Popup File ${Date.now()}`);

      const fileInput = profile.popupPage.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'popup-notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Popup file capture that should persist after review.'),
      });

      await expect(profile.popupPage.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
      await profile.popupPage.getByRole('button', { name: 'Cancel' }).click();
      await expect(profile.popupPage.getByRole('dialog')).toHaveCount(0);

      await fileInput.setInputFiles({
        name: 'popup-notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Popup file capture that should persist after review.'),
      });

      await expect(profile.popupPage.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
      await profile.popupPage.getByRole('textbox', { name: 'Title' }).fill('Popup file proof');
      await profile.popupPage
        .getByRole('textbox', { name: 'Context' })
        .fill('Reviewed and saved from the popup browser smoke suite.');
      await profile.popupPage.getByRole('button', { name: 'Save to Pocket Coop' }).click();

      await waitForReceiverIntakeCount(profile.popupPage, 1);
      await expect(profile.popupPage.getByRole('dialog')).toHaveCount(0);
    } finally {
      await closeContextSafely(profile.context);
    }
  });

  test('shows microphone denial recovery and retries the popup recording request', async () => {
    const profile = await launchPopupProfile(
      path.join(os.tmpdir(), `coop-popup-actions-audio-${Date.now()}`),
      {
        beforePopupLoad: async (popupPage) => {
          await popupPage.addInitScript(() => {
            globalThis.__coopGetUserMediaCalls = 0;

            Object.defineProperty(navigator, 'mediaDevices', {
              configurable: true,
              value: {
                getUserMedia: async () => {
                  globalThis.__coopGetUserMediaCalls += 1;
                  const error = new Error('NotAllowedError');
                  error.name = 'NotAllowedError';
                  throw error;
                },
              },
            });

            Object.defineProperty(globalThis, 'MediaRecorder', {
              configurable: true,
              value: class FakeMediaRecorder {},
            });
          });
        },
      },
    );

    try {
      await seedPopupCoop(profile.popupPage, `Popup Audio ${Date.now()}`);
      await profile.popupPage.getByRole('button', { name: 'Audio' }).click();

      await expect(profile.popupPage.getByText('Microphone access needed')).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        profile.popupPage.getByText('Microphone access was denied. Allow it and try again.'),
      ).toBeVisible();

      await profile.popupPage.getByRole('button', { name: 'Try Again' }).click();
      await expect
        .poll(
          async () =>
            await profile.popupPage.evaluate(() => globalThis.__coopGetUserMediaCalls ?? 0),
          { timeout: 30_000 },
        )
        .toBe(2);
      await expect(profile.popupPage.getByRole('button', { name: 'Retry Audio' })).toBeVisible();
    } finally {
      await closeContextSafely(profile.context);
    }
  });

  test('stays usable after a failed popup capture action', async () => {
    const profile = await launchPopupProfile(
      path.join(os.tmpdir(), `coop-popup-actions-recovery-${Date.now()}`),
    );

    try {
      await seedPopupCoop(profile.popupPage, `Popup Recovery ${Date.now()}`);
      await profile.popupPage.bringToFront();

      await profile.popupPage.getByRole('button', { name: 'Capture Tab' }).click();
      await expect(
        profile.popupPage.getByText('Open a standard web page before capturing this tab.'),
      ).toBeVisible({
        timeout: 30_000,
      });

      await profile.popupPage.getByRole('textbox', { name: 'Note' }).fill(
        'Popup still accepts notes after a failed capture attempt.',
      );
      await profile.popupPage.getByRole('button', { name: 'Save note' }).click();

      await expect(profile.popupPage.getByText('Note hatched into your roost.')).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await closeContextSafely(profile.context);
    }
  });
});
