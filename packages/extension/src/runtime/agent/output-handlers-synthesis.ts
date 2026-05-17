import type {
  MemoryInsightOutput,
  PublishReadinessCheckOutput,
  ReviewDigestOutput,
  ReviewDraft,
  SkillOutputSchemaRef,
} from '@coop/shared';
import {
  createActionProposal,
  createMemoryInsightDraft,
  createReviewDigestDraft,
} from '@coop/shared';
import { configuredOnchainMode } from '../config';
import type { SkillOutputHandler } from './output-handlers-helpers';
import {
  applyContextProvenanceToDraft,
  patchSynthesisDraft,
  pushCreatedDraft,
  queueActionProposals,
  resolveSynthesisDraftContext,
} from './output-handlers-helpers';

export const handleMemoryInsightOutput: SkillOutputHandler = async (input) => {
  if (!input.context.coop) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  }

  const createdDraftIds: string[] = [];
  const insights = (input.output as MemoryInsightOutput).insights;
  const synthesisContext = resolveSynthesisDraftContext(input.context);
  for (const [index, insight] of insights.entries()) {
    const generatedDraft = applyContextProvenanceToDraft(
      createMemoryInsightDraft({
        observationId: input.observation.id,
        planId: input.plan.id,
        skillRunId: input.run.id,
        skillId: input.skillId,
        coopId: input.context.coop.profile.id,
        output: insight,
      }),
      input.context,
    );
    if (index === 0 && synthesisContext.existingDraft) {
      const patchedDraft = applyContextProvenanceToDraft(
        patchSynthesisDraft({
          draft: synthesisContext.existingDraft,
          generated: generatedDraft,
          targetCoopIds: synthesisContext.targetCoopIds,
        }),
        input.context,
      );
      await input.saveReviewDraft(patchedDraft);
      input.context.draft = patchedDraft;
      continue;
    }

    const nextDraft = {
      ...generatedDraft,
      suggestedTargetCoopIds:
        synthesisContext.targetCoopIds.length > 0
          ? synthesisContext.targetCoopIds
          : generatedDraft.suggestedTargetCoopIds,
    } satisfies ReviewDraft;
    await input.saveReviewDraft(nextDraft);
    pushCreatedDraft({
      context: input.context,
      draftId: nextDraft.id,
      createdDraftIds,
    });
  }

  return {
    plan: input.plan,
    context: input.context,
    output: input.output,
    createdDraftIds,
    autoExecutedActionCount: 0,
    errors: [],
  };
};

export const handleReviewDigestOutput: SkillOutputHandler = async (input) => {
  if (!input.context.coop) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  }

  const generatedDraft = applyContextProvenanceToDraft(
    createReviewDigestDraft({
      observationId: input.observation.id,
      planId: input.plan.id,
      skillRunId: input.run.id,
      skillId: input.skillId,
      coopId: input.context.coop.profile.id,
      output: input.output as ReviewDigestOutput,
    }),
    input.context,
  );
  const synthesisContext = resolveSynthesisDraftContext(input.context);
  let createdDraftIds: string[] = [];

  if (synthesisContext.existingDraft) {
    const patchedDraft = applyContextProvenanceToDraft(
      patchSynthesisDraft({
        draft: synthesisContext.existingDraft,
        generated: generatedDraft,
        targetCoopIds: synthesisContext.targetCoopIds,
      }),
      input.context,
    );
    await input.saveReviewDraft(patchedDraft);
    input.context.draft = patchedDraft;
  } else {
    const nextDraft = {
      ...generatedDraft,
      suggestedTargetCoopIds:
        synthesisContext.targetCoopIds.length > 0
          ? synthesisContext.targetCoopIds
          : generatedDraft.suggestedTargetCoopIds,
    } satisfies ReviewDraft;
    await input.saveReviewDraft(nextDraft);

    createdDraftIds = [];
    pushCreatedDraft({
      context: input.context,
      draftId: nextDraft.id,
      createdDraftIds,
    });
  }

  return {
    plan: input.plan,
    context: input.context,
    output: input.output,
    createdDraftIds,
    autoExecutedActionCount: 0,
    errors: [],
  };
};

export const handlePublishReadinessCheckOutput: SkillOutputHandler = async (input) => {
  if (!input.context.coop || !input.context.draft) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  }

  const readiness = input.output as PublishReadinessCheckOutput;
  input.context.draft = await input.maybePatchDraft(input.context.draft, readiness);

  if (!readiness.ready || !input.context.draft) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  }

  const queued = await queueActionProposals({
    manifest: input.manifest,
    plan: input.plan,
    proposals: [
      createActionProposal({
        actionClass: 'publish-ready-draft',
        coopId: input.context.coop.profile.id,
        payload: {
          draftId: readiness.draftId || input.context.draft.id,
          targetCoopIds: input.context.draft.suggestedTargetCoopIds,
        },
        reason: 'Publish readiness check marked the draft as ready.',
        approvalMode: input.manifest.approvalMode,
        onchainMode: configuredOnchainMode,
        generatedBySkillId: input.skillId,
      }),
    ],
    autoRunEnabled: input.autoRunEnabled,
    savePlan: input.savePlan,
    dispatchActionProposal: input.dispatchActionProposal,
  });

  return {
    plan: queued.plan,
    context: input.context,
    output: input.output,
    createdDraftIds: [],
    autoExecutedActionCount: queued.autoExecutedActionCount,
    errors: queued.errors,
  };
};

export const synthesisHandlers: Partial<Record<SkillOutputSchemaRef, SkillOutputHandler>> = {
  'memory-insight-output': handleMemoryInsightOutput,
  'review-digest-output': handleReviewDigestOutput,
  'publish-readiness-check-output': handlePublishReadinessCheckOutput,
};
