import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub chrome.runtime before importing the hook.
const sendMessageMock = vi.fn();
const addListenerMock = vi.fn();
const removeListenerMock = vi.fn();

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      sendMessage: sendMessageMock,
      onMessage: {
        addListener: addListenerMock,
        removeListener: removeListenerMock,
      },
    },
  },
});

// Mock the runtime modules so the hook can be imported without full extension context.
vi.mock('../../../../runtime/config', () => ({
  resolveConfiguredChain: () => 'sepolia',
  resolveConfiguredArchiveMode: () => 'mock',
  resolveConfiguredOnchainMode: () => 'mock',
  resolveConfiguredSessionMode: () => 'passkey',
  resolveReceiverAppUrl: () => 'https://app.test',
  parseConfiguredSignalingUrls: () => [],
}));

vi.mock('../../../../runtime/receiver', () => ({
  filterPrivateReceiverIntake: () => [],
  filterVisibleReceiverPairings: () => [],
  filterVisibleReviewDrafts: () => [],
  isReceiverPairingVisibleForMemberContext: () => false,
  resolveReceiverPairingMember: () => null,
}));

vi.mock('../../../../runtime/messages', async () => {
  return {
    sendRuntimeMessage: sendMessageMock,
  };
});

// Must import after mocks are set up.
const { useDashboard } = await import('../useDashboard');

function makeDashboardResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    data: {
      coops: [],
      drafts: [],
      candidates: [],
      summary: {
        iconState: 'idle',
        iconLabel: 'Coop',
        pendingDrafts: 0,
        coopCount: 0,
        syncState: 'idle',
        captureMode: 'manual',
        localEnhancement: 'none',
        localInferenceOptIn: false,
      },
      soundPreferences: {
        enabled: true,
        volume: 0.5,
        roosterCallEnabled: true,
        softCluckEnabled: true,
      },
      uiPreferences: {
        notificationsEnabled: true,
        localInferenceOptIn: false,
      },
      authSession: null,
      identities: [],
      receiverPairings: [],
      receiverIntake: [],
      runtimeConfig: {
        chainKey: 'sepolia',
        onchainMode: 'mock',
        archiveMode: 'mock',
        sessionMode: 'passkey',
        receiverAppUrl: 'https://app.test',
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
        grants: [],
        grantLog: [],
        sessionCapabilities: [],
        sessionCapabilityLog: [],
      },
      ...overrides,
    },
  };
}

function makeAgentDashboardResponse() {
  return {
    ok: true,
    data: {
      observations: [],
      plans: [],
      skillRuns: [],
      manifests: [],
      autoRunSkillIds: [],
    },
  };
}

function makePoliciesResponse() {
  return { ok: true, data: [] };
}

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMessageMock.mockImplementation((msg: { type: string }) => {
      switch (msg.type) {
        case 'get-dashboard':
          return Promise.resolve(makeDashboardResponse());
        case 'get-agent-dashboard':
          return Promise.resolve(makeAgentDashboardResponse());
        case 'get-action-policies':
          return Promise.resolve(makePoliciesResponse());
        default:
          return Promise.resolve({ ok: false, error: 'Unknown' });
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the dashboard on mount', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.dashboard).not.toBeNull();
    });

    expect(sendMessageMock).toHaveBeenCalledWith({ type: 'get-dashboard' });
    expect(sendMessageMock).toHaveBeenCalledWith({ type: 'get-agent-dashboard' });
  });

  it('registers a chrome.runtime.onMessage listener on mount', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.dashboard).not.toBeNull();
    });

    expect(addListenerMock).toHaveBeenCalledTimes(1);
    expect(addListenerMock).toHaveBeenCalledWith(expect.any(Function));
  });

  it('removes the listener on unmount', async () => {
    const { result, unmount } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.dashboard).not.toBeNull();
    });

    const registeredListener = addListenerMock.mock.calls[0][0];
    unmount();

    expect(removeListenerMock).toHaveBeenCalledWith(registeredListener);
  });

  it('refreshes dashboard when receiving DASHBOARD_UPDATED message', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.dashboard).not.toBeNull();
    });

    // Clear mock call counts after initial load.
    sendMessageMock.mockClear();

    // Simulate the background sending a DASHBOARD_UPDATED message.
    const listener = addListenerMock.mock.calls[0][0];
    act(() => {
      listener({ type: 'DASHBOARD_UPDATED' });
    });

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({ type: 'get-dashboard' });
      expect(sendMessageMock).toHaveBeenCalledWith({ type: 'get-agent-dashboard' });
    });
  });

  it('ignores unrelated messages', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.dashboard).not.toBeNull();
    });

    sendMessageMock.mockClear();

    const listener = addListenerMock.mock.calls[0][0];
    act(() => {
      listener({ type: 'SOME_OTHER_MESSAGE' });
    });

    // Give it a tick to ensure no calls fire.
    await new Promise((r) => setTimeout(r, 50));

    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('does NOT set up a setInterval for polling', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.dashboard).not.toBeNull();
    });

    // Verify no setInterval was set up (the old polling approach).
    const dashboardPollingCalls = setIntervalSpy.mock.calls.filter(
      ([, interval]) => interval === 3500,
    );
    expect(dashboardPollingCalls).toHaveLength(0);

    setIntervalSpy.mockRestore();
  });

  it('exposes loadDashboard for manual refresh', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.dashboard).not.toBeNull();
    });

    sendMessageMock.mockClear();

    await act(async () => {
      await result.current.loadDashboard();
    });

    expect(sendMessageMock).toHaveBeenCalledWith({ type: 'get-dashboard' });
  });
});
