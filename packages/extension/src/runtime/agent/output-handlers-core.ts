import type {
  CapitalFormationBriefOutput,
  EntityExtractionOutput,
  GrantFitScorerOutput,
  OpportunityExtractorOutput,
  SkillOutputSchemaRef,
  TabRouterOutput,
} from '@coop/shared';
import { createCapitalFormationDraft } from '@coop/shared';
import type { SkillOutputHandler } from './output-handlers-helpers';
import { applyContextProvenanceToDraft, pushCreatedDraft } from './output-handlers-helpers';

export const handleOpportunityExtractorOutput: SkillOutputHandler = async (input) => {
  input.context.candidates = (input.output as OpportunityExtractorOutput).candidates.map(
    (candidate) => ({
      ...candidate,
      sourceDraftId: candidate.sourceDraftId ?? input.context.draft?.id,
      sourceExtractId: candidate.sourceExtractId ?? input.observation.extractId,
    }),
  );

  return {
    plan: input.plan,
    context: input.context,
    output: { candidates: input.context.candidates } satisfies OpportunityExtractorOutput,
    createdDraftIds: [],
    autoExecutedActionCount: 0,
    errors: [],
  };
};

export const handleGrantFitScorerOutput: SkillOutputHandler = async (input) => {
  input.context.scores = (input.output as GrantFitScorerOutput).scores;
  return {
    plan: input.plan,
    context: input.context,
    output: input.output,
    createdDraftIds: [],
    autoExecutedActionCount: 0,
    errors: [],
  };
};

export const handleTabRouterOutput: SkillOutputHandler = async (input) => {
  const persisted = await input.persistTabRouterOutput({
    observation: input.observation,
    coops: input.context.coop ? [input.context.coop] : await input.getCoops(),
    extracts: input.extracts,
    output: input.output as TabRouterOutput,
    provider: input.provider,
  });
  input.context.createdDraftIds.push(...persisted.createdDraftIds);
  return {
    plan: input.plan,
    context: input.context,
    output: input.output,
    createdDraftIds: persisted.createdDraftIds,
    autoExecutedActionCount: 0,
    errors: [],
  };
};

export const handleEntityExtractionOutput: SkillOutputHandler = async (input) => {
  const coopId = input.context.coop?.profile.id ?? input.observation.coopId;
  if (!coopId) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
      contextEntityIds: [],
    };
  }

  const persisted = await input.persistEntityExtractionOutput({
    observation: input.observation,
    coopId,
    output: input.output as EntityExtractionOutput,
    provider: input.provider,
  });

  return {
    plan: input.plan,
    context: input.context,
    output: input.output,
    createdDraftIds: [],
    autoExecutedActionCount: 0,
    errors: [],
    contextEntityIds: persisted.entityIds,
  };
};

export const handleCapitalFormationBriefOutput: SkillOutputHandler = async (input) => {
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

  const draft = applyContextProvenanceToDraft(
    createCapitalFormationDraft({
      observationId: input.observation.id,
      planId: input.plan.id,
      skillRunId: input.run.id,
      skillId: input.skillId,
      coopId: input.context.coop.profile.id,
      output: input.output as CapitalFormationBriefOutput,
    }),
    input.context,
  );
  await input.saveReviewDraft(draft);

  const createdDraftIds: string[] = [];
  pushCreatedDraft({
    context: input.context,
    draftId: draft.id,
    createdDraftIds,
  });

  return {
    plan: input.plan,
    context: input.context,
    output: input.output,
    createdDraftIds,
    autoExecutedActionCount: 0,
    errors: [],
  };
};

export const coreHandlers: Partial<Record<SkillOutputSchemaRef, SkillOutputHandler>> = {
  'opportunity-extractor-output': handleOpportunityExtractorOutput,
  'grant-fit-scorer-output': handleGrantFitScorerOutput,
  'tab-router-output': handleTabRouterOutput,
  'entity-extraction-output': handleEntityExtractionOutput,
  'capital-formation-brief-output': handleCapitalFormationBriefOutput,
};
