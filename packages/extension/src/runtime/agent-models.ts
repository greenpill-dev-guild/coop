import type {
  AgentProvider,
  CapitalFormationBriefOutput,
  EcosystemEntityExtractorOutput,
  GrantFitScorerOutput,
  GreenGoodsAssessmentOutput,
  GreenGoodsGapAdminSyncOutput,
  GreenGoodsWorkApprovalOutput,
  OpportunityExtractorOutput,
  PublishReadinessCheckOutput,
  ReviewDigestOutput,
  SkillOutputSchemaRef,
  ThemeClustererOutput,
} from '@coop/shared';
import { validateSkillOutput } from '@coop/shared';
import { AgentWebLlmBridge } from './agent-webllm-bridge';

const TRANSFORMERS_MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

type TextGenerationPipeline = (
  messages: Array<{ role: string; content: string }>,
  options: Record<string, unknown>,
) => Promise<Array<{ generated_text: string | Array<{ content?: string }> }>>;

let transformersPipelinePromise: Promise<TextGenerationPipeline> | null = null;
const webLlmBridge = new AgentWebLlmBridge();

function extractJsonBlock(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const content = fenced?.[1] ?? trimmed;
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }
  return content;
}

function parseValidatedOutput<T>(schemaRef: SkillOutputSchemaRef, raw: string) {
  return validateSkillOutput<T>(schemaRef, JSON.parse(extractJsonBlock(raw)));
}

async function ensureTransformersPipeline() {
  if (transformersPipelinePromise) {
    return transformersPipelinePromise;
  }

  transformersPipelinePromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    return (await pipeline('text-generation', TRANSFORMERS_MODEL_ID, {
      dtype: 'q4',
      device: 'wasm',
    })) as TextGenerationPipeline;
  })();

  return transformersPipelinePromise;
}

function heuristicOutput(schemaRef: SkillOutputSchemaRef, rawContext: string) {
  switch (schemaRef) {
    case 'opportunity-extractor-output':
      return {
        candidates: [
          {
            id: `candidate-${Date.now()}`,
            title: rawContext.slice(0, 60) || 'Potential opportunity',
            summary: rawContext.slice(0, 180) || 'Potential ecological funding opportunity.',
            rationale: 'Heuristic extraction found coordination, funding, or opportunity language.',
            regionTags: [],
            ecologyTags: [],
            fundingSignals: ['local-signal'],
            priority: 0.58,
            recommendedNextStep:
              'Review the source and decide whether it should become a funding lead draft.',
          },
        ],
      } satisfies OpportunityExtractorOutput;
    case 'grant-fit-scorer-output':
      return {
        scores: [],
      } satisfies GrantFitScorerOutput;
    case 'capital-formation-brief-output':
      return {
        title: 'Potential capital formation opportunity',
        summary:
          rawContext.slice(0, 220) || 'This source may inform a capital formation opportunity.',
        whyItMatters:
          'The signal appears relevant to the coop purpose and could support funding readiness.',
        suggestedNextStep:
          'Review the signal, tighten the thesis, and decide whether to route it into a funding brief.',
        tags: ['funding', 'opportunity'],
        targetCoopIds: [],
        supportingCandidateIds: [],
      } satisfies CapitalFormationBriefOutput;
    case 'review-digest-output':
      return {
        title: 'Weekly review digest',
        summary: rawContext.slice(0, 220) || 'A heuristic digest of recent coop activity.',
        whyItMatters: 'It keeps recent signals legible before the next review ritual.',
        suggestedNextStep: 'Review highlights together and choose what moves forward.',
        highlights: [rawContext.slice(0, 120) || 'No recent highlights available.'],
        tags: ['review', 'digest'],
      } satisfies ReviewDigestOutput;
    case 'ecosystem-entity-extractor-output':
      return {
        entities: [],
      } satisfies EcosystemEntityExtractorOutput;
    case 'theme-clusterer-output':
      return {
        themes: [],
      } satisfies ThemeClustererOutput;
    case 'publish-readiness-check-output':
      return {
        draftId: 'unknown',
        ready: false,
        suggestions: ['Review summary clarity and tags before publishing.'],
        proposedPatch: {},
      } satisfies PublishReadinessCheckOutput;
    case 'green-goods-garden-bootstrap-output':
      return {
        name: 'Coop Garden',
        description: rawContext.slice(0, 220) || 'Green Goods garden bootstrap for this coop.',
        location: '',
        bannerImage: '',
        metadata: '',
        openJoining: false,
        maxGardeners: 0,
        weightScheme: 'linear',
        domains: ['agro'],
        rationale: 'Heuristic bootstrap uses coop purpose and setup context.',
      };
    case 'green-goods-garden-sync-output':
      return {
        name: 'Coop Garden',
        description:
          rawContext.slice(0, 220) || 'Sync the Green Goods garden to current coop state.',
        location: '',
        bannerImage: '',
        metadata: '',
        openJoining: false,
        maxGardeners: 0,
        domains: ['agro'],
        ensurePools: true,
        rationale: 'Heuristic sync keeps garden metadata aligned with coop state.',
      };
    case 'green-goods-work-approval-output':
      return {
        actionUid: 0,
        workUid: `0x${'0'.repeat(64)}`,
        approved: true,
        feedback: rawContext.slice(0, 180),
        confidence: 100,
        verificationMethod: 0,
        reviewNotesCid: '',
        rationale: 'Heuristic Green Goods work approval output requires structured request data.',
      } satisfies GreenGoodsWorkApprovalOutput;
    case 'green-goods-assessment-output':
      return {
        title: 'Green Goods assessment',
        description: rawContext.slice(0, 220) || 'Assessment attestation request.',
        assessmentConfigCid: 'bafyassessmentconfigplaceholder',
        domain: 'agro',
        startDate: 0,
        endDate: 0,
        location: '',
        rationale: 'Heuristic Green Goods assessment output requires structured request data.',
      } satisfies GreenGoodsAssessmentOutput;
    case 'green-goods-gap-admin-sync-output':
      return {
        addAdmins: [],
        removeAdmins: [],
        rationale: 'Heuristic GAP admin sync detected no changes.',
      } satisfies GreenGoodsGapAdminSyncOutput;
  }
}

async function runTransformers<T>(input: {
  prompt: string;
  schemaRef: SkillOutputSchemaRef;
}) {
  const start = Date.now();
  const pipeline = await ensureTransformersPipeline();
  const result = await pipeline([{ role: 'user', content: input.prompt }], {
    max_new_tokens: 512,
    temperature: 0.2,
    do_sample: false,
    return_full_text: false,
  });
  const output =
    Array.isArray(result) && result[0]?.generated_text
      ? typeof result[0].generated_text === 'string'
        ? result[0].generated_text
        : Array.isArray(result[0].generated_text)
          ? (result[0].generated_text[result[0].generated_text.length - 1]?.content ?? '')
          : ''
      : '';

  return {
    provider: 'transformers' as const,
    model: TRANSFORMERS_MODEL_ID,
    output: parseValidatedOutput<T>(input.schemaRef, output),
    durationMs: Date.now() - start,
  };
}

async function runWebLlm<T>(input: {
  system: string;
  prompt: string;
  schemaRef: SkillOutputSchemaRef;
}) {
  const result = await webLlmBridge.complete({
    system: input.system,
    prompt: input.prompt,
    temperature: 0.2,
    maxTokens: 700,
  });
  return {
    provider: result.provider,
    model: result.model,
    output: parseValidatedOutput<T>(input.schemaRef, result.output),
    durationMs: result.durationMs,
  };
}

export async function completeSkillOutput<T>(input: {
  preferredProvider: AgentProvider;
  schemaRef: SkillOutputSchemaRef;
  system: string;
  prompt: string;
  heuristicContext: string;
}): Promise<{ provider: AgentProvider; model?: string; output: T; durationMs: number }> {
  const fallback = () => ({
    provider: 'heuristic' as const,
    model: undefined,
    output: heuristicOutput(input.schemaRef, input.heuristicContext) as T,
    durationMs: 0,
  });

  try {
    if (input.preferredProvider === 'webllm') {
      return await runWebLlm<T>({
        system: input.system,
        prompt: input.prompt,
        schemaRef: input.schemaRef,
      });
    }

    if (input.preferredProvider === 'transformers') {
      return await runTransformers<T>({
        prompt: `${input.system}\n\n${input.prompt}`,
        schemaRef: input.schemaRef,
      });
    }
  } catch {
    // Fall through to the next provider or heuristic fallback.
  }

  if (input.preferredProvider === 'webllm') {
    try {
      return await runTransformers<T>({
        prompt: `${input.system}\n\n${input.prompt}`,
        schemaRef: input.schemaRef,
      });
    } catch {
      return fallback();
    }
  }

  return fallback();
}

export function teardownAgentModels() {
  webLlmBridge.teardown();
}
