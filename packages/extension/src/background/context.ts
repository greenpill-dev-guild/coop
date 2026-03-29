import {
  type CoopSharedState,
  type GreenGoodsGardenState,
  type ReceiverCapture,
  type UiPreferences,
  createCoopDb,
  createId,
  createReceiverCapture,
  defaultSignalingUrls,
  defaultSoundPreferences,
  detectLocalEnhancementAvailability,
  getAuthSession,
  getCoopArchiveSecrets,
  getSoundPreferences,
  getTrustedNodeArchiveConfig,
  getUiPreferences,
  hydrateCoopDoc,
  mergeCoopArchiveConfig,
  readCoopState,
  saveCoopState,
  selectActiveReceiverPairingsForSync,
  setAuthSession,
  setSoundPreferences,
  setTrustedNodeArchiveConfig,
  setUiPreferences,
  uiPreferencesSchema,
} from '@coop/shared';
import {
  isLocalEnhancementEnabled,
  parseConfiguredSignalingUrls,
  resolveConfiguredArchiveMode,
  resolveConfiguredChain,
  resolveConfiguredFvmChain,
  resolveConfiguredFvmOperatorKey,
  resolveConfiguredFvmRegistryAddress,
  resolveConfiguredOnchainMode,
  resolveConfiguredPrivacyMode,
  resolveConfiguredProviderMode,
  resolveConfiguredSessionMode,
  resolveReceiverAppUrl,
  resolveTrustedNodeArchiveBootstrapConfig,
} from '../runtime/config';
import type { ReceiverSyncRuntimeStatus, SidepanelIntent } from '../runtime/messages';

// ---- Database ----

export const db = createCoopDb('coop-extension');

let dbReadyPromise: Promise<void> | null = null;

function isPrimaryKeyUpgradeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'UpgradeError' &&
    /changing primary key|Not yet support for changing primary key/i.test(error.message)
  );
}

/**
 * Ensures the Dexie database is open and compatible with the current schema.
 * If the schema has changed in a way that breaks primary keys (common after
 * extension updates), the database is deleted and recreated automatically.
 */
export async function ensureDbReady(): Promise<void> {
  if (dbReadyPromise) {
    await dbReadyPromise;
    return;
  }

  dbReadyPromise = (async () => {
    try {
      if (!db.isOpen()) {
        await db.open();
      }
      return;
    } catch (error) {
      if (!isPrimaryKeyUpgradeError(error)) {
        throw error;
      }
    }

    console.warn(
      '[coop-extension] IndexedDB schema is incompatible with this build. Resetting local db.',
    );
    try {
      db.close();
    } catch {
      // already closed or never opened
    }
    await db.delete();
    await db.open();
  })().finally(() => {
    dbReadyPromise = null;
  });

  await dbReadyPromise;
}

// ---- Types ----

export type RuntimeHealth = {
  offline: boolean;
  missingPermission: boolean;
  syncError: boolean;
  lastCaptureError?: string;
  lastSyncError?: string;
};

export type SidepanelStateRegistry = Record<string, boolean>;

export type NotificationRegistry = Record<string, string>;
export type NotificationIntentRegistry = Record<string, SidepanelIntent>;
export type AgentOnboardingStatus = 'pending-followup' | 'steady';
export type AgentOnboardingState = Record<
  string,
  {
    status: AgentOnboardingStatus;
    triggeredAt: string;
    followUpAt?: string;
    completedAt?: string;
  }
>;

// ---- Constants ----

export const stateKeys = {
  activeCoopId: 'active-coop-id',
  agentOnboarding: 'agent-onboarding',
  captureMode: 'capture-mode',
  notificationIntentRegistry: 'notification-intent-registry',
  notificationRegistry: 'notification-registry',
  receiverSyncRuntime: 'receiver-sync-runtime',
  runtimeHealth: 'runtime-health',
  sidepanelIntent: 'sidepanel-intent',
  sidepanelState: 'sidepanel-state',
  sessionWrappingSecret: 'session-wrapping-secret',
};

export const alarmNames = {
  capture: 'coop-capture',
  agentCadence: 'agent-proactive-cycle',
  agentHeartbeat: 'agent-heartbeat',
  archiveStatusPoll: 'archive-status-poll',
  onboardingFollowUpPrefix: 'agent-onboarding-followup:',
} as const;

export const defaultRuntimeHealth: RuntimeHealth = {
  offline: false,
  missingPermission: false,
  syncError: false,
};

export const configuredArchiveMode = resolveConfiguredArchiveMode(
  import.meta.env.VITE_COOP_ARCHIVE_MODE,
);
export const configuredChain = resolveConfiguredChain(import.meta.env.VITE_COOP_CHAIN);
export const configuredOnchainMode = resolveConfiguredOnchainMode(
  import.meta.env.VITE_COOP_ONCHAIN_MODE,
  import.meta.env.VITE_PIMLICO_API_KEY,
);
export const configuredSessionMode = resolveConfiguredSessionMode(
  import.meta.env.VITE_COOP_SESSION_MODE,
);
export const configuredProviderMode = resolveConfiguredProviderMode(
  import.meta.env.VITE_COOP_PROVIDER_MODE,
);
export const configuredPrivacyMode = resolveConfiguredPrivacyMode(
  import.meta.env.VITE_COOP_PRIVACY_MODE,
);
export const configuredSignalingUrls =
  parseConfiguredSignalingUrls(import.meta.env.VITE_COOP_SIGNALING_URLS) ?? defaultSignalingUrls;
export const configuredWebsocketSyncUrl: string | undefined =
  typeof import.meta.env.VITE_COOP_WEBSOCKET_SYNC_URL === 'string' &&
  import.meta.env.VITE_COOP_WEBSOCKET_SYNC_URL.length > 0
    ? import.meta.env.VITE_COOP_WEBSOCKET_SYNC_URL
    : undefined;
export const configuredPimlicoApiKey =
  typeof import.meta.env.VITE_PIMLICO_API_KEY === 'string' &&
  import.meta.env.VITE_PIMLICO_API_KEY.length > 0
    ? import.meta.env.VITE_PIMLICO_API_KEY
    : undefined;
export const configuredGreenGoodsWorkSchemaUid =
  typeof import.meta.env.VITE_COOP_GREEN_GOODS_WORK_SCHEMA_UID === 'string' &&
  /^0x[a-fA-F0-9]{64}$/.test(import.meta.env.VITE_COOP_GREEN_GOODS_WORK_SCHEMA_UID)
    ? (import.meta.env.VITE_COOP_GREEN_GOODS_WORK_SCHEMA_UID as `0x${string}`)
    : undefined;
export const configuredReceiverAppUrl = resolveReceiverAppUrl(
  import.meta.env.VITE_COOP_RECEIVER_APP_URL,
);
export const configuredFvmChain = resolveConfiguredFvmChain(import.meta.env.VITE_COOP_FVM_CHAIN);
export const configuredFvmRegistryAddress = resolveConfiguredFvmRegistryAddress(
  import.meta.env.VITE_COOP_FVM_REGISTRY_ADDRESS,
);
export const configuredFvmOperatorKey = resolveConfiguredFvmOperatorKey(
  import.meta.env.VITE_COOP_FVM_OPERATOR_KEY,
);
export const prefersLocalEnhancement = isLocalEnhancementEnabled(
  import.meta.env.VITE_COOP_LOCAL_ENHANCEMENT,
);
export const trustedNodeArchiveBootstrap = (() => {
  try {
    return {
      config: resolveTrustedNodeArchiveBootstrapConfig(
        import.meta.env as Record<string, string | undefined>,
      ),
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
export const trustedNodeArchiveConfigMissingError =
  'Live Storacha archive mode is enabled, but this anchor node has no trusted-node archive delegation config.';

export let localInferenceOptIn = false;
export let uiPreferences = uiPreferencesSchema.parse({});

export const uiPreferenceStorageKey = 'coop:uiPreferences';
export const extensionCaptureDeviceId = 'extension-browser';
export const contextMenuIds = {
  open: 'coop-open',
  roundUp: 'coop-round-up-tab',
  screenshot: 'coop-capture-screenshot',
} as const;

// ---- Settings Helpers ----

export async function setLocalSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

export async function getLocalSetting<T>(key: string, fallback: T): Promise<T> {
  const record = await db.settings.get(key);
  return (record?.value as T | undefined) ?? fallback;
}

// ---- UI Preferences ----

export async function readSyncedUiPreferences(): Promise<UiPreferences | null> {
  try {
    const record = await chrome.storage.sync.get(uiPreferenceStorageKey);
    const raw = record[uiPreferenceStorageKey];
    return raw ? uiPreferencesSchema.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function writeSyncedUiPreferences(value: UiPreferences) {
  try {
    await chrome.storage.sync.set({
      [uiPreferenceStorageKey]: value,
    });
  } catch {
    // Ignore sync storage failures and fall back to local settings.
  }
}

export async function hydrateUiPreferences() {
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

export async function saveResolvedUiPreferences(value: UiPreferences) {
  const next = uiPreferencesSchema.parse(value);
  uiPreferences = next;
  localInferenceOptIn = next.localInferenceOptIn;
  await Promise.all([setUiPreferences(db, next), writeSyncedUiPreferences(next)]);
  return next;
}

// ---- Notification System ----

export async function getNotificationRegistry() {
  return getLocalSetting<NotificationRegistry>(stateKeys.notificationRegistry, {});
}

export async function getNotificationIntentRegistry() {
  return getLocalSetting<NotificationIntentRegistry>(stateKeys.notificationIntentRegistry, {});
}

export function agentOnboardingKey(coopId: string, memberId: string) {
  return `${coopId}:${memberId}`;
}

export async function getAgentOnboardingState() {
  return getLocalSetting<AgentOnboardingState>(stateKeys.agentOnboarding, {});
}

export async function setAgentOnboardingState(value: AgentOnboardingState) {
  await setLocalSetting(stateKeys.agentOnboarding, value);
}

export async function getPendingSidepanelIntent() {
  return getLocalSetting<SidepanelIntent | null>(stateKeys.sidepanelIntent, null);
}

export async function setPendingSidepanelIntent(value: SidepanelIntent | null) {
  await setLocalSetting(stateKeys.sidepanelIntent, value);
}

export async function consumePendingSidepanelIntent() {
  const current = await getPendingSidepanelIntent();
  if (current) {
    await setPendingSidepanelIntent(null);
  }
  return current;
}

export async function notifyExtensionEvent(input: {
  eventKind: string;
  entityId: string;
  state: string;
  title: string;
  message: string;
  intent?: SidepanelIntent;
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
    const notificationId = `coop-${createId('notification')}`;
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: input.title,
      message: input.message,
    });
    if (input.intent) {
      const registry = await getNotificationIntentRegistry();
      registry[notificationId] = input.intent;
      await setLocalSetting(stateKeys.notificationIntentRegistry, registry);
    }
  } catch {
    // Notifications are optional UX only.
  }
}

export async function consumeNotificationIntent(notificationId: string) {
  const registry = await getNotificationIntentRegistry();
  const intent = registry[notificationId];
  if (intent) {
    delete registry[notificationId];
    await setLocalSetting(stateKeys.notificationIntentRegistry, registry);
  }
  return intent;
}

// ---- Offscreen Document ----

let receiverSyncDocumentPromise: Promise<void> | null = null;

export async function hasReceiverSyncOffscreenDocument(
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

export async function ensureReceiverSyncOffscreenDocument() {
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

// ---- Basic Persistence ----

export async function getCoops() {
  const docs = await db.coopDocs.toArray();
  return docs.map((record) => readCoopState(hydrateCoopDoc(record.encodedState)));
}

export async function saveState(state: CoopSharedState) {
  await saveCoopState(db, state);
}

export async function updateCoopGreenGoodsState(input: {
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

// ---- Runtime Health ----

export async function getRuntimeHealth() {
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

export async function setRuntimeHealth(patch: Partial<RuntimeHealth>) {
  const current = await getRuntimeHealth();
  const next = {
    ...current,
    ...patch,
  } satisfies RuntimeHealth;
  await setLocalSetting(stateKeys.runtimeHealth, next);
  return next;
}

export async function getReceiverSyncRuntime() {
  return getLocalSetting<ReceiverSyncRuntimeStatus>(stateKeys.receiverSyncRuntime, {
    activePairingIds: [],
    activeBindingKeys: [],
    transport: 'none',
  });
}

export async function reportReceiverSyncRuntime(patch: Partial<ReceiverSyncRuntimeStatus>) {
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

export async function getSidepanelStateRegistry() {
  return getLocalSetting<SidepanelStateRegistry>(stateKeys.sidepanelState, {});
}

export async function isSidepanelOpen(windowId: number) {
  const registry = await getSidepanelStateRegistry();
  return registry[String(windowId)] === true;
}

export async function setSidepanelWindowState(windowId: number, open: boolean) {
  const registry = await getSidepanelStateRegistry();
  const next = {
    ...registry,
    [String(windowId)]: open,
  } satisfies SidepanelStateRegistry;
  await setLocalSetting(stateKeys.sidepanelState, next);
  return next;
}

// ---- Archive Config Resolution ----

export async function ensureTrustedNodeArchiveBootstrap() {
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

export async function getResolvedTrustedNodeArchiveConfig() {
  const existing = await getTrustedNodeArchiveConfig(db);
  if (existing) {
    return existing;
  }

  return ensureTrustedNodeArchiveBootstrap();
}

export async function requireTrustedNodeArchiveConfig() {
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

export async function resolveArchiveConfigForCoop(coopId: string, coop: CoopSharedState) {
  // 1. Check per-coop config first
  if (coop.archiveConfig) {
    const secrets = await getCoopArchiveSecrets(db, coopId);
    if (secrets) {
      return mergeCoopArchiveConfig(coop.archiveConfig, secrets);
    }
    // Has public config but no local secrets -- can't archive from this node
    return null;
  }

  // 2. Fall back to global config
  return getResolvedTrustedNodeArchiveConfig();
}

// ---- Initialization ----

export async function ensureDefaults() {
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

export async function syncAgentCadenceAlarm(
  agentCadenceMinutes: UiPreferences['agentCadenceMinutes'],
) {
  await chrome.alarms.clear(alarmNames.agentCadence);
  await chrome.alarms.create(alarmNames.agentCadence, {
    periodInMinutes: agentCadenceMinutes,
  });
}

const captureModePeriodMap: Record<string, number> = {
  '5-min': 5,
  '10-min': 10,
  '15-min': 15,
  '30-min': 30,
  '60-min': 60,
};

export function getCapturePeriodMinutes(captureMode: string): number | null {
  return captureModePeriodMap[captureMode] ?? null;
}

export async function syncCaptureAlarm(captureMode: string) {
  await chrome.alarms.clear(alarmNames.capture);
  const period = getCapturePeriodMinutes(captureMode);
  if (!period) {
    return;
  }
  await chrome.alarms.create(alarmNames.capture, {
    periodInMinutes: period,
  });
}

// ---- Recent Capture Dedup ----

const recentCaptureUrls = new Map<string, number>();
const DEDUP_PRUNE_THRESHOLD_MS = 60 * 60_000; // 1 hour
const DEDUP_MAX_ENTRIES = 2000;

export function markUrlCaptured(url: string) {
  recentCaptureUrls.set(url, Date.now());
}

function pruneRecentCaptureUrls() {
  const now = Date.now();
  for (const [key, ts] of recentCaptureUrls) {
    if (now - ts > DEDUP_PRUNE_THRESHOLD_MS) {
      recentCaptureUrls.delete(key);
    }
  }
  // Hard cap: evict oldest entries if still over limit
  if (recentCaptureUrls.size > DEDUP_MAX_ENTRIES) {
    const sorted = [...recentCaptureUrls.entries()].sort((a, b) => a[1] - b[1]);
    const toRemove = sorted.slice(0, recentCaptureUrls.size - DEDUP_MAX_ENTRIES);
    for (const [key] of toRemove) {
      recentCaptureUrls.delete(key);
    }
  }
}

export function wasRecentlyCaptured(url: string, cooldownMs: number): boolean {
  if (recentCaptureUrls.size > DEDUP_MAX_ENTRIES / 2) {
    pruneRecentCaptureUrls();
  }

  const lastCaptured = recentCaptureUrls.get(url);
  if (lastCaptured === undefined) {
    return false;
  }
  return Date.now() - lastCaptured < cooldownMs;
}

// ---- Tab URL Cache (for tab-close capture) ----

export type TabCacheEntry = {
  url: string;
  title: string;
  favIconUrl?: string;
  windowId: number;
};

export const tabUrlCache = new Map<number, TabCacheEntry>();

export function updateTabCache(
  tabId: number,
  tab: { url?: string; title?: string; favIconUrl?: string; windowId?: number },
) {
  if (!tab.url) {
    return;
  }
  tabUrlCache.set(tabId, {
    url: tab.url,
    title: tab.title ?? '',
    favIconUrl: tab.favIconUrl,
    windowId: tab.windowId ?? 0,
  });
}

export function removeFromTabCache(tabId: number) {
  tabUrlCache.delete(tabId);
}

export async function warmTabCache() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null && tab.url) {
      updateTabCache(tab.id, tab);
    }
  }
}

// ---- Local Enhancement ----

export function localEnhancementAvailability() {
  return detectLocalEnhancementAvailability({
    prefersLocalModels: prefersLocalEnhancement,
    hasWorkerRuntime: true,
    hasWebGpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
  });
}
