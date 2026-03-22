import { emptySetupInsightsInput } from '@coop/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

describe('landing page', () => {
  beforeEach(() => {
    installMatchMediaMock(false);
    window.localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
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
    render(<App />);

    expect(screen.getByRole('heading', { name: /no more chickens loose/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^how coop works$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^curate your coop$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^why we build$/i })).toBeInTheDocument();
    expect(screen.getByText(/your data stays yours/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /github/i })).toBeInTheDocument();
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
    vi.useFakeTimers();

    render(<App />);

    // Switch to Family — lens titles become: Household Memory, Shared Resources, Logistics, Milestones
    fireEvent.click(screen.getByRole('button', { name: /^family$/i }));
    completeCard('Household Memory', 'We keep links in chats.');
    completeCard('Shared Resources');
    completeCard('Logistics');
    completeCard('Milestones');

    fireEvent.change(screen.getByLabelText(/coop name/i), {
      target: { value: 'Pocket Flock' },
    });
    fireEvent.change(screen.getByLabelText(/what opportunity are you organizing around/i), {
      target: { value: 'Turn scattered notes into momentum.' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy packet/i }));
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"coopName": "Pocket Flock"'),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"purpose": "Turn scattered notes into momentum."'),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"audience": "family"'),
    );

    act(() => {
      vi.runAllTimers();
    });

    vi.useRealTimers();
  });

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

    fireEvent.click(screen.getByRole('button', { name: /flip back/i }));
    expect(screen.getByRole('button', { name: /collective intelligence/i })).toHaveFocus();
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

    act(() => {
      activeRecognition?.onend?.();
    });

    expect(screen.getByRole('textbox', { name: /collective intelligence notes/i })).toHaveValue(
      'We keep grant links in chat. We also keep follow-ups in calls.',
    );
    expect(screen.getByText(/transcript is ready to edit/i)).toBeInTheDocument();
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
