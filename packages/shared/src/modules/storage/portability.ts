import type {
  EncryptedSessionMaterial,
  LocalMemberSignerBinding,
  LocalPasskeyIdentity,
  PrivacyIdentityRecord,
  StealthKeyPairRecord,
} from '../../contracts/schema';
import { base64ToBytes, bytesToBase64, nowIso } from '../../utils';
import { clearDerivedKeyCache, clearWrappingSecretCache } from './db';
import type { CoopDexie, LocalSetting } from './db';

// ── Constants ────────────────────────────────────────────────────────

export const PORTABILITY_SCHEMA_VERSION = 1;

const PBKDF2_ITERATIONS = 200_000;

export const ALL_TABLE_NAMES = [
  'tabCandidates',
  'pageExtracts',
  'reviewDrafts',
  'coopDocs',
  'captureRuns',
  'settings',
  'identities',
  'localMemberSignerBindings',
  'receiverPairings',
  'receiverCaptures',
  'receiverBlobs',
  'actionBundles',
  'actionLogEntries',
  'replayIds',
  'executionPermits',
  'permitLogEntries',
  'sessionCapabilities',
  'sessionCapabilityLogEntries',
  'encryptedSessionMaterials',
  'agentObservations',
  'agentPlans',
  'skillRuns',
  'tabRoutings',
  'knowledgeSkills',
  'coopKnowledgeSkillOverrides',
  'agentLogs',
  'privacyIdentities',
  'stealthKeyPairs',
  'agentMemories',
  'encryptedLocalPayloads',
  'coopBlobs',
  'syncOutbox',
] as const;

export type TableName = (typeof ALL_TABLE_NAMES)[number];

// ── Interfaces ───────────────────────────────────────────────────────

export interface DatabaseExportEnvelope {
  type: 'coop-full-database-export';
  schemaVersion: number;
  exportedAt: string;
  dbVersion: number;
  tableCounts: Record<string, number>;
  tables: Record<string, unknown[]>;
}

export interface CryptoKeyBundle {
  type: 'coop-crypto-key-bundle';
  schemaVersion: number;
  exportedAt: string;
  wrappingSecret: string;
  identities: LocalPasskeyIdentity[];
  localMemberSignerBindings: LocalMemberSignerBinding[];
  privacyIdentities: PrivacyIdentityRecord[];
  stealthKeyPairs: StealthKeyPairRecord[];
  encryptedSessionMaterials: EncryptedSessionMaterial[];
  archiveSecrets: Array<{ key: string; value: unknown }>;
}

// ── Encryption helpers (internal) ────────────────────────────────────

async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const saltBytes = Uint8Array.from(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptWithPassphrase(data: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassphrase(passphrase, salt);

  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data),
  );

  return JSON.stringify({
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
  });
}

async function decryptWithPassphrase(encrypted: string, passphrase: string): Promise<string> {
  let parsed: { ciphertext: string; iv: string; salt: string };
  try {
    parsed = JSON.parse(encrypted);
  } catch {
    throw new Error('Invalid passphrase or corrupted backup data');
  }

  if (!parsed.ciphertext || !parsed.iv || !parsed.salt) {
    throw new Error('Invalid passphrase or corrupted backup data');
  }

  const salt = base64ToBytes(parsed.salt);
  const iv = base64ToBytes(parsed.iv);
  const ciphertextBytes = base64ToBytes(parsed.ciphertext);
  const key = await deriveKeyFromPassphrase(passphrase, salt);

  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextBytes);
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Invalid passphrase or corrupted backup data');
  }
}

// ── Serialization helpers ────────────────────────────────────────────

function serializeCoopDocRecords(records: unknown[]): unknown[] {
  return records.map((record) => {
    const r = record as Record<string, unknown>;
    if (r.encodedState instanceof Uint8Array) {
      return { ...r, encodedState: bytesToBase64(r.encodedState) };
    }
    return r;
  });
}

function deserializeCoopDocRecords(records: unknown[]): unknown[] {
  return records.map((record) => {
    const r = record as Record<string, unknown>;
    if (typeof r.encodedState === 'string') {
      return { ...r, encodedState: base64ToBytes(r.encodedState) };
    }
    return r;
  });
}

async function serializeReceiverBlobRecords(records: unknown[]): Promise<unknown[]> {
  const serialized: unknown[] = [];
  for (const record of records) {
    const r = record as Record<string, unknown>;
    if (r.blob instanceof Blob) {
      try {
        const buffer = await r.blob.arrayBuffer();
        const base64 = bytesToBase64(new Uint8Array(buffer));
        serialized.push({ ...r, blob: base64, _blobType: r.blob.type });
      } catch {
        // If Blob conversion fails (e.g., in test environments), skip the blob data
        serialized.push({ ...r, blob: null, _blobType: null });
      }
    } else {
      serialized.push(r);
    }
  }
  return serialized;
}

function deserializeReceiverBlobRecords(records: unknown[]): unknown[] {
  return records.map((record) => {
    const r = record as Record<string, unknown>;
    if (typeof r.blob === 'string' && r._blobType !== undefined) {
      try {
        const bytes = base64ToBytes(r.blob);
        const blobType = typeof r._blobType === 'string' ? r._blobType : 'application/octet-stream';
        const { _blobType: _, ...rest } = r;
        return { ...rest, blob: new Blob([bytes], { type: blobType }) };
      } catch {
        return r;
      }
    }
    const { _blobType: _, ...cleaned } = r;
    return cleaned;
  });
}

// ── Table key helpers ────────────────────────────────────────────────

function getTablePrimaryKey(tableName: TableName): string {
  const keyMap: Partial<Record<TableName, string>> = {
    settings: 'key',
    receiverPairings: 'pairingId',
    receiverBlobs: 'captureId',
    encryptedSessionMaterials: 'capabilityId',
    replayIds: 'replayId',
    coopBlobs: 'blobId',
  };
  return keyMap[tableName] ?? 'id';
}

// ── Full Database Export/Import ──────────────────────────────────────

export async function exportFullDatabase(db: CoopDexie, passphrase: string): Promise<string> {
  const tables: Record<string, unknown[]> = {};
  const tableCounts: Record<string, number> = {};

  for (const tableName of ALL_TABLE_NAMES) {
    const table = (db as unknown as Record<string, import('dexie').Table>)[tableName];
    if (!table) {
      tables[tableName] = [];
      tableCounts[tableName] = 0;
      continue;
    }

    let records: unknown[] = await table.toArray();

    // Serialize Uint8Array fields for coopDocs
    if (tableName === 'coopDocs') {
      records = serializeCoopDocRecords(records);
    }

    // Serialize Blob fields for receiverBlobs
    if (tableName === 'receiverBlobs') {
      records = await serializeReceiverBlobRecords(records);
    }

    tables[tableName] = records;
    tableCounts[tableName] = records.length;
  }

  const envelope: DatabaseExportEnvelope = {
    type: 'coop-full-database-export',
    schemaVersion: PORTABILITY_SCHEMA_VERSION,
    exportedAt: nowIso(),
    dbVersion: db.verno,
    tableCounts,
    tables,
  };

  const json = JSON.stringify(envelope);
  return encryptWithPassphrase(json, passphrase);
}

export async function importFullDatabase(
  db: CoopDexie,
  encryptedData: string,
  passphrase: string,
  options?: { mode?: 'overwrite' | 'skip-existing' },
): Promise<{ imported: Record<string, number>; skipped: Record<string, number> }> {
  const json = await decryptWithPassphrase(encryptedData, passphrase);

  let envelope: DatabaseExportEnvelope;
  try {
    envelope = JSON.parse(json);
  } catch {
    throw new Error('Invalid passphrase or corrupted backup data');
  }

  if (envelope.type !== 'coop-full-database-export') {
    throw new Error(`Unexpected export type: ${envelope.type}`);
  }

  if (envelope.schemaVersion !== PORTABILITY_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version: ${envelope.schemaVersion} (expected ${PORTABILITY_SCHEMA_VERSION})`,
    );
  }

  const mode = options?.mode ?? 'overwrite';
  const imported: Record<string, number> = {};
  const skipped: Record<string, number> = {};

  for (const tableName of ALL_TABLE_NAMES) {
    let records = (envelope.tables[tableName] ?? []) as unknown[];
    imported[tableName] = 0;
    skipped[tableName] = 0;

    if (records.length === 0) continue;

    const table = (db as unknown as Record<string, import('dexie').Table>)[tableName];
    if (!table) continue;

    // Deserialize Uint8Array fields for coopDocs
    if (tableName === 'coopDocs') {
      records = deserializeCoopDocRecords(records);
    }

    // Deserialize Blob fields for receiverBlobs
    if (tableName === 'receiverBlobs') {
      records = deserializeReceiverBlobRecords(records);
    }

    if (mode === 'overwrite') {
      await db.transaction('rw', table, async () => {
        await table.clear();
        await table.bulkPut(records);
      });
      imported[tableName] = records.length;
    } else {
      // skip-existing: only add records that don't already exist
      const primaryKey = getTablePrimaryKey(tableName);
      for (const record of records) {
        const r = record as Record<string, unknown>;
        const key = r[primaryKey];
        if (key != null) {
          const existing = await table.get(key);
          if (existing) {
            skipped[tableName] = (skipped[tableName] ?? 0) + 1;
          } else {
            await table.put(record);
            imported[tableName] = (imported[tableName] ?? 0) + 1;
          }
        } else {
          await table.put(record);
          imported[tableName] = (imported[tableName] ?? 0) + 1;
        }
      }
    }
  }

  return { imported, skipped };
}

// ── Granular Export Functions ─────────────────────────────────────────

export async function exportTabCandidates(db: CoopDexie): Promise<string> {
  const data = await db.tabCandidates.toArray();
  return JSON.stringify({
    type: 'coop-tab-candidates-export',
    exportedAt: nowIso(),
    data,
  });
}

export async function exportPageExtracts(db: CoopDexie): Promise<string> {
  const data = await db.pageExtracts.toArray();
  return JSON.stringify({
    type: 'coop-page-extracts-export',
    exportedAt: nowIso(),
    data,
  });
}

export async function exportReviewDrafts(db: CoopDexie): Promise<string> {
  const data = await db.reviewDrafts.toArray();
  return JSON.stringify({
    type: 'coop-review-drafts-export',
    exportedAt: nowIso(),
    data,
  });
}

export async function exportAgentMemories(db: CoopDexie): Promise<string> {
  const data = await db.agentMemories.toArray();
  return JSON.stringify({
    type: 'coop-agent-memories-export',
    exportedAt: nowIso(),
    data,
  });
}

export async function exportReceiverData(db: CoopDexie): Promise<string> {
  const [pairings, captures] = await Promise.all([
    db.receiverPairings.toArray(),
    db.receiverCaptures.toArray(),
  ]);
  return JSON.stringify({
    type: 'coop-receiver-data-export',
    exportedAt: nowIso(),
    data: { pairings, captures },
  });
}

export async function exportCoopBlobs(db: CoopDexie): Promise<string> {
  const data = await db.coopBlobs.toArray();
  return JSON.stringify({
    type: 'coop-coop-blobs-export',
    exportedAt: nowIso(),
    data,
  });
}

// ── Crypto Key Bundle Export/Import ──────────────────────────────────

const WRAPPING_SECRET_KEY = 'session-wrapping-secret';
const ARCHIVE_SECRETS_PREFIX = 'archive-secrets:';

export async function exportCryptoKeyBundle(db: CoopDexie, passphrase: string): Promise<string> {
  // Read wrapping secret
  const wrappingSecretSetting = await db.settings.get(WRAPPING_SECRET_KEY);
  const wrappingSecret =
    typeof wrappingSecretSetting?.value === 'string' ? wrappingSecretSetting.value : '';

  // Read all identity tables
  const [
    identities,
    localMemberSignerBindings,
    privacyIdentities,
    stealthKeyPairs,
    encryptedSessionMaterials,
  ] = await Promise.all([
    db.identities.toArray(),
    db.localMemberSignerBindings.toArray(),
    db.privacyIdentities.toArray(),
    db.stealthKeyPairs.toArray(),
    db.encryptedSessionMaterials.toArray(),
  ]);

  // Read archive secrets from settings
  const allSettings = await db.settings.toArray();
  const archiveSecrets = allSettings
    .filter((s: LocalSetting) => s.key.startsWith(ARCHIVE_SECRETS_PREFIX))
    .map((s: LocalSetting) => ({ key: s.key, value: s.value }));

  const bundle: CryptoKeyBundle = {
    type: 'coop-crypto-key-bundle',
    schemaVersion: PORTABILITY_SCHEMA_VERSION,
    exportedAt: nowIso(),
    wrappingSecret,
    identities,
    localMemberSignerBindings,
    privacyIdentities,
    stealthKeyPairs,
    encryptedSessionMaterials,
    archiveSecrets,
  };

  const json = JSON.stringify(bundle);
  return encryptWithPassphrase(json, passphrase);
}

export async function importCryptoKeyBundle(
  db: CoopDexie,
  encryptedData: string,
  passphrase: string,
): Promise<{ imported: Record<string, number> }> {
  const json = await decryptWithPassphrase(encryptedData, passphrase);

  let bundle: CryptoKeyBundle;
  try {
    bundle = JSON.parse(json);
  } catch {
    throw new Error('Invalid passphrase or corrupted backup data');
  }

  if (bundle.type !== 'coop-crypto-key-bundle') {
    throw new Error(`Unexpected bundle type: ${bundle.type}`);
  }

  if (bundle.schemaVersion !== PORTABILITY_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version: ${bundle.schemaVersion} (expected ${PORTABILITY_SCHEMA_VERSION})`,
    );
  }

  const imported: Record<string, number> = {};

  // Restore wrapping secret
  if (bundle.wrappingSecret) {
    await db.settings.put({ key: WRAPPING_SECRET_KEY, value: bundle.wrappingSecret });
    clearWrappingSecretCache(db.name);
    clearDerivedKeyCache();
    imported.wrappingSecret = 1;
  }

  // Restore identities
  if (bundle.identities.length > 0) {
    await db.identities.bulkPut(bundle.identities);
  }
  imported.identities = bundle.identities.length;

  // Restore local member signer bindings
  if (bundle.localMemberSignerBindings.length > 0) {
    await db.localMemberSignerBindings.bulkPut(bundle.localMemberSignerBindings);
  }
  imported.localMemberSignerBindings = bundle.localMemberSignerBindings.length;

  // Restore privacy identities
  if (bundle.privacyIdentities.length > 0) {
    await db.privacyIdentities.bulkPut(bundle.privacyIdentities);
  }
  imported.privacyIdentities = bundle.privacyIdentities.length;

  // Restore stealth key pairs
  if (bundle.stealthKeyPairs.length > 0) {
    await db.stealthKeyPairs.bulkPut(bundle.stealthKeyPairs);
  }
  imported.stealthKeyPairs = bundle.stealthKeyPairs.length;

  // Restore encrypted session materials
  if (bundle.encryptedSessionMaterials.length > 0) {
    await db.encryptedSessionMaterials.bulkPut(bundle.encryptedSessionMaterials);
  }
  imported.encryptedSessionMaterials = bundle.encryptedSessionMaterials.length;

  // Restore archive secrets
  for (const secret of bundle.archiveSecrets) {
    await db.settings.put({ key: secret.key, value: secret.value });
  }
  imported.archiveSecrets = bundle.archiveSecrets.length;

  return { imported };
}
