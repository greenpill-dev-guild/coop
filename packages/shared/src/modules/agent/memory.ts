import { type AgentMemory, agentMemorySchema } from '../../contracts/schema';
import { createId, hashJson, nowIso } from '../../utils';
import type { CoopDexie } from '../storage/db';

export async function createAgentMemory(
  db: CoopDexie,
  input: Omit<AgentMemory, 'id' | 'createdAt' | 'contentHash' | 'domain'> & {
    createdAt?: string;
    domain?: string;
  },
): Promise<AgentMemory> {
  const memory: AgentMemory = {
    ...input,
    id: createId('agent-memory'),
    contentHash: hashJson({ content: input.content, coopId: input.coopId }),
    createdAt: input.createdAt ?? nowIso(),
    domain: input.domain ?? 'general',
  };
  const validated = agentMemorySchema.parse(memory);
  await db.agentMemories.put(validated);
  return validated;
}

export async function queryRecentMemories(
  db: CoopDexie,
  coopId: string,
  options?: { limit?: number; domain?: string; type?: AgentMemory['type'] },
): Promise<AgentMemory[]> {
  const limit = options?.limit ?? 10;

  const collection = db.agentMemories.where('coopId').equals(coopId);
  let results = await collection.toArray();

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
  const expired = await db.agentMemories.where('expiresAt').below(now).toArray();

  if (expired.length === 0) return 0;

  await db.agentMemories.bulkDelete(expired.map((m) => m.id));
  return expired.length;
}

export async function deduplicateMemories(db: CoopDexie, coopId: string): Promise<number> {
  const memories = await db.agentMemories.where('coopId').equals(coopId).toArray();

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

  await db.agentMemories.bulkDelete(toDelete);
  return toDelete.length;
}

export async function queryMemoriesForSkill(
  db: CoopDexie,
  coopId: string,
  _trigger?: string,
  options?: { limit?: number },
): Promise<AgentMemory[]> {
  const limit = options?.limit ?? 8;

  // Fetch skill-pattern and observation-outcome first (most relevant to skill execution)
  const [skillPatterns, outcomes, general] = await Promise.all([
    queryRecentMemories(db, coopId, { type: 'skill-pattern', limit }),
    queryRecentMemories(db, coopId, { type: 'observation-outcome', limit }),
    queryRecentMemories(db, coopId, { limit }),
  ]);

  // Merge, deduplicate by id, cap at limit
  const seen = new Set<string>();
  const merged: AgentMemory[] = [];

  for (const memory of [...skillPatterns, ...outcomes, ...general]) {
    if (seen.has(memory.id)) continue;
    seen.add(memory.id);
    merged.push(memory);
    if (merged.length >= limit) break;
  }

  return merged;
}

export async function enforceMemoryLimit(
  db: CoopDexie,
  coopId: string,
  maxEntries = 500,
): Promise<number> {
  const memories = await db.agentMemories.where('coopId').equals(coopId).toArray();

  if (memories.length <= maxEntries) return 0;

  // Sort oldest first
  memories.sort((a, b) => (a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0));

  const excess = memories.length - maxEntries;
  const toDelete = memories.slice(0, excess).map((m) => m.id);

  await db.agentMemories.bulkDelete(toDelete);
  return toDelete.length;
}
