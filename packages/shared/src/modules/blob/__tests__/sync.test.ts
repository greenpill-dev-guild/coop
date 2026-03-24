import { describe, expect, it } from 'vitest';
import type { BlobKind } from '../../../contracts/schema';
import {
  BLOB_CHUNK_SIZE,
  type BlobChunk,
  type BlobManifest,
  type BlobNotFound,
  type BlobRequest,
  EAGER_SYNC_KINDS,
  LAZY_SYNC_KINDS,
  chunkBlob,
  decodeBlobSyncMessage,
  encodeBlobSyncMessage,
  isEagerSyncKind,
  reassembleChunks,
} from '../sync';

describe('chunkBlob', () => {
  it('produces a single chunk for small data', () => {
    const bytes = new Uint8Array(100);
    bytes.fill(42);
    const chunks = chunkBlob({ blobId: 'b1', requestId: 'r1', bytes });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].totalChunks).toBe(1);
    expect(chunks[0].data).toEqual(bytes);
    expect(chunks[0].type).toBe('blob-chunk');
    expect(chunks[0].blobId).toBe('b1');
    expect(chunks[0].requestId).toBe('r1');
  });

  it('splits data into multiple chunks at BLOB_CHUNK_SIZE boundaries', () => {
    const size = BLOB_CHUNK_SIZE * 2 + 100;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i % 256;

    const chunks = chunkBlob({ blobId: 'b2', requestId: 'r2', bytes });

    expect(chunks).toHaveLength(3);
    expect(chunks[0].data.length).toBe(BLOB_CHUNK_SIZE);
    expect(chunks[1].data.length).toBe(BLOB_CHUNK_SIZE);
    expect(chunks[2].data.length).toBe(100);
    expect(chunks.every((c) => c.totalChunks === 3)).toBe(true);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2]);
  });

  it('handles empty data with a single empty chunk', () => {
    const chunks = chunkBlob({ blobId: 'b3', requestId: 'r3', bytes: new Uint8Array(0) });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].data.length).toBe(0);
    expect(chunks[0].totalChunks).toBe(1);
  });
});

describe('reassembleChunks', () => {
  it('reassembles chunked data correctly', () => {
    const original = new Uint8Array(BLOB_CHUNK_SIZE * 2 + 500);
    for (let i = 0; i < original.length; i++) original[i] = i % 256;

    const chunks = chunkBlob({ blobId: 'b1', requestId: 'r1', bytes: original });
    const reassembled = reassembleChunks(chunks);

    expect(reassembled).not.toBeNull();
    expect(reassembled?.length).toBe(original.length);
    // Byte-level comparison avoids Vitest deep-equality overhead on large Uint8Arrays
    expect(Buffer.compare(Buffer.from(reassembled as Uint8Array), Buffer.from(original))).toBe(0);
  });

  it('reassembles out-of-order chunks', () => {
    const original = new Uint8Array(BLOB_CHUNK_SIZE + 100);
    original.fill(99);

    const chunks = chunkBlob({ blobId: 'b1', requestId: 'r1', bytes: original });
    const reversed = [...chunks].reverse();
    const reassembled = reassembleChunks(reversed);

    expect(reassembled).not.toBeNull();
    expect(reassembled?.length).toBe(original.length);
    expect(Buffer.compare(Buffer.from(reassembled as Uint8Array), Buffer.from(original))).toBe(0);
  });

  it('returns null for empty chunks array', () => {
    expect(reassembleChunks([])).toBeNull();
  });

  it('returns null for incomplete chunks', () => {
    const chunks = chunkBlob({
      blobId: 'b1',
      requestId: 'r1',
      bytes: new Uint8Array(BLOB_CHUNK_SIZE * 3),
    });
    // Remove one chunk
    const incomplete = chunks.slice(0, 2);
    expect(reassembleChunks(incomplete)).toBeNull();
  });

  it('returns null for mismatched blobIds', () => {
    const chunks = chunkBlob({
      blobId: 'b1',
      requestId: 'r1',
      bytes: new Uint8Array(BLOB_CHUNK_SIZE * 2),
    });
    chunks[1] = { ...chunks[1], blobId: 'b-different' };
    expect(reassembleChunks(chunks)).toBeNull();
  });
});

describe('encode/decode BlobSyncMessage', () => {
  it('round-trips a BlobRequest', () => {
    const msg: BlobRequest = { type: 'blob-request', blobId: 'b1', requestId: 'r1' };
    const encoded = encodeBlobSyncMessage(msg);
    const decoded = decodeBlobSyncMessage(encoded);
    expect(decoded).toEqual(msg);
  });

  it('round-trips a BlobNotFound', () => {
    const msg: BlobNotFound = { type: 'blob-not-found', blobId: 'b1', requestId: 'r1' };
    const encoded = encodeBlobSyncMessage(msg);
    const decoded = decodeBlobSyncMessage(encoded);
    expect(decoded).toEqual(msg);
  });

  it('round-trips a BlobManifest', () => {
    const msg: BlobManifest = { type: 'blob-manifest', blobIds: ['b1', 'b2', 'b3'] };
    const encoded = encodeBlobSyncMessage(msg);
    const decoded = decodeBlobSyncMessage(encoded);
    expect(decoded).toEqual(msg);
  });

  it('round-trips a BlobChunk with binary data', () => {
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;

    const msg: BlobChunk = {
      type: 'blob-chunk',
      requestId: 'r1',
      blobId: 'b1',
      chunkIndex: 0,
      totalChunks: 1,
      data,
    };
    const encoded = encodeBlobSyncMessage(msg);
    const decoded = decodeBlobSyncMessage(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.type).toBe('blob-chunk');
    expect((decoded as BlobChunk).data).toEqual(data);
  });

  it('returns null for invalid JSON', () => {
    expect(decodeBlobSyncMessage('not json')).toBeNull();
  });

  it('returns null for missing type field', () => {
    expect(decodeBlobSyncMessage('{"blobId":"b1"}')).toBeNull();
  });
});

describe('blob sync policy', () => {
  it('classifies audio-transcript and image as eager sync', () => {
    expect(EAGER_SYNC_KINDS.has('audio-transcript')).toBe(true);
    expect(EAGER_SYNC_KINDS.has('image')).toBe(true);
  });

  it('classifies audio-source and file as lazy sync', () => {
    expect(LAZY_SYNC_KINDS.has('audio-source')).toBe(true);
    expect(LAZY_SYNC_KINDS.has('file')).toBe(true);
  });

  it('isEagerSyncKind returns true for eager kinds and false for lazy kinds', () => {
    expect(isEagerSyncKind('audio-transcript')).toBe(true);
    expect(isEagerSyncKind('image')).toBe(true);
    expect(isEagerSyncKind('audio-source')).toBe(false);
    expect(isEagerSyncKind('file')).toBe(false);
  });

  it('every BlobKind is classified in exactly one policy set', () => {
    const allKinds: BlobKind[] = ['image', 'audio-source', 'audio-transcript', 'file'];
    for (const kind of allKinds) {
      const inEager = EAGER_SYNC_KINDS.has(kind);
      const inLazy = LAZY_SYNC_KINDS.has(kind);
      expect(inEager || inLazy).toBe(true);
      expect(inEager && inLazy).toBe(false);
    }
  });
});
