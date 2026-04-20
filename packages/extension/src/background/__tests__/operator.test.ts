import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CoopSharedState } from '@coop/shared';

const mocks = vi.hoisted(() => ({
  appendPrivilegedActionLog: vi.fn(),
  createPrivilegedActionLogEntry: vi.fn(),
  describeAnchorCapabilityStatus: vi.fn(),
  describePrivilegedFeatureAvailability: vi.fn(),
  getAnchorCapability: vi.fn(),
  getAuthSession: vi.fn(),
  getCoops: vi.fn(),
  getLocalSetting: vi.fn(),
  getResolvedTrustedNodeArchiveConfig: vi.fn(),
  isTrustedNodeRole: vi.fn(),
  listPrivilegedActionLog: vi.fn(),
  resolveActiveReviewContext: vi.fn(),
  resolveReceiverPairingMember: vi.fn(),
  setPrivilegedActionLog: vi.fn(),
  trustedNodeArchiveBootstrap: {
    error: undefined as string | undefined,
  },
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    appendPrivilegedActionLog: mocks.appendPrivilegedActionLog,
    createPrivilegedActionLogEntry: mocks.createPrivilegedActionLogEntry,
    describeAnchorCapabilityStatus: mocks.describeAnchorCapabilityStatus,
    getAnchorCapability: mocks.getAnchorCapability,
    getAuthSession: mocks.getAuthSession,
    listPrivilegedActionLog: mocks.listPrivilegedActionLog,
    setPrivilegedActionLog: mocks.setPrivilegedActionLog,
  };
});

vi.mock('../../runtime/agent/harness', () => ({
  isTrustedNodeRole: mocks.isTrustedNodeRole,
}));

vi.mock('../../runtime/operator', () => ({
  describePrivilegedFeatureAvailability: mocks.describePrivilegedFeatureAvailability,
}));

vi.mock('../../runtime/receiver', () => ({
  resolveActiveReviewContext: mocks.resolveActiveReviewContext,
  resolveReceiverPairingMember: mocks.resolveReceiverPairingMember,
}));

vi.mock('../context', () => ({
  configuredArchiveMode: 'live',
  configuredOnchainMode: 'mock',
  db: {},
  getCoops: mocks.getCoops,
  getLocalSetting: mocks.getLocalSetting,
  getResolvedTrustedNodeArchiveConfig: mocks.getResolvedTrustedNodeArchiveConfig,
  stateKeys: {
    activeCoopId: 'active-coop-id',
  },
  trustedNodeArchiveBootstrap: mocks.trustedNodeArchiveBootstrap,
}));

const {
  appendOperatorActionLog,
  findAuthenticatedCoopMember,
  getActiveReviewContextForSession,
  getOperatorState,
  getTrustedNodeContext,
  logPrivilegedAction,
  requireCreatorGrantManager,
} = await import('../operator');

function makeAuthSession(primaryAddress: string | undefined) {
  if (!primaryAddress) {
    return null;
  }

  return {
    authMode: 'passkey' as const,
    displayName: 'Test Operator',
    primaryAddress,
    createdAt: '2026-03-01T00:00:00.000Z',
    identityWarning: 'Stored locally.',
  };
}

function makeCoop(overrides: Partial<CoopSharedState> = {}): CoopSharedState {
  return {
    profile: {
      id: 'coop-1',
      name: 'Alpha Coop',
      purpose: 'Watershed work',
      spaceType: 'community',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'member-1',
      captureMode: 'manual',
      safeAddress: '0x1111111111111111111111111111111111111111',
      active: true,
    },
    members: [
      {
        id: 'member-1',
        displayName: 'Ari',
        role: 'creator',
        authMode: 'passkey',
        address: '0x1111111111111111111111111111111111111111',
        joinedAt: '2026-01-01T00:00:00.000Z',
        identityWarning: '',
      },
      {
        id: 'member-2',
        displayName: 'Bo',
        role: 'trusted',
        authMode: 'passkey',
        address: '0x2222222222222222222222222222222222222222',
        joinedAt: '2026-01-02T00:00:00.000Z',
        identityWarning: '',
      },
    ],
    artifacts: [],
    archiveReceipts: [],
    onchainState: {
      chainId: 11155111,
      chainKey: 'sepolia',
      safeAddress: '0x1111111111111111111111111111111111111111',
      safeCapability: 'ready',
      statusNote: '',
    },
    setupInsights: {
      version: 1,
      lenses: [],
      summaryNarrative: '',
      seedContribution: '',
    },
    soul: { identity: '', norms: '', ritualGuidance: '' },
    rituals: [],
    memberAccounts: [],
    reviewBoard: [],
    memoryProfile: {
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      topDomains: [],
      topTags: [],
      categoryStats: [],
      ritualLensWeights: [],
      exemplarArtifactIds: [],
      archiveSignals: { archivedTagCounts: {}, archivedDomainCounts: {} },
    },
    syncRoom: { signalingServers: [], roomId: 'room-1', password: 'pw' },
    invites: [],
    memberCommitments: [],
    ...overrides,
  } as unknown as CoopSharedState;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLocalSetting.mockResolvedValue('coop-1');
  mocks.getResolvedTrustedNodeArchiveConfig.mockResolvedValue(undefined);
  mocks.describeAnchorCapabilityStatus.mockReturnValue({
    enabled: true,
    active: true,
    detail: 'Anchor mode enabled.',
  });
  mocks.describePrivilegedFeatureAvailability
    .mockReturnValueOnce({
      available: true,
      detail: 'Live archive uploads are available.',
    })
    .mockReturnValueOnce({
      available: true,
      detail: 'Safe deployments are available.',
    });
  mocks.isTrustedNodeRole.mockImplementation(
    (role: string) => role === 'creator' || role === 'trusted',
  );
  mocks.appendPrivilegedActionLog.mockImplementation((current, entry) => [...current, entry]);
  mocks.createPrivilegedActionLogEntry.mockImplementation((entry) => ({
    id: 'log-1',
    createdAt: '2026-03-01T00:00:00.000Z',
    ...entry,
  }));
  mocks.listPrivilegedActionLog.mockResolvedValue([]);
  mocks.setPrivilegedActionLog.mockResolvedValue(undefined);
});

describe('background operator helpers', () => {
  it('passes the requested active coop id into review-context resolution', async () => {
    const coop = makeCoop();
    const authSession = makeAuthSession(coop.members[0]?.address);
    mocks.resolveActiveReviewContext.mockResolvedValue({
      activeCoopId: 'coop-1',
      activeCoop: coop,
      activeMemberId: 'member-1',
    });

    const result = await getActiveReviewContextForSession([coop], authSession);

    expect(result).toEqual(
      expect.objectContaining({
        activeCoopId: 'coop-1',
      }),
    );
    expect(mocks.resolveActiveReviewContext).toHaveBeenCalledWith([coop], authSession, 'coop-1');
  });

  it('builds operator state and blocks live archive when trusted-node config is missing', async () => {
    const coop = makeCoop();
    const authSession = makeAuthSession(coop.members[0]?.address);
    mocks.getCoops.mockResolvedValue([coop]);
    mocks.getAuthSession.mockResolvedValue(authSession);
    mocks.getAnchorCapability.mockResolvedValue({ enabled: true });
    mocks.resolveActiveReviewContext.mockResolvedValue({
      activeCoopId: coop.profile.id,
      activeCoop: coop,
      activeMemberId: coop.members[0]?.id,
    });
    mocks.resolveReceiverPairingMember.mockReturnValue(coop.members[0]);
    mocks.trustedNodeArchiveBootstrap.error = 'missing delegation';

    const result = await getOperatorState();

    expect(result.activeCoop?.profile.id).toBe(coop.profile.id);
    expect(result.activeMember?.id).toBe(coop.members[0]?.id);
    expect(result.liveArchive).toEqual(
      expect.objectContaining({
        available: false,
      }),
    );
    expect(result.liveArchive.detail).toContain('missing delegation');
    expect(result.liveOnchain).toEqual(
      expect.objectContaining({
        available: true,
      }),
    );
  });

  it('appends operator log entries through the shared log helpers', async () => {
    const entry = { id: 'existing-log' };
    mocks.listPrivilegedActionLog.mockResolvedValue([entry]);

    const result = await appendOperatorActionLog({ id: 'next-log' } as never);

    expect(result).toEqual([entry, { id: 'next-log' }]);
    expect(mocks.setPrivilegedActionLog).toHaveBeenCalledWith({}, [entry, { id: 'next-log' }]);
  });

  it('creates privileged log entries with the correct mode and actor context', async () => {
    const coop = makeCoop();
    const authSession = makeAuthSession(coop.members[0]?.address);
    if (!authSession) {
      throw new Error('Expected auth session for coop member.');
    }

    const entry = await logPrivilegedAction({
      actionType: 'safe-deployment',
      status: 'attempted',
      detail: 'Attempting live Safe deployment.',
      coop,
      memberId: coop.members[0]?.id,
      memberDisplayName: coop.members[0]?.displayName,
      authSession,
    });

    expect(mocks.createPrivilegedActionLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'safe-deployment',
        context: expect.objectContaining({
          coopId: coop.profile.id,
          actorAddress: authSession.primaryAddress,
          mode: 'mock',
        }),
      }),
    );
    expect(entry).toEqual(
      expect.objectContaining({
        actionType: 'safe-deployment',
      }),
    );
  });

  it('finds authenticated members and enforces creator-only grant management', async () => {
    const coop = makeCoop();
    const creatorSession = makeAuthSession('0x1111111111111111111111111111111111111111');
    const memberSession = makeAuthSession('0x2222222222222222222222222222222222222222');
    mocks.getCoops.mockResolvedValue([coop]);

    expect(findAuthenticatedCoopMember(coop, creatorSession)?.id).toBe('member-1');
    expect(
      findAuthenticatedCoopMember(
        coop,
        makeAuthSession('0x3333333333333333333333333333333333333333'),
      ),
    ).toBeUndefined();

    const creatorResult = await requireCreatorGrantManager(
      coop.profile.id,
      creatorSession,
      'Only coop creators can do this.',
    );
    const memberResult = await requireCreatorGrantManager(
      coop.profile.id,
      memberSession,
      'Only coop creators can do this.',
    );

    expect(creatorResult).toEqual(
      expect.objectContaining({
        ok: true,
        member: expect.objectContaining({ id: 'member-1' }),
      }),
    );
    expect(memberResult).toEqual({
      ok: false,
      error: 'Only coop creators can do this.',
    });
  });

  it('rejects trusted-node controls without a passkey session', async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const result = await getTrustedNodeContext();

    expect(result).toEqual({
      ok: false,
      error: 'A passkey session is required for trusted-node controls.',
    });
  });

  it('resolves trusted-node context for trusted members and rejects non-trusted members', async () => {
    const coop = makeCoop();
    const authSession = { primaryAddress: coop.members[1]?.address };
    mocks.getAuthSession.mockResolvedValue(authSession);
    mocks.getCoops.mockResolvedValue([coop]);
    mocks.resolveActiveReviewContext.mockResolvedValue({
      activeCoopId: coop.profile.id,
      activeCoop: coop,
      activeMemberId: coop.members[1]?.id,
    });
    mocks.resolveReceiverPairingMember.mockReturnValueOnce({
      ...coop.members[1],
      role: 'member',
    });

    const denied = await getTrustedNodeContext();

    expect(denied).toEqual({
      ok: false,
      error: 'Trusted-node controls are limited to creator or trusted members.',
    });

    mocks.resolveReceiverPairingMember.mockReturnValueOnce(coop.members[1]);

    const allowed = await getTrustedNodeContext();

    expect(allowed).toEqual(
      expect.objectContaining({
        ok: true,
        coop: expect.objectContaining({
          profile: expect.objectContaining({ id: coop.profile.id }),
        }),
        member: expect.objectContaining({ id: 'member-2' }),
      }),
    );
  });
});
