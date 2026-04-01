import { type ReceiverCapture, type SoundPreferences, compressImage } from '@coop/shared';
import { useRef, useState } from 'react';
import { playCoopSound } from '../../runtime/audio';
import type { ActiveTabCaptureResult, PopupPreparedCapture } from '../../runtime/messages';
import { sendRuntimeMessage } from '../../runtime/messages';
import type { PopupPendingCapture } from '../Popup/popup-types';
import {
  preflightActiveTabCapture,
  preflightManualCapture,
  preflightScreenshotCapture,
  requestBroadHostAccess,
} from './capture-preflight';

const MANUAL_TAB_RECAPTURE_INTENT_WINDOW_MS = 12_000;

function normalizeActiveTabCaptureResult(
  result: ActiveTabCaptureResult | number | undefined,
): ActiveTabCaptureResult {
  if (typeof result === 'number') {
    return { capturedCount: result };
  }

  return result ?? { capturedCount: 0 };
}

export function useCaptureActions(deps: {
  setMessage: (message: string) => void;
  loadDashboard: () => Promise<void>;
  onManualCaptureNeedsPermission?: () => Promise<void> | void;
  afterManualCapture?: () => void;
  afterActiveTabCapture?: () => void;
  soundPreferences?: SoundPreferences;
}) {
  const {
    setMessage,
    loadDashboard,
    onManualCaptureNeedsPermission,
    afterManualCapture,
    afterActiveTabCapture,
    soundPreferences,
  } = deps;

  const [isCapturing, setIsCapturing] = useState(false);
  const [isRoundupInFlight, setIsRoundupInFlight] = useState(false);
  const captureActionInFlightRef = useRef(false);
  const roundupInFlightRef = useRef(false);
  const activeTabRecaptureArmedUntilRef = useRef(0);

  function playCaptureSound() {
    if (soundPreferences) {
      void playCoopSound('capture-complete', soundPreferences).catch(() => {});
    }
  }

  function sizeFromBase64(dataBase64: string) {
    return Math.ceil((dataBase64.length * 3) / 4);
  }

  function createPreviewUrl(blob: Blob) {
    return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : undefined;
  }

  function toEditableNote(note: string | undefined) {
    const trimmedNote = note?.trim() ?? '';
    return trimmedNote ? `${trimmedNote}\n\n` : '';
  }

  function beginCaptureAction() {
    if (captureActionInFlightRef.current) {
      return false;
    }
    captureActionInFlightRef.current = true;
    setIsCapturing(true);
    return true;
  }

  function endCaptureAction() {
    captureActionInFlightRef.current = false;
    setIsCapturing(false);
  }

  function beginRoundup() {
    if (roundupInFlightRef.current) {
      return false;
    }
    roundupInFlightRef.current = true;
    setIsRoundupInFlight(true);
    return true;
  }

  function endRoundup() {
    roundupInFlightRef.current = false;
    setIsRoundupInFlight(false);
  }

  function armActiveTabRecapture() {
    activeTabRecaptureArmedUntilRef.current = Date.now() + MANUAL_TAB_RECAPTURE_INTENT_WINDOW_MS;
  }

  function clearActiveTabRecapture() {
    activeTabRecaptureArmedUntilRef.current = 0;
  }

  function shouldAllowRecentDuplicateCapture() {
    return activeTabRecaptureArmedUntilRef.current > Date.now();
  }

  async function encodeBlobBase64(blob: Blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return btoa(binary);
  }

  function toSavePayload(
    pendingCapture: PopupPendingCapture,
    dataBase64: string,
  ): PopupPreparedCapture {
    return {
      kind: pendingCapture.kind,
      dataBase64,
      mimeType: pendingCapture.mimeType,
      fileName: pendingCapture.fileName,
      title: pendingCapture.title.trim() || 'Untitled capture',
      note: pendingCapture.note.trim(),
      sourceUrl: pendingCapture.sourceUrl,
      durationSeconds: pendingCapture.durationSeconds,
    };
  }

  async function runManualCapture() {
    if (roundupInFlightRef.current || captureActionInFlightRef.current) return;
    const preflight = await preflightManualCapture();

    if (!preflight.ok && preflight.needsPermission) {
      if (onManualCaptureNeedsPermission) {
        setMessage('Roundup needs site access. Finish setup in the workspace.');
        await onManualCaptureNeedsPermission();
        return;
      }

      const granted = await requestBroadHostAccess();
      if (!granted) {
        setMessage('Site access is needed to round up tabs. Please grant access and try again.');
        return;
      }
    } else if (!preflight.ok) {
      setMessage(preflight.error);
      return;
    }

    if (captureActionInFlightRef.current || !beginRoundup()) {
      return;
    }

    try {
      setMessage('Rounding up open tabs…');
      const response = await sendRuntimeMessage<number>({ type: 'manual-capture' });
      const capturedCount = response.data ?? 0;

      if (!response.ok) {
        setMessage(response.error ?? 'Roundup failed — try again.');
        return;
      }

      if (capturedCount > 0) {
        setMessage(`Rounded up ${capturedCount} ${capturedCount === 1 ? 'tab' : 'tabs'}.`);
        playCaptureSound();
        await loadDashboard();
        afterManualCapture?.();
        return;
      }

      setMessage('No eligible tabs were captured.');
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Roundup failed — try again.');
    } finally {
      endRoundup();
    }
  }

  async function runActiveTabCapture() {
    if (!beginCaptureAction()) return;
    const preflight = await preflightActiveTabCapture();
    if (!preflight.ok) {
      endCaptureAction();
      setMessage(preflight.error);
      return;
    }

    try {
      const allowRecentDuplicate = shouldAllowRecentDuplicateCapture();
      clearActiveTabRecapture();
      const response = await sendRuntimeMessage<ActiveTabCaptureResult>(
        allowRecentDuplicate
          ? {
              type: 'capture-active-tab',
              payload: { allowRecentDuplicate: true },
            }
          : { type: 'capture-active-tab' },
      );
      const captureResult = normalizeActiveTabCaptureResult(response.data);
      const capturedCount = captureResult.capturedCount;

      if (!response.ok) {
        setMessage(response.error ?? 'Could not capture this tab.');
        return;
      }

      if (capturedCount > 0) {
        setMessage('Tab captured.');
        playCaptureSound();
        await loadDashboard();
        afterActiveTabCapture?.();
        return;
      }

      if (captureResult.duplicateSuppressed) {
        armActiveTabRecapture();
        setMessage('Captured this tab a moment ago. Choose Capture Tab again to recapture it now.');
        await loadDashboard();
        return;
      }

      setMessage('Could not pull fresh context from this tab. Try again.');
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not capture this tab.');
    } finally {
      endCaptureAction();
    }
  }

  async function prepareVisibleScreenshot() {
    if (!beginCaptureAction()) return null;
    const preflight = await preflightScreenshotCapture();
    if (!preflight.ok) {
      endCaptureAction();
      setMessage(preflight.error);
      return null;
    }

    try {
      const response = await sendRuntimeMessage<PopupPreparedCapture>({
        type: 'prepare-visible-screenshot',
      });
      if (!response.ok || !response.data) {
        setMessage(response.error ?? 'Could not take a screenshot — try again.');
        return null;
      }

      return {
        kind: response.data.kind,
        title: response.data.title,
        note: toEditableNote(response.data.note),
        mimeType: response.data.mimeType,
        fileName: response.data.fileName,
        sourceUrl: response.data.sourceUrl,
        durationSeconds: response.data.durationSeconds,
        byteSize: sizeFromBase64(response.data.dataBase64),
        dataBase64: response.data.dataBase64,
        previewUrl: `data:${response.data.mimeType};base64,${response.data.dataBase64}`,
      } satisfies PopupPendingCapture;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not take a screenshot.');
      return null;
    } finally {
      endCaptureAction();
    }
  }

  async function prepareFileCapture(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setMessage('This file is too large — 10 MB maximum.');
      return null;
    }

    const isImage = file.type.startsWith('image/');
    const COMPRESS_THRESHOLD = 2 * 1024 * 1024; // 2 MB

    let resultBlob: Blob = file;
    let resultMime = file.type || 'application/octet-stream';

    if (isImage && file.size > COMPRESS_THRESHOLD) {
      try {
        const compressed = await compressImage({ blob: file });
        resultBlob = compressed.blob;
        resultMime = compressed.blob.type || 'image/webp';
      } catch (err) {
        console.warn('[prepareFileCapture] Image compression failed, using original:', err);
      }
    }

    return {
      kind: 'file',
      title: file.name || 'File capture',
      note: '',
      mimeType: resultMime,
      fileName: file.name,
      byteSize: resultBlob.size,
      blob: resultBlob,
      previewUrl:
        isImage || resultMime.startsWith('audio/') ? createPreviewUrl(resultBlob) : undefined,
    } satisfies PopupPendingCapture;
  }

  async function createNoteDraft(text: string): Promise<boolean> {
    if (!text.trim()) return false;
    if (!beginCaptureAction()) return false;
    try {
      const response = await sendRuntimeMessage({
        type: 'create-note-draft',
        payload: { text },
      });
      setMessage(
        response.ok
          ? 'Note hatched into your roost.'
          : (response.error ?? 'Could not save note — try again.'),
      );
      if (response.ok) playCaptureSound();
      await loadDashboard();
      return response.ok;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save note — try again.');
      return false;
    } finally {
      endCaptureAction();
    }
  }

  async function prepareAudioCapture(blob: Blob, durationSeconds: number) {
    return {
      kind: 'audio',
      title: 'Voice note',
      note: '',
      mimeType: blob.type || 'audio/webm',
      fileName: `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`,
      durationSeconds,
      byteSize: blob.size,
      blob,
      previewUrl: createPreviewUrl(blob),
    } satisfies PopupPendingCapture;
  }

  async function savePendingCapture(pendingCapture: PopupPendingCapture) {
    if (!beginCaptureAction()) return false;
    try {
      const dataBase64 =
        pendingCapture.dataBase64 ??
        (pendingCapture.blob ? await encodeBlobBase64(pendingCapture.blob) : null);

      if (!dataBase64) {
        setMessage('Could not prepare this capture for saving.');
        return false;
      }

      const response = await sendRuntimeMessage<ReceiverCapture>({
        type: 'save-popup-capture',
        payload: toSavePayload(pendingCapture, dataBase64),
      });

      if (!response.ok) {
        setMessage(response.error ?? 'Could not save this capture.');
        return false;
      }

      const successMessage =
        pendingCapture.kind === 'photo'
          ? 'Screenshot saved as draft.'
          : pendingCapture.kind === 'file'
            ? 'File saved as draft.'
            : 'Voice note saved as draft.';

      setMessage(successMessage);
      playCaptureSound();
      await loadDashboard();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this capture.');
      return false;
    } finally {
      endCaptureAction();
    }
  }

  async function saveAudioCaptureDirect(blob: Blob, durationSeconds: number, title = 'Voice note') {
    const pendingCapture = await prepareAudioCapture(blob, durationSeconds);
    if (!pendingCapture) {
      return false;
    }

    pendingCapture.title = title;
    return savePendingCapture(pendingCapture);
  }

  return {
    runManualCapture,
    runActiveTabCapture,
    prepareVisibleScreenshot,
    prepareFileCapture,
    prepareAudioCapture,
    savePendingCapture,
    saveAudioCaptureDirect,
    createNoteDraft,
    isCapturing,
    isRoundupInFlight,
  };
}
