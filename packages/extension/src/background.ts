import {
  type CoopSharedState,
  type InviteType,
  type TabCandidate,
  addInviteToState,
  authSessionToLocalIdentity,
  createArchiveBundle,
  createArchiveReceiptFromUpload,
  createCoop,
  createCoopDb,
  createId,
  createLocalEnhancementAdapter,
  createMockArchiveReceipt,
  createStateFromInviteBootstrap,
  createStorachaArchiveClient,
  defaultSoundPreferences,
  deriveExtensionIconState,
  detectLocalEnhancementAvailability,
  exportArchiveReceiptJson,
  exportArchiveReceiptTextBundle,
  exportArtifactJson,
  exportArtifactTextBundle,
  exportCoopSnapshotJson,
  exportSnapshotTextBundle,
  extensionIconBadge,
  extensionIconStateLabel,
  generateInviteCode,
  getAuthSession,
  getSoundPreferences,
  hydrateCoopDoc,
  joinCoop,
  listLocalIdentities,
  nowIso,
  parseInviteCode,
  publishDraftAcrossCoops,
  readCoopState,
  recordArchiveReceipt,
  requestArchiveDelegation,
  runPassivePipeline,
  saveCoopState,
  setAuthSession,
  setSoundPreferences,
  uploadArchiveBundleToStoracha,
  upsertLocalIdentity,
  verifyInviteCodeProof,
} from '@coop/shared';
import {
  isLocalEnhancementEnabled,
  resolveArchiveGatewayUrl,
  resolveConfiguredArchiveMode,
} from './runtime/config';
import type {
  DashboardResponse,
  RuntimeActionResponse,
  RuntimeRequest,
  RuntimeSummary,
} from './runtime/messages';
import { type CaptureSnapshot, extractPageSnapshot, isSupportedUrl } from './runtime/tab-capture';

const db = createCoopDb('coop-extension');

type RuntimeHealth = {
  offline: boolean;
  missingPermission: boolean;
  syncError: boolean;
  lastCaptureError?: string;
  lastSyncError?: string;
};

const stateKeys = {
  activeCoopId: 'active-coop-id',
  captureMode: 'capture-mode',
  runtimeHealth: 'runtime-health',
};

const defaultRuntimeHealth: RuntimeHealth = {
  offline: false,
  missingPermission: false,
  syncError: false,
};

const configuredArchiveMode = resolveConfiguredArchiveMode(
  import.meta.env.VITE_COOP_ARCHIVE_MODE,
  import.meta.env.VITE_STORACHA_ISSUER_URL,
);
const configuredArchiveIssuerUrl = import.meta.env.VITE_STORACHA_ISSUER_URL;
const configuredArchiveIssuerToken = import.meta.env.VITE_STORACHA_ISSUER_TOKEN;
const configuredArchiveGatewayUrl = resolveArchiveGatewayUrl(
  import.meta.env.VITE_STORACHA_GATEWAY_URL,
);
const prefersLocalEnhancement = isLocalEnhancementEnabled(
  import.meta.env.VITE_COOP_LOCAL_ENHANCEMENT,
);

async function getCoops() {
  const docs = await db.coopDocs.toArray();
  return docs.map((record) => readCoopState(hydrateCoopDoc(record.encodedState)));
}

async function saveState(state: CoopSharedState) {
  await saveCoopState(db, state);
}

async function setLocalSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

async function getLocalSetting<T>(key: string, fallback: T): Promise<T> {
  const record = await db.settings.get(key);
  return (record?.value as T | undefined) ?? fallback;
}

async function getRuntimeHealth() {
  const missingPermission = !(await chrome.permissions.contains({
    permissions: ['storage', 'alarms', 'tabs', 'scripting', 'sidePanel', 'activeTab'],
    origins: ['http://*/*', 'https://*/*'],
  }));
  const offline = typeof navigator !== 'undefined' ? navigator.onLine === false : false;
  const stored = await getLocalSetting<RuntimeHealth>(
    stateKeys.runtimeHealth,
    defaultRuntimeHealth,
  );
  return {
    ...stored,
    offline,
    missingPermission,
  } satisfies RuntimeHealth;
}

async function setRuntimeHealth(patch: Partial<RuntimeHealth>) {
  const current = await getRuntimeHealth();
  const next = {
    ...current,
    ...patch,
  } satisfies RuntimeHealth;
  await setLocalSetting(stateKeys.runtimeHealth, next);
  return next;
}

function localEnhancementAvailability() {
  return detectLocalEnhancementAvailability({
    prefersLocalModels: prefersLocalEnhancement,
    hasWorkerRuntime: true,
    hasWebGpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
  });
}

async function ensureDefaults() {
  const sound = await getSoundPreferences(db);
  if (!sound) {
    await setSoundPreferences(db, defaultSoundPreferences);
  }
  const captureMode = await getLocalSetting(stateKeys.captureMode, null);
  if (!captureMode) {
    await setLocalSetting(stateKeys.captureMode, 'manual');
  }
  const runtimeHealth = await getLocalSetting(stateKeys.runtimeHealth, null);
  if (!runtimeHealth) {
    await setLocalSetting(stateKeys.runtimeHealth, defaultRuntimeHealth);
  }
}

async function syncCaptureAlarm(captureMode: string) {
  await chrome.alarms.clear('coop-capture');
  if (captureMode === 'manual') {
    return;
  }
  await chrome.alarms.create('coop-capture', {
    periodInMinutes: captureMode === '30-min' ? 30 : 60,
  });
}

async function refreshBadge() {
  const summary = await buildSummary();
  const badge = extensionIconBadge(summary.iconState);
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  await chrome.action.setTitle({ title: `Coop: ${summary.iconLabel}` });
}

async function buildSummary(): Promise<RuntimeSummary> {
  const drafts = await db.reviewDrafts.toArray();
  const coops = await getCoops();
  const captureMode = await getLocalSetting(stateKeys.captureMode, 'manual');
  const runtimeHealth = await getRuntimeHealth();
  const activeCoopId =
    (await getLocalSetting<string | undefined>(stateKeys.activeCoopId, undefined)) ??
    coops[0]?.profile.id;
  const lastCapture = await db.captureRuns.orderBy('capturedAt').last();
  const enhancement = localEnhancementAvailability();
  const iconState = deriveExtensionIconState({
    pendingDrafts: drafts.length,
    watching: captureMode !== 'manual',
    offline: runtimeHealth.offline,
    missingPermission: runtimeHealth.missingPermission,
    syncError: runtimeHealth.syncError || Boolean(runtimeHealth.lastCaptureError),
  });

  return {
    iconState,
    iconLabel: extensionIconStateLabel(iconState),
    pendingDrafts: drafts.length,
    coopCount: coops.length,
    syncState:
      runtimeHealth.syncError || runtimeHealth.lastCaptureError
        ? (runtimeHealth.lastSyncError ??
          runtimeHealth.lastCaptureError ??
          'Runtime needs attention')
        : coops.length > 0
          ? 'Peer-ready local-first sync'
          : 'No coop yet',
    lastCaptureAt: lastCapture?.capturedAt,
    captureMode,
    localEnhancement:
      enhancement.status === 'ready'
        ? (enhancement.model ?? enhancement.reason)
        : `Heuristics-first fallback (${enhancement.reason})`,
    activeCoopId,
  };
}

async function getDashboard(): Promise<DashboardResponse> {
  const [coops, drafts, candidates, summary, soundPreferences, authSession, identities] =
    await Promise.all([
      getCoops(),
      db.reviewDrafts.reverse().sortBy('createdAt'),
      db.tabCandidates.reverse().sortBy('capturedAt'),
      buildSummary(),
      getSoundPreferences(db),
      getAuthSession(db),
      listLocalIdentities(db),
    ]);

  return {
    coops,
    activeCoopId: summary.activeCoopId,
    drafts: drafts.reverse(),
    candidates: candidates.reverse().slice(-12).reverse(),
    summary,
    soundPreferences: soundPreferences ?? defaultSoundPreferences,
    authSession,
    identities,
  };
}

async function collectCandidate(
  tab: chrome.tabs.Tab,
): Promise<{ candidate: TabCandidate; snapshot: CaptureSnapshot } | null> {
  if (!tab.id || !tab.url || !isSupportedUrl(tab.url)) {
    return null;
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageSnapshot,
  });

  if (!result) {
    return null;
  }

  return {
    candidate: {
      id: createId('candidate'),
      tabId: tab.id,
      windowId: tab.windowId ?? 0,
      url: tab.url,
      canonicalUrl: tab.url,
      title: result.title || tab.title || tab.url,
      domain: new URL(tab.url).hostname.replace(/^www\./, ''),
      favicon: tab.favIconUrl,
      excerpt: result.metaDescription ?? result.paragraphs[0],
      tabGroupHint: undefined,
      capturedAt: nowIso(),
    },
    snapshot: result,
  };
}

async function runCaptureCycle() {
  const coops = await getCoops();
  const tabs = await chrome.tabs.query({});
  const candidates: TabCandidate[] = [];
  const inferenceAdapter = createLocalEnhancementAdapter({
    prefersLocalModels: prefersLocalEnhancement,
    hasWorkerRuntime: true,
    hasWebGpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
  });
  let lastCaptureError: string | undefined;

  for (const tab of tabs) {
    if (!isSupportedUrl(tab.url)) {
      continue;
    }

    try {
      const collected = await collectCandidate(tab);
      if (!collected) {
        continue;
      }
      const { candidate, snapshot } = collected;
      candidates.push(candidate);
      await db.tabCandidates.put(candidate);

      if (coops.length > 0) {
        const { extract, drafts } = runPassivePipeline({
          candidate,
          page: snapshot,
          coops,
          inferenceAdapter,
        });
        await db.pageExtracts.put(extract);
        await db.reviewDrafts.bulkPut(drafts);
      }
    } catch (error) {
      lastCaptureError =
        error instanceof Error ? error.message : `Capture failed for ${tab.url ?? 'unknown tab'}.`;
    }
  }

  await db.captureRuns.put({
    id: createId('capture'),
    state: lastCaptureError ? 'failed' : 'completed',
    capturedAt: nowIso(),
    candidateCount: candidates.length,
  });
  await setRuntimeHealth({
    syncError: Boolean(lastCaptureError),
    lastCaptureError,
  });
  await refreshBadge();

  return candidates.length;
}

async function handleCreateCoop(message: Extract<RuntimeRequest, { type: 'create-coop' }>) {
  const created = createCoop(message.payload);
  await saveState(created.state);
  await setLocalSetting(stateKeys.activeCoopId, created.state.profile.id);
  await setLocalSetting(stateKeys.captureMode, created.state.profile.captureMode);
  await syncCaptureAlarm(created.state.profile.captureMode);
  await refreshBadge();
  return {
    ok: true,
    data: created.state,
    soundEvent: created.soundEvent,
  } satisfies RuntimeActionResponse<CoopSharedState>;
}

async function handleCreateInvite(message: Extract<RuntimeRequest, { type: 'create-invite' }>) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const invite = addInviteToState(
    coop,
    generateInviteCode({
      state: coop,
      createdBy: message.payload.createdBy,
      type: message.payload.inviteType as InviteType,
    }),
  );
  await saveState(invite);
  await refreshBadge();
  return {
    ok: true,
    data: invite.invites[invite.invites.length - 1],
  } satisfies RuntimeActionResponse;
}

async function handleJoinCoop(message: Extract<RuntimeRequest, { type: 'join-coop' }>) {
  const invite = parseInviteCode(message.payload.inviteCode);
  const coops = await getCoops();
  const existingCoop = coops.find((item) => item.profile.id === invite.bootstrap.coopId);
  if (existingCoop && !verifyInviteCodeProof(invite, existingCoop.syncRoom.inviteSigningSecret)) {
    return { ok: false, error: 'Invite verification failed.' } satisfies RuntimeActionResponse;
  }
  const coop = existingCoop ?? createStateFromInviteBootstrap(invite);

  const joined = joinCoop({
    state: coop,
    invite,
    displayName: message.payload.displayName,
    seedContribution: message.payload.seedContribution,
    member: message.payload.member,
  });
  await saveState(joined.state);
  await setLocalSetting(stateKeys.activeCoopId, joined.state.profile.id);
  await refreshBadge();
  return {
    ok: true,
    data: joined.state,
  } satisfies RuntimeActionResponse;
}

async function handlePublishDraft(message: Extract<RuntimeRequest, { type: 'publish-draft' }>) {
  const coops = await getCoops();
  const targetStates = coops.filter((item) =>
    message.payload.targetCoopIds.includes(item.profile.id),
  );
  if (targetStates.length === 0) {
    return { ok: false, error: 'Target coop not found.' } satisfies RuntimeActionResponse;
  }

  const published = publishDraftAcrossCoops({
    states: targetStates,
    draft: message.payload.draft,
    actorId: message.payload.actorId,
    targetCoopIds: message.payload.targetCoopIds,
  });
  for (const state of published.nextStates) {
    await saveState(state);
  }
  await db.reviewDrafts.delete(message.payload.draft.id);
  await refreshBadge();
  return {
    ok: true,
    data: published.artifacts,
    soundEvent: 'artifact-published',
  } satisfies RuntimeActionResponse;
}

async function createArchiveReceiptForBundle(input: {
  coop: CoopSharedState;
  bundle: ReturnType<typeof createArchiveBundle>;
  artifactIds?: string[];
}) {
  try {
    if (configuredArchiveMode === 'mock') {
      return createMockArchiveReceipt({
        bundle: input.bundle,
        delegationIssuer: 'trusted-node-demo',
        artifactIds: input.artifactIds,
      });
    }

    if (!configuredArchiveIssuerUrl) {
      throw new Error(
        'Live Storacha archive mode is enabled, but no delegation issuer URL is configured.',
      );
    }

    const authSession = await getAuthSession(db);
    if (!authSession) {
      throw new Error('A passkey session is required before live archive upload.');
    }

    const client = await createStorachaArchiveClient();
    const delegation = await requestArchiveDelegation({
      issuerUrl: configuredArchiveIssuerUrl,
      issuerToken: configuredArchiveIssuerToken,
      audienceDid: client.did(),
      coopId: input.coop.profile.id,
      scope: input.bundle.scope,
      artifactIds: input.artifactIds,
      actorAddress: authSession.primaryAddress,
      safeAddress: input.coop.profile.safeAddress,
      chainKey: input.coop.onchainState.chainKey,
    });
    const upload = await uploadArchiveBundleToStoracha({
      bundle: input.bundle,
      delegation: {
        ...delegation,
        gatewayBaseUrl: delegation.gatewayBaseUrl ?? configuredArchiveGatewayUrl,
      },
      client,
    });

    return createArchiveReceiptFromUpload({
      bundle: input.bundle,
      delegationIssuer: delegation.delegationIssuer,
      artifactIds: input.artifactIds,
      rootCid: upload.rootCid,
      shardCids: upload.shardCids,
      pieceCids: upload.pieceCids,
      gatewayUrl: upload.gatewayUrl,
    });
  } catch (error) {
    await setRuntimeHealth({
      syncError: true,
      lastSyncError: error instanceof Error ? error.message : 'Archive upload failed.',
    });
    throw error;
  }
}

async function handleArchiveArtifact(
  message: Extract<RuntimeRequest, { type: 'archive-artifact' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const bundle = createArchiveBundle({
    scope: 'artifact',
    state: coop,
    artifactIds: [message.payload.artifactId],
  });
  const receipt = await createArchiveReceiptForBundle({
    coop,
    bundle,
    artifactIds: [message.payload.artifactId],
  });
  const nextState = recordArchiveReceipt(coop, receipt, [message.payload.artifactId]);
  await saveState(nextState);
  await setRuntimeHealth({
    syncError: false,
    lastSyncError: undefined,
  });
  await refreshBadge();
  return {
    ok: true,
    data: receipt,
  } satisfies RuntimeActionResponse;
}

async function handleArchiveSnapshot(
  message: Extract<RuntimeRequest, { type: 'archive-snapshot' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const bundle = createArchiveBundle({
    scope: 'snapshot',
    state: coop,
  });
  const receipt = await createArchiveReceiptForBundle({
    coop,
    bundle,
  });
  const nextState = recordArchiveReceipt(coop, receipt);
  await saveState(nextState);
  await setRuntimeHealth({
    syncError: false,
    lastSyncError: undefined,
  });
  await refreshBadge();
  return {
    ok: true,
    data: receipt,
  } satisfies RuntimeActionResponse;
}

async function handleExportSnapshot(message: Extract<RuntimeRequest, { type: 'export-snapshot' }>) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  return {
    ok: true,
    data:
      message.payload.format === 'json'
        ? exportCoopSnapshotJson(coop)
        : exportSnapshotTextBundle(coop),
  } satisfies RuntimeActionResponse<string>;
}

async function handleExportArtifact(message: Extract<RuntimeRequest, { type: 'export-artifact' }>) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  const artifact = coop?.artifacts.find((item) => item.id === message.payload.artifactId);
  if (!artifact) {
    return { ok: false, error: 'Artifact not found.' } satisfies RuntimeActionResponse;
  }

  return {
    ok: true,
    data:
      message.payload.format === 'json'
        ? exportArtifactJson(artifact)
        : exportArtifactTextBundle(artifact),
  } satisfies RuntimeActionResponse<string>;
}

async function handleExportReceipt(message: Extract<RuntimeRequest, { type: 'export-receipt' }>) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  const receipt = coop?.archiveReceipts.find((item) => item.id === message.payload.receiptId);
  if (!receipt) {
    return { ok: false, error: 'Archive receipt not found.' } satisfies RuntimeActionResponse;
  }

  return {
    ok: true,
    data:
      message.payload.format === 'json'
        ? exportArchiveReceiptJson(receipt)
        : exportArchiveReceiptTextBundle(receipt),
  } satisfies RuntimeActionResponse<string>;
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await syncCaptureAlarm(await getLocalSetting(stateKeys.captureMode, 'manual'));
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await refreshBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await syncCaptureAlarm(await getLocalSetting(stateKeys.captureMode, 'manual'));
  await refreshBadge();
});

chrome.alarms.onAlarm.addListener(async () => {
  const captureMode = await getLocalSetting(stateKeys.captureMode, 'manual');
  if (captureMode !== 'manual') {
    await runCaptureCycle();
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
  void (async () => {
    await ensureDefaults();

    switch (message.type) {
      case 'get-auth-session':
        sendResponse({
          ok: true,
          data: await getAuthSession(db),
        } satisfies RuntimeActionResponse);
        return;
      case 'set-auth-session':
        await setAuthSession(db, message.payload);
        if (message.payload) {
          const identity = authSessionToLocalIdentity(message.payload);
          if (identity) {
            await upsertLocalIdentity(db, identity);
          }
        }
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      case 'get-dashboard':
        sendResponse({
          ok: true,
          data: await getDashboard(),
        } satisfies RuntimeActionResponse<DashboardResponse>);
        return;
      case 'manual-capture':
        sendResponse({
          ok: true,
          data: await runCaptureCycle(),
        } satisfies RuntimeActionResponse<number>);
        return;
      case 'create-coop':
        sendResponse(await handleCreateCoop(message));
        return;
      case 'create-invite':
        sendResponse(await handleCreateInvite(message));
        return;
      case 'join-coop':
        sendResponse(await handleJoinCoop(message));
        return;
      case 'publish-draft':
        sendResponse(await handlePublishDraft(message));
        return;
      case 'archive-artifact':
        sendResponse(await handleArchiveArtifact(message));
        return;
      case 'archive-snapshot':
        sendResponse(await handleArchiveSnapshot(message));
        return;
      case 'export-snapshot':
        sendResponse(await handleExportSnapshot(message));
        return;
      case 'export-artifact':
        sendResponse(await handleExportArtifact(message));
        return;
      case 'export-receipt':
        sendResponse(await handleExportReceipt(message));
        return;
      case 'set-sound-preferences':
        await setSoundPreferences(db, message.payload);
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      case 'set-capture-mode':
        await setLocalSetting(stateKeys.captureMode, message.payload.captureMode);
        await syncCaptureAlarm(message.payload.captureMode);
        await refreshBadge();
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      case 'set-active-coop':
        await setLocalSetting(stateKeys.activeCoopId, message.payload.coopId);
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      case 'persist-coop-state':
        await saveState(message.payload.state);
        await refreshBadge();
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      case 'report-sync-health':
        await setRuntimeHealth({
          syncError: message.payload.syncError,
          lastSyncError: message.payload.note,
        });
        await refreshBadge();
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
    }
  })().catch((error: unknown) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    } satisfies RuntimeActionResponse);
  });

  return true;
});
