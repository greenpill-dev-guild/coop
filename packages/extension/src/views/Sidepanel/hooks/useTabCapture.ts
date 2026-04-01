import type { CaptureExclusionCategory, ReceiverCapture, UiPreferences } from '@coop/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveTabCaptureResult } from '../../../runtime/messages';
import { sendRuntimeMessage } from '../../../runtime/messages';
import {
  hasBroadHostAccess,
  preflightActiveTabCapture,
  preflightManualCapture,
  preflightScreenshotCapture,
  requestBroadHostAccess,
} from '../../shared/capture-preflight';
import type { SidepanelTab } from '../sidepanel-tabs';

const MANUAL_TAB_RECAPTURE_INTENT_WINDOW_MS = 12_000;

function normalizeActiveTabCaptureResult(
  result: ActiveTabCaptureResult | number | undefined,
): ActiveTabCaptureResult {
  if (typeof result === 'number') {
    return { capturedCount: result };
  }

  return result ?? { capturedCount: 0 };
}

export function useTabCapture(deps: {
  setMessage: (msg: string) => void;
  setPanelTab: (tab: SidepanelTab) => void;
  loadDashboard: () => Promise<void>;
}) {
  const { setMessage, setPanelTab, loadDashboard } = deps;
  const [roundupAccessStatus, setRoundupAccessStatus] = useState<
    'checking' | 'granted' | 'missing'
  >('checking');
  const [requestingRoundupAccess, setRequestingRoundupAccess] = useState(false);
  const activeTabRecaptureArmedUntilRef = useRef(0);

  const refreshRoundupAccess = useCallback(async () => {
    const hasAccess = await hasBroadHostAccess();
    setRoundupAccessStatus(hasAccess ? 'granted' : 'missing');
    return hasAccess;
  }, []);

  useEffect(() => {
    void refreshRoundupAccess();
  }, [refreshRoundupAccess]);

  async function requestRoundupAccess(options: { runRoundupAfterGrant?: boolean } = {}) {
    const { runRoundupAfterGrant = false } = options;

    if (requestingRoundupAccess) {
      return false;
    }

    if (await refreshRoundupAccess()) {
      if (runRoundupAfterGrant) {
        await runManualCapture();
      }
      return true;
    }

    setRequestingRoundupAccess(true);
    try {
      const granted = await requestBroadHostAccess();
      setRoundupAccessStatus(granted ? 'granted' : 'missing');

      if (!granted) {
        setMessage('Site access is needed to round up tabs. Please grant access and try again.');
        return false;
      }

      await loadDashboard();

      if (runRoundupAfterGrant) {
        await runManualCapture();
      } else {
        setMessage('Roundup site access enabled. Coop can now inspect tabs locally on demand.');
      }

      return true;
    } finally {
      setRequestingRoundupAccess(false);
    }
  }

  async function runManualCapture() {
    const preflight = await preflightManualCapture();
    if (!preflight.ok && preflight.needsPermission) {
      const granted = await requestRoundupAccess();
      if (!granted) {
        return;
      }
    } else if (!preflight.ok) {
      setMessage(preflight.error);
      return;
    }

    try {
      const response = await sendRuntimeMessage<number>({ type: 'manual-capture' });
      if (!response.ok) {
        setMessage(response.error ?? 'Round-up failed.');
        return;
      }

      if ((response.data ?? 0) > 0) {
        setMessage(`Round-up complete. Coop checked ${response.data ?? 0} tabs locally.`);
        setPanelTab('chickens');
      } else {
        setMessage('No eligible tabs were captured.');
      }
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Round-up failed.');
    }
  }

  async function runActiveTabCapture() {
    const preflight = await preflightActiveTabCapture();
    if (!preflight.ok) {
      setMessage(preflight.error);
      return;
    }

    try {
      const allowRecentDuplicate = activeTabRecaptureArmedUntilRef.current > Date.now();
      activeTabRecaptureArmedUntilRef.current = 0;
      const response = await sendRuntimeMessage<ActiveTabCaptureResult>(
        allowRecentDuplicate
          ? {
              type: 'capture-active-tab',
              payload: { allowRecentDuplicate: true },
            }
          : { type: 'capture-active-tab' },
      );
      const captureResult = normalizeActiveTabCaptureResult(response.data);
      if (!response.ok) {
        setMessage(response.error ?? 'This-tab round-up failed.');
        return;
      }

      if (captureResult.capturedCount > 0) {
        setMessage(
          `This tab was rounded up locally. Coop checked ${captureResult.capturedCount} tab.`,
        );
        setPanelTab('chickens');
      } else if (captureResult.duplicateSuppressed) {
        activeTabRecaptureArmedUntilRef.current =
          Date.now() + MANUAL_TAB_RECAPTURE_INTENT_WINDOW_MS;
        setMessage('Captured this tab a moment ago. Choose Capture Tab again to recapture it now.');
      } else {
        setMessage('Could not pull fresh context from this tab. Try again.');
      }
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This-tab round-up failed.');
    }
  }

  async function captureVisibleScreenshotAction() {
    const preflight = await preflightScreenshotCapture();
    if (!preflight.ok) {
      setMessage(preflight.error);
      return;
    }

    try {
      const response = await sendRuntimeMessage<ReceiverCapture>({
        type: 'capture-visible-screenshot',
      });
      setMessage(
        response.ok
          ? 'This page was snapped into Pocket Coop finds.'
          : (response.error ?? 'Screenshot capture failed.'),
      );
      if (response.ok) {
        setPanelTab('nest');
        await loadDashboard();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Screenshot capture failed.');
    }
  }

  async function updateAgentCadence(agentCadenceMinutes: UiPreferences['agentCadenceMinutes']) {
    const currentPreferences = await sendRuntimeMessage<UiPreferences>({
      type: 'get-ui-preferences',
    });
    if (!currentPreferences.ok || !currentPreferences.data) {
      setMessage(currentPreferences.error ?? 'Could not load settings.');
      return;
    }
    const response = await sendRuntimeMessage<UiPreferences>({
      type: 'set-ui-preferences',
      payload: {
        ...currentPreferences.data,
        agentCadenceMinutes,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update agent cadence.');
      return;
    }
    setMessage(`Agent cadence updated to ${formatAgentCadence(agentCadenceMinutes)}.`);
    await loadDashboard();
  }

  async function updateExcludedCategories(excludedCategories: CaptureExclusionCategory[]) {
    const currentPreferences = await sendRuntimeMessage<UiPreferences>({
      type: 'get-ui-preferences',
    });
    if (!currentPreferences.ok || !currentPreferences.data) {
      setMessage(currentPreferences.error ?? 'Could not load settings.');
      return;
    }
    const response = await sendRuntimeMessage<UiPreferences>({
      type: 'set-ui-preferences',
      payload: { ...currentPreferences.data, excludedCategories },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update exclusions.');
      return;
    }
    await loadDashboard();
  }

  async function updateCustomExcludedDomains(customExcludedDomains: string[]) {
    const currentPreferences = await sendRuntimeMessage<UiPreferences>({
      type: 'get-ui-preferences',
    });
    if (!currentPreferences.ok || !currentPreferences.data) {
      setMessage(currentPreferences.error ?? 'Could not load settings.');
      return;
    }
    const response = await sendRuntimeMessage<UiPreferences>({
      type: 'set-ui-preferences',
      payload: { ...currentPreferences.data, customExcludedDomains },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update custom domains.');
      return;
    }
    await loadDashboard();
  }

  async function toggleCaptureOnClose(captureOnClose: boolean) {
    const currentPreferences = await sendRuntimeMessage<UiPreferences>({
      type: 'get-ui-preferences',
    });
    if (!currentPreferences.ok || !currentPreferences.data) {
      setMessage(currentPreferences.error ?? 'Could not load settings.');
      return;
    }
    const response = await sendRuntimeMessage<UiPreferences>({
      type: 'set-ui-preferences',
      payload: { ...currentPreferences.data, captureOnClose },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update capture-on-close setting.');
      return;
    }
    setMessage(
      captureOnClose ? 'Closing tabs will now be captured.' : 'Capture on tab close disabled.',
    );
    await loadDashboard();
  }

  return {
    runManualCapture,
    runActiveTabCapture,
    captureVisibleScreenshotAction,
    refreshRoundupAccess,
    requestRoundupAccess,
    requestingRoundupAccess,
    roundupAccessStatus,
    updateAgentCadence,
    updateExcludedCategories,
    updateCustomExcludedDomains,
    toggleCaptureOnClose,
  };
}

function formatAgentCadence(minutes: UiPreferences['agentCadenceMinutes']) {
  return `${minutes} min`;
}
