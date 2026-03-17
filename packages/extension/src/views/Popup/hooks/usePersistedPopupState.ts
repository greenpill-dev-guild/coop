import { useEffect, useState } from 'react';

export function usePersistedPopupState<T>(storageKey: string, initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const result = await chrome.storage.local.get(storageKey);
        if (!cancelled && result[storageKey]) {
          setState(result[storageKey] as T);
        }
      } catch {
        // Ignore popup state hydration failures and fall back to defaults.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (loading) {
      return;
    }

    void chrome.storage.local
      .set({
        [storageKey]: state,
      })
      .catch(() => {
        // Ignore popup state persistence failures.
      });
  }, [loading, state, storageKey]);

  return {
    state,
    loading,
    setState,
  };
}
