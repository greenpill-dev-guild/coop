import {
  type ActionBundle,
  type ActionLogEntry,
  type ActionPolicy,
  type AgentObservation,
  type AgentPlan,
  type AnchorCapability,
  type CoopSharedState,
  type DelegatedActionClass,
  type EncryptedSessionMaterial,
  type ExecutionGrant,
  type GrantLogEntry,
  type GreenGoodsAssessmentRequest,
  type GreenGoodsGardenState,
  type GreenGoodsWorkApprovalRequest,
  type InviteType,
  type PolicyActionClass,
  type PrivilegedActionLogEntry,
  type ReceiverCapture,
  type ReviewDraft,
  type SessionCapability,
  type SessionCapabilityLogEntry,
  type SessionCapableActionClass,
  type SkillRun,
  type TabCandidate,
  type UiPreferences,
  addInviteToState,
  appendPrivilegedActionLog,
  applyArchiveReceiptFollowUp,
  approveBundle,
  assertReceiverSyncEnvelope,
  authSessionToLocalIdentity,
  buildAgentObservationFingerprint,
  buildEnableSessionExecution,
  buildPimlicoRpcUrl,
  buildReceiverPairingDeepLink,
  buildRemoveSessionExecution,
  buildSmartSession,
  checkSessionCapabilityEnabled,
  completeAgentPlan,
  coopSharedStateSchema,
  createActionBundle,
  createActionLogEntry,
  createAgentObservation,
  createAnchorCapability,
  createArchiveBundle,
  createArchiveReceiptFromUpload,
  createCoop,
  createCoopDb,
  createDefaultPolicies,
  createExecutionGrant,
  createGrantLogEntry,
  createGreenGoodsAssessment,
  createGreenGoodsGarden,
  createGreenGoodsGardenPools,
  createId,
  createLocalEnhancementAdapter,
  createMockArchiveReceipt,
  createMockOnchainState,
  createPrivilegedActionLogEntry,
  createReceiverCapture,
  createReceiverDraftSeed,
  createReceiverPairingPayload,
  createReplayGuard,
  createSessionCapability,
  createSessionCapabilityLogEntry,
  createSessionSignerMaterial,
  createSessionWrappingSecret,
  createStateFromInviteBootstrap,
  createStorachaArchiveClient,
  createUnavailableOnchainState,
  decryptSessionPrivateKey,
  defaultSoundPreferences,
  deployCoopSafe,
  deriveExtensionIconState,
  describeAnchorCapabilityStatus,
  detectLocalEnhancementAvailability,
  encodeReceiverPairingPayload,
  encryptSessionPrivateKey,
  executeBundle as executeBundleAction,
  expireStaleBundles,
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
  findAgentObservationByFingerprint,
  findMatchingPolicy,
  generateInviteCode,
  getActionBundle,
  getAgentObservation,
  getAgentPlan,
  getAnchorCapability,
  getAuthSession,
  getCoopChainConfig,
  getEncryptedSessionMaterial,
  getExecutionGrant,
  getGreenGoodsDeployment,
  getReceiverCapture,
  getReviewDraft,
  getSessionCapability,
  getSkillRun,
  getSoundPreferences,
  getTrustedNodeArchiveConfig,
  getUiPreferences,
  greenGoodsAssessmentRequestSchema,
  greenGoodsWorkApprovalRequestSchema,
  hydrateCoopDoc,
  incrementGrantUsage,
  incrementSessionCapabilityUsage,
  isArchiveReceiptRefreshable,
  issueArchiveDelegation,
  joinCoop,
  listActionBundles,
  listActionBundlesByStatus,
  listActionLogEntries,
  listActionPolicies,
  listAgentObservations,
  listAgentPlans,
  listExecutionGrants,
  listGrantLogEntries,
  listLocalIdentities,
  listPrivilegedActionLog,
  listReceiverCaptures,
  listReceiverPairings,
  listRecordedReplayIds,
  listSessionCapabilities,
  listSessionCapabilityLogEntries,
  listSkillRuns,
  approveAgentPlan as markAgentPlanApproved,
  rejectAgentPlan as markAgentPlanRejected,
  nowIso,
  parseInviteCode,
  pendingBundles,
  publishDraftAcrossCoops,
  readCoopState,
  receiverSyncAssetToBlob,
  recordArchiveReceipt,
  recordReplayId,
  refreshGrantStatus,
  refreshSessionCapabilityStatus,
  rejectBundle,
  requestArchiveReceiptFilecoinInfo,
  resolveDraftTargetCoopIdsForUi,
  resolveGreenGoodsGapAdminChanges,
  resolveScopedActionPayload,
  restorePasskeyAccount,
  revokeGrant,
  revokeSessionCapability,
  rotateSessionCapability,
  runPassivePipeline,
  saveActionBundle,
  saveActionLogEntry,
  saveAgentObservation,
  saveAgentPlan,
  saveCoopState,
  saveEncryptedSessionMaterial,
  saveExecutionGrant,
  saveGrantLogEntry,
  saveReceiverCapture,
  saveReviewDraft,
  saveSessionCapability,
  saveSessionCapabilityLogEntry,
  selectActiveReceiverPairingsForSync,
  setActionPolicies,
  setActiveReceiverPairing,
  setAnchorCapability,
  setAuthSession,
  setGreenGoodsGardenDomains,
  setPrivilegedActionLog,
  setSoundPreferences,
  setTrustedNodeArchiveConfig,
  setUiPreferences,
  submitGreenGoodsWorkApproval,
  syncGreenGoodsGapAdmins,
  syncGreenGoodsGardenProfile,
  toReceiverPairingRecord,
  uiPreferencesSchema,
  updateAgentObservation,
  updateAgentPlan,
  updateArchiveReceipt,
  updateGreenGoodsState,
  updateReceiverCapture,
  updateReceiverPairing,
  uploadArchiveBundleToStoracha,
  upsertLocalIdentity,
  upsertPolicyForActionClass,
  upsertReceiverPairing,
  validateGrantForExecution,
  validateSessionCapabilityForBundle,
  verifyInviteCodeProof,
  withArchiveWorthiness,
  wrapUseSessionSignature,
} from '@coop/shared';
import {
  type Account as SessionModuleAccount,
  installModule as buildModuleInstallExecutions,
  isModuleInstalled as checkModuleInstalled,
} from '@rhinestone/module-sdk/account';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless/clients';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { http, type Address, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  AGENT_HIGH_CONFIDENCE_THRESHOLD,
  AGENT_LOOP_WAIT_TIMEOUT_MS,
  AGENT_SETTING_KEYS,
  type AgentCycleRequest,
  type AgentCycleState,
} from './runtime/agent-config';
import { filterAgentDashboardState, isTrustedNodeRole } from './runtime/agent-harness';
import { listRegisteredSkills } from './runtime/agent-registry';
import {
  isLocalEnhancementEnabled,
  parseConfiguredSignalingUrls,
  resolveConfiguredArchiveMode,
  resolveConfiguredChain,
  resolveConfiguredOnchainMode,
  resolveConfiguredSessionMode,
  resolveReceiverAppUrl,
  resolveTrustedNodeArchiveBootstrapConfig,
} from './runtime/config';
import {
  createRuntimeGrantExecutor,
  resolveDelegatedActionExecution,
} from './runtime/grant-runtime';
import type {
  AgentDashboardResponse,
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
import { sessionCapabilityChanged } from './runtime/session-capability';
import { type CaptureSnapshot, extractPageSnapshot, isSupportedUrl } from './runtime/tab-capture';

const db = createCoopDb('coop-extension');

type RuntimeHealth = {
  offline: boolean;
  missingPermission: boolean;
  syncError: boolean;
  lastCaptureError?: string;
  lastSyncError?: string;
};

type NotificationRegistry = Record<string, string>;

const stateKeys = {
  activeCoopId: 'active-coop-id',
  captureMode: 'capture-mode',
  notificationRegistry: 'notification-registry',
  receiverSyncRuntime: 'receiver-sync-runtime',
  runtimeHealth: 'runtime-health',
  sessionWrappingSecret: 'session-wrapping-secret',
};

const defaultRuntimeHealth: RuntimeHealth = {
  offline: false,
  missingPermission: false,
  syncError: false,
};

const configuredArchiveMode = resolveConfiguredArchiveMode(import.meta.env.VITE_COOP_ARCHIVE_MODE);
const configuredChain = resolveConfiguredChain(import.meta.env.VITE_COOP_CHAIN);
const configuredOnchainMode = resolveConfiguredOnchainMode(
  import.meta.env.VITE_COOP_ONCHAIN_MODE,
  import.meta.env.VITE_PIMLICO_API_KEY,
);
const configuredSessionMode = resolveConfiguredSessionMode(import.meta.env.VITE_COOP_SESSION_MODE);
const configuredSignalingUrls =
  parseConfiguredSignalingUrls(import.meta.env.VITE_COOP_SIGNALING_URLS) ?? [];
const configuredPimlicoApiKey =
  typeof import.meta.env.VITE_PIMLICO_API_KEY === 'string' &&
  import.meta.env.VITE_PIMLICO_API_KEY.length > 0
    ? import.meta.env.VITE_PIMLICO_API_KEY
    : undefined;
const configuredReceiverAppUrl = resolveReceiverAppUrl(import.meta.env.VITE_COOP_RECEIVER_APP_URL);
const prefersLocalEnhancement = isLocalEnhancementEnabled(
  import.meta.env.VITE_COOP_LOCAL_ENHANCEMENT,
);
const trustedNodeArchiveBootstrap = (() => {
  try {
    return {
      config: resolveTrustedNodeArchiveBootstrapConfig(import.meta.env),
      error: undefined,
    } as const;
  } catch (error) {
    return {
      config: null,
      error:
        error instanceof Error
          ? error.message
          : 'Trusted-node archive bootstrap config could not be parsed.',
    } as const;
  }
})();
const trustedNodeArchiveConfigMissingError =
  'Live Storacha archive mode is enabled, but this anchor node has no trusted-node archive delegation config.';
let localInferenceOptIn = false;
let uiPreferences = uiPreferencesSchema.parse({});
const uiPreferenceStorageKey = 'coop:uiPreferences';
const extensionCaptureDeviceId = 'extension-browser';
const contextMenuIds = {
  open: 'coop-open',
  roundUp: 'coop-round-up-tab',
  screenshot: 'coop-capture-screenshot',
} as const;

async function readSyncedUiPreferences(): Promise<UiPreferences | null> {
  try {
    const record = await chrome.storage.sync.get(uiPreferenceStorageKey);
    const raw = record[uiPreferenceStorageKey];
    return raw ? uiPreferencesSchema.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeSyncedUiPreferences(value: UiPreferences) {
  try {
    await chrome.storage.sync.set({
      [uiPreferenceStorageKey]: value,
    });
  } catch {
    // Ignore sync storage failures and fall back to local settings.
  }
}

async function hydrateUiPreferences() {
  const [localValue, syncedValue] = await Promise.all([
    getUiPreferences(db),
    readSyncedUiPreferences(),
  ]);
  const next = uiPreferencesSchema.parse(syncedValue ?? localValue ?? {});
  uiPreferences = next;
  localInferenceOptIn = next.localInferenceOptIn;
  await Promise.all([setUiPreferences(db, next), writeSyncedUiPreferences(next)]);
  return next;
}

async function saveResolvedUiPreferences(value: UiPreferences) {
  const next = uiPreferencesSchema.parse(value);
  uiPreferences = next;
  localInferenceOptIn = next.localInferenceOptIn;
  await Promise.all([setUiPreferences(db, next), writeSyncedUiPreferences(next)]);
  return next;
}

async function getNotificationRegistry() {
  return getLocalSetting<NotificationRegistry>(stateKeys.notificationRegistry, {});
}

async function notifyExtensionEvent(input: {
  eventKind: string;
  entityId: string;
  state: string;
  title: string;
  message: string;
}) {
  if (!uiPreferences.notificationsEnabled) {
    return;
  }

  const key = `${input.eventKind}:${input.entityId}`;
  const token = `${input.state}`;
  const registry = await getNotificationRegistry();
  if (registry[key] === token) {
    return;
  }

  registry[key] = token;
  await setLocalSetting(stateKeys.notificationRegistry, registry);

  try {
    await chrome.notifications.create(`coop-${createId('notification')}`, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: input.title,
      message: input.message,
    });
  } catch {
    // Notifications are optional UX only.
  }
}

// Restore persisted local inference preference
chrome.storage.local.get('coop:localInferenceOptIn', (result) => {
  if (typeof result['coop:localInferenceOptIn'] === 'boolean') {
    localInferenceOptIn = result['coop:localInferenceOptIn'];
    uiPreferences = uiPreferencesSchema.parse({
      ...uiPreferences,
      localInferenceOptIn,
    });
  }
});

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
        receiverSyncDocumentPromise = null;
        if (await hasReceiverSyncOffscreenDocument(offscreenApi)) {
          return;
        }
        throw error;
      });
  }

  await receiverSyncDocumentPromise;
}

async function getCoops() {
  const docs = await db.coopDocs.toArray();
  return docs.map((record) => readCoopState(hydrateCoopDoc(record.encodedState)));
}

async function updateCoopGreenGoodsState(input: {
  coopId: string;
  apply(current: GreenGoodsGardenState | undefined, coop: CoopSharedState): GreenGoodsGardenState;
}) {
  const coops = await getCoops();
  const coop = coops.find((candidate) => candidate.profile.id === input.coopId);
  if (!coop) {
    throw new Error('Coop not found.');
  }

  const nextState = {
    ...coop,
    greenGoods: input.apply(coop.greenGoods, coop),
  } satisfies CoopSharedState;
  await saveState(nextState);
  return nextState;
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

function buildSessionModuleAccount(state: CoopSharedState['onchainState']): SessionModuleAccount {
  return {
    address: state.safeAddress as Address,
    type: 'safe',
    deployedOnChains: [state.chainId],
  };
}

function resolveGreenGoodsSessionTargets(
  coop: CoopSharedState,
  actionClass: SessionCapableActionClass,
): string[] {
  const deployment = getGreenGoodsDeployment(coop.onchainState.chainKey);
  switch (actionClass) {
    case 'green-goods-create-garden':
      return [deployment.gardenToken];
    case 'green-goods-sync-garden-profile':
      return coop.greenGoods?.gardenAddress ? [coop.greenGoods.gardenAddress] : [];
    case 'green-goods-set-garden-domains':
      return [deployment.actionRegistry];
    case 'green-goods-create-garden-pools':
      return [deployment.gardensModule];
  }
}

function resolveSessionTargetAllowlist(input: {
  coop: CoopSharedState;
  allowedActions: SessionCapableActionClass[];
  overrides?: Record<string, string[]>;
}) {
  return input.allowedActions.reduce<Record<string, string[]>>((allowlist, actionClass) => {
    const configuredTargets =
      input.overrides?.[actionClass] ?? resolveGreenGoodsSessionTargets(input.coop, actionClass);
    const normalizedTargets = Array.from(
      new Set(
        configuredTargets.filter(
          (value): value is string =>
            typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value),
        ),
      ),
    );
    if (normalizedTargets.length === 0) {
      throw new Error(
        actionClass === 'green-goods-sync-garden-profile'
          ? 'Garden-linked session actions require a linked Green Goods garden address first.'
          : `Session action "${actionClass}" is missing an explicit target allowlist.`,
      );
    }
    allowlist[actionClass] = normalizedTargets;
    return allowlist;
  }, {});
}

function resolveDefaultSessionActionsForCoop(coop: CoopSharedState): SessionCapableActionClass[] {
  return coop.greenGoods?.gardenAddress
    ? [
        'green-goods-sync-garden-profile',
        'green-goods-set-garden-domains',
        'green-goods-create-garden-pools',
      ]
    : ['green-goods-create-garden'];
}

async function requireSessionWrappingSecret() {
  const record = await db.settings.get(stateKeys.sessionWrappingSecret);
  if (typeof record?.value === 'string' && record.value.length > 0) {
    return record.value;
  }
  const created = await createSessionWrappingSecret();
  await setLocalSetting(stateKeys.sessionWrappingSecret, created);
  return created;
}

async function createOwnerSafeExecutionContext(input: {
  authSession: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
  onchainState: CoopSharedState['onchainState'];
}) {
  if (!configuredPimlicoApiKey) {
    throw new Error('Pimlico API key is required for live session-key setup.');
  }

  const owner = restorePasskeyAccount(input.authSession);
  const chainConfig = getCoopChainConfig(input.onchainState.chainKey);
  const bundlerUrl = buildPimlicoRpcUrl(input.onchainState.chainKey, configuredPimlicoApiKey);
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.chain.rpcUrls.default.http[0]),
  });
  const account = await toSafeSmartAccount({
    client: publicClient,
    owners: [owner],
    address: input.onchainState.safeAddress as Address,
    version: '1.4.1',
  });
  const pimlicoClient = createPimlicoClient({
    chain: chainConfig.chain,
    transport: http(bundlerUrl),
  });
  const smartClient = createSmartAccountClient({
    account,
    chain: chainConfig.chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  return {
    publicClient,
    smartClient,
    moduleAccount: buildSessionModuleAccount(input.onchainState),
  };
}

async function ensureSessionCapabilityReadyLive(input: {
  capability: SessionCapability;
  authSession: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
  onchainState: CoopSharedState['onchainState'];
}) {
  const context = await createOwnerSafeExecutionContext({
    authSession: input.authSession,
    onchainState: input.onchainState,
  });
  const { modules } = buildSmartSession({ capability: input.capability });

  for (const module of [modules.validator, modules.fallback]) {
    const installed = await checkModuleInstalled({
      client: context.publicClient,
      account: context.moduleAccount,
      module,
    });
    if (installed) {
      continue;
    }

    const executions = await buildModuleInstallExecutions({
      client: context.publicClient,
      account: context.moduleAccount,
      module,
    });
    for (const execution of executions) {
      await context.smartClient.sendTransaction({
        to: execution.to,
        data: execution.data,
        value: execution.value,
      });
    }
  }

  const enabled = await checkSessionCapabilityEnabled({
    client: context.publicClient,
    capability: input.capability,
  });
  if (!enabled) {
    const { execution } = buildEnableSessionExecution(input.capability);
    await context.smartClient.sendTransaction({
      to: execution.to,
      data: execution.data,
      value: execution.value,
    });
  }

  const timestamp = nowIso();
  return {
    capability: {
      ...input.capability,
      moduleInstalledAt: input.capability.moduleInstalledAt ?? timestamp,
      updatedAt: timestamp,
      status: 'active',
      lastValidationFailure: undefined,
      statusDetail: 'Session key is enabled on the coop Safe and ready for bounded execution.',
    } satisfies SessionCapability,
    context,
  };
}

async function revokeSessionCapabilityLive(input: {
  capability: SessionCapability;
  authSession: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
  onchainState: CoopSharedState['onchainState'];
}) {
  const context = await createOwnerSafeExecutionContext({
    authSession: input.authSession,
    onchainState: input.onchainState,
  });
  const enabled = await checkSessionCapabilityEnabled({
    client: context.publicClient,
    capability: input.capability,
  });
  if (!enabled) {
    return;
  }

  const { execution } = buildRemoveSessionExecution(input.capability);
  await context.smartClient.sendTransaction({
    to: execution.to,
    data: execution.data,
    value: execution.value,
  });
}

async function createSessionExecutionContext(input: {
  capability: SessionCapability;
  onchainState: CoopSharedState['onchainState'];
}) {
  if (!configuredPimlicoApiKey) {
    throw new Error('Pimlico API key is required for live session-key execution.');
  }

  const material = await getEncryptedSessionMaterial(db, input.capability.id);
  if (!material) {
    throw new Error('Encrypted session signer material is unavailable on this browser profile.');
  }

  const wrappingSecret = await requireSessionWrappingSecret();
  const privateKey = await decryptSessionPrivateKey({
    material,
    wrappingSecret,
  });
  const owner = privateKeyToAccount(privateKey);
  const chainConfig = getCoopChainConfig(input.onchainState.chainKey);
  const bundlerUrl = buildPimlicoRpcUrl(input.onchainState.chainKey, configuredPimlicoApiKey);
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.chain.rpcUrls.default.http[0]),
  });
  const baseAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [owner],
    address: input.onchainState.safeAddress as Address,
    version: '1.4.1',
  });
  const account = {
    ...baseAccount,
    async getStubSignature() {
      const validatorSignature = await baseAccount.getStubSignature();
      return wrapUseSessionSignature({
        capability: input.capability,
        validatorSignature,
      });
    },
    async signUserOperation(parameters: Parameters<typeof baseAccount.signUserOperation>[0]) {
      const validatorSignature = await baseAccount.signUserOperation(parameters);
      return wrapUseSessionSignature({
        capability: input.capability,
        validatorSignature,
      });
    },
  };
  const pimlicoClient = createPimlicoClient({
    chain: chainConfig.chain,
    transport: http(bundlerUrl),
  });
  const smartClient = createSmartAccountClient({
    account,
    chain: chainConfig.chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  return {
    publicClient,
    smartClient,
    material,
  };
}

async function refreshStoredSessionCapabilityStatuses() {
  const capabilities = await listSessionCapabilities(db);
  const refreshed = capabilities.map((capability) => refreshSessionCapabilityStatus(capability));
  await Promise.all(
    refreshed
      .filter((capability, index) => sessionCapabilityChanged(capability, capabilities[index]))
      .map((capability) => saveSessionCapability(db, capability)),
  );
  return refreshed;
}

async function selectSessionCapabilityForBundle(input: {
  coop: CoopSharedState;
  bundle: ActionBundle;
}) {
  const capabilities = (await refreshStoredSessionCapabilityStatuses()).filter(
    (capability) => capability.coopId === input.coop.profile.id,
  );

  let lastFailure: { reason: string; capability: SessionCapability; rejectType: string } | null =
    null;
  for (const capability of capabilities) {
    const validation = validateSessionCapabilityForBundle({
      capability,
      bundle: input.bundle,
      chainKey: input.coop.onchainState.chainKey,
      safeAddress: input.coop.onchainState.safeAddress,
      pimlicoApiKey: configuredPimlicoApiKey,
      hasEncryptedMaterial: (await getEncryptedSessionMaterial(db, capability.id)) !== undefined,
    });
    if (validation.ok) {
      if (sessionCapabilityChanged(validation.capability, capability)) {
        await saveSessionCapability(db, validation.capability);
      }
      return validation.capability;
    }

    await saveSessionCapability(db, validation.capability);
    await saveSessionCapabilityLogEntry(
      db,
      createSessionCapabilityLogEntry({
        capabilityId: validation.capability.id,
        coopId: validation.capability.coopId,
        eventType: 'session-validation-rejected',
        detail: validation.reason,
        actionClass: input.bundle.actionClass,
        bundleId: input.bundle.id,
        replayId: input.bundle.replayId,
        reason: validation.rejectType,
      }),
    );
    lastFailure = validation;
  }

  if (lastFailure) {
    throw new Error(lastFailure.reason);
  }

  throw new Error('No usable session key is available for this coop.');
}

async function buildGreenGoodsSessionExecutor(input: {
  coop: CoopSharedState;
  bundle: ActionBundle;
}) {
  if (configuredSessionMode !== 'live' || configuredOnchainMode !== 'live') {
    return undefined;
  }

  const capability = await selectSessionCapabilityForBundle(input);
  const context = await createSessionExecutionContext({
    capability,
    onchainState: input.coop.onchainState,
  });

  return async ({ to, data, value }: { to: Address; data: `0x${string}`; value?: bigint }) => {
    await saveSessionCapabilityLogEntry(
      db,
      createSessionCapabilityLogEntry({
        capabilityId: capability.id,
        coopId: capability.coopId,
        eventType: 'session-execution-attempted',
        detail: `Attempting ${input.bundle.actionClass} through session key ${capability.sessionAddress}.`,
        actionClass: input.bundle.actionClass,
        bundleId: input.bundle.id,
        replayId: input.bundle.replayId,
      }),
    );

    try {
      const txHash = await context.smartClient.sendTransaction({
        to,
        data,
        value: value ?? 0n,
      });
      const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
      const updatedCapability = incrementSessionCapabilityUsage(capability);
      await saveSessionCapability(db, updatedCapability);
      await saveSessionCapabilityLogEntry(
        db,
        createSessionCapabilityLogEntry({
          capabilityId: capability.id,
          coopId: capability.coopId,
          eventType: 'session-execution-succeeded',
          detail: `Session key executed ${input.bundle.actionClass} successfully.`,
          actionClass: input.bundle.actionClass,
          bundleId: input.bundle.id,
          replayId: input.bundle.replayId,
        }),
      );
      return {
        txHash,
        receipt,
        safeAddress: input.coop.onchainState.safeAddress as Address,
      };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Session-key execution failed unexpectedly.';
      await saveSessionCapabilityLogEntry(
        db,
        createSessionCapabilityLogEntry({
          capabilityId: capability.id,
          coopId: capability.coopId,
          eventType: 'session-execution-failed',
          detail,
          actionClass: input.bundle.actionClass,
          bundleId: input.bundle.id,
          replayId: input.bundle.replayId,
        }),
      );
      throw error;
    }
  };
}

async function getRuntimeHealth() {
  const missingPermission = !(await chrome.permissions.contains({
    permissions: [
      'storage',
      'alarms',
      'tabs',
      'scripting',
      'sidePanel',
      'activeTab',
      'contextMenus',
      'notifications',
    ],
    origins: ['http://127.0.0.1/*', 'http://localhost/*'],
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

async function ensureTrustedNodeArchiveBootstrap() {
  const existing = await getTrustedNodeArchiveConfig(db);
  if (existing) {
    return existing;
  }

  if (!trustedNodeArchiveBootstrap.config) {
    return null;
  }

  await setTrustedNodeArchiveConfig(db, trustedNodeArchiveBootstrap.config);
  return trustedNodeArchiveBootstrap.config;
}

async function getResolvedTrustedNodeArchiveConfig() {
  const existing = await getTrustedNodeArchiveConfig(db);
  if (existing) {
    return existing;
  }

  return ensureTrustedNodeArchiveBootstrap();
}

async function requireTrustedNodeArchiveConfig() {
  const config = await getResolvedTrustedNodeArchiveConfig();
  if (config) {
    return config;
  }

  if (trustedNodeArchiveBootstrap.error) {
    throw new Error(
      `Trusted-node archive bootstrap config is invalid: ${trustedNodeArchiveBootstrap.error}`,
    );
  }

  throw new Error(trustedNodeArchiveConfigMissingError);
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
  await ensureTrustedNodeArchiveBootstrap();
  await hydrateUiPreferences();
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

function extensionIconPaths(state: RuntimeSummary['iconState']) {
  switch (state) {
    case 'idle':
      return {
        16: 'icons/icon-idle-16.png',
        32: 'icons/icon-idle-32.png',
        48: 'icons/icon-idle-48.png',
        128: 'icons/icon-idle-128.png',
      };
    case 'watching':
      return {
        16: 'icons/icon-watching-16.png',
        32: 'icons/icon-watching-32.png',
        48: 'icons/icon-watching-48.png',
        128: 'icons/icon-watching-128.png',
      };
    case 'review-needed':
      return {
        16: 'icons/icon-review-needed-16.png',
        32: 'icons/icon-review-needed-32.png',
        48: 'icons/icon-review-needed-48.png',
        128: 'icons/icon-review-needed-128.png',
      };
    case 'error-offline':
      return {
        16: 'icons/icon-error-offline-16.png',
        32: 'icons/icon-error-offline-32.png',
        48: 'icons/icon-error-offline-48.png',
        128: 'icons/icon-error-offline-128.png',
      };
  }
}

async function refreshBadge() {
  const summary = await buildSummary();
  const badge = extensionIconBadge(summary.iconState);
  await chrome.action.setIcon({ path: extensionIconPaths(summary.iconState) });
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  await chrome.action.setTitle({ title: `Coop: ${summary.iconLabel}` });
}

async function buildSummary(): Promise<RuntimeSummary> {
  const [drafts, coops, captureMode, runtimeHealth, authSession, lastCapture, prefs] =
    await Promise.all([
      db.reviewDrafts.toArray(),
      getCoops(),
      getLocalSetting(stateKeys.captureMode, 'manual'),
      getRuntimeHealth(),
      getAuthSession(db),
      db.captureRuns.orderBy('capturedAt').last(),
      hydrateUiPreferences(),
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
    localInferenceOptIn: prefs.localInferenceOptIn,
    activeCoopId: activeContext.activeCoopId,
  };
}

async function getOperatorState(input?: {
  coops?: CoopSharedState[];
  authSession?: Awaited<ReturnType<typeof getAuthSession>>;
}) {
  const coops = input?.coops ?? (await getCoops());
  const authSession = input?.authSession ?? (await getAuthSession(db));
  const [anchorCapability, actionLog, trustedNodeArchiveConfig] = await Promise.all([
    getAnchorCapability(db),
    listPrivilegedActionLog(db),
    getResolvedTrustedNodeArchiveConfig(),
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
  const liveArchiveWithConfig =
    configuredArchiveMode === 'live' && liveArchive.available && !trustedNodeArchiveConfig
      ? {
          available: false,
          detail: trustedNodeArchiveBootstrap.error
            ? `Live archive uploads are blocked by invalid trusted-node archive bootstrap config: ${trustedNodeArchiveBootstrap.error}`
            : 'Live archive uploads are unavailable until this anchor node is provisioned with trusted-node archive delegation config.',
        }
      : liveArchive;
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
    liveArchive: liveArchiveWithConfig,
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
        input.actionType === 'safe-deployment' || input.actionType === 'green-goods-transaction'
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

function findAuthenticatedCoopMember(
  coop: CoopSharedState,
  authSession: Awaited<ReturnType<typeof getAuthSession>>,
) {
  const authAddress = authSession?.primaryAddress?.toLowerCase();
  if (!authAddress) {
    return undefined;
  }

  return coop.members.find((member) => member.address.toLowerCase() === authAddress);
}

async function requireCreatorGrantManager(
  coopId: string,
  authSession: Awaited<ReturnType<typeof getAuthSession>>,
  errorMessage: string,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === coopId);
  if (!coop) {
    return { ok: false as const, error: 'Coop not found.' };
  }

  const member = findAuthenticatedCoopMember(coop, authSession);
  if (!member || member.role !== 'creator') {
    return { ok: false as const, error: errorMessage };
  }

  return {
    ok: true as const,
    coop,
    member,
  };
}

async function getTrustedNodeContext(input?: {
  coopId?: string;
  requestedMemberId?: string;
}) {
  const authSession = await getAuthSession(db);
  if (!authSession) {
    return {
      ok: false as const,
      error: 'A passkey session is required for trusted-node controls.',
    };
  }

  const coops = await getCoops();
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const coop =
    (input?.coopId
      ? coops.find((candidate) => candidate.profile.id === input.coopId)
      : activeContext.activeCoop) ?? null;
  if (!coop) {
    return {
      ok: false as const,
      error: 'Select a coop before using trusted-node controls.',
    };
  }

  const member = resolveReceiverPairingMember(coop, authSession, input?.requestedMemberId);
  if (!member || !isTrustedNodeRole(member.role)) {
    return {
      ok: false as const,
      error: 'Trusted-node controls are limited to creator or trusted members.',
    };
  }

  return {
    ok: true as const,
    authSession,
    coops,
    coop,
    member,
    activeContext,
  };
}

function getLatestReviewDigestDraft(input: { coop: CoopSharedState; drafts: ReviewDraft[] }) {
  return input.drafts
    .filter(
      (draft) =>
        draft.provenance.type === 'agent' &&
        draft.provenance.skillId === 'review-digest' &&
        draft.suggestedTargetCoopIds.includes(input.coop.profile.id),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function resolveObservationInactiveReason(input: {
  observation: AgentObservation;
  coopsById: Map<string, CoopSharedState>;
  draftsById: Map<string, ReviewDraft>;
  capturesById: Map<string, ReceiverCapture>;
  drafts: ReviewDraft[];
}) {
  const { observation } = input;

  switch (observation.trigger) {
    case 'high-confidence-draft': {
      const draft = observation.draftId ? input.draftsById.get(observation.draftId) : undefined;
      if (!draft) {
        return 'Source draft no longer exists.';
      }
      if (draft.confidence < AGENT_HIGH_CONFIDENCE_THRESHOLD) {
        return 'Source draft no longer meets the high-confidence threshold.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: draft.suggestedTargetCoopIds[0],
        draftId: draft.id,
        extractId: draft.extractId,
        payload: {
          confidence: draft.confidence,
          category: draft.category,
          workflowStage: draft.workflowStage,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest draft state.';
      }
      return null;
    }
    case 'receiver-backlog': {
      const capture = observation.captureId
        ? input.capturesById.get(observation.captureId)
        : undefined;
      if (!capture) {
        return 'Receiver capture no longer exists.';
      }
      if (capture.intakeStatus === 'archived' || capture.intakeStatus === 'published') {
        return 'Receiver capture no longer needs backlog handling.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: capture.coopId,
        captureId: capture.id,
        payload: {
          intakeStatus: capture.intakeStatus,
          receiverKind: capture.kind,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest receiver intake state.';
      }
      return null;
    }
    case 'stale-archive-receipt': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      const receipt = observation.receiptId
        ? coop?.archiveReceipts.find((candidate) => candidate.id === observation.receiptId)
        : undefined;
      if (!receipt || !isArchiveReceiptRefreshable(receipt)) {
        return 'Archive receipt no longer needs follow-up.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        receiptId: receipt.id,
        payload: {
          rootCid: receipt.rootCid,
          archiveScope: receipt.scope,
          filecoinStatus: receipt.filecoinStatus,
          lastFollowUpAt:
            receipt.followUp?.lastRefreshRequestedAt ??
            receipt.followUp?.lastRefreshedAt ??
            receipt.followUp?.lastStatusChangeAt,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest archive follow-up state.';
      }
      return null;
    }
    case 'ritual-review-due': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop || !isRitualReviewDue({ coop, drafts: input.drafts })) {
        return 'Review digest is no longer due for this coop.';
      }
      const latestDigest = getLatestReviewDigestDraft({
        coop,
        drafts: input.drafts,
      });
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          weeklyReviewCadence: coop.rituals[0]?.weeklyReviewCadence,
          latestDigestCreatedAt: latestDigest?.createdAt,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest review cadence state.';
      }
      return null;
    }
    case 'green-goods-garden-requested': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.greenGoods?.enabled || coop.greenGoods.gardenAddress) {
        return 'Green Goods garden request no longer needs action.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          status: coop.greenGoods.status,
          requestedAt: coop.greenGoods.requestedAt,
          weightScheme: coop.greenGoods.weightScheme,
          domainMask: coop.greenGoods.domainMask,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest Green Goods request state.';
      }
      return null;
    }
    case 'green-goods-sync-needed': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!isGreenGoodsSyncNeeded(coop?.greenGoods)) {
        return 'Green Goods garden sync is no longer needed.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          status: coop.greenGoods?.status,
          lastProfileSyncAt: coop.greenGoods?.lastProfileSyncAt,
          lastDomainSyncAt: coop.greenGoods?.lastDomainSyncAt,
          lastPoolSyncAt: coop.greenGoods?.lastPoolSyncAt,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest Green Goods sync state.';
      }
      return null;
    }
    case 'green-goods-work-approval-requested': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.greenGoods?.enabled || !coop.greenGoods.gardenAddress) {
        return 'Green Goods work approval no longer has a linked garden target.';
      }
      return null;
    }
    case 'green-goods-assessment-requested': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.greenGoods?.enabled || !coop.greenGoods.gardenAddress) {
        return 'Green Goods assessment no longer has a linked garden target.';
      }
      return null;
    }
    case 'green-goods-gap-admin-sync-needed': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop || !isGreenGoodsGapAdminSyncNeeded(coop)) {
        return 'Green Goods GAP admin sync is no longer needed.';
      }
      const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(coop);
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          desiredAdmins,
          currentAdmins: coop.greenGoods?.gapAdminAddresses ?? [],
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest Green Goods GAP admin state.';
      }
      return null;
    }
  }
}

async function reconcileAgentObservations(input: {
  drafts: ReviewDraft[];
  receiverCaptures: ReceiverCapture[];
  coops: CoopSharedState[];
}) {
  const observations = await listAgentObservations(db, 300);
  const draftsById = new Map(input.drafts.map((draft) => [draft.id, draft] as const));
  const capturesById = new Map(
    input.receiverCaptures.map((capture) => [capture.id, capture] as const),
  );
  const coopsById = new Map(input.coops.map((coop) => [coop.profile.id, coop] as const));

  for (const observation of observations) {
    if (observation.status === 'dismissed' || observation.status === 'completed') {
      continue;
    }

    const inactiveReason = resolveObservationInactiveReason({
      observation,
      draftsById,
      capturesById,
      coopsById,
      drafts: input.drafts,
    });
    if (!inactiveReason) {
      continue;
    }

    await saveAgentObservation(
      db,
      updateAgentObservation(observation, {
        status: 'dismissed',
        blockedReason: inactiveReason,
      }),
    );
  }
}

async function refreshStoredGrantStatuses() {
  const grants = await listExecutionGrants(db);
  const refreshed = grants.map((grant) => refreshGrantStatus(grant));

  for (const grant of refreshed) {
    const original = grants.find((candidate) => candidate.id === grant.id);
    if (!original || original.status === grant.status) {
      continue;
    }

    await saveExecutionGrant(db, grant);

    if (grant.status === 'expired') {
      await saveGrantLogEntry(
        db,
        createGrantLogEntry({
          grantId: grant.id,
          eventType: 'grant-expired',
          detail: `Grant ${grant.id} expired at ${grant.expiresAt}.`,
          coopId: grant.coopId,
        }),
      );
    }
  }

  return refreshed;
}

async function getAgentCycleState() {
  return getLocalSetting<AgentCycleState>(AGENT_SETTING_KEYS.cycleState, {
    running: false,
  });
}

async function getAgentAutoRunSkillIds() {
  return getLocalSetting<string[]>(AGENT_SETTING_KEYS.autoRunSkillIds, []);
}

async function requestAgentCycle(reason: string, force = false) {
  const request: AgentCycleRequest = {
    id: createId('agent-cycle'),
    requestedAt: nowIso(),
    reason,
    force,
  };
  await setLocalSetting(AGENT_SETTING_KEYS.cycleRequest, request);
  return request;
}

async function waitForAgentCycle(
  request: AgentCycleRequest,
  timeoutMs = AGENT_LOOP_WAIT_TIMEOUT_MS,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const state = await getAgentCycleState();
    if (
      state.lastRequestId === request.id &&
      state.lastCompletedAt &&
      state.lastCompletedAt >= request.requestedAt &&
      state.running === false
    ) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return getAgentCycleState();
}

async function emitAgentObservationIfMissing(
  input: Parameters<typeof createAgentObservation>[0],
): Promise<AgentObservation> {
  const observation = createAgentObservation(input);
  const existing = await findAgentObservationByFingerprint(db, observation.fingerprint);
  if (existing) {
    return existing;
  }
  await saveAgentObservation(db, observation);
  return observation;
}

async function syncHighConfidenceDraftObservations(drafts: ReviewDraft[]) {
  const candidates = drafts.filter((draft) => draft.confidence >= AGENT_HIGH_CONFIDENCE_THRESHOLD);
  for (const draft of candidates) {
    await emitAgentObservationIfMissing({
      trigger: 'high-confidence-draft',
      title: `High-confidence draft: ${draft.title}`,
      summary: draft.summary,
      coopId: draft.suggestedTargetCoopIds[0],
      draftId: draft.id,
      extractId: draft.extractId,
      payload: {
        confidence: draft.confidence,
        category: draft.category,
        workflowStage: draft.workflowStage,
      },
    });
  }
}

function isRitualReviewDue(input: { coop: CoopSharedState; drafts: ReviewDraft[] }) {
  const cadence = input.coop.rituals[0]?.weeklyReviewCadence ?? '';
  if (!cadence.trim()) {
    return false;
  }

  const latest = getLatestReviewDigestDraft(input);
  if (!latest) {
    return true;
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return new Date(latest.createdAt).getTime() < sevenDaysAgo;
}

function isGreenGoodsSyncNeeded(greenGoods?: GreenGoodsGardenState) {
  if (!greenGoods?.enabled || !greenGoods.gardenAddress || greenGoods.status !== 'linked') {
    return false;
  }
  return (
    !greenGoods.lastProfileSyncAt || !greenGoods.lastDomainSyncAt || !greenGoods.lastPoolSyncAt
  );
}

function resolveDesiredGreenGoodsGapAdmins(coop: CoopSharedState) {
  return coop.members
    .filter((member) => member.role === 'creator' || member.role === 'trusted')
    .map((member) => member.address);
}

function isGreenGoodsGapAdminSyncNeeded(coop: CoopSharedState) {
  if (
    !coop.greenGoods?.enabled ||
    !coop.greenGoods.gardenAddress ||
    coop.greenGoods.status !== 'linked'
  ) {
    return false;
  }
  const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(coop) as `0x${string}`[];
  const currentAdmins = (coop.greenGoods.gapAdminAddresses ?? []) as `0x${string}`[];
  const changes = resolveGreenGoodsGapAdminChanges({
    desiredAdmins,
    currentAdmins,
  });
  return changes.addAdmins.length > 0 || changes.removeAdmins.length > 0;
}

async function syncAgentObservations() {
  const [coops, drafts, receiverCaptures] = await Promise.all([
    getCoops(),
    db.reviewDrafts.toArray(),
    listReceiverCaptures(db),
  ]);

  await reconcileAgentObservations({
    coops,
    drafts,
    receiverCaptures,
  });

  await syncHighConfidenceDraftObservations(drafts);

  for (const capture of receiverCaptures) {
    if (capture.intakeStatus === 'archived' || capture.intakeStatus === 'published') {
      continue;
    }
    await emitAgentObservationIfMissing({
      trigger: 'receiver-backlog',
      title: `Receiver backlog: ${capture.title}`,
      summary: capture.note || capture.title,
      coopId: capture.coopId,
      captureId: capture.id,
      payload: {
        intakeStatus: capture.intakeStatus,
        receiverKind: capture.kind,
      },
    });
  }

  for (const coop of coops) {
    if (coop.greenGoods?.enabled && !coop.greenGoods.gardenAddress) {
      await emitAgentObservationIfMissing({
        trigger: 'green-goods-garden-requested',
        title: `Green Goods garden requested for ${coop.profile.name}`,
        summary: `Create a Green Goods garden owned by ${coop.profile.name}'s coop Safe.`,
        coopId: coop.profile.id,
        payload: {
          status: coop.greenGoods.status,
          requestedAt: coop.greenGoods.requestedAt,
          weightScheme: coop.greenGoods.weightScheme,
          domainMask: coop.greenGoods.domainMask,
        },
      });
    }

    if (isGreenGoodsSyncNeeded(coop.greenGoods)) {
      await emitAgentObservationIfMissing({
        trigger: 'green-goods-sync-needed',
        title: `Green Goods sync needed for ${coop.profile.name}`,
        summary: `Garden ${coop.greenGoods?.gardenAddress} should be synced to the latest coop state.`,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          status: coop.greenGoods?.status,
          lastProfileSyncAt: coop.greenGoods?.lastProfileSyncAt,
          lastDomainSyncAt: coop.greenGoods?.lastDomainSyncAt,
          lastPoolSyncAt: coop.greenGoods?.lastPoolSyncAt,
        },
      });
    }

    if (isGreenGoodsGapAdminSyncNeeded(coop)) {
      const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(coop);
      await emitAgentObservationIfMissing({
        trigger: 'green-goods-gap-admin-sync-needed',
        title: `Green Goods GAP admin sync needed for ${coop.profile.name}`,
        summary: `Karma GAP project admins should match the trusted operators for ${coop.profile.name}.`,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          desiredAdmins,
          currentAdmins: coop.greenGoods?.gapAdminAddresses ?? [],
        },
      });
    }

    for (const receipt of coop.archiveReceipts) {
      if (!isArchiveReceiptRefreshable(receipt)) {
        continue;
      }
      await emitAgentObservationIfMissing({
        trigger: 'stale-archive-receipt',
        title: `Archive follow-up due: ${receipt.rootCid}`,
        summary: `Archive receipt ${receipt.id} is refreshable and can be checked for newer Filecoin status.`,
        coopId: coop.profile.id,
        receiptId: receipt.id,
        payload: {
          rootCid: receipt.rootCid,
          archiveScope: receipt.scope,
          filecoinStatus: receipt.filecoinStatus,
          lastFollowUpAt:
            receipt.followUp?.lastRefreshRequestedAt ??
            receipt.followUp?.lastRefreshedAt ??
            receipt.followUp?.lastStatusChangeAt,
        },
      });
    }

    if (isRitualReviewDue({ coop, drafts })) {
      const latestDigest = getLatestReviewDigestDraft({ coop, drafts });
      await emitAgentObservationIfMissing({
        trigger: 'ritual-review-due',
        title: `Review digest due for ${coop.profile.name}`,
        summary: `${coop.profile.name} is due for a shared review digest.`,
        coopId: coop.profile.id,
        payload: {
          weeklyReviewCadence: coop.rituals[0]?.weeklyReviewCadence,
          latestDigestCreatedAt: latestDigest?.createdAt,
        },
      });
    }
  }
}

async function getAgentDashboard(): Promise<AgentDashboardResponse> {
  const [observations, plans, skillRuns, autoRunSkillIds, drafts, captures, trustedNodeContext] =
    await Promise.all([
      listAgentObservations(db, 80),
      listAgentPlans(db, 80),
      listSkillRuns(db, 120),
      getAgentAutoRunSkillIds(),
      db.reviewDrafts.toArray(),
      listReceiverCaptures(db),
      getTrustedNodeContext(),
    ]);
  const filtered = filterAgentDashboardState({
    observations,
    plans,
    skillRuns,
    drafts,
    captures,
    activeCoopId: trustedNodeContext.ok ? trustedNodeContext.coop.profile.id : undefined,
    activeMemberId: trustedNodeContext.ok ? trustedNodeContext.member.id : undefined,
    operatorAccess: trustedNodeContext.ok,
  });
  return {
    observations: filtered.observations,
    plans: filtered.plans,
    skillRuns: filtered.skillRuns,
    manifests: listRegisteredSkills().map((entry) => entry.manifest),
    autoRunSkillIds,
  };
}

async function getDashboard(): Promise<DashboardResponse> {
  const [
    coops,
    drafts,
    candidates,
    summary,
    soundPreferences,
    resolvedUiPreferences,
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
    hydrateUiPreferences(),
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
  const [
    operator,
    actionBundles,
    actionLogEntries,
    executionGrants,
    grantLogEntries,
    sessionCapabilities,
    sessionCapabilityLogEntries,
  ] = await Promise.all([
    getOperatorState({
      coops,
      authSession,
    }),
    listActionBundles(db),
    listActionLogEntries(db, 50),
    refreshStoredGrantStatuses(),
    listGrantLogEntries(db),
    refreshStoredSessionCapabilityStatuses(),
    listSessionCapabilityLogEntries(db),
  ]);
  const operatorAccess = isTrustedNodeRole(operator.activeMember?.role);
  const scopedActionBundles = operatorAccess
    ? actionBundles.filter((bundle) => bundle.coopId === activeContext.activeCoopId)
    : [];
  const scopedActionLogEntries = operatorAccess
    ? actionLogEntries.filter((entry) => entry.coopId === activeContext.activeCoopId)
    : [];
  const scopedExecutionGrants = operatorAccess
    ? executionGrants.filter((grant) => grant.coopId === activeContext.activeCoopId)
    : [];
  const scopedGrantLogEntries = operatorAccess
    ? grantLogEntries.filter((entry) => entry.coopId === activeContext.activeCoopId)
    : [];
  const scopedSessionCapabilities = operatorAccess
    ? sessionCapabilities.filter((capability) => capability.coopId === activeContext.activeCoopId)
    : [];
  const scopedSessionCapabilityLogEntries = operatorAccess
    ? sessionCapabilityLogEntries.filter((entry) => entry.coopId === activeContext.activeCoopId)
    : [];
  const scopedPrivilegedActionLog = operatorAccess
    ? operator.actionLog.filter(
        (entry) => !entry.context.coopId || entry.context.coopId === activeContext.activeCoopId,
      )
    : [];

  return {
    coops,
    activeCoopId: activeContext.activeCoopId ?? summary.activeCoopId,
    drafts: visibleDrafts,
    candidates: candidates.reverse().slice(-12).reverse(),
    summary,
    soundPreferences: soundPreferences ?? defaultSoundPreferences,
    uiPreferences: resolvedUiPreferences,
    authSession,
    identities,
    receiverPairings: visibleReceiverPairings,
    receiverIntake: visibleReceiverIntake,
    runtimeConfig: {
      chainKey: configuredChain,
      onchainMode: configuredOnchainMode,
      archiveMode: configuredArchiveMode,
      sessionMode: configuredSessionMode,
      receiverAppUrl: configuredReceiverAppUrl,
      signalingUrls: configuredSignalingUrls,
    },
    operator: {
      anchorCapability: operator.anchorCapability,
      anchorActive: operator.anchorStatus.active,
      anchorDetail: operator.anchorStatus.detail,
      actionLog: scopedPrivilegedActionLog,
      archiveMode: configuredArchiveMode,
      onchainMode: configuredOnchainMode,
      liveArchiveAvailable: operator.liveArchive.available,
      liveArchiveDetail: operator.liveArchive.detail,
      liveOnchainAvailable: operator.liveOnchain.available,
      liveOnchainDetail: operator.liveOnchain.detail,
      policyActionQueue: pendingBundles(scopedActionBundles),
      policyActionLogEntries: scopedActionLogEntries,
      grants: scopedExecutionGrants,
      grantLog: scopedGrantLogEntries,
      sessionCapabilities: scopedSessionCapabilities,
      sessionCapabilityLog: scopedSessionCapabilityLogEntries,
    },
  };
}

async function collectCandidate(
  tab: chrome.tabs.Tab,
): Promise<{ candidate: TabCandidate; snapshot: CaptureSnapshot } | null> {
  if (!tab.id || !tab.url || !isSupportedUrl(tab.url)) {
    return null;
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageSnapshot,
  });
  const result = results?.[0]?.result;

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

async function runCaptureForTabs(tabs: chrome.tabs.Tab[]) {
  const coops = await getCoops();
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
        await syncHighConfidenceDraftObservations(drafts);
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

async function runCaptureCycle() {
  return runCaptureForTabs(await chrome.tabs.query({}));
}

async function captureActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    return 0;
  }
  return runCaptureForTabs([tab]);
}

async function openCoopSidepanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.windowId) {
    return false;
  }

  await chrome.sidePanel.open({ windowId: tab.windowId });
  return true;
}

async function captureVisibleScreenshot(): Promise<ReceiverCapture> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.windowId || !tab.url || !isSupportedUrl(tab.url)) {
    throw new Error('Open a standard web page before capturing a screenshot.');
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: 'png',
  });
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const timestamp = nowIso();
  const coops = await getCoops();
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const activeCoop = coops.find((coop) => coop.profile.id === activeContext.activeCoopId);
  const activeMember = resolveReceiverPairingMember(activeCoop, authSession);
  const capture = {
    ...createReceiverCapture({
      deviceId: extensionCaptureDeviceId,
      kind: 'photo',
      blob,
      fileName: `coop-screenshot-${timestamp.replace(/[:.]/gu, '-')}.png`,
      title: `Page screenshot · ${tab.title || new URL(tab.url).hostname}`,
      note: `Captured from ${tab.url} via Extension Browser.`,
      sourceUrl: tab.url,
      createdAt: timestamp,
    }),
    coopId: activeCoop?.profile.id,
    coopDisplayName: activeCoop?.profile.name,
    memberId: activeMember?.id,
    memberDisplayName: activeMember?.displayName,
    updatedAt: timestamp,
  } satisfies ReceiverCapture;

  await saveReceiverCapture(db, capture, blob);
  await refreshBadge();
  await notifyExtensionEvent({
    eventKind: 'screenshot-saved',
    entityId: capture.id,
    state: 'saved',
    title: 'Screenshot saved',
    message: activeCoop?.profile.name
      ? `Saved a private screenshot for ${activeCoop.profile.name}.`
      : 'Saved a private local screenshot to Coop.',
  });
  return capture;
}

async function registerContextMenus() {
  await chrome.contextMenus.removeAll();
  await chrome.contextMenus.create({
    id: contextMenuIds.open,
    title: 'Open Coop',
    contexts: ['action'],
  });
  await chrome.contextMenus.create({
    id: contextMenuIds.roundUp,
    title: 'Round up this tab',
    contexts: ['page', 'action'],
  });
  await chrome.contextMenus.create({
    id: contextMenuIds.screenshot,
    title: 'Capture screenshot to Coop',
    contexts: ['page', 'action'],
  });
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
    await notifyExtensionEvent({
      eventKind: 'safe-deployment',
      entityId: message.payload.coopSeed,
      state: 'succeeded',
      title: 'Safe deployed',
      message: `Live Safe deployment completed on ${onchainState.chainKey}.`,
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
    await notifyExtensionEvent({
      eventKind: 'safe-deployment',
      entityId: message.payload.coopSeed,
      state: 'failed',
      title: 'Safe deployment failed',
      message: messageText,
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
  if (created.state.greenGoods?.enabled) {
    await emitAgentObservationIfMissing({
      trigger: 'green-goods-garden-requested',
      title: `Green Goods garden requested for ${created.state.profile.name}`,
      summary: `Create a Green Goods garden owned by ${created.state.profile.name}'s coop Safe.`,
      coopId: created.state.profile.id,
      payload: {
        status: created.state.greenGoods.status,
        requestedAt: created.state.greenGoods.requestedAt,
        weightScheme: created.state.greenGoods.weightScheme,
        domainMask: created.state.greenGoods.domainMask,
      },
    });
    await ensureReceiverSyncOffscreenDocument();
    await requestAgentCycle(`green-goods-create:${created.state.profile.id}`, true);
  }
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
  const firstSyncForPairing = !pairing.lastSyncedAt;
  await updateReceiverPairing(db, pairingId, {
    lastSyncedAt: syncedAt,
  });
  await emitAgentObservationIfMissing({
    trigger: 'receiver-backlog',
    title: `Receiver backlog: ${capture.title}`,
    summary: capture.note || capture.title,
    coopId: capture.coopId,
    captureId: capture.id,
    payload: {
      intakeStatus: capture.intakeStatus,
      receiverKind: capture.kind,
    },
  });
  await refreshBadge();
  if (firstSyncForPairing) {
    await notifyExtensionEvent({
      eventKind: 'receiver-sync',
      entityId: pairingId,
      state: 'first-sync',
      title: 'Receiver synced',
      message: `${pairing.memberDisplayName} synced their first receiver capture into ${pairing.coopDisplayName}.`,
    });
  }

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
  await syncHighConfidenceDraftObservations([draft]);
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

async function publishDraftWithContext(input: {
  draft: ReviewDraft;
  targetCoopIds: string[];
  authSession: Awaited<ReturnType<typeof getAuthSession>>;
  activeCoopId?: string;
  activeMemberId?: string;
}) {
  const coops = await getCoops();
  const persistedDraft = await getReviewDraft(db, input.draft.id);
  const validation = validateReviewDraftPublish({
    persistedDraft,
    incomingDraft: input.draft,
    targetCoopIds: input.targetCoopIds,
    states: coops,
    authSession: input.authSession,
    activeCoopId: input.activeCoopId,
    activeMemberId: input.activeMemberId,
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
  const authSession = await getAuthSession(db);
  const coops = await getCoops();
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  return publishDraftWithContext({
    draft: message.payload.draft,
    targetCoopIds: message.payload.targetCoopIds,
    authSession,
    activeCoopId: activeContext.activeCoopId,
    activeMemberId: activeContext.activeMemberId,
  });
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
    const trustedNodeArchiveConfig = await requireTrustedNodeArchiveConfig();
    const delegation = await issueArchiveDelegation({
      config: trustedNodeArchiveConfig,
      request: {
        audienceDid: client.did(),
        coopId: input.coop.profile.id,
        scope: input.bundle.scope,
        operation: 'upload',
        artifactIds: input.artifactIds,
        actorAddress: authSession.primaryAddress,
        safeAddress: input.coop.profile.safeAddress,
        chainKey: input.coop.onchainState.chainKey,
      },
    });
    const upload = await uploadArchiveBundleToStoracha({
      bundle: input.bundle,
      delegation,
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
    const detail = describeArchiveLiveFailure(error);
    await notifyExtensionEvent({
      eventKind: 'archive-artifact',
      entityId: message.payload.artifactId,
      state: 'failed',
      title: 'Artifact archive failed',
      message: detail,
    });
    return {
      ok: false,
      error: detail,
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
  await notifyExtensionEvent({
    eventKind: 'archive-artifact',
    entityId: message.payload.artifactId,
    state: receipt.id,
    title: 'Artifact archived',
    message: `${receipt.title} was archived and stored locally.`,
  });
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
    const detail = describeArchiveLiveFailure(error);
    await notifyExtensionEvent({
      eventKind: 'archive-snapshot',
      entityId: message.payload.coopId,
      state: 'failed',
      title: 'Snapshot archive failed',
      message: detail,
    });
    return {
      ok: false,
      error: detail,
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
  await notifyExtensionEvent({
    eventKind: 'archive-snapshot',
    entityId: message.payload.coopId,
    state: receipt.id,
    title: 'Snapshot archived',
    message: `${coop.profile.name} snapshot archived and receipt stored.`,
  });
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
      const trustedNodeArchiveConfig = await requireTrustedNodeArchiveConfig();
      const delegation = await issueArchiveDelegation({
        config: trustedNodeArchiveConfig,
        request: {
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
        },
      });
      const filecoinInfo = await requestArchiveReceiptFilecoinInfo({
        receipt,
        delegation,
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
  if (failedCount > 0) {
    await notifyExtensionEvent({
      eventKind: 'archive-follow-up',
      entityId: message.payload.receiptId ?? `${coop.profile.id}:${candidates.length}`,
      state: `${failedCount}-failed`,
      title: 'Archive follow-up needs attention',
      message: `Filecoin follow-up failed for ${failedCount} archive receipt(s).`,
    });
  }
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

async function executeAgentPlanProposals(plan: AgentPlan) {
  const authSession = await getAuthSession(db);
  const coops = await getCoops();
  let executedCount = 0;
  const errors: string[] = [];

  for (const proposal of plan.actionProposals) {
    const coop = coops.find((candidate) => candidate.profile.id === proposal.coopId);
    const memberId =
      proposal.memberId ?? (coop ? findAuthenticatedCoopMember(coop, authSession)?.id : undefined);
    if (!memberId) {
      errors.push(`No authenticated member is available for coop ${proposal.coopId}.`);
      continue;
    }

    const proposed = await handleProposeAction({
      type: 'propose-action',
      payload: {
        actionClass: proposal.actionClass,
        coopId: proposal.coopId,
        memberId,
        payload: proposal.payload,
      },
    });
    if (!proposed.ok || !proposed.data) {
      errors.push(proposed.error ?? `Could not propose ${proposal.actionClass}.`);
      continue;
    }

    if (proposal.approvalMode !== 'auto-run-eligible' || proposed.data.status !== 'approved') {
      continue;
    }

    const executed = await handleExecuteAction({
      type: 'execute-action',
      payload: { bundleId: proposed.data.id },
    });
    if (!executed.ok) {
      errors.push(executed.error ?? `Could not execute ${proposal.actionClass}.`);
      continue;
    }
    executedCount += 1;
  }

  return { executedCount, errors };
}

async function handleGetAgentDashboard(): Promise<RuntimeActionResponse<AgentDashboardResponse>> {
  await syncAgentObservations();
  return {
    ok: true,
    data: await getAgentDashboard(),
  };
}

async function handleRunAgentCycle(): Promise<RuntimeActionResponse<AgentDashboardResponse>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  await ensureReceiverSyncOffscreenDocument();
  await syncAgentObservations();
  const request = await requestAgentCycle('manual-run', true);
  await waitForAgentCycle(request);
  return {
    ok: true,
    data: await getAgentDashboard(),
  };
}

async function handleApproveAgentPlan(
  message: Extract<RuntimeRequest, { type: 'approve-agent-plan' }>,
): Promise<RuntimeActionResponse<AgentPlan>> {
  const plan = await getAgentPlan(db, message.payload.planId);
  if (!plan) {
    return { ok: false, error: 'Agent plan not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: (await getAgentObservation(db, plan.observationId))?.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  let approvedPlan = markAgentPlanApproved(plan);
  await saveAgentPlan(db, approvedPlan);

  const dispatch = await executeAgentPlanProposals(approvedPlan);
  if (dispatch.errors.length > 0) {
    approvedPlan = updateAgentPlan(approvedPlan, {
      failureReason: dispatch.errors.join(' '),
      status: dispatch.executedCount > 0 ? 'approved' : 'failed',
    });
  } else if (approvedPlan.actionProposals.length === 0 || dispatch.executedCount > 0) {
    approvedPlan = completeAgentPlan(approvedPlan);
  }

  await saveAgentPlan(db, approvedPlan);
  return { ok: true, data: approvedPlan };
}

async function handleRejectAgentPlan(
  message: Extract<RuntimeRequest, { type: 'reject-agent-plan' }>,
): Promise<RuntimeActionResponse<AgentPlan>> {
  const plan = await getAgentPlan(db, message.payload.planId);
  if (!plan) {
    return { ok: false, error: 'Agent plan not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: (await getAgentObservation(db, plan.observationId))?.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const rejected = markAgentPlanRejected(plan, message.payload.reason);
  await saveAgentPlan(db, rejected);

  const observation = await getAgentObservation(db, rejected.observationId);
  if (observation) {
    await saveAgentObservation(
      db,
      updateAgentObservation(observation, {
        status: 'dismissed',
        blockedReason: message.payload.reason,
      }),
    );
  }
  return { ok: true, data: rejected };
}

async function handleRetrySkillRun(
  message: Extract<RuntimeRequest, { type: 'retry-skill-run' }>,
): Promise<RuntimeActionResponse<AgentDashboardResponse>> {
  const skillRun = await getSkillRun(db, message.payload.skillRunId);
  if (!skillRun) {
    return { ok: false, error: 'Skill run not found.' };
  }
  const observation = await getAgentObservation(db, skillRun.observationId);
  if (!observation) {
    return { ok: false, error: 'Agent observation not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: observation.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  await saveAgentObservation(
    db,
    updateAgentObservation(observation, {
      status: 'pending',
      blockedReason: undefined,
    }),
  );

  await ensureReceiverSyncOffscreenDocument();
  const request = await requestAgentCycle(`retry:${skillRun.id}`, true);
  await waitForAgentCycle(request);
  return { ok: true, data: await getAgentDashboard() };
}

async function handleListSkillManifests(): Promise<
  RuntimeActionResponse<AgentDashboardResponse['manifests']>
> {
  return {
    ok: true,
    data: listRegisteredSkills().map((entry) => entry.manifest),
  };
}

async function handleQueueGreenGoodsWorkApproval(
  message: Extract<RuntimeRequest, { type: 'queue-green-goods-work-approval' }>,
): Promise<RuntimeActionResponse<AgentObservation>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  if (!trustedNodeContext.coop.greenGoods?.gardenAddress) {
    return { ok: false, error: 'Green Goods garden is not linked for this coop.' };
  }

  const request = greenGoodsWorkApprovalRequestSchema.parse(
    message.payload.request,
  ) as GreenGoodsWorkApprovalRequest;
  const observation = await emitAgentObservationIfMissing({
    trigger: 'green-goods-work-approval-requested',
    title: `Green Goods work approval for ${trustedNodeContext.coop.profile.name}`,
    summary: `Approve work ${request.workUid} for action ${request.actionUid}.`,
    coopId: trustedNodeContext.coop.profile.id,
    payload: request,
  });
  await ensureReceiverSyncOffscreenDocument();
  await requestAgentCycle(`green-goods-work-approval:${observation.id}`, true);
  return { ok: true, data: observation };
}

async function handleQueueGreenGoodsAssessment(
  message: Extract<RuntimeRequest, { type: 'queue-green-goods-assessment' }>,
): Promise<RuntimeActionResponse<AgentObservation>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  if (!trustedNodeContext.coop.greenGoods?.gardenAddress) {
    return { ok: false, error: 'Green Goods garden is not linked for this coop.' };
  }

  const request = greenGoodsAssessmentRequestSchema.parse(
    message.payload.request,
  ) as GreenGoodsAssessmentRequest;
  const observation = await emitAgentObservationIfMissing({
    trigger: 'green-goods-assessment-requested',
    title: `Green Goods assessment for ${trustedNodeContext.coop.profile.name}`,
    summary: `Create assessment "${request.title}" for ${trustedNodeContext.coop.profile.name}.`,
    coopId: trustedNodeContext.coop.profile.id,
    payload: request,
  });
  await ensureReceiverSyncOffscreenDocument();
  await requestAgentCycle(`green-goods-assessment:${observation.id}`, true);
  return { ok: true, data: observation };
}

async function handleQueueGreenGoodsGapAdminSync(
  message: Extract<RuntimeRequest, { type: 'queue-green-goods-gap-admin-sync' }>,
): Promise<RuntimeActionResponse<AgentObservation>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  if (!trustedNodeContext.coop.greenGoods?.gardenAddress) {
    return { ok: false, error: 'Green Goods garden is not linked for this coop.' };
  }

  const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(trustedNodeContext.coop);
  const observation = await emitAgentObservationIfMissing({
    trigger: 'green-goods-gap-admin-sync-needed',
    title: `Green Goods GAP admin sync needed for ${trustedNodeContext.coop.profile.name}`,
    summary: `Align Karma GAP admins with the trusted operators for ${trustedNodeContext.coop.profile.name}.`,
    coopId: trustedNodeContext.coop.profile.id,
    payload: {
      gardenAddress: trustedNodeContext.coop.greenGoods.gardenAddress,
      desiredAdmins,
      currentAdmins: trustedNodeContext.coop.greenGoods.gapAdminAddresses ?? [],
    },
  });
  await ensureReceiverSyncOffscreenDocument();
  await requestAgentCycle(`green-goods-gap-admin-sync:${observation.id}`, true);
  return { ok: true, data: observation };
}

async function handleSetAgentSkillAutoRun(
  message: Extract<RuntimeRequest, { type: 'set-agent-skill-auto-run' }>,
): Promise<RuntimeActionResponse<string[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const current = new Set(await getAgentAutoRunSkillIds());
  if (message.payload.enabled) {
    current.add(message.payload.skillId);
  } else {
    current.delete(message.payload.skillId);
  }
  const next = [...current].sort();
  await setLocalSetting(AGENT_SETTING_KEYS.autoRunSkillIds, next);
  return { ok: true, data: next };
}

// --- Agent Policy Handlers ---

async function ensureActionPolicies(): Promise<ActionPolicy[]> {
  const policies = await listActionPolicies(db);
  if (policies.length > 0) {
    return policies;
  }
  const defaults = createDefaultPolicies();
  await setActionPolicies(db, defaults);
  return defaults;
}

async function handleGetActionPolicies(): Promise<RuntimeActionResponse<ActionPolicy[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  const policies = await ensureActionPolicies();
  return { ok: true, data: policies };
}

async function handleSetActionPolicy(
  message: Extract<RuntimeRequest, { type: 'set-action-policy' }>,
): Promise<RuntimeActionResponse<ActionPolicy[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const current = await ensureActionPolicies();
  const updated = upsertPolicyForActionClass(current, message.payload.actionClass, {
    approvalRequired: message.payload.approvalRequired,
  });
  await setActionPolicies(db, updated);
  return { ok: true, data: updated };
}

async function handleProposeAction(
  message: Extract<RuntimeRequest, { type: 'propose-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
    requestedMemberId: message.payload.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const policies = await ensureActionPolicies();
  const policy = findMatchingPolicy(policies, {
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    memberId: message.payload.memberId,
  });
  if (!policy) {
    return {
      ok: false,
      error: `No policy found for action class "${message.payload.actionClass}".`,
    };
  }

  const bundle = createActionBundle({
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    memberId: message.payload.memberId,
    payload: message.payload.payload,
    policy,
    chainId: trustedNodeContext.coop.onchainState.chainId,
    chainKey: trustedNodeContext.coop.onchainState.chainKey,
    safeAddress: trustedNodeContext.coop.onchainState.safeAddress as Address,
  });
  await saveActionBundle(db, bundle);

  const logEntry = createActionLogEntry({
    bundle,
    eventType: 'proposal-created',
    detail: `Proposed ${message.payload.actionClass} for coop ${message.payload.coopId}.`,
  });
  await saveActionLogEntry(db, logEntry);

  return { ok: true, data: bundle };
}

async function handleApproveAction(
  message: Extract<RuntimeRequest, { type: 'approve-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const bundle = await getActionBundle(db, message.payload.bundleId);
  if (!bundle) {
    return { ok: false, error: 'Action bundle not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: bundle.coopId,
    requestedMemberId: bundle.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const result = approveBundle(bundle);
  if ('error' in result) {
    return { ok: false, error: result.error };
  }

  await saveActionBundle(db, result);
  const logEntry = createActionLogEntry({
    bundle: result,
    eventType: 'proposal-approved',
    detail: `Approved ${result.actionClass} bundle ${result.id}.`,
  });
  await saveActionLogEntry(db, logEntry);

  return { ok: true, data: result };
}

async function handleRejectAction(
  message: Extract<RuntimeRequest, { type: 'reject-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const bundle = await getActionBundle(db, message.payload.bundleId);
  if (!bundle) {
    return { ok: false, error: 'Action bundle not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: bundle.coopId,
    requestedMemberId: bundle.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const result = rejectBundle(bundle);
  if ('error' in result) {
    return { ok: false, error: result.error };
  }

  await saveActionBundle(db, result);
  const logEntry = createActionLogEntry({
    bundle: result,
    eventType: 'proposal-rejected',
    detail: `Rejected ${result.actionClass} bundle ${result.id}.`,
  });
  await saveActionLogEntry(db, logEntry);

  return { ok: true, data: result };
}

async function handleExecuteAction(
  message: Extract<RuntimeRequest, { type: 'execute-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const bundle = await getActionBundle(db, message.payload.bundleId);
  if (!bundle) {
    return { ok: false, error: 'Action bundle not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: bundle.coopId,
    requestedMemberId: bundle.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const policies = await ensureActionPolicies();
  const policy = findMatchingPolicy(policies, {
    actionClass: bundle.actionClass,
    coopId: bundle.coopId,
    memberId: bundle.memberId,
  });
  if (!policy) {
    return {
      ok: false,
      error: `No policy found for action class "${bundle.actionClass}".`,
    };
  }

  const replayIds = await listRecordedReplayIds(db);
  const replayGuard = createReplayGuard(replayIds);

  const handlers: Partial<
    Record<
      PolicyActionClass,
      (payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; data?: unknown }>
    >
  > = {
    'archive-artifact': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'archive-artifact',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }
      const coopId = scopedPayload.normalizedPayload.coopId as string;
      const artifactId = scopedPayload.normalizedPayload.artifactId as string;
      const result = await handleArchiveArtifact({
        type: 'archive-artifact',
        payload: { coopId, artifactId },
      });
      return { ok: result.ok, error: result.error, data: result.data };
    },
    'archive-snapshot': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'archive-snapshot',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }
      const coopId = scopedPayload.normalizedPayload.coopId as string;
      const result = await handleArchiveSnapshot({
        type: 'archive-snapshot',
        payload: { coopId },
      });
      return { ok: result.ok, error: result.error, data: result.data };
    },
    'refresh-archive-status': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'refresh-archive-status',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }
      const coopId = scopedPayload.normalizedPayload.coopId as string;
      const receiptId = scopedPayload.normalizedPayload.receiptId as string | undefined;
      const result = await handleRefreshArchiveStatus({
        type: 'refresh-archive-status',
        payload: { coopId, receiptId },
      });
      return { ok: result.ok, error: result.error, data: result.data };
    },
    'publish-ready-draft': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'publish-ready-draft',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }
      const draftId = scopedPayload.normalizedPayload.draftId as string;
      const targetCoopIds = scopedPayload.normalizedPayload.targetCoopIds as string[];
      const persistedDraft = await getReviewDraft(db, draftId);
      if (!persistedDraft) {
        return { ok: false, error: 'Draft not found.' };
      }

      const coops = await getCoops();
      const authSession = await getAuthSession(db);
      const scopedCoop = coops.find((item) => item.profile.id === bundle.coopId);
      const scopedMember = scopedCoop
        ? resolveReceiverPairingMember(scopedCoop, authSession, bundle.memberId)
        : undefined;
      const validation = validateReviewDraftPublish({
        persistedDraft,
        incomingDraft: persistedDraft,
        targetCoopIds,
        states: coops,
        authSession,
        activeCoopId: scopedCoop?.profile.id,
        activeMemberId: scopedMember?.id,
      });
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      const publishResult = await publishDraftWithContext({
        draft: persistedDraft,
        targetCoopIds,
        authSession,
        activeCoopId: scopedCoop?.profile.id,
        activeMemberId: scopedMember?.id,
      });
      return { ok: publishResult.ok, error: publishResult.error, data: publishResult.data };
    },
    'safe-deployment': async () => {
      return {
        ok: false,
        error: 'Safe deployment requires direct human confirmation in this phase.',
      };
    },
    'green-goods-create-garden': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-create-garden',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }

      try {
        const provisioningCoop = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current?.enabled) {
              throw new Error('Green Goods is not enabled for this coop.');
            }
            return updateGreenGoodsState(current, {
              status: 'provisioning',
              provisioningAt: nowIso(),
              name: scopedPayload.normalizedPayload.name as string,
              slug: scopedPayload.normalizedPayload.slug as string | undefined,
              description: scopedPayload.normalizedPayload.description as string,
              location: scopedPayload.normalizedPayload.location as string,
              bannerImage: scopedPayload.normalizedPayload.bannerImage as string,
              metadata: scopedPayload.normalizedPayload.metadata as string,
              openJoining: scopedPayload.normalizedPayload.openJoining as boolean,
              maxGardeners: scopedPayload.normalizedPayload.maxGardeners as number,
              weightScheme: scopedPayload.normalizedPayload
                .weightScheme as GreenGoodsGardenState['weightScheme'],
              domains: scopedPayload.normalizedPayload.domains as GreenGoodsGardenState['domains'],
              statusNote: 'Provisioning Green Goods garden via the coop Safe.',
              lastError: undefined,
            });
          },
        });
        const provisioningGarden = provisioningCoop.greenGoods;
        if (!provisioningGarden) {
          throw new Error('Green Goods state is missing.');
        }

        const result = await createGreenGoodsGarden({
          mode: configuredOnchainMode,
          coopId: bundle.coopId,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: provisioningCoop.onchainState,
          garden: provisioningGarden,
          operatorAddresses: scopedPayload.normalizedPayload.operatorAddresses as `0x${string}`[],
          gardenerAddresses: scopedPayload.normalizedPayload.gardenerAddresses as `0x${string}`[],
          liveExecutor: await buildGreenGoodsSessionExecutor({
            coop: provisioningCoop,
            bundle,
          }),
        });

        const linkedCoop = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) {
              throw new Error('Green Goods state is missing.');
            }
            return updateGreenGoodsState(current, {
              status: 'linked',
              gardenAddress: result.gardenAddress,
              tokenId: result.tokenId,
              gapProjectUid: result.gapProjectUid,
              gapAdminAddresses: [],
              linkedAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });

        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Created Green Goods garden ${result.gardenAddress}.`,
          coop: linkedCoop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        await emitAgentObservationIfMissing({
          trigger: 'green-goods-sync-needed',
          title: `Green Goods sync needed for ${linkedCoop.profile.name}`,
          summary: `Garden ${result.gardenAddress} should be synced to the latest coop state.`,
          coopId: linkedCoop.profile.id,
          payload: {
            gardenAddress: result.gardenAddress,
            status: linkedCoop.greenGoods?.status,
            lastProfileSyncAt: linkedCoop.greenGoods?.lastProfileSyncAt,
            lastDomainSyncAt: linkedCoop.greenGoods?.lastDomainSyncAt,
            lastPoolSyncAt: linkedCoop.greenGoods?.lastPoolSyncAt,
          },
        });
        if (isGreenGoodsGapAdminSyncNeeded(linkedCoop)) {
          const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(linkedCoop);
          await emitAgentObservationIfMissing({
            trigger: 'green-goods-gap-admin-sync-needed',
            title: `Green Goods GAP admin sync needed for ${linkedCoop.profile.name}`,
            summary: `Karma GAP admins should match the trusted operators for ${linkedCoop.profile.name}.`,
            coopId: linkedCoop.profile.id,
            payload: {
              gardenAddress: result.gardenAddress,
              desiredAdmins,
              currentAdmins: linkedCoop.greenGoods?.gapAdminAddresses ?? [],
            },
          });
        }
        await ensureReceiverSyncOffscreenDocument();
        await requestAgentCycle(`green-goods-sync:${linkedCoop.profile.id}`, true);

        return { ok: true, data: linkedCoop.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods garden creation failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) {
                throw new Error(message);
              }
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          // Ignore follow-up state patch failures and return the original error.
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods garden creation failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-sync-garden-profile': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-sync-garden-profile',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }

      try {
        const coop = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current?.gardenAddress) {
              throw new Error('Green Goods garden is not linked yet.');
            }
            return updateGreenGoodsState(current, {
              name: scopedPayload.normalizedPayload.name as string,
              description: scopedPayload.normalizedPayload.description as string,
              location: scopedPayload.normalizedPayload.location as string,
              bannerImage: scopedPayload.normalizedPayload.bannerImage as string,
              metadata: scopedPayload.normalizedPayload.metadata as string,
              openJoining: scopedPayload.normalizedPayload.openJoining as boolean,
              maxGardeners: scopedPayload.normalizedPayload.maxGardeners as number,
              status: 'linked',
              statusNote: 'Syncing Green Goods garden profile fields.',
              lastError: undefined,
            });
          },
        });
        const result = await syncGreenGoodsGardenProfile({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          output: {
            name: scopedPayload.normalizedPayload.name as string,
            description: scopedPayload.normalizedPayload.description as string,
            location: scopedPayload.normalizedPayload.location as string,
            bannerImage: scopedPayload.normalizedPayload.bannerImage as string,
            metadata: scopedPayload.normalizedPayload.metadata as string,
            openJoining: scopedPayload.normalizedPayload.openJoining as boolean,
            maxGardeners: scopedPayload.normalizedPayload.maxGardeners as number,
            domains: coop.greenGoods?.domains ?? [],
            ensurePools: true,
            rationale: 'Sync Green Goods garden profile fields.',
          },
          liveExecutor: await buildGreenGoodsSessionExecutor({
            coop,
            bundle,
          }),
        });
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) {
              throw new Error('Green Goods state is missing.');
            }
            return updateGreenGoodsState(current, {
              status: 'linked',
              lastProfileSyncAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Synced Green Goods garden profile for ${scopedPayload.normalizedPayload.gardenAddress as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods garden profile sync failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) {
                throw new Error(message);
              }
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          // Ignore follow-up state patch failures and return the original error.
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods garden profile sync failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-set-garden-domains': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-set-garden-domains',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }

      try {
        const coop = trustedNodeContext.coop;
        const result = await setGreenGoodsGardenDomains({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          domains: scopedPayload.normalizedPayload.domains as GreenGoodsGardenState['domains'],
          liveExecutor: await buildGreenGoodsSessionExecutor({
            coop,
            bundle,
          }),
        });
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) {
              throw new Error('Green Goods state is missing.');
            }
            return updateGreenGoodsState(current, {
              status: 'linked',
              domains: scopedPayload.normalizedPayload.domains as GreenGoodsGardenState['domains'],
              lastDomainSyncAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Updated Green Goods garden domains for ${scopedPayload.normalizedPayload.gardenAddress as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Green Goods domain sync failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) {
                throw new Error(message);
              }
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          // Ignore follow-up state patch failures and return the original error.
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods domain sync failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-create-garden-pools': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-create-garden-pools',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }

      try {
        const coop = trustedNodeContext.coop;
        const result = await createGreenGoodsGardenPools({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          liveExecutor: await buildGreenGoodsSessionExecutor({
            coop,
            bundle,
          }),
        });
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) {
              throw new Error('Green Goods state is missing.');
            }
            return updateGreenGoodsState(current, {
              status: 'linked',
              lastPoolSyncAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Created Green Goods signal pools for ${scopedPayload.normalizedPayload.gardenAddress as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods pool creation failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) {
                throw new Error(message);
              }
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          // Ignore follow-up state patch failures and return the original error.
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods pool creation failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-submit-work-approval': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-submit-work-approval',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }

      try {
        const coop = trustedNodeContext.coop;
        const result = await submitGreenGoodsWorkApproval({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          output: {
            actionUid: scopedPayload.normalizedPayload.actionUid as number,
            workUid: scopedPayload.normalizedPayload.workUid as `0x${string}`,
            approved: scopedPayload.normalizedPayload.approved as boolean,
            feedback: scopedPayload.normalizedPayload.feedback as string,
            confidence: scopedPayload.normalizedPayload.confidence as number,
            verificationMethod: scopedPayload.normalizedPayload.verificationMethod as number,
            reviewNotesCid: scopedPayload.normalizedPayload.reviewNotesCid as string,
            rationale: 'Submit Green Goods work approval.',
          },
        });
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) {
              throw new Error('Green Goods state is missing.');
            }
            return updateGreenGoodsState(current, {
              status: 'linked',
              lastWorkApprovalAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Submitted Green Goods work approval for ${scopedPayload.normalizedPayload.workUid as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods work approval submission failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) {
                throw new Error(message);
              }
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          // Ignore follow-up state patch failures and return the original error.
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods work approval submission failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-create-assessment': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-create-assessment',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }

      try {
        const coop = trustedNodeContext.coop;
        const result = await createGreenGoodsAssessment({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          output: {
            title: scopedPayload.normalizedPayload.title as string,
            description: scopedPayload.normalizedPayload.description as string,
            assessmentConfigCid: scopedPayload.normalizedPayload.assessmentConfigCid as string,
            domain: scopedPayload.normalizedPayload
              .domain as GreenGoodsGardenState['domains'][number],
            startDate: scopedPayload.normalizedPayload.startDate as number,
            endDate: scopedPayload.normalizedPayload.endDate as number,
            location: scopedPayload.normalizedPayload.location as string,
            rationale: 'Create Green Goods assessment.',
          },
        });
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) {
              throw new Error('Green Goods state is missing.');
            }
            return updateGreenGoodsState(current, {
              status: 'linked',
              lastAssessmentAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Created Green Goods assessment ${scopedPayload.normalizedPayload.title as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods assessment creation failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) {
                throw new Error(message);
              }
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          // Ignore follow-up state patch failures and return the original error.
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods assessment creation failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
    'green-goods-sync-gap-admins': async (payload) => {
      const scopedPayload = resolveScopedActionPayload({
        actionClass: 'green-goods-sync-gap-admins',
        payload,
        expectedCoopId: bundle.coopId,
      });
      if (!scopedPayload.ok) {
        return { ok: false, error: scopedPayload.reason };
      }

      try {
        const coop = trustedNodeContext.coop;
        const addAdmins = scopedPayload.normalizedPayload.addAdmins as `0x${string}`[];
        const removeAdmins = scopedPayload.normalizedPayload.removeAdmins as `0x${string}`[];
        const result = await syncGreenGoodsGapAdmins({
          mode: configuredOnchainMode,
          authSession: trustedNodeContext.authSession,
          pimlicoApiKey: configuredPimlicoApiKey,
          onchainState: coop.onchainState,
          gardenAddress: scopedPayload.normalizedPayload.gardenAddress as `0x${string}`,
          addAdmins,
          removeAdmins,
        });
        const nextAdminAddresses = resolveDesiredGreenGoodsGapAdmins(coop);
        const updated = await updateCoopGreenGoodsState({
          coopId: bundle.coopId,
          apply(current) {
            if (!current) {
              throw new Error('Green Goods state is missing.');
            }
            return updateGreenGoodsState(current, {
              status: 'linked',
              gapAdminAddresses: nextAdminAddresses,
              lastGapAdminSyncAt: nowIso(),
              lastTxHash: result.txHash,
              statusNote: result.detail,
              lastError: undefined,
            });
          },
        });
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'succeeded',
          detail: `Synced Green Goods GAP admins for ${scopedPayload.normalizedPayload.gardenAddress as string}.`,
          coop: updated,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: true, data: updated.greenGoods };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Green Goods GAP admin sync failed.';
        try {
          await updateCoopGreenGoodsState({
            coopId: bundle.coopId,
            apply(current) {
              if (!current) {
                throw new Error(message);
              }
              return updateGreenGoodsState(current, {
                status: 'error',
                lastError: message,
                statusNote: message,
              });
            },
          });
        } catch {
          // Ignore follow-up state patch failures and return the original error.
        }
        await logPrivilegedAction({
          actionType: 'green-goods-transaction',
          status: 'failed',
          detail: `Green Goods GAP admin sync failed: ${message}`,
          coop: trustedNodeContext.coop,
          memberId: trustedNodeContext.member.id,
          memberDisplayName: trustedNodeContext.member.displayName,
          authSession: trustedNodeContext.authSession,
        });
        return { ok: false, error: message };
      }
    },
  };

  const startLogEntry = createActionLogEntry({
    bundle,
    eventType: 'execution-started',
    detail: `Executing ${bundle.actionClass} bundle ${bundle.id}.`,
  });
  await saveActionLogEntry(db, startLogEntry);

  const executionResult = await executeBundleAction({
    bundle,
    policy,
    replayGuard,
    handlers,
  });

  await saveActionBundle(db, executionResult.bundle);

  if (executionResult.ok) {
    await recordReplayId(db, bundle.replayId, bundle.id, nowIso());
    const successLogEntry = createActionLogEntry({
      bundle: executionResult.bundle,
      eventType: 'execution-succeeded',
      detail: executionResult.detail,
    });
    await saveActionLogEntry(db, successLogEntry);
  } else {
    const failLogEntry = createActionLogEntry({
      bundle: executionResult.bundle,
      eventType: 'execution-failed',
      detail: executionResult.detail,
    });
    await saveActionLogEntry(db, failLogEntry);
  }

  return {
    ok: executionResult.ok,
    data: executionResult.bundle,
    error: executionResult.ok ? undefined : executionResult.detail,
  };
}

async function handleGetActionQueue(): Promise<RuntimeActionResponse<ActionBundle[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  const bundles = await listActionBundlesByStatus(db, ['proposed', 'approved']);
  const processed = expireStaleBundles(
    bundles.filter((bundle) => bundle.coopId === trustedNodeContext.coop.profile.id),
  );
  for (const bundle of processed) {
    if (bundle.status === 'expired') {
      await saveActionBundle(db, bundle);
    }
  }
  return { ok: true, data: pendingBundles(processed) };
}

async function handleGetActionHistory(): Promise<RuntimeActionResponse<ActionLogEntry[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  const entries = (await listActionLogEntries(db, 50)).filter(
    (entry) => entry.coopId === trustedNodeContext.coop.profile.id,
  );
  return { ok: true, data: entries };
}

type PreparedDelegatedExecution =
  | {
      ok: true;
      normalizedPayload: Record<string, unknown>;
      targetIds: string[];
      execute(): Promise<RuntimeActionResponse>;
    }
  | {
      ok: false;
      error: string;
    };

async function prepareDelegatedExecution(
  message: Extract<RuntimeRequest, { type: 'execute-with-grant' }>,
  authSession: Awaited<ReturnType<typeof getAuthSession>>,
): Promise<PreparedDelegatedExecution> {
  const scopedAction = resolveDelegatedActionExecution({
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    actionPayload: message.payload.actionPayload,
  });
  if (!scopedAction.ok) {
    return { ok: false, error: scopedAction.reason };
  }

  switch (message.payload.actionClass) {
    case 'archive-artifact': {
      const coopId = scopedAction.normalizedPayload.coopId as string;
      const artifactId = scopedAction.normalizedPayload.artifactId as string;
      const coops = await getCoops();
      const coop = coops.find((item) => item.profile.id === coopId);
      if (!coop) {
        return { ok: false, error: 'Coop not found.' };
      }
      if (!coop.artifacts.some((artifact) => artifact.id === artifactId)) {
        return { ok: false, error: 'Artifact not found.' };
      }
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () =>
          handleArchiveArtifact({
            type: 'archive-artifact',
            payload: { coopId, artifactId },
          }),
      };
    }
    case 'archive-snapshot': {
      const coopId = scopedAction.normalizedPayload.coopId as string;
      const coops = await getCoops();
      if (!coops.some((item) => item.profile.id === coopId)) {
        return { ok: false, error: 'Coop not found.' };
      }
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () =>
          handleArchiveSnapshot({
            type: 'archive-snapshot',
            payload: { coopId },
          }),
      };
    }
    case 'refresh-archive-status': {
      const coopId = scopedAction.normalizedPayload.coopId as string;
      const receiptId = scopedAction.normalizedPayload.receiptId as string | undefined;
      const coops = await getCoops();
      const coop = coops.find((item) => item.profile.id === coopId);
      if (!coop) {
        return { ok: false, error: 'Coop not found.' };
      }
      if (receiptId && !coop.archiveReceipts.some((receipt) => receipt.id === receiptId)) {
        return { ok: false, error: 'Archive receipt not found.' };
      }
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () =>
          handleRefreshArchiveStatus({
            type: 'refresh-archive-status',
            payload: { coopId, receiptId },
          }),
      };
    }
    case 'publish-ready-draft': {
      const draftId = scopedAction.normalizedPayload.draftId as string;
      const targetCoopIds = scopedAction.normalizedPayload.targetCoopIds as string[];
      const draft = await getReviewDraft(db, draftId);
      if (!draft) {
        return { ok: false, error: 'Draft not found.' };
      }

      const coops = await getCoops();
      const scopedCoop = coops.find((item) => item.profile.id === message.payload.coopId);
      const scopedMember = scopedCoop
        ? findAuthenticatedCoopMember(scopedCoop, authSession)
        : undefined;
      const validation = validateReviewDraftPublish({
        persistedDraft: draft,
        incomingDraft: draft,
        targetCoopIds,
        states: coops,
        authSession,
        activeCoopId: scopedCoop?.profile.id,
        activeMemberId: scopedMember?.id,
      });
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () =>
          publishDraftWithContext({
            draft,
            targetCoopIds,
            authSession,
            activeCoopId: scopedCoop?.profile.id,
            activeMemberId: scopedMember?.id,
          }),
      };
    }
  }
}

async function reserveGrantExecution(input: {
  grantId: string;
  actionClass: DelegatedActionClass;
  coopId: string;
  replayId: string;
  targetIds: string[];
  executor: Pick<ExecutionGrant['executor'], 'label' | 'localIdentityId'>;
}) {
  return db.transaction('rw', db.executionGrants, db.replayIds, async () => {
    const grant = await getExecutionGrant(db, input.grantId);
    if (!grant) {
      return {
        ok: false as const,
        error: 'Grant not found.',
      };
    }

    const refreshed = refreshGrantStatus(grant);
    if (refreshed.status !== grant.status) {
      await saveExecutionGrant(db, refreshed);
    }

    const replayExists = (await db.replayIds.get(input.replayId)) !== undefined;
    const validation = validateGrantForExecution({
      grant: refreshed,
      actionClass: input.actionClass,
      coopId: input.coopId,
      replayId: input.replayId,
      replayGuard: createReplayGuard(replayExists ? [input.replayId] : []),
      targetIds: input.targetIds,
      executor: input.executor,
    });
    if (!validation.ok) {
      return {
        ok: false as const,
        grant: refreshed,
        validation,
      };
    }

    const reservedGrant = incrementGrantUsage(refreshed);
    await saveExecutionGrant(db, reservedGrant);
    await recordReplayId(db, input.replayId, reservedGrant.id, nowIso());

    return {
      ok: true as const,
      grant: reservedGrant,
    };
  });
}

async function handleIssueGrant(
  message: Extract<RuntimeRequest, { type: 'issue-grant' }>,
): Promise<RuntimeActionResponse<ExecutionGrant>> {
  const authSession = await getAuthSession(db);
  if (!authSession) {
    return { ok: false, error: 'Authentication required to issue grants.' };
  }

  const creatorResolution = await requireCreatorGrantManager(
    message.payload.coopId,
    authSession,
    'Only coop creators can issue execution grants.',
  );
  if (!creatorResolution.ok) {
    return { ok: false, error: creatorResolution.error };
  }

  const executor = createRuntimeGrantExecutor(authSession);
  if (!executor.localIdentityId) {
    return {
      ok: false,
      error: 'A passkey member session is required to issue execution grants.',
    };
  }

  const grant = createExecutionGrant({
    coopId: message.payload.coopId,
    issuedBy: {
      memberId: creatorResolution.member.id,
      displayName: creatorResolution.member.displayName,
      address: authSession.primaryAddress,
    },
    executor,
    expiresAt: message.payload.expiresAt,
    maxUses: message.payload.maxUses,
    allowedActions: message.payload.allowedActions,
    targetAllowlist: message.payload.targetAllowlist,
  });

  await saveExecutionGrant(db, grant);

  const logEntry = createGrantLogEntry({
    grantId: grant.id,
    eventType: 'grant-issued',
    detail: `Grant issued for ${grant.allowedActions.join(', ')} (max ${grant.maxUses} uses, expires ${grant.expiresAt}).`,
    coopId: grant.coopId,
  });
  await saveGrantLogEntry(db, logEntry);

  return { ok: true, data: grant };
}

async function handleRevokeGrant(
  message: Extract<RuntimeRequest, { type: 'revoke-grant' }>,
): Promise<RuntimeActionResponse<ExecutionGrant>> {
  const grant = await getExecutionGrant(db, message.payload.grantId);
  if (!grant) {
    return { ok: false, error: 'Grant not found.' };
  }

  const authSession = await getAuthSession(db);
  if (!authSession) {
    return { ok: false, error: 'Authentication required to revoke grants.' };
  }

  const creatorResolution = await requireCreatorGrantManager(
    grant.coopId,
    authSession,
    'Only coop creators can revoke execution grants.',
  );
  if (!creatorResolution.ok) {
    return { ok: false, error: creatorResolution.error };
  }

  const revoked = revokeGrant(grant);
  await saveExecutionGrant(db, revoked);

  const logEntry = createGrantLogEntry({
    grantId: revoked.id,
    eventType: 'grant-revoked',
    detail: `Grant ${revoked.id} revoked.`,
    coopId: revoked.coopId,
  });
  await saveGrantLogEntry(db, logEntry);

  return { ok: true, data: revoked };
}

async function handleExecuteWithGrant(
  message: Extract<RuntimeRequest, { type: 'execute-with-grant' }>,
): Promise<RuntimeActionResponse> {
  const authSession = await getAuthSession(db);
  if (!authSession) {
    return { ok: false, error: 'Authentication required for delegated execution.' };
  }

  const executor = createRuntimeGrantExecutor(authSession);
  if (!executor.localIdentityId) {
    return {
      ok: false,
      error: 'A passkey member session is required for delegated execution.',
    };
  }

  const prepared = await prepareDelegatedExecution(message, authSession);
  if (!prepared.ok) {
    return { ok: false, error: prepared.error };
  }

  const reservation = await reserveGrantExecution({
    grantId: message.payload.grantId,
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    replayId: message.payload.replayId,
    targetIds: prepared.targetIds,
    executor,
  });
  if (!reservation.ok) {
    if ('error' in reservation) {
      return { ok: false, error: reservation.error };
    }

    const logEventType =
      reservation.validation.rejectType === 'replay-rejected'
        ? ('delegated-replay-rejected' as const)
        : reservation.validation.rejectType === 'exhausted'
          ? ('delegated-exhausted-rejected' as const)
          : reservation.validation.rejectType === 'revoked'
            ? ('grant-revoked' as const)
            : reservation.validation.rejectType === 'expired'
              ? ('grant-expired' as const)
              : ('delegated-execution-failed' as const);
    await saveGrantLogEntry(
      db,
      createGrantLogEntry({
        grantId: reservation.grant.id,
        eventType: logEventType,
        detail: reservation.validation.reason,
        actionClass: message.payload.actionClass,
        coopId: message.payload.coopId,
        replayId: message.payload.replayId,
      }),
    );
    return { ok: false, error: reservation.validation.reason };
  }

  await saveGrantLogEntry(
    db,
    createGrantLogEntry({
      grantId: reservation.grant.id,
      eventType: 'delegated-execution-attempted',
      detail: `Attempting delegated ${message.payload.actionClass} on coop ${message.payload.coopId}.`,
      actionClass: message.payload.actionClass,
      coopId: message.payload.coopId,
      replayId: message.payload.replayId,
    }),
  );

  let result: RuntimeActionResponse;
  try {
    result = await prepared.execute();
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : 'Delegated execution failed unexpectedly.',
    };
  }

  if (result.ok) {
    await saveGrantLogEntry(
      db,
      createGrantLogEntry({
        grantId: reservation.grant.id,
        eventType: 'delegated-execution-succeeded',
        detail: `Delegated ${message.payload.actionClass} succeeded.`,
        actionClass: message.payload.actionClass,
        coopId: message.payload.coopId,
        replayId: message.payload.replayId,
      }),
    );
  } else {
    await saveGrantLogEntry(
      db,
      createGrantLogEntry({
        grantId: reservation.grant.id,
        eventType: 'delegated-execution-failed',
        detail: result.error ?? 'Delegated execution failed.',
        actionClass: message.payload.actionClass,
        coopId: message.payload.coopId,
        replayId: message.payload.replayId,
      }),
    );
  }

  return result;
}

async function handleGetGrants(): Promise<RuntimeActionResponse<ExecutionGrant[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  return {
    ok: true,
    data: (await refreshStoredGrantStatuses()).filter(
      (grant) => grant.coopId === trustedNodeContext.coop.profile.id,
    ),
  };
}

async function handleGetGrantLog(): Promise<RuntimeActionResponse<GrantLogEntry[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  const entries = (await listGrantLogEntries(db)).filter(
    (entry) => entry.coopId === trustedNodeContext.coop.profile.id,
  );
  return { ok: true, data: entries };
}

async function handleIssueSessionCapability(
  message: Extract<RuntimeRequest, { type: 'issue-session-capability' }>,
): Promise<RuntimeActionResponse<SessionCapability>> {
  const authSession = await getAuthSession(db);
  if (!authSession) {
    return { ok: false, error: 'Authentication required to issue session keys.' };
  }

  const creatorResolution = await requireCreatorGrantManager(
    message.payload.coopId,
    authSession,
    'Only coop creators can issue session keys.',
  );
  if (!creatorResolution.ok) {
    return { ok: false, error: creatorResolution.error };
  }

  const executor = createRuntimeGrantExecutor(authSession);
  if (!executor.localIdentityId) {
    return {
      ok: false,
      error: 'A passkey member session is required to issue a session key.',
    };
  }

  if (!creatorResolution.coop.greenGoods?.enabled) {
    return {
      ok: false,
      error: 'Green Goods must be enabled for this coop before issuing a session key.',
    };
  }

  let targetAllowlist: Record<string, string[]>;
  try {
    targetAllowlist = resolveSessionTargetAllowlist({
      coop: creatorResolution.coop,
      allowedActions: message.payload.allowedActions,
      overrides: message.payload.targetAllowlist,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Session target allowlist is invalid.',
    };
  }

  const signerMaterial = createSessionSignerMaterial();
  let capability = createSessionCapability({
    coopId: creatorResolution.coop.profile.id,
    issuedBy: {
      memberId: creatorResolution.member.id,
      displayName: creatorResolution.member.displayName,
      address: authSession.primaryAddress,
    },
    executor,
    scope: {
      allowedActions: message.payload.allowedActions,
      targetAllowlist,
      maxUses: message.payload.maxUses,
      expiresAt: message.payload.expiresAt,
      chainKey: creatorResolution.coop.onchainState.chainKey,
      safeAddress: creatorResolution.coop.onchainState.safeAddress,
    },
    sessionAddress: signerMaterial.sessionAddress,
    validatorAddress: signerMaterial.validatorAddress,
    validatorInitData: signerMaterial.validatorInitData,
    statusDetail:
      configuredSessionMode === 'live'
        ? 'Session key issued locally. Enabling on the coop Safe.'
        : configuredSessionMode === 'mock'
          ? 'Mock session key issued locally for bounded Green Goods demo flows.'
          : 'Session key issued locally. Live execution stays off until session mode is enabled.',
  });
  capability = {
    ...capability,
    permissionId: buildSmartSession({ capability }).permissionId,
  };

  const wrappingSecret = await requireSessionWrappingSecret();
  const material = await encryptSessionPrivateKey({
    capabilityId: capability.id,
    sessionAddress: capability.sessionAddress as Address,
    privateKey: signerMaterial.privateKey,
    wrappingSecret,
  });

  await saveSessionCapability(db, capability);
  await saveEncryptedSessionMaterial(db, material);
  await saveSessionCapabilityLogEntry(
    db,
    createSessionCapabilityLogEntry({
      capabilityId: capability.id,
      coopId: capability.coopId,
      eventType: 'session-issued',
      detail: `Issued session key for ${capability.scope.allowedActions.join(', ')}.`,
    }),
  );

  if (configuredSessionMode === 'live') {
    try {
      const ready = await ensureSessionCapabilityReadyLive({
        capability,
        authSession,
        onchainState: creatorResolution.coop.onchainState,
      });
      capability = ready.capability;
      await saveSessionCapability(db, capability);
      await saveSessionCapabilityLogEntry(
        db,
        createSessionCapabilityLogEntry({
          capabilityId: capability.id,
          coopId: capability.coopId,
          eventType: 'session-module-installed',
          detail: 'Smart Sessions validator was installed and enabled on the coop Safe.',
        }),
      );
    } catch (error) {
      capability = {
        ...capability,
        updatedAt: nowIso(),
        status: 'unusable',
        lastValidationFailure: 'module-unavailable',
        statusDetail:
          error instanceof Error
            ? error.message
            : 'Smart Sessions could not be installed on the coop Safe.',
      };
      await saveSessionCapability(db, capability);
      await saveSessionCapabilityLogEntry(
        db,
        createSessionCapabilityLogEntry({
          capabilityId: capability.id,
          coopId: capability.coopId,
          eventType: 'session-module-install-failed',
          detail: capability.statusDetail,
          reason: 'module-unavailable',
        }),
      );
      return {
        ok: false,
        error: capability.statusDetail,
      };
    }
  }

  return { ok: true, data: capability };
}

async function handleRotateSessionCapability(
  message: Extract<RuntimeRequest, { type: 'rotate-session-capability' }>,
): Promise<RuntimeActionResponse<SessionCapability>> {
  const capability = await getSessionCapability(db, message.payload.capabilityId);
  if (!capability) {
    return { ok: false, error: 'Session key not found.' };
  }

  const authSession = await getAuthSession(db);
  if (!authSession) {
    return { ok: false, error: 'Authentication required to rotate session keys.' };
  }

  const creatorResolution = await requireCreatorGrantManager(
    capability.coopId,
    authSession,
    'Only coop creators can rotate session keys.',
  );
  if (!creatorResolution.ok) {
    return { ok: false, error: creatorResolution.error };
  }

  if (configuredSessionMode === 'live') {
    await revokeSessionCapabilityLive({
      capability,
      authSession,
      onchainState: creatorResolution.coop.onchainState,
    });
  }

  const signerMaterial = createSessionSignerMaterial();
  let rotated = rotateSessionCapability({
    capability,
    sessionAddress: signerMaterial.sessionAddress,
    validatorAddress: signerMaterial.validatorAddress,
    validatorInitData: signerMaterial.validatorInitData,
  });
  rotated = {
    ...rotated,
    permissionId: buildSmartSession({ capability: rotated }).permissionId,
  };

  const wrappingSecret = await requireSessionWrappingSecret();
  const material = await encryptSessionPrivateKey({
    capabilityId: rotated.id,
    sessionAddress: rotated.sessionAddress as Address,
    privateKey: signerMaterial.privateKey,
    wrappingSecret,
  });

  await saveSessionCapability(db, rotated);
  await saveEncryptedSessionMaterial(db, material);
  await saveSessionCapabilityLogEntry(
    db,
    createSessionCapabilityLogEntry({
      capabilityId: rotated.id,
      coopId: rotated.coopId,
      eventType: 'session-rotated',
      detail: 'Session key rotated locally.',
    }),
  );

  if (configuredSessionMode === 'live') {
    try {
      const ready = await ensureSessionCapabilityReadyLive({
        capability: rotated,
        authSession,
        onchainState: creatorResolution.coop.onchainState,
      });
      rotated = ready.capability;
      await saveSessionCapability(db, rotated);
    } catch (error) {
      rotated = {
        ...rotated,
        updatedAt: nowIso(),
        status: 'unusable',
        lastValidationFailure: 'module-unavailable',
        statusDetail:
          error instanceof Error
            ? error.message
            : 'Rotated session key could not be enabled on the coop Safe.',
      };
      await saveSessionCapability(db, rotated);
      return {
        ok: false,
        error: rotated.statusDetail,
      };
    }
  }

  return { ok: true, data: rotated };
}

async function handleRevokeSessionCapability(
  message: Extract<RuntimeRequest, { type: 'revoke-session-capability' }>,
): Promise<RuntimeActionResponse<SessionCapability>> {
  const capability = await getSessionCapability(db, message.payload.capabilityId);
  if (!capability) {
    return { ok: false, error: 'Session key not found.' };
  }

  const authSession = await getAuthSession(db);
  if (!authSession) {
    return { ok: false, error: 'Authentication required to revoke session keys.' };
  }

  const creatorResolution = await requireCreatorGrantManager(
    capability.coopId,
    authSession,
    'Only coop creators can revoke session keys.',
  );
  if (!creatorResolution.ok) {
    return { ok: false, error: creatorResolution.error };
  }

  if (configuredSessionMode === 'live') {
    try {
      await revokeSessionCapabilityLive({
        capability,
        authSession,
        onchainState: creatorResolution.coop.onchainState,
      });
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Session key could not be removed from the coop Safe.',
      };
    }
  }

  const revoked = revokeSessionCapability(capability);
  await saveSessionCapability(db, revoked);
  await saveSessionCapabilityLogEntry(
    db,
    createSessionCapabilityLogEntry({
      capabilityId: revoked.id,
      coopId: revoked.coopId,
      eventType: 'session-revoked',
      detail: 'Session key revoked.',
      reason: 'revoked',
    }),
  );
  return { ok: true, data: revoked };
}

async function handleGetSessionCapabilities(): Promise<RuntimeActionResponse<SessionCapability[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  return {
    ok: true,
    data: (await refreshStoredSessionCapabilityStatuses()).filter(
      (capability) => capability.coopId === trustedNodeContext.coop.profile.id,
    ),
  };
}

async function handleGetSessionCapabilityLog(): Promise<
  RuntimeActionResponse<SessionCapabilityLogEntry[]>
> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  return {
    ok: true,
    data: (await listSessionCapabilityLogEntries(db)).filter(
      (entry) => entry.coopId === trustedNodeContext.coop.profile.id,
    ),
  };
}

chrome.contextMenus.onClicked.addListener((info) => {
  void (async () => {
    await ensureDefaults();
    switch (info.menuItemId) {
      case contextMenuIds.open:
        await openCoopSidepanel();
        break;
      case contextMenuIds.roundUp:
        await captureActiveTab();
        break;
      case contextMenuIds.screenshot:
        await captureVisibleScreenshot();
        break;
    }
  })();
});

chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    await ensureDefaults();
    switch (command) {
      case 'open-sidepanel':
        await openCoopSidepanel();
        break;
      case 'round-up-tab':
        await captureActiveTab();
        break;
      case 'capture-screenshot':
        await captureVisibleScreenshot();
        break;
    }
  })();
});

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await registerContextMenus();
  await syncCaptureAlarm(await getLocalSetting(stateKeys.captureMode, 'manual'));
  await ensureReceiverSyncOffscreenDocument();
  await syncAgentObservations();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await refreshBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await registerContextMenus();
  await syncCaptureAlarm(await getLocalSetting(stateKeys.captureMode, 'manual'));
  await ensureReceiverSyncOffscreenDocument();
  await syncAgentObservations();
  await refreshBadge();
});

chrome.alarms.onAlarm.addListener(async () => {
  const captureMode = await getLocalSetting(stateKeys.captureMode, 'manual');
  if (captureMode !== 'manual') {
    await runCaptureCycle();
  }
  await syncAgentObservations();
});

chrome.runtime.onMessage.addListener((message: RuntimeRequest, sender, sendResponse) => {
  void (async () => {
    await ensureDefaults();

    const isExtensionContext = !sender.tab && sender.id === chrome.runtime.id;
    const isAllowedBridgeMessage = message.type === 'ingest-receiver-capture';

    if (!isExtensionContext && !isAllowedBridgeMessage) {
      sendResponse({
        ok: false,
        error: 'Unauthorized sender.',
      } satisfies RuntimeActionResponse);
      return;
    }

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
      case 'capture-active-tab':
        sendResponse({
          ok: true,
          data: await captureActiveTab(),
        } satisfies RuntimeActionResponse<number>);
        return;
      case 'capture-visible-screenshot':
        try {
          sendResponse({
            ok: true,
            data: await captureVisibleScreenshot(),
          } satisfies RuntimeActionResponse<ReceiverCapture>);
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : 'Screenshot capture failed.',
          } satisfies RuntimeActionResponse);
        }
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
      case 'get-ui-preferences':
        sendResponse({
          ok: true,
          data: await hydrateUiPreferences(),
        } satisfies RuntimeActionResponse<UiPreferences>);
        return;
      case 'set-ui-preferences':
        sendResponse({
          ok: true,
          data: await saveResolvedUiPreferences(message.payload),
        } satisfies RuntimeActionResponse<UiPreferences>);
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
      case 'persist-coop-state': {
        const parsed = coopSharedStateSchema.safeParse(message.payload.state);
        if (!parsed.success) {
          console.warn('persist-coop-state validation failed:', parsed.error.issues);
          sendResponse({ ok: false, error: 'Invalid coop state' } satisfies RuntimeActionResponse);
          return;
        }
        await saveState(parsed.data);
        await refreshBadge();
        sendResponse({ ok: true } satisfies RuntimeActionResponse);
        return;
      }
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
      case 'set-local-inference-opt-in':
        sendResponse({
          ok: true,
          data: await saveResolvedUiPreferences({
            ...uiPreferences,
            localInferenceOptIn: message.payload.enabled,
          }),
        });
        return;
      case 'queue-green-goods-work-approval':
        sendResponse(await handleQueueGreenGoodsWorkApproval(message));
        return;
      case 'queue-green-goods-assessment':
        sendResponse(await handleQueueGreenGoodsAssessment(message));
        return;
      case 'queue-green-goods-gap-admin-sync':
        sendResponse(await handleQueueGreenGoodsGapAdminSync(message));
        return;
      case 'get-agent-dashboard':
        sendResponse(await handleGetAgentDashboard());
        return;
      case 'run-agent-cycle':
        sendResponse(await handleRunAgentCycle());
        return;
      case 'approve-agent-plan':
        sendResponse(await handleApproveAgentPlan(message));
        return;
      case 'reject-agent-plan':
        sendResponse(await handleRejectAgentPlan(message));
        return;
      case 'retry-skill-run':
        sendResponse(await handleRetrySkillRun(message));
        return;
      case 'list-skill-manifests':
        sendResponse(await handleListSkillManifests());
        return;
      case 'set-agent-skill-auto-run':
        sendResponse(await handleSetAgentSkillAutoRun(message));
        return;
      case 'get-action-policies':
        sendResponse(await handleGetActionPolicies());
        return;
      case 'set-action-policy':
        sendResponse(await handleSetActionPolicy(message));
        return;
      case 'propose-action':
        sendResponse(await handleProposeAction(message));
        return;
      case 'approve-action':
        sendResponse(await handleApproveAction(message));
        return;
      case 'reject-action':
        sendResponse(await handleRejectAction(message));
        return;
      case 'execute-action':
        sendResponse(await handleExecuteAction(message));
        return;
      case 'get-action-queue':
        sendResponse(await handleGetActionQueue());
        return;
      case 'get-action-history':
        sendResponse(await handleGetActionHistory());
        return;
      case 'issue-grant':
        sendResponse(await handleIssueGrant(message));
        return;
      case 'revoke-grant':
        sendResponse(await handleRevokeGrant(message));
        return;
      case 'execute-with-grant':
        sendResponse(await handleExecuteWithGrant(message));
        return;
      case 'get-grants':
        sendResponse(await handleGetGrants());
        return;
      case 'get-grant-log':
        sendResponse(await handleGetGrantLog());
        return;
      case 'issue-session-capability':
        sendResponse(await handleIssueSessionCapability(message));
        return;
      case 'rotate-session-capability':
        sendResponse(await handleRotateSessionCapability(message));
        return;
      case 'revoke-session-capability':
        sendResponse(await handleRevokeSessionCapability(message));
        return;
      case 'get-session-capabilities':
        sendResponse(await handleGetSessionCapabilities());
        return;
      case 'get-session-capability-log':
        sendResponse(await handleGetSessionCapabilityLog());
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
