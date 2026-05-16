import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockCompleteSkillOutput, mockGetReceiverCaptureBlob } = vi.hoisted(() => ({
  mockCompleteSkillOutput: vi.fn(),
  mockGetReceiverCaptureBlob: vi.fn(),
}));

vi.mock('../models', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../models')>();
  return {
    ...actual,
    completeSkillOutput: mockCompleteSkillOutput,
  };
});

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    getReceiverCaptureBlob: mockGetReceiverCaptureBlob,
  };
});

import type { AgentObservation, ReceiverCapture, SkillManifest } from '@coop/shared';
import { getReceiverCaptureBlob } from '@coop/shared';
import { completeSkillOutput } from '../models';
import type { RegisteredSkill } from '../registry';
import { completeSkill } from '../runner-skills-completion';

function createSkill(): RegisteredSkill {
  return {
    manifest: {
      id: 'memory-insight',
      version: '1.0.0',
      description: 'Test memory insight skill',
      runtime: 'extension-offscreen',
      model: 'gemma4',
      triggers: ['audio-transcript-ready'],
      inputSchemaRef: 'agent-observation',
      outputSchemaRef: 'memory-insight-output',
      allowedTools: [],
      allowedActionClasses: [],
      requiredCapabilities: [],
      approvalMode: 'advisory',
      timeoutMs: 1000,
      depends: [],
      provides: [],
      maxTokens: 256,
    } satisfies SkillManifest,
    instructions: 'Test instructions',
    instructionMeta: {
      name: 'Memory insight',
      description: 'Test memory insight skill',
    },
  };
}

function createObservation(payload: Record<string, unknown> = {}): AgentObservation {
  return {
    id: 'observation-audio-1',
    trigger: 'audio-transcript-ready',
    status: 'pending',
    title: 'Voice note transcribed',
    summary: 'Transcribed audio capture',
    payload,
    createdAt: '2026-05-16T12:00:00.000Z',
  } as AgentObservation;
}

function createCapture(kind: ReceiverCapture['kind'], mimeType: string): ReceiverCapture {
  return {
    id: `capture-${kind}-1`,
    kind,
    mimeType,
    fileName: kind === 'audio' ? 'voice-note.webm' : 'grant-site.png',
    title: kind === 'audio' ? 'Voice note' : 'Grant site screenshot',
    createdAt: '2026-05-16T12:00:00.000Z',
    updatedAt: '2026-05-16T12:00:00.000Z',
  } as ReceiverCapture;
}

async function completeWithCapture(capture: ReceiverCapture, observation = createObservation()) {
  mockCompleteSkillOutput.mockResolvedValue({
    provider: 'gemma4',
    model: 'onnx-community/gemma-4-E2B-it-ONNX',
    output: { insights: [] },
    durationMs: 12,
  });

  return completeSkill({
    skill: createSkill(),
    observation,
    capture,
    candidates: [],
    scores: [],
    extracts: [],
    relatedDrafts: [],
    relatedArtifacts: [],
    relatedRoutings: [],
    memories: [],
    preferredProvider: 'gemma4',
    preparedPrompt: {
      system: 'You are Coop.',
      prompt: 'Summarize the capture.',
      heuristicContext: 'Voice note context',
    },
  });
}

describe('completeSkill multimodal receiver capture forwarding', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads receiver audio capture blobs as data URLs for Gemma 4', async () => {
    mockGetReceiverCaptureBlob.mockResolvedValue(new Blob(['raw-audio'], { type: 'audio/webm' }));

    await completeWithCapture(createCapture('audio', 'audio/webm'));

    expect(getReceiverCaptureBlob).toHaveBeenCalledWith(expect.anything(), 'capture-audio-1');
    expect(completeSkillOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredProvider: 'gemma4',
        audioUrl: 'data:audio/webm;base64,cmF3LWF1ZGlv',
        audioSamplingRate: 16000,
        imageUrl: undefined,
      }),
    );
  });

  it('preserves explicit observation audio URLs without reloading the capture blob', async () => {
    await completeWithCapture(
      createCapture('audio', 'audio/webm'),
      createObservation({
        audioUrl: 'data:audio/wav;base64,ZXhwbGljaXQ=',
        audioSamplingRate: 24000,
      }),
    );

    expect(getReceiverCaptureBlob).not.toHaveBeenCalled();
    expect(completeSkillOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        audioUrl: 'data:audio/wav;base64,ZXhwbGljaXQ=',
        audioSamplingRate: 24000,
      }),
    );
  });
});
