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
    backends: { onnx: { wasm: { wasmPaths: undefined } } },
  },
  pipeline: vi.fn(async () => transformersPipeline),
}));

import { completeSkillOutput, extractJsonBlock, repairJson } from '../agent-models';

describe('repairJson', () => {
  it('strips control characters except newline, tab, and carriage return', () => {
    const input = '{"name":\x00"hello\x01world\x02"}';
    const result = repairJson(input);
    expect(result).toBe('{"name":"helloworld"}');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('preserves newline, tab, and carriage return', () => {
    const input = '{"name":"hello\\nworld"}';
    const result = repairJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result).name).toBe('hello\nworld');
  });

  it('fixes trailing comma before closing brace', () => {
    const input = '{"a": 1, "b": 2,}';
    const result = repairJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ a: 1, b: 2 });
  });

  it('fixes trailing comma before closing bracket', () => {
    const input = '{"items": [1, 2, 3,]}';
    const result = repairJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ items: [1, 2, 3] });
  });

  it('fixes multiple trailing commas in nested structures', () => {
    const input = '{"a": [1, 2,], "b": {"c": 3,},}';
    const result = repairJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ a: [1, 2], b: { c: 3 } });
  });

  it('adds missing closing braces', () => {
    const input = '{"a": {"b": 1}';
    const result = repairJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ a: { b: 1 } });
  });

  it('adds missing closing brackets', () => {
    const input = '{"items": [1, 2, 3}';
    // Missing ] before }
    const result = repairJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('handles truncated string by adding missing closing quote', () => {
    const input = '{"title": "hello world';
    const result = repairJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result).title).toBe('hello world');
  });

  it('handles already valid JSON unchanged', () => {
    const input = '{"a": 1, "b": [2, 3]}';
    const result = repairJson(input);
    expect(result).toBe(input);
    expect(JSON.parse(result)).toEqual({ a: 1, b: [2, 3] });
  });

  it('handles empty object', () => {
    const input = '{}';
    const result = repairJson(input);
    expect(result).toBe('{}');
  });
});

describe('extractJsonBlock + repairJson pipeline', () => {
  it('extracts from fenced code block and repairs trailing comma', () => {
    const raw = '```json\n{"title": "Test", "tags": ["a",]}\n```';
    const extracted = extractJsonBlock(raw);
    const repaired = repairJson(extracted);
    expect(() => JSON.parse(repaired)).not.toThrow();
    expect(JSON.parse(repaired)).toEqual({ title: 'Test', tags: ['a'] });
  });

  it('extracts from markdown with surrounding text and repairs', () => {
    const raw = 'Here is the result:\n```json\n{"score": 0.9,}\n```\nDone.';
    const extracted = extractJsonBlock(raw);
    const repaired = repairJson(extracted);
    expect(() => JSON.parse(repaired)).not.toThrow();
    expect(JSON.parse(repaired)).toEqual({ score: 0.9 });
  });

  it('handles raw JSON with missing closing brace', () => {
    const raw = '{"candidates": [{"id": "c1", "title": "Test"}]';
    const extracted = extractJsonBlock(raw);
    const repaired = repairJson(extracted);
    expect(() => JSON.parse(repaired)).not.toThrow();
  });

  it('handles fenced block with truncated string', () => {
    const raw = '```json\n{"summary": "This is a truncated\n```';
    const extracted = extractJsonBlock(raw);
    const repaired = repairJson(extracted);
    expect(() => JSON.parse(repaired)).not.toThrow();
  });
});

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

  it('retries once with error context on parse failure then succeeds', async () => {
    // First call returns malformed JSON, second call returns valid JSON
    webLlmComplete
      .mockResolvedValueOnce({
        provider: 'webllm',
        model: 'qwen-webllm',
        output: '{"title": "Review digest", broken',
        durationMs: 10,
      })
      .mockResolvedValueOnce({
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
        durationMs: 15,
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
    // The retry call should include error context in the prompt
    expect(webLlmComplete).toHaveBeenCalledTimes(2);
    const retryCall = webLlmComplete.mock.calls[1][0];
    expect(retryCall.prompt).toContain('Your previous output had validation errors');
  });

  it('falls through to next provider when retry also fails', async () => {
    // Both WebLLM attempts return garbage
    webLlmComplete
      .mockResolvedValueOnce({
        provider: 'webllm',
        model: 'qwen-webllm',
        output: 'not json at all',
        durationMs: 10,
      })
      .mockResolvedValueOnce({
        provider: 'webllm',
        model: 'qwen-webllm',
        output: 'still not json',
        durationMs: 10,
      });

    transformersPipeline.mockResolvedValue([
      {
        generated_text: JSON.stringify({
          title: 'Capital brief',
          summary: 'A concise funding brief.',
          whyItMatters: 'It matches coop purpose.',
          suggestedNextStep: 'Review with the funding circle.',
          tags: ['funding'],
          targetCoopIds: [],
          supportingCandidateIds: [],
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

    // Should fall through to transformers after webllm retry fails
    expect(result.provider).toBe('transformers');
    expect(webLlmComplete).toHaveBeenCalledTimes(2);
  });

  it('uses heuristic tab routing on transformers cold start while warming the pipeline', async () => {
    transformersPipeline.mockResolvedValue([
      {
        generated_text: JSON.stringify({
          routings: [
            {
              sourceCandidateId: 'candidate-1',
              extractId: 'extract-1',
              coopId: 'coop-1',
              relevanceScore: 0.42,
              matchedRitualLenses: ['capital-formation'],
              category: 'funding-lead',
              tags: ['funding'],
              rationale: 'Funding overlap.',
              suggestedNextStep: 'Review it.',
              archiveWorthinessHint: true,
            },
          ],
        }),
      },
    ]);

    const result = await completeSkillOutput({
      preferredProvider: 'transformers',
      schemaRef: 'tab-router-output',
      system: 'Return JSON only.',
      prompt: 'Route this extract.',
      heuristicContext: 'Funding roundup for Coop Town Test.',
    });

    expect(result.provider).toBe('heuristic');
    expect(result.output).toEqual({ routings: [] });
  });
});
