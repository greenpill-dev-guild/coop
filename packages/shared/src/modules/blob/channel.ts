import { createId } from '../../utils';
import type { CoopDexie } from '../storage/db';
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

export function createBlobSyncChannel(input: {
  webrtcProvider: {
    room: { webrtcConns: Map<string, { peer: RTCPeerConnection }> } | null;
  };
  db: CoopDexie;
  coopId: string;
  onBlobReceived?: (blobId: string) => void;
}): BlobSyncChannel {
  const { db, coopId, onBlobReceived } = input;
  const dataChannels = new Map<string, RTCDataChannel>();
  const pendingRequests = new Map<string, PendingRequest>();
  const peerManifests = new Map<string, Set<string>>(); // peerId -> Set<blobId>
  const peerListeners = new Map<string, { pc: RTCPeerConnection; handler: (e: Event) => void }>();
  let destroyed = false;

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

  // --- Message handling ---

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
  }

  function getAvailablePeers(): string[] {
    return Array.from(dataChannels.entries())
      .filter(([, ch]) => ch.readyState === 'open')
      .map(([id]) => id);
  }

  async function requestBlob(blobId: string): Promise<Uint8Array | null> {
    // Find a peer that has this blob via manifest
    for (const [peerId, manifest] of peerManifests) {
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

  const room = input.webrtcProvider.room;
  if (room) {
    for (const [peerId, conn] of room.webrtcConns) {
      setupPeerChannel(peerId, conn.peer);
    }
  }

  return {
    requestBlob,
    getAvailablePeers,
    broadcastManifest,
    destroy,
  };
}
