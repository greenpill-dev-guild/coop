import { describe, expect, it } from 'vitest';
import { sessionToMember } from '../../auth/auth';
import {
  canManageInvites,
  createCoop,
  createMember,
  createStateFromInviteBootstrap,
  generateInviteCode,
  getComputedInviteStatus,
  joinCoop,
  leaveCoop,
  parseInviteCode,
  revokeInviteCode,
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

  it('derives soul with new identity fields having sensible defaults', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship and shared funding context.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our research and field notes to stay visible.',
      setupInsights: buildSetupInsights(),
    });

    const soul = created.state.soul;
    expect(soul.purposeStatement).toBe('Coordinate forest stewardship and shared funding context.');
    expect(soul.agentPersona).toBeUndefined();
    expect(soul.vocabularyTerms).toEqual([]);
    expect(soul.prohibitedTopics).toEqual([]);
    expect(soul.confidenceThreshold).toBe(0.72);
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
      creator: createMember('June', 'creator', { passkeyCredentialId: 'cred-june' }),
      greenGoods: {
        enabled: true,
      },
    });

    expect(created.state.greenGoods?.enabled).toBe(true);
    expect(created.state.greenGoods?.status).toBe('requested');
    expect(created.state.greenGoods?.domains.length).toBeGreaterThan(0);
    expect(created.state.memberAccounts).toHaveLength(1);
    expect(created.state.memberAccounts[0]?.status).toBe('pending');
    expect(created.state.greenGoods?.memberBindings).toHaveLength(1);
    expect(created.state.greenGoods?.memberBindings[0]?.desiredRoles).toEqual([
      'gardener',
      'operator',
    ]);
    expect(created.state.greenGoods?.memberBindings[0]?.status).toBe('pending-account');
  });

  it('initializes pending member account state when a second member joins a Green Goods coop', () => {
    const created = createCoop({
      coopName: 'Watershed Coop',
      purpose: 'Coordinate bioregional stewardship and ecological funding opportunities.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'I want our regional work and funding paths to stay visible.',
      setupInsights: buildSetupInsights(),
      creator: createMember('June', 'creator', { passkeyCredentialId: 'cred-june' }),
      greenGoods: {
        enabled: true,
      },
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });

    const joined = joinCoop({
      state: {
        ...created.state,
        invites: [invite],
      },
      invite,
      displayName: 'Mina',
      seedContribution: 'I bring review energy and member context.',
      member: createMember('Mina', 'member', { passkeyCredentialId: 'cred-mina' }),
    });

    expect(joined.state.memberAccounts).toHaveLength(2);
    expect(joined.state.memberAccounts.every((account) => account.status === 'pending')).toBe(true);
    expect(joined.state.greenGoods?.memberBindings).toHaveLength(2);
    expect(joined.state.greenGoods?.memberBindings[1]?.desiredRoles).toEqual(['gardener']);
    expect(joined.state.greenGoods?.memberBindings[1]?.status).toBe('pending-account');
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
    expect(bootstrapped.syncRoom.roomSecret).toBe(created.state.syncRoom.roomSecret);
    expect(bootstrapped.syncRoom.inviteSigningSecret.startsWith('bootstrap:')).toBe(true);
    expect(joined.state.members).toHaveLength(2);
    expect(joined.state.members[1]?.displayName).toBe('Mina');
  });

  it('rejects a join attempt with a tampered invite proof', () => {
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
        inviteProof: '0xdeadbeef',
      },
    };

    expect(() =>
      joinCoop({
        state: {
          ...created.state,
          invites: [invite],
        },
        invite: tampered,
        displayName: 'Attacker',
        seedContribution: 'Trying to sneak in with a tampered proof.',
      }),
    ).toThrow(/integrity check failed/i);
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
        attachments: [],
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
        attachments: [],
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

  it('revokes an active invite code', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });
    const stateWithInvite = { ...created.state, invites: [invite] };

    const revoked = revokeInviteCode({
      state: stateWithInvite,
      inviteId: invite.id,
      revokedBy: created.creator.id,
    });

    const revokedInvite = revoked.invites.find((i) => i.id === invite.id);
    expect(revokedInvite?.status).toBe('revoked');
    expect(revokedInvite?.revokedBy).toBe(created.creator.id);
    expect(revokedInvite?.revokedAt).toBeDefined();
  });

  it('rejects join attempt on a revoked invite', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });
    const stateWithInvite = { ...created.state, invites: [invite] };
    const revoked = revokeInviteCode({
      state: stateWithInvite,
      inviteId: invite.id,
      revokedBy: created.creator.id,
    });

    expect(() =>
      joinCoop({
        state: revoked,
        invite,
        displayName: 'Attacker',
        seedContribution: 'Trying to join with a revoked invite.',
      }),
    ).toThrow(/revoked/i);
  });

  it('only allows creators and trusted members to revoke invites', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });
    const stateWithInvite = { ...created.state, invites: [invite] };

    const joined = joinCoop({
      state: stateWithInvite,
      invite,
      displayName: 'Mina',
      seedContribution: 'Regular member here.',
    });
    const regularMember = joined.state.members[1] as (typeof joined.state.members)[number];

    expect(canManageInvites(joined.state, created.creator.id)).toBe(true);
    expect(canManageInvites(joined.state, regularMember.id)).toBe(false);
    expect(() =>
      revokeInviteCode({
        state: joined.state,
        inviteId: invite.id,
        revokedBy: regularMember.id,
      }),
    ).toThrow(/creators and trusted members/i);

    // Regular members also cannot generate invites
    expect(() =>
      generateInviteCode({
        state: joined.state,
        createdBy: regularMember.id,
        type: 'member',
      }),
    ).toThrow(/creators and trusted members/i);
  });

  it('computes invite status correctly across lifecycle stages', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });

    expect(getComputedInviteStatus(invite)).toBe('active');

    const expiredInvite = { ...invite, expiresAt: '2020-01-01T00:00:00.000Z' };
    expect(getComputedInviteStatus(expiredInvite)).toBe('expired');

    const usedInvite = { ...invite, usedByMemberIds: ['member-1'] };
    expect(getComputedInviteStatus(usedInvite)).toBe('used');

    const revokedInvite = { ...invite, status: 'revoked' as const };
    expect(getComputedInviteStatus(revokedInvite)).toBe('revoked');

    // Revoked takes precedence over expired
    const revokedAndExpired = {
      ...invite,
      status: 'revoked' as const,
      expiresAt: '2020-01-01T00:00:00.000Z',
    };
    expect(getComputedInviteStatus(revokedAndExpired)).toBe('revoked');
  });

  it('supports custom expiry when generating invite codes', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
      expiresInHours: 1,
    });

    const expiresAt = new Date(invite.expiresAt).getTime();
    const now = Date.now();
    // Should expire within ~1 hour (with some tolerance)
    expect(expiresAt - now).toBeLessThan(1.1 * 60 * 60 * 1000);
    expect(expiresAt - now).toBeGreaterThan(0.9 * 60 * 60 * 1000);
  });

  it('prevents double-revocation of an invite', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });
    const stateWithInvite = { ...created.state, invites: [invite] };
    const revoked = revokeInviteCode({
      state: stateWithInvite,
      inviteId: invite.id,
      revokedBy: created.creator.id,
    });

    expect(() =>
      revokeInviteCode({
        state: revoked,
        inviteId: invite.id,
        revokedBy: created.creator.id,
      }),
    ).toThrow(/already revoked/i);
  });

  it('trusted members can manage invites', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'trusted',
    });
    const stateWithInvite = { ...created.state, invites: [invite] };

    const joined = joinCoop({
      state: stateWithInvite,
      invite,
      displayName: 'Mina',
      seedContribution: 'Trusted member here.',
    });
    const trustedMember = joined.state.members[1] as (typeof joined.state.members)[number];
    expect(trustedMember.role).toBe('trusted');
    expect(canManageInvites(joined.state, trustedMember.id)).toBe(true);

    // Trusted member can generate a new invite and revoke it
    const newInvite = generateInviteCode({
      state: joined.state,
      createdBy: trustedMember.id,
      type: 'member',
    });
    const stateWithNewInvite = { ...joined.state, invites: [...joined.state.invites, newInvite] };
    const revokedState = revokeInviteCode({
      state: stateWithNewInvite,
      inviteId: newInvite.id,
      revokedBy: trustedMember.id,
    });
    expect(revokedState.invites.find((i) => i.id === newInvite.id)?.status).toBe('revoked');
  });

  it('allows a member to leave a coop and removes their member account', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });
    const joined = joinCoop({
      state: { ...created.state, invites: [invite] },
      invite,
      displayName: 'Mina',
      seedContribution: 'Regular member here.',
    });
    const regularMember = joined.state.members[1] as (typeof joined.state.members)[number];

    const result = leaveCoop({ state: joined.state, memberId: regularMember.id });

    expect(result.state.members).toHaveLength(1);
    expect(result.state.members[0]?.id).toBe(created.creator.id);
    expect(result.removedMember.id).toBe(regularMember.id);
    expect(result.state.memberAccounts.every((a) => a.memberId !== regularMember.id)).toBe(true);
    expect(result.state.profile.active).toBe(true);
  });

  it('prevents the creator from leaving while other members remain', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });
    const invite = generateInviteCode({
      state: created.state,
      createdBy: created.creator.id,
      type: 'member',
    });
    const joined = joinCoop({
      state: { ...created.state, invites: [invite] },
      invite,
      displayName: 'Mina',
      seedContribution: 'Regular member here.',
    });

    expect(() => leaveCoop({ state: joined.state, memberId: created.creator.id })).toThrow(
      /creator cannot leave while other members remain/i,
    );
  });

  it('allows the creator to leave when they are the last member, deactivating the coop', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });

    const result = leaveCoop({ state: created.state, memberId: created.creator.id });

    expect(result.state.members).toHaveLength(0);
    expect(result.state.profile.active).toBe(false);
    expect(result.removedMember.id).toBe(created.creator.id);
  });

  it('throws when attempting to remove a non-existent member', () => {
    const created = createCoop({
      coopName: 'Forest Coop',
      purpose: 'Coordinate forest stewardship.',
      creatorDisplayName: 'June',
      captureMode: 'manual',
      seedContribution: 'Starter note.',
      setupInsights: buildSetupInsights(),
    });

    expect(() => leaveCoop({ state: created.state, memberId: 'nonexistent-id' })).toThrow(
      /member not found/i,
    );
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
