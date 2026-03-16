import { defaultIceServers, defaultSignalingUrls } from '@coop/api';
import { IndexeddbPersistence } from 'y-indexeddb';
import { type SignalingConn, WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';
import {
  type CoopSharedState,
  type SyncRoomBootstrap,
  type SyncRoomConfig,
  coopSharedStateSchema,
} from '../../contracts/schema';
import { createId, hashText } from '../../utils';

const ROOT_KEY = 'coop';
export {
  buildIceServers,
  defaultIceServers,
  defaultSignalingUrls,
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
    roomSecret: `bootstrap:${input.roomId}`,
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
  doc.transact(() => {
    for (const key of sharedKeys) {
      root.set(key, JSON.stringify(state[key]));
    }
  });
}

export function readCoopState(doc: Y.Doc): CoopSharedState {
  const root = doc.getMap<string>(ROOT_KEY);
  const raw = Object.fromEntries(
    sharedKeys.map((key) => {
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
) {
  if (typeof window === 'undefined') {
    return {
      roomId: room.roomId,
      indexeddb: undefined,
      webrtc: undefined,
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

  return {
    roomId: room.roomId,
    indexeddb,
    webrtc,
    disconnect() {
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
}

export function summarizeSyncTransportHealth(
  webrtc?: Pick<WebrtcProvider, 'room' | 'signalingUrls' | 'signalingConns'>,
): SyncTransportHealth {
  if (!webrtc) {
    return {
      syncError: true,
      note: 'Peer sync is unavailable in this extension context right now.',
      configuredSignalingCount: 0,
      signalingConnectionCount: 0,
      peerCount: 0,
      broadcastPeerCount: 0,
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
      syncError: true,
      note: 'No signaling server connection. Shared sync is currently limited to this browser profile.',
      configuredSignalingCount: webrtc.signalingUrls.length,
      signalingConnectionCount,
      peerCount,
      broadcastPeerCount,
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
    };
  }

  return {
    syncError: false,
    note: 'Signaling connected. Waiting for peers.',
    configuredSignalingCount: webrtc.signalingUrls.length,
    signalingConnectionCount,
    peerCount,
    broadcastPeerCount,
  };
}
