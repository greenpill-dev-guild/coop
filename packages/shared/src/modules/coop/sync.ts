import { IndexeddbPersistence } from 'y-indexeddb';
import { type SignalingConn, WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import type * as Y from 'yjs';
import type { CoopSharedState, InviteHandoffRoom, SyncRoomConfig } from '../../contracts/schema';
import {
  type BlobRelayMessage,
  type BlobRelayTransport,
  MESSAGE_BLOB_RELAY,
  decodeBlobRelayMessage,
  encodeBlobRelayMessage,
} from '../blob';
import {
  appendSyncAuthToUrl,
  buildAuthenticatedSignalingUrls,
  buildCoopSyncAuthParams,
  buildInviteHandoffAuthParams,
  decodeRelayFrame,
  defaultIceServers,
  defaultWebsocketSyncUrl,
  encodeRelayFrame,
} from '../sync-core';

// Re-export everything from sync-core for backward compatibility
export {
  ORIGIN_LOCAL,
  appendSyncAuthToUrl,
  buildIceServers,
  buildAuthenticatedSignalingUrls,
  buildCoopSyncAuthParams,
  buildInviteHandoffAuthParams,
  buildSyncRoomRotationProofBase,
  buildSyncRoomRotationProofChallenge,
  compactCoopArtifacts,
  compareSyncRoomRotationOrder,
  createBootstrapSyncRoomConfig,
  createCoopDoc,
  createRoomRotationAnnouncement,
  createSyncRoomConfig,
  decodeRelayFrame,
  defaultIceServers,
  defaultSignalingUrls,
  defaultWebsocketSyncUrl,
  deriveSyncRoomId,
  deriveInviteHandoffRoomId,
  encodeCoopDoc,
  encodeRelayFrame,
  finalizeSyncRoomRotationProof,
  hydrateCoopDoc,
  isBootstrapSyncRoomConfig,
  isAuthorizedCoopSyncRoom,
  mergeCoopDocUpdates,
  observeArtifacts,
  isPreferredSyncRoomRotation,
  parseSignalingUrls,
  readCoopState,
  readCoopStateRaw,
  readVarUint,
  toSyncRoomBootstrap,
  updateCoopState,
  verifyRoomRotationAnnouncement,
  verifySyncRoomRotationProof,
  writeCoopState,
  writeVarUint,
} from '../sync-core';
export type { CompactionResult } from '../sync-core';

/**
 * Connects IndexedDB persistence, WebRTC peer sync, and WebSocket sync providers to a Yjs document.
 * Returns a no-op bundle in non-browser environments (SSR-safe).
 * @param doc - The Yjs document to connect providers to
 * @param room - Sync room configuration with room ID, secrets, and signaling URLs
 * @param iceServers - Optional ICE servers for WebRTC (defaults to STUN-only unless TURN is configured)
 * @param websocketSyncUrl - Optional WebSocket sync URL (defaults to production)
 * @returns Object with roomId, provider references, and a disconnect() cleanup function
 */
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
  const authenticatedSignalingUrls = buildAuthenticatedSignalingUrls(room, room.signalingUrls);

  try {
    webrtc = new WebrtcProvider(room.roomId, doc, {
      signaling: authenticatedSignalingUrls,
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
        params: buildCoopSyncAuthParams(room),
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

export function buildAuthenticatedInviteHandoffSignalingUrls(
  room: Pick<InviteHandoffRoom, 'inviteId' | 'roomId' | 'roomSecret'>,
  signalingUrls: string[],
) {
  const params = buildInviteHandoffAuthParams(room);
  return signalingUrls.map((url) => appendSyncAuthToUrl(url, params));
}

export function connectInviteHandoffProviders(
  doc: Y.Doc,
  room: InviteHandoffRoom,
  iceServers?: RTCIceServer[],
  websocketSyncUrl?: string,
) {
  if (typeof window === 'undefined') {
    return {
      roomId: room.roomId,
      webrtc: undefined,
      websocket: undefined,
      disconnect() {},
    };
  }

  let webrtc: WebrtcProvider | undefined;
  const authenticatedSignalingUrls = buildAuthenticatedInviteHandoffSignalingUrls(
    room,
    room.signalingUrls,
  );

  try {
    webrtc = new WebrtcProvider(room.roomId, doc, {
      signaling: authenticatedSignalingUrls,
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
        params: buildInviteHandoffAuthParams(room),
      });
    } catch (error) {
      void error;
      websocket = undefined;
    }
  }

  return {
    roomId: room.roomId,
    webrtc,
    websocket,
    disconnect() {
      websocket?.destroy();
      webrtc?.destroy();
    },
  };
}

/**
 * Create a BlobRelayTransport backed by a y-websocket provider.
 *
 * Hooks into the provider's underlying WebSocket to send/receive blob relay
 * messages (message type 2) alongside normal Yjs sync traffic.
 *
 * Handles y-websocket reconnection: re-attaches the message listener when
 * the provider creates a new WebSocket after disconnect/reconnect.
 */
export function createBlobRelayTransport(provider: WebsocketProvider): BlobRelayTransport | null {
  const getWs = () => (provider as unknown as { ws: WebSocket | null }).ws;

  const handlers = new Set<(msg: BlobRelayMessage) => void>();
  let currentWs: WebSocket | null = null;

  function messageListener(event: MessageEvent) {
    const data = event.data;
    if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) return;
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.length === 0) return;

    try {
      const frame = decodeRelayFrame(bytes);
      if (!frame || frame.messageType !== MESSAGE_BLOB_RELAY) return;

      const msg = decodeBlobRelayMessage(frame.payload);
      if (!msg) return;

      for (const handler of handlers) {
        handler(msg);
      }
    } catch {
      // Not a blob relay message or decode error — ignore
    }
  }

  function attachListener() {
    const ws = getWs();
    if (ws === currentWs) return; // already attached
    if (currentWs) {
      currentWs.removeEventListener('message', messageListener);
    }
    currentWs = ws;
    if (ws) {
      ws.addEventListener('message', messageListener);
    }
  }

  // Attach to the current WebSocket
  attachListener();

  // Re-attach when the provider reconnects with a new WebSocket
  const onStatus = () => attachListener();
  provider.on('status', onStatus);

  return {
    sendMessage(msg: BlobRelayMessage) {
      const ws = getWs();
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const jsonStr = encodeBlobRelayMessage(msg);
      ws.send(encodeRelayFrame(MESSAGE_BLOB_RELAY, jsonStr));
    },
    onMessage(handler: (msg: BlobRelayMessage) => void): () => void {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
          if (currentWs) currentWs.removeEventListener('message', messageListener);
          provider.off('status', onStatus);
        }
      };
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

/**
 * Produces a health summary of the sync transport layer (signaling, peers, WebSocket).
 * @param webrtc - Optional WebRTC provider with room and signaling connection info
 * @param websocket - Optional WebSocket provider with connection status
 * @returns A SyncTransportHealth object with connection counts, peer counts, and error status
 */
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
    note: 'Signaling connected. Ready when another peer joins.',
    configuredSignalingCount: webrtc.signalingUrls.length,
    signalingConnectionCount,
    peerCount,
    broadcastPeerCount,
    websocketConnected,
  };
}
