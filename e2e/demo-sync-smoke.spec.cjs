const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir } = require('./helpers/extension-build.cjs');
const { createMockMemberIdentity } = require('./helpers/mock-auth.cjs');

const closeTimeoutMs = 15_000;
const apiPort = process.env.COOP_PLAYWRIGHT_API_PORT || process.env.COOP_DEV_API_PORT || '4444';
const signalingUrl = process.env.COOP_PLAYWRIGHT_SIGNALING_URL || `ws://127.0.0.1:${apiPort}`;
const websocketSyncUrl =
  process.env.VITE_COOP_WEBSOCKET_SYNC_URL || `ws://127.0.0.1:${apiPort}/yws`;
const progressLogPath = path.join(os.tmpdir(), 'coop-demo-sync-smoke-progress.log');

process.env.VITE_COOP_WEBSOCKET_SYNC_URL = websocketSyncUrl;

function withTimeout(promise, timeoutMs, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function logProgress(step, details = {}) {
  const line = `${new Date().toISOString()} ${step}${
    Object.keys(details).length > 0 ? ` ${JSON.stringify(details)}` : ''
  }`;
  fs.appendFileSync(progressLogPath, `${line}\n`);
  console.log(`[demo-sync] ${step}`, details);
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

async function closeContextSafely(context, label) {
  if (!context) {
    return;
  }

  try {
    await Promise.allSettled(
      context.pages().map((page) =>
        withTimeout(page.close(), closeTimeoutMs, `${label} page.close`).catch((error) => {
          if (!isBenignCloseError(error)) {
            throw error;
          }
        }),
      ),
    );

    await withTimeout(
      context.close({ reason: `${label} demo sync e2e teardown` }),
      closeTimeoutMs,
      `${label} context.close`,
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
        browser.close({ reason: `force ${label} demo sync e2e teardown` }),
        closeTimeoutMs,
        `${label} browser.close fallback`,
      );
    } catch (browserError) {
      if (isBenignCloseError(browserError)) {
        return;
      }
      throw browserError;
    }
  }
}

async function launchExtensionProfile(name) {
  const userDataDir = path.join(os.tmpdir(), `coop-demo-sync-${name}-${Date.now()}`);
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
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 15_000,
  });
  await page.waitForLoadState('domcontentloaded');

  return {
    context,
    extensionId,
    page,
  };
}

async function sendRuntimeMessage(page, message, timeoutMs = 15_000) {
  const response = await withTimeout(
    page.evaluate(async (payload) => chrome.runtime.sendMessage(payload), message),
    timeoutMs,
    `runtime message ${message.type}`,
  );
  if (!response?.ok) {
    throw new Error(response?.error ?? `Runtime message ${message.type} failed.`);
  }

  return response.data;
}

async function getCoopSyncRuntime(page) {
  return sendRuntimeMessage(page, { type: 'get-coop-sync-runtime' });
}

async function getCoopSyncConfig(page) {
  return sendRuntimeMessage(page, { type: 'get-coop-sync-config' });
}

function summarizeCoopConfig(config) {
  return {
    coops: (config?.coops ?? []).map((entry) => ({
      coopId: entry.coop.profile.id,
      name: entry.coop.profile.name,
      members: entry.coop.members.map((member) => member.displayName),
      artifacts: entry.coop.artifacts.map((artifact) => artifact.title),
      roomSecretAvailable: entry.roomSecretAvailable,
      runtimeRoomId: entry.providerSyncRoom?.roomId,
    })),
  };
}

async function waitForCoopConfigValue(page, select, timeoutMs, label) {
  const startedAt = Date.now();
  let lastConfig = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastConfig = await getCoopSyncConfig(page);
    if (lastConfig) {
      const value = select(lastConfig);
      if (value) {
        return value;
      }
    }
    await page.waitForTimeout(300);
  }

  throw new Error(
    `Timed out waiting for ${label}. Last coop sync config: ${JSON.stringify(
      summarizeCoopConfig(lastConfig),
    )}`,
  );
}

async function waitForCoopSyncRuntime(page, predicate, timeoutMs, label) {
  const startedAt = Date.now();
  let lastRuntime = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastRuntime = await getCoopSyncRuntime(page);
    if (lastRuntime && predicate(lastRuntime)) {
      return lastRuntime;
    }
    await page.waitForTimeout(500);
  }

  throw new Error(`Timed out waiting for ${label}. Last runtime: ${JSON.stringify(lastRuntime)}`);
}

function hasPeerOrRelaySync(runtime, coopId) {
  return runtime.activeCoopIds.includes(coopId) && ['webrtc', 'websocket'].includes(runtime.mode);
}

async function seedAuthSession(page, identity) {
  await sendRuntimeMessage(page, {
    type: 'set-auth-session',
    payload: identity.session,
  });
}

function buildSetupInsights(seed) {
  return {
    summary: `${seed} needs live shared state proof before the filmed demo.`,
    crossCuttingPainPoints: [
      'A demo can look correct in one profile while shared state is stalled elsewhere.',
    ],
    crossCuttingOpportunities: [
      'Use a short two-profile rehearsal to prove coop sync before recording.',
    ],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Demo opportunities are reviewed locally first.',
        painPoints: 'Funding context can drift between devices.',
        improvements: 'Confirm both member profiles see shared artifacts.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Evidence enters local review before it is shared.',
        painPoints: 'Private drafts can be mistaken for shared memory.',
        improvements: 'Verify publish visibility separately from local review state.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Members join through invites.',
        painPoints: 'Invite handoff can fail if the creator profile is not online.',
        improvements: 'Require the join path to complete through live sync.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Shared notes become artifacts after review.',
        painPoints: 'One-way sync can hide a broken peer profile.',
        improvements: 'Publish from both profiles and check both directions.',
      },
    ],
  };
}

function buildCoopPayload(coopName, creator) {
  return {
    coopName,
    purpose: 'Validate the Kaggle Gemma for Good recording path with live coop sync.',
    creatorDisplayName: creator.displayName,
    captureMode: 'manual',
    seedContribution: 'I bring the creator-side demo profile and shared memory context.',
    setupInsights: buildSetupInsights(coopName),
    signalingUrls: [signalingUrl],
    creator,
  };
}

async function createDemoCoop(page, identity, coopName) {
  await seedAuthSession(page, identity);
  return sendRuntimeMessage(page, {
    type: 'create-coop',
    payload: buildCoopPayload(coopName, identity.member),
  });
}

async function promoteDraft(page, input) {
  return sendRuntimeMessage(page, {
    type: 'promote-signal-to-draft',
    payload: {
      signalId: input.signalId,
      title: input.title,
      url: input.url,
      domain: input.domain,
      category: 'resource',
      tags: input.tags,
      extractId: input.extractId,
      sourceCandidateId: input.sourceCandidateId,
      topRelevanceScore: 0.93,
      targetCoops: [
        {
          coopId: input.coopId,
          coopName: input.coopName,
          rationale: input.rationale,
          suggestedNextStep: input.suggestedNextStep,
          matchedRitualLenses: ['knowledge-garden-resources'],
        },
      ],
    },
  });
}

async function publishDemoArtifact(page, input) {
  const draft = await promoteDraft(page, input);
  const readyDraft = {
    ...draft,
    workflowStage: 'ready',
    suggestedTargetCoopIds: [input.coopId],
  };
  const artifacts = await sendRuntimeMessage(page, {
    type: 'publish-draft',
    payload: {
      draft: readyDraft,
      targetCoopIds: [input.coopId],
    },
  });
  expect(artifacts).toHaveLength(1);
  return artifacts[0];
}

async function waitForArtifact(page, coopId, title, label) {
  return waitForCoopConfigValue(
    page,
    (config) => {
      const coop = config.coops.find((entry) => entry.coop.profile.id === coopId)?.coop;
      return coop?.artifacts.find((artifact) => artifact.title === title) ?? null;
    },
    45_000,
    label,
  );
}

async function waitForMember(page, coopId, displayName, label) {
  return waitForCoopConfigValue(
    page,
    (config) => {
      const coop = config.coops.find((entry) => entry.coop.profile.id === coopId)?.coop;
      return coop?.members.find((member) => member.displayName === displayName) ?? null;
    },
    45_000,
    label,
  );
}

async function refreshCoopSync(page, reason) {
  await sendRuntimeMessage(page, {
    type: 'get-coop-sync-config',
  });
  await sendRuntimeMessage(page, {
    type: 'refresh-coop-sync-bindings',
    payload: { reason },
  });
}

async function syncCoopSnapshotRelay(page, coopId) {
  await sendRuntimeMessage(
    page,
    {
      type: 'sync-coop-snapshot-relay',
      payload: { coopId },
    },
    20_000,
  );
}

test.describe('Kaggle demo sync smoke', () => {
  test.describe.configure({ timeout: 240_000 });

  test.skip(({ isMobile }) => isMobile, 'Demo sync smoke uses two desktop extension profiles.');

  test.beforeAll(() => {
    test.setTimeout(120_000);
    ensureExtensionBuilt();
  });

  test('syncs shared coop artifacts bidirectionally across two extension profiles', async () => {
    fs.writeFileSync(progressLogPath, '');
    logProgress('starting demo sync smoke', {
      signalingUrl,
      websocketSyncUrl,
    });

    const profileA = await launchExtensionProfile('profile-a');
    const profileB = await launchExtensionProfile('profile-b');
    const creatorIdentity = createMockMemberIdentity({
      displayName: 'Demo Creator',
      role: 'creator',
      passkeyCredentialId: 'passkey-demo-creator',
    });
    const memberIdentity = createMockMemberIdentity({
      displayName: 'Demo Member',
      role: 'member',
      passkeyCredentialId: 'passkey-demo-member',
    });

    try {
      const coopName = `Kaggle Demo Sync ${Date.now()}`;
      const coop = await createDemoCoop(profileA.page, creatorIdentity, coopName);
      logProgress('profile A created coop', {
        coopId: coop.profile.id,
        coopName: coop.profile.name,
      });

      await refreshCoopSync(profileA.page, 'demo-smoke-created-coop');
      await waitForCoopSyncRuntime(
        profileA.page,
        (runtime) => runtime.activeCoopIds.includes(coop.profile.id) && runtime.mode !== 'none',
        30_000,
        'profile A coop sync binding',
      );
      logProgress('profile A coop sync binding active');

      const invite = await sendRuntimeMessage(profileA.page, {
        type: 'create-invite',
        payload: {
          coopId: coop.profile.id,
          inviteType: 'trusted',
          createdBy: creatorIdentity.member.id,
        },
      });
      await refreshCoopSync(profileA.page, 'demo-smoke-created-invite');
      logProgress('profile A created trusted invite', {
        inviteId: invite.id,
      });

      await seedAuthSession(profileB.page, memberIdentity);
      const joined = await sendRuntimeMessage(profileB.page, {
        type: 'join-coop',
        payload: {
          inviteCode: invite.code,
          displayName: memberIdentity.member.displayName,
          seedContribution: 'I bring the second browser profile for bidirectional demo proof.',
          member: memberIdentity.member,
        },
      });
      expect(joined.profile.id).toBe(coop.profile.id);
      logProgress('profile B joined coop through invite handoff', {
        coopId: joined.profile.id,
      });

      await refreshCoopSync(profileA.page, 'demo-smoke-after-join-a');
      await refreshCoopSync(profileB.page, 'demo-smoke-after-join-b');
      await waitForMember(
        profileA.page,
        coop.profile.id,
        memberIdentity.member.displayName,
        'profile B member visible in profile A',
      );
      logProgress('profile B membership visible in profile A');

      await waitForCoopSyncRuntime(
        profileB.page,
        (runtime) => runtime.activeCoopIds.includes(coop.profile.id) && runtime.mode !== 'none',
        30_000,
        'profile B coop sync binding',
      );
      logProgress('profile B coop sync binding active');

      const readyRuntimeA = await waitForCoopSyncRuntime(
        profileA.page,
        (runtime) => hasPeerOrRelaySync(runtime, coop.profile.id),
        30_000,
        'profile A peer or relay sync before publish',
      );
      const readyRuntimeB = await waitForCoopSyncRuntime(
        profileB.page,
        (runtime) => hasPeerOrRelaySync(runtime, coop.profile.id),
        30_000,
        'profile B peer or relay sync before publish',
      );
      logProgress('both profiles have peer or relay sync before publish', {
        profileA: {
          mode: readyRuntimeA.mode,
          peerCount: readyRuntimeA.peerCount,
          websocketConnected: readyRuntimeA.websocketConnected,
        },
        profileB: {
          mode: readyRuntimeB.mode,
          peerCount: readyRuntimeB.peerCount,
          websocketConnected: readyRuntimeB.websocketConnected,
        },
      });

      const profileATitle = `Profile A shared memory ${Date.now()}`;
      const profileAArtifact = await publishDemoArtifact(profileA.page, {
        coopId: coop.profile.id,
        coopName: coop.profile.name,
        signalId: `signal-a-${Date.now()}`,
        extractId: `extract-a-${Date.now()}`,
        sourceCandidateId: `candidate-a-${Date.now()}`,
        title: profileATitle,
        url: 'https://example.com/kaggle/profile-a-memory',
        domain: 'example.com',
        tags: ['kaggle-demo', 'profile-a'],
        rationale: 'Profile A is publishing a reviewed shared memory artifact.',
        suggestedNextStep: 'Profile B should see this artifact in shared coop memory.',
      });
      await refreshCoopSync(profileA.page, 'demo-smoke-profile-a-published-artifact');
      await syncCoopSnapshotRelay(profileA.page, coop.profile.id);
      await syncCoopSnapshotRelay(profileB.page, coop.profile.id);
      logProgress('profile A published shared artifact', {
        artifactId: profileAArtifact.id,
        title: profileAArtifact.title,
      });
      await waitForArtifact(
        profileA.page,
        coop.profile.id,
        profileATitle,
        'profile A artifact visible locally in profile A',
      );
      const profileAArtifactFromB = await waitForArtifact(
        profileB.page,
        coop.profile.id,
        profileATitle,
        'profile A artifact visible in profile B',
      );
      logProgress('profile A artifact visible in profile B', {
        artifactId: profileAArtifactFromB.id,
      });

      const profileBTitle = `Profile B shared memory ${Date.now()}`;
      const profileBArtifact = await publishDemoArtifact(profileB.page, {
        coopId: coop.profile.id,
        coopName: coop.profile.name,
        signalId: `signal-b-${Date.now()}`,
        extractId: `extract-b-${Date.now()}`,
        sourceCandidateId: `candidate-b-${Date.now()}`,
        title: profileBTitle,
        url: 'https://example.com/kaggle/profile-b-memory',
        domain: 'example.com',
        tags: ['kaggle-demo', 'profile-b'],
        rationale: 'Profile B is publishing a reviewed shared memory artifact.',
        suggestedNextStep: 'Profile A should see this artifact in shared coop memory.',
      });
      await refreshCoopSync(profileB.page, 'demo-smoke-profile-b-published-artifact');
      await syncCoopSnapshotRelay(profileB.page, coop.profile.id);
      await syncCoopSnapshotRelay(profileA.page, coop.profile.id);
      logProgress('profile B published shared artifact', {
        artifactId: profileBArtifact.id,
        title: profileBArtifact.title,
      });
      await waitForArtifact(
        profileB.page,
        coop.profile.id,
        profileBTitle,
        'profile B artifact visible locally in profile B',
      );
      const profileBArtifactFromA = await waitForArtifact(
        profileA.page,
        coop.profile.id,
        profileBTitle,
        'profile B artifact visible in profile A',
      );
      logProgress('profile B artifact visible in profile A', {
        artifactId: profileBArtifactFromA.id,
      });

      const runtimeA = await waitForCoopSyncRuntime(
        profileA.page,
        (runtime) => hasPeerOrRelaySync(runtime, coop.profile.id),
        30_000,
        'profile A peer or relay sync health',
      );
      const runtimeB = await waitForCoopSyncRuntime(
        profileB.page,
        (runtime) => hasPeerOrRelaySync(runtime, coop.profile.id),
        30_000,
        'profile B peer or relay sync health',
      );
      logProgress('coop sync health exposed as peer or relay', {
        profileA: {
          mode: runtimeA.mode,
          peerCount: runtimeA.peerCount,
          websocketConnected: runtimeA.websocketConnected,
        },
        profileB: {
          mode: runtimeB.mode,
          peerCount: runtimeB.peerCount,
          websocketConnected: runtimeB.websocketConnected,
        },
      });

      logProgress('demo sync smoke completed');
    } finally {
      await closeContextSafely(profileB.context, 'profile B');
      await closeContextSafely(profileA.context, 'profile A');
    }
  });
});
