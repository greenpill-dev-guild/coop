import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendRuntimeMessageMock } = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useSidepanelInvites } = await import('../useSidepanelInvites');

type ActiveCoop = NonNullable<Parameters<typeof useSidepanelInvites>[0]['activeCoop']>;
type ActiveMember = NonNullable<Parameters<typeof useSidepanelInvites>[0]['activeMember']>;
type InviteResult = NonNullable<Parameters<typeof useSidepanelInvites>[0]['inviteResult']>;
type Dashboard = NonNullable<Parameters<typeof useSidepanelInvites>[0]['dashboard']>;

function makeActiveCoop(): ActiveCoop {
  return {
    profile: { id: 'coop-1', name: 'Field Coop' },
  } as ActiveCoop;
}

function makeActiveMember(): ActiveMember {
  return {
    id: 'member-1',
    displayName: 'Mina',
    address: '0x1111111111111111111111111111111111111111',
    role: 'creator',
    authMode: 'passkey',
    joinedAt: '2026-03-20T00:00:00.000Z',
    identityWarning: 'Device bound.',
  } as ActiveMember;
}

function makeInviteResult(
  overrides: Partial<InviteResult> = {},
): InviteResult {
  return {
    id: 'invite-1',
    type: 'member',
    code: 'INVITE-1',
    expiresAt: '2026-04-01T00:00:00.000Z',
    createdAt: '2026-03-20T00:00:00.000Z',
    createdBy: 'member-1',
    usedByMemberIds: [],
    bootstrap: {
      coopId: 'coop-1',
      coopDisplayName: 'Field Coop',
      inviteId: 'invite-1',
      inviteType: 'member',
      expiresAt: '2026-04-01T00:00:00.000Z',
      roomId: 'room-1',
      signalingUrls: ['wss://api.coop.town'],
      inviteProof: 'proof-1',
    },
    ...overrides,
  } as InviteResult;
}

function makeDashboard(): Dashboard {
  return {
    receiverPairings: [
      {
        pairingId: 'pairing-1',
        coopId: 'coop-1',
        coopDisplayName: 'Field Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        pairSecret: 'secret-1',
        roomId: 'room-1',
        signalingUrls: ['wss://api.coop.town'],
        issuedAt: '2026-03-20T00:00:00.000Z',
        expiresAt: '2026-04-01T00:00:00.000Z',
        active: false,
        pairingCode: 'PAIR-1',
        deepLink: 'https://receiver.test/pair/1',
      },
      {
        pairingId: 'pairing-2',
        coopId: 'coop-1',
        coopDisplayName: 'Field Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        pairSecret: 'secret-2',
        roomId: 'room-2',
        signalingUrls: ['wss://api.coop.town'],
        issuedAt: '2026-03-21T00:00:00.000Z',
        expiresAt: '2026-04-02T00:00:00.000Z',
        active: false,
        pairingCode: 'PAIR-2',
        deepLink: 'https://receiver.test/pair/2',
      },
    ],
  } as Dashboard;
}

describe('useSidepanelInvites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears the fresh invite result when revoking the same invite type', async () => {
    const setMessage = vi.fn();
    const setInviteResult = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useSidepanelInvites({
        activeCoop: makeActiveCoop(),
        activeMember: makeActiveMember(),
        dashboard: makeDashboard(),
        inviteResult: makeInviteResult({ type: 'trusted' }),
        setMessage,
        setInviteResult,
        setPairingResult: vi.fn(),
        loadDashboard,
      }),
    );

    await act(async () => {
      await result.current.revokeInviteType('trusted');
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'revoke-invite-type',
      payload: {
        coopId: 'coop-1',
        inviteType: 'trusted',
        revokedBy: 'member-1',
      },
    });
    expect(setInviteResult).toHaveBeenCalledWith(null);
    expect(setMessage).toHaveBeenCalledWith('Trusted flock invite revoked.');
    expect(loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('clears the fresh invite result when revoking the same invite id', async () => {
    const setMessage = vi.fn();
    const setInviteResult = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useSidepanelInvites({
        activeCoop: makeActiveCoop(),
        activeMember: makeActiveMember(),
        dashboard: makeDashboard(),
        inviteResult: makeInviteResult({ id: 'invite-match' }),
        setMessage,
        setInviteResult,
        setPairingResult: vi.fn(),
        loadDashboard,
      }),
    );

    await act(async () => {
      await result.current.revokeInvite('invite-match');
    });

    expect(setInviteResult).toHaveBeenCalledWith(null);
    expect(setMessage).toHaveBeenCalledWith('Invite revoked.');
    expect(loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('marks the selected pairing active before the dashboard reload finishes', async () => {
    const setPairingResult = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useSidepanelInvites({
        activeCoop: makeActiveCoop(),
        activeMember: makeActiveMember(),
        dashboard: makeDashboard(),
        inviteResult: null,
        setMessage: vi.fn(),
        setInviteResult: vi.fn(),
        setPairingResult,
        loadDashboard,
      }),
    );

    await act(async () => {
      await result.current.selectReceiverPairing('pairing-2');
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'set-active-receiver-pairing',
      payload: {
        pairingId: 'pairing-2',
      },
    });
    expect(setPairingResult).toHaveBeenCalledWith(
      expect.objectContaining({
        pairingId: 'pairing-2',
        active: true,
      }),
    );
    expect(loadDashboard).toHaveBeenCalledTimes(1);
  });
});
