import Dexie, { type EntityTable } from 'dexie';
import * as Y from 'yjs';
import type {
  ActionBundle,
  ActionLogEntry,
  ActionPolicy,
  AgentLog,
  AgentMemory,
  AgentObservation,
  AgentPlan,
  AnchorCapability,
  AuthSession,
  CoopArchiveSecrets,
  CoopBlobRecord,
  CoopKnowledgeSkillOverride,
  CoopSharedState,
  EncryptedLocalPayload,
  EncryptedLocalPayloadKind,
  EncryptedSessionMaterial,
  ExecutionPermit,
  HapticPreferences,
  KnowledgeSkill,
  LocalMemberSignerBinding,
  LocalPasskeyIdentity,
  PermitLogEntry,
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
  TabRouting,
  TrustedNodeArchiveConfig,
  UiPreferences,
} from '../../contracts/schema';
import {
  actionBundleSchema,
  actionLogEntrySchema,
  actionPolicySchema,
  agentMemorySchema,
  agentObservationSchema,
  agentPlanSchema,
  anchorCapabilitySchema,
  authSessionSchema,
  coopArchiveSecretsSchema,
  encryptedLocalPayloadSchema,
  encryptedSessionMaterialSchema,
  executionPermitSchema,
  hapticPreferencesSchema,
  localMemberSignerBindingSchema,
  normalizeLegacyOnchainState,
  permitLogEntrySchema,
  privilegedActionLogEntrySchema,
  readablePageExtractSchema,
  receiverCaptureSchema,
  receiverDeviceIdentitySchema,
  reviewDraftSchema,
  sessionCapabilityLogEntrySchema,
  sessionCapabilitySchema,
  skillRunSchema,
  soundPreferencesSchema,
  tabCandidateSchema,
  tabRoutingSchema,
  trustedNodeArchiveConfigSchema,
  uiPreferencesSchema,
} from '../../contracts/schema';
import { base64ToBytes, bytesToBase64, nowIso } from '../../utils';
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
  capturedDomains?: string[];
  skippedCount?: number;
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
  localMemberSignerBindings!: EntityTable<LocalMemberSignerBinding, 'id'>;
  receiverPairings!: EntityTable<ReceiverPairingRecord, 'pairingId'>;
  receiverCaptures!: EntityTable<ReceiverCapture, 'id'>;
  receiverBlobs!: EntityTable<ReceiverBlobRecord, 'captureId'>;
  actionBundles!: EntityTable<ActionBundle, 'id'>;
  actionLogEntries!: EntityTable<ActionLogEntry, 'id'>;
  replayIds!: EntityTable<ReplayIdRecord, 'replayId'>;
  executionPermits!: EntityTable<ExecutionPermit, 'id'>;
  permitLogEntries!: EntityTable<PermitLogEntry, 'id'>;
  sessionCapabilities!: EntityTable<SessionCapability, 'id'>;
  sessionCapabilityLogEntries!: EntityTable<SessionCapabilityLogEntry, 'id'>;
  encryptedSessionMaterials!: EntityTable<EncryptedSessionMaterial, 'capabilityId'>;
  agentObservations!: EntityTable<AgentObservation, 'id'>;
  agentPlans!: EntityTable<AgentPlan, 'id'>;
  skillRuns!: EntityTable<SkillRun, 'id'>;
  tabRoutings!: EntityTable<TabRouting, 'id'>;
  knowledgeSkills!: EntityTable<KnowledgeSkill, 'id'>;
  coopKnowledgeSkillOverrides!: EntityTable<CoopKnowledgeSkillOverride, 'id'>;
  agentLogs!: EntityTable<AgentLog, 'id'>;
  privacyIdentities!: EntityTable<PrivacyIdentityRecord, 'id'>;
  stealthKeyPairs!: EntityTable<StealthKeyPairRecord, 'id'>;
  agentMemories!: EntityTable<AgentMemory, 'id'>;
  encryptedLocalPayloads!: EntityTable<EncryptedLocalPayload, 'id'>;
  coopBlobs!: EntityTable<CoopBlobRecord, 'blobId'>;

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
      executionPermits: 'id, coopId, status, createdAt, expiresAt',
      permitLogEntries: 'id, permitId, eventType, createdAt',
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
      executionPermits: 'id, coopId, status, createdAt, expiresAt',
      permitLogEntries: 'id, permitId, eventType, createdAt',
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
      executionPermits: 'id, coopId, status, createdAt, expiresAt',
      permitLogEntries: 'id, permitId, eventType, createdAt',
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
      executionPermits: 'id, coopId, status, createdAt, expiresAt',
      permitLogEntries: 'id, permitId, eventType, createdAt',
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
      executionPermits: 'id, coopId, status, createdAt, expiresAt',
      permitLogEntries: 'id, permitId, eventType, createdAt',
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
    this.version(11).stores({
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
      executionPermits: 'id, coopId, status, createdAt, expiresAt',
      permitLogEntries: 'id, permitId, eventType, createdAt',
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
      agentMemories: 'id, coopId, type, domain, createdAt, expiresAt, contentHash',
    });
    this.version(12).stores({
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
      executionPermits: 'id, coopId, status, createdAt, expiresAt',
      permitLogEntries: 'id, permitId, eventType, createdAt',
      sessionCapabilities: 'id, coopId, status, createdAt, updatedAt, sessionAddress',
      sessionCapabilityLogEntries: 'id, capabilityId, eventType, createdAt',
      encryptedSessionMaterials: 'capabilityId, sessionAddress, wrappedAt',
      agentObservations: 'id, status, trigger, coopId, createdAt, fingerprint',
      agentPlans: 'id, observationId, status, createdAt, updatedAt',
      skillRuns: 'id, observationId, planId, skillId, status, startedAt',
      tabRoutings:
        'id, [extractId+coopId], sourceCandidateId, extractId, coopId, status, createdAt, updatedAt',
      knowledgeSkills: 'id, &url, name, domain, enabled',
      coopKnowledgeSkillOverrides: 'id, [coopId+knowledgeSkillId], coopId',
      agentLogs: 'id, traceId, spanType, skillId, observationId, level, timestamp',
      privacyIdentities: 'id, [coopId+memberId], coopId, memberId, commitment, createdAt',
      stealthKeyPairs: 'id, coopId, createdAt',
      agentMemories: 'id, coopId, type, domain, createdAt, expiresAt, contentHash',
    });
    this.version(13).stores({
      tabCandidates: 'id, canonicalUrl, domain, capturedAt',
      pageExtracts: 'id, canonicalUrl, domain, createdAt',
      reviewDrafts: 'id, category, createdAt, workflowStage',
      coopDocs: 'id, updatedAt',
      captureRuns: 'id, state, capturedAt',
      settings: 'key',
      identities: 'id, ownerAddress, displayName, createdAt, lastUsedAt',
      localMemberSignerBindings:
        'id, [coopId+memberId], coopId, memberId, accountAddress, passkeyCredentialId, createdAt, lastUsedAt',
      receiverPairings: 'pairingId, coopId, memberId, roomId, issuedAt, acceptedAt, active',
      receiverCaptures:
        'id, kind, createdAt, syncState, pairingId, coopId, memberId, intakeStatus, linkedDraftId',
      receiverBlobs: 'captureId',
      actionBundles: 'id, status, coopId, actionClass, createdAt',
      actionLogEntries: 'id, bundleId, eventType, createdAt',
      replayIds: 'replayId, bundleId, executedAt',
      executionPermits: 'id, coopId, status, createdAt, expiresAt',
      permitLogEntries: 'id, permitId, eventType, createdAt',
      sessionCapabilities: 'id, coopId, status, createdAt, updatedAt, sessionAddress',
      sessionCapabilityLogEntries: 'id, capabilityId, eventType, createdAt',
      encryptedSessionMaterials: 'capabilityId, sessionAddress, wrappedAt',
      agentObservations: 'id, status, trigger, coopId, createdAt, fingerprint',
      agentPlans: 'id, observationId, status, createdAt, updatedAt',
      skillRuns: 'id, observationId, planId, skillId, status, startedAt',
      tabRoutings:
        'id, [extractId+coopId], sourceCandidateId, extractId, coopId, status, createdAt, updatedAt',
      knowledgeSkills: 'id, &url, name, domain, enabled',
      coopKnowledgeSkillOverrides: 'id, [coopId+knowledgeSkillId], coopId',
      agentLogs: 'id, traceId, spanType, skillId, observationId, level, timestamp',
      privacyIdentities: 'id, [coopId+memberId], coopId, memberId, commitment, createdAt',
      stealthKeyPairs: 'id, coopId, createdAt',
      agentMemories: 'id, coopId, type, domain, createdAt, expiresAt, contentHash',
    });
    this.version(14)
      .stores({
        tabCandidates: 'id, canonicalUrl, domain, capturedAt',
        pageExtracts: 'id, canonicalUrl, domain, createdAt',
        reviewDrafts: 'id, category, createdAt, workflowStage',
        coopDocs: 'id, updatedAt',
        captureRuns: 'id, state, capturedAt',
        settings: 'key',
        identities: 'id, ownerAddress, displayName, createdAt, lastUsedAt',
        localMemberSignerBindings:
          'id, [coopId+memberId], coopId, memberId, accountAddress, passkeyCredentialId, createdAt, lastUsedAt',
        receiverPairings: 'pairingId, coopId, memberId, roomId, issuedAt, acceptedAt, active',
        receiverCaptures:
          'id, kind, createdAt, syncState, pairingId, coopId, memberId, intakeStatus, linkedDraftId',
        receiverBlobs: 'captureId',
        actionBundles: 'id, status, coopId, actionClass, createdAt',
        actionLogEntries: 'id, bundleId, eventType, createdAt',
        replayIds: 'replayId, bundleId, executedAt',
        executionPermits: 'id, coopId, status, createdAt, expiresAt',
        permitLogEntries: 'id, permitId, eventType, createdAt',
        sessionCapabilities: 'id, coopId, status, createdAt, updatedAt, sessionAddress',
        sessionCapabilityLogEntries: 'id, capabilityId, eventType, createdAt',
        encryptedSessionMaterials: 'capabilityId, sessionAddress, wrappedAt',
        agentObservations: 'id, status, trigger, coopId, createdAt, fingerprint',
        agentPlans: 'id, observationId, status, createdAt, updatedAt',
        skillRuns: 'id, observationId, planId, skillId, status, startedAt',
        tabRoutings:
          'id, [extractId+coopId], sourceCandidateId, extractId, coopId, status, createdAt, updatedAt',
        knowledgeSkills: 'id, &url, name, domain, enabled',
        coopKnowledgeSkillOverrides: 'id, [coopId+knowledgeSkillId], coopId',
        agentLogs: 'id, traceId, spanType, skillId, observationId, level, timestamp',
        privacyIdentities: 'id, [coopId+memberId], coopId, memberId, commitment, createdAt',
        stealthKeyPairs: 'id, coopId, createdAt',
        agentMemories: 'id, coopId, type, domain, createdAt, expiresAt, contentHash',
        encryptedLocalPayloads: 'id, [kind+entityId], kind, entityId, wrappedAt, expiresAt',
      })
      .upgrade(async (tx) => {
        await tx.table('knowledgeSkills').clear();
        await tx.table('coopKnowledgeSkillOverrides').clear();
      });
    this.version(15).stores({
      tabCandidates: 'id, canonicalUrl, domain, capturedAt',
      pageExtracts: 'id, canonicalUrl, domain, createdAt',
      reviewDrafts: 'id, category, createdAt, workflowStage',
      coopDocs: 'id, updatedAt',
      captureRuns: 'id, state, capturedAt',
      settings: 'key',
      identities: 'id, ownerAddress, displayName, createdAt, lastUsedAt',
      localMemberSignerBindings:
        'id, [coopId+memberId], coopId, memberId, accountAddress, passkeyCredentialId, createdAt, lastUsedAt',
      receiverPairings: 'pairingId, coopId, memberId, roomId, issuedAt, acceptedAt, active',
      receiverCaptures:
        'id, kind, createdAt, syncState, pairingId, coopId, memberId, intakeStatus, linkedDraftId',
      receiverBlobs: 'captureId',
      actionBundles: 'id, status, coopId, actionClass, createdAt',
      actionLogEntries: 'id, bundleId, eventType, createdAt',
      replayIds: 'replayId, bundleId, executedAt',
      executionPermits: 'id, coopId, status, createdAt, expiresAt',
      permitLogEntries: 'id, permitId, eventType, createdAt',
      sessionCapabilities: 'id, coopId, status, createdAt, updatedAt, sessionAddress',
      sessionCapabilityLogEntries: 'id, capabilityId, eventType, createdAt',
      encryptedSessionMaterials: 'capabilityId, sessionAddress, wrappedAt',
      agentObservations: 'id, status, trigger, coopId, createdAt, fingerprint',
      agentPlans: 'id, observationId, status, createdAt, updatedAt',
      skillRuns: 'id, observationId, planId, skillId, status, startedAt',
      tabRoutings:
        'id, [extractId+coopId], sourceCandidateId, extractId, coopId, status, createdAt, updatedAt',
      knowledgeSkills: 'id, &url, name, domain, enabled',
      coopKnowledgeSkillOverrides: 'id, [coopId+knowledgeSkillId], coopId',
      agentLogs: 'id, traceId, spanType, skillId, observationId, level, timestamp',
      privacyIdentities: 'id, [coopId+memberId], coopId, memberId, commitment, createdAt',
      stealthKeyPairs: 'id, coopId, createdAt',
      agentMemories: 'id, coopId, type, domain, createdAt, expiresAt, contentHash',
      encryptedLocalPayloads: 'id, [kind+entityId], kind, entityId, wrappedAt, expiresAt',
      coopBlobs: 'blobId, sourceEntityId, coopId, kind, origin, accessedAt',
    });
  }
}

const LOCAL_DATA_WRAPPING_SECRET_KEY = 'session-wrapping-secret';
const LOCAL_DATA_PLACEHOLDER_PREFIX = 'encrypted://local';
const LOCAL_DATA_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
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

function buildRedactedTabCandidate(candidate: TabCandidate): TabCandidate {
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

function buildRedactedPageExtract(extract: ReadablePageExtract): ReadablePageExtract {
  return readablePageExtractSchema.parse({
    ...extract,
    canonicalUrl: buildEncryptedPlaceholderUrl('page-extract', extract.id),
    cleanedTitle: 'Encrypted page extract',
    metaDescription: undefined,
    topHeadings: [],
    leadParagraphs: [],
    salientTextBlocks: [],
    previewImageUrl: undefined,
  });
}

function buildRedactedReviewDraft(draft: ReviewDraft): ReviewDraft {
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

function buildRedactedReceiverCapture(capture: ReceiverCapture): ReceiverCapture {
  return receiverCaptureSchema.parse({
    ...capture,
    title: 'Encrypted local capture',
    note: '',
    sourceUrl: undefined,
    fileName: undefined,
  });
}

function buildRedactedAgentMemory(memory: AgentMemory): AgentMemory {
  return agentMemorySchema.parse({
    ...memory,
    content: 'Encrypted local memory',
  });
}

function looksRedactedTabCandidate(candidate: TabCandidate) {
  return candidate.url.startsWith(`${LOCAL_DATA_PLACEHOLDER_PREFIX}/tab-candidate/`);
}

function looksRedactedPageExtract(extract: ReadablePageExtract) {
  return extract.canonicalUrl.startsWith(`${LOCAL_DATA_PLACEHOLDER_PREFIX}/page-extract/`);
}

function looksRedactedReviewDraft(draft: ReviewDraft) {
  return (
    draft.title === 'Encrypted review draft' && draft.summary === 'Encrypted local review content.'
  );
}

function looksRedactedReceiverCapture(capture: ReceiverCapture) {
  return capture.title === 'Encrypted local capture' && !capture.sourceUrl && capture.note === '';
}

function looksRedactedAgentMemory(memory: AgentMemory) {
  return memory.content === 'Encrypted local memory';
}

async function ensureLocalDataWrappingSecret(db: CoopDexie) {
  const existing = await db.settings.get(LOCAL_DATA_WRAPPING_SECRET_KEY);
  if (typeof existing?.value === 'string' && existing.value.length > 0) {
    return existing.value;
  }

  const secret = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  await db.settings.put({
    key: LOCAL_DATA_WRAPPING_SECRET_KEY,
    value: secret,
  });
  return secret;
}

async function deriveLocalDataKey(secret: string, salt: Uint8Array) {
  const encoder = new TextEncoder();
  const saltBytes = Uint8Array.from(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
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

async function loadEncryptedJsonPayload<T>(
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

async function loadEncryptedBlobPayload(
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

function resolveTabCandidatePayloadExpiry(candidate: TabCandidate) {
  return new Date(new Date(candidate.capturedAt).getTime() + LOCAL_DATA_RETENTION_MS).toISOString();
}

function resolvePageExtractPayloadExpiry(extract: ReadablePageExtract) {
  return new Date(new Date(extract.createdAt).getTime() + LOCAL_DATA_RETENTION_MS).toISOString();
}

async function hydrateTabCandidateRecord(db: CoopDexie, candidate?: TabCandidate) {
  if (!candidate) {
    return undefined;
  }
  return (
    (await loadEncryptedJsonPayload(db, 'tab-candidate', candidate.id, (value) =>
      tabCandidateSchema.parse(value),
    )) ?? candidate
  );
}

async function hydratePageExtractRecord(db: CoopDexie, extract?: ReadablePageExtract) {
  if (!extract) {
    return undefined;
  }
  return (
    (await loadEncryptedJsonPayload(db, 'page-extract', extract.id, (value) =>
      readablePageExtractSchema.parse(value),
    )) ?? extract
  );
}

async function hydrateReviewDraftRecord(db: CoopDexie, draft?: ReviewDraft) {
  if (!draft) {
    return undefined;
  }
  return (
    (await loadEncryptedJsonPayload(db, 'review-draft', draft.id, (value) =>
      reviewDraftSchema.parse(value),
    )) ?? draft
  );
}

async function hydrateReceiverCaptureRecord(db: CoopDexie, capture?: ReceiverCapture) {
  if (!capture) {
    return undefined;
  }
  return (
    (await loadEncryptedJsonPayload(db, 'receiver-capture', capture.id, (value) =>
      receiverCaptureSchema.parse(value),
    )) ?? capture
  );
}

async function hydrateAgentMemoryRecord(db: CoopDexie, memory?: AgentMemory) {
  if (!memory) {
    return undefined;
  }
  return (
    (await loadEncryptedJsonPayload(db, 'agent-memory', memory.id, (value) =>
      agentMemorySchema.parse(value),
    )) ?? memory
  );
}

export function createCoopDb(name?: string) {
  return new CoopDexie(name);
}

export async function saveCoopState(db: CoopDexie, state: CoopSharedState) {
  const doc = createCoopDoc(state);
  await db.coopDocs.put({
    id: state.profile.id,
    encodedState: encodeCoopDoc(doc),
    updatedAt: nowIso(),
  });
}

export async function saveTabCandidate(db: CoopDexie, candidate: TabCandidate) {
  const payload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'tab-candidate',
    entityId: candidate.id,
    bytes: new TextEncoder().encode(JSON.stringify(tabCandidateSchema.parse(candidate))),
    expiresAt: resolveTabCandidatePayloadExpiry(candidate),
  });

  await db.transaction('rw', db.tabCandidates, db.encryptedLocalPayloads, async () => {
    await db.tabCandidates.put(buildRedactedTabCandidate(candidate));
    await db.encryptedLocalPayloads.put(payload);
  });
}

export async function getTabCandidate(db: CoopDexie, candidateId: string) {
  return hydrateTabCandidateRecord(db, await db.tabCandidates.get(candidateId));
}

export async function listTabCandidates(db: CoopDexie, limit?: number) {
  const candidates = await db.tabCandidates.orderBy('capturedAt').reverse().toArray();
  const hydrated = await Promise.all(
    candidates.map((candidate) => hydrateTabCandidateRecord(db, candidate)),
  );
  const filtered = hydrated.filter((candidate): candidate is TabCandidate => Boolean(candidate));
  return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
}

export async function savePageExtract(db: CoopDexie, extract: ReadablePageExtract) {
  const payload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'page-extract',
    entityId: extract.id,
    bytes: new TextEncoder().encode(JSON.stringify(readablePageExtractSchema.parse(extract))),
    expiresAt: resolvePageExtractPayloadExpiry(extract),
  });

  await db.transaction('rw', db.pageExtracts, db.encryptedLocalPayloads, async () => {
    await db.pageExtracts.put(buildRedactedPageExtract(extract));
    await db.encryptedLocalPayloads.put(payload);
  });
}

export async function getPageExtract(db: CoopDexie, extractId: string) {
  return hydratePageExtractRecord(db, await db.pageExtracts.get(extractId));
}

export async function listPageExtracts(db: CoopDexie) {
  const extracts = await db.pageExtracts.orderBy('createdAt').reverse().toArray();
  const hydrated = await Promise.all(
    extracts.map((extract) => hydratePageExtractRecord(db, extract)),
  );
  return hydrated.filter((extract): extract is ReadablePageExtract => Boolean(extract));
}

export async function saveReviewDraft(db: CoopDexie, draft: ReviewDraft) {
  const payload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'review-draft',
    entityId: draft.id,
    bytes: new TextEncoder().encode(JSON.stringify(reviewDraftSchema.parse(draft))),
  });

  await db.transaction('rw', db.reviewDrafts, db.encryptedLocalPayloads, async () => {
    await db.reviewDrafts.put(buildRedactedReviewDraft(draft));
    await db.encryptedLocalPayloads.put(payload);
  });
}

export async function getReviewDraft(db: CoopDexie, draftId: string) {
  return hydrateReviewDraftRecord(db, await db.reviewDrafts.get(draftId));
}

export async function listReviewDrafts(db: CoopDexie) {
  const drafts = await db.reviewDrafts.orderBy('createdAt').reverse().toArray();
  const hydrated = await Promise.all(drafts.map((draft) => hydrateReviewDraftRecord(db, draft)));
  return hydrated.filter((draft): draft is ReviewDraft => Boolean(draft));
}

export async function listReviewDraftsByWorkflowStage(
  db: CoopDexie,
  workflowStage: ReviewDraft['workflowStage'],
) {
  const drafts = await db.reviewDrafts.where('workflowStage').equals(workflowStage).toArray();
  const hydrated = await Promise.all(drafts.map((draft) => hydrateReviewDraftRecord(db, draft)));
  return hydrated.filter((draft): draft is ReviewDraft => Boolean(draft));
}

export async function updateReviewDraft(
  db: CoopDexie,
  draftId: string,
  patch: Partial<ReviewDraft>,
) {
  const current = await getReviewDraft(db, draftId);
  if (!current) {
    return null;
  }

  const next = reviewDraftSchema.parse({
    ...current,
    ...patch,
  });
  await saveReviewDraft(db, next);
  return next;
}

export async function deleteReviewDraft(db: CoopDexie, draftId: string) {
  await db.transaction('rw', db.reviewDrafts, db.encryptedLocalPayloads, async () => {
    await db.reviewDrafts.delete(draftId);
    await db.encryptedLocalPayloads.delete(buildEncryptedLocalPayloadId('review-draft', draftId));
  });
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

async function persistReceiverCapture(db: CoopDexie, capture: ReceiverCapture, blob?: Blob | null) {
  const blobBytes =
    blob && blob.size > 0
      ? typeof blob.arrayBuffer === 'function'
        ? new Uint8Array(await blob.arrayBuffer())
        : new Uint8Array(await new Response(blob).arrayBuffer())
      : null;
  const capturePayload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'receiver-capture',
    entityId: capture.id,
    bytes: new TextEncoder().encode(JSON.stringify(receiverCaptureSchema.parse(capture))),
  });
  const blobPayload = blobBytes
    ? await buildEncryptedLocalPayloadRecord({
        db,
        kind: 'receiver-blob',
        entityId: capture.id,
        bytes: blobBytes,
      })
    : null;

  await db.transaction(
    'rw',
    db.receiverCaptures,
    db.receiverBlobs,
    db.encryptedLocalPayloads,
    async () => {
      await db.receiverCaptures.put(buildRedactedReceiverCapture(capture));
      await db.encryptedLocalPayloads.put(capturePayload);
      if (blobPayload) {
        await db.encryptedLocalPayloads.put(blobPayload);
      } else {
        await db.encryptedLocalPayloads.delete(
          buildEncryptedLocalPayloadId('receiver-blob', capture.id),
        );
      }
      await db.receiverBlobs.delete(capture.id);
    },
  );
}

export async function saveReceiverCapture(db: CoopDexie, capture: ReceiverCapture, blob: Blob) {
  await persistReceiverCapture(db, capture, blob);
}

export async function listReceiverCaptures(db: CoopDexie) {
  const captures = await db.receiverCaptures.orderBy('createdAt').reverse().toArray();
  const hydrated = await Promise.all(
    captures.map((capture) => hydrateReceiverCaptureRecord(db, capture)),
  );
  return hydrated.filter((capture): capture is ReceiverCapture => Boolean(capture));
}

export async function getReceiverCapture(db: CoopDexie, captureId: string) {
  return hydrateReceiverCaptureRecord(db, await db.receiverCaptures.get(captureId));
}

export async function getReceiverCaptureBlob(db: CoopDexie, captureId: string) {
  const capture = await getReceiverCapture(db, captureId);
  const encryptedBlob = await loadEncryptedBlobPayload(
    db,
    captureId,
    capture?.mimeType ?? 'application/octet-stream',
  );
  if (encryptedBlob) {
    return encryptedBlob;
  }

  return (await db.receiverBlobs.get(captureId))?.blob ?? null;
}

export async function updateReceiverCapture(
  db: CoopDexie,
  captureId: string,
  patch: Partial<ReceiverCapture>,
) {
  const current = await getReceiverCapture(db, captureId);
  if (!current) {
    return null;
  }
  const next = receiverCaptureSchema.parse({
    ...current,
    ...patch,
  });
  await persistReceiverCapture(db, next, await getReceiverCaptureBlob(db, captureId));
  return next;
}

export async function deleteReceiverCapture(db: CoopDexie, captureId: string) {
  await db.transaction(
    'rw',
    db.receiverCaptures,
    db.receiverBlobs,
    db.encryptedLocalPayloads,
    async () => {
      await db.receiverCaptures.delete(captureId);
      await db.receiverBlobs.delete(captureId);
      await db.encryptedLocalPayloads.delete(
        buildEncryptedLocalPayloadId('receiver-capture', captureId),
      );
      await db.encryptedLocalPayloads.delete(
        buildEncryptedLocalPayloadId('receiver-blob', captureId),
      );
    },
  );
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

// --- Execution Permit persistence ---

export async function saveExecutionPermit(db: CoopDexie, permit: ExecutionPermit) {
  await db.executionPermits.put(executionPermitSchema.parse(permit));
}

export async function getExecutionPermit(db: CoopDexie, permitId: string) {
  return db.executionPermits.get(permitId);
}

export async function listExecutionPermits(db: CoopDexie) {
  return db.executionPermits.orderBy('createdAt').reverse().toArray();
}

export async function listExecutionPermitsByCoopId(db: CoopDexie, coopId: string) {
  return db.executionPermits.where('coopId').equals(coopId).reverse().sortBy('createdAt');
}

// --- Permit Log persistence ---

export async function savePermitLogEntry(db: CoopDexie, entry: PermitLogEntry) {
  await db.permitLogEntries.put(permitLogEntrySchema.parse(entry));
}

export async function listPermitLogEntries(db: CoopDexie, limit = 100) {
  return db.permitLogEntries.orderBy('createdAt').reverse().limit(limit).toArray();
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

// --- Local member signer binding persistence ---

export async function saveLocalMemberSignerBinding(
  db: CoopDexie,
  binding: LocalMemberSignerBinding,
) {
  await db.localMemberSignerBindings.put(localMemberSignerBindingSchema.parse(binding));
}

export async function getLocalMemberSignerBinding(db: CoopDexie, coopId: string, memberId: string) {
  return db.localMemberSignerBindings.where('[coopId+memberId]').equals([coopId, memberId]).first();
}

export async function listLocalMemberSignerBindingsByCoopId(db: CoopDexie, coopId: string) {
  return db.localMemberSignerBindings.where('coopId').equals(coopId).toArray();
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

// --- Tab routing persistence ---

export async function saveTabRouting(db: CoopDexie, routing: TabRouting) {
  const parsed = tabRoutingSchema.parse(routing);
  const existing = await db.tabRoutings
    .where('[extractId+coopId]')
    .equals([parsed.extractId, parsed.coopId])
    .first();
  await db.tabRoutings.put({
    ...parsed,
    id: existing?.id ?? parsed.id,
    createdAt: existing?.createdAt ?? parsed.createdAt,
  });
}

export async function getTabRoutingByExtractAndCoop(
  db: CoopDexie,
  extractId: string,
  coopId: string,
) {
  return db.tabRoutings.where('[extractId+coopId]').equals([extractId, coopId]).first();
}

export async function listTabRoutings(
  db: CoopDexie,
  options: {
    coopId?: string;
    extractId?: string;
    sourceCandidateId?: string;
    status?: TabRouting['status'][];
    limit?: number;
  } = {},
) {
  let results = await db.tabRoutings.orderBy('updatedAt').reverse().toArray();
  if (options.coopId) {
    results = results.filter((routing) => routing.coopId === options.coopId);
  }
  if (options.extractId) {
    results = results.filter((routing) => routing.extractId === options.extractId);
  }
  if (options.sourceCandidateId) {
    results = results.filter((routing) => routing.sourceCandidateId === options.sourceCandidateId);
  }
  if (options.status?.length) {
    const allowed = new Set(options.status);
    results = results.filter((routing) => allowed.has(routing.status));
  }
  return typeof options.limit === 'number' ? results.slice(0, options.limit) : results;
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

export async function deleteCoopKnowledgeSkillOverride(db: CoopDexie, overrideId: string) {
  await db.coopKnowledgeSkillOverrides.delete(overrideId);
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

// --- Sensitive local content maintenance ---

export async function saveAgentMemory(db: CoopDexie, memory: AgentMemory) {
  const payload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'agent-memory',
    entityId: memory.id,
    bytes: new TextEncoder().encode(JSON.stringify(agentMemorySchema.parse(memory))),
  });

  await db.transaction('rw', db.agentMemories, db.encryptedLocalPayloads, async () => {
    await db.agentMemories.put(buildRedactedAgentMemory(memory));
    await db.encryptedLocalPayloads.put(payload);
  });
}

export async function getAgentMemory(db: CoopDexie, memoryId: string) {
  return hydrateAgentMemoryRecord(db, await db.agentMemories.get(memoryId));
}

export async function listAgentMemories(db: CoopDexie) {
  const memories = await db.agentMemories.orderBy('createdAt').reverse().toArray();
  const hydrated = await Promise.all(
    memories.map((memory) => hydrateAgentMemoryRecord(db, memory)),
  );
  return hydrated.filter((memory): memory is AgentMemory => Boolean(memory));
}

export async function deleteAgentMemories(db: CoopDexie, ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  await db.transaction('rw', db.agentMemories, db.encryptedLocalPayloads, async () => {
    await db.agentMemories.bulkDelete(ids);
    await db.encryptedLocalPayloads.bulkDelete(
      ids.map((id) => buildEncryptedLocalPayloadId('agent-memory', id)),
    );
  });
}

export async function purgeQuarantinedKnowledgeSkills(db: CoopDexie) {
  await db.transaction('rw', db.knowledgeSkills, db.coopKnowledgeSkillOverrides, async () => {
    await db.knowledgeSkills.clear();
    await db.coopKnowledgeSkillOverrides.clear();
  });
}

export async function clearSensitiveLocalData(db: CoopDexie) {
  await db.transaction(
    'rw',
    [
      db.tabCandidates,
      db.pageExtracts,
      db.reviewDrafts,
      db.receiverCaptures,
      db.receiverBlobs,
      db.tabRoutings,
      db.captureRuns,
      db.agentMemories,
      db.encryptedLocalPayloads,
    ] as unknown as Parameters<CoopDexie['transaction']>[1],
    async () => {
      await Promise.all([
        db.tabCandidates.clear(),
        db.pageExtracts.clear(),
        db.reviewDrafts.clear(),
        db.receiverCaptures.clear(),
        db.receiverBlobs.clear(),
        db.tabRoutings.clear(),
        db.captureRuns.clear(),
        db.agentMemories.clear(),
        db.encryptedLocalPayloads.clear(),
      ]);
    },
  );
}

export async function pruneSensitiveLocalData(db: CoopDexie) {
  const cutoff = new Date(Date.now() - LOCAL_DATA_RETENTION_MS).toISOString();

  const [candidateRows, extractRows, draftRows, captureRows, rawBlobs, payloads] =
    await Promise.all([
      db.tabCandidates.toArray(),
      db.pageExtracts.toArray(),
      db.reviewDrafts.toArray(),
      db.receiverCaptures.toArray(),
      db.receiverBlobs.toArray(),
      db.encryptedLocalPayloads.toArray(),
    ]);

  const extractIdsReferencedByDrafts = new Set(draftRows.map((draft) => draft.extractId));
  const candidateIdsReferencedByExtracts = new Set(
    extractRows.map((extract) => extract.sourceCandidateId),
  );
  const captureIds = new Set(captureRows.map((capture) => capture.id));

  const staleCandidateIds = candidateRows
    .filter(
      (candidate) =>
        candidate.capturedAt < cutoff && !candidateIdsReferencedByExtracts.has(candidate.id),
    )
    .map((candidate) => candidate.id);
  const staleExtractIds = extractRows
    .filter(
      (extract) => extract.createdAt < cutoff && !extractIdsReferencedByDrafts.has(extract.id),
    )
    .map((extract) => extract.id);
  const orphanedBlobIds = rawBlobs
    .filter((record) => !captureIds.has(record.captureId))
    .map((record) => record.captureId);
  const stalePayloadIds = payloads
    .filter((payload) => {
      if (payload.kind === 'receiver-blob') {
        return !captureIds.has(payload.entityId);
      }
      if (payload.kind === 'tab-candidate') {
        return staleCandidateIds.includes(payload.entityId);
      }
      if (payload.kind === 'page-extract') {
        return staleExtractIds.includes(payload.entityId);
      }
      if (payload.expiresAt) {
        return payload.expiresAt < cutoff;
      }
      return false;
    })
    .map((payload) => payload.id);

  await db.transaction(
    'rw',
    db.tabCandidates,
    db.pageExtracts,
    db.receiverBlobs,
    db.encryptedLocalPayloads,
    async () => {
      if (staleCandidateIds.length > 0) {
        await db.tabCandidates.bulkDelete(staleCandidateIds);
      }
      if (staleExtractIds.length > 0) {
        await db.pageExtracts.bulkDelete(staleExtractIds);
      }
      if (orphanedBlobIds.length > 0) {
        await db.receiverBlobs.bulkDelete(orphanedBlobIds);
      }
      if (stalePayloadIds.length > 0) {
        await db.encryptedLocalPayloads.bulkDelete(stalePayloadIds);
      }
    },
  );

  return {
    staleCandidateCount: staleCandidateIds.length,
    staleExtractCount: staleExtractIds.length,
    orphanedBlobCount: orphanedBlobIds.length,
    stalePayloadCount: stalePayloadIds.length,
  };
}

export async function migrateLegacySensitiveRecords(db: CoopDexie) {
  const [candidateRows, extractRows, draftRows, captureRows, memoryRows] = await Promise.all([
    db.tabCandidates.toArray(),
    db.pageExtracts.toArray(),
    db.reviewDrafts.toArray(),
    db.receiverCaptures.toArray(),
    db.agentMemories.toArray(),
  ]);

  let migrated = 0;

  for (const candidate of candidateRows) {
    const payload = await getEncryptedLocalPayloadRecord(db, 'tab-candidate', candidate.id);
    if (!payload && !looksRedactedTabCandidate(candidate)) {
      await saveTabCandidate(db, candidate);
      migrated += 1;
    }
  }

  for (const extract of extractRows) {
    const payload = await getEncryptedLocalPayloadRecord(db, 'page-extract', extract.id);
    if (!payload && !looksRedactedPageExtract(extract)) {
      await savePageExtract(db, extract);
      migrated += 1;
    }
  }

  for (const draft of draftRows) {
    const payload = await getEncryptedLocalPayloadRecord(db, 'review-draft', draft.id);
    if (!payload && !looksRedactedReviewDraft(draft)) {
      await saveReviewDraft(db, draft);
      migrated += 1;
    }
  }

  for (const capture of captureRows) {
    const capturePayload = await getEncryptedLocalPayloadRecord(db, 'receiver-capture', capture.id);
    const blobPayload = await getEncryptedLocalPayloadRecord(db, 'receiver-blob', capture.id);
    if (capturePayload && blobPayload) {
      continue;
    }

    if (!capturePayload && !looksRedactedReceiverCapture(capture)) {
      await persistReceiverCapture(
        db,
        capture,
        (await db.receiverBlobs.get(capture.id))?.blob ?? null,
      );
      migrated += 1;
      continue;
    }

    if (!blobPayload) {
      const blob = (await db.receiverBlobs.get(capture.id))?.blob;
      if (blob) {
        await persistReceiverCapture(
          db,
          (await hydrateReceiverCaptureRecord(db, capture)) ?? capture,
          blob,
        );
        migrated += 1;
      }
    }
  }

  for (const memory of memoryRows) {
    const payload = await getEncryptedLocalPayloadRecord(db, 'agent-memory', memory.id);
    if (!payload && !looksRedactedAgentMemory(memory)) {
      await saveAgentMemory(db, memory);
      migrated += 1;
    }
  }

  return migrated;
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
      updatedAt: nowIso(),
    });
  }
}
