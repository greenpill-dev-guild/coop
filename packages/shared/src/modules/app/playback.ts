import type { SoundEvent, SoundPreferences } from '../../contracts/schema';
import { shouldPlaySound, soundPattern } from './sound';

let audioContext: AudioContext | null = null;

export const soundFileMap: Record<SoundEvent, { fileName: string; volume: number }> = {
  'coop-created': { fileName: 'coop-rooster-call.mp3', volume: 0.72 },
  'artifact-published': { fileName: 'coop-soft-cluck.mp3', volume: 0.62 },
  'review-digest-ready': { fileName: 'coop-soft-cluck.mp3', volume: 0.64 },
  'action-awaiting-review': { fileName: 'coop-rooster-call.mp3', volume: 0.68 },
  'capture-complete': { fileName: 'coop-soft-cluck.mp3', volume: 0.55 },
  'sound-test': { fileName: 'coop-squeaky-test.mp3', volume: 0.68 },
};

async function playSoundFile(event: SoundEvent, basePath: string) {
  const AudioCtor = globalThis.Audio as (new (src?: string) => HTMLAudioElement) | undefined;
  const sound = soundFileMap[event];
  if (!sound || typeof AudioCtor !== 'function') {
    return false;
  }

  try {
    const src = `${basePath}/${sound.fileName}`;
    const audio = new AudioCtor(src);
    audio.preload = 'auto';
    audio.volume = sound.volume;
    await Promise.resolve(audio.play());
    return true;
  } catch {
    return false;
  }
}

export async function playCoopSound(
  event: SoundEvent,
  preferences: SoundPreferences,
  audioBasePath = '/audio',
) {
  if (!shouldPlaySound(event, preferences, true)) {
    return;
  }

  if (await playSoundFile(event, audioBasePath)) {
    return;
  }

  const context = audioContext ?? new AudioContext();
  audioContext = context;

  if (context.state === 'suspended') {
    await context.resume();
  }

  let offset = context.currentTime;
  for (const step of soundPattern(event)) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = step.type;
    oscillator.frequency.value = step.frequency;
    gain.gain.value = step.gain;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(offset);
    oscillator.stop(offset + step.durationMs / 1000);
    offset += step.durationMs / 1000;
  }
}
