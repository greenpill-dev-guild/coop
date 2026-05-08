export {
  type GraphStore,
  initGraphStore,
  upsertEntity,
  getEntity,
  getEntityNeighbors,
  createRelationship,
  invalidateRelationship,
  markEntitiesFromSourceStale,
  isGraphRefFromSource,
  destroyGraphStore,
} from './store';
export type { MarkSourceStaleResult } from './store';
export { currentFacts, factsAt, factHistory } from './temporal';
export {
  type RetrievalResult,
  type HybridSearchOptions,
  searchByText,
  searchByVector,
  searchByTraversal,
  hybridSearch,
} from './retrieval';
export { assembleGraphContext } from './context';
export { createEntityEmbedding, createTextEmbedding } from './embedding';
export {
  recordReasoningTrace,
  queryPrecedents,
  computePrecedentAdjustment,
} from './reasoning';
export {
  strengthenSourceEdges,
  weakenSourceEdges,
  createValidatedInsight,
} from './compound';
export { runKnowledgeLint } from './lint';
