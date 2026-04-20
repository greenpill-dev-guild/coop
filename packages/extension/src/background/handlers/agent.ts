import {
  type AgentObservation,
  type AgentPlan,
  type AgentProviderPromotionState,
  type GreenGoodsAssessmentRequest,
  type GreenGoodsWorkApprovalRequest,
  completeAgentPlan,
  createAgentMemory,
  getAgentObservation,
  getAgentPlan,
  getSkillRun,
  greenGoodsAssessmentRequestSchema,
  greenGoodsWorkApprovalRequestSchema,
  listSkillRunsByPlanId,
  approveAgentPlan as markAgentPlanApproved,
  rejectAgentPlan as markAgentPlanRejected,
  saveAgentObservation,
  saveAgentPlan,
  updateAgentObservation,
  updateAgentPlan,
} from '@coop/shared';
import { AGENT_SETTING_KEYS } from '../../runtime/agent/config';
import {
  activateWebLlmProviderPromotion,
  getWebLlmProviderPromotionState,
} from '../../runtime/agent/provider-promotion';
import { listRegisteredSkills } from '../../runtime/agent/registry';
import type {
  AgentDashboardResponse,
  RuntimeActionResponse,
  RuntimeRequest,
} from '../../runtime/messages';
import { db, ensureReceiverSyncOffscreenDocument, setLocalSetting } from '../context';
import { getTrustedNodeContext } from '../operator';

// ---- Re-exports from split modules ----
export {
  getAgentCycleState,
  getAgentAutoRunSkillIds,
  requestAgentCycle,
  drainAgentCycles,
} from './agent-cycle-helpers';
export {
  emitAgentObservationIfMissing,
  emitRoundupBatchObservation,
  emitAudioTranscriptObservation,
  syncHighConfidenceDraftObservations,
} from './agent-observation-emitters';
export { reconcileAgentObservations, syncAgentObservations } from './agent-reconciliation';
export {
  getAgentDashboard,
  diffProactiveSnapshot,
  runProactiveAgentCycle,
  ensureOnboardingBurst,
  completeOnboardingBurst,
} from './agent-dashboard';
export { executeAgentPlanProposals } from './agent-plan-executor';

// ---- Imports from split modules (used by handlers) ----
import { getAgentAutoRunSkillIds, requestAgentCycle } from './agent-cycle-helpers';
import { drainAgentCycles, waitForAgentCycle } from './agent-cycle-helpers';
import { getAgentDashboard, runProactiveAgentCycle } from './agent-dashboard';
import { resolveDesiredGreenGoodsGapAdmins } from './agent-observation-conditions';
import { emitAgentObservationIfMissing } from './agent-observation-emitters';
import { executeAgentPlanProposals } from './agent-plan-executor';
import { syncAgentObservations } from './agent-reconciliation';

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
  await syncAgentObservations();
  await drainAgentCycles({
    reason: 'manual-run',
    force: true,
    maxPasses: 3,
    syncBetweenPasses: true,
  });
  return {
    ok: true,
    data: await getAgentDashboard(),
  };
}

export async function handleGetWebLlmProviderPromotionState(): Promise<
  RuntimeActionResponse<AgentProviderPromotionState | null>
> {
  return {
    ok: true,
    data: await getWebLlmProviderPromotionState(db),
  };
}

export async function handleActivateWebLlmProviderPromotion(): Promise<
  RuntimeActionResponse<AgentProviderPromotionState>
> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  return {
    ok: true,
    data: await activateWebLlmProviderPromotion({
      db,
    }),
  };
}

export async function handleApproveAgentPlan(
  message: Extract<RuntimeRequest, { type: 'approve-agent-plan' }>,
): Promise<RuntimeActionResponse<AgentPlan>> {
  const plan = await getAgentPlan(db, message.payload.planId);
  if (!plan) {
    return { ok: false, error: 'Agent plan not found.' };
  }
  const observation = await getAgentObservation(db, plan.observationId);
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: observation?.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  let approvedPlan = markAgentPlanApproved(plan);
  await saveAgentPlan(db, approvedPlan);

  const dispatch =
    approvedPlan.actionProposals.length > 0
      ? await executeAgentPlanProposals(approvedPlan)
      : { executedCount: 0, errors: [] };
  if (dispatch.errors.length > 0) {
    approvedPlan = updateAgentPlan(approvedPlan, {
      failureReason: dispatch.errors.join(' '),
      status: dispatch.executedCount > 0 ? 'approved' : 'failed',
    });
  } else if (approvedPlan.actionProposals.length === 0 || dispatch.executedCount > 0) {
    approvedPlan = completeAgentPlan(approvedPlan);
  }

  await saveAgentPlan(db, approvedPlan);

  createAgentMemory(db, {
    type: 'user-feedback',
    coopId: observation?.coopId ?? trustedNodeContext.coop.profile.id,
    memberId: trustedNodeContext.member.id,
    content: `Plan approved: ${plan.goal ?? plan.rationale ?? plan.id}`,
    confidence: 1,
    sourceObservationId: plan.observationId,
  }).catch(() => {});

  // Wire autoresearch feedback for each skill run in this plan
  listSkillRunsByPlanId(db, plan.id)
    .then(async (runs) => {
      const { collectFeedback } = await import('../../runtime/agent/experiment-loop');
      for (const run of runs) {
        await collectFeedback(db, run.id, true).catch(() => {});
      }
    })
    .catch(() => {});

  return { ok: true, data: approvedPlan };
}

export async function handleRejectAgentPlan(
  message: Extract<RuntimeRequest, { type: 'reject-agent-plan' }>,
): Promise<RuntimeActionResponse<AgentPlan>> {
  const plan = await getAgentPlan(db, message.payload.planId);
  if (!plan) {
    return { ok: false, error: 'Agent plan not found.' };
  }
  const observation = await getAgentObservation(db, plan.observationId);
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: observation?.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const rejected = markAgentPlanRejected(plan, message.payload.reason);
  await saveAgentPlan(db, rejected);

  if (observation) {
    await saveAgentObservation(
      db,
      updateAgentObservation(observation, {
        status: 'dismissed',
        blockedReason: message.payload.reason,
      }),
    );
  }

  const reason = message.payload.reason;
  createAgentMemory(db, {
    type: 'user-feedback',
    coopId: observation?.coopId ?? trustedNodeContext.coop.profile.id,
    memberId: trustedNodeContext.member.id,
    content: `Plan rejected: ${plan.goal ?? plan.rationale ?? plan.id}${reason ? `\nReason: ${reason}` : ''}`,
    confidence: 1,
    sourceObservationId: plan.observationId,
  }).catch(() => {});

  // Wire autoresearch feedback (rejection) for each skill run in this plan
  listSkillRunsByPlanId(db, plan.id)
    .then(async (runs) => {
      const { collectFeedback } = await import('../../runtime/agent/experiment-loop');
      for (const run of runs) {
        await collectFeedback(db, run.id, false).catch(() => {});
      }
    })
    .catch(() => {});

  // Knowledge sandbox compound loop: weaken edges on rejection
  try {
    const { getGraphStore } = await import('../../runtime/agent/graph-store-singleton');
    const { weakenSourceEdges } = await import('@coop/shared');
    const graphStore = getGraphStore();
    const lastTrace = graphStore.traces
      .filter((t) => t.observationId === plan.observationId)
      .at(-1);
    if (lastTrace) {
      weakenSourceEdges(graphStore, lastTrace.traceId, 'rejected');
      lastTrace.outcome = 'rejected';
    }
  } catch {
    // Knowledge sandbox not available — skip compound loop
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
