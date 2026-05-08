import type { GraphEntity } from '../../contracts/schema-knowledge';

const DEFAULT_EMBEDDING_DIMENSIONS = 32;

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index++) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_.,;:!?()[\]{}"']+/)
    .filter((token) => token.length > 1);
}

export function createTextEmbedding(text: string, dimensions = DEFAULT_EMBEDDING_DIMENSIONS) {
  const safeDimensions = Math.max(1, Math.floor(dimensions));
  const vector = Array.from({ length: safeDimensions }, () => 0);

  for (const token of tokenize(text)) {
    const hash = hashToken(token);
    const index = hash % safeDimensions;
    const sign = hash & 1 ? 1 : -1;
    vector[index] += sign;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

export function createEntityEmbedding(
  entity: GraphEntity,
  dimensions = DEFAULT_EMBEDDING_DIMENSIONS,
) {
  return createTextEmbedding(
    `${entity.name} ${entity.type} ${entity.description} ${entity.sourceRef}`,
    dimensions,
  );
}
