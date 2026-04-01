import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installDefaultRuntimeHandlers,
  makeDashboard,
  makeDraft,
} from '../../__test-utils__/popup-harness';

const { mockSendRuntimeMessage, mockPlayCoopSound } = vi.hoisted(() => ({
  mockSendRuntimeMessage: vi.fn(),
  mockPlayCoopSound: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../runtime/audio', () => ({
  playCoopSound: mockPlayCoopSound,
  playRandomChickenSound: vi.fn(),
}));

const { PopupApp } = await import('../PopupApp');

type PopupHarnessDashboard = Omit<ReturnType<typeof makeDashboard>, 'drafts'> & {
  drafts: Array<ReturnType<typeof makeDraft>>;
};

function updatePendingDraftSummary(dashboard: PopupHarnessDashboard): PopupHarnessDashboard {
  const pendingDrafts = dashboard.drafts.length;
  return {
    ...dashboard,
    coopBadges: dashboard.coopBadges.map((badge) =>
      badge.coopId === dashboard.activeCoopId ? { ...badge, pendingDrafts } : badge,
    ),
    summary: {
      ...dashboard.summary,
      pendingDrafts,
    },
  };
}

function installPopupActionRuntime(
  overrides: {
    dashboard?: PopupHarnessDashboard;
    manualCaptureHandler?: (helpers: {
      addDraft: (title: string) => void;
      getDashboard: () => PopupHarnessDashboard;
      message: { type: string; payload?: unknown };
    }) => Promise<unknown>;
    captureActiveTabHandler?: (helpers: {
      addDraft: (title: string) => void;
      getDashboard: () => PopupHarnessDashboard;
      message: { type: string; payload?: unknown };
    }) => Promise<unknown>;
    prepareVisibleScreenshotResponse?:
      | { ok: false; error: string }
      | {
          ok: true;
          data: {
            kind: 'photo';
            dataBase64: string;
            mimeType: string;
            fileName: string;
            title: string;
            note: string;
            sourceUrl: string;
          };
        };
  } = {},
) {
  let currentDashboard = structuredClone(
    overrides.dashboard ??
      (makeDashboard({
        drafts: [] as Array<ReturnType<typeof makeDraft>>,
      }) as PopupHarnessDashboard),
  ) as PopupHarnessDashboard;
  let draftIndex = currentDashboard.drafts.length + 1;

  const getDashboard = () => structuredClone(currentDashboard) as PopupHarnessDashboard;

  const addDraft = (title: string) => {
    currentDashboard = updatePendingDraftSummary({
      ...currentDashboard,
      drafts: [
        ...currentDashboard.drafts,
        makeDraft({
          id: `draft-${draftIndex}`,
          title,
          summary: `${title} summary`,
          createdAt: new Date(Date.now() + draftIndex * 1000).toISOString(),
        }),
      ],
    });
    draftIndex += 1;
  };

  mockSendRuntimeMessage.mockImplementation(
    async (message: { type: string; payload?: unknown }) => {
      if (message.type === 'get-dashboard') {
        return { ok: true, data: getDashboard() };
      }
      if (message.type === 'get-sidepanel-state') {
        return { ok: true, data: { open: false, canClose: true } };
      }
      if (message.type === 'toggle-sidepanel') {
        return { ok: true, data: { open: true, canClose: true } };
      }
      if (message.type === 'manual-capture') {
        if (overrides.manualCaptureHandler) {
          return overrides.manualCaptureHandler({ addDraft, getDashboard, message });
        }
        addDraft('Roundup generated draft');
        return { ok: true, data: 1 };
      }
      if (message.type === 'capture-active-tab') {
        if (overrides.captureActiveTabHandler) {
          return overrides.captureActiveTabHandler({ addDraft, getDashboard, message });
        }
        addDraft('Captured active tab');
        return { ok: true, data: 1 };
      }
      if (message.type === 'create-note-draft') {
        const payload = message.payload as { text: string };
        addDraft(payload.text.trim() || 'New note');
        return { ok: true };
      }
      if (message.type === 'prepare-visible-screenshot') {
        return (
          overrides.prepareVisibleScreenshotResponse ?? {
            ok: true,
            data: {
              kind: 'photo' as const,
              dataBase64: btoa('image-data'),
              mimeType: 'image/png',
              fileName: 'coop-screenshot.png',
              title: 'Page screenshot',
              note: 'Captured from https://example.com via Extension Browser.',
              sourceUrl: 'https://example.com',
            },
          }
        );
      }
      if (message.type === 'save-popup-capture') {
        return { ok: true, data: { id: `capture-${draftIndex}` } };
      }
      if (message.type === 'set-active-coop') {
        currentDashboard = {
          ...currentDashboard,
          activeCoopId: (message.payload as { coopId: string }).coopId,
        };
        return { ok: true };
      }
      return { ok: true };
    },
  );

  return { addDraft, getDashboard };
}

function installChromeMocks(activeTabUrl = 'https://example.com') {
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
          onChanged: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
      },
      tabs: {
        query: vi.fn().mockImplementation((query: chrome.tabs.QueryInfo = {}) => {
          if (query.active) {
            return Promise.resolve([{ id: 7, windowId: 7, url: activeTabUrl, title: 'Example' }]);
          }
          return Promise.resolve([{ id: 7, windowId: 7, url: activeTabUrl, title: 'Example' }]);
        }),
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
}

class FakeMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void | Promise<void>) | null = null;

  constructor(public readonly stream: MediaStream) {}

  start() {
    this.state = 'recording';
  }

  stop() {
    if (this.state === 'inactive') {
      return;
    }

    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['audio-data'], { type: this.mimeType }),
    });
    void this.onstop?.();
  }
}

describe('Popup action integration', () => {
  beforeEach(() => {
    mockSendRuntimeMessage.mockReset();
    mockPlayCoopSound.mockReset().mockResolvedValue(undefined);
    installChromeMocks();
    window.localStorage.clear();
    sessionStorage.clear();

    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue('Fresh note from clipboard'),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reloads the dashboard after roundup and keeps the popup responsive', async () => {
    installPopupActionRuntime({
      dashboard: makeDashboard({ drafts: [] }),
    });
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Roundup Chickens' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Rounded up 1 tab.');
    expect(screen.getByRole('button', { name: 'Capture Tab' })).toBeInTheDocument();
  });

  it('routes missing roundup permission into the workspace instead of requesting from the popup', async () => {
    installPopupActionRuntime({
      dashboard: makeDashboard({ drafts: [] }),
    });
    const user = userEvent.setup();
    vi.mocked(chrome.permissions.contains).mockResolvedValue(false);

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Roundup Chickens' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Roundup needs site access. Finish setup in the workspace.',
    );
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(chrome.sidePanel.open).toHaveBeenCalled();
    expect(mockSendRuntimeMessage).not.toHaveBeenCalledWith({ type: 'manual-capture' });
    expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
      type: 'set-sidepanel-intent',
      payload: expect.objectContaining({
        tab: 'chickens',
        segment: 'roundup-access',
        roundupAccessMode: 'grant-and-roundup',
        coopId: 'coop-1',
      }),
    });
  });

  it('opens the file review modal and saves the file capture', async () => {
    installPopupActionRuntime();
    const user = userEvent.setup();

    render(<PopupApp />);

    await screen.findByRole('button', { name: 'Files' });
    const fileInput = document.querySelector('input[type="file"]');
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error('Expected popup file input to be rendered.');
    }

    const file = new File(['field note'], 'field-note.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('field-note.txt');

    fireEvent.change(screen.getByRole('textbox', { name: 'Context' }), {
      target: { value: 'Remember why this file matters.' },
    });
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('status')).toHaveTextContent('File saved as draft.');
  });

  it('opens the audio review modal after recording and saves the voice note', async () => {
    installPopupActionRuntime();
    const user = userEvent.setup();

    const stopTrack = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack } as unknown as MediaStreamTrack],
        } satisfies Pick<MediaStream, 'getTracks'>),
      },
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: FakeMediaRecorder,
    });

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Audio' }));
    expect(await screen.findByLabelText('Recording audio')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save Voice Note' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Capture audio preview')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Voice note');

    fireEvent.change(screen.getByRole('textbox', { name: 'Context' }), {
      target: { value: 'Shared after the walk.' },
    });
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Voice note saved as draft.');
    expect(stopTrack).toHaveBeenCalled();
  });

  it('prevents repeated roundup attempts while a capture is already in flight', async () => {
    let resolveCapture: ((value: unknown) => void) | undefined;
    installPopupActionRuntime({
      manualCaptureHandler: async ({ addDraft }) =>
        new Promise((resolve) => {
          resolveCapture = (value) => {
            addDraft('Deferred roundup draft');
            resolve(value);
          };
        }),
    });

    render(<PopupApp />);

    const roundupButton = await screen.findByRole(
      'button',
      { name: 'Roundup Chickens' },
      { timeout: 10_000 },
    );
    fireEvent.click(roundupButton);

    await waitFor(() => {
      expect(roundupButton).toBeDisabled();
    });

    fireEvent.click(roundupButton);

    expect(
      mockSendRuntimeMessage.mock.calls.filter(
        ([message]) => (message as { type: string }).type === 'manual-capture',
      ),
    ).toHaveLength(1);

    resolveCapture?.({ ok: true, data: 1 });

    await waitFor(() => {
      expect(roundupButton).not.toBeDisabled();
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Rounded up 1 tab.');
  }, 30_000);

  it('lets the user confirm an immediate duplicate and recapture the active tab', async () => {
    installPopupActionRuntime({
      captureActiveTabHandler: async ({ addDraft, message }) => {
        const allowRecentDuplicate =
          (message.payload as { allowRecentDuplicate?: boolean } | undefined)
            ?.allowRecentDuplicate === true;

        if (!allowRecentDuplicate) {
          return {
            ok: true,
            data: { capturedCount: 0, duplicateSuppressed: true },
          };
        }

        addDraft('Captured active tab again');
        return { ok: true, data: { capturedCount: 1 } };
      },
    });
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Capture Tab' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Captured this tab a moment ago. Choose Capture Tab again to recapture it now.',
    );
    expect(screen.getByRole('button', { name: 'Roundup Chickens' })).toBeInTheDocument();
    expect(screen.queryByText('Captured active tab again')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Capture Tab' }));

    await waitFor(() => {
      expect(
        mockSendRuntimeMessage.mock.calls.filter(
          ([message]) => (message as { type: string }).type === 'capture-active-tab',
        ),
      ).toEqual([
        [{ type: 'capture-active-tab' }],
        [{ type: 'capture-active-tab', payload: { allowRecentDuplicate: true } }],
      ]);
    });
    expect(await screen.findByText('Captured active tab again')).toBeInTheDocument();
  });

  it('surfaces precise screenshot permission errors without opening the review modal', async () => {
    installDefaultRuntimeHandlers(mockSendRuntimeMessage);
    mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === 'get-dashboard') {
        return { ok: true, data: makeDashboard({ drafts: [] }) };
      }
      if (message.type === 'get-sidepanel-state') {
        return { ok: true, data: { open: false, canClose: true } };
      }
      if (message.type === 'prepare-visible-screenshot') {
        return {
          ok: false,
          error: "Either the '<all_urls>' or 'activeTab' permission is required.",
        };
      }
      return { ok: true };
    });
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Screenshot' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      "Either the '<all_urls>' or 'activeTab' permission is required.",
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
