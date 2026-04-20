import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { webLlmComplete, webLlmPrewarm, webLlmStatus, transformersPipeline } = vi.hoisted(() => ({
  webLlmComplete: vi.fn(),
  webLlmPrewarm: vi.fn(),
  webLlmStatus: {
    ready: false,
    initProgress: 0,
    initMessage: '',
    error: undefined,
    model: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
  },
  transformersPipeline: vi.fn(),
}));

vi.mock('../agent/webllm-bridge', () => ({
  AgentWebLlmBridge: class {
    complete = webLlmComplete;
    prewarm = webLlmPrewarm;
    get status() {
      return webLlmStatus;
    }
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

import {
  completeSkillOutput,
  extractJsonBlock,
  repairJson,
  teardownAgentModels,
} from '../agent/models';

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
    webLlmPrewarm.mockReset();
    transformersPipeline.mockReset();
    webLlmStatus.ready = false;
    webLlmStatus.error = undefined;
    webLlmStatus.initProgress = 0;
    webLlmStatus.initMessage = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    teardownAgentModels();
  });

  it('uses WebLLM when available', async () => {
    webLlmStatus.ready = true;
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
      maxTokens: 432,
    });

    expect(result.provider).toBe('webllm');
    expect((result.output as Record<string, unknown>).title).toBe('Review digest');
    expect(webLlmComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        maxTokens: 432,
      }),
    );
  });

  it('falls back from WebLLM to transformers', async () => {
    webLlmStatus.ready = true;
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
    expect((result.output as Record<string, unknown>).title).toBe('Capital brief');
  });

  it('falls back from a hung WebLLM call to transformers after the skill timeout', async () => {
    vi.useFakeTimers();
    webLlmStatus.ready = true;
    webLlmComplete.mockImplementation(() => new Promise(() => {}));
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

    const resultPromise = completeSkillOutput({
      preferredProvider: 'webllm',
      schemaRef: 'capital-formation-brief-output',
      system: 'Return JSON only.',
      prompt: 'Write a funding brief.',
      heuristicContext: 'Potential funding opportunity.',
    });

    await vi.advanceTimersByTimeAsync(30_000);
    const result = await resultPromise;

    expect(result.provider).toBe('transformers');
    expect((result.output as Record<string, unknown>).title).toBe('Capital brief');
    expect(webLlmComplete).toHaveBeenCalledTimes(1);
  });

  it('falls back to heuristics when model providers fail', async () => {
    webLlmStatus.ready = true;
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
    expect((result.output as Record<string, unknown>).summary).toContain('Recent activity');
  });

  it('falls back to heuristics when warmed transformers completion hangs past the skill timeout', async () => {
    vi.useFakeTimers();
    transformersPipeline.mockImplementation(() => new Promise(() => {}));

    const resultPromise = completeSkillOutput({
      preferredProvider: 'transformers',
      schemaRef: 'capital-formation-brief-output',
      system: 'Return JSON only.',
      prompt: 'Write a funding brief.',
      heuristicContext: 'A local ecological funding lead with strong community fit.',
    });

    await vi.advanceTimersByTimeAsync(60_000);
    const result = await resultPromise;

    expect(result.provider).toBe('heuristic');
    expect((result.output as Record<string, unknown>).title).toBe(
      'Potential capital formation opportunity',
    );
    expect(transformersPipeline).toHaveBeenCalledTimes(2);
  });

  it('retries once with error context on parse failure then succeeds', async () => {
    webLlmStatus.ready = true;
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
    expect((result.output as Record<string, unknown>).title).toBe('Review digest');
    // The retry call should include error context in the prompt
    expect(webLlmComplete).toHaveBeenCalledTimes(2);
    const retryCall = webLlmComplete.mock.calls[1][0];
    expect(retryCall.prompt).toContain('Your previous output had validation errors');
  });

  it('falls through to next provider when retry also fails', async () => {
    webLlmStatus.ready = true;
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

  it('uses heuristic capital briefs on WebLLM cold start while warming the engine', async () => {
    const result = await completeSkillOutput({
      preferredProvider: 'webllm',
      schemaRef: 'capital-formation-brief-output',
      system: 'Return JSON only.',
      prompt: 'Write a funding brief.',
      heuristicContext: 'Potential funding opportunity.',
    });

    expect(result.provider).toBe('heuristic');
    expect((result.output as Record<string, unknown>).title).toBe(
      'Potential capital formation opportunity',
    );
    expect(webLlmPrewarm).toHaveBeenCalledTimes(1);
    expect(webLlmComplete).not.toHaveBeenCalled();
  });

  it('uses heuristic opportunity extraction on transformers cold start while warming the pipeline', async () => {
    transformersPipeline.mockResolvedValue([
      {
        generated_text: JSON.stringify({
          candidates: [
            {
              id: 'candidate-1',
              title: 'Community watershed grant',
              summary: 'A strong watershed funding lead.',
              rationale: 'It overlaps with the coop purpose.',
              regionTags: ['ca'],
              ecologyTags: ['watershed'],
              fundingSignals: ['grant'],
              priority: 0.9,
              recommendedNextStep: 'Review it.',
            },
          ],
        }),
      },
    ]);

    const result = await completeSkillOutput({
      preferredProvider: 'transformers',
      schemaRef: 'opportunity-extractor-output',
      system: 'Return JSON only.',
      prompt: 'Extract ecological opportunities.',
      heuristicContext: 'Watershed funding lead for local climate work.',
    });

    expect(result.provider).toBe('heuristic');
    expect((result.output as Record<string, unknown>).candidates).toEqual([
      expect.objectContaining({
        title: 'Watershed funding lead for local climate work.',
      }),
    ]);
  });

  it('uses heuristic entity extraction on transformers cold start while warming the pipeline', async () => {
    transformersPipeline.mockResolvedValue([
      {
        generated_text: JSON.stringify({
          entities: [
            {
              id: 'entity-1',
              type: 'organization',
              name: 'Coop Town',
              confidence: 0.95,
              aliases: [],
              provenance: [],
            },
          ],
          relationships: [],
        }),
      },
    ]);

    const result = await completeSkillOutput({
      preferredProvider: 'transformers',
      schemaRef: 'entity-extraction-output',
      system: 'Return JSON only.',
      prompt: 'Extract entities and relationships.',
      heuristicContext:
        'Observation title: River funding roundup\nObservation summary: Alice Johnson from Greenpill Network met at River Summit in Portland using Coop Protocol.',
    });

    expect(result.provider).toBe('heuristic');
    expect(result.output).toEqual(
      expect.objectContaining({
        entities: expect.arrayContaining([
          expect.objectContaining({ name: 'Alice Johnson', type: 'person' }),
          expect.objectContaining({ name: 'Greenpill Network', type: 'organization' }),
          expect.objectContaining({ name: 'River Summit', type: 'event' }),
          expect.objectContaining({ name: 'Portland', type: 'location' }),
          expect.objectContaining({ name: 'Coop Protocol', type: 'object' }),
        ]),
        relationships: expect.arrayContaining([
          expect.objectContaining({ type: 'affiliated-with' }),
          expect.objectContaining({ type: 'participated-in' }),
          expect.objectContaining({ type: 'hosted-in' }),
          expect.objectContaining({ type: 'uses' }),
        ]),
      }),
    );
  });

  it('keeps using heuristic opportunity extraction while transformers are still warming', async () => {
    transformersPipeline.mockImplementation(() => new Promise(() => {}));

    const warmingResult = await completeSkillOutput({
      preferredProvider: 'transformers',
      schemaRef: 'tab-router-output',
      system: 'Return JSON only.',
      prompt: 'Route this extract.',
      heuristicContext: 'Funding roundup for Coop Town Test.',
    });

    const result = await completeSkillOutput({
      preferredProvider: 'transformers',
      schemaRef: 'opportunity-extractor-output',
      system: 'Return JSON only.',
      prompt: 'Extract ecological opportunities.',
      heuristicContext: 'Watershed funding lead for local climate work.',
    });

    expect(warmingResult.provider).toBe('heuristic');
    expect(result.provider).toBe('heuristic');
    expect((result.output as Record<string, unknown>).candidates).toEqual([
      expect.objectContaining({
        title: 'Watershed funding lead for local climate work.',
      }),
    ]);
  });

  it('passes manifest maxTokens through to transformers', async () => {
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
      preferredProvider: 'transformers',
      schemaRef: 'capital-formation-brief-output',
      system: 'Return JSON only.',
      prompt: 'Write a funding brief.',
      heuristicContext: 'Potential funding opportunity.',
      maxTokens: 321,
    });

    expect(result.provider).toBe('transformers');
    expect(transformersPipeline).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        max_new_tokens: 321,
      }),
    );
  });
});
