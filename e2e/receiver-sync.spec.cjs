const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir } = require('./helpers/extension-build.cjs');
const { createMockMemberIdentity } = require('./helpers/mock-auth.cjs');

const closeTimeoutMs = 15000;
const appBaseUrl =
  process.env.COOP_PLAYWRIGHT_BASE_URL ||
  `http://127.0.0.1:${process.env.COOP_PLAYWRIGHT_APP_PORT || process.env.COOP_DEV_APP_PORT || '3001'}`;
const progressLogPath = path.join(os.tmpdir(), 'coop-receiver-sync-progress.log');

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
        withTimeout(page.close(), closeTimeoutMs, 'receiver sync page.close').catch((error) => {
          if (!isBenignCloseError(error)) {
            throw error;
          }
        }),
      ),
    );

    await withTimeout(
      context.close({ reason: 'receiver sync e2e teardown' }),
      closeTimeoutMs,
      'receiver sync context.close',
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
        browser.close({ reason: 'force receiver sync e2e teardown' }),
        closeTimeoutMs,
        'receiver sync browser.close fallback',
      );
    } catch (browserError) {
      if (isBenignCloseError(browserError)) {
        return;
      }
      throw browserError;
    }
  }
}

async function launchExtensionProfile(userDataDir) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });

  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  const cdpSession = await context.newCDPSession(page);

  await cdpSession.send('WebAuthn.enable');
  await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  return {
    context,
    extensionId,
    page,
  };
}

async function openFooterTab(page, name) {
  await page
    .locator('nav[aria-label="Sidepanel navigation"]')
    .getByRole('button', { name: new RegExp(`^${name}$`, 'i') })
    .click();
}

async function openNestSection(page, title) {
  const section = page.locator('details.collapsible-card').filter({ hasText: title }).first();
  const isOpen = await section.evaluate((element) => element.hasAttribute('open'));
  if (!isOpen) {
    await section.locator('summary').click();
  }
}

async function getDashboard(page) {
  const response = await page.evaluate(async () =>
    chrome.runtime.sendMessage({ type: 'get-dashboard' }),
  );
  return response?.ok ? response.data : null;
}

async function sendRuntimeMessage(page, message) {
  const response = await page.evaluate(
    async (payload) => chrome.runtime.sendMessage(payload),
    message,
  );
  if (!response?.ok) {
    throw new Error(response?.error ?? `Runtime message ${message.type} failed.`);
  }

  return response.data;
}

async function waitForDashboardValue(page, select, timeoutMs = 30000, label = 'dashboard value') {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const dashboard = await getDashboard(page);
    if (dashboard) {
      const value = select(dashboard);
      if (value) {
        return value;
      }
    }
    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

function logProgress(step) {
  fs.appendFileSync(progressLogPath, `${new Date().toISOString()} ${step}\n`);
}

async function waitForCoop(page, coopName, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const dashboard = await getDashboard(page);
    const coop = dashboard?.coops.find((candidate) => candidate.profile.name === coopName);
    if (dashboard && coop) {
      return { coop, dashboard };
    }
    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for coop ${coopName} to appear in the dashboard.`);
}

async function setActiveCoop(page, coopName) {
  const { coop } = await waitForCoop(page, coopName);
  await sendRuntimeMessage(page, {
    type: 'set-active-coop',
    payload: { coopId: coop.profile.id },
  });

  await expect
    .poll(async () => {
      const dashboard = await getDashboard(page);
      return dashboard?.activeCoopId === coop.profile.id;
    })
    .toBe(true);
}

function buildSeedCoopPayload(input, creator) {
  return {
    coopName: input.coopName,
    purpose: input.purpose,
    creatorDisplayName: input.creatorName ?? 'Ari',
    captureMode: 'manual',
    seedContribution: input.seedContribution,
    creator,
    setupInsights: {
      summary: input.summary,
      crossCuttingPainPoints: [
        input.capitalPain,
        input.impactPain,
        input.governancePain,
        input.knowledgePain,
      ],
      crossCuttingOpportunities: [
        input.capitalImprove,
        input.impactImprove,
        input.governanceImprove,
        input.knowledgeImprove,
      ],
      lenses: [
        {
          lens: 'capital-formation',
          currentState: input.capitalCurrent,
          painPoints: input.capitalPain,
          improvements: input.capitalImprove,
        },
        {
          lens: 'impact-reporting',
          currentState: input.impactCurrent,
          painPoints: input.impactPain,
          improvements: input.impactImprove,
        },
        {
          lens: 'governance-coordination',
          currentState: input.governanceCurrent,
          painPoints: input.governancePain,
          improvements: input.governanceImprove,
        },
        {
          lens: 'knowledge-garden-resources',
          currentState: input.knowledgeCurrent,
          painPoints: input.knowledgePain,
          improvements: input.knowledgeImprove,
        },
      ],
    },
  };
}

async function seedCoop(page, input, creator) {
  const seededCreator = createMockMemberIdentity({
    ...creator,
    displayName: creator?.displayName ?? input.creatorName ?? 'Ari',
    role: 'creator',
  }).member;
  await seedAuthSession(page, seededCreator);

  const response = await page.evaluate(
    async (payload) => {
      return chrome.runtime.sendMessage({
        type: 'create-coop',
        payload,
      });
    },
    buildSeedCoopPayload(input, seededCreator),
  );

  if (!response?.ok || !response.data) {
    throw new Error(response?.error ?? `Could not seed coop ${input.coopName}.`);
  }

  return response.data;
}

async function seedAuthSession(page, creator) {
  const { session } = createMockMemberIdentity(creator);
  const response = await page.evaluate(async (payload) => {
    return chrome.runtime.sendMessage({
      type: 'set-auth-session',
      payload,
    });
  }, session);

  if (!response?.ok) {
    throw new Error(response?.error ?? 'Could not seed the receiver-sync auth session.');
  }
}

test.describe('receiver pairing and sync', () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    ({ isMobile }) => isMobile,
    'Receiver pairing automation runs only on the desktop Chromium project.',
  );

  test('pairs the receiver app, syncs into private intake, and publishes to multiple coops', async () => {
    ensureExtensionBuilt();
    fs.writeFileSync(progressLogPath, '');

    const creatorUserDataDir = path.join(os.tmpdir(), `coop-e2e-receiver-${Date.now()}`);
    const creatorProfile = await launchExtensionProfile(creatorUserDataDir);

    try {
      const appPage = await creatorProfile.context.newPage();
      await appPage.goto(appBaseUrl);
      await creatorProfile.page.bringToFront();

      const receiverCoop = await seedCoop(creatorProfile.page, {
        coopName: 'Receiver Coop',
        purpose: 'Give members a local-first mobile receiver that syncs into private intake.',
        summary: 'We need a playful receiver shell for audio, photos, and files.',
        seedContribution: 'I bring mobile capture context that should stay private until reviewed.',
        capitalCurrent: 'Signals land in scattered voice notes.',
        capitalPain: 'Follow-up context disappears between devices.',
        capitalImprove: 'Queue the best signals in private intake.',
        impactCurrent: 'Field evidence arrives late.',
        impactPain: 'Photos and notes get buried.',
        impactImprove: 'Make the receiver inbox easy to review.',
        governanceCurrent: 'Team decisions happen in calls.',
        governancePain: 'No one sees the context quickly enough.',
        governanceImprove: 'Pull receiver captures into the extension.',
        knowledgeCurrent: 'Files live in chat threads.',
        knowledgePain: 'Local knowledge never reaches the coop.',
        knowledgeImprove: 'Sync local captures into a private queue.',
      });
      const creator = receiverCoop.members?.[0];
      if (!creator?.address || !creator?.displayName) {
        throw new Error('Seeded receiver coop did not return a creator member.');
      }
      await creatorProfile.page.reload();
      await creatorProfile.page.waitForLoadState('domcontentloaded');

      const forestSignalsCoop = await seedCoop(
        creatorProfile.page,
        {
          coopName: 'Forest Signals',
          purpose: 'Route reviewed field evidence across the right coops without friction.',
          summary: 'Members often work across more than one coop and need low-friction routing.',
          seedContribution: 'I bring a second coop context for shared publication.',
          capitalCurrent: 'Follow-up routing is manual and easy to miss.',
          capitalPain: 'Reviewed items rarely reach every coop that needs them.',
          capitalImprove: 'Publish the same reviewed draft into both feeds when appropriate.',
          impactCurrent: 'Cross-coop evidence arrives late.',
          impactPain: 'The second coop never sees field notes in time.',
          impactImprove: 'Route shared context cleanly after review.',
          governanceCurrent: 'Weekly reviews happen separately.',
          governancePain: 'Facilitators rebuild the same context twice.',
          governanceImprove: 'Use a single private review membrane first.',
          knowledgeCurrent: 'Reference notes stay stuck in one group.',
          knowledgePain: 'Good evidence does not travel.',
          knowledgeImprove: 'Make multi-coop publishing a first-class action.',
        },
        creator,
      );
      await creatorProfile.page.reload();
      await creatorProfile.page.waitForLoadState('domcontentloaded');

      await setActiveCoop(creatorProfile.page, 'Receiver Coop');
      await openNestSection(creatorProfile.page, 'Receiver Pairings');
      await creatorProfile.page
        .getByRole('button', { name: /(generate receiver pairing|generate nest code)/i })
        .click();
      logProgress('generated receiver pairing');

      let deepLink = null;
      await expect
        .poll(
          async () => {
            const dashboard = await getDashboard(creatorProfile.page);
            deepLink = dashboard?.receiverPairings?.[0]?.deepLink ?? null;
            return deepLink;
          },
          { timeout: 15000 },
        )
        .toMatch(/\/pair#payload=/);
      const deepLinkUrl = new URL(deepLink);

      await creatorProfile.page.close();

      await appPage.goto(deepLinkUrl.toString());
      await expect(
        appPage.getByRole('button', { name: /(accept pairing|join this coop)/i }),
      ).toBeVisible({
        timeout: 15000,
      });
      await expect(appPage).toHaveURL(/\/pair$/);
      await appPage.getByRole('button', { name: /(accept pairing|join this coop)/i }).click();
      logProgress('accepted receiver pairing');
      await expect(appPage.locator('input[type="file"]')).toHaveCount(2, {
        timeout: 10000,
      });
      const receiverSurface = await withTimeout(
        appPage.evaluate(() => ({
          url: window.location.href,
          fileInputCount: document.querySelectorAll('input[type="file"]').length,
        })),
        10000,
        'receiver surface inspection',
      );
      expect(receiverSurface).toMatchObject({
        url: expect.stringMatching(/\/receiver$/),
        fileInputCount: 2,
      });
      await withTimeout(
        appPage.evaluate(() => {
          const inputs = document.querySelectorAll('input[type="file"]');
          const target = inputs.item(1);
          if (!(target instanceof HTMLInputElement)) {
            throw new Error(`Receiver file input missing. Found ${inputs.length} file inputs.`);
          }

          const file = new File(['receiver capture from playwright'], 'field-note.txt', {
            type: 'text/plain',
          });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          target.files = dataTransfer.files;
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }),
        10000,
        'receiver capture injection',
      );
      await expect(
        appPage.locator('.nest-item-card').filter({ hasText: 'field-note.txt' }).first(),
      ).toBeVisible({ timeout: 15000 });
      await expect
        .poll(
          async () => {
            const cardCount = await appPage.locator('.nest-item-card').count();
            const hasFile = await appPage
              .locator('.nest-item-card strong')
              .filter({ hasText: 'field-note.txt' })
              .count();
            return cardCount >= 1 && hasFile >= 1;
          },
          { timeout: 15000 },
        )
        .toBe(true);
      logProgress('receiver capture visible in app');
      const reviewPage = await creatorProfile.context.newPage();
      await reviewPage.goto(`chrome-extension://${creatorProfile.extensionId}/sidepanel.html`);
      await expect
        .poll(
          async () => {
            const response = await reviewPage.evaluate(async () =>
              chrome.runtime.sendMessage({ type: 'get-receiver-sync-runtime' }),
            );
            return response.ok ? response.data : null;
          },
          {
            timeout: 30000,
          },
        )
        .toMatchObject({
          activePairingIds: [expect.any(String)],
          transport: expect.stringMatching(/^(websocket|webrtc)$/),
        });
      logProgress('receiver runtime connected');
      const syncedCapture = await waitForDashboardValue(
        reviewPage,
        (dashboard) =>
          dashboard.receiverIntake.find(
            (capture) =>
              capture.title === 'field-note.txt' && capture.coopId === receiverCoop.profile.id,
          ) ?? null,
        30000,
        'receiver capture in private intake',
      );
      logProgress('receiver capture found in dashboard');
      const candidateDraft = await sendRuntimeMessage(reviewPage, {
        type: 'convert-receiver-intake',
        payload: {
          captureId: syncedCapture.id,
          workflowStage: 'candidate',
          targetCoopId: receiverCoop.profile.id,
        },
      });
      logProgress('receiver intake converted to candidate draft');
      const readyDraft = await sendRuntimeMessage(reviewPage, {
        type: 'update-review-draft',
        payload: {
          draft: {
            ...candidateDraft,
            title: 'Community field note',
            summary:
              'Reviewed privately first, then routed into the coops that need the field context.',
            category: 'resource',
            tags: ['field note', 'review'],
            whyItMatters:
              'This note captures a field observation worth sharing after lightweight review.',
            suggestedNextStep:
              'Publish this note into both coops and use it in the next weekly ritual.',
            suggestedTargetCoopIds: [receiverCoop.profile.id, forestSignalsCoop.profile.id],
            workflowStage: 'ready',
          },
        },
      });
      logProgress('receiver draft updated to ready');
      await waitForDashboardValue(
        reviewPage,
        (dashboard) =>
          dashboard.drafts.find(
            (draft) =>
              draft.id === readyDraft.id &&
              draft.workflowStage === 'ready' &&
              draft.title === 'Community field note',
          ) ?? null,
        15000,
        'ready receiver draft',
      );
      logProgress('ready draft visible in dashboard');

      const publishedArtifacts = await sendRuntimeMessage(reviewPage, {
        type: 'publish-draft',
        payload: {
          draft: readyDraft,
          targetCoopIds: readyDraft.suggestedTargetCoopIds,
        },
      });
      expect(publishedArtifacts).toHaveLength(2);
      logProgress('publish-draft returned two artifacts');
      await waitForDashboardValue(
        reviewPage,
        (dashboard) => {
          const receiverFeed = dashboard.coops.find(
            (coop) => coop.profile.id === receiverCoop.profile.id,
          );
          const forestFeed = dashboard.coops.find(
            (coop) => coop.profile.id === forestSignalsCoop.profile.id,
          );
          const updatedCapture = dashboard.receiverIntake.find(
            (capture) => capture.id === syncedCapture.id,
          );
          const receiverPublished = receiverFeed?.artifacts.some(
            (artifact) => artifact.title === 'Community field note',
          );
          const forestPublished = forestFeed?.artifacts.some(
            (artifact) => artifact.title === 'Community field note',
          );

          if (
            receiverPublished &&
            forestPublished &&
            updatedCapture?.intakeStatus === 'published'
          ) {
            return {
              receiverPublished,
              forestPublished,
              intakeStatus: updatedCapture.intakeStatus,
            };
          }

          return null;
        },
        20000,
        'published artifacts in both coops',
      );
      logProgress('published artifacts visible in both coops');
    } finally {
      await closeContextSafely(creatorProfile.context);
    }
  });
});
