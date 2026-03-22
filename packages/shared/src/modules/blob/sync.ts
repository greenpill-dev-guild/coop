import type { BlobKind } from '../../contracts/schema';

// --- Protocol message types ---

export interface BlobRequest {
  type: 'blob-request';
  blobId: string;
  requestId: string;
}

export interface BlobChunk {
  type: 'blob-chunk';
  requestId: string;
  blobId: string;
  chunkIndex: number;
  totalChunks: number;
  data: Uint8Array;
}

export interface BlobNotFound {
  type: 'blob-not-found';
  requestId: string;
  blobId: string;
}

export interface BlobManifest {
  type: 'blob-manifest';
  blobIds: string[];
}

export type BlobSyncMessage = BlobRequest | BlobChunk | BlobNotFound | BlobManifest;

// --- Constants ---

/** 64KB chunk size fits within WebRTC data channel message limits */
export const BLOB_CHUNK_SIZE = 64 * 1024;

// --- Chunking utilities ---

/** Split a byte array into BLOB_CHUNK_SIZE chunks for transfer */
export function chunkBlob(input: {
  blobId: string;
  requestId: string;
  bytes: Uint8Array;
}): BlobChunk[] {
  const { blobId, requestId, bytes } = input;
  const totalChunks = Math.max(1, Math.ceil(bytes.length / BLOB_CHUNK_SIZE));
  const chunks: BlobChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * BLOB_CHUNK_SIZE;
    const end = Math.min(start + BLOB_CHUNK_SIZE, bytes.length);
    chunks.push({
      type: 'blob-chunk',
      requestId,
      blobId,
      chunkIndex: i,
      totalChunks,
      data: bytes.slice(start, end),
    });
  }

  return chunks;
}

/** Reassemble chunks into a complete byte array. Returns null if chunks are incomplete or mismatched. */
export function reassembleChunks(chunks: BlobChunk[]): Uint8Array | null {
  if (chunks.length === 0) return null;

  const { totalChunks, blobId, requestId } = chunks[0];

  // Verify all chunks belong to the same request
  if (
    !chunks.every(
      (c) => c.blobId === blobId && c.requestId === requestId && c.totalChunks === totalChunks,
    )
  ) {
    return null;
  }

  // Verify we have all chunks
  if (chunks.length !== totalChunks) return null;

  // Sort by index
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

  // Verify contiguous indices
  if (!sorted.every((c, i) => c.chunkIndex === i)) return null;

  // Calculate total size and assemble
  const totalSize = sorted.reduce((sum, c) => sum + c.data.length, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of sorted) {
    result.set(chunk.data, offset);
    offset += chunk.data.length;
  }

  return result;
}

// --- Serialization (JSON with base64 for binary data) ---

/** Encode a BlobSyncMessage to a string for WebRTC data channel transport */
export function encodeBlobSyncMessage(msg: BlobSyncMessage): string {
  if (msg.type === 'blob-chunk') {
    // Encode data as base64 for JSON transport
    const bytes = msg.data;
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return JSON.stringify({
      ...msg,
      data: btoa(binary),
      _encoding: 'base64',
    });
  }
  return JSON.stringify(msg);
}

/** Decode a BlobSyncMessage from a string received via WebRTC data channel */
export function decodeBlobSyncMessage(raw: string): BlobSyncMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.type !== 'string') return null;

    if (parsed.type === 'blob-chunk' && parsed._encoding === 'base64') {
      const binary = atob(parsed.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const { _encoding, ...rest } = parsed;
      return { ...rest, data: bytes } as BlobChunk;
    }

    return parsed as BlobSyncMessage;
  } catch {
    return null;
  }
}

// --- Sync policy ---

/** Blob kinds that should be eagerly pushed to all peers on publish */
export const EAGER_SYNC_KINDS: ReadonlySet<BlobKind> = new Set(['audio-transcript', 'image']);

/** Blob kinds that are fetched on-demand when a peer views/plays them */
export const LAZY_SYNC_KINDS: ReadonlySet<BlobKind> = new Set(['audio-source', 'file']);

export function isEagerSyncKind(kind: BlobKind): boolean {
  return EAGER_SYNC_KINDS.has(kind);
}

/** Interface for the blob sync channel (see channel.ts) */
export interface BlobSyncChannel {
  requestBlob(blobId: string): Promise<Uint8Array | null>;
  getAvailablePeers(): string[];
  broadcastManifest(): void;
  destroy(): void;
}
