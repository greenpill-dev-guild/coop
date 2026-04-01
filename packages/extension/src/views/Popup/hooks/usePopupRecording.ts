import { useCallback, useEffect, useRef, useState } from 'react';

export type PopupRecordingStatus =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'denied'
  | 'unsupported'
  | 'unavailable';

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
const POPUP_MICROPHONE_PROMPT_MESSAGE =
  'Allow microphone access to record a voice note here in the popup.';
const POPUP_MICROPHONE_BLOCKED_MESSAGE =
  'Microphone access is blocked for Coop. Allow it in browser settings and try again.';
const POPUP_MICROPHONE_UNSUPPORTED_MESSAGE = 'This browser cannot record audio in the popup.';
const POPUP_MICROPHONE_NOT_GRANTED_MESSAGE =
  'Microphone access was not granted. Keep the popup open and allow access to record a voice note.';
const POPUP_MICROPHONE_MISSING_DEVICE_MESSAGE =
  'No microphone is available right now. Connect one and try again.';
const POPUP_MICROPHONE_BUSY_MESSAGE =
  'Coop could not start the microphone. Close other apps using it and try again.';

type MicrophonePermissionState = PermissionState | 'unknown';

async function getMicrophonePermissionState(): Promise<MicrophonePermissionState> {
  if (!navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    return status.state;
  } catch {
    return 'unknown';
  }
}

function describeMicrophoneError(error: unknown) {
  if (error instanceof DOMException) {
    return `${error.name} ${error.message}`.toLowerCase();
  }

  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase();
  }

  return '';
}

function statusFromFailureMessage(message: string) {
  if (message === POPUP_MICROPHONE_BLOCKED_MESSAGE) {
    return 'denied' as const;
  }

  if (message === POPUP_MICROPHONE_UNSUPPORTED_MESSAGE) {
    return 'unsupported' as const;
  }

  return 'unavailable' as const;
}

async function classifyMicrophoneStartFailure(
  error: unknown,
  initialPermissionState: MicrophonePermissionState,
) {
  const latestPermissionState = await getMicrophonePermissionState();
  const details = describeMicrophoneError(error);

  if (initialPermissionState === 'denied' || latestPermissionState === 'denied') {
    return {
      status: 'denied' as const,
      message: POPUP_MICROPHONE_BLOCKED_MESSAGE,
    };
  }

  if (
    details.includes('notfounderror') ||
    details.includes('devicesnotfounderror') ||
    details.includes('requested device not found') ||
    details.includes('no device found')
  ) {
    return {
      status: 'unavailable' as const,
      message: POPUP_MICROPHONE_MISSING_DEVICE_MESSAGE,
    };
  }

  if (
    details.includes('notreadableerror') ||
    details.includes('trackstarterror') ||
    details.includes('aborterror') ||
    details.includes('could not start audio source')
  ) {
    return {
      status: 'unavailable' as const,
      message: POPUP_MICROPHONE_BUSY_MESSAGE,
    };
  }

  if (details.includes('securityerror') || details.includes('notsupportederror')) {
    return {
      status: 'unsupported' as const,
      message: POPUP_MICROPHONE_UNSUPPORTED_MESSAGE,
    };
  }

  if (
    details.includes('notallowederror') ||
    details.includes('permissiondeniederror') ||
    details.includes('permission')
  ) {
    return {
      status: 'unavailable' as const,
      message: POPUP_MICROPHONE_NOT_GRANTED_MESSAGE,
    };
  }

  return {
    status: 'unavailable' as const,
    message:
      error instanceof Error && error.message
        ? error.message
        : 'Coop could not start the microphone. Try again.',
  };
}

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
  const startingRef = useRef(false);

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
      startingRef.current = false;
      chunksRef.current = [];
      if (mountedRef.current) {
        setStatus(nextStatus);
        setElapsedSeconds(0);
      }
    },
    [clearTimers],
  );

  const startRecording = useCallback(async () => {
    if (recorderRef.current || startingRef.current) return;
    startingRef.current = true;
    setPermissionMessage(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      const nextMessage = POPUP_MICROPHONE_UNSUPPORTED_MESSAGE;
      setPermissionMessage(nextMessage);
      setMessage(nextMessage);
      setStatus(statusFromFailureMessage(nextMessage));
      startingRef.current = false;
      return;
    }

    const permissionStateBefore = await getMicrophonePermissionState();
    const showedPromptMessage = permissionStateBefore !== 'granted';
    if (permissionStateBefore === 'denied') {
      setPermissionMessage(POPUP_MICROPHONE_BLOCKED_MESSAGE);
      setMessage(POPUP_MICROPHONE_BLOCKED_MESSAGE);
      setStatus('denied');
      startingRef.current = false;
      return;
    }

    setStatus('requesting-permission');
    if (showedPromptMessage) {
      setMessage(POPUP_MICROPHONE_PROMPT_MESSAGE);
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
      startingRef.current = false;
      if (showedPromptMessage) {
        setMessage('');
      }
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
      const failure = await classifyMicrophoneStartFailure(error, permissionStateBefore);
      cleanup(failure.status);
      setPermissionMessage(failure.message);
      setMessage(failure.message);
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
