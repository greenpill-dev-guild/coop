/**
 * Barrel re-export for all background context modules.
 *
 * Existing importers that use `from './context'` (or `from '../context'` etc.)
 * continue to work unchanged. Each domain-scoped file can also be imported
 * directly for tighter dependency graphs.
 *
 * Domain files:
 *   context-db.ts       — Database instance, Dexie helpers, persistence, state keys & alarm names
 *   context-config.ts   — Environment-resolved configuration constants
 *   context-ui.ts       — UI preferences, notifications, sidepanel intent & state
 *   context-receiver.ts — Offscreen document, receiver sync, permission origins
 *   context-runtime.ts  — Runtime health, archive config, initialization, alarms, capture dedup, tab cache, local enhancement
 */

export {
  db,
  ensureDbReady,
  setLocalSetting,
  getLocalSetting,
  getCoops,
  saveState,
  updateCoopGreenGoodsState,
  stateKeys,
  alarmNames,
} from './context-db';

export {
  configuredArchiveMode,
  configuredChain,
  configuredOnchainMode,
  configuredSessionMode,
  configuredProviderMode,
  configuredPrivacyMode,
  configuredSignalingUrls,
  configuredWebsocketSyncUrl,
  configuredPimlicoApiKey,
  configuredGreenGoodsWorkSchemaUid,
  configuredReceiverAppUrl,
  configuredFvmChain,
  configuredFvmRegistryAddress,
  configuredFvmOperatorKey,
  prefersLocalEnhancement,
  trustedNodeArchiveBootstrap,
  trustedNodeArchiveConfigMissingError,
} from './context-config';

export {
  localInferenceOptIn,
  uiPreferences,
  uiPreferenceStorageKey,
  extensionCaptureDeviceId,
  contextMenuIds,
  readSyncedUiPreferences,
  writeSyncedUiPreferences,
  hydrateUiPreferences,
  saveResolvedUiPreferences,
  getNotificationRegistry,
  getNotificationIntentRegistry,
  agentOnboardingKey,
  getAgentOnboardingState,
  setAgentOnboardingState,
  getPendingSidepanelIntent,
  setPendingSidepanelIntent,
  consumePendingSidepanelIntent,
  notifyExtensionEvent,
  consumeNotificationIntent,
  getSidepanelStateRegistry,
  isSidepanelOpen,
  setSidepanelWindowState,
} from './context-ui';

export type {
  NotificationRegistry,
  NotificationIntentRegistry,
  AgentOnboardingStatus,
  AgentOnboardingState,
  SidepanelStateRegistry,
} from './context-ui';

export {
  ensureCoopSyncOffscreenDocument,
  hasReceiverSyncOffscreenDocument,
  ensureReceiverSyncOffscreenDocument,
  getCoopSyncConfig,
  getCoopSyncRuntime,
  getReceiverSyncRuntime,
  reportCoopSyncRuntime,
  reportReceiverSyncRuntime,
} from './context-receiver';

export {
  defaultRuntimeHealth,
  getRuntimeHealth,
  setRuntimeHealth,
  ensureTrustedNodeArchiveBootstrap,
  getResolvedTrustedNodeArchiveConfig,
  requireTrustedNodeArchiveConfig,
  resolveArchiveConfigForCoop,
  ensureDefaults,
  syncAgentCadenceAlarm,
  getCapturePeriodMinutes,
  syncCaptureAlarm,
  markUrlCaptured,
  wasRecentlyCaptured,
  tabUrlCache,
  updateTabCache,
  removeFromTabCache,
  warmTabCache,
  localEnhancementAvailability,
} from './context-runtime';

export type { RuntimeHealth, TabCacheEntry } from './context-runtime';
