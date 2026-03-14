import type {
  ActionBundle,
  ActionLogEntry,
  AgentObservation,
  AgentPlan,
  AnchorCapability,
  ArchiveReceipt,
  Artifact,
  AuthSession,
  CaptureMode,
  CoopSharedState,
  CoopSpaceType,
  DelegatedActionClass,
  ExecutionGrant,
  ExtensionIconState,
  GrantLogEntry,
  GreenGoodsAssessmentRequest,
  GreenGoodsWorkApprovalRequest,
  IntegrationMode,
  InviteType,
  LocalInferenceCapability,
  LocalPasskeyIdentity,
  Member,
  OnchainState,
  PolicyActionClass,
  PrivilegedActionLogEntry,
  ProviderMode,
  ReceiverCapture,
  ReceiverPairingRecord,
  ReceiverSyncEnvelope,
  RefineRequest,
  RefineResult,
  ReviewDraft,
  SessionCapability,
  SessionCapabilityLogEntry,
  SessionCapableActionClass,
  SessionMode,
  SkillManifest,
  SkillRun,
  SoundEvent,
  SoundPreferences,
  TabCandidate,
  UiPreferences,
} from '@coop/shared';

export interface RuntimeSummary {
  iconState: ExtensionIconState;
  iconLabel: string;
  pendingDrafts: number;
  coopCount: number;
  syncState: string;
  lastCaptureAt?: string;
  captureMode: CaptureMode;
  localEnhancement: string;
  localInferenceOptIn: boolean;
  activeCoopId?: string;
}

export interface DashboardResponse {
  coops: CoopSharedState[];
  activeCoopId?: string;
  drafts: ReviewDraft[];
  candidates: TabCandidate[];
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
    grants: ExecutionGrant[];
    grantLog: GrantLogEntry[];
    sessionCapabilities: SessionCapability[];
    sessionCapabilityLog: SessionCapabilityLogEntry[];
  };
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

export interface AgentDashboardResponse {
  observations: AgentObservation[];
  plans: AgentPlan[];
  skillRuns: SkillRun[];
  manifests: SkillManifest[];
  autoRunSkillIds: string[];
}

export type RuntimeRequest =
  | { type: 'get-auth-session' }
  | { type: 'set-auth-session'; payload: AuthSession | null }
  | { type: 'get-dashboard' }
  | { type: 'get-receiver-sync-config' }
  | { type: 'get-receiver-sync-runtime' }
  | { type: 'manual-capture' }
  | { type: 'capture-active-tab' }
  | { type: 'capture-visible-screenshot' }
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
      type: 'update-meeting-settings';
      payload: {
        coopId: string;
        weeklyReviewCadence: string;
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
  | { type: 'persist-coop-state'; payload: { state: CoopSharedState } }
  | { type: 'report-sync-health'; payload: { syncError: boolean; note?: string } }
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
  | { type: 'get-agent-dashboard' }
  | { type: 'run-agent-cycle' }
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
      type: 'issue-grant';
      payload: {
        coopId: string;
        expiresAt: string;
        maxUses: number;
        allowedActions: DelegatedActionClass[];
        targetAllowlist?: Record<string, string[]>;
      };
    }
  | { type: 'revoke-grant'; payload: { grantId: string } }
  | {
      type: 'execute-with-grant';
      payload: {
        grantId: string;
        replayId: string;
        actionClass: DelegatedActionClass;
        coopId: string;
        actionPayload: Record<string, unknown>;
      };
    }
  | { type: 'get-grants' }
  | { type: 'get-grant-log' }
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
  | { type: 'get-privacy-identity'; payload: { coopId: string; memberId: string } }
  | { type: 'get-stealth-meta-address'; payload: { coopId: string } }
  | { type: 'get-membership-commitments'; payload: { coopId: string } }
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
    };

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
 * Messages pushed from the background service worker to the sidepanel.
 * These are fire-and-forget notifications, not request/response pairs.
 */
export type BackgroundNotification = { type: 'DASHBOARD_UPDATED' };

/**
 * Notify the sidepanel that dashboard-relevant state has changed.
 * Silently ignores the expected "Receiving end does not exist" error
 * (when no sidepanel listener is open) but warns on unexpected failures.
 */
export function notifyDashboardUpdated(): Promise<void> {
  return chrome.runtime
    .sendMessage({ type: 'DASHBOARD_UPDATED' } satisfies BackgroundNotification)
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('Receiving end does not exist')) {
        console.warn('[notifyDashboardUpdated] unexpected error:', err);
      }
    });
}
