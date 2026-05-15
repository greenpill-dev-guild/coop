import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { webLlmComplete, webLlmStatus, transformersPipeline } = vi.hoisted(() => ({
  webLlmComplete: vi.fn(),
  webLlmStatus: {
    ready: true,
    initProgress: 1,
    initMessage: 'ready',
    error: undefined,
    model: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
  },
  transformersPipeline: vi.fn(),
}));

vi.mock('../webllm-bridge', () => ({
  AgentWebLlmBridge: class {
    complete = webLlmComplete;
    prewarm() {}
    async initialize() {
      return {
        model: webLlmStatus.model,
        durationMs: 220,
      };
    }
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

import { createCoopDb, listAgentBenchmarkRecords } from '@coop/shared';
import { runAgentProviderBenchmarks } from '../benchmarks';
import { listAgentRuntimeProviderContracts } from '../provider-contracts';

function replyForSchema(schemaRef: string, repaired = false) {
  switch (schemaRef) {
    case 'tab-router-output':
      return JSON.stringify({
        routings: [
          {
            sourceCandidateId: 'tab-candidate-routing',
            extractId: 'benchmark-extract-routing',
            coopId: 'coop-benchmark',
            relevanceScore: 0.82,
            matchedRitualLenses: ['capital-formation'],
            category: 'funding-lead',
            tags: ['watershed', 'grant'],
            rationale: 'The grant aligns with stewardship work and has a clear local review path.',
            suggestedNextStep: 'Route this signal into the next funding review.',
            archiveWorthinessHint: true,
          },
        ],
      });
    case 'opportunity-extractor-output':
      return repaired
        ? '{"candidates":[{"id":"candidate-solar","title":"Community solar microgrant","summary":"A microgrant for urban agriculture and solar resilience.","rationale":"The program combines energy infrastructure and cooperative ownership.","regionTags":["oakland"],"ecologyTags":["energy"],"fundingSignals":["microgrant"],"priority":0.81,"recommendedNextStep":"Draft a funding lead and confirm site eligibility."}],}'
        : JSON.stringify({
            candidates: [
              {
                id: 'candidate-solar',
                title: 'Community solar microgrant',
                summary: 'A microgrant for urban agriculture and solar resilience.',
                rationale: 'The program combines energy infrastructure and cooperative ownership.',
                regionTags: ['oakland'],
                ecologyTags: ['energy'],
                fundingSignals: ['microgrant'],
                priority: 0.81,
                recommendedNextStep: 'Draft a funding lead and confirm site eligibility.',
              },
            ],
          });
    case 'capital-formation-brief-output':
      return JSON.stringify({
        title: 'Community solar capital brief',
        summary:
          'The cooperative can combine a climate microgrant with member financing for solar infrastructure.',
        whyItMatters:
          'This aligns resilient infrastructure, cooperative ownership, and a tractable capital stack.',
        suggestedNextStep:
          'Review the brief with the funding circle and confirm match requirements.',
        tags: ['solar', 'capital', 'resilience'],
        targetCoopIds: ['coop-benchmark'],
        supportingCandidateIds: ['candidate-solar'],
      });
    default:
      throw new Error(`Unhandled schema ${schemaRef}`);
  }
}

describe('agent provider benchmarks', () => {
  let db: ReturnType<typeof createCoopDb>;

  beforeEach(() => {
    db = createCoopDb(`coop-agent-benchmarks-${crypto.randomUUID()}`);
    transformersPipeline.mockReset();
    webLlmComplete.mockReset();

    transformersPipeline.mockImplementation(async (messages: Array<{ content: string }>) => {
      const prompt = messages[0]?.content ?? '';
      if (prompt.includes('tab-router-output')) {
        return [{ generated_text: replyForSchema('tab-router-output') }];
      }
      if (prompt.includes('opportunity-extractor-output')) {
        return [{ generated_text: replyForSchema('opportunity-extractor-output', true) }];
      }
      if (prompt.includes('capital-formation-brief-output')) {
        return [{ generated_text: replyForSchema('capital-formation-brief-output') }];
      }
      throw new Error(`Unexpected prompt: ${prompt}`);
    });

    webLlmComplete.mockImplementation(
      async (input: { system?: string; prompt: string; maxTokens?: number }) => {
        const descriptor = `${input.system ?? ''}\n${input.prompt}`;
        if (descriptor.includes('tab-router-output')) {
          return {
            provider: 'webllm',
            model: webLlmStatus.model,
            output: replyForSchema('tab-router-output'),
            durationMs: 90,
          };
        }
        if (descriptor.includes('opportunity-extractor-output')) {
          return {
            provider: 'webllm',
            model: webLlmStatus.model,
            output: replyForSchema('opportunity-extractor-output'),
            durationMs: 92,
          };
        }
        return {
          provider: 'webllm',
          model: webLlmStatus.model,
          output: replyForSchema('capital-formation-brief-output'),
          durationMs: 94,
        };
      },
    );
  });

  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('exposes provider contracts with capability metadata', () => {
    const contracts = listAgentRuntimeProviderContracts();

    expect(contracts.map((contract) => contract.id)).toEqual([
      'heuristic',
      'transformers',
      'webllm',
      'gemma4',
      'chrome-prompt-api',
    ]);
    expect(
      contracts.find((contract) => contract.id === 'webllm')?.capabilities.requiresWebGpu,
    ).toBe(true);
  });

  it('runs and persists benchmark summaries for the supported local providers', async () => {
    const records = await runAgentProviderBenchmarks({
      db,
      providerIds: ['heuristic', 'transformers', 'webllm'],
      persist: true,
    });

    expect(records).toHaveLength(9);

    const persisted = await listAgentBenchmarkRecords(db, { limit: 20 });
    expect(persisted).toHaveLength(9);

    const transformersOpportunity = persisted.find(
      (record) =>
        record.skillId === 'opportunity-extractor' && record.providerId === 'transformers',
    );
    const webLlmBrief = persisted.find(
      (record) => record.skillId === 'capital-formation-brief' && record.providerId === 'webllm',
    );

    expect(transformersOpportunity?.schemaPassRate).toBe(1);
    expect(transformersOpportunity?.jsonRepairRate).toBe(1);
    expect(typeof transformersOpportunity?.medianLatencyMs).toBe('number');
    expect(typeof transformersOpportunity?.coldStartTimeMs).toBe('number');
    expect(webLlmBrief?.confidenceScore).toBeGreaterThan(0.5);
    expect(webLlmBrief?.outcome).toBe('completed');
  });
});
