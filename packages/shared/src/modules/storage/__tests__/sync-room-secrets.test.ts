import { afterEach, describe, expect, it } from 'vitest';
import { createSyncRoomConfig } from '../../coop';
import {
  type CoopDexie,
  createCoopDb,
  ensureSyncRoomSecretRecord,
  getSyncRoomSecretRecord,
  hydrateSyncRoomWithSecret,
  isRedactedSyncRoomSecret,
  redactSyncRoomSecrets,
} from '../db';

const databases: CoopDexie[] = [];
const STORAGE_CRYPTO_TEST_TIMEOUT_MS = 20_000;

function freshDb(): CoopDexie {
  const db = createCoopDb(`coop-sync-secret-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

afterEach(async () => {
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases.length = 0;
});

describe('sync room secret persistence', () => {
  it(
    'migrates a legacy room secret into encrypted local payload storage',
    async () => {
      const db = freshDb();
      const room = createSyncRoomConfig('coop-secret-test');

      const migrated = await ensureSyncRoomSecretRecord(db, room);
      const loaded = await getSyncRoomSecretRecord(db, room.coopId);
      const encryptedPayload = await db.encryptedLocalPayloads.get(
        `sync-room-secret:${room.coopId}`,
      );

      expect(migrated?.roomSecret).toBe(room.roomSecret);
      expect(loaded?.inviteSigningSecret).toBe(room.inviteSigningSecret);
      expect(encryptedPayload).toBeDefined();
      expect(encryptedPayload?.ciphertext).not.toContain(room.roomSecret);
    },
    STORAGE_CRYPTO_TEST_TIMEOUT_MS,
  );

  it(
    'hydrates a redacted public room from the local secret record',
    async () => {
      const db = freshDb();
      const room = createSyncRoomConfig('coop-redacted-test');
      const record = await ensureSyncRoomSecretRecord(db, room);
      const redacted = redactSyncRoomSecrets(room);

      expect(isRedactedSyncRoomSecret(redacted.roomSecret)).toBe(true);
      expect(hydrateSyncRoomWithSecret(redacted, record)).toMatchObject({
        roomId: room.roomId,
        roomSecret: room.roomSecret,
        inviteSigningSecret: room.inviteSigningSecret,
      });
    },
    STORAGE_CRYPTO_TEST_TIMEOUT_MS,
  );
});
