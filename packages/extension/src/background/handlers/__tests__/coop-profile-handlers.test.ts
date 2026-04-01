import type { CoopSharedState } from '@coop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeCoopState } from '../../../__tests__/fixtures';

const sharedMocks = vi.hoisted(() => ({
  createLocalMemberSignerBinding: vi.fn(),
  createStateFromInviteBootstrap: vi.fn(),
  getAuthSession: vi.fn(),
  initializeMemberPrivacy: vi.fn(),
  joinCoop: vi.fn(),
  leaveCoop: vi.fn(),
  markAccountPredicted: vi.fn(),
  parseInviteCode: vi.fn(),
  predictMemberAccountAddress: vi.fn(),
  saveLocalMemberSignerBinding: vi.fn(async () => undefined),
  verifyInviteCodeProof: vi.fn(),
}));

const contextMocks = vi.hoisted(() => ({
  getCoops: vi.fn(),
  saveState: vi.fn(async () => undefined),
  setLocalSetting: vi.fn(async () => undefined),
}));

const dashboardMocks = vi.hoisted(() => ({
  refreshBadge: vi.fn(async () => undefined),
}));

const agentMocks = vi.hoisted(() => ({
  emitAgentObservationIfMissing: vi.fn(async () => undefined),
  ensureOnboardingBurst: vi.fn(async () => undefined),
  requestAgentCycle: vi.fn(async () => undefined),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    createLocalMemberSignerBinding: sharedMocks.createLocalMemberSignerBinding,
    createStateFromInviteBootstrap: sharedMocks.createStateFromInviteBootstrap,
    getAuthSession: sharedMocks.getAuthSession,
    initializeMemberPrivacy: sharedMocks.initializeMemberPrivacy,
    joinCoop: sharedMocks.joinCoop,
    leaveCoop: sharedMocks.leaveCoop,
    markAccountPredicted: sharedMocks.markAccountPredicted,
    parseInviteCode: sharedMocks.parseInviteCode,
    predictMemberAccountAddress: sharedMocks.predictMemberAccountAddress,
    saveLocalMemberSignerBinding: sharedMocks.saveLocalMemberSignerBinding,
    verifyInviteCodeProof: sharedMocks.verifyInviteCodeProof,
  };
});

vi.mock('../../context', () => ({
  db: {},
  configuredChain: 'sepolia',
  configuredOnchainMode: 'mock',
  getCoops: contextMocks.getCoops,
  notifyExtensionEvent: vi.fn(),
  saveState: contextMocks.saveState,
  setLocalSetting: contextMocks.setLocalSetting,
  stateKeys: {
    activeCoopId: 'active-coop-id',
    captureMode: 'capture-mode',
  },
}));

vi.mock('../../dashboard', () => ({
  refreshBadge: dashboardMocks.refreshBadge,
}));

vi.mock('../../operator', () => ({
  getOperatorState: vi.fn(),
  logPrivilegedAction: vi.fn(),
}));

vi.mock('../agent', () => ({
  emitAgentObservationIfMissing: agentMocks.emitAgentObservationIfMissing,
  ensureOnboardingBurst: agentMocks.ensureOnboardingBurst,
  requestAgentCycle: agentMocks.requestAgentCycle,
}));

const { handleJoinCoop, handleLeaveCoop, handleUpdateCoopDetails } = await import('../coop');

function makeBaseCoop(): CoopSharedState {
  return makeCoopState({
    profile: {
      id: 'coop-1',
      name: 'Alpha Coop',
      purpose: 'Coordinate grants and evidence.',
      captureMode: 'manual',
      safeAddress: '0x1111111111111111111111111111111111111111',
    },
    members: [
      {
        id: 'member-1',
        displayName: 'Ava',
        role: 'creator',
        authMode: 'passkey',
        address: '0x1111111111111111111111111111111111111111',
        joinedAt: '2026-03-20T00:00:00.000Z',
        identityWarning: 'Device bound.',
      },
    ],
    onchainState: {
      chainId: 11155111,
      chainKey: 'sepolia',
      safeAddress: '0x1111111111111111111111111111111111111111',
      safeCapability: 'ready',
      safeOwners: ['0x1111111111111111111111111111111111111111'],
      statusNote: 'Ready',
    },
  });
}

describe('coop profile and membership handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const coop = makeBaseCoop();
    const joinedMember = {
      id: 'member-2',
      displayName: 'Bo',
      role: 'trusted',
      authMode: 'passkey',
      address: '0x2222222222222222222222222222222222222222',
      joinedAt: '2026-03-29T00:00:00.000Z',
      identityWarning: 'Pending signer sync.',
    };
    const pendingAccount = {
      memberId: 'member-2',
      accountType: 'kernel-v3.1',
      status: 'pending',
    };
    const joinedState = {
      ...coop,
      members: [...coop.members, joinedMember],
      memberAccounts: [pendingAccount],
    } as CoopSharedState;

    contextMocks.getCoops.mockResolvedValue([coop]);
    sharedMocks.parseInviteCode.mockReturnValue({
      id: 'invite-1',
      type: 'trusted',
      bootstrap: {
        coopId: 'coop-1',
      },
    });
    sharedMocks.verifyInviteCodeProof.mockReturnValue(true);
    sharedMocks.createStateFromInviteBootstrap.mockReturnValue(coop);
    sharedMocks.joinCoop.mockReturnValue({
      state: joinedState,
      member: joinedMember,
    });
    sharedMocks.initializeMemberPrivacy.mockResolvedValue({
      commitment: 'commitment-2',
    });
    sharedMocks.getAuthSession.mockResolvedValue({
      primaryAddress: '0x1111111111111111111111111111111111111111',
      passkey: {
        id: 'passkey-1',
      },
    });
    sharedMocks.predictMemberAccountAddress.mockResolvedValue(
      '0x3333333333333333333333333333333333333333',
    );
    sharedMocks.markAccountPredicted.mockImplementation((account, accountAddress) => ({
      ...account,
      status: 'predicted',
      accountAddress,
    }));
    sharedMocks.createLocalMemberSignerBinding.mockReturnValue({
      coopId: 'coop-1',
      memberId: 'member-2',
      accountAddress: '0x3333333333333333333333333333333333333333',
      accountType: 'kernel-v3.1',
      passkeyCredentialId: 'passkey-1',
    });
    sharedMocks.leaveCoop.mockReturnValue({
      state: {
        ...coop,
        profile: {
          ...coop.profile,
          active: false,
        },
      },
    });
  });

  it('joins an existing coop, hydrates privacy state, and predicts the signer account for trusted members', async () => {
    const result = await handleJoinCoop({
      type: 'join-coop',
      payload: {
        inviteCode: 'COOP-INVITE',
        displayName: 'Bo',
        seedContribution: 'I bring operator coverage.',
      },
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        profile: expect.objectContaining({
          id: 'coop-1',
        }),
        memberCommitments: ['commitment-2'],
        memberAccounts: [
          expect.objectContaining({
            memberId: 'member-2',
            status: 'predicted',
            accountAddress: '0x3333333333333333333333333333333333333333',
          }),
        ],
      }),
    });
    expect(contextMocks.setLocalSetting).toHaveBeenCalledWith('active-coop-id', 'coop-1');
    expect(sharedMocks.saveLocalMemberSignerBinding).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        memberId: 'member-2',
        accountAddress: '0x3333333333333333333333333333333333333333',
      }),
    );
    expect(agentMocks.emitAgentObservationIfMissing).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'safe-add-owner-requested',
        coopId: 'coop-1',
      }),
    );
    expect(agentMocks.ensureOnboardingBurst).toHaveBeenCalledWith({
      coopId: 'coop-1',
      memberId: 'member-2',
      reason: 'coop-join',
    });
    expect(dashboardMocks.refreshBadge).toHaveBeenCalledTimes(1);
  });

  it('rejects joins when the invite proof does not match the existing coop', async () => {
    sharedMocks.verifyInviteCodeProof.mockReturnValueOnce(false);

    const result = await handleJoinCoop({
      type: 'join-coop',
      payload: {
        inviteCode: 'COOP-INVITE',
        displayName: 'Bo',
        seedContribution: 'I bring operator coverage.',
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Invite verification failed.',
    });
    expect(sharedMocks.joinCoop).not.toHaveBeenCalled();
  });

  it('updates coop details, mirrors purpose into the soul, and persists capture-mode changes', async () => {
    const result = await handleUpdateCoopDetails({
      type: 'update-coop-details',
      payload: {
        coopId: 'coop-1',
        profile: {
          name: 'Renamed Coop',
          purpose: 'Coordinate archive follow-up.',
          captureMode: '10-min',
        },
        soul: {
          whyThisCoopExists: 'Help the coop act on the strongest leads.',
          usefulSignalDefinition: 'Signals point to clear next steps.',
          toneAndWorkingStyle: 'Direct, kind, and evidence-first.',
          artifactFocus: ['Funding leads', 'Decision records'],
        },
        setupInsights: {
          summary: 'Updated setup summary for a more focused coop workflow.',
          crossCuttingPainPoints: ['Work is split across too many tools'],
          crossCuttingOpportunities: ['Keep decisions and leads in one shared place'],
          lenses: [
            {
              lens: 'capital-formation',
              currentState: 'Funding leads live in chat.',
              painPoints: 'They disappear quickly.',
              improvements: 'Track them in the coop.',
            },
            {
              lens: 'impact-reporting',
              currentState: 'Evidence is gathered at the end.',
              painPoints: 'The story feels incomplete.',
              improvements: 'Collect evidence steadily.',
            },
            {
              lens: 'governance-coordination',
              currentState: 'Decisions are made on calls.',
              painPoints: 'Follow-ups slip.',
              improvements: 'Keep actions visible.',
            },
            {
              lens: 'knowledge-garden-resources',
              currentState: 'Research sits in tabs.',
              painPoints: 'People repeat work.',
              improvements: 'Save reusable references.',
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        profile: expect.objectContaining({
          id: 'coop-1',
          name: 'Renamed Coop',
          purpose: 'Coordinate archive follow-up.',
          captureMode: '10-min',
        }),
        soul: expect.objectContaining({
          purposeStatement: 'Coordinate archive follow-up.',
          whyThisCoopExists: 'Help the coop act on the strongest leads.',
          artifactFocus: ['Funding leads', 'Decision records'],
        }),
        setupInsights: expect.objectContaining({
          summary: 'Updated setup summary for a more focused coop workflow.',
        }),
      }),
    });
    expect(contextMocks.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({
          name: 'Renamed Coop',
        }),
        soul: expect.objectContaining({
          purposeStatement: 'Coordinate archive follow-up.',
        }),
      }),
    );
    expect(contextMocks.setLocalSetting).toHaveBeenCalledWith('capture-mode', '10-min');
  });

  it('rejects invalid coop detail payloads instead of saving broken state', async () => {
    const result = await handleUpdateCoopDetails({
      type: 'update-coop-details',
      payload: {
        coopId: 'coop-1',
        soul: {
          artifactFocus: [],
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.any(String),
    });
    expect(contextMocks.saveState).not.toHaveBeenCalled();
  });

  it('updates the active coop when leaving deactivates the current coop', async () => {
    const otherCoop = makeCoopState({
      profile: {
        id: 'coop-2',
        name: 'Fallback Coop',
      },
    });
    contextMocks.getCoops.mockResolvedValue([makeBaseCoop(), otherCoop]);

    const result = await handleLeaveCoop({
      type: 'leave-coop',
      payload: {
        coopId: 'coop-1',
        memberId: 'member-1',
      },
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        profile: expect.objectContaining({
          id: 'coop-1',
          active: false,
        }),
      }),
    });
    expect(contextMocks.setLocalSetting).toHaveBeenCalledWith('active-coop-id', 'coop-2');
    expect(dashboardMocks.refreshBadge).toHaveBeenCalledTimes(1);
  });

  it('surfaces leave errors from the shared coop flow', async () => {
    sharedMocks.leaveCoop.mockImplementationOnce(() => {
      throw new Error('Creators must transfer ownership before leaving.');
    });

    const result = await handleLeaveCoop({
      type: 'leave-coop',
      payload: {
        coopId: 'coop-1',
        memberId: 'member-1',
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Creators must transfer ownership before leaving.',
    });
    expect(contextMocks.saveState).not.toHaveBeenCalled();
  });
});
