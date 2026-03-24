import type { SoundEvent, SoundPreferences } from '../../contracts/schema';

export interface ToneStep {
  frequency: number;
  durationMs: number;
  gain: number;
  type: OscillatorType;
}

export function shouldPlaySound(
  event: SoundEvent,
  preferences: SoundPreferences,
  explicitlyTriggered = true,
) {
  if (!preferences.enabled || preferences.reducedSound) {
    return false;
  }
  if (!explicitlyTriggered) {
    return false;
  }
  return [
    'coop-created',
    'artifact-published',
    'review-digest-ready',
    'action-awaiting-review',
    'capture-complete',
    'sound-test',
  ].includes(event);
}

export function soundPattern(event: SoundEvent): ToneStep[] {
  switch (event) {
    case 'coop-created':
      return [
        { frequency: 622, durationMs: 120, gain: 0.08, type: 'triangle' },
        { frequency: 830, durationMs: 180, gain: 0.12, type: 'square' },
        { frequency: 1047, durationMs: 280, gain: 0.08, type: 'sine' },
      ];
    case 'artifact-published':
      return [
        { frequency: 392, durationMs: 110, gain: 0.05, type: 'sine' },
        { frequency: 494, durationMs: 170, gain: 0.06, type: 'triangle' },
      ];
    case 'review-digest-ready':
      return [
        { frequency: 523, durationMs: 110, gain: 0.05, type: 'triangle' },
        { frequency: 659, durationMs: 140, gain: 0.06, type: 'triangle' },
        { frequency: 784, durationMs: 180, gain: 0.07, type: 'sine' },
      ];
    case 'action-awaiting-review':
      return [
        { frequency: 349, durationMs: 120, gain: 0.06, type: 'square' },
        { frequency: 415, durationMs: 120, gain: 0.06, type: 'square' },
        { frequency: 523, durationMs: 180, gain: 0.08, type: 'triangle' },
      ];
    case 'capture-complete':
      return [
        { frequency: 523, durationMs: 100, gain: 0.25, type: 'sine' },
        { frequency: 659, durationMs: 120, gain: 0.2, type: 'sine' },
      ];
    case 'sound-test':
      return [
        { frequency: 988, durationMs: 70, gain: 0.07, type: 'square' },
        { frequency: 740, durationMs: 70, gain: 0.06, type: 'square' },
        { frequency: 1047, durationMs: 90, gain: 0.07, type: 'triangle' },
      ];
    default:
      return [];
  }
}

export const defaultSoundPreferences: SoundPreferences = {
  enabled: true,
  reducedMotion: false,
  reducedSound: false,
};
