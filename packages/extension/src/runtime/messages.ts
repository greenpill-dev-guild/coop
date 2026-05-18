import type {
  ActionBundle,
  ActionLogEntry,
  AgentBenchmarkRecord,
  AgentMemory,
  AgentObservation,
  AgentPlan,
  AgentProviderPromotionState,
  AgentTraceRecord,
  AnchorCapability,
  ArchiveReceipt,
  Artifact,
  AuthSession,
  CaptureMode,
  CaptureRunRecord,
  CoopKnowledgeSkillOverride,
  CoopSharedState,
  CoopSoul,
  CoopSpaceType,
  DelegatedActionClass,
  ExecutionPermit,
  ExtensionIconState,
  GreenGoodsAssessmentRequest,
  GreenGoodsWorkApprovalRequest,
  GreenGoodsWorkSubmissionOutput,
  IceConfigResponse,
  IntegrationMode,
  InviteType,
  KnowledgeSkill,
  LocalInferenceCapability,
  LocalPasskeyIdentity,
  Member,
  OnchainState,
  PermitLogEntry,
  PolicyActionClass,
  PrivilegedActionLogEntry,
  ProviderMode,
  ReceiverCapture,
  ReceiverPairingRecord,
  ReceiverSyncEnvelope,
  RefineRequest,
  RefineResult,
  ReviewDraft,
  ReviewItemFeedback,
  SessionCapability,
  SessionCapabilityLogEntry,
  SessionCapableActionClass,
  SessionMode,
  SetupInsights,
  SkillManifest,
  SkillRun,
  SoundEvent,
  SoundPreferences,
  SyncRoomConfig,
  TabCandidate,
  TabRouting,
  UiPreferences,
} from '@coop/shared';

export interface RuntimeSummary {
  iconState: ExtensionIconState;
  iconLabel: string;
  pendingDrafts: number;
  routedTabs: number;
  insightDrafts: number;
  pendingActions: number;
  staleObservationCount: number;
  pendingAttentionCount: number;
  coopCount: number;
  syncState: string;
  syncLabel: string;
  syncDetail: string;
  syncTone: 'ok' | 'warning' | 'error';
  lastCaptureAt?: string;
  captureMode: CaptureMode;
  agentCadenceMinutes: UiPreferences['agentCadenceMinutes'];
  localEnhancement: string;
  localInferenceOptIn: boolean;
  activeCoopId?: string;
  pendingOutboxCount: number;
}

export interface PopupSidepanelState {
  open: boolean;
  canClose: boolean;
}

export const POPUP_SNAPSHOT_KEY = 'coop:popup-snapshot';

export interface PopupSnapshot {
  hasCoops: boolean;
  coopCount: number;
  coopOptions: Array<{ id: string; name: string }>;
  activeCoopId?: string;
  syncLabel: string;
  syncTone: 'ok' | 'warning' | 'error';
  syncDetail: string;
  draftCount: number;
  routedSignalCount: number;
  staleObservationCount: number;
  artifactCount: number;
  lastCaptureAt?: string;
  recentDraftTitles: string[];
  cachedAt: string;
}

export interface CoopBadgeSummary {
  coopId: string;
  coopName: string;
  pendingDrafts: number;
  routedTabs: number;
  insightDrafts: number;
  artifactCount: number;
  pendingActions: number;
  pendingAttentionCount: number;
}

export type SidepanelIntentTab = 'roost' | 'chickens' | 'coops' | 'nest';
export type SidepanelIntentSegment =
  | 'review'
  | 'shared'
  | 'summary'
  | 'agent'
  | 'roundup-access'
  | 'drafts'
  | 'signals'
  | 'stale';

export interface SidepanelIntent {
  tab: SidepanelIntentTab;
  segment?: SidepanelIntentSegment;
  roundupAccessMode?: 'prompt' | 'grant-and-roundup';
  coopId?: string;
  draftId?: string;
  signalId?: string;
  observationId?: string;
  emittedAt?: string;
}

export interface ProactiveSignalSupport {
  id: string;
  kind: 'memory' | 'draft' | 'artifact';
  title: string;
  detail: string;
}

export interface ProactiveSignalTarget {
  coopId: string;
  coopName: string;
  relevanceScore: number;
  rationale: string;
  suggestedNextStep: string;
  matchedRitualLenses: string[];
}

export interface ProactiveSignal {
  id: string;
  sourceCandidateId: string;
  extractId: string;
  title: string;
  url: string;
  domain: string;
  favicon?: string;
  category: TabRouting['category'];
  tags: string[];
  archiveWorthinessHint: boolean;
  draftId?: string;
  topRelevanceScore: number;
  targetCoops: ProactiveSignalTarget[];
  support: ProactiveSignalSupport[];
  updatedAt: string;
}

export interface DashboardResponse {
  coops: CoopSharedState[];
  activeCoopId?: string;
  coopBadges: CoopBadgeSummary[];
  drafts: ReviewDraft[];
  candidates: TabCandidate[];
  tabRoutings: TabRouting[];
  proactiveSignals: ProactiveSignal[];
  activeReviewItemFeedbacks: ReviewItemFeedback[];
  summary: RuntimeSummary;
  soundPreferences: SoundPreferences;
  uiPreferences: UiPreferences;
  authSession?: AuthSession | null;
  identities: LocalPasskeyIdentity[];
  receiverPairings: ReceiverPairingRecord[];
  receiverIntake: ReceiverCapture[];
  runtimeConfig: {
    chainKey: OnchainState['chainKey'];
    onchainMode: IntegrationMode;
    archiveMode: IntegrationMode;
    sessionMode: SessionMode;
    providerMode: ProviderMode;
    privacyMode: 'off' | 'on';
    receiverAppUrl: string;
    signalingUrls: string[];
    websocketSyncUrl?: string;
  };
  operator: {
    anchorCapability: AnchorCapability | null;
    anchorActive: boolean;
    anchorDetail: string;
    actionLog: PrivilegedActionLogEntry[];
    archiveMode: IntegrationMode;
    onchainMode: IntegrationMode;
    liveArchiveAvailable: boolean;
    liveArchiveDetail: string;
    liveOnchainAvailable: boolean;
    liveOnchainDetail: string;
    policyActionQueue: ActionBundle[];
    policyActionLogEntries: ActionLogEntry[];
    permits: ExecutionPermit[];
    permitLog: PermitLogEntry[];
    sessionCapabilities: SessionCapability[];
    sessionCapabilityLog: SessionCapabilityLogEntry[];
  };
  recentCaptureRuns: CaptureRunRecord[];
}

export interface ReceiverSyncConfigResponse {
  pairings: ReceiverPairingRecord[];
}

export interface ReceiverSyncRuntimeStatus {
  loadedAt?: string;
  lastRefreshedAt?: string;
  lastBindingCreatedAt?: string;
  lastBindingDisconnectedAt?: string;
  lastDocUpdateAt?: string;
  lastEnvelopeCount?: number;
  lastIngestAttemptAt?: string;
  lastIngestSuccessAt?: string;
  lastError?: string;
  transport?: 'none' | 'indexeddb-only' | 'webrtc' | 'websocket';
  hasWebSocket?: boolean;
  hasRtcPeerConnection?: boolean;
  activePairingIds: string[];
  activeBindingKeys: string[];
}

export interface CoopSyncConfigEntry {
  coop: CoopSharedState;
  providerSyncRoom?: SyncRoomConfig;
  retiredProviderSyncRooms?: SyncRoomConfig[];
  roomSecretAvailable: boolean;
  legacySecretMigrated: boolean;
  roomEpoch?: number;
  localMemberId?: string;
  localMemberDisplayName?: string;
}

export interface CoopSyncConfigResponse {
  coops: CoopSyncConfigEntry[];
  websocketSyncUrl?: string;
  iceConfig: IceConfigResponse | null;
}

export interface CoopSyncRuntimeStatus {
  loadedAt?: string;
  lastRefreshedAt?: string;
  lastBindingCreatedAt?: string;
  lastBindingDisconnectedAt?: string;
  lastDocUpdateAt?: string;
  lastPersistAt?: string;
  lastCompactionAt?: string;
  lastError?: string;
  mode?: 'none' | 'indexeddb-only' | 'webrtc' | 'websocket' | 'degraded';
  configuredSignalingCount?: number;
  signalingConnectionCount?: number;
  peerCount?: number;
  broadcastPeerCount?: number;
  websocketConnected?: boolean;
  directPeerAvailable?: boolean;
  docBytes?: number;
  pendingUpdateCount?: number;
  activeCoopIds: string[];
  activeBindingKeys: string[];
}

export interface PopupPreparedCapture {
  kind: 'audio' | 'photo' | 'file';
  dataBase64: string;
  mimeType: string;
  fileName?: string;
  title: string;
  note: string;
  sourceUrl?: string;
  durationSeconds?: number;
}

export interface ActiveTabCaptureResult {
  capturedCount: number;
  duplicateSuppressed?: boolean;
}

export interface AgentDashboardResponse {
  observations: AgentObservation[];
  plans: AgentPlan[];
  skillRuns: SkillRun[];
  manifests: SkillManifest[];
  autoRunSkillIds: string[];
  memories: AgentMemory[];
  providerPromotion?: {
    webllm: AgentProviderPromotionState | null;
    webllmEvidence: AgentProviderPromotionEvidence;
  };
}

export interface AgentProviderPromotionEvidence {
  benchmarkRecords: AgentProviderPromotionBenchmarkEvidence[];
  traceRecords: AgentProviderPromotionTraceEvidence[];
}

export interface AgentProviderPromotionBenchmarkEvidence {
  recordId: string;
  skillId: string;
  outcome: AgentBenchmarkRecord['outcome'];
  schemaPassRate: number;
  jsonRepairRate: number;
  medianLatencyMs: number | null;
  coldStartTimeMs: number | null;
  confidenceScore: number | null;
  fallbackReason?: string;
  unavailableReason?: string;
  createdAt: string;
}

export interface AgentProviderPromotionTraceEvidence {
  recordId: string;
  skillId: string;
  outcome: AgentTraceRecord['outcome'];
  durationMs: number;
  confidenceScore?: number;
  evalScore?: number;
  createdAt: string;
}

export interface AgentDashboardKnowledgeSkill {
  skill: KnowledgeSkill;
  override?: CoopKnowledgeSkillOverride;
  effectiveEnabled: boolean;
  effectiveTriggerPatterns: string[];
  freshness: 'fresh' | 'stale' | 'never-fetched';
}

export type RuntimeRequest =
  | { type: 'get-auth-session' }
  | { type: 'set-auth-session'; payload: AuthSession | null }
  | { type: 'get-dashboard' }
  | { type: 'get-sidepanel-state'; payload: { windowId: number } }
  | { type: 'toggle-sidepanel'; payload: { windowId: number } }
  | { type: 'set-sidepanel-intent'; payload: SidepanelIntent }
  | { type: 'consume-sidepanel-intent' }
  | { type: 'get-receiver-sync-config' }
  | { type: 'get-receiver-sync-runtime' }
  | { type: 'get-coop-sync-config' }
  | { type: 'get-coop-sync-runtime' }
  | { type: 'manual-capture' }
  | {
      type: 'capture-active-tab';
      payload?: {
        allowRecentDuplicate?: boolean;
      };
    }
  | { type: 'prepare-visible-screenshot' }
  | { type: 'capture-visible-screenshot' }
  | {
      type: 'capture-file';
      payload: {
        fileName: string;
        mimeType: string;
        dataBase64: string;
        byteSize: number;
      };
    }
  | {
      type: 'create-note-draft';
      payload: {
        text: string;
      };
    }
  | {
      type: 'capture-audio';
      payload: {
        dataBase64: string;
        mimeType: string;
        durationSeconds: number;
        fileName: string;
      };
    }
  | {
      type: 'save-popup-capture';
      payload: PopupPreparedCapture;
    }
  | { type: 'clear-sensitive-local-data' }
  | { type: 'get-ui-preferences' }
  | { type: 'set-ui-preferences'; payload: UiPreferences }
  | {
      type: 'create-coop';
      payload: {
        coopName: string;
        purpose: string;
        spaceType?: CoopSpaceType;
        creatorDisplayName: string;
        captureMode: CaptureMode;
        seedContribution: string;
        setupInsights: unknown;
        signalingUrls?: string[];
        creator?: Member;
        onchainState?: OnchainState;
        greenGoods?: {
          enabled: boolean;
        };
      };
    }
  | {
      type: 'create-receiver-pairing';
      payload: { coopId: string; memberId: string };
    }
  | {
      type: 'ingest-receiver-capture';
      payload: ReceiverSyncEnvelope;
    }
  | {
      type: 'convert-receiver-intake';
      payload: {
        captureId: string;
        workflowStage: 'candidate' | 'ready';
        targetCoopId?: string;
      };
    }
  | {
      type: 'archive-receiver-intake';
      payload: { captureId: string };
    }
  | {
      type: 'set-receiver-intake-archive-worthy';
      payload: { captureId: string; archiveWorthy: boolean };
    }
  | {
      type: 'create-invite';
      payload: { coopId: string; inviteType: InviteType; createdBy: string };
    }
  | {
      type: 'ensure-invite-codes';
      payload: { coopId: string; createdBy: string; inviteTypes?: InviteType[] };
    }
  | {
      type: 'regenerate-invite-code';
      payload: { coopId: string; inviteType: InviteType; createdBy: string };
    }
  | {
      type: 'revoke-invite';
      payload: { coopId: string; inviteId: string; revokedBy: string };
    }
  | {
      type: 'revoke-invite-type';
      payload: { coopId: string; inviteType: InviteType; revokedBy: string };
    }
  | {
      type: 'update-coop-details';
      payload: {
        coopId: string;
        profile?: {
          name?: string;
          purpose?: string;
          captureMode?: CaptureMode;
        };
        soul?: Partial<
          Pick<
            CoopSoul,
            | 'purposeStatement'
            | 'whyThisCoopExists'
            | 'usefulSignalDefinition'
            | 'toneAndWorkingStyle'
            | 'artifactFocus'
            | 'memoryCharter'
          >
        >;
        setupInsights?: SetupInsights;
      };
    }
  | {
      type: 'leave-coop';
      payload: {
        coopId: string;
        memberId: string;
      };
    }
  | {
      type: 'set-active-receiver-pairing';
      payload: { pairingId: string };
    }
  | {
      type: 'join-coop';
      payload: {
        inviteCode: string;
        displayName: string;
        seedContribution: string;
        member?: Member;
      };
    }
  | {
      type: 'request-invite-handoff';
      payload: {
        inviteCode: string;
        memberId: string;
        memberDisplayName: string;
        timeoutMs?: number;
      };
    }
  | {
      type: 'provision-member-onchain-account';
      payload: {
        coopId: string;
        memberId: string;
      };
    }
  | {
      type: 'submit-green-goods-work-submission';
      payload: {
        coopId: string;
        memberId: string;
        submission: Pick<
          GreenGoodsWorkSubmissionOutput,
          'actionUid' | 'title' | 'feedback' | 'metadataCid' | 'mediaCids'
        >;
      };
    }
  | {
      type: 'publish-draft';
      payload: {
        draft: ReviewDraft;
        targetCoopIds: string[];
        anonymous?: boolean;
      };
    }
  | {
      type: 'update-review-draft';
      payload: {
        draft: ReviewDraft;
      };
    }
  | {
      type: 'promote-signal-to-draft';
      payload: {
        signalId: string;
        title: string;
        url: string;
        domain: string;
        favicon?: string;
        category: ReviewDraft['category'];
        tags: string[];
        extractId: string;
        sourceCandidateId: string;
        topRelevanceScore: number;
        targetCoops: {
          coopId: string;
          coopName: string;
          rationale: string;
          suggestedNextStep: string;
          matchedRitualLenses: string[];
        }[];
      };
    }
  | {
      type: 'record-review-feedback';
      payload: {
        itemKind: ReviewItemFeedback['itemKind'];
        itemId: string;
        action: ReviewItemFeedback['action'];
        coopId?: string;
        extractId?: string;
        sourceCandidateId?: string;
        draftId?: string;
        observationId?: string;
        remindAt?: string;
      };
    }
  | {
      type: 'update-meeting-settings';
      payload: {
        coopId: string;
        weeklyReviewCadence: string;
        namedMoments: string[];
        facilitatorExpectation: string;
        defaultCapturePosture: string;
      };
    }
  | {
      type: 'archive-artifact';
      payload: { coopId: string; artifactId: string };
    }
  | {
      type: 'set-artifact-archive-worthy';
      payload: { coopId: string; artifactId: string; archiveWorthy: boolean };
    }
  | {
      type: 'archive-snapshot';
      payload: { coopId: string };
    }
  | {
      type: 'refresh-archive-status';
      payload: { coopId: string; receiptId?: string };
    }
  | { type: 'export-snapshot'; payload: { coopId: string; format: 'json' | 'text' } }
  | {
      type: 'export-artifact';
      payload: { coopId: string; artifactId: string; format: 'json' | 'text' };
    }
  | {
      type: 'export-receipt';
      payload: { coopId: string; receiptId: string; format: 'json' | 'text' };
    }
  | { type: 'set-sound-preferences'; payload: SoundPreferences }
  | { type: 'set-anchor-mode'; payload: { enabled: boolean } }
  | { type: 'set-capture-mode'; payload: { captureMode: CaptureMode } }
  | { type: 'set-active-coop'; payload: { coopId: string } }
  | { type: 'persist-coop-state'; payload: { coopId: string; docUpdate: number[] | Uint8Array } }
  | {
      type: 'persist-coop-room-handoff';
      payload: { coopId: string; syncRoom: SyncRoomConfig; roomEpoch?: number };
    }
  | { type: 'report-sync-health'; payload: { syncError: boolean; note?: string } }
  | {
      type: 'report-coop-sync-runtime';
      payload: Partial<CoopSyncRuntimeStatus>;
    }
  | { type: 'refresh-coop-sync-bindings'; payload?: { reason?: string; force?: boolean } }
  | {
      type: 'resolve-onchain-state';
      payload: { coopSeed: string };
    }
  | {
      type: 'report-receiver-sync-runtime';
      payload: Partial<ReceiverSyncRuntimeStatus>;
    }
  | {
      type: 'set-local-inference-opt-in';
      payload: { enabled: boolean };
    }
  | {
      type: 'queue-green-goods-work-approval';
      payload: {
        coopId: string;
        request: GreenGoodsWorkApprovalRequest;
      };
    }
  | {
      type: 'queue-green-goods-assessment';
      payload: {
        coopId: string;
        request: GreenGoodsAssessmentRequest;
      };
    }
  | {
      type: 'queue-green-goods-gap-admin-sync';
      payload: {
        coopId: string;
      };
    }
  | {
      type: 'queue-green-goods-member-sync';
      payload: {
        coopId: string;
      };
    }
  | { type: 'get-agent-dashboard' }
  | { type: 'run-agent-cycle' }
  | { type: 'get-webllm-provider-promotion-state' }
  | { type: 'activate-webllm-provider-promotion' }
  | { type: 'approve-agent-plan'; payload: { planId: string } }
  | { type: 'reject-agent-plan'; payload: { planId: string; reason?: string } }
  | { type: 'retry-skill-run'; payload: { skillRunId: string } }
  | { type: 'list-skill-manifests' }
  | { type: 'set-agent-skill-auto-run'; payload: { skillId: string; enabled: boolean } }
  | { type: 'get-action-policies' }
  | {
      type: 'set-action-policy';
      payload: { actionClass: PolicyActionClass; approvalRequired: boolean };
    }
  | {
      type: 'propose-action';
      payload: {
        actionClass: PolicyActionClass;
        coopId: string;
        memberId: string;
        payload: Record<string, unknown>;
      };
    }
  | { type: 'approve-action'; payload: { bundleId: string } }
  | { type: 'reject-action'; payload: { bundleId: string } }
  | { type: 'execute-action'; payload: { bundleId: string } }
  | { type: 'get-action-queue' }
  | { type: 'get-action-history' }
  | {
      type: 'issue-permit';
      payload: {
        coopId: string;
        expiresAt: string;
        maxUses: number;
        allowedActions: DelegatedActionClass[];
        targetAllowlist?: Record<string, string[]>;
      };
    }
  | { type: 'revoke-permit'; payload: { permitId: string } }
  | {
      type: 'execute-with-permit';
      payload: {
        permitId: string;
        replayId: string;
        actionClass: DelegatedActionClass;
        coopId: string;
        actionPayload: Record<string, unknown>;
      };
    }
  | { type: 'get-permits' }
  | { type: 'get-permit-log' }
  | {
      type: 'issue-session-capability';
      payload: {
        coopId: string;
        expiresAt: string;
        maxUses: number;
        allowedActions: SessionCapableActionClass[];
        targetAllowlist?: Record<string, string[]>;
      };
    }
  | {
      type: 'rotate-session-capability';
      payload: {
        capabilityId: string;
      };
    }
  | { type: 'revoke-session-capability'; payload: { capabilityId: string } }
  | { type: 'get-session-capabilities' }
  | { type: 'get-session-capability-log' }
  | { type: 'export-agent-manifest'; payload: { coopId: string } }
  | { type: 'export-agent-log'; payload: { coopId: string; traceId?: string } }
  | { type: 'get-agent-identity'; payload: { coopId: string } }
  | { type: 'get-agent-reputation'; payload: { coopId: string; agentId: number } }
  | { type: 'get-agent-feedback-history'; payload: { coopId: string; agentId: number } }
  | { type: 'get-privacy-identity'; payload: { coopId: string; memberId: string } }
  | { type: 'get-stealth-meta-address'; payload: { coopId: string } }
  | { type: 'get-membership-commitments'; payload: { coopId: string } }
  | {
      type: 'provision-archive-space';
      payload: {
        coopId: string;
        email: string;
        coopName: string;
      };
    }
  | {
      type: 'set-coop-archive-config';
      payload: {
        coopId: string;
        publicConfig: {
          spaceDid: string;
          delegationIssuer: string;
          gatewayBaseUrl?: string;
          allowsFilecoinInfo?: boolean;
          expirationSeconds?: number;
        };
        secrets: {
          agentPrivateKey?: string;
          spaceDelegation: string;
          proofs?: string[];
          filecoinWitnessRpcUrl?: string;
          filecoinWitnessRpcToken?: string;
        };
      };
    }
  | {
      type: 'remove-coop-archive-config';
      payload: { coopId: string };
    }
  | {
      type: 'retrieve-archive-bundle';
      payload: {
        coopId: string;
        receiptId: string;
      };
    }
  | {
      type: 'anchor-archive-cid';
      payload: {
        coopId: string;
        receiptId: string;
      };
    }
  | {
      type: 'fvm-register-archive';
      payload: {
        coopId: string;
        receiptId: string;
      };
    }
  | {
      type: 'add-knowledge-source';
      payload: { coopId: string; sourceType: string; identifier: string; label: string };
    }
  | {
      type: 'remove-knowledge-source';
      payload: { sourceId: string };
    }
  | {
      type: 'toggle-knowledge-source';
      payload: { sourceId: string; active: boolean };
    }
  | {
      type: 'list-knowledge-sources';
      payload: { coopId: string };
    }
  | {
      type: 'refresh-knowledge-source';
      payload: { coopId: string };
    }
  | {
      type: 'get-knowledge-stats';
      payload: { coopId: string };
    }
  | { type: 'list-autoresearch-configs' }
  | {
      type: 'set-autoresearch-config';
      payload: {
        skillId: string;
        enabled?: boolean;
        maxExperimentsPerCycle?: number;
        timeBudgetMs?: number;
        qualityFloor?: number;
      };
    }
  | {
      type: 'run-autoresearch-cycle';
      payload: { skillId: string };
    }
  | { type: 'list-experiment-records' };

export interface RuntimeActionResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  soundEvent?: SoundEvent;
}

export async function sendRuntimeMessage<T = unknown>(message: RuntimeRequest) {
  return chrome.runtime.sendMessage(message) as Promise<RuntimeActionResponse<T>>;
}

/**
 * Messages pushed from the background service worker to the popup/sidepanel.
 * These are fire-and-forget notifications, not request/response pairs.
 *
 * Agent event types are modeled on the AG-UI (Agent-User Interaction Protocol)
 * event taxonomy, adapted for Chrome extension message passing.
 * See: https://docs.ag-ui.com/concepts/events
 */

export interface AgentCycleStartedEvent {
  type: 'AGENT_CYCLE_STARTED';
  traceId: string;
  reason: string;
  pendingObservationCount: number;
  emittedAt: string;
}

export interface AgentCycleFinishedEvent {
  type: 'AGENT_CYCLE_FINISHED';
  traceId: string;
  processedCount: number;
  draftCount: number;
  errorCount: number;
  durationMs: number;
  emittedAt: string;
}

export interface AgentStateDeltaEvent {
  type: 'AGENT_STATE_DELTA';
  routedTabs: number;
  insightDrafts: number;
  reviewDigests: number;
  pendingActions: number;
  message: string;
  focusIntent?: SidepanelIntent;
  emittedAt: string;
}

export interface SidepanelIntentEvent {
  type: 'SIDEPANEL_INTENT';
  intent: SidepanelIntent;
  emittedAt: string;
}

export interface AgentCycleErrorEvent {
  type: 'AGENT_CYCLE_ERROR';
  traceId: string;
  error: string;
  emittedAt: string;
}

export type AgentEvent =
  | AgentCycleStartedEvent
  | AgentCycleFinishedEvent
  | AgentStateDeltaEvent
  | AgentCycleErrorEvent;

export type BackgroundNotification =
  | { type: 'DASHBOARD_UPDATED' }
  | SidepanelIntentEvent
  | AgentEvent;

/** Fire-and-forget push to any open popup or sidepanel. Suppresses "Receiving end does not exist". */
function sendBackgroundNotification(msg: BackgroundNotification, label: string): Promise<void> {
  return chrome.runtime.sendMessage(msg).catch((err: unknown) => {
    const detail = err instanceof Error ? err.message : String(err);
    if (!detail.includes('Receiving end does not exist')) {
      console.warn(`[${label}] unexpected error:`, err);
    }
  });
}

/** Notify the popup/sidepanel that dashboard-relevant state has changed. */
export function notifyDashboardUpdated(): Promise<void> {
  return sendBackgroundNotification({ type: 'DASHBOARD_UPDATED' }, 'notifyDashboardUpdated');
}

/** Push an agent lifecycle event to any open popup or sidepanel. */
export function notifyAgentEvent(event: AgentEvent): Promise<void> {
  return sendBackgroundNotification(event, 'notifyAgentEvent');
}

/** Push a sidepanel navigation intent to any open sidepanel instance. */
export function notifySidepanelIntent(intent: SidepanelIntent): Promise<void> {
  return sendBackgroundNotification(
    {
      type: 'SIDEPANEL_INTENT',
      intent,
      emittedAt: new Date().toISOString(),
    },
    'notifySidepanelIntent',
  );
}
