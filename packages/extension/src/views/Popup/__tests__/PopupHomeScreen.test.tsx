import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PopupHomeScreen } from '../PopupHomeScreen';

function renderHomeScreen(overrides: Partial<Parameters<typeof PopupHomeScreen>[0]> = {}) {
  const props: Parameters<typeof PopupHomeScreen>[0] = {
    statusItems: [],
    yardItems: [],
    noteText: 'Quick note',
    onChangeNote: vi.fn(),
    onSaveNote: vi.fn(),
    onPaste: vi.fn(),
    onRoundUp: vi.fn(),
    onCaptureTab: vi.fn(),
    onScreenshot: vi.fn(),
    onFileSelected: vi.fn(),
    isCapturing: false,
    isRoundupInFlight: false,
    isRecording: false,
    audioStatus: 'idle',
    elapsedSeconds: 0,
    onStartRecording: vi.fn(),
    onStopRecording: vi.fn(),
    onCancelRecording: vi.fn(),
    ...overrides,
  };

  return render(<PopupHomeScreen {...props} />);
}

describe('PopupHomeScreen', () => {
  it('keeps unrelated capture actions enabled while roundup is in flight', () => {
    renderHomeScreen({ isRoundupInFlight: true });

    expect(screen.getByRole('button', { name: 'Rounding up…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Capture Tab' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Screenshot' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Audio' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Files' })).toBeEnabled();
    expect(screen.getByLabelText('Note')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Paste' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save note' })).toBeEnabled();
  });

  it('still locks the quick-capture surface during a direct capture/save action', () => {
    renderHomeScreen({ isCapturing: true });

    expect(screen.getByRole('button', { name: 'Roundup Chickens' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Capture Tab' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Screenshot' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Audio' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Files' })).toBeDisabled();
    expect(screen.getByLabelText('Note')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Paste' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();
  });
});
