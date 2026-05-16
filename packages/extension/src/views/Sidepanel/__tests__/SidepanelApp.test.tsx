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
  dashboardUiModeMock,
  hasTrustedNodeAccessMock,
} = vi.hoisted(() => ({
  sendRuntimeMessageMock: vi.fn(),
  loadDashboardMock: vi.fn(async () => undefined),
  loadAgentDashboardMock: vi.fn(async () => undefined),
  setMessageMock: vi.fn(),
  setAgentDashboardMock: vi.fn(),
  setPairingResultMock: vi.fn(),
  updateUiPreferencesMock: vi.fn(async () => null),
  dashboardUiModeMock: { current: 'simple' as 'simple' | 'advanced' },
  hasTrustedNodeAccessMock: { current: false },
}));

vi.mock('../../../runtime/messages', () => ({
  sendRuntimeMessage: sendRuntimeMessageMock,
}));

vi.mock('../../../runtime/audio', () => ({
  playRandomChickenSound: vi.fn(async () => undefined),
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
    activeTab,
    onNavigate,
  }: {
    showNestTab: boolean;
    activeTab: string;
    onNavigate: (tab: string) => void;
    badges?: Record<string, number>;
  }) => {
    const tabs = showNestTab
      ? ['roost', 'chickens', 'coops', 'nest']
      : ['roost', 'chickens', 'coops'];
    return (
      <div
        data-testid="sidepanel-footer-nav"
        data-active-tab={activeTab}
        data-show-nest={showNestTab ? 'true' : 'false'}
      >
        {tabs.map((tab) => (
          <button key={tab} onClick={() => onNavigate(tab)} type="button">
            {tab}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock('../tabs/index', () => ({
  RoostTab: () => <div>Roost</div>,
  ChickensTab: ({ synthesisSegment }: { synthesisSegment: string }) => (
    <div>Chickens:{synthesisSegment}</div>
  ),
  CoopsTab: () => <div>Coops</div>,
  NestTab: ({ subTabRequest }: { subTabRequest?: { subTab: string } }) => (
    <div>Nest:{subTabRequest?.subTab ?? 'members'}</div>
  ),
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
        uiMode: dashboardUiModeMock.current,
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
      sessionMode: 'mock',
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
    hasTrustedNodeAccess: hasTrustedNodeAccessMock.current,
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
    dashboardUiModeMock.current = 'simple';
    hasTrustedNodeAccessMock.current = false;
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

  it('uses Chickens as the simple-mode workspace and hides footer navigation', async () => {
    render(<SidepanelApp />);

    await waitFor(() => expect(screen.getByText('Chickens:review')).toBeInTheDocument());
    expect(screen.queryByTestId('sidepanel-footer-nav')).not.toBeInTheDocument();
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

  it('keeps advanced mode on the existing roost-first workspace with footer nav', () => {
    dashboardUiModeMock.current = 'advanced';

    render(<SidepanelApp />);

    expect(screen.getByText('Roost')).toBeInTheDocument();
    const footerNav = screen.getByTestId('sidepanel-footer-nav');
    expect(footerNav).toHaveAttribute('data-show-nest', 'false');
    expect(footerNav).toHaveAttribute('data-active-tab', 'roost');
  });

  it('lets simple-mode users open review, shared, settings, and advanced view from More', async () => {
    const user = userEvent.setup();

    render(<SidepanelApp />);

    await waitFor(() => expect(screen.getByText('Chickens:review')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: /shared with coop/i }));
    expect(screen.getByText('Chickens:shared')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: /settings/i }));
    expect(screen.getByText('Nest:settings')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: /advanced view/i }));
    expect(updateUiPreferencesMock).toHaveBeenCalledWith({ uiMode: 'advanced' });
  });
});
