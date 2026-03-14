import type { HapticEvent, HapticPreferences } from '../../contracts/schema';

export const defaultHapticPreferences: HapticPreferences = {
  enabled: false,
  reducedMotion: false,
};

/** Vibration patterns in ms: [vibrate, pause, vibrate, ...] */
const hapticPatterns: Record<HapticEvent, number[]> = {
  'pairing-confirmed': [50, 30, 80],
  'capture-saved': [30],
  'sync-completed': [40, 20, 40, 20, 60],
  'button-press': [15],
  error: [100, 50, 100],
};

export function shouldFireHaptic(event: HapticEvent, preferences: HapticPreferences): boolean {
  if (!preferences.enabled || preferences.reducedMotion) {
    return false;
  }
  return event in hapticPatterns;
}

export function hapticPattern(event: HapticEvent): number[] {
  return hapticPatterns[event] ?? [];
}

export function triggerHaptic(event: HapticEvent, preferences: HapticPreferences): boolean {
  if (!shouldFireHaptic(event, preferences)) {
    return false;
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    return navigator.vibrate(hapticPatterns[event]);
  }

  return false;
}
