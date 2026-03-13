import {
  createCoop,
  createReceiverDraftSeed,
  publishDraftAcrossCoops,
  sessionToMember,
  withArchiveWorthiness,
} from '@coop/shared';
import type { ReviewDraft } from '@coop/shared';
import { describe, expect, it } from 'vitest';
import {
  receiverDraftPrivacyError,
  reviewDraftPublishStageError,
  validateReviewDraftPublish,
  validateReviewDraftUpdate,
} from '../review';

function buildSetupInsights() {
  return {
    summary: 'This coop needs a shared place for governance, evidence, and funding leads.',
    crossCuttingPainPoints: ['Knowledge is fragmented'],
    crossCuttingOpportunities: ['Members can publish cleaner shared artifacts'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Funding links live in chat.',
        painPoints: 'No shared memory for grants.',
        improvements: 'Capture leads into a coop feed.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Metrics are gathered manually.',
        painPoints: 'Evidence arrives late.',
        improvements: 'Collect evidence steadily.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Calls and decisions are spread out.',
        painPoints: 'Follow-up slips after calls.',
        improvements: 'Keep next steps visible in review.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Resources sit in browser tabs.',
        painPoints: 'People repeat research.',
        improvements: 'Turn tabs into shared references.',
      },
    ],
  } as const;
}

function buildTabDraft(targetCoopIds: string[]): ReviewDraft {
  return {
    id: 'draft-tab-1',
    interpretationId: 'interp-1',
    extractId: 'extract-1',
    sourceCandidateId: 'candidate-1',
    title: 'Shared tab draft',
    summary: 'Normal tab draft',
    sources: [{ label: 'Shared tab', url: 'https://example.org', domain: 'example.org' }],
    tags: ['shared'],
    category: 'resource',
    whyItMatters: 'Visible to the current local session',
    suggestedNextStep: 'Publish when ready',
    suggestedTargetCoopIds: targetCoopIds,
    confidence: 0.8,
    rationale: 'Tab pipeline draft',
    status: 'draft',
    workflowStage: 'ready',
    provenance: {
      type: 'tab',
      interpretationId: 'interp-1',
      extractId: 'extract-1',
      sourceCandidateId: 'candidate-1',
    },
    createdAt: '2026-03-11T18:01:00.000Z',
  };
}

describe('review draft validation', () => {
  it('blocks a different active member from editing or publishing a receiver draft', () => {
    const coop = createCoop({
      coopName: 'Receiver Coop',
      purpose: 'Keep receiver drafts private until they are reviewed.',
      creatorDisplayName: 'Mina',
      captureMode: 'manual',
      seedContribution: 'I bring field notes from the receiver app.',
      setupInsights: buildSetupInsights(),
    }).state;
    const persistedDraft = createReceiverDraftSeed({
      capture: {
        id: 'capture-1',
        deviceId: 'device-1',
        pairingId: 'pairing-1',
        coopId: coop.profile.id,
        coopDisplayName: coop.profile.name,
        memberId: coop.members[0]?.id,
        memberDisplayName: coop.members[0]?.displayName,
        kind: 'audio',
        title: 'Receiver note',
        note: '',
        mimeType: 'audio/webm',
        byteSize: 24,
        createdAt: '2026-03-11T18:00:00.000Z',
        updatedAt: '2026-03-11T18:00:00.000Z',
        syncState: 'synced',
        syncedAt: '2026-03-11T18:01:00.000Z',
        retryCount: 0,
        intakeStatus: 'draft',
      },
      availableCoopIds: [coop.profile.id],
      preferredCoopId: coop.profile.id,
      preferredCoopLabel: coop.profile.name,
      workflowStage: 'ready',
      createdAt: '2026-03-11T18:02:00.000Z',
    });
    const incomingDraft = {
      ...persistedDraft,
      title: 'Edited title',
    };

    expect(
      validateReviewDraftUpdate({
        persistedDraft,
        incomingDraft,
        availableCoopIds: [coop.profile.id],
        activeCoopId: coop.profile.id,
        activeMemberId: 'member-other',
      }),
    ).toMatchObject({
      ok: false,
      error: receiverDraftPrivacyError,
    });

    expect(
      validateReviewDraftPublish({
        persistedDraft,
        incomingDraft,
        targetCoopIds: [coop.profile.id],
        states: [coop],
        authSession: {
          authMode: 'wallet',
          displayName: 'Other',
          primaryAddress: '0x2222222222222222222222222222222222222222',
          createdAt: '2026-03-11T18:00:00.000Z',
          identityWarning: '',
        },
        activeCoopId: coop.profile.id,
        activeMemberId: 'member-other',
      }),
    ).toMatchObject({
      ok: false,
      error: receiverDraftPrivacyError,
    });
  });

  it('preserves non-receiver draft editing while failing closed on invalid routing', () => {
    const persistedDraft = buildTabDraft(['coop-1']);

    expect(
      validateReviewDraftUpdate({
        persistedDraft,
        incomingDraft: {
          ...persistedDraft,
          title: 'Updated tab draft',
          suggestedTargetCoopIds: ['coop-1'],
        },
        availableCoopIds: ['coop-1', 'coop-2'],
      }),
    ).toMatchObject({
      ok: true,
      draft: {
        title: 'Updated tab draft',
        suggestedTargetCoopIds: ['coop-1'],
      },
    });

    expect(
      validateReviewDraftUpdate({
        persistedDraft,
        incomingDraft: {
          ...persistedDraft,
          suggestedTargetCoopIds: [],
        },
        availableCoopIds: ['coop-1', 'coop-2'],
      }),
    ).toMatchObject({
      ok: false,
      error: 'Select at least one coop target.',
    });

    expect(
      validateReviewDraftPublish({
        persistedDraft,
        incomingDraft: persistedDraft,
        targetCoopIds: ['stale-coop'],
        states: [],
        authSession: null,
      }),
    ).toMatchObject({
      ok: false,
      error: 'Selected coop target is no longer available: stale-coop.',
    });
  });

  it('resolves a valid actor for each target coop during multi-coop publish', () => {
    const sharedAuthSession = {
      authMode: 'wallet' as const,
      displayName: 'June',
      primaryAddress: '0x1111111111111111111111111111111111111111',
      createdAt: '2026-03-12T18:00:00.000Z',
      identityWarning: '',
    };
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
      creator: sessionToMember(sharedAuthSession, 'June', 'creator'),
    }).state;
    const peerCoop = createCoop({
      coopName: 'Watershed Coop',
      purpose: 'Track watershed coordination and funding opportunities.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I bring watershed planning context.',
      setupInsights: buildSetupInsights(),
      creator: sessionToMember(sharedAuthSession, 'June', 'creator'),
    }).state;
    const persistedDraft = buildTabDraft([created.profile.id, peerCoop.profile.id]);

    expect(
      validateReviewDraftPublish({
        persistedDraft,
        incomingDraft: persistedDraft,
        targetCoopIds: [created.profile.id, peerCoop.profile.id],
        states: [created, peerCoop],
        authSession: sharedAuthSession,
      }),
    ).toMatchObject({
      ok: true,
      draft: {
        suggestedTargetCoopIds: [created.profile.id, peerCoop.profile.id],
      },
      targetActors: [
        { coopId: created.profile.id, actorId: created.members[0]?.id },
        { coopId: peerCoop.profile.id, actorId: peerCoop.members[0]?.id },
      ],
    });
  });

  it('requires the persisted draft to already be ready before publishing', () => {
    const sharedAuthSession = {
      authMode: 'wallet' as const,
      displayName: 'June',
      primaryAddress: '0x1111111111111111111111111111111111111111',
      createdAt: '2026-03-12T18:00:00.000Z',
      identityWarning: '',
    };
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
      creator: sessionToMember(sharedAuthSession, 'June', 'creator'),
    }).state;
    const persistedDraft = {
      ...buildTabDraft([created.profile.id]),
      workflowStage: 'candidate' as const,
    };

    expect(
      validateReviewDraftPublish({
        persistedDraft,
        incomingDraft: {
          ...persistedDraft,
          workflowStage: 'ready',
        },
        targetCoopIds: [created.profile.id],
        states: [created],
        authSession: sharedAuthSession,
      }),
    ).toMatchObject({
      ok: false,
      error: reviewDraftPublishStageError,
    });
  });

  it('fails publish when the authenticated person is not a member of every target coop', () => {
    const sharedAuthSession = {
      authMode: 'wallet' as const,
      displayName: 'June',
      primaryAddress: '0x1111111111111111111111111111111111111111',
      createdAt: '2026-03-12T18:00:00.000Z',
      identityWarning: '',
    };
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
      creator: sessionToMember(sharedAuthSession, 'June', 'creator'),
    }).state;
    const peerCoop = createCoop({
      coopName: 'Watershed Coop',
      purpose: 'Track watershed coordination and funding opportunities.',
      creatorDisplayName: 'Nico',
      captureMode: 'manual',
      seedContribution: 'I bring watershed planning context.',
      setupInsights: buildSetupInsights(),
    }).state;
    const persistedDraft = buildTabDraft([created.profile.id, peerCoop.profile.id]);

    expect(
      validateReviewDraftPublish({
        persistedDraft,
        incomingDraft: persistedDraft,
        targetCoopIds: [created.profile.id, peerCoop.profile.id],
        states: [created, peerCoop],
        authSession: sharedAuthSession,
      }),
    ).toMatchObject({
      ok: false,
      error: `The current authenticated person is not a member of target coop(s): ${peerCoop.profile.id}`,
    });
  });

  it('preserves archive-worthy flags through draft save validation and publish shaping', () => {
    const sharedAuthSession = {
      authMode: 'wallet' as const,
      displayName: 'June',
      primaryAddress: '0x1111111111111111111111111111111111111111',
      createdAt: '2026-03-12T18:00:00.000Z',
      identityWarning: '',
    };
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
      creator: sessionToMember(sharedAuthSession, 'June', 'creator'),
    }).state;
    const persistedDraft = buildTabDraft([created.profile.id]);
    const flaggedDraft = withArchiveWorthiness(persistedDraft, true, '2026-03-12T18:10:00.000Z');

    const validation = validateReviewDraftUpdate({
      persistedDraft,
      incomingDraft: flaggedDraft,
      availableCoopIds: [created.profile.id],
    });
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    expect(validation.draft.archiveWorthiness).toMatchObject({
      flagged: true,
      flaggedAt: '2026-03-12T18:10:00.000Z',
    });

    const published = publishDraftAcrossCoops({
      states: [created],
      draft: validation.draft,
      targetActors: [{ coopId: created.profile.id, actorId: created.members[0]?.id ?? '' }],
    });

    expect(published.artifacts[0]?.archiveWorthiness).toMatchObject({
      flagged: true,
      flaggedAt: '2026-03-12T18:10:00.000Z',
    });
  });
});
