import { createId, nowIso } from '../../utils';
import type {
  CoopDexie,
  SyncOutboxEntry,
  SyncOutboxEntryStatus,
  SyncOutboxEntryType,
} from '../storage/db';

const OUTBOX_PRUNE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates a new outbox entry for a pending sync operation.
 * @param input - Entry parameters
 * @param input.coopId - The coop this sync operation belongs to
 * @param input.type - The type of sync operation (artifact-publish or state-update)
 * @param input.entityKey - Unique key identifying the change (e.g., artifact ID) for dedup
 * @returns A new SyncOutboxEntry with 'pending' status and zero retry count
 */
export function createOutboxEntry(input: {
  coopId: string;
  type: SyncOutboxEntryType;
  entityKey: string;
}): SyncOutboxEntry {
  return {
    id: createId('outbox'),
    coopId: input.coopId,
    type: input.type,
    entityKey: input.entityKey,
    createdAt: nowIso(),
    status: 'pending',
    retryCount: 0,
  };
}

/**
 * Persists an outbox entry to the database.
 * @param db - Dexie database instance
 * @param entry - The outbox entry to store
 */
export async function addOutboxEntry(db: CoopDexie, entry: SyncOutboxEntry): Promise<void> {
  await db.syncOutbox.put(entry);
}

/**
 * Marks an outbox entry as successfully synced.
 * @param db - Dexie database instance
 * @param id - The outbox entry ID to mark
 */
export async function markOutboxSynced(db: CoopDexie, id: string): Promise<void> {
  await db.syncOutbox.update(id, {
    status: 'synced' satisfies SyncOutboxEntryStatus,
    syncedAt: nowIso(),
  });
}

/**
 * Marks an outbox entry as failed, incrementing its retry count.
 * @param db - Dexie database instance
 * @param id - The outbox entry ID to mark
 * @param error - Error message describing the failure
 */
export async function markOutboxFailed(db: CoopDexie, id: string, error: string): Promise<void> {
  const entry = await db.syncOutbox.get(id);
  if (!entry) return;
  await db.syncOutbox.update(id, {
    status: 'failed' satisfies SyncOutboxEntryStatus,
    retryCount: entry.retryCount + 1,
    lastError: error,
  });
}

/**
 * Retrieves all pending outbox entries for a specific coop.
 * @param db - Dexie database instance
 * @param coopId - The coop to query pending entries for
 * @returns Array of pending outbox entries
 */
export async function getPendingOutboxEntries(
  db: CoopDexie,
  coopId: string,
): Promise<SyncOutboxEntry[]> {
  return db.syncOutbox.where({ coopId, status: 'pending' }).toArray();
}

/** Get the count of pending outbox entries across all coops. */
export async function getPendingOutboxCount(db: CoopDexie): Promise<number> {
  return db.syncOutbox.where('status').equals('pending').count();
}

/** Prune old synced/failed entries beyond the retention period. */
export async function pruneOutbox(db: CoopDexie): Promise<number> {
  const cutoff = new Date(Date.now() - OUTBOX_PRUNE_AGE_MS).toISOString();
  const staleEntries = await db.syncOutbox
    .where('status')
    .anyOf('synced', 'failed')
    .and((entry) => entry.createdAt < cutoff)
    .toArray();

  if (staleEntries.length === 0) return 0;

  await db.syncOutbox.bulkDelete(staleEntries.map((e) => e.id));
  return staleEntries.length;
}

/** Mark outbox entries as synced when their entity keys appear in the shared state. */
export async function reconcileOutbox(
  db: CoopDexie,
  coopId: string,
  syncedEntityKeys: Set<string>,
): Promise<number> {
  const pending = await getPendingOutboxEntries(db, coopId);
  let count = 0;
  for (const entry of pending) {
    if (syncedEntityKeys.has(entry.entityKey)) {
      await markOutboxSynced(db, entry.id);
      count++;
    }
  }
  return count;
}
