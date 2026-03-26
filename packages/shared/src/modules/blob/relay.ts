import z from 'zod';

// --- Message type constant ---

/**
 * WebSocket relay message type identifier.
 * yjs-sync uses 0 (sync) and 1 (awareness); blob relay uses 2.
 */
export const MESSAGE_BLOB_RELAY = 2;

// --- Protocol message types (TypeScript interfaces) ---

export interface BlobRelayRequest {
  type: 'blob-relay-request';
  blobId: string;
  requestId: string;
  originConnectionId: string;
}

export interface BlobRelayChunk {
  type: 'blob-relay-chunk';
  requestId: string;
  blobId: string;
  chunkIndex: number;
  totalChunks: number;
  data: Uint8Array;
  targetConnectionId: string;
}

export interface BlobRelayNotFound {
  type: 'blob-relay-not-found';
  requestId: string;
  blobId: string;
  targetConnectionId: string;
}

export interface BlobRelayManifest {
  type: 'blob-relay-manifest';
  blobIds: string[];
  originConnectionId: string;
}

export type BlobRelayMessage =
  | BlobRelayRequest
  | BlobRelayChunk
  | BlobRelayNotFound
  | BlobRelayManifest;

// --- Zod schemas (trust boundary — messages arrive from server WS) ---

export const blobRelayRequestSchema = z.object({
  type: z.literal('blob-relay-request'),
  blobId: z.string(),
  requestId: z.string(),
  originConnectionId: z.string(),
});

export const blobRelayChunkSchema = z.object({
  type: z.literal('blob-relay-chunk'),
  requestId: z.string(),
  blobId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  totalChunks: z.number().int().positive(),
  data: z.instanceof(Uint8Array),
  targetConnectionId: z.string(),
});

export const blobRelayNotFoundSchema = z.object({
  type: z.literal('blob-relay-not-found'),
  requestId: z.string(),
  blobId: z.string(),
  targetConnectionId: z.string(),
});

export const blobRelayManifestSchema = z.object({
  type: z.literal('blob-relay-manifest'),
  blobIds: z.array(z.string()),
  originConnectionId: z.string(),
});

export const blobRelayMessageSchema = z.discriminatedUnion('type', [
  blobRelayRequestSchema,
  blobRelayChunkSchema,
  blobRelayNotFoundSchema,
  blobRelayManifestSchema,
]);

// --- Serialization (JSON with base64 for binary data) ---

/** Encode a BlobRelayMessage to a JSON string for WebSocket relay transport */
export function encodeBlobRelayMessage(msg: BlobRelayMessage): string {
  if (msg.type === 'blob-relay-chunk') {
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

/** Decode a BlobRelayMessage from a JSON string received via WebSocket relay */
export function decodeBlobRelayMessage(raw: string): BlobRelayMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return null;

    if (parsed.type === 'blob-relay-chunk' && parsed._encoding === 'base64') {
      const binary = atob(parsed.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const { _encoding, ...rest } = parsed;
      return { ...rest, data: bytes } as BlobRelayChunk;
    }

    return parsed as BlobRelayMessage;
  } catch {
    return null;
  }
}
