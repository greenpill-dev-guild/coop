import type { CoopBlobRecord } from '../../contracts/schema';
import { nowIso } from '../../utils';
import {
  type CoopDexie,
  buildEncryptedLocalPayloadId,
  buildEncryptedLocalPayloadRecord,
  decryptEncryptedLocalPayloadRecord,
  getEncryptedLocalPayloadRecord,
} from '../storage/db';

const DEFAULT_MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB

export async function saveCoopBlob(
  db: CoopDexie,
  record: CoopBlobRecord,
  bytes: Uint8Array,
): Promise<void> {
  const payload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'coop-blob',
    entityId: record.blobId,
    bytes,
  });

  await db.transaction('rw', db.coopBlobs, db.encryptedLocalPayloads, async () => {
    await db.coopBlobs.put(record);
    await db.encryptedLocalPayloads.put(payload);
  });
}

export async function getCoopBlob(
  db: CoopDexie,
  blobId: string,
): Promise<{ record: CoopBlobRecord; bytes: Uint8Array } | null> {
  const record = await db.coopBlobs.get(blobId);
  if (!record) {
    return null;
  }

  const encryptedPayload = await getEncryptedLocalPayloadRecord(db, 'coop-blob', blobId);
  if (!encryptedPayload) {
    return null;
  }

  try {
    const bytes = await decryptEncryptedLocalPayloadRecord(db, encryptedPayload);
    return { record, bytes };
  } catch (error) {
    console.warn(
      `[blob-store] Failed to decrypt blob payload for ${blobId}. Returning null.`,
      error,
    );
    return null;
  }
}

export async function deleteCoopBlob(db: CoopDexie, blobId: string): Promise<void> {
  await db.transaction('rw', db.coopBlobs, db.encryptedLocalPayloads, async () => {
    await db.coopBlobs.delete(blobId);
    await db.encryptedLocalPayloads.delete(buildEncryptedLocalPayloadId('coop-blob', blobId));
  });
}

export async function listCoopBlobs(db: CoopDexie, coopId: string): Promise<CoopBlobRecord[]> {
  return db.coopBlobs.where('coopId').equals(coopId).toArray();
}

export async function touchCoopBlobAccess(db: CoopDexie, blobId: string): Promise<void> {
  await db.coopBlobs.update(blobId, { accessedAt: nowIso() });
}

export async function pruneCoopBlobs(
  db: CoopDexie,
  options?: { maxTotalBytes?: number; maxAge?: number },
): Promise<number> {
  const maxTotalBytes = options?.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const maxAge = options?.maxAge;
  const now = Date.now();
  let evictedCount = 0;

  const allBlobs = await db.coopBlobs.toArray();

  // Phase 1: evict aged-out non-self blobs
  if (maxAge !== undefined) {
    const agedOut = allBlobs.filter(
      (b) => b.origin !== 'self' && now - new Date(b.accessedAt).getTime() > maxAge,
    );
    for (const blob of agedOut) {
      await deleteCoopBlob(db, blob.blobId);
      evictedCount++;
    }
  }

  // Phase 2: LRU eviction of non-self blobs when over budget
  // Re-read after age eviction
  const remaining = await db.coopBlobs.toArray();
  const totalBytes = remaining.reduce((sum, b) => sum + b.byteSize, 0);

  if (totalBytes > maxTotalBytes) {
    // Sort evictable blobs by accessedAt ascending (oldest first)
    const evictable = remaining
      .filter((b) => b.origin !== 'self')
      .sort((a, b) => new Date(a.accessedAt).getTime() - new Date(b.accessedAt).getTime());

    let currentTotal = totalBytes;
    for (const blob of evictable) {
      if (currentTotal <= maxTotalBytes) break;
      await deleteCoopBlob(db, blob.blobId);
      currentTotal -= blob.byteSize;
      evictedCount++;
    }
  }

  return evictedCount;
}
