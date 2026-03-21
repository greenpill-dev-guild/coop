import type {
  AgentProvider,
  CapitalFormationBriefOutput,
  EcosystemEntityExtractorOutput,
  Erc8004FeedbackOutput,
  Erc8004RegistrationOutput,
  GrantFitScorerOutput,
  GreenGoodsAssessmentOutput,
  GreenGoodsGapAdminSyncOutput,
  GreenGoodsWorkApprovalOutput,
  MemoryInsightOutput,
  OpportunityExtractorOutput,
  PublishReadinessCheckOutput,
  ReviewDigestOutput,
  SkillOutputSchemaRef,
  TabRouterOutput,
  ThemeClustererOutput,
} from '@coop/shared';
import { validateSkillOutput } from '@coop/shared';
import { AGENT_SKILL_TIMEOUT_MS } from './agent-config';
import { AgentWebLlmBridge } from './agent-webllm-bridge';

const TRANSFORMERS_MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

type TextGenerationPipeline = (
  messages: Array<{ role: string; content: string }>,
  options: Record<string, unknown>,
) => Promise<Array<{ generated_text: string | Array<{ content?: string }> }>>;

let transformersPipelinePromise: Promise<TextGenerationPipeline> | null = null;
const webLlmBridge = new AgentWebLlmBridge();

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function warmTransformersPipeline() {
  void ensureTransformersPipeline().catch(() => {
    transformersPipelinePromise = null;
  });
}

export function extractJsonBlock(raw: string) {
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

/**
 * Repairs common small-model JSON failures:
 * - Strips control characters (except \n, \t, \r)
 * - Fixes trailing commas before } or ]
 * - Handles truncated strings (adds missing closing quote)
 * - Adds missing closing braces/brackets (counts unmatched openers)
 */
export function repairJson(raw: string): string {
  // 1. Strip control characters except \n (0x0A), \t (0x09), \r (0x0D)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control character stripping
  let result = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  // 2. Fix trailing commas before } or ] (with optional whitespace)
  result = result.replace(/,(\s*[}\]])/g, '$1');

  // 3. Handle truncated strings and escape raw newlines inside string values.
  //    Small models sometimes produce unescaped newlines inside JSON strings,
  //    or truncate mid-string without a closing quote.
  let inString = false;
  let escaped = false;
  let fixed = '';
  for (let i = 0; i < result.length; i++) {
    const ch = result[i];
    if (escaped) {
      escaped = false;
      fixed += ch;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      fixed += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      fixed += ch;
      continue;
    }
    // Escape raw newlines/tabs/CRs inside string values
    if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
      fixed += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : '\\t';
      continue;
    }
    fixed += ch;
  }
  if (inString) {
    fixed += '"';
  }
  result = fixed;

  // 4. Add missing closing braces/brackets by rebuilding with a stack
  //    When a closer doesn't match the top of the stack, insert the
  //    expected closer before it (handles e.g. `[1,2}` → `[1,2]}`)
  inString = false;
  escaped = false;
  const stack: string[] = [];
  let rebuilt = '';
  for (let i = 0; i < result.length; i++) {
    const ch = result[i];
    if (escaped) {
      escaped = false;
      rebuilt += ch;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      rebuilt += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      rebuilt += ch;
      continue;
    }
    if (inString) {
      rebuilt += ch;
      continue;
    }
    if (ch === '{') {
      stack.push('}');
      rebuilt += ch;
    } else if (ch === '[') {
      stack.push(']');
      rebuilt += ch;
    } else if (ch === '}' || ch === ']') {
      // Insert missing closers for any mismatched openers above the matching one
      const matchIdx = stack.lastIndexOf(ch);
      if (matchIdx >= 0) {
        for (let j = stack.length - 1; j > matchIdx; j--) {
          rebuilt += stack.pop();
        }
        stack.pop();
      }
      rebuilt += ch;
    } else {
      rebuilt += ch;
    }
  }
  // Close any remaining unmatched openers (LIFO)
  while (stack.length > 0) {
    rebuilt += stack.pop();
  }
  result = rebuilt;

  return result;
}

function parseValidatedOutput<T>(schemaRef: SkillOutputSchemaRef, raw: string) {
  return validateSkillOutput<T>(schemaRef, JSON.parse(repairJson(extractJsonBlock(raw))));
}

async function ensureTransformersPipeline() {
  if (transformersPipelinePromise) {
    return transformersPipelinePromise;
  }

  transformersPipelinePromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    // Load ONNX WASM from CDN instead of bundling the 22 MB binary
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';

    return (await pipeline('text-generation', TRANSFORMERS_MODEL_ID, {
      dtype: 'q4',
      device: 'wasm',
    })) as TextGenerationPipeline;
  })();

  return transformersPipelinePromise;
}

function heuristicOutput(schemaRef: SkillOutputSchemaRef, rawContext: string) {
  switch (schemaRef) {
    case 'tab-router-output':
      return {
        routings: [],
      } satisfies TabRouterOutput;
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
    case 'memory-insight-output':
      return {
        insights: [
          {
            title: 'Local routing insight',
            summary:
              rawContext.slice(0, 220) || 'Recent routed tabs suggest a reusable local insight.',
            whyItMatters: 'A compact local insight helps the member decide what to review next.',
            suggestedNextStep:
              'Review the routed tabs and decide whether this should stay local or be polished.',
            tags: ['insight', 'routing'],
            category: 'insight',
            confidence: 0.68,
          },
        ],
      } satisfies MemoryInsightOutput;
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
    case 'erc8004-registration-output':
      return {
        agentURI: 'data:application/json;base64,e30=',
        metadata: [],
        rationale: 'Heuristic ERC-8004 registration payload.',
      } satisfies Erc8004RegistrationOutput;
    case 'erc8004-feedback-output':
      return {
        targetAgentId: 1,
        value: 1,
        tag1: 'coop',
        tag2: 'feedback',
        rationale: 'Heuristic ERC-8004 feedback payload.',
      } satisfies Erc8004FeedbackOutput;
  }
}

async function runTransformers<T>(input: {
  prompt: string;
  schemaRef: SkillOutputSchemaRef;
  maxTokens?: number;
  retryContext?: string;
}) {
  const start = Date.now();
  const pipeline = await ensureTransformersPipeline();
  const promptWithRetry = input.retryContext
    ? `${input.prompt}\n\n${input.retryContext}`
    : input.prompt;
  const result = await pipeline([{ role: 'user', content: promptWithRetry }], {
    max_new_tokens: input.maxTokens ?? 512,
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
  maxTokens?: number;
  retryContext?: string;
}) {
  const promptWithRetry = input.retryContext
    ? `${input.prompt}\n\n${input.retryContext}`
    : input.prompt;
  const result = await withTimeout(
    webLlmBridge.complete({
      system: input.system,
      prompt: promptWithRetry,
      temperature: 0.2,
      maxTokens: input.maxTokens ?? 700,
    }),
    AGENT_SKILL_TIMEOUT_MS,
    'WebLLM completion',
  );
  return {
    provider: result.provider,
    model: result.model,
    output: parseValidatedOutput<T>(input.schemaRef, result.output),
    durationMs: result.durationMs,
  };
}

function formatRetryContext(error: unknown): string {
  if (error instanceof SyntaxError) {
    return `Your previous output had validation errors: ${error.message}. Fix and return valid JSON.`;
  }
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues: Array<{ path: (string | number)[]; message: string }> })
      .issues;
    const msgs = issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return `Your previous output had validation errors: ${msgs}. Fix and return valid JSON.`;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return `Your previous output had validation errors: ${msg}. Fix and return valid JSON.`;
}

export async function completeSkillOutput<T>(input: {
  preferredProvider: AgentProvider;
  schemaRef: SkillOutputSchemaRef;
  system: string;
  prompt: string;
  heuristicContext: string;
  maxTokens?: number;
}): Promise<{ provider: AgentProvider; model?: string; output: T; durationMs: number }> {
  const fallback = () => ({
    provider: 'heuristic' as const,
    model: undefined,
    output: heuristicOutput(input.schemaRef, input.heuristicContext) as T,
    durationMs: 0,
  });

  // Keep first-pass tab routing responsive. If the Transformers pipeline is
  // still cold, warm it in the background and route heuristically now.
  if (input.preferredProvider === 'transformers' && input.schemaRef === 'tab-router-output') {
    if (!transformersPipelinePromise) {
      warmTransformersPipeline();
      return fallback();
    }
  }

  try {
    if (input.preferredProvider === 'webllm') {
      try {
        return await runWebLlm<T>({
          system: input.system,
          prompt: input.prompt,
          schemaRef: input.schemaRef,
          maxTokens: input.maxTokens,
        });
      } catch (firstError) {
        if (firstError instanceof Error && /timed out/i.test(firstError.message)) {
          throw firstError;
        }
        // Retry once with error context
        try {
          return await runWebLlm<T>({
            system: input.system,
            prompt: input.prompt,
            schemaRef: input.schemaRef,
            maxTokens: input.maxTokens,
            retryContext: formatRetryContext(firstError),
          });
        } catch {
          // Both attempts failed — fall through to next provider
        }
      }
    }

    if (input.preferredProvider === 'transformers') {
      try {
        return await runTransformers<T>({
          prompt: `${input.system}\n\n${input.prompt}`,
          schemaRef: input.schemaRef,
          maxTokens: input.maxTokens,
        });
      } catch (firstError) {
        try {
          return await runTransformers<T>({
            prompt: `${input.system}\n\n${input.prompt}`,
            schemaRef: input.schemaRef,
            maxTokens: input.maxTokens,
            retryContext: formatRetryContext(firstError),
          });
        } catch {
          // Both attempts failed — fall through to heuristic
        }
      }
      return fallback();
    }
  } catch {
    // Fall through to the next provider or heuristic fallback.
  }

  if (input.preferredProvider === 'webllm') {
    try {
      return await runTransformers<T>({
        prompt: `${input.system}\n\n${input.prompt}`,
        schemaRef: input.schemaRef,
        maxTokens: input.maxTokens,
      });
    } catch {
      return fallback();
    }
  }

  return fallback();
}

export function teardownAgentModels() {
  transformersPipelinePromise = null;
  webLlmBridge.teardown();
}
