import { render, screen, waitFor } from '@testing-library/react';
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
    tags: [],
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
        artifactCount: 1,
        pendingActions: 0,
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

    expect(await screen.findByText('Set up Coop')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create a coop' }));

    expect(await screen.findByRole('heading', { name: 'Create a coop' })).toBeInTheDocument();
    expect(screen.getByLabelText('Coop name')).toBeInTheDocument();
  });

  it('uses round-up as the primary action when no drafts are waiting', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return {
          ok: true,
          data: makeDashboard(),
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
    await user.click(roundUp);

    await waitFor(() => {
      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({ type: 'manual-capture' });
    });
    expect(await screen.findByText(/Round-up complete\./i)).toBeInTheDocument();
  });

  it('opens the workspace explicitly from the popup', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return {
          ok: true,
          data: makeDashboard(),
        };
      }
      return { ok: true };
    });

    const user = userEvent.setup();
    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Open workspace' }));

    await waitFor(() => {
      expect(globalThis.chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 7 });
    });
  });

  it('uses review as the primary action when drafts exist', async () => {
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
      return { ok: true };
    });

    const user = userEvent.setup();
    render(<PopupApp />);

    const reviewButtons = await screen.findAllByRole('button', { name: 'Review drafts' });
    await user.click(reviewButtons[0]);

    expect(await screen.findByText('River restoration lead')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
  });
});
