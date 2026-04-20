import {
  listActionBundles,
  listAgentObservations,
  listAgentPlans,
  listReceiverCaptures,
  listReviewDrafts,
  listSkillRuns,
  listTabRoutings,
  nowIso,
  pendingBundles,
  queryRecentMemories,
} from '@coop/shared';
import { filterAgentDashboardState } from '../../runtime/agent/harness';
import {
  getWebLlmProviderPromotionEvidence,
  getWebLlmProviderPromotionState,
} from '../../runtime/agent/provider-promotion';
import { listRegisteredSkills } from '../../runtime/agent/registry';
import {
  type AgentDashboardResponse,
  type AgentProviderPromotionBenchmarkEvidence,
  type AgentProviderPromotionEvidence,
  type AgentProviderPromotionTraceEvidence,
  notifyAgentEvent,
} from '../../runtime/messages';
import {
  agentOnboardingKey,
  alarmNames,
  db,
  getAgentOnboardingState,
  notifyExtensionEvent,
  setAgentOnboardingState,
} from '../context';
import { getTrustedNodeContext } from '../operator';
import { getAgentAutoRunSkillIds } from './agent-cycle-helpers';

function summarizePromotionBenchmarkEvidence(
  record: Awaited<
    ReturnType<typeof getWebLlmProviderPromotionEvidence>
  >['benchmarkRecords'][number],
): AgentProviderPromotionBenchmarkEvidence {
  return {
    recordId: record.id,
    skillId: record.skillId,
    outcome: record.outcome,
    schemaPassRate: record.schemaPassRate,
    jsonRepairRate: record.jsonRepairRate,
    medianLatencyMs: record.medianLatencyMs,
    coldStartTimeMs: record.coldStartTimeMs,
    confidenceScore: record.confidenceScore,
    fallbackReason: record.fallbackReason,
    unavailableReason: record.unavailableReason,
    createdAt: record.createdAt,
  };
}

function summarizePromotionTraceEvidence(
  record: Awaited<ReturnType<typeof getWebLlmProviderPromotionEvidence>>['traceRecords'][number],
): AgentProviderPromotionTraceEvidence {
  return {
    recordId: record.id,
    skillId: record.skillId,
    outcome: record.outcome,
    durationMs: record.durationMs,
    confidenceScore: record.confidenceScore,
    evalScore: record.evalScore,
    createdAt: record.createdAt,
  };
}

function summarizeProviderPromotionEvidence(
  evidence: Awaited<ReturnType<typeof getWebLlmProviderPromotionEvidence>>,
): AgentProviderPromotionEvidence {
  return {
    benchmarkRecords: evidence.benchmarkRecords.map(summarizePromotionBenchmarkEvidence),
    traceRecords: evidence.traceRecords.map(summarizePromotionTraceEvidence),
  };
}

async function getAgentDashboard(): Promise<AgentDashboardResponse> {
  const [
    observations,
    plans,
    skillRuns,
    autoRunSkillIds,
    drafts,
    captures,
    trustedNodeContext,
    webLlmPromotionState,
    webLlmPromotionEvidence,
  ] = await Promise.all([
    listAgentObservations(db, 80),
    listAgentPlans(db, 80),
    listSkillRuns(db, 120),
    getAgentAutoRunSkillIds(),
    listReviewDrafts(db),
    listReceiverCaptures(db),
    getTrustedNodeContext(),
    getWebLlmProviderPromotionState(db),
    getWebLlmProviderPromotionEvidence(db),
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
    providerPromotion: {
      webllm: webLlmPromotionState,
      webllmEvidence: summarizeProviderPromotionEvidence(webLlmPromotionEvidence),
    },
  };
}

export { getAgentDashboard };

type ProactiveSnapshot = {
  routingMarkers: Set<string>;
  insightDraftIds: Set<string>;
  digestDraftIds: Set<string>;
  pendingActionIds: Set<string>;
};

async function captureProactiveSnapshot(): Promise<ProactiveSnapshot> {
  const [routings, drafts, actionBundles] = await Promise.all([
    listTabRoutings(db, { status: ['routed', 'drafted'], limit: 500 }),
    listReviewDrafts(db),
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

export function diffProactiveSnapshot(before: ProactiveSnapshot, after: ProactiveSnapshot) {
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

  // Emit AG-UI state delta for any open popup/sidepanel
  const deltaMessage =
    delta.pendingActions > 0
      ? `${delta.pendingActions} action bundle(s) awaiting review.`
      : delta.reviewDigests > 0
        ? `${delta.reviewDigests} review digest draft(s) ready.`
        : delta.insightDrafts > 0
          ? `${delta.insightDrafts} local insight draft(s) ready for review.`
          : `${delta.routedTabs} tab signal(s) routed locally.`;
  const focusIntent =
    delta.pendingActions > 0
      ? ({ tab: 'nest', segment: 'agent' } as const)
      : delta.reviewDigests > 0 || delta.insightDrafts > 0
        ? ({ tab: 'chickens', segment: 'drafts' } as const)
        : ({ tab: 'chickens', segment: 'signals' } as const);

  void notifyAgentEvent({
    type: 'AGENT_STATE_DELTA',
    routedTabs: delta.routedTabs,
    insightDrafts: delta.insightDrafts,
    reviewDigests: delta.reviewDigests,
    pendingActions: delta.pendingActions,
    message: deltaMessage,
    focusIntent,
    emittedAt: nowIso(),
  });

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
      intent: focusIntent,
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
      intent: focusIntent,
    });
    return;
  }

  if (delta.reviewDigests > 0) {
    await notifyExtensionEvent({
      eventKind: 'review-digest-ready',
      entityId: `digest:${nowIso()}`,
      state: `${delta.reviewDigests}`,
      title: 'Review digest ready',
      message: `${delta.reviewDigests} new review digest draft(s) are ready in Chickens.`,
      intent: focusIntent,
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
      intent: focusIntent,
    });
    return;
  }

  await notifyExtensionEvent({
    eventKind: 'roundup-summary',
    entityId: `roundup:${nowIso()}`,
    state: `${delta.routedTabs}`,
    title: 'Roundup summary',
    message: `${delta.routedTabs} new routed tab signal(s) are ready locally.`,
    intent: focusIntent,
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
