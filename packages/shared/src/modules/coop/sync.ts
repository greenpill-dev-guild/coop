import { defaultIceServers, defaultSignalingUrls, defaultWebsocketSyncUrl } from '@coop/api';
import { IndexeddbPersistence } from 'y-indexeddb';
import { type SignalingConn, WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import {
  type CoopSharedState,
  type SyncRoomBootstrap,
  type SyncRoomConfig,
  artifactSchema,
  coopSharedStateSchema,
} from '../../contracts/schema';
import { createId, hashText } from '../../utils';

const ROOT_KEY = 'coop';
const ARTIFACTS_MAP_KEY = 'coop-artifacts';
export {
  buildIceServers,
  defaultIceServers,
  defaultSignalingUrls,
  defaultWebsocketSyncUrl,
  parseSignalingUrls,
} from '@coop/api';
const sharedKeys = [
  'profile',
  'setupInsights',
  'soul',
  'rituals',
  'members',
  'invites',
  'artifacts',
  'reviewBoard',
  'archiveReceipts',
  'memoryProfile',
  'syncRoom',
  'onchainState',
  'greenGoods',
  'archiveConfig',
  'memberCommitments',
] as const;

export function deriveSyncRoomId(coopId: string, roomSecret: string) {
  return `coop-room-${hashText(`${coopId}:${roomSecret}`).slice(2, 18)}`;
}

export function createSyncRoomConfig(
  coopId: string,
  signalingUrls = defaultSignalingUrls,
): SyncRoomConfig {
  const roomSecret = createId('room-secret');
  const inviteSigningSecret = createId('invite-secret');
  return {
    coopId,
    roomSecret,
    roomId: deriveSyncRoomId(coopId, roomSecret),
    inviteSigningSecret,
    signalingUrls,
  };
}

export function toSyncRoomBootstrap(room: SyncRoomConfig): SyncRoomBootstrap {
  return {
    coopId: room.coopId,
    roomId: room.roomId,
    roomSecret: room.roomSecret,
    signalingUrls: room.signalingUrls,
  };
}

export function createBootstrapSyncRoomConfig(
  input: SyncRoomBootstrap,
  inviteId: string,
): SyncRoomConfig {
  return {
    coopId: input.coopId,
    roomId: input.roomId,
    signalingUrls: input.signalingUrls,
    roomSecret: input.roomSecret ?? `bootstrap:${input.roomId}`,
    inviteSigningSecret: `bootstrap:${inviteId}`,
  };
}

export function isBootstrapSyncRoomConfig(room: SyncRoomConfig) {
  return (
    room.roomSecret.startsWith('bootstrap:') || room.inviteSigningSecret.startsWith('bootstrap:')
  );
}

export function createCoopDoc(state: CoopSharedState) {
  const doc = new Y.Doc();
  writeCoopState(doc, state);
  return doc;
}

export function writeCoopState(doc: Y.Doc, state: CoopSharedState) {
  const root = doc.getMap<string>(ROOT_KEY);
  const artifactsMap = doc.getMap<string>(ARTIFACTS_MAP_KEY);

  doc.transact(() => {
    for (const key of sharedKeys) {
      // Dual-write: old format kept for backward compat with pre-migration peers
      root.set(key, JSON.stringify(state[key]));
    }

    // New format: per-artifact entries in dedicated Y.Map
    const currentIds = new Set(state.artifacts.map((a) => a.id));
    for (const id of artifactsMap.keys()) {
      if (!currentIds.has(id)) {
        artifactsMap.delete(id);
      }
    }
    for (const artifact of state.artifacts) {
      artifactsMap.set(artifact.id, JSON.stringify(artifact));
    }
  });
}

export function readCoopState(doc: Y.Doc): CoopSharedState {
  const root = doc.getMap<string>(ROOT_KEY);
  const artifactsMap = doc.getMap<string>(ARTIFACTS_MAP_KEY);

  // Read per-artifact map (new format) if populated, else fall back to old JSON string
  let artifacts: unknown[];
  if (artifactsMap.size > 0) {
    artifacts = [];
    for (const value of artifactsMap.values()) {
      try {
        artifacts.push(JSON.parse(value));
      } catch {
        // skip corrupted entries
      }
    }
  } else {
    const raw = root.get('artifacts');
    artifacts = raw ? JSON.parse(raw) : [];
  }

  const raw = Object.fromEntries(
    sharedKeys.map((key) => {
      if (key === 'artifacts') return ['artifacts', artifacts];
      const value = root.get(key);
      return [key, value ? JSON.parse(value) : undefined];
    }),
  );

  return coopSharedStateSchema.parse(raw);
}

export function updateCoopState(
  doc: Y.Doc,
  updater: (current: CoopSharedState) => CoopSharedState,
) {
  const current = readCoopState(doc);
  const next = updater(current);
  writeCoopState(doc, next);
  return next;
}

export function encodeCoopDoc(doc: Y.Doc) {
  return Y.encodeStateAsUpdate(doc);
}

export function hydrateCoopDoc(update?: Uint8Array) {
  const doc = new Y.Doc();
  if (update) {
    Y.applyUpdate(doc, update);
  }
  return doc;
}

export function connectSyncProviders(
  doc: Y.Doc,
  room: SyncRoomConfig,
  iceServers?: RTCIceServer[],
  websocketSyncUrl?: string,
) {
  if (typeof window === 'undefined') {
    return {
      roomId: room.roomId,
      indexeddb: undefined,
      webrtc: undefined,
      websocket: undefined,
      disconnect() {},
    };
  }

  const indexeddb = new IndexeddbPersistence(room.roomId, doc);
  let webrtc: WebrtcProvider | undefined;

  try {
    webrtc = new WebrtcProvider(room.roomId, doc, {
      signaling: room.signalingUrls,
      password: room.roomSecret,
      maxConns: 8,
      peerOpts: { config: { iceServers: iceServers ?? defaultIceServers } },
    });
  } catch (error) {
    void error;
    webrtc = undefined;
  }

  let websocket: WebsocketProvider | undefined;
  const resolvedWsUrl = websocketSyncUrl ?? defaultWebsocketSyncUrl;
  if (resolvedWsUrl) {
    try {
      websocket = new WebsocketProvider(resolvedWsUrl, room.roomId, doc, {
        connect: true,
      });
    } catch (error) {
      void error;
      websocket = undefined;
    }
  }

  return {
    roomId: room.roomId,
    indexeddb,
    webrtc,
    websocket,
    disconnect() {
      websocket?.destroy();
      webrtc?.destroy();
      indexeddb.destroy();
    },
  };
}

export interface SyncTransportHealth {
  syncError: boolean;
  note?: string;
  configuredSignalingCount: number;
  signalingConnectionCount: number;
  peerCount: number;
  broadcastPeerCount: number;
  websocketConnected: boolean;
}

export function summarizeSyncTransportHealth(
  webrtc?: Pick<WebrtcProvider, 'room' | 'signalingUrls' | 'signalingConns'>,
  websocket?: Pick<WebsocketProvider, 'wsconnected'>,
): SyncTransportHealth {
  const websocketConnected = websocket?.wsconnected ?? false;

  if (!webrtc) {
    return {
      syncError: !websocketConnected,
      note: websocketConnected
        ? 'WebSocket sync connected. Peer sync is unavailable.'
        : 'Peer sync is unavailable in this extension context right now.',
      configuredSignalingCount: 0,
      signalingConnectionCount: 0,
      peerCount: 0,
      broadcastPeerCount: 0,
      websocketConnected,
    };
  }

  const signalingConns = (webrtc.signalingConns as SignalingConn[] | undefined) ?? [];
  const signalingConnectionCount = signalingConns.filter(
    (connection) => connection.connected,
  ).length;
  const peerCount = webrtc.room?.webrtcConns.size ?? 0;
  const broadcastPeerCount = webrtc.room?.bcConns.size ?? 0;

  if (signalingConnectionCount === 0 && peerCount === 0 && broadcastPeerCount === 0) {
    return {
      syncError: !websocketConnected,
      note: websocketConnected
        ? 'WebSocket sync connected. No signaling server connection.'
        : 'No signaling server connection. Shared sync is currently limited to this browser profile.',
      configuredSignalingCount: webrtc.signalingUrls.length,
      signalingConnectionCount,
      peerCount,
      broadcastPeerCount,
      websocketConnected,
    };
  }

  if (peerCount > 0 || broadcastPeerCount > 0) {
    const totalPeers = peerCount + broadcastPeerCount;
    return {
      syncError: false,
      note: `Connected to ${totalPeers} peer${totalPeers === 1 ? '' : 's'}.`,
      configuredSignalingCount: webrtc.signalingUrls.length,
      signalingConnectionCount,
      peerCount,
      broadcastPeerCount,
      websocketConnected,
    };
  }

  return {
    syncError: false,
    note: 'Signaling connected. Waiting for peers.',
    configuredSignalingCount: webrtc.signalingUrls.length,
    signalingConnectionCount,
    peerCount,
    broadcastPeerCount,
    websocketConnected,
  };
}

// --- Per-artifact observation (Step 20) ---

/**
 * Observe per-artifact Y.Map changes for UI reactivity.
 * Returns an unsubscribe function.
 */
export function observeArtifacts(
  doc: Y.Doc,
  callback: (artifacts: CoopSharedState['artifacts']) => void,
): () => void {
  const artifactsMap = doc.getMap<string>(ARTIFACTS_MAP_KEY);

  const handler = () => {
    const artifacts: CoopSharedState['artifacts'] = [];
    for (const value of artifactsMap.values()) {
      try {
        const parsed = artifactSchema.safeParse(JSON.parse(value));
        if (parsed.success) {
          artifacts.push(parsed.data);
        }
      } catch {
        // skip corrupted entries
      }
    }
    callback(artifacts);
  };

  artifactsMap.observe(handler);
  return () => artifactsMap.unobserve(handler);
}

// --- Horizon compaction (Step 21) ---

const DEFAULT_MAX_LIVE_ARTIFACTS = 200;
const DEFAULT_MAX_AGE_DAYS = 90;

export interface CompactionResult {
  archivedIds: string[];
  remainingCount: number;
}

/**
 * Identify artifacts beyond the horizon and remove them from the live Yjs doc.
 * Callers should archive the returned IDs before calling this.
 */
export function compactCoopArtifacts(input: {
  doc: Y.Doc;
  state: CoopSharedState;
  maxLiveArtifacts?: number;
  maxAgeDays?: number;
}): CompactionResult {
  const maxLive = input.maxLiveArtifacts ?? DEFAULT_MAX_LIVE_ARTIFACTS;
  const maxAgeDays = input.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  // Sort newest first
  const sorted = [...input.state.artifacts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const archivedIds: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const age = now - new Date(sorted[i].createdAt).getTime();
    if (i >= maxLive || age > maxAgeMs) {
      archivedIds.push(sorted[i].id);
    }
  }

  if (archivedIds.length === 0) {
    return { archivedIds: [], remainingCount: sorted.length };
  }

  // Remove from both old and new Yjs structures
  const artifactsMap = input.doc.getMap<string>(ARTIFACTS_MAP_KEY);
  const root = input.doc.getMap<string>(ROOT_KEY);
  const archivedSet = new Set(archivedIds);

  input.doc.transact(() => {
    for (const id of archivedIds) {
      artifactsMap.delete(id);
    }
    const remaining = sorted.filter((a) => !archivedSet.has(a.id));
    root.set('artifacts', JSON.stringify(remaining));
  });

  return { archivedIds, remainingCount: sorted.length - archivedIds.length };
}
