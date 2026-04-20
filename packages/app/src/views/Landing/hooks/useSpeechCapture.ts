import type { getRitualLenses } from '@coop/shared/app';
import { useEffect, useRef, useState } from 'react';
import {
  cleanText,
  defaultTranscriptStatus,
  resolveSpeechError,
  resolveSpeechRecognitionConstructor,
} from '../landing-data';
import type { BrowserSpeechRecognition, TranscriptKey, TranscriptMap } from '../landing-types';

type RitualLens = ReturnType<typeof getRitualLenses>[number];

export type SpeechCaptureReturn = {
  recordingLens: TranscriptKey | null;
  transcriptStatus: string;
  transcriptStatusCardId: TranscriptKey | null;
  startRecording: (cardId: TranscriptKey) => void;
  stopRecording: () => void;
  stopRecognitionNow: () => void;
  resetSpeechState: () => void;
  setScopedTranscriptStatus: (cardId: TranscriptKey, message: string) => void;
};

export function useSpeechCapture(
  transcripts: TranscriptMap,
  updateTranscript: (key: TranscriptKey, value: string) => void,
  ritualLenses: RitualLens[],
): SpeechCaptureReturn {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recognitionHadErrorRef = useRef(false);
  const recognitionStoppedIntentionallyRef = useRef(false);
  const recognitionRestartCountRef = useRef(0);

  const [recordingLens, setRecordingLens] = useState<TranscriptKey | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState(defaultTranscriptStatus);
  const [transcriptStatusCardId, setTranscriptStatusCardId] = useState<TranscriptKey | null>(null);

  const speechRecognition =
    typeof window === 'undefined' ? null : resolveSpeechRecognitionConstructor(window);

  // Keep transcripts ref current for closures inside recognition callbacks
  const transcriptsRef = useRef(transcripts);
  transcriptsRef.current = transcripts;

  const updateTranscriptRef = useRef(updateTranscript);
  updateTranscriptRef.current = updateTranscript;

  const ritualLensesRef = useRef(ritualLenses);
  ritualLensesRef.current = ritualLenses;

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;

      if (!recognition) {
        return;
      }

      if (recognition.abort) {
        recognition.abort();
        return;
      }

      recognition.stop();
    };
  }, []);

  function setScopedTranscriptStatus(cardId: TranscriptKey, message: string) {
    setTranscriptStatus(message);
    setTranscriptStatusCardId(cardId);
  }

  function stopRecognitionNow() {
    const recognition = recognitionRef.current;

    if (!recognition) {
      return;
    }

    recognitionStoppedIntentionallyRef.current = true;

    if (recognition.abort) {
      recognition.abort();
    } else {
      recognition.stop();
    }

    recognitionRef.current = null;
    setRecordingLens(null);
  }

  function stopRecording() {
    if (!recognitionRef.current || !recordingLens) {
      return;
    }

    recognitionStoppedIntentionallyRef.current = true;
    const lensTitle =
      ritualLensesRef.current.find((l) => l.id === recordingLens)?.title ?? recordingLens;
    setScopedTranscriptStatus(recordingLens, `Saving the ${lensTitle.toLowerCase()} notes...`);
    recognitionRef.current.stop();
  }

  function startRecording(cardId: TranscriptKey) {
    if (!speechRecognition) {
      setScopedTranscriptStatus(
        cardId,
        'This browser does not expose live transcript here yet. Type notes directly into the card.',
      );
      return;
    }

    if (recognitionRef.current) {
      stopRecognitionNow();
    }

    recognitionHadErrorRef.current = false;
    recognitionStoppedIntentionallyRef.current = false;
    recognitionRestartCountRef.current = 0;

    const recognition = new speechRecognition();
    let committedTranscript = cleanText(transcriptsRef.current[cardId]);

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setRecordingLens(cardId);
      const lensTitle = ritualLensesRef.current.find((l) => l.id === cardId)?.title ?? cardId;
      setScopedTranscriptStatus(cardId, `${lensTitle} is listening on this device.`);
    };

    recognition.onresult = (event) => {
      const nextFinalSegments: string[] = [];
      let nextInterimSegment = '';
      const startIndex = Math.max(0, event.resultIndex ?? 0);

      for (const result of Array.from(event.results).slice(startIndex)) {
        const transcript = result[0]?.transcript?.trim();

        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          nextFinalSegments.push(transcript);
          continue;
        }

        nextInterimSegment = transcript;
      }

      if (nextFinalSegments.length > 0) {
        committedTranscript = [committedTranscript, nextFinalSegments.join(' ')]
          .filter(Boolean)
          .join(' ');
      }

      updateTranscriptRef.current(
        cardId,
        [committedTranscript, nextInterimSegment].filter(Boolean).join(' '),
      );
    };

    recognition.onerror = (event) => {
      recognitionHadErrorRef.current = true;
      setRecordingLens(null);
      recognitionRef.current = null;
      setScopedTranscriptStatus(cardId, resolveSpeechError(event.error));
    };

    recognition.onend = () => {
      if (recognitionHadErrorRef.current) {
        setRecordingLens((current) => (current === cardId ? null : current));
        recognitionRef.current = null;
        return;
      }

      if (
        !recognitionStoppedIntentionallyRef.current &&
        speechRecognition &&
        recognitionRestartCountRef.current < 3
      ) {
        recognitionRestartCountRef.current += 1;
        try {
          const restartRecognition = new speechRecognition();
          restartRecognition.continuous = true;
          restartRecognition.interimResults = true;
          restartRecognition.lang = 'en-US';
          restartRecognition.onstart = recognition.onstart;
          restartRecognition.onresult = recognition.onresult;
          restartRecognition.onerror = recognition.onerror;
          restartRecognition.onend = recognition.onend;
          recognitionRef.current = restartRecognition;
          restartRecognition.start();
          return;
        } catch {
          // Fall through to normal cleanup if restart fails
        }
      }

      setRecordingLens((current) => (current === cardId ? null : current));
      recognitionRef.current = null;

      const endTitle = ritualLensesRef.current.find((l) => l.id === cardId)?.title ?? cardId;
      if (!recognitionStoppedIntentionallyRef.current && recognitionRestartCountRef.current >= 3) {
        setScopedTranscriptStatus(cardId, 'Recording paused \u2014 tap Record to try again');
      } else {
        setScopedTranscriptStatus(cardId, `${endTitle} transcript is ready to edit.`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function resetSpeechState() {
    stopRecognitionNow();
    setRecordingLens(null);
    setTranscriptStatus(defaultTranscriptStatus);
    setTranscriptStatusCardId(null);
  }

  return {
    recordingLens,
    transcriptStatus,
    transcriptStatusCardId,
    startRecording,
    stopRecording,
    stopRecognitionNow,
    resetSpeechState,
    setScopedTranscriptStatus,
  };
}
