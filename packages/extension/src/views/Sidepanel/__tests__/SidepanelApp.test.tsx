import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidepanelApp } from '../SidepanelApp';

const {
  loadAgentDashboardMock,
  loadDashboardMock,
  sendRuntimeMessageMock,
  setAgentDashboardMock,
  setMessageMock,
  setPairingResultMock,
  updateUiPreferencesMock,
} = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
  loadDashboardMock: vi.fn(async () => undefined),
  loadAgentDashboardMock: vi.fn(async () => undefined),
  setMessageMock: vi.fn(),
  setAgentDashboardMock: vi.fn(),
  setPairingResultMock: vi.fn(),
  updateUiPreferencesMock: vi.fn(async () => null),
}));

vi.mock('../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

vi.mock('../../../runtime/audio', () => ({
  playCoopSound: vi.fn(async () => undefined),
}));

vi.mock('../../../runtime/inference-bridge', () => ({
  InferenceBridge: class {
    subscribe = vi.fn(() => () => undefined);
    setOptIn = vi.fn();
    teardown = vi.fn();
  },
}));

vi.mock('../ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../CoopSwitcher', () => ({
  CoopSwitcher: ({ onSwitch }: { onSwitch: (coopId: string) => void | Promise<void> }) => (
    <button onClick={() => void onSwitch('coop-2')} type="button">
      Switch to Coop Two
    </button>
  ),
}));

vi.mock('../TabStrip', () => ({
  TabStrip: () => <div data-testid="tab-strip" />,
}));

vi.mock('../tabs', () => ({
  LooseChickensTab: () => <div>Loose Chickens</div>,
  RoostTab: () => <div>Roost</div>,
  NestTab: () => <div>Nest</div>,
  CoopFeedTab: () => <div>Coop Feed</div>,
  FlockMeetingTab: () => <div>Flock Meeting</div>,
  NestToolsTab: () => <div>Nest Tools</div>,
}));

vi.mock('../hooks/useCoopForm', () => ({
  useCoopForm: () => ({}),
}));

vi.mock('../hooks/useDraftEditor', () => ({
  useDraftEditor: () => ({}),
}));

vi.mock('../hooks/useSyncBindings', () => ({
  useSyncBindings: () => undefined,
}));

vi.mock('../hooks/useTabCapture', () => ({
  useTabCapture: () => ({}),
}));

vi.mock('../helpers', () => ({
  describeLocalHelperState: () => 'Ready',
  formatAgentCadence: () => '1h',
}));

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: () => ({
    dashboard: {
      coops: [
        {
          profile: {
            id: 'coop-1',
            name: 'Coop One',
          },
        },
        {
          profile: {
            id: 'coop-2',
            name: 'Coop Two',
          },
        },
      ],
      activeCoopId: 'coop-1',
      coopBadges: [],
      receiverPairings: [],
      summary: {
        iconState: 'idle',
        iconLabel: 'Coop',
        pendingDrafts: 0,
        syncState: 'idle',
        agentCadenceMinutes: 60,
        localEnhancement: 'ready',
        localInferenceOptIn: false,
      },
      uiPreferences: {
        localInferenceOptIn: false,
      },
      operator: {
        policyActionQueue: [],
      },
    },
    agentDashboard: {
      knowledgeSkills: [],
      manifests: [],
      skillRuns: [],
      memories: [],
    },
    setAgentDashboard: setAgentDashboardMock,
    actionPolicies: [],
    runtimeConfig: {
      privacyMode: 'off',
      sessionMode: 'passkey',
    },
    activeCoop: {
      profile: {
        id: 'coop-1',
        name: 'Coop One',
      },
      rituals: [],
      members: [],
      artifacts: [],
      archiveReceipts: [],
    },
    soundPreferences: {
      enabled: true,
    },
    authSession: null,
    activeMember: null,
    hasTrustedNodeAccess: false,
    visibleReceiverPairings: [],
    activeReceiverPairing: null,
    activeReceiverPairingStatus: null,
    activeReceiverProtocolLink: null,
    receiverIntake: [],
    visibleDrafts: [],
    meetingMode: 'solo',
    archiveStory: null,
    archiveReceipts: [],
    refreshableArchiveReceipts: [],
    browserUxCapabilities: {
      canSaveFile: false,
    },
    boardUrl: null,
    message: '',
    setMessage: setMessageMock,
    pairingResult: null,
    setPairingResult: setPairingResultMock,
    loadDashboard: loadDashboardMock,
    loadAgentDashboard: loadAgentDashboardMock,
    updateUiPreferences: updateUiPreferencesMock,
    configuredSignalingUrls: [],
    configuredReceiverAppUrl: 'https://receiver.test',
  }),
}));

describe('SidepanelApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRuntimeMessageMock.mockResolvedValue({ ok: true });
    loadDashboardMock.mockResolvedValue(undefined);
    loadAgentDashboardMock.mockResolvedValue(undefined);
    updateUiPreferencesMock.mockResolvedValue(null);
  });

  it('reloads both dashboards after switching coops', async () => {
    const user = userEvent.setup();

    render(<SidepanelApp />);

    await user.click(screen.getByRole('button', { name: 'Switch to Coop Two' }));

    await waitFor(() => {
      expect(sendRuntimeMessageMock).toHaveBeenCalledWith({
        type: 'set-active-coop',
        payload: { coopId: 'coop-2' },
      });
    });
    await waitFor(() => {
      expect(loadDashboardMock).toHaveBeenCalledTimes(1);
      expect(loadAgentDashboardMock).toHaveBeenCalledTimes(1);
    });
  });
});
