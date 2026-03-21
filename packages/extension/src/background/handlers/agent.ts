import {
  type AgentObservation,
  type AgentPlan,
  type CoopKnowledgeSkillOverride,
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
  deleteCoopKnowledgeSkillOverride,
  findAgentObservationByFingerprint,
  getAgentObservation,
  getAgentPlan,
  getAuthSession,
  getKnowledgeSkill,
  getSkillRun,
  greenGoodsAssessmentRequestSchema,
  greenGoodsWorkApprovalRequestSchema,
  isArchiveReceiptRefreshable,
  listActionBundles,
  listAgentObservations,
  listAgentObservationsByStatus,
  listAgentPlans,
  listCoopKnowledgeSkillOverrides,
  listKnowledgeSkills,
  listReceiverCaptures,
  listSkillRuns,
  listTabRoutings,
  approveAgentPlan as markAgentPlanApproved,
  rejectAgentPlan as markAgentPlanRejected,
  nowIso,
  pendingBundles,
  queryRecentMemories,
  resolveGreenGoodsGapAdminChanges,
  saveAgentObservation,
  saveAgentPlan,
  saveCoopKnowledgeSkillOverride,
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
import {
  importKnowledgeSkill,
  normalizeKnowledgeSkillTriggerPatterns,
  refreshKnowledgeSkill,
  resolveKnowledgeSkillTriggerPatterns,
} from '../../runtime/agent-knowledge';
import { listRegisteredSkills } from '../../runtime/agent-registry';
import type {
  AgentDashboardKnowledgeSkill,
  AgentDashboardResponse,
  RuntimeActionResponse,
  RuntimeRequest,
} from '../../runtime/messages';
import {
  agentOnboardingKey,
  alarmNames,
  db,
  ensureReceiverSyncOffscreenDocument,
  getAgentOnboardingState,
  getCoops,
  getLocalSetting,
  notifyExtensionEvent,
  setAgentOnboardingState,
  setLocalSetting,
} from '../context';
import { findAuthenticatedCoopMember, getTrustedNodeContext } from '../operator';

// ---- Agent Cycle State ----

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

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
  await ensureReceiverSyncOffscreenDocument();
  try {
    await chrome.runtime.sendMessage({
      type: 'run-agent-cycle-if-pending',
      payload: { reason, force },
    });
  } catch (error) {
    console.warn('[agent-cycle] Could not poke offscreen agent runner:', error);
  }
  return request;
}

export async function drainAgentCycles(input: {
  reason: string;
  force?: boolean;
  maxPasses?: number;
}) {
  const maxPasses = input.maxPasses ?? 2;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const pending = await listAgentObservationsByStatus(db, ['pending']);
    if (pending.length === 0 && pass > 0) {
      break;
    }
    const request = await requestAgentCycle(`${input.reason}:pass-${pass + 1}`, input.force);
    await waitForAgentCycle(request);
  }
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
  options: { requestCycle?: boolean } = {},
): Promise<AgentObservation> {
  const observation = createAgentObservation(input);
  const existing = await findAgentObservationByFingerprint(db, observation.fingerprint);
  if (existing) {
    return existing;
  }
  await saveAgentObservation(db, observation);
  if (options.requestCycle ?? true) {
    await requestAgentCycle(`observation:${observation.trigger}`);
  }
  return observation;
}

export async function emitRoundupBatchObservation(input: {
  extractIds: string[];
  eligibleCoopIds: string[];
}) {
  if (input.extractIds.length === 0 || input.eligibleCoopIds.length === 0) {
    return null;
  }

  return emitAgentObservationIfMissing({
    trigger: 'roundup-batch-ready',
    title: 'Captured tabs ready for routing',
    summary: `Route ${input.extractIds.length} freshly captured tab extracts into local coop contexts.`,
    payload: {
      extractIds: input.extractIds,
      eligibleCoopIds: input.eligibleCoopIds,
    },
  });
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
    case 'roundup-batch-ready': {
      const extractIds = Array.isArray(observation.payload.extractIds)
        ? observation.payload.extractIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [];
      if (extractIds.length === 0) {
        return 'Roundup batch no longer has captured extracts to route.';
      }
      return null;
    }
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
      if (!coop || !receipt || !isArchiveReceiptRefreshable(receipt)) {
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
    case 'memory-insight-due': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop) {
        return 'Coop context is unavailable for memory insight synthesis.';
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
      if (!coop || !isGreenGoodsSyncNeeded(coop.greenGoods)) {
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
      await emitAgentObservationIfMissing(
        {
          trigger: 'ritual-review-due',
          title: `Review digest due for ${coop.profile.name}`,
          summary: `${coop.profile.name} is due for a shared review digest.`,
          coopId: coop.profile.id,
          payload: {
            weeklyReviewCadence: coop.rituals[0]?.weeklyReviewCadence,
            latestDigestCreatedAt: latestDigest?.createdAt,
          },
        },
        {
          requestCycle: false,
        },
      );
    }
  }
}

// ---- Agent Dashboard ----

function resolveKnowledgeSkillFreshness(
  fetchedAt?: string,
): AgentDashboardKnowledgeSkill['freshness'] {
  if (!fetchedAt) {
    return 'never-fetched';
  }

  const fetchedAtMs = new Date(fetchedAt).getTime();
  if (Number.isNaN(fetchedAtMs)) {
    return 'stale';
  }

  return Date.now() - fetchedAtMs > 7 * 24 * 60 * 60 * 1000 ? 'stale' : 'fresh';
}

async function listDashboardKnowledgeSkills(
  coopId?: string,
): Promise<AgentDashboardKnowledgeSkill[]> {
  const [skills, overrides] = await Promise.all([
    listKnowledgeSkills(db),
    coopId ? listCoopKnowledgeSkillOverrides(db, coopId) : Promise.resolve([]),
  ]);
  const overrideMap = new Map(overrides.map((override) => [override.knowledgeSkillId, override]));

  return skills
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((skill) => {
      const override = overrideMap.get(skill.id);
      return {
        skill,
        override,
        effectiveEnabled: override?.enabled ?? skill.enabled,
        effectiveTriggerPatterns: resolveKnowledgeSkillTriggerPatterns(skill, override),
        freshness: resolveKnowledgeSkillFreshness(skill.fetchedAt),
      };
    });
}

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
  const [memories, knowledgeSkills] = await Promise.all([
    activeCoopId ? queryRecentMemories(db, activeCoopId, { limit: 20 }) : Promise.resolve([]),
    trustedNodeContext.ok ? listDashboardKnowledgeSkills(activeCoopId) : Promise.resolve([]),
  ]);

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
    knowledgeSkills,
  };
}

type ProactiveSnapshot = {
  routingMarkers: Set<string>;
  insightDraftIds: Set<string>;
  digestDraftIds: Set<string>;
  pendingActionIds: Set<string>;
};

async function captureProactiveSnapshot(): Promise<ProactiveSnapshot> {
  const [routings, drafts, actionBundles] = await Promise.all([
    listTabRoutings(db, { status: ['routed', 'drafted'], limit: 500 }),
    db.reviewDrafts.toArray(),
    listActionBundles(db),
  ]);

  return {
    routingMarkers: new Set(routings.map((routing) => `${routing.id}:${routing.updatedAt}`)),
    insightDraftIds: new Set(
      drafts
        .filter(
          (draft) =>
            draft.provenance.type === 'agent' &&
            draft.provenance.skillId === 'memory-insight-synthesizer',
        )
        .map((draft) => draft.id),
    ),
    digestDraftIds: new Set(
      drafts
        .filter(
          (draft) =>
            draft.provenance.type === 'agent' && draft.provenance.skillId === 'review-digest',
        )
        .map((draft) => draft.id),
    ),
    pendingActionIds: new Set(pendingBundles(actionBundles).map((bundle) => bundle.id)),
  };
}

function diffProactiveSnapshot(before: ProactiveSnapshot, after: ProactiveSnapshot) {
  return {
    routedTabs: [...after.routingMarkers].filter((marker) => !before.routingMarkers.has(marker))
      .length,
    insightDrafts: [...after.insightDraftIds].filter((id) => !before.insightDraftIds.has(id))
      .length,
    reviewDigests: [...after.digestDraftIds].filter((id) => !before.digestDraftIds.has(id)).length,
    pendingActions: [...after.pendingActionIds].filter((id) => !before.pendingActionIds.has(id))
      .length,
  };
}

async function notifyProactiveDelta(input: {
  delta: ReturnType<typeof diffProactiveSnapshot>;
  onboardingKey?: string;
}) {
  const { delta } = input;
  if (
    delta.routedTabs === 0 &&
    delta.insightDrafts === 0 &&
    delta.reviewDigests === 0 &&
    delta.pendingActions === 0
  ) {
    return;
  }

  if (input.onboardingKey) {
    await notifyExtensionEvent({
      eventKind: 'roundup-summary',
      entityId: `onboarding:${input.onboardingKey}`,
      state: 'complete',
      title: 'Coop is routing locally',
      message:
        delta.pendingActions > 0
          ? `Your onboarding run surfaced ${delta.pendingActions} action bundle(s) awaiting review.`
          : delta.reviewDigests > 0
            ? `Your onboarding run prepared ${delta.reviewDigests} review digest draft(s).`
            : delta.insightDrafts > 0
              ? `Your onboarding run prepared ${delta.insightDrafts} local insight draft(s).`
              : `Your onboarding run routed ${delta.routedTabs} tab signal(s).`,
    });
    return;
  }

  if (delta.pendingActions > 0) {
    await notifyExtensionEvent({
      eventKind: 'action-awaiting-review',
      entityId: `actions:${nowIso()}`,
      state: `${delta.pendingActions}`,
      title: 'Action awaiting review',
      message: `${delta.pendingActions} new action bundle(s) need review.`,
    });
    return;
  }

  if (delta.reviewDigests > 0) {
    await notifyExtensionEvent({
      eventKind: 'review-digest-ready',
      entityId: `digest:${nowIso()}`,
      state: `${delta.reviewDigests}`,
      title: 'Review digest ready',
      message: `${delta.reviewDigests} new review digest draft(s) are ready in the Roost.`,
    });
    return;
  }

  if (delta.insightDrafts > 0) {
    await notifyExtensionEvent({
      eventKind: 'memory-insight-ready',
      entityId: `insight:${nowIso()}`,
      state: `${delta.insightDrafts}`,
      title: 'Local insight ready',
      message: `${delta.insightDrafts} new local insight draft(s) are ready for review.`,
    });
    return;
  }

  await notifyExtensionEvent({
    eventKind: 'roundup-summary',
    entityId: `roundup:${nowIso()}`,
    state: `${delta.routedTabs}`,
    title: 'Roundup summary',
    message: `${delta.routedTabs} new routed tab signal(s) are ready locally.`,
  });
}

export async function runProactiveAgentCycle(input: { reason: string; onboardingKey?: string }) {
  const before = await captureProactiveSnapshot();
  const { runCaptureCycle } = await import('./capture');
  await runCaptureCycle();
  const after = await captureProactiveSnapshot();
  const delta = diffProactiveSnapshot(before, after);
  await notifyProactiveDelta({
    delta,
    onboardingKey: input.onboardingKey,
  });
  return delta;
}

export async function ensureOnboardingBurst(input: {
  coopId: string;
  memberId: string;
  reason: string;
}) {
  const key = agentOnboardingKey(input.coopId, input.memberId);
  const state = await getAgentOnboardingState();
  if (state[key]) {
    return state[key];
  }

  state[key] = {
    status: 'pending-followup',
    triggeredAt: nowIso(),
    followUpAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
  await setAgentOnboardingState(state);
  await chrome.alarms.create(`${alarmNames.onboardingFollowUpPrefix}${key}`, {
    when: Date.now() + 5 * 60 * 1000,
  });

  void runProactiveAgentCycle({
    reason: input.reason,
    onboardingKey: key,
  }).catch((error) => {
    console.warn('[agent-onboarding] Immediate proactive cycle failed:', error);
  });

  return state[key];
}

export async function completeOnboardingBurst(key: string) {
  const state = await getAgentOnboardingState();
  const current = state[key];
  if (!current) {
    return;
  }
  state[key] = {
    ...current,
    status: 'steady',
    completedAt: nowIso(),
  };
  await setAgentOnboardingState(state);
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
  await syncAgentObservations();
  await runProactiveAgentCycle({ reason: 'manual-run' });
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

export async function handleImportKnowledgeSkill(
  message: Extract<RuntimeRequest, { type: 'import-knowledge-skill' }>,
): Promise<RuntimeActionResponse<AgentDashboardResponse>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  try {
    await importKnowledgeSkill(message.payload.url);
    return { ok: true, data: await getAgentDashboard() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not import the knowledge skill.',
    };
  }
}

export async function handleRefreshKnowledgeSkill(
  message: Extract<RuntimeRequest, { type: 'refresh-knowledge-skill' }>,
): Promise<RuntimeActionResponse<AgentDashboardResponse>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  try {
    const refreshed = await refreshKnowledgeSkill(message.payload.skillId);
    if (!refreshed) {
      return { ok: false, error: 'Knowledge skill not found.' };
    }
    return { ok: true, data: await getAgentDashboard() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not refresh the knowledge skill.',
    };
  }
}

export async function handleSetCoopKnowledgeSkillEnabled(
  message: Extract<RuntimeRequest, { type: 'set-coop-knowledge-skill-enabled' }>,
): Promise<RuntimeActionResponse<AgentDashboardResponse>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const skill = await getKnowledgeSkill(db, message.payload.knowledgeSkillId);
  if (!skill) {
    return { ok: false, error: 'Knowledge skill not found.' };
  }

  const overrides = await listCoopKnowledgeSkillOverrides(db, trustedNodeContext.coop.profile.id);
  const existingOverride = overrides.find(
    (override) => override.knowledgeSkillId === message.payload.knowledgeSkillId,
  );
  if (!existingOverride && message.payload.enabled === skill.enabled) {
    return { ok: true, data: await getAgentDashboard() };
  }
  if (
    existingOverride &&
    message.payload.enabled === skill.enabled &&
    existingOverride.triggerPatterns === undefined
  ) {
    await deleteCoopKnowledgeSkillOverride(db, existingOverride.id);
    return { ok: true, data: await getAgentDashboard() };
  }
  const nextOverride: CoopKnowledgeSkillOverride = {
    id: existingOverride?.id ?? createId('knowledge-override'),
    coopId: trustedNodeContext.coop.profile.id,
    knowledgeSkillId: message.payload.knowledgeSkillId,
    enabled: message.payload.enabled,
    triggerPatterns: existingOverride?.triggerPatterns,
  };
  await saveCoopKnowledgeSkillOverride(db, nextOverride);

  return { ok: true, data: await getAgentDashboard() };
}

export async function handleSetCoopKnowledgeSkillTriggerPatterns(
  message: Extract<RuntimeRequest, { type: 'set-coop-knowledge-skill-trigger-patterns' }>,
): Promise<RuntimeActionResponse<AgentDashboardResponse>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const skill = await getKnowledgeSkill(db, message.payload.knowledgeSkillId);
  if (!skill) {
    return { ok: false, error: 'Knowledge skill not found.' };
  }

  const overrides = await listCoopKnowledgeSkillOverrides(db, trustedNodeContext.coop.profile.id);
  const existingOverride = overrides.find(
    (override) => override.knowledgeSkillId === message.payload.knowledgeSkillId,
  );
  const nextTriggerPatterns = normalizeKnowledgeSkillTriggerPatterns(
    message.payload.triggerPatterns,
  );
  const preservedEnabled = existingOverride?.enabled ?? skill.enabled;
  const storedTriggerPatterns = arraysEqual(nextTriggerPatterns, skill.triggerPatterns)
    ? undefined
    : nextTriggerPatterns;

  if (!existingOverride && !storedTriggerPatterns) {
    return { ok: true, data: await getAgentDashboard() };
  }

  if (
    existingOverride &&
    preservedEnabled === skill.enabled &&
    storedTriggerPatterns === undefined
  ) {
    await deleteCoopKnowledgeSkillOverride(db, existingOverride.id);
    return { ok: true, data: await getAgentDashboard() };
  }

  const nextOverride: CoopKnowledgeSkillOverride = {
    id: existingOverride?.id ?? createId('knowledge-override'),
    coopId: trustedNodeContext.coop.profile.id,
    knowledgeSkillId: message.payload.knowledgeSkillId,
    enabled: preservedEnabled,
    triggerPatterns: storedTriggerPatterns,
  };
  await saveCoopKnowledgeSkillOverride(db, nextOverride);

  return { ok: true, data: await getAgentDashboard() };
}
