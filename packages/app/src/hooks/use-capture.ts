import {
  type HapticPreferences,
  type ReceiverCapture,
  type ReceiverPairingRecord,
  type SoundPreferences,
  createReceiverCapture,
  createReceiverLinkCapture,
  getActiveReceiverPairing,
  getReceiverCaptureBlob,
  getReceiverPairingStatus,
  listReceiverCaptures,
  playCoopSound,
  saveReceiverCapture,
  triggerHaptic,
} from '@coop/shared';
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { receiverDb as ReceiverDbType } from '../app';
import type { ReceiverShareHandoff } from '../share-handoff';
import type { CaptureCard } from '../views/Receiver';

type NavigatorWithUx = Navigator & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

function createPreviewUrl(blob: Blob) {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : undefined;
}

function revokePreviewUrl(previewUrl?: string) {
  if (previewUrl && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(previewUrl);
  }
}

async function materializeCaptureCards(db: typeof ReceiverDbType) {
  const captures = await listReceiverCaptures(db);
  return Promise.all(
    captures.map(async (capture) => {
      const blob = await getReceiverCaptureBlob(db, capture.id);
      if (!blob) {
        return { capture } satisfies CaptureCard;
      }
      return {
        capture,
        previewUrl: createPreviewUrl(blob),
      } satisfies CaptureCard;
    }),
  );
}

export type CaptureState = {
  captures: CaptureCard[];
  newestCapture: ReceiverCapture | undefined;
  hatchedCaptureId: string | null;
  isRecording: boolean;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  capturesRef: React.RefObject<CaptureCard[]>;
  stashCapture: (input: {
    blob: Blob;
    kind: ReceiverCapture['kind'];
    fileName?: string;
    title?: string;
  }) => Promise<void>;
  stashSharedLink: (input: ReceiverShareHandoff) => Promise<void>;
  startRecording: () => Promise<void>;
  finishRecording: (mode: 'save' | 'cancel') => void;
  onPickFile: (event: ChangeEvent<HTMLInputElement>, kind: 'photo' | 'file') => Promise<void>;
  shareCapture: (card: CaptureCard) => Promise<void>;
  copyCaptureLink: (capture: ReceiverCapture) => Promise<void>;
  downloadCapture: (card: CaptureCard) => Promise<void>;
  refreshCaptures: () => Promise<CaptureCard[]>;
};

/**
 * All cross-hook callbacks are accessed through refs to avoid stale closures
 * and dependency cascades. The refs are kept in sync via effects in app.tsx.
 */
export function useCapture(
  db: typeof ReceiverDbType,
  deps: {
    isMountedRef: React.RefObject<boolean>;
    ensureDeviceIdentityRef: React.RefObject<() => Promise<{ id: string }>>;
    soundPreferencesRef: React.RefObject<SoundPreferences>;
    hapticPreferencesRef: React.RefObject<HapticPreferences>;
    setMessage: (message: string) => void;
    reconcilePairingRef: React.RefObject<() => Promise<void>>;
    pairingRef: React.RefObject<ReceiverPairingRecord | null>;
    refreshLocalStateRef: React.RefObject<() => Promise<void>>;
  },
): CaptureState {
  const {
    isMountedRef,
    ensureDeviceIdentityRef,
    soundPreferencesRef,
    hapticPreferencesRef,
    setMessage,
    reconcilePairingRef,
    pairingRef,
    refreshLocalStateRef,
  } = deps;

  const [captures, setCaptures] = useState<CaptureCard[]>([]);
  const [hatchedCaptureId, setHatchedCaptureId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recorderCommitRef = useRef<'save' | 'cancel'>('save');
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const capturesRef = useRef<CaptureCard[]>([]);

  const newestCapture = captures[0]?.capture;

  const refreshCaptures = useCallback(async () => {
    const nextCards = await materializeCaptureCards(db);
    if (!isMountedRef.current) {
      for (const card of nextCards) {
        revokePreviewUrl(card.previewUrl);
      }
      return nextCards;
    }
    setCaptures((current) => {
      for (const card of current) {
        revokePreviewUrl(card.previewUrl);
      }
      return nextCards;
    });
    return nextCards;
  }, [db, isMountedRef]);

  const stashCapture = useCallback(
    async (input: {
      blob: Blob;
      kind: ReceiverCapture['kind'];
      fileName?: string;
      title?: string;
    }) => {
      try {
        const device = await ensureDeviceIdentityRef.current();
        const activePairing = pairingRef.current ?? (await getActiveReceiverPairing(db));
        const activePairingStatus = activePairing ? getReceiverPairingStatus(activePairing) : null;
        const usablePairing = activePairingStatus?.status === 'ready' ? activePairing : null;
        const capture = createReceiverCapture({
          deviceId: device.id,
          kind: input.kind,
          blob: input.blob,
          fileName: input.fileName,
          title: input.title,
          pairing: usablePairing,
        });

        await saveReceiverCapture(db, capture, input.blob);
        if (!isMountedRef.current) {
          return;
        }
        setHatchedCaptureId(capture.id);
        void playCoopSound('artifact-published', soundPreferencesRef.current).catch(() => {});
        triggerHaptic('capture-saved', hapticPreferencesRef.current);
        setMessage(
          usablePairing
            ? 'Nest item saved locally and queued for sync.'
            : activePairingStatus?.status === 'expired'
              ? 'Nest item saved locally. The current nest code expired, so it stayed local until you join with a fresh one.'
              : activePairingStatus?.status === 'invalid'
                ? 'Nest item saved locally. The current nest code is invalid, so it stayed local until you join with a fresh one.'
                : activePairingStatus?.status === 'missing-signaling'
                  ? 'Nest item saved locally. This nest code has no usable signaling path yet, so sync is blocked for now.'
                  : activePairingStatus?.status === 'inactive'
                    ? 'Nest item saved locally. This nest code is inactive, so it stayed local until you reactivate or replace it.'
                    : 'Nest item saved locally. Pair with a coop when you are ready to sync.',
        );
        await refreshLocalStateRef.current();
        if (usablePairing) {
          await reconcilePairingRef.current();
        }
      } catch (error) {
        if (isMountedRef.current) {
          setMessage(error instanceof Error ? error.message : 'Could not save this nest item.');
        }
      }
    },
    [
      db,
      ensureDeviceIdentityRef,
      hapticPreferencesRef,
      isMountedRef,
      pairingRef,
      reconcilePairingRef,
      refreshLocalStateRef,
      setMessage,
      soundPreferencesRef,
    ],
  );

  const stashSharedLink = useCallback(
    async (input: ReceiverShareHandoff) => {
      try {
        const device = await ensureDeviceIdentityRef.current();
        const activePairing = pairingRef.current ?? (await getActiveReceiverPairing(db));
        const activePairingStatus = activePairing ? getReceiverPairingStatus(activePairing) : null;
        const usablePairing = activePairingStatus?.status === 'ready' ? activePairing : null;
        const { capture, blob } = createReceiverLinkCapture({
          deviceId: device.id,
          title: input.title,
          note: input.note,
          sourceUrl: input.sourceUrl,
          pairing: usablePairing,
        });

        await saveReceiverCapture(db, capture, blob);
        if (!isMountedRef.current) {
          return;
        }
        setHatchedCaptureId(capture.id);
        void playCoopSound('artifact-published', soundPreferencesRef.current).catch(() => {});
        triggerHaptic('capture-saved', hapticPreferencesRef.current);
        setMessage(
          usablePairing
            ? 'Shared link saved locally and queued for sync.'
            : 'Shared link saved locally. Pair with a coop when you are ready to sync it.',
        );
        await refreshLocalStateRef.current();
        if (usablePairing) {
          await reconcilePairingRef.current();
        }
      } catch (error) {
        if (isMountedRef.current) {
          setMessage(error instanceof Error ? error.message : 'Could not save the shared link.');
        }
      }
    },
    [
      db,
      ensureDeviceIdentityRef,
      hapticPreferencesRef,
      isMountedRef,
      pairingRef,
      reconcilePairingRef,
      refreshLocalStateRef,
      setMessage,
      soundPreferencesRef,
    ],
  );

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('This browser cannot record audio here yet.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }
      const recorder = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      recorderCommitRef.current = 'save';
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recorderChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        for (const track of stream.getTracks()) {
          track.stop();
        }
        recorderStreamRef.current = null;
        recorderRef.current = null;
        recorderChunksRef.current = [];
        if (wakeLockRef.current) {
          await wakeLockRef.current.release().catch(() => undefined);
          wakeLockRef.current = null;
        }

        if (recorderCommitRef.current === 'save' && blob.size > 0) {
          await stashCapture({
            blob,
            kind: 'audio',
            fileName: `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`,
            title: 'Voice note',
          });
        } else if (isMountedRef.current) {
          setMessage('Recording canceled before it hatched.');
        }
      };

      recorder.start(250);
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {
          wakeLockRef.current = null;
        }
      }
      setIsRecording(true);
      setMessage('Recording into the nest\u2026');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start recording.');
    }
  }, [isMountedRef, setMessage, stashCapture]);

  const finishRecording = useCallback((mode: 'save' | 'cancel') => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') {
      return;
    }
    recorderCommitRef.current = mode;
    recorderRef.current.stop();
    setIsRecording(false);
  }, []);

  const onPickFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>, kind: 'photo' | 'file') => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      await stashCapture({ blob: file, kind, fileName: file.name });
    },
    [stashCapture],
  );

  const shareCapture = useCallback(
    async (card: CaptureCard) => {
      const shareNavigator = navigator as NavigatorWithUx;
      if (!shareNavigator.share) {
        setMessage('Web Share is not available in this browser.');
        return;
      }

      try {
        if (card.capture.kind === 'link') {
          await shareNavigator.share({
            title: card.capture.title,
            text: card.capture.note || card.capture.sourceUrl || card.capture.title,
            url: card.capture.sourceUrl,
          });
          return;
        }

        const blob = await getReceiverCaptureBlob(db, card.capture.id);
        if (!blob) {
          throw new Error('Missing local capture blob.');
        }

        const file = new File([blob], card.capture.fileName ?? card.capture.title, {
          type: card.capture.mimeType,
        });
        const shareData = {
          title: card.capture.title,
          text: card.capture.note || card.capture.title,
          files: [file],
        } satisfies ShareData;

        if (shareNavigator.canShare && !shareNavigator.canShare(shareData)) {
          throw new Error('This browser can share links here, but not local files.');
        }

        await shareNavigator.share(shareData);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not share this nest item.');
      }
    },
    [db, setMessage],
  );

  const copyCaptureLink = useCallback(
    async (capture: ReceiverCapture) => {
      if (!capture.sourceUrl) {
        setMessage('No source link is available for this capture.');
        return;
      }
      if (!navigator.clipboard?.writeText) {
        setMessage('Clipboard access is unavailable in this browser.');
        return;
      }
      try {
        await navigator.clipboard.writeText(capture.sourceUrl);
        setMessage('Link copied to the clipboard.');
      } catch {
        setMessage('Could not copy the link.');
      }
    },
    [setMessage],
  );

  const downloadCapture = useCallback(
    async (card: CaptureCard) => {
      if (!card.previewUrl) {
        setMessage('This nest item is missing its local preview.');
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = card.previewUrl;
      anchor.download =
        card.capture.fileName ??
        `${card.capture.title.toLowerCase().replace(/[^a-z0-9]+/giu, '-') || 'coop-capture'}`;
      anchor.click();
    },
    [setMessage],
  );

  // Keep capturesRef in sync
  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  // Hatch animation timer
  useEffect(() => {
    for (const card of captures) {
      if (card.capture.id === hatchedCaptureId) {
        const timer = window.setTimeout(() => setHatchedCaptureId(null), 2400);
        return () => window.clearTimeout(timer);
      }
    }
  }, [captures, hatchedCaptureId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const card of capturesRef.current) {
        revokePreviewUrl(card.previewUrl);
      }
      const stream = recorderStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => undefined);
      }
    };
  }, []);

  return {
    captures,
    newestCapture,
    hatchedCaptureId,
    isRecording,
    photoInputRef,
    fileInputRef,
    capturesRef,
    stashCapture,
    stashSharedLink,
    startRecording,
    finishRecording,
    onPickFile,
    shareCapture,
    copyCaptureLink,
    downloadCapture,
    refreshCaptures,
  };
}
