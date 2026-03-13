import {
  type AnchorCapability,
  type CoopSharedState,
  type InviteType,
  type PrivilegedActionLogEntry,
  type ReceiverCapture,
  type ReviewDraft,
  type TabCandidate,
  addInviteToState,
  appendPrivilegedActionLog,
  applyArchiveReceiptFollowUp,
  assertReceiverSyncEnvelope,
  authSessionToLocalIdentity,
  buildReceiverPairingDeepLink,
  createAnchorCapability,
  createArchiveBundle,
  createArchiveReceiptFromUpload,
  createCoop,
  createCoopDb,
  createId,
  createLocalEnhancementAdapter,
  createMockArchiveReceipt,
  createMockOnchainState,
  createPrivilegedActionLogEntry,
  createReceiverDraftSeed,
  createReceiverPairingPayload,
  createStateFromInviteBootstrap,
  createStorachaArchiveClient,
  createUnavailableOnchainState,
  defaultSoundPreferences,
  deployCoopSafe,
  deriveExtensionIconState,
  describeAnchorCapabilityStatus,
  detectLocalEnhancementAvailability,
  encodeReceiverPairingPayload,
  exportArchiveReceiptJson,
  exportArchiveReceiptTextBundle,
  exportArtifactJson,
  exportArtifactTextBundle,
  exportCoopSnapshotJson,
  exportSnapshotTextBundle,
  extensionIconBadge,
  extensionIconStateLabel,
  filterReceiverCapturesForMemberContext,
  filterVisibleReviewDrafts,
  generateInviteCode,
  getAnchorCapability,
  getAuthSession,
  getReceiverCapture,
  getReviewDraft,
  getSoundPreferences,
  hydrateCoopDoc,
  isArchiveReceiptRefreshable,
  joinCoop,
  listLocalIdentities,
  listPrivilegedActionLog,
  listReceiverCaptures,
  listReceiverPairings,
  nowIso,
  parseInviteCode,
  publishDraftAcrossCoops,
  readCoopState,
  receiverSyncAssetToBlob,
  recordArchiveReceipt,
  requestArchiveDelegation,
  requestArchiveReceiptFilecoinInfo,
  resolveDraftTargetCoopIdsForUi,
  runPassivePipeline,
  saveCoopState,
  saveReceiverCapture,
  saveReviewDraft,
  selectActiveReceiverPairingsForSync,
  setActiveReceiverPairing,
  setAnchorCapability,
  setAuthSession,
  setPrivilegedActionLog,
  setSoundPreferences,
  toReceiverPairingRecord,
  updateArchiveReceipt,
  updateReceiverCapture,
  updateReceiverPairing,
  uploadArchiveBundleToStoracha,
  upsertLocalIdentity,
  upsertReceiverPairing,
  verifyInviteCodeProof,
  withArchiveWorthiness,
} from '@coop/shared';
import {
  isLocalEnhancementEnabled,
  resolveArchiveGatewayUrl,
  resolveConfiguredArchiveMode,
  resolveConfiguredChain,
  resolveConfiguredOnchainMode,
  resolveReceiverAppUrl,
} from './runtime/config';
import type {
  DashboardResponse,
  ReceiverSyncRuntimeStatus,
  RuntimeActionResponse,
  RuntimeRequest,
  RuntimeSummary,
} from './runtime/messages';
import {
  describeArchiveLiveFailure,
  describePrivilegedFeatureAvailability,
  requireAnchorModeForFeature,
} from './runtime/operator';
import {
  filterVisibleReceiverPairings,
  isReceiverCaptureVisibleForMemberContext,
  resolveActiveReviewContext,
  resolveReceiverPairingMember,
} from './runtime/receiver';
import { validateReviewDraftPublish, validateReviewDraftUpdate } from './runtime/review';
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
  receiverSyncRuntime: 'receiver-sync-runtime',
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
const configuredChain = resolveConfiguredChain(import.meta.env.VITE_COOP_CHAIN);
const configuredOnchainMode = resolveConfiguredOnchainMode(
  import.meta.env.VITE_COOP_ONCHAIN_MODE,
  import.meta.env.VITE_PIMLICO_API_KEY,
);
const configuredReceiverAppUrl = resolveReceiverAppUrl(import.meta.env.VITE_COOP_RECEIVER_APP_URL);
const prefersLocalEnhancement = isLocalEnhancementEnabled(
  import.meta.env.VITE_COOP_LOCAL_ENHANCEMENT,
);
let receiverSyncDocumentPromise: Promise<void> | null = null;

async function hasReceiverSyncOffscreenDocument(
  offscreenApi: typeof chrome.offscreen & {
    hasDocument?: () => Promise<boolean>;
  },
) {
  if (offscreenApi.hasDocument) {
    return offscreenApi.hasDocument();
  }

  const runtimeApi = chrome.runtime as typeof chrome.runtime & {
    getContexts?: (filter: {
      contextTypes?: string[];
      documentUrls?: string[];
    }) => Promise<Array<{ documentUrl?: string }>>;
  };
  if (!runtimeApi.getContexts) {
    return false;
  }

  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const contexts = await runtimeApi.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  });
  return contexts.some((context) => context.documentUrl === offscreenUrl);
}

async function ensureReceiverSyncOffscreenDocument() {
  const offscreenApi = chrome.offscreen as typeof chrome.offscreen & {
    hasDocument?: () => Promise<boolean>;
  };

  if (!offscreenApi?.createDocument) {
    return;
  }

  const existingDocument = await hasReceiverSyncOffscreenDocument(offscreenApi);
  if (existingDocument) {
    return;
  }

  if (!receiverSyncDocumentPromise) {
    receiverSyncDocumentPromise = offscreenApi
      .createDocument({
        url: 'offscreen.html',
        reasons: ['WEB_RTC'],
        justification: 'Keep receiver sync alive while the sidepanel is closed.',
      })
      .catch(async (error) => {
        if (await hasReceiverSyncOffscreenDocument(offscreenApi)) {
          return;
        }
        throw error;
      })
      .finally(() => {
        receiverSyncDocumentPromise = null;
      });
  }

  await receiverSyncDocumentPromise;
}

async function getCoops() {
  const docs = await db.coopDocs.toArray();
  return docs.map((record) => readCoopState(hydrateCoopDoc(record.encodedState)));
}

async function getReceiverSyncConfig() {
  const [pairings, coops, authSession] = await Promise.all([
    listReceiverPairings(db),
    getCoops(),
    getAuthSession(db),
  ]);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  return {
    pairings: filterVisibleReceiverPairings(
      selectActiveReceiverPairingsForSync(pairings),
      activeContext.activeCoopId,
      activeContext.activeMemberId,
    ),
  };
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

async function getReceiverSyncRuntime() {
  return getLocalSetting<ReceiverSyncRuntimeStatus>(stateKeys.receiverSyncRuntime, {
    activePairingIds: [],
    activeBindingKeys: [],
    transport: 'none',
  });
}

async function reportReceiverSyncRuntime(patch: Partial<ReceiverSyncRuntimeStatus>) {
  const current = await getReceiverSyncRuntime();
  const next = {
    ...current,
    ...patch,
    activePairingIds: patch.activePairingIds ?? current.activePairingIds,
    activeBindingKeys: patch.activeBindingKeys ?? current.activeBindingKeys,
  } satisfies ReceiverSyncRuntimeStatus;
  await setLocalSetting(stateKeys.receiverSyncRuntime, next);
  return next;
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
  const [drafts, coops, captureMode, runtimeHealth, authSession, lastCapture] = await Promise.all([
    db.reviewDrafts.toArray(),
    getCoops(),
    getLocalSetting(stateKeys.captureMode, 'manual'),
    getRuntimeHealth(),
    getAuthSession(db),
    db.captureRuns.orderBy('capturedAt').last(),
  ]);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const visibleDrafts = filterVisibleReviewDrafts(
    drafts,
    activeContext.activeCoopId,
    activeContext.activeMemberId,
  );
  const enhancement = localEnhancementAvailability();
  const iconState = deriveExtensionIconState({
    pendingDrafts: visibleDrafts.length,
    watching: captureMode !== 'manual',
    offline: runtimeHealth.offline,
    missingPermission: runtimeHealth.missingPermission,
    syncError: runtimeHealth.syncError || Boolean(runtimeHealth.lastCaptureError),
  });

  return {
    iconState,
    iconLabel: extensionIconStateLabel(iconState),
    pendingDrafts: visibleDrafts.length,
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
    activeCoopId: activeContext.activeCoopId,
  };
}

async function getOperatorState(input?: {
  coops?: CoopSharedState[];
  authSession?: Awaited<ReturnType<typeof getAuthSession>>;
}) {
  const coops = input?.coops ?? (await getCoops());
  const authSession = input?.authSession ?? (await getAuthSession(db));
  const [anchorCapability, actionLog] = await Promise.all([
    getAnchorCapability(db),
    listPrivilegedActionLog(db),
  ]);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const activeCoop = coops.find((coop) => coop.profile.id === activeContext.activeCoopId);
  const activeMember = resolveReceiverPairingMember(activeCoop, authSession);
  const anchorStatus = describeAnchorCapabilityStatus({
    capability: anchorCapability,
    authSession,
  });
  const liveArchive = describePrivilegedFeatureAvailability({
    mode: configuredArchiveMode,
    capability: anchorCapability,
    authSession,
    liveLabel: 'archive uploads',
  });
  const liveOnchain = describePrivilegedFeatureAvailability({
    mode: configuredOnchainMode,
    capability: anchorCapability,
    authSession,
    liveLabel: 'Safe deployments',
  });

  return {
    anchorCapability,
    actionLog,
    authSession,
    activeCoop,
    activeContext,
    activeMember,
    anchorStatus,
    liveArchive,
    liveOnchain,
  };
}

async function appendOperatorActionLog(entry: PrivilegedActionLogEntry) {
  const current = await listPrivilegedActionLog(db);
  const next = appendPrivilegedActionLog(current, entry);
  await setPrivilegedActionLog(db, next);
  return next;
}

async function logPrivilegedAction(input: {
  actionType: PrivilegedActionLogEntry['actionType'];
  status: PrivilegedActionLogEntry['status'];
  detail: string;
  coop?: CoopSharedState;
  memberId?: string;
  memberDisplayName?: string;
  authSession?: Awaited<ReturnType<typeof getAuthSession>>;
  artifactId?: string;
  receiptId?: string;
  archiveScope?: PrivilegedActionLogEntry['context']['archiveScope'];
}) {
  const authSession = input.authSession ?? (await getAuthSession(db));
  const entry = createPrivilegedActionLogEntry({
    actionType: input.actionType,
    status: input.status,
    detail: input.detail,
    context: {
      coopId: input.coop?.profile.id,
      coopName: input.coop?.profile.name,
      memberId: input.memberId,
      memberDisplayName: input.memberDisplayName,
      actorAddress: authSession?.primaryAddress,
      chainKey: input.coop?.onchainState.chainKey,
      artifactId: input.artifactId,
      receiptId: input.receiptId,
      archiveScope: input.archiveScope,
      mode:
        input.actionType === 'safe-deployment'
          ? configuredOnchainMode
          : input.actionType === 'anchor-mode-toggle'
            ? undefined
            : configuredArchiveMode,
    },
  });
  await appendOperatorActionLog(entry);
  return entry;
}

async function getActiveReviewContextForSession(
  coops: CoopSharedState[],
  authSession: Awaited<ReturnType<typeof getAuthSession>>,
) {
  const requestedActiveCoopId = await getLocalSetting<string | undefined>(
    stateKeys.activeCoopId,
    undefined,
  );
  return resolveActiveReviewContext(coops, authSession, requestedActiveCoopId);
}

async function getDashboard(): Promise<DashboardResponse> {
  const [
    coops,
    drafts,
    candidates,
    summary,
    soundPreferences,
    authSession,
    identities,
    receiverPairings,
    receiverIntake,
  ] = await Promise.all([
    getCoops(),
    db.reviewDrafts.reverse().sortBy('createdAt'),
    db.tabCandidates.reverse().sortBy('capturedAt'),
    buildSummary(),
    getSoundPreferences(db),
    getAuthSession(db),
    listLocalIdentities(db),
    listReceiverPairings(db),
    listReceiverCaptures(db),
  ]);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const orderedDrafts = drafts.reverse();
  const visibleDrafts = filterVisibleReviewDrafts(
    orderedDrafts,
    activeContext.activeCoopId,
    activeContext.activeMemberId,
  );
  const visibleReceiverIntake = filterReceiverCapturesForMemberContext(
    receiverIntake,
    activeContext.activeCoopId,
    activeContext.activeMemberId,
  );
  const visibleReceiverPairings = filterVisibleReceiverPairings(
    receiverPairings,
    activeContext.activeCoopId,
    activeContext.activeMemberId,
  );
  const operator = await getOperatorState({
    coops,
    authSession,
  });

  return {
    coops,
    activeCoopId: activeContext.activeCoopId ?? summary.activeCoopId,
    drafts: visibleDrafts,
    candidates: candidates.reverse().slice(-12).reverse(),
    summary,
    soundPreferences: soundPreferences ?? defaultSoundPreferences,
    authSession,
    identities,
    receiverPairings: visibleReceiverPairings,
    receiverIntake: visibleReceiverIntake,
    operator: {
      anchorCapability: operator.anchorCapability,
      anchorActive: operator.anchorStatus.active,
      anchorDetail: operator.anchorStatus.detail,
      actionLog: operator.actionLog,
      archiveMode: configuredArchiveMode,
      onchainMode: configuredOnchainMode,
      liveArchiveAvailable: operator.liveArchive.available,
      liveArchiveDetail: operator.liveArchive.detail,
      liveOnchainAvailable: operator.liveOnchain.available,
      liveOnchainDetail: operator.liveOnchain.detail,
    },
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

async function handleSetAnchorMode(message: Extract<RuntimeRequest, { type: 'set-anchor-mode' }>) {
  const operator = await getOperatorState();
  if (message.payload.enabled && !operator.authSession) {
    return {
      ok: false,
      error: 'Anchor mode requires an authenticated passkey member session.',
    } satisfies RuntimeActionResponse;
  }

  const capability = createAnchorCapability({
    enabled: message.payload.enabled,
    authSession: operator.authSession,
    memberId: operator.activeMember?.id,
    memberDisplayName: operator.activeMember?.displayName,
  });
  await setAnchorCapability(db, capability);
  await logPrivilegedAction({
    actionType: 'anchor-mode-toggle',
    status: 'succeeded',
    detail: message.payload.enabled
      ? 'Anchor mode enabled for this operator node.'
      : 'Anchor mode disabled for this operator node.',
    coop: operator.activeCoop,
    memberId: operator.activeMember?.id,
    memberDisplayName: operator.activeMember?.displayName,
    authSession: operator.authSession,
  });
  return {
    ok: true,
    data: capability,
  } satisfies RuntimeActionResponse<AnchorCapability>;
}

async function handleResolveOnchainState(
  message: Extract<RuntimeRequest, { type: 'resolve-onchain-state' }>,
) {
  const authSession = await getAuthSession(db);
  if (!authSession) {
    return {
      ok: false,
      error: 'A passkey session is required before creating a coop.',
    } satisfies RuntimeActionResponse;
  }

  if (configuredOnchainMode === 'mock') {
    return {
      ok: true,
      data: createMockOnchainState({
        seed: message.payload.coopSeed,
        senderAddress: authSession.primaryAddress,
        chainKey: configuredChain,
      }),
    } satisfies RuntimeActionResponse;
  }

  const pimlicoApiKey = import.meta.env.VITE_PIMLICO_API_KEY;
  if (!pimlicoApiKey) {
    return {
      ok: true,
      data: createUnavailableOnchainState({
        safeAddressSeed: message.payload.coopSeed,
        senderAddress: authSession.primaryAddress,
        chainKey: configuredChain,
      }),
    } satisfies RuntimeActionResponse;
  }

  const operator = await getOperatorState({
    authSession,
  });

  try {
    await logPrivilegedAction({
      actionType: 'safe-deployment',
      status: 'attempted',
      detail: 'Attempting live Safe deployment.',
      coop: operator.activeCoop,
      memberId: operator.activeMember?.id,
      memberDisplayName: operator.activeMember?.displayName,
      authSession,
    });
    requireAnchorModeForFeature({
      capability: operator.anchorCapability,
      authSession,
      feature: 'live Safe deployments',
    });
    const onchainState = await deployCoopSafe({
      authSession,
      coopSeed: message.payload.coopSeed,
      pimlico: {
        apiKey: pimlicoApiKey,
        chainKey: configuredChain,
        sponsorshipPolicyId: import.meta.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID,
      },
    });
    await logPrivilegedAction({
      actionType: 'safe-deployment',
      status: 'succeeded',
      detail: `Live Safe deployed on ${onchainState.chainKey}.`,
      coop: operator.activeCoop,
      memberId: operator.activeMember?.id,
      memberDisplayName: operator.activeMember?.displayName,
      authSession,
    });
    return {
      ok: true,
      data: onchainState,
    } satisfies RuntimeActionResponse;
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : 'Live Safe deployment failed unexpectedly.';
    await logPrivilegedAction({
      actionType: 'safe-deployment',
      status: 'failed',
      detail: messageText,
      coop: operator.activeCoop,
      memberId: operator.activeMember?.id,
      memberDisplayName: operator.activeMember?.displayName,
      authSession,
    });
    return {
      ok: false,
      error: messageText,
    } satisfies RuntimeActionResponse;
  }
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

function isIdempotentReceiverReplay(
  existing: Awaited<ReturnType<typeof getReceiverCapture>>,
  incoming: Extract<RuntimeRequest, { type: 'ingest-receiver-capture' }>['payload']['capture'],
  pairing: { pairingId: string; coopId: string; memberId: string },
) {
  if (!existing) {
    return false;
  }

  return (
    existing.pairingId === pairing.pairingId &&
    existing.coopId === pairing.coopId &&
    existing.memberId === pairing.memberId &&
    existing.deviceId === incoming.deviceId &&
    existing.kind === incoming.kind &&
    existing.title === incoming.title &&
    existing.note === incoming.note &&
    existing.fileName === incoming.fileName &&
    existing.mimeType === incoming.mimeType &&
    existing.byteSize === incoming.byteSize &&
    existing.createdAt === incoming.createdAt
  );
}

function receiverDraftStageToIntakeStatus(stage: ReviewDraft['workflowStage']) {
  return stage === 'candidate' ? 'candidate' : 'draft';
}

async function syncReceiverCaptureFromDraft(
  draft: ReviewDraft,
  patch: Partial<ReceiverCapture> = {},
) {
  if (draft.provenance.type !== 'receiver') {
    return null;
  }

  const capture = await getReceiverCapture(db, draft.provenance.captureId);
  if (!capture) {
    return null;
  }

  return updateReceiverCapture(db, capture.id, {
    intakeStatus: receiverDraftStageToIntakeStatus(draft.workflowStage),
    linkedDraftId: draft.id,
    updatedAt: nowIso(),
    ...patch,
  });
}

async function handleCreateReceiverPairing(
  message: Extract<RuntimeRequest, { type: 'create-receiver-pairing' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(coop, authSession, message.payload.memberId);
  if (!member) {
    return {
      ok: false,
      error: 'Receiver pairing must use the current authenticated member for this coop.',
    } satisfies RuntimeActionResponse;
  }

  const payload = createReceiverPairingPayload({
    coopId: coop.profile.id,
    coopDisplayName: coop.profile.name,
    memberId: member.id,
    memberDisplayName: member.displayName,
    signalingUrls: coop.syncRoom.signalingUrls,
  });
  const pairingCode = encodeReceiverPairingPayload(payload);
  const pairing = {
    ...toReceiverPairingRecord(payload),
    pairingCode,
    deepLink: buildReceiverPairingDeepLink(configuredReceiverAppUrl, pairingCode),
  };

  await upsertReceiverPairing(db, pairing);
  await setActiveReceiverPairing(db, pairing.pairingId);
  await ensureReceiverSyncOffscreenDocument();

  return {
    ok: true,
    data: pairing,
  } satisfies RuntimeActionResponse<typeof pairing>;
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

async function handleSetActiveReceiverPairing(
  message: Extract<RuntimeRequest, { type: 'set-active-receiver-pairing' }>,
) {
  const [pairings, coops, authSession] = await Promise.all([
    listReceiverPairings(db),
    getCoops(),
    getAuthSession(db),
  ]);
  const pairing = pairings.find((item) => item.pairingId === message.payload.pairingId);
  if (!pairing) {
    return { ok: false, error: 'Receiver pairing not found.' } satisfies RuntimeActionResponse;
  }
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  if (
    !filterVisibleReceiverPairings(
      [pairing],
      activeContext.activeCoopId,
      activeContext.activeMemberId,
    ).length
  ) {
    return {
      ok: false,
      error:
        'Receiver pairings can only be activated for the current authenticated member in this coop.',
    } satisfies RuntimeActionResponse;
  }
  await setActiveReceiverPairing(db, message.payload.pairingId);
  await ensureReceiverSyncOffscreenDocument();
  return { ok: true } satisfies RuntimeActionResponse;
}

async function handleIngestReceiverCapture(
  message: Extract<RuntimeRequest, { type: 'ingest-receiver-capture' }>,
) {
  const pairingId = message.payload.capture.pairingId;
  if (!pairingId) {
    return { ok: false, error: 'Receiver pairing is missing.' } satisfies RuntimeActionResponse;
  }

  const pairing = await db.receiverPairings.get(pairingId);
  if (!pairing) {
    return {
      ok: false,
      error: 'Receiver pairing is unknown to this extension.',
    } satisfies RuntimeActionResponse;
  }

  let envelope: Awaited<ReturnType<typeof assertReceiverSyncEnvelope>> | null = null;
  try {
    envelope = await assertReceiverSyncEnvelope(message.payload, pairing);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Receiver payload is malformed.',
    } satisfies RuntimeActionResponse;
  }

  if (!envelope) {
    return {
      ok: false,
      error: 'Receiver payload is malformed.',
    } satisfies RuntimeActionResponse;
  }

  const existingCapture = await getReceiverCapture(db, message.payload.capture.id);
  if (isIdempotentReceiverReplay(existingCapture, envelope.capture, pairing)) {
    return {
      ok: true,
      data: existingCapture,
    } satisfies RuntimeActionResponse<typeof existingCapture>;
  }

  if (existingCapture) {
    return {
      ok: false,
      error: 'Receiver capture id conflicts with an existing intake item.',
    } satisfies RuntimeActionResponse;
  }

  const syncedAt = nowIso();
  const capture = {
    ...envelope.capture,
    pairingId: pairing.pairingId,
    coopId: pairing.coopId,
    coopDisplayName: pairing.coopDisplayName,
    memberId: pairing.memberId,
    memberDisplayName: pairing.memberDisplayName,
    syncState: 'synced',
    syncError: undefined,
    syncedAt,
    updatedAt: syncedAt,
  };

  await saveReceiverCapture(db, capture, receiverSyncAssetToBlob(envelope.asset));
  await updateReceiverPairing(db, pairingId, {
    lastSyncedAt: syncedAt,
  });
  await refreshBadge();

  return {
    ok: true,
    data: capture,
  } satisfies RuntimeActionResponse<typeof capture>;
}

async function handleConvertReceiverIntake(
  message: Extract<RuntimeRequest, { type: 'convert-receiver-intake' }>,
) {
  const capture = await getReceiverCapture(db, message.payload.captureId);
  if (!capture) {
    return { ok: false, error: 'Receiver capture not found.' } satisfies RuntimeActionResponse;
  }

  const coops = await getCoops();
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  if (
    !isReceiverCaptureVisibleForMemberContext(
      capture,
      activeContext.activeCoopId,
      activeContext.activeMemberId,
    )
  ) {
    return {
      ok: false,
      error: 'Receiver captures stay private to the paired member who captured them.',
    } satisfies RuntimeActionResponse;
  }

  const availableCoopIds = coops.map((state) => state.profile.id);
  const preferredCoopId =
    message.payload.targetCoopId ?? activeContext.activeCoopId ?? capture.coopId;
  const preferredTargetCoopIds = resolveDraftTargetCoopIdsForUi(
    [preferredCoopId ?? capture.coopId].filter(Boolean) as string[],
    availableCoopIds,
    preferredCoopId ?? capture.coopId,
  );

  if (preferredTargetCoopIds.length === 0) {
    return {
      ok: false,
      error: 'No available coop target is ready for this receiver draft.',
    } satisfies RuntimeActionResponse;
  }

  const existingDraftId = capture.linkedDraftId ?? `draft-receiver-${capture.id}`;
  const existingDraft = await getReviewDraft(db, existingDraftId);
  const preferredCoop = coops.find((state) => state.profile.id === preferredTargetCoopIds[0]);
  const draft =
    existingDraft && existingDraft.provenance.type === 'receiver'
      ? {
          ...existingDraft,
          workflowStage: message.payload.workflowStage,
          suggestedTargetCoopIds: resolveDraftTargetCoopIdsForUi(
            existingDraft.suggestedTargetCoopIds,
            availableCoopIds,
            preferredTargetCoopIds[0],
          ),
        }
      : createReceiverDraftSeed({
          capture,
          availableCoopIds,
          preferredCoopId: preferredTargetCoopIds[0],
          preferredCoopLabel: preferredCoop?.profile.name,
          workflowStage: message.payload.workflowStage,
        });

  await saveReviewDraft(db, draft);
  await updateReceiverCapture(db, capture.id, {
    intakeStatus: receiverDraftStageToIntakeStatus(draft.workflowStage),
    linkedDraftId: draft.id,
    archivedAt: undefined,
    updatedAt: nowIso(),
  });
  await refreshBadge();

  return {
    ok: true,
    data: draft,
  } satisfies RuntimeActionResponse<ReviewDraft>;
}

async function handleArchiveReceiverIntake(
  message: Extract<RuntimeRequest, { type: 'archive-receiver-intake' }>,
) {
  const capture = await getReceiverCapture(db, message.payload.captureId);
  if (!capture) {
    return { ok: false, error: 'Receiver capture not found.' } satisfies RuntimeActionResponse;
  }

  if (capture.linkedDraftId) {
    await db.reviewDrafts.delete(capture.linkedDraftId);
  }

  await updateReceiverCapture(db, capture.id, {
    intakeStatus: 'archived',
    archivedAt: nowIso(),
    linkedDraftId: undefined,
    updatedAt: nowIso(),
  });
  await refreshBadge();

  return { ok: true } satisfies RuntimeActionResponse;
}

async function handleSetReceiverIntakeArchiveWorthiness(
  message: Extract<RuntimeRequest, { type: 'set-receiver-intake-archive-worthy' }>,
) {
  const capture = await getReceiverCapture(db, message.payload.captureId);
  if (!capture) {
    return { ok: false, error: 'Receiver capture not found.' } satisfies RuntimeActionResponse;
  }

  const coops = await getCoops();
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  if (
    !isReceiverCaptureVisibleForMemberContext(
      capture,
      activeContext.activeCoopId,
      activeContext.activeMemberId,
    )
  ) {
    return {
      ok: false,
      error: 'Receiver captures stay private to the paired member who captured them.',
    } satisfies RuntimeActionResponse;
  }

  const nextArchiveWorthiness = withArchiveWorthiness(
    capture,
    message.payload.archiveWorthy,
    nowIso(),
  ).archiveWorthiness;
  const nextCapture = await updateReceiverCapture(db, capture.id, {
    archiveWorthiness: nextArchiveWorthiness,
    updatedAt: nowIso(),
  });

  if (capture.linkedDraftId) {
    const linkedDraft = await getReviewDraft(db, capture.linkedDraftId);
    if (
      linkedDraft?.provenance.type === 'receiver' &&
      linkedDraft.provenance.captureId === capture.id
    ) {
      await saveReviewDraft(db, {
        ...linkedDraft,
        archiveWorthiness: nextArchiveWorthiness,
      });
    }
  }

  await refreshBadge();
  return {
    ok: true,
    data: nextCapture,
  } satisfies RuntimeActionResponse;
}

async function handleUpdateReviewDraft(
  message: Extract<RuntimeRequest, { type: 'update-review-draft' }>,
) {
  const coops = await getCoops();
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const persistedDraft = await getReviewDraft(db, message.payload.draft.id);
  const validation = validateReviewDraftUpdate({
    persistedDraft,
    incomingDraft: message.payload.draft,
    availableCoopIds: coops.map((state) => state.profile.id),
    activeCoopId: activeContext.activeCoopId,
    activeMemberId: activeContext.activeMemberId,
  });
  if (!validation.ok) {
    return { ok: false, error: validation.error } satisfies RuntimeActionResponse;
  }

  await saveReviewDraft(db, validation.draft);
  await syncReceiverCaptureFromDraft(validation.draft);
  await refreshBadge();

  return {
    ok: true,
    data: validation.draft,
  } satisfies RuntimeActionResponse<ReviewDraft>;
}

async function handleUpdateMeetingSettings(
  message: Extract<RuntimeRequest, { type: 'update-meeting-settings' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  const [currentRitual, ...remainingRituals] = coop.rituals;
  if (!currentRitual) {
    return {
      ok: false,
      error: 'Meeting settings are unavailable for this coop.',
    } satisfies RuntimeActionResponse;
  }

  const nextState = {
    ...coop,
    rituals: [
      {
        ...currentRitual,
        weeklyReviewCadence: message.payload.weeklyReviewCadence,
        facilitatorExpectation: message.payload.facilitatorExpectation,
        defaultCapturePosture: message.payload.defaultCapturePosture,
      },
      ...remainingRituals,
    ],
  } satisfies CoopSharedState;
  await saveState(nextState);

  return { ok: true, data: nextState } satisfies RuntimeActionResponse<CoopSharedState>;
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
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const persistedDraft = await getReviewDraft(db, message.payload.draft.id);
  const validation = validateReviewDraftPublish({
    persistedDraft,
    incomingDraft: message.payload.draft,
    targetCoopIds: message.payload.targetCoopIds,
    states: coops,
    authSession,
    activeCoopId: activeContext.activeCoopId,
    activeMemberId: activeContext.activeMemberId,
  });
  if (!validation.ok) {
    return { ok: false, error: validation.error } satisfies RuntimeActionResponse;
  }

  const targetStates = coops.filter((item) =>
    validation.targetActors.some((targetActor) => targetActor.coopId === item.profile.id),
  );

  const published = publishDraftAcrossCoops({
    states: targetStates,
    draft: validation.draft,
    targetActors: validation.targetActors,
  });
  for (const state of published.nextStates) {
    await saveState(state);
  }
  await db.reviewDrafts.delete(validation.draft.id);
  if (validation.draft.provenance.type === 'receiver') {
    await syncReceiverCaptureFromDraft(validation.draft, {
      intakeStatus: 'published',
      publishedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
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
  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(input.coop, authSession);

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

    await logPrivilegedAction({
      actionType: 'archive-upload',
      status: 'attempted',
      detail: `Attempting live archive upload for this ${input.bundle.scope}.`,
      coop: input.coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      artifactId: input.artifactIds?.[0],
      archiveScope: input.bundle.scope,
    });

    if (!authSession) {
      throw new Error('A passkey session is required before live archive upload.');
    }

    requireAnchorModeForFeature({
      capability: await getAnchorCapability(db),
      authSession,
      feature: 'live archive uploads',
    });

    const client = await createStorachaArchiveClient();
    const delegation = await requestArchiveDelegation({
      issuerUrl: configuredArchiveIssuerUrl,
      issuerToken: configuredArchiveIssuerToken,
      audienceDid: client.did(),
      coopId: input.coop.profile.id,
      scope: input.bundle.scope,
      operation: 'upload',
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
      delegationIssuerUrl: delegation.issuerUrl,
      delegationAudienceDid: upload.audienceDid,
      delegationMode: 'live',
      allowsFilecoinInfo: delegation.allowsFilecoinInfo,
      artifactIds: input.artifactIds,
      rootCid: upload.rootCid,
      shardCids: upload.shardCids,
      pieceCids: upload.pieceCids,
      gatewayUrl: upload.gatewayUrl,
    });
  } catch (error) {
    const detail = describeArchiveLiveFailure(error);
    await setRuntimeHealth({
      syncError: true,
      lastSyncError: detail,
    });
    if (configuredArchiveMode === 'live') {
      await logPrivilegedAction({
        actionType: 'archive-upload',
        status: 'failed',
        detail,
        coop: input.coop,
        memberId: member?.id,
        memberDisplayName: member?.displayName,
        authSession,
        artifactId: input.artifactIds?.[0],
        archiveScope: input.bundle.scope,
      });
    }
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
  let receipt: Awaited<ReturnType<typeof createArchiveReceiptForBundle>>;
  try {
    receipt = await createArchiveReceiptForBundle({
      coop,
      bundle,
      artifactIds: [message.payload.artifactId],
    });
  } catch (error) {
    return {
      ok: false,
      error: describeArchiveLiveFailure(error),
    } satisfies RuntimeActionResponse;
  }
  const nextState = recordArchiveReceipt(coop, receipt, [message.payload.artifactId]);
  await saveState(nextState);
  await setRuntimeHealth({
    syncError: false,
    lastSyncError: undefined,
  });
  if (configuredArchiveMode === 'live') {
    const authSession = await getAuthSession(db);
    const member = resolveReceiverPairingMember(coop, authSession);
    await logPrivilegedAction({
      actionType: 'archive-upload',
      status: 'succeeded',
      detail: 'Live archive upload completed and receipt stored.',
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      artifactId: message.payload.artifactId,
      receiptId: receipt.id,
      archiveScope: receipt.scope,
    });
  }
  await refreshBadge();
  return {
    ok: true,
    data: receipt,
  } satisfies RuntimeActionResponse;
}

async function handleSetArtifactArchiveWorthiness(
  message: Extract<RuntimeRequest, { type: 'set-artifact-archive-worthy' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  const artifact = coop.artifacts.find((item) => item.id === message.payload.artifactId);
  if (!artifact) {
    return { ok: false, error: 'Artifact not found.' } satisfies RuntimeActionResponse;
  }

  const nextArtifact = withArchiveWorthiness(artifact, message.payload.archiveWorthy, nowIso());
  const nextState = {
    ...coop,
    artifacts: coop.artifacts.map((item) => (item.id === artifact.id ? nextArtifact : item)),
  } satisfies CoopSharedState;

  await saveState(nextState);
  await refreshBadge();

  return {
    ok: true,
    data: nextArtifact,
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
  let receipt: Awaited<ReturnType<typeof createArchiveReceiptForBundle>>;
  try {
    receipt = await createArchiveReceiptForBundle({
      coop,
      bundle,
    });
  } catch (error) {
    return {
      ok: false,
      error: describeArchiveLiveFailure(error),
    } satisfies RuntimeActionResponse;
  }
  const nextState = recordArchiveReceipt(coop, receipt);
  await saveState(nextState);
  await setRuntimeHealth({
    syncError: false,
    lastSyncError: undefined,
  });
  if (configuredArchiveMode === 'live') {
    const authSession = await getAuthSession(db);
    const member = resolveReceiverPairingMember(coop, authSession);
    await logPrivilegedAction({
      actionType: 'archive-upload',
      status: 'succeeded',
      detail: 'Live snapshot archive upload completed and receipt stored.',
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: receipt.id,
      archiveScope: receipt.scope,
    });
  }
  await refreshBadge();
  return {
    ok: true,
    data: receipt,
  } satisfies RuntimeActionResponse;
}

async function handleRefreshArchiveStatus(
  message: Extract<RuntimeRequest, { type: 'refresh-archive-status' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  if (configuredArchiveMode !== 'live') {
    return {
      ok: false,
      error: 'Archive follow-up refresh is only available in live archive mode.',
    } satisfies RuntimeActionResponse;
  }

  if (!configuredArchiveIssuerUrl) {
    return {
      ok: false,
      error: 'Live archive refresh requires a configured issuer URL.',
    } satisfies RuntimeActionResponse;
  }

  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(coop, authSession);
  const candidates = coop.archiveReceipts.filter((receipt) =>
    message.payload.receiptId
      ? receipt.id === message.payload.receiptId && isArchiveReceiptRefreshable(receipt)
      : isArchiveReceiptRefreshable(receipt),
  );

  if (candidates.length === 0) {
    return {
      ok: true,
      data: {
        checked: 0,
        updated: 0,
        failed: 0,
        message: 'No live archive receipts need follow-up right now.',
      },
    } satisfies RuntimeActionResponse;
  }

  await logPrivilegedAction({
    actionType: 'archive-follow-up-refresh',
    status: 'attempted',
    detail: `Refreshing Filecoin status for ${candidates.length} archive receipt(s).`,
    coop,
    memberId: member?.id,
    memberDisplayName: member?.displayName,
    authSession,
    receiptId: message.payload.receiptId,
  });

  try {
    requireAnchorModeForFeature({
      capability: await getAnchorCapability(db),
      authSession,
      feature: 'archive follow-up jobs',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Anchor mode is required.';
    await logPrivilegedAction({
      actionType: 'archive-follow-up-refresh',
      status: 'failed',
      detail,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: message.payload.receiptId,
    });
    return {
      ok: false,
      error: detail,
    } satisfies RuntimeActionResponse;
  }

  let client: Awaited<ReturnType<typeof createStorachaArchiveClient>>;
  try {
    client = await createStorachaArchiveClient();
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'Could not start the Storacha archive client.';
    await logPrivilegedAction({
      actionType: 'archive-follow-up-refresh',
      status: 'failed',
      detail,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: message.payload.receiptId,
    });
    return {
      ok: false,
      error: detail,
    } satisfies RuntimeActionResponse;
  }
  let nextState = coop;
  let updatedCount = 0;
  let failedCount = 0;

  for (const receipt of candidates) {
    try {
      const delegation = await requestArchiveDelegation({
        issuerUrl: configuredArchiveIssuerUrl,
        issuerToken: configuredArchiveIssuerToken,
        audienceDid: client.did(),
        coopId: coop.profile.id,
        scope: receipt.scope,
        operation: 'follow-up',
        artifactIds: receipt.artifactIds,
        actorAddress: authSession?.primaryAddress,
        safeAddress: coop.profile.safeAddress,
        chainKey: coop.onchainState.chainKey,
        receiptId: receipt.id,
        rootCid: receipt.rootCid,
        pieceCids: receipt.pieceCids,
      });
      const filecoinInfo = await requestArchiveReceiptFilecoinInfo({
        receipt,
        delegation: {
          ...delegation,
          gatewayBaseUrl: delegation.gatewayBaseUrl ?? configuredArchiveGatewayUrl,
        },
        client,
      });
      const nextReceipt = applyArchiveReceiptFollowUp({
        receipt,
        filecoinInfo,
      });
      if (JSON.stringify(nextReceipt) !== JSON.stringify(receipt)) {
        updatedCount += 1;
      }
      nextState = updateArchiveReceipt(nextState, receipt.id, nextReceipt);
    } catch (error) {
      failedCount += 1;
      const nextReceipt = applyArchiveReceiptFollowUp({
        receipt,
        error: error instanceof Error ? error.message : 'Archive follow-up failed.',
      });
      nextState = updateArchiveReceipt(nextState, receipt.id, nextReceipt);
    }
  }

  await saveState(nextState);
  await setRuntimeHealth({
    syncError: failedCount > 0,
    lastSyncError: failedCount > 0 ? 'One or more archive follow-up refreshes failed.' : undefined,
  });
  await logPrivilegedAction({
    actionType: 'archive-follow-up-refresh',
    status: failedCount === candidates.length ? 'failed' : 'succeeded',
    detail:
      failedCount > 0
        ? `Archive follow-up refreshed ${candidates.length - failedCount} receipt(s); ${failedCount} failed.`
        : `Archive follow-up refreshed ${candidates.length} receipt(s).`,
    coop,
    memberId: member?.id,
    memberDisplayName: member?.displayName,
    authSession,
    receiptId: message.payload.receiptId,
  });
  await refreshBadge();

  return {
    ok: true,
    data: {
      checked: candidates.length,
      updated: updatedCount,
      failed: failedCount,
      message:
        failedCount > 0
          ? `Refreshed ${candidates.length - failedCount} receipt(s); ${failedCount} failed.`
          : `Refreshed ${updatedCount} receipt(s) with newer Filecoin status.`,
    },
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
  await ensureReceiverSyncOffscreenDocument();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await refreshBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await syncCaptureAlarm(await getLocalSetting(stateKeys.captureMode, 'manual'));
  await ensureReceiverSyncOffscreenDocument();
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
      case 'set-anchor-mode':
        sendResponse(await handleSetAnchorMode(message));
        return;
      case 'get-dashboard':
        sendResponse({
          ok: true,
          data: await getDashboard(),
        } satisfies RuntimeActionResponse<DashboardResponse>);
        return;
      case 'get-receiver-sync-config':
        await ensureReceiverSyncOffscreenDocument();
        sendResponse({
          ok: true,
          data: await getReceiverSyncConfig(),
        } satisfies RuntimeActionResponse<Awaited<ReturnType<typeof getReceiverSyncConfig>>>);
        return;
      case 'get-receiver-sync-runtime':
        sendResponse({
          ok: true,
          data: await getReceiverSyncRuntime(),
        } satisfies RuntimeActionResponse<ReceiverSyncRuntimeStatus>);
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
      case 'resolve-onchain-state':
        sendResponse(await handleResolveOnchainState(message));
        return;
      case 'create-receiver-pairing':
        sendResponse(await handleCreateReceiverPairing(message));
        return;
      case 'convert-receiver-intake':
        sendResponse(await handleConvertReceiverIntake(message));
        return;
      case 'archive-receiver-intake':
        sendResponse(await handleArchiveReceiverIntake(message));
        return;
      case 'set-receiver-intake-archive-worthy':
        sendResponse(await handleSetReceiverIntakeArchiveWorthiness(message));
        return;
      case 'create-invite':
        sendResponse(await handleCreateInvite(message));
        return;
      case 'set-active-receiver-pairing':
        sendResponse(await handleSetActiveReceiverPairing(message));
        return;
      case 'ingest-receiver-capture':
        sendResponse(await handleIngestReceiverCapture(message));
        return;
      case 'join-coop':
        sendResponse(await handleJoinCoop(message));
        return;
      case 'publish-draft':
        sendResponse(await handlePublishDraft(message));
        return;
      case 'update-review-draft':
        sendResponse(await handleUpdateReviewDraft(message));
        return;
      case 'update-meeting-settings':
        sendResponse(await handleUpdateMeetingSettings(message));
        return;
      case 'archive-artifact':
        sendResponse(await handleArchiveArtifact(message));
        return;
      case 'set-artifact-archive-worthy':
        sendResponse(await handleSetArtifactArchiveWorthiness(message));
        return;
      case 'archive-snapshot':
        sendResponse(await handleArchiveSnapshot(message));
        return;
      case 'refresh-archive-status':
        sendResponse(await handleRefreshArchiveStatus(message));
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
      case 'report-receiver-sync-runtime':
        sendResponse({
          ok: true,
          data: await reportReceiverSyncRuntime(message.payload),
        } satisfies RuntimeActionResponse<ReceiverSyncRuntimeStatus>);
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
