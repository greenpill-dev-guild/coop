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

vi.mock('../../shared/NotificationBanner', () => ({
  NotificationBanner: () => null,
}));

vi.mock('../ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../TabStrip', () => ({
  SidepanelFooterNav: ({
    showNestTab,
  }: {
    showNestTab: boolean;
    activeTab: string;
    onNavigate: (tab: string) => void;
    badges?: Record<string, number>;
  }) => <div data-testid="sidepanel-footer-nav" data-show-nest={showNestTab ? 'true' : 'false'} />,
}));

vi.mock('../tabs/index', () => ({
  RoostTab: () => <div>Roost</div>,
  ChickensTab: () => <div>Chickens</div>,
  CoopsTab: () => <div>Coops</div>,
  NestTab: () => <div>Nest</div>,
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
        iconState: 'ready',
        iconLabel: 'Coop',
        pendingDrafts: 0,
        syncState: 'idle',
        agentCadenceMinutes: 64,
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

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            get: vi.fn(() => new Promise<Record<string, unknown>>(() => undefined)),
            set: vi.fn().mockResolvedValue(undefined),
            onChanged: {
              addListener: vi.fn(),
              removeListener: vi.fn(),
            },
          },
        },
        runtime: {
          getURL: vi.fn((path: string) => `chrome-extension://${path}`),
          onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
        action: {
          openPopup: vi.fn(),
        },
      },
    });

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('does not show nest tab when hasTrustedNodeAccess is false', () => {
    render(<SidepanelApp />);

    const footerNav = screen.getByTestId('sidepanel-footer-nav');
    expect(footerNav).toHaveAttribute('data-show-nest', 'false');
  });

  it('renders the header with brand, pair, profile, theme, and close buttons', () => {
    render(<SidepanelApp />);

    expect(screen.getByAltText('Coop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pair a Device' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open popup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close sidepanel' })).toBeInTheDocument();
  });

  it('cycles theme when the theme button is clicked', async () => {
    const user = userEvent.setup();

    render(<SidepanelApp />);

    const themeButton = screen.getByRole('button', { name: /change theme/i });
    await user.click(themeButton);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      'coop:popup-theme': 'dark',
    });
  });

  it('closes the panel when the close button is clicked', async () => {
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(<SidepanelApp />);

    await user.click(screen.getByRole('button', { name: 'Close sidepanel' }));

    expect(closeSpy).toHaveBeenCalled();
    closeSpy.mockRestore();
  });

  it('defaults to the roost tab', () => {
    render(<SidepanelApp />);

    expect(screen.getByText('Roost')).toBeInTheDocument();
  });
});
