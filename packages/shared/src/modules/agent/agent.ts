import type {
  ActionProposal,
  AgentObservation,
  AgentObservationTrigger,
  AgentPlan,
  AgentPlanStep,
  AgentProvider,
  ArtifactCategory,
  CapitalFormationBriefOutput,
  OpportunityCandidate,
  PublishReadinessCheckOutput,
  ReviewDigestOutput,
  ReviewDraft,
  SkillManifest,
  SkillOutputSchemaRef,
  SkillRun,
} from '../../contracts/schema';
import {
  actionProposalSchema,
  agentObservationSchema,
  agentPlanSchema,
  agentPlanStepSchema,
  capitalFormationBriefOutputSchema,
  ecosystemEntityExtractorOutputSchema,
  erc8004FeedbackOutputSchema,
  erc8004RegistrationOutputSchema,
  grantFitScorerOutputSchema,
  greenGoodsAssessmentOutputSchema,
  greenGoodsGapAdminSyncOutputSchema,
  greenGoodsGardenBootstrapOutputSchema,
  greenGoodsGardenSyncOutputSchema,
  greenGoodsWorkApprovalOutputSchema,
  opportunityExtractorOutputSchema,
  publishReadinessCheckOutputSchema,
  reviewDigestOutputSchema,
  skillManifestSchema,
  skillRunSchema,
  themeClustererOutputSchema,
} from '../../contracts/schema';
import { createId, hashJson, nowIso, slugify, truncateWords } from '../../utils';

export const skillOutputSchemas: Record<
  SkillOutputSchemaRef,
  { parse: (value: unknown) => unknown }
> = {
  'opportunity-extractor-output': opportunityExtractorOutputSchema,
  'grant-fit-scorer-output': grantFitScorerOutputSchema,
  'capital-formation-brief-output': capitalFormationBriefOutputSchema,
  'review-digest-output': reviewDigestOutputSchema,
  'ecosystem-entity-extractor-output': ecosystemEntityExtractorOutputSchema,
  'theme-clusterer-output': themeClustererOutputSchema,
  'publish-readiness-check-output': publishReadinessCheckOutputSchema,
  'green-goods-garden-bootstrap-output': greenGoodsGardenBootstrapOutputSchema,
  'green-goods-garden-sync-output': greenGoodsGardenSyncOutputSchema,
  'green-goods-work-approval-output': greenGoodsWorkApprovalOutputSchema,
  'green-goods-assessment-output': greenGoodsAssessmentOutputSchema,
  'green-goods-gap-admin-sync-output': greenGoodsGapAdminSyncOutputSchema,
  'erc8004-registration-output': erc8004RegistrationOutputSchema,
  'erc8004-feedback-output': erc8004FeedbackOutputSchema,
};

export function buildAgentObservationFingerprint(input: {
  trigger: AgentObservationTrigger;
  coopId?: string;
  draftId?: string;
  extractId?: string;
  receiptId?: string;
  captureId?: string;
  artifactId?: string;
  payload?: Record<string, unknown>;
}) {
  return hashJson({
    trigger: input.trigger,
    coopId: input.coopId,
    draftId: input.draftId,
    extractId: input.extractId,
    receiptId: input.receiptId,
    captureId: input.captureId,
    artifactId: input.artifactId,
    payload: input.payload ?? {},
  });
}

export function createAgentObservation(input: {
  trigger: AgentObservationTrigger;
  title: string;
  summary: string;
  coopId?: string;
  draftId?: string;
  extractId?: string;
  receiptId?: string;
  captureId?: string;
  artifactId?: string;
  payload?: Record<string, unknown>;
  fingerprint?: string;
  createdAt?: string;
}): AgentObservation {
  const createdAt = input.createdAt ?? nowIso();
  return agentObservationSchema.parse({
    id: createId('agent-observation'),
    trigger: input.trigger,
    status: 'pending',
    title: input.title,
    summary: input.summary,
    coopId: input.coopId,
    draftId: input.draftId,
    extractId: input.extractId,
    receiptId: input.receiptId,
    captureId: input.captureId,
    artifactId: input.artifactId,
    fingerprint:
      input.fingerprint ??
      buildAgentObservationFingerprint({
        trigger: input.trigger,
        coopId: input.coopId,
        draftId: input.draftId,
        extractId: input.extractId,
        receiptId: input.receiptId,
        captureId: input.captureId,
        artifactId: input.artifactId,
        payload: input.payload,
      }),
    payload: input.payload ?? {},
    createdAt,
    updatedAt: createdAt,
  });
}

export function updateAgentObservation(
  observation: AgentObservation,
  patch: Partial<Omit<AgentObservation, 'id' | 'createdAt'>>,
) {
  return agentObservationSchema.parse({
    ...observation,
    ...patch,
    updatedAt: nowIso(),
  });
}

export function createAgentPlanStep(input: {
  skillId: string;
  provider: AgentProvider;
  summary: string;
  startedAt?: string;
}): AgentPlanStep {
  return agentPlanStepSchema.parse({
    id: createId('agent-step'),
    skillId: input.skillId,
    provider: input.provider,
    status: 'pending',
    summary: input.summary,
    startedAt: input.startedAt,
  });
}

export function updateAgentPlanStep(
  step: AgentPlanStep,
  patch: Partial<Omit<AgentPlanStep, 'id' | 'skillId'>>,
) {
  return agentPlanStepSchema.parse({
    ...step,
    ...patch,
  });
}

export function createActionProposal(input: {
  actionClass: ActionProposal['actionClass'];
  coopId: string;
  memberId?: string;
  payload: Record<string, unknown>;
  reason: string;
  approvalMode: ActionProposal['approvalMode'];
  requiresGrant?: boolean;
  grantId?: string;
  generatedBySkillId?: string;
  createdAt?: string;
}): ActionProposal {
  return actionProposalSchema.parse({
    id: createId('agent-proposal'),
    actionClass: input.actionClass,
    coopId: input.coopId,
    memberId: input.memberId,
    payload: input.payload,
    reason: input.reason,
    approvalMode: input.approvalMode,
    requiresGrant: input.requiresGrant ?? false,
    grantId: input.grantId,
    generatedBySkillId: input.generatedBySkillId,
    createdAt: input.createdAt ?? nowIso(),
  });
}

export function createAgentPlan(input: {
  observationId: string;
  provider: AgentProvider;
  confidence: number;
  goal: string;
  rationale: string;
  steps?: AgentPlanStep[];
  actionProposals?: ActionProposal[];
  requiresApproval?: boolean;
  createdAt?: string;
}): AgentPlan {
  const createdAt = input.createdAt ?? nowIso();
  return agentPlanSchema.parse({
    id: createId('agent-plan'),
    observationId: input.observationId,
    status: 'pending',
    provider: input.provider,
    confidence: input.confidence,
    goal: input.goal,
    rationale: input.rationale,
    steps: input.steps ?? [],
    actionProposals: input.actionProposals ?? [],
    requiresApproval: input.requiresApproval ?? (input.actionProposals?.length ?? 0) > 0,
    createdAt,
    updatedAt: createdAt,
  });
}

export function updateAgentPlan(
  plan: AgentPlan,
  patch: Partial<Omit<AgentPlan, 'id' | 'observationId' | 'createdAt'>>,
) {
  return agentPlanSchema.parse({
    ...plan,
    ...patch,
    updatedAt: nowIso(),
  });
}

export function approveAgentPlan(plan: AgentPlan) {
  return updateAgentPlan(plan, {
    status: 'approved',
    approvedAt: nowIso(),
  });
}

export function rejectAgentPlan(plan: AgentPlan, reason?: string) {
  return updateAgentPlan(plan, {
    status: 'rejected',
    rejectedAt: nowIso(),
    failureReason: reason,
  });
}

export function completeAgentPlan(plan: AgentPlan) {
  return updateAgentPlan(plan, {
    status: 'completed',
    completedAt: nowIso(),
  });
}

export function failAgentPlan(plan: AgentPlan, reason: string) {
  return updateAgentPlan(plan, {
    status: 'failed',
    completedAt: nowIso(),
    failureReason: reason,
  });
}

export function createSkillRun(input: {
  observationId: string;
  planId: string;
  skill: Pick<SkillManifest, 'id' | 'version' | 'outputSchemaRef'>;
  provider: AgentProvider;
  promptHash?: string;
  notes?: string;
  startedAt?: string;
}): SkillRun {
  return skillRunSchema.parse({
    id: createId('skill-run'),
    observationId: input.observationId,
    planId: input.planId,
    skillId: input.skill.id,
    skillVersion: input.skill.version,
    provider: input.provider,
    status: 'pending',
    promptHash: input.promptHash,
    startedAt: input.startedAt ?? nowIso(),
    outputSchemaRef: input.skill.outputSchemaRef,
    notes: input.notes,
  });
}

export function completeSkillRun(run: SkillRun, output: unknown, notes?: string) {
  const schema = skillOutputSchemas[run.outputSchemaRef];
  return skillRunSchema.parse({
    ...run,
    status: 'completed',
    finishedAt: nowIso(),
    output: schema.parse(output) as Record<string, unknown>,
    notes: notes ?? run.notes,
  });
}

export function failSkillRun(run: SkillRun, error: string) {
  return skillRunSchema.parse({
    ...run,
    status: 'failed',
    finishedAt: nowIso(),
    error,
  });
}

export function validateSkillManifest(input: unknown): SkillManifest {
  return skillManifestSchema.parse(input);
}

export function validateSkillOutput<T>(schemaRef: SkillOutputSchemaRef, value: unknown) {
  return skillOutputSchemas[schemaRef].parse(value) as T;
}

function buildAgentDraftTitle(prefix: string, title: string) {
  return truncateWords(`${prefix}: ${title}`.trim(), 12);
}

export function createAgentGeneratedDraft(input: {
  observationId: string;
  planId: string;
  skillRunId: string;
  skillId: string;
  coopId: string;
  title: string;
  summary: string;
  whyItMatters: string;
  suggestedNextStep: string;
  tags?: string[];
  category: ArtifactCategory;
  confidence?: number;
  workflowStage?: ReviewDraft['workflowStage'];
  createdAt?: string;
}): ReviewDraft {
  const createdAt = input.createdAt ?? nowIso();
  const baseId = slugify(`${input.skillId}-${input.coopId}-${input.title}`) || 'agent';
  return {
    id: createId('draft'),
    interpretationId: `agent-interpretation-${baseId}`,
    extractId: `agent-extract-${baseId}`,
    sourceCandidateId: `agent-source-${baseId}`,
    title: input.title,
    summary: input.summary,
    sources: [
      {
        label: input.title,
        url: `coop://agent/${input.skillId}/${input.observationId}`,
        domain: 'agent.local',
      },
    ],
    tags: input.tags ?? [],
    category: input.category,
    whyItMatters: input.whyItMatters,
    suggestedNextStep: input.suggestedNextStep,
    suggestedTargetCoopIds: [input.coopId],
    confidence: input.confidence ?? 0.72,
    rationale: `Generated by ${input.skillId} from agent observation ${input.observationId}.`,
    previewImageUrl: undefined,
    status: 'draft',
    workflowStage: input.workflowStage ?? 'candidate',
    provenance: {
      type: 'agent',
      observationId: input.observationId,
      planId: input.planId,
      skillRunId: input.skillRunId,
      skillId: input.skillId,
    },
    createdAt,
  };
}

export function createCapitalFormationDraft(input: {
  observationId: string;
  planId: string;
  skillRunId: string;
  skillId: string;
  coopId: string;
  output: CapitalFormationBriefOutput;
}) {
  return createAgentGeneratedDraft({
    observationId: input.observationId,
    planId: input.planId,
    skillRunId: input.skillRunId,
    skillId: input.skillId,
    coopId: input.coopId,
    title: buildAgentDraftTitle('Capital formation brief', input.output.title),
    summary: input.output.summary,
    whyItMatters: input.output.whyItMatters,
    suggestedNextStep: input.output.suggestedNextStep,
    tags: input.output.tags,
    category: 'funding-lead',
    confidence: 0.82,
  });
}

export function createReviewDigestDraft(input: {
  observationId: string;
  planId: string;
  skillRunId: string;
  skillId: string;
  coopId: string;
  output: ReviewDigestOutput;
}) {
  return createAgentGeneratedDraft({
    observationId: input.observationId,
    planId: input.planId,
    skillRunId: input.skillRunId,
    skillId: input.skillId,
    coopId: input.coopId,
    title: buildAgentDraftTitle('Review digest', input.output.title),
    summary: input.output.summary,
    whyItMatters: input.output.whyItMatters,
    suggestedNextStep: input.output.suggestedNextStep,
    tags: input.output.tags,
    category: 'insight',
    confidence: 0.76,
  });
}

export function summarizeOpportunityCandidates(candidates: OpportunityCandidate[]) {
  return candidates
    .slice(0, 3)
    .map((candidate) => `${candidate.title}: ${candidate.summary}`)
    .join('\n');
}

export function summarizePublishReadiness(output: PublishReadinessCheckOutput) {
  return output.ready
    ? 'Draft is ready to publish.'
    : `Draft needs work: ${output.suggestions.join(' ')}`.trim();
}
