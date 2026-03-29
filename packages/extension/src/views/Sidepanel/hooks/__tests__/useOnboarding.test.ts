import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ONBOARDING_KEY, useOnboarding } from '../useOnboarding';

// --- chrome.storage.sync mock ---

function createChromeStorageMock() {
  const store: Record<string, unknown> = {};
  return {
    store,
    sync: {
      get: vi.fn((key: string) => Promise.resolve({ [key]: store[key] })),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(store, items);
        return Promise.resolve();
      }),
    },
  };
}

let storageMock: ReturnType<typeof createChromeStorageMock>;

beforeEach(() => {
  storageMock = createChromeStorageMock();
  // biome-ignore lint/suspicious/noExplicitAny: chrome mock in test
  (globalThis as any).chrome = { storage: storageMock };
  localStorage.clear();
});

afterEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: chrome mock cleanup in test
  (globalThis as any).chrome = undefined;
  vi.restoreAllMocks();
});

describe('useOnboarding', () => {
  it('returns loading=true initially while checking chrome.storage.sync', () => {
    storageMock.sync.get.mockImplementationOnce(
      () => new Promise<Record<string, unknown>>(() => undefined),
    );
    const { result } = renderHook(() => useOnboarding());
    // Before the async check resolves, loading should be true
    expect(result.current.loading).toBe(true);
  });

  it('starts onboarding at step 0 for new users (no flag in storage)', async () => {
    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.step).toBe(0);
  });

  it('skips onboarding (step=null) if chrome.storage.sync has the flag', async () => {
    storageMock.store[ONBOARDING_KEY] = true;

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.step).toBeNull();
  });

  it('advances step on advance()', async () => {
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.advance());

    expect(result.current.step).toBe(1);
  });

  it('dismisses onboarding and writes to chrome.storage.sync on dismiss()', async () => {
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.dismiss());

    expect(result.current.step).toBeNull();
    expect(storageMock.sync.set).toHaveBeenCalledWith({ [ONBOARDING_KEY]: true });
  });

  it('dismisses automatically when advancing past the final step', async () => {
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Advance through all 3 steps (0 -> 1 -> 2 -> dismiss)
    act(() => result.current.advance()); // 0 -> 1
    act(() => result.current.advance()); // 1 -> 2
    act(() => result.current.advance()); // 2 -> dismiss

    expect(result.current.step).toBeNull();
    expect(storageMock.sync.set).toHaveBeenCalledWith({ [ONBOARDING_KEY]: true });
  });

  describe('localStorage migration', () => {
    it('migrates localStorage flag to chrome.storage.sync and removes it', async () => {
      localStorage.setItem(ONBOARDING_KEY, '1');

      const { result } = renderHook(() => useOnboarding());
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Should have written to chrome.storage.sync
      expect(storageMock.sync.set).toHaveBeenCalledWith({ [ONBOARDING_KEY]: true });
      // Should have removed from localStorage
      expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull();
      // User should be treated as having completed onboarding
      expect(result.current.step).toBeNull();
    });

    it('does not write to chrome.storage.sync if localStorage has no flag', async () => {
      const { result } = renderHook(() => useOnboarding());
      await waitFor(() => expect(result.current.loading).toBe(false));

      // sync.set should not have been called during init
      expect(storageMock.sync.set).not.toHaveBeenCalled();
    });

    it('is idempotent — migration does not run if chrome.storage.sync already has the flag', async () => {
      localStorage.setItem(ONBOARDING_KEY, '1');
      storageMock.store[ONBOARDING_KEY] = true;

      const { result } = renderHook(() => useOnboarding());
      await waitFor(() => expect(result.current.loading).toBe(false));

      // sync.set should not be called since chrome.storage.sync already has it
      expect(storageMock.sync.set).not.toHaveBeenCalled();
      // localStorage should still be cleaned up
      expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull();
      expect(result.current.step).toBeNull();
    });
  });

  it('handles chrome.storage.sync.get failure gracefully (falls back to no onboarding)', async () => {
    storageMock.sync.get.mockRejectedValueOnce(new Error('storage error'));

    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // On error, default to skipping onboarding (don't annoy returning users)
    expect(result.current.step).toBeNull();
  });
});
