/**
 * Extension-specific test fixture factories.
 *
 * Provides chrome mock installation and dashboard response builders
 * that are reused across popup, sidepanel, and background test files.
 *
 * For domain-level factories (makeReviewDraft, makeArtifact, etc.),
 * import from 'packages/shared/src/__tests__/fixtures'.
 */

import {
  type AuthSession,
  type CoopSharedState,
  type GreenGoodsGardenState,
  type GreenGoodsMemberBinding,
  type MemberOnchainAccount,
  type ReceiverCapture,
  type ReceiverPairingRecord,
  createCoop,
} from '@coop/shared';
import { makeArtifact, makeSetupInsights } from '@coop/shared/testing';
import { vi } from 'vitest';
import type { DashboardResponse } from '../../runtime/messages';
export { mockCoopSeeds, mockCoopSeedsByName } from './mock-coop-seeds';

type CoopStateOverrides = Omit<
  Partial<CoopSharedState>,
  | 'profile'
  | 'members'
  | 'rituals'
  | 'artifacts'
  | 'reviewBoard'
  | 'archiveReceipts'
  | 'invites'
  | 'memberAccounts'
  | 'memberCommitments'
  | 'setupInsights'
  | 'soul'
  | 'onchainState'
  | 'syncRoom'
  | 'memoryProfile'
  | 'greenGoods'
> & {
  profile?: Partial<CoopSharedState['profile']>;
  members?: CoopSharedState['members'];
  rituals?: CoopSharedState['rituals'];
  artifacts?: CoopSharedState['artifacts'];
  reviewBoard?: CoopSharedState['reviewBoard'];
  archiveReceipts?: CoopSharedState['archiveReceipts'];
  invites?: CoopSharedState['invites'];
  memberAccounts?: CoopSharedState['memberAccounts'];
  memberCommitments?: CoopSharedState['memberCommitments'];
  setupInsights?: CoopSharedState['setupInsights'];
  soul?: CoopSharedState['soul'];
  onchainState?: Partial<CoopSharedState['onchainState']>;
  syncRoom?: Partial<CoopSharedState['syncRoom']>;
  memoryProfile?: Partial<CoopSharedState['memoryProfile']>;
  greenGoods?: Partial<NonNullable<CoopSharedState['greenGoods']>>;
};

type DashboardResponseOverrides = Omit<
  Partial<DashboardResponse>,
  'summary' | 'uiPreferences' | 'runtimeConfig' | 'operator'
> & {
  summary?: Partial<DashboardResponse['summary']>;
  uiPreferences?: Partial<DashboardResponse['uiPreferences']>;
  runtimeConfig?: Partial<DashboardResponse['runtimeConfig']>;
  operator?: Partial<DashboardResponse['operator']>;
};

// ---------------------------------------------------------------------------
// installChromeMock — sets up globalThis.chrome with common stubs
// ---------------------------------------------------------------------------

export function installChromeMock() {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          onChanged: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ windowId: 7 }]),
        create: vi.fn().mockResolvedValue(undefined),
      },
      sidePanel: {
        open: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      },
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://${path}`),
      },
    },
  });
}

export function makeAuthSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    authMode: 'passkey',
    displayName: 'Ava',
    primaryAddress: '0x1234567890abcdef1234567890abcdef12345678',
    createdAt: '2026-03-20T00:00:00.000Z',
    identityWarning: 'Device bound.',
    passkey: {
      id: 'credential-1',
      publicKey: '0xabcdef1234567890',
      rpId: 'coop.test',
    },
    ...overrides,
  };
}

export function makeUiPreferences(
  overrides: Partial<DashboardResponse['uiPreferences']> = {},
): DashboardResponse['uiPreferences'] {
  return {
    notificationsEnabled: true,
    localInferenceOptIn: true,
    uiMode: 'simple',
    preferredExportMethod: 'download',
    heartbeatEnabled: true,
    agentCadenceMinutes: 64,
    excludedCategories: [],
    customExcludedDomains: [],
    captureOnClose: false,
    ...overrides,
  };
}

export function makeRuntimeConfig(
  overrides: Partial<DashboardResponse['runtimeConfig']> = {},
): DashboardResponse['runtimeConfig'] {
  return {
    chainKey: 'sepolia',
    onchainMode: 'mock',
    archiveMode: 'mock',
    sessionMode: 'mock',
    providerMode: 'standard',
    privacyMode: 'off',
    receiverAppUrl: 'http://localhost:3000',
    signalingUrls: [],
    ...overrides,
  };
}

function toGreenGoodsDomainMask(domains: GreenGoodsGardenState['domains']) {
  let mask = 0;
  for (const domain of domains) {
    switch (domain) {
      case 'solar':
        mask |= 1;
        break;
      case 'agro':
        mask |= 2;
        break;
      case 'edu':
        mask |= 4;
        break;
      case 'waste':
        mask |= 8;
        break;
    }
  }
  return mask;
}

export function makeGreenGoodsMemberBinding(
  overrides: Partial<GreenGoodsMemberBinding> = {},
): GreenGoodsMemberBinding {
  return {
    memberId: 'member-1',
    desiredRoles: [],
    currentRoles: [],
    status: 'pending-account',
    ...overrides,
  };
}

export function makeGreenGoodsState(
  overrides: Partial<GreenGoodsGardenState> = {},
): GreenGoodsGardenState {
  const enabled = overrides.enabled ?? true;
  const status = overrides.status ?? (enabled ? 'requested' : 'disabled');
  const domains = overrides.domains ?? ['agro'];
  const memberBindings = overrides.memberBindings ?? [];
  const gapAdminAddresses = overrides.gapAdminAddresses ?? [];
  const domainMask = overrides.domainMask ?? toGreenGoodsDomainMask(domains);

  return {
    enabled,
    status,
    requestedAt: enabled ? '2026-03-20T00:00:00.000Z' : undefined,
    provisioningAt: undefined,
    linkedAt: undefined,
    lastMemberSyncAt: undefined,
    lastProfileSyncAt: undefined,
    lastDomainSyncAt: undefined,
    lastPoolSyncAt: undefined,
    lastGapAdminSyncAt: undefined,
    lastWorkSubmissionAt: undefined,
    lastWorkApprovalAt: undefined,
    lastAssessmentAt: undefined,
    lastHypercertMintAt: undefined,
    lastImpactReportAt: undefined,
    gardenAddress: status === 'linked' ? '0x1234567890abcdef1234567890abcdef12345678' : undefined,
    tokenId: undefined,
    gapProjectUid: undefined,
    name: enabled ? 'Starter Garden' : 'Green Goods Disabled',
    slug: enabled ? 'starter-garden' : undefined,
    description: enabled
      ? 'Coordinate regenerative work through the coop.'
      : 'Green Goods is disabled for this coop.',
    location: '',
    bannerImage: '',
    metadata: '',
    openJoining: false,
    maxGardeners: 0,
    weightScheme: 'linear',
    domains,
    memberBindings,
    gapAdminAddresses,
    domainMask,
    statusNote: enabled ? 'Green Goods garden requested.' : 'Green Goods disabled.',
    lastError: undefined,
    lastTxHash: undefined,
    lastHypercertId: undefined,
    lastHypercertMetadataUri: undefined,
    lastHypercertAllowlistUri: undefined,
    lastUserOperationHash: undefined,
    ...overrides,
  };
}

export function makeMemberOnchainAccount(
  overrides: Partial<MemberOnchainAccount> = {},
): MemberOnchainAccount {
  return {
    id: 'account-1',
    memberId: 'member-1',
    coopId: 'coop-1',
    accountAddress: '0x1234567890abcdef1234567890abcdef12345678',
    accountType: 'safe',
    ownerPasskeyCredentialId: 'credential-1',
    chainKey: 'sepolia',
    status: 'active',
    statusNote: '',
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    deployedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

export function makeCoopState(overrides: CoopStateOverrides = {}): CoopSharedState {
  const {
    profile: profileOverrides,
    members,
    rituals,
    artifacts,
    reviewBoard,
    archiveReceipts,
    invites,
    memberAccounts,
    memberCommitments,
    setupInsights,
    soul,
    onchainState: onchainStateOverrides,
    syncRoom: syncRoomOverrides,
    memoryProfile: memoryProfileOverrides,
    greenGoods: greenGoodsOverrides,
    ...rest
  } = overrides;
  const coopId = overrides.profile?.id ?? 'coop-1';
  const coopName = overrides.profile?.name ?? 'Starter Coop';
  const creatorAddress =
    overrides.members?.[0]?.address ?? '0x1234567890abcdef1234567890abcdef12345678';
  const baseState = createCoop({
    coopName,
    purpose: overrides.profile?.purpose ?? 'Coordinate local research',
    creatorDisplayName: overrides.members?.[0]?.displayName ?? 'Ava',
    captureMode: overrides.profile?.captureMode ?? 'manual',
    seedContribution: 'A deterministic seed contribution for extension tests.',
    setupInsights: makeSetupInsights({
      summary: 'Deterministic coop fixture for extension tests.',
    }),
  }).state;

  return {
    ...baseState,
    ...rest,
    profile: {
      ...baseState.profile,
      id: coopId,
      name: coopName,
      purpose: 'Coordinate local research',
      spaceType: 'community',
      createdAt: '2026-03-20T00:00:00.000Z',
      createdBy: 'member-1',
      captureMode: 'manual',
      safeAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      active: true,
      ...profileOverrides,
    },
    members: members ?? [
      {
        ...baseState.members[0],
        id: 'member-1',
        displayName: 'Ava',
        role: 'creator',
        address: creatorAddress,
        joinedAt: '2026-03-20T00:00:00.000Z',
        authMode: 'passkey',
        identityWarning: 'Device bound.',
      },
    ],
    rituals: rituals ?? baseState.rituals,
    artifacts: artifacts ?? [],
    reviewBoard: reviewBoard ?? [],
    archiveReceipts: archiveReceipts ?? [],
    invites: invites ?? [],
    memberAccounts: memberAccounts ?? [],
    memberCommitments: memberCommitments ?? [],
    setupInsights: setupInsights ?? baseState.setupInsights,
    soul: soul ?? baseState.soul,
    onchainState: {
      ...baseState.onchainState,
      chainId: 11155111,
      chainKey: 'sepolia',
      safeAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      safeCapability: 'ready',
      statusNote: 'Ready',
      ...onchainStateOverrides,
    },
    syncRoom: {
      ...baseState.syncRoom,
      roomId: `room-${coopId}`,
      signalingUrls: ['wss://api.coop.town'],
      roomSecret: `room-secret-${coopId}`,
      inviteSigningSecret: `invite-secret-${coopId}`,
      ...syncRoomOverrides,
    },
    memoryProfile: {
      ...baseState.memoryProfile,
      version: 1,
      topDomains: [],
      topTags: [],
      categoryStats: [],
      ritualLensWeights: [],
      exemplarArtifactIds: [],
      archiveSignals: {
        archivedTagCounts: {},
        archivedDomainCounts: {},
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      ...memoryProfileOverrides,
    },
    greenGoods:
      greenGoodsOverrides === undefined ? undefined : makeGreenGoodsState(greenGoodsOverrides),
  } as CoopSharedState;
}

export function makeReceiverPairingRecord(
  overrides: Partial<ReceiverPairingRecord> = {},
): ReceiverPairingRecord {
  const pairingId = overrides.pairingId ?? 'pairing-1';
  return {
    version: 1,
    pairingId,
    coopId: overrides.coopId ?? 'coop-1',
    coopDisplayName: overrides.coopDisplayName ?? 'Starter Coop',
    memberId: overrides.memberId ?? 'member-1',
    memberDisplayName: overrides.memberDisplayName ?? 'Ava',
    pairSecret: overrides.pairSecret ?? 'secret-123',
    roomId: overrides.roomId ?? `receiver-${pairingId}`,
    signalingUrls: overrides.signalingUrls ?? ['wss://api.coop.town'],
    issuedAt: overrides.issuedAt ?? '2026-03-20T00:00:00.000Z',
    expiresAt: overrides.expiresAt ?? '2026-04-01T00:00:00.000Z',
    active: overrides.active ?? true,
    pairingCode: overrides.pairingCode ?? `NEST:${pairingId}`,
    deepLink: overrides.deepLink ?? `https://receiver.test/pair/${pairingId}`,
    ...overrides,
  } as ReceiverPairingRecord;
}

export function makeReceiverCapture(overrides: Partial<ReceiverCapture> = {}): ReceiverCapture {
  return {
    id: overrides.id ?? 'capture-1',
    pairingId: overrides.pairingId ?? 'pairing-1',
    coopId: overrides.coopId ?? 'coop-1',
    coopDisplayName: overrides.coopDisplayName ?? 'Starter Coop',
    memberId: overrides.memberId ?? 'member-1',
    memberDisplayName: overrides.memberDisplayName ?? 'Ava',
    deviceId: overrides.deviceId ?? 'device-1',
    kind: overrides.kind ?? 'link',
    title: overrides.title ?? 'Receiver note',
    note: overrides.note ?? 'A quick note from the phone',
    mimeType: overrides.mimeType ?? 'text/plain',
    byteSize: overrides.byteSize ?? 42,
    createdAt: overrides.createdAt ?? '2026-03-20T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-20T00:05:00.000Z',
    intakeStatus: overrides.intakeStatus ?? 'candidate',
    syncState: overrides.syncState ?? 'synced',
    ...overrides,
  } as ReceiverCapture;
}

// ---------------------------------------------------------------------------
// makeDashboardResponse — full dashboard payload for popup/sidepanel tests
// ---------------------------------------------------------------------------

export function makeDashboardResponse(
  overrides: DashboardResponseOverrides = {},
): DashboardResponse {
  const {
    summary: summaryOverrides,
    uiPreferences: uiPreferencesOverrides,
    runtimeConfig: runtimeConfigOverrides,
    operator: operatorOverrides,
    ...rest
  } = overrides;
  const defaultCoop = makeCoopState({
    artifacts: [makeArtifact()],
  });

  return {
    coops: [defaultCoop],
    activeCoopId: 'coop-1',
    coopBadges: [
      {
        coopId: 'coop-1',
        coopName: 'Starter Coop',
        pendingDrafts: 0,
        routedTabs: 0,
        insightDrafts: 0,
        artifactCount: 1,
        pendingActions: 0,
        pendingAttentionCount: 0,
      },
    ],
    drafts: [],
    candidates: [],
    tabRoutings: [],
    proactiveSignals: [],
    activeReviewItemFeedbacks: [],
    summary: {
      iconState: 'ready',
      iconLabel: 'Synced',
      pendingDrafts: 0,
      routedTabs: 0,
      insightDrafts: 0,
      pendingActions: 0,
      staleObservationCount: 0,
      pendingAttentionCount: 0,
      coopCount: 1,
      syncState: 'Peer-ready local-first sync',
      syncLabel: 'Healthy',
      syncDetail: 'Peer-ready local-first sync.',
      syncTone: 'ok',
      lastCaptureAt: '2026-03-22T00:00:00.000Z',
      captureMode: 'manual',
      agentCadenceMinutes: 64,
      localEnhancement: 'Heuristics-first fallback',
      localInferenceOptIn: true,
      activeCoopId: 'coop-1',
      pendingOutboxCount: 0,
      ...summaryOverrides,
    },
    soundPreferences: {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    },
    uiPreferences: makeUiPreferences(uiPreferencesOverrides),
    authSession: makeAuthSession(),
    identities: [],
    receiverPairings: [],
    receiverIntake: [],
    recentCaptureRuns: [],
    runtimeConfig: makeRuntimeConfig(runtimeConfigOverrides),
    operator: {
      anchorCapability: null,
      anchorActive: false,
      anchorDetail: '',
      actionLog: [],
      archiveMode: 'mock',
      onchainMode: 'mock',
      liveArchiveAvailable: false,
      liveArchiveDetail: '',
      liveOnchainAvailable: false,
      liveOnchainDetail: '',
      policyActionQueue: [],
      policyActionLogEntries: [],
      permits: [],
      permitLog: [],
      sessionCapabilities: [],
      sessionCapabilityLog: [],
      ...operatorOverrides,
    },
    ...rest,
  };
}
