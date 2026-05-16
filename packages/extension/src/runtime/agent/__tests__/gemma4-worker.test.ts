import { describe, expect, it } from 'vitest';
import { canUseBrowserCache } from '../gemma4-worker';

describe('canUseBrowserCache', () => {
  it('uses browser cache when the runtime exposes cache storage', () => {
    expect(canUseBrowserCache({ caches: {} })).toBe(true);
  });

  it('disables browser cache when cache storage is missing', () => {
    expect(canUseBrowserCache({})).toBe(false);
  });

  it('disables browser cache when sandbox access throws', () => {
    const sandboxLikeScope = {};
    Object.defineProperty(sandboxLikeScope, 'caches', {
      get() {
        throw new Error('Cache storage is disabled.');
      },
    });

    expect(canUseBrowserCache(sandboxLikeScope)).toBe(false);
  });
});
