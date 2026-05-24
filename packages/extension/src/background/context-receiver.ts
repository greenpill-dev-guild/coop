import {
  ensureSyncRoomSecretRecord,
  fetchServerMintedIceConfig,
  getAuthSession,
  hydrateSyncRoomWithSecret,
  isRedactedSyncRoomSecret,
  listAgentObservationsByStatus,
  listReceiverPairings,
  listRetiredSyncRoomSecretRecords,
  redactSyncRoomSecrets,
  selectActiveReceiverPairingsForSync,
  syncRoomSecretRecordToConfig,
} from '@coop/shared';
import type {
  AgentRuntimeDiagnostics,
  CoopSyncRuntimeStatus,
  ReceiverSyncRuntimeStatus,
} from '../runtime/messages';
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

async function hasActiveOffscreenWork() {
  const [pairings, coops, pendingObservations] = await Promise.all([
    listReceiverPairings(db),
    getCoops(),
    listAgentObservationsByStatus(db, ['pending']),
  ]);

  return {
    activeReceiverPairingCount: selectActiveReceiverPairingsForSync(pairings).length,
    syncableCoopCount: coops.length,
    pendingObservationCount: pendingObservations.length,
  };
}

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

export async function ensureSyncOffscreenDocumentForActiveWork() {
  const work = await hasActiveOffscreenWork();
  if (
    work.activeReceiverPairingCount === 0 &&
    work.syncableCoopCount === 0 &&
    work.pendingObservationCount === 0
  ) {
    await Promise.all([
      reportReceiverSyncRuntime({
        activePairingIds: [],
        activeBindingKeys: [],
        bindingCount: 0,
        providerCount: 0,
        timerCount: 0,
        transport: 'none',
        lastDisconnectReason: 'no-active-work',
      }),
      reportCoopSyncRuntime({
        activeCoopIds: [],
        activeBindingKeys: [],
        bindingCount: 0,
        providerCount: 0,
        timerCount: 0,
        mode: 'none',
        lastDisconnectReason: 'no-active-work',
      }),
    ]);
    return false;
  }

  await ensureReceiverSyncOffscreenDocument();
  return true;
}

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

export async function getAgentRuntimeDiagnostics() {
  const pendingObservationCount = await listAgentObservationsByStatus(db, ['pending']).then(
    (items) => items.length,
  );
  const current = await getLocalSetting<Partial<AgentRuntimeDiagnostics>>(
    stateKeys.agentRuntimeDiagnostics,
    {},
  );
  return {
    running: current.running ?? false,
    modelStatus: current.modelStatus ?? {
      transformers: {
        ready: false,
        initializing: false,
        model: 'onnx-community/Qwen2.5-0.5B-Instruct',
      },
      webllm: {
        ready: false,
        initialized: false,
        workerActive: false,
      },
      gemma4: {
        ready: false,
        initialized: false,
        iframeActive: false,
      },
    },
    ...current,
    pendingObservationCount,
  } satisfies AgentRuntimeDiagnostics;
}

export async function reportAgentRuntimeDiagnostics(patch: Partial<AgentRuntimeDiagnostics>) {
  const current = await getAgentRuntimeDiagnostics();
  const next = {
    ...current,
    ...patch,
    modelStatus: {
      ...current.modelStatus,
      ...patch.modelStatus,
      transformers: {
        ...current.modelStatus.transformers,
        ...patch.modelStatus?.transformers,
      },
      webllm: {
        ...current.modelStatus.webllm,
        ...patch.modelStatus?.webllm,
      },
      gemma4: {
        ...current.modelStatus.gemma4,
        ...patch.modelStatus?.gemma4,
      },
    },
  } satisfies AgentRuntimeDiagnostics;
  await setLocalSetting(stateKeys.agentRuntimeDiagnostics, next);
  return next;
}

export async function getCoopSyncConfig() {
  const [coops, iceConfig, authSession] = await Promise.all([
    getCoops(),
    fetchServerMintedIceConfig({ websocketSyncUrl: configuredWebsocketSyncUrl }),
    getAuthSession(db),
  ]);

  const entries = [];
  for (const coop of coops) {
    const secretRecord = await ensureSyncRoomSecretRecord(db, coop.syncRoom);
    const hydratedRoom = hydrateSyncRoomWithSecret(coop.syncRoom, secretRecord);
    const retiredRecords = await listRetiredSyncRoomSecretRecords(db, coop.profile.id);
    const retiredProviderSyncRooms = retiredRecords.map((record) =>
      syncRoomSecretRecordToConfig(record, coop.syncRoom.signalingUrls),
    );
    if (secretRecord && secretRecord.roomId !== coop.syncRoom.roomId) {
      retiredProviderSyncRooms.push(
        syncRoomSecretRecordToConfig(secretRecord, coop.syncRoom.signalingUrls),
      );
    }
    const dedupedRetiredRooms = [
      ...new Map(retiredProviderSyncRooms.map((room) => [room.roomId, room])).values(),
    ].filter((room) => room.roomId !== hydratedRoom?.roomId);
    const localMember = authSession
      ? coop.members.find(
          (member) =>
            member.address.toLowerCase() === authSession.primaryAddress.toLowerCase() ||
            (authSession.passkey?.id && member.passkeyCredentialId === authSession.passkey.id),
        )
      : undefined;
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
    const publicCoop = {
      ...coop,
      syncRoom: redactSyncRoomSecrets(hydratedRoom ?? coop.syncRoom),
    };
    entries.push({
      coop: publicCoop,
      providerSyncRoom: hydratedRoom ?? undefined,
      retiredProviderSyncRooms: dedupedRetiredRooms,
      roomSecretAvailable: Boolean(hydratedRoom),
      legacySecretMigrated: Boolean(secretRecord),
      roomEpoch: secretRecord?.roomEpoch,
      localMemberId: localMember?.id,
      localMemberDisplayName: localMember?.displayName,
    });
  }

  return {
    coops: entries,
    websocketSyncUrl: configuredWebsocketSyncUrl,
    iceConfig,
  };
}
