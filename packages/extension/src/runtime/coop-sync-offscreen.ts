import {
  type CoopSharedState,
  type SyncRoomConfig,
  buildIceServers,
  connectSyncProviders,
  createCoopDoc,
  hashJson,
  mergeCoopDocUpdates,
  ORIGIN_LOCAL,
  readCoopState,
  summarizeSyncTransportHealth,
  writeCoopState,
} from '@coop/shared';
import type { CoopSyncRuntime, RuntimeActionResponse } from './messages';

type CoopSyncBinding = {
  coopId: string;
  key: string;
  doc: ReturnType<typeof createCoopDoc>;
  providers: ReturnType<typeof connectSyncProviders>;
  disconnect: () => void;
  lastHash: string;
  pendingUpdates: Uint8Array[];
  timer?: number;
  healthTimer?: number;
};

const bindings = new Map<string, CoopSyncBinding>();
let refreshPromise: Promise<void> | null = null;

interface CoopSyncConfig {
  coops: Array<{
    coopId: string;
    state: CoopSharedState;
    syncRoom: SyncRoomConfig;
  }>;
  iceServers?: RTCIceServer[];
  websocketSyncUrl?: string;
}

function buildBindingKey(syncRoom: SyncRoomConfig) {
  return `${syncRoom.roomId}:${syncRoom.signalingUrls.join('|')}`;
}

async function fetchCoopSyncConfig(): Promise<CoopSyncConfig> {
  const response = (await chrome.runtime.sendMessage({
    type: 'get-coop-sync-config',
  })) as RuntimeActionResponse<CoopSyncConfig>;

  if (!response.ok || !response.data) {
    throw new Error(response.error ?? 'Could not load coop sync config.');
  }

  return response.data;
}

async function reportCoopSyncRuntime(coopId: string, patch: Partial<CoopSyncRuntime>) {
  try {
    await chrome.runtime.sendMessage({
      type: 'report-coop-sync-runtime',
      payload: { coopId, ...patch },
    });
  } catch {
    // Best-effort reporting.
  }
}

function resolveMode(providers: ReturnType<typeof connectSyncProviders>): CoopSyncRuntime['mode'] {
  const hasWebrtc = Boolean(providers.webrtc);
  const hasWebsocket = Boolean(providers.websocket);
  if (hasWebrtc && hasWebsocket) return 'mixed';
  if (hasWebrtc) return 'webrtc';
  if (hasWebsocket) return 'websocket-only';
  if (providers.indexeddb) return 'local-only';
  return 'inactive';
}

function createBinding(
  coopEntry: CoopSyncConfig['coops'][number],
  iceServers?: RTCIceServer[],
  websocketSyncUrl?: string,
): CoopSyncBinding {
  const { coopId, state, syncRoom } = coopEntry;
  const doc = createCoopDoc(state);
  const configuredIce =
    iceServers ??
    buildIceServers({
      urls: import.meta.env.VITE_COOP_TURN_URLS,
      username: import.meta.env.VITE_COOP_TURN_USERNAME,
      credential: import.meta.env.VITE_COOP_TURN_CREDENTIAL,
    });
  const providers = connectSyncProviders(doc, syncRoom, configuredIce, websocketSyncUrl);

  const binding: CoopSyncBinding = {
    coopId,
    key: buildBindingKey(syncRoom),
    doc,
    providers,
    lastHash: hashJson(state),
    pendingUpdates: [],
    disconnect() {
      if (binding.timer) {
        window.clearTimeout(binding.timer);
      }
      if (binding.healthTimer) {
        window.clearTimeout(binding.healthTimer);
      }
      doc.off('update', onDocUpdate);
      providers.disconnect();
      void reportCoopSyncRuntime(coopId, { active: false, mode: 'inactive' });
    },
  };

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    // CRITICAL: Skip local writes — only process remote peer updates.
    if (origin === ORIGIN_LOCAL) return;

    binding.pendingUpdates.push(update);
    if (binding.timer) {
      window.clearTimeout(binding.timer);
    }
    binding.timer = window.setTimeout(async () => {
      const nextState = readCoopState(doc);
      const remoteHash = hashJson(nextState);
      const docUpdate = mergeCoopDocUpdates(binding.pendingUpdates);
      binding.pendingUpdates = [];
      if (remoteHash === binding.lastHash) {
        return;
      }
      binding.lastHash = remoteHash;

      const persist = (await chrome.runtime.sendMessage({
        type: 'persist-coop-state',
        payload: {
          coopId,
          docUpdate,
        },
      })) as RuntimeActionResponse;

      if (!persist.ok) {
        void reportCoopSyncRuntime(coopId, {
          lastError: persist.error ?? 'Could not persist synced coop state.',
        });
        return;
      }

      void reportCoopSyncRuntime(coopId, {
        lastPersistAt: new Date().toISOString(),
        lastRemoteUpdateAt: new Date().toISOString(),
        lastError: undefined,
      });
    }, 280);
  };

  doc.on('update', onDocUpdate);

  // Schedule initial health report after a short delay for providers to connect.
  const reportHealth = () => {
    const health = summarizeSyncTransportHealth(providers.webrtc, providers.websocket);
    void reportCoopSyncRuntime(coopId, {
      mode: resolveMode(providers),
      peerCount: health.peerCount,
      broadcastPeerCount: health.broadcastPeerCount,
      signalingConnectionCount: health.signalingConnectionCount,
      configuredSignalingCount: health.configuredSignalingCount,
      websocketConnected: health.websocketConnected,
      lastError: health.syncError ? health.note : undefined,
      active: true,
    });
  };

  binding.healthTimer = window.setTimeout(reportHealth, 2500);

  return binding;
}

async function refreshBindings() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const config = await fetchCoopSyncConfig();
    const nextIds = new Map(
      config.coops.map((entry) => [entry.coopId, buildBindingKey(entry.syncRoom)]),
    );

    // Remove stale bindings
    for (const [coopId, binding] of bindings.entries()) {
      if (nextIds.get(coopId) !== binding.key) {
        binding.disconnect();
        bindings.delete(coopId);
      }
    }

    // Create new bindings or update existing
    for (const entry of config.coops) {
      const existing = bindings.get(entry.coopId);
      if (existing) {
        // Update state if hash changed
        const nextHash = hashJson(entry.state);
        if (existing.lastHash !== nextHash) {
          existing.lastHash = nextHash;
          writeCoopState(existing.doc, entry.state);
        }
        continue;
      }
      bindings.set(entry.coopId, createBinding(entry, config.iceServers, config.websocketSyncUrl));
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// ---- Startup ----

void refreshBindings();

// ---- Heartbeat fallback ----

window.setInterval(() => {
  void refreshBindings();
}, 15_000);

// ---- Message listener ----

chrome.runtime.onMessage.addListener(
  (message: { type?: string }, _sender: unknown, sendResponse: (response: unknown) => void) => {
    if (message.type === 'refresh-coop-sync-bindings') {
      void refreshBindings().then(() => sendResponse({ ok: true }));
      return true;
    }
  },
);

// ---- Cleanup ----

window.addEventListener('unload', () => {
  for (const binding of bindings.values()) {
    binding.disconnect();
  }
  bindings.clear();
});
