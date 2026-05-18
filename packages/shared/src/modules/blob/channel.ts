import { createId } from '../../utils';
// Use ../storage/db (the real barrel) to avoid vitest circular-dep resolution issues
import type { CoopDexie } from '../storage/db';
import {
  type BlobRelayChunk,
  type BlobRelayMessage,
  decodeBlobRelayMessage,
  encodeBlobRelayMessage,
} from './relay';
import { getCoopBlob, listCoopBlobs } from './store';
import {
  type BlobChunk,
  type BlobSyncChannel,
  type BlobSyncMessage,
  chunkBlob,
  decodeBlobSyncMessage,
  encodeBlobSyncMessage,
  reassembleChunks,
} from './sync';

const BLOB_CHANNEL_LABEL = 'coop-blob';
const REQUEST_TIMEOUT_MS = 30_000;
const SEND_BUFFER_HIGH_WATER = 128 * 1024; // 128 KB

interface PendingRequest {
  blobId: string;
  requestId: string;
  chunks: Map<number, BlobChunk>;
  totalChunks: number;
  resolve: (bytes: Uint8Array | null) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * WebSocket relay transport for blob sync fallback.
 * Provided when a y-websocket provider is available.
 */
export interface BlobRelayTransport {
  /** Send a relay message through the WebSocket connection. */
  sendMessage(msg: BlobRelayMessage): void;
  /** Register a handler for incoming relay messages. Returns unsubscribe. */
  onMessage(handler: (msg: BlobRelayMessage) => void): () => void;
  /** The local connection ID assigned by the server. Set after first relay message received. */
  localConnectionId?: string;
}

export function createBlobSyncChannel(input: {
  webrtcProvider?: {
    room: { webrtcConns: Map<string, { peer: RTCPeerConnection }> } | null;
  } | null;
  db: CoopDexie;
  coopId: string;
  onBlobReceived?: (blobId: string) => void;
  /** Optional WebSocket relay for blob sync when WebRTC is unavailable. */
  relay?: BlobRelayTransport;
}): BlobSyncChannel {
  const { db, coopId, onBlobReceived, relay } = input;
  const dataChannels = new Map<string, RTCDataChannel>();
  const pendingRequests = new Map<string, PendingRequest>();
  const peerManifests = new Map<string, Set<string>>(); // peerId -> Set<blobId>
  const peerListeners = new Map<string, { pc: RTCPeerConnection; handler: (e: Event) => void }>();
  let destroyed = false;
  let disposeRelay: (() => void) | undefined;

  // --- Setup data channels on existing and new peer connections ---

  function setupPeerChannel(peerId: string, pc: RTCPeerConnection) {
    if (destroyed || dataChannels.has(peerId)) return;

    try {
      const channel = pc.createDataChannel(BLOB_CHANNEL_LABEL);
      setupChannelHandlers(peerId, channel);
    } catch {
      // Peer connection may not be in the right state
    }

    // Also listen for channels created by the remote peer
    const handler = (event: Event) => {
      if (destroyed) return;
      const dcEvent = event as RTCDataChannelEvent;
      if (dcEvent.channel.label === BLOB_CHANNEL_LABEL) {
        setupChannelHandlers(peerId, dcEvent.channel);
      }
    };
    pc.addEventListener('datachannel', handler);
    peerListeners.set(peerId, { pc, handler });
  }

  function setupChannelHandlers(peerId: string, channel: RTCDataChannel) {
    dataChannels.set(peerId, channel);

    channel.onopen = () => {
      // Send our manifest when channel opens
      broadcastManifestToPeer(peerId);
    };

    channel.onmessage = (event: MessageEvent) => {
      const msg = decodeBlobSyncMessage(typeof event.data === 'string' ? event.data : '');
      if (!msg) return;
      handleMessage(peerId, msg);
    };

    channel.onclose = () => {
      dataChannels.delete(peerId);
      peerManifests.delete(peerId);
    };
  }

  // --- Message handling (WebRTC data channel) ---

  async function handleMessage(peerId: string, msg: BlobSyncMessage) {
    switch (msg.type) {
      case 'blob-manifest': {
        peerManifests.set(peerId, new Set(msg.blobIds));
        break;
      }

      case 'blob-request': {
        // Peer wants a blob from us -- read and send chunks
        const result = await getCoopBlob(db, msg.blobId);
        const channel = dataChannels.get(peerId);
        if (!channel || channel.readyState !== 'open') break;

        if (!result) {
          channel.send(
            encodeBlobSyncMessage({
              type: 'blob-not-found',
              requestId: msg.requestId,
              blobId: msg.blobId,
            }),
          );
          break;
        }

        const chunks = chunkBlob({
          blobId: msg.blobId,
          requestId: msg.requestId,
          bytes: result.bytes,
        });
        // Send with backpressure: yield between chunks when buffer fills
        for (const chunk of chunks) {
          if (channel.readyState !== 'open') break;
          if (channel.bufferedAmount > SEND_BUFFER_HIGH_WATER) {
            await new Promise<void>((r) => {
              channel.onbufferedamountlow = () => {
                channel.onbufferedamountlow = null;
                r();
              };
              // Fallback timeout in case event never fires
              setTimeout(r, 500);
            });
          }
          channel.send(encodeBlobSyncMessage(chunk));
        }
        break;
      }

      case 'blob-chunk': {
        const pending = pendingRequests.get(msg.requestId);
        if (!pending || pending.blobId !== msg.blobId) break;

        pending.chunks.set(msg.chunkIndex, msg);
        pending.totalChunks = msg.totalChunks;

        // Check if all chunks received
        if (pending.chunks.size === pending.totalChunks) {
          clearTimeout(pending.timeoutId);
          pendingRequests.delete(msg.requestId);
          const bytes = reassembleChunks(Array.from(pending.chunks.values()));
          if (bytes && onBlobReceived) {
            onBlobReceived(msg.blobId);
          }
          pending.resolve(bytes);
        }
        break;
      }

      case 'blob-not-found': {
        const pending = pendingRequests.get(msg.requestId);
        if (pending && pending.blobId === msg.blobId) {
          clearTimeout(pending.timeoutId);
          pendingRequests.delete(msg.requestId);
          pending.resolve(null);
        }
        break;
      }
    }
  }

  // --- WebSocket relay message handling ---

  function handleRelayMessage(msg: BlobRelayMessage) {
    if (destroyed) return;

    switch (msg.type) {
      case 'blob-relay-request': {
        // Another peer is requesting a blob via the relay — respond if we have it
        void handleRelayBlobRequest(msg.blobId, msg.requestId, msg.originConnectionId);
        break;
      }

      case 'blob-relay-chunk': {
        // Convert relay chunk to a regular BlobChunk for pending request handling
        const pending = pendingRequests.get(msg.requestId);
        if (!pending || pending.blobId !== msg.blobId) break;

        const chunk: BlobChunk = {
          type: 'blob-chunk',
          requestId: msg.requestId,
          blobId: msg.blobId,
          chunkIndex: msg.chunkIndex,
          totalChunks: msg.totalChunks,
          data: msg.data,
        };
        pending.chunks.set(chunk.chunkIndex, chunk);
        pending.totalChunks = chunk.totalChunks;

        if (pending.chunks.size === pending.totalChunks) {
          clearTimeout(pending.timeoutId);
          pendingRequests.delete(msg.requestId);
          const bytes = reassembleChunks(Array.from(pending.chunks.values()));
          if (bytes && onBlobReceived) {
            onBlobReceived(msg.blobId);
          }
          pending.resolve(bytes);
        }
        break;
      }

      case 'blob-relay-not-found': {
        const pending = pendingRequests.get(msg.requestId);
        if (pending && pending.blobId === msg.blobId) {
          clearTimeout(pending.timeoutId);
          pendingRequests.delete(msg.requestId);
          pending.resolve(null);
        }
        break;
      }

      case 'blob-relay-manifest': {
        // Track relay peer manifests using the originConnectionId as peerId
        peerManifests.set(`relay:${msg.originConnectionId}`, new Set(msg.blobIds));
        break;
      }
    }
  }

  async function handleRelayBlobRequest(
    blobId: string,
    requestId: string,
    targetConnectionId: string,
  ) {
    if (!relay) return;

    const result = await getCoopBlob(db, blobId);
    if (!result) {
      relay.sendMessage({
        type: 'blob-relay-not-found',
        requestId,
        blobId,
        targetConnectionId,
      });
      return;
    }

    const chunks = chunkBlob({ blobId, requestId, bytes: result.bytes });
    for (const chunk of chunks) {
      if (destroyed) break;
      relay.sendMessage({
        type: 'blob-relay-chunk',
        requestId,
        blobId,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        data: chunk.data,
        targetConnectionId,
      });
    }
  }

  // --- WebSocket relay request ---

  async function requestBlobViaRelay(blobId: string): Promise<Uint8Array | null> {
    if (!relay) return null;

    const requestId = createId('blob-relay-req');

    return new Promise<Uint8Array | null>((resolve) => {
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(requestId);
        resolve(null);
      }, REQUEST_TIMEOUT_MS);

      pendingRequests.set(requestId, {
        blobId,
        requestId,
        chunks: new Map(),
        totalChunks: 0,
        resolve,
        timeoutId,
      });

      relay.sendMessage({
        type: 'blob-relay-request',
        blobId,
        requestId,
        originConnectionId: relay.localConnectionId ?? '',
      });
    });
  }

  // --- Internal helpers ---

  async function broadcastManifestToPeer(peerId: string) {
    const blobs = await listCoopBlobs(db, coopId);
    const channel = dataChannels.get(peerId);
    if (!channel || channel.readyState !== 'open') return;

    channel.send(
      encodeBlobSyncMessage({
        type: 'blob-manifest',
        blobIds: blobs.map((b) => b.blobId),
      }),
    );
  }

  // --- Public API ---

  function broadcastManifest() {
    for (const peerId of dataChannels.keys()) {
      broadcastManifestToPeer(peerId);
    }
    // Also broadcast via relay if available
    if (relay) {
      void listCoopBlobs(db, coopId).then((blobs) => {
        if (destroyed) return;
        relay.sendMessage({
          type: 'blob-relay-manifest',
          blobIds: blobs.map((b) => b.blobId),
          originConnectionId: relay.localConnectionId ?? '',
        });
      });
    }
  }

  function getAvailablePeers(): string[] {
    const peers = Array.from(dataChannels.entries())
      .filter(([, ch]) => ch.readyState === 'open')
      .map(([id]) => id);
    // Include relay as a virtual peer if available
    if (relay) {
      peers.push('ws-relay');
    }
    return peers;
  }

  async function requestBlob(blobId: string): Promise<Uint8Array | null> {
    // First try WebRTC data channels (existing logic)
    const webrtcResult = await requestBlobViaWebRTC(blobId);
    if (webrtcResult) return webrtcResult;

    // Fall back to WebSocket relay
    return requestBlobViaRelay(blobId);
  }

  async function requestBlobViaWebRTC(blobId: string): Promise<Uint8Array | null> {
    // Find a peer that has this blob via manifest
    for (const [peerId, manifest] of peerManifests) {
      if (peerId.startsWith('relay:')) continue; // skip relay manifests
      if (!manifest.has(blobId)) continue;
      const channel = dataChannels.get(peerId);
      if (!channel || channel.readyState !== 'open') continue;

      const requestId = createId('blob-req');

      return new Promise<Uint8Array | null>((resolve) => {
        const timeoutId = setTimeout(() => {
          pendingRequests.delete(requestId);
          resolve(null);
        }, REQUEST_TIMEOUT_MS);

        pendingRequests.set(requestId, {
          blobId,
          requestId,
          chunks: new Map(),
          totalChunks: 0,
          resolve,
          timeoutId,
        });

        channel.send(
          encodeBlobSyncMessage({
            type: 'blob-request',
            blobId,
            requestId,
          }),
        );
      });
    }

    // No peer manifest claims it -- try all connected peers as fallback
    for (const [peerId, channel] of dataChannels) {
      if (channel.readyState !== 'open') continue;
      // Skip peers whose manifest explicitly does not include this blob
      const peerSet = peerManifests.get(peerId);
      if (peerSet && !peerSet.has(blobId)) continue;

      const requestId = createId('blob-req');

      const result = await new Promise<Uint8Array | null>((resolve) => {
        const timeoutId = setTimeout(() => {
          pendingRequests.delete(requestId);
          resolve(null);
        }, REQUEST_TIMEOUT_MS);

        pendingRequests.set(requestId, {
          blobId,
          requestId,
          chunks: new Map(),
          totalChunks: 0,
          resolve,
          timeoutId,
        });

        channel.send(
          encodeBlobSyncMessage({
            type: 'blob-request',
            blobId,
            requestId,
          }),
        );
      });

      if (result) return result;
    }

    return null;
  }

  function destroy() {
    destroyed = true;
    disposeRelay?.();

    for (const [, pending] of pendingRequests) {
      clearTimeout(pending.timeoutId);
      pending.resolve(null);
    }
    pendingRequests.clear();

    for (const [, channel] of dataChannels) {
      try {
        channel.close();
      } catch {
        // already closed
      }
    }
    dataChannels.clear();
    peerManifests.clear();

    // Remove event listeners from peer connections
    for (const [, { pc, handler }] of peerListeners) {
      pc.removeEventListener('datachannel', handler);
    }
    peerListeners.clear();
  }

  // --- Initialize: set up channels for existing peers ---

  const room = input.webrtcProvider?.room;
  if (room) {
    for (const [peerId, conn] of room.webrtcConns) {
      setupPeerChannel(peerId, conn.peer);
    }
  }

  // --- Initialize relay listener ---
  if (relay) {
    disposeRelay = relay.onMessage(handleRelayMessage);
  }

  return {
    requestBlob,
    getAvailablePeers,
    broadcastManifest,
    destroy,
  };
}
