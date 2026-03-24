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

describe('shared playback module', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('AudioContext', MockAudioContext as unknown as typeof AudioContext);
    createdContexts.length = 0;
    createdAudioElements.length = 0;
    vi.stubGlobal('Audio', MockAudioElement as unknown as typeof Audio);
  });

  it('does nothing when sound is disabled', async () => {
    const { playCoopSound } = await import('../playback');
    await playCoopSound('coop-created', {
      enabled: false,
      reducedMotion: false,
      reducedSound: false,
    });
    expect(createdAudioElements).toHaveLength(0);
    expect(createdContexts).toHaveLength(0);
  }, 30_000);

  it('plays MP3 files at correct volume with default base path', async () => {
    const { playCoopSound } = await import('../playback');
    await playCoopSound('coop-created', {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    });
    expect(createdAudioElements).toHaveLength(1);
    expect(createdAudioElements[0]?.src).toBe('/audio/coop-rooster-call.mp3');
    expect(createdAudioElements[0]?.volume).toBe(0.72);
  }, 30_000);

  it('respects custom audio base path', async () => {
    const { playCoopSound } = await import('../playback');
    await playCoopSound(
      'artifact-published',
      { enabled: true, reducedMotion: false, reducedSound: false },
      '/custom/path',
    );
    expect(createdAudioElements[0]?.src).toBe('/custom/path/coop-soft-cluck.mp3');
    expect(createdAudioElements[0]?.volume).toBe(0.62);
  }, 30_000);

  it('falls back to synthesized tones when Audio is unavailable', async () => {
    vi.stubGlobal('Audio', undefined as unknown as typeof Audio);
    const { playCoopSound } = await import('../playback');
    await playCoopSound('sound-test', {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    });
    expect(createdContexts).toHaveLength(1);
    expect(createdContexts[0]?.oscillators).toHaveLength(3);
  }, 30_000);

  it('does not play when reducedSound is true', async () => {
    const { playCoopSound } = await import('../playback');
    await playCoopSound('coop-created', {
      enabled: true,
      reducedMotion: false,
      reducedSound: true,
    });
    expect(createdAudioElements).toHaveLength(0);
    expect(createdContexts).toHaveLength(0);
  }, 30_000);

  it('exports soundFileMap with all six events', async () => {
    const { soundFileMap } = await import('../playback');
    expect(Object.keys(soundFileMap)).toEqual([
      'coop-created',
      'artifact-published',
      'review-digest-ready',
      'action-awaiting-review',
      'capture-complete',
      'sound-test',
    ]);
    for (const entry of Object.values(soundFileMap)) {
      expect(entry.fileName).toMatch(/\.mp3$/);
      expect(entry.volume).toBeGreaterThan(0);
      expect(entry.volume).toBeLessThanOrEqual(1);
    }
  }, 30_000);
});
