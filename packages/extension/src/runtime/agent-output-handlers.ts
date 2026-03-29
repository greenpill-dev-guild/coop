import type {
  AgentObservation,
  AgentPlan,
  AgentProvider,
  CapitalFormationBriefOutput,
  CoopSharedState,
  Erc8004FeedbackOutput,
  Erc8004RegistrationOutput,
  GrantFitScore,
  GrantFitScorerOutput,
  GreenGoodsAssessmentOutput,
  GreenGoodsGapAdminSyncOutput,
  GreenGoodsGardenBootstrapOutput,
  GreenGoodsGardenSyncOutput,
  GreenGoodsWorkApprovalOutput,
  MemoryInsightOutput,
  OpportunityCandidate,
  OpportunityExtractorOutput,
  PublishReadinessCheckOutput,
  ReadablePageExtract,
  ReviewDigestOutput,
  ReviewDraft,
  SkillManifest,
  SkillOutputSchemaRef,
  SkillRun,
  TabRouterOutput,
  TabRouting,
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
  createCapitalFormationDraft,
  createMemoryInsightDraft,
  createReviewDigestDraft,
  updateAgentPlan,
} from '@coop/shared';

export type SkillOutputHandlerExecutionContext = {
  coop?: CoopSharedState;
  draft?: ReviewDraft | null;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
  createdDraftIds: string[];
  relatedDrafts: ReviewDraft[];
  relatedRoutings: TabRouting[];
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
};

export type SkillOutputHandler = (
  input: SkillOutputHandlerInput,
) => Promise<SkillOutputHandlerResult>;

function pushCreatedDraft(input: {
  context: SkillOutputHandlerExecutionContext;
  draftId: string;
  createdDraftIds: string[];
}) {
  input.context.createdDraftIds.push(input.draftId);
  input.createdDraftIds.push(input.draftId);
}

function resolveSynthesisDraftContext(context: SkillOutputHandlerExecutionContext) {
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

function patchSynthesisDraft(input: {
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

function validateActionClass(
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

async function queueActionProposals(input: {
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

const skillOutputHandlers: Partial<Record<SkillOutputSchemaRef, SkillOutputHandler>> = {
  'opportunity-extractor-output': async (input) => {
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
  },
  'grant-fit-scorer-output': async (input) => {
    input.context.scores = (input.output as GrantFitScorerOutput).scores;
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  },
  'tab-router-output': async (input) => {
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
  },
  'capital-formation-brief-output': async (input) => {
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

    const draft = createCapitalFormationDraft({
      observationId: input.observation.id,
      planId: input.plan.id,
      skillRunId: input.run.id,
      skillId: input.skillId,
      coopId: input.context.coop.profile.id,
      output: input.output as CapitalFormationBriefOutput,
    });
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
  },
  'memory-insight-output': async (input) => {
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
      const generatedDraft = createMemoryInsightDraft({
        observationId: input.observation.id,
        planId: input.plan.id,
        skillRunId: input.run.id,
        skillId: input.skillId,
        coopId: input.context.coop.profile.id,
        output: insight,
      });
      if (index === 0 && synthesisContext.existingDraft) {
        const patchedDraft = patchSynthesisDraft({
          draft: synthesisContext.existingDraft,
          generated: generatedDraft,
          targetCoopIds: synthesisContext.targetCoopIds,
        });
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
  },
  'review-digest-output': async (input) => {
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

    const generatedDraft = createReviewDigestDraft({
      observationId: input.observation.id,
      planId: input.plan.id,
      skillRunId: input.run.id,
      skillId: input.skillId,
      coopId: input.context.coop.profile.id,
      output: input.output as ReviewDigestOutput,
    });
    const synthesisContext = resolveSynthesisDraftContext(input.context);
    let createdDraftIds: string[] = [];

    if (synthesisContext.existingDraft) {
      const patchedDraft = patchSynthesisDraft({
        draft: synthesisContext.existingDraft,
        generated: generatedDraft,
        targetCoopIds: synthesisContext.targetCoopIds,
      });
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
  },
  'publish-readiness-check-output': async (input) => {
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
  },
  'green-goods-garden-bootstrap-output': async (input) => {
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
  },
  'green-goods-garden-sync-output': async (input) => {
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
  },
  'green-goods-work-approval-output': async (input) => {
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
  },
  'green-goods-assessment-output': async (input) => {
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
  },
  'green-goods-gap-admin-sync-output': async (input) => {
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
  },
  'erc8004-registration-output': async (input) => {
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
  },
  'erc8004-feedback-output': async (input) => {
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
  },
};

export async function applySkillOutput(
  input: SkillOutputHandlerInput,
): Promise<SkillOutputHandlerResult> {
  const handler = skillOutputHandlers[input.manifest.outputSchemaRef];
  if (!handler) {
    return {
      plan: input.plan,
      context: input.context,
      output: input.output,
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    };
  }

  return handler(input);
}
