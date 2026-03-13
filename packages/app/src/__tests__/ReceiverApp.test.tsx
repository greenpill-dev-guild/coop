import {
  buildReceiverPairingDeepLink,
  createReceiverPairingPayload,
  encodeReceiverPairingPayload,
} from '@coop/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RootApp, resetReceiverDb } from '../app';
import { bootstrapReceiverPairingHandoff } from '../pairing-handoff';

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

    expect(await screen.findByRole('heading', { name: /capture into the nest/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /start recording/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /take photo/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /attach file/i })).toBeVisible();
    expect(screen.getByText(/local-only nest/i)).toBeVisible();
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

    expect(await screen.findByRole('heading', { name: /pair your nest/i })).toBeVisible();

    fireEvent.change(screen.getByLabelText(/pairing payload or deep link/i), {
      target: { value: pairingCode },
    });
    await user.click(screen.getByRole('button', { name: /review pairing/i }));

    expect(screen.getByRole('button', { name: /accept pairing/i })).toBeVisible();
    expect(
      screen.getByText(/confirm before this receiver stores the pairing secret/i),
    ).toBeVisible();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /accept pairing/i }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(await screen.findByRole('heading', { name: /capture into the nest/i })).toBeVisible();
    expect(screen.getByText(/paired to river coop as mina/i)).toBeVisible();
    expect(screen.getByText(/river coop · mina/i)).toBeVisible();
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

    expect(await screen.findByRole('button', { name: /accept pairing/i })).toBeVisible();
    expect(await screen.findByText(/canopy coop/i)).toBeVisible();
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
      fireEvent.click(screen.getByRole('link', { name: 'Inbox', exact: true }));
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /inbox nest/i })).toBeVisible();
    });
    expect(screen.getAllByText('field-note.txt').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /download local file/i })).toBeVisible();
  });
});
