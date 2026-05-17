import {
  buildReceiverPairingDeepLink,
  buildReceiverPairingProtocolLink,
  createReceiverPairingPayload,
  encodeReceiverPairingPayload,
} from '@coop/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetReceiverDb } from '../app';
import { bootstrapReceiverPairingHandoff } from '../pairing-handoff';
import { bootstrapReceiverShareHandoff } from '../share-handoff';
import { renderRootApp } from './root-app-test-utils';

function stubStandaloneReceiver() {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 390,
  });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  });
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 5,
  });
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value: true,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' || query === '(pointer: coarse)',
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

describe('receiver app routes', () => {
  const createObjectUrl = vi.fn(() => 'blob:receiver-preview');
  const originalCreateObjectUrl = URL.createObjectURL;

  beforeEach(async () => {
    await resetReceiverDb();
    stubStandaloneReceiver();
    window.history.pushState({}, '', '/app/receiver');
    createObjectUrl.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
  });

  afterEach(async () => {
    await resetReceiverDb();
    window.history.pushState({}, '', '/');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectUrl,
    });
  });

  it('renders the receiver shell with audio-first and local-first actions', async () => {
    await renderRootApp();

    expect(await screen.findByRole('heading', { name: /^Hatch$/i })).toBeVisible();
    expect(screen.getByRole('navigation', { name: /receiver navigation/i })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Mate' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Hatch' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Roost' })).toBeVisible();
    expect(screen.queryByRole('link', { name: /media/i })).not.toBeInTheDocument();
    expect(document.querySelector('.receiver-shell')).toHaveClass('is-hatch');
    expect(document.querySelector('.receiver-main')).toHaveClass('is-hatch');
    expect(
      screen.getByRole('button', { name: /settings and status: not paired · 0 saved/i }),
    ).toBeVisible();
    expect(screen.queryByText(/about coop/i)).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /start recording/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /take photo/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /attach file/i })).toBeVisible();
    expect(screen.getAllByText(/not paired/i).length).toBeGreaterThan(0);
  });

  it('requires explicit confirmation before accepting a pasted pairing payload', async () => {
    const user = userEvent.setup();
    const payload = createReceiverPairingPayload({
      coopId: 'coop-1',
      coopDisplayName: 'River Coop',
      memberId: 'member-1',
      memberDisplayName: 'Mina',
      signalingUrls: ['ws://127.0.0.1:4444'],
    });
    const pairingCode = encodeReceiverPairingPayload(payload);

    window.history.pushState({}, '', '/app/pair');

    await renderRootApp();

    expect(await screen.findByRole('heading', { name: /^Mate$/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /scan qr/i })).toBeVisible();
    expect(screen.queryByLabelText(/nest code or coop link/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /paste code/i }));
    fireEvent.change(await screen.findByLabelText(/nest code or coop link/i), {
      target: { value: pairingCode },
    });
    await user.click(screen.getByRole('button', { name: /check nest code/i }));

    expect(screen.getByRole('button', { name: /join this coop/i })).toBeVisible();
    expect(
      screen.getByText(/check this code before this phone joins the private nest/i),
    ).toBeVisible();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /join this coop/i }));
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: /^Hatch$/i })).toBeVisible();
        expect(screen.getByText(/paired to river coop as mina/i)).toBeVisible();
        expect(
          screen.getByRole('button', { name: /settings and status: paired · 0 saved/i }),
        ).toBeVisible();
      },
      { timeout: 3000 },
    );

    await user.click(
      screen.getByRole('button', { name: /settings and status: paired · 0 saved/i }),
    );
    expect(await screen.findByText('River Coop')).toBeVisible();
    expect(screen.getByText('Mina')).toBeVisible();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });
  });

  it('sanitizes pairing deep links before the receiver shell continues', async () => {
    const payload = createReceiverPairingPayload({
      coopId: 'coop-2',
      coopDisplayName: 'Canopy Coop',
      memberId: 'member-2',
      memberDisplayName: 'Rae',
    });
    const deepLink = buildReceiverPairingDeepLink('http://localhost', payload);
    const parsedDeepLink = new URL(deepLink);

    window.history.pushState({}, '', `${parsedDeepLink.pathname}${parsedDeepLink.hash}`);

    const handoff = bootstrapReceiverPairingHandoff(window);

    expect(window.location.pathname).toBe('/app/pair');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(handoff).toBeTruthy();

    await renderRootApp({ initialPairingInput: handoff });

    expect(await screen.findByRole('button', { name: /join this coop/i })).toBeVisible();
    expect(await screen.findByText(/canopy coop/i)).toBeVisible();
  });

  it('accepts a protocol pairing link through the HTTPS protocol handler handoff', async () => {
    const payload = createReceiverPairingPayload({
      coopId: 'coop-protocol',
      coopDisplayName: 'Protocol Coop',
      memberId: 'member-protocol',
      memberDisplayName: 'Ira',
    });
    const protocolLink = buildReceiverPairingProtocolLink(payload);

    window.history.pushState({}, '', `/pair?payload=${encodeURIComponent(protocolLink)}`);

    const handoff = bootstrapReceiverPairingHandoff(window);

    expect(window.location.pathname).toBe('/app/pair');

    await renderRootApp({ initialPairingInput: handoff });

    expect(await screen.findByRole('button', { name: /join this coop/i })).toBeVisible();
    expect(screen.getByText(/protocol coop/i)).toBeVisible();
  });

  it('stores a local file capture and shows it in the inbox', async () => {
    const user = userEvent.setup();

    await renderRootApp();

    const fileInput = await screen.findByLabelText('Attach file');
    const file = new File(['receiver capture from test'], 'field-note.txt', {
      type: 'text/plain',
    });

    await user.upload(fileInput, file);

    await waitFor(
      () => {
        expect(screen.getAllByText('field-note.txt').length).toBeGreaterThan(0);
      },
      { timeout: 10_000 },
    );
    expect(
      await screen.findByText(/nest item saved locally/i, {}, { timeout: 10_000 }),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', { name: /saved on this phone/i }, { timeout: 10_000 }),
    ).toBeVisible();

    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Roost' }));
    });

    await waitFor(() => {
      expect(screen.getByText(/your roost/i)).toBeVisible();
    });
    expect(screen.getAllByText('field-note.txt').length).toBeGreaterThan(0);
    const item = screen.getByText('field-note.txt').closest('article');
    expect(item).not.toBeNull();
    if (!item) {
      throw new Error('Expected field note item to render');
    }
    expect(within(item).getByRole('button', { name: /more actions/i })).toBeVisible();
    expect(within(item).getByRole('button', { name: /remove/i })).toBeVisible();
    expect(within(item).queryByRole('button', { name: /retry sync/i })).not.toBeInTheDocument();
    await user.click(within(item).getByRole('button', { name: /more actions/i }));
    expect(
      await screen.findByRole('dialog', { name: /actions for field-note.txt/i }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /download local file/i })).toBeVisible();
  });

  it('removes a local receiver capture from the inbox', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    try {
      await renderRootApp();

      const fileInput = await screen.findByLabelText('Attach file');
      const file = new File(['receiver capture from test'], 'remove-me.txt', {
        type: 'text/plain',
      });

      await user.upload(fileInput, file);

      expect(await screen.findByText('remove-me.txt', {}, { timeout: 10_000 })).toBeVisible();

      await act(async () => {
        fireEvent.click(screen.getByRole('link', { name: 'Roost' }));
      });

      await user.click(await screen.findByRole('button', { name: /remove/i }));

      expect(confirmSpy).toHaveBeenCalledWith('Remove "remove-me.txt" from this phone?');
      expect(await screen.findByText(/removed from this phone/i)).toBeVisible();
      expect(screen.queryByText('remove-me.txt')).not.toBeInTheDocument();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('ingests a shared link handoff into the local inbox', async () => {
    window.history.pushState(
      {},
      '',
      '/receiver?title=Shared%20Grant&text=Follow%20up%20next%20week&url=https%3A%2F%2Fexample.com%2Fgrant',
    );

    const handoff = bootstrapReceiverShareHandoff(window);

    expect(window.location.pathname).toBe('/app/receiver');

    await renderRootApp({ initialShareInput: handoff });

    expect(
      (await screen.findAllByText('Shared Grant', {}, { timeout: 10_000 })).length,
    ).toBeGreaterThan(0);
    expect(
      await screen.findByText(/shared link saved locally/i, {}, { timeout: 10_000 }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Roost' })).toBeVisible();

    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Roost' }));
    });

    expect(
      await screen.findByText('https://example.com/grant', {}, { timeout: 3_000 }),
    ).toBeVisible();
    const linkItem = screen.getByText('Shared Grant').closest('article');
    expect(linkItem).not.toBeNull();
    if (!linkItem) {
      throw new Error('Expected shared link item to render');
    }
    const sharedLinkUser = userEvent.setup();
    await sharedLinkUser.click(within(linkItem).getByRole('button', { name: /more actions/i }));
    expect(await screen.findByRole('button', { name: /copy link/i })).toBeVisible();
  });

  it('falls back cleanly when QR scanning is unavailable', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/app/pair');

    await renderRootApp();

    await user.click(await screen.findByRole('button', { name: /scan qr/i }));

    expect(await screen.findByText(/qr scanning is not supported/i)).toBeVisible();
  });
});
