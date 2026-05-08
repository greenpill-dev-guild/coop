import {
  type KnowledgeSource,
  type KnowledgeSourceType,
  knowledgeSourceSchema,
} from '../../contracts/schema-knowledge';
import { createId, nowIso } from '../../utils';
import type { GraphStore, MarkSourceStaleResult } from '../graph';
import { markEntitiesFromSourceStale } from '../graph';
import type { CoopDexie } from '../storage/db-schema';

export async function createKnowledgeSource(
  db: CoopDexie,
  input: {
    type: KnowledgeSourceType;
    identifier: string;
    label: string;
    coopId: string;
    addedBy: string;
  },
): Promise<KnowledgeSource> {
  // Check for duplicate identifier within the same coop
  const existing = await db.knowledgeSources
    .where('[coopId+identifier]')
    .equals([input.coopId, input.identifier])
    .first();

  if (existing) {
    throw new Error(
      `Duplicate source: identifier "${input.identifier}" is already registered in coop "${input.coopId}"`,
    );
  }

  const source: KnowledgeSource = {
    id: createId('ks'),
    type: input.type,
    identifier: input.identifier,
    label: input.label,
    coopId: input.coopId,
    addedBy: input.addedBy,
    addedAt: nowIso(),
    lastFetchedAt: null,
    entityCount: 0,
    active: true,
  };

  const validated = knowledgeSourceSchema.parse(source);
  await db.knowledgeSources.put(validated);
  return validated;
}

export async function removeKnowledgeSource(
  db: CoopDexie,
  id: string,
  options: {
    graphStore?: GraphStore;
    source?: KnowledgeSource;
    staleAt?: string;
  } = {},
): Promise<MarkSourceStaleResult> {
  const source = options.source ?? (await db.knowledgeSources.get(id));
  const result =
    source && options.graphStore
      ? markEntitiesFromSourceStale(options.graphStore, source, options.staleAt ?? nowIso())
      : { staleEntityCount: 0, invalidatedRelationshipCount: 0 };

  await db.knowledgeSources.delete(id);
  return result;
}

export interface KnowledgeSourceFilters {
  coopId?: string;
  type?: KnowledgeSourceType;
  active?: boolean;
}

export async function listKnowledgeSources(
  db: CoopDexie,
  filters: KnowledgeSourceFilters,
): Promise<KnowledgeSource[]> {
  let collection = db.knowledgeSources.toCollection();

  if (filters.coopId) {
    collection = db.knowledgeSources.where('coopId').equals(filters.coopId);
  }

  let results = await collection.toArray();

  if (filters.type) {
    results = results.filter((s) => s.type === filters.type);
  }
  if (filters.active !== undefined) {
    results = results.filter((s) => s.active === filters.active);
  }

  return results;
}

export async function updateKnowledgeSourceMeta(
  db: CoopDexie,
  id: string,
  meta: { lastFetchedAt?: string; entityCount?: number },
): Promise<void> {
  await db.knowledgeSources.update(id, meta);
}
