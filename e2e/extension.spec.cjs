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
        withTimeout(page.close(), closeTimeoutMs, 'extension e2e page.close').catch((error) => {
          if (!isBenignCloseError(error)) {
            throw error;
          }
        }),
      ),
    );

    await withTimeout(
      context.close({ reason: 'extension e2e teardown' }),
      closeTimeoutMs,
      'extension e2e context.close',
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
        browser.close({ reason: 'force extension e2e teardown' }),
        closeTimeoutMs,
        'extension e2e browser.close fallback',
      );
    } catch (browserError) {
      if (isBenignCloseError(browserError)) {
        return;
      }
      throw browserError;
    }
  }
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

async function getAgentDashboard(page) {
  const response = await page.evaluate(async () =>
    chrome.runtime.sendMessage({ type: 'get-agent-dashboard' }),
  );
  return response?.ok ? response.data : null;
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
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    ({ isMobile }) => isMobile,
    'Extension automation runs only on the desktop Chromium project.',
  );

  test('@flow-board creates a coop, publishes memory, archives a result, and opens the board', async () => {
    ensureExtensionBuilt();

    const creatorUserDataDir = path.join(os.tmpdir(), `coop-e2e-creator-${Date.now()}`);
    const memberUserDataDir = path.join(os.tmpdir(), `coop-e2e-member-${Date.now()}`);
    const creatorProfile = await launchExtensionProfile(creatorUserDataDir);
    let memberProfile;

    try {
      const creatorAppPage = await creatorProfile.context.newPage();
      await creatorAppPage.goto('http://127.0.0.1:3001/manual-roundup-fixture.html');
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
      await openOptionalSetup(creatorProfile.page);
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
      await creatorProfile.page
        .getByRole('button', { name: /(launch the coop|start this coop)/i })
        .click();

      await expect(creatorProfile.page.getByText(/coop created\./i)).toBeVisible({
        timeout: 30000,
      });
      await openPanelTab(creatorProfile.page, 'Nest');
      await expect(
        creatorProfile.page.getByRole('heading', { name: 'Coop Town Test' }),
      ).toBeVisible();
      await expect(creatorProfile.page.getByText(/0x[a-fA-F0-9]{40}/).first()).toBeVisible();

      await creatorProfile.page
        .getByRole('button', { name: /(create|make) member invite/i })
        .click();
      const inviteCode = await creatorProfile.page.locator('#invite-code').inputValue();

      memberProfile = await launchExtensionProfile(memberUserDataDir);
      await memberProfile.page.bringToFront();
      await memberProfile.page.fill('#join-code', inviteCode);
      await memberProfile.page.fill('#join-name', 'Mina');
      await memberProfile.page.fill('#join-seed', 'I bring review energy and member context.');
      await memberProfile.page.getByRole('button', { name: /join( this)? coop/i }).click();

      await expect(
        memberProfile.page.getByText(
          /member joined and (seed contribution published|starter note saved)/i,
        ),
      ).toBeVisible({
        timeout: 30000,
      });
      await openPanelTab(memberProfile.page, 'Nest');
      await expect(memberProfile.page.getByText('Mina')).toBeVisible();

      await openPanelTab(creatorProfile.page, 'Loose Chickens');
      await creatorProfile.page
        .getByRole('button', { name: /(manual round-up|round up now)/i })
        .click();
      await openPanelTab(creatorProfile.page, 'Roost');
      const firstDraftTitleInput = creatorProfile.page
        .locator('.draft-card input[id^="title-"]')
        .first();
      await expect(firstDraftTitleInput).toHaveValue('Funding roundup for Coop Town Test', {
        timeout: 15000,
      });
      await expect(
        creatorProfile.page.getByRole('button', { name: /(push into|share with) coop/i }).first(),
      ).toBeVisible({
        timeout: 15000,
      });
      const publishedTitle = await firstDraftTitleInput.inputValue();
      await creatorProfile.page
        .getByRole('button', { name: /(push into|share with) coop/i })
        .first()
        .click();
      await expect(
        creatorProfile.page.getByText(
          /(draft (pushed into shared coop memory|shared with the coop feed)|just landed in the feed)/i,
        ),
      ).toBeVisible();

      await openPanelTab(memberProfile.page, 'Coop Feed');

      await openPanelTab(creatorProfile.page, 'Nest Tools');
      await creatorProfile.page
        .getByRole('button', { name: /(archive latest artifact|save latest find)/i })
        .click();
      await expect(
        creatorProfile.page.getByText(
          /(archive receipt created and stored|saved proof created and stored)/i,
        ),
      ).toBeVisible();

      await openPanelTab(creatorProfile.page, 'Coop Feed');
      const boardUrl = await creatorProfile.page
        .getByRole('link', { name: /open.*board/i })
        .first()
        .getAttribute('href');
      expect(boardUrl).toBeTruthy();
      const boardPage = await creatorProfile.context.newPage();
      await boardPage.goto(boardUrl);
      await boardPage.waitForLoadState('domcontentloaded');
      await expect(boardPage.getByRole('heading', { name: 'Coop Town Test' })).toBeVisible({
        timeout: 15000,
      });
      const boardSurface = boardPage.getByTestId('coop-board-surface');
      await expect(boardPage.getByRole('heading', { name: /saved proof trail/i })).toBeVisible({
        timeout: 15000,
      });
      await expect(boardSurface.getByText(publishedTitle.trim()).first()).toBeVisible({
        timeout: 15000,
      });
      await expect(boardSurface.getByText('published to coop').first()).toBeVisible({
        timeout: 15000,
      });
      await expect(boardSurface.getByText('archived in').first()).toBeVisible({
        timeout: 15000,
      });
    } finally {
      if (memberProfile) {
        await closeContextSafely(memberProfile.context);
      }
      await closeContextSafely(creatorProfile.context);
    }
  });

  test('@agent-loop shows the agent console and completes a trusted-node agent cycle', async () => {
    ensureExtensionBuilt();

    const creatorUserDataDir = path.join(os.tmpdir(), `coop-agent-loop-${Date.now()}`);
    const creatorProfile = await launchExtensionProfile(creatorUserDataDir);

    try {
      const creatorAppPage = await creatorProfile.context.newPage();
      await creatorAppPage.goto('http://127.0.0.1:3001/manual-roundup-fixture.html');
      await creatorAppPage.evaluate(
        (fixture) => {
          document.title = fixture.title;
          const titleTag = document.querySelector('title');
          if (titleTag) {
            titleTag.textContent = fixture.title;
          }
          const metaDescription = document.querySelector('meta[name="description"]');
          if (metaDescription) {
            metaDescription.setAttribute('content', fixture.description);
          }
          const mainHeading = document.querySelector('h1');
          if (mainHeading) {
            mainHeading.textContent = fixture.heading;
          }
          const sectionHeadings = [...document.querySelectorAll('h2')];
          if (sectionHeadings[0]) {
            sectionHeadings[0].textContent = fixture.whyHeading;
          }
          if (sectionHeadings[1]) {
            sectionHeadings[1].textContent = fixture.nextHeading;
          }
          const paragraphs = [...document.querySelectorAll('p')];
          fixture.paragraphs.forEach((text, index) => {
            if (paragraphs[index]) {
              paragraphs[index].textContent = text;
            }
          });
        },
        {
          title: 'Capital formation roundup for Agent Loop Coop',
          description:
            'Agent Loop Coop tracks ecological funding opportunities, trusted-node review, shared memory, and capital formation briefs.',
          heading: 'Capital formation roundup for Agent Loop Coop',
          whyHeading: 'Why ecological funding matters',
          nextHeading: 'Trusted-node next step',
          paragraphs: [
            'Agent Loop Coop keeps ecological signals, watershed funding leads, and review-ready briefs in one local roundup.',
            'Trusted members use this capital formation roundup to cluster funding opportunities, preserve shared memory, and prepare review-ready funding briefs for weekly review.',
            'The coop needs capital formation context, ecological opportunity tracking, and trusted-node coordination so the strongest funding opportunities are easy to spot.',
            'Round this page up locally, route it into the Roost, and let the trusted helper build a capital formation brief for Agent Loop Coop.',
          ],
        },
      );
      await creatorProfile.page.bringToFront();

      await creatorProfile.page.fill('#coop-name', 'Agent Loop Coop');
      await creatorProfile.page.fill(
        '#coop-purpose',
        'Turn ecological signals into shared funding opportunities and review-ready briefs.',
      );
      await creatorProfile.page.fill('#creator-name', 'Ari');
      await creatorProfile.page.fill(
        '#summary',
        'We want a trusted-node loop that turns local signals into ecological opportunity briefs.',
      );
      await creatorProfile.page.fill(
        '#seed-contribution',
        'I bring watershed funding leads and operator review context.',
      );
      await openOptionalSetup(creatorProfile.page);
      await creatorProfile.page.fill(
        '#capitalCurrent',
        'Funding research is scattered across tabs.',
      );
      await creatorProfile.page.fill('#capitalPain', 'High-signal opportunities are easy to miss.');
      await creatorProfile.page.fill(
        '#capitalImprove',
        'Generate concise, review-ready funding briefs.',
      );
      await creatorProfile.page.fill('#impactCurrent', 'Impact evidence is reviewed ad hoc.');
      await creatorProfile.page.fill('#impactPain', 'Shared context is stale by the time we meet.');
      await creatorProfile.page.fill(
        '#impactImprove',
        'Keep opportunity context fresh in weekly review.',
      );
      await creatorProfile.page.fill(
        '#governanceCurrent',
        'Trusted members coordinate review manually.',
      );
      await creatorProfile.page.fill(
        '#governancePain',
        'Follow-up actions disappear after the meeting.',
      );
      await creatorProfile.page.fill(
        '#governanceImprove',
        'Let the operator console queue bounded actions.',
      );
      await creatorProfile.page.fill(
        '#knowledgeCurrent',
        'Bioregional research lives in open tabs.',
      );
      await creatorProfile.page.fill('#knowledgePain', 'The same research gets repeated.');
      await creatorProfile.page.fill(
        '#knowledgeImprove',
        'Cluster themes into reusable shared memory.',
      );
      await creatorProfile.page
        .getByRole('button', { name: /(launch the coop|start this coop)/i })
        .click();

      await expect(creatorProfile.page.getByText(/coop created\./i)).toBeVisible({
        timeout: 30000,
      });

      await openPanelTab(creatorProfile.page, 'Loose Chickens');
      await creatorProfile.page
        .getByRole('button', { name: /(manual round-up|round up now)/i })
        .click();
      await expect
        .poll(
          async () => {
            const dashboard = await getDashboard(creatorProfile.page);
            return (dashboard?.candidates.length ?? 0) > 0;
          },
          {
            timeout: 15000,
          },
        )
        .toBe(true);

      await openPanelTab(creatorProfile.page, 'Coop Feed');
      await expect(
        creatorProfile.page.getByRole('heading', { name: 'Trusted Helper Runs' }),
      ).toBeVisible();
      await expect(
        creatorProfile.page.getByRole('heading', {
          name: 'What Helpers Noticed',
        }),
      ).toBeVisible();
      await expect(creatorProfile.page.getByText('opportunity-extractor')).toBeVisible();

      await creatorProfile.page
        .getByRole('button', { name: /(run agent cycle|check the helpers)/i })
        .click();
      let capitalFormationCompleted = false;
      let recentRunSummary = [];
      for (let attempt = 0; attempt < 18; attempt += 1) {
        const agentDashboard = await getAgentDashboard(creatorProfile.page);
        recentRunSummary = (agentDashboard?.skillRuns ?? [])
          .slice(-8)
          .map(
            (run) =>
              `${run.skillId}:${run.outputSchemaRef}:${run.status}:${run.provider}:${run.observationId}`,
          );
        capitalFormationCompleted =
          agentDashboard?.skillRuns.some(
            (run) =>
              run.outputSchemaRef === 'capital-formation-brief-output' &&
              run.status === 'completed',
          ) ?? false;
        if (capitalFormationCompleted) {
          break;
        }
        await creatorProfile.page.waitForTimeout(5000);
      }
      expect(
        capitalFormationCompleted,
        `Capital formation run did not complete. Recent skill runs: ${recentRunSummary.join(' | ')}`,
      ).toBe(true);
      await openPanelTab(creatorProfile.page, 'Coop Feed');
      const capitalFormationRun = creatorProfile.page
        .locator('.operator-log-entry')
        .filter({
          has: creatorProfile.page.getByText('capital-formation-brief-output', { exact: true }),
        })
        .first();
      await expect(capitalFormationRun).toBeVisible({
        timeout: 30000,
      });
      await expect(
        capitalFormationRun.getByText('capital-formation-brief', { exact: true }).first(),
      ).toBeVisible({
        timeout: 30000,
      });
      await expect(capitalFormationRun.getByText('completed', { exact: true }).first()).toBeVisible(
        {
          timeout: 30000,
        },
      );

      await openPanelTab(creatorProfile.page, 'Roost');
      await expect
        .poll(
          async () => {
            const dashboard = await getDashboard(creatorProfile.page);
            if (!dashboard) {
              return [];
            }
            return dashboard.drafts
              .filter(
                (draft) =>
                  draft.provenance?.type === 'agent' &&
                  draft.provenance.skillId === 'capital-formation-brief',
              )
              .map((draft) => draft.title);
          },
          {
            timeout: 30000,
          },
        )
        .toContainEqual(expect.stringMatching(/capital formation brief/i));
    } finally {
      await closeContextSafely(creatorProfile.context);
    }
  });
});
