const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir } = require('./helpers/extension-build.cjs');
const { createMockMemberIdentity } = require('./helpers/mock-auth.cjs');

const closeTimeoutMs = 15_000;
const popupSnapshotKey = 'coop:popup-snapshot';
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

function isTransientNavigationError(error) {
  return (
    error instanceof Error &&
    /ERR_EMPTY_RESPONSE|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_CONNECTION_REFUSED|ERR_FAILED/i.test(
      error.message,
    )
  );
}

async function gotoWithRetry(page, url, attempts = 5) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      lastError = error;
      if (!isTransientNavigationError(error) || attempt === attempts) {
        throw error;
      }
      await page.waitForTimeout(Math.min(250 * attempt, 1000));
    }
  }

  throw lastError ?? new Error(`Could not navigate to ${url}.`);
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
      crossCuttingPainPoints: [
        'Popup flows have less browser-level action coverage than sidepanel flows.',
      ],
      crossCuttingOpportunities: [
        'Exercise popup actions in a real extension session before releases.',
      ],
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

async function getAgentDashboard(page) {
  const response = await page.evaluate(async () =>
    chrome.runtime.sendMessage({ type: 'get-agent-dashboard' }),
  );
  return response?.ok ? response.data : null;
}

async function getPopupSnapshot(page) {
  return page.evaluate(async (storageKey) => {
    const result = await chrome.storage.local.get(storageKey);
    return result[storageKey] ?? null;
  }, popupSnapshotKey);
}

async function waitForDashboardValue(page, select, timeoutMs = 30000, label = 'dashboard value') {
  const startedAt = Date.now();
  let lastDashboard = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastDashboard = await getDashboard(page);
    if (lastDashboard) {
      const value = select(lastDashboard);
      if (value) {
        return value;
      }
    }
    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

async function waitForPopupSnapshotValue(
  page,
  select,
  timeoutMs = 30000,
  label = 'popup snapshot value',
) {
  const startedAt = Date.now();
  let lastSnapshot = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastSnapshot = await getPopupSnapshot(page);
    if (lastSnapshot) {
      const value = select(lastSnapshot);
      if (value) {
        return value;
      }
    }
    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for ${label}. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

async function seedPopupCoop(popupPage, coopName) {
  const { member: creator, session } = createMockMemberIdentity({
    displayName: 'Popup Tester',
    role: 'creator',
  });
  const authResponse = await popupPage.evaluate(async (payload) => {
    return chrome.runtime.sendMessage({
      type: 'set-auth-session',
      payload,
    });
  }, session);

  if (!authResponse?.ok) {
    throw new Error(authResponse?.error ?? 'Could not seed popup auth session.');
  }

  const response = await popupPage.evaluate(
    async (payload) => {
      return chrome.runtime.sendMessage({
        type: 'create-coop',
        payload,
      });
    },
    { ...popupCoopPayload(coopName), creator },
  );

  if (!response?.ok) {
    throw new Error(response?.error ?? 'Could not create popup test coop.');
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
  await gotoWithRetry(page, targetUrl);
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
  await waitForDashboardValue(
    popupPage,
    (dashboard) => ((dashboard?.drafts.length ?? 0) === count ? count : null),
    30_000,
    `popup draft count ${count}`,
  );
}

async function waitForReceiverIntakeCount(popupPage, count) {
  await waitForDashboardValue(
    popupPage,
    (dashboard) => ((dashboard?.receiverIntake.length ?? 0) === count ? count : null),
    30_000,
    `receiver intake count ${count}`,
  );
}

async function waitForDraftCountAbove(popupPage, baselineDraftCount, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastSnapshot = null;
  let lastDashboard = null;
  let lastAgentDashboard = null;

  while (Date.now() - startedAt < timeoutMs) {
    [lastSnapshot, lastDashboard, lastAgentDashboard] = await Promise.all([
      getPopupSnapshot(popupPage),
      getDashboard(popupPage),
      getAgentDashboard(popupPage),
    ]);

    const snapshotDraftCount = lastSnapshot?.draftCount ?? 0;
    const dashboardDraftCount = lastDashboard?.drafts.length ?? 0;

    if (snapshotDraftCount > baselineDraftCount || dashboardDraftCount > baselineDraftCount) {
      return Math.max(snapshotDraftCount, dashboardDraftCount);
    }

    await popupPage.waitForTimeout(250);
  }

  throw new Error(
    `Timed out waiting for popup draft count > ${baselineDraftCount}. Last snapshot: ${JSON.stringify(
      lastSnapshot,
    )}. Last dashboard summary: ${JSON.stringify(
      lastDashboard?.summary ?? null,
    )}. Last recent capture runs: ${JSON.stringify(
      (lastDashboard?.recentCaptureRuns ?? []).slice(0, 3).map((run) => ({
        id: run.id,
        state: run.state,
        capturedAt: run.capturedAt,
        candidateCount: run.candidateCount,
        skippedCount: run.skippedCount,
        capturedDomains: run.capturedDomains,
      })),
    )}. Last visible candidates: ${JSON.stringify(
      (lastDashboard?.candidates ?? []).slice(0, 5).map((candidate) => ({
        id: candidate.id,
        url: candidate.url,
        title: candidate.title,
        capturedAt: candidate.capturedAt,
      })),
    )}. Last agent dashboard: ${JSON.stringify({
      observations:
        lastAgentDashboard?.observations?.map((observation) => ({
          trigger: observation.trigger,
          status: observation.status,
          coopId: observation.coopId,
          blockedReason: observation.blockedReason,
        })) ?? [],
      plans:
        lastAgentDashboard?.plans?.map((plan) => ({
          skillId: plan.skillId,
          status: plan.status,
          failureReason: plan.failureReason,
          confidence: plan.confidence,
        })) ?? [],
      skillRuns:
        lastAgentDashboard?.skillRuns?.map((run) => ({
          skillId: run.skillId,
          status: run.status,
          error: run.error,
        })) ?? [],
    })}.`,
  );
}

async function waitForCaptureRunActivity(popupPage, baselineCapturedAt, timeoutMs = 5000) {
  const startedAt = Date.now();
  let lastDashboard = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastDashboard = await getDashboard(popupPage);
    const latestCaptureRun = lastDashboard?.recentCaptureRuns?.[0] ?? null;
    const latestCapturedAt = latestCaptureRun?.capturedAt ?? lastDashboard?.summary?.lastCaptureAt;

    if (latestCapturedAt && latestCapturedAt !== baselineCapturedAt) {
      return latestCaptureRun;
    }

    await popupPage.waitForTimeout(200);
  }

  throw new Error(
    `Timed out waiting for a new capture run after ${baselineCapturedAt ?? 'none'}. Last recent capture runs: ${JSON.stringify(
      (lastDashboard?.recentCaptureRuns ?? []).slice(0, 3).map((run) => ({
        id: run.id,
        state: run.state,
        capturedAt: run.capturedAt,
        candidateCount: run.candidateCount,
        skippedCount: run.skippedCount,
        capturedDomains: run.capturedDomains,
      })),
    )}`,
  );
}

async function clickWithoutFocusing(locator) {
  await locator.evaluate((button) => button.click());
}

async function createActionPopupDriver(context, worker) {
  const browser = context.browser();
  if (!browser) {
    throw new Error('Could not access the browser for popup action automation.');
  }

  const cdp = await browser.newBrowserCDPSession();
  const pending = new Map();
  let nextId = 1;

  cdp.on('Target.receivedMessageFromTarget', (event) => {
    const message = JSON.parse(event.message);
    if (!message.id) {
      return;
    }

    const resolver = pending.get(message.id);
    if (!resolver) {
      return;
    }

    pending.delete(message.id);
    if (message.error) {
      resolver.reject(new Error(message.error.message || String(message.error)));
      return;
    }

    resolver.resolve(message.result);
  });

  async function sendToTarget(sessionId, method, params = {}) {
    return await new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      cdp
        .send('Target.sendMessageToTarget', {
          sessionId,
          message: JSON.stringify({ id, method, params }),
        })
        .catch(reject);
    });
  }

  async function evaluate(sessionId, expression) {
    const response = await sendToTarget(sessionId, 'Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text || 'Popup evaluation failed.');
    }

    return response.result?.value;
  }

  return {
    async open() {
      const initialTargets = await cdp.send('Target.getTargets');
      const existingPopupTargetIds = new Set(
        initialTargets.targetInfos
          .filter((target) => target.url.endsWith('/popup.html'))
          .map((target) => target.targetId),
      );

      await worker.evaluate(async () => {
        await chrome.action.openPopup();
      });

      for (let attempt = 0; attempt < 30; attempt += 1) {
        const targets = await cdp.send('Target.getTargets');
        const popupTarget = targets.targetInfos.find(
          (target) =>
            target.url.endsWith('/popup.html') && !existingPopupTargetIds.has(target.targetId),
        );
        if (popupTarget) {
          const { sessionId } = await cdp.send('Target.attachToTarget', {
            targetId: popupTarget.targetId,
            flatten: false,
          });
          await sendToTarget(sessionId, 'Runtime.enable');

          for (let readyAttempt = 0; readyAttempt < 30; readyAttempt += 1) {
            const ready = await evaluate(
              sessionId,
              `(() => document.readyState !== 'loading' && Boolean(document.querySelector('.popup-app')) && document.querySelectorAll('button').length > 0)()`,
            );
            if (ready) {
              return sessionId;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          return sessionId;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      throw new Error('Could not attach to the real extension action popup.');
    },
    async clickButton(sessionId, label) {
      const encoded = JSON.stringify(label);
      return evaluate(
        sessionId,
        `(() => {
          const button = [...document.querySelectorAll('button')].find((node) =>
            (node.textContent || '').includes(${encoded}) || node.getAttribute('aria-label') === ${encoded},
          );
          if (!button) {
            throw new Error('Missing popup button: ' + ${encoded});
          }
          button.click();
          return true;
        })()`,
      );
    },
    async fillCaptureReview(sessionId, values) {
      return evaluate(
        sessionId,
        `(() => {
          const fields = [...document.querySelectorAll('.popup-dialog__field')];
          const titleField = fields.find((node) => node.textContent.includes('Title'));
          const contextField = fields.find((node) => node.textContent.includes('Context'));
          const input = titleField?.querySelector('input');
          const textarea = contextField?.querySelector('textarea') ?? document.querySelector('textarea');
          if (!input || !textarea) {
            throw new Error('Capture review fields are not available.');
          }
          input.value = ${JSON.stringify(values.title)};
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          textarea.value = ${JSON.stringify(values.context)};
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()`,
      );
    },
    async hasDialog(sessionId) {
      return Boolean(await evaluate(sessionId, `Boolean(document.querySelector('dialog[open]'))`));
    },
    async bodyText(sessionId) {
      return (await evaluate(sessionId, 'document.body.innerText')) ?? '';
    },
  };
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

  test('rounds up open pages into popup drafts in a live extension session', async () => {
    const profile = await launchPopupProfile(
      path.join(os.tmpdir(), `coop-popup-actions-roundup-${Date.now()}`),
    );

    try {
      await seedPopupCoop(profile.popupPage, `Popup Smoke ${Date.now()}`);
      await waitForDashboardValue(
        profile.popupPage,
        (dashboard) =>
          dashboard?.recentCaptureRuns?.[0]?.capturedAt ??
          dashboard?.summary?.lastCaptureAt ??
          null,
        10_000,
        'initial onboarding capture run',
      );
      await profile.popupPage.waitForTimeout(500);
      await openStandardPage(profile.context, '?roundup=1');

      const baselineDraftCount = (await getDashboard(profile.popupPage))?.drafts.length ?? 0;
      const baselineCaptureAt = (await getDashboard(profile.popupPage))?.summary?.lastCaptureAt;
      await expect
        .poll(async () => (await getDashboard(profile.popupPage))?.drafts.length ?? 0)
        .toBe(baselineDraftCount);

      const captureResponse = await profile.popupPage.evaluate(async () =>
        chrome.runtime.sendMessage({ type: 'manual-capture' }),
      );
      if (!captureResponse?.ok) {
        throw new Error(captureResponse?.error ?? 'Roundup capture did not succeed.');
      }
      await waitForCaptureRunActivity(profile.popupPage, baselineCaptureAt);
      await waitForDraftCountAbove(profile.popupPage, baselineDraftCount);
      const draftTitles = await waitForDashboardValue(
        profile.popupPage,
        (dashboard) => {
          const titles = (dashboard?.drafts ?? []).map((draft) => draft.title);
          return titles.length > baselineDraftCount ? titles : null;
        },
        30_000,
        'popup draft titles after roundup',
      );
      expect(draftTitles.join('\n')).toContain('Funding roundup for Coop Town Test');
    } finally {
      await closeContextSafely(profile.context);
    }
  });

  test('surfaces the precise screenshot permission error when automation lacks a real activeTab grant', async () => {
    const profile = await launchPopupProfile(
      path.join(os.tmpdir(), `coop-popup-actions-screenshot-${Date.now()}`),
    );

    try {
      const actionPopup = await createActionPopupDriver(profile.context, profile.worker);
      await seedPopupCoop(profile.popupPage, `Popup Screenshot ${Date.now()}`);
      const targetPage = await openStandardPage(profile.context, '?screenshot=1');

      await targetPage.bringToFront();
      const popupSessionId = await actionPopup.open();
      await actionPopup.clickButton(popupSessionId, 'Screenshot');
      await expect
        .poll(() => actionPopup.bodyText(popupSessionId), {
          timeout: 30_000,
        })
        .toContain("Either the '<all_urls>' or 'activeTab' permission is required.");
      await expect
        .poll(() => actionPopup.hasDialog(popupSessionId), { timeout: 30_000 })
        .toBe(false);
    } finally {
      await closeContextSafely(profile.context);
    }
  });

  test('blocks screenshot capture from the popup surface before opening review', async () => {
    const profile = await launchPopupProfile(
      path.join(os.tmpdir(), `coop-popup-actions-screenshot-gate-${Date.now()}`),
    );

    try {
      await seedPopupCoop(profile.popupPage, `Popup Screenshot Gate ${Date.now()}`);
      await profile.popupPage.bringToFront();

      await profile.popupPage.getByRole('button', { name: 'Screenshot' }).click();

      await expect(
        profile.popupPage.getByText('Open a standard web page before taking a screenshot.'),
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

      await profile.popupPage
        .getByRole('textbox', { name: 'Note' })
        .fill('Popup still accepts notes after a failed capture attempt.');
      await profile.popupPage.getByRole('button', { name: 'Save note' }).click();

      await expect(profile.popupPage.getByText('Note hatched into your roost.')).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await closeContextSafely(profile.context);
    }
  });
});
