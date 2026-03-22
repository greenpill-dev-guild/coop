import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptionResult, TranscriptionSegment } from '../types';

// vi.hoisted runs before mock hoisting, so these are available in the factory
const { mockTranscribe, mockPipelineFactory, mockCanLoad } = vi.hoisted(() => {
  const mockTranscribe = vi.fn();
  const mockPipelineFactory = vi.fn().mockResolvedValue(mockTranscribe);
  const mockCanLoad = vi.fn().mockResolvedValue(true);
  return { mockTranscribe, mockPipelineFactory, mockCanLoad };
});

vi.mock('../loader', () => ({
  loadTransformers: vi.fn().mockResolvedValue({ pipeline: mockPipelineFactory }),
  canLoadTransformers: mockCanLoad,
}));

import { loadTransformers } from '../loader';
import { isWhisperSupported, resetWhisperPipeline, transcribeAudio } from '../whisper';

describe('isWhisperSupported', () => {
  it('returns true when @huggingface/transformers is available', async () => {
    const result = await isWhisperSupported();
    expect(result).toBe(true);
  });

  it('returns false when transformers cannot load', async () => {
    mockCanLoad.mockResolvedValueOnce(false);
    const result = await isWhisperSupported();
    expect(result).toBe(false);
  });
});

describe('transcribeAudio', () => {
  beforeEach(() => {
    resetWhisperPipeline();
    vi.clearAllMocks();

    // Restore mock implementations after clearAllMocks
    vi.mocked(loadTransformers).mockResolvedValue({ pipeline: mockPipelineFactory });
    mockPipelineFactory.mockResolvedValue(mockTranscribe);

    // Default mock: return valid Whisper-style result
    mockTranscribe.mockResolvedValue({
      text: 'Hello world this is a test.',
      chunks: [
        { timestamp: [0, 2.5], text: ' Hello world' },
        { timestamp: [2.5, 5.0], text: ' this is a test.' },
      ],
    });

    // Stub out OfflineAudioContext so the fallback path runs
    // (raw Float32Array passed directly to pipeline)
    vi.stubGlobal('OfflineAudioContext', undefined);
  });

  it('returns a TranscriptionResult with the expected shape', async () => {
    const audioBlob = new Blob([new Float32Array(16000)], { type: 'audio/wav' });
    const onProgress = vi.fn();

    const result = await transcribeAudio({ audioBlob, onProgress });

    expect(result).toMatchObject({
      text: 'Hello world this is a test.',
      language: 'en',
      duration: 5.0,
      segments: expect.any(Array),
      modelId: 'onnx-community/whisper-tiny.en',
    });

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toEqual({
      start: 0,
      end: 2.5,
      text: 'Hello world',
      confidence: 1.0,
    });
  });

  it('calls onProgress with 0.1 before inference and 1.0 after', async () => {
    const audioBlob = new Blob([new Float32Array(100)], { type: 'audio/wav' });
    const onProgress = vi.fn();

    await transcribeAudio({ audioBlob, onProgress });

    expect(onProgress).toHaveBeenCalledWith(0.1);
    expect(onProgress).toHaveBeenCalledWith(1.0);
  });

  it('passes return_timestamps and chunk options to the pipeline', async () => {
    const audioBlob = new Blob([new Float32Array(100)], { type: 'audio/wav' });

    await transcribeAudio({ audioBlob });

    expect(mockTranscribe).toHaveBeenCalledWith(
      expect.any(Float32Array),
      expect.objectContaining({
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      }),
    );
  });

  it('caches the pipeline between calls', async () => {
    const blob = new Blob([new Float32Array(100)], { type: 'audio/wav' });

    await transcribeAudio({ audioBlob: blob });
    await transcribeAudio({ audioBlob: blob });

    // Pipeline factory should only be called once (cached)
    expect(mockPipelineFactory).toHaveBeenCalledTimes(1);
  });

  it('recreates pipeline when modelId changes', async () => {
    const blob = new Blob([new Float32Array(100)], { type: 'audio/wav' });

    await transcribeAudio({ audioBlob: blob });
    await transcribeAudio({ audioBlob: blob, modelId: 'onnx-community/whisper-small' });

    expect(mockPipelineFactory).toHaveBeenCalledTimes(2);
    expect(mockPipelineFactory).toHaveBeenLastCalledWith(
      'automatic-speech-recognition',
      'onnx-community/whisper-small',
      expect.any(Object),
    );
  });

  it('handles result with no chunks gracefully', async () => {
    mockTranscribe.mockResolvedValue({
      text: 'Hello',
      chunks: [],
    });

    const blob = new Blob([new Float32Array(100)], { type: 'audio/wav' });
    const result = await transcribeAudio({ audioBlob: blob });

    expect(result.segments).toEqual([]);
    expect(result.duration).toBe(0);
    expect(result.text).toBe('Hello');
  });

  it('handles result with null end timestamp', async () => {
    mockTranscribe.mockResolvedValue({
      text: 'Partial',
      chunks: [{ timestamp: [3.0, null], text: ' Partial' }],
    });

    const blob = new Blob([new Float32Array(100)], { type: 'audio/wav' });
    const result = await transcribeAudio({ audioBlob: blob });

    expect(result.segments[0].end).toBe(3.0); // Falls back to start
  });

  it('handles missing text in result', async () => {
    mockTranscribe.mockResolvedValue({
      text: undefined,
      chunks: undefined,
    });

    const blob = new Blob([new Float32Array(100)], { type: 'audio/wav' });
    const result = await transcribeAudio({ audioBlob: blob });

    expect(result.text).toBe('');
    expect(result.segments).toEqual([]);
    expect(result.duration).toBe(0);
  });
});

describe('resetWhisperPipeline', () => {
  beforeEach(() => {
    resetWhisperPipeline();
    vi.stubGlobal('OfflineAudioContext', undefined);
    vi.clearAllMocks();
    vi.mocked(loadTransformers).mockResolvedValue({ pipeline: mockPipelineFactory });
    mockPipelineFactory.mockResolvedValue(mockTranscribe);
    mockTranscribe.mockResolvedValue({ text: 'A', chunks: [] });
  });

  it('clears cache so next call creates a new pipeline', async () => {
    const blob = new Blob([new Float32Array(100)], { type: 'audio/wav' });

    await transcribeAudio({ audioBlob: blob });
    expect(mockPipelineFactory).toHaveBeenCalledTimes(1);

    resetWhisperPipeline();
    await transcribeAudio({ audioBlob: blob });
    expect(mockPipelineFactory).toHaveBeenCalledTimes(2);
  });
});

describe('TranscriptionResult type structure', () => {
  it('defines expected TranscriptionSegment fields', () => {
    const segment: TranscriptionSegment = {
      start: 0,
      end: 2.5,
      text: 'hello',
      confidence: 0.95,
    };

    expect(segment.start).toBe(0);
    expect(segment.end).toBe(2.5);
  });

  it('defines expected TranscriptionResult fields', () => {
    const result: TranscriptionResult = {
      text: 'hello world',
      language: 'en',
      duration: 5.0,
      segments: [],
      modelId: 'test-model',
    };

    expect(result.text).toBe('hello world');
    expect(result.modelId).toBe('test-model');
  });
});
