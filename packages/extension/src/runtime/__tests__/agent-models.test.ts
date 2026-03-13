import { beforeEach, describe, expect, it, vi } from 'vitest';

const { webLlmComplete, transformersPipeline } = vi.hoisted(() => ({
  webLlmComplete: vi.fn(),
  transformersPipeline: vi.fn(),
}));

vi.mock('../agent-webllm-bridge', () => ({
  AgentWebLlmBridge: class {
    complete = webLlmComplete;
    teardown() {}
  },
}));

vi.mock('@huggingface/transformers', () => ({
  env: {
    allowLocalModels: false,
    useBrowserCache: true,
  },
  pipeline: vi.fn(async () => transformersPipeline),
}));

import { completeSkillOutput } from '../agent-models';

describe('agent model provider fallback', () => {
  beforeEach(() => {
    webLlmComplete.mockReset();
    transformersPipeline.mockReset();
  });

  it('uses WebLLM when available', async () => {
    webLlmComplete.mockResolvedValue({
      provider: 'webllm',
      model: 'qwen-webllm',
      output: JSON.stringify({
        title: 'Review digest',
        summary: 'A concise digest.',
        whyItMatters: 'It helps the ritual stay current.',
        suggestedNextStep: 'Review together.',
        highlights: ['Watershed funding lead'],
        tags: ['digest'],
      }),
      durationMs: 12,
    });

    const result = await completeSkillOutput({
      preferredProvider: 'webllm',
      schemaRef: 'review-digest-output',
      system: 'Return JSON only.',
      prompt: 'Summarize recent activity.',
      heuristicContext: 'Recent activity.',
    });

    expect(result.provider).toBe('webllm');
    expect(result.output.title).toBe('Review digest');
  });

  it('falls back from WebLLM to transformers', async () => {
    webLlmComplete.mockRejectedValue(new Error('WebLLM unavailable'));
    transformersPipeline.mockResolvedValue([
      {
        generated_text: JSON.stringify({
          title: 'Capital brief',
          summary: 'A concise funding brief.',
          whyItMatters: 'It matches coop purpose.',
          suggestedNextStep: 'Review with the funding circle.',
          tags: ['funding'],
          targetCoopIds: ['coop-1'],
          supportingCandidateIds: ['candidate-1'],
        }),
      },
    ]);

    const result = await completeSkillOutput({
      preferredProvider: 'webllm',
      schemaRef: 'capital-formation-brief-output',
      system: 'Return JSON only.',
      prompt: 'Write a funding brief.',
      heuristicContext: 'Potential funding opportunity.',
    });

    expect(result.provider).toBe('transformers');
    expect(result.output.title).toBe('Capital brief');
  });

  it('falls back to heuristics when model providers fail', async () => {
    webLlmComplete.mockRejectedValue(new Error('WebLLM unavailable'));
    transformersPipeline.mockRejectedValue(new Error('Transformers unavailable'));

    const result = await completeSkillOutput({
      preferredProvider: 'webllm',
      schemaRef: 'review-digest-output',
      system: 'Return JSON only.',
      prompt: 'Summarize recent activity.',
      heuristicContext: 'Recent activity on watershed funding and archive follow-up.',
    });

    expect(result.provider).toBe('heuristic');
    expect(result.output.summary).toContain('Recent activity');
  });
});
