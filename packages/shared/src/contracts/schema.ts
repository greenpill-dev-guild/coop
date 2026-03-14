import { z } from 'zod';

export const authModeSchema = z.enum(['passkey', 'wallet', 'embedded']);
export const memberRoleSchema = z.enum(['creator', 'trusted', 'member']);
export const inviteTypeSchema = z.enum(['trusted', 'member']);
export const captureModeSchema = z.enum(['manual', '30-min', '60-min']);
export const coopSpaceTypeSchema = z.enum([
  'community',
  'project',
  'friends',
  'family',
  'personal',
]);
export const integrationModeSchema = z.enum(['live', 'mock']);
export const sessionModeSchema = z.enum(['off', 'mock', 'live']);
export const extensionIconStateSchema = z.enum([
  'idle',
  'watching',
  'review-needed',
  'error-offline',
]);
export const capabilityStateSchema = z.enum([
  'unavailable',
  'stubbed',
  'ready',
  'executed',
  'failed',
]);
export const ritualLensSchema = z.enum([
  'capital-formation',
  'impact-reporting',
  'governance-coordination',
  'knowledge-garden-resources',
]);
export const artifactCategorySchema = z.enum([
  'setup-insight',
  'coop-soul',
  'ritual',
  'seed-contribution',
  'resource',
  'thought',
  'insight',
  'evidence',
  'opportunity',
  'funding-lead',
  'next-step',
]);
export const reviewStatusSchema = z.enum(['draft', 'published', 'reviewed', 'actioned']);
export const archiveScopeSchema = z.enum(['artifact', 'snapshot']);
export const archiveStatusSchema = z.enum(['not-archived', 'pending', 'archived']);
export const filecoinStatusSchema = z.enum(['pending', 'offered', 'indexed', 'sealed']);
export const archiveDelegationOperationSchema = z.enum(['upload', 'follow-up']);
export const soundEventSchema = z.enum(['coop-created', 'artifact-published', 'sound-test']);
export const coopChainKeySchema = z.enum(['arbitrum', 'sepolia']);
export const providerModeSchema = z.enum(['standard', 'kohaku']);
export type ProviderMode = z.infer<typeof providerModeSchema>;

export const signatureValidationResultSchema = z.object({
  isValid: z.boolean(),
});
export type SignatureValidationResult = z.infer<typeof signatureValidationResultSchema>;

export const membershipProofSchema = z.object({
  merkleTreeDepth: z.number().int().nonnegative(),
  merkleTreeRoot: z.string().min(1),
  nullifier: z.string().min(1),
  message: z.string().min(1),
  scope: z.string().min(1),
  points: z.array(z.string()),
});
export type MembershipProof = z.infer<typeof membershipProofSchema>;

export const greenGoodsGardenStatusSchema = z.enum([
  'disabled',
  'requested',
  'provisioning',
  'linked',
  'error',
]);
export const greenGoodsDomainSchema = z.enum(['solar', 'agro', 'edu', 'waste']);
export const greenGoodsWeightSchemeSchema = z.enum(['linear', 'exponential', 'power']);
export const privilegedActionTypeSchema = z.enum([
  'anchor-mode-toggle',
  'archive-upload',
  'archive-follow-up-refresh',
  'archive-anchor',
  'safe-deployment',
  'green-goods-transaction',
]);

export const policyActionClassSchema = z.enum([
  'archive-artifact',
  'archive-snapshot',
  'refresh-archive-status',
  'publish-ready-draft',
  'safe-deployment',
  'green-goods-create-garden',
  'green-goods-sync-garden-profile',
  'green-goods-set-garden-domains',
  'green-goods-create-garden-pools',
  'green-goods-submit-work-approval',
  'green-goods-create-assessment',
  'green-goods-sync-gap-admins',
  'erc8004-register-agent',
  'erc8004-give-feedback',
]);

export const actionPolicySchema = z.object({
  id: z.string().min(1),
  actionClass: policyActionClassSchema,
  approvalRequired: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
  replayProtection: z.boolean().default(true),
  coopId: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  targetConstraints: z.record(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const actionBundleStatusSchema = z.enum([
  'proposed',
  'approved',
  'rejected',
  'executed',
  'failed',
  'expired',
]);

export const typedActionBundleFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
});

export const typedActionBundleSchema = z.object({
  domain: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    chainId: z.number().int().positive(),
    verifyingContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),
  primaryType: z.literal('CoopActionBundle'),
  types: z.object({
    CoopActionBundle: z.array(typedActionBundleFieldSchema).min(1),
  }),
  message: z.object({
    actionClass: policyActionClassSchema,
    coopId: z.string().min(1),
    memberId: z.string().min(1),
    replayId: z.string().min(1),
    payloadHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    chainKey: coopChainKeySchema,
    safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),
  digest: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export const actionBundleSchema = z.object({
  id: z.string().min(1),
  replayId: z.string().min(1),
  actionClass: policyActionClassSchema,
  coopId: z.string().min(1),
  memberId: z.string().min(1),
  payload: z.record(z.any()),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  policyId: z.string().min(1),
  status: actionBundleStatusSchema,
  digest: z.string().min(1),
  typedAuthorization: typedActionBundleSchema.optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  executedAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
  failureReason: z.string().optional(),
});

export const actionLogEventTypeSchema = z.enum([
  'proposal-created',
  'proposal-approved',
  'proposal-rejected',
  'execution-started',
  'execution-succeeded',
  'execution-failed',
  'replay-rejected',
  'expiry-rejected',
]);

export const actionLogEntrySchema = z.object({
  id: z.string().min(1),
  bundleId: z.string().min(1),
  eventType: actionLogEventTypeSchema,
  actionClass: policyActionClassSchema,
  detail: z.string().min(1),
  createdAt: z.string().datetime(),
  coopId: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
});

export const delegatedActionClassSchema = z.enum([
  'archive-artifact',
  'archive-snapshot',
  'refresh-archive-status',
  'publish-ready-draft',
]);

export const grantStatusSchema = z.enum(['active', 'expired', 'revoked', 'exhausted']);

export const grantLogEventTypeSchema = z.enum([
  'grant-issued',
  'grant-revoked',
  'grant-expired',
  'delegated-execution-attempted',
  'delegated-execution-succeeded',
  'delegated-execution-failed',
  'delegated-replay-rejected',
  'delegated-exhausted-rejected',
]);

export const executionGrantSchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  issuedBy: z.object({
    memberId: z.string().min(1),
    displayName: z.string().min(1),
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
  }),
  executor: z.object({
    label: z.string().min(1),
    localIdentityId: z.string().min(1).optional(),
  }),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive(),
  usedCount: z.number().int().nonnegative().default(0),
  allowedActions: z.array(delegatedActionClassSchema).min(1),
  targetAllowlist: z.record(z.array(z.string())).optional(),
  policyRef: z.string().min(1).optional(),
  status: grantStatusSchema.default('active'),
});

export const grantLogEntrySchema = z.object({
  id: z.string().min(1),
  grantId: z.string().min(1),
  eventType: grantLogEventTypeSchema,
  actionClass: delegatedActionClassSchema.optional(),
  detail: z.string().min(1),
  createdAt: z.string().datetime(),
  coopId: z.string().min(1).optional(),
  replayId: z.string().min(1).optional(),
});

export const sessionCapableActionClassSchema = z.enum([
  'green-goods-create-garden',
  'green-goods-sync-garden-profile',
  'green-goods-set-garden-domains',
  'green-goods-create-garden-pools',
]);

export const sessionCapabilityStatusSchema = z.enum([
  'active',
  'expired',
  'revoked',
  'exhausted',
  'unusable',
]);

export const sessionCapabilityFailureReasonSchema = z.enum([
  'expired',
  'revoked',
  'exhausted',
  'allowlist-mismatch',
  'action-denied',
  'missing-safe',
  'missing-pimlico',
  'wrong-chain',
  'missing-session-material',
  'unsupported-action',
  'module-unavailable',
]);

export const sessionCapabilityScopeSchema = z.object({
  allowedActions: z.array(sessionCapableActionClassSchema).min(1),
  targetAllowlist: z.record(z.array(z.string())).default({}),
  maxUses: z.number().int().positive(),
  expiresAt: z.string().datetime(),
  chainKey: coopChainKeySchema,
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const sessionCapabilitySchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
  lastUsedAt: z.string().datetime().optional(),
  permissionId: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
  sessionAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  validatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  validatorInitData: z.string().regex(/^0x[a-fA-F0-9]*$/),
  status: sessionCapabilityStatusSchema.default('active'),
  statusDetail: z.string().min(1),
  lastValidationFailure: sessionCapabilityFailureReasonSchema.optional(),
  moduleInstalledAt: z.string().datetime().optional(),
  enableSignature: z
    .string()
    .regex(/^0x[a-fA-F0-9]*$/)
    .optional(),
  scope: sessionCapabilityScopeSchema,
  issuedBy: z.object({
    memberId: z.string().min(1),
    displayName: z.string().min(1),
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
  }),
  executor: z.object({
    label: z.string().min(1),
    localIdentityId: z.string().min(1).optional(),
  }),
  usedCount: z.number().int().nonnegative().default(0),
});

export const sessionCapabilityLogEventTypeSchema = z.enum([
  'session-issued',
  'session-rotated',
  'session-revoked',
  'session-module-installed',
  'session-module-install-failed',
  'session-execution-attempted',
  'session-execution-succeeded',
  'session-execution-failed',
  'session-validation-rejected',
]);

export const sessionCapabilityLogEntrySchema = z.object({
  id: z.string().min(1),
  capabilityId: z.string().min(1),
  coopId: z.string().min(1),
  eventType: sessionCapabilityLogEventTypeSchema,
  detail: z.string().min(1),
  createdAt: z.string().datetime(),
  actionClass: policyActionClassSchema.optional(),
  bundleId: z.string().min(1).optional(),
  replayId: z.string().min(1).optional(),
  reason: sessionCapabilityFailureReasonSchema.optional(),
});

export const encryptedSessionMaterialSchema = z.object({
  capabilityId: z.string().min(1),
  sessionAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().optional(),
  algorithm: z.literal('aes-gcm'),
  wrappedAt: z.string().datetime(),
  version: z.literal(1),
});

export const agentObservationTriggerSchema = z.enum([
  'high-confidence-draft',
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
  'opportunity-extractor-output',
  'grant-fit-scorer-output',
  'capital-formation-brief-output',
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
  requiresGrant: z.boolean().default(false),
  grantId: z.string().min(1).optional(),
  generatedBySkillId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
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

export const greenGoodsGardenBootstrapOutputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().min(1),
  location: z.string().default(''),
  bannerImage: z.string().default(''),
  metadata: z.string().default(''),
  openJoining: z.boolean().default(false),
  maxGardeners: z.number().int().nonnegative().default(0),
  weightScheme: greenGoodsWeightSchemeSchema.default('linear'),
  domains: z.array(greenGoodsDomainSchema).default([]),
  rationale: z.string().min(1),
});

export const greenGoodsGardenSyncOutputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  location: z.string().default(''),
  bannerImage: z.string().default(''),
  metadata: z.string().default(''),
  openJoining: z.boolean().default(false),
  maxGardeners: z.number().int().nonnegative().default(0),
  domains: z.array(greenGoodsDomainSchema).default([]),
  ensurePools: z.boolean().default(true),
  rationale: z.string().min(1),
});

export const greenGoodsWorkApprovalRequestSchema = z.object({
  actionUid: z.number().int().nonnegative(),
  workUid: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  approved: z.boolean(),
  feedback: z.string().default(''),
  confidence: z.number().int().min(0).max(255).default(100),
  verificationMethod: z.number().int().min(0).max(255).default(0),
  reviewNotesCid: z.string().default(''),
  rationale: z.string().min(1).default('Queue a Green Goods work approval attestation.'),
});

export const greenGoodsAssessmentRequestSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    assessmentConfigCid: z.string().min(1),
    domain: greenGoodsDomainSchema.default('agro'),
    startDate: z.number().int().nonnegative(),
    endDate: z.number().int().nonnegative(),
    location: z.string().default(''),
    rationale: z.string().min(1).default('Queue a Green Goods assessment attestation.'),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'endDate must be greater than or equal to startDate.',
      });
    }
  });

export const greenGoodsWorkApprovalOutputSchema = z.object({
  actionUid: z.number().int().nonnegative(),
  workUid: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  approved: z.boolean(),
  feedback: z.string().default(''),
  confidence: z.number().int().min(0).max(255).default(100),
  verificationMethod: z.number().int().min(0).max(255).default(0),
  reviewNotesCid: z.string().default(''),
  rationale: z.string().min(1),
});

export const greenGoodsAssessmentOutputSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    assessmentConfigCid: z.string().min(1),
    domain: greenGoodsDomainSchema.default('agro'),
    startDate: z.number().int().nonnegative(),
    endDate: z.number().int().nonnegative(),
    location: z.string().default(''),
    rationale: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'endDate must be greater than or equal to startDate.',
      });
    }
  });

export const greenGoodsGapAdminSyncOutputSchema = z.object({
  addAdmins: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).default([]),
  removeAdmins: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).default([]),
  rationale: z.string().min(1),
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

export const privilegedActionStatusSchema = z.enum(['attempted', 'succeeded', 'failed']);
export const archiveWorthinessSchema = z.object({
  flagged: z.boolean().default(false),
  flaggedAt: z.string().datetime().optional(),
});

export const legacyOnchainChainKeyMap = {
  celo: 'arbitrum',
  'celo-sepolia': 'sepolia',
} as const satisfies Record<string, z.infer<typeof coopChainKeySchema>>;

const supportedOnchainChainIds = {
  arbitrum: 42161,
  sepolia: 11155111,
} as const satisfies Record<z.infer<typeof coopChainKeySchema>, number>;

function normalizeLegacyOnchainStatusNote(statusNote: string) {
  return statusNote.replaceAll('Celo Sepolia', 'Sepolia').replace(/\bCelo\b/g, 'Arbitrum');
}

export function normalizeLegacyOnchainState(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const raw = { ...(value as Record<string, unknown>) };
  const rawChainKey = typeof raw.chainKey === 'string' ? raw.chainKey : undefined;
  const normalizedChainKey = rawChainKey
    ? legacyOnchainChainKeyMap[rawChainKey as keyof typeof legacyOnchainChainKeyMap]
    : undefined;

  if (!normalizedChainKey) {
    return raw;
  }

  raw.chainKey = normalizedChainKey;
  raw.chainId = supportedOnchainChainIds[normalizedChainKey];

  if (typeof raw.statusNote === 'string') {
    raw.statusNote = normalizeLegacyOnchainStatusNote(raw.statusNote);
  }

  return raw;
}

export const setupLensResponseSchema = z.object({
  lens: ritualLensSchema,
  currentState: z.string().min(1),
  painPoints: z.string().min(1),
  improvements: z.string().min(1),
});

export const setupInsightsSchema = z.object({
  summary: z.string().min(16),
  lenses: z.array(setupLensResponseSchema).length(4),
  crossCuttingPainPoints: z.array(z.string()).default([]),
  crossCuttingOpportunities: z.array(z.string()).default([]),
});

export const coopSoulSchema = z.object({
  purposeStatement: z.string().min(1),
  toneAndWorkingStyle: z.string().min(1),
  usefulSignalDefinition: z.string().min(1),
  artifactFocus: z.array(z.string()).min(1),
  whyThisCoopExists: z.string().min(1),
});

export const ritualDefinitionSchema = z.object({
  weeklyReviewCadence: z.string().min(1),
  namedMoments: z.array(z.string()).min(1),
  facilitatorExpectation: z.string().min(1),
  defaultCapturePosture: z.string().min(1),
});

export const onchainStateSchema = z
  .object({
    chainId: z.number().int().positive(),
    chainKey: coopChainKeySchema.default('sepolia'),
    safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    senderAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
    safeCapability: capabilityStateSchema,
    statusNote: z.string(),
    deploymentTxHash: z
      .string()
      .regex(/^0x[a-fA-F0-9]+$/)
      .optional(),
    userOperationHash: z
      .string()
      .regex(/^0x[a-fA-F0-9]+$/)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.chainId !== supportedOnchainChainIds[value.chainKey]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chainId'],
        message: `chainId must match the configured ${value.chainKey} network.`,
      });
    }
  });

export const syncRoomConfigSchema = z.object({
  coopId: z.string().min(1),
  roomSecret: z.string().min(1),
  roomId: z.string().min(1),
  inviteSigningSecret: z.string().min(1),
  signalingUrls: z.array(z.string().url()).default([]),
});

export const syncRoomBootstrapSchema = z.object({
  coopId: z.string().min(1),
  roomId: z.string().min(1),
  signalingUrls: z.array(z.string().url()).default([]),
});

export const receiverCaptureKindSchema = z.enum(['audio', 'photo', 'file', 'link']);
export const receiverCaptureSyncStateSchema = z.enum(['local-only', 'queued', 'synced', 'failed']);
export const receiverIntakeStatusSchema = z.enum([
  'private-intake',
  'candidate',
  'draft',
  'published',
  'archived',
]);

export const receiverDeviceIdentitySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export const receiverPairingPayloadSchema = z.object({
  version: z.literal(1),
  pairingId: z.string().min(1),
  coopId: z.string().min(1),
  coopDisplayName: z.string().min(1),
  memberId: z.string().min(1),
  memberDisplayName: z.string().min(1),
  pairSecret: z.string().min(1),
  roomId: z.string().min(1).optional(),
  signalingUrls: z.array(z.string().url()).default([]),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const receiverPairingRecordSchema = receiverPairingPayloadSchema.extend({
  roomId: z.string().min(1),
  acceptedAt: z.string().datetime().optional(),
  lastSyncedAt: z.string().datetime().optional(),
  pairingCode: z.string().min(1).optional(),
  deepLink: z.string().url().optional(),
  active: z.boolean().default(true),
});

export const coopProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  spaceType: coopSpaceTypeSchema.default('community'),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  captureMode: captureModeSchema,
  safeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  active: z.boolean().default(true),
});

export const sourceReferenceSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
  domain: z.string().min(1),
});

export const receiverCaptureSchema = z.object({
  id: z.string().min(1),
  deviceId: z.string().min(1),
  pairingId: z.string().min(1).optional(),
  coopId: z.string().min(1).optional(),
  coopDisplayName: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  memberDisplayName: z.string().min(1).optional(),
  kind: receiverCaptureKindSchema,
  title: z.string().min(1),
  note: z.string().default(''),
  sourceUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  syncState: receiverCaptureSyncStateSchema,
  syncError: z.string().optional(),
  syncedAt: z.string().datetime().optional(),
  lastSyncAttemptAt: z.string().datetime().optional(),
  nextRetryAt: z.string().datetime().optional(),
  retryCount: z.number().int().nonnegative().default(0),
  intakeStatus: receiverIntakeStatusSchema.default('private-intake'),
  linkedDraftId: z.string().min(1).optional(),
  archivedAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
  archiveWorthiness: archiveWorthinessSchema.optional(),
});

export const receiverSyncAssetSchema = z.object({
  captureId: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  fileName: z.string().optional(),
  dataBase64: z.string().min(1),
});

export const receiverSyncAuthSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal('hmac-sha256'),
  pairingId: z.string().min(1),
  signedAt: z.string().datetime(),
  signature: z.string().min(1),
});

export const receiverSyncEnvelopeSchema = z.object({
  capture: receiverCaptureSchema,
  asset: receiverSyncAssetSchema,
  auth: receiverSyncAuthSchema,
});

export const memberSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  role: memberRoleSchema,
  authMode: authModeSchema,
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  joinedAt: z.string().datetime(),
  seedContributionId: z.string().optional(),
  identityWarning: z.string(),
  passkeyCredentialId: z.string().optional(),
});

export const passkeyCredentialSchema = z.object({
  id: z.string().min(1),
  publicKey: z.string().regex(/^0x[a-fA-F0-9]+$/),
  rpId: z.string().min(1),
});

export const authSessionSchema = z.object({
  authMode: authModeSchema,
  displayName: z.string().min(1),
  primaryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  createdAt: z.string().datetime(),
  identityWarning: z.string(),
  passkey: passkeyCredentialSchema.optional(),
});

export const localPasskeyIdentitySchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
  identityWarning: z.string(),
  passkey: passkeyCredentialSchema,
});

export const inviteBootstrapSchema = z.object({
  coopId: z.string().min(1),
  coopDisplayName: z.string().min(1),
  inviteId: z.string().min(1),
  inviteType: inviteTypeSchema,
  expiresAt: z.string().datetime(),
  roomId: z.string().min(1),
  signalingUrls: z.array(z.string().url()).default([]),
  inviteProof: z.string().min(1),
  bootstrapState: z.lazy(() => inviteCoopBootstrapSnapshotSchema).optional(),
});

export const inviteCodeSchema = z.object({
  id: z.string().min(1),
  type: inviteTypeSchema,
  expiresAt: z.string().datetime(),
  code: z.string().min(1),
  bootstrap: inviteBootstrapSchema,
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  usedByMemberIds: z.array(z.string()).default([]),
});

export const tabCandidateSchema = z.object({
  id: z.string().min(1),
  tabId: z.number().int().nonnegative(),
  windowId: z.number().int().nonnegative(),
  url: z.string().min(1),
  canonicalUrl: z.string().min(1),
  title: z.string().min(1),
  domain: z.string().min(1),
  favicon: z.string().optional(),
  excerpt: z.string().optional(),
  tabGroupHint: z.string().optional(),
  capturedAt: z.string().datetime(),
});

export const readablePageExtractSchema = z.object({
  id: z.string().min(1),
  sourceCandidateId: z.string().min(1),
  canonicalUrl: z.string().min(1),
  cleanedTitle: z.string().min(1),
  domain: z.string().min(1),
  metaDescription: z.string().optional(),
  topHeadings: z.array(z.string()).default([]),
  leadParagraphs: z.array(z.string()).default([]),
  salientTextBlocks: z.array(z.string()).default([]),
  textHash: z.string().min(1),
  previewImageUrl: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const coopInterpretationSchema = z.object({
  id: z.string().min(1),
  targetCoopId: z.string().min(1),
  relevanceScore: z.number().min(0).max(1),
  matchedRitualLenses: z.array(ritualLensSchema).default([]),
  categoryCandidates: z.array(artifactCategorySchema).min(1),
  tagCandidates: z.array(z.string()).default([]),
  rationale: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  archiveWorthinessHint: z.boolean(),
});

export const reviewDraftWorkflowStageSchema = z.enum(['candidate', 'ready']);

export const reviewDraftProvenanceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('tab'),
    interpretationId: z.string().min(1),
    extractId: z.string().min(1),
    sourceCandidateId: z.string().min(1),
  }),
  z.object({
    type: z.literal('agent'),
    observationId: z.string().min(1),
    planId: z.string().min(1),
    skillRunId: z.string().min(1),
    skillId: z.string().min(1),
  }),
  z.object({
    type: z.literal('receiver'),
    captureId: z.string().min(1),
    pairingId: z.string().min(1).optional(),
    coopId: z.string().min(1).optional(),
    memberId: z.string().min(1).optional(),
    receiverKind: receiverCaptureKindSchema,
    seedMethod: z.literal('metadata-only'),
  }),
]);

export const reviewDraftSchema = z.object({
  id: z.string().min(1),
  interpretationId: z.string().min(1),
  extractId: z.string().min(1),
  sourceCandidateId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  sources: z.array(sourceReferenceSchema).min(1),
  tags: z.array(z.string()).default([]),
  category: artifactCategorySchema,
  whyItMatters: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  suggestedTargetCoopIds: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  previewImageUrl: z.string().optional(),
  status: z.literal('draft').default('draft'),
  workflowStage: reviewDraftWorkflowStageSchema.default('ready'),
  archiveWorthiness: archiveWorthinessSchema.optional(),
  provenance: reviewDraftProvenanceSchema,
  createdAt: z.string().datetime(),
});

export const artifactOriginSchema = z.object({
  originId: z.string().min(1),
  sourceDraftId: z.string().min(1),
  sourceUrls: z.array(z.string()).min(1),
  createdAt: z.string().datetime(),
});

export const artifactSchema = z.object({
  id: z.string().min(1),
  originId: z.string().min(1),
  targetCoopId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  sources: z.array(sourceReferenceSchema).min(1),
  tags: z.array(z.string()).default([]),
  category: artifactCategorySchema,
  whyItMatters: z.string().min(1),
  suggestedNextStep: z.string().min(1),
  previewImageUrl: z.string().optional(),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  reviewStatus: reviewStatusSchema,
  archiveStatus: archiveStatusSchema,
  archiveReceiptIds: z.array(z.string()).default([]),
  archiveWorthiness: archiveWorthinessSchema.optional(),
  membershipProof: membershipProofSchema.optional(),
});

export const archiveReceiptSchema = z.object({
  id: z.string().min(1),
  scope: archiveScopeSchema,
  targetCoopId: z.string().min(1),
  artifactIds: z.array(z.string()).default([]),
  bundleReference: z.string().min(1),
  rootCid: z.string().min(1),
  shardCids: z.array(z.string()).default([]),
  pieceCids: z.array(z.string()).default([]),
  gatewayUrl: z.string().url(),
  uploadedAt: z.string().datetime(),
  filecoinStatus: filecoinStatusSchema,
  delegationIssuer: z.string().min(1),
  delegation: z
    .object({
      issuer: z.string().min(1),
      issuerUrl: z.string().url().optional(),
      audienceDid: z.string().min(1).optional(),
      mode: integrationModeSchema.default('mock'),
      allowsFilecoinInfo: z.boolean().default(false),
    })
    .optional(),
  followUp: z
    .object({
      refreshCount: z.number().int().nonnegative().default(0),
      lastRefreshRequestedAt: z.string().datetime().optional(),
      lastRefreshedAt: z.string().datetime().optional(),
      lastStatusChangeAt: z.string().datetime().optional(),
      lastError: z.string().min(1).optional(),
    })
    .optional(),
  filecoinInfo: z
    .object({
      pieceCid: z.string().min(1).optional(),
      aggregates: z
        .array(
          z.object({
            aggregate: z.string().min(1),
            inclusionProofAvailable: z.boolean().default(false),
            inclusionProof: z.string().optional(),
          }),
        )
        .default([]),
      deals: z
        .array(
          z.object({
            aggregate: z.string().min(1),
            provider: z.string().min(1).optional(),
            dealId: z.string().min(1).optional(),
          }),
        )
        .default([]),
      lastUpdatedAt: z.string().datetime().optional(),
    })
    .optional(),
  anchorTxHash: z.string().optional(),
  anchorChainKey: coopChainKeySchema.optional(),
  anchorStatus: z.enum(['pending', 'anchored', 'skipped']).default('pending'),
});

export const archiveBundleSchema = z.object({
  id: z.string().min(1),
  scope: archiveScopeSchema,
  targetCoopId: z.string().min(1),
  createdAt: z.string().datetime(),
  schemaVersion: z.number().int().positive().default(1),
  payload: z.record(z.any()),
});

export const archiveDelegationMaterialSchema = z.object({
  spaceDid: z.string().min(1),
  delegationIssuer: z.string().min(1),
  gatewayBaseUrl: z.string().url().default('https://storacha.link'),
  spaceDelegation: z.string().min(1),
  proofs: z.array(z.string()).default([]),
  issuerUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
  allowsFilecoinInfo: z.boolean().default(false),
});

export const archiveDelegationRequestSchema = z.object({
  audienceDid: z.string().min(1),
  coopId: z.string().min(1),
  scope: archiveScopeSchema,
  operation: archiveDelegationOperationSchema.default('upload'),
  artifactIds: z.array(z.string()).default([]),
  actorAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  safeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  chainKey: coopChainKeySchema.optional(),
  receiptId: z.string().min(1).optional(),
  rootCid: z.string().min(1).optional(),
  pieceCids: z.array(z.string().min(1)).default([]),
});

export const trustedNodeArchiveConfigSchema = z.object({
  agentPrivateKey: z.string().min(1).optional(),
  spaceDid: z.string().min(1),
  delegationIssuer: z.string().min(1),
  gatewayBaseUrl: z.string().url().default('https://storacha.link'),
  spaceDelegation: z.string().min(1),
  proofs: z.array(z.string().min(1)).default([]),
  allowsFilecoinInfo: z.boolean().default(false),
  expirationSeconds: z.number().int().positive().default(600),
});

/** Public archive config — synced via CRDT in CoopSharedState. */
export const coopArchiveConfigSchema = z.object({
  spaceDid: z.string().min(1),
  delegationIssuer: z.string().min(1),
  gatewayBaseUrl: z.string().url().default('https://storacha.link'),
  allowsFilecoinInfo: z.boolean().default(false),
  expirationSeconds: z.number().int().positive().default(600),
});

/** Secret archive config — stored locally in Dexie, never synced. */
export const coopArchiveSecretsSchema = z.object({
  coopId: z.string().min(1),
  agentPrivateKey: z.string().min(1).optional(),
  spaceDelegation: z.string().min(1),
  proofs: z.array(z.string().min(1)).default([]),
});

export const anchorCapabilitySchema = z.object({
  enabled: z.boolean().default(false),
  nodeId: z.string().min(1).default('coop-extension'),
  updatedAt: z.string().datetime(),
  actorAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  actorDisplayName: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  memberDisplayName: z.string().min(1).optional(),
});

export const privilegedActionContextSchema = z.object({
  coopId: z.string().min(1).optional(),
  coopName: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  memberDisplayName: z.string().min(1).optional(),
  actorAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  chainKey: coopChainKeySchema.optional(),
  artifactId: z.string().min(1).optional(),
  receiptId: z.string().min(1).optional(),
  archiveScope: archiveScopeSchema.optional(),
  mode: integrationModeSchema.optional(),
});

export const privilegedActionLogEntrySchema = z.object({
  id: z.string().min(1),
  actionType: privilegedActionTypeSchema,
  status: privilegedActionStatusSchema,
  detail: z.string().min(1),
  createdAt: z.string().datetime(),
  context: privilegedActionContextSchema.default({}),
});

export const reviewBoardGroupSchema = z.object({
  id: z.string().min(1),
  groupBy: z.enum(['category', 'member']),
  label: z.string().min(1),
  artifactIds: z.array(z.string()).default([]),
});

export const domainStatSchema = z.object({
  domain: z.string().min(1),
  acceptCount: z.number().int().nonnegative(),
  reviewedCount: z.number().int().nonnegative(),
  lastAcceptedAt: z.string().datetime(),
});

export const tagStatSchema = z.object({
  tag: z.string().min(1),
  acceptCount: z.number().int().nonnegative(),
  lastAcceptedAt: z.string().datetime(),
});

export const categoryStatSchema = z.object({
  category: artifactCategorySchema,
  publishCount: z.number().int().nonnegative(),
  actionedCount: z.number().int().nonnegative(),
});

export const ritualLensWeightSchema = z.object({
  lens: ritualLensSchema,
  weight: z.number().min(0).max(1),
});

export const archiveSignalsSchema = z.object({
  archivedTagCounts: z.record(z.number().int().nonnegative()),
  archivedDomainCounts: z.record(z.number().int().nonnegative()),
});

export const coopMemoryProfileSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  topDomains: z.array(domainStatSchema).default([]),
  topTags: z.array(tagStatSchema).default([]),
  categoryStats: z.array(categoryStatSchema).default([]),
  ritualLensWeights: z.array(ritualLensWeightSchema).default([]),
  exemplarArtifactIds: z.array(z.string()).default([]),
  archiveSignals: archiveSignalsSchema,
});

export const greenGoodsGardenStateSchema = z.object({
  enabled: z.boolean().default(false),
  status: greenGoodsGardenStatusSchema.default('disabled'),
  requestedAt: z.string().datetime().optional(),
  provisioningAt: z.string().datetime().optional(),
  linkedAt: z.string().datetime().optional(),
  lastProfileSyncAt: z.string().datetime().optional(),
  lastDomainSyncAt: z.string().datetime().optional(),
  lastPoolSyncAt: z.string().datetime().optional(),
  lastGapAdminSyncAt: z.string().datetime().optional(),
  lastWorkApprovalAt: z.string().datetime().optional(),
  lastAssessmentAt: z.string().datetime().optional(),
  gardenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  tokenId: z.string().min(1).optional(),
  gapProjectUid: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().min(1),
  location: z.string().default(''),
  bannerImage: z.string().default(''),
  metadata: z.string().default(''),
  openJoining: z.boolean().default(false),
  maxGardeners: z.number().int().nonnegative().default(0),
  weightScheme: greenGoodsWeightSchemeSchema.default('linear'),
  domains: z.array(greenGoodsDomainSchema).default([]),
  gapAdminAddresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).default([]),
  domainMask: z.number().int().min(0).max(15).default(0),
  statusNote: z.string().default(''),
  lastError: z.string().optional(),
  lastTxHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/)
    .optional(),
  lastUserOperationHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/)
    .optional(),
});

// ---------------------------------------------------------------------------
// ERC-8004 Agent Identity & Reputation
// ---------------------------------------------------------------------------

export const erc8004AgentStateSchema = z.object({
  enabled: z.boolean().default(false),
  agentId: z.number().int().positive().optional(),
  agentURI: z.string().optional(),
  agentURICid: z.string().optional(),
  registrationTxHash: z.string().regex(/^0x/).optional(),
  registeredAt: z.string().datetime().optional(),
  reputationScore: z.number().optional(),
  lastFeedbackAt: z.string().datetime().optional(),
  feedbackCount: z.number().int().nonnegative().default(0),
  status: z.enum(['disabled', 'pending', 'registered', 'error']),
  statusNote: z.string().optional(),
});

export const erc8004RegistrationOutputSchema = z.object({
  agentURI: z.string(),
  metadata: z.array(z.object({ key: z.string(), value: z.string() })),
  rationale: z.string(),
});

export const erc8004FeedbackOutputSchema = z.object({
  targetAgentId: z.number().int().positive(),
  value: z.number().int().min(-128).max(127),
  tag1: z.string(),
  tag2: z.string(),
  rationale: z.string(),
});

export const inviteCoopBootstrapSnapshotSchema = z.object({
  profile: coopProfileSchema,
  setupInsights: setupInsightsSchema,
  soul: coopSoulSchema,
  rituals: z.array(ritualDefinitionSchema).min(1),
  members: z.array(memberSchema).min(1),
  artifacts: z.array(artifactSchema).default([]),
  reviewBoard: z.array(reviewBoardGroupSchema).default([]),
  archiveReceipts: z.array(archiveReceiptSchema).default([]),
  memoryProfile: coopMemoryProfileSchema,
  syncRoom: syncRoomBootstrapSchema,
  onchainState: onchainStateSchema,
  greenGoods: greenGoodsGardenStateSchema.optional(),
});

export const coopBootstrapSnapshotSchema = z.object({
  profile: coopProfileSchema,
  setupInsights: setupInsightsSchema,
  soul: coopSoulSchema,
  rituals: z.array(ritualDefinitionSchema).min(1),
  members: z.array(memberSchema).min(1),
  artifacts: z.array(artifactSchema).default([]),
  reviewBoard: z.array(reviewBoardGroupSchema).default([]),
  archiveReceipts: z.array(archiveReceiptSchema).default([]),
  memoryProfile: coopMemoryProfileSchema,
  syncRoom: syncRoomConfigSchema,
  onchainState: onchainStateSchema,
  greenGoods: greenGoodsGardenStateSchema.optional(),
});

export const soundPreferencesSchema = z.object({
  enabled: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  reducedSound: z.boolean().default(false),
});

export const hapticEventSchema = z.enum([
  'pairing-confirmed',
  'capture-saved',
  'sync-completed',
  'button-press',
  'error',
]);

export const hapticPreferencesSchema = z.object({
  enabled: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
});

export const preferredExportMethodSchema = z.enum(['download', 'file-picker']);

export const uiPreferencesSchema = z.object({
  notificationsEnabled: z.boolean().default(true),
  localInferenceOptIn: z.boolean().default(false),
  preferredExportMethod: preferredExportMethodSchema.default('download'),
});

export const coopSharedStateSchema = z.object({
  profile: coopProfileSchema,
  setupInsights: setupInsightsSchema,
  soul: coopSoulSchema,
  rituals: z.array(ritualDefinitionSchema).min(1),
  members: z.array(memberSchema).min(1),
  invites: z.array(inviteCodeSchema).default([]),
  artifacts: z.array(artifactSchema).default([]),
  reviewBoard: z.array(reviewBoardGroupSchema).default([]),
  archiveReceipts: z.array(archiveReceiptSchema).default([]),
  memoryProfile: coopMemoryProfileSchema,
  syncRoom: syncRoomConfigSchema,
  onchainState: onchainStateSchema,
  greenGoods: greenGoodsGardenStateSchema.optional(),
  agentIdentity: erc8004AgentStateSchema.optional(),
  archiveConfig: coopArchiveConfigSchema.optional(),
  memberCommitments: z.array(z.string()).default([]),
});

export const localEnhancementAvailabilitySchema = z.object({
  status: capabilityStateSchema,
  reason: z.string(),
  model: z.string().optional(),
});

export const localInferenceStatusSchema = z.enum([
  'disabled',
  'unavailable',
  'loading',
  'ready',
  'running',
  'failed',
]);

export const localInferenceCapabilitySchema = z.object({
  status: localInferenceStatusSchema,
  reason: z.string(),
  model: z.string().optional(),
  hasWebGpu: z.boolean().default(false),
  hasWorker: z.boolean().default(false),
  userOptIn: z.boolean().default(false),
});

export const refineTaskSchema = z.enum([
  'title-refinement',
  'summary-compression',
  'tag-suggestion',
]);

export const refineRequestSchema = z.object({
  draftId: z.string().min(1),
  task: refineTaskSchema,
  title: z.string().min(1),
  summary: z.string(),
  tags: z.array(z.string()).default([]),
  category: artifactCategorySchema,
  coopName: z.string().min(1),
  coopPurpose: z.string().min(1),
});

export const refineResultSchema = z.object({
  draftId: z.string().min(1),
  task: refineTaskSchema,
  refinedTitle: z.string().optional(),
  refinedSummary: z.string().optional(),
  suggestedTags: z.array(z.string()).optional(),
  provider: z.enum(['heuristic', 'local-model']),
  model: z.string().optional(),
  durationMs: z.number().int().nonnegative(),
});

export type ArchiveBundle = z.infer<typeof archiveBundleSchema>;
export type ArchiveDelegationMaterial = z.infer<typeof archiveDelegationMaterialSchema>;
export type ArchiveDelegationOperation = z.infer<typeof archiveDelegationOperationSchema>;
export type ArchiveDelegationRequestInput = z.input<typeof archiveDelegationRequestSchema>;
export type ArchiveDelegationRequest = z.infer<typeof archiveDelegationRequestSchema>;
export type ArchiveReceipt = z.infer<typeof archiveReceiptSchema>;
export type ArchiveScope = z.infer<typeof archiveScopeSchema>;
export type ArchiveStatus = z.infer<typeof archiveStatusSchema>;
export type ArchiveWorthiness = z.infer<typeof archiveWorthinessSchema>;
export type AnchorCapability = z.infer<typeof anchorCapabilitySchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type ArtifactCategory = z.infer<typeof artifactCategorySchema>;
export type ArtifactOrigin = z.infer<typeof artifactOriginSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthMode = z.infer<typeof authModeSchema>;
export type CapabilityState = z.infer<typeof capabilityStateSchema>;
export type CaptureMode = z.infer<typeof captureModeSchema>;
export type CoopChainKey = z.infer<typeof coopChainKeySchema>;
export type CoopBootstrapSnapshot = z.infer<typeof coopBootstrapSnapshotSchema>;
export type CoopInterpretation = z.infer<typeof coopInterpretationSchema>;
export type CoopMemoryProfile = z.infer<typeof coopMemoryProfileSchema>;
export type CoopProfile = z.infer<typeof coopProfileSchema>;
export type CoopSpaceType = z.infer<typeof coopSpaceTypeSchema>;
export type CoopArchiveConfig = z.infer<typeof coopArchiveConfigSchema>;
export type CoopArchiveSecrets = z.infer<typeof coopArchiveSecretsSchema>;
export type CoopSharedState = z.infer<typeof coopSharedStateSchema>;
export type CoopSoul = z.infer<typeof coopSoulSchema>;
export type ExtensionIconState = z.infer<typeof extensionIconStateSchema>;
export type GreenGoodsDomain = z.infer<typeof greenGoodsDomainSchema>;
export type GreenGoodsGardenBootstrapOutput = z.infer<typeof greenGoodsGardenBootstrapOutputSchema>;
export type GreenGoodsGardenState = z.infer<typeof greenGoodsGardenStateSchema>;
export type GreenGoodsGardenStatus = z.infer<typeof greenGoodsGardenStatusSchema>;
export type GreenGoodsGardenSyncOutput = z.infer<typeof greenGoodsGardenSyncOutputSchema>;
export type GreenGoodsWorkApprovalRequest = z.infer<typeof greenGoodsWorkApprovalRequestSchema>;
export type GreenGoodsAssessmentRequest = z.infer<typeof greenGoodsAssessmentRequestSchema>;
export type GreenGoodsWorkApprovalOutput = z.infer<typeof greenGoodsWorkApprovalOutputSchema>;
export type GreenGoodsAssessmentOutput = z.infer<typeof greenGoodsAssessmentOutputSchema>;
export type GreenGoodsGapAdminSyncOutput = z.infer<typeof greenGoodsGapAdminSyncOutputSchema>;
export type GreenGoodsWeightScheme = z.infer<typeof greenGoodsWeightSchemeSchema>;
export type Erc8004AgentState = z.infer<typeof erc8004AgentStateSchema>;
export type Erc8004RegistrationOutput = z.infer<typeof erc8004RegistrationOutputSchema>;
export type Erc8004FeedbackOutput = z.infer<typeof erc8004FeedbackOutputSchema>;
export type InviteBootstrap = z.infer<typeof inviteBootstrapSchema>;
export type InviteCoopBootstrapSnapshot = z.infer<typeof inviteCoopBootstrapSnapshotSchema>;
export type InviteCode = z.infer<typeof inviteCodeSchema>;
export type InviteType = z.infer<typeof inviteTypeSchema>;
export type IntegrationMode = z.infer<typeof integrationModeSchema>;
export type SessionMode = z.infer<typeof sessionModeSchema>;
export type LocalEnhancementAvailability = z.infer<typeof localEnhancementAvailabilitySchema>;
export type LocalInferenceStatus = z.infer<typeof localInferenceStatusSchema>;
export type LocalInferenceCapability = z.infer<typeof localInferenceCapabilitySchema>;
export type LocalPasskeyIdentity = z.infer<typeof localPasskeyIdentitySchema>;
export type Member = z.infer<typeof memberSchema>;
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type OnchainState = z.infer<typeof onchainStateSchema>;
export type PasskeyCredential = z.infer<typeof passkeyCredentialSchema>;
export type PrivilegedActionContext = z.infer<typeof privilegedActionContextSchema>;
export type PrivilegedActionLogEntry = z.infer<typeof privilegedActionLogEntrySchema>;
export type PrivilegedActionStatus = z.infer<typeof privilegedActionStatusSchema>;
export type PrivilegedActionType = z.infer<typeof privilegedActionTypeSchema>;
export type ReadablePageExtract = z.infer<typeof readablePageExtractSchema>;
export type ReceiverCapture = z.infer<typeof receiverCaptureSchema>;
export type ReceiverCaptureKind = z.infer<typeof receiverCaptureKindSchema>;
export type ReceiverIntakeStatus = z.infer<typeof receiverIntakeStatusSchema>;
export type ReceiverCaptureSyncState = z.infer<typeof receiverCaptureSyncStateSchema>;
export type ReceiverDeviceIdentity = z.infer<typeof receiverDeviceIdentitySchema>;
export type ReceiverPairingPayload = z.infer<typeof receiverPairingPayloadSchema>;
export type ReceiverPairingRecord = z.infer<typeof receiverPairingRecordSchema>;
export type ReceiverSyncAsset = z.infer<typeof receiverSyncAssetSchema>;
export type ReceiverSyncAuth = z.infer<typeof receiverSyncAuthSchema>;
export type ReceiverSyncEnvelope = z.infer<typeof receiverSyncEnvelopeSchema>;
export type ReviewBoardGroup = z.infer<typeof reviewBoardGroupSchema>;
export type ReviewDraft = z.infer<typeof reviewDraftSchema>;
export type ReviewDraftProvenance = z.infer<typeof reviewDraftProvenanceSchema>;
export type ReviewDraftWorkflowStage = z.infer<typeof reviewDraftWorkflowStageSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type RitualDefinition = z.infer<typeof ritualDefinitionSchema>;
export type RitualLens = z.infer<typeof ritualLensSchema>;
export type SetupInsights = z.infer<typeof setupInsightsSchema>;
export type SoundEvent = z.infer<typeof soundEventSchema>;
export type SoundPreferences = z.infer<typeof soundPreferencesSchema>;
export type HapticEvent = z.infer<typeof hapticEventSchema>;
export type HapticPreferences = z.infer<typeof hapticPreferencesSchema>;
export type PreferredExportMethod = z.infer<typeof preferredExportMethodSchema>;
export type UiPreferences = z.infer<typeof uiPreferencesSchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type SyncRoomBootstrap = z.infer<typeof syncRoomBootstrapSchema>;
export type SyncRoomConfig = z.infer<typeof syncRoomConfigSchema>;
export type RefineTask = z.infer<typeof refineTaskSchema>;
export type RefineRequest = z.infer<typeof refineRequestSchema>;
export type RefineResult = z.infer<typeof refineResultSchema>;
export type TrustedNodeArchiveConfig = z.infer<typeof trustedNodeArchiveConfigSchema>;
export type TabCandidate = z.infer<typeof tabCandidateSchema>;
export type PolicyActionClass = z.infer<typeof policyActionClassSchema>;
export type ActionPolicy = z.infer<typeof actionPolicySchema>;
export type ActionBundleStatus = z.infer<typeof actionBundleStatusSchema>;
export type TypedActionBundle = z.infer<typeof typedActionBundleSchema>;
export type ActionBundle = z.infer<typeof actionBundleSchema>;
export type ActionLogEventType = z.infer<typeof actionLogEventTypeSchema>;
export type ActionLogEntry = z.infer<typeof actionLogEntrySchema>;
export type DelegatedActionClass = z.infer<typeof delegatedActionClassSchema>;
export type GrantStatus = z.infer<typeof grantStatusSchema>;
export type GrantLogEventType = z.infer<typeof grantLogEventTypeSchema>;
export type ExecutionGrant = z.infer<typeof executionGrantSchema>;
export type GrantLogEntry = z.infer<typeof grantLogEntrySchema>;
export type SessionCapableActionClass = z.infer<typeof sessionCapableActionClassSchema>;
export type SessionCapabilityStatus = z.infer<typeof sessionCapabilityStatusSchema>;
export type SessionCapabilityFailureReason = z.infer<typeof sessionCapabilityFailureReasonSchema>;
export type SessionCapabilityScope = z.infer<typeof sessionCapabilityScopeSchema>;
export type SessionCapability = z.infer<typeof sessionCapabilitySchema>;
export type SessionCapabilityLogEventType = z.infer<typeof sessionCapabilityLogEventTypeSchema>;
export type SessionCapabilityLogEntry = z.infer<typeof sessionCapabilityLogEntrySchema>;
export type EncryptedSessionMaterial = z.infer<typeof encryptedSessionMaterialSchema>;
export type AgentObservationTrigger = z.infer<typeof agentObservationTriggerSchema>;
export type AgentObservationStatus = z.infer<typeof agentObservationStatusSchema>;
export type AgentObservation = z.infer<typeof agentObservationSchema>;
export type AgentPlanStatus = z.infer<typeof agentPlanStatusSchema>;
export type AgentPlanStepStatus = z.infer<typeof agentPlanStepStatusSchema>;
export type AgentProvider = z.infer<typeof agentProviderSchema>;
export type SkillRuntime = z.infer<typeof skillRuntimeSchema>;
export type SkillModel = z.infer<typeof skillModelSchema>;
export type SkillApprovalMode = z.infer<typeof skillApprovalModeSchema>;
export type SkillTool = z.infer<typeof skillToolSchema>;
export type SkillRunStatus = z.infer<typeof skillRunStatusSchema>;
export type SkillOutputSchemaRef = z.infer<typeof skillOutputSchemaRefSchema>;
export type ActionProposal = z.infer<typeof actionProposalSchema>;
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

// ---------------------------------------------------------------------------
// Privacy / Semaphore v4 + Bandada
// ---------------------------------------------------------------------------

export const privacyIdentitySchema = z.object({
  commitment: z.string().min(1),
  publicKey: z.tuple([z.string().min(1), z.string().min(1)]),
  exportedPrivateKey: z.string().min(1),
});

export const privacyGroupSchema = z.object({
  id: z.string().min(1),
  memberCount: z.number().int().nonnegative(),
  merkleRoot: z.string().min(1),
});

export type PrivacyIdentity = z.infer<typeof privacyIdentitySchema>;
export type PrivacyGroup = z.infer<typeof privacyGroupSchema>;

// ── Stealth Address (ERC-5564 / ERC-6538) ──────────────────────────
export const stealthSchemeIdSchema = z.literal(1);

export const stealthKeysSchema = z.object({
  spendingKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'spending key must be a 32-byte hex string'),
  viewingKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'viewing key must be a 32-byte hex string'),
  spendingPublicKey: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/, 'spending public key must be a hex string'),
  viewingPublicKey: z.string().regex(/^0x[a-fA-F0-9]+$/, 'viewing public key must be a hex string'),
});

export const stealthMetaAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, 'stealth meta-address must be a hex string')
  .refine(
    (v) => v.length >= 134,
    'stealth meta-address must encode both spending and viewing public keys',
  );

export const stealthAddressSchema = z.object({
  stealthAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ephemeralPublicKey: z.string().regex(/^0x[a-fA-F0-9]+$/),
  viewTag: z.string().regex(/^0x[a-fA-F0-9]+$/),
});

export const stealthAnnouncementSchema = z.object({
  schemeId: stealthSchemeIdSchema,
  stealthAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ephemeralPublicKey: z.string().regex(/^0x[a-fA-F0-9]+$/),
  metadata: z.string().regex(/^0x[a-fA-F0-9]*$/),
});

export type StealthSchemeId = z.infer<typeof stealthSchemeIdSchema>;
export type StealthKeys = z.infer<typeof stealthKeysSchema>;
export type StealthMetaAddress = z.infer<typeof stealthMetaAddressSchema>;
export type StealthAddress = z.infer<typeof stealthAddressSchema>;
export type StealthAnnouncement = z.infer<typeof stealthAnnouncementSchema>;

// ── Privacy Identity / Stealth Key Pair Records (Dexie storage) ────
export const privacyIdentityRecordSchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  memberId: z.string().min(1),
  commitment: z.string().min(1),
  publicKey: z.tuple([z.string().min(1), z.string().min(1)]),
  exportedPrivateKey: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type PrivacyIdentityRecord = z.infer<typeof privacyIdentityRecordSchema>;

export const stealthKeyPairRecordSchema = z.object({
  id: z.string().min(1),
  coopId: z.string().min(1),
  spendingKey: z.string().min(1),
  viewingKey: z.string().min(1),
  spendingPublicKey: z.string().min(1),
  viewingPublicKey: z.string().min(1),
  metaAddress: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type StealthKeyPairRecord = z.infer<typeof stealthKeyPairRecordSchema>;
