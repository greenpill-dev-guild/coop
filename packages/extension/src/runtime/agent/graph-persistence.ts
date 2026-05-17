import type {
  AgentObservation,
  CoopDexie,
  EntityExtractionOutput,
  GraphEntity,
  GraphRelationship,
} from '@coop/shared';
import { createEntityEmbedding, createRelationship, nowIso, upsertEntity } from '@coop/shared';
import { loadGraphSnapshot, scheduleSave } from './graph-store-singleton';

export type PersistedEntityExtractionResult = {
  entityIds: string[];
  relationshipCount: number;
};

function resolveObservationSourceRef(observation: AgentObservation): string {
  const sourceRef = observation.payload?.sourceRef;
  if (typeof sourceRef === 'string' && sourceRef.trim().length > 0) {
    return sourceRef;
  }
  const contentId = observation.payload?.contentId;
  if (typeof contentId === 'string' && contentId.trim().length > 0) {
    return `source-content:${contentId}`;
  }
  const sourceId = observation.payload?.sourceId;
  if (typeof sourceId === 'string' && sourceId.trim().length > 0) {
    return `source:${sourceId}`;
  }
  if (observation.extractId) {
    return `extract:${observation.extractId}`;
  }
  if (observation.captureId) {
    return `capture:${observation.captureId}`;
  }
  if (observation.draftId) {
    return `draft:${observation.draftId}`;
  }
  return `observation:${observation.id}`;
}

function shouldUpgradeRef(ref: string | undefined): boolean {
  if (!ref) {
    return true;
  }
  return ref === 'heuristic:entity-extraction' || ref.startsWith('observation:');
}

function normalizeEntity(entity: GraphEntity, sourceRef: string): GraphEntity {
  const normalizedSourceRef = shouldUpgradeRef(entity.sourceRef) ? sourceRef : entity.sourceRef;
  const normalizedEntity = {
    ...entity,
    sourceRef: normalizedSourceRef,
  };

  return {
    ...normalizedEntity,
    embedding:
      entity.embedding && entity.embedding.length > 0
        ? entity.embedding
        : createEntityEmbedding(normalizedEntity),
  };
}

function entityNeedsUpsert(existing: GraphEntity | undefined, next: GraphEntity): boolean {
  if (!existing) {
    return true;
  }
  const existingEmbedding = existing.embedding ?? [];
  const nextEmbedding = next.embedding ?? [];
  return (
    existing.name !== next.name ||
    existing.type !== next.type ||
    existing.description !== next.description ||
    existing.sourceRef !== next.sourceRef ||
    JSON.stringify(existingEmbedding) !== JSON.stringify(nextEmbedding)
  );
}

function normalizeRelationship(
  relationship: GraphRelationship,
  provenance: string,
): GraphRelationship {
  return {
    ...relationship,
    t_valid: relationship.t_valid || nowIso(),
    t_invalid: relationship.t_invalid ?? null,
    provenance: shouldUpgradeRef(relationship.provenance) ? provenance : relationship.provenance,
  };
}

function findActiveRelationshipIndex(
  relationships: GraphRelationship[],
  relationship: GraphRelationship,
): number {
  return relationships.findIndex(
    (candidate) =>
      candidate.from === relationship.from &&
      candidate.to === relationship.to &&
      candidate.type === relationship.type &&
      candidate.provenance === relationship.provenance &&
      candidate.t_invalid === null,
  );
}

export async function persistEntityExtractionOutputToGraph(input: {
  db: CoopDexie;
  coopId: string;
  observation: AgentObservation;
  output: EntityExtractionOutput;
}): Promise<PersistedEntityExtractionResult> {
  if (input.output.entities.length === 0 && input.output.relationships.length === 0) {
    return { entityIds: [], relationshipCount: 0 };
  }

  const store = await loadGraphSnapshot(input.db, input.coopId);
  const sourceRef = resolveObservationSourceRef(input.observation);
  const entityIds = [...new Set(input.output.entities.map((entity) => entity.id))];
  let mutated = false;

  for (const entity of input.output.entities.map((candidate) =>
    normalizeEntity(candidate, sourceRef),
  )) {
    if (!entityNeedsUpsert(store.entities.get(entity.id), entity)) {
      continue;
    }
    upsertEntity(store, entity);
    mutated = true;
  }

  let relationshipCount = 0;
  for (const relationship of input.output.relationships.map((candidate) =>
    normalizeRelationship(candidate, sourceRef),
  )) {
    if (!store.entities.has(relationship.from) || !store.entities.has(relationship.to)) {
      continue;
    }

    const existingIndex = findActiveRelationshipIndex(store.relationships, relationship);
    if (existingIndex >= 0) {
      const existing = store.relationships[existingIndex];
      const nextConfidence = Math.max(existing.confidence, relationship.confidence);
      if (nextConfidence !== existing.confidence) {
        existing.confidence = nextConfidence;
        mutated = true;
      }
      if (relationship.t_valid < existing.t_valid) {
        existing.t_valid = relationship.t_valid;
        mutated = true;
      }
      continue;
    }

    createRelationship(store, relationship);
    relationshipCount += 1;
    mutated = true;
  }

  if (mutated) {
    scheduleSave(input.db, input.coopId);
  }

  return {
    entityIds,
    relationshipCount,
  };
}
