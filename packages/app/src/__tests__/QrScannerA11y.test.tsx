import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RootApp, resetReceiverDb } from '../app';

class FakeBarcodeDetector {
  detect() {
    return Promise.resolve([]);
  }
}

const fakeStream = {
  getTracks: () => [{ stop: vi.fn() }],
};

describe('QR scanner overlay a11y', () => {
  const createObjectUrl = vi.fn(() => 'blob:receiver-preview');
  const originalCreateObjectUrl = URL.createObjectURL;
  let originalBarcodeDetector: unknown;

  beforeEach(async () => {
    await resetReceiverDb();
    window.history.pushState({}, '', '/pair');
    createObjectUrl.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });

    // HTMLVideoElement.play() returns undefined in happy-dom; stub it as a resolved Promise
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockResolvedValue(undefined);

    // Mock BarcodeDetector
    originalBarcodeDetector = (globalThis as Record<string, unknown>).BarcodeDetector;
    (globalThis as Record<string, unknown>).BarcodeDetector = FakeBarcodeDetector;

    // Mock getUserMedia
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn(() => Promise.resolve(fakeStream)) },
      });
    } else {
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(
        fakeStream as unknown as MediaStream,
      );
    }
  });

  afterEach(async () => {
    await resetReceiverDb();
    window.history.pushState({}, '', '/');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectUrl,
    });

    if (originalBarcodeDetector === undefined) {
      (globalThis as Record<string, unknown>).BarcodeDetector = undefined;
    } else {
      (globalThis as Record<string, unknown>).BarcodeDetector = originalBarcodeDetector;
    }
  });

  it('renders the QR scanner as a native dialog element when open', async () => {
    await act(async () => {
      render(<RootApp />);
    });

    const scanButton = screen.getByRole('button', { name: /scan qr/i });
    await act(async () => {
      scanButton.click();
    });

    const dialog = screen.getByRole('dialog', { name: /qr code scanner/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog.tagName).toBe('DIALOG');
  });

  it('does not render a dialog when scanner is closed', async () => {
    await act(async () => {
      render(<RootApp />);
    });

    expect(screen.queryByRole('dialog', { name: /qr code scanner/i })).not.toBeInTheDocument();
  });

  it('closes the scanner when Escape is pressed', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<RootApp />);
    });

    const scanButton = screen.getByRole('button', { name: /scan qr/i });
    await act(async () => {
      scanButton.click();
    });

    expect(screen.getByRole('dialog', { name: /qr code scanner/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: /qr code scanner/i })).not.toBeInTheDocument();
  });
});
