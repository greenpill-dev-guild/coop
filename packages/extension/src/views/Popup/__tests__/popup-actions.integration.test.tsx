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
      (makeDashboard({ drafts: [] as Array<ReturnType<typeof makeDraft>> }) as PopupHarnessDashboard),
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

  mockSendRuntimeMessage.mockImplementation(async (message: { type: string; payload?: unknown }) => {
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
  });

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

  it('reloads the dashboard after roundup and shows the new draft in Chickens', async () => {
    installPopupActionRuntime({
      dashboard: makeDashboard({ drafts: [] }),
    });
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Roundup Chickens' }));

    expect(await screen.findByText('Roundup generated draft')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Rounded up 1 tab.');
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

    await user.type(
      screen.getByRole('textbox', { name: 'Context' }),
      'Remember why this file matters.',
    );
    await user.click(screen.getByRole('button', { name: 'Save to Pocket Coop' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('status')).toHaveTextContent('File saved to Pocket Coop finds.');
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
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Voice note');

    await user.type(screen.getByRole('textbox', { name: 'Context' }), 'Shared after the walk.');
    await user.click(screen.getByRole('button', { name: 'Save to Pocket Coop' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Voice note saved.');
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
    const user = userEvent.setup();

    render(<PopupApp />);

    const roundupButton = await screen.findByRole('button', { name: 'Roundup Chickens' });
    await user.click(roundupButton);

    await waitFor(() => {
      expect(roundupButton).toBeDisabled();
    });

    await user.click(roundupButton);

    expect(
      mockSendRuntimeMessage.mock.calls.filter(
        ([message]) => (message as { type: string }).type === 'manual-capture',
      ),
    ).toHaveLength(1);

    resolveCapture?.({ ok: true, data: 1 });

    expect(await screen.findByText('Deferred roundup draft')).toBeInTheDocument();
  });

  it('keeps Home visible when active-tab capture returns zero new results', async () => {
    installPopupActionRuntime({
      captureActiveTabHandler: async () => ({ ok: true, data: 0 }),
    });
    const user = userEvent.setup();

    render(<PopupApp />);

    await user.click(await screen.findByRole('button', { name: 'Capture Tab' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'This tab did not produce a new capture.',
    );
    expect(screen.getByRole('button', { name: 'Roundup Chickens' })).toBeInTheDocument();
    expect(screen.queryByText('Captured active tab')).not.toBeInTheDocument();
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
