import type {
  ActionBundle,
  AgentObservation,
  CoopSharedState,
  ReviewDraft,
  TabCandidate,
  TabRouting,
} from '@coop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeCoopState,
  makeReceiverCapture,
  makeReceiverPairingRecord,
} from '../../__tests__/fixtures';

const sharedMocks = vi.hoisted(() => ({
  createPermitLogEntry: vi.fn((input: Record<string, unknown>) => input),
  deriveExtensionIconState: vi.fn(() => 'working'),
  filterReceiverCapturesForMemberContext: vi.fn((items: unknown[]) => items),
  filterVisibleReviewDrafts: vi.fn((items: unknown[]) => items),
  getAuthSession: vi.fn(),
  getPendingOutboxCount: vi.fn(),
  getSoundPreferences: vi.fn(),
  listActionBundles: vi.fn(),
  listActionLogEntries: vi.fn(),
  listActiveReviewItemFeedbacks: vi.fn(),
  listAgentObservations: vi.fn(),
  listExecutionPermits: vi.fn(),
  listLocalIdentities: vi.fn(),
  listPermitLogEntries: vi.fn(),
  listReceiverCaptures: vi.fn(),
  listReceiverPairings: vi.fn(),
  listReviewDrafts: vi.fn(),
  listSessionCapabilities: vi.fn(),
  listSessionCapabilityLogEntries: vi.fn(),
  listTabCandidates: vi.fn(),
  listTabRoutings: vi.fn(),
  pendingBundles: vi.fn((bundles: unknown[]) => bundles),
  pruneOutbox: vi.fn(async () => 0),
  queryRecentMemories: vi.fn(),
  reconcileOutbox: vi.fn(async () => 0),
  refreshPermitStatus: vi.fn((permit: Record<string, unknown>) => permit),
  saveExecutionPermit: vi.fn(async () => undefined),
  savePermitLogEntry: vi.fn(async () => undefined),
}));

const contextMocks = vi.hoisted(() => ({
  getCoops: vi.fn(),
  getLocalSetting: vi.fn(),
  getRuntimeHealth: vi.fn(),
  hydrateUiPreferences: vi.fn(),
  localEnhancementAvailability: vi.fn(() => ({
    status: 'ready',
    model: 'local-helper',
  })),
}));

const handlerMocks = vi.hoisted(() => ({
  getAgentCycleState: vi.fn(),
  refreshStoredSessionCapabilityStatuses: vi.fn(),
}));

const operatorMocks = vi.hoisted(() => ({
  getActiveReviewContextForSession: vi.fn(),
  getOperatorState: vi.fn(),
}));

const messageMocks = vi.hoisted(() => ({
  notifyDashboardUpdated: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    createPermitLogEntry: sharedMocks.createPermitLogEntry,
    deriveExtensionIconState: sharedMocks.deriveExtensionIconState,
    filterReceiverCapturesForMemberContext: sharedMocks.filterReceiverCapturesForMemberContext,
    filterVisibleReviewDrafts: sharedMocks.filterVisibleReviewDrafts,
    getAuthSession: sharedMocks.getAuthSession,
    getPendingOutboxCount: sharedMocks.getPendingOutboxCount,
    getSoundPreferences: sharedMocks.getSoundPreferences,
    listActionBundles: sharedMocks.listActionBundles,
    listActionLogEntries: sharedMocks.listActionLogEntries,
    listActiveReviewItemFeedbacks: sharedMocks.listActiveReviewItemFeedbacks,
    listAgentObservations: sharedMocks.listAgentObservations,
    listExecutionPermits: sharedMocks.listExecutionPermits,
    listLocalIdentities: sharedMocks.listLocalIdentities,
    listPermitLogEntries: sharedMocks.listPermitLogEntries,
    listReceiverCaptures: sharedMocks.listReceiverCaptures,
    listReceiverPairings: sharedMocks.listReceiverPairings,
    listReviewDrafts: sharedMocks.listReviewDrafts,
    listSessionCapabilities: sharedMocks.listSessionCapabilities,
    listSessionCapabilityLogEntries: sharedMocks.listSessionCapabilityLogEntries,
    listTabCandidates: sharedMocks.listTabCandidates,
    listTabRoutings: sharedMocks.listTabRoutings,
    pendingBundles: sharedMocks.pendingBundles,
    pruneOutbox: sharedMocks.pruneOutbox,
    queryRecentMemories: sharedMocks.queryRecentMemories,
    reconcileOutbox: sharedMocks.reconcileOutbox,
    refreshPermitStatus: sharedMocks.refreshPermitStatus,
    saveExecutionPermit: sharedMocks.saveExecutionPermit,
    savePermitLogEntry: sharedMocks.savePermitLogEntry,
  };
});

vi.mock('../context', () => ({
  configuredArchiveMode: 'mock',
  configuredChain: 'sepolia',
  configuredOnchainMode: 'mock',
  configuredPrivacyMode: 'off',
  configuredProviderMode: 'standard',
  configuredReceiverAppUrl: 'https://receiver.test',
  configuredSessionMode: 'mock',
  configuredSignalingUrls: ['wss://api.coop.town'],
  configuredWebsocketSyncUrl: 'wss://api.coop.town/yws',
  db: {
    captureRuns: {
      orderBy: vi.fn(() => ({
        last: vi.fn(async () => ({
          capturedAt: '2026-03-29T00:00:00.000Z',
        })),
        reverse: vi.fn(() => ({
          limit: vi.fn(() => ({
            toArray: vi.fn(async () => [
              {
                id: 'run-1',
                capturedAt: '2026-03-29T00:00:00.000Z',
                candidateCount: 2,
              },
            ]),
          })),
        })),
      })),
    },
  },
  getCoops: contextMocks.getCoops,
  getLocalSetting: contextMocks.getLocalSetting,
  getRuntimeHealth: contextMocks.getRuntimeHealth,
  hydrateUiPreferences: contextMocks.hydrateUiPreferences,
  localEnhancementAvailability: contextMocks.localEnhancementAvailability,
  stateKeys: {
    captureMode: 'capture-mode',
  },
}));

vi.mock('../handlers/agent', () => ({
  getAgentCycleState: handlerMocks.getAgentCycleState,
}));

vi.mock('../handlers/session', () => ({
  refreshStoredSessionCapabilityStatuses: handlerMocks.refreshStoredSessionCapabilityStatuses,
}));

vi.mock('../operator', () => ({
  getActiveReviewContextForSession: operatorMocks.getActiveReviewContextForSession,
  getOperatorState: operatorMocks.getOperatorState,
}));

vi.mock('../../runtime/messages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../runtime/messages')>();
  return {
    ...actual,
    notifyDashboardUpdated: messageMocks.notifyDashboardUpdated,
  };
});

const { buildProactiveSignals, buildSummary, getDashboard, refreshBadge } = await import(
  '../dashboard'
);

function makeDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    id: overrides.id ?? 'draft-1',
    title: overrides.title ?? 'Restoration draft',
    summary: 'Draft summary',
    whyItMatters: 'Why it matters',
    suggestedNextStep: 'Review it',
    category: 'opportunity',
    tags: [],
    sources: [
      {
        url: 'https://example.com/article',
        domain: 'example.com',
      },
    ],
    createdAt: overrides.createdAt ?? '2026-03-28T00:00:00.000Z',
    createdBy: 'member-1',
    reviewStatus: 'pending',
    workflowStage: 'candidate',
    suggestedTargetCoopIds: overrides.suggestedTargetCoopIds ?? ['coop-1'],
    provenance:
      overrides.provenance ??
      ({
        type: 'agent',
        skillId: 'memory-insight-synthesizer',
      } as ReviewDraft['provenance']),
    archiveWorthiness: 'not-flagged',
    archiveStatus: 'not-archived',
    archiveReceiptIds: [],
    ...overrides,
  } as ReviewDraft;
}

function makeCandidate(overrides: Partial<TabCandidate> = {}): TabCandidate {
  return {
    id: overrides.id ?? 'candidate-1',
    title: 'River restoration signal',
    url: 'https://example.com/river',
    canonicalUrl: 'https://example.com/river',
    domain: 'example.com',
    capturedAt: '2026-03-28T00:00:00.000Z',
    tabId: 1,
    windowId: 1,
    ...overrides,
  } as TabCandidate;
}

function makeRouting(overrides: Partial<TabRouting> = {}): TabRouting {
  return {
    id: overrides.id ?? 'routing-1',
    sourceCandidateId: overrides.sourceCandidateId ?? 'candidate-1',
    extractId: overrides.extractId ?? 'extract-1',
    coopId: overrides.coopId ?? 'coop-1',
    status: overrides.status ?? 'routed',
    relevanceScore: overrides.relevanceScore ?? 0.91,
    rationale: overrides.rationale ?? 'Matches coop goals.',
    suggestedNextStep: overrides.suggestedNextStep ?? 'Review it',
    matchedRitualLenses: overrides.matchedRitualLenses ?? ['knowledge-garden-resources'],
    category: overrides.category ?? 'opportunity',
    tags: overrides.tags ?? ['water'],
    archiveWorthinessHint: overrides.archiveWorthinessHint ?? false,
    updatedAt: overrides.updatedAt ?? '2026-03-29T00:00:00.000Z',
    ...overrides,
  } as TabRouting;
}

describe('dashboard assembly', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const coopOne = {
      ...makeCoopState(),
      artifacts: [
        {
          id: 'artifact-1',
          title: 'Recent artifact',
          tags: ['shared'],
        },
      ],
    } as CoopSharedState;
    const coopTwo = {
      ...makeCoopState({
        profile: {
          id: 'coop-2',
          name: 'Delta Coop',
        },
      }),
      members: [
        {
          ...makeCoopState().members[0],
          id: 'member-2',
          address: '0x2222222222222222222222222222222222222222',
        },
      ],
    } as CoopSharedState;
    const drafts = [
      makeDraft(),
      makeDraft({
        id: 'draft-2',
        title: 'Related draft',
        suggestedTargetCoopIds: ['coop-1'],
        createdAt: '2026-03-27T00:00:00.000Z',
      }),
    ];
    const routings = [
      makeRouting(),
      makeRouting({
        id: 'routing-2',
        status: 'drafted',
        draftId: 'draft-1',
        relevanceScore: 0.8,
      }),
      makeRouting({
        id: 'routing-3',
        sourceCandidateId: 'candidate-2',
        extractId: 'extract-2',
        coopId: 'coop-2',
        relevanceScore: 0.4,
        updatedAt: '2026-03-27T00:00:00.000Z',
      }),
    ];

    contextMocks.getCoops.mockResolvedValue([coopOne, coopTwo]);
    contextMocks.getLocalSetting.mockImplementation(
      async (_key: string, fallback: unknown) => fallback,
    );
    contextMocks.getRuntimeHealth.mockResolvedValue({
      offline: false,
      missingPermission: false,
      syncError: false,
    });
    contextMocks.hydrateUiPreferences.mockResolvedValue({
      agentCadenceMinutes: 16,
      localInferenceOptIn: true,
      notificationsEnabled: true,
    });
    sharedMocks.getAuthSession.mockResolvedValue({
      primaryAddress: coopOne.members[0]?.address,
    });
    sharedMocks.getPendingOutboxCount.mockRejectedValue(new Error('outbox unavailable'));
    sharedMocks.getSoundPreferences.mockResolvedValue({
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    });
    sharedMocks.listReviewDrafts.mockResolvedValue(drafts);
    sharedMocks.listActiveReviewItemFeedbacks.mockResolvedValue([]);
    sharedMocks.listTabCandidates.mockResolvedValue([
      makeCandidate(),
      makeCandidate({ id: 'candidate-2' }),
    ]);
    sharedMocks.listTabRoutings.mockResolvedValue(routings);
    sharedMocks.listActionBundles.mockResolvedValue([
      {
        id: 'bundle-1',
        coopId: 'coop-1',
      },
      {
        id: 'bundle-2',
        coopId: 'coop-2',
      },
    ] as ActionBundle[]);
    sharedMocks.listAgentObservations.mockResolvedValue([
      {
        id: 'obs-1',
        coopId: 'coop-1',
        status: 'pending',
        createdAt: '2026-03-20T00:00:00.000Z',
        title: 'Pending observation',
        summary: 'Needs review',
      },
    ] as AgentObservation[]);
    sharedMocks.listActionLogEntries.mockResolvedValue([
      { id: 'log-1', coopId: 'coop-1' },
      { id: 'log-2', coopId: 'coop-2' },
    ]);
    sharedMocks.listExecutionPermits.mockResolvedValue([
      { id: 'permit-1', coopId: 'coop-1' },
      { id: 'permit-2', coopId: 'coop-2' },
    ]);
    sharedMocks.listPermitLogEntries.mockResolvedValue([
      { id: 'permit-log-1', coopId: 'coop-1' },
      { id: 'permit-log-2', coopId: 'coop-2' },
    ]);
    handlerMocks.refreshStoredSessionCapabilityStatuses.mockResolvedValue([
      { id: 'session-1', coopId: 'coop-1' },
      { id: 'session-2', coopId: 'coop-2' },
    ]);
    sharedMocks.listSessionCapabilityLogEntries.mockResolvedValue([
      { id: 'session-log-1', coopId: 'coop-1' },
      { id: 'session-log-2', coopId: 'coop-2' },
    ]);
    sharedMocks.listLocalIdentities.mockResolvedValue([]);
    sharedMocks.listReceiverPairings.mockResolvedValue([
      makeReceiverPairingRecord(),
      makeReceiverPairingRecord({
        pairingId: 'pairing-2',
        coopId: 'coop-2',
        memberId: 'member-2',
      }),
    ]);
    sharedMocks.listReceiverCaptures.mockResolvedValue([
      makeReceiverCapture(),
      makeReceiverCapture({
        id: 'capture-2',
        coopId: 'coop-2',
        memberId: 'member-2',
      }),
    ]);
    sharedMocks.queryRecentMemories.mockResolvedValue([
      {
        id: 'memory-1',
        content: 'Earlier coop memory about wetlands restoration.',
      },
    ]);
    handlerMocks.getAgentCycleState.mockResolvedValue({
      running: true,
    });
    operatorMocks.getActiveReviewContextForSession.mockResolvedValue({
      activeCoopId: 'coop-1',
      activeMemberId: 'member-1',
    });
    operatorMocks.getOperatorState.mockResolvedValue({
      activeMember: {
        role: 'trusted',
      },
      actionLog: [
        { id: 'priv-1', context: { coopId: 'coop-1' } },
        { id: 'priv-2', context: { coopId: 'coop-2' } },
      ],
      anchorCapability: null,
      anchorStatus: {
        active: false,
        detail: 'Idle',
      },
      liveArchive: {
        available: false,
        detail: 'Mock archive',
      },
      liveOnchain: {
        available: false,
        detail: 'Mock onchain',
      },
    });

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        action: {
          setIcon: vi.fn(async () => undefined),
          setBadgeText: vi.fn(async () => undefined),
          setBadgeBackgroundColor: vi.fn(async () => undefined),
          setTitle: vi.fn(async () => undefined),
        },
        storage: {
          local: {
            set: vi.fn(async () => undefined),
          },
        },
      },
    });
  });

  it('builds proactive signals scoped to the active coop and dedupes support items', async () => {
    const signals = await buildProactiveSignals({
      coops: await contextMocks.getCoops(),
      drafts: await sharedMocks.listReviewDrafts(),
      candidates: await sharedMocks.listTabCandidates(),
      tabRoutings: await sharedMocks.listTabRoutings(),
      activeCoopId: 'coop-1',
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual(
      expect.objectContaining({
        sourceCandidateId: 'candidate-1',
        title: 'River restoration signal',
      }),
    );
    expect(signals[0]?.support).toHaveLength(2);
  });

  it('computes runtime summary counts and tolerates outbox read failures', async () => {
    const result = await buildSummary();

    expect(result.summary).toEqual(
      expect.objectContaining({
        iconState: 'working',
        pendingDrafts: 2,
        routedTabs: 1,
        pendingActions: 1,
        staleObservationCount: 1,
        pendingAttentionCount: 5,
        pendingOutboxCount: 0,
        localEnhancement: 'local-helper',
        agentCadenceMinutes: 16,
      }),
    );
  });

  it('excludes active review feedback from summary and proactive signal counts', async () => {
    sharedMocks.listActiveReviewItemFeedbacks.mockResolvedValue([
      {
        id: 'feedback-1',
        itemKind: 'signal',
        itemId: 'signal:candidate-1',
        action: 'not-useful',
        coopId: 'coop-1',
        sourceCandidateId: 'candidate-1',
        extractId: 'extract-1',
        createdAt: '2026-03-29T01:00:00.000Z',
        updatedAt: '2026-03-29T01:00:00.000Z',
      },
    ]);

    const result = await buildSummary();
    const signals = await buildProactiveSignals({
      coops: await contextMocks.getCoops(),
      drafts: await sharedMocks.listReviewDrafts(),
      candidates: await sharedMocks.listTabCandidates(),
      tabRoutings: await sharedMocks.listTabRoutings(),
      activeReviewItemFeedbacks: await sharedMocks.listActiveReviewItemFeedbacks(),
      activeCoopId: 'coop-1',
    });

    expect(result.summary.routedTabs).toBe(0);
    expect(signals).toHaveLength(0);
  });

  it('refreshes the badge, writes a popup snapshot, and notifies listeners', async () => {
    await refreshBadge();

    expect(chrome.action.setIcon).toHaveBeenCalledTimes(1);
    expect(chrome.action.setBadgeText).toHaveBeenCalledTimes(1);
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledTimes(1);
    expect(chrome.action.setTitle).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      'coop:popup-snapshot': expect.objectContaining({
        coopCount: 2,
        draftCount: 2,
      }),
    });
    expect(messageMocks.notifyDashboardUpdated).toHaveBeenCalledTimes(1);
  });

  it('returns a scoped dashboard payload with operator data filtered to the active coop', async () => {
    const dashboard = await getDashboard();

    expect(dashboard.runtimeConfig).toEqual({
      chainKey: 'sepolia',
      onchainMode: 'mock',
      archiveMode: 'mock',
      sessionMode: 'mock',
      providerMode: 'standard',
      privacyMode: 'off',
      receiverAppUrl: 'https://receiver.test',
      signalingUrls: ['wss://api.coop.town'],
      websocketSyncUrl: 'wss://api.coop.town/yws',
    });
    expect(dashboard.operator.policyActionQueue).toHaveLength(1);
    expect(dashboard.operator.policyActionLogEntries).toHaveLength(1);
    expect(dashboard.operator.permits).toHaveLength(1);
    expect(dashboard.operator.sessionCapabilities).toHaveLength(1);
    expect(dashboard.receiverPairings).toHaveLength(1);
    expect(dashboard.receiverIntake).toHaveLength(2);
    expect(dashboard.tabRoutings).toHaveLength(3);
    expect(dashboard.proactiveSignals).toHaveLength(1);
  });

  it('deduplicates candidates by canonicalUrlHash, keeping only the most recent per URL', async () => {
    const urlHash = 'hash-abc123';
    sharedMocks.listTabCandidates.mockResolvedValue([
      makeCandidate({
        id: 'recent-capture',
        canonicalUrlHash: urlHash,
        capturedAt: '2026-03-29T12:00:00.000Z',
      }),
      makeCandidate({
        id: 'older-capture',
        canonicalUrlHash: urlHash,
        capturedAt: '2026-03-28T06:00:00.000Z',
      }),
      makeCandidate({
        id: 'unique-capture',
        canonicalUrlHash: 'hash-different',
        url: 'https://example.com/other',
        canonicalUrl: 'https://example.com/other',
        capturedAt: '2026-03-28T00:00:00.000Z',
      }),
    ]);

    const dashboard = await getDashboard();

    expect(dashboard.candidates).toHaveLength(2);
    expect(dashboard.candidates.map((c) => c.id)).toContain('recent-capture');
    expect(dashboard.candidates.map((c) => c.id)).toContain('unique-capture');
    expect(dashboard.candidates.map((c) => c.id)).not.toContain('older-capture');
  });
});
