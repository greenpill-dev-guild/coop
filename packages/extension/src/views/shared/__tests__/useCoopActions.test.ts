import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createPasskeySessionMock, playCoopSoundMock, sendRuntimeMessageMock, sessionToMemberMock } =
  vi.hoisted(() => ({
    createPasskeySessionMock: vi.fn(),
    playCoopSoundMock: vi.fn(async () => undefined),
    sendRuntimeMessageMock: vi.fn(),
    sessionToMemberMock: vi.fn(),
  }));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    createPasskeySession: createPasskeySessionMock,
    sessionToMember: sessionToMemberMock,
  };
});

vi.mock('../../../runtime/audio', () => ({
  playCoopSound: playCoopSoundMock,
}));

vi.mock('../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useCoopActions } = await import('../useCoopActions');

describe('useCoopActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPasskeySessionMock.mockResolvedValue({
      displayName: 'Ari',
      primaryAddress: '0xabc',
      passkey: { id: 'cred-1', rpId: 'coop.local' },
    });
    sessionToMemberMock.mockReturnValue({ id: 'member-1' });
  });

  it('creates a coop after establishing a passkey session and onchain state', async () => {
    const loadDashboard = vi.fn(async () => undefined);
    sendRuntimeMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: { passkey: { id: 'cred-1', rpId: 'coop.local' } },
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, data: { chainKey: 'sepolia' } })
      .mockResolvedValueOnce({ ok: true, soundEvent: 'coop-created', data: { id: 'coop-1' } });

    const { result } = renderHook(() =>
      useCoopActions({
        setMessage: vi.fn(),
        loadDashboard,
        soundPreferences: {
          enabled: true,
          reducedMotion: false,
          reducedSound: false,
        },
        configuredSignalingUrls: ['wss://api.coop.town'],
      }),
    );

    const created = await act(async () =>
      result.current.createCoop({
        coopName: 'River Coop',
        creatorName: 'Ari',
        purpose: 'Coordinate field work',
        starterNote: '',
        spaceType: 'community',
        captureMode: 'manual',
      } as never),
    );

    expect(created).toEqual({ id: 'coop-1' });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(3, {
      type: 'resolve-onchain-state',
      payload: { coopSeed: expect.stringContaining('River Coop:Ari:0xabc') },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        type: 'create-coop',
        payload: expect.objectContaining({
          coopName: 'River Coop',
          seedContribution:
            'I want River Coop to keep useful context, loose research, and next steps visible.',
        }),
      }),
    );
    expect(playCoopSoundMock).toHaveBeenCalledWith('coop-created', {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    });
    expect(loadDashboard).toHaveBeenCalledTimes(2);
  });

  it('joins and switches coops while surfacing failures', async () => {
    const setMessage = vi.fn();
    const loadDashboard = vi.fn(async () => undefined);
    sendRuntimeMessageMock
      .mockResolvedValueOnce({
        ok: true,
        data: { passkey: { id: 'cred-1', rpId: 'coop.local' } },
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, data: { id: 'coop-1' } })
      .mockResolvedValueOnce({ ok: false, error: 'switch failed' });

    const { result } = renderHook(() =>
      useCoopActions({
        setMessage,
        loadDashboard,
        soundPreferences: {
          enabled: true,
          reducedMotion: false,
          reducedSound: false,
        },
        configuredSignalingUrls: ['wss://api.coop.town'],
      }),
    );

    await act(async () => {
      await result.current.joinCoop({
        inviteCode: 'COOP-JOIN',
        displayName: 'Ari',
        starterNote: '',
      } as never);
    });

    const switched = await act(async () => result.current.switchCoop('coop-2'));

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: 'join-coop',
        payload: expect.objectContaining({
          inviteCode: 'COOP-JOIN',
          seedContribution: "I want to help keep this coop's work visible and actionable.",
        }),
      }),
    );
    expect(setMessage).toHaveBeenCalledWith('Joined coop.');
    expect(switched).toBe(false);
    expect(setMessage).toHaveBeenCalledWith('switch failed');
  });
});
