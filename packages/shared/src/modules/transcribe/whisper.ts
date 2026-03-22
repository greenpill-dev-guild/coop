import { canLoadTransformers, loadTransformers } from './loader';
import type { TranscriptionResult, TranscriptionSegment } from './types';

const DEFAULT_MODEL_ID = 'onnx-community/whisper-tiny.en';

// Cached pipeline instance
// biome-ignore lint/suspicious/noExplicitAny: pipeline type varies by transformers.js version
let pipelineInstance: any = null;
let pipelineModelId: string | null = null;

/**
 * Check if Whisper transcription is supported in the current environment.
 * Requires @huggingface/transformers to be available (dynamic import).
 */
export async function isWhisperSupported(): Promise<boolean> {
  return canLoadTransformers();
}

/**
 * Transcribe audio using local Whisper model via @huggingface/transformers.
 * The model is cached after first load.
 */
export async function transcribeAudio(input: {
  audioBlob: Blob;
  modelId?: string;
  onProgress?: (progress: number) => void;
}): Promise<TranscriptionResult> {
  const { audioBlob, modelId = DEFAULT_MODEL_ID, onProgress } = input;

  const { pipeline } = await loadTransformers();

  // Create or reuse pipeline
  if (!pipelineInstance || pipelineModelId !== modelId) {
    pipelineInstance = await pipeline('automatic-speech-recognition', modelId, {
      // Prefer WebGPU, fall back to WASM
      device: typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm',
      dtype: 'q4',
    });
    pipelineModelId = modelId;
  }

  // Convert Blob to Float32Array audio data
  const arrayBuffer = await audioBlob.arrayBuffer();

  let audioData: Float32Array;

  // Use OfflineAudioContext for proper decoding + resampling when available
  if (typeof OfflineAudioContext !== 'undefined') {
    const audioBuffer = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(
      arrayBuffer.slice(0),
    );

    if (audioBuffer.sampleRate !== 16000) {
      const offlineCtx = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * 16000), 16000);
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start();
      const resampled = await offlineCtx.startRendering();
      audioData = resampled.getChannelData(0);
    } else {
      audioData = audioBuffer.getChannelData(0);
    }
  } else {
    // Fallback: pass raw bytes and let transformers.js handle decoding
    audioData = new Float32Array(arrayBuffer);
  }

  onProgress?.(0.1);

  const result = await pipelineInstance(audioData, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  onProgress?.(1.0);

  // Parse result into our typed structure
  const rawChunks: Array<{ timestamp: [number, number | null]; text: string }> =
    result.chunks ?? [];

  const segments: TranscriptionSegment[] = rawChunks.map((chunk) => ({
    start: chunk.timestamp[0],
    end: chunk.timestamp[1] ?? chunk.timestamp[0],
    text: chunk.text.trim(),
    confidence: 1.0, // Whisper doesn't provide per-segment confidence
  }));

  const totalDuration = segments.length > 0 ? Math.max(...segments.map((s) => s.end)) : 0;

  return {
    text: (result.text ?? '').trim(),
    language: 'en', // whisper-tiny.en is English-only
    duration: totalDuration,
    segments,
    modelId,
  };
}

/** Reset the cached pipeline, releasing WASM/GPU resources */
export function resetWhisperPipeline(): void {
  if (pipelineInstance) {
    try {
      pipelineInstance.dispose?.();
    } catch {
      // dispose may not exist on all pipeline versions
    }
  }
  pipelineInstance = null;
  pipelineModelId = null;
}
