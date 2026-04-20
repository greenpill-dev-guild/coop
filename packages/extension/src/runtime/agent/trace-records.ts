import type {
  AgentMemory,
  AgentObservation,
  AgentRuntimeProviderId,
  AgentTraceOutcome,
  AgentTraceRecord,
  AgentTraceSourceRisk,
  ArchiveReceipt,
  CoopDexie,
  CoopSharedState,
  GrantFitScore,
  OpportunityCandidate,
  ReadablePageExtract,
  ReceiverCapture,
  ReviewDraft,
  TabRouting,
} from '@coop/shared';
import { createAgentTraceRecord, saveAgentTraceRecord } from '@coop/shared';
import { db as runtimeDb } from './runner-state';

type TraceSkillContext = {
  observation: AgentObservation;
  coop?: CoopSharedState;
  draft?: ReviewDraft | null;
  capture?: ReceiverCapture | null;
  receipt?: ArchiveReceipt | null;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
  extracts: ReadablePageExtract[];
  relatedDrafts: ReviewDraft[];
  relatedArtifacts: CoopSharedState['artifacts'];
  relatedRoutings: TabRouting[];
  memories: AgentMemory[];
  graphContext?: string;
};

function fallbackHash(value: string) {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function hashTraceValue(value: string) {
  const encoded = new TextEncoder().encode(value);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return fallbackHash(value);
}

export async function hashTraceJson(value: unknown) {
  return hashTraceValue(JSON.stringify(value));
}

export function estimateContextBudgetTokens(input: { system: string; prompt: string }) {
  return Math.max(1, Math.ceil((input.system.length + input.prompt.length) / 4));
}

export function buildAgentTraceContextInventory(input: TraceSkillContext) {
  return [
    `observation:${input.observation.id}`,
    input.coop ? `coop:${input.coop.profile.id}` : undefined,
    input.draft ? `draft:${input.draft.id}` : undefined,
    input.capture ? `capture:${input.capture.id}` : undefined,
    input.receipt ? `receipt:${input.receipt.id}` : undefined,
    `extracts:${input.extracts.length}`,
    `candidates:${input.candidates.length}`,
    `scores:${input.scores.length}`,
    `related-drafts:${input.relatedDrafts.length}`,
    `related-artifacts:${input.relatedArtifacts.length}`,
    `related-routings:${input.relatedRoutings.length}`,
    `memories:${input.memories.length}`,
    input.graphContext ? 'graph-context:1' : undefined,
  ].filter((value): value is string => Boolean(value));
}

export function classifyAgentTraceSourceRisk(input: TraceSkillContext): AgentTraceSourceRisk {
  const hasUntrustedSources = Boolean(input.capture) || input.extracts.length > 0;
  const hasTrustedSources =
    Boolean(input.coop) ||
    Boolean(input.draft) ||
    Boolean(input.receipt) ||
    input.candidates.length > 0 ||
    input.scores.length > 0 ||
    input.relatedDrafts.length > 0 ||
    input.relatedArtifacts.length > 0 ||
    input.relatedRoutings.length > 0 ||
    input.memories.length > 0 ||
    typeof input.graphContext === 'string';

  if (hasUntrustedSources && hasTrustedSources) {
    return 'mixed';
  }
  if (hasUntrustedSources) {
    return 'untrusted';
  }
  return 'trusted';
}

function resolveTraceModelId(providerId: AgentRuntimeProviderId, modelId?: string) {
  if (typeof modelId === 'string' && modelId.trim().length > 0) {
    return modelId;
  }
  if (providerId === 'heuristic') {
    return 'heuristic-fallback';
  }
  return providerId;
}

export async function persistAgentSkillTrace(input: {
  db?: CoopDexie;
  traceId: string;
  observationId: string;
  skillId: string;
  providerId: AgentRuntimeProviderId;
  modelId?: string;
  promptHash: string;
  preparedPrompt: {
    system: string;
    prompt: string;
  };
  context: TraceSkillContext;
  startedAt: number;
  durationMs: number;
  output?: unknown;
  repairSteps?: string[];
  validationErrors?: string[];
  confidenceScore?: number;
  evalScore?: number;
  outcome: AgentTraceOutcome;
  userOutcome?: AgentTraceRecord['userOutcome'];
}) {
  try {
    const record = createAgentTraceRecord({
      traceId: input.traceId,
      observationId: input.observationId,
      skillId: input.skillId,
      providerId: input.providerId,
      modelId: resolveTraceModelId(input.providerId, input.modelId),
      promptHash: input.promptHash,
      contextInventory: buildAgentTraceContextInventory(input.context),
      contextBudgetTokens: estimateContextBudgetTokens(input.preparedPrompt),
      sourceRisk: classifyAgentTraceSourceRisk(input.context),
      startedAt: input.startedAt,
      durationMs: Math.max(0, Math.round(input.durationMs)),
      rawOutputHash: input.output === undefined ? undefined : await hashTraceJson(input.output),
      repairSteps: input.repairSteps ?? [],
      validationErrors: input.validationErrors ?? [],
      confidenceScore: input.confidenceScore,
      evalScore: input.evalScore,
      outcome: input.outcome,
      userOutcome: input.userOutcome,
    });

    await saveAgentTraceRecord(input.db ?? runtimeDb, record);
    return record;
  } catch (error) {
    console.warn('[agent-trace] Failed to persist trace record.', error);
    return null;
  }
}
