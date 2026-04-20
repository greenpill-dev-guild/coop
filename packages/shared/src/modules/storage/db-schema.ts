import Dexie, { type EntityTable } from 'dexie';
import type {
  ActionBundle,
  ActionLogEntry,
  AgentBenchmarkRecord,
  AgentLog,
  AgentMemory,
  AgentObservation,
  AgentPlan,
  AgentTraceRecord,
  AutoresearchConfig,
  CoopBlobRecord,
  CoopKnowledgeSkillOverride,
  EncryptedLocalPayload,
  EncryptedSessionMaterial,
  ExecutionPermit,
  ExperimentRecord,
  GraphSnapshot,
  KnowledgeSkill,
  KnowledgeSource,
  LocalMemberSignerBinding,
  LocalPasskeyIdentity,
  PermitLogEntry,
  PrivacyIdentityRecord,
  ReadablePageExtract,
  ReceiverCapture,
  ReceiverPairingRecord,
  ReviewDraft,
  SessionCapability,
  SessionCapabilityLogEntry,
  SkillRun,
  SkillVariant,
  StealthKeyPairRecord,
  TabCandidate,
  TabRouting,
} from '../../contracts/schema';

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

export type SyncOutboxEntryType = 'artifact-publish' | 'state-update';
export type SyncOutboxEntryStatus = 'pending' | 'synced' | 'failed';

export interface SyncOutboxEntry {
  id: string;
  coopId: string;
  type: SyncOutboxEntryType;
  /** Key identifying the change (e.g., artifact ID) for dedup. */
  entityKey: string;
  createdAt: string;
  status: SyncOutboxEntryStatus;
  syncedAt?: string;
  retryCount: number;
  lastError?: string;
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
  agentTraceRecords!: EntityTable<AgentTraceRecord, 'id'>;
  privacyIdentities!: EntityTable<PrivacyIdentityRecord, 'id'>;
  stealthKeyPairs!: EntityTable<StealthKeyPairRecord, 'id'>;
  agentMemories!: EntityTable<AgentMemory, 'id'>;
  encryptedLocalPayloads!: EntityTable<EncryptedLocalPayload, 'id'>;
  coopBlobs!: EntityTable<CoopBlobRecord, 'blobId'>;
  syncOutbox!: EntityTable<SyncOutboxEntry, 'id'>;
  knowledgeSources!: EntityTable<KnowledgeSource, 'id'>;
  graphSnapshots!: EntityTable<GraphSnapshot, 'id'>;
  skillVariants!: EntityTable<SkillVariant, 'id'>;
  experimentRecords!: EntityTable<ExperimentRecord, 'id'>;
  autoresearchConfigs!: EntityTable<AutoresearchConfig, 'skillId'>;
  agentBenchmarkRecords!: EntityTable<AgentBenchmarkRecord, 'id'>;

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
    this.version(16).stores({
      syncOutbox: 'id, coopId, type, status, createdAt, entityKey',
    });
    this.version(17).stores({
      pageExtracts: 'id, canonicalUrl, domain, textHash, createdAt',
    });
    this.version(18).stores({
      tabCandidates: 'id, canonicalUrl, canonicalUrlHash, domain, captureRunId, capturedAt',
    });
    this.version(19).stores({
      knowledgeSources: 'id, coopId, type, active, [coopId+identifier]',
    });
    this.version(20).stores({
      graphSnapshots: 'id, coopId, updatedAt',
    });
    this.version(21).stores({
      skillVariants: 'id, skillId, [skillId+isActive], promptHash',
      experimentRecords: 'id, [skillId+createdAt], outcome',
      autoresearchConfigs: '&skillId',
    });
    this.version(22).stores({
      agentBenchmarkRecords: 'id, [skillId+createdAt], providerId, createdAt',
    });
    this.version(23).stores({
      agentTraceRecords:
        'id, traceId, [observationId+startedAt], [skillId+startedAt], providerId, outcome, startedAt, createdAt',
    });
  }
}

export function createCoopDb(name?: string) {
  return new CoopDexie(name);
}
