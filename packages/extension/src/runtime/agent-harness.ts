import {
  type AgentObservation,
  type AgentPlan,
  type Member,
  type ReceiverCapture,
  type ReviewDraft,
  type SkillManifest,
  type SkillRun,
  isReceiverCaptureVisibleForMemberContext,
  isReviewDraftVisibleForMemberContext,
} from '@coop/shared';

const trustedNodeRoles = new Set<Member['role']>(['creator', 'trusted']);

const skillExecutionOrder: Record<string, number> = {
  'opportunity-extractor': 10,
  'grant-fit-scorer': 20,
  'capital-formation-brief': 30,
  'review-digest': 40,
  'ecosystem-entity-extractor': 50,
  'theme-clusterer': 60,
  'publish-readiness-check': 70,
  'green-goods-garden-bootstrap': 80,
  'green-goods-garden-sync': 90,
  'green-goods-work-approval': 100,
  'green-goods-assessment': 110,
  'green-goods-gap-admin-sync': 120,
};

export function isTrustedNodeRole(role: Member['role'] | undefined | null): boolean {
  return role ? trustedNodeRoles.has(role) : false;
}

export function selectSkillIdsForObservation(
  observation: AgentObservation,
  manifests: SkillManifest[],
): string[] {
  return manifests
    .filter((manifest) => manifest.triggers.includes(observation.trigger))
    .filter((manifest) => observation.draftId || manifest.id !== 'publish-readiness-check')
    .sort((left, right) => {
      const leftOrder = skillExecutionOrder[left.id] ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = skillExecutionOrder[right.id] ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.id.localeCompare(right.id);
    })
    .map((manifest) => manifest.id);
}

export function isAgentObservationVisible(input: {
  observation: AgentObservation;
  activeCoopId?: string;
  activeMemberId?: string;
  draftsById: Map<string, ReviewDraft>;
  capturesById: Map<string, ReceiverCapture>;
}): boolean {
  const { observation, activeCoopId, activeMemberId, draftsById, capturesById } = input;

  if (observation.captureId) {
    const capture = capturesById.get(observation.captureId);
    if (!capture) {
      return observation.coopId === activeCoopId;
    }
    return isReceiverCaptureVisibleForMemberContext(capture, activeCoopId, activeMemberId);
  }

  if (observation.draftId) {
    const draft = draftsById.get(observation.draftId);
    if (!draft) {
      return observation.coopId === activeCoopId;
    }
    return isReviewDraftVisibleForMemberContext(draft, activeCoopId, activeMemberId);
  }

  return Boolean(activeCoopId && observation.coopId === activeCoopId);
}

export function filterAgentDashboardState(input: {
  observations: AgentObservation[];
  plans: AgentPlan[];
  skillRuns: SkillRun[];
  drafts: ReviewDraft[];
  captures: ReceiverCapture[];
  activeCoopId?: string;
  activeMemberId?: string;
  operatorAccess: boolean;
}) {
  if (!input.operatorAccess) {
    return {
      observations: [] as AgentObservation[],
      plans: [] as AgentPlan[],
      skillRuns: [] as SkillRun[],
    };
  }

  const draftsById = new Map(input.drafts.map((draft) => [draft.id, draft] as const));
  const capturesById = new Map(input.captures.map((capture) => [capture.id, capture] as const));
  const observations = input.observations.filter((observation) =>
    isAgentObservationVisible({
      observation,
      activeCoopId: input.activeCoopId,
      activeMemberId: input.activeMemberId,
      draftsById,
      capturesById,
    }),
  );
  const visibleObservationIds = new Set(observations.map((observation) => observation.id));

  return {
    observations,
    plans: input.plans.filter((plan) => visibleObservationIds.has(plan.observationId)),
    skillRuns: input.skillRuns.filter((run) => visibleObservationIds.has(run.observationId)),
  };
}
