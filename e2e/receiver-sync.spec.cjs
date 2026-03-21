const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir, rootDir } = require('./helpers/extension-build.cjs');

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

async function openOptionalSetup(page) {
  const optionalSetup = page.locator('details.collapsible-card').first();
  const isOpen = await optionalSetup.evaluate((element) => element.hasAttribute('open'));
  if (!isOpen) {
    await optionalSetup.locator('summary').click();
  }
}

async function openPanelTab(page, name) {
  await page.getByRole('tab', { name, exact: true }).click();
}

async function getDashboard(page) {
  const response = await page.evaluate(async () =>
    chrome.runtime.sendMessage({ type: 'get-dashboard' }),
  );
  return response?.ok ? response.data : null;
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
  await openPanelTab(page, 'Nest');
  const coopSelect = page.locator('#active-coop-select');
  if (await coopSelect.count()) {
    await coopSelect.selectOption({ label: coopName });
    await expect
      .poll(async () => {
        const dashboard = await getDashboard(page);
        return dashboard?.activeCoopId === coop.profile.id;
      })
      .toBe(true);
    await expect(coopSelect).toContainText(coopName, { timeout: 30000 });
    return;
  }

  const trigger = page.locator('.coop-switcher__trigger').first();
  const triggerLabel = page.locator('.coop-switcher__trigger-label').first();
  if (await trigger.count()) {
    const currentLabel = ((await triggerLabel.textContent()) ?? '').trim();
    if (currentLabel !== coopName) {
      await trigger.click();
      const option = page.locator('.coop-switcher__option').filter({ hasText: coopName }).first();
      await expect(option).toBeVisible({ timeout: 30000 });
      await option.click();
    }
    await expect
      .poll(async () => {
        const dashboard = await getDashboard(page);
        return dashboard?.activeCoopId === coop.profile.id;
      })
      .toBe(true);
    await expect(triggerLabel).toContainText(coopName, { timeout: 30000 });
    return;
  }

  const staticLabel = page.locator('.coop-switcher__label').first();
  if (await staticLabel.count()) {
    await expect
      .poll(async () => {
        const dashboard = await getDashboard(page);
        return dashboard?.activeCoopId === coop.profile.id;
      })
      .toBe(true);
    await expect(staticLabel).toContainText(coopName, { timeout: 30000 });
    return;
  }

  await expect
    .poll(async () => {
      const dashboard = await getDashboard(page);
      return dashboard?.activeCoopId === coop.profile.id;
    })
    .toBe(true);
  await expect(page.getByText(coopName, { exact: true }).first()).toBeVisible({
    timeout: 30000,
  });
}

async function launchCoop(page, input) {
  await openPanelTab(page, 'Nest');
  await page.fill('#coop-name', input.coopName);
  await page.fill('#coop-purpose', input.purpose);
  await page.fill('#creator-name', input.creatorName ?? 'Ari');
  await page.fill('#summary', input.summary);
  await page.fill('#seed-contribution', input.seedContribution);
  await openOptionalSetup(page);
  await page.fill('#capitalCurrent', input.capitalCurrent);
  await page.fill('#capitalPain', input.capitalPain);
  await page.fill('#capitalImprove', input.capitalImprove);
  await page.fill('#impactCurrent', input.impactCurrent);
  await page.fill('#impactPain', input.impactPain);
  await page.fill('#impactImprove', input.impactImprove);
  await page.fill('#governanceCurrent', input.governanceCurrent);
  await page.fill('#governancePain', input.governancePain);
  await page.fill('#governanceImprove', input.governanceImprove);
  await page.fill('#knowledgeCurrent', input.knowledgeCurrent);
  await page.fill('#knowledgePain', input.knowledgePain);
  await page.fill('#knowledgeImprove', input.knowledgeImprove);
  await page.getByRole('button', { name: /(launch the coop|start this coop)/i }).click();

  await expect(page.getByText(/coop created\./i)).toBeVisible({
    timeout: 30000,
  });
  await setActiveCoop(page, input.coopName);
}

test.describe('receiver pairing and sync', () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    ({ isMobile }) => isMobile,
    'Receiver pairing automation runs only on the desktop Chromium project.',
  );

  test('pairs the receiver app, syncs into private intake with the bridge disabled, and publishes to multiple coops', async () => {
    ensureExtensionBuilt();

    const creatorUserDataDir = path.join(os.tmpdir(), `coop-e2e-receiver-${Date.now()}`);
    const creatorProfile = await launchExtensionProfile(creatorUserDataDir);

    try {
      const appPage = await creatorProfile.context.newPage();
      await appPage.goto('http://127.0.0.1:3001');
      await creatorProfile.page.bringToFront();

      await launchCoop(creatorProfile.page, {
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
      await launchCoop(creatorProfile.page, {
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
      });

      await setActiveCoop(creatorProfile.page, 'Receiver Coop');
      await creatorProfile.page
        .getByRole('button', { name: /(generate receiver pairing|generate nest code)/i })
        .click();

      const deepLink = await creatorProfile.page.locator('#receiver-pairing-link').inputValue();
      expect(deepLink).toContain('/pair#payload=');
      const deepLinkUrl = new URL(deepLink);
      deepLinkUrl.searchParams.set('bridge', 'off');

      await creatorProfile.page.close();

      await appPage.goto(deepLinkUrl.toString());
      await expect(
        appPage.getByRole('button', { name: /(accept pairing|join this coop)/i }),
      ).toBeVisible({
        timeout: 15000,
      });
      await expect(appPage).toHaveURL(/\/pair\?bridge=off$/);
      await appPage.getByRole('button', { name: /(accept pairing|join this coop)/i }).click();
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
        url: expect.stringMatching(/\/receiver\?bridge=off$/),
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
            timeout: 20000,
          },
        )
        .toMatchObject({
          activePairingIds: [expect.any(String)],
          transport: expect.stringMatching(/^(websocket|webrtc)$/),
          lastIngestSuccessAt: expect.any(String),
        });
      await openPanelTab(reviewPage, 'Flock Meeting');
      await expect(reviewPage.getByText('field-note.txt').first()).toBeVisible({ timeout: 20000 });
      await expect(reviewPage.locator('#meeting-cadence')).toBeVisible({ timeout: 15000 });

      await reviewPage.fill('#meeting-cadence', 'Weekly orchard review');
      await reviewPage.fill(
        '#meeting-facilitator',
        'One facilitator stewards intake and decides what graduates into shared memory.',
      );
      await reviewPage.fill(
        '#meeting-posture',
        'Start private, move to candidate review, then publish only what the group wants shared.',
      );
      await reviewPage
        .getByRole('button', { name: /(save ritual settings|save meeting rhythm)/i })
        .click();
      await expect(
        reviewPage.getByText(/(meeting settings updated|flock meeting rhythm updated)/i),
      ).toBeVisible({
        timeout: 15000,
      });

      const intakeDraftCard = reviewPage
        .locator('.draft-card')
        .filter({ hasText: 'field-note.txt' })
        .first();
      await intakeDraftCard
        .getByRole('button', { name: /(convert to candidate|move to hatching)/i })
        .click();
      await expect(
        reviewPage.getByText(
          /(receiver intake moved into candidate review|pocket coop find moved into hatching review)/i,
        ),
      ).toBeVisible({
        timeout: 15000,
      });
      await expect(
        reviewPage.getByRole('button', { name: /(mark ready|ready to share)/i }),
      ).toBeVisible({
        timeout: 15000,
      });

      const draftTitleInput = intakeDraftCard.locator('input[id^="title-"]').first();
      const draftTitleInputId = await draftTitleInput.getAttribute('id');
      if (!draftTitleInputId) {
        throw new Error('Converted receiver draft did not expose a title input id.');
      }
      const receiverDraftCard = reviewPage
        .locator('.draft-card')
        .filter({ has: reviewPage.locator(`#${draftTitleInputId}`) })
        .first();
      await draftTitleInput.fill('Community field note');
      await receiverDraftCard
        .locator('textarea[id^="summary-"]')
        .first()
        .fill('Reviewed privately first, then routed into the coops that need the field context.');
      await receiverDraftCard.locator('select[id^="category-"]').first().selectOption('resource');
      await receiverDraftCard.locator('input[id^="tags-"]').first().fill('field note, review');
      await receiverDraftCard
        .locator('textarea[id^="why-"]')
        .first()
        .fill('This note captures a field observation worth sharing after lightweight review.');
      await receiverDraftCard
        .locator('textarea[id^="next-step-"]')
        .first()
        .fill('Publish this note into both coops and use it in the next weekly ritual.');
      await receiverDraftCard
        .getByRole('button', { name: /add forest signals/i })
        .first()
        .click();
      await receiverDraftCard
        .getByRole('button', { name: /(mark ready|ready to share)/i })
        .first()
        .click();
      await expect(
        reviewPage.getByText(
          /(draft moved into the ready-to-publish lane|draft is ready to share)/i,
        ),
      ).toBeVisible({
        timeout: 15000,
      });

      await receiverDraftCard
        .getByRole('button', { name: /(push into|share with) coop/i })
        .first()
        .click();
      await expect(
        reviewPage.getByText(
          /(draft (pushed into shared coop memory|shared with the coop feed)|just landed in the feed)/i,
        ),
      ).toBeVisible({
        timeout: 15000,
      });

      await openPanelTab(reviewPage, 'Coop Feed');
      await expect(reviewPage.getByText('Community field note', { exact: true })).toBeVisible({
        timeout: 15000,
      });

      await setActiveCoop(reviewPage, 'Forest Signals');
      await openPanelTab(reviewPage, 'Coop Feed');
      await expect(reviewPage.getByText('Community field note', { exact: true })).toBeVisible({
        timeout: 15000,
      });
    } finally {
      await closeContextSafely(creatorProfile.context);
    }
  });
});
