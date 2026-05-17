import type {
  AgentObservation,
  AgentPlan,
  AgentProvider,
  CoopSharedState,
  EntityExtractionOutput,
  GrantFitScore,
  KnowledgeSourceContent,
  OpportunityCandidate,
  PublishReadinessCheckOutput,
  ReadablePageExtract,
  ReasoningTrace,
  ReviewDraft,
  SkillManifest,
  SkillRun,
  TabRouterOutput,
  TabRouting,
} from '@coop/shared';
import { updateAgentPlan } from '@coop/shared';
import type { PersistedEntityExtractionResult } from './graph-persistence';

export type SkillOutputHandlerExecutionContext = {
  coop?: CoopSharedState;
  draft?: ReviewDraft | null;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
  createdDraftIds: string[];
  relatedDrafts: ReviewDraft[];
  relatedRoutings: TabRouting[];
  sourceContents?: KnowledgeSourceContent[];
  precedents?: ReasoningTrace[];
  precedentConfidenceAdjustment?: number;
  graphContext?: string;
};

export type PersistedTabRouterResult = {
  createdDraftIds: string[];
};

export type SkillOutputHandlerInput = {
  output: unknown;
  manifest: SkillManifest;
  skillId: string;
  provider: AgentProvider;
  durationMs: number;
  observation: AgentObservation;
  plan: AgentPlan;
  run: SkillRun;
  context: SkillOutputHandlerExecutionContext;
  extracts: ReadablePageExtract[];
  autoRunEnabled: boolean;
  getCoops(): Promise<CoopSharedState[]>;
  saveReviewDraft(draft: ReviewDraft): Promise<void>;
  savePlan(plan: AgentPlan): Promise<void>;
  persistTabRouterOutput(input: {
    observation: AgentObservation;
    coops: CoopSharedState[];
    extracts: ReadablePageExtract[];
    output: TabRouterOutput;
    provider: AgentProvider;
  }): Promise<PersistedTabRouterResult>;
  persistEntityExtractionOutput(input: {
    observation: AgentObservation;
    coopId: string;
    output: EntityExtractionOutput;
    provider: AgentProvider;
  }): Promise<PersistedEntityExtractionResult>;
  maybePatchDraft(
    draft: ReviewDraft | null | undefined,
    output: PublishReadinessCheckOutput,
  ): Promise<ReviewDraft | null>;
  dispatchActionProposal(input: {
    plan: AgentPlan;
    proposal: AgentPlan['actionProposals'][number];
    autoExecute: boolean;
  }): Promise<{ ok: boolean; executed?: boolean; error?: string }>;
};

export type SkillOutputHandlerResult = {
  plan: AgentPlan;
  context: SkillOutputHandlerExecutionContext;
  output: unknown;
  createdDraftIds: string[];
  autoExecutedActionCount: number;
  errors: string[];
  contextEntityIds?: string[];
};

export type SkillOutputHandler = (
  input: SkillOutputHandlerInput,
) => Promise<SkillOutputHandlerResult>;

export function pushCreatedDraft(input: {
  context: SkillOutputHandlerExecutionContext;
  draftId: string;
  createdDraftIds: string[];
}) {
  input.context.createdDraftIds.push(input.draftId);
  input.createdDraftIds.push(input.draftId);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function applyContextProvenanceToDraft(
  draft: ReviewDraft,
  context: SkillOutputHandlerExecutionContext,
): ReviewDraft {
  const sourceRefs = uniqueStrings([
    ...(draft.sourceRefs ?? []),
    ...(context.sourceContents ?? []).map((content) => content.sourceRef),
  ]);
  const precedentTraceIds = uniqueStrings([
    ...(draft.precedentTraceIds ?? []),
    ...(context.precedents ?? []).map((trace) => trace.traceId),
  ]);
  const contextLabels = uniqueStrings([
    ...(draft.contextLabels ?? []),
    ...(context.sourceContents ?? []).map(() => 'observed/unconfirmed'),
    ...(context.graphContext ? ['graph-context'] : []),
  ]);

  return {
    ...draft,
    sourceRefs,
    precedentTraceIds,
    contextLabels,
    confidenceAdjustment: context.precedentConfidenceAdjustment ?? draft.confidenceAdjustment ?? 0,
  };
}

export function resolveSynthesisDraftContext(context: SkillOutputHandlerExecutionContext) {
  const routedTargetCoopIds = [
    ...new Set(
      context.relatedRoutings
        .map((routing) => routing.coopId)
        .concat(context.coop ? [context.coop.profile.id] : []),
    ),
  ];
  const routedDraftId = context.relatedRoutings.find(
    (routing) => typeof routing.draftId === 'string',
  )?.draftId;
  const existingDraft =
    context.draft ??
    context.relatedDrafts.find((draft) => draft.id === routedDraftId) ??
    context.relatedDrafts.find(
      (draft) =>
        context.relatedRoutings.some((routing) => routing.extractId === draft.extractId) &&
        draft.provenance.type === 'tab',
    ) ??
    null;

  return {
    existingDraft,
    targetCoopIds:
      routedTargetCoopIds.length > 0
        ? routedTargetCoopIds
        : context.coop
          ? [context.coop.profile.id]
          : [],
  };
}

export function patchSynthesisDraft(input: {
  draft: ReviewDraft;
  generated: ReviewDraft;
  targetCoopIds: string[];
}) {
  return {
    ...input.draft,
    title: input.generated.title,
    summary: input.generated.summary,
    whyItMatters: input.generated.whyItMatters,
    suggestedNextStep: input.generated.suggestedNextStep,
    tags: [...new Set([...input.draft.tags, ...input.generated.tags])],
    category: input.generated.category,
    confidence: Math.max(input.draft.confidence, input.generated.confidence),
    suggestedTargetCoopIds: [
      ...new Set([...input.draft.suggestedTargetCoopIds, ...input.targetCoopIds]),
    ],
    sourceRefs: uniqueStrings([
      ...(input.draft.sourceRefs ?? []),
      ...(input.generated.sourceRefs ?? []),
    ]),
    precedentTraceIds: uniqueStrings([
      ...(input.draft.precedentTraceIds ?? []),
      ...(input.generated.precedentTraceIds ?? []),
    ]),
    contextLabels: uniqueStrings([
      ...(input.draft.contextLabels ?? []),
      ...(input.generated.contextLabels ?? []),
    ]),
    confidenceAdjustment:
      input.generated.confidenceAdjustment || input.draft.confidenceAdjustment || 0,
  } satisfies ReviewDraft;
}

export function resolveGreenGoodsOperatorAddresses(coop: CoopSharedState) {
  return coop.members
    .filter((member) => member.role === 'creator' || member.role === 'trusted')
    .map((member) => member.address);
}

export function resolveGreenGoodsGardenerAddresses(coop: CoopSharedState) {
  return coop.members.map((member) => member.address);
}

export function resolveGreenGoodsGapAdminAddresses(coop: CoopSharedState) {
  return coop.greenGoods?.gapAdminAddresses ?? [];
}

export function validateActionClass(
  manifest: SkillManifest,
  actionClass: AgentPlan['actionProposals'][number]['actionClass'],
) {
  if (
    manifest.allowedActionClasses.length > 0 &&
    !manifest.allowedActionClasses.includes(actionClass)
  ) {
    return `Skill "${manifest.id}" is not allowed to propose action "${actionClass}".`;
  }
  return null;
}

export async function queueActionProposals(input: {
  manifest: SkillManifest;
  plan: AgentPlan;
  proposals: AgentPlan['actionProposals'];
  autoRunEnabled: boolean;
  savePlan(plan: AgentPlan): Promise<void>;
  dispatchActionProposal(input: {
    plan: AgentPlan;
    proposal: AgentPlan['actionProposals'][number];
    autoExecute: boolean;
  }): Promise<{ ok: boolean; executed?: boolean; error?: string }>;
}) {
  const errors = input.proposals
    .map((proposal) => validateActionClass(input.manifest, proposal.actionClass))
    .filter((error): error is string => Boolean(error));

  const allowedProposals = input.proposals.filter(
    (proposal) => !validateActionClass(input.manifest, proposal.actionClass),
  );
  if (allowedProposals.length === 0) {
    return {
      plan: input.plan,
      autoExecutedActionCount: 0,
      errors,
    };
  }

  const nextPlan = updateAgentPlan(input.plan, {
    actionProposals: [...input.plan.actionProposals, ...allowedProposals],
    requiresApproval: true,
  });
  await input.savePlan(nextPlan);

  let autoExecutedActionCount = 0;
  for (const proposal of allowedProposals) {
    if (!input.autoRunEnabled || input.manifest.approvalMode !== 'auto-run-eligible') {
      continue;
    }
    const dispatched = await input.dispatchActionProposal({
      plan: nextPlan,
      proposal,
      autoExecute: true,
    });
    if (dispatched.ok && dispatched.executed) {
      autoExecutedActionCount += 1;
    } else if (!dispatched.ok) {
      errors.push(dispatched.error ?? `Could not auto-run ${proposal.actionClass}.`);
    }
  }

  return {
    plan: nextPlan,
    autoExecutedActionCount,
    errors,
  };
}
