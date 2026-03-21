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

/**
 * Topological sort of skills based on the `depends` graph.
 * Falls back to alphabetical for skills with no dependencies.
 * Throws at build time if cycles are detected.
 */
export function topologicalSortSkills(manifests: SkillManifest[]): SkillManifest[] {
  const byId = new Map(manifests.map((m) => [m.id, m]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const m of manifests) {
    inDegree.set(m.id, 0);
    dependents.set(m.id, []);
  }

  for (const m of manifests) {
    for (const dep of m.depends) {
      if (!byId.has(dep)) continue;
      inDegree.set(m.id, (inDegree.get(m.id) ?? 0) + 1);
      const depChildren = dependents.get(dep);
      if (depChildren) depChildren.push(m.id);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }
  queue.sort((a, b) => a.localeCompare(b));

  const sorted: SkillManifest[] = [];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    const manifest = byId.get(id);
    if (!manifest) continue;
    sorted.push(manifest);

    const children = dependents.get(id) ?? [];
    const ready: string[] = [];
    for (const child of children) {
      const newDegree = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDegree);
      if (newDegree === 0) ready.push(child);
    }
    ready.sort((a, b) => a.localeCompare(b));
    queue.push(...ready);
    queue.sort((a, b) => a.localeCompare(b));
  }

  if (sorted.length !== manifests.length) {
    const remaining = manifests.filter((m) => !sorted.some((s) => s.id === m.id));
    throw new Error(
      `Dependency cycle detected among skills: ${remaining.map((m) => m.id).join(', ')}`,
    );
  }

  return sorted;
}

export type SkillExecutionContext = {
  candidates: Array<unknown>;
  scores: Array<unknown>;
  draft?: unknown;
  coop?: unknown;
  capture?: unknown;
  receipt?: unknown;
};

export const skipConditions: Record<string, (ctx: SkillExecutionContext) => boolean> = {
  'no-candidates': (ctx) => ctx.candidates.length === 0,
  'no-scores': (ctx) => ctx.scores.length === 0,
  'no-draft': (ctx) => !ctx.draft,
  'no-coop': (ctx) => !ctx.coop,
};

export function shouldSkipSkill(skipWhen: string | undefined, ctx: SkillExecutionContext): boolean {
  if (!skipWhen) return false;
  const condition = skipConditions[skipWhen];
  return condition ? condition(ctx) : false;
}

function readNestedBoolean(source: unknown, path: string[]) {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return Boolean(current);
}

function readNestedString(source: unknown, path: string[]) {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' && current.length > 0 ? current : undefined;
}

function readNestedNumber(source: unknown, path: string[]) {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : undefined;
}

export const requiredCapabilityChecks: Record<string, (ctx: SkillExecutionContext) => boolean> = {
  'coop-context': (ctx) => Boolean(ctx.coop),
  'draft-context': (ctx) => Boolean(ctx.draft),
  'capture-context': (ctx) => Boolean(ctx.capture),
  'receipt-context': (ctx) => Boolean(ctx.receipt),
  'opportunity-candidates': (ctx) => ctx.candidates.length > 0,
  'grant-fit-scores': (ctx) => ctx.scores.length > 0,
  'green-goods-enabled': (ctx) => readNestedBoolean(ctx.coop, ['greenGoods', 'enabled']),
  'green-goods-garden-linked': (ctx) =>
    Boolean(readNestedString(ctx.coop, ['greenGoods', 'gardenAddress'])),
  'safe-deployed': (ctx) =>
    readNestedString(ctx.coop, ['onchainState', 'safeCapability']) === 'executed',
  'agent-identity': (ctx) => Boolean(readNestedNumber(ctx.coop, ['agentIdentity', 'agentId'])),
};

export function getMissingRequiredCapabilities(
  requiredCapabilities: string[] | undefined,
  ctx: SkillExecutionContext,
) {
  if (!requiredCapabilities?.length) {
    return [];
  }
  return requiredCapabilities.filter((capability) => {
    const check = requiredCapabilityChecks[capability];
    return check ? !check(ctx) : true;
  });
}

export function isTrustedNodeRole(role: Member['role'] | undefined | null): boolean {
  return role ? trustedNodeRoles.has(role) : false;
}

export function selectSkillIdsForObservation(
  observation: AgentObservation,
  manifests: SkillManifest[],
): string[] {
  const filtered = manifests
    .filter((manifest) => manifest.triggers.includes(observation.trigger))
    .filter((manifest) => observation.draftId || manifest.id !== 'publish-readiness-check');

  return topologicalSortSkills(filtered).map((manifest) => manifest.id);
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
