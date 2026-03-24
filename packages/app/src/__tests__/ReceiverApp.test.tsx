import {
  buildReceiverPairingDeepLink,
  buildReceiverPairingProtocolLink,
  createReceiverPairingPayload,
  encodeReceiverPairingPayload,
} from '@coop/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RootApp, resetReceiverDb } from '../app';
import { bootstrapReceiverPairingHandoff } from '../pairing-handoff';
import { bootstrapReceiverShareHandoff } from '../share-handoff';

describe('receiver app routes', () => {
  const createObjectUrl = vi.fn(() => 'blob:receiver-preview');
  const originalCreateObjectUrl = URL.createObjectURL;

  beforeEach(async () => {
    await resetReceiverDb();
    window.history.pushState({}, '', '/receiver');
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
    await act(async () => {
      render(<RootApp />);
    });

    expect(await screen.findByRole('heading', { name: /^Hatch$/i })).toBeVisible();
    expect(screen.getByRole('navigation', { name: /receiver navigation/i })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Mate' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Hatch' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Roost' })).toBeVisible();
    expect(screen.getByRole('button', { name: /start recording/i })).toBeVisible();
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

    window.history.pushState({}, '', '/pair');

    await act(async () => {
      render(<RootApp />);
    });

    expect(await screen.findByRole('heading', { name: /^Mate$/i })).toBeVisible();

    fireEvent.change(screen.getByLabelText(/nest code or coop link/i), {
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
        expect(screen.getAllByText(/river coop/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/mina/i).length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

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

    expect(window.location.pathname).toBe('/pair');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(handoff).toBeTruthy();

    await act(async () => {
      render(<RootApp initialPairingInput={handoff} />);
    });

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

    await act(async () => {
      render(<RootApp initialPairingInput={handoff} />);
    });

    expect(await screen.findByRole('button', { name: /join this coop/i })).toBeVisible();
    expect(screen.getByText(/protocol coop/i)).toBeVisible();
  });

  it('stores a local file capture and shows it in the inbox', async () => {
    await act(async () => {
      render(<RootApp />);
    });

    const fileInput = document.querySelectorAll('input[type="file"]')[1];
    const file = new File(['receiver capture from test'], 'field-note.txt', {
      type: 'text/plain',
    });

    await act(async () => {
      fireEvent.change(fileInput, {
        target: {
          files: [file],
        },
      });
    });

    expect((await screen.findAllByText('field-note.txt')).length).toBeGreaterThan(0);
    expect(screen.getByText(/nest item saved locally/i)).toBeVisible();
    expect(screen.getByText(/local only/i)).toBeVisible();

    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Roost' }));
    });

    await waitFor(() => {
      expect(screen.getByText(/your roost/i)).toBeVisible();
    });
    expect(screen.getAllByText('field-note.txt').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /download local file/i })).toBeVisible();
  });

  it('ingests a shared link handoff into the local inbox', async () => {
    window.history.pushState(
      {},
      '',
      '/receiver?title=Shared%20Grant&text=Follow%20up%20next%20week&url=https%3A%2F%2Fexample.com%2Fgrant',
    );

    const handoff = bootstrapReceiverShareHandoff(window);

    await act(async () => {
      render(<RootApp initialShareInput={handoff} />);
    });

    expect((await screen.findAllByText('Shared Grant')).length).toBeGreaterThan(0);
    expect(screen.getByText(/shared link saved locally/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Roost' })).toBeVisible();

    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Roost' }));
    });

    expect(await screen.findByText('https://example.com/grant')).toBeVisible();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeVisible();
  });

  it('falls back cleanly when QR scanning is unavailable', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/pair');

    await act(async () => {
      render(<RootApp />);
    });

    await user.click(screen.getByRole('button', { name: /scan qr/i }));

    expect(await screen.findByText(/qr scanning is not supported/i)).toBeVisible();
  });
});
