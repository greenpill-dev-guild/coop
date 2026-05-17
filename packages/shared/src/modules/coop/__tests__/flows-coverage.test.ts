/**
 * Focused tests for coop/flows.ts — covering functions and paths not exercised
 * by the existing flows.test.ts suite.
 *
 * Targets:
 *  - createMember (isolated output shape)
 *  - createDeviceBoundWarning
 *  - createInviteBootstrapSnapshot
 *  - addInviteToState
 *  - validateInvite (edge cases)
 *  - updateCoopDetails (profile, soul, bidirectional sync)
 *  - updateCoopMeetingSettings (happy path, empty moments, no rituals)
 *  - leaveCoop (cleanup edge cases)
 *  - canManageInvites (edge cases)
 */

import { describe, expect, it } from 'vitest';
import { makeSetupInsights } from '../../../__tests__/fixtures';
import {
  addInviteToState,
  canManageInvites,
  createCoop,
  createDeviceBoundWarning,
  createInviteBootstrapSnapshot,
  createMember,
  generateInviteCode,
  joinCoop,
  leaveCoop,
  updateCoopDetails,
  updateCoopMeetingSettings,
  validateInvite,
} from '../flows';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function quickCoop(overrides?: Partial<Parameters<typeof createCoop>[0]>) {
  return createCoop({
    coopName: 'Test Coop',
    purpose: 'Unit-test coop for coverage.',
    creatorDisplayName: 'Tester',
    captureMode: 'manual',
    seedContribution: 'Seed note for tests.',
    setupInsights: makeSetupInsights(),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// createDeviceBoundWarning
// ---------------------------------------------------------------------------

describe('createDeviceBoundWarning', () => {
  it('includes the display name in the warning text', () => {
    const warning = createDeviceBoundWarning('June');
    expect(warning).toContain('June');
    expect(warning).toContain('passkey');
  });

  it('handles an empty display name without crashing', () => {
    const warning = createDeviceBoundWarning('');
    expect(typeof warning).toBe('string');
    expect(warning).toContain('passkey');
  });
});

// ---------------------------------------------------------------------------
// createMember (isolated)
// ---------------------------------------------------------------------------

describe('createMember', () => {
  it('returns a member with an ID, deterministic address, and passkey auth mode', () => {
    const member = createMember('June', 'creator');
    expect(member.id).toMatch(/^member-/);
    expect(member.displayName).toBe('June');
    expect(member.role).toBe('creator');
    expect(member.authMode).toBe('passkey');
    expect(member.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(member.joinedAt).toBeDefined();
    expect(member.identityWarning).toContain('June');
  });

  it('applies optional overrides for address and authMode', () => {
    const member = createMember('Kai', 'member', {
      address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
      authMode: 'wallet',
    });
    expect(member.address).toBe('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');
    expect(member.authMode).toBe('wallet');
  });

  it('applies optional passkeyCredentialId', () => {
    const member = createMember('Kai', 'trusted', {
      passkeyCredentialId: 'cred-123',
    });
    expect(member.passkeyCredentialId).toBe('cred-123');
  });

  it('generates unique IDs for successive calls', () => {
    const a = createMember('A', 'member');
    const b = createMember('B', 'member');
    expect(a.id).not.toBe(b.id);
    expect(a.address).not.toBe(b.address);
  });
});

describe('createCoop memory charter bootstrap', () => {
  it('derives a memory charter from purpose and setup insights', () => {
    const { state, creator } = quickCoop({
      coopName: 'Memory Loop Coop',
      purpose: 'Track local source-backed knowledge and reviewable memory.',
      setupInsights: makeSetupInsights({
        crossCuttingPainPoints: ['Knowledge is fragmented across tools'],
        crossCuttingOpportunities: ['Members can publish cleaner shared artifacts'],
      }),
    });

    expect(state.soul.memoryCharter).toMatchObject({
      version: 1,
      updatedByMemberId: creator.id,
      confidenceThreshold: state.soul.confidenceThreshold,
    });
    expect(state.soul.memoryCharter?.goals).toEqual(
      expect.arrayContaining([
        'Track local source-backed knowledge and reviewable memory',
        'Members can publish cleaner shared artifacts',
      ]),
    );
    expect(state.soul.memoryCharter?.evidenceStandards).toEqual(
      expect.arrayContaining([
        'Prefer member-approved artifacts before treating a memory as shared truth',
        'Keep source provenance visible on recommendations',
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// createInviteBootstrapSnapshot
// ---------------------------------------------------------------------------

describe('createInviteBootstrapSnapshot', () => {
  it('extracts profile, soul, members, and artifacts from the state', () => {
    const { state } = quickCoop();
    const snapshot = createInviteBootstrapSnapshot(state);

    expect(snapshot.profile.id).toBe(state.profile.id);
    expect(snapshot.profile.name).toBe(state.profile.name);
    expect(snapshot.soul.purposeStatement).toBe(state.soul.purposeStatement);
    expect(snapshot.members).toHaveLength(state.members.length);
    expect(snapshot.artifacts).toHaveLength(state.artifacts.length);
    expect(snapshot.setupInsights.summary).toBe(state.setupInsights.summary);
  });

  it('includes the syncRoom bootstrap variant (roomId present)', () => {
    const { state } = quickCoop();
    const snapshot = createInviteBootstrapSnapshot(state);
    expect(snapshot.syncRoom.roomId).toBe(state.syncRoom.roomId);
  });

  it('carries onchainState forward', () => {
    const { state } = quickCoop();
    const snapshot = createInviteBootstrapSnapshot(state);
    expect(snapshot.onchainState.safeAddress).toBe(state.onchainState.safeAddress);
  });
});

// ---------------------------------------------------------------------------
// addInviteToState
// ---------------------------------------------------------------------------

describe('addInviteToState', () => {
  it('appends an invite and preserves existing invites', () => {
    const { state, creator } = quickCoop();
    const originalInviteCount = state.invites.length;

    const invite = generateInviteCode({
      state,
      createdBy: creator.id,
      type: 'member',
    });

    const next = addInviteToState(state, invite);
    expect(next.invites).toHaveLength(originalInviteCount + 1);
    expect(next.invites.at(-1)?.id).toBe(invite.id);
    // Original invites are still there
    for (const orig of state.invites) {
      expect(next.invites.some((i) => i.id === orig.id)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// validateInvite
// ---------------------------------------------------------------------------

describe('validateInvite', () => {
  it('returns true for a future expiry', () => {
    const { state, creator } = quickCoop();
    const invite = generateInviteCode({
      state,
      createdBy: creator.id,
      type: 'member',
    });
    expect(validateInvite({ invite })).toBe(true);
  });

  it('returns false when the invite has expired', () => {
    const { state, creator } = quickCoop();
    const invite = generateInviteCode({
      state,
      createdBy: creator.id,
      type: 'member',
    });
    const expired = { ...invite, expiresAt: '2020-01-01T00:00:00.000Z' };
    expect(validateInvite({ invite: expired })).toBe(false);
  });

  it('respects a custom now reference time', () => {
    const { state, creator } = quickCoop();
    const invite = generateInviteCode({
      state,
      createdBy: creator.id,
      type: 'member',
      expiresInHours: 1,
    });

    // An hour in the future: still valid
    const slightlyBefore = new Date(Date.now() + 30 * 60 * 1000);
    expect(validateInvite({ invite, now: slightlyBefore })).toBe(true);

    // Two hours in the future: expired
    const wellAfter = new Date(Date.now() + 3 * 60 * 60 * 1000);
    expect(validateInvite({ invite, now: wellAfter })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateCoopDetails
// ---------------------------------------------------------------------------

describe('updateCoopDetails', () => {
  it('updates the coop name and purpose', () => {
    const { state } = quickCoop();
    const updated = updateCoopDetails({
      state,
      profile: {
        name: 'Renamed Coop',
        purpose: 'A new purpose statement.',
      },
    });

    expect(updated.profile.name).toBe('Renamed Coop');
    expect(updated.profile.purpose).toBe('A new purpose statement.');
    // Should NOT change soul if only profile was provided
    expect(updated.soul.purposeStatement).toBe('A new purpose statement.');
  });

  it('syncs purpose to soul.purposeStatement when purpose is updated alone', () => {
    const { state } = quickCoop();
    const updated = updateCoopDetails({
      state,
      profile: { purpose: 'Synced purpose.' },
    });

    expect(updated.profile.purpose).toBe('Synced purpose.');
    expect(updated.soul.purposeStatement).toBe('Synced purpose.');
  });

  it('syncs soul.purposeStatement to profile.purpose when purposeStatement is updated alone', () => {
    const { state } = quickCoop();
    const updated = updateCoopDetails({
      state,
      soul: { purposeStatement: 'Soul-driven purpose.' },
    });

    expect(updated.soul.purposeStatement).toBe('Soul-driven purpose.');
    expect(updated.profile.purpose).toBe('Soul-driven purpose.');
  });

  it('does not cross-sync when both purpose and purposeStatement are provided', () => {
    const { state } = quickCoop();
    const updated = updateCoopDetails({
      state,
      profile: { purpose: 'Profile says this.' },
      soul: { purposeStatement: 'Soul says that.' },
    });

    expect(updated.profile.purpose).toBe('Profile says this.');
    expect(updated.soul.purposeStatement).toBe('Soul says that.');
  });

  it('updates soul fields without touching profile', () => {
    const { state } = quickCoop();
    const updated = updateCoopDetails({
      state,
      soul: {
        whyThisCoopExists: 'Because tests need it.',
        toneAndWorkingStyle: 'Casual and iterative.',
        artifactFocus: ['coverage', 'testing'],
      },
    });

    expect(updated.soul.whyThisCoopExists).toBe('Because tests need it.');
    expect(updated.soul.toneAndWorkingStyle).toBe('Casual and iterative.');
    expect(updated.soul.artifactFocus).toEqual(['coverage', 'testing']);
    // Profile unchanged
    expect(updated.profile.name).toBe(state.profile.name);
  });

  it('persists member-authored memory charter edits through coop detail updates', () => {
    const { state } = quickCoop();
    const originalCharter = state.soul.memoryCharter;
    expect(originalCharter).toBeDefined();

    const updated = updateCoopDetails({
      state,
      soul: {
        memoryCharter: {
          ...originalCharter,
          version: 1,
          goals: ['Track local memory loop behavior', 'Keep provenance visible'],
          opportunityThesis: 'Coop memory should stay source-backed and member-reviewable.',
          desiredSignals: ['reviewed source provenance', 'member-approved insight summaries'],
          antiSignals: ['raw captures in shared state', 'unconfirmed graph facts as truth'],
          evidenceStandards: [
            'Prefer member-approved artifacts before treating a memory as shared truth',
            'Keep source provenance visible on recommendations',
          ],
          vocabulary: ['context graph', 'memory charter'],
          prohibitedTopics: ['raw prompts'],
          confidenceThreshold: 0.81,
          updatedAt: '2026-05-16T12:00:00.000Z',
          updatedByMemberId: state.members[0].id,
        },
      },
    });

    expect(updated.soul.memoryCharter).toMatchObject({
      goals: ['Track local memory loop behavior', 'Keep provenance visible'],
      opportunityThesis: 'Coop memory should stay source-backed and member-reviewable.',
      desiredSignals: ['reviewed source provenance', 'member-approved insight summaries'],
      antiSignals: ['raw captures in shared state', 'unconfirmed graph facts as truth'],
      confidenceThreshold: 0.81,
      updatedByMemberId: state.members[0].id,
    });
    expect(updated.profile.purpose).toBe(state.profile.purpose);
  });

  it('updates capture mode on the profile', () => {
    const { state } = quickCoop();
    const updated = updateCoopDetails({
      state,
      profile: { captureMode: '15-min' },
    });

    expect(updated.profile.captureMode).toBe('15-min');
  });

  it('replaces setupInsights when provided', () => {
    const { state } = quickCoop();
    const newInsights = makeSetupInsights({
      summary: 'Completely new setup summary.',
    });
    const updated = updateCoopDetails({
      state,
      setupInsights: newInsights,
    });

    expect(updated.setupInsights.summary).toBe('Completely new setup summary.');
  });

  it('preserves setupInsights when not provided', () => {
    const { state } = quickCoop();
    const updated = updateCoopDetails({
      state,
      profile: { name: 'Rename Only' },
    });

    expect(updated.setupInsights.summary).toBe(state.setupInsights.summary);
  });

  it('is a no-op (preserves all fields) when called with empty overrides', () => {
    const { state } = quickCoop();
    const updated = updateCoopDetails({ state });

    expect(updated.profile.name).toBe(state.profile.name);
    expect(updated.profile.purpose).toBe(state.profile.purpose);
    expect(updated.soul.purposeStatement).toBe(state.soul.purposeStatement);
  });
});

// ---------------------------------------------------------------------------
// updateCoopMeetingSettings
// ---------------------------------------------------------------------------

describe('updateCoopMeetingSettings', () => {
  it('updates the first ritual with new meeting cadence and moments', () => {
    const { state } = quickCoop();
    const updated = updateCoopMeetingSettings({
      state,
      weeklyReviewCadence: 'Biweekly check-in',
      namedMoments: ['Sprint review', 'Retrospective'],
      facilitatorExpectation: 'Rotate every cycle.',
      defaultCapturePosture: 'Passive capture with weekly triage.',
    });

    expect(updated.rituals[0]?.weeklyReviewCadence).toBe('Biweekly check-in');
    expect(updated.rituals[0]?.namedMoments).toEqual(['Sprint review', 'Retrospective']);
    expect(updated.rituals[0]?.facilitatorExpectation).toBe('Rotate every cycle.');
    expect(updated.rituals[0]?.defaultCapturePosture).toBe('Passive capture with weekly triage.');
  });

  it('trims and filters blank named moments', () => {
    const { state } = quickCoop();
    const updated = updateCoopMeetingSettings({
      state,
      weeklyReviewCadence: 'Weekly',
      namedMoments: ['  Sprint review  ', '', '   ', 'Retrospective'],
      facilitatorExpectation: 'Anyone.',
      defaultCapturePosture: 'Manual.',
    });

    expect(updated.rituals[0]?.namedMoments).toEqual(['Sprint review', 'Retrospective']);
  });

  it('rejects empty namedMoments because the schema requires at least one', () => {
    const { state } = quickCoop();

    expect(() =>
      updateCoopMeetingSettings({
        state,
        weeklyReviewCadence: 'Weekly',
        namedMoments: [],
        facilitatorExpectation: 'The creator.',
        defaultCapturePosture: 'Manual.',
      }),
    ).toThrow();
  });

  it('throws when rituals array is empty', () => {
    const { state } = quickCoop();
    const stateWithNoRituals = { ...state, rituals: [] };

    expect(() =>
      updateCoopMeetingSettings({
        state: stateWithNoRituals,
        weeklyReviewCadence: 'Weekly',
        namedMoments: [],
        facilitatorExpectation: 'n/a',
        defaultCapturePosture: 'n/a',
      }),
    ).toThrow(/meeting settings are unavailable/i);
  });

  it('preserves additional rituals beyond the first', () => {
    const { state } = quickCoop();
    // Simulate a state with two rituals
    const secondRitual = {
      ...state.rituals[0],
      weeklyReviewCadence: 'Second ritual cadence',
    };
    const stateWithTwo = {
      ...state,
      rituals: [...state.rituals, secondRitual],
    };

    const updated = updateCoopMeetingSettings({
      state: stateWithTwo,
      weeklyReviewCadence: 'Updated first',
      namedMoments: ['First moment'],
      facilitatorExpectation: 'Lead.',
      defaultCapturePosture: 'Passive.',
    });

    expect(updated.rituals).toHaveLength(2);
    expect(updated.rituals[0]?.weeklyReviewCadence).toBe('Updated first');
    expect(updated.rituals[1]?.weeklyReviewCadence).toBe('Second ritual cadence');
  });
});

// ---------------------------------------------------------------------------
// canManageInvites (edge cases)
// ---------------------------------------------------------------------------

describe('canManageInvites', () => {
  it('returns false for a member ID that does not exist in the coop', () => {
    const { state } = quickCoop();
    expect(canManageInvites(state, 'nonexistent-member-id')).toBe(false);
  });

  it('returns true for creator role', () => {
    const { state, creator } = quickCoop();
    expect(canManageInvites(state, creator.id)).toBe(true);
  });

  it('returns false for regular member role', () => {
    const { state, creator } = quickCoop();
    const invite = generateInviteCode({
      state,
      createdBy: creator.id,
      type: 'member',
    });
    const joined = joinCoop({
      state: { ...state, invites: [invite] },
      invite,
      displayName: 'Regular',
      seedContribution: 'Seed.',
    });
    const regular = joined.state.members[1];
    expect(regular).toBeDefined();
    expect(canManageInvites(joined.state, regular?.id ?? '')).toBe(false);
  });

  it('returns true for trusted member role', () => {
    const { state, creator } = quickCoop();
    const invite = generateInviteCode({
      state,
      createdBy: creator.id,
      type: 'trusted',
    });
    const joined = joinCoop({
      state: { ...state, invites: [invite] },
      invite,
      displayName: 'Trusted',
      seedContribution: 'Seed.',
    });
    const trusted = joined.state.members[1];
    expect(trusted).toBeDefined();
    expect(canManageInvites(joined.state, trusted?.id ?? '')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// leaveCoop (additional edge cases)
// ---------------------------------------------------------------------------

describe('leaveCoop', () => {
  it('cleans up member accounts when the member leaves', () => {
    const { state, creator } = quickCoop();
    const invite = generateInviteCode({
      state,
      createdBy: creator.id,
      type: 'member',
    });
    const joined = joinCoop({
      state: { ...state, invites: [invite] },
      invite,
      displayName: 'Leaver',
      seedContribution: 'Temporary seed.',
    });
    const leaver = joined.state.members[1];
    expect(leaver).toBeDefined();
    if (!leaver) {
      throw new Error('Expected leaver to exist.');
    }

    const result = leaveCoop({ state: joined.state, memberId: leaver.id });

    expect(result.state.members).toHaveLength(1);
    expect(result.state.memberAccounts.every((a) => a.memberId !== leaver.id)).toBe(true);
    expect(result.removedMember.displayName).toBe('Leaver');
  });

  it('deactivates the coop when the last member leaves', () => {
    const { state, creator } = quickCoop();
    const result = leaveCoop({ state, memberId: creator.id });

    expect(result.state.members).toHaveLength(0);
    expect(result.state.profile.active).toBe(false);
  });

  it('returns the removed member record', () => {
    const { state, creator } = quickCoop();
    const result = leaveCoop({ state, memberId: creator.id });
    expect(result.removedMember.id).toBe(creator.id);
    expect(result.removedMember.displayName).toBe('Tester');
  });
});
