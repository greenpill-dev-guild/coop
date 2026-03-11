const { execSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');

const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'packages/extension/dist');

async function closeContextSafely(context) {
  if (!context) {
    return;
  }

  try {
    await context.close();
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return;
    }
    throw error;
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
    page,
  };
}

test.describe('extension workflow', () => {
  test.describe.configure({ timeout: 120_000 });

  test.skip(
    ({ isMobile }) => isMobile,
    'Extension automation runs only on the desktop Chromium project.',
  );

  test('creates a coop, joins from a second profile, syncs state, rounds up a tab, and archives a result', async () => {
    execSync(
      'VITE_COOP_ONCHAIN_MODE=mock VITE_COOP_ARCHIVE_MODE=mock VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444 bun run --filter @coop/extension build',
      {
        cwd: rootDir,
        stdio: 'inherit',
      },
    );

    const creatorUserDataDir = path.join(os.tmpdir(), `coop-e2e-creator-${Date.now()}`);
    const memberUserDataDir = path.join(os.tmpdir(), `coop-e2e-member-${Date.now()}`);
    const creatorProfile = await launchExtensionProfile(creatorUserDataDir);
    let memberProfile;

    try {
      const creatorAppPage = await creatorProfile.context.newPage();
      await creatorAppPage.goto('http://127.0.0.1:3001');
      await creatorProfile.page.bringToFront();

      await creatorProfile.page.fill('#coop-name', 'Coop Town Test');
      await creatorProfile.page.fill(
        '#coop-purpose',
        'Turn loose tabs into shared intelligence and fundable next steps.',
      );
      await creatorProfile.page.fill('#creator-name', 'Ari');
      await creatorProfile.page.fill(
        '#summary',
        'We need a shared membrane for tabs, funding leads, and next steps.',
      );
      await creatorProfile.page.fill(
        '#seed-contribution',
        'I bring loose research tabs and funding opportunities.',
      );
      await creatorProfile.page.fill('#capitalCurrent', 'Funding links live in scattered docs.');
      await creatorProfile.page.fill('#capitalPain', 'Good grant context keeps disappearing.');
      await creatorProfile.page.fill('#capitalImprove', 'Surface fundable leads in shared review.');
      await creatorProfile.page.fill('#impactCurrent', 'Impact evidence is compiled manually.');
      await creatorProfile.page.fill('#impactPain', 'Useful evidence arrives too late.');
      await creatorProfile.page.fill('#impactImprove', 'Keep evidence visible in the coop feed.');
      await creatorProfile.page.fill('#governanceCurrent', 'Calls happen weekly.');
      await creatorProfile.page.fill('#governancePain', 'Follow-up work gets lost after calls.');
      await creatorProfile.page.fill('#governanceImprove', 'Track next steps in the board.');
      await creatorProfile.page.fill('#knowledgeCurrent', 'Resources live in browser tabs.');
      await creatorProfile.page.fill('#knowledgePain', 'People repeat the same research.');
      await creatorProfile.page.fill('#knowledgeImprove', 'Create a shared knowledge commons.');
      await creatorProfile.page.getByRole('button', { name: /launch the coop/i }).click();

      await expect(
        creatorProfile.page.locator('.summary-card strong').filter({ hasText: 'Coop Town Test' }),
      ).toBeVisible({
        timeout: 30000,
      });
      await creatorProfile.page.getByRole('button', { name: 'Coops' }).click();
      await expect(
        creatorProfile.page.getByRole('heading', { name: 'Coop Town Test' }),
      ).toBeVisible();
      await expect(creatorProfile.page.getByText(/0x[a-fA-F0-9]{40}/).first()).toBeVisible();

      await creatorProfile.page.getByRole('button', { name: /create member invite/i }).click();
      const inviteCode = await creatorProfile.page.locator('#invite-code').inputValue();

      memberProfile = await launchExtensionProfile(memberUserDataDir);
      await memberProfile.page.bringToFront();
      await memberProfile.page.fill('#join-code', inviteCode);
      await memberProfile.page.fill('#join-name', 'Mina');
      await memberProfile.page.fill('#join-seed', 'I bring review energy and member context.');
      await memberProfile.page.getByRole('button', { name: /join coop/i }).click();

      await expect(
        memberProfile.page.getByText(/member joined and seed contribution published/i),
      ).toBeVisible();
      await memberProfile.page.getByRole('button', { name: 'Coops' }).click();
      await expect(memberProfile.page.getByText('Mina')).toBeVisible();

      await creatorProfile.page.getByRole('button', { name: 'Loose Chickens' }).click();
      await creatorProfile.page.getByRole('button', { name: /manual round-up/i }).click();
      await expect(creatorProfile.page.getByText(/manual round-up completed/i)).toBeVisible({
        timeout: 15000,
      });

      await creatorProfile.page.getByRole('button', { name: 'Roost' }).click();
      await expect(
        creatorProfile.page.getByRole('button', { name: /push into coop/i }).first(),
      ).toBeVisible({
        timeout: 15000,
      });
      const publishedTitle = await creatorProfile.page
        .locator('.draft-card input[id^="title-"]')
        .first()
        .inputValue();
      await creatorProfile.page
        .getByRole('button', { name: /push into coop/i })
        .first()
        .click();
      await expect(
        creatorProfile.page.getByText(/draft pushed into shared coop memory/i),
      ).toBeVisible();

      await memberProfile.page.getByRole('button', { name: 'Feed' }).click();
      if (publishedTitle) {
        await expect(memberProfile.page.getByText(publishedTitle.trim())).toBeVisible({
          timeout: 15000,
        });
      }

      await creatorProfile.page.getByRole('button', { name: 'Settings' }).click();
      await creatorProfile.page.getByRole('button', { name: /archive latest artifact/i }).click();
      await expect(
        creatorProfile.page.getByText(/archive receipt created and stored/i),
      ).toBeVisible();
    } finally {
      if (memberProfile) {
        await closeContextSafely(memberProfile.context);
      }
      await closeContextSafely(creatorProfile.context);
    }
  });
});
