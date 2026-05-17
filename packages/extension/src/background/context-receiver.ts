import {
  ensureSyncRoomSecretRecord,
  fetchServerMintedIceConfig,
  hydrateSyncRoomWithSecret,
  isRedactedSyncRoomSecret,
  redactSyncRoomSecrets,
} from '@coop/shared';
import type { CoopSyncRuntimeStatus, ReceiverSyncRuntimeStatus } from '../runtime/messages';
import { configuredReceiverAppUrl, configuredWebsocketSyncUrl } from './context-config';
import { db, getCoops, getLocalSetting, saveState, setLocalSetting, stateKeys } from './context-db';

// ---- Receiver Permission Origins ----

const LOCAL_RECEIVER_PERMISSION_ORIGINS = ['http://127.0.0.1/*', 'http://localhost/*'] as const;

function isLocalReceiverHostname(hostname: string) {
  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

export function getRequiredReceiverPermissionOrigins(receiverAppUrl = configuredReceiverAppUrl) {
  try {
    const url = new URL(receiverAppUrl);
    const exactOriginMatch = `${url.origin}/*`;

    if (isLocalReceiverHostname(url.hostname)) {
      return [...new Set([...LOCAL_RECEIVER_PERMISSION_ORIGINS, exactOriginMatch])].sort();
    }

    return [exactOriginMatch];
  } catch {
    return [...LOCAL_RECEIVER_PERMISSION_ORIGINS];
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
        justification: 'Keep receiver and coop sync alive while the sidepanel is closed.',
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

export const ensureCoopSyncOffscreenDocument = ensureReceiverSyncOffscreenDocument;

// ---- Receiver Sync Runtime ----

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

// ---- Coop Sync Runtime ----

export async function getCoopSyncRuntime() {
  return getLocalSetting<CoopSyncRuntimeStatus>(stateKeys.coopSyncRuntime, {
    activeCoopIds: [],
    activeBindingKeys: [],
    mode: 'none',
  });
}

export async function reportCoopSyncRuntime(patch: Partial<CoopSyncRuntimeStatus>) {
  const current = await getCoopSyncRuntime();
  const next = {
    ...current,
    ...patch,
    activeCoopIds: patch.activeCoopIds ?? current.activeCoopIds,
    activeBindingKeys: patch.activeBindingKeys ?? current.activeBindingKeys,
  } satisfies CoopSyncRuntimeStatus;
  await setLocalSetting(stateKeys.coopSyncRuntime, next);
  return next;
}

export async function getCoopSyncConfig() {
  const [coops, iceConfig] = await Promise.all([
    getCoops(),
    fetchServerMintedIceConfig({ websocketSyncUrl: configuredWebsocketSyncUrl }),
  ]);

  const entries = [];
  for (const coop of coops) {
    const secretRecord = await ensureSyncRoomSecretRecord(db, coop.syncRoom);
    const hydratedRoom = hydrateSyncRoomWithSecret(coop.syncRoom, secretRecord);
    if (
      secretRecord &&
      (!isRedactedSyncRoomSecret(coop.syncRoom.roomSecret) ||
        !isRedactedSyncRoomSecret(coop.syncRoom.inviteSigningSecret))
    ) {
      await saveState({
        ...coop,
        syncRoom: redactSyncRoomSecrets(coop.syncRoom),
      });
    }
    entries.push({
      coop: hydratedRoom ? { ...coop, syncRoom: hydratedRoom } : coop,
      roomSecretAvailable: Boolean(hydratedRoom),
      legacySecretMigrated: Boolean(secretRecord),
    });
  }

  return {
    coops: entries,
    websocketSyncUrl: configuredWebsocketSyncUrl,
    iceConfig,
  };
}
