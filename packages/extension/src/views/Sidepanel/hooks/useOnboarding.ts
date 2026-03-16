import { useCallback, useEffect, useState } from 'react';
import { onboardingSteps } from '../OnboardingOverlay';

export const ONBOARDING_KEY = 'coop-onboarding-complete';

type OnboardingState = {
  /** Current step index, or null if onboarding is dismissed/complete. */
  step: number | null;
  /** True while the initial chrome.storage.sync check is in flight. */
  loading: boolean;
  /** Advance to the next step; auto-dismisses after the final step. */
  advance: () => void;
  /** Dismiss onboarding immediately and persist the flag. */
  dismiss: () => void;
};

export function useOnboarding(): OnboardingState {
  const [step, setStep] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: check chrome.storage.sync, migrate from localStorage if needed
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const result = await chrome.storage.sync.get(ONBOARDING_KEY);
        const synced = !!result[ONBOARDING_KEY];

        // One-time migration: localStorage -> chrome.storage.sync
        let localFlag = false;
        try {
          localFlag = !!localStorage.getItem(ONBOARDING_KEY);
        } catch {
          // localStorage unavailable
        }

        if (localFlag) {
          // Clean up localStorage regardless
          try {
            localStorage.removeItem(ONBOARDING_KEY);
          } catch {
            // best effort
          }

          if (!synced) {
            // Copy to chrome.storage.sync
            await chrome.storage.sync.set({ [ONBOARDING_KEY]: true });
          }
        }

        if (cancelled) return;
        // User has completed onboarding if either source had the flag
        setStep(synced || localFlag ? null : 0);
      } catch {
        // On failure, default to skipping onboarding (don't annoy returning users)
        if (!cancelled) {
          setStep(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistDismiss = useCallback(() => {
    try {
      chrome.storage.sync.set({ [ONBOARDING_KEY]: true });
    } catch {
      // storage unavailable
    }
  }, []);

  const advance = useCallback(() => {
    setStep((current) => {
      if (current === null) return null;
      const next = current + 1;
      if (next >= onboardingSteps.length) {
        persistDismiss();
        return null;
      }
      return next;
    });
  }, [persistDismiss]);

  const dismiss = useCallback(() => {
    setStep(null);
    persistDismiss();
  }, [persistDismiss]);

  return { step, loading, advance, dismiss };
}
