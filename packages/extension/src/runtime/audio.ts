import {
  type SoundEvent,
  type SoundPreferences,
  shouldPlaySound,
  soundPattern,
} from '@coop/shared';

let audioContext: AudioContext | null = null;

const soundFiles: Record<SoundEvent, { src: string; volume: number }> = {
  'coop-created': { src: '/audio/coop-rooster-call.wav', volume: 0.72 },
  'artifact-published': { src: '/audio/coop-soft-cluck.wav', volume: 0.62 },
  'review-digest-ready': { src: '/audio/coop-soft-cluck.wav', volume: 0.64 },
  'action-awaiting-review': { src: '/audio/coop-rooster-call.wav', volume: 0.68 },
  'capture-complete': { src: '/audio/coop-soft-cluck.wav', volume: 0.55 },
  'sound-test': { src: '/audio/coop-squeaky-test.wav', volume: 0.68 },
};

const chickenSoundEvents: SoundEvent[] = [
  'coop-created',
  'artifact-published',
  'review-digest-ready',
  'action-awaiting-review',
];

async function playSoundFile(event: SoundEvent) {
  const AudioCtor = globalThis.Audio as (new (src?: string) => HTMLAudioElement) | undefined;
  const sound = soundFiles[event];
  if (!sound || typeof AudioCtor !== 'function') {
    return false;
  }

  try {
    const audio = new AudioCtor(sound.src);
    audio.preload = 'auto';
    audio.volume = sound.volume;
    await Promise.resolve(audio.play());
    return true;
  } catch {
    return false;
  }
}

export async function playCoopSound(event: SoundEvent, preferences: SoundPreferences) {
  if (!shouldPlaySound(event, preferences, true)) {
    return;
  }

  if (await playSoundFile(event)) {
    return;
  }

  if (typeof AudioContext !== 'function') {
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

export async function playRandomChickenSound(preferences: SoundPreferences) {
  const index = Math.floor(Math.random() * chickenSoundEvents.length);
  const event = chickenSoundEvents[index] ?? chickenSoundEvents[0];
  if (!event) {
    return;
  }

  await playCoopSound(event, preferences);
}
