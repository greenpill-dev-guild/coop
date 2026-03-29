import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { playCoopSoundMock, sendRuntimeMessageMock } = vi.hoisted(() => ({
  playCoopSoundMock: vi.fn(async () => undefined),
  sendRuntimeMessageMock: vi.fn(),
}));

vi.mock('../../../../runtime/audio', () => ({
  playCoopSound: playCoopSoundMock,
}));

vi.mock('../../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

const { useSidepanelCoopManagement } = await import('../useSidepanelCoopManagement');

function makeDeps(overrides: Partial<Parameters<typeof useSidepanelCoopManagement>[0]> = {}) {
  return {
    activeCoop: {
      profile: {
        id: 'coop-1',
        name: 'River Coop',
      },
    } as never,
    activeMember: {
      id: 'member-1',
    } as never,
    dashboard: {
      uiPreferences: {
        localInferenceOptIn: false,
      },
    } as never,
    runtimeConfig: {} as never,
    soundPreferences: {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    } as never,
    setMessage: vi.fn(),
    setAgentDashboard: vi.fn(),
    loadDashboard: vi.fn(async () => undefined),
    loadAgentDashboard: vi.fn(async () => undefined),
    updateUiPreferences: vi.fn(async (patch) => ({
      localInferenceOptIn: patch.localInferenceOptIn,
    })),
    inferenceBridgeRef: {
      current: {
        setOptIn: vi.fn(),
      },
    },
    ...overrides,
  };
}

describe('useSidepanelCoopManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates coop profile, leaves coops, and switches the active coop', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useSidepanelCoopManagement(deps));

    await act(async () => {
      await result.current.updateCoopProfile({ name: 'New River Coop' });
      await result.current.handleLeaveCoop();
      await result.current.selectActiveCoop('coop-2');
    });

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'update-coop-profile',
      payload: { coopId: 'coop-1', name: 'New River Coop' },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'leave-coop',
      payload: { coopId: 'coop-1', memberId: 'member-1' },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(3, {
      type: 'set-active-coop',
      payload: { coopId: 'coop-2' },
    });
    expect(deps.setMessage).toHaveBeenCalledWith('Coop profile updated.');
    expect(deps.setMessage).toHaveBeenCalledWith('You left River Coop.');
    expect(deps.loadDashboard).toHaveBeenCalledTimes(3);
    expect(deps.loadAgentDashboard).toHaveBeenCalledTimes(1);
  });

  it('toggles local inference and clears sensitive local data', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useSidepanelCoopManagement(deps));

    await act(async () => {
      await result.current.toggleLocalInferenceOptIn();
      await result.current.clearSensitiveLocalData();
    });

    expect(deps.updateUiPreferences).toHaveBeenCalledWith({ localInferenceOptIn: true });
    expect(deps.inferenceBridgeRef.current?.setOptIn).toHaveBeenCalledWith(true);
    expect(deps.setMessage).toHaveBeenCalledWith('Local helper enabled.');
    expect(sendRuntimeMessageMock).toHaveBeenCalledWith({ type: 'clear-sensitive-local-data' });
    expect(deps.setAgentDashboard).toHaveBeenCalledWith(null);
    expect(deps.setMessage).toHaveBeenCalledWith(
      'Local encrypted capture history cleared from this browser.',
    );
    expect(deps.loadAgentDashboard).toHaveBeenCalledTimes(1);
  });

  it('updates anchor and sound settings and plays test sound', async () => {
    const deps = makeDeps();
    sendRuntimeMessageMock.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useSidepanelCoopManagement(deps));

    await act(async () => {
      await result.current.toggleAnchorMode(true);
      await result.current.updateSound({
        enabled: false,
        reducedMotion: true,
        reducedSound: true,
      });
      await result.current.testSound();
    });

    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'set-anchor-mode',
      payload: { enabled: true },
    });
    expect(sendRuntimeMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'set-sound-preferences',
      payload: {
        enabled: false,
        reducedMotion: true,
        reducedSound: true,
      },
    });
    expect(playCoopSoundMock).toHaveBeenCalledWith('sound-test', deps.soundPreferences);
    expect(deps.setMessage).toHaveBeenCalledWith('Trusted mode turned on for this browser.');
    expect(deps.setMessage).toHaveBeenCalledWith('Coop sound played.');
  });

  it('handles clipboard copy edge cases and success', async () => {
    const deps = makeDeps();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });

    const { result } = renderHook(() => useSidepanelCoopManagement(deps));

    await act(async () => {
      await result.current.copyText('Invite', '');
      await result.current.copyText('Invite', 'COOP-JOIN');
    });

    expect(deps.setMessage).toHaveBeenCalledWith('No invite is available yet.');
    expect(writeText).toHaveBeenCalledWith('COOP-JOIN');
    expect(deps.setMessage).toHaveBeenCalledWith('Invite copied.');
  });
});
