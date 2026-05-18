import {
  ORIGIN_LOCAL,
  assertInviteHandoffPayloadMatchesInvite,
  buildIceServers,
  compactCoopArtifacts,
  connectInviteHandoffProviders,
  connectSyncProviders,
  createBlobRelayTransport,
  createCoopDb,
  createCoopDoc,
  createInviteHandoffRequest,
  decryptInviteHandoffPayload,
  encodeCoopDoc,
  encryptInviteHandoffPayload,
  hashJson,
  hydrateCoopDoc,
  inviteHandoffRequestSchema,
  inviteHandoffResponseSchema,
  isRedactedSyncRoomSecret,
  mergeCoopDocUpdates,
  parseInviteCode,
  readCoopState,
  redactSyncRoomSecrets,
  summarizeSyncTransportHealth,
  validateInvite,
  verifyInviteCodeProof,
  writeCoopState,
} from '@coop/shared';
import { createBlobSyncChannel } from '@coop/shared/blob-channel';
import type {
  CoopSyncConfigResponse,
  CoopSyncRuntimeStatus,
  RuntimeActionResponse,
} from './messages';

type CoopConfigEntry = CoopSyncConfigResponse['coops'][number];
type ProviderSyncRoom = NonNullable<CoopConfigEntry['providerSyncRoom']>;
type InviteHandoffRoom = NonNullable<
  CoopConfigEntry['coop']['invites'][number]['bootstrap']['handoff']
>;

type InviteHandoffResponder = {
  inviteId: string;
  doc: ReturnType<typeof hydrateCoopDoc>;
  disconnect: () => void;
  invite: CoopConfigEntry['coop']['invites'][number];
  coop: CoopConfigEntry['coop'];
  syncRoom: ProviderSyncRoom;
  roomEpoch: number;
};

type CoopBinding = {
  key: string;
  coopId: string;
  doc: ReturnType<typeof createCoopDoc>;
  disconnect: () => void;
  lastHash: string;
  pendingUpdates: Uint8Array[];
  timer?: number;
  healthTimer?: number;
  compactionTimer?: number;
  iceExpiresAtMs?: number;
  blobSync?: ReturnType<typeof createBlobSyncChannel>;
  handoffResponders: Map<string, InviteHandoffResponder>;
  persistRetryCount: number;
};

const heartbeatIntervalMs = 30_000;
const compactionIntervalMs = 10 * 60_000;
const remotePersistDebounceMs = 280;
const remotePersistRetryBaseMs = 1_500;
const remotePersistRetryMaxMs = 15_000;
const docSizeWarningBytes = 1024 * 1024;
const iceRefreshSkewMs = 60_000;
const inviteHandoffRequestTimeoutMs = 12_000;
const handoffRequestsMapKey = 'invite-handoff-requests';
const handoffResponsesMapKey = 'invite-handoff-responses';
const bindings = new Map<string, CoopBinding>();
const db = createCoopDb('coop-extension');
let refreshPromise: Promise<void> | null = null;
let latestIceConfig: CoopSyncConfigResponse['iceConfig'] = null;
let latestWebsocketSyncUrl: string | undefined;

function runtimeNow() {
  return new Date().toISOString();
}

function resolveProviderSyncRoom(entry: CoopConfigEntry) {
  return entry.providerSyncRoom ?? entry.coop.syncRoom;
}

function hasProviderSyncRoomSecret(entry: CoopConfigEntry) {
  const room = resolveProviderSyncRoom(entry);
  return (
    entry.roomSecretAvailable &&
    !isRedactedSyncRoomSecret(room.roomSecret) &&
    !isRedactedSyncRoomSecret(room.inviteSigningSecret)
  );
}

function redactCoopStateForYjs(coop: CoopConfigEntry['coop']) {
  if (
    isRedactedSyncRoomSecret(coop.syncRoom.roomSecret) &&
    isRedactedSyncRoomSecret(coop.syncRoom.inviteSigningSecret)
  ) {
    return coop;
  }

  return {
    ...coop,
    syncRoom: redactSyncRoomSecrets(coop.syncRoom),
  };
}

function buildBindingKey(entry: CoopConfigEntry) {
  const room = resolveProviderSyncRoom(entry);
  return `${entry.coop.profile.id}:${room.roomId}:${room.signalingUrls.join('|')}`;
}

function resolveIceExpiresAtMs(config = latestIceConfig) {
  if (!config?.expiresAt) return undefined;
  const time = new Date(config.expiresAt).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function shouldRefreshIce(binding: CoopBinding) {
  return Boolean(binding.iceExpiresAtMs && Date.now() + iceRefreshSkewMs >= binding.iceExpiresAtMs);
}

async function reportCoopSyncRuntime(patch: Partial<CoopSyncRuntimeStatus>) {
  try {
    await chrome.runtime.sendMessage({
      type: 'report-coop-sync-runtime',
      payload: patch,
    });
  } catch {
    // Runtime reporting must never break sync.
  }
}

async function reportAggregateHealth() {
  const activeBindings = [...bindings.values()];
  const patch: Partial<CoopSyncRuntimeStatus> = {
    lastRefreshedAt: runtimeNow(),
    activeCoopIds: activeBindings.map((binding) => binding.coopId),
    activeBindingKeys: activeBindings.map((binding) => binding.key),
  };
  if (!activeBindings[0]) {
    patch.mode = 'none';
  }
  await reportCoopSyncRuntime(patch);
}

async function fetchCoopSyncConfig() {
  const response = (await chrome.runtime.sendMessage({
    type: 'get-coop-sync-config',
  })) as RuntimeActionResponse<CoopSyncConfigResponse>;

  if (!response.ok || !response.data) {
    throw new Error(response.error ?? 'Could not load coop sync config.');
  }

  latestIceConfig = response.data.iceConfig;
  latestWebsocketSyncUrl = response.data.websocketSyncUrl;
  return response.data;
}

function resolveIceServers() {
  if (latestIceConfig && !latestIceConfig.degraded && latestIceConfig.iceServers.length > 0) {
    return [...buildIceServers(), ...latestIceConfig.iceServers];
  }

  return buildIceServers({
    urls: import.meta.env.VITE_COOP_TURN_URLS,
    username: import.meta.env.VITE_COOP_TURN_USERNAME,
    credential: import.meta.env.VITE_COOP_TURN_CREDENTIAL,
  });
}

function resolveMode(
  health: ReturnType<typeof summarizeSyncTransportHealth>,
): NonNullable<CoopSyncRuntimeStatus['mode']> {
  if (health.peerCount > 0 || health.broadcastPeerCount > 0) return 'webrtc';
  if (health.websocketConnected) return 'websocket';
  if (health.syncError) return 'degraded';
  return 'indexeddb-only';
}

function buildSyncRoomFromHandoffPayload(
  payload: Awaited<ReturnType<typeof decryptInviteHandoffPayload>>,
) {
  return {
    coopId: payload.coopId,
    roomId: payload.roomId,
    roomSecret: payload.roomSecret,
    inviteSigningSecret: payload.inviteSigningSecret,
    signalingUrls: payload.signalingUrls,
  };
}

function isUsableHandoffInvite(invite: CoopConfigEntry['coop']['invites'][number]) {
  return Boolean(
    invite.bootstrap.handoff && invite.status !== 'revoked' && validateInvite({ invite }),
  );
}

function disconnectHandoffResponder(responder: InviteHandoffResponder) {
  responder.disconnect();
  responder.doc.destroy();
}

function createInviteHandoffResponder(input: {
  coop: CoopConfigEntry['coop'];
  invite: CoopConfigEntry['coop']['invites'][number];
  handoff: InviteHandoffRoom;
  syncRoom: ProviderSyncRoom;
  roomEpoch: number;
  websocketSyncUrl?: string;
}) {
  const doc = hydrateCoopDoc();
  const providers = connectInviteHandoffProviders(
    doc,
    input.handoff,
    resolveIceServers(),
    input.websocketSyncUrl,
  );
  const requests = doc.getMap<string>(handoffRequestsMapKey);
  const responses = doc.getMap<string>(handoffResponsesMapKey);

  const responder: InviteHandoffResponder = {
    inviteId: input.invite.id,
    doc,
    invite: input.invite,
    coop: input.coop,
    syncRoom: input.syncRoom,
    roomEpoch: input.roomEpoch,
    disconnect() {
      requests.unobserve(handleRequests);
      providers.disconnect();
    },
  };

  const handleRequests = () => {
    for (const [requestId, rawRequest] of requests.entries()) {
      if (responses.has(requestId)) continue;

      void (async () => {
        try {
          const request = inviteHandoffRequestSchema.parse(JSON.parse(rawRequest));
          const currentInvite = responder.coop.invites.find(
            (candidate) => candidate.id === request.inviteId,
          );
          if (
            !currentInvite ||
            currentInvite.id !== responder.inviteId ||
            currentInvite.status === 'revoked' ||
            !validateInvite({ invite: currentInvite }) ||
            !verifyInviteCodeProof(currentInvite, responder.syncRoom.inviteSigningSecret)
          ) {
            return;
          }
          if (
            request.coopId !== responder.coop.profile.id ||
            request.memberId.length === 0 ||
            request.inviteId !== currentInvite.id
          ) {
            return;
          }

          const response = await encryptInviteHandoffPayload({
            request,
            payload: {
              requestId: request.requestId,
              coopId: responder.coop.profile.id,
              inviteId: currentInvite.id,
              recipientMemberId: request.memberId,
              roomEpoch: responder.roomEpoch,
              roomId: responder.syncRoom.roomId,
              roomSecret: responder.syncRoom.roomSecret,
              inviteSigningSecret: responder.syncRoom.inviteSigningSecret,
              signalingUrls: responder.syncRoom.signalingUrls,
              bootstrapSnapshot: currentInvite.bootstrap.bootstrapState,
              createdAt: runtimeNow(),
            },
          });
          responses.set(request.requestId, JSON.stringify(response));
        } catch (error) {
          void reportCoopSyncRuntime({
            lastError: error instanceof Error ? error.message : 'Invite handoff response failed.',
          });
        }
      })();
    }
  };

  requests.observe(handleRequests);
  handleRequests();
  return responder;
}

function reconcileInviteHandoffResponders(
  binding: CoopBinding,
  entry: CoopConfigEntry,
  websocketSyncUrl?: string,
) {
  const syncRoom = resolveProviderSyncRoom(entry);
  const desiredInviteIds = new Set(
    entry.coop.invites.filter((invite) => isUsableHandoffInvite(invite)).map((invite) => invite.id),
  );

  for (const [inviteId, responder] of binding.handoffResponders.entries()) {
    if (!desiredInviteIds.has(inviteId)) {
      disconnectHandoffResponder(responder);
      binding.handoffResponders.delete(inviteId);
    }
  }

  for (const invite of entry.coop.invites) {
    const handoff = invite.bootstrap.handoff;
    if (!handoff || !desiredInviteIds.has(invite.id)) continue;

    const existing = binding.handoffResponders.get(invite.id);
    if (existing) {
      existing.coop = entry.coop;
      existing.invite = invite;
      existing.syncRoom = syncRoom;
      existing.roomEpoch = entry.roomEpoch ?? existing.roomEpoch;
      continue;
    }

    binding.handoffResponders.set(
      invite.id,
      createInviteHandoffResponder({
        coop: entry.coop,
        invite,
        handoff,
        syncRoom,
        roomEpoch: entry.roomEpoch ?? 1,
        websocketSyncUrl,
      }),
    );
  }
}

function scheduleRuntimeHealthReport(
  binding: CoopBinding,
  providers: ReturnType<typeof connectSyncProviders>,
  delay = 0,
) {
  if (binding.healthTimer) {
    window.clearTimeout(binding.healthTimer);
  }

  binding.healthTimer = window.setTimeout(() => {
    const health = summarizeSyncTransportHealth(providers.webrtc, providers.websocket);
    const encoded = encodeCoopDoc(binding.doc);
    void chrome.runtime.sendMessage({
      type: 'report-sync-health',
      payload: {
        syncError: health.syncError,
        note: health.note,
      },
    });
    void reportCoopSyncRuntime({
      lastRefreshedAt: runtimeNow(),
      mode: resolveMode(health),
      configuredSignalingCount: health.configuredSignalingCount,
      signalingConnectionCount: health.signalingConnectionCount,
      peerCount: health.peerCount,
      broadcastPeerCount: health.broadcastPeerCount,
      websocketConnected: health.websocketConnected,
      directPeerAvailable: health.peerCount + health.broadcastPeerCount > 0,
      docBytes: encoded.byteLength,
      pendingUpdateCount: binding.pendingUpdates.length,
      lastError:
        encoded.byteLength > docSizeWarningBytes
          ? `Coop sync doc is ${encoded.byteLength} bytes; compaction should run soon.`
          : health.syncError
            ? health.note
            : undefined,
      activeCoopIds: [...bindings.values()].map((candidate) => candidate.coopId),
      activeBindingKeys: [...bindings.values()].map((candidate) => candidate.key),
    });
  }, delay);
}

function createBinding(entry: CoopConfigEntry, websocketSyncUrl?: string) {
  const coop = redactCoopStateForYjs(entry.coop);
  const providerSyncRoom = resolveProviderSyncRoom(entry);
  const doc = createCoopDoc(coop);
  const providers = connectSyncProviders(
    doc,
    providerSyncRoom,
    resolveIceServers(),
    websocketSyncUrl,
  );
  const disposers: (() => void)[] = [];
  const binding: CoopBinding = {
    key: buildBindingKey(entry),
    coopId: coop.profile.id,
    doc,
    lastHash: hashJson(coop),
    pendingUpdates: [],
    iceExpiresAtMs: resolveIceExpiresAtMs(),
    handoffResponders: new Map(),
    persistRetryCount: 0,
    disconnect() {
      if (binding.timer) window.clearTimeout(binding.timer);
      if (binding.healthTimer) window.clearTimeout(binding.healthTimer);
      if (binding.compactionTimer) window.clearTimeout(binding.compactionTimer);
      for (const dispose of disposers) dispose();
      binding.blobSync?.destroy();
      for (const responder of binding.handoffResponders.values()) {
        disconnectHandoffResponder(responder);
      }
      binding.handoffResponders.clear();
      doc.off('update', onDocUpdate);
      providers.disconnect();
      void reportCoopSyncRuntime({
        lastBindingDisconnectedAt: runtimeNow(),
        activeCoopIds: [...bindings.values()]
          .filter((candidate) => candidate.coopId !== coop.profile.id)
          .map((candidate) => candidate.coopId),
        activeBindingKeys: [...bindings.values()]
          .filter((candidate) => candidate.key !== binding.key)
          .map((candidate) => candidate.key),
      });
    },
  };

  const onProviderSignal = () => scheduleRuntimeHealthReport(binding, providers);
  const onProviderDisconnect = () => scheduleRuntimeHealthReport(binding, providers, 1200);

  if (providers.webrtc) {
    providers.webrtc.on('status', onProviderSignal);
    providers.webrtc.on('synced', onProviderSignal);
    providers.webrtc.on('peers', onProviderSignal);
    disposers.push(() => {
      providers.webrtc?.off('status', onProviderSignal);
      providers.webrtc?.off('synced', onProviderSignal);
      providers.webrtc?.off('peers', onProviderSignal);
    });
  }

  if (providers.websocket) {
    providers.websocket.on('status', onProviderSignal);
    disposers.push(() => providers.websocket?.off('status', onProviderSignal));
  }

  const setupBlobSync = () => {
    if (binding.blobSync) return;
    const relay = providers.websocket ? createBlobRelayTransport(providers.websocket) : undefined;
    if (!providers.webrtc && !relay) return;
    binding.blobSync = createBlobSyncChannel({
      webrtcProvider: providers.webrtc ?? { room: null },
      db,
      coopId: coop.profile.id,
      relay: relay ?? undefined,
      onBlobReceived: () => binding.blobSync?.broadcastManifest(),
    });
    binding.blobSync.broadcastManifest();
  };

  setupBlobSync();
  reconcileInviteHandoffResponders(binding, entry, websocketSyncUrl);
  if (providers.websocket) {
    const onWsConnect = ({ status }: { status: string }) => {
      if (status === 'connected') {
        setupBlobSync();
        binding.blobSync?.broadcastManifest();
      }
    };
    providers.websocket.on('status', onWsConnect);
    disposers.push(() => providers.websocket?.off('status', onWsConnect));
  }

  const persistPendingUpdates = async () => {
    let nextState: ReturnType<typeof readCoopState>;
    try {
      const remoteState = readCoopState(doc);
      nextState = redactCoopStateForYjs(remoteState);
      if (nextState !== remoteState) {
        writeCoopState(doc, nextState);
      }
    } catch (error) {
      await reportCoopSyncRuntime({
        lastError: error instanceof Error ? error.message : 'Could not read remote coop state.',
      });
      binding.pendingUpdates = [];
      return;
    }

    const remoteHash = hashJson(nextState);
    const docUpdate = mergeCoopDocUpdates(binding.pendingUpdates);
    if (remoteHash === binding.lastHash) {
      binding.pendingUpdates = [];
      return;
    }

    let persist: RuntimeActionResponse;
    try {
      persist = (await chrome.runtime.sendMessage({
        type: 'persist-coop-state',
        payload: {
          coopId: coop.profile.id,
          docUpdate,
        },
      })) as RuntimeActionResponse;
    } catch (error) {
      persist = {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not persist synced coop state.',
      };
    }

    if (!persist.ok) {
      await reportCoopSyncRuntime({
        lastError: persist.error ?? 'Could not persist synced coop state.',
      });
      const retryDelay = Math.min(
        remotePersistRetryBaseMs * 2 ** binding.persistRetryCount,
        remotePersistRetryMaxMs,
      );
      binding.persistRetryCount += 1;
      binding.timer = window.setTimeout(() => {
        void persistPendingUpdates();
      }, retryDelay);
      return;
    }

    binding.lastHash = remoteHash;
    binding.pendingUpdates = [];
    binding.persistRetryCount = 0;
    await reportCoopSyncRuntime({
      lastPersistAt: runtimeNow(),
      pendingUpdateCount: 0,
      lastError: undefined,
    });
    scheduleRuntimeHealthReport(binding, providers);
  };

  function onDocUpdate(update: Uint8Array, origin: unknown) {
    if (origin === ORIGIN_LOCAL) return;
    binding.pendingUpdates.push(update);
    void reportCoopSyncRuntime({
      lastDocUpdateAt: runtimeNow(),
      pendingUpdateCount: binding.pendingUpdates.length,
    });
    if (binding.timer) {
      window.clearTimeout(binding.timer);
    }
    binding.timer = window.setTimeout(() => {
      void persistPendingUpdates();
    }, remotePersistDebounceMs);
  }

  const runCompaction = async () => {
    try {
      const state = redactCoopStateForYjs(readCoopState(doc));
      const result = compactCoopArtifacts({ doc, state });
      if (result.archivedIds.length > 0) {
        const compactedState = readCoopState(doc);
        writeCoopState(doc, compactedState);
        const docUpdate = encodeCoopDoc(doc);
        const persist = (await chrome.runtime.sendMessage({
          type: 'persist-coop-state',
          payload: {
            coopId: coop.profile.id,
            docUpdate,
          },
        })) as RuntimeActionResponse;
        if (!persist.ok) {
          await reportCoopSyncRuntime({
            lastError: persist.error ?? 'Could not persist compacted coop state.',
          });
          return;
        }
        binding.lastHash = hashJson(readCoopState(doc));
      }
      const runtimePatch: Partial<CoopSyncRuntimeStatus> = {
        lastCompactionAt: runtimeNow(),
        docBytes: encodeCoopDoc(doc).byteLength,
        lastError: undefined,
      };
      if (result.archivedIds.length > 0) {
        runtimePatch.lastPersistAt = runtimeNow();
      }
      void reportCoopSyncRuntime(runtimePatch);
    } catch (error) {
      void reportCoopSyncRuntime({
        lastError: error instanceof Error ? error.message : 'Coop sync compaction failed.',
      });
    } finally {
      binding.compactionTimer = window.setTimeout(() => {
        void runCompaction();
      }, compactionIntervalMs);
    }
  };

  doc.on('update', onDocUpdate);
  binding.compactionTimer = window.setTimeout(() => {
    void runCompaction();
  }, compactionIntervalMs);
  scheduleRuntimeHealthReport(binding, providers, 2500);
  void reportCoopSyncRuntime({
    lastBindingCreatedAt: runtimeNow(),
    lastError: undefined,
    activeCoopIds: [...bindings.values(), binding].map((candidate) => candidate.coopId),
    activeBindingKeys: [...bindings.values(), binding].map((candidate) => candidate.key),
  });
  return binding;
}

async function refreshBindings() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const config = await fetchCoopSyncConfig();
    const nextBindings = new Map(
      config.coops
        .filter((entry) => hasProviderSyncRoomSecret(entry))
        .map((entry) => [entry.coop.profile.id, buildBindingKey(entry)]),
    );

    for (const [coopId, binding] of bindings.entries()) {
      if (nextBindings.get(coopId) !== binding.key || shouldRefreshIce(binding)) {
        binding.disconnect();
        bindings.delete(coopId);
      }
    }

    for (const entry of config.coops) {
      const coopId = entry.coop.profile.id;
      if (!hasProviderSyncRoomSecret(entry)) {
        await reportCoopSyncRuntime({
          lastError: `Sync secrets are unavailable for ${entry.coop.profile.name}. Accept a fresh invite handoff.`,
        });
        continue;
      }

      const existing = bindings.get(coopId);
      if (!existing) {
        bindings.set(coopId, createBinding(entry, config.websocketSyncUrl));
        continue;
      }

      const publicCoop = redactCoopStateForYjs(entry.coop);
      const nextHash = hashJson(publicCoop);
      if (existing.lastHash !== nextHash) {
        existing.lastHash = nextHash;
        writeCoopState(existing.doc, publicCoop);
        existing.blobSync?.broadcastManifest();
      }
      reconcileInviteHandoffResponders(existing, entry, config.websocketSyncUrl);
    }

    await reportAggregateHealth();
  })()
    .catch(async (error) => {
      await reportCoopSyncRuntime({
        lastError: error instanceof Error ? error.message : 'Coop sync refresh failed.',
      });
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function requestBlobFromPeers(coopId: string, blobId: string) {
  return bindings.get(coopId)?.blobSync?.requestBlob(blobId) ?? null;
}

async function requestInviteHandoff(input: {
  inviteCode: string;
  memberId: string;
  memberDisplayName: string;
  timeoutMs?: number;
}) {
  const invite = parseInviteCode(input.inviteCode);
  const handoff = invite.bootstrap.handoff;
  if (!handoff) {
    throw new Error('Invite is missing handoff metadata.');
  }

  const config = await fetchCoopSyncConfig();
  const { request, keyPair } = await createInviteHandoffRequest({
    coopId: invite.bootstrap.coopId,
    inviteId: invite.id,
    memberId: input.memberId,
    memberDisplayName: input.memberDisplayName,
  });
  const doc = hydrateCoopDoc();
  const providers = connectInviteHandoffProviders(
    doc,
    handoff,
    resolveIceServers(),
    config.websocketSyncUrl ?? latestWebsocketSyncUrl,
  );
  const requests = doc.getMap<string>(handoffRequestsMapKey);
  const responses = doc.getMap<string>(handoffResponsesMapKey);

  try {
    const timeoutMs = input.timeoutMs ?? inviteHandoffRequestTimeoutMs;
    const payload = await new Promise<Awaited<ReturnType<typeof decryptInviteHandoffPayload>>>(
      (resolve, reject) => {
        let settled = false;
        const cleanup = () => {
          responses.unobserve(handleResponses);
          window.clearTimeout(timer);
        };
        const settle = (
          fn: typeof resolve | typeof reject,
          value: Awaited<ReturnType<typeof decryptInviteHandoffPayload>> | Error,
        ) => {
          if (settled) return;
          settled = true;
          cleanup();
          fn(value as never);
        };
        const handleResponses = () => {
          const raw = responses.get(request.requestId);
          if (!raw) return;
          void (async () => {
            try {
              const response = inviteHandoffResponseSchema.parse(JSON.parse(raw));
              if (
                response.requestId !== request.requestId ||
                response.coopId !== invite.bootstrap.coopId ||
                response.inviteId !== invite.id ||
                response.memberId !== input.memberId
              ) {
                return;
              }
              const decrypted = await decryptInviteHandoffPayload({
                response,
                privateKey: keyPair.privateKey,
              });
              settle(
                resolve,
                assertInviteHandoffPayloadMatchesInvite({ invite, payload: decrypted }),
              );
            } catch (error) {
              settle(
                reject,
                error instanceof Error ? error : new Error('Invite handoff response failed.'),
              );
            }
          })();
        };
        const timer = window.setTimeout(() => {
          settle(
            reject,
            new Error('Invite handoff timed out. Ask an existing member to come online.'),
          );
        }, timeoutMs);

        responses.observe(handleResponses);
        requests.set(request.requestId, JSON.stringify(request));
        handleResponses();
      },
    );
    return payload;
  } finally {
    providers.disconnect();
    doc.destroy();
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: {
      type?: string;
      payload?: {
        coopId?: string;
        blobId?: string;
        inviteCode?: string;
        memberId?: string;
        memberDisplayName?: string;
        timeoutMs?: number;
      };
    },
    _sender,
    sendResponse,
  ) => {
    if (message.type === 'refresh-coop-sync-bindings') {
      void refreshBindings();
      return;
    }
    if (message.type === 'resolve-coop-blob-from-peers') {
      const { coopId, blobId } = message.payload ?? {};
      if (!coopId || !blobId) {
        sendResponse({ ok: false, error: 'Missing coopId or blobId.' });
        return;
      }
      void requestBlobFromPeers(coopId, blobId)
        .then((bytes) => {
          sendResponse({
            ok: true,
            data: bytes ? { bytes: Array.from(bytes) } : null,
          });
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : 'Peer blob request failed.',
          });
        });
      return true;
    }
    if (message.type === 'request-invite-handoff') {
      const { inviteCode, memberId, memberDisplayName, timeoutMs } = message.payload ?? {};
      if (!inviteCode || !memberId || !memberDisplayName) {
        sendResponse({ ok: false, error: 'Missing invite handoff request details.' });
        return;
      }
      void requestInviteHandoff({ inviteCode, memberId, memberDisplayName, timeoutMs })
        .then((payload) => {
          sendResponse({
            ok: true,
            data: {
              ...payload,
              syncRoom: buildSyncRoomFromHandoffPayload(payload),
            },
          });
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : 'Invite handoff failed.',
          });
        });
      return true;
    }
  },
);

void reportCoopSyncRuntime({
  loadedAt: runtimeNow(),
  activeCoopIds: [],
  activeBindingKeys: [],
  mode: 'none',
});
void refreshBindings();

window.setInterval(() => {
  void refreshBindings();
}, heartbeatIntervalMs);

window.addEventListener('unload', () => {
  for (const binding of bindings.values()) {
    binding.disconnect();
  }
  bindings.clear();
});
