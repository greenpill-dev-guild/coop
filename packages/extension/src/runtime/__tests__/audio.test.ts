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
  });

  it('does nothing when sound playback is disabled', async () => {
    const { playCoopSound } = await import('../audio');

    await playCoopSound('coop-created', {
      enabled: false,
      reducedMotion: false,
      reducedSound: false,
    });

    expect(createdContexts).toHaveLength(0);
  }, 30_000);

  it('creates oscillators and resumes the audio context for explicit sound events', async () => {
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
