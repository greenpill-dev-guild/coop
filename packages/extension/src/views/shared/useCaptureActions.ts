import type { ReceiverCapture, SoundPreferences } from '@coop/shared';
import { useState } from 'react';
import { playCoopSound } from '../../runtime/audio';
import { sendRuntimeMessage } from '../../runtime/messages';

export function useCaptureActions(deps: {
  setMessage: (message: string) => void;
  loadDashboard: () => Promise<void>;
  afterManualCapture?: () => void;
  afterActiveTabCapture?: () => void;
  afterScreenshotCapture?: () => void;
  soundPreferences?: SoundPreferences;
}) {
  const {
    setMessage,
    loadDashboard,
    afterManualCapture,
    afterActiveTabCapture,
    afterScreenshotCapture,
    soundPreferences,
  } = deps;

  const [isCapturing, setIsCapturing] = useState(false);

  function playCaptureSound() {
    if (soundPreferences) {
      void playCoopSound('capture-complete', soundPreferences).catch(() => {});
    }
  }

  async function runManualCapture() {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const response = await sendRuntimeMessage<number>({ type: 'manual-capture' });
      setMessage(
        response.ok
          ? `Rounded up ${response.data ?? 0} tabs.`
          : (response.error ?? 'Roundup failed — try again.'),
      );
      if (response.ok) playCaptureSound();
      await loadDashboard();
      afterManualCapture?.();
    } finally {
      setIsCapturing(false);
    }
  }

  async function runActiveTabCapture() {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const response = await sendRuntimeMessage<number>({ type: 'capture-active-tab' });
      setMessage(response.ok ? 'Tab captured.' : (response.error ?? 'Could not capture this tab.'));
      if (response.ok) playCaptureSound();
      await loadDashboard();
      afterActiveTabCapture?.();
    } finally {
      setIsCapturing(false);
    }
  }

  async function captureVisibleScreenshot() {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const response = await sendRuntimeMessage<ReceiverCapture>({
        type: 'capture-visible-screenshot',
      });
      setMessage(
        response.ok
          ? 'Screenshot snapped.'
          : (response.error ?? 'Could not take screenshot — open a regular web page first.'),
      );
      if (response.ok) playCaptureSound();
      await loadDashboard();
      afterScreenshotCapture?.();
    } finally {
      setIsCapturing(false);
    }
  }

  async function captureFile(file: File) {
    if (isCapturing) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessage('This file is too large — 10 MB maximum.');
      return;
    }
    setIsCapturing(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const dataBase64 = btoa(binary);
      const response = await sendRuntimeMessage({
        type: 'capture-file',
        payload: {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64,
          byteSize: file.size,
        },
      });
      setMessage(
        response.ok ? 'File captured.' : (response.error ?? 'Could not capture file — try again.'),
      );
      if (response.ok) playCaptureSound();
      await loadDashboard();
    } finally {
      setIsCapturing(false);
    }
  }

  async function createNoteDraft(text: string): Promise<boolean> {
    if (isCapturing) return false;
    if (!text.trim()) return false;
    setIsCapturing(true);
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
    } finally {
      setIsCapturing(false);
    }
  }

  async function captureAudioBlob(blob: Blob, durationSeconds: number) {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const dataBase64 = btoa(binary);
      const fileName = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
      const response = await sendRuntimeMessage({
        type: 'capture-audio',
        payload: { dataBase64, mimeType: blob.type || 'audio/webm', durationSeconds, fileName },
      });
      setMessage(
        response.ok ? 'Voice note saved.' : (response.error ?? 'Could not save recording.'),
      );
      if (response.ok) playCaptureSound();
      await loadDashboard();
    } finally {
      setIsCapturing(false);
    }
  }

  return {
    runManualCapture,
    runActiveTabCapture,
    captureVisibleScreenshot,
    captureFile,
    createNoteDraft,
    captureAudioBlob,
    isCapturing,
  };
}
