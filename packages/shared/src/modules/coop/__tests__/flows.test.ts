import { describe, expect, it } from 'vitest';
import { sessionToMember } from '../../auth/auth';
import {
  createCoop,
  createStateFromInviteBootstrap,
  generateInviteCode,
  joinCoop,
  parseInviteCode,
  verifyInviteCodeProof,
} from '../flows';
import {
  publishDraftAcrossCoops,
  publishDraftToCoops,
  resolvePublishActorsForTargets,
} from '../publish';

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

describe('create, join, and publish flows', () => {
  it('creates a coop with initial artifacts and a Safe address', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
    });

    expect(created.state.profile.safeAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(created.state.profile.spaceType).toBe('community');
    expect(created.state.artifacts).toHaveLength(4);
    expect(created.state.members[0]?.role).toBe('creator');
  });

  it('stores the selected space preset in the coop profile', () => {
    const created = createCoop({
      coopName: 'Personal Research Coop',
      purpose: 'Keep personal research threads, notes, and follow-ups coherent across devices.',
      spaceType: 'personal',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want my field notes and tabs to stay legible to future me.',
      setupInsights: buildSetupInsights(),
    });

    expect(created.state.profile.spaceType).toBe('personal');
    expect(created.state.rituals[0]?.weeklyReviewCadence).toBe('Weekly self-review');
    expect(created.state.artifacts.at(-1)?.suggestedNextStep).toMatch(/pair another device/i);
  });

  it('can opt a coop into Green Goods garden creation at launch', () => {
    const created = createCoop({
      coopName: 'Watershed Coop',
      purpose: 'Coordinate bioregional stewardship and ecological funding opportunities.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our regional work and funding paths to stay visible.',
      setupInsights: buildSetupInsights(),
      greenGoods: {
        enabled: true,
      },
    });

    expect(created.state.greenGoods?.enabled).toBe(true);
    expect(created.state.greenGoods?.status).toBe('requested');
    expect(created.state.greenGoods?.domains.length).toBeGreaterThan(0);
  });

  it('supports trusted and member invite flows and adds a joining member', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'trusted',
    });

    const joined = joinCoop({
      state: {
        ...created.state,
        invites: [invite],
      },
      invite,
      displayName: 'Mina',
      seedContribution: 'I bring funding leads from restoration partners.',
    });

    expect(joined.state.members).toHaveLength(2);
    expect(joined.state.members[1]?.role).toBe('trusted');
    expect(joined.state.artifacts.at(-1)?.category).toBe('seed-contribution');
    expect(verifyInviteCodeProof(invite, created.state.syncRoom.inviteSigningSecret)).toBe(true);
    expect('roomSecret' in invite.bootstrap).toBe(false);
  });

  it('rejects a tampered invite bootstrap payload', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });

    const tampered = {
      ...invite,
      bootstrap: {
        ...invite.bootstrap,
        coopDisplayName: 'Tampered Forest Coop',
      },
    };

    expect(verifyInviteCodeProof(tampered, created.state.syncRoom.inviteSigningSecret)).toBe(false);
  });

  it('bootstraps a coop from the invite payload so a second profile can join', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });

    const bootstrapped = createStateFromInviteBootstrap(invite);
    const joined = joinCoop({
      state: bootstrapped,
      invite,
      displayName: 'Mina',
      seedContribution: 'I bring review energy and member context.',
    });

    expect(bootstrapped.profile.id).toBe(created.state.profile.id);
    expect(invite.bootstrap.bootstrapState?.syncRoom.roomId).toBe(created.state.syncRoom.roomId);
    expect(bootstrapped.syncRoom.roomId).toBe(created.state.syncRoom.roomId);
    expect(bootstrapped.syncRoom.inviteSigningSecret.startsWith('bootstrap:')).toBe(true);
    expect(joined.state.members).toHaveLength(2);
    expect(joined.state.members[1]?.displayName).toBe('Mina');
  });

  it('rejects duplicate passkey membership within the same coop', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });

    expect(() =>
      joinCoop({
        state: {
          ...created.state,
          invites: [invite],
        },
        invite,
        displayName: 'June Again',
        seedContribution: 'Attempting to reuse the same identity.',
        member: created.creator,
      }),
    ).toThrow(/already a member/i);
  });

  it('rejects duplicate passkey credential ids even when the address differs', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
      creator: {
        id: 'member-creator',
        displayName: 'June',
        role: 'creator',
        authMode: 'passkey',
        address: '0x1111111111111111111111111111111111111111',
        joinedAt: new Date().toISOString(),
        identityWarning: 'Device bound.',
        passkeyCredentialId: 'credential-1',
      },
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });

    expect(() =>
      joinCoop({
        state: {
          ...created.state,
          invites: [invite],
        },
        invite,
        displayName: 'Mina',
        seedContribution: 'Trying to reuse the same passkey credential.',
        member: {
          id: 'member-joiner',
          displayName: 'Mina',
          role: 'member',
          authMode: 'passkey',
          address: '0x2222222222222222222222222222222222222222',
          joinedAt: new Date().toISOString(),
          identityWarning: 'Device bound.',
          passkeyCredentialId: 'credential-1',
        },
      }),
    ).toThrow(/already linked to a coop member/i);
  });

  it('creates sibling artifacts per target coop when a draft is pushed', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
    });

    const published = publishDraftToCoops({
      state: created.state,
      actorId: created.creator.id,
      targetCoopIds: [created.state.profile.id, 'coop-peer-2'],
      draft: {
        id: 'draft-1',
        interpretationId: 'interp-1',
        extractId: 'extract-1',
        sourceCandidateId: 'candidate-1',
        title: 'Forest grant opportunity',
        summary: 'A major regional grant now fits the coop’s stewardship goals.',
        sources: [
          {
            label: 'Grant page',
            url: 'https://example.org/grant',
            domain: 'example.org',
          },
        ],
        tags: ['grant', 'forest'],
        category: 'funding-lead',
        whyItMatters: 'This could fund the next watershed work cycle.',
        suggestedNextStep: 'Review requirements and assign proposal prep.',
        suggestedTargetCoopIds: [created.state.profile.id, 'coop-peer-2'],
        confidence: 0.82,
        rationale: 'Keyword overlap with funding and stewardship language.',
        status: 'draft',
        workflowStage: 'ready',
        provenance: {
          type: 'tab',
          interpretationId: 'interp-1',
          extractId: 'extract-1',
          sourceCandidateId: 'candidate-1',
        },
        createdAt: new Date().toISOString(),
      },
    });

    expect(published.artifacts).toHaveLength(2);
    expect(published.artifacts[0]?.originId).toBe(published.artifacts[1]?.originId);
    expect(published.nextState.reviewBoard.length).toBeGreaterThan(0);
  });

  it('updates each target coop independently for multi-coop publish', () => {
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
    });
    const peerCoop = createCoop({
      coopName: 'Watershed Coop',
      purpose: 'Track watershed coordination and funding opportunities.',
      creatorDisplayName: 'Nico',
      captureMode: 'manual',
      seedContribution: 'I bring watershed planning context.',
      setupInsights: buildSetupInsights(),
      creator: sessionToMember(sharedAuthSession, 'June', 'creator'),
    });
    const actorResolution = resolvePublishActorsForTargets({
      states: [created.state, peerCoop.state],
      authSession: sharedAuthSession,
      targetCoopIds: [created.state.profile.id, peerCoop.state.profile.id],
    });
    expect(actorResolution).toMatchObject({
      ok: true,
    });
    if (!actorResolution.ok) {
      throw new Error(actorResolution.error);
    }

    const published = publishDraftAcrossCoops({
      states: [created.state, peerCoop.state],
      targetActors: actorResolution.targetActors,
      draft: {
        id: 'draft-2',
        interpretationId: 'interp-2',
        extractId: 'extract-2',
        sourceCandidateId: 'candidate-2',
        title: 'Shared grant opportunity',
        summary: 'The opportunity fits both stewardship and watershed work.',
        sources: [
          {
            label: 'Grant page',
            url: 'https://example.org/grant-2',
            domain: 'example.org',
          },
        ],
        tags: ['grant', 'shared'],
        category: 'funding-lead',
        whyItMatters: 'It can fund both coops without collapsing them into one feed.',
        suggestedNextStep: 'Review each coop-specific application angle.',
        suggestedTargetCoopIds: [created.state.profile.id, peerCoop.state.profile.id],
        confidence: 0.77,
        rationale: 'The grant supports both stewardship and watershed efforts.',
        status: 'draft',
        workflowStage: 'ready',
        provenance: {
          type: 'tab',
          interpretationId: 'interp-2',
          extractId: 'extract-2',
          sourceCandidateId: 'candidate-2',
        },
        createdAt: new Date().toISOString(),
      },
    });

    const updatedForest = published.nextStates.find(
      (state) => state.profile.id === created.state.profile.id,
    );
    const updatedWatershed = published.nextStates.find(
      (state) => state.profile.id === peerCoop.state.profile.id,
    );

    expect(updatedForest?.artifacts.at(-1)?.targetCoopId).toBe(created.state.profile.id);
    expect(updatedWatershed?.artifacts.at(-1)?.targetCoopId).toBe(peerCoop.state.profile.id);
    expect(updatedForest?.artifacts.at(-1)?.createdBy).toBe(created.state.members[0]?.id);
    expect(updatedWatershed?.artifacts.at(-1)?.createdBy).toBe(peerCoop.state.members[0]?.id);
    expect(updatedForest?.artifacts.length).toBe(created.state.artifacts.length + 1);
    expect(updatedWatershed?.artifacts.length).toBe(peerCoop.state.artifacts.length + 1);
  });

  it('throws a clear error when parseInviteCode receives garbage input', () => {
    expect(() => parseInviteCode('not-valid-base64!!')).toThrow(
      'Invite code is malformed or corrupted.',
    );
  });

  it('throws a clear error when parseInviteCode receives empty input', () => {
    expect(() => parseInviteCode('')).toThrow('Invite code is malformed or corrupted.');
  });

  it('fails multi-coop publish when the authenticated person is not a member of every target coop', () => {
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
    });
    const peerCoop = createCoop({
      coopName: 'Watershed Coop',
      purpose: 'Track watershed coordination and funding opportunities.',
      creatorDisplayName: 'Nico',
      captureMode: 'manual',
      seedContribution: 'I bring watershed planning context.',
      setupInsights: buildSetupInsights(),
    });

    expect(
      resolvePublishActorsForTargets({
        states: [created.state, peerCoop.state],
        authSession: sharedAuthSession,
        targetCoopIds: [created.state.profile.id, peerCoop.state.profile.id],
      }),
    ).toMatchObject({
      ok: false,
      error: `The current authenticated person is not a member of target coop(s): ${peerCoop.state.profile.id}`,
    });
  });
});
