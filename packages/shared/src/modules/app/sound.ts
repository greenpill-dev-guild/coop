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
  return ['coop-created', 'artifact-published', 'sound-test'].includes(event);
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
  enabled: false,
  reducedMotion: false,
  reducedSound: false,
};
