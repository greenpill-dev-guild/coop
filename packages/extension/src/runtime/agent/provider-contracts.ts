import type {
  AgentRuntimeProviderContract,
  AgentRuntimeProviderId,
  SkillOutputSchemaRef,
} from '@coop/shared';
import { validateAgentRuntimeProviderContract } from '@coop/shared';
import { resolveConfiguredChromePromptApiEnabled } from '../config';
import {
  buildHeuristicSkillOutput,
  getAgentGemma4Status,
  getAgentWebLlmStatus,
  getGemma4ModelId,
  getTransformersModelId,
  initializeGemma4Engine,
  initializeTransformersPipeline,
  initializeWebLlmEngine,
  isTransformersPipelineReady,
  parseValidatedOutputAttempt,
  runGemma4TextCompletion,
  runTransformersTextCompletion,
  runWebLlmTextCompletion,
} from './models';

type ProviderExecutionBase = {
  providerId: AgentRuntimeProviderId;
  modelId?: string;
  durationMs: number;
  coldStartMs: number | null;
  jsonRepaired: boolean;
};

export type RuntimeProviderAvailability = {
  available: boolean;
  reason?: string;
  fallbackProviderId?: AgentRuntimeProviderId;
};

export type RuntimeProviderExecutionResult<T> =
  | (ProviderExecutionBase & {
      outcome: 'completed';
      schemaPassed: true;
      output: T;
    })
  | (ProviderExecutionBase & {
      outcome: 'failed';
      schemaPassed: false;
      failureReason: string;
    })
  | (ProviderExecutionBase & {
      outcome: 'unavailable';
      schemaPassed: false;
      unavailableReason: string;
      fallbackProviderId?: AgentRuntimeProviderId;
    });

type PromptApiSession = {
  prompt(
    input: string,
    options?: {
      responseConstraint?: Record<string, unknown>;
      omitResponseConstraintInput?: boolean;
      signal?: AbortSignal;
    },
  ): Promise<string>;
  destroy?: () => Promise<void> | void;
};

type PromptApiGlobal = {
  availability: (options?: Record<string, unknown>) => Promise<string>;
  create: (options?: Record<string, unknown>) => Promise<PromptApiSession>;
};

const PROMPT_API_ENABLED = resolveConfiguredChromePromptApiEnabled(
  import.meta.env.VITE_COOP_ENABLE_CHROME_PROMPT_API,
);

const PROVIDER_CONTRACTS = [
  {
    id: 'heuristic',
    tier: 'p0',
    label: 'Heuristic fallback',
    experimental: false,
    capabilities: {
      structuredJson: 'deterministic',
      workerSafe: true,
      offscreenSafe: true,
      requiresWebGpu: false,
      supportsStreaming: false,
      supportsMultimodal: false,
    },
    fallbackOrder: [],
  },
  {
    id: 'transformers',
    tier: 'p1',
    label: 'Transformers.js WASM',
    defaultModelId: getTransformersModelId(),
    experimental: false,
    capabilities: {
      structuredJson: 'repairable',
      workerSafe: true,
      offscreenSafe: true,
      requiresWebGpu: false,
      supportsStreaming: false,
      supportsMultimodal: false,
    },
    fallbackOrder: ['heuristic'],
  },
  {
    id: 'webllm',
    tier: 'p2',
    label: 'WebLLM WebGPU',
    defaultModelId: getAgentWebLlmStatus().model,
    experimental: false,
    capabilities: {
      structuredJson: 'grammar-constrained',
      workerSafe: true,
      offscreenSafe: true,
      requiresWebGpu: true,
      supportsStreaming: false,
      supportsMultimodal: false,
    },
    fallbackOrder: ['transformers', 'heuristic'],
  },
  {
    id: 'gemma4',
    tier: 'p2',
    label: 'Gemma 4 (transformers.js)',
    defaultModelId: getGemma4ModelId(),
    experimental: false,
    capabilities: {
      structuredJson: 'function-calling',
      workerSafe: true,
      offscreenSafe: true,
      requiresWebGpu: true,
      supportsStreaming: false,
      supportsMultimodal: true,
    },
    fallbackOrder: ['webllm', 'transformers', 'heuristic'],
  },
  {
    id: 'chrome-prompt-api',
    tier: 'p3',
    label: 'Chrome Prompt API',
    defaultModelId: 'gemini-nano',
    experimental: true,
    capabilities: {
      structuredJson: 'schema-constrained',
      workerSafe: false,
      offscreenSafe: true,
      requiresWebGpu: false,
      supportsStreaming: true,
      supportsMultimodal: true,
    },
    fallbackOrder: ['webllm', 'transformers', 'heuristic'],
  },
] satisfies AgentRuntimeProviderContract[];

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatRetryContext(error: unknown): string {
  const message = toErrorMessage(error);
  return `Your previous output had validation errors: ${message}. Fix and return valid JSON.`;
}

function getPromptApiGlobal(): PromptApiGlobal | undefined {
  return (globalThis as { LanguageModel?: PromptApiGlobal }).LanguageModel;
}

function supportsWebGpu() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

function supportsWorker() {
  return typeof Worker !== 'undefined';
}

async function checkChromePromptAvailability(): Promise<RuntimeProviderAvailability> {
  if (!PROMPT_API_ENABLED) {
    return {
      available: false,
      reason: 'Chrome Prompt API scaffold is disabled by VITE_COOP_ENABLE_CHROME_PROMPT_API.',
      fallbackProviderId: 'webllm',
    };
  }

  const languageModel = getPromptApiGlobal();
  if (!languageModel) {
    return {
      available: false,
      reason: 'LanguageModel is not available in this runtime.',
      fallbackProviderId: 'webllm',
    };
  }

  try {
    const availability = await languageModel.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
    if (availability === 'unavailable') {
      return {
        available: false,
        reason: 'Chrome Prompt API reported unavailable.',
        fallbackProviderId: 'webllm',
      };
    }
    return { available: true };
  } catch (error) {
    return {
      available: false,
      reason: `Chrome Prompt API availability check failed: ${toErrorMessage(error)}`,
      fallbackProviderId: 'webllm',
    };
  }
}

export function listAgentRuntimeProviderContracts() {
  return PROVIDER_CONTRACTS.map((contract) => validateAgentRuntimeProviderContract(contract));
}

export function getAgentRuntimeProviderContract(providerId: AgentRuntimeProviderId) {
  return listAgentRuntimeProviderContracts().find((contract) => contract.id === providerId);
}

export async function getAgentRuntimeProviderAvailability(
  providerId: AgentRuntimeProviderId,
): Promise<RuntimeProviderAvailability> {
  switch (providerId) {
    case 'heuristic':
    case 'transformers':
      return { available: true };
    case 'webllm': {
      const status = getAgentWebLlmStatus();
      if (status.ready) {
        return { available: true };
      }
      if (!supportsWorker()) {
        return {
          available: false,
          reason: 'WebLLM requires Web Workers in this runtime.',
          fallbackProviderId: 'transformers',
        };
      }
      if (!supportsWebGpu()) {
        return {
          available: false,
          reason: 'WebLLM requires WebGPU support.',
          fallbackProviderId: 'transformers',
        };
      }
      return { available: true };
    }
    case 'gemma4': {
      const status = getAgentGemma4Status();
      if (status.ready) {
        return { available: true };
      }
      if (!supportsWorker()) {
        return {
          available: false,
          reason: 'Gemma 4 requires Web Workers in this runtime.',
          fallbackProviderId: 'webllm',
        };
      }
      if (!supportsWebGpu()) {
        return {
          available: false,
          reason: 'Gemma 4 requires WebGPU support.',
          fallbackProviderId: 'webllm',
        };
      }
      return { available: true };
    }
    case 'chrome-prompt-api':
      return checkChromePromptAvailability();
  }
}

async function runProviderWithRetry<T>(input: {
  providerId: AgentRuntimeProviderId;
  modelId?: string;
  coldStartMs: number | null;
  schemaRef: SkillOutputSchemaRef;
  runText: (retryContext?: string) => Promise<{ output: string; durationMs: number }>;
}) {
  let totalDurationMs = 0;
  let jsonRepaired = false;
  let previousError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retryContext = attempt === 0 ? undefined : formatRetryContext(previousError);
    try {
      const result = await input.runText(retryContext);
      totalDurationMs += result.durationMs;
      const parsed = parseValidatedOutputAttempt<T>(input.schemaRef, result.output);
      jsonRepaired = jsonRepaired || parsed.jsonRepaired;
      return {
        providerId: input.providerId,
        modelId: input.modelId,
        outcome: 'completed' as const,
        schemaPassed: true as const,
        output: parsed.output,
        durationMs: totalDurationMs,
        coldStartMs: input.coldStartMs,
        jsonRepaired,
      };
    } catch (error) {
      previousError = error;
      const message = toErrorMessage(error);
      if (attempt === 1) {
        return {
          providerId: input.providerId,
          modelId: input.modelId,
          outcome: 'failed' as const,
          schemaPassed: false as const,
          failureReason: message,
          durationMs: totalDurationMs,
          coldStartMs: input.coldStartMs,
          jsonRepaired,
        };
      }
    }
  }

  return {
    providerId: input.providerId,
    modelId: input.modelId,
    outcome: 'failed' as const,
    schemaPassed: false as const,
    failureReason: 'Provider run did not complete.',
    durationMs: totalDurationMs,
    coldStartMs: input.coldStartMs,
    jsonRepaired,
  };
}

export async function executeRuntimeProviderSkill<T>(input: {
  providerId: AgentRuntimeProviderId;
  schemaRef: SkillOutputSchemaRef;
  system: string;
  prompt: string;
  heuristicContext: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<RuntimeProviderExecutionResult<T>> {
  const contract = getAgentRuntimeProviderContract(input.providerId);
  if (!contract) {
    return {
      providerId: input.providerId,
      outcome: 'unavailable',
      schemaPassed: false,
      unavailableReason: `Unknown provider "${input.providerId}".`,
      durationMs: 0,
      coldStartMs: null,
      jsonRepaired: false,
    };
  }

  const availability = await getAgentRuntimeProviderAvailability(input.providerId);
  if (!availability.available) {
    return {
      providerId: input.providerId,
      modelId: contract.defaultModelId,
      outcome: 'unavailable',
      schemaPassed: false,
      unavailableReason: availability.reason ?? `${contract.label} is unavailable.`,
      fallbackProviderId: availability.fallbackProviderId,
      durationMs: 0,
      coldStartMs: null,
      jsonRepaired: false,
    };
  }

  if (input.providerId === 'heuristic') {
    try {
      return {
        providerId: input.providerId,
        outcome: 'completed',
        schemaPassed: true,
        output: buildHeuristicSkillOutput<T>(input.schemaRef, input.heuristicContext),
        durationMs: 0,
        coldStartMs: 0,
        jsonRepaired: false,
      };
    } catch (error) {
      return {
        providerId: input.providerId,
        outcome: 'failed',
        schemaPassed: false,
        failureReason: toErrorMessage(error),
        durationMs: 0,
        coldStartMs: 0,
        jsonRepaired: false,
      };
    }
  }

  if (input.providerId === 'transformers') {
    const coldStartMs = isTransformersPipelineReady()
      ? null
      : (await initializeTransformersPipeline()).durationMs;
    return runProviderWithRetry<T>({
      providerId: input.providerId,
      modelId: contract.defaultModelId,
      coldStartMs,
      schemaRef: input.schemaRef,
      runText: (retryContext) =>
        runTransformersTextCompletion({
          prompt: `${input.system}\n\n${input.prompt}`,
          maxTokens: input.maxTokens,
          retryContext,
          signal: input.signal,
        }),
    });
  }

  if (input.providerId === 'webllm') {
    const status = getAgentWebLlmStatus();
    const coldStartMs = status.ready ? null : (await initializeWebLlmEngine()).durationMs;
    return runProviderWithRetry<T>({
      providerId: input.providerId,
      modelId: contract.defaultModelId,
      coldStartMs,
      schemaRef: input.schemaRef,
      runText: (retryContext) =>
        runWebLlmTextCompletion({
          system: input.system,
          prompt: input.prompt,
          maxTokens: input.maxTokens,
          retryContext,
          signal: input.signal,
        }),
    });
  }

  if (input.providerId === 'gemma4') {
    const status = getAgentGemma4Status();
    const coldStartMs = status.ready ? null : (await initializeGemma4Engine()).durationMs;
    return runProviderWithRetry<T>({
      providerId: input.providerId,
      modelId: contract.defaultModelId,
      coldStartMs,
      schemaRef: input.schemaRef,
      runText: async (retryContext) => {
        const result = await runGemma4TextCompletion({
          system: input.system,
          prompt: input.prompt,
          maxTokens: input.maxTokens,
          retryContext,
          signal: input.signal,
        });
        // Surface a tool-call payload as JSON when present so the existing
        // schema-validating retry loop sees a structured response.
        const output = result.toolCall ? JSON.stringify(result.toolCall.arguments) : result.output;
        return { output, durationMs: result.durationMs };
      },
    });
  }

  const languageModel = getPromptApiGlobal();
  if (!languageModel) {
    return {
      providerId: input.providerId,
      modelId: contract.defaultModelId,
      outcome: 'unavailable',
      schemaPassed: false,
      unavailableReason: 'LanguageModel is not available in this runtime.',
      fallbackProviderId: contract.fallbackOrder[0],
      durationMs: 0,
      coldStartMs: null,
      jsonRepaired: false,
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.userActivation?.isActive) {
    return {
      providerId: input.providerId,
      modelId: contract.defaultModelId,
      outcome: 'unavailable',
      schemaPassed: false,
      unavailableReason: 'Chrome Prompt API session creation requires user activation.',
      fallbackProviderId: contract.fallbackOrder[0],
      durationMs: 0,
      coldStartMs: null,
      jsonRepaired: false,
    };
  }

  const coldStartStart = Date.now();
  const session = await languageModel.create();
  const coldStartMs = Date.now() - coldStartStart;
  try {
    return runProviderWithRetry<T>({
      providerId: input.providerId,
      modelId: contract.defaultModelId,
      coldStartMs,
      schemaRef: input.schemaRef,
      runText: async () => {
        const start = Date.now();
        const output = await session.prompt(`${input.system}\n\n${input.prompt}`, {
          responseConstraint: { type: 'object' },
          omitResponseConstraintInput: true,
          signal: input.signal,
        });
        return {
          output,
          durationMs: Date.now() - start,
        };
      },
    });
  } finally {
    await session.destroy?.();
  }
}
