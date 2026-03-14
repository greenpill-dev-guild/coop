import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultHapticPreferences,
  hapticPattern,
  shouldFireHaptic,
  triggerHaptic,
} from '../haptics';

describe('haptics module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to disabled', () => {
    expect(defaultHapticPreferences.enabled).toBe(false);
    expect(defaultHapticPreferences.reducedMotion).toBe(false);
  });

  it('does not fire when disabled', () => {
    expect(shouldFireHaptic('pairing-confirmed', { enabled: false, reducedMotion: false })).toBe(
      false,
    );
  });

  it('does not fire when reducedMotion is true', () => {
    expect(shouldFireHaptic('pairing-confirmed', { enabled: true, reducedMotion: true })).toBe(
      false,
    );
  });

  it('fires for all known events when enabled', () => {
    const prefs = { enabled: true, reducedMotion: false };
    expect(shouldFireHaptic('pairing-confirmed', prefs)).toBe(true);
    expect(shouldFireHaptic('capture-saved', prefs)).toBe(true);
    expect(shouldFireHaptic('sync-completed', prefs)).toBe(true);
    expect(shouldFireHaptic('button-press', prefs)).toBe(true);
    expect(shouldFireHaptic('error', prefs)).toBe(true);
  });

  it('returns correct patterns for each event', () => {
    expect(hapticPattern('pairing-confirmed')).toEqual([50, 30, 80]);
    expect(hapticPattern('capture-saved')).toEqual([30]);
    expect(hapticPattern('sync-completed')).toEqual([40, 20, 40, 20, 60]);
    expect(hapticPattern('button-press')).toEqual([15]);
    expect(hapticPattern('error')).toEqual([100, 50, 100]);
  });

  it('calls navigator.vibrate with the correct pattern', () => {
    const vibrateMock = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate: vibrateMock });

    const result = triggerHaptic('pairing-confirmed', { enabled: true, reducedMotion: false });
    expect(result).toBe(true);
    expect(vibrateMock).toHaveBeenCalledWith([50, 30, 80]);
  });

  it('returns false when navigator.vibrate is unavailable', () => {
    vi.stubGlobal('navigator', {});

    const result = triggerHaptic('capture-saved', { enabled: true, reducedMotion: false });
    expect(result).toBe(false);
  });

  it('does not call vibrate when preferences are disabled', () => {
    const vibrateMock = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate: vibrateMock });

    triggerHaptic('error', { enabled: false, reducedMotion: false });
    expect(vibrateMock).not.toHaveBeenCalled();
  });
});
