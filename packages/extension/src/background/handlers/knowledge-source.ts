import {
  type KnowledgeSourceType,
  appendLogEntry,
  createKnowledgeSource,
  encodeCoopDoc,
  getAuthSession,
  hydrateCoopDoc,
  listKnowledgeSources,
  nowIso,
  removeKnowledgeSource,
  removeSourceFromYDoc,
  writeSourceToYDoc,
} from '@coop/shared';
import { loadGraphSnapshot, saveGraphSnapshot } from '../../runtime/agent/graph-store-singleton';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { resolveReceiverPairingMember } from '../../runtime/receiver';
import { db, getCoops, getLocalSetting, stateKeys } from '../context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveActiveMemberId(): Promise<string | undefined> {
  const [coops, authSession, activeCoopId] = await Promise.all([
    getCoops(),
    getAuthSession(db),
    getLocalSetting<string | undefined>(stateKeys.activeCoopId, undefined),
  ]);
  const coop = coops.find((c) => c.profile.id === activeCoopId) ?? coops[0];
  return resolveReceiverPairingMember(coop, authSession)?.id;
}

async function updateSharedSourceRegistryDoc(
  coopId: string,
  mutate: (doc: ReturnType<typeof hydrateCoopDoc>) => void,
) {
  const coopDocs = db.coopDocs;
  if (!coopDocs?.get || !coopDocs?.put) {
    return;
  }
  const record = await coopDocs.get(coopId);
  if (!record) {
    return;
  }

  const doc = hydrateCoopDoc(record.encodedState);
  try {
    mutate(doc);
    await coopDocs.put({
      id: coopId,
      encodedState: encodeCoopDoc(doc),
      updatedAt: nowIso(),
    });
  } finally {
    doc.destroy();
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

type AddRequest = Extract<RuntimeRequest, { type: 'add-knowledge-source' }>;
type RemoveRequest = Extract<RuntimeRequest, { type: 'remove-knowledge-source' }>;
type ToggleRequest = Extract<RuntimeRequest, { type: 'toggle-knowledge-source' }>;
type ListRequest = Extract<RuntimeRequest, { type: 'list-knowledge-sources' }>;

export async function handleAddKnowledgeSource(
  message: AddRequest,
): Promise<RuntimeActionResponse> {
  try {
    const memberId = await resolveActiveMemberId();
    const source = await createKnowledgeSource(db, {
      type: message.payload.sourceType as KnowledgeSourceType,
      identifier: message.payload.identifier,
      label: message.payload.label,
      coopId: message.payload.coopId,
      addedBy: memberId ?? 'unknown',
    });
    await updateSharedSourceRegistryDoc(source.coopId, (doc) => {
      writeSourceToYDoc(doc, source);
      appendLogEntry(doc, {
        type: 'ingest',
        timestamp: nowIso(),
        summary: `Knowledge source added: ${source.label}`,
        sourceId: source.id,
      });
    });
    return { ok: true, data: source };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to add source' };
  }
}

export async function handleRemoveKnowledgeSource(
  message: RemoveRequest,
): Promise<RuntimeActionResponse> {
  try {
    const source = await db.knowledgeSources.get(message.payload.sourceId);
    const graphStore = source ? await loadGraphSnapshot(db, source.coopId) : undefined;
    const result = await removeKnowledgeSource(db, message.payload.sourceId, {
      graphStore,
      source,
    });

    if (source && result.staleEntityCount + result.invalidatedRelationshipCount > 0) {
      await saveGraphSnapshot(db, source.coopId);
    }
    if (source) {
      await updateSharedSourceRegistryDoc(source.coopId, (doc) => {
        removeSourceFromYDoc(doc, source.id);
        appendLogEntry(doc, {
          type: 'rejection',
          timestamp: nowIso(),
          summary: `Knowledge source removed: ${source.label}`,
          sourceId: source.id,
        });
      });
    }

    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to remove source',
    };
  }
}

export async function handleToggleKnowledgeSource(
  message: ToggleRequest,
): Promise<RuntimeActionResponse> {
  try {
    const source = await db.knowledgeSources.get(message.payload.sourceId);
    await db.knowledgeSources.update(message.payload.sourceId, {
      active: message.payload.active,
    });
    if (source) {
      const nextSource = { ...source, active: message.payload.active };
      await updateSharedSourceRegistryDoc(source.coopId, (doc) => {
        writeSourceToYDoc(doc, nextSource);
        appendLogEntry(doc, {
          type: message.payload.active ? 'approval' : 'rejection',
          timestamp: nowIso(),
          summary: `Knowledge source ${message.payload.active ? 'enabled' : 'disabled'}: ${source.label}`,
          sourceId: source.id,
        });
      });
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to toggle source',
    };
  }
}

export async function handleListKnowledgeSources(
  message: ListRequest,
): Promise<RuntimeActionResponse> {
  try {
    const sources = await listKnowledgeSources(db, {
      coopId: message.payload.coopId,
    });
    return { ok: true, data: sources };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to list sources',
    };
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

type StatsRequest = Extract<RuntimeRequest, { type: 'get-knowledge-stats' }>;

export async function handleGetKnowledgeStats(
  message: StatsRequest,
): Promise<RuntimeActionResponse> {
  try {
    const store = await loadGraphSnapshot(db, message.payload.coopId);
    const sources = await listKnowledgeSources(db, { coopId: message.payload.coopId });

    // Build topic list from entity types
    const topicCounts = new Map<string, { depth: number; sourceRefs: Set<string> }>();
    for (const entity of store.entities.values()) {
      const existing = topicCounts.get(entity.type) ?? { depth: 0, sourceRefs: new Set() };
      existing.depth += 1;
      existing.sourceRefs.add(entity.sourceRef);
      topicCounts.set(entity.type, existing);
    }
    const maxDepth = Math.max(1, ...Array.from(topicCounts.values()).map((v) => v.depth));
    const topics = Array.from(topicCounts.entries()).map(([topic, v]) => ({
      topic,
      depth: Math.round((v.depth / maxDepth) * 100),
      sourceCount: v.sourceRefs.size,
    }));

    // Build recent decisions from traces (matches DecisionEntry interface)
    const decisions = store.traces.slice(-10).map((trace) => ({
      id: trace.traceId,
      skillId: trace.skillRunId,
      confidence: trace.confidence,
      timestamp: trace.createdAt,
      outcome: trace.outcome === 'pending' ? ('skipped' as const) : trace.outcome,
      sourceRefs: trace.contextEntityIds,
    }));

    return {
      ok: true,
      data: {
        topics,
        stats: {
          entities: store.entities.size,
          relationships: store.relationships.length,
          sources: sources.length,
        },
        decisions,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to get knowledge stats',
    };
  }
}
