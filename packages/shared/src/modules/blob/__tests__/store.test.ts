import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoopBlobRecord } from '../../../contracts/schema';
import { type CoopDexie, createCoopDb } from '../../storage/db';
import {
  deleteCoopBlob,
  getCoopBlob,
  listCoopBlobs,
  pruneCoopBlobs,
  saveCoopBlob,
  touchCoopBlobAccess,
} from '../store';

const databases: CoopDexie[] = [];

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

function freshDb(): CoopDexie {
  const db = createCoopDb(`coop-blob-store-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

/** Anchor all timestamps relative to a fixed "now" so maxAge calculations are deterministic. */
const FIXED_NOW = new Date('2026-03-13T12:00:00.000Z');
const NOW = FIXED_NOW.toISOString();
const EARLIER = '2026-03-12T12:00:00.000Z';
const MUCH_EARLIER = '2026-03-01T12:00:00.000Z';

function buildBlobRecord(overrides: Partial<CoopBlobRecord> = {}): CoopBlobRecord {
  return {
    blobId: `blob-${crypto.randomUUID()}`,
    sourceEntityId: 'entity-1',
    coopId: 'coop-1',
    mimeType: 'image/png',
    byteSize: 1024,
    kind: 'image',
    origin: 'self',
    createdAt: NOW,
    accessedAt: NOW,
    ...overrides,
  };
}

function makeBytes(size = 1024): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

afterEach(async () => {
  while (databases.length > 0) {
    const db = databases.pop();
    await db?.delete();
  }
});

// ---------------------------------------------------------------------------
// saveCoopBlob + getCoopBlob round-trip
// ---------------------------------------------------------------------------

describe('saveCoopBlob + getCoopBlob round-trip', () => {
  it('saves a blob and retrieves record + decrypted bytes', async () => {
    const db = freshDb();
    const record = buildBlobRecord();
    const bytes = makeBytes(256);

    await saveCoopBlob(db, record, bytes);
    const result = await getCoopBlob(db, record.blobId);

    expect(result).not.toBeNull();
    expect(result?.record.blobId).toBe(record.blobId);
    expect(result?.record.coopId).toBe(record.coopId);
    expect(result?.record.mimeType).toBe('image/png');
    expect(result?.record.kind).toBe('image');
    expect(result?.bytes).toEqual(bytes);
  });

  it('returns null for a non-existent blob', async () => {
    const db = freshDb();
    expect(await getCoopBlob(db, 'no-such-blob')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteCoopBlob
// ---------------------------------------------------------------------------

describe('deleteCoopBlob', () => {
  it('removes both metadata and encrypted payload', async () => {
    const db = freshDb();
    const record = buildBlobRecord();
    const bytes = makeBytes();

    await saveCoopBlob(db, record, bytes);
    expect(await getCoopBlob(db, record.blobId)).not.toBeNull();

    await deleteCoopBlob(db, record.blobId);
    expect(await getCoopBlob(db, record.blobId)).toBeNull();
  });

  it('does not throw when deleting a non-existent blob', async () => {
    const db = freshDb();
    await expect(deleteCoopBlob(db, 'no-such-blob')).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// listCoopBlobs
// ---------------------------------------------------------------------------

describe('listCoopBlobs', () => {
  it('returns blobs for the specified coopId only', async () => {
    const db = freshDb();
    const blobA = buildBlobRecord({ coopId: 'coop-a' });
    const blobB = buildBlobRecord({ coopId: 'coop-b' });
    const blobA2 = buildBlobRecord({ coopId: 'coop-a' });

    await saveCoopBlob(db, blobA, makeBytes());
    await saveCoopBlob(db, blobB, makeBytes());
    await saveCoopBlob(db, blobA2, makeBytes());

    const listA = await listCoopBlobs(db, 'coop-a');
    expect(listA).toHaveLength(2);
    expect(listA.every((r) => r.coopId === 'coop-a')).toBe(true);

    const listB = await listCoopBlobs(db, 'coop-b');
    expect(listB).toHaveLength(1);
    expect(listB[0].blobId).toBe(blobB.blobId);
  });

  it('returns empty array when no blobs exist for coopId', async () => {
    const db = freshDb();
    expect(await listCoopBlobs(db, 'coop-empty')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// touchCoopBlobAccess
// ---------------------------------------------------------------------------

describe('touchCoopBlobAccess', () => {
  it('updates the accessedAt timestamp', async () => {
    const db = freshDb();
    const record = buildBlobRecord({ accessedAt: EARLIER });
    await saveCoopBlob(db, record, makeBytes());

    const beforeResult = await getCoopBlob(db, record.blobId);
    expect(beforeResult).not.toBeNull();
    expect(beforeResult?.record.accessedAt).toBe(EARLIER);

    await touchCoopBlobAccess(db, record.blobId);

    const afterResult = await getCoopBlob(db, record.blobId);
    expect(afterResult).not.toBeNull();
    const after = afterResult?.record.accessedAt ?? '';
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(EARLIER).getTime());
  });
});

// ---------------------------------------------------------------------------
// pruneCoopBlobs
// ---------------------------------------------------------------------------

describe('pruneCoopBlobs', () => {
  it('evicts peer/gateway blobs over budget (LRU), preserves self blobs', async () => {
    const db = freshDb();
    const selfBlob = buildBlobRecord({
      origin: 'self',
      byteSize: 100,
      accessedAt: MUCH_EARLIER,
    });
    const peerBlob = buildBlobRecord({
      origin: 'peer',
      byteSize: 100,
      accessedAt: EARLIER,
    });
    const gatewayBlob = buildBlobRecord({
      origin: 'gateway',
      byteSize: 100,
      accessedAt: NOW,
    });

    await saveCoopBlob(db, selfBlob, makeBytes(100));
    await saveCoopBlob(db, peerBlob, makeBytes(100));
    await saveCoopBlob(db, gatewayBlob, makeBytes(100));

    // Budget only allows 250 bytes total -> peer blob (oldest evictable) should be evicted
    // Total is 300 (self=100 + peer=100 + gateway=100), so one eviction brings it to 200.
    const evicted = await pruneCoopBlobs(db, { maxTotalBytes: 250 });

    expect(evicted).toBe(1);
    // self blob is always preserved
    expect(await getCoopBlob(db, selfBlob.blobId)).not.toBeNull();
    // peer blob was oldest evictable and pushed total over budget
    expect(await getCoopBlob(db, peerBlob.blobId)).toBeNull();
    // gateway blob survives (within budget after peer evicted)
    expect(await getCoopBlob(db, gatewayBlob.blobId)).not.toBeNull();
  });

  it('evicts blobs older than maxAge regardless of budget', async () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW.getTime());
    try {
      const db = freshDb();
      const oldBlob = buildBlobRecord({
        origin: 'peer',
        byteSize: 10,
        accessedAt: MUCH_EARLIER,
      });
      const freshBlob = buildBlobRecord({
        origin: 'peer',
        byteSize: 10,
        accessedAt: NOW,
      });

      await saveCoopBlob(db, oldBlob, makeBytes(10));
      await saveCoopBlob(db, freshBlob, makeBytes(10));

      // maxAge = 1 day in ms; MUCH_EARLIER is ~12 days before FIXED_NOW
      const evicted = await pruneCoopBlobs(db, {
        maxTotalBytes: 1_000_000,
        maxAge: 24 * 60 * 60 * 1000,
      });

      expect(evicted).toBeGreaterThanOrEqual(1);
      expect(await getCoopBlob(db, oldBlob.blobId)).toBeNull();
      expect(await getCoopBlob(db, freshBlob.blobId)).not.toBeNull();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('never evicts self-origin blobs even if over budget', async () => {
    const db = freshDb();
    const selfBlob = buildBlobRecord({
      origin: 'self',
      byteSize: 500,
      accessedAt: MUCH_EARLIER,
    });

    await saveCoopBlob(db, selfBlob, makeBytes(500));

    const evicted = await pruneCoopBlobs(db, { maxTotalBytes: 100 });

    expect(evicted).toBe(0);
    expect(await getCoopBlob(db, selfBlob.blobId)).not.toBeNull();
  });

  it('returns 0 when no blobs exist', async () => {
    const db = freshDb();
    expect(await pruneCoopBlobs(db)).toBe(0);
  });
});
