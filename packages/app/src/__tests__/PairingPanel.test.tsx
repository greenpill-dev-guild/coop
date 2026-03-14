import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PairingPanel } from '../views/Receiver/PairingPanel';

function renderPairingPanel(overrides: Partial<Parameters<typeof PairingPanel>[0]> = {}) {
  const defaults: Parameters<typeof PairingPanel>[0] = {
    pairingInput: '',
    pendingPairing: null,
    pairingError: '',
    qrScanError: '',
    isQrScannerOpen: false,
    qrVideoRef: createRef<HTMLVideoElement>(),
    onPairingInputChange: vi.fn(),
    onReviewPairing: vi.fn(),
    onConfirmPairing: vi.fn(),
    onCancelPairing: vi.fn(),
    onStartQrScanner: vi.fn(),
    onStopQrScanner: vi.fn(),
    onNavigateToReceiver: vi.fn(),
    ...overrides,
  };
  return render(<PairingPanel {...defaults} />);
}

describe('PairingPanel QR scanner overlay a11y', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the QR scanner with dialog role and aria-modal when open', () => {
    renderPairingPanel({ isQrScannerOpen: true });
    const dialog = screen.getByRole('dialog', { name: /qr code scanner/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('does not render a dialog role when scanner is closed', () => {
    renderPairingPanel({ isQrScannerOpen: false });
    expect(screen.queryByRole('dialog', { name: /qr code scanner/i })).not.toBeInTheDocument();
  });

  it('calls onStopQrScanner when Escape is pressed while scanner is open', async () => {
    const user = userEvent.setup();
    const onStopQrScanner = vi.fn();
    renderPairingPanel({ isQrScannerOpen: true, onStopQrScanner });
    await user.keyboard('{Escape}');
    expect(onStopQrScanner).toHaveBeenCalledOnce();
  });
});
