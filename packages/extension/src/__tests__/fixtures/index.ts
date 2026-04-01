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
  type CoopSharedState,
  type ReceiverCapture,
  type ReceiverPairingRecord,
  createCoop,
} from '@coop/shared';
import { vi } from 'vitest';
import { makeArtifact, makeSetupInsights } from '../../../../shared/src/__tests__/fixtures';

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

export function makeCoopState(overrides: Partial<CoopSharedState> = {}): CoopSharedState {
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
    kind: overrides.kind ?? 'note',
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

export function makeDashboardResponse(overrides: Record<string, unknown> = {}) {
  return {
    coops: [
      {
        profile: {
          id: 'coop-1',
          name: 'Starter Coop',
          purpose: 'Coordinate local research',
          captureMode: 'manual',
        },
        members: [
          {
            id: 'member-1',
            displayName: 'Ava',
            address: '0x1234567890abcdef1234567890abcdef12345678',
          },
        ],
        artifacts: [makeArtifact()],
      },
    ],
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
    },
    soundPreferences: {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    },
    uiPreferences: {
      notificationsEnabled: true,
      localInferenceOptIn: true,
      preferredExportMethod: 'download',
      heartbeatEnabled: true,
      agentCadenceMinutes: 64,
      excludedCategories: [],
      customExcludedDomains: [],
      captureOnClose: false,
    },
    authSession: {
      primaryAddress: '0x1234567890abcdef1234567890abcdef12345678',
    },
    identities: [],
    receiverPairings: [],
    receiverIntake: [],
    runtimeConfig: {
      chainKey: 'sepolia',
      onchainMode: 'mock',
      archiveMode: 'mock',
      sessionMode: 'mock',
      providerMode: 'rpc',
      privacyMode: 'off',
      receiverAppUrl: 'http://localhost:3000',
      signalingUrls: [],
    },
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
    },
    ...overrides,
  };
}
