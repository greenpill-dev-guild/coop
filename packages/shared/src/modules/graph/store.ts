import type {
  GraphEntity,
  GraphRelationship,
  KnowledgeSource,
  ReasoningTrace,
  ValidatedInsight,
} from '../../contracts/schema-knowledge';

/**
 * In-memory graph store implementing POLE+O entity CRUD and temporal relationships.
 * Designed as an interface-compatible stand-in that can be swapped to Kuzu-WASM later.
 */
export interface GraphStore {
  entities: Map<string, GraphEntity>;
  relationships: GraphRelationship[];
  /** Tracks previous versions of entities for history */
  entityHistory: Map<string, GraphEntity[]>;
  /** Reasoning traces from skill runs */
  traces: ReasoningTrace[];
  /** Validated insights from approved drafts */
  insights: ValidatedInsight[];
}

/** Create a new in-memory graph store. */
export function initGraphStore(): GraphStore {
  return {
    entities: new Map(),
    relationships: [],
    entityHistory: new Map(),
    traces: [],
    insights: [],
  };
}

/**
 * Insert or update an entity. If the entity already exists (same id),
 * the previous version is preserved in history before overwriting.
 */
export function upsertEntity(store: GraphStore, entity: GraphEntity): void {
  const existing = store.entities.get(entity.id);
  if (existing) {
    const history = store.entityHistory.get(entity.id) ?? [];
    history.push({ ...existing });
    store.entityHistory.set(entity.id, history);
  } else {
    // First version also goes into history
    store.entityHistory.set(entity.id, [{ ...entity }]);
  }
  store.entities.set(entity.id, { ...entity });
}

/** Get an entity by ID. */
export function getEntity(store: GraphStore, id: string): GraphEntity | undefined {
  return store.entities.get(id);
}

/** Get all 1-hop neighbors (outgoing and incoming edges) of an entity. */
export function getEntityNeighbors(store: GraphStore, entityId: string): GraphEntity[] {
  const neighborIds = new Set<string>();

  for (const rel of store.relationships) {
    if (rel.from === entityId) neighborIds.add(rel.to);
    if (rel.to === entityId) neighborIds.add(rel.from);
  }

  neighborIds.delete(entityId);

  const neighbors: GraphEntity[] = [];
  for (const id of neighborIds) {
    const entity = store.entities.get(id);
    if (entity) neighbors.push(entity);
  }
  return neighbors;
}

/** Add a relationship (edge) to the graph. */
export function createRelationship(store: GraphStore, rel: GraphRelationship): void {
  store.relationships.push({ ...rel });
}

/**
 * Invalidate a relationship by setting t_invalid.
 * Does NOT delete the edge — it remains queryable via temporal queries.
 */
export function invalidateRelationship(
  store: GraphStore,
  from: string,
  to: string,
  type: string,
  t_invalid: string,
): void {
  for (const rel of store.relationships) {
    if (rel.from === from && rel.to === to && rel.type === type && rel.t_invalid === null) {
      rel.t_invalid = t_invalid;
      return;
    }
  }
}

export interface MarkSourceStaleResult {
  staleEntityCount: number;
  invalidatedRelationshipCount: number;
}

function sourceRefsForSource(source: KnowledgeSource): string[] {
  return [
    source.id,
    `source:${source.id}`,
    `${source.type}:${source.identifier}`,
    `${source.type}:${source.identifier}:`,
    `${source.type}:${source.identifier}#`,
  ];
}

export function isGraphRefFromSource(ref: string, source: KnowledgeSource): boolean {
  return sourceRefsForSource(source).some((candidate) => {
    if (candidate.endsWith(':') || candidate.endsWith('#')) {
      return ref.startsWith(candidate);
    }
    return ref === candidate;
  });
}

export function markEntitiesFromSourceStale(
  store: GraphStore,
  source: KnowledgeSource,
  staleAt: string,
): MarkSourceStaleResult {
  const staleEntityIds = new Set<string>();

  for (const entity of store.entities.values()) {
    if (!isGraphRefFromSource(entity.sourceRef, source)) {
      continue;
    }

    staleEntityIds.add(entity.id);
    upsertEntity(store, {
      ...entity,
      stale: true,
      staleAt,
      staleReason: `source-removed:${source.id}`,
    });
  }

  let invalidatedRelationshipCount = 0;
  for (const relationship of store.relationships) {
    if (relationship.t_invalid !== null) {
      continue;
    }

    const touchesStaleEntity =
      staleEntityIds.has(relationship.from) || staleEntityIds.has(relationship.to);
    const hasSourceProvenance = isGraphRefFromSource(relationship.provenance, source);
    if (!touchesStaleEntity && !hasSourceProvenance) {
      continue;
    }

    relationship.t_invalid = staleAt;
    invalidatedRelationshipCount++;
  }

  return {
    staleEntityCount: staleEntityIds.size,
    invalidatedRelationshipCount,
  };
}

/** Destroy the graph store and clear all data. */
export function destroyGraphStore(store: GraphStore): void {
  store.entities.clear();
  store.relationships.length = 0;
  store.entityHistory.clear();
  store.traces.length = 0;
  store.insights.length = 0;
}
