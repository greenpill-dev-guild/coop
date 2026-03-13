import type {
  AnchorCapability,
  ArchiveReceipt,
  Artifact,
  AuthSession,
  CaptureMode,
  CoopSharedState,
  ExtensionIconState,
  IntegrationMode,
  InviteType,
  LocalPasskeyIdentity,
  Member,
  OnchainState,
  PrivilegedActionLogEntry,
  ReceiverCapture,
  ReceiverPairingRecord,
  ReceiverSyncEnvelope,
  ReviewDraft,
  SoundEvent,
  SoundPreferences,
  TabCandidate,
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
  activeCoopId?: string;
}

export interface DashboardResponse {
  coops: CoopSharedState[];
  activeCoopId?: string;
  drafts: ReviewDraft[];
  candidates: TabCandidate[];
  summary: RuntimeSummary;
  soundPreferences: SoundPreferences;
  authSession?: AuthSession | null;
  identities: LocalPasskeyIdentity[];
  receiverPairings: ReceiverPairingRecord[];
  receiverIntake: ReceiverCapture[];
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

export type RuntimeRequest =
  | { type: 'get-auth-session' }
  | { type: 'set-auth-session'; payload: AuthSession | null }
  | { type: 'get-dashboard' }
  | { type: 'get-receiver-sync-config' }
  | { type: 'get-receiver-sync-runtime' }
  | { type: 'manual-capture' }
  | {
      type: 'create-coop';
      payload: {
        coopName: string;
        purpose: string;
        creatorDisplayName: string;
        captureMode: CaptureMode;
        seedContribution: string;
        setupInsights: unknown;
        signalingUrls?: string[];
        creator?: Member;
        onchainState?: OnchainState;
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
