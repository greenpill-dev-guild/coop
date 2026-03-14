import {
  type CoopSharedState,
  type GreenGoodsGardenState,
  type ReceiverCapture,
  type UiPreferences,
  createCoopDb,
  createId,
  createReceiverCapture,
  defaultSoundPreferences,
  detectLocalEnhancementAvailability,
  getAuthSession,
  getSoundPreferences,
  getUiPreferences,
  hydrateCoopDoc,
  readCoopState,
  saveCoopState,
  selectActiveReceiverPairingsForSync,
  setAuthSession,
  setSoundPreferences,
  setUiPreferences,
  uiPreferencesSchema,
} from '@coop/shared';
import { defaultSignalingUrls } from '@coop/signaling';
import {
  isLocalEnhancementEnabled,
  parseConfiguredSignalingUrls,
  resolveConfiguredArchiveMode,
  resolveConfiguredChain,
  resolveConfiguredOnchainMode,
  resolveConfiguredPrivacyMode,
  resolveConfiguredProviderMode,
  resolveConfiguredSessionMode,
  resolveReceiverAppUrl,
  resolveTrustedNodeArchiveBootstrapConfig,
} from '../runtime/config';
import type { ReceiverSyncRuntimeStatus } from '../runtime/messages';

// ---- Database ----

export const db = createCoopDb('coop-extension');

// ---- Types ----

export type RuntimeHealth = {
  offline: boolean;
  missingPermission: boolean;
  syncError: boolean;
  lastCaptureError?: string;
  lastSyncError?: string;
};

export type NotificationRegistry = Record<string, string>;

// ---- Constants ----

export const stateKeys = {
  activeCoopId: 'active-coop-id',
  captureMode: 'capture-mode',
  notificationRegistry: 'notification-registry',
  receiverSyncRuntime: 'receiver-sync-runtime',
  runtimeHealth: 'runtime-health',
  sessionWrappingSecret: 'session-wrapping-secret',
};

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
export const configuredPimlicoApiKey =
  typeof import.meta.env.VITE_PIMLICO_API_KEY === 'string' &&
  import.meta.env.VITE_PIMLICO_API_KEY.length > 0
    ? import.meta.env.VITE_PIMLICO_API_KEY
    : undefined;
export const configuredReceiverAppUrl = resolveReceiverAppUrl(
  import.meta.env.VITE_COOP_RECEIVER_APP_URL,
);
export const prefersLocalEnhancement = isLocalEnhancementEnabled(
  import.meta.env.VITE_COOP_LOCAL_ENHANCEMENT,
);
export const trustedNodeArchiveBootstrap = (() => {
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

// ---- Notification System ----

export async function getNotificationRegistry() {
  return getLocalSetting<NotificationRegistry>(stateKeys.notificationRegistry, {});
}

export async function notifyExtensionEvent(input: {
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

// ---- Archive Config Resolution ----

import {
  getCoopArchiveSecrets,
  getTrustedNodeArchiveConfig,
  mergeCoopArchiveConfig,
  setTrustedNodeArchiveConfig,
} from '@coop/shared';

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

export async function syncCaptureAlarm(captureMode: string) {
  await chrome.alarms.clear('coop-capture');
  if (captureMode === 'manual') {
    return;
  }
  await chrome.alarms.create('coop-capture', {
    periodInMinutes: captureMode === '30-min' ? 30 : 60,
  });
}

// ---- Local Enhancement ----

export function localEnhancementAvailability() {
  return detectLocalEnhancementAvailability({
    prefersLocalModels: prefersLocalEnhancement,
    hasWorkerRuntime: true,
    hasWebGpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
  });
}
