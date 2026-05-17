import type {
  AgentProvider,
  CapitalFormationBriefOutput,
  EcosystemEntityExtractorOutput,
  EntityExtractionOutput,
  Erc8004FeedbackOutput,
  Erc8004RegistrationOutput,
  GrantActionPlannerOutput,
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
import { resolveOnnxRuntimeWasmPaths } from '../onnx-assets';
import { AGENT_SKILL_TIMEOUT_MS } from './config';
import {
  AgentGemma4Bridge,
  type Gemma4ToolDefinition,
  buildGemma4ToolForSkill,
  getDefaultGemma4ModelId,
  getGemma4ToolNameForSkill,
} from './gemma4-bridge';
import { inferPoleEntitiesFromText } from './runner-inference';
import { AgentWebLlmBridge } from './webllm-bridge';

const TRANSFORMERS_MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const TRANSFORMERS_COLD_START_FALLBACK_SCHEMAS = new Set<SkillOutputSchemaRef>([
  'tab-router-output',
  'opportunity-extractor-output',
  'grant-fit-scorer-output',
  'entity-extraction-output',
  'ecosystem-entity-extractor-output',
  'theme-clusterer-output',
]);
const WEBLLM_COLD_START_FALLBACK_SCHEMAS = new Set<SkillOutputSchemaRef>([
  'capital-formation-brief-output',
  'review-digest-output',
  'memory-insight-output',
]);

type TextGenerationPipeline = (
  messages: Array<{ role: string; content: string }>,
  options: Record<string, unknown>,
) => Promise<Array<{ generated_text: string | Array<{ content?: string }> }>>;

let transformersPipelinePromise: Promise<TextGenerationPipeline> | null = null;
let transformersPipelineReady = false;
let transformersPipelineEpoch = 0;
const webLlmBridge = new AgentWebLlmBridge();
const gemma4Bridge = new AgentGemma4Bridge();

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

function getAbortError(signal?: AbortSignal) {
  if (signal?.reason instanceof Error) {
    return signal.reason;
  }
  return new Error('Operation aborted.');
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw getAbortError(signal);
  }
}

async function withTimeoutAndSignal<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  signal?: AbortSignal,
) {
  let abortListener: (() => void) | null = null;
  try {
    throwIfAborted(signal);
    return await Promise.race([
      withTimeout(promise, timeoutMs, label),
      new Promise<T>((_, reject) => {
        if (!signal) {
          return;
        }
        if (signal.aborted) {
          reject(getAbortError(signal));
          return;
        }
        abortListener = () => reject(getAbortError(signal));
        signal.addEventListener('abort', abortListener, { once: true });
      }),
    ]);
  } finally {
    if (signal && abortListener) {
      signal.removeEventListener('abort', abortListener);
    }
  }
}

function warmTransformersPipeline() {
  void ensureTransformersPipeline().catch(() => {
    transformersPipelinePromise = null;
    transformersPipelineReady = false;
  });
}

export function isTransformersPipelineReady() {
  return transformersPipelineReady;
}

export function getTransformersModelId() {
  return TRANSFORMERS_MODEL_ID;
}

export async function initializeTransformersPipeline() {
  const start = Date.now();
  await ensureTransformersPipeline();
  return {
    model: TRANSFORMERS_MODEL_ID,
    durationMs: Date.now() - start,
  };
}

export function getAgentWebLlmStatus() {
  return webLlmBridge.status;
}

export async function initializeWebLlmEngine() {
  return webLlmBridge.initialize();
}

export function getAgentGemma4Status() {
  return gemma4Bridge.status;
}

export async function initializeGemma4Engine() {
  return gemma4Bridge.initialize();
}

export function getGemma4ModelId() {
  return getDefaultGemma4ModelId();
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

export function parseValidatedOutputAttempt<T>(schemaRef: SkillOutputSchemaRef, raw: string) {
  const extracted = extractJsonBlock(raw);
  const repaired = repairJson(extracted);
  return {
    output: validateSkillOutput<T>(schemaRef, JSON.parse(repaired)),
    jsonRepaired: repaired !== extracted,
  };
}

function parseValidatedOutput<T>(schemaRef: SkillOutputSchemaRef, raw: string) {
  return parseValidatedOutputAttempt<T>(schemaRef, raw).output;
}

function parseValidatedJson<T>(validate: (value: unknown) => T, raw: string) {
  return validate(JSON.parse(repairJson(extractJsonBlock(raw))));
}

async function ensureTransformersPipeline() {
  if (transformersPipelinePromise) {
    return transformersPipelinePromise;
  }

  const epoch = transformersPipelineEpoch;
  transformersPipelinePromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.wasmPaths = resolveOnnxRuntimeWasmPaths();
    }

    // biome-ignore lint/suspicious/noExplicitAny: pipeline overloads produce an unrepresentable union
    return (await (pipeline as any)('text-generation', TRANSFORMERS_MODEL_ID, {
      dtype: 'q4',
      device: 'wasm',
    })) as TextGenerationPipeline;
  })()
    .then((loadedPipeline) => {
      if (epoch === transformersPipelineEpoch) {
        transformersPipelineReady = true;
      }
      return loadedPipeline;
    })
    .catch((error) => {
      if (epoch === transformersPipelineEpoch) {
        transformersPipelineReady = false;
      }
      throw error;
    });

  return transformersPipelinePromise;
}

export function buildHeuristicSkillOutput<T>(
  schemaRef: SkillOutputSchemaRef,
  rawContext: string,
): T {
  return validateSkillOutput<T>(schemaRef, heuristicOutput(schemaRef, rawContext));
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
              rawContext.slice(0, 220) || 'Recent routed signals suggest a reusable local insight.',
            whyItMatters: 'A compact local insight helps the member decide what to review next.',
            suggestedNextStep:
              'Review the routed signals and decide whether this should stay local or be polished.',
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
    case 'entity-extraction-output':
      return inferPoleEntitiesFromText(rawContext) satisfies EntityExtractionOutput;
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
    case 'grant-action-planner-output':
      return {
        action: 'request_member_input',
        opportunityTitle: rawContext.slice(0, 80) || 'Top-scored opportunity',
        outlineSections: [],
        memberIds: [],
        rationale:
          'Heuristic plan suggests requesting member input until the on-device model picks a richer follow-up.',
      } satisfies GrantActionPlannerOutput;
    case 'knowledge-lint-output':
      return {
        findings: [],
      };
  }
}

export async function runTransformersTextCompletion(input: {
  prompt: string;
  maxTokens?: number;
  retryContext?: string;
  signal?: AbortSignal;
}) {
  const start = Date.now();
  const pipeline = await withTimeoutAndSignal(
    ensureTransformersPipeline(),
    AGENT_SKILL_TIMEOUT_MS,
    'Transformers pipeline initialization',
    input.signal,
  );
  const promptWithRetry = input.retryContext
    ? `${input.prompt}\n\n${input.retryContext}`
    : input.prompt;
  const result = await withTimeoutAndSignal(
    pipeline([{ role: 'user', content: promptWithRetry }], {
      max_new_tokens: input.maxTokens ?? 512,
      temperature: 0.2,
      do_sample: false,
      return_full_text: false,
    }),
    AGENT_SKILL_TIMEOUT_MS,
    'Transformers completion',
    input.signal,
  );
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
    output,
    durationMs: Date.now() - start,
  };
}

async function runTransformers<T>(input: {
  prompt: string;
  schemaRef: SkillOutputSchemaRef;
  maxTokens?: number;
  retryContext?: string;
  signal?: AbortSignal;
}) {
  const result = await runTransformersTextCompletion(input);
  return {
    provider: result.provider,
    model: result.model,
    output: parseValidatedOutput<T>(input.schemaRef, result.output),
    durationMs: result.durationMs,
  };
}

async function runTransformersStructured<T>(input: {
  prompt: string;
  validate: (value: unknown) => T;
  maxTokens?: number;
  retryContext?: string;
  signal?: AbortSignal;
}) {
  const start = Date.now();
  const pipeline = await withTimeoutAndSignal(
    ensureTransformersPipeline(),
    AGENT_SKILL_TIMEOUT_MS,
    'Transformers pipeline initialization',
    input.signal,
  );
  const promptWithRetry = input.retryContext
    ? `${input.prompt}\n\n${input.retryContext}`
    : input.prompt;
  const result = await withTimeoutAndSignal(
    pipeline([{ role: 'user', content: promptWithRetry }], {
      max_new_tokens: input.maxTokens ?? 512,
      temperature: 0.2,
      do_sample: false,
      return_full_text: false,
    }),
    AGENT_SKILL_TIMEOUT_MS,
    'Transformers completion',
    input.signal,
  );
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
    output: parseValidatedJson(input.validate, output),
    durationMs: Date.now() - start,
  };
}

export async function runWebLlmTextCompletion(input: {
  system: string;
  prompt: string;
  maxTokens?: number;
  retryContext?: string;
  signal?: AbortSignal;
}) {
  const promptWithRetry = input.retryContext
    ? `${input.prompt}\n\n${input.retryContext}`
    : input.prompt;
  return withTimeoutAndSignal(
    webLlmBridge.complete({
      system: input.system,
      prompt: promptWithRetry,
      temperature: 0.2,
      maxTokens: input.maxTokens ?? 700,
    }),
    AGENT_SKILL_TIMEOUT_MS,
    'WebLLM completion',
    input.signal,
  );
}

async function runWebLlm<T>(input: {
  system: string;
  prompt: string;
  schemaRef: SkillOutputSchemaRef;
  maxTokens?: number;
  retryContext?: string;
  signal?: AbortSignal;
}) {
  const result = await runWebLlmTextCompletion(input);
  return {
    provider: result.provider,
    model: result.model,
    output: parseValidatedOutput<T>(input.schemaRef, result.output),
    durationMs: result.durationMs,
  };
}

async function runWebLlmStructured<T>(input: {
  system: string;
  prompt: string;
  validate: (value: unknown) => T;
  maxTokens?: number;
  retryContext?: string;
  signal?: AbortSignal;
}) {
  const promptWithRetry = input.retryContext
    ? `${input.prompt}\n\n${input.retryContext}`
    : input.prompt;
  const result = await withTimeoutAndSignal(
    webLlmBridge.complete({
      system: input.system,
      prompt: promptWithRetry,
      temperature: 0.2,
      maxTokens: input.maxTokens ?? 700,
    }),
    AGENT_SKILL_TIMEOUT_MS,
    'WebLLM completion',
    input.signal,
  );
  return {
    provider: result.provider,
    model: result.model,
    output: parseValidatedJson(input.validate, result.output),
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
  signal?: AbortSignal;
  // Multimodal context — only consumed by the gemma4 path. Other providers
  // ignore these fields, so callers can populate them eagerly when an
  // observation carries an image or audio attachment.
  imageUrl?: string;
  audioUrl?: string;
  audioSamplingRate?: number;
}): Promise<{ provider: AgentProvider; model?: string; output: T; durationMs: number }> {
  const fallback = () => ({
    provider: 'heuristic' as const,
    model: undefined,
    output: heuristicOutput(input.schemaRef, input.heuristicContext) as T,
    durationMs: 0,
  });

  // Keep first-pass local inference responsive. If the Transformers pipeline is
  // still cold, warm it in the background and fall back to a local heuristic
  // for schemas that already have deterministic heuristic support.
  if (
    input.preferredProvider === 'transformers' &&
    TRANSFORMERS_COLD_START_FALLBACK_SCHEMAS.has(input.schemaRef)
  ) {
    throwIfAborted(input.signal);
    if (!transformersPipelineReady) {
      warmTransformersPipeline();
      return fallback();
    }
  }

  if (
    input.preferredProvider === 'webllm' &&
    WEBLLM_COLD_START_FALLBACK_SCHEMAS.has(input.schemaRef)
  ) {
    throwIfAborted(input.signal);
    if (!webLlmBridge.status.ready) {
      webLlmBridge.prewarm();
      return fallback();
    }
  }

  try {
    if (input.preferredProvider === 'gemma4') {
      try {
        return await runGemma4<T>({
          system: input.system,
          prompt: input.prompt,
          schemaRef: input.schemaRef,
          maxTokens: input.maxTokens,
          imageUrl: input.imageUrl,
          audioUrl: input.audioUrl,
          audioSamplingRate: input.audioSamplingRate,
          signal: input.signal,
        });
      } catch (firstError) {
        throwIfAborted(input.signal);
        if (firstError instanceof Error && /timed out/i.test(firstError.message)) {
          throw firstError;
        }
        try {
          return await runGemma4<T>({
            system: input.system,
            prompt: input.prompt,
            schemaRef: input.schemaRef,
            maxTokens: input.maxTokens,
            imageUrl: input.imageUrl,
            audioUrl: input.audioUrl,
            audioSamplingRate: input.audioSamplingRate,
            retryContext: formatRetryContext(firstError),
            signal: input.signal,
          });
        } catch {
          throwIfAborted(input.signal);
          // Fall through to webllm/transformers/heuristic chain
        }
      }
    }

    if (input.preferredProvider === 'webllm') {
      try {
        return await runWebLlm<T>({
          system: input.system,
          prompt: input.prompt,
          schemaRef: input.schemaRef,
          maxTokens: input.maxTokens,
          signal: input.signal,
        });
      } catch (firstError) {
        throwIfAborted(input.signal);
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
            signal: input.signal,
          });
        } catch {
          throwIfAborted(input.signal);
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
          signal: input.signal,
        });
      } catch (firstError) {
        throwIfAborted(input.signal);
        try {
          return await runTransformers<T>({
            prompt: `${input.system}\n\n${input.prompt}`,
            schemaRef: input.schemaRef,
            maxTokens: input.maxTokens,
            retryContext: formatRetryContext(firstError),
            signal: input.signal,
          });
        } catch {
          throwIfAborted(input.signal);
          // Both attempts failed — fall through to heuristic
        }
      }
      throwIfAborted(input.signal);
      return fallback();
    }
  } catch {
    throwIfAborted(input.signal);
    // Fall through to the next provider or heuristic fallback.
  }

  if (input.preferredProvider === 'webllm' || input.preferredProvider === 'gemma4') {
    try {
      return await runTransformers<T>({
        prompt: `${input.system}\n\n${input.prompt}`,
        schemaRef: input.schemaRef,
        maxTokens: input.maxTokens,
        signal: input.signal,
      });
    } catch {
      throwIfAborted(input.signal);
      return fallback();
    }
  }

  throwIfAborted(input.signal);
  return fallback();
}

export async function completeStructuredOutput<T>(input: {
  preferredProvider: AgentProvider;
  system: string;
  prompt: string;
  maxTokens?: number;
  validate: (value: unknown) => T;
  fallback: () => T;
}): Promise<{ provider: AgentProvider; model?: string; output: T; durationMs: number }> {
  const fallback = () => ({
    provider: 'heuristic' as const,
    model: undefined,
    output: input.fallback(),
    durationMs: 0,
  });

  try {
    if (input.preferredProvider === 'webllm') {
      try {
        return await runWebLlmStructured<T>({
          system: input.system,
          prompt: input.prompt,
          validate: input.validate,
          maxTokens: input.maxTokens,
        });
      } catch (firstError) {
        if (firstError instanceof Error && /timed out/i.test(firstError.message)) {
          throw firstError;
        }
        try {
          return await runWebLlmStructured<T>({
            system: input.system,
            prompt: input.prompt,
            validate: input.validate,
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
        return await runTransformersStructured<T>({
          prompt: `${input.system}\n\n${input.prompt}`,
          validate: input.validate,
          maxTokens: input.maxTokens,
        });
      } catch (firstError) {
        try {
          return await runTransformersStructured<T>({
            prompt: `${input.system}\n\n${input.prompt}`,
            validate: input.validate,
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
      return await runTransformersStructured<T>({
        prompt: `${input.system}\n\n${input.prompt}`,
        validate: input.validate,
        maxTokens: input.maxTokens,
      });
    } catch {
      return fallback();
    }
  }

  return fallback();
}

export type Gemma4SkillCompletionInput = {
  system: string;
  prompt: string;
  imageUrl?: string;
  audioUrl?: string;
  audioSamplingRate?: number;
  tools?: Gemma4ToolDefinition[];
  forceToolName?: string;
  maxTokens?: number;
  retryContext?: string;
  signal?: AbortSignal;
};

export async function runGemma4TextCompletion(input: Gemma4SkillCompletionInput) {
  const promptWithRetry = input.retryContext
    ? `${input.prompt}\n\n${input.retryContext}`
    : input.prompt;
  const start = Date.now();
  const result = await withTimeoutAndSignal(
    gemma4Bridge.complete({
      system: input.system,
      prompt: promptWithRetry,
      imageUrl: input.imageUrl,
      audioUrl: input.audioUrl,
      audioSamplingRate: input.audioSamplingRate,
      tools: input.tools,
      forceToolName: input.forceToolName,
      maxTokens: input.maxTokens ?? 512,
      temperature: 0,
    }),
    AGENT_SKILL_TIMEOUT_MS,
    'Gemma4 completion',
    input.signal,
  );
  return {
    provider: 'gemma4' as const,
    model: result.model,
    output: result.output,
    toolCall: result.toolCall,
    durationMs: Date.now() - start,
  };
}

async function runGemma4<T>(
  input: Gemma4SkillCompletionInput & { schemaRef: SkillOutputSchemaRef },
) {
  // Build the Gemma 4 tool schema for this skill on demand and pass it to the
  // worker so apply_chat_template's `tools:` slot is populated. Skills without
  // a registered tool schema still produce a JSON answer that the existing
  // schema validator handles, which keeps the back-half skills working while
  // the demo-path skills move to native function calling.
  const tool = buildGemma4ToolForSkill(input.schemaRef);
  const forceToolName = getGemma4ToolNameForSkill(input.schemaRef);
  const result = await runGemma4TextCompletion({
    ...input,
    tools: tool ? [tool] : input.tools,
    forceToolName: forceToolName ?? input.forceToolName,
  });
  // Prefer the parsed tool-call payload — it is the function-calling contract
  // judges and ARCHITECTURE.md will refer to. Fall back to extracting JSON
  // from the raw text so the path still completes when the model elects to
  // emit a JSON object directly instead of wrapping it in a tool_call tag.
  if (result.toolCall) {
    const validated = validateSkillOutput<T>(input.schemaRef, result.toolCall.arguments);
    return {
      provider: result.provider,
      model: result.model,
      output: validated,
      durationMs: result.durationMs,
    };
  }
  return {
    provider: result.provider,
    model: result.model,
    output: parseValidatedOutput<T>(input.schemaRef, result.output),
    durationMs: result.durationMs,
  };
}

export function teardownAgentModels() {
  transformersPipelineEpoch += 1;
  transformersPipelinePromise = null;
  transformersPipelineReady = false;
  webLlmBridge.teardown();
  gemma4Bridge.teardown();
}
