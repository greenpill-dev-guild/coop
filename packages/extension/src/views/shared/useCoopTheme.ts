import { useEffect, useState } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'coop:popup-theme';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

function readSystemTheme(): ResolvedTheme {
  return window.matchMedia?.(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference;
}

function applyThemeToDocument(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.body.style.colorScheme = theme;
}

/**
 * Reads the shared coop theme preference from chrome.storage and applies
 * `data-theme` to the document root. Used by both popup and sidepanel to
 * ensure consistent theming driven by the app's own preference, not the OS.
 */
export function useCoopTheme() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);
  const [loading, setLoading] = useState(true);

  // Load from storage
  useEffect(() => {
    if (!hasChromeStorage()) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const result = await chrome.storage.local.get(THEME_STORAGE_KEY);
        const stored = result[THEME_STORAGE_KEY];
        if (!cancelled && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setPreference(stored);
        }
      } catch {
        // Fall back to system
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for storage changes (when popup changes theme)
  useEffect(() => {
    if (!hasChromeStorage()) {
      return;
    }

    function handleStorageChange(changes: Record<string, chrome.storage.StorageChange>) {
      const change = changes[THEME_STORAGE_KEY];
      if (
        change?.newValue === 'light' ||
        change?.newValue === 'dark' ||
        change?.newValue === 'system'
      ) {
        setPreference(change.newValue);
      }
    }

    chrome.storage.local.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.local.onChanged.removeListener(handleStorageChange);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const media = window.matchMedia?.(DARK_MEDIA_QUERY);
    if (!media) {
      return;
    }

    const handleChange = (event?: MediaQueryListEvent) => {
      setSystemTheme((event?.matches ?? media.matches) ? 'dark' : 'light');
    };

    handleChange();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const resolvedTheme = resolveTheme(preference, systemTheme);

  // Apply to document
  useEffect(() => {
    if (!loading) {
      applyThemeToDocument(resolvedTheme);
    }
  }, [loading, resolvedTheme]);

  const setTheme = (next: ThemePreference) => {
    setPreference(next);
    if (hasChromeStorage()) {
      void chrome.storage.local.set({ [THEME_STORAGE_KEY]: next });
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  };

  return { loading, resolvedTheme, preference, toggleTheme, setTheme };
}
