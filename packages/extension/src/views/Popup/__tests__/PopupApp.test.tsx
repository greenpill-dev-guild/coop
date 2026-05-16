import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCoopState } from '../../../__tests__/fixtures';
import {
  installDefaultRuntimeHandlers,
  makeArtifact,
  makeDashboard,
  makeDraft,
} from '../../__test-utils__/popup-harness';
import { passkeyTrustLabel, purposeCreateHelperText } from '../../shared/coop-copy';

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

function makePopupCoop(overrides: Parameters<typeof makeCoopState>[0] = {}) {
  return makeCoopState({
    profile: {
      id: 'coop-2',
      name: 'Delta Field Coop',
      purpose: 'Track field notes',
    },
    members: [
      {
        ...makeCoopState().members[0],
        id: 'member-1',
        displayName: 'Ava',
        address: '0x1234567890abcdef1234567890abcdef12345678',
      },
    ],
    artifacts: [],
    invites: [],
    ...overrides,
  });
}

function mockClipboardReadText(value: string | ReturnType<typeof vi.fn>) {
  const readText = typeof value === 'string' ? vi.fn().mockResolvedValue(value) : value;
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      readText,
    },
  });
  return readText;
}

describe('PopupApp', () => {
  beforeEach(() => {
    mockSendRuntimeMessage.mockReset();
    mockPlayCoopSound.mockReset().mockResolvedValue(undefined);
    mockPlayRandomChickenSound.mockReset();
    window.localStorage.clear();
    sessionStorage.clear();

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

    mockClipboardReadText('Fresh note from clipboard');

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
    expect(screen.queryByRole('navigation', { name: 'Popup navigation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open sidepanel' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create a Coop' }));

    expect(await screen.findByRole('heading', { name: 'Start your coop.' })).toBeInTheDocument();
    expect(screen.getByText(passkeyTrustLabel)).toBeInTheDocument();
    expect(screen.getByLabelText('Coop name')).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /purpose/i })).toBeInTheDocument();
    expect(screen.getByText(purposeCreateHelperText)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /enable green goods/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Popup navigation' })).not.toBeInTheDocument();
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
    expect(screen.getByText(passkeyTrustLabel)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste invite code' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Popup navigation' })).not.toBeInTheDocument();
  });

  it('shows the aggregate Home layout with capture actions, notes, handoffs, and new footer tabs', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    const homeStatus = await screen.findByLabelText('Home status');
    expect(within(homeStatus).getByRole('button', { name: 'Status: Idle' })).toBeInTheDocument();
    expect(within(homeStatus).getByRole('button', { name: 'Review: 0' })).toBeInTheDocument();
    expect(screen.queryByText('Status at a glance')).not.toBeInTheDocument();
    expect(screen.queryByText('Why these states?')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Roundup Chickens' })).toBeInTheDocument();
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

  it('appends pasted clipboard text into the home note field', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();
    mockClipboardReadText('Fresh note from clipboard');

    render(<PopupApp />);

    const noteInput = await screen.findByLabelText('Note');
    fireEvent.change(noteInput, { target: { value: 'Existing note' } });

    await user.click(screen.getByRole('button', { name: 'Paste' }));

    await waitFor(() => {
      expect(noteInput).toHaveValue('Existing note\nFresh note from clipboard');
    });
  });

  it('surfaces the clipboard fallback hint when explicit paste is unavailable', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockRejectedValue(new Error('Clipboard blocked')),
      },
    });

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Paste' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Clipboard access unavailable. Use Cmd/Ctrl+V to paste.',
    );
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

  it('appends pasted clipboard text into the create-coop purpose field', async () => {
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
    mockClipboardReadText('Fresh note from clipboard');
    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Create a Coop' }));

    const purposeField = screen.getByRole('textbox', { name: /purpose/i });
    fireEvent.change(purposeField, { target: { value: 'Existing purpose' } });

    await user.click(screen.getByRole('button', { name: 'Paste purpose' }));

    await waitFor(() => {
      expect(purposeField).toHaveValue('Existing purpose\nFresh note from clipboard');
    });
  });

  it('keeps only the latest pasted invite code in the join flow', async () => {
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
    const readText = vi
      .fn()
      .mockResolvedValueOnce('FIRST-CODE')
      .mockResolvedValueOnce('SECOND-CODE');
    mockClipboardReadText(readText);
    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Join with Code' }));

    const inviteField = screen.getByRole('textbox', { name: /invite code/i });

    await user.click(screen.getByRole('button', { name: 'Paste invite code' }));
    await waitFor(() => {
      expect(inviteField).toHaveValue('FIRST-CODE');
    });

    await user.click(screen.getByRole('button', { name: 'Paste invite code' }));
    await waitFor(() => {
      expect(inviteField).toHaveValue('SECOND-CODE');
    });
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
        coops: [makeDashboard().coops[0], makePopupCoop()],
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

    await user.click(
      await screen.findByRole('button', { name: 'Open sidepanel' }, { timeout: 10_000 }),
    );

    await waitFor(() => {
      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 7 });
      expect(screen.getByRole('button', { name: 'Close sidepanel' })).toBeInTheDocument();
    });
  }, 30_000);

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
        coops: [makeDashboard().coops[0], makePopupCoop()],
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
        coops: [makeDashboard().coops[0], makePopupCoop()],
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
          makePopupCoop({
            artifacts: [
              makeArtifact({
                id: 'artifact-2',
                targetCoopId: 'coop-2',
                title: 'Floodplain funding update',
                summary: 'Shared from the second coop.',
              }),
            ],
          }),
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
    expect(
      await within(await screen.findByLabelText('Home status')).findByRole('button', {
        name: 'Status: Idle',
      }),
    ).toBeInTheDocument();

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
    expect(
      await within(await screen.findByLabelText('Home status')).findByRole('button', {
        name: 'Status: Local',
      }),
    ).toBeInTheDocument();

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

  it('keeps the popup on Home and invites recapture when active-tab capture was just run', async () => {
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return { ok: true, data: makeDashboard({ drafts: [] }) };
      }
      if (message.type === 'get-sidepanel-state') {
        return { ok: true, data: { open: false, canClose: true } };
      }
      if (message.type === 'capture-active-tab') {
        return { ok: true, data: { capturedCount: 0, duplicateSuppressed: true } };
      }
      return { ok: true };
    });
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Capture Tab' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Captured this tab a moment ago. Choose Capture Tab again to recapture it now.',
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

    fireEvent.change(titleInput, { target: { value: 'Field note screenshot' } });
    fireEvent.change(contextInput, {
      target: { value: 'Needs follow-up in the next coop review.' },
    });
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

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

  it('shows a non-blocking microphone toast when popup audio access is already blocked', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'denied' } satisfies Partial<PermissionStatus>),
      },
    });
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

    expect(
      await screen.findByText(
        'Microphone access is blocked for Coop. Allow it in browser settings and try again.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry Audio' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument();
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

  it('shows the quick actions button and opens create/join/invite options', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    const plusButton = await screen.findByRole('button', { name: 'Quick actions' });
    expect(plusButton).toBeInTheDocument();

    await user.click(plusButton);

    expect(await screen.findByRole('menuitem', { name: 'Create Coop' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Join Coop' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Invite Members' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Invite Members' }));

    expect(
      await screen.findByRole('heading', { name: 'Manage the canonical doors into each coop.' }),
    ).toBeInTheDocument();
  });

  it('shows general coop context in the profile panel without invite actions', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Open profile' }));

    expect(await screen.findByText('Your Coops')).toBeInTheDocument();
    expect(screen.getByText('Starter Coop')).toBeInTheDocument();
    expect(screen.getByText('Member context')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy invite/i })).not.toBeInTheDocument();
  });

  it('shows locked rows and canonical invite actions in the invite hub', async () => {
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
                status: 'active',
                code: 'OLD-MEMBER-CODE',
                expiresAt: new Date(Date.now() + 86400000).toISOString(),
                createdAt: new Date().toISOString(),
                createdBy: 'member-1',
                usedByMemberIds: ['member-used'],
                bootstrap: {
                  coopId: 'coop-1',
                  coopDisplayName: 'Starter Coop',
                  inviteId: 'invite-1',
                  inviteType: 'member',
                  expiresAt: new Date(Date.now() + 86400000).toISOString(),
                  roomId: 'room-1',
                  signalingUrls: [],
                  inviteProof: 'proof-1',
                },
              },
              {
                id: 'invite-2',
                type: 'trusted',
                status: 'active',
                code: 'OLD-TRUSTED-CODE',
                expiresAt: new Date(Date.now() + 86400000).toISOString(),
                createdAt: new Date().toISOString(),
                createdBy: 'member-1',
                usedByMemberIds: [],
                bootstrap: {
                  coopId: 'coop-1',
                  coopDisplayName: 'Starter Coop',
                  inviteId: 'invite-2',
                  inviteType: 'trusted',
                  expiresAt: new Date(Date.now() + 86400000).toISOString(),
                  roomId: 'room-1',
                  signalingUrls: [],
                  inviteProof: 'proof-2',
                },
              },
            ],
          },
          makePopupCoop({
            profile: {
              id: 'coop-2',
              name: 'Member Only Coop',
              purpose: 'Locked row',
            },
            members: [
              {
                ...makeCoopState().members[0],
                id: 'member-2',
                displayName: 'Ava',
                role: 'member',
                address: '0x1234567890abcdef1234567890abcdef12345678',
                joinedAt: '2026-03-17T10:00:00.000Z',
              },
            ],
          }),
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

    await user.click(await screen.findByRole('button', { name: 'Quick actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Invite Members' }));

    expect(await screen.findByText('Starter Coop')).toBeInTheDocument();
    expect(screen.getByText('Member Only Coop')).toBeInTheDocument();
    expect(screen.getByText('Reusable')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Open this coop as a creator or trusted member to copy, rotate, or revoke its canonical invite codes.',
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Copy member invite code for Starter Coop' }),
    );
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith('OLD-MEMBER-CODE');

    await user.click(
      screen.getByRole('button', { name: 'Regenerate member invite for Starter Coop' }),
    );
    expect(await screen.findByText('COOP-MEMBER-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revoke member invite for Starter Coop' }));
    expect(await screen.findByText('No code yet')).toBeInTheDocument();
  });

  it('shows post-create invite success and opens the workspace onboarding flow', async () => {
    installDefaultRuntimeHandlers(
      mockSendRuntimeMessage,
      makeDashboard({
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
    );
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Create a Coop' }));
    fireEvent.change(screen.getByLabelText('Coop name'), { target: { value: 'Fresh Coop' } });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ava' } });
    fireEvent.change(screen.getByPlaceholderText('What will your coop gather and act on?'), {
      target: { value: 'Keep fresh invite flows visible.' },
    });

    await user.click(screen.getByRole('button', { name: 'Create Coop' }));

    expect(await screen.findByText('Fresh Coop is ready.')).toBeInTheDocument();
    expect(screen.getByText('COOP-MEMBER-1')).toBeInTheDocument();
    expect(screen.getByText('COOP-TRUSTED-2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enter Coop' }));

    expect(chrome.sidePanel.open).toHaveBeenCalled();
    expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
      type: 'set-sidepanel-intent',
      payload: expect.objectContaining({
        tab: 'chickens',
        segment: 'roundup-access',
        roundupAccessMode: 'prompt',
        coopId: 'coop-1',
      }),
    });
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
