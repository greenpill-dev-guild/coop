import type {
  GreenGoodsAssessmentOutput,
  GreenGoodsGapAdminSyncOutput,
  GreenGoodsGardenBootstrapOutput,
  GreenGoodsGardenSyncOutput,
  GreenGoodsWorkApprovalOutput,
  SkillOutputSchemaRef,
} from '@coop/shared';
import {
  buildGreenGoodsCreateAssessmentPayload,
  buildGreenGoodsCreateGardenPayload,
  buildGreenGoodsCreateGardenPoolsPayload,
  buildGreenGoodsSetGardenDomainsPayload,
  buildGreenGoodsSubmitWorkApprovalPayload,
  buildGreenGoodsSyncGapAdminsPayload,
  buildGreenGoodsSyncGardenProfilePayload,
  createActionProposal,
} from '@coop/shared';
import { configuredOnchainMode } from '../config';
import type { SkillOutputHandler } from './output-handlers-helpers';
import {
  queueActionProposals,
  resolveGreenGoodsGardenerAddresses,
  resolveGreenGoodsOperatorAddresses,
} from './output-handlers-helpers';

export const handleGreenGoodsGardenBootstrapOutput: SkillOutputHandler = async (input) => {
  if (!input.context.coop?.greenGoods || input.context.coop.greenGoods.gardenAddress) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  }

  const bootstrap = input.output as GreenGoodsGardenBootstrapOutput;
  const queued = await queueActionProposals({
    manifest: input.manifest,
    plan: input.plan,
    proposals: [
      createActionProposal({
        actionClass: 'green-goods-create-garden',
        coopId: input.context.coop.profile.id,
        payload: buildGreenGoodsCreateGardenPayload({
          coopId: input.context.coop.profile.id,
          name: bootstrap.name,
          slug: bootstrap.slug,
          description: bootstrap.description,
          location: bootstrap.location,
          bannerImage: bootstrap.bannerImage,
          metadata: bootstrap.metadata,
          openJoining: bootstrap.openJoining,
          maxGardeners: bootstrap.maxGardeners,
          weightScheme: bootstrap.weightScheme,
          domains: bootstrap.domains,
          operatorAddresses: resolveGreenGoodsOperatorAddresses(input.context.coop),
          gardenerAddresses: resolveGreenGoodsGardenerAddresses(input.context.coop),
        }),
        reason: bootstrap.rationale,
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

export const handleGreenGoodsGardenSyncOutput: SkillOutputHandler = async (input) => {
  if (!input.context.coop?.greenGoods?.gardenAddress || !input.context.coop) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  }

  const sync = input.output as GreenGoodsGardenSyncOutput;
  const queued = await queueActionProposals({
    manifest: input.manifest,
    plan: input.plan,
    proposals: [
      createActionProposal({
        actionClass: 'green-goods-sync-garden-profile',
        coopId: input.context.coop.profile.id,
        payload: buildGreenGoodsSyncGardenProfilePayload({
          coopId: input.context.coop.profile.id,
          gardenAddress: input.context.coop.greenGoods.gardenAddress,
          name: sync.name,
          description: sync.description,
          location: sync.location,
          bannerImage: sync.bannerImage,
          metadata: sync.metadata,
          openJoining: sync.openJoining,
          maxGardeners: sync.maxGardeners,
        }),
        reason: sync.rationale,
        approvalMode: input.manifest.approvalMode,
        onchainMode: configuredOnchainMode,
        generatedBySkillId: input.skillId,
      }),
      createActionProposal({
        actionClass: 'green-goods-set-garden-domains',
        coopId: input.context.coop.profile.id,
        payload: buildGreenGoodsSetGardenDomainsPayload({
          coopId: input.context.coop.profile.id,
          gardenAddress: input.context.coop.greenGoods.gardenAddress,
          domains: sync.domains,
        }),
        reason: 'Keep Green Goods garden domains aligned with the coop scope.',
        approvalMode: input.manifest.approvalMode,
        onchainMode: configuredOnchainMode,
        generatedBySkillId: input.skillId,
      }),
      ...(sync.ensurePools
        ? [
            createActionProposal({
              actionClass: 'green-goods-create-garden-pools',
              coopId: input.context.coop.profile.id,
              payload: buildGreenGoodsCreateGardenPoolsPayload({
                coopId: input.context.coop.profile.id,
                gardenAddress: input.context.coop.greenGoods.gardenAddress,
              }),
              reason: 'Ensure Green Goods signal pools exist for this garden.',
              approvalMode: input.manifest.approvalMode,
              onchainMode: configuredOnchainMode,
              generatedBySkillId: input.skillId,
            }),
          ]
        : []),
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

export const handleGreenGoodsWorkApprovalOutput: SkillOutputHandler = async (input) => {
  if (!input.context.coop?.greenGoods?.gardenAddress) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  }

  const approval = input.output as GreenGoodsWorkApprovalOutput;
  const queued = await queueActionProposals({
    manifest: input.manifest,
    plan: input.plan,
    proposals: [
      createActionProposal({
        actionClass: 'green-goods-submit-work-approval',
        coopId: input.context.coop.profile.id,
        payload: buildGreenGoodsSubmitWorkApprovalPayload({
          coopId: input.context.coop.profile.id,
          gardenAddress: input.context.coop.greenGoods.gardenAddress,
          actionUid: approval.actionUid,
          workUid: approval.workUid,
          approved: approval.approved,
          feedback: approval.feedback,
          confidence: approval.confidence,
          verificationMethod: approval.verificationMethod,
          reviewNotesCid: approval.reviewNotesCid,
        }),
        reason: approval.rationale,
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

export const handleGreenGoodsAssessmentOutput: SkillOutputHandler = async (input) => {
  if (!input.context.coop?.greenGoods?.gardenAddress) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  }

  const assessment = input.output as GreenGoodsAssessmentOutput;
  const queued = await queueActionProposals({
    manifest: input.manifest,
    plan: input.plan,
    proposals: [
      createActionProposal({
        actionClass: 'green-goods-create-assessment',
        coopId: input.context.coop.profile.id,
        payload: buildGreenGoodsCreateAssessmentPayload({
          coopId: input.context.coop.profile.id,
          gardenAddress: input.context.coop.greenGoods.gardenAddress,
          title: assessment.title,
          description: assessment.description,
          assessmentConfigCid: assessment.assessmentConfigCid,
          domain: assessment.domain,
          startDate: assessment.startDate,
          endDate: assessment.endDate,
          location: assessment.location,
        }),
        reason: assessment.rationale,
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

export const handleGreenGoodsGapAdminSyncOutput: SkillOutputHandler = async (input) => {
  if (!input.context.coop?.greenGoods?.gardenAddress) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  }

  const gapSync = input.output as GreenGoodsGapAdminSyncOutput;
  if (gapSync.addAdmins.length === 0 && gapSync.removeAdmins.length === 0) {
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
        actionClass: 'green-goods-sync-gap-admins',
        coopId: input.context.coop.profile.id,
        payload: buildGreenGoodsSyncGapAdminsPayload({
          coopId: input.context.coop.profile.id,
          gardenAddress: input.context.coop.greenGoods.gardenAddress,
          addAdmins: gapSync.addAdmins,
          removeAdmins: gapSync.removeAdmins,
        }),
        reason: gapSync.rationale,
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

export const greenGoodsHandlers: Partial<Record<SkillOutputSchemaRef, SkillOutputHandler>> = {
  'green-goods-garden-bootstrap-output': handleGreenGoodsGardenBootstrapOutput,
  'green-goods-garden-sync-output': handleGreenGoodsGardenSyncOutput,
  'green-goods-work-approval-output': handleGreenGoodsWorkApprovalOutput,
  'green-goods-assessment-output': handleGreenGoodsAssessmentOutput,
  'green-goods-gap-admin-sync-output': handleGreenGoodsGapAdminSyncOutput,
};
