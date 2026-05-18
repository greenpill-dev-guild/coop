import { emptySetupInsightsInput } from '@coop/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, buildLandingSetupPacket, emptyLandingTranscripts } from '../views/Landing';

function installMatchMediaMock(matches = false) {
  const matchMedia = vi.fn().mockImplementation(() => ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return matchMedia;
}

function stubMobileBrowser(userAgent: string, platform = 'iPhone') {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 390,
  });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 5,
  });
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function openCard(title: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(title, 'i') }));
}

function completeCard(title: string, notes?: string) {
  openCard(title);

  if (notes) {
    fireEvent.change(screen.getByRole('textbox', { name: new RegExp(`${title} notes`, 'i') }), {
      target: { value: notes },
    });
  }

  fireEvent.click(screen.getByRole('button', { name: /mark complete/i }));
}

function mockDialogMethods() {
  const showModalDescriptor = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    'showModal',
  );
  const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
  const showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  const close = vi.fn(function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  });

  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: showModal,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: close,
  });

  return {
    close,
    restore() {
      if (showModalDescriptor) {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModalDescriptor);
      } else {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
          configurable: true,
          value: undefined,
        });
      }

      if (closeDescriptor) {
        Object.defineProperty(HTMLDialogElement.prototype, 'close', closeDescriptor);
      } else {
        Object.defineProperty(HTMLDialogElement.prototype, 'close', {
          configurable: true,
          value: undefined,
        });
      }
    },
    showModal,
  };
}

describe('landing page', () => {
  beforeEach(() => {
    installMatchMediaMock(false);
    window.localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue('Pasted transcript'),
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const speechWindow = window as typeof window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };

    speechWindow.SpeechRecognition = undefined;
    speechWindow.webkitSpeechRecognition = undefined;
  });

  it('renders the simplified landing structure and footer links', () => {
    const { container } = render(<App />);

    expect(screen.getByRole('heading', { name: /no more chickens loose\./i })).toBeInTheDocument();
    expect(screen.getByText(/^No more$/)).toBeInTheDocument();
    expect(screen.getByText(/^chickens loose\.$/)).toBeInTheDocument();
    expect(
      screen.getByText(/browser-first, local-first coordination for community organizers/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^launch your coop$/i })).toHaveAttribute(
      'href',
      '#ritual',
    );
    expect(screen.getByRole('link', { name: /^see how it works$/i })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    expect(container.querySelector('.thought-bubble')).not.toBeNull();
    expect(screen.getByText(/quick capture from the walk home/i)).toBeInTheDocument();
    expect(screen.queryByText(/chickenThoughts\.voice-memos/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^how coop works$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /^shape your community coop$/i }),
    ).toBeInTheDocument();
    expect(container.querySelector('.why-build-heading-card h2')).not.toBeNull();
    expect(screen.getByRole('heading', { name: /capture from anywhere/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /refine on your device/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /review before sharing/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /share with proof/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.how-works-index')).toHaveLength(4);
    expect(container.querySelector('.why-build-heading-card')).not.toBeNull();
    expect(container.querySelector('.landing-trust-strip')).not.toBeNull();
    expect(screen.getByText(/^On-device AI$/)).toBeInTheDocument();
    expect(screen.getByText(/^Multimodal capture$/)).toBeInTheDocument();
    expect(container.querySelector('.audience-picker')).toBeNull();
    expect(container.querySelector('.audience-chip-group')).toBeNull();
    expect(screen.queryByText(/^get started$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset ritual/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /github/i })).toBeInTheDocument();
    expect(container.querySelector('.footer-copy')).toHaveTextContent('Greenpill Dev Guild');
    expect(screen.getByRole('link', { name: /docs/i })).toHaveAttribute(
      'href',
      'https://docs.coop.town',
    );
    expect(screen.getByRole('link', { name: /bluesky/i })).toHaveAttribute(
      'href',
      'https://bsky.app/profile/coop.town',
    );
  });

  it('opens a desktop install QR dialog that targets the app route', async () => {
    const dialogMethods = mockDialogMethods();

    try {
      render(<App />);

      fireEvent.click(screen.getByRole('link', { name: /install app/i }));

      const dialog = await screen.findByRole('dialog', { name: /open coop on your phone/i });
      expect(dialog).toBeVisible();
      expect(dialogMethods.showModal).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: /close install instructions/i })).toHaveFocus();
      expect(screen.getByText(/scan with your phone camera/i)).toBeVisible();
      expect(dialog.querySelector('.eyebrow')).toHaveTextContent(/phone field companion/i);
      expect(screen.getByText(/captures audio, photos, and files in the field/i)).toBeVisible();
      expect(screen.getByRole('link', { name: /open coop on the phone/i })).toHaveAttribute(
        'href',
        expect.stringContaining('/app'),
      );
      expect(await screen.findByAltText(/qr code for the coop receiver app/i)).toBeVisible();
    } finally {
      dialogMethods.restore();
    }
  });

  it('shows iOS Safari Add to Home Screen guidance on mobile browser', async () => {
    stubMobileBrowser(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    );

    render(<App />);

    fireEvent.click(screen.getAllByRole('link', { name: /install app/i })[0]);

    expect(
      await screen.findByRole('dialog', { name: /install coop on this iphone/i }),
    ).toBeVisible();
    expect(screen.getByText(/tap share in safari/i)).toBeVisible();
    expect(screen.getByText(/add to home screen/i)).toBeVisible();
  });

  it('uses the native Android install prompt when available', async () => {
    stubMobileBrowser(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Linux armv8l',
    );
    const prompt = vi.fn(async () => undefined);
    const installEvent = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted'; platform: string }>;
      preventDefault: () => void;
    };
    installEvent.prompt = prompt;
    installEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    installEvent.preventDefault = vi.fn();

    render(<App />);

    act(() => {
      window.dispatchEvent(installEvent);
    });
    fireEvent.click(screen.getAllByRole('link', { name: /install app/i })[0]);

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledTimes(1);
    });
  });

  it('points Android non-Chrome browsers toward Chrome for install', async () => {
    stubMobileBrowser(
      'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
      'Linux armv8l',
    );

    render(<App />);

    fireEvent.click(screen.getAllByRole('link', { name: /install app/i })[0]);

    expect(
      await screen.findByRole('dialog', { name: /install coop on this phone/i }),
    ).toBeVisible();
    expect(screen.getByText(/installs from chrome on android/i)).toBeVisible();
  });

  it('commits to the community audience on the landing surface', () => {
    const { container } = render(<App />);

    expect(container.querySelector('.ritual-game-shell')).toHaveAttribute(
      'data-audience',
      'community',
    );
    expect(container.querySelector('.audience-picker')).toBeNull();
    expect(container.querySelector('.audience-chip-group')).toBeNull();
    expect(screen.queryByRole('button', { name: /^family$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^personal$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^friends$/i })).toBeNull();
  });

  it('renders the dev tunnel badge when tunnel state is provided', async () => {
    render(
      <App
        devEnvironment={{
          version: 1,
          updatedAt: '2026-03-20T12:00:00.000Z',
          accessToken: 'COOP1234',
          app: {
            localUrl: 'http://127.0.0.1:3001',
            publicUrl: 'https://coop-dev.trycloudflare.com',
            qrUrl: 'https://coop-dev.trycloudflare.com/?coop-dev-token=COOP1234',
            status: 'ready',
          },
          api: {
            localUrl: 'http://127.0.0.1:4444',
            websocketUrl: 'wss://signal-dev.trycloudflare.com',
            publicUrl: 'https://signal-dev.trycloudflare.com',
            status: 'ready',
          },
          docs: {
            localUrl: 'http://127.0.0.1:3003',
            status: 'ready',
          },
          extension: {
            distPath: '/tmp/extension',
            mode: 'watch',
            receiverAppUrl: 'https://coop-dev.trycloudflare.com',
            signalingUrls: ['wss://signal-dev.trycloudflare.com'],
            status: 'ready',
          },
          tunnel: {
            enabled: true,
            provider: 'cloudflare',
            status: 'ready',
          },
        }}
      />,
    );

    expect(await screen.findByText(/scan to open the pwa on your phone/i)).toBeVisible();
    expect(screen.getByText('COOP1234')).toBeVisible();
    expect(screen.getByText('https://coop-dev.trycloudflare.com')).toBeVisible();
  });

  it('fills flashcards and copies a setup packet', async () => {
    window.localStorage.setItem(
      'coop-landing-ritual-v2',
      JSON.stringify({
        version: 2,
        audience: 'community',
        openCardId: null,
        sharedNotes: '',
        setupInput: {
          ...emptySetupInsightsInput,
          knowledgeCurrent: 'Notes and findings live across Notion, Drive, and DMs.',
          knowledgePain: 'New members re-research what the community already knew.',
          knowledgeImprove: 'Collect community knowledge in one shared place.',
          capitalCurrent: 'Grant leads surface in DMs and on calls.',
          capitalPain: 'Funding leads die in inboxes before the group can act.',
          capitalImprove: 'Keep funding leads visible to everyone.',
          governanceCurrent: 'Decisions happen on calls; notes are scattered.',
          governancePain: 'Three meetings later nobody can say what was decided.',
          governanceImprove: 'Use one shared ritual to organize next steps.',
          impactCurrent: 'Milestones are easy to miss without a shared place.',
          impactPain: 'Wins and follow-ups drift apart.',
          impactImprove: 'Track progress in a packet the community can reuse.',
        },
        transcripts: {
          ...emptyLandingTranscripts,
          knowledge: 'Notes and findings live across Notion, Drive, and DMs.',
          capital: 'Grant leads surface in DMs and on calls.',
          governance: 'Decisions happen on calls; notes are scattered.',
          impact: 'Milestones are easy to miss without a shared place.',
        },
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /your setup packet is ready/i }),
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText(/coop name/i), {
      target: { value: 'Community Garden Grants' },
    });
    fireEvent.change(
      screen.getByLabelText(/what opportunity is your community organizing around/i),
      {
        target: { value: 'Turn scattered notes into momentum.' },
      },
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy packet/i }));
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"coopName": "Community Garden Grants"'),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"purpose": "Turn scattered notes into momentum."'),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"audience": "community"'),
    );
  }, 30_000);

  it('restores ritual progress from localStorage after a remount', () => {
    // Default audience is community — capital lens title is "Funding & Resources"
    const firstRender = render(<App />);

    openCard('Funding & Resources');
    fireEvent.change(screen.getByRole('textbox', { name: /funding & resources notes/i }), {
      target: { value: 'Grant leads from calls.' },
    });

    firstRender.unmount();

    render(<App />);

    expect(screen.getByRole('textbox', { name: /funding & resources notes/i })).toHaveValue(
      'Grant leads from calls.',
    );
  });

  it('moves focus into an opened flashcard and returns it when the card closes', () => {
    // Default audience is community — knowledge lens title is "Collective Intelligence"
    render(<App />);

    const trigger = screen.getByRole('button', { name: /collective intelligence/i });
    fireEvent.click(trigger);

    const transcriptField = screen.getByRole('textbox', { name: /collective intelligence notes/i });
    expect(transcriptField).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: /^close card$/i }));
    expect(screen.getByRole('button', { name: /collective intelligence/i })).toHaveFocus();
  });

  it('closes the centered flashcard stage from the backdrop and Escape', () => {
    render(<App />);

    openCard('Collective Intelligence');
    expect(screen.getByRole('dialog', { name: /collective intelligence/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close card backdrop/i }));
    expect(
      screen.queryByRole('textbox', { name: /collective intelligence notes/i }),
    ).not.toBeInTheDocument();

    openCard('Collective Intelligence');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('textbox', { name: /collective intelligence notes/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps one flashcard open at a time', () => {
    render(<App />);

    openCard('Collective Intelligence');
    expect(screen.getByRole('textbox', { name: /collective intelligence notes/i })).toBeVisible();

    openCard('Funding & Resources');
    expect(screen.getByRole('textbox', { name: /funding & resources notes/i })).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: /collective intelligence notes/i }),
    ).not.toBeInTheDocument();
  });

  it('fills the open flashcard transcript when browser speech recognition is available', () => {
    let activeRecognition: MockSpeechRecognition | null = null;

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onend: (() => void) | null = null;
      onerror: ((event: { error?: string }) => void) | null = null;
      onresult:
        | ((event: {
            resultIndex?: number;
            results: ArrayLike<{ isFinal: boolean; 0: { transcript?: string } }>;
          }) => void)
        | null = null;
      onstart: (() => void) | null = null;

      start() {
        activeRecognition = this;
        this.onstart?.();
      }

      stop() {
        this.onend?.();
      }

      abort() {
        this.onend?.();
      }
    }

    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      writable: true,
      value: MockSpeechRecognition,
    });

    render(<App />);

    // Default audience is community — knowledge lens title is "Collective Intelligence"
    openCard('Collective Intelligence');
    fireEvent.click(screen.getByRole('button', { name: /^record$/i }));

    act(() => {
      activeRecognition?.onresult?.({
        resultIndex: 0,
        results: [
          {
            0: { transcript: 'We keep grant links in chat.' },
            isFinal: true,
          },
        ],
      });
    });

    act(() => {
      activeRecognition?.onresult?.({
        resultIndex: 1,
        results: [
          {
            0: { transcript: 'We keep grant links in chat.' },
            isFinal: true,
          },
          {
            0: { transcript: 'We also keep follow-ups in calls.' },
            isFinal: true,
          },
        ],
      });
    });

    // Click "Stop recording" so the intentional-stop flag is set before onend fires
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^stop recording$/i }));
    });

    expect(screen.getByRole('textbox', { name: /collective intelligence notes/i })).toHaveValue(
      'We keep grant links in chat. We also keep follow-ups in calls.',
    );
    expect(screen.getByText(/transcript is ready to edit/i)).toBeInTheDocument();
  });

  it('appends pasted clipboard text into the open flashcard transcript', async () => {
    render(<App />);

    openCard('Collective Intelligence');
    const transcriptField = screen.getByRole('textbox', { name: /collective intelligence notes/i });
    fireEvent.change(transcriptField, { target: { value: 'Existing line' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^paste$/i }));
      await Promise.resolve();
    });

    expect(transcriptField).toHaveValue('Existing line\nPasted transcript');
  });

  it('shows the clipboard fallback hint when explicit paste is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockRejectedValue(new Error('Clipboard blocked')),
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<App />);

    openCard('Collective Intelligence');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^paste$/i }));
      await Promise.resolve();
    });

    expect(
      screen.getByText('Clipboard access unavailable. Use Cmd/Ctrl+V to paste.'),
    ).toBeInTheDocument();
  });

  it('renders a static story stage when reduced motion is preferred', () => {
    installMatchMediaMock(true);
    const { container } = render(<App />);

    expect(container.querySelector('.journey-scene-story.is-static')).not.toBeNull();
  });

  it('builds a setup packet with saved audience and shared notes', () => {
    const packet = buildLandingSetupPacket(
      {
        ...emptySetupInsightsInput,
        coopName: 'Pocket Flock',
        purpose: 'Keep useful context from getting loose.',
      },
      {
        ...emptyLandingTranscripts,
        capital: 'Grant notes',
      },
      {
        audience: 'friends',
        sharedNotes: 'Shared notes go here.',
      },
    );

    expect(packet.setupInsights.lenses).toHaveLength(4);
    expect(packet.summary).toContain('Pocket Flock uses Coop');
    expect(packet.transcripts.moneyAndResources).toBe('Grant notes');
    expect(packet.audience).toBe('friends');
    expect(packet.sharedNotes).toBe('Shared notes go here.');
  });
});
