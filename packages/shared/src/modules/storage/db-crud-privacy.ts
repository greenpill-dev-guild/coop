import {
  type PrivacyIdentityRecord,
  type StealthKeyPairRecord,
  privacyIdentityRecordSchema,
  stealthKeyPairRecordSchema,
} from '../../contracts/schema';
import {
  buildEncryptedLocalPayloadRecord,
  buildRedactedPrivacyIdentityRecord,
  buildRedactedStealthKeyPairRecord,
  hydratePrivacyIdentityRecord,
  hydrateStealthKeyPairRecord,
} from './db-encryption';
import type { CoopDexie } from './db-schema';

// --- Privacy identity persistence ---

export async function savePrivacyIdentity(db: CoopDexie, record: PrivacyIdentityRecord) {
  const payload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'privacy-identity',
    entityId: record.id,
    bytes: new TextEncoder().encode(JSON.stringify(privacyIdentityRecordSchema.parse(record))),
  });

  await db.transaction('rw', db.privacyIdentities, db.encryptedLocalPayloads, async () => {
    await db.privacyIdentities.put(buildRedactedPrivacyIdentityRecord(record));
    await db.encryptedLocalPayloads.put(payload);
  });
}

export async function getPrivacyIdentity(db: CoopDexie, coopId: string, memberId: string) {
  const record = await db.privacyIdentities.where({ coopId, memberId }).first();
  return hydratePrivacyIdentityRecord(db, record);
}

export async function getPrivacyIdentitiesForCoop(db: CoopDexie, coopId: string) {
  const records = await db.privacyIdentities.where({ coopId }).toArray();
  const hydrated = await Promise.all(
    records.map((record) => hydratePrivacyIdentityRecord(db, record)),
  );
  return hydrated.filter((record): record is PrivacyIdentityRecord => Boolean(record));
}

export async function listPrivacyIdentities(db: CoopDexie, options?: { requireSecrets?: boolean }) {
  const records = await db.privacyIdentities.toArray();
  const hydrated = await Promise.all(
    records.map((record) =>
      hydratePrivacyIdentityRecord(db, record, {
        requireSecret: options?.requireSecrets,
      }),
    ),
  );
  return hydrated.filter((record): record is PrivacyIdentityRecord => Boolean(record));
}

// --- Stealth key pair persistence ---

export async function saveStealthKeyPair(db: CoopDexie, record: StealthKeyPairRecord) {
  const payload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'stealth-key-pair',
    entityId: record.id,
    bytes: new TextEncoder().encode(JSON.stringify(stealthKeyPairRecordSchema.parse(record))),
  });

  await db.transaction('rw', db.stealthKeyPairs, db.encryptedLocalPayloads, async () => {
    await db.stealthKeyPairs.put(buildRedactedStealthKeyPairRecord(record));
    await db.encryptedLocalPayloads.put(payload);
  });
}

export async function getStealthKeyPair(db: CoopDexie, coopId: string) {
  const record = await db.stealthKeyPairs.where({ coopId }).first();
  return hydrateStealthKeyPairRecord(db, record);
}

export async function listStealthKeyPairs(db: CoopDexie, options?: { requireSecrets?: boolean }) {
  const records = await db.stealthKeyPairs.toArray();
  const hydrated = await Promise.all(
    records.map((record) =>
      hydrateStealthKeyPairRecord(db, record, {
        requireSecret: options?.requireSecrets,
      }),
    ),
  );
  return hydrated.filter((record): record is StealthKeyPairRecord => Boolean(record));
}
