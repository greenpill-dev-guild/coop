import {
  type CoopProfile,
  type CoopSharedState,
  type CoopSoul,
  type Member,
  type SetupInsights,
  coopSharedStateSchema,
} from '../../contracts/schema';

export function updateCoopDetails(input: {
  state: CoopSharedState;
  profile?: Partial<Pick<CoopProfile, 'name' | 'purpose' | 'captureMode'>>;
  soul?: Partial<
    Pick<
      CoopSoul,
      | 'purposeStatement'
      | 'whyThisCoopExists'
      | 'usefulSignalDefinition'
      | 'toneAndWorkingStyle'
      | 'artifactFocus'
      | 'memoryCharter'
    >
  >;
  setupInsights?: SetupInsights;
}) {
  const nextProfile = {
    ...input.state.profile,
    ...(input.profile ?? {}),
  };
  const nextSoul = {
    ...input.state.soul,
    ...(input.soul ?? {}),
  };

  if (input.profile?.purpose !== undefined && input.soul?.purposeStatement === undefined) {
    nextSoul.purposeStatement = input.profile.purpose;
  }
  if (input.soul?.purposeStatement !== undefined && input.profile?.purpose === undefined) {
    nextProfile.purpose = input.soul.purposeStatement;
  }

  return coopSharedStateSchema.parse({
    ...input.state,
    profile: nextProfile,
    soul: nextSoul,
    ...(input.setupInsights ? { setupInsights: input.setupInsights } : {}),
  });
}

export function updateCoopMeetingSettings(input: {
  state: CoopSharedState;
  weeklyReviewCadence: string;
  namedMoments: string[];
  facilitatorExpectation: string;
  defaultCapturePosture: string;
}) {
  const [currentRitual, ...remainingRituals] = input.state.rituals;
  if (!currentRitual) {
    throw new Error('Meeting settings are unavailable for this coop.');
  }

  const namedMoments = input.namedMoments.map((value) => value.trim()).filter(Boolean);

  return coopSharedStateSchema.parse({
    ...input.state,
    rituals: [
      {
        ...currentRitual,
        weeklyReviewCadence: input.weeklyReviewCadence,
        namedMoments,
        facilitatorExpectation: input.facilitatorExpectation,
        defaultCapturePosture: input.defaultCapturePosture,
      },
      ...remainingRituals,
    ],
  });
}

// ---------------------------------------------------------------------------
// Leave coop
// ---------------------------------------------------------------------------

export interface LeaveCoopInput {
  state: CoopSharedState;
  memberId: string;
}

export interface LeaveCoopResult {
  state: CoopSharedState;
  removedMember: Member;
}

/**
 * Removes a member from a coop, cleaning up their accounts and deactivating the coop if empty.
 * @param input - Object with the coop state and the departing member's ID
 * @returns Object with the updated state and the removed member record
 * @throws If the member is not found, or if the creator tries to leave while other members remain
 */
export function leaveCoop(input: LeaveCoopInput): LeaveCoopResult {
  const member = input.state.members.find((m) => m.id === input.memberId);
  if (!member) throw new Error('Member not found in coop.');
  if (member.role === 'creator' && input.state.members.length > 1) {
    throw new Error('The coop creator cannot leave while other members remain.');
  }
  const nextMembers = input.state.members.filter((m) => m.id !== input.memberId);
  const nextMemberAccounts = (input.state.memberAccounts ?? []).filter(
    (a) => a.memberId !== input.memberId,
  );
  const nextState: CoopSharedState = {
    ...input.state,
    members: nextMembers,
    memberAccounts: nextMemberAccounts,
    profile: { ...input.state.profile, active: nextMembers.length > 0 },
  };
  return { state: nextState, removedMember: member };
}
