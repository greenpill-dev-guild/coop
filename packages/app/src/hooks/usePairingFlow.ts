import {
  type HapticPreferences,
  type ReceiverPairingPayload,
  type ReceiverPairingRecord,
  type SoundPreferences,
  detectBrowserUxCapabilities,
  getReceiverPairingStatus,
  isReceiverPairingExpired,
  nowIso,
  parseReceiverPairingInput,
  playCoopSound,
  setActiveReceiverPairing,
  toReceiverPairingRecord,
  triggerHaptic,
  upsertReceiverPairing,
} from '@coop/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { receiverDb as ReceiverDbType } from '../app';

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type GlobalWithBarcodeDetector = typeof globalThis & {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
};

export type PairingFlowState = {
  pairingInput: string;
  setPairingInput: (value: string) => void;
  pendingPairing: ReceiverPairingPayload | null;
  setPendingPairing: (value: ReceiverPairingPayload | null) => void;
  pairingError: string;
  isQrScannerOpen: boolean;
  qrScanError: string;
  qrVideoRef: React.RefObject<HTMLVideoElement | null>;
  reviewPairing: (value: string) => void;
  startQrScanner: () => Promise<void>;
  stopQrScanner: () => void;
  confirmPairing: () => Promise<void>;
};

export function usePairingFlow(
  db: typeof ReceiverDbType,
  deps: {
    isMountedRef: React.RefObject<boolean>;
    soundPreferences: SoundPreferences;
    hapticPreferences: HapticPreferences;
    setMessage: (message: string) => void;
    navigate: (route: '/pair' | '/receiver' | '/inbox' | '/') => void;
    refreshLocalState: () => Promise<void>;
    notifyReceiverEvent: (title: string, body: string, tag: string) => Promise<void>;
  },
): PairingFlowState {
  const {
    isMountedRef,
    soundPreferences,
    hapticPreferences,
    setMessage,
    navigate,
    refreshLocalState,
    notifyReceiverEvent,
  } = deps;

  const browserUxCapabilities = detectBrowserUxCapabilities(globalThis);

  const [pairingInput, setPairingInput] = useState('');
  const [pendingPairing, setPendingPairing] = useState<ReceiverPairingPayload | null>(null);
  const [pairingError, setPairingError] = useState('');
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScanError, setQrScanError] = useState('');
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrScanTimerRef = useRef<number | null>(null);

  const stopQrScanner = useCallback(() => {
    if (qrScanTimerRef.current) {
      window.clearInterval(qrScanTimerRef.current);
      qrScanTimerRef.current = null;
    }
    const stream = qrStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      qrStreamRef.current = null;
    }
    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
    setIsQrScannerOpen(false);
  }, []);

  const reviewPairing = useCallback(
    (value: string) => {
      try {
        const payload = parseReceiverPairingInput(value);
        if (!isMountedRef.current) {
          return;
        }
        setPendingPairing(payload);
        setPairingInput('');
        setPairingError('');
        setMessage('Check the nest code, then join this coop.');
      } catch (error) {
        if (isMountedRef.current) {
          setPendingPairing(null);
          setPairingError(
            error instanceof Error ? error.message : 'Could not read that nest code.',
          );
        }
      }
    },
    [isMountedRef, setMessage],
  );

  const startQrScanner = useCallback(async () => {
    if (!browserUxCapabilities.canScanQr || !navigator.mediaDevices?.getUserMedia) {
      setQrScanError('QR scanning is not supported in this browser yet.');
      return;
    }

    const BarcodeDetectorCtor = (globalThis as GlobalWithBarcodeDetector).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setQrScanError('QR scanning is not supported in this browser yet.');
      return;
    }

    stopQrScanner();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      qrStreamRef.current = stream;
      setQrScanError('');
      setIsQrScannerOpen(true);

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });

      qrScanTimerRef.current = window.setInterval(() => {
        void (async () => {
          const video = qrVideoRef.current;
          if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            return;
          }
          const matches = await detector.detect(video);
          const payload = matches[0]?.rawValue?.trim();
          if (!payload) {
            return;
          }
          stopQrScanner();
          setPairingInput(payload);
          reviewPairing(payload);
        })().catch((err: unknown) => {
          console.warn('[QR scanner] detection error:', err);
        });
      }, 500);
    } catch (error) {
      stopQrScanner();
      setQrScanError(
        error instanceof Error ? error.message : 'Could not access the camera for QR scanning.',
      );
    }
  }, [browserUxCapabilities.canScanQr, reviewPairing, stopQrScanner]);

  const confirmPairing = useCallback(async () => {
    if (!pendingPairing) {
      return;
    }

    try {
      if (isReceiverPairingExpired(pendingPairing)) {
        throw new Error('This nest code has expired.');
      }
      const nextPairing = toReceiverPairingRecord(pendingPairing, nowIso());
      const nextPairingStatus = getReceiverPairingStatus(nextPairing);
      await upsertReceiverPairing(db, nextPairing);
      await setActiveReceiverPairing(db, nextPairing.pairingId);
      if (!isMountedRef.current) {
        return;
      }
      setPendingPairing(null);
      setPairingError('');
      setMessage(
        nextPairingStatus.status === 'ready'
          ? `Paired to ${pendingPairing.coopDisplayName} as ${pendingPairing.memberDisplayName}.`
          : nextPairingStatus.message,
      );
      await refreshLocalState();
      void playCoopSound('coop-created', soundPreferences).catch(() => {});
      triggerHaptic('pairing-confirmed', hapticPreferences);
      await notifyReceiverEvent(
        'Receiver paired',
        `${pendingPairing.coopDisplayName} is ready for private intake sync.`,
        `receiver-pairing-${nextPairing.pairingId}`,
      );
      navigate('/receiver');
    } catch (error) {
      if (isMountedRef.current) {
        setPairingError(error instanceof Error ? error.message : 'Could not join this coop.');
      }
    }
  }, [
    db,
    hapticPreferences,
    isMountedRef,
    navigate,
    notifyReceiverEvent,
    pendingPairing,
    refreshLocalState,
    setMessage,
    soundPreferences,
  ]);

  // Wire up QR video stream when scanner opens
  useEffect(() => {
    if (!isQrScannerOpen || !qrStreamRef.current || !qrVideoRef.current) {
      return;
    }
    qrVideoRef.current.srcObject = qrStreamRef.current;
    void qrVideoRef.current.play().catch(() => undefined);
  }, [isQrScannerOpen]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopQrScanner();
    };
  }, [stopQrScanner]);

  return {
    pairingInput,
    setPairingInput,
    pendingPairing,
    setPendingPairing,
    pairingError,
    isQrScannerOpen,
    qrScanError,
    qrVideoRef,
    reviewPairing,
    startQrScanner,
    stopQrScanner,
    confirmPairing,
  };
}
