const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir } = require('./helpers/extension-build.cjs');
const { createMockMemberIdentity } = require('./helpers/mock-auth.cjs');

const screenshotsDir = path.join(__dirname, 'qa-screenshots', 'next-step-review');

function ensureScreenshotsDir() {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function setTheme(page, theme) {
  await page.evaluate((value) => {
    document.documentElement.setAttribute('data-theme', value);
    document.body.setAttribute('data-theme', value);
    document.documentElement.style.colorScheme = value;
    document.body.style.colorScheme = value;
  }, theme);
  await page.waitForTimeout(200);
}

async function sendRuntimeMessage(page, message) {
  return page.evaluate(async (payload) => globalThis.chrome.runtime.sendMessage(payload), message);
}

async function seedAuthSession(page, creator) {
  const { session } = createMockMemberIdentity(creator);
  const response = await sendRuntimeMessage(page, {
    type: 'set-auth-session',
    payload: session,
  });
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Could not seed the auth session.');
  }
}

async function seedCoop(page, creatorMember) {
  const response = await sendRuntimeMessage(page, {
    type: 'create-coop',
    payload: {
      coopName: 'QA Coop',
      purpose: 'Validate next-step review surfaces',
      spaceType: 'project',
      creatorDisplayName: creatorMember.displayName,
      captureMode: 'manual',
      seedContribution: 'Bring scattered tabs into one shared space.',
      creator: creatorMember,
      setupInsights: {
        summary: 'Coop seeded for QA pass 2 visual sweep.',
        crossCuttingPainPoints: [
          'Funding context scattered.',
          'Evidence slow.',
          'Follow-up gets lost.',
          'Resources hard to refind.',
        ],
        crossCuttingOpportunities: [
          'Surface fundable next steps.',
          'Keep evidence visible in feed.',
          'Make next steps explicit.',
          'Cluster resources in shared garden.',
        ],
        lenses: [
          {
            lens: 'capital-formation',
            currentState: 'Funding leads scattered.',
            painPoints: 'Lost context across tabs.',
            improvements: 'Surface fundable next steps.',
          },
          {
            lens: 'impact-reporting',
            currentState: 'Evidence compiled manually.',
            painPoints: 'Slow follow-up.',
            improvements: 'Keep evidence visible in feed.',
          },
          {
            lens: 'governance-coordination',
            currentState: 'Weekly calls, scattered notes.',
            painPoints: 'Follow-up gets lost.',
            improvements: 'Make next steps explicit.',
          },
          {
            lens: 'knowledge-garden-resources',
            currentState: 'Resources spread thin.',
            painPoints: 'Hard to find again.',
            improvements: 'Cluster resources in shared garden.',
          },
        ],
      },
    },
  });
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Could not seed coop.');
  }
}

test.describe('next-step-review visual sweep', () => {
  test.describe.configure({ timeout: 180_000 });

  let context;
  let page;
  let extensionId;

  test.beforeAll(async ({ isMobile }, testInfo) => {
    test.skip(isMobile, 'Extension visual tests run only on the desktop Chromium project.');
    testInfo.setTimeout(240_000);
    ensureScreenshotsDir();
    ensureExtensionBuilt();

    const userDataDir = path.join(os.tmpdir(), `coop-qa-next-step-review-${Date.now()}`);
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
    });

    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    extensionId = new URL(worker.url()).host;

    page = await context.newPage();
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

    await page.setViewportSize({ width: 440, height: 800 });
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.waitForLoadState('domcontentloaded');

    const creator = createMockMemberIdentity({
      displayName: 'QA Reviewer',
      role: 'creator',
    }).member;
    await seedAuthSession(page, creator);
    await seedCoop(page, creator);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('h2:has-text("What\'s Next")', { timeout: 30_000 });
    await setTheme(page, 'light');
  });

  test.afterAll(async () => {
    if (context) {
      await context.close({ reason: 'qa sweep complete' }).catch(() => {});
    }
  });

  test('Roost simple-mode "What\'s Next" copy avoids agent jargon', async () => {
    await page.getByRole('button', { name: /Roost/, exact: false }).first().click();
    await page.waitForTimeout(300);

    const heading = page.getByRole('heading', { name: "What's Next", exact: true });
    await expect(heading).toBeVisible();

    // Spec: simple-mode copy must avoid raw agent-management framing.
    await expect(page.getByText(/run agent/i)).toHaveCount(0);
    await expect(page.getByText(/stale observation/i)).toHaveCount(0);

    await page.screenshot({
      path: path.join(screenshotsDir, '01-roost-simple-light.png'),
      fullPage: true,
    });
    await setTheme(page, 'dark');
    await page.screenshot({
      path: path.join(screenshotsDir, '02-roost-simple-dark.png'),
      fullPage: true,
    });
    await setTheme(page, 'light');
  });

  test('Chickens review tab renders Review/Shared segments', async () => {
    await page
      .getByRole('button', { name: /Chickens/, exact: false })
      .first()
      .click();
    await page.waitForTimeout(400);

    await expect(page.getByRole('button', { name: 'Review', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shared', exact: true })).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, '03-chickens-review-light.png'),
      fullPage: true,
    });

    await page.getByRole('button', { name: 'Shared', exact: true }).click();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(screenshotsDir, '04-chickens-shared-light.png'),
      fullPage: true,
    });

    // Return to review for downstream tests.
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await page.waitForTimeout(200);
  });

  test('Advanced mode restores Agent subtab on Roost', async () => {
    // Flip uiMode -> advanced via Nest settings sub-tab.
    await page.getByRole('button', { name: /Nest/, exact: false }).first().click();
    await page.waitForTimeout(300);

    // Open the Nest "Settings" sub-tab — it's not the default landing.
    const settingsSubtab = page.locator('.nest-sub-tabs button', { hasText: /^Settings$/ }).first();
    if ((await settingsSubtab.count()) > 0) {
      await settingsSubtab.click();
      await page.waitForTimeout(300);
    }

    const advancedSelect = page.locator('#settings-advanced-controls');
    await advancedSelect.scrollIntoViewIfNeeded();
    await advancedSelect.selectOption('advanced');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotsDir, '05-nest-advanced-toggle.png'),
      fullPage: true,
    });

    // Switch back to Roost — Agent subtab must appear in advanced mode.
    await page.getByRole('button', { name: /Roost/, exact: false }).first().click();
    await page.waitForTimeout(400);

    const agentSubtab = page.getByRole('button', { name: /Agent/, exact: false });
    await expect(agentSubtab.first()).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: path.join(screenshotsDir, '06-roost-advanced.png'),
      fullPage: true,
    });
  });
});
