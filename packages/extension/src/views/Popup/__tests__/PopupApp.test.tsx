import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PopupApp } from '../PopupApp';

const { mockSendRuntimeMessage, mockPlayCoopSound, mockPlayRandomChickenSound } = vi.hoisted(
  () => ({
    mockSendRuntimeMessage: vi.fn(),
    mockPlayCoopSound: vi.fn(),
    mockPlayRandomChickenSound: vi.fn(),
  }),
);

vi.mock('../../../runtime/messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../runtime/messages')>()),
  sendRuntimeMessage: mockSendRuntimeMessage,
}));

vi.mock('../../../runtime/audio', () => ({
  playCoopSound: mockPlayCoopSound,
  playRandomChickenSound: mockPlayRandomChickenSound,
}));

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    interpretationId: 'interp-1',
    extractId: 'extract-1',
    sourceCandidateId: 'candidate-1',
    title: 'River restoration lead',
    summary: 'A rounded-up draft that still needs quick review.',
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

function makeArtifact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'artifact-1',
    originId: 'origin-1',
    targetCoopId: 'coop-1',
    title: 'Shared watershed note',
    summary: 'A published artifact in the feed.',
    sources: [
      {
        label: 'Example',
        url: 'https://example.com/article',
        domain: 'example.com',
      },
    ],
    tags: ['shared'],
    category: 'note',
    whyItMatters: 'It helps the coop stay aligned on the latest research.',
    suggestedNextStep: 'Open the note, skim the summary, and decide what to share next.',
    previewImageUrl: 'https://example.com/artifact.png',
    createdBy: 'member-1',
    createdAt: new Date('2026-03-17T11:45:00.000Z').toISOString(),
    reviewStatus: 'approved',
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
        artifacts: [makeArtifact()],
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
    tabRoutings: [],
    summary: {
      iconState: 'ready',
      iconLabel: 'Synced',
      pendingDrafts: 0,
      routedTabs: 0,
      insightDrafts: 0,
      pendingActions: 0,
      pendingAttentionCount: 0,
      coopCount: 1,
      syncState: 'Peer-ready local-first sync',
      syncLabel: 'Healthy',
      syncDetail: 'Peer-ready local-first sync.',
      syncTone: 'ok',
      lastCaptureAt: new Date('2026-03-17T11:50:00.000Z').toISOString(),
      captureMode: 'manual',
      agentCadenceMinutes: 64,
      localEnhancement: 'Heuristics-first fallback',
      localInferenceOptIn: false,
      activeCoopId: 'coop-1',
    },
    soundPreferences: {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    },
    uiPreferences: {
      notificationsEnabled: true,
      localInferenceOptIn: false,
      preferredExportMethod: 'download',
      heartbeatEnabled: true,
      agentCadenceMinutes: 64,
    },
    authSession: {
      primaryAddress: '0x1234567890abcdef1234567890abcdef12345678',
    },
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
    mockPlayCoopSound.mockReset();
    mockPlayRandomChickenSound.mockReset();

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

    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue('Fresh note from clipboard'),
      },
    });

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
            onChanged: {
              addListener: vi.fn(),
              removeListener: vi.fn(),
            },
          },
        },
        tabs: {
          query: vi.fn().mockResolvedValue([{ windowId: 7 }]),
          create: vi.fn().mockResolvedValue(undefined),
        },
        sidePanel: {
          open: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        },
        runtime: {
          getURL: vi.fn((path: string) => `chrome-extension://${path}`),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function installDefaultRuntimeHandlers(dashboard = makeDashboard()) {
    let currentDashboard = dashboard;

    mockSendRuntimeMessage.mockImplementation(
      async (message: { type: string; payload?: unknown }) => {
        if (message.type === 'get-dashboard') {
          return { ok: true, data: currentDashboard };
        }
        if (message.type === 'get-sidepanel-state') {
          return { ok: true, data: { open: false, canClose: true } };
        }
        if (message.type === 'manual-capture') {
          return { ok: true, data: 2 };
        }
        if (message.type === 'capture-active-tab') {
          return { ok: true, data: 1 };
        }
        if (message.type === 'toggle-sidepanel') {
          return { ok: true, data: { open: true, canClose: true } };
        }
        if (message.type === 'set-active-coop') {
          currentDashboard = {
            ...currentDashboard,
            activeCoopId: (message.payload as { coopId: string }).coopId,
          };
          return { ok: true };
        }
        if (message.type === 'set-ui-preferences') {
          currentDashboard = {
            ...currentDashboard,
            uiPreferences: {
              ...currentDashboard.uiPreferences,
              ...(message.payload as object),
            },
          };
          return { ok: true, data: currentDashboard.uiPreferences };
        }
        if (message.type === 'set-sound-preferences') {
          currentDashboard = {
            ...currentDashboard,
            soundPreferences: {
              ...currentDashboard.soundPreferences,
              ...(message.payload as object),
            },
          };
          return { ok: true, data: undefined };
        }
        return { ok: true };
      },
    );
  }

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
    expect(screen.queryByRole('button', { name: 'Open sidepanel' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create a Coop' }));

    expect(await screen.findByRole('heading', { name: 'Start your coop.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Coop name')).toBeInTheDocument();
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

    await user.click(await screen.findByRole('button', { name: 'Join with Code' }));

    expect(await screen.findByRole('heading', { name: 'Find your coop.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste invite code' })).toBeInTheDocument();
  });

  it('shows the aggregate Home layout with capture actions, notes, handoffs, and new footer tabs', async () => {
    installDefaultRuntimeHandlers();
    const user = userEvent.setup();

    render(<PopupApp />);

    expect(await screen.findByRole('button', { name: 'Roundup Chickens' })).toBeInTheDocument();
    expect(screen.queryByText('Review queue')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Capture Tab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chickens' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Feed/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Coops' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Fresh note' } });
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Note saved locally.');
    expect(screen.getByRole('button', { name: 'Audio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Files' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Social' })).not.toBeInTheDocument();
  });

  it('saves notes via the compact input and persists them', async () => {
    installDefaultRuntimeHandlers();
    const user = userEvent.setup();

    render(<PopupApp />);

    await screen.findByRole('button', { name: 'Roundup Chickens' });

    // Type into the note input
    const noteInput = screen.getByLabelText('Note');
    fireEvent.change(noteInput, { target: { value: 'Saved note' } });
    expect(noteInput).toHaveValue('Saved note');

    // Save via button
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Note saved locally.');
  });

  it('triggers the random chicken sound from the header mark', async () => {
    installDefaultRuntimeHandlers();
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Play coop sound' }));

    expect(mockPlayRandomChickenSound).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('opens the profile drawer with coop management and segmented settings while omitting Local helper', async () => {
    installDefaultRuntimeHandlers(
      makeDashboard({
        coops: [
          makeDashboard().coops[0],
          {
            profile: {
              id: 'coop-2',
              name: 'Delta Field Coop',
              purpose: 'Track field notes',
              captureMode: 'manual',
            },
            members: [
              {
                id: 'member-1',
                displayName: 'Ava',
                address: '0x1234567890abcdef1234567890abcdef12345678',
              },
            ],
            artifacts: [],
          },
        ],
      }),
    );
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Open profile' }));

    expect(await screen.findByText('Your Coops')).toBeInTheDocument();
    expect(screen.getAllByText('Starter Coop').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delta Field Coop').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'On' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument();
    expect(screen.queryByText('Local helper')).not.toBeInTheDocument();
  });

  it('switches the popup theme from the header toggle', async () => {
    installDefaultRuntimeHandlers();
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: /^Change theme\./ }));

    await waitFor(() => {
      expect(document.body.dataset.theme).toBe('dark');
    });
  });

  it('toggles the sidepanel explicitly from the popup header', async () => {
    installDefaultRuntimeHandlers();
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Open sidepanel' }));

    await waitFor(() => {
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 7 });
    });
    expect(await screen.findByRole('button', { name: 'Close sidepanel' })).toBeInTheDocument();
  });

  it('falls back to the direct sidepanel API when the runtime bridge is stale', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return { ok: true, data: makeDashboard() };
      }
      if (message.type === 'get-sidepanel-state' || message.type === 'toggle-sidepanel') {
        return { ok: false, error: `Unknown message type: ${message.type}` };
      }
      return { ok: true };
    });

    const user = userEvent.setup();
    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Open sidepanel' }));

    await waitFor(() => {
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 7 });
    });
    expect(screen.queryByText(/Unknown message type/i)).not.toBeInTheDocument();
  });

  it('aggregates chickens across coops and narrows them with the coop filter', async () => {
    installDefaultRuntimeHandlers(
      makeDashboard({
        coops: [
          makeDashboard().coops[0],
          {
            profile: {
              id: 'coop-2',
              name: 'Delta Field Coop',
              purpose: 'Track field notes',
              captureMode: 'manual',
            },
            members: [
              {
                id: 'member-1',
                displayName: 'Ava',
                address: '0x1234567890abcdef1234567890abcdef12345678',
              },
            ],
            artifacts: [],
          },
        ],
        drafts: [
          makeDraft(),
          makeDraft({
            id: 'draft-2',
            title: 'Wetland policy summary',
            suggestedTargetCoopIds: ['coop-2'],
          }),
        ],
      }),
    );
    const user = userEvent.setup();

    render(<PopupApp />);

    // Wait for home screen to load, then navigate to Chickens tab via footer nav
    await screen.findByRole('button', { name: 'Roundup Chickens' });
    const chickensTabButtons = screen.getAllByRole('button', { name: /Chickens/i });
    const chickensFooterTab = chickensTabButtons.find((btn) =>
      btn.classList.contains('popup-footer-nav__button'),
    )!;
    await user.click(chickensFooterTab);

    expect(await screen.findByText('River restoration lead')).toBeInTheDocument();
    expect(screen.getByText('Wetland policy summary')).toBeInTheDocument();
    expect(screen.getAllByText('Starter Coop').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delta Field Coop').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Delta Field Coop' }));

    expect(screen.queryByText('River restoration lead')).not.toBeInTheDocument();
    expect(screen.getByText('Wetland policy summary')).toBeInTheDocument();
  });

  it('switches the sidepanel context to the selected draft coop before opening full view', async () => {
    installDefaultRuntimeHandlers(
      makeDashboard({
        coops: [
          makeDashboard().coops[0],
          {
            profile: {
              id: 'coop-2',
              name: 'Delta Field Coop',
              purpose: 'Track field notes',
              captureMode: 'manual',
            },
            members: [
              {
                id: 'member-1',
                displayName: 'Ava',
                address: '0x1234567890abcdef1234567890abcdef12345678',
              },
            ],
            artifacts: [],
          },
        ],
        drafts: [
          makeDraft(),
          makeDraft({
            id: 'draft-2',
            title: 'Wetland policy summary',
            suggestedTargetCoopIds: ['coop-2'],
          }),
        ],
      }),
    );
    const user = userEvent.setup();

    render(<PopupApp />);

    // Wait for home screen to load, then navigate to Chickens tab via footer nav
    await screen.findByRole('button', { name: 'Roundup Chickens' });
    const chickensTabButtons = screen.getAllByRole('button', { name: /Chickens/i });
    const chickensFooterTab = chickensTabButtons.find((btn) =>
      btn.classList.contains('popup-footer-nav__button'),
    )!;
    await user.click(chickensFooterTab);
    await user.click(await screen.findByRole('button', { name: 'Delta Field Coop' }));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.click(await screen.findByRole('button', { name: 'Open sidepanel' }));

    await waitFor(() => {
      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'set-active-coop',
        payload: { coopId: 'coop-2' },
      });
    });
  });

  it('aggregates feed artifacts across coops, filters them, and opens the minimal modal', async () => {
    installDefaultRuntimeHandlers(
      makeDashboard({
        coops: [
          {
            ...makeDashboard().coops[0],
            artifacts: [makeArtifact()],
          },
          {
            profile: {
              id: 'coop-2',
              name: 'Delta Field Coop',
              purpose: 'Track field notes',
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
              makeArtifact({
                id: 'artifact-2',
                targetCoopId: 'coop-2',
                title: 'Floodplain funding update',
                summary: 'Shared from the second coop.',
              }),
            ],
          },
        ],
      }),
    );
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: /Feed/ }));

    expect(await screen.findByText('Shared watershed note')).toBeInTheDocument();
    expect(screen.getByText('Floodplain funding update')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delta Field Coop' }));
    expect(screen.queryByText('Shared watershed note')).not.toBeInTheDocument();
    expect(screen.getByText('Floodplain funding update')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Floodplain funding update/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Full view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close details' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Full view' }));
    await waitFor(() => {
      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'set-active-coop',
        payload: { coopId: 'coop-2' },
      });
    });
    expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 7 });
  });

  it('shows checking while sync summary is unavailable, local for degraded sync, and error for dashboard failures', async () => {
    mockSendRuntimeMessage.mockImplementationOnce(async () => ({
      ok: true,
      data: makeDashboard({ summary: undefined }),
    }));
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-sidepanel-state') {
        return { ok: true, data: { open: false, canClose: true } };
      }
      return { ok: true };
    });

    let view = render(<PopupApp />);
    expect(await screen.findByText('Checking')).toBeInTheDocument();

    mockSendRuntimeMessage.mockReset();
    installDefaultRuntimeHandlers(
      makeDashboard({
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
    );
    view.unmount();
    view = render(<PopupApp />);
    expect(await screen.findByText('Local')).toBeInTheDocument();

    mockSendRuntimeMessage.mockReset();
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return { ok: false, error: 'Failed to reach the local dashboard.' };
      }
      return { ok: true };
    });
    view.unmount();
    render(<PopupApp />);
    const blockingDialog = await screen.findByRole('alertdialog');
    expect(blockingDialog).toBeInTheDocument();
    expect(screen.getByText('Failed to reach the local dashboard.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus();
    expect(document.querySelector('.popup-surface')).toHaveAttribute('inert');
  });

  it('shows the screenshot button on the home screen and wires capture action', async () => {
    installDefaultRuntimeHandlers();
    const user = userEvent.setup();

    render(<PopupApp />);

    const screenshotButton = await screen.findByRole('button', { name: 'Screenshot' });
    expect(screenshotButton).toBeInTheDocument();

    await user.click(screenshotButton);

    await waitFor(() => {
      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'capture-visible-screenshot',
      });
    });
  });

  it('shows the + button in the header and opens a create/join popover', async () => {
    installDefaultRuntimeHandlers();
    const user = userEvent.setup();

    render(<PopupApp />);

    const plusButton = await screen.findByRole('button', { name: 'Create or join' });
    expect(plusButton).toBeInTheDocument();

    await user.click(plusButton);

    expect(await screen.findByRole('menuitem', { name: 'Create Coop' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Join Coop' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Create Coop' }));

    expect(await screen.findByRole('heading', { name: 'Start your coop.' })).toBeInTheDocument();
  });

  it('shows invite codes per coop in the profile panel with copy support', async () => {
    installDefaultRuntimeHandlers();
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Open profile' }));

    expect(await screen.findByText('Your Coops')).toBeInTheDocument();
    expect(screen.getByText('Starter Coop')).toBeInTheDocument();
    expect(screen.getByText('No invite code yet')).toBeInTheDocument();
  });

  it('shows a Copy Invite button when the coop has invite codes', async () => {
    installDefaultRuntimeHandlers(
      makeDashboard({
        coops: [
          {
            ...makeDashboard().coops[0],
            invites: [
              {
                id: 'invite-1',
                type: 'member',
                code: 'COOP-JOIN-ABC123',
                expiresAt: new Date(Date.now() + 86400000).toISOString(),
                createdAt: new Date().toISOString(),
                createdBy: 'member-1',
                usedByMemberIds: [],
                bootstrap: {
                  coopName: 'Starter Coop',
                  coopId: 'coop-1',
                  syncRoom: { roomId: 'room-1', signalingUrls: [] },
                },
              },
            ],
          },
        ],
      }),
    );
    const user = userEvent.setup();

    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue(''),
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Open profile' }));

    expect(await screen.findByText('Your Coops')).toBeInTheDocument();
    expect(screen.queryByText('No invite code yet')).not.toBeInTheDocument();

    const copyButton = screen.getByRole('button', { name: 'Copy Invite' });
    await user.click(copyButton);

    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith('COOP-JOIN-ABC123');
  });

  it('shows the illustrated feed empty state when no artifacts are shared', async () => {
    installDefaultRuntimeHandlers(
      makeDashboard({
        coops: [
          {
            ...makeDashboard().coops[0],
            artifacts: [],
          },
        ],
      }),
    );
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: /Feed/ }));

    // Should show the warm illustrated empty state, not the old plain text
    expect(await screen.findByText('Nothing shared in the coop yet')).toBeInTheDocument();
    expect(
      screen.getByText('When someone shares a chicken, it will show up here.'),
    ).toBeInTheDocument();

    // Should NOT have an action button (feed items come from the coop, not user action)
    expect(screen.queryByRole('button', { name: /Roundup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share/i })).not.toBeInTheDocument();
  });

  it('shows a feed badge count on the footer nav', async () => {
    installDefaultRuntimeHandlers(
      makeDashboard({
        coops: [
          {
            ...makeDashboard().coops[0],
            artifacts: [
              makeArtifact(),
              makeArtifact({ id: 'artifact-2', title: 'Second artifact' }),
            ],
          },
        ],
      }),
    );

    render(<PopupApp />);

    await screen.findByRole('button', { name: 'Roundup Chickens' });

    const feedButton = screen.getByRole('button', { name: /Feed/ });
    expect(feedButton.querySelector('.popup-footer-nav__badge')).toBeInTheDocument();
  });
});
