import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installDefaultRuntimeHandlers,
  makeArtifact,
  makeDashboard,
  makeDraft,
} from '../../__test-utils__/popup-harness';

const { mockSendRuntimeMessage, mockPlayCoopSound, mockPlayRandomChickenSound } = vi.hoisted(
  () => ({
    mockSendRuntimeMessage: vi.fn(),
    mockPlayCoopSound: vi.fn(),
    mockPlayRandomChickenSound: vi.fn(),
  }),
);

vi.mock('../../../runtime/audio', () => ({
  playCoopSound: mockPlayCoopSound,
  playRandomChickenSound: mockPlayRandomChickenSound,
}));

const { PopupApp } = await import('../PopupApp');

describe('PopupApp', () => {
  beforeEach(() => {
    mockSendRuntimeMessage.mockReset();
    mockPlayCoopSound.mockReset().mockResolvedValue(undefined);
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
          query: vi
            .fn()
            .mockResolvedValue([
              { id: 7, windowId: 7, url: 'https://example.com', title: 'Example' },
            ]),
          create: vi.fn().mockResolvedValue(undefined),
        },
        permissions: {
          contains: vi.fn().mockResolvedValue(true),
          request: vi.fn().mockResolvedValue(true),
        },
        sidePanel: {
          open: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        },
        runtime: {
          sendMessage: mockSendRuntimeMessage,
          getURL: vi.fn((path: string) => `chrome-extension://${path}`),
          onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
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

    expect(await screen.findByRole('status')).toHaveTextContent('Note hatched into your roost.');
    expect(screen.getByRole('button', { name: 'Audio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Files' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Social' })).not.toBeInTheDocument();
  });

  it('saves notes via the compact input and persists them', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    await screen.findByRole('button', { name: 'Roundup Chickens' });

    // Type into the note input
    const noteInput = screen.getByLabelText('Note');
    fireEvent.change(noteInput, { target: { value: 'Saved note' } });
    expect(noteInput).toHaveValue('Saved note');

    // Save via button
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Note hatched into your roost.');
  });

  it('renders the playful header mark without disturbing the popup flow', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Play coop sound' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('opens the profile drawer with coop management and segmented settings while omitting Local helper', async () => {
    installDefaultRuntimeHandlers(
      mockSendRuntimeMessage,
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
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: /^Change theme\./ }));

    await waitFor(() => {
      expect(document.body.dataset.theme).toBe('dark');
    });
  });

  it('toggles the sidepanel explicitly from the popup header', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
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
      mockSendRuntimeMessage,
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
    // biome-ignore lint/style/noNonNullAssertion: test assertion — footer tab always exists in rendered popup
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
      mockSendRuntimeMessage,
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
    // biome-ignore lint/style/noNonNullAssertion: test assertion — footer tab always exists in rendered popup
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
      mockSendRuntimeMessage,
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
      mockSendRuntimeMessage,
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
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    const screenshotButton = await screen.findByRole('button', { name: 'Screenshot' });
    expect(screenshotButton).toBeInTheDocument();

    await user.click(screenshotButton);

    await waitFor(() => {
      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'prepare-visible-screenshot',
      });
    });
  });

  it('keeps the popup on Home when active-tab capture returns zero new drafts', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return { ok: true, data: makeDashboard({ drafts: [] }) };
      }
      if (message.type === 'get-sidepanel-state') {
        return { ok: true, data: { open: false, canClose: true } };
      }
      if (message.type === 'capture-active-tab') {
        return { ok: true, data: 0 };
      }
      return { ok: true };
    });
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Capture Tab' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'This tab did not produce a new capture.',
    );
    expect(screen.getByRole('button', { name: 'Roundup Chickens' })).toBeInTheDocument();
    expect(screen.queryByText('River restoration lead')).not.toBeInTheDocument();
  });

  it('opens the capture review dialog for screenshots and saves edited context', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Screenshot' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const titleInput = screen.getByRole('textbox', { name: 'Title' });
    const contextInput = screen.getByRole('textbox', { name: 'Context' });

    await user.clear(titleInput);
    await user.type(titleInput, 'Field note screenshot');
    await user.type(contextInput, 'Needs follow-up in the next coop review.');
    await user.click(screen.getByRole('button', { name: 'Save to Pocket Coop' }));

    await waitFor(() => {
      expect(mockSendRuntimeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'save-popup-capture',
          payload: expect.objectContaining({
            kind: 'photo',
            title: 'Field note screenshot',
            note: expect.stringContaining('Needs follow-up in the next coop review.'),
          }),
        }),
      );
    });
  });

  it('lets the user cancel the capture review dialog without saving', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Screenshot' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      mockSendRuntimeMessage.mock.calls.some(
        ([message]) => (message as { type: string }).type === 'save-popup-capture',
      ),
    ).toBe(false);
  });

  it('shows inline microphone recovery when popup audio permission is denied', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      },
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: class {},
    });

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Audio' }));

    expect(await screen.findByText('Microphone access needed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('surfaces the unsupported-page screenshot message before calling runtime capture', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    chrome.tabs.query = vi.fn().mockResolvedValue([
      {
        id: 7,
        windowId: 7,
        url: 'chrome://extensions',
        title: 'Extensions',
      },
    ]);

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Screenshot' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Open a standard web page before taking a screenshot.',
    );
    expect(mockSendRuntimeMessage).not.toHaveBeenCalledWith({
      type: 'prepare-visible-screenshot',
    });
  });

  it('uses the shared fill-frame on Home, Chickens, and Feed', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    const homeSubheader = await screen.findByLabelText('Home status');
    expect(homeSubheader.closest('.popup-screen--fill')).not.toBeNull();
    expect(homeSubheader.closest('.popup-screen--home')).not.toBeNull();

    await user.click(await screen.findByRole('button', { name: 'Chickens' }));
    const chickensSubheader = await screen.findByLabelText('Filter chickens by coop');
    expect(chickensSubheader.closest('.popup-screen--fill')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /Feed/ }));
    const feedSubheader = await screen.findByLabelText('Filter feed by coop');
    expect(feedSubheader.closest('.popup-screen--fill')).not.toBeNull();
  });

  it('resets the popup scroll frame when switching screens', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    const { container } = render(<PopupApp />);
    const scrollPane = container.querySelector('.popup-scroll-pane');
    expect(scrollPane).not.toBeNull();

    await user.click(await screen.findByRole('button', { name: 'Chickens' }));
    if (!(scrollPane instanceof HTMLDivElement)) {
      throw new Error('Expected popup scroll pane to be an HTMLDivElement.');
    }

    scrollPane.scrollTop = 18;

    await user.click(screen.getByRole('button', { name: 'Home' }));

    await waitFor(() => {
      expect(scrollPane.scrollTop).toBe(0);
    });
  });

  it('shows the + button in the header and opens a create/join popover', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
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
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Open profile' }));

    expect(await screen.findByText('Your Coops')).toBeInTheDocument();
    expect(screen.getByText('Starter Coop')).toBeInTheDocument();
    expect(screen.getByText('No invite code yet')).toBeInTheDocument();
  });

  it('shows a Copy Invite button when the coop has invite codes', async () => {
    installDefaultRuntimeHandlers(
      mockSendRuntimeMessage,
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
      mockSendRuntimeMessage,
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
      mockSendRuntimeMessage,
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
