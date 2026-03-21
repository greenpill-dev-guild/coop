import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PopupApp } from '../PopupApp';

const { mockSendRuntimeMessage } = vi.hoisted(() => ({
  mockSendRuntimeMessage: vi.fn(),
}));

vi.mock('../../../runtime/messages', () => ({
  sendRuntimeMessage: mockSendRuntimeMessage,
}));

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    interpretationId: 'interp-1',
    extractId: 'extract-1',
    sourceCandidateId: 'candidate-1',
    title: 'River restoration lead',
    summary: 'A draft that needs review.',
    whyItMatters: 'Important context.',
    suggestedNextStep: 'Review and share.',
    category: 'opportunity',
    confidence: 0.62,
    rationale: 'Captured from a relevant tab.',
    tags: [],
    previewImageUrl: 'https://example.com/preview.png',
    sources: [
      {
        label: 'Example',
        url: 'https://example.com/article',
        domain: 'example.com',
      },
    ],
    createdAt: new Date('2026-03-17T12:00:00.000Z').toISOString(),
    createdBy: 'member-1',
    reviewStatus: 'draft',
    workflowStage: 'candidate',
    suggestedTargetCoopIds: ['coop-1'],
    provenance: {
      type: 'tab-candidate',
      candidateId: 'candidate-1',
    },
    archiveStatus: 'not-archived',
    archiveReceiptIds: [],
    ...overrides,
  };
}

function makeDashboard(overrides: Record<string, unknown> = {}) {
  return {
    coops: [
      {
        profile: {
          id: 'coop-1',
          name: 'Starter Coop',
          purpose: 'Coordinate local research',
          captureMode: 'manual',
        },
        members: [
          {
            id: 'member-1',
            displayName: 'Ava',
            address: '0x1234567890abcdef1234567890abcdef12345678',
          },
        ],
        artifacts: [
          {
            id: 'artifact-1',
            title: 'Shared watershed note',
            summary: 'A published artifact in the feed.',
          },
        ],
      },
    ],
    activeCoopId: 'coop-1',
    coopBadges: [
      {
        coopId: 'coop-1',
        coopName: 'Starter Coop',
        pendingDrafts: 0,
        routedTabs: 0,
        insightDrafts: 0,
        artifactCount: 1,
        pendingActions: 0,
        pendingAttentionCount: 0,
      },
    ],
    drafts: [],
    candidates: [],
    summary: {
      iconState: 'idle',
      iconLabel: 'Synced',
      pendingDrafts: 0,
      coopCount: 1,
      syncState: 'Peer-ready local-first sync',
      syncLabel: 'Healthy',
      syncDetail: 'Peer-ready local-first sync.',
      syncTone: 'ok',
      lastCaptureAt: new Date('2026-03-17T11:50:00.000Z').toISOString(),
      captureMode: 'manual',
      localEnhancement: 'Heuristics-first fallback',
      localInferenceOptIn: false,
      activeCoopId: 'coop-1',
    },
    soundPreferences: {
      enabled: false,
      reducedMotion: false,
      reducedSound: false,
    },
    uiPreferences: {
      notificationsEnabled: true,
      localInferenceOptIn: false,
      preferredExportMethod: 'download',
      heartbeatEnabled: true,
    },
    authSession: null,
    identities: [],
    receiverPairings: [],
    receiverIntake: [],
    runtimeConfig: {
      chainKey: 'sepolia',
      onchainMode: 'mock',
      archiveMode: 'mock',
      sessionMode: 'mock',
      providerMode: 'rpc',
      privacyMode: 'off',
      receiverAppUrl: 'http://localhost:3000',
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
      permits: [],
      permitLog: [],
      sessionCapabilities: [],
      sessionCapabilityLog: [],
    },
    ...overrides,
  };
}

describe('PopupApp', () => {
  beforeEach(() => {
    mockSendRuntimeMessage.mockReset();

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
          },
        },
        tabs: {
          query: vi.fn().mockResolvedValue([{ windowId: 7 }]),
          create: vi.fn().mockResolvedValue(undefined),
        },
        sidePanel: {
          open: vi.fn().mockResolvedValue(undefined),
        },
        runtime: {
          getURL: vi.fn((path: string) => `chrome-extension://${path}`),
        },
      },
    });
  });

  it('shows the no-coop setup state and routes into create flow', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return {
          ok: true,
          data: makeDashboard({
            coops: [],
            activeCoopId: undefined,
            coopBadges: [],
            summary: {
              ...makeDashboard().summary,
              coopCount: 0,
              iconLabel: 'No coop yet',
              activeCoopId: undefined,
            },
          }),
        };
      }
      return { ok: true };
    });

    const user = userEvent.setup();
    render(<PopupApp />);

    expect(await screen.findByText('Ready to round up your loose chickens?')).toBeInTheDocument();
    expect(
      screen.queryByText('Everything stays local and private until you share.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open workspace' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create a coop' }));

    expect(await screen.findByRole('heading', { name: 'Start your coop.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Coop name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste purpose' })).toBeInTheDocument();
    expect(screen.queryByText('Starter note (optional)')).not.toBeInTheDocument();
  });

  it('routes into the simplified join flow', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return {
          ok: true,
          data: makeDashboard({
            coops: [],
            activeCoopId: undefined,
            coopBadges: [],
            summary: {
              ...makeDashboard().summary,
              coopCount: 0,
              iconLabel: 'No coop yet',
              activeCoopId: undefined,
            },
          }),
        };
      }
      return { ok: true };
    });

    const user = userEvent.setup();
    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Join with code' }));

    expect(await screen.findByRole('heading', { name: 'Find your coop.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste invite code' })).toBeInTheDocument();
    expect(screen.queryByText('Starter note (optional)')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste your invite code.').tagName).toBe('INPUT');
  });

  it('uses round-up as the primary action when no drafts are waiting', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return {
          ok: true,
          data: makeDashboard(),
        };
      }
      if (message.type === 'get-sidepanel-state') {
        return {
          ok: true,
          data: { open: false, canClose: true },
        };
      }
      if (message.type === 'manual-capture') {
        return {
          ok: true,
          data: 2,
        };
      }
      return { ok: true };
    });

    const user = userEvent.setup();
    render(<PopupApp />);

    const roundUp = await screen.findByRole('button', { name: 'Round up now' });
    expect(screen.queryByRole('button', { name: 'Open feed' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Feed' })).toBeInTheDocument();
    await user.click(roundUp);

    await waitFor(() => {
      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({ type: 'manual-capture' });
    });
    expect(await screen.findByText(/Round-up complete\./i)).toBeInTheDocument();
  });

  it('switches the popup theme from settings', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return {
          ok: true,
          data: makeDashboard(),
        };
      }
      if (message.type === 'get-sidepanel-state') {
        return {
          ok: true,
          data: { open: false, canClose: true },
        };
      }
      return { ok: true };
    });

    const user = userEvent.setup();
    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: /Theme: System/i }));

    await waitFor(() => {
      expect(document.body.dataset.theme).toBe('dark');
    });
  });

  it('toggles the sidepanel explicitly from the popup header', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return {
          ok: true,
          data: makeDashboard(),
        };
      }
      if (message.type === 'get-sidepanel-state') {
        return {
          ok: true,
          data: { open: false, canClose: true },
        };
      }
      if (message.type === 'toggle-sidepanel') {
        return {
          ok: true,
          data: { open: true, canClose: true },
        };
      }
      return { ok: true };
    });

    const user = userEvent.setup();
    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Open sidepanel' }));

    await waitFor(() => {
      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'toggle-sidepanel',
        payload: { windowId: 7 },
      });
    });
    expect(await screen.findByRole('button', { name: 'Close sidepanel' })).toBeInTheDocument();
  });

  it('shows the coops hub in the footer even with one coop', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return {
          ok: true,
          data: makeDashboard(),
        };
      }
      if (message.type === 'get-sidepanel-state') {
        return {
          ok: true,
          data: { open: false, canClose: true },
        };
      }
      return { ok: true };
    });

    const user = userEvent.setup();
    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Coops' }));

    expect(await screen.findByRole('heading', { name: 'Coops' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create another coop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join another coop' })).toBeInTheDocument();
  });

  it('renders the home review queue and opens draft detail from it', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return {
          ok: true,
          data: makeDashboard({
            drafts: [makeDraft()],
            summary: {
              ...makeDashboard().summary,
              pendingDrafts: 1,
            },
          }),
        };
      }
      if (message.type === 'get-sidepanel-state') {
        return {
          ok: true,
          data: { open: false, canClose: true },
        };
      }
      return { ok: true };
    });

    const user = userEvent.setup();
    render(<PopupApp />);

    expect(await screen.findByText('River restoration lead')).toBeInTheDocument();
    expect(screen.getByText('A draft that needs review.')).toBeInTheDocument();
    expect(screen.getByText('Opportunity')).toBeInTheDocument();
    expect(screen.getAllByText('Starter Coop')).toHaveLength(2);

    await user.click(screen.getByText('River restoration lead'));

    expect(await screen.findByRole('heading', { name: 'Review draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open sidepanel for synthesis' })).toBeInTheDocument();
  });

  it('shows compact sync status with tooltip detail on focus', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return {
          ok: true,
          data: makeDashboard({
            summary: {
              ...makeDashboard().summary,
              syncState:
                'No signaling server connection. Shared sync is currently limited to this browser profile.',
              syncLabel: 'Local only',
              syncDetail:
                'No signaling server connection. Shared sync is currently limited to this browser profile.',
              syncTone: 'warning',
            },
          }),
        };
      }
      if (message.type === 'get-sidepanel-state') {
        return {
          ok: true,
          data: { open: false, canClose: true },
        };
      }
      return { ok: true };
    });

    render(<PopupApp />);

    const syncCard = (await screen.findByText('Sync')).parentElement as HTMLElement;
    expect(screen.getByText('Local only')).toBeInTheDocument();

    fireEvent.focus(syncCard);

    expect(
      await screen.findByText(
        'No signaling server connection. Shared sync is currently limited to this browser profile.',
      ),
    ).toBeInTheDocument();
  });
});
