import { useCallback, useEffect, useRef, useState } from 'react';

export type PopupRecordingStatus = 'idle' | 'requesting-permission' | 'recording' | 'denied';

export interface PopupRecordingState {
  isRecording: boolean;
  status: PopupRecordingStatus;
  permissionMessage: string | null;
  elapsedSeconds: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  partialSaveMessage: string | null;
  clearPartialSaveMessage: () => void;
}

const MAX_RECORDING_SECONDS = 30;

export function usePopupRecording(deps: {
  onRecordingReady: (blob: Blob, durationSeconds: number) => Promise<void>;
  onEmergencySave: (blob: Blob, durationSeconds: number) => Promise<void>;
  setMessage: (message: string) => void;
}): PopupRecordingState {
  const { onEmergencySave, onRecordingReady, setMessage } = deps;
  const [status, setStatus] = useState<PopupRecordingStatus>('idle');
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [partialSaveMessage, setPartialSaveMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const commitRef = useRef<'save' | 'cancel' | 'emergency-save'>('save');
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(
    (nextStatus: PopupRecordingStatus = 'idle') => {
      clearTimers();
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      recorderRef.current = null;
      chunksRef.current = [];
      if (mountedRef.current) {
        setStatus(nextStatus);
        setElapsedSeconds(0);
      }
    },
    [clearTimers],
  );

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return;
    setPermissionMessage(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setPermissionMessage('This browser cannot record audio.');
      setStatus('denied');
      return;
    }

    setStatus('requesting-permission');

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
        const commitMode = commitRef.current;
        cleanup();

        if (blob.size === 0) {
          if (commitMode === 'cancel') {
            setMessage('Recording canceled.');
          }
          return;
        }

        if (commitMode === 'save') {
          await onRecordingReady(blob, duration);
          return;
        }

        if (commitMode === 'emergency-save') {
          await onEmergencySave(blob, duration);
          return;
        }

        setMessage('Recording canceled.');
      };

      recorder.start(250);
      setStatus('recording');
      setElapsedSeconds(0);

      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          commitRef.current = 'save';
          recorderRef.current.stop();
        }
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error) {
      cleanup('denied');
      const msg = error instanceof Error ? error.message : 'Could not start recording.';
      if (
        msg.includes('Permission') ||
        msg.includes('permission') ||
        msg.includes('NotAllowedError')
      ) {
        setPermissionMessage('Microphone access was denied. Allow it and try again.');
      } else {
        setPermissionMessage(msg);
      }
    }
  }, [cleanup, onEmergencySave, onRecordingReady, setMessage]);

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

  useEffect(() => {
    function handleBeforeUnload() {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        commitRef.current = 'emergency-save';
        recorderRef.current.stop();
      }
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState === 'hidden' &&
        recorderRef.current &&
        recorderRef.current.state !== 'inactive'
      ) {
        commitRef.current = 'emergency-save';
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

  useEffect(() => {
    const key = 'coop:popup-partial-recording';
    const stored = sessionStorage.getItem(key);
    if (stored) {
      setPartialSaveMessage(stored);
      sessionStorage.removeItem(key);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
        clearTimers();
        commitRef.current = 'emergency-save';
        recorderRef.current.stop();
        return;
      }
      cleanup();
    };
  }, [cleanup, clearTimers]);

  const clearPartialSaveMessage = useCallback(() => setPartialSaveMessage(null), []);

  return {
    isRecording: status === 'recording',
    status,
    permissionMessage,
    elapsedSeconds,
    startRecording,
    stopRecording,
    cancelRecording,
    partialSaveMessage,
    clearPartialSaveMessage,
  };
}
