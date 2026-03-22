import { describe, expect, it } from 'vitest';
import type {
  Artifact,
  AuthSession,
  CoopMemoryProfile,
  CoopSharedState,
  ReviewDraft,
} from '../../../contracts/schema';
import { createCoop } from '../flows';
import {
  buildReviewBoard,
  createSiblingArtifacts,
  publishDraftAcrossCoops,
  publishDraftToCoops,
  resolvePublishActorsForTargets,
  updateMemoryProfileFromArtifacts,
} from '../publish';

function buildSetupInsights() {
  return {
    summary: 'A compact setup payload for testing publish flows.',
    crossCuttingPainPoints: ['Context is hard to inspect once it moves around'],
    crossCuttingOpportunities: ['Capture review trails that stay legible'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Funding links are scattered.',
        painPoints: 'Important leads disappear.',
        improvements: 'Keep the best artifacts legible.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Evidence arrives late.',
        painPoints: 'Field context disappears.',
        improvements: 'Preserve good evidence quickly.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Weekly reviews carry the flow.',
        painPoints: 'Follow-up context is brittle.',
        improvements: 'Show what got published and archived.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Research lives in tabs and notes.',
        painPoints: 'Useful signal is hard to inspect later.',
        improvements: 'Give the board a durable archive story.',
      },
    ],
  } as const;
}

function createTestCoopState(overrides?: {
  coopName?: string;
  creatorDisplayName?: string;
}): { state: CoopSharedState; creatorAddress: string } {
  const created = createCoop({
    coopName: overrides?.coopName ?? 'Publish Test Coop',
    purpose: 'Testing publish flows.',
    creatorDisplayName: overrides?.creatorDisplayName ?? 'Mina',
    captureMode: 'manual',
    seedContribution: 'I bring test contributions.',
    setupInsights: buildSetupInsights(),
  });
  return {
    state: created.state,
    creatorAddress: created.creator.address,
  };
}

function createTestDraft(coopId: string): ReviewDraft {
  return {
    id: 'draft-test-1',
    interpretationId: 'interp-1',
    extractId: 'extract-1',
    sourceCandidateId: 'candidate-1',
    title: 'Test Artifact Title',
    summary: 'A summary of the test artifact.',
    sources: [
      { url: 'https://example.com/resource', label: 'Example Resource', domain: 'example.com' },
    ],
    tags: ['testing', 'publish'],
    category: 'insight',
    whyItMatters: 'It validates the publish flow.',
    suggestedNextStep: 'Review and archive.',
    suggestedTargetCoopIds: [coopId],
    confidence: 0.9,
    rationale: 'Relevant to the coop mission.',
    status: 'draft',
    workflowStage: 'ready',
    attachments: [],
    provenance: {
      type: 'tab',
      interpretationId: 'interp-1',
      extractId: 'extract-1',
      sourceCandidateId: 'candidate-1',
    },
    createdAt: '2026-03-13T12:00:00.000Z',
  };
}

function createTestAuthSession(address: string): AuthSession {
  return {
    authMode: 'passkey',
    displayName: 'Mina',
    primaryAddress: address,
    createdAt: '2026-03-13T11:00:00.000Z',
    identityWarning: 'Test warning.',
  };
}

function createEmptyMemoryProfile(): CoopMemoryProfile {
  return {
    version: 1,
    updatedAt: '2026-03-13T11:00:00.000Z',
    topDomains: [],
    topTags: [],
    categoryStats: [],
    ritualLensWeights: [],
    exemplarArtifactIds: [],
    archiveSignals: {
      archivedTagCounts: {},
      archivedDomainCounts: {},
    },
  };
}

describe('buildReviewBoard', () => {
  it('correctly groups artifacts by category and member', () => {
    const { state } = createTestCoopState();
    const memberId = state.members[0].id;

    const artifacts: Artifact[] = [
      {
        id: 'artifact-1',
        originId: 'origin-1',
        targetCoopId: state.profile.id,
        title: 'Insight A',
        summary: 'Summary A',
        sources: [{ url: 'https://a.com', label: 'A', domain: 'a.com' }],
        tags: ['tag-a'],
        category: 'insight',
        whyItMatters: 'Matters A',
        suggestedNextStep: 'Next A',
        createdBy: memberId,
        createdAt: '2026-03-13T12:00:00.000Z',
        reviewStatus: 'published',
        archiveStatus: 'not-archived',
        attachments: [],
        archiveReceiptIds: [],
      },
      {
        id: 'artifact-2',
        originId: 'origin-2',
        targetCoopId: state.profile.id,
        title: 'Evidence B',
        summary: 'Summary B',
        sources: [{ url: 'https://b.com', label: 'B', domain: 'b.com' }],
        tags: ['tag-b'],
        category: 'evidence',
        whyItMatters: 'Matters B',
        suggestedNextStep: 'Next B',
        createdBy: memberId,
        createdAt: '2026-03-13T12:01:00.000Z',
        reviewStatus: 'published',
        archiveStatus: 'not-archived',
        attachments: [],
        archiveReceiptIds: [],
      },
    ];

    const board = buildReviewBoard(artifacts);

    // Should have groups by category (insight, evidence) and by member (memberId)
    const categoryGroups = board.filter((g) => g.groupBy === 'category');
    const memberGroups = board.filter((g) => g.groupBy === 'member');

    expect(categoryGroups).toHaveLength(2);
    expect(memberGroups).toHaveLength(1);

    const insightGroup = categoryGroups.find((g) => g.label === 'insight');
    const evidenceGroup = categoryGroups.find((g) => g.label === 'evidence');
    expect(insightGroup?.artifactIds).toEqual(['artifact-1']);
    expect(evidenceGroup?.artifactIds).toEqual(['artifact-2']);

    const memberGroup = memberGroups[0];
    expect(memberGroup.label).toBe(memberId);
    expect(memberGroup.artifactIds).toContain('artifact-1');
    expect(memberGroup.artifactIds).toContain('artifact-2');
  });

  it('returns an empty board for no artifacts', () => {
    const board = buildReviewBoard([]);
    expect(board).toEqual([]);
  });
});

describe('updateMemoryProfileFromArtifacts', () => {
  it('updates the profile with domain, tag, and category data from artifacts', () => {
    const profile = createEmptyMemoryProfile();
    const artifacts: Artifact[] = [
      {
        id: 'artifact-1',
        originId: 'origin-1',
        targetCoopId: 'coop-1',
        title: 'Test',
        summary: 'Summary',
        sources: [{ url: 'https://example.com/page', label: 'Example', domain: 'example.com' }],
        tags: ['alpha', 'beta'],
        category: 'insight',
        whyItMatters: 'Matters',
        suggestedNextStep: 'Next',
        createdBy: 'member-1',
        createdAt: '2026-03-13T12:00:00.000Z',
        reviewStatus: 'published',
        archiveStatus: 'not-archived',
        attachments: [],
        archiveReceiptIds: [],
      },
    ];

    const updated = updateMemoryProfileFromArtifacts(profile, artifacts);

    expect(updated.topDomains).toHaveLength(1);
    expect(updated.topDomains[0].domain).toBe('example.com');
    expect(updated.topDomains[0].acceptCount).toBe(1);

    expect(updated.topTags).toHaveLength(2);
    expect(updated.topTags.map((t) => t.tag)).toContain('alpha');
    expect(updated.topTags.map((t) => t.tag)).toContain('beta');

    expect(updated.categoryStats).toHaveLength(1);
    expect(updated.categoryStats[0].category).toBe('insight');
    expect(updated.categoryStats[0].publishCount).toBe(1);

    expect(updated.exemplarArtifactIds).toContain('artifact-1');
  });

  it('does not mutate the original profile', () => {
    const profile = createEmptyMemoryProfile();
    const artifacts: Artifact[] = [
      {
        id: 'artifact-1',
        originId: 'origin-1',
        targetCoopId: 'coop-1',
        title: 'Test',
        summary: 'Summary',
        sources: [{ url: 'https://example.com/page', label: 'Example', domain: 'example.com' }],
        tags: ['tag'],
        category: 'insight',
        whyItMatters: 'Matters',
        suggestedNextStep: 'Next',
        createdBy: 'member-1',
        createdAt: '2026-03-13T12:00:00.000Z',
        reviewStatus: 'published',
        archiveStatus: 'not-archived',
        attachments: [],
        archiveReceiptIds: [],
      },
    ];

    updateMemoryProfileFromArtifacts(profile, artifacts);

    expect(profile.topDomains).toHaveLength(0);
    expect(profile.topTags).toHaveLength(0);
    expect(profile.categoryStats).toHaveLength(0);
  });
});

describe('resolvePublishActorsForTargets', () => {
  it('resolves member IDs correctly when the session matches a member', () => {
    const { state, creatorAddress } = createTestCoopState();
    const authSession = createTestAuthSession(creatorAddress);

    const result = resolvePublishActorsForTargets({
      states: [state],
      authSession,
      targetCoopIds: [state.profile.id],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.targetActors).toHaveLength(1);
      expect(result.targetActors[0].coopId).toBe(state.profile.id);
      expect(result.targetActors[0].actorId).toBe(state.members[0].id);
    }
  });

  it('returns an error when no auth session is provided', () => {
    const { state } = createTestCoopState();

    const result = resolvePublishActorsForTargets({
      states: [state],
      authSession: null,
      targetCoopIds: [state.profile.id],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('authenticated session is required');
    }
  });

  it('returns an error when the member is not found in the target coop', () => {
    const { state } = createTestCoopState();
    const foreignSession = createTestAuthSession('0x0000000000000000000000000000000000000099');

    const result = resolvePublishActorsForTargets({
      states: [state],
      authSession: foreignSession,
      targetCoopIds: [state.profile.id],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('not a member');
    }
  });

  it('returns an error when coop state is missing for a target', () => {
    const { state, creatorAddress } = createTestCoopState();
    const authSession = createTestAuthSession(creatorAddress);

    const result = resolvePublishActorsForTargets({
      states: [state],
      authSession,
      targetCoopIds: [state.profile.id, 'coop-nonexistent'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Missing coop state');
      expect(result.error).toContain('coop-nonexistent');
    }
  });
});

describe('publishDraftToCoops', () => {
  it('creates artifacts with correct fields from a draft', () => {
    const { state, creatorAddress } = createTestCoopState();
    const draft = createTestDraft(state.profile.id);

    const result = publishDraftToCoops({
      state,
      draft,
      actorId: state.members[0].id,
      targetCoopIds: [state.profile.id],
    });

    expect(result.artifacts).toHaveLength(1);
    const artifact = result.artifacts[0];
    expect(artifact.title).toBe(draft.title);
    expect(artifact.summary).toBe(draft.summary);
    expect(artifact.category).toBe(draft.category);
    expect(artifact.tags).toEqual(draft.tags);
    expect(artifact.targetCoopId).toBe(state.profile.id);
    expect(artifact.createdBy).toBe(state.members[0].id);
    expect(artifact.reviewStatus).toBe('published');
    expect(artifact.archiveStatus).toBe('not-archived');

    // Next state should contain the new artifact
    expect(result.nextState.artifacts.length).toBeGreaterThan(state.artifacts.length);
    expect(result.nextState.artifacts.map((a) => a.id)).toContain(artifact.id);
  });
});

describe('publishDraftAcrossCoops', () => {
  it('creates sibling artifacts with shared originId across multiple coops', () => {
    const coopA = createTestCoopState({ coopName: 'Coop A' });
    const coopB = createTestCoopState({ coopName: 'Coop B' });
    const draft = createTestDraft(coopA.state.profile.id);

    const result = publishDraftAcrossCoops({
      states: [coopA.state, coopB.state],
      draft,
      targetActors: [
        { coopId: coopA.state.profile.id, actorId: coopA.state.members[0].id },
        { coopId: coopB.state.profile.id, actorId: coopB.state.members[0].id },
      ],
    });

    expect(result.artifacts).toHaveLength(2);
    // All sibling artifacts share the same originId
    const originIds = result.artifacts.map((a) => a.originId);
    expect(originIds[0]).toBe(originIds[1]);

    // But have different ids
    const ids = result.artifacts.map((a) => a.id);
    expect(ids[0]).not.toBe(ids[1]);

    // Each targets the correct coop
    expect(result.artifacts.map((a) => a.targetCoopId)).toContain(coopA.state.profile.id);
    expect(result.artifacts.map((a) => a.targetCoopId)).toContain(coopB.state.profile.id);

    // Next states are updated per coop
    expect(result.nextStates).toHaveLength(2);
  });

  it('throws when a target coop state is missing', () => {
    const coopA = createTestCoopState({ coopName: 'Coop A' });
    const draft = createTestDraft(coopA.state.profile.id);

    expect(() =>
      publishDraftAcrossCoops({
        states: [coopA.state],
        draft,
        targetActors: [
          { coopId: coopA.state.profile.id, actorId: coopA.state.members[0].id },
          { coopId: 'coop-missing', actorId: 'actor-missing' },
        ],
      }),
    ).toThrow(/Missing coop state/);
  });
});
