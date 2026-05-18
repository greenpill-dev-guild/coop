const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir } = require('./helpers/extension-build.cjs');
const { createMockMemberIdentity } = require('./helpers/mock-auth.cjs');

const closeTimeoutMs = 5000;
const popupSnapshotKey = 'coop:popup-snapshot';
const appBaseUrl =
  process.env.COOP_PLAYWRIGHT_BASE_URL ||
  `http://127.0.0.1:${process.env.COOP_PLAYWRIGHT_APP_PORT || process.env.COOP_DEV_APP_PORT || '3001'}`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withTimeout(promise, timeoutMs, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
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

async function openFooterTab(page, name) {
  await page
    .locator('nav[aria-label="Sidepanel navigation"]')
    .getByRole('button', { name: new RegExp(escapeRegExp(name), 'i') })
    .click();
}

async function openNestSubTab(page, name) {
  await page
    .locator('nav[aria-label="Nest sections"]')
    .getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}$`, 'i') })
    .click();
}

async function openRoostSubTab(page, name) {
  await page
    .locator('nav[aria-label="Roost sections"]')
    .getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}$`, 'i') })
    .click();
}

async function ensureFooterTabReady(page, name, locator, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const visible = await locator.isVisible().catch(() => false);
    if (visible) {
      return;
    }

    await openFooterTab(page, name);
    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for the ${name} tab to show the requested control.`);
}

async function ensureNestSubTabReady(page, name, locator, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const visible = await locator.isVisible().catch(() => false);
    if (visible) {
      return;
    }

    await openFooterTab(page, 'Nest');
    await openNestSubTab(page, name);
    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for the Nest ${name} sub-tab to show the requested control.`);
}

async function ensureRoostSubTabReady(page, name, locator, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const visible = await locator.isVisible().catch(() => false);
    if (visible) {
      return;
    }

    await openFooterTab(page, 'Roost');
    await openRoostSubTab(page, name);
    await page.waitForTimeout(250);
  }

  throw new Error(`Timed out waiting for the Roost ${name} sub-tab to show the requested control.`);
}

async function openCoopDetail(page, coopName) {
  await openFooterTab(page, 'Coops');
  const backToAllCoops = page.getByRole('button', { name: /back to all coops/i });
  if (await backToAllCoops.isVisible().catch(() => false)) {
    await backToAllCoops.click();
  }
  await page.locator('.coop-card-button').filter({ hasText: coopName }).first().click();
}

async function findDraftTitleInputByTitle(page, title, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const index = await page
      .locator('.draft-card input[id^="title-"]')
      .evaluateAll(
        (inputs, expectedTitle) => inputs.findIndex((input) => input.value === expectedTitle),
        title,
      );

    if (index >= 0) {
      return page.locator('.draft-card input[id^="title-"]').nth(index);
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Could not find draft title input with title "${title}".`);
}

async function getDashboard(page) {
  const response = await page.evaluate(async () =>
    chrome.runtime.sendMessage({ type: 'get-dashboard' }),
  );
  return response?.ok ? response.data : null;
}

async function getPopupSnapshot(page) {
  return page.evaluate(async (storageKey) => {
    const result = await chrome.storage.local.get(storageKey);
    return result[storageKey] ?? null;
  }, popupSnapshotKey);
}

async function sendRuntimeMessage(page, message) {
  return page.evaluate(async (payload) => chrome.runtime.sendMessage(payload), message);
}

async function setAgentSkillAutoRun(page, skillId, enabled) {
  const response = await sendRuntimeMessage(page, {
    type: 'set-agent-skill-auto-run',
    payload: { skillId, enabled },
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? `Could not update auto-run for ${skillId}.`);
  }

  return response.data;
}

async function runAgentCycle(page) {
  return page.evaluate(() => {
    void chrome.runtime.sendMessage({
      type: 'run-agent-cycle',
    });
    return true;
  });
}

async function approveAgentPlan(page, planId) {
  const response = await sendRuntimeMessage(page, {
    type: 'approve-agent-plan',
    payload: { planId },
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? `Could not approve agent plan ${planId}.`);
  }

  return response.data;
}

async function approveActionBundle(page, bundleId) {
  const response = await sendRuntimeMessage(page, {
    type: 'approve-action',
    payload: { bundleId },
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? `Could not approve action bundle ${bundleId}.`);
  }

  return response.data;
}

async function executeActionBundle(page, bundleId) {
  const response = await sendRuntimeMessage(page, {
    type: 'execute-action',
    payload: { bundleId },
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? `Could not execute action bundle ${bundleId}.`);
  }

  return response.data;
}

function buildSeedCoopPayload(input, creator) {
  return {
    coopName: input.coopName,
    purpose: input.purpose,
    spaceType: input.spaceType,
    creatorDisplayName: input.creatorName ?? 'Ari',
    captureMode: input.captureMode ?? 'manual',
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
    greenGoods: input.greenGoodsEnabled ? { enabled: true } : undefined,
  };
}

async function seedCoop(page, input, creator) {
  const seededCreator = createMockMemberIdentity({
    ...creator,
    displayName: creator?.displayName ?? input.creatorName ?? 'Ari',
    role: 'creator',
  }).member;
  await seedAuthSession(page, seededCreator);

  const response = await sendRuntimeMessage(page, {
    type: 'create-coop',
    payload: buildSeedCoopPayload(input, seededCreator),
  });

  if (!response?.ok || !response.data) {
    throw new Error(response?.error ?? `Could not seed coop ${input.coopName}.`);
  }

  return response.data;
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

async function seedExtensionCoop(page, input) {
  const coop = await seedCoop(page, input, input.creator);
  const creator = coop.members?.[0];
  if (!creator?.address || !creator?.displayName) {
    throw new Error(`Seeded coop ${input.coopName} did not return a creator member.`);
  }

  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  return {
    coop,
    creator,
  };
}

async function setSidepanelUiMode(page, uiMode) {
  const current = await sendRuntimeMessage(page, {
    type: 'get-ui-preferences',
  });
  if (!current?.ok || !current.data) {
    throw new Error(current?.error ?? 'Could not load UI preferences.');
  }

  const response = await sendRuntimeMessage(page, {
    type: 'set-ui-preferences',
    payload: {
      ...current.data,
      uiMode,
    },
  });
  if (!response?.ok) {
    throw new Error(response?.error ?? `Could not switch sidepanel UI mode to ${uiMode}.`);
  }

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
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

  const knownCoops = (lastDashboard?.coops ?? []).map((candidate) => candidate.profile.name);
  throw new Error(
    `Timed out waiting for ${label}. Last dashboard coops: ${knownCoops.join(', ') || 'none'}.`,
  );
}

async function waitForCaptureRunActivity(page, baselineCapturedAt, timeoutMs = 10000) {
  const startedAt = Date.now();
  let lastDashboard = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastDashboard = await getDashboard(page);
    const latestCaptureRun = lastDashboard?.recentCaptureRuns?.[0] ?? null;
    const latestCapturedAt = latestCaptureRun?.capturedAt ?? lastDashboard?.summary?.lastCaptureAt;

    if (latestCapturedAt && latestCapturedAt !== baselineCapturedAt) {
      return latestCaptureRun;
    }

    await page.waitForTimeout(200);
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

async function waitForDraftCountAbove(page, baselineDraftCount, timeoutMs = 30000) {
  return waitForDashboardValue(
    page,
    (dashboard) => {
      const draftCount = dashboard?.drafts.length ?? 0;
      return draftCount > baselineDraftCount ? draftCount : null;
    },
    timeoutMs,
    `draft count above ${baselineDraftCount}`,
  );
}

async function waitForDraftByTitle(page, title, timeoutMs = 30000) {
  return waitForDashboardValue(
    page,
    (dashboard) => dashboard?.drafts.find((draft) => draft.title.trim() === title.trim()) ?? null,
    timeoutMs,
    `draft "${title}"`,
  );
}

async function triggerCapture(page, type = 'manual-capture') {
  const response = await sendRuntimeMessage(page, { type });
  if (!response?.ok) {
    throw new Error(response?.error ?? `Could not trigger ${type}.`);
  }
  if (typeof response.data === 'number' && response.data < 1) {
    throw new Error(`${type} completed without capturing an eligible tab.`);
  }
}

async function getAgentDashboard(page) {
  const response = await page.evaluate(async () =>
    chrome.runtime.sendMessage({ type: 'get-agent-dashboard' }),
  );
  return response?.ok ? response.data : null;
}

async function waitForGardenLinkOrPlan(page, coopName, timeoutMs = 45000) {
  const startedAt = Date.now();
  let lastDashboard = null;
  let lastAgentDashboard = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastDashboard = await getDashboard(page);
    const coop = lastDashboard?.coops.find((candidate) => candidate.profile.name === coopName);
    const gardenAddress = coop?.greenGoods?.gardenAddress ?? null;
    if (gardenAddress) {
      return { kind: 'garden-linked', gardenAddress };
    }

    lastAgentDashboard = await getAgentDashboard(page);
    const pendingPlan = lastAgentDashboard?.plans.find(
      (plan) =>
        plan.status === 'pending' &&
        plan.actionProposals.some(
          (proposal) => proposal.actionClass === 'green-goods-create-garden',
        ),
    );
    if (pendingPlan) {
      return { kind: 'plan-pending', planId: pendingPlan.id };
    }

    await page.waitForTimeout(500);
  }

  const knownPlans = (lastAgentDashboard?.plans ?? [])
    .slice(0, 5)
    .map(
      (plan) =>
        `${plan.status}:${plan.actionProposals.map((proposal) => proposal.actionClass).join(',')}`,
    );
  throw new Error(
    `Timed out waiting for a linked Green Goods garden or pending plan for ${coopName}. Recent plans: ${knownPlans.join(' | ') || 'none'}.`,
  );
}

async function waitForActionBundle(page, select, timeoutMs = 30000, label = 'action bundle') {
  const startedAt = Date.now();
  let lastDashboard = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastDashboard = await getDashboard(page);
    if (lastDashboard) {
      const value = select(lastDashboard.operator?.policyActionQueue ?? []);
      if (value) {
        return value;
      }
    }

    await page.waitForTimeout(250);
  }

  const knownBundles = (lastDashboard?.operator?.policyActionQueue ?? [])
    .slice(0, 5)
    .map((bundle) => `${bundle.status}:${bundle.actionClass}:${bundle.id}`);
  throw new Error(
    `Timed out waiting for ${label}. Recent queued bundles: ${knownBundles.join(' | ') || 'none'}.`,
  );
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

  test('@flow-board publishes memory, archives a result, and opens the board', async () => {
    ensureExtensionBuilt();

    const creatorUserDataDir = path.join(os.tmpdir(), `coop-e2e-creator-${Date.now()}`);
    const memberUserDataDir = path.join(os.tmpdir(), `coop-e2e-member-${Date.now()}`);
    const creatorProfile = await launchExtensionProfile(creatorUserDataDir);
    let memberProfile;

    try {
      await creatorProfile.page.bringToFront();
      await seedExtensionCoop(creatorProfile.page, {
        coopName: 'Coop Town Test',
        purpose: 'Turn loose tabs into shared intelligence and fundable next steps.',
        creatorName: 'Ari',
        summary: 'We need a shared membrane for tabs, funding leads, and next steps.',
        seedContribution: 'I bring loose research tabs and funding opportunities.',
        capitalCurrent: 'Funding links live in scattered docs.',
        capitalPain: 'Good grant context keeps disappearing.',
        capitalImprove: 'Surface fundable leads in shared review.',
        impactCurrent: 'Impact evidence is compiled manually.',
        impactPain: 'Useful evidence arrives too late.',
        impactImprove: 'Keep evidence visible in the coop feed.',
        governanceCurrent: 'Calls happen weekly.',
        governancePain: 'Follow-up work gets lost after calls.',
        governanceImprove: 'Track next steps in the board.',
        knowledgeCurrent: 'Resources live in browser tabs.',
        knowledgePain: 'People repeat the same research.',
        knowledgeImprove: 'Create a shared knowledge commons.',
      });
      await waitForDashboardValue(
        creatorProfile.page,
        (dashboard) =>
          dashboard?.coops.find((candidate) => candidate.profile.name === 'Coop Town Test'),
        15000,
        'Coop Town Test in dashboard',
      );
      const coopHeading = creatorProfile.page.getByRole('heading', { name: 'Coop Town Test' });
      await ensureNestSubTabReady(creatorProfile.page, 'Members', coopHeading, 15000);
      await expect(coopHeading).toBeVisible();
      await expect
        .poll(
          async () => {
            const dashboard = await getDashboard(creatorProfile.page);
            return dashboard?.coops[0]?.onchainState?.safeAddress ?? null;
          },
          {
            timeout: 15000,
          },
        )
        .toMatch(/^0x[a-fA-F0-9]{40}$/);

      const inviteCard = creatorProfile.page
        .locator('details.collapsible-card')
        .filter({
          has: creatorProfile.page.getByRole('heading', {
            name: 'Invite the Flock',
          }),
        })
        .first();
      const inviteCardOpen = await inviteCard.evaluate((element) => element.hasAttribute('open'));
      if (!inviteCardOpen) {
        await inviteCard.locator('summary').click();
      }
      await expect
        .poll(async () => creatorProfile.page.locator('#member-current-code').inputValue(), {
          timeout: 15000,
        })
        .not.toBe('No current code');
      const inviteCode = await creatorProfile.page.locator('#member-current-code').inputValue();
      await expect(creatorProfile.page.locator('#member-current-code')).toHaveValue(/.+/, {
        timeout: 15000,
      });

      memberProfile = await launchExtensionProfile(memberUserDataDir);
      await memberProfile.page.bringToFront();
      const { member: joiningMember, session: joiningSession } = createMockMemberIdentity({
        displayName: 'Mina',
        role: 'member',
      });
      const memberAuthResponse = await sendRuntimeMessage(memberProfile.page, {
        type: 'set-auth-session',
        payload: joiningSession,
      });
      if (!memberAuthResponse?.ok) {
        throw new Error(memberAuthResponse?.error ?? 'Could not seed the member auth session.');
      }
      const joinResponse = await sendRuntimeMessage(memberProfile.page, {
        type: 'join-coop',
        payload: {
          inviteCode,
          displayName: 'Mina',
          seedContribution: 'I bring review energy and member context.',
          member: joiningMember,
        },
      });
      if (!joinResponse?.ok) {
        throw new Error(joinResponse?.error ?? 'Could not join Coop Town Test.');
      }
      await waitForDashboardValue(
        memberProfile.page,
        (dashboard) =>
          dashboard?.coops.find((candidate) => candidate.profile.name === 'Coop Town Test'),
        30000,
        'member joined Coop Town Test',
      );
      await closeContextSafely(memberProfile.context);
      memberProfile = null;

      const creatorAppPage = await creatorProfile.context.newPage();
      await gotoWithRetry(
        creatorAppPage,
        `${appBaseUrl}/manual-roundup-fixture.html?flow-board=${Date.now()}`,
      );
      await creatorAppPage.waitForLoadState('domcontentloaded');
      await expect(
        creatorAppPage.getByRole('heading', {
          level: 1,
          name: 'Funding roundup for Coop Town Test',
        }),
      ).toBeVisible({
        timeout: 15000,
      });

      await creatorProfile.page.bringToFront();
      const baselineDashboard = await getDashboard(creatorProfile.page);
      const baselineCapturedAt =
        baselineDashboard?.recentCaptureRuns?.[0]?.capturedAt ??
        baselineDashboard?.summary?.lastCaptureAt ??
        null;
      await creatorAppPage.bringToFront();
      await triggerCapture(creatorProfile.page);
      await waitForCaptureRunActivity(creatorProfile.page, baselineCapturedAt);
      await waitForDraftByTitle(creatorProfile.page, 'Funding roundup for Coop Town Test', 30000);
      const runtimeDraft = await waitForDraftByTitle(
        creatorProfile.page,
        'Funding roundup for Coop Town Test',
        30000,
      );
      let readyDraft = runtimeDraft;
      if (runtimeDraft.workflowStage !== 'ready') {
        const readyDraftResponse = await sendRuntimeMessage(creatorProfile.page, {
          type: 'update-review-draft',
          payload: {
            draft: {
              ...runtimeDraft,
              workflowStage: 'ready',
            },
          },
        });
        if (!readyDraftResponse?.ok || !readyDraftResponse.data) {
          throw new Error(
            readyDraftResponse?.error ?? 'Could not mark the roundup draft as ready.',
          );
        }
        readyDraft = readyDraftResponse.data;
      }
      if (!readyDraft) {
        throw new Error('Could not mark the roundup draft as ready.');
      }
      const publishedTitle = readyDraft.title;
      const publishResponse = await sendRuntimeMessage(creatorProfile.page, {
        type: 'publish-draft',
        payload: {
          draft: readyDraft,
          targetCoopIds: readyDraft.suggestedTargetCoopIds,
        },
      });
      if (!publishResponse?.ok) {
        throw new Error(publishResponse?.error ?? 'Could not publish the roundup draft.');
      }
      await expect
        .poll(
          async () => {
            const dashboard = await getDashboard(creatorProfile.page);
            const coop = dashboard?.coops.find(
              (candidate) => candidate.profile.name === 'Coop Town Test',
            );
            return (
              coop?.artifacts.some((artifact) => artifact.title.trim() === publishedTitle.trim()) ??
              false
            );
          },
          {
            timeout: 30000,
          },
        )
        .toBe(true);

      await creatorProfile.page.bringToFront();
      await openCoopDetail(creatorProfile.page, 'Coop Town Test');
      await expect(
        creatorProfile.page.getByRole('heading', {
          name: 'Coop Feed',
        }),
      ).toBeVisible({
        timeout: 15000,
      });
      const sharedFindsSection = creatorProfile.page
        .locator('article.panel-card')
        .filter({
          has: creatorProfile.page.getByRole('heading', {
            name: 'Shared Finds',
          }),
        })
        .first();
      const saveableArtifactCard = sharedFindsSection.locator('.artifact-card').first();
      await expect(saveableArtifactCard).toBeVisible({
        timeout: 15000,
      });
      await expect(
        saveableArtifactCard.getByRole('button', { name: 'Save this find', exact: true }),
      ).toBeVisible({
        timeout: 15000,
      });
      const artifactToArchive = await waitForDashboardValue(
        creatorProfile.page,
        (dashboard) => {
          const coop = dashboard?.coops.find(
            (candidate) => candidate.profile.name === 'Coop Town Test',
          );
          if (!coop) {
            return null;
          }
          const artifact = coop.artifacts.find(
            (candidate) => candidate.title.trim() === publishedTitle.trim(),
          );
          return artifact
            ? {
                coopId: coop.profile.id,
                artifactId: artifact.id,
              }
            : null;
        },
        30000,
        `artifact "${publishedTitle}" in Coop Town Test`,
      );
      const archiveArtifactResponse = await sendRuntimeMessage(creatorProfile.page, {
        type: 'archive-artifact',
        payload: {
          coopId: artifactToArchive.coopId,
          artifactId: artifactToArchive.artifactId,
        },
      });
      if (!archiveArtifactResponse?.ok) {
        throw new Error(archiveArtifactResponse?.error ?? 'Could not archive the published find.');
      }
      await expect
        .poll(
          async () => {
            const dashboard = await getDashboard(creatorProfile.page);
            const coop = dashboard?.coops.find(
              (candidate) => candidate.profile.name === 'Coop Town Test',
            );
            return coop?.archiveReceipts.length ?? 0;
          },
          {
            timeout: 30000,
          },
        )
        .toBeGreaterThan(0);

      // Wait for the coop detail UI to render the receipt so boardUrl is fresh
      const savedProofSection = creatorProfile.page
        .locator('article.panel-card')
        .filter({
          has: creatorProfile.page.getByRole('heading', { name: 'Saved Proof' }),
        })
        .first();
      await expect(savedProofSection.locator('.draft-card').first()).toBeVisible({
        timeout: 15000,
      });

      const boardPagePromise = creatorProfile.context.waitForEvent('page');
      await creatorProfile.page.getByRole('button', { name: 'Open Board', exact: true }).click();
      const boardPage = await boardPagePromise;
      await boardPage.waitForURL(/\/board\//, {
        timeout: 15000,
      });
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
      await creatorProfile.page.bringToFront();
      await seedExtensionCoop(creatorProfile.page, {
        coopName: 'Agent Loop Coop',
        purpose:
          'Turn ecological signals into shared funding opportunities and review-ready briefs.',
        creatorName: 'Ari',
        summary:
          'We want a trusted-node loop that turns local signals into ecological opportunity briefs.',
        seedContribution: 'I bring watershed funding leads and operator review context.',
        capitalCurrent: 'Funding research is scattered across tabs.',
        capitalPain: 'High-signal opportunities are easy to miss.',
        capitalImprove: 'Generate concise, review-ready funding briefs.',
        impactCurrent: 'Impact evidence is reviewed ad hoc.',
        impactPain: 'Shared context is stale by the time we meet.',
        impactImprove: 'Keep opportunity context fresh in weekly review.',
        governanceCurrent: 'Trusted members coordinate review manually.',
        governancePain: 'Follow-up actions disappear after the meeting.',
        governanceImprove: 'Let the operator console queue bounded actions.',
        knowledgeCurrent: 'Bioregional research lives in open tabs.',
        knowledgePain: 'The same research gets repeated.',
        knowledgeImprove: 'Cluster themes into reusable shared memory.',
      });
      await setSidepanelUiMode(creatorProfile.page, 'advanced');
      await waitForDashboardValue(
        creatorProfile.page,
        (dashboard) =>
          dashboard?.coops.find((candidate) => candidate.profile.name === 'Agent Loop Coop'),
        15000,
        'Agent Loop Coop in dashboard',
      );

      const creatorAppPage = await creatorProfile.context.newPage();
      await gotoWithRetry(creatorAppPage, `${appBaseUrl}/manual-roundup-fixture.html`);
      await creatorAppPage.waitForLoadState('domcontentloaded');
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

      const baselineDashboard = await getDashboard(creatorProfile.page);
      const baselineDraftCount = baselineDashboard?.drafts.length ?? 0;
      const baselineCapturedAt =
        baselineDashboard?.recentCaptureRuns?.[0]?.capturedAt ??
        baselineDashboard?.summary?.lastCaptureAt ??
        null;
      await creatorAppPage.bringToFront();
      await triggerCapture(creatorProfile.page);
      await waitForCaptureRunActivity(creatorProfile.page, baselineCapturedAt);
      await waitForDraftCountAbove(creatorProfile.page, baselineDraftCount, 20000);
      await creatorProfile.page.bringToFront();
      await openFooterTab(creatorProfile.page, 'Chickens');

      await openFooterTab(creatorProfile.page, 'Nest');
      await openNestSubTab(creatorProfile.page, 'Agent');
      await expect(
        creatorProfile.page.getByRole('heading', { name: 'Trusted Helper Runs' }),
      ).toBeVisible();
      await expect(
        creatorProfile.page.getByRole('heading', {
          name: 'What Helpers Noticed',
        }),
      ).toBeVisible();
      await expect(
        creatorProfile.page.getByText('opportunity-extractor', { exact: true }).first(),
      ).toBeVisible();
      await expect(
        creatorProfile.page.getByRole('heading', {
          name: 'Trusted Helpers',
        }),
      ).toBeVisible();
      await runAgentCycle(creatorProfile.page);
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
      const trustedHelperRuns = creatorProfile.page
        .locator('details.collapsible-card')
        .filter({
          has: creatorProfile.page.getByRole('heading', {
            name: 'Trusted Helper Runs',
          }),
        })
        .first();
      const trustedHelperRunsOpen = await trustedHelperRuns.evaluate((element) =>
        element.hasAttribute('open'),
      );
      if (!trustedHelperRunsOpen) {
        await trustedHelperRuns.locator('summary').click();
      }
      const capitalFormationRun = trustedHelperRuns
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

  test('provisions a member garden account and hatches a sidepanel garden pass in mock-path modes', async ({
    browserName,
  }, testInfo) => {
    void browserName;
    testInfo.setTimeout(300_000);
    ensureExtensionBuilt();

    const creatorUserDataDir = path.join(os.tmpdir(), `coop-sidepanel-onchain-${Date.now()}`);
    const creatorProfile = await launchExtensionProfile(creatorUserDataDir);

    try {
      const { coop } = await seedExtensionCoop(creatorProfile.page, {
        coopName: 'Garden Pass Coop',
        purpose: 'Exercise sidepanel member-account and garden-pass actions before release.',
        creatorName: 'Ari',
        summary:
          'We need stable browser coverage for member provisioning and bounded garden passes.',
        seedContribution:
          'I bring the first Green Goods operator rehearsal for this browser profile.',
        greenGoodsEnabled: true,
        capitalCurrent: 'Operator readiness is mostly verified in unit tests.',
        capitalPain: 'Release regressions can still hide in Chrome.',
        capitalImprove: 'Exercise member-account and garden-pass flows in the real sidepanel.',
        impactCurrent: 'Garden work is rehearsed outside the browser.',
        impactPain: 'Provisioning and pass issuance need browser-backed validation.',
        impactImprove: 'Keep the operator path legible in the release slice.',
        governanceCurrent: 'Trusted members issue capabilities manually.',
        governancePain: 'Session controls can drift without end-to-end browser checks.',
        governanceImprove: 'Confirm garden-pass issuance from the sidepanel itself.',
        knowledgeCurrent: 'Green Goods setup notes live in docs.',
        knowledgePain: 'The real sidepanel path is easy to under-test.',
        knowledgeImprove: 'Capture the browser path in automated release checks.',
      });
      await waitForDashboardValue(
        creatorProfile.page,
        (dashboard) =>
          dashboard?.coops.find((candidate) => candidate.profile.name === 'Garden Pass Coop'),
        15000,
        'Garden Pass Coop in dashboard',
      );
      const runAgentCycleButton = creatorProfile.page.getByRole('button', {
        name: /(run agent cycle|check the helpers)/i,
      });
      await ensureNestSubTabReady(creatorProfile.page, 'Agent', runAgentCycleButton, 30_000);
      await setAgentSkillAutoRun(creatorProfile.page, 'green-goods-garden-bootstrap', true);
      await runAgentCycleButton.dispatchEvent('click');
      const gardenLinkResult = await waitForGardenLinkOrPlan(
        creatorProfile.page,
        'Garden Pass Coop',
        45_000,
      );
      if (gardenLinkResult.kind === 'plan-pending') {
        await approveAgentPlan(creatorProfile.page, gardenLinkResult.planId);
        const createGardenBundle = await waitForActionBundle(
          creatorProfile.page,
          (bundles) =>
            bundles.find(
              (bundle) =>
                bundle.actionClass === 'green-goods-create-garden' &&
                bundle.coopId === coop.profile.id,
            ) ?? null,
          30_000,
          'Green Goods create-garden action bundle',
        );
        if (createGardenBundle.status === 'proposed') {
          await approveActionBundle(creatorProfile.page, createGardenBundle.id);
        }
        await executeActionBundle(creatorProfile.page, createGardenBundle.id);
      }
      await waitForDashboardValue(
        creatorProfile.page,
        (dashboard) => {
          const coop = dashboard?.coops.find(
            (candidate) => candidate.profile.name === 'Garden Pass Coop',
          );
          return coop?.greenGoods?.gardenAddress ?? null;
        },
        45_000,
        'linked Green Goods garden for Garden Pass Coop',
      );

      await waitForDashboardValue(
        creatorProfile.page,
        (dashboard) => {
          const liveCoop = dashboard?.coops.find(
            (candidate) => candidate.profile.id === coop.profile.id,
          );
          return liveCoop?.memberAccounts.find(
            (account) =>
              account.memberId === coop.members[0]?.id &&
              Boolean(account.accountAddress) &&
              (account.status === 'predicted' || account.status === 'active'),
          )
            ? true
            : null;
        },
        30_000,
        'member account ready for Garden Pass Coop',
      );

      const gardenAccountButton = creatorProfile.page.getByRole('button', {
        name: /(provision my garden account|refresh local garden account)/i,
      });
      await ensureRoostSubTabReady(creatorProfile.page, 'Garden', gardenAccountButton);
      await expect(
        creatorProfile.page.getByRole('button', { name: /refresh local garden account/i }),
      ).toBeVisible({
        timeout: 30_000,
      });

      const gardenPassHeading = creatorProfile.page.getByRole('heading', {
        name: 'Garden Passes',
      });
      await ensureNestSubTabReady(creatorProfile.page, 'Agent', gardenPassHeading, 30_000);
      const gardenPassSection = creatorProfile.page
        .locator('details.collapsible-card')
        .filter({
          has: creatorProfile.page.getByRole('heading', { name: 'Garden Passes' }),
        })
        .first();
      const gardenPassSectionOpen = await gardenPassSection.evaluate((element) =>
        element.hasAttribute('open'),
      );
      if (!gardenPassSectionOpen) {
        await gardenPassSection.locator('summary').click();
      }

      const hatchGardenPassButton = gardenPassSection.getByRole('button', {
        name: /hatch (setup|garden) pass/i,
      });
      await ensureNestSubTabReady(creatorProfile.page, 'Agent', hatchGardenPassButton, 30_000);
      await hatchGardenPassButton.click();

      const gardenPass = await waitForDashboardValue(
        creatorProfile.page,
        (dashboard) => dashboard?.operator?.sessionCapabilities[0] ?? null,
        45_000,
        'garden pass in dashboard',
      );
      expect(gardenPass.scope.allowedActions.length).toBeGreaterThan(0);

      const gardenPassLogDetail = await waitForDashboardValue(
        creatorProfile.page,
        (dashboard) => dashboard?.operator?.sessionCapabilityLog[0]?.detail ?? null,
        45_000,
        'garden pass log entry',
      );
      expect(gardenPassLogDetail).toContain('Issued session key');
    } finally {
      await closeContextSafely(creatorProfile.context);
    }
  });
});
