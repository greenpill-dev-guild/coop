import Dexie, { type EntityTable } from 'dexie';
import type {
  AnchorCapability,
  AuthSession,
  CoopSharedState,
  LocalPasskeyIdentity,
  PrivilegedActionLogEntry,
  ReadablePageExtract,
  ReceiverCapture,
  ReceiverDeviceIdentity,
  ReceiverPairingRecord,
  ReviewDraft,
  SoundPreferences,
  TabCandidate,
} from '../../contracts/schema';
import { anchorCapabilitySchema, privilegedActionLogEntrySchema } from '../../contracts/schema';
import { createCoopDoc, encodeCoopDoc, hydrateCoopDoc, readCoopState } from '../coop/sync';

export interface CoopDocRecord {
  id: string;
  encodedState: Uint8Array;
  updatedAt: string;
}

export interface CaptureRunRecord {
  id: string;
  state: 'idle' | 'running' | 'failed' | 'completed';
  capturedAt: string;
  candidateCount: number;
}

export interface LocalSetting {
  key: string;
  value: unknown;
}

export interface ReceiverBlobRecord {
  captureId: string;
  blob: Blob;
}

export class CoopDexie extends Dexie {
  tabCandidates!: EntityTable<TabCandidate, 'id'>;
  pageExtracts!: EntityTable<ReadablePageExtract, 'id'>;
  reviewDrafts!: EntityTable<ReviewDraft, 'id'>;
  coopDocs!: EntityTable<CoopDocRecord, 'id'>;
  captureRuns!: EntityTable<CaptureRunRecord, 'id'>;
  settings!: EntityTable<LocalSetting, 'key'>;
  identities!: EntityTable<LocalPasskeyIdentity, 'id'>;
  receiverPairings!: EntityTable<ReceiverPairingRecord, 'pairingId'>;
  receiverCaptures!: EntityTable<ReceiverCapture, 'id'>;
  receiverBlobs!: EntityTable<ReceiverBlobRecord, 'captureId'>;

  constructor(name = 'coop-v1') {
    super(name);
    this.version(1).stores({
      tabCandidates: 'id, canonicalUrl, domain, capturedAt',
      pageExtracts: 'id, canonicalUrl, domain, createdAt',
      reviewDrafts: 'id, category, createdAt',
      coopDocs: 'id, updatedAt',
      captureRuns: 'id, state, capturedAt',
      settings: 'key',
    });
    this.version(2).stores({
      tabCandidates: 'id, canonicalUrl, domain, capturedAt',
      pageExtracts: 'id, canonicalUrl, domain, createdAt',
      reviewDrafts: 'id, category, createdAt',
      coopDocs: 'id, updatedAt',
      captureRuns: 'id, state, capturedAt',
      settings: 'key',
      identities: 'id, ownerAddress, displayName, createdAt, lastUsedAt',
    });
    this.version(3).stores({
      tabCandidates: 'id, canonicalUrl, domain, capturedAt',
      pageExtracts: 'id, canonicalUrl, domain, createdAt',
      reviewDrafts: 'id, category, createdAt',
      coopDocs: 'id, updatedAt',
      captureRuns: 'id, state, capturedAt',
      settings: 'key',
      identities: 'id, ownerAddress, displayName, createdAt, lastUsedAt',
      receiverPairings: 'pairingId, coopId, memberId, roomId, issuedAt, acceptedAt, active',
      receiverCaptures: 'id, kind, createdAt, syncState, pairingId, coopId, memberId',
      receiverBlobs: 'captureId',
    });
    this.version(4)
      .stores({
        tabCandidates: 'id, canonicalUrl, domain, capturedAt',
        pageExtracts: 'id, canonicalUrl, domain, createdAt',
        reviewDrafts: 'id, category, createdAt, workflowStage',
        coopDocs: 'id, updatedAt',
        captureRuns: 'id, state, capturedAt',
        settings: 'key',
        identities: 'id, ownerAddress, displayName, createdAt, lastUsedAt',
        receiverPairings: 'pairingId, coopId, memberId, roomId, issuedAt, acceptedAt, active',
        receiverCaptures:
          'id, kind, createdAt, syncState, pairingId, coopId, memberId, intakeStatus, linkedDraftId',
        receiverBlobs: 'captureId',
      })
      .upgrade(async (tx) => {
        const reviewDrafts = await tx.table('reviewDrafts').toArray();
        for (const draft of reviewDrafts) {
          await tx.table('reviewDrafts').put({
            ...draft,
            workflowStage: draft.workflowStage ?? 'ready',
            provenance: draft.provenance ?? {
              type: 'tab',
              interpretationId: draft.interpretationId,
              extractId: draft.extractId,
              sourceCandidateId: draft.sourceCandidateId,
            },
          });
        }

        const receiverCaptures = await tx.table('receiverCaptures').toArray();
        for (const capture of receiverCaptures) {
          await tx.table('receiverCaptures').put({
            ...capture,
            retryCount: capture.retryCount ?? 0,
            intakeStatus: capture.intakeStatus ?? 'private-intake',
          });
        }
      });
  }
}

export function createCoopDb(name?: string) {
  return new CoopDexie(name);
}

export async function saveCoopState(db: CoopDexie, state: CoopSharedState) {
  const doc = createCoopDoc(state);
  await db.coopDocs.put({
    id: state.profile.id,
    encodedState: encodeCoopDoc(doc),
    updatedAt: new Date().toISOString(),
  });
}

export async function saveReviewDraft(db: CoopDexie, draft: ReviewDraft) {
  await db.reviewDrafts.put(draft);
}

export async function getReviewDraft(db: CoopDexie, draftId: string) {
  return db.reviewDrafts.get(draftId);
}

export async function updateReviewDraft(
  db: CoopDexie,
  draftId: string,
  patch: Partial<ReviewDraft>,
) {
  const current = await db.reviewDrafts.get(draftId);
  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...patch,
  } satisfies ReviewDraft;
  await db.reviewDrafts.put(next);
  return next;
}

export async function loadCoopState(db: CoopDexie, coopId: string) {
  const record = await db.coopDocs.get(coopId);
  if (!record) {
    return null;
  }
  const doc = hydrateCoopDoc(record.encodedState);
  return readCoopState(doc);
}

export async function setSoundPreferences(db: CoopDexie, value: SoundPreferences) {
  await db.settings.put({
    key: 'sound-preferences',
    value,
  });
}

export async function getSoundPreferences(db: CoopDexie): Promise<SoundPreferences | null> {
  const record = await db.settings.get('sound-preferences');
  return (record?.value as SoundPreferences | undefined) ?? null;
}

export async function setAuthSession(db: CoopDexie, value: AuthSession | null) {
  if (!value) {
    await db.settings.delete('auth-session');
    return;
  }
  await db.settings.put({
    key: 'auth-session',
    value,
  });
}

export async function getAuthSession(db: CoopDexie): Promise<AuthSession | null> {
  const record = await db.settings.get('auth-session');
  return (record?.value as AuthSession | undefined) ?? null;
}

export async function setAnchorCapability(db: CoopDexie, value: AnchorCapability) {
  await db.settings.put({
    key: 'anchor-capability',
    value,
  });
}

export async function getAnchorCapability(db: CoopDexie): Promise<AnchorCapability | null> {
  const record = await db.settings.get('anchor-capability');
  return record?.value ? anchorCapabilitySchema.parse(record.value) : null;
}

export async function setPrivilegedActionLog(db: CoopDexie, entries: PrivilegedActionLogEntry[]) {
  await db.settings.put({
    key: 'privileged-action-log',
    value: entries,
  });
}

export async function listPrivilegedActionLog(db: CoopDexie): Promise<PrivilegedActionLogEntry[]> {
  const record = await db.settings.get('privileged-action-log');
  if (!record?.value || !Array.isArray(record.value)) {
    return [];
  }

  return record.value.map((entry) => privilegedActionLogEntrySchema.parse(entry));
}

export async function upsertLocalIdentity(db: CoopDexie, identity: LocalPasskeyIdentity) {
  await db.identities.put(identity);
}

export async function listLocalIdentities(db: CoopDexie) {
  return db.identities.orderBy('lastUsedAt').reverse().toArray();
}

export async function upsertReceiverPairing(db: CoopDexie, pairing: ReceiverPairingRecord) {
  await db.receiverPairings.put(pairing);
}

export async function listReceiverPairings(db: CoopDexie) {
  return db.receiverPairings.orderBy('issuedAt').reverse().toArray();
}

export async function getActiveReceiverPairing(db: CoopDexie) {
  const pairings = await listReceiverPairings(db);
  return pairings.find((pairing) => pairing.active) ?? null;
}

export async function setActiveReceiverPairing(db: CoopDexie, pairingId: string) {
  const pairings = await listReceiverPairings(db);
  if (!pairings.some((pairing) => pairing.pairingId === pairingId)) {
    return null;
  }
  await db.transaction('rw', db.receiverPairings, async () => {
    await Promise.all(
      pairings.map((pairing) =>
        db.receiverPairings.put({
          ...pairing,
          active: pairing.pairingId === pairingId,
        }),
      ),
    );
  });
  return db.receiverPairings.get(pairingId);
}

export async function updateReceiverPairing(
  db: CoopDexie,
  pairingId: string,
  patch: Partial<ReceiverPairingRecord>,
) {
  const current = await db.receiverPairings.get(pairingId);
  if (!current) {
    return null;
  }
  const next = {
    ...current,
    ...patch,
  } satisfies ReceiverPairingRecord;
  await db.receiverPairings.put(next);
  return next;
}

export async function saveReceiverCapture(db: CoopDexie, capture: ReceiverCapture, blob: Blob) {
  await db.transaction('rw', db.receiverCaptures, db.receiverBlobs, async () => {
    await db.receiverCaptures.put(capture);
    await db.receiverBlobs.put({
      captureId: capture.id,
      blob,
    });
  });
}

export async function listReceiverCaptures(db: CoopDexie) {
  return db.receiverCaptures.orderBy('createdAt').reverse().toArray();
}

export async function getReceiverCapture(db: CoopDexie, captureId: string) {
  return db.receiverCaptures.get(captureId);
}

export async function getReceiverCaptureBlob(db: CoopDexie, captureId: string) {
  return (await db.receiverBlobs.get(captureId))?.blob ?? null;
}

export async function updateReceiverCapture(
  db: CoopDexie,
  captureId: string,
  patch: Partial<ReceiverCapture>,
) {
  const current = await db.receiverCaptures.get(captureId);
  if (!current) {
    return null;
  }
  const next = {
    ...current,
    ...patch,
  } satisfies ReceiverCapture;
  await db.receiverCaptures.put(next);
  return next;
}

export async function setReceiverDeviceIdentity(db: CoopDexie, identity: ReceiverDeviceIdentity) {
  await db.settings.put({
    key: 'receiver-device-identity',
    value: identity,
  });
}

export async function getReceiverDeviceIdentity(
  db: CoopDexie,
): Promise<ReceiverDeviceIdentity | null> {
  const record = await db.settings.get('receiver-device-identity');
  return (record?.value as ReceiverDeviceIdentity | undefined) ?? null;
}
