import {
  type CoopSharedState,
  type UiPreferences,
  defaultSoundPreferences,
  detectLocalEnhancementAvailability,
  getCoopArchiveSecrets,
  getSoundPreferences,
  getTrustedNodeArchiveConfig,
  mergeCoopArchiveConfig,
  setSoundPreferences,
  setTrustedNodeArchiveConfig,
} from '@coop/shared';
import {
  prefersLocalEnhancement,
  trustedNodeArchiveBootstrap,
  trustedNodeArchiveConfigMissingError,
} from './context-config';
import { alarmNames, db, getLocalSetting, setLocalSetting, stateKeys } from './context-db';
import { getRequiredReceiverPermissionOrigins } from './context-receiver';
import { hydrateUiPreferences } from './context-ui';

// Re-export so barrel consumers can still reach these from context-runtime
export { stateKeys, alarmNames } from './context-db';

let defaultsReady = false;
let defaultsReadyPromise: Promise<void> | null = null;

// ---- Types ----

export type RuntimeHealth = {
  offline: boolean;
  missingPermission: boolean;
  syncError: boolean;
  lastCaptureError?: string;
  lastSyncError?: string;
};

// ---- Constants ----

export const defaultRuntimeHealth: RuntimeHealth = {
  offline: false,
  missingPermission: false,
  syncError: false,
};

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
    origins: getRequiredReceiverPermissionOrigins(),
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
  if (defaultsReady) {
    return;
  }

  if (!defaultsReadyPromise) {
    defaultsReadyPromise = (async () => {
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
      defaultsReady = true;
    })().finally(() => {
      defaultsReadyPromise = null;
    });
  }

  await defaultsReadyPromise;
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
