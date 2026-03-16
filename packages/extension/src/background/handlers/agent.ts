import {
  type AgentObservation,
  type AgentPlan,
  type CoopSharedState,
  type GreenGoodsAssessmentRequest,
  type GreenGoodsGardenState,
  type GreenGoodsWorkApprovalRequest,
  type ReceiverCapture,
  type ReviewDraft,
  buildAgentObservationFingerprint,
  completeAgentPlan,
  createAgentObservation,
  createId,
  findAgentObservationByFingerprint,
  getAgentObservation,
  getAgentPlan,
  getAuthSession,
  getSkillRun,
  greenGoodsAssessmentRequestSchema,
  greenGoodsWorkApprovalRequestSchema,
  isArchiveReceiptRefreshable,
  listAgentObservations,
  listAgentPlans,
  listReceiverCaptures,
  listSkillRuns,
  approveAgentPlan as markAgentPlanApproved,
  rejectAgentPlan as markAgentPlanRejected,
  nowIso,
  queryRecentMemories,
  resolveGreenGoodsGapAdminChanges,
  saveAgentObservation,
  saveAgentPlan,
  updateAgentObservation,
  updateAgentPlan,
} from '@coop/shared';
import {
  AGENT_HIGH_CONFIDENCE_THRESHOLD,
  AGENT_LOOP_WAIT_TIMEOUT_MS,
  AGENT_SETTING_KEYS,
  type AgentCycleRequest,
  type AgentCycleState,
} from '../../runtime/agent-config';
import { filterAgentDashboardState, isTrustedNodeRole } from '../../runtime/agent-harness';
import { listRegisteredSkills } from '../../runtime/agent-registry';
import type {
  AgentDashboardResponse,
  RuntimeActionResponse,
  RuntimeRequest,
} from '../../runtime/messages';
import {
  db,
  ensureReceiverSyncOffscreenDocument,
  getCoops,
  getLocalSetting,
  setLocalSetting,
} from '../context';
import { findAuthenticatedCoopMember, getTrustedNodeContext } from '../operator';

// ---- Agent Cycle State ----

export async function getAgentCycleState() {
  return getLocalSetting<AgentCycleState>(AGENT_SETTING_KEYS.cycleState, {
    running: false,
  });
}

export async function getAgentAutoRunSkillIds() {
  return getLocalSetting<string[]>(AGENT_SETTING_KEYS.autoRunSkillIds, []);
}

export async function requestAgentCycle(reason: string, force = false) {
  const request: AgentCycleRequest = {
    id: createId('agent-cycle'),
    requestedAt: nowIso(),
    reason,
    force,
  };
  await setLocalSetting(AGENT_SETTING_KEYS.cycleRequest, request);
  return request;
}

async function waitForAgentCycle(
  request: AgentCycleRequest,
  timeoutMs = AGENT_LOOP_WAIT_TIMEOUT_MS,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const state = await getAgentCycleState();
    if (
      state.lastRequestId === request.id &&
      state.lastCompletedAt &&
      state.lastCompletedAt >= request.requestedAt &&
      state.running === false
    ) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return getAgentCycleState();
}

// ---- Observation Helpers ----

export async function emitAgentObservationIfMissing(
  input: Parameters<typeof createAgentObservation>[0],
): Promise<AgentObservation> {
  const observation = createAgentObservation(input);
  const existing = await findAgentObservationByFingerprint(db, observation.fingerprint);
  if (existing) {
    return existing;
  }
  await saveAgentObservation(db, observation);
  return observation;
}

export async function syncHighConfidenceDraftObservations(drafts: ReviewDraft[]) {
  const candidates = drafts.filter((draft) => draft.confidence >= AGENT_HIGH_CONFIDENCE_THRESHOLD);
  for (const draft of candidates) {
    await emitAgentObservationIfMissing({
      trigger: 'high-confidence-draft',
      title: `High-confidence draft: ${draft.title}`,
      summary: draft.summary,
      coopId: draft.suggestedTargetCoopIds[0],
      draftId: draft.id,
      extractId: draft.extractId,
      payload: {
        confidence: draft.confidence,
        category: draft.category,
        workflowStage: draft.workflowStage,
      },
    });
  }
}

function getLatestReviewDigestDraft(input: { coop: CoopSharedState; drafts: ReviewDraft[] }) {
  return input.drafts
    .filter(
      (draft) =>
        draft.provenance.type === 'agent' &&
        draft.provenance.skillId === 'review-digest' &&
        draft.suggestedTargetCoopIds.includes(input.coop.profile.id),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function isRitualReviewDue(input: { coop: CoopSharedState; drafts: ReviewDraft[] }) {
  const cadence = input.coop.rituals[0]?.weeklyReviewCadence ?? '';
  if (!cadence.trim()) {
    return false;
  }

  const latest = getLatestReviewDigestDraft(input);
  if (!latest) {
    return true;
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return new Date(latest.createdAt).getTime() < sevenDaysAgo;
}

function isGreenGoodsSyncNeeded(greenGoods?: GreenGoodsGardenState) {
  if (!greenGoods?.enabled || !greenGoods.gardenAddress || greenGoods.status !== 'linked') {
    return false;
  }
  return (
    !greenGoods.lastProfileSyncAt || !greenGoods.lastDomainSyncAt || !greenGoods.lastPoolSyncAt
  );
}

function resolveDesiredGreenGoodsGapAdmins(coop: CoopSharedState) {
  return coop.members
    .filter((member) => member.role === 'creator' || member.role === 'trusted')
    .map((member) => member.address);
}

function isGreenGoodsGapAdminSyncNeeded(coop: CoopSharedState) {
  if (
    !coop.greenGoods?.enabled ||
    !coop.greenGoods.gardenAddress ||
    coop.greenGoods.status !== 'linked'
  ) {
    return false;
  }
  const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(coop) as `0x${string}`[];
  const currentAdmins = (coop.greenGoods.gapAdminAddresses ?? []) as `0x${string}`[];
  const changes = resolveGreenGoodsGapAdminChanges({
    desiredAdmins,
    currentAdmins,
  });
  return changes.addAdmins.length > 0 || changes.removeAdmins.length > 0;
}

function resolveObservationInactiveReason(input: {
  observation: AgentObservation;
  coopsById: Map<string, CoopSharedState>;
  draftsById: Map<string, ReviewDraft>;
  capturesById: Map<string, ReceiverCapture>;
  drafts: ReviewDraft[];
}) {
  const { observation } = input;

  switch (observation.trigger) {
    case 'high-confidence-draft': {
      const draft = observation.draftId ? input.draftsById.get(observation.draftId) : undefined;
      if (!draft) {
        return 'Source draft no longer exists.';
      }
      if (draft.confidence < AGENT_HIGH_CONFIDENCE_THRESHOLD) {
        return 'Source draft no longer meets the high-confidence threshold.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: draft.suggestedTargetCoopIds[0],
        draftId: draft.id,
        extractId: draft.extractId,
        payload: {
          confidence: draft.confidence,
          category: draft.category,
          workflowStage: draft.workflowStage,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest draft state.';
      }
      return null;
    }
    case 'receiver-backlog': {
      const capture = observation.captureId
        ? input.capturesById.get(observation.captureId)
        : undefined;
      if (!capture) {
        return 'Receiver capture no longer exists.';
      }
      if (capture.intakeStatus === 'archived' || capture.intakeStatus === 'published') {
        return 'Receiver capture no longer needs backlog handling.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: capture.coopId,
        captureId: capture.id,
        payload: {
          intakeStatus: capture.intakeStatus,
          receiverKind: capture.kind,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest receiver intake state.';
      }
      return null;
    }
    case 'stale-archive-receipt': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      const receipt = observation.receiptId
        ? coop?.archiveReceipts.find((candidate) => candidate.id === observation.receiptId)
        : undefined;
      if (!receipt || !isArchiveReceiptRefreshable(receipt)) {
        return 'Archive receipt no longer needs follow-up.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        receiptId: receipt.id,
        payload: {
          rootCid: receipt.rootCid,
          archiveScope: receipt.scope,
          filecoinStatus: receipt.filecoinStatus,
          lastFollowUpAt:
            receipt.followUp?.lastRefreshRequestedAt ??
            receipt.followUp?.lastRefreshedAt ??
            receipt.followUp?.lastStatusChangeAt,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest archive follow-up state.';
      }
      return null;
    }
    case 'ritual-review-due': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop || !isRitualReviewDue({ coop, drafts: input.drafts })) {
        return 'Review digest is no longer due for this coop.';
      }
      const latestDigest = getLatestReviewDigestDraft({
        coop,
        drafts: input.drafts,
      });
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          weeklyReviewCadence: coop.rituals[0]?.weeklyReviewCadence,
          latestDigestCreatedAt: latestDigest?.createdAt,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest review cadence state.';
      }
      return null;
    }
    case 'green-goods-garden-requested': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.greenGoods?.enabled || coop.greenGoods.gardenAddress) {
        return 'Green Goods garden request no longer needs action.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          status: coop.greenGoods.status,
          requestedAt: coop.greenGoods.requestedAt,
          weightScheme: coop.greenGoods.weightScheme,
          domainMask: coop.greenGoods.domainMask,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest Green Goods request state.';
      }
      return null;
    }
    case 'green-goods-sync-needed': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!isGreenGoodsSyncNeeded(coop?.greenGoods)) {
        return 'Green Goods garden sync is no longer needed.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          status: coop.greenGoods?.status,
          lastProfileSyncAt: coop.greenGoods?.lastProfileSyncAt,
          lastDomainSyncAt: coop.greenGoods?.lastDomainSyncAt,
          lastPoolSyncAt: coop.greenGoods?.lastPoolSyncAt,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest Green Goods sync state.';
      }
      return null;
    }
    case 'green-goods-work-approval-requested': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.greenGoods?.enabled || !coop.greenGoods.gardenAddress) {
        return 'Green Goods work approval no longer has a linked garden target.';
      }
      return null;
    }
    case 'green-goods-assessment-requested': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.greenGoods?.enabled || !coop.greenGoods.gardenAddress) {
        return 'Green Goods assessment no longer has a linked garden target.';
      }
      return null;
    }
    case 'green-goods-gap-admin-sync-needed': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop || !isGreenGoodsGapAdminSyncNeeded(coop)) {
        return 'Green Goods GAP admin sync is no longer needed.';
      }
      const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(coop);
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          desiredAdmins,
          currentAdmins: coop.greenGoods?.gapAdminAddresses ?? [],
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest Green Goods GAP admin state.';
      }
      return null;
    }
    case 'erc8004-registration-due': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop || coop.agentIdentity?.agentId) {
        return 'ERC-8004 agent identity already registered or coop not found.';
      }
      if (coop.onchainState.safeCapability !== 'executed') {
        return 'Safe is not yet deployed — registration cannot proceed.';
      }
      return null;
    }
    case 'erc8004-feedback-due': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.agentIdentity?.agentId) {
        return 'No ERC-8004 agent identity — feedback cannot be submitted.';
      }
      return null;
    }
    case 'stale-draft': {
      const draft = observation.draftId ? input.draftsById.get(observation.draftId) : undefined;
      if (!draft) {
        return 'Source draft no longer exists.';
      }
      if (draft.workflowStage !== 'ready') {
        return 'Draft is no longer in the ready stage.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: draft.suggestedTargetCoopIds[0],
        draftId: draft.id,
        payload: {
          workflowStage: draft.workflowStage,
          category: draft.category,
          confidence: draft.confidence,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest draft state.';
      }
      return null;
    }
  }
}

export async function reconcileAgentObservations(input: {
  drafts: ReviewDraft[];
  receiverCaptures: ReceiverCapture[];
  coops: CoopSharedState[];
}) {
  const observations = await listAgentObservations(db, 300);
  const draftsById = new Map(input.drafts.map((draft) => [draft.id, draft] as const));
  const capturesById = new Map(
    input.receiverCaptures.map((capture) => [capture.id, capture] as const),
  );
  const coopsById = new Map(input.coops.map((coop) => [coop.profile.id, coop] as const));

  for (const observation of observations) {
    if (observation.status === 'dismissed' || observation.status === 'completed') {
      continue;
    }

    const inactiveReason = resolveObservationInactiveReason({
      observation,
      draftsById,
      capturesById,
      coopsById,
      drafts: input.drafts,
    });
    if (!inactiveReason) {
      continue;
    }

    await saveAgentObservation(
      db,
      updateAgentObservation(observation, {
        status: 'dismissed',
        blockedReason: inactiveReason,
      }),
    );
  }
}

export async function syncAgentObservations() {
  const [coops, drafts, receiverCaptures] = await Promise.all([
    getCoops(),
    db.reviewDrafts.toArray(),
    listReceiverCaptures(db),
  ]);

  await reconcileAgentObservations({
    coops,
    drafts,
    receiverCaptures,
  });

  await syncHighConfidenceDraftObservations(drafts);

  for (const capture of receiverCaptures) {
    if (capture.intakeStatus === 'archived' || capture.intakeStatus === 'published') {
      continue;
    }
    await emitAgentObservationIfMissing({
      trigger: 'receiver-backlog',
      title: `Receiver backlog: ${capture.title}`,
      summary: capture.note || capture.title,
      coopId: capture.coopId,
      captureId: capture.id,
      payload: {
        intakeStatus: capture.intakeStatus,
        receiverKind: capture.kind,
      },
    });
  }

  for (const coop of coops) {
    if (coop.greenGoods?.enabled && !coop.greenGoods.gardenAddress) {
      await emitAgentObservationIfMissing({
        trigger: 'green-goods-garden-requested',
        title: `Green Goods garden requested for ${coop.profile.name}`,
        summary: `Create a Green Goods garden owned by ${coop.profile.name}'s coop Safe.`,
        coopId: coop.profile.id,
        payload: {
          status: coop.greenGoods.status,
          requestedAt: coop.greenGoods.requestedAt,
          weightScheme: coop.greenGoods.weightScheme,
          domainMask: coop.greenGoods.domainMask,
        },
      });
    }

    if (isGreenGoodsSyncNeeded(coop.greenGoods)) {
      await emitAgentObservationIfMissing({
        trigger: 'green-goods-sync-needed',
        title: `Green Goods sync needed for ${coop.profile.name}`,
        summary: `Garden ${coop.greenGoods?.gardenAddress} should be synced to the latest coop state.`,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          status: coop.greenGoods?.status,
          lastProfileSyncAt: coop.greenGoods?.lastProfileSyncAt,
          lastDomainSyncAt: coop.greenGoods?.lastDomainSyncAt,
          lastPoolSyncAt: coop.greenGoods?.lastPoolSyncAt,
        },
      });
    }

    if (isGreenGoodsGapAdminSyncNeeded(coop)) {
      const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(coop);
      await emitAgentObservationIfMissing({
        trigger: 'green-goods-gap-admin-sync-needed',
        title: `Green Goods GAP admin sync needed for ${coop.profile.name}`,
        summary: `Karma GAP project admins should match the trusted operators for ${coop.profile.name}.`,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          desiredAdmins,
          currentAdmins: coop.greenGoods?.gapAdminAddresses ?? [],
        },
      });
    }

    // ERC-8004: If coop has a deployed Safe but no agent identity, fire registration observation
    if (coop.onchainState.safeCapability === 'executed' && !coop.agentIdentity?.agentId) {
      await emitAgentObservationIfMissing({
        trigger: 'erc8004-registration-due',
        title: `ERC-8004 agent registration due for ${coop.profile.name}`,
        summary: `Coop ${coop.profile.name} has a deployed Safe but no ERC-8004 agent identity. Register to enable reputation tracking.`,
        coopId: coop.profile.id,
        payload: {
          safeAddress: coop.onchainState.safeAddress,
          safeCapability: coop.onchainState.safeCapability,
        },
      });
    }

    for (const receipt of coop.archiveReceipts) {
      if (!isArchiveReceiptRefreshable(receipt)) {
        continue;
      }
      await emitAgentObservationIfMissing({
        trigger: 'stale-archive-receipt',
        title: `Archive follow-up due: ${receipt.rootCid}`,
        summary: `Archive receipt ${receipt.id} is refreshable and can be checked for newer Filecoin status.`,
        coopId: coop.profile.id,
        receiptId: receipt.id,
        payload: {
          rootCid: receipt.rootCid,
          archiveScope: receipt.scope,
          filecoinStatus: receipt.filecoinStatus,
          lastFollowUpAt:
            receipt.followUp?.lastRefreshRequestedAt ??
            receipt.followUp?.lastRefreshedAt ??
            receipt.followUp?.lastStatusChangeAt,
        },
      });
    }

    if (isRitualReviewDue({ coop, drafts })) {
      const latestDigest = getLatestReviewDigestDraft({ coop, drafts });
      await emitAgentObservationIfMissing({
        trigger: 'ritual-review-due',
        title: `Review digest due for ${coop.profile.name}`,
        summary: `${coop.profile.name} is due for a shared review digest.`,
        coopId: coop.profile.id,
        payload: {
          weeklyReviewCadence: coop.rituals[0]?.weeklyReviewCadence,
          latestDigestCreatedAt: latestDigest?.createdAt,
        },
      });
    }
  }
}

// ---- Agent Dashboard ----

async function getAgentDashboard(): Promise<AgentDashboardResponse> {
  const [observations, plans, skillRuns, autoRunSkillIds, drafts, captures, trustedNodeContext] =
    await Promise.all([
      listAgentObservations(db, 80),
      listAgentPlans(db, 80),
      listSkillRuns(db, 120),
      getAgentAutoRunSkillIds(),
      db.reviewDrafts.toArray(),
      listReceiverCaptures(db),
      getTrustedNodeContext(),
    ]);

  const activeCoopId = trustedNodeContext.ok ? trustedNodeContext.coop.profile.id : undefined;
  const memories = activeCoopId ? await queryRecentMemories(db, activeCoopId, { limit: 20 }) : [];

  const filtered = filterAgentDashboardState({
    observations,
    plans,
    skillRuns,
    drafts,
    captures,
    activeCoopId,
    activeMemberId: trustedNodeContext.ok ? trustedNodeContext.member.id : undefined,
    operatorAccess: trustedNodeContext.ok,
  });
  return {
    observations: filtered.observations,
    plans: filtered.plans,
    skillRuns: filtered.skillRuns,
    manifests: listRegisteredSkills().map((entry) => entry.manifest),
    autoRunSkillIds,
    memories,
  };
}

// ---- Execute Plan Proposals ----

export async function executeAgentPlanProposals(plan: AgentPlan) {
  const authSession = await getAuthSession(db);
  const coops = await getCoops();
  let executedCount = 0;
  const errors: string[] = [];

  const { handleProposeAction, handleExecuteAction } = await import('./actions');

  for (const proposal of plan.actionProposals) {
    const coop = coops.find((candidate) => candidate.profile.id === proposal.coopId);
    const memberId =
      proposal.memberId ?? (coop ? findAuthenticatedCoopMember(coop, authSession)?.id : undefined);
    if (!memberId) {
      errors.push(`No authenticated member is available for coop ${proposal.coopId}.`);
      continue;
    }

    const proposed = await handleProposeAction({
      type: 'propose-action',
      payload: {
        actionClass: proposal.actionClass,
        coopId: proposal.coopId,
        memberId,
        payload: proposal.payload,
      },
    });
    if (!proposed.ok || !proposed.data) {
      errors.push(proposed.error ?? `Could not propose ${proposal.actionClass}.`);
      continue;
    }

    if (proposal.approvalMode !== 'auto-run-eligible' || proposed.data.status !== 'approved') {
      continue;
    }

    const executed = await handleExecuteAction({
      type: 'execute-action',
      payload: { bundleId: proposed.data.id },
    });
    if (!executed.ok) {
      errors.push(executed.error ?? `Could not execute ${proposal.actionClass}.`);
      continue;
    }
    executedCount += 1;
  }

  return { executedCount, errors };
}

// ---- Agent Handlers ----

export async function handleGetAgentDashboard(): Promise<
  RuntimeActionResponse<AgentDashboardResponse>
> {
  await syncAgentObservations();
  return {
    ok: true,
    data: await getAgentDashboard(),
  };
}

export async function handleRunAgentCycle(): Promise<
  RuntimeActionResponse<AgentDashboardResponse>
> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  await ensureReceiverSyncOffscreenDocument();
  await syncAgentObservations();
  const request = await requestAgentCycle('manual-run', true);
  await waitForAgentCycle(request);
  return {
    ok: true,
    data: await getAgentDashboard(),
  };
}

export async function handleApproveAgentPlan(
  message: Extract<RuntimeRequest, { type: 'approve-agent-plan' }>,
): Promise<RuntimeActionResponse<AgentPlan>> {
  const plan = await getAgentPlan(db, message.payload.planId);
  if (!plan) {
    return { ok: false, error: 'Agent plan not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: (await getAgentObservation(db, plan.observationId))?.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  let approvedPlan = markAgentPlanApproved(plan);
  await saveAgentPlan(db, approvedPlan);

  const dispatch = await executeAgentPlanProposals(approvedPlan);
  if (dispatch.errors.length > 0) {
    approvedPlan = updateAgentPlan(approvedPlan, {
      failureReason: dispatch.errors.join(' '),
      status: dispatch.executedCount > 0 ? 'approved' : 'failed',
    });
  } else if (approvedPlan.actionProposals.length === 0 || dispatch.executedCount > 0) {
    approvedPlan = completeAgentPlan(approvedPlan);
  }

  await saveAgentPlan(db, approvedPlan);
  return { ok: true, data: approvedPlan };
}

export async function handleRejectAgentPlan(
  message: Extract<RuntimeRequest, { type: 'reject-agent-plan' }>,
): Promise<RuntimeActionResponse<AgentPlan>> {
  const plan = await getAgentPlan(db, message.payload.planId);
  if (!plan) {
    return { ok: false, error: 'Agent plan not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: (await getAgentObservation(db, plan.observationId))?.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const rejected = markAgentPlanRejected(plan, message.payload.reason);
  await saveAgentPlan(db, rejected);

  const observation = await getAgentObservation(db, rejected.observationId);
  if (observation) {
    await saveAgentObservation(
      db,
      updateAgentObservation(observation, {
        status: 'dismissed',
        blockedReason: message.payload.reason,
      }),
    );
  }
  return { ok: true, data: rejected };
}

export async function handleRetrySkillRun(
  message: Extract<RuntimeRequest, { type: 'retry-skill-run' }>,
): Promise<RuntimeActionResponse<AgentDashboardResponse>> {
  const skillRun = await getSkillRun(db, message.payload.skillRunId);
  if (!skillRun) {
    return { ok: false, error: 'Skill run not found.' };
  }
  const observation = await getAgentObservation(db, skillRun.observationId);
  if (!observation) {
    return { ok: false, error: 'Agent observation not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: observation.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  await saveAgentObservation(
    db,
    updateAgentObservation(observation, {
      status: 'pending',
      blockedReason: undefined,
    }),
  );

  await ensureReceiverSyncOffscreenDocument();
  const request = await requestAgentCycle(`retry:${skillRun.id}`, true);
  await waitForAgentCycle(request);
  return { ok: true, data: await getAgentDashboard() };
}

export async function handleListSkillManifests(): Promise<
  RuntimeActionResponse<AgentDashboardResponse['manifests']>
> {
  return {
    ok: true,
    data: listRegisteredSkills().map((entry) => entry.manifest),
  };
}

export async function handleQueueGreenGoodsWorkApproval(
  message: Extract<RuntimeRequest, { type: 'queue-green-goods-work-approval' }>,
): Promise<RuntimeActionResponse<AgentObservation>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  if (!trustedNodeContext.coop.greenGoods?.gardenAddress) {
    return { ok: false, error: 'Green Goods garden is not linked for this coop.' };
  }

  const request = greenGoodsWorkApprovalRequestSchema.parse(
    message.payload.request,
  ) as GreenGoodsWorkApprovalRequest;
  const observation = await emitAgentObservationIfMissing({
    trigger: 'green-goods-work-approval-requested',
    title: `Green Goods work approval for ${trustedNodeContext.coop.profile.name}`,
    summary: `Approve work ${request.workUid} for action ${request.actionUid}.`,
    coopId: trustedNodeContext.coop.profile.id,
    payload: request,
  });
  await ensureReceiverSyncOffscreenDocument();
  await requestAgentCycle(`green-goods-work-approval:${observation.id}`, true);
  return { ok: true, data: observation };
}

export async function handleQueueGreenGoodsAssessment(
  message: Extract<RuntimeRequest, { type: 'queue-green-goods-assessment' }>,
): Promise<RuntimeActionResponse<AgentObservation>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  if (!trustedNodeContext.coop.greenGoods?.gardenAddress) {
    return { ok: false, error: 'Green Goods garden is not linked for this coop.' };
  }

  const request = greenGoodsAssessmentRequestSchema.parse(
    message.payload.request,
  ) as GreenGoodsAssessmentRequest;
  const observation = await emitAgentObservationIfMissing({
    trigger: 'green-goods-assessment-requested',
    title: `Green Goods assessment for ${trustedNodeContext.coop.profile.name}`,
    summary: `Create assessment "${request.title}" for ${trustedNodeContext.coop.profile.name}.`,
    coopId: trustedNodeContext.coop.profile.id,
    payload: request,
  });
  await ensureReceiverSyncOffscreenDocument();
  await requestAgentCycle(`green-goods-assessment:${observation.id}`, true);
  return { ok: true, data: observation };
}

export async function handleQueueGreenGoodsGapAdminSync(
  message: Extract<RuntimeRequest, { type: 'queue-green-goods-gap-admin-sync' }>,
): Promise<RuntimeActionResponse<AgentObservation>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  if (!trustedNodeContext.coop.greenGoods?.gardenAddress) {
    return { ok: false, error: 'Green Goods garden is not linked for this coop.' };
  }

  const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(trustedNodeContext.coop);
  const observation = await emitAgentObservationIfMissing({
    trigger: 'green-goods-gap-admin-sync-needed',
    title: `Green Goods GAP admin sync needed for ${trustedNodeContext.coop.profile.name}`,
    summary: `Align Karma GAP admins with the trusted operators for ${trustedNodeContext.coop.profile.name}.`,
    coopId: trustedNodeContext.coop.profile.id,
    payload: {
      gardenAddress: trustedNodeContext.coop.greenGoods.gardenAddress,
      desiredAdmins,
      currentAdmins: trustedNodeContext.coop.greenGoods.gapAdminAddresses ?? [],
    },
  });
  await ensureReceiverSyncOffscreenDocument();
  await requestAgentCycle(`green-goods-gap-admin-sync:${observation.id}`, true);
  return { ok: true, data: observation };
}

export async function handleSetAgentSkillAutoRun(
  message: Extract<RuntimeRequest, { type: 'set-agent-skill-auto-run' }>,
): Promise<RuntimeActionResponse<string[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const current = new Set(await getAgentAutoRunSkillIds());
  if (message.payload.enabled) {
    current.add(message.payload.skillId);
  } else {
    current.delete(message.payload.skillId);
  }
  const next = [...current].sort();
  await setLocalSetting(AGENT_SETTING_KEYS.autoRunSkillIds, next);
  return { ok: true, data: next };
}
