import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockOscillator = {
  connect: ReturnType<typeof vi.fn>;
  frequency: { value: number };
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  type: OscillatorType;
};

type MockGainNode = {
  connect: ReturnType<typeof vi.fn>;
  gain: { value: number };
};

const createdContexts: MockAudioContext[] = [];
const createdAudioElements: MockAudioElement[] = [];

class MockAudioElement {
  preload = 'none';
  src = '';
  volume = 1;
  play = vi.fn(async () => {});

  constructor(src?: string) {
    this.src = src ?? '';
    createdAudioElements.push(this);
  }
}

class MockAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 1;
  destination = { nodeType: 'destination' };
  oscillators: MockOscillator[] = [];
  gains: MockGainNode[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  createOscillator = vi.fn(() => {
    const oscillator: MockOscillator = {
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    this.oscillators.push(oscillator);
    return oscillator;
  });
  createGain = vi.fn(() => {
    const gain: MockGainNode = {
      gain: { value: 0 },
      connect: vi.fn(),
    };
    this.gains.push(gain);
    return gain;
  });

  constructor() {
    createdContexts.push(this);
  }
}

describe('extension audio playback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('AudioContext', MockAudioContext as unknown as typeof AudioContext);
    createdContexts.length = 0;
    createdAudioElements.length = 0;
    vi.stubGlobal('Audio', MockAudioElement as unknown as typeof Audio);
  });

  it('does nothing when sound playback is disabled', async () => {
    const { playCoopSound } = await import('../audio');

    await playCoopSound('coop-created', {
      enabled: false,
      reducedMotion: false,
      reducedSound: false,
    });

    expect(createdContexts).toHaveLength(0);
    expect(createdAudioElements).toHaveLength(0);
  }, 30_000);

  it('plays packaged coop audio files when Audio is available', async () => {
    const { playCoopSound } = await import('../audio');

    await playCoopSound('coop-created', {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    });

    expect(createdAudioElements).toHaveLength(1);
    expect(createdAudioElements[0]?.src).toBe('/audio/coop-rooster-call.wav');
    expect(createdAudioElements[0]?.volume).toBe(0.72);
    expect(createdAudioElements[0]?.play).toHaveBeenCalledTimes(1);
    expect(createdContexts).toHaveLength(0);
  }, 30_000);

  it('falls back to generated tones when packaged audio is unavailable', async () => {
    vi.stubGlobal('Audio', undefined as unknown as typeof Audio);
    const { playCoopSound } = await import('../audio');

    await playCoopSound('sound-test', {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    });

    expect(createdContexts).toHaveLength(1);
    expect(createdContexts[0]?.resume).toHaveBeenCalledTimes(1);
    expect(createdContexts[0]?.oscillators).toHaveLength(3);
    expect(createdContexts[0]?.gains).toHaveLength(3);
    expect(createdContexts[0]?.oscillators[0]?.start).toHaveBeenCalledWith(1);
    expect(createdContexts[0]?.oscillators[0]?.stop).toHaveBeenCalledWith(1.07);
  }, 30_000);
});
