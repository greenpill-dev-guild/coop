import type {
  AgentMemory,
  AgentObservation,
  AgentProvider,
  ArchiveReceipt,
  AuthSession,
  CoopSharedState,
  GrantFitScore,
  OpportunityCandidate,
  ReadablePageExtract,
  ReceiverCapture,
  ReviewDraft,
  SkillManifest,
  TabRouting,
} from '@coop/shared';
import { createCoopDb, hydrateCoopDoc, readCoopState } from '@coop/shared';
import { AGENT_SETTING_KEYS, type AgentCycleRequest, type AgentCycleState } from './config';
import { isTrustedNodeRole } from './harness';

export type CoopDexie = ReturnType<typeof createCoopDb>;

export type SkillRunMetric = {
  skillId: string;
  provider: AgentProvider;
  durationMs: number;
  retryCount: number;
  skipped: boolean;
};

export type AgentCycleResult = {
  processedObservationIds: string[];
  createdPlanIds: string[];
  createdDraftIds: string[];
  completedSkillRunIds: string[];
  autoExecutedActionCount: number;
  errors: string[];
  traceId?: string;
  totalDurationMs?: number;
  skillRunMetrics: SkillRunMetric[];
};

export type SkillExecutionContext = {
  observation: AgentObservation;
  coop?: CoopSharedState;
  draft?: ReviewDraft | null;
  capture?: ReceiverCapture | null;
  receipt?: ArchiveReceipt | null;
  authSession: AuthSession | null;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
  createdDraftIds: string[];
  extracts: ReadablePageExtract[];
  relatedDrafts: ReviewDraft[];
  relatedArtifacts: CoopSharedState['artifacts'];
  relatedRoutings: TabRouting[];
  memories: AgentMemory[];
  /** Graph-based context from knowledge sandbox retrieval (if available) */
  graphContext?: string;
};

export const db = createCoopDb('coop-extension');

export function compact(value: Array<string | undefined | null | false>) {
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export async function getSetting<T>(
  key: string,
  fallback: T,
  targetDb: CoopDexie = db,
): Promise<T> {
  const record = await targetDb.settings.get(key);
  return (record?.value as T | undefined) ?? fallback;
}

export async function setSetting(key: string, value: unknown, targetDb: CoopDexie = db) {
  await targetDb.settings.put({ key, value });
}

export async function getCycleState() {
  return getSetting<AgentCycleState>(AGENT_SETTING_KEYS.cycleState, {
    running: false,
  });
}

export async function setCycleState(patch: Partial<AgentCycleState>) {
  const current = await getCycleState();
  const next = {
    ...current,
    ...patch,
  } satisfies AgentCycleState;
  await setSetting(AGENT_SETTING_KEYS.cycleState, next);
  return next;
}

export async function getCycleRequest() {
  return getSetting<AgentCycleRequest | null>(AGENT_SETTING_KEYS.cycleRequest, null);
}

export async function getAutoRunSkillIds() {
  return getSetting<string[]>(AGENT_SETTING_KEYS.autoRunSkillIds, []);
}

export async function getCoops() {
  const docs = await db.coopDocs.toArray();
  return docs.map((record) => readCoopState(hydrateCoopDoc(record.encodedState)));
}

export function findAuthenticatedCoopMember(
  coop: CoopSharedState,
  authSession: AuthSession | null,
) {
  const authAddress = authSession?.primaryAddress?.toLowerCase();
  if (!authAddress) {
    return undefined;
  }
  return coop.members.find((member) => member.address.toLowerCase() === authAddress);
}

export function inferPreferredProvider(manifest: SkillManifest): AgentProvider {
  if (manifest.model === 'heuristic') {
    return 'heuristic';
  }
  if (manifest.model === 'gemma4') {
    return 'gemma4';
  }
  if (manifest.model === 'transformers') {
    return 'transformers';
  }
  if (manifest.model === 'webllm') {
    return 'webllm';
  }
  if (manifest.id === 'capital-formation-brief' || manifest.id === 'review-digest') {
    return 'webllm';
  }
  return 'transformers';
}

export function listAuthorizedOperatorCoopIds(
  coops: CoopSharedState[],
  authSession: AuthSession | null,
) {
  return new Set(
    coops
      .filter((coop) => isTrustedNodeRole(findAuthenticatedCoopMember(coop, authSession)?.role))
      .map((coop) => coop.profile.id),
  );
}
