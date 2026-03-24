import { useCallback, useEffect, useRef, useState } from 'react';

export interface PopupRecordingState {
  isRecording: boolean;
  elapsedSeconds: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  partialSaveMessage: string | null;
  clearPartialSaveMessage: () => void;
}

const MAX_RECORDING_SECONDS = 30;

export function usePopupRecording(deps: {
  captureAudioBlob: (blob: Blob, durationSeconds: number) => Promise<void>;
  setMessage: (message: string) => void;
}): PopupRecordingState {
  const { captureAudioBlob, setMessage } = deps;
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [partialSaveMessage, setPartialSaveMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const commitRef = useRef<'save' | 'cancel'>('save');
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setElapsedSeconds(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('This browser cannot record audio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      commitRef.current = 'save';
      streamRef.current = stream;
      recorderRef.current = recorder;
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        cleanup();

        if (commitRef.current === 'save' && blob.size > 0) {
          await captureAudioBlob(blob, duration);
        } else {
          setMessage('Recording canceled.');
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setElapsedSeconds(0);

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Max recording timer (30s)
      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          commitRef.current = 'save';
          recorderRef.current.stop();
        }
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error) {
      cleanup();
      const msg = error instanceof Error ? error.message : 'Could not start recording.';
      if (
        msg.includes('Permission') ||
        msg.includes('permission') ||
        msg.includes('NotAllowedError')
      ) {
        setMessage('Microphone access denied — check browser permissions.');
      } else {
        setMessage(msg);
      }
    }
  }, [captureAudioBlob, cleanup, setMessage]);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') return;
    commitRef.current = 'save';
    recorderRef.current.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') return;
    commitRef.current = 'cancel';
    recorderRef.current.stop();
  }, []);

  // Auto-save on popup close
  useEffect(() => {
    function handleBeforeUnload() {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        commitRef.current = 'save';
        recorderRef.current.stop();
      }
    }
    function handleVisibilityChange() {
      if (
        document.visibilityState === 'hidden' &&
        recorderRef.current &&
        recorderRef.current.state !== 'inactive'
      ) {
        commitRef.current = 'save';
        recorderRef.current.stop();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Check for partial save message from previous session
  useEffect(() => {
    const key = 'coop:popup-partial-recording';
    const stored = sessionStorage.getItem(key);
    if (stored) {
      setPartialSaveMessage(stored);
      sessionStorage.removeItem(key);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (duration > 0) {
          sessionStorage.setItem(
            'coop:popup-partial-recording',
            `Partial voice note saved (${duration}s).`,
          );
        }
        commitRef.current = 'save';
        recorderRef.current.stop();
      }
      cleanup();
    };
  }, [cleanup]);

  const clearPartialSaveMessage = useCallback(() => setPartialSaveMessage(null), []);

  return {
    isRecording,
    elapsedSeconds,
    startRecording,
    stopRecording,
    cancelRecording,
    partialSaveMessage,
    clearPartialSaveMessage,
  };
}
