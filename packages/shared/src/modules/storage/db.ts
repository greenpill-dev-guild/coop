import Dexie, { type EntityTable } from 'dexie';
import * as Y from 'yjs';
import type {
  ActionBundle,
  ActionLogEntry,
  ActionPolicy,
  AgentLog,
  AgentObservation,
  AgentPlan,
  AnchorCapability,
  AuthSession,
  CoopArchiveSecrets,
  CoopKnowledgeSkillOverride,
  CoopSharedState,
  EncryptedSessionMaterial,
  ExecutionGrant,
  GrantLogEntry,
  HapticPreferences,
  KnowledgeSkill,
  LocalPasskeyIdentity,
  PrivacyIdentityRecord,
  PrivilegedActionLogEntry,
  ReadablePageExtract,
  ReceiverCapture,
  ReceiverDeviceIdentity,
  ReceiverPairingRecord,
  ReviewDraft,
  SessionCapability,
  SessionCapabilityLogEntry,
  SkillRun,
  SoundPreferences,
  StealthKeyPairRecord,
  TabCandidate,
  TrustedNodeArchiveConfig,
  UiPreferences,
} from '../../contracts/schema';
import {
  actionBundleSchema,
  actionLogEntrySchema,
  actionPolicySchema,
  agentObservationSchema,
  agentPlanSchema,
  anchorCapabilitySchema,
  authSessionSchema,
  coopArchiveSecretsSchema,
  encryptedSessionMaterialSchema,
  executionGrantSchema,
  grantLogEntrySchema,
  hapticPreferencesSchema,
  normalizeLegacyOnchainState,
  privilegedActionLogEntrySchema,
  receiverDeviceIdentitySchema,
  sessionCapabilityLogEntrySchema,
  sessionCapabilitySchema,
  skillRunSchema,
  soundPreferencesSchema,
  trustedNodeArchiveConfigSchema,
  uiPreferencesSchema,
} from '../../contracts/schema';
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

export interface ReplayIdRecord {
  replayId: string;
  bundleId: string;
  executedAt: string;
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
  actionBundles!: EntityTable<ActionBundle, 'id'>;
  actionLogEntries!: EntityTable<ActionLogEntry, 'id'>;
  replayIds!: EntityTable<ReplayIdRecord, 'replayId'>;
  executionGrants!: EntityTable<ExecutionGrant, 'id'>;
  grantLogEntries!: EntityTable<GrantLogEntry, 'id'>;
  sessionCapabilities!: EntityTable<SessionCapability, 'id'>;
  sessionCapabilityLogEntries!: EntityTable<SessionCapabilityLogEntry, 'id'>;
  encryptedSessionMaterials!: EntityTable<EncryptedSessionMaterial, 'capabilityId'>;
  agentObservations!: EntityTable<AgentObservation, 'id'>;
  agentPlans!: EntityTable<AgentPlan, 'id'>;
  skillRuns!: EntityTable<SkillRun, 'id'>;
  knowledgeSkills!: EntityTable<KnowledgeSkill, 'id'>;
  coopKnowledgeSkillOverrides!: EntityTable<CoopKnowledgeSkillOverride, 'id'>;
  agentLogs!: EntityTable<AgentLog, 'id'>;
  privacyIdentities!: EntityTable<PrivacyIdentityRecord, 'id'>;
  stealthKeyPairs!: EntityTable<StealthKeyPairRecord, 'id'>;

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
    this.version(5).stores({
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
      actionBundles: 'id, status, coopId, actionClass, createdAt',
      actionLogEntries: 'id, bundleId, eventType, createdAt',
      replayIds: 'replayId, bundleId, executedAt',
    });
    this.version(6).stores({
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
      actionBundles: 'id, status, coopId, actionClass, createdAt',
      actionLogEntries: 'id, bundleId, eventType, createdAt',
      replayIds: 'replayId, bundleId, executedAt',
      executionGrants: 'id, coopId, status, createdAt, expiresAt',
      grantLogEntries: 'id, grantId, eventType, createdAt',
    });
    this.version(7).stores({
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
      actionBundles: 'id, status, coopId, actionClass, createdAt',
      actionLogEntries: 'id, bundleId, eventType, createdAt',
      replayIds: 'replayId, bundleId, executedAt',
      executionGrants: 'id, coopId, status, createdAt, expiresAt',
      grantLogEntries: 'id, grantId, eventType, createdAt',
      agentObservations: 'id, status, trigger, coopId, createdAt, fingerprint',
      agentPlans: 'id, observationId, status, createdAt, updatedAt',
      skillRuns: 'id, observationId, planId, skillId, status, startedAt',
    });
    this.version(8).stores({
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
      actionBundles: 'id, status, coopId, actionClass, createdAt',
      actionLogEntries: 'id, bundleId, eventType, createdAt',
      replayIds: 'replayId, bundleId, executedAt',
      executionGrants: 'id, coopId, status, createdAt, expiresAt',
      grantLogEntries: 'id, grantId, eventType, createdAt',
      sessionCapabilities: 'id, coopId, status, createdAt, updatedAt, sessionAddress',
      sessionCapabilityLogEntries: 'id, capabilityId, eventType, createdAt',
      encryptedSessionMaterials: 'capabilityId, sessionAddress, wrappedAt',
      agentObservations: 'id, status, trigger, coopId, createdAt, fingerprint',
      agentPlans: 'id, observationId, status, createdAt, updatedAt',
      skillRuns: 'id, observationId, planId, skillId, status, startedAt',
    });
    this.version(9).stores({
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
      actionBundles: 'id, status, coopId, actionClass, createdAt',
      actionLogEntries: 'id, bundleId, eventType, createdAt',
      replayIds: 'replayId, bundleId, executedAt',
      executionGrants: 'id, coopId, status, createdAt, expiresAt',
      grantLogEntries: 'id, grantId, eventType, createdAt',
      sessionCapabilities: 'id, coopId, status, createdAt, updatedAt, sessionAddress',
      sessionCapabilityLogEntries: 'id, capabilityId, eventType, createdAt',
      encryptedSessionMaterials: 'capabilityId, sessionAddress, wrappedAt',
      agentObservations: 'id, status, trigger, coopId, createdAt, fingerprint',
      agentPlans: 'id, observationId, status, createdAt, updatedAt',
      skillRuns: 'id, observationId, planId, skillId, status, startedAt',
      knowledgeSkills: 'id, &url, name, domain, enabled',
      coopKnowledgeSkillOverrides: 'id, [coopId+knowledgeSkillId], coopId',
      agentLogs: 'id, traceId, spanType, skillId, observationId, level, timestamp',
    });
    this.version(10).stores({
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
      actionBundles: 'id, status, coopId, actionClass, createdAt',
      actionLogEntries: 'id, bundleId, eventType, createdAt',
      replayIds: 'replayId, bundleId, executedAt',
      executionGrants: 'id, coopId, status, createdAt, expiresAt',
      grantLogEntries: 'id, grantId, eventType, createdAt',
      sessionCapabilities: 'id, coopId, status, createdAt, updatedAt, sessionAddress',
      sessionCapabilityLogEntries: 'id, capabilityId, eventType, createdAt',
      encryptedSessionMaterials: 'capabilityId, sessionAddress, wrappedAt',
      agentObservations: 'id, status, trigger, coopId, createdAt, fingerprint',
      agentPlans: 'id, observationId, status, createdAt, updatedAt',
      skillRuns: 'id, observationId, planId, skillId, status, startedAt',
      knowledgeSkills: 'id, &url, name, domain, enabled',
      coopKnowledgeSkillOverrides: 'id, [coopId+knowledgeSkillId], coopId',
      agentLogs: 'id, traceId, spanType, skillId, observationId, level, timestamp',
      privacyIdentities: 'id, [coopId+memberId], coopId, memberId, commitment, createdAt',
      stealthKeyPairs: 'id, coopId, createdAt',
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
  if (!record?.value) return null;
  const result = soundPreferencesSchema.safeParse(record.value);
  return result.success ? result.data : null;
}

export async function setHapticPreferences(db: CoopDexie, value: HapticPreferences) {
  await db.settings.put({
    key: 'haptic-preferences',
    value,
  });
}

export async function getHapticPreferences(db: CoopDexie): Promise<HapticPreferences | null> {
  const record = await db.settings.get('haptic-preferences');
  if (!record?.value) return null;
  const result = hapticPreferencesSchema.safeParse(record.value);
  return result.success ? result.data : null;
}

export async function setUiPreferences(db: CoopDexie, value: UiPreferences) {
  await db.settings.put({
    key: 'ui-preferences',
    value,
  });
}

export async function getUiPreferences(db: CoopDexie): Promise<UiPreferences | null> {
  const record = await db.settings.get('ui-preferences');
  if (!record?.value) return null;
  const result = uiPreferencesSchema.safeParse(record.value);
  return result.success ? result.data : null;
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
  if (!record?.value) return null;
  const result = authSessionSchema.safeParse(record.value);
  return result.success ? result.data : null;
}

export async function setAnchorCapability(db: CoopDexie, value: AnchorCapability) {
  await db.settings.put({
    key: 'anchor-capability',
    value,
  });
}

export async function getAnchorCapability(db: CoopDexie): Promise<AnchorCapability | null> {
  const record = await db.settings.get('anchor-capability');
  if (!record?.value) return null;
  const result = anchorCapabilitySchema.safeParse(record.value);
  return result.success ? result.data : null;
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

  return record.value
    .map((entry) => privilegedActionLogEntrySchema.safeParse(entry))
    .filter((r) => r.success)
    .map((r) => r.data);
}

export async function setTrustedNodeArchiveConfig(db: CoopDexie, value: TrustedNodeArchiveConfig) {
  await db.settings.put({
    key: 'trusted-node-archive-config',
    value: trustedNodeArchiveConfigSchema.parse(value),
  });
}

export async function getTrustedNodeArchiveConfig(
  db: CoopDexie,
): Promise<TrustedNodeArchiveConfig | null> {
  const record = await db.settings.get('trusted-node-archive-config');
  if (!record?.value) return null;
  const result = trustedNodeArchiveConfigSchema.safeParse(record.value);
  return result.success ? result.data : null;
}

// --- Per-coop archive secrets (local-only, never synced) ---

export async function setCoopArchiveSecrets(
  db: CoopDexie,
  coopId: string,
  secrets: CoopArchiveSecrets,
) {
  await db.settings.put({
    key: `archive-secrets:${coopId}`,
    value: coopArchiveSecretsSchema.parse({ ...secrets, coopId }),
  });
}

export async function getCoopArchiveSecrets(
  db: CoopDexie,
  coopId: string,
): Promise<CoopArchiveSecrets | null> {
  const record = await db.settings.get(`archive-secrets:${coopId}`);
  if (!record?.value) return null;
  const result = coopArchiveSecretsSchema.safeParse(record.value);
  return result.success ? result.data : null;
}

export async function removeCoopArchiveSecrets(db: CoopDexie, coopId: string) {
  await db.settings.delete(`archive-secrets:${coopId}`);
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
  if (!record?.value) return null;
  const result = receiverDeviceIdentitySchema.safeParse(record.value);
  return result.success ? result.data : null;
}

// --- Action Policy persistence (stored in settings) ---

export async function setActionPolicies(db: CoopDexie, policies: ActionPolicy[]) {
  await db.settings.put({ key: 'action-policies', value: policies });
}

export async function listActionPolicies(db: CoopDexie): Promise<ActionPolicy[]> {
  const record = await db.settings.get('action-policies');
  if (!record?.value || !Array.isArray(record.value)) {
    return [];
  }
  return record.value.map((entry) => actionPolicySchema.parse(entry));
}

// --- Action Bundle persistence ---

export async function saveActionBundle(db: CoopDexie, bundle: ActionBundle) {
  await db.actionBundles.put(actionBundleSchema.parse(bundle));
}

export async function getActionBundle(db: CoopDexie, bundleId: string) {
  return db.actionBundles.get(bundleId);
}

export async function listActionBundles(db: CoopDexie) {
  return db.actionBundles.orderBy('createdAt').reverse().toArray();
}

export async function listActionBundlesByStatus(db: CoopDexie, statuses: ActionBundle['status'][]) {
  const all = await listActionBundles(db);
  const set = new Set(statuses);
  return all.filter((bundle) => set.has(bundle.status));
}

// --- Action Log persistence ---

export async function saveActionLogEntry(db: CoopDexie, entry: ActionLogEntry) {
  await db.actionLogEntries.put(actionLogEntrySchema.parse(entry));
}

export async function listActionLogEntries(db: CoopDexie, limit = 100) {
  return db.actionLogEntries.orderBy('createdAt').reverse().limit(limit).toArray();
}

// --- Replay ID persistence ---

export async function recordReplayId(
  db: CoopDexie,
  replayId: string,
  bundleId: string,
  executedAt: string,
) {
  await db.replayIds.put({ replayId, bundleId, executedAt });
}

export async function isReplayIdRecorded(db: CoopDexie, replayId: string) {
  return (await db.replayIds.get(replayId)) !== undefined;
}

export async function listRecordedReplayIds(db: CoopDexie) {
  const records = await db.replayIds.toArray();
  return records.map((r) => r.replayId);
}

// --- Execution Grant persistence ---

export async function saveExecutionGrant(db: CoopDexie, grant: ExecutionGrant) {
  await db.executionGrants.put(executionGrantSchema.parse(grant));
}

export async function getExecutionGrant(db: CoopDexie, grantId: string) {
  return db.executionGrants.get(grantId);
}

export async function listExecutionGrants(db: CoopDexie) {
  return db.executionGrants.orderBy('createdAt').reverse().toArray();
}

export async function listExecutionGrantsByCoopId(db: CoopDexie, coopId: string) {
  return db.executionGrants.where('coopId').equals(coopId).reverse().sortBy('createdAt');
}

// --- Grant Log persistence ---

export async function saveGrantLogEntry(db: CoopDexie, entry: GrantLogEntry) {
  await db.grantLogEntries.put(grantLogEntrySchema.parse(entry));
}

export async function listGrantLogEntries(db: CoopDexie, limit = 100) {
  return db.grantLogEntries.orderBy('createdAt').reverse().limit(limit).toArray();
}

// --- Session capability persistence ---

export async function saveSessionCapability(db: CoopDexie, capability: SessionCapability) {
  await db.sessionCapabilities.put(sessionCapabilitySchema.parse(capability));
}

export async function getSessionCapability(db: CoopDexie, capabilityId: string) {
  return db.sessionCapabilities.get(capabilityId);
}

export async function listSessionCapabilities(db: CoopDexie) {
  return db.sessionCapabilities.orderBy('createdAt').reverse().toArray();
}

export async function listSessionCapabilitiesByCoopId(db: CoopDexie, coopId: string) {
  return db.sessionCapabilities.where('coopId').equals(coopId).reverse().sortBy('createdAt');
}

export async function saveSessionCapabilityLogEntry(
  db: CoopDexie,
  entry: SessionCapabilityLogEntry,
) {
  await db.sessionCapabilityLogEntries.put(sessionCapabilityLogEntrySchema.parse(entry));
}

export async function listSessionCapabilityLogEntries(db: CoopDexie, limit = 200) {
  return db.sessionCapabilityLogEntries.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function saveEncryptedSessionMaterial(
  db: CoopDexie,
  material: EncryptedSessionMaterial,
) {
  await db.encryptedSessionMaterials.put(encryptedSessionMaterialSchema.parse(material));
}

export async function getEncryptedSessionMaterial(db: CoopDexie, capabilityId: string) {
  return db.encryptedSessionMaterials.get(capabilityId);
}

export async function deleteEncryptedSessionMaterial(db: CoopDexie, capabilityId: string) {
  await db.encryptedSessionMaterials.delete(capabilityId);
}

// --- Agent persistence ---

export async function saveAgentObservation(db: CoopDexie, observation: AgentObservation) {
  await db.agentObservations.put(agentObservationSchema.parse(observation));
}

export async function getAgentObservation(db: CoopDexie, observationId: string) {
  return db.agentObservations.get(observationId);
}

export async function listAgentObservations(db: CoopDexie, limit = 100) {
  return db.agentObservations.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function findAgentObservationByFingerprint(db: CoopDexie, fingerprint: string) {
  return db.agentObservations.where('fingerprint').equals(fingerprint).first();
}

export async function listAgentObservationsByStatus(
  db: CoopDexie,
  statuses: AgentObservation['status'][],
) {
  const all = await listAgentObservations(db, 500);
  const set = new Set(statuses);
  return all.filter((observation) => set.has(observation.status));
}

export async function saveAgentPlan(db: CoopDexie, plan: AgentPlan) {
  await db.agentPlans.put(agentPlanSchema.parse(plan));
}

export async function getAgentPlan(db: CoopDexie, planId: string) {
  return db.agentPlans.get(planId);
}

export async function listAgentPlans(db: CoopDexie, limit = 100) {
  return db.agentPlans.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function listAgentPlansByObservationId(db: CoopDexie, observationId: string) {
  return db.agentPlans.where('observationId').equals(observationId).reverse().sortBy('createdAt');
}

export async function saveSkillRun(db: CoopDexie, run: SkillRun) {
  await db.skillRuns.put(skillRunSchema.parse(run));
}

export async function getSkillRun(db: CoopDexie, skillRunId: string) {
  return db.skillRuns.get(skillRunId);
}

export async function listSkillRuns(db: CoopDexie, limit = 200) {
  return db.skillRuns.orderBy('startedAt').reverse().limit(limit).toArray();
}

export async function listSkillRunsByPlanId(db: CoopDexie, planId: string) {
  return db.skillRuns.where('planId').equals(planId).reverse().sortBy('startedAt');
}

// --- Knowledge skills ---

export async function saveKnowledgeSkill(db: CoopDexie, skill: KnowledgeSkill) {
  await db.knowledgeSkills.put(skill);
}

export async function getKnowledgeSkill(db: CoopDexie, skillId: string) {
  return db.knowledgeSkills.get(skillId);
}

export async function listKnowledgeSkills(db: CoopDexie) {
  return db.knowledgeSkills.toArray();
}

export async function deleteKnowledgeSkill(db: CoopDexie, skillId: string) {
  await db.knowledgeSkills.delete(skillId);
}

export async function saveCoopKnowledgeSkillOverride(
  db: CoopDexie,
  override: CoopKnowledgeSkillOverride,
) {
  await db.coopKnowledgeSkillOverrides.put(override);
}

export async function listCoopKnowledgeSkillOverrides(db: CoopDexie, coopId: string) {
  return db.coopKnowledgeSkillOverrides.where('coopId').equals(coopId).toArray();
}

// --- Agent logs ---

export async function saveAgentLog(db: CoopDexie, log: AgentLog) {
  await db.agentLogs.put(log);
}

export async function listAgentLogsByTraceId(db: CoopDexie, traceId: string) {
  return db.agentLogs.where('traceId').equals(traceId).sortBy('timestamp');
}

export async function listRecentAgentLogs(db: CoopDexie, limit = 200) {
  return db.agentLogs.orderBy('timestamp').reverse().limit(limit).toArray();
}

// --- Privacy identity persistence ---

export async function savePrivacyIdentity(db: CoopDexie, record: PrivacyIdentityRecord) {
  await db.privacyIdentities.put(record);
}

export async function getPrivacyIdentity(db: CoopDexie, coopId: string, memberId: string) {
  return db.privacyIdentities.where({ coopId, memberId }).first();
}

export async function getPrivacyIdentitiesForCoop(db: CoopDexie, coopId: string) {
  return db.privacyIdentities.where({ coopId }).toArray();
}

// --- Stealth key pair persistence ---

export async function saveStealthKeyPair(db: CoopDexie, record: StealthKeyPairRecord) {
  await db.stealthKeyPairs.put(record);
}

export async function getStealthKeyPair(db: CoopDexie, coopId: string) {
  return db.stealthKeyPairs.where({ coopId }).first();
}

// --- Legacy chain key migration ---

/**
 * One-time migration: normalizes legacy chain keys (celo → arbitrum,
 * celo-sepolia → sepolia) stored in coop docs. Idempotent — safe to
 * run multiple times; modern keys pass through unchanged.
 */
export async function migrateLegacyChainKeys(db: CoopDexie) {
  const records = await db.coopDocs.toArray();

  for (const record of records) {
    const doc = hydrateCoopDoc(record.encodedState);
    const root = doc.getMap<string>('coop');
    const rawOnchain = root.get('onchainState');
    if (!rawOnchain) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawOnchain);
    } catch {
      continue;
    }

    const normalized = normalizeLegacyOnchainState(parsed);
    if (normalized === parsed) continue;

    // Check if anything actually changed
    const normalizedJson = JSON.stringify(normalized);
    if (normalizedJson === rawOnchain) continue;

    doc.transact(() => {
      root.set('onchainState', normalizedJson);
    });

    await db.coopDocs.put({
      ...record,
      encodedState: Y.encodeStateAsUpdate(doc),
      updatedAt: new Date().toISOString(),
    });
  }
}
