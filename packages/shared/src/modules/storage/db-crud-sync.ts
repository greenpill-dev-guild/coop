import z from 'zod';
import { type SyncRoomConfig, syncRoomConfigSchema } from '../../contracts/schema';
import { nowIso } from '../../utils';
import {
  buildEncryptedLocalPayloadId,
  buildEncryptedLocalPayloadRecord,
  decryptEncryptedLocalPayloadRecord,
  getEncryptedLocalPayloadRecord,
} from './db-encryption';
import type { CoopDexie } from './db-schema';

const syncRoomSecretRecordSchema = z.object({
  coopId: z.string().min(1),
  roomId: z.string().min(1),
  roomSecret: z.string().min(1),
  inviteSigningSecret: z.string().min(1),
  roomEpoch: z.number().int().nonnegative().default(1),
  legacyCompatible: z.boolean().default(true),
  migratedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SyncRoomSecretRecord = z.infer<typeof syncRoomSecretRecordSchema>;

export function buildRedactedSyncRoomSecret(coopId: string, roomId: string) {
  return `encrypted://local/sync-room-secret/${coopId}/${roomId}`;
}

export function isRedactedSyncRoomSecret(value: string | undefined) {
  return typeof value === 'string' && value.startsWith('encrypted://local/sync-room-secret/');
}

export function redactSyncRoomSecrets(room: SyncRoomConfig): SyncRoomConfig {
  return syncRoomConfigSchema.parse({
    ...room,
    roomSecret: buildRedactedSyncRoomSecret(room.coopId, room.roomId),
    inviteSigningSecret: buildRedactedSyncRoomSecret(room.coopId, `${room.roomId}/invite`),
  });
}

export async function setSyncRoomSecretRecord(
  db: CoopDexie,
  value: SyncRoomSecretRecord,
): Promise<SyncRoomSecretRecord> {
  const parsed = syncRoomSecretRecordSchema.parse(value);
  const payload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'sync-room-secret',
    entityId: parsed.coopId,
    bytes: new TextEncoder().encode(JSON.stringify(parsed)),
  });

  await db.encryptedLocalPayloads.put(payload);
  return parsed;
}

export async function getSyncRoomSecretRecord(
  db: CoopDexie,
  coopId: string,
): Promise<SyncRoomSecretRecord | null> {
  const record = await getEncryptedLocalPayloadRecord(db, 'sync-room-secret', coopId);
  if (!record) return null;

  try {
    const bytes = await decryptEncryptedLocalPayloadRecord(db, record);
    return syncRoomSecretRecordSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    console.warn(`[storage] Failed to decrypt sync room secret payload for ${coopId}.`, error);
    return null;
  }
}

export async function removeSyncRoomSecretRecord(db: CoopDexie, coopId: string): Promise<void> {
  await db.encryptedLocalPayloads.delete(buildEncryptedLocalPayloadId('sync-room-secret', coopId));
}

export async function ensureSyncRoomSecretRecord(
  db: CoopDexie,
  room: SyncRoomConfig,
): Promise<SyncRoomSecretRecord | null> {
  const existing = await getSyncRoomSecretRecord(db, room.coopId);
  if (existing?.roomId === room.roomId) {
    return existing;
  }

  if (isRedactedSyncRoomSecret(room.roomSecret)) {
    return existing;
  }

  const now = nowIso();
  return setSyncRoomSecretRecord(db, {
    coopId: room.coopId,
    roomId: room.roomId,
    roomSecret: room.roomSecret,
    inviteSigningSecret: room.inviteSigningSecret,
    roomEpoch: (existing?.roomEpoch ?? 0) + 1,
    legacyCompatible: true,
    migratedAt: existing?.migratedAt ?? now,
    updatedAt: now,
  });
}

export function hydrateSyncRoomWithSecret(
  room: SyncRoomConfig,
  record: SyncRoomSecretRecord | null,
): SyncRoomConfig | null {
  if (!record) {
    return isRedactedSyncRoomSecret(room.roomSecret) ? null : room;
  }

  if (record.coopId !== room.coopId || record.roomId !== room.roomId) {
    return isRedactedSyncRoomSecret(room.roomSecret) ? null : room;
  }

  return syncRoomConfigSchema.parse({
    ...room,
    roomSecret: record.roomSecret,
    inviteSigningSecret: record.inviteSigningSecret,
  });
}
