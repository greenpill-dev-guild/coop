import { type AgentMemory, agentMemorySchema } from '../../contracts/schema';
import { createId, hashJson, nowIso } from '../../utils';
// Use ../storage/db (the real barrel) to avoid vitest circular-dep resolution issues
import {
  type CoopDexie,
  deleteAgentMemories,
  listAgentMemories,
  saveAgentMemory,
} from '../storage/db';

function defaultMemoryProvenance(input: {
  type: AgentMemory['type'];
  sourceObservationId?: string;
  sourceSkillRunId?: string;
}): Pick<AgentMemory, 'provenanceLabel' | 'confirmationStatus' | 'sourceChannel'> {
  if (input.type === 'user-feedback') {
    return {
      provenanceLabel: 'user-confirmed',
      confirmationStatus: 'confirmed',
      sourceChannel: 'member',
    };
  }

  if (input.sourceObservationId && !input.sourceSkillRunId) {
    return {
      provenanceLabel: 'observed',
      confirmationStatus: 'unconfirmed',
      sourceChannel: 'source',
    };
  }

  return {
    provenanceLabel: 'inferred',
    confirmationStatus: 'unconfirmed',
    sourceChannel: 'skill',
  };
}

export async function createAgentMemory(
  db: CoopDexie,
  input: Omit<AgentMemory, 'id' | 'createdAt' | 'contentHash' | 'domain' | 'scope'> &
    Partial<Pick<AgentMemory, 'scope'>> & {
      createdAt?: string;
      domain?: string;
    },
): Promise<AgentMemory> {
  const provenanceDefaults = defaultMemoryProvenance(input);
  const memory: AgentMemory = {
    ...input,
    scope: input.scope ?? 'coop',
    id: createId('agent-memory'),
    contentHash: hashJson({
      content: input.content,
      scope: input.scope ?? 'coop',
      coopId: input.coopId,
      memberId: input.memberId,
    }),
    createdAt: input.createdAt ?? nowIso(),
    domain: input.domain ?? 'general',
    provenanceLabel: input.provenanceLabel ?? provenanceDefaults.provenanceLabel,
    confirmationStatus: input.confirmationStatus ?? provenanceDefaults.confirmationStatus,
    sourceChannel: input.sourceChannel ?? provenanceDefaults.sourceChannel,
    unresolvedQuestions: input.unresolvedQuestions ?? [],
  };
  const validated = agentMemorySchema.parse(memory);
  await saveAgentMemory(db, validated);
  return validated;
}

type MemoryQueryScope =
  | string
  | {
      scope?: AgentMemory['scope'];
      coopId?: string;
      memberId?: string;
    };

const STALE_MEMORY_RELATIVE_GAP_MS = 30 * 24 * 60 * 60 * 1000;

function memoryTypePriority(memory: AgentMemory) {
  if (memory.scope === 'member') {
    return 0;
  }

  switch (memory.type) {
    case 'skill-pattern':
      return 1;
    case 'observation-outcome':
      return 2;
    case 'decision-context':
      return 3;
    default:
      return 4;
  }
}

function isMemoryStale(memory: AgentMemory, latestCreatedAt: number) {
  const createdAt = Date.parse(memory.createdAt);
  const staleByAge =
    latestCreatedAt > 0 &&
    Number.isFinite(createdAt) &&
    latestCreatedAt - createdAt > STALE_MEMORY_RELATIVE_GAP_MS;

  return (
    staleByAge ||
    memory.provenanceLabel === 'stale' ||
    memory.confirmationStatus === 'stale' ||
    memory.confirmationStatus === 'rejected'
  );
}

function memoryConfirmationPriority(memory: AgentMemory) {
  if (memory.provenanceLabel === 'stale' || memory.confirmationStatus === 'stale') {
    return 5;
  }
  if (memory.confirmationStatus === 'rejected') {
    return 4;
  }
  if (memory.confirmationStatus === 'confirmed' || memory.provenanceLabel === 'user-confirmed') {
    return 0;
  }
  if (memory.provenanceLabel === 'observed' || memory.sourceChannel === 'source') {
    return 1;
  }
  if (memory.provenanceLabel === 'imported' || memory.sourceChannel === 'import') {
    return 2;
  }
  return 3;
}

function sortMemoriesForSkill(memories: AgentMemory[]) {
  const latestCreatedAt = memories.reduce<number>((latest, memory) => {
    const createdAt = Date.parse(memory.createdAt);
    return Number.isFinite(createdAt) ? Math.max(latest, createdAt) : latest;
  }, 0);

  return [...memories].sort((left, right) => {
    const leftIsStale = isMemoryStale(left, latestCreatedAt);
    const rightIsStale = isMemoryStale(right, latestCreatedAt);

    if (leftIsStale !== rightIsStale) {
      return leftIsStale ? 1 : -1;
    }

    const confirmationDelta = memoryConfirmationPriority(left) - memoryConfirmationPriority(right);
    if (confirmationDelta !== 0) {
      return confirmationDelta;
    }

    const priorityDelta = memoryTypePriority(left) - memoryTypePriority(right);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function filterMemoriesByScope(memories: AgentMemory[], scope: MemoryQueryScope) {
  if (typeof scope === 'string') {
    return memories.filter((memory) => memory.scope === 'coop' && memory.coopId === scope);
  }

  if ((scope.scope ?? 'coop') === 'member') {
    return memories.filter(
      (memory) =>
        memory.scope === 'member' &&
        memory.memberId === scope.memberId &&
        (!scope.coopId || memory.coopId === scope.coopId || !memory.coopId),
    );
  }

  return memories.filter((memory) => memory.scope === 'coop' && memory.coopId === scope.coopId);
}

export async function queryRecentMemories(
  db: CoopDexie,
  scope: MemoryQueryScope,
  options?: { limit?: number; domain?: string; type?: AgentMemory['type'] },
): Promise<AgentMemory[]> {
  const limit = options?.limit ?? 10;
  let results = filterMemoriesByScope(await listAgentMemories(db), scope);

  if (options?.domain) {
    results = results.filter((m) => m.domain === options.domain);
  }
  if (options?.type) {
    results = results.filter((m) => m.type === options.type);
  }

  results.sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));

  return results.slice(0, limit);
}

export async function pruneExpiredMemories(db: CoopDexie): Promise<number> {
  const now = nowIso();
  const expired = (await listAgentMemories(db)).filter(
    (memory) => typeof memory.expiresAt === 'string' && memory.expiresAt < now,
  );

  if (expired.length === 0) return 0;

  await deleteAgentMemories(
    db,
    expired.map((memory) => memory.id),
  );
  return expired.length;
}

export async function deduplicateMemories(db: CoopDexie, coopId: string): Promise<number> {
  const memories = await queryRecentMemories(db, coopId, { limit: Number.MAX_SAFE_INTEGER });

  const byHash = new Map<string, AgentMemory[]>();
  for (const m of memories) {
    const group = byHash.get(m.contentHash) ?? [];
    group.push(m);
    byHash.set(m.contentHash, group);
  }

  const toDelete: string[] = [];
  for (const group of byHash.values()) {
    if (group.length <= 1) continue;
    // Sort newest first, delete all but the first
    group.sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));
    for (let i = 1; i < group.length; i++) {
      toDelete.push(group[i].id);
    }
  }

  if (toDelete.length === 0) return 0;

  await deleteAgentMemories(db, toDelete);
  return toDelete.length;
}

export async function queryMemoriesForSkill(
  db: CoopDexie,
  scope: string | { coopId: string; memberId?: string },
  _trigger?: string,
  options?: { limit?: number },
): Promise<AgentMemory[]> {
  const limit = options?.limit ?? 8;
  const coopId = typeof scope === 'string' ? scope : scope.coopId;
  const memberId = typeof scope === 'string' ? undefined : scope.memberId;

  const [memberMemories, coopSkillPatterns, coopOutcomes, coopDecisionContext, coopGeneral] =
    await Promise.all([
      memberId
        ? queryRecentMemories(
            db,
            {
              scope: 'member',
              memberId,
            },
            { limit },
          )
        : Promise.resolve([]),
      queryRecentMemories(db, { scope: 'coop', coopId }, { type: 'skill-pattern', limit }),
      queryRecentMemories(db, { scope: 'coop', coopId }, { type: 'observation-outcome', limit }),
      queryRecentMemories(db, { scope: 'coop', coopId }, { type: 'decision-context', limit }),
      queryRecentMemories(db, { scope: 'coop', coopId }, { limit }),
    ]);

  const seen = new Set<string>();
  const merged: AgentMemory[] = [];

  for (const memory of [
    ...memberMemories,
    ...coopSkillPatterns,
    ...coopOutcomes,
    ...coopDecisionContext,
    ...coopGeneral,
  ]) {
    if (seen.has(memory.id)) continue;
    seen.add(memory.id);
    merged.push(memory);
  }

  return sortMemoriesForSkill(merged).slice(0, limit);
}

export async function enforceMemoryLimit(
  db: CoopDexie,
  coopId: string,
  maxEntries = 500,
): Promise<number> {
  const memories = await queryRecentMemories(db, coopId, { limit: Number.MAX_SAFE_INTEGER });

  if (memories.length <= maxEntries) return 0;

  // Sort oldest first
  memories.sort((a, b) => (a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0));

  const excess = memories.length - maxEntries;
  const toDelete = memories.slice(0, excess).map((m) => m.id);

  await deleteAgentMemories(db, toDelete);
  return toDelete.length;
}
