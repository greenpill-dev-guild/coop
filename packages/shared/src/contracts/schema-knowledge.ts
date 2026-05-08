import z from 'zod';

export const knowledgeSourceTypeSchema = z.enum([
  'youtube',
  'github',
  'rss',
  'reddit',
  'npm',
  'wikipedia',
]);

export type KnowledgeSourceType = z.infer<typeof knowledgeSourceTypeSchema>;

export const knowledgeSourceSchema = z.object({
  id: z.string().min(1),
  type: knowledgeSourceTypeSchema,
  identifier: z.string().min(1),
  label: z.string().min(1),
  coopId: z.string().min(1),
  addedBy: z.string().min(1),
  addedAt: z.string().datetime(),
  lastFetchedAt: z.string().datetime().nullable(),
  entityCount: z.number().int().min(0),
  active: z.boolean(),
});

export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;

// ---------------------------------------------------------------------------
// POLE+O Entity Model (Person, Organization, Location, Event + Object)
// ---------------------------------------------------------------------------

export const poleEntityTypeSchema = z.enum([
  'person',
  'organization',
  'location',
  'event',
  'object',
]);

export type PoleEntityType = z.infer<typeof poleEntityTypeSchema>;

export const graphEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: poleEntityTypeSchema,
  description: z.string().min(1),
  sourceRef: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  stale: z.boolean().optional(),
  staleAt: z.string().datetime().optional(),
  staleReason: z.string().min(1).optional(),
});

export type GraphEntity = z.infer<typeof graphEntitySchema>;

export const graphRelationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.string().min(1),
  confidence: z.number().min(0).max(1),
  t_valid: z.string().datetime(),
  t_invalid: z.string().datetime().nullable(),
  provenance: z.string().min(1),
});

export type GraphRelationship = z.infer<typeof graphRelationshipSchema>;

export const entityExtractionOutputSchema = z.object({
  entities: z.array(graphEntitySchema),
  relationships: z.array(graphRelationshipSchema).default([]),
});

export type EntityExtractionOutput = z.infer<typeof entityExtractionOutputSchema>;

// ---------------------------------------------------------------------------
// Reasoning Traces
// ---------------------------------------------------------------------------

export const reasoningTraceOutcomeSchema = z.enum(['approved', 'rejected', 'pending']);

export const reasoningTraceSchema = z.object({
  traceId: z.string().min(1),
  skillRunId: z.string().min(1),
  observationId: z.string().min(1),
  observationText: z.string().min(1),
  contextEntityIds: z.array(z.string()).default([]),
  precedentTraceIds: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  outputSummary: z.string().min(1),
  outcome: reasoningTraceOutcomeSchema,
  createdAt: z.string().datetime(),
});

export type ReasoningTrace = z.infer<typeof reasoningTraceSchema>;

// ---------------------------------------------------------------------------
// Validated Insights (approved drafts → first-class graph nodes)
// ---------------------------------------------------------------------------

export const validatedInsightSchema = z.object({
  insightId: z.string().min(1),
  draftSummary: z.string().min(1),
  sourceEntityIds: z.array(z.string()),
  traceId: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type ValidatedInsight = z.infer<typeof validatedInsightSchema>;

// ---------------------------------------------------------------------------
// Knowledge Activity Log
// ---------------------------------------------------------------------------

export const knowledgeLogEntryTypeSchema = z.enum([
  'ingest',
  'query',
  'lint',
  'approval',
  'rejection',
]);

export const knowledgeLogEntrySchema = z.object({
  type: knowledgeLogEntryTypeSchema,
  timestamp: z.string().datetime(),
  summary: z.string().min(1),
  sourceId: z.string().optional(),
  entityCount: z.number().int().min(0).optional(),
  traceId: z.string().optional(),
});

export type KnowledgeLogEntry = z.infer<typeof knowledgeLogEntrySchema>;

// ---------------------------------------------------------------------------
// Knowledge Lint Output
// ---------------------------------------------------------------------------

export const knowledgeLintFindingSchema = z.object({
  type: z.enum(['orphan-entity', 'stale-source', 'contradiction', 'coverage-gap', 'health']),
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string().min(1),
  entityId: z.string().optional(),
  sourceId: z.string().optional(),
  suggestion: z.string().optional(),
});

export type KnowledgeLintFinding = z.infer<typeof knowledgeLintFindingSchema>;

export const knowledgeLintOutputSchema = z.object({
  findings: z.array(knowledgeLintFindingSchema).default([]),
  stats: z.object({
    entityCount: z.number().int().min(0),
    relationshipCount: z.number().int().min(0),
    sourceCount: z.number().int().min(0),
    orphanEntityCount: z.number().int().min(0),
    staleSourceCount: z.number().int().min(0),
  }),
});

export type KnowledgeLintOutput = z.infer<typeof knowledgeLintOutputSchema>;

// ---------------------------------------------------------------------------
// Graph Snapshot (Dexie persistence for in-memory graph store)
// ---------------------------------------------------------------------------

export const graphSnapshotSchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  entities: z.string(),
  relationships: z.string(),
  traces: z.string(),
  insights: z.string(),
  entityHistory: z.string().default('[]'),
  updatedAt: z.string().datetime(),
});

export type GraphSnapshot = z.infer<typeof graphSnapshotSchema>;
