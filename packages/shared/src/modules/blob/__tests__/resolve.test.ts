import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactAttachment, CoopBlobRecord } from '../../../contracts/schema';
import { fetchBlobFromGateway, resolveBlob } from '../resolve';
import type { BlobSyncChannel } from '../sync';

// Mock the store module
vi.mock('../store', () => ({
  getCoopBlob: vi.fn(),
  saveCoopBlob: vi.fn(),
  touchCoopBlobAccess: vi.fn(),
}));

// Mock global fetch for gateway tests
vi.stubGlobal('fetch', vi.fn());

import { getCoopBlob, saveCoopBlob, touchCoopBlobAccess } from '../store';

// biome-ignore lint/suspicious/noExplicitAny: mock for test
const mockDb = {} as any;

const testAttachment: ArtifactAttachment = {
  blobId: 'blob-123',
  mimeType: 'image/webp',
  byteSize: 5000,
  kind: 'image',
};

const testBytes = new Uint8Array([1, 2, 3, 4, 5]);

describe('resolveBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves from local store (Tier 1)', async () => {
    const localRecord: CoopBlobRecord = {
      blobId: 'blob-123',
      sourceEntityId: 'capture-1',
      coopId: 'coop-1',
      mimeType: 'image/webp',
      byteSize: 5,
      kind: 'image',
      origin: 'self',
      createdAt: '2026-01-01T00:00:00.000Z',
      accessedAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(getCoopBlob).mockResolvedValue({ record: localRecord, bytes: testBytes });

    const result = await resolveBlob({
      db: mockDb,
      blobId: 'blob-123',
      attachment: testAttachment,
      coopId: 'coop-1',
    });

    expect(result).toEqual({ bytes: testBytes, source: 'self' });
    expect(touchCoopBlobAccess).toHaveBeenCalledWith(mockDb, 'blob-123');
    expect(saveCoopBlob).not.toHaveBeenCalled();
  });

  it('falls back to peer (Tier 2) when not local', async () => {
    vi.mocked(getCoopBlob).mockResolvedValue(null);

    const mockBlobSync: BlobSyncChannel = {
      requestBlob: vi.fn().mockResolvedValue(testBytes),
      getAvailablePeers: vi.fn().mockReturnValue(['peer-1']),
      broadcastManifest: vi.fn(),
      destroy: vi.fn(),
    };

    const result = await resolveBlob({
      db: mockDb,
      blobId: 'blob-123',
      attachment: testAttachment,
      coopId: 'coop-1',
      blobSync: mockBlobSync,
    });

    expect(result).toEqual({ bytes: testBytes, source: 'peer' });
    expect(mockBlobSync.requestBlob).toHaveBeenCalledWith('blob-123');
    expect(saveCoopBlob).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ blobId: 'blob-123', origin: 'peer', kind: 'image' }),
      testBytes,
    );
  });

  it('falls back to gateway (Tier 3) when not local or peer', async () => {
    vi.mocked(getCoopBlob).mockResolvedValue(null);

    const mockBlobSync: BlobSyncChannel = {
      requestBlob: vi.fn().mockResolvedValue(null),
      getAvailablePeers: vi.fn().mockReturnValue([]),
      broadcastManifest: vi.fn(),
      destroy: vi.fn(),
    };

    const attachmentWithCid = { ...testAttachment, archiveCid: 'bafytest123' };

    // Mock fetch for gateway
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(testBytes.buffer),
    } as Response);

    const result = await resolveBlob({
      db: mockDb,
      blobId: 'blob-123',
      attachment: attachmentWithCid,
      coopId: 'coop-1',
      blobSync: mockBlobSync,
    });

    expect(result).toEqual({ bytes: expect.any(Uint8Array), source: 'gateway' });
    expect(saveCoopBlob).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ blobId: 'blob-123', origin: 'gateway' }),
      expect.any(Uint8Array),
    );
  });

  it('returns null when all tiers fail', async () => {
    vi.mocked(getCoopBlob).mockResolvedValue(null);

    const result = await resolveBlob({
      db: mockDb,
      blobId: 'blob-123',
      attachment: testAttachment,
      coopId: 'coop-1',
    });

    expect(result).toBeNull();
  });

  it('skips peer tier when no blobSync provided', async () => {
    vi.mocked(getCoopBlob).mockResolvedValue(null);

    const result = await resolveBlob({
      db: mockDb,
      blobId: 'blob-123',
      attachment: testAttachment,
      coopId: 'coop-1',
      // no blobSync
    });

    expect(result).toBeNull();
  });

  it('skips gateway tier when no archiveCid', async () => {
    vi.mocked(getCoopBlob).mockResolvedValue(null);

    const mockBlobSync: BlobSyncChannel = {
      requestBlob: vi.fn().mockResolvedValue(null),
      getAvailablePeers: vi.fn().mockReturnValue([]),
      broadcastManifest: vi.fn(),
      destroy: vi.fn(),
    };

    const result = await resolveBlob({
      db: mockDb,
      blobId: 'blob-123',
      attachment: testAttachment, // no archiveCid
      coopId: 'coop-1',
      blobSync: mockBlobSync,
    });

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('fetchBlobFromGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches bytes from gateway URL', async () => {
    const responseBytes = new Uint8Array([10, 20, 30]);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(responseBytes.buffer),
    } as Response);

    const result = await fetchBlobFromGateway('bafyabc123');

    expect(fetch).toHaveBeenCalledWith(
      'https://storacha.link/ipfs/bafyabc123',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result).toEqual(responseBytes);
  });

  it('returns null on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    const result = await fetchBlobFromGateway('bafyabc123');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
    const result = await fetchBlobFromGateway('bafyabc123');
    expect(result).toBeNull();
  });

  it('uses custom gateway base URL', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as Response);

    await fetchBlobFromGateway('bafyabc123', 'https://custom-gw.example.com');

    expect(fetch).toHaveBeenCalledWith(
      'https://custom-gw.example.com/ipfs/bafyabc123',
      expect.anything(),
    );
  });
});
