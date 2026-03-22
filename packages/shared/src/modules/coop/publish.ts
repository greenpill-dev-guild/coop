import type {
  Artifact,
  AuthSession,
  CoopMemoryProfile,
  CoopSharedState,
  ReviewBoardGroup,
  ReviewDraft,
} from '../../contracts/schema';
import { createId, extractDomain, groupBy, nowIso, unique } from '../../utils';

export interface TargetCoopActor {
  coopId: string;
  actorId: string;
}

function findAuthenticatedMemberId(state: CoopSharedState, authSession: AuthSession) {
  const authAddress = authSession.primaryAddress.toLowerCase();
  return state.members.find((member) => member.address.toLowerCase() === authAddress)?.id;
}

export function resolvePublishActorsForTargets(input: {
  states: CoopSharedState[];
  authSession: AuthSession | null | undefined;
  targetCoopIds: string[];
}) {
  if (!input.authSession?.primaryAddress) {
    return {
      ok: false as const,
      error: 'An authenticated session is required to publish this draft.',
    };
  }

  const stateById = new Map(input.states.map((state) => [state.profile.id, state]));
  const missingStateIds = input.targetCoopIds.filter((coopId) => !stateById.has(coopId));
  if (missingStateIds.length > 0) {
    return {
      ok: false as const,
      error: `Missing coop state for publish target(s): ${missingStateIds.join(', ')}`,
    };
  }

  const targetActors: TargetCoopActor[] = [];
  const invalidTargetCoopIds: string[] = [];
  for (const coopId of input.targetCoopIds) {
    const state = stateById.get(coopId);
    if (!state) {
      invalidTargetCoopIds.push(coopId);
      continue;
    }

    const actorId = findAuthenticatedMemberId(state, input.authSession);
    if (!actorId) {
      invalidTargetCoopIds.push(coopId);
      continue;
    }

    targetActors.push({
      coopId,
      actorId,
    });
  }

  if (invalidTargetCoopIds.length > 0) {
    return {
      ok: false as const,
      error: `The current authenticated person is not a member of target coop(s): ${invalidTargetCoopIds.join(', ')}`,
    };
  }

  return {
    ok: true as const,
    targetActors,
  };
}

export function createSiblingArtifacts(input: {
  draft: ReviewDraft;
  targetActors: TargetCoopActor[];
}) {
  const originId = createId('origin');
  const createdAt = nowIso();

  return input.targetActors.map<Artifact>(({ coopId, actorId }) => ({
    id: createId('artifact'),
    originId,
    targetCoopId: coopId,
    title: input.draft.title,
    summary: input.draft.summary,
    sources: input.draft.sources,
    tags: input.draft.tags,
    category: input.draft.category,
    whyItMatters: input.draft.whyItMatters,
    suggestedNextStep: input.draft.suggestedNextStep,
    previewImageUrl: input.draft.previewImageUrl,
    createdBy: actorId,
    createdAt,
    reviewStatus: 'published',
    archiveStatus: 'not-archived',
    archiveReceiptIds: [],
    attachments: input.draft.attachments ?? [],
    archiveWorthiness: input.draft.archiveWorthiness,
  }));
}

export function buildReviewBoard(artifacts: Artifact[]): ReviewBoardGroup[] {
  const byCategory = groupBy(artifacts, (artifact) => artifact.category);
  const byMember = groupBy(artifacts, (artifact) => artifact.createdBy);

  return [
    ...Object.entries(byCategory).map(([label, bucket]) => ({
      id: createId('group'),
      groupBy: 'category' as const,
      label,
      artifactIds: bucket.map((artifact) => artifact.id),
    })),
    ...Object.entries(byMember).map(([label, bucket]) => ({
      id: createId('group'),
      groupBy: 'member' as const,
      label,
      artifactIds: bucket.map((artifact) => artifact.id),
    })),
  ];
}

function upsertDomain(profile: CoopMemoryProfile, artifact: Artifact) {
  const domain = extractDomain(artifact.sources[0]?.url ?? 'https://coop.local');
  const existing = profile.topDomains.find((entry) => entry.domain === domain);
  if (existing) {
    existing.acceptCount += 1;
    existing.reviewedCount += artifact.reviewStatus === 'reviewed' ? 1 : 0;
    existing.lastAcceptedAt = artifact.createdAt;
    return;
  }
  profile.topDomains.push({
    domain,
    acceptCount: 1,
    reviewedCount: artifact.reviewStatus === 'reviewed' ? 1 : 0,
    lastAcceptedAt: artifact.createdAt,
  });
}

function upsertTag(profile: CoopMemoryProfile, tag: string, createdAt: string) {
  const existing = profile.topTags.find((entry) => entry.tag === tag);
  if (existing) {
    existing.acceptCount += 1;
    existing.lastAcceptedAt = createdAt;
    return;
  }
  profile.topTags.push({
    tag,
    acceptCount: 1,
    lastAcceptedAt: createdAt,
  });
}

function upsertCategory(profile: CoopMemoryProfile, artifact: Artifact) {
  const existing = profile.categoryStats.find((entry) => entry.category === artifact.category);
  if (existing) {
    existing.publishCount += 1;
    existing.actionedCount += artifact.reviewStatus === 'actioned' ? 1 : 0;
    return;
  }
  profile.categoryStats.push({
    category: artifact.category,
    publishCount: 1,
    actionedCount: artifact.reviewStatus === 'actioned' ? 1 : 0,
  });
}

export function updateMemoryProfileFromArtifacts(
  profile: CoopMemoryProfile,
  artifacts: Artifact[],
): CoopMemoryProfile {
  const next = structuredClone(profile);
  next.updatedAt = nowIso();

  for (const artifact of artifacts) {
    upsertDomain(next, artifact);
    upsertCategory(next, artifact);
    for (const tag of unique(artifact.tags)) {
      upsertTag(next, tag, artifact.createdAt);
    }
    next.exemplarArtifactIds = unique([artifact.id, ...next.exemplarArtifactIds]).slice(0, 12);
  }

  next.topDomains = next.topDomains
    .sort((left, right) => right.acceptCount - left.acceptCount)
    .slice(0, 12);
  next.topTags = next.topTags
    .sort((left, right) => right.acceptCount - left.acceptCount)
    .slice(0, 18);
  next.categoryStats = next.categoryStats.sort(
    (left, right) => right.publishCount - left.publishCount,
  );

  return next;
}

export function publishDraftToCoops(input: {
  state: CoopSharedState;
  draft: ReviewDraft;
  actorId: string;
  targetCoopIds: string[];
}) {
  const artifacts = createSiblingArtifacts({
    draft: input.draft,
    targetActors: input.targetCoopIds.map((coopId) => ({
      coopId,
      actorId: input.actorId,
    })),
  });

  const nextArtifacts = [...input.state.artifacts, ...artifacts];
  return {
    artifacts,
    nextState: {
      ...input.state,
      artifacts: nextArtifacts,
      reviewBoard: buildReviewBoard(nextArtifacts),
      memoryProfile: updateMemoryProfileFromArtifacts(input.state.memoryProfile, artifacts),
    },
  };
}

export function publishDraftAcrossCoops(input: {
  states: CoopSharedState[];
  draft: ReviewDraft;
  targetActors: TargetCoopActor[];
}) {
  const stateById = new Map(input.states.map((state) => [state.profile.id, state]));
  const missing = input.targetActors
    .map((targetActor) => targetActor.coopId)
    .filter((coopId) => !stateById.has(coopId));
  if (missing.length > 0) {
    throw new Error(`Missing coop state for publish target(s): ${missing.join(', ')}`);
  }

  const artifacts = createSiblingArtifacts({
    draft: input.draft,
    targetActors: input.targetActors,
  });

  const nextStates = input.states.map((state) => {
    const artifactsForCoop = artifacts.filter(
      (artifact) => artifact.targetCoopId === state.profile.id,
    );
    if (artifactsForCoop.length === 0) {
      return state;
    }

    const nextArtifacts = [...state.artifacts, ...artifactsForCoop];
    return {
      ...state,
      artifacts: nextArtifacts,
      reviewBoard: buildReviewBoard(nextArtifacts),
      memoryProfile: updateMemoryProfileFromArtifacts(state.memoryProfile, artifactsForCoop),
    };
  });

  return {
    artifacts,
    nextStates,
  };
}
