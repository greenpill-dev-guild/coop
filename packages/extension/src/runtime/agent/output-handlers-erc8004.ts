import type {
  Erc8004FeedbackOutput,
  Erc8004RegistrationOutput,
  SkillOutputSchemaRef,
} from '@coop/shared';
import { createActionProposal } from '@coop/shared';
import { configuredOnchainMode } from '../config';
import type { SkillOutputHandler } from './output-handlers-helpers';
import { queueActionProposals } from './output-handlers-helpers';

export const handleErc8004RegistrationOutput: SkillOutputHandler = async (input) => {
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

  const registration = input.output as Erc8004RegistrationOutput;
  const queued = await queueActionProposals({
    manifest: input.manifest,
    plan: input.plan,
    proposals: [
      createActionProposal({
        actionClass: 'erc8004-register-agent',
        coopId: input.context.coop.profile.id,
        payload: {
          coopId: input.context.coop.profile.id,
          agentURI: registration.agentURI,
          metadata: registration.metadata,
          rationale: registration.rationale,
        },
        reason: registration.rationale,
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

export const handleErc8004FeedbackOutput: SkillOutputHandler = async (input) => {
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

  const feedback = input.output as Erc8004FeedbackOutput;
  const queued = await queueActionProposals({
    manifest: input.manifest,
    plan: input.plan,
    proposals: [
      createActionProposal({
        actionClass: 'erc8004-give-feedback',
        coopId: input.context.coop.profile.id,
        payload: {
          coopId: input.context.coop.profile.id,
          targetAgentId: feedback.targetAgentId,
          value: feedback.value,
          tag1: feedback.tag1,
          tag2: feedback.tag2,
          rationale: feedback.rationale,
        },
        reason: feedback.rationale,
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

export const erc8004Handlers: Partial<Record<SkillOutputSchemaRef, SkillOutputHandler>> = {
  'erc8004-registration-output': handleErc8004RegistrationOutput,
  'erc8004-feedback-output': handleErc8004FeedbackOutput,
};
