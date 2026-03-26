import z from 'zod';
import { artifactCategorySchema, ritualLensSchema } from './schema-enums';
import { policyActionClassSchema } from './schema-policy';

export const agentObservationTriggerSchema = z.enum([
  'roundup-batch-ready',
  'high-confidence-draft',
  'memory-insight-due',
  'receiver-backlog',
  'stale-archive-receipt',
  'ritual-review-due',
  'green-goods-garden-requested',
  'green-goods-sync-needed',
  'green-goods-work-approval-requested',
  'green-goods-assessment-requested',
  'green-goods-gap-admin-sync-needed',
  'erc8004-registration-due',
  'erc8004-feedback-due',
  'stale-draft',
  'audio-transcript-ready',
  'safe-add-owner-requested',
]);

export const agentObservationStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'dismissed',
  'stalled',
]);

export const agentPlanStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'executing',
  'completed',
  'failed',
]);

export const agentPlanStepStatusSchema = z.enum(['pending', 'completed', 'failed', 'skipped']);

export const agentProviderSchema = z.enum(['heuristic', 'transformers', 'webllm']);

export const skillRuntimeSchema = z.enum(['extension-offscreen', 'extension-sidepanel']);

export const skillModelSchema = z.enum(['heuristic', 'transformers', 'webllm', 'hybrid']);

export const skillApprovalModeSchema = z.enum(['advisory', 'proposal', 'auto-run-eligible']);

export const skillQualityProfileSchema = z.enum(['synthesis-v1', 'publish-readiness-v1']);

export const skillToolSchema = z.enum([
  'read-observation-context',
  'read-coop-context',
  'list-related-artifacts',
  'list-related-drafts',
  'create-review-draft',
  'patch-review-draft',
  'propose-action',
]);

export const skillRunStatusSchema = z.enum(['pending', 'completed', 'failed', 'skipped']);

export const skillOutputSchemaRefSchema = z.enum([
  'tab-router-output',
  'opportunity-extractor-output',
  'grant-fit-scorer-output',
  'capital-formation-brief-output',
  'memory-insight-output',
  'review-digest-output',
  'ecosystem-entity-extractor-output',
  'theme-clusterer-output',
  'publish-readiness-check-output',
  'green-goods-garden-bootstrap-output',
  'green-goods-garden-sync-output',
  'green-goods-work-approval-output',
  'green-goods-assessment-output',
  'green-goods-gap-admin-sync-output',
  'erc8004-registration-output',
  'erc8004-feedback-output',
]);

export const actionProposalSchema = z.object({
  id: z.string().min(1),
  actionClass: policyActionClassSchema,
  coopId: z.string().min(1),
  memberId: z.string().min(1).optional(),
  payload: z.record(z.any()),
  reason: z.string().min(1),
  approvalMode: skillApprovalModeSchema,
  requiresPermit: z.boolean().default(false),
  permitId: z.string().min(1).optional(),
  generatedBySkillId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
});

export const tabRoutingStatusSchema = z.enum(['routed', 'drafted', 'dismissed', 'published']);

export const tabRoutingSchema = z.object({
  id: z.string().min(1),
  sourceCandidateId: z.string().min(1),
  extractId: z.string().min(1),
  coopId: z.string().min(1),
  relevanceScore: z.number().min(0).max(1),
  matchedRitualLenses: z.array(ritualLensSchema).default([]),
  category: artifactCategorySchema,
  tags: z.array(z.string()).default([]),
  rationale: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  archiveWorthinessHint: z.boolean().default(false),
  provider: agentProviderSchema,
  status: tabRoutingStatusSchema,
  draftId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const tabRouterOutputItemSchema = z.object({
  sourceCandidateId: z.string().min(1),
  extractId: z.string().min(1),
  coopId: z.string().min(1),
  relevanceScore: z.number().min(0).max(1),
  matchedRitualLenses: z.array(ritualLensSchema).default([]),
  category: artifactCategorySchema,
  tags: z.array(z.string()).default([]),
  rationale: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  archiveWorthinessHint: z.boolean().default(false),
});

export const tabRouterOutputSchema = z.object({
  routings: z.array(tabRouterOutputItemSchema).default([]),
});

export const memoryInsightOutputItemSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  whyItMatters: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  tags: z.array(z.string()).default([]),
  category: artifactCategorySchema.default('insight'),
  confidence: z.number().min(0).max(1).default(0.72),
});

export const memoryInsightOutputSchema = z.object({
  insights: z.array(memoryInsightOutputItemSchema).default([]),
});

export const agentPlanStepEvaluationContractSchema = z.object({
  rubricId: skillQualityProfileSchema,
  threshold: z.number().min(0).max(1),
  maxRetries: z.number().int().min(0),
});

export const skillEvaluationCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0).max(1),
  score: z.number().min(0).max(1),
  passed: z.boolean(),
  reason: z.string().min(1).optional(),
});

export const skillEvaluationAttemptSchema = z.object({
  attempt: z.number().int().positive(),
  rubricId: skillQualityProfileSchema,
  score: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1),
  passed: z.boolean(),
  critiqueSummary: z.string().min(1),
  criteria: z.array(skillEvaluationCriterionSchema).default([]),
  evaluatedAt: z.string().datetime(),
});

export const agentPlanStepSchema = z.object({
  id: z.string().min(1),
  skillId: z.string().min(1),
  provider: agentProviderSchema,
  status: agentPlanStepStatusSchema,
  summary: z.string().min(1),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  outputRef: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  evaluationContract: agentPlanStepEvaluationContractSchema.optional(),
});

export const agentObservationSchema = z.object({
  id: z.string().min(1),
  trigger: agentObservationTriggerSchema,
  status: agentObservationStatusSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  coopId: z.string().min(1).optional(),
  draftId: z.string().min(1).optional(),
  extractId: z.string().min(1).optional(),
  receiptId: z.string().min(1).optional(),
  captureId: z.string().min(1).optional(),
  artifactId: z.string().min(1).optional(),
  fingerprint: z.string().min(1),
  payload: z.record(z.any()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastRunAt: z.string().datetime().optional(),
  blockedReason: z.string().min(1).optional(),
});

export const agentPlanSchema = z.object({
  id: z.string().min(1),
  observationId: z.string().min(1),
  status: agentPlanStatusSchema,
  provider: agentProviderSchema,
  confidence: z.number().min(0).max(1),
  goal: z.string().min(1),
  rationale: z.string().min(1),
  steps: z.array(agentPlanStepSchema).default([]),
  actionProposals: z.array(actionProposalSchema).default([]),
  requiresApproval: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  failureReason: z.string().min(1).optional(),
});

export const opportunityCandidateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  rationale: z.string().min(1),
  regionTags: z.array(z.string()).default([]),
  ecologyTags: z.array(z.string()).default([]),
  fundingSignals: z.array(z.string()).default([]),
  sourceDraftId: z.string().min(1).optional(),
  sourceExtractId: z.string().min(1).optional(),
  priority: z.number().min(0).max(1),
  recommendedNextStep: z.string().min(1),
});

export const opportunityExtractorOutputSchema = z.object({
  candidates: z.array(opportunityCandidateSchema).default([]),
});

export const grantFitScoreSchema = z.object({
  candidateId: z.string().min(1),
  candidateTitle: z.string().min(1),
  score: z.number().min(0).max(1),
  reasons: z.array(z.string()).default([]),
  recommendedTargetCoopId: z.string().min(1).optional(),
});

export const grantFitScorerOutputSchema = z.object({
  scores: z.array(grantFitScoreSchema).default([]),
});

export const capitalFormationBriefOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  whyItMatters: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  tags: z.array(z.string()).default([]),
  targetCoopIds: z.array(z.string()).default([]),
  supportingCandidateIds: z.array(z.string()).default([]),
});

export const reviewDigestOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  whyItMatters: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  highlights: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const ecosystemEntitySchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['organization', 'bioregion', 'watershed', 'program', 'place', 'network']),
  relevance: z.number().min(0).max(1),
});

export const ecosystemEntityExtractorOutputSchema = z.object({
  entities: z.array(ecosystemEntitySchema).default([]),
});

export const themeClusterSchema = z.object({
  label: z.string().min(1),
  summary: z.string().min(1),
  sourceIds: z.array(z.string()).default([]),
});

export const themeClustererOutputSchema = z.object({
  themes: z.array(themeClusterSchema).default([]),
});

export const publishReadinessCheckOutputSchema = z.object({
  draftId: z.string().min(1),
  ready: z.boolean(),
  suggestions: z.array(z.string()).default([]),
  proposedPatch: z
    .object({
      title: z.string().min(1).optional(),
      summary: z.string().min(1).optional(),
      tags: z.array(z.string()).optional(),
    })
    .default({}),
});

export const skillManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  runtime: skillRuntimeSchema,
  model: skillModelSchema,
  triggers: z.array(agentObservationTriggerSchema).min(1),
  inputSchemaRef: z.string().min(1),
  outputSchemaRef: skillOutputSchemaRefSchema,
  allowedTools: z.array(skillToolSchema).default([]),
  allowedActionClasses: z.array(policyActionClassSchema).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
  approvalMode: skillApprovalModeSchema,
  timeoutMs: z.number().int().positive(),
  depends: z.array(z.string()).default([]),
  skipWhen: z.string().optional(),
  provides: z.array(z.string()).default([]),
  maxTokens: z.number().int().positive().optional(),
  qualityProfile: skillQualityProfileSchema.optional(),
  qualityThreshold: z.number().min(0).max(1).optional(),
  maxEvaluatorRetries: z.number().int().min(0).optional(),
});

export const skillRunSchema = z.object({
  id: z.string().min(1),
  observationId: z.string().min(1),
  planId: z.string().min(1),
  skillId: z.string().min(1),
  skillVersion: z.string().min(1),
  provider: agentProviderSchema,
  status: skillRunStatusSchema,
  promptHash: z.string().min(1).optional(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  outputSchemaRef: skillOutputSchemaRefSchema,
  output: z.record(z.any()).optional(),
  notes: z.string().optional(),
  error: z.string().optional(),
  evaluationAttempts: z.array(skillEvaluationAttemptSchema).optional(),
});

export const knowledgeSkillSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  name: z.string().min(1),
  description: z.string().default(''),
  domain: z.string().default('general'),
  content: z.string().default(''),
  contentHash: z.string().default(''),
  fetchedAt: z.string().datetime().optional(),
  enabled: z.boolean().default(true),
  triggerPatterns: z.array(z.string()).default([]),
});

export const coopKnowledgeSkillOverrideSchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  knowledgeSkillId: z.string().min(1),
  enabled: z.boolean(),
  triggerPatterns: z.array(z.string()).optional(),
});

export const agentLogSpanTypeSchema = z.enum([
  'cycle',
  'observation',
  'skill',
  'inference',
  'action',
]);

export const agentLogLevelSchema = z.enum(['info', 'warn', 'error']);

export const agentLogSchema = z.object({
  id: z.string().min(1),
  traceId: z.string().min(1),
  spanType: agentLogSpanTypeSchema,
  skillId: z.string().optional(),
  observationId: z.string().optional(),
  level: agentLogLevelSchema,
  message: z.string(),
  data: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
});

export const agentMemoryTypeSchema = z.enum([
  'observation-outcome',
  'skill-pattern',
  'user-feedback',
  'domain-pattern',
  'coop-context',
  'decision-context',
]);

export const agentMemoryScopeSchema = z.enum(['member', 'coop']);

export const agentMemorySchema = z
  .object({
    id: z.string().min(1),
    scope: agentMemoryScopeSchema.default('coop'),
    coopId: z.string().min(1).optional(),
    memberId: z.string().min(1).optional(),
    type: agentMemoryTypeSchema,
    domain: z.string().default('general'),
    content: z.string().min(1),
    contentHash: z.string().min(1),
    confidence: z.number().min(0).max(1),
    authorMemberId: z.string().optional(),
    sourceObservationId: z.string().optional(),
    sourceSkillRunId: z.string().optional(),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'coop' && !value.coopId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'coop-scoped memories require coopId',
        path: ['coopId'],
      });
    }
    if (value.scope === 'member' && !value.memberId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'member-scoped memories require memberId',
        path: ['memberId'],
      });
    }
  });

export const privilegedActionStatusSchema = z.enum(['attempted', 'succeeded', 'failed']);
export const archiveWorthinessSchema = z.object({
  flagged: z.boolean().default(false),
  flaggedAt: z.string().datetime().optional(),
});

export type AgentObservationTrigger = z.infer<typeof agentObservationTriggerSchema>;
export type AgentObservationStatus = z.infer<typeof agentObservationStatusSchema>;
export type AgentObservation = z.infer<typeof agentObservationSchema>;
export type AgentPlanStatus = z.infer<typeof agentPlanStatusSchema>;
export type AgentPlanStepStatus = z.infer<typeof agentPlanStepStatusSchema>;
export type AgentProvider = z.infer<typeof agentProviderSchema>;
export type SkillRuntime = z.infer<typeof skillRuntimeSchema>;
export type SkillModel = z.infer<typeof skillModelSchema>;
export type SkillApprovalMode = z.infer<typeof skillApprovalModeSchema>;
export type SkillQualityProfile = z.infer<typeof skillQualityProfileSchema>;
export type SkillTool = z.infer<typeof skillToolSchema>;
export type SkillRunStatus = z.infer<typeof skillRunStatusSchema>;
export type SkillOutputSchemaRef = z.infer<typeof skillOutputSchemaRefSchema>;
export type TabRoutingStatus = z.infer<typeof tabRoutingStatusSchema>;
export type TabRouting = z.infer<typeof tabRoutingSchema>;
export type TabRouterOutput = z.infer<typeof tabRouterOutputSchema>;
export type MemoryInsightOutput = z.infer<typeof memoryInsightOutputSchema>;
export type ActionProposal = z.infer<typeof actionProposalSchema>;
export type AgentPlanStepEvaluationContract = z.infer<
  typeof agentPlanStepEvaluationContractSchema
>;
export type SkillEvaluationCriterion = z.infer<typeof skillEvaluationCriterionSchema>;
export type SkillEvaluationAttempt = z.infer<typeof skillEvaluationAttemptSchema>;
export type AgentPlanStep = z.infer<typeof agentPlanStepSchema>;
export type AgentPlan = z.infer<typeof agentPlanSchema>;
export type OpportunityCandidate = z.infer<typeof opportunityCandidateSchema>;
export type OpportunityExtractorOutput = z.infer<typeof opportunityExtractorOutputSchema>;
export type GrantFitScore = z.infer<typeof grantFitScoreSchema>;
export type GrantFitScorerOutput = z.infer<typeof grantFitScorerOutputSchema>;
export type CapitalFormationBriefOutput = z.infer<typeof capitalFormationBriefOutputSchema>;
export type ReviewDigestOutput = z.infer<typeof reviewDigestOutputSchema>;
export type EcosystemEntity = z.infer<typeof ecosystemEntitySchema>;
export type EcosystemEntityExtractorOutput = z.infer<typeof ecosystemEntityExtractorOutputSchema>;
export type ThemeCluster = z.infer<typeof themeClusterSchema>;
export type ThemeClustererOutput = z.infer<typeof themeClustererOutputSchema>;
export type PublishReadinessCheckOutput = z.infer<typeof publishReadinessCheckOutputSchema>;
export type SkillManifest = z.infer<typeof skillManifestSchema>;
export type SkillRun = z.infer<typeof skillRunSchema>;
export type KnowledgeSkill = z.infer<typeof knowledgeSkillSchema>;
export type CoopKnowledgeSkillOverride = z.infer<typeof coopKnowledgeSkillOverrideSchema>;
export type AgentLogSpanType = z.infer<typeof agentLogSpanTypeSchema>;
export type AgentLogLevel = z.infer<typeof agentLogLevelSchema>;
export type AgentLog = z.infer<typeof agentLogSchema>;
export type AgentMemoryType = z.infer<typeof agentMemoryTypeSchema>;
export type AgentMemoryScope = z.infer<typeof agentMemoryScopeSchema>;
export type AgentMemory = z.infer<typeof agentMemorySchema>;
export type PrivilegedActionStatus = z.infer<typeof privilegedActionStatusSchema>;
export type ArchiveWorthiness = z.infer<typeof archiveWorthinessSchema>;
