import {
  type UiPreferences,
  createId,
  getUiPreferences,
  setUiPreferences,
  uiPreferencesSchema,
} from '@coop/shared';
import type { SidepanelIntent } from '../runtime/messages';
import { db, getLocalSetting, setLocalSetting, stateKeys } from './context-db';

// ---- UI Preferences ----

export let localInferenceOptIn = false;
export let uiPreferences = uiPreferencesSchema.parse({});
let uiPreferenceOperation: Promise<unknown> = Promise.resolve();

export const uiPreferenceStorageKey = 'coop:uiPreferences';
export const extensionCaptureDeviceId = 'extension-browser';
export const contextMenuIds = {
  open: 'coop-open',
  roundUp: 'coop-round-up-tab',
  screenshot: 'coop-capture-screenshot',
} as const;

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

async function runUiPreferenceOperation<T>(operation: () => Promise<T>): Promise<T> {
  const previousOperation = uiPreferenceOperation;
  let releaseOperation: () => void = () => undefined;
  uiPreferenceOperation = new Promise<void>((resolve) => {
    releaseOperation = resolve;
  });

  await previousOperation.catch(() => undefined);

  try {
    return await operation();
  } finally {
    releaseOperation();
  }
}

export async function hydrateUiPreferences() {
  return runUiPreferenceOperation(async () => {
    const [localValue, syncedValue] = await Promise.all([
      getUiPreferences(db),
      readSyncedUiPreferences(),
    ]);
    const next = uiPreferencesSchema.parse(syncedValue ?? localValue ?? {});
    uiPreferences = next;
    localInferenceOptIn = next.localInferenceOptIn;
    await Promise.all([setUiPreferences(db, next), writeSyncedUiPreferences(next)]);
    return next;
  });
}

export async function saveResolvedUiPreferences(value: UiPreferences) {
  return runUiPreferenceOperation(async () => {
    const next = uiPreferencesSchema.parse(value);
    uiPreferences = next;
    localInferenceOptIn = next.localInferenceOptIn;
    await Promise.all([setUiPreferences(db, next), writeSyncedUiPreferences(next)]);
    return next;
  });
}

// ---- Notification System ----

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

// ---- Sidepanel State ----

export type SidepanelStateRegistry = Record<string, boolean>;

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
