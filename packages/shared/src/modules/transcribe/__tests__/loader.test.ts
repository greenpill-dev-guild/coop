import { afterEach, describe, expect, it, vi } from 'vitest';
import * as loader from '../loader';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('transcribe loader', () => {
  it('surfaces the missing dependency error when transformers is unavailable', async () => {
    await expect(loader.loadTransformers()).rejects.toThrow(/huggingface\/transformers/i);
  });

  it('reports availability when an injected loader resolves', async () => {
    const injectedLoader = vi.fn().mockResolvedValue({
      pipeline: vi.fn(),
    });

    await expect(loader.canLoadTransformers(injectedLoader)).resolves.toBe(true);
  });

  it('reports unavailability when the runtime loader rejects', async () => {
    const injectedLoader = vi.fn().mockRejectedValue(new Error('missing dependency'));

    await expect(loader.canLoadTransformers(injectedLoader)).resolves.toBe(false);
  });
});
