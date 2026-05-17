import {
  ORIGIN_LOCAL,
  buildIceServers,
  compactCoopArtifacts,
  connectSyncProviders,
  createBlobRelayTransport,
  createCoopDb,
  createCoopDoc,
  encodeCoopDoc,
  hashJson,
  mergeCoopDocUpdates,
  readCoopState,
  summarizeSyncTransportHealth,
  writeCoopState,
} from '@coop/shared';
import { createBlobSyncChannel } from '@coop/shared/blob-channel';
import type {
  CoopSyncConfigResponse,
  CoopSyncRuntimeStatus,
  RuntimeActionResponse,
} from './messages';

type CoopConfigEntry = CoopSyncConfigResponse['coops'][number];

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
};

const heartbeatIntervalMs = 30_000;
const compactionIntervalMs = 10 * 60_000;
const remotePersistDebounceMs = 280;
const docSizeWarningBytes = 1024 * 1024;
const iceRefreshSkewMs = 60_000;
const bindings = new Map<string, CoopBinding>();
const db = createCoopDb('coop-extension');
let refreshPromise: Promise<void> | null = null;
let latestIceConfig: CoopSyncConfigResponse['iceConfig'] = null;

function runtimeNow() {
  return new Date().toISOString();
}

function buildBindingKey(entry: CoopConfigEntry) {
  return `${entry.coop.profile.id}:${entry.coop.syncRoom.roomId}:${entry.coop.syncRoom.signalingUrls.join('|')}`;
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
          : health.note,
      activeCoopIds: [...bindings.values()].map((candidate) => candidate.coopId),
      activeBindingKeys: [...bindings.values()].map((candidate) => candidate.key),
    });
  }, delay);
}

function createBinding(entry: CoopConfigEntry, websocketSyncUrl?: string) {
  const coop = entry.coop;
  const doc = createCoopDoc(coop);
  const providers = connectSyncProviders(doc, coop.syncRoom, resolveIceServers(), websocketSyncUrl);
  const disposers: (() => void)[] = [];
  const binding: CoopBinding = {
    key: buildBindingKey(entry),
    coopId: coop.profile.id,
    doc,
    lastHash: hashJson(coop),
    pendingUpdates: [],
    iceExpiresAtMs: resolveIceExpiresAtMs(),
    disconnect() {
      if (binding.timer) window.clearTimeout(binding.timer);
      if (binding.healthTimer) window.clearTimeout(binding.healthTimer);
      if (binding.compactionTimer) window.clearTimeout(binding.compactionTimer);
      for (const dispose of disposers) dispose();
      binding.blobSync?.destroy();
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
    if (binding.blobSync || !providers.webrtc) return;
    const relay = providers.websocket ? createBlobRelayTransport(providers.websocket) : undefined;
    binding.blobSync = createBlobSyncChannel({
      webrtcProvider: providers.webrtc,
      db,
      coopId: coop.profile.id,
      relay: relay ?? undefined,
      onBlobReceived: () => binding.blobSync?.broadcastManifest(),
    });
    binding.blobSync.broadcastManifest();
  };

  setupBlobSync();
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
      nextState = readCoopState(doc);
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

    const persist = (await chrome.runtime.sendMessage({
      type: 'persist-coop-state',
      payload: {
        coopId: coop.profile.id,
        docUpdate,
      },
    })) as RuntimeActionResponse;

    if (!persist.ok) {
      await reportCoopSyncRuntime({
        lastError: persist.error ?? 'Could not persist synced coop state.',
      });
      return;
    }

    binding.lastHash = remoteHash;
    binding.pendingUpdates = [];
    await reportCoopSyncRuntime({
      lastPersistAt: runtimeNow(),
      pendingUpdateCount: 0,
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
      const state = readCoopState(doc);
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
        .filter((entry) => entry.roomSecretAvailable)
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
      if (!entry.roomSecretAvailable) {
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

      const nextHash = hashJson(entry.coop);
      if (existing.lastHash !== nextHash) {
        existing.lastHash = nextHash;
        writeCoopState(existing.doc, entry.coop);
        existing.blobSync?.broadcastManifest();
      }
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

chrome.runtime.onMessage.addListener(
  (
    message: { type?: string; payload?: { coopId?: string; blobId?: string } },
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
