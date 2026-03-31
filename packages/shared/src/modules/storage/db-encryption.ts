import type {
  AgentMemory,
  EncryptedLocalPayload,
  EncryptedLocalPayloadKind,
  ReadablePageExtract,
  ReceiverCapture,
  ReviewDraft,
  TabCandidate,
} from '../../contracts/schema';
import {
  agentMemorySchema,
  encryptedLocalPayloadSchema,
  readablePageExtractSchema,
  receiverCaptureSchema,
  reviewDraftSchema,
  tabCandidateSchema,
} from '../../contracts/schema';
import { base64ToBytes, bytesToBase64, nowIso } from '../../utils';
import type { CoopDexie } from './db-schema';

const LOCAL_DATA_WRAPPING_SECRET_KEY = 'session-wrapping-secret';
const wrappingSecretCache = new Map<string, string>();
export const LOCAL_DATA_PLACEHOLDER_PREFIX = 'encrypted://local';
export const LOCAL_DATA_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Derived-key LRU cache — avoids re-running 120k PBKDF2 iterations for the
// same (secret, salt) pair on every encrypted row read.
// ---------------------------------------------------------------------------
const DERIVED_KEY_CACHE_MAX = 2000;
const derivedKeyCache = new Map<string, CryptoKey>();

/**
 * Clear the in-memory PBKDF2 derived-key cache.
 * Call when the wrapping secret changes or from tests.
 */
export function clearDerivedKeyCache() {
  derivedKeyCache.clear();
}

/**
 * Clear the in-memory wrapping-secret cache for a specific database.
 * Must be called whenever the wrapping secret is replaced (e.g. import)
 * so that subsequent encrypt/decrypt operations pick up the new secret
 * instead of the stale cached value.
 */
export function clearWrappingSecretCache(dbName: string) {
  wrappingSecretCache.delete(dbName);
}
const LOCAL_DATA_REDACTED_SOURCE = {
  label: 'Encrypted local source',
  url: 'encrypted://local/source',
  domain: 'local',
} as const;

export function buildEncryptedLocalPayloadId(kind: EncryptedLocalPayloadKind, entityId: string) {
  return `${kind}:${entityId}`;
}

function buildEncryptedPlaceholderUrl(kind: EncryptedLocalPayloadKind, entityId: string) {
  return `${LOCAL_DATA_PLACEHOLDER_PREFIX}/${kind}/${entityId}`;
}

export function buildRedactedTabCandidate(candidate: TabCandidate): TabCandidate {
  return tabCandidateSchema.parse({
    ...candidate,
    url: buildEncryptedPlaceholderUrl('tab-candidate', candidate.id),
    canonicalUrl: buildEncryptedPlaceholderUrl('tab-candidate', candidate.id),
    title: 'Encrypted local tab',
    favicon: undefined,
    excerpt: undefined,
    tabGroupHint: undefined,
  });
}

export function buildRedactedPageExtract(extract: ReadablePageExtract): ReadablePageExtract {
  return readablePageExtractSchema.parse({
    ...extract,
    canonicalUrl: buildEncryptedPlaceholderUrl('page-extract', extract.id),
    cleanedTitle: 'Encrypted page extract',
    metaDescription: undefined,
    topHeadings: [],
    leadParagraphs: [],
    salientTextBlocks: [],
    faviconUrl: undefined,
    socialPreviewImageUrl: undefined,
    previewImageUrl: undefined,
  });
}

export function buildRedactedReviewDraft(draft: ReviewDraft): ReviewDraft {
  return reviewDraftSchema.parse({
    ...draft,
    title: 'Encrypted review draft',
    summary: 'Encrypted local review content.',
    sources: [LOCAL_DATA_REDACTED_SOURCE],
    tags: [],
    whyItMatters: 'Stored locally in encrypted form.',
    suggestedNextStep: 'Open the draft to view its local content.',
    rationale: 'Encrypted local draft content.',
    previewImageUrl: undefined,
  });
}

export function buildRedactedReceiverCapture(capture: ReceiverCapture): ReceiverCapture {
  return receiverCaptureSchema.parse({
    ...capture,
    title: 'Encrypted local capture',
    note: '',
    sourceUrl: undefined,
    fileName: undefined,
  });
}

export function buildRedactedAgentMemory(memory: AgentMemory): AgentMemory {
  return agentMemorySchema.parse({
    ...memory,
    content: 'Encrypted local memory',
  });
}

export function looksRedactedTabCandidate(candidate: TabCandidate) {
  return candidate.url.startsWith(`${LOCAL_DATA_PLACEHOLDER_PREFIX}/tab-candidate/`);
}

export function looksRedactedPageExtract(extract: ReadablePageExtract) {
  return extract.canonicalUrl.startsWith(`${LOCAL_DATA_PLACEHOLDER_PREFIX}/page-extract/`);
}

export function looksRedactedReviewDraft(draft: ReviewDraft) {
  return (
    draft.title === 'Encrypted review draft' && draft.summary === 'Encrypted local review content.'
  );
}

export function looksRedactedReceiverCapture(capture: ReceiverCapture) {
  return capture.title === 'Encrypted local capture' && !capture.sourceUrl && capture.note === '';
}

export function looksRedactedAgentMemory(memory: AgentMemory) {
  return memory.content === 'Encrypted local memory';
}

export async function ensureLocalDataWrappingSecret(db: CoopDexie) {
  const cached = wrappingSecretCache.get(db.name);
  if (cached) return cached;

  const existing = await db.settings.get(LOCAL_DATA_WRAPPING_SECRET_KEY);
  if (typeof existing?.value === 'string' && existing.value.length > 0) {
    wrappingSecretCache.set(db.name, existing.value);
    return existing.value;
  }

  const secret = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  await db.settings.put({
    key: LOCAL_DATA_WRAPPING_SECRET_KEY,
    value: secret,
  });
  wrappingSecretCache.set(db.name, secret);
  return secret;
}

async function deriveLocalDataKey(secret: string, salt: Uint8Array) {
  const saltKey = bytesToBase64(salt);
  const cached = derivedKeyCache.get(saltKey);
  if (cached) return cached;

  const encoder = new TextEncoder();
  const saltBytes = Uint8Array.from(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 120_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  // LRU-style eviction: if the cache is full, drop the oldest entry.
  if (derivedKeyCache.size >= DERIVED_KEY_CACHE_MAX) {
    const oldest = derivedKeyCache.keys().next().value;
    if (oldest !== undefined) derivedKeyCache.delete(oldest);
  }
  derivedKeyCache.set(saltKey, key);
  return key;
}

export async function buildEncryptedLocalPayloadRecord(input: {
  db: CoopDexie;
  kind: EncryptedLocalPayloadKind;
  entityId: string;
  bytes: Uint8Array;
  wrappedAt?: string;
  expiresAt?: string;
}): Promise<EncryptedLocalPayload> {
  const secret = await ensureLocalDataWrappingSecret(input.db);
  const iv = Uint8Array.from(crypto.getRandomValues(new Uint8Array(12)));
  const salt = Uint8Array.from(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveLocalDataKey(secret, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    Uint8Array.from(input.bytes),
  );

  return encryptedLocalPayloadSchema.parse({
    id: buildEncryptedLocalPayloadId(input.kind, input.entityId),
    kind: input.kind,
    entityId: input.entityId,
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    algorithm: 'aes-gcm',
    wrappedAt: input.wrappedAt ?? nowIso(),
    expiresAt: input.expiresAt,
    version: 1,
  });
}

export async function getEncryptedLocalPayloadRecord(
  db: CoopDexie,
  kind: EncryptedLocalPayloadKind,
  entityId: string,
) {
  return db.encryptedLocalPayloads.get(buildEncryptedLocalPayloadId(kind, entityId));
}

export async function decryptEncryptedLocalPayloadRecord(
  db: CoopDexie,
  record: EncryptedLocalPayload,
) {
  const secret = await ensureLocalDataWrappingSecret(db);
  const key = await deriveLocalDataKey(secret, base64ToBytes(record.salt));
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(record.iv),
    },
    key,
    base64ToBytes(record.ciphertext),
  );

  return new Uint8Array(decrypted);
}

function logEncryptedPayloadReadFailure(
  kind: EncryptedLocalPayloadKind,
  entityId: string,
  error: unknown,
) {
  console.warn(
    `[storage] Failed to load encrypted ${kind} payload for ${entityId}. Falling back to the redacted local record.`,
    error,
  );
}

export async function loadEncryptedJsonPayload<T>(
  db: CoopDexie,
  kind: EncryptedLocalPayloadKind,
  entityId: string,
  parse: (value: unknown) => T,
): Promise<T | null> {
  const record = await getEncryptedLocalPayloadRecord(db, kind, entityId);
  if (!record) {
    return null;
  }

  try {
    const bytes = await decryptEncryptedLocalPayloadRecord(db, record);
    return parse(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    logEncryptedPayloadReadFailure(kind, entityId, error);
    return null;
  }
}

export async function loadEncryptedBlobPayload(
  db: CoopDexie,
  entityId: string,
  mimeType: string,
): Promise<Blob | null> {
  const record = await getEncryptedLocalPayloadRecord(db, 'receiver-blob', entityId);
  if (!record) {
    return null;
  }

  try {
    const bytes = await decryptEncryptedLocalPayloadRecord(db, record);
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    logEncryptedPayloadReadFailure('receiver-blob', entityId, error);
    return null;
  }
}

export function resolveTabCandidatePayloadExpiry(candidate: TabCandidate) {
  return new Date(new Date(candidate.capturedAt).getTime() + LOCAL_DATA_RETENTION_MS).toISOString();
}

export function resolvePageExtractPayloadExpiry(extract: ReadablePageExtract) {
  return new Date(new Date(extract.createdAt).getTime() + LOCAL_DATA_RETENTION_MS).toISOString();
}

export async function hydrateTabCandidateRecord(db: CoopDexie, candidate?: TabCandidate) {
  if (!candidate) {
    return undefined;
  }
  return (
    (await loadEncryptedJsonPayload(db, 'tab-candidate', candidate.id, (value) =>
      tabCandidateSchema.parse(value),
    )) ?? candidate
  );
}

export async function hydratePageExtractRecord(db: CoopDexie, extract?: ReadablePageExtract) {
  if (!extract) {
    return undefined;
  }
  return (
    (await loadEncryptedJsonPayload(db, 'page-extract', extract.id, (value) =>
      readablePageExtractSchema.parse(value),
    )) ?? extract
  );
}

export async function hydrateReviewDraftRecord(db: CoopDexie, draft?: ReviewDraft) {
  if (!draft) {
    return undefined;
  }
  return (
    (await loadEncryptedJsonPayload(db, 'review-draft', draft.id, (value) =>
      reviewDraftSchema.parse(value),
    )) ?? draft
  );
}

export async function hydrateReceiverCaptureRecord(db: CoopDexie, capture?: ReceiverCapture) {
  if (!capture) {
    return undefined;
  }
  return (
    (await loadEncryptedJsonPayload(db, 'receiver-capture', capture.id, (value) =>
      receiverCaptureSchema.parse(value),
    )) ?? capture
  );
}

export async function hydrateAgentMemoryRecord(db: CoopDexie, memory?: AgentMemory) {
  if (!memory) {
    return undefined;
  }
  return (
    (await loadEncryptedJsonPayload(db, 'agent-memory', memory.id, (value) =>
      agentMemorySchema.parse(value),
    )) ?? memory
  );
}
