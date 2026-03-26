import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendRuntimeMessageMock } = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useSidepanelGreenGoods } = await import('../useSidepanelGreenGoods');
const { useSidepanelInvites } = await import('../useSidepanelInvites');
const { useSidepanelPermissions } = await import('../useSidepanelPermissions');

type ActiveCoop = NonNullable<Parameters<typeof useSidepanelInvites>[0]['activeCoop']>;
type ActiveMember = NonNullable<Parameters<typeof useSidepanelInvites>[0]['activeMember']>;

function makeRuntimeConfig(
  sessionMode: 'live' | 'mock' | 'off',
): Parameters<typeof useSidepanelPermissions>[0]['runtimeConfig'] {
  return { sessionMode } as Parameters<typeof useSidepanelPermissions>[0]['runtimeConfig'];
}

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

describe('sidepanel onchain actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage: sendRuntimeMessageMock,
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('provisions a member smart account from the active coop context', async () => {
    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useSidepanelInvites({
        activeCoop: makeActiveCoop(),
        activeMember: makeActiveMember(),
        dashboard: null,
        setMessage,
        setInviteResult: vi.fn(),
        setPairingResult: vi.fn(),
        loadDashboard,
      }),
    );

    await act(async () => {
      await result.current.handleProvisionMemberOnchainAccount();
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'provision-member-onchain-account',
      payload: {
        coopId: 'coop-1',
        memberId: 'member-1',
      },
    });
    expect(setMessage).toHaveBeenCalledWith(
      'Member smart account predicted and stored on this browser.',
    );
    expect(loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('surfaces provisioning errors without reloading the dashboard', async () => {
    sendRuntimeMessageMock.mockResolvedValueOnce({
      ok: false,
      error: 'Could not provision the member smart account.',
    });

    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useSidepanelInvites({
        activeCoop: makeActiveCoop(),
        activeMember: makeActiveMember(),
        dashboard: null,
        setMessage,
        setInviteResult: vi.fn(),
        setPairingResult: vi.fn(),
        loadDashboard,
      }),
    );

    await act(async () => {
      await result.current.handleProvisionMemberOnchainAccount();
    });

    expect(setMessage).toHaveBeenCalledWith('Could not provision the member smart account.');
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it.each([
    ['live', 'Garden pass hatched and enabled for the shared nest.'],
    ['mock', 'Practice garden pass hatched for the Green Goods rehearsal flow.'],
    ['off', 'Garden pass hatched locally. Turn garden pass mode on before live use.'],
  ] as const)(
    'labels issued session capabilities for %s mode',
    async (sessionMode, expectedMessage) => {
      const setMessage = vi.fn();
      const loadDashboard = vi.fn(async () => undefined);
      const { result } = renderHook(() =>
        useSidepanelPermissions({
          activeCoop: makeActiveCoop(),
          runtimeConfig: makeRuntimeConfig(sessionMode),
          setMessage,
          loadDashboard,
        }),
      );

      await act(async () => {
        await result.current.handleIssueSessionCapability({
          coopId: 'coop-1',
          expiresAt: '2026-03-26T00:00:00.000Z',
          maxUses: 12,
          allowedActions: ['green-goods-create-garden'],
        });
      });

      expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
        type: 'issue-session-capability',
        payload: {
          coopId: 'coop-1',
          expiresAt: '2026-03-26T00:00:00.000Z',
          maxUses: 12,
          allowedActions: ['green-goods-create-garden'],
        },
      });
      expect(setMessage).toHaveBeenCalledWith(expectedMessage);
      expect(loadDashboard).toHaveBeenCalledTimes(1);
    },
  );

  it('surfaces garden-pass revoke failures from the runtime', async () => {
    sendRuntimeMessageMock.mockResolvedValueOnce({
      ok: false,
      error: 'Garden pass revoke failed.',
    });

    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useSidepanelPermissions({
        activeCoop: makeActiveCoop(),
        runtimeConfig: makeRuntimeConfig('mock'),
        setMessage,
        loadDashboard,
      }),
    );

    await act(async () => {
      await result.current.handleRevokeSessionCapability('cap-1');
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'revoke-session-capability',
      payload: { capabilityId: 'cap-1' },
    });
    expect(setMessage).toHaveBeenCalledWith('Garden pass revoke failed.');
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it('submits impact reports from the active member smart account and refreshes dashboard state', async () => {
    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useSidepanelGreenGoods({
        activeCoop: makeActiveCoop(),
        activeMember: makeActiveMember(),
        setMessage,
        loadDashboard,
        loadAgentDashboard: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleSubmitGreenGoodsImpactReport({
        title: 'Watershed update',
        description: 'Quarterly impact pulse.',
        domain: 'agro',
        reportCid: 'bafy-impact',
        metricsSummary: '{"soil":0.7}',
        reportingPeriodStart: 1_700_000_000,
        reportingPeriodEnd: 1_700_086_400,
      });
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'submit-green-goods-impact-report',
      payload: {
        coopId: 'coop-1',
        memberId: 'member-1',
        report: {
          title: 'Watershed update',
          description: 'Quarterly impact pulse.',
          domain: 'agro',
          reportCid: 'bafy-impact',
          metricsSummary: '{"soil":0.7}',
          reportingPeriodStart: 1_700_000_000,
          reportingPeriodEnd: 1_700_086_400,
        },
      },
    });
    expect(setMessage).toHaveBeenCalledWith(
      'Green Goods impact report submitted from your member smart account.',
    );
    expect(loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('keeps work-submission failures visible to the user', async () => {
    sendRuntimeMessageMock.mockResolvedValueOnce({
      ok: false,
      error: 'Could not submit the Green Goods work submission.',
    });

    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useSidepanelGreenGoods({
        activeCoop: makeActiveCoop(),
        activeMember: makeActiveMember(),
        setMessage,
        loadDashboard,
        loadAgentDashboard: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleSubmitGreenGoodsWorkSubmission({
        actionUid: 7,
        title: 'Planting row',
        feedback: 'Crew finished the contour line.',
        metadataCid: 'bafy-work',
        mediaCids: ['bafy-photo'],
      });
    });

    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
      type: 'submit-green-goods-work-submission',
      payload: {
        coopId: 'coop-1',
        memberId: 'member-1',
        submission: {
          actionUid: 7,
          title: 'Planting row',
          feedback: 'Crew finished the contour line.',
          metadataCid: 'bafy-work',
          mediaCids: ['bafy-photo'],
        },
      },
    });
    expect(setMessage).toHaveBeenCalledWith('Could not submit the Green Goods work submission.');
    expect(loadDashboard).not.toHaveBeenCalled();
  });
});
