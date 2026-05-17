import type * as Y from 'yjs';
import {
  type CoopSharedState,
  type InviteCode,
  type InviteCoopBootstrapSnapshot,
  type InviteType,
  type MemberRole,
  coopBootstrapSnapshotSchema,
  coopSharedStateSchema,
  inviteCodeSchema,
} from '../../contracts/schema';
import { createId, decodeBase64Url, encodeBase64Url, hashText, nowIso } from '../../utils';
import {
  createBootstrapSyncRoomConfig,
  deriveInviteHandoffRoomId,
  isBootstrapSyncRoomConfig,
  toSyncRoomBootstrap,
  updateCoopState,
} from './sync';

const INVITE_MANAGER_ROLES: MemberRole[] = ['creator', 'trusted'];
export const DEFAULT_INVITE_TYPES: InviteType[] = ['member', 'trusted'];

/**
 * Extracts a bootstrap snapshot from the current coop state for embedding in invite codes.
 * @param state - Current coop shared state
 * @returns A snapshot containing the essential coop state needed to bootstrap a joining member
 */
export function createInviteBootstrapSnapshot(state: CoopSharedState): InviteCoopBootstrapSnapshot {
  return {
    profile: state.profile,
    setupInsights: state.setupInsights,
    soul: state.soul,
    rituals: state.rituals,
    members: state.members,
    memberAccounts: state.memberAccounts,
    artifacts: state.artifacts,
    reviewBoard: state.reviewBoard,
    archiveReceipts: state.archiveReceipts,
    memoryProfile: state.memoryProfile,
    syncRoom: toSyncRoomBootstrap(state.syncRoom),
    onchainState: state.onchainState,
    greenGoods: state.greenGoods,
  };
}

/**
 * Reconstructs a full coop shared state from an invite code's embedded bootstrap snapshot.
 * @param invite - Parsed invite code containing the bootstrap state
 * @returns A validated CoopSharedState hydrated from the invite's bootstrap data
 * @throws If the invite is missing its bootstrap state
 */
export function createStateFromInviteBootstrap(invite: InviteCode) {
  if (!invite.bootstrap.bootstrapState) {
    throw new Error('Invite is missing coop bootstrap state.');
  }

  return coopSharedStateSchema.parse({
    ...invite.bootstrap.bootstrapState,
    syncRoom: createBootstrapSyncRoomConfig(invite.bootstrap.bootstrapState.syncRoom, invite.id),
    invites: [invite],
  });
}

function serializeInviteBootstrapForProof(input: {
  coopId: string;
  coopDisplayName: string;
  inviteId: string;
  inviteType: InviteType;
  expiresAt: string;
  roomId: string;
  signalingUrls: string[];
  handoff?: InviteCode['bootstrap']['handoff'];
  bootstrapState?: InviteCoopBootstrapSnapshot;
}) {
  return JSON.stringify({
    coopId: input.coopId,
    coopDisplayName: input.coopDisplayName,
    inviteId: input.inviteId,
    inviteType: input.inviteType,
    expiresAt: input.expiresAt,
    roomId: input.roomId,
    signalingUrls: input.signalingUrls,
    handoff: input.handoff
      ? {
          inviteId: input.handoff.inviteId,
          roomId: input.handoff.roomId,
          roomSecret: input.handoff.roomSecret,
          signalingUrls: input.handoff.signalingUrls,
        }
      : undefined,
    bootstrapState: input.bootstrapState,
  });
}

/**
 * Generates a cryptographic proof for an invite code using the coop's signing secret.
 * @param bootstrap - Invite bootstrap data (without the proof field)
 * @param inviteSigningSecret - The coop's invite signing secret
 * @returns A hash string serving as the invite integrity proof
 */
export function createInviteProof(
  bootstrap: Omit<InviteCode['bootstrap'], 'inviteProof'>,
  inviteSigningSecret: string,
) {
  return hashText(`${inviteSigningSecret}:${serializeInviteBootstrapForProof(bootstrap)}`);
}

/**
 * Verifies that an invite code's proof matches the expected hash for the coop's signing secret.
 * @param invite - The invite code to verify
 * @param inviteSigningSecret - The coop's invite signing secret
 * @returns True if the invite proof is valid
 */
export function verifyInviteCodeProof(invite: InviteCode, inviteSigningSecret: string) {
  return (
    invite.bootstrap.inviteProof ===
    createInviteProof(
      {
        coopId: invite.bootstrap.coopId,
        coopDisplayName: invite.bootstrap.coopDisplayName,
        inviteId: invite.bootstrap.inviteId,
        inviteType: invite.bootstrap.inviteType,
        expiresAt: invite.bootstrap.expiresAt,
        roomId: invite.bootstrap.roomId,
        signalingUrls: invite.bootstrap.signalingUrls,
        handoff: invite.bootstrap.handoff,
        bootstrapState: invite.bootstrap.bootstrapState,
      },
      inviteSigningSecret,
    )
  );
}

/**
 * Decodes and validates a base64url-encoded invite code string.
 * @param code - The raw base64url invite code string
 * @returns A validated InviteCode parsed from the encoded data
 * @throws If the code is malformed or corrupted
 */
export function parseInviteCode(code: string) {
  try {
    const decoded = JSON.parse(decodeBase64Url(code));
    return inviteCodeSchema.parse({
      id: decoded.inviteId,
      type: decoded.inviteType,
      expiresAt: decoded.expiresAt,
      code,
      bootstrap: decoded,
      createdAt: nowIso(),
      createdBy: 'external',
      usedByMemberIds: [],
    });
  } catch {
    throw new Error('Invite code is malformed or corrupted.');
  }
}

/**
 * Checks whether an invite code is still within its expiry window.
 * @param input - Object with the invite code and optional reference time
 * @param input.invite - The invite code to check
 * @param input.now - Reference time for expiry check (defaults to current time)
 * @returns True if the invite has not expired
 */
export function validateInvite(input: { invite: InviteCode; now?: Date }) {
  const now = input.now ?? new Date();
  return new Date(input.invite.expiresAt).getTime() > now.getTime();
}

/**
 * Appends an invite code to the coop's shared state invite list.
 * @param state - Current coop shared state
 * @param invite - The invite code to add
 * @returns Updated coop state with the new invite appended
 */
export function addInviteToState(state: CoopSharedState, invite: InviteCode) {
  return coopSharedStateSchema.parse({
    ...state,
    invites: [...state.invites, invite],
  });
}

/**
 * Returns true when a coop already has invite history for the given type.
 * @param state - Current coop shared state
 * @param inviteType - Invite type to inspect
 * @returns True when at least one invite of the requested type exists
 */
export function hasInviteHistoryForType(
  state: Pick<CoopSharedState, 'invites'>,
  inviteType: InviteType,
) {
  return (state.invites ?? []).some((invite) => invite.type === inviteType);
}

/**
 * Returns the canonical current invite for a type: the newest non-revoked invite.
 * Used invites still count as current until explicitly revoked or replaced.
 * @param state - Coop state containing invite history
 * @param inviteType - Invite type to resolve
 * @returns The newest non-revoked invite for the requested type, if any
 */
export function getCurrentInviteForType(
  state: Pick<CoopSharedState, 'invites'>,
  inviteType: InviteType,
) {
  return (state.invites ?? [])
    .filter((invite) => invite.type === inviteType && invite.status !== 'revoked')
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return rightTime - leftTime;
    })[0];
}

/**
 * Generates a signed invite code for a coop, embedding a bootstrap snapshot of the current state.
 * @param input - Object containing the coop state, creator member ID, invite type, and optional expiry
 * @returns A validated InviteCode with an encoded shareable code string
 * @throws If sync has not completed on this member or if the member lacks invite permissions
 */
export function generateInviteCode(input: {
  state: CoopSharedState;
  createdBy: string;
  type: InviteType;
  expiresInHours?: number;
}) {
  if (isBootstrapSyncRoomConfig(input.state.syncRoom)) {
    throw new Error('Invites are unavailable until sync completes on this member.');
  }
  if (!canManageInvites(input.state, input.createdBy)) {
    throw new Error('Only creators and trusted members can generate invites.');
  }

  const inviteId = createId('invite');
  const handoffSecret = createId('invite-room-secret');
  const expiresInHours = input.expiresInHours ?? (input.type === 'trusted' ? 48 : 24 * 7);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
  const handoff = {
    inviteId,
    roomSecret: handoffSecret,
    roomId: deriveInviteHandoffRoomId(inviteId, handoffSecret),
    signalingUrls: input.state.syncRoom.signalingUrls,
  };
  const bootstrapBase = {
    coopId: input.state.profile.id,
    coopDisplayName: input.state.profile.name,
    inviteId,
    inviteType: input.type,
    expiresAt,
    roomId: input.state.syncRoom.roomId,
    signalingUrls: input.state.syncRoom.signalingUrls,
    handoff,
    bootstrapState: createInviteBootstrapSnapshot(input.state),
  };
  const bootstrap = {
    ...bootstrapBase,
    inviteProof: createInviteProof(bootstrapBase, input.state.syncRoom.inviteSigningSecret),
  };
  const code = encodeBase64Url(JSON.stringify(bootstrap));
  return inviteCodeSchema.parse({
    id: inviteId,
    type: input.type,
    expiresAt,
    code,
    bootstrap,
    createdAt: nowIso(),
    createdBy: input.createdBy,
    usedByMemberIds: [],
  });
}

/**
 * Ensures canonical invites exist for any requested type that has no history yet.
 * Explicitly revoked types are not recreated because they still have history.
 * @param input - Coop state, acting member, and optional subset of types to seed
 * @returns Updated state including any newly created invite codes
 */
export function ensureInviteCodes(input: {
  state: CoopSharedState;
  createdBy: string;
  inviteTypes?: InviteType[];
}) {
  const inviteTypes = input.inviteTypes ?? DEFAULT_INVITE_TYPES;
  let nextState = input.state;

  for (const inviteType of inviteTypes) {
    if (hasInviteHistoryForType(nextState, inviteType)) {
      continue;
    }
    const invite = generateInviteCode({
      state: nextState,
      createdBy: input.createdBy,
      type: inviteType,
    });
    nextState = addInviteToState(nextState, invite);
  }

  return nextState;
}

/**
 * Seeds canonical member and trusted invite codes for a brand-new coop.
 * @param input - Coop state and creator member ID
 * @returns Updated state with default invite codes persisted
 */
export function seedDefaultInviteCodes(input: { state: CoopSharedState; createdBy: string }) {
  return ensureInviteCodes(input);
}

// ---------------------------------------------------------------------------
// Invite lifecycle
// ---------------------------------------------------------------------------

/**
 * Checks whether a member has permission to create or revoke invite codes.
 * @param state - Current coop shared state
 * @param memberId - ID of the member to check
 * @returns True if the member is a creator or trusted member
 */
export function canManageInvites(state: CoopSharedState, memberId: string): boolean {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return false;
  return INVITE_MANAGER_ROLES.includes(member.role);
}

export type ComputedInviteStatus = 'active' | 'revoked' | 'expired' | 'used';

/**
 * Computes the effective status of an invite code considering revocation, expiry, and usage.
 * @param invite - The invite code to evaluate
 * @param now - Optional reference time for expiry check
 * @returns The computed status: 'active', 'revoked', 'expired', or 'used'
 */
export function getComputedInviteStatus(invite: InviteCode, now?: Date): ComputedInviteStatus {
  if (invite.status === 'revoked') return 'revoked';
  if (!validateInvite({ invite, now })) return 'expired';
  if (invite.usedByMemberIds.length > 0) return 'used';
  return 'active';
}

/**
 * Revokes an active invite code, preventing further use.
 * @param input - Object with the coop state, invite ID, and revoking member ID
 * @returns Updated coop state with the invite marked as revoked
 * @throws If the revoker lacks permissions, or the invite is not found or already revoked
 */
export function revokeInviteCode(input: {
  state: CoopSharedState;
  inviteId: string;
  revokedBy: string;
}): CoopSharedState {
  if (!canManageInvites(input.state, input.revokedBy)) {
    throw new Error('Only creators and trusted members can revoke invites.');
  }

  const invite = input.state.invites.find((i) => i.id === input.inviteId);
  if (!invite) {
    throw new Error('Invite not found.');
  }
  if (invite.status === 'revoked') {
    throw new Error('Invite is already revoked.');
  }

  return coopSharedStateSchema.parse({
    ...input.state,
    invites: input.state.invites.map((i) =>
      i.id === input.inviteId
        ? { ...i, status: 'revoked' as const, revokedAt: nowIso(), revokedBy: input.revokedBy }
        : i,
    ),
  });
}

/**
 * Revokes every non-revoked invite for a given invite type.
 * @param input - Coop state, target invite type, and the revoking member ID
 * @returns Updated state with all matching live invites marked revoked
 * @throws If the acting member lacks invite permissions
 */
export function revokeInviteType(input: {
  state: CoopSharedState;
  inviteType: InviteType;
  revokedBy: string;
}): CoopSharedState {
  if (!canManageInvites(input.state, input.revokedBy)) {
    throw new Error('Only creators and trusted members can revoke invites.');
  }

  const hasLiveInvite = input.state.invites.some(
    (invite) => invite.type === input.inviteType && invite.status !== 'revoked',
  );
  if (!hasLiveInvite) {
    return input.state;
  }

  return coopSharedStateSchema.parse({
    ...input.state,
    invites: input.state.invites.map((invite) =>
      invite.type === input.inviteType && invite.status !== 'revoked'
        ? {
            ...invite,
            status: 'revoked' as const,
            revokedAt: nowIso(),
            revokedBy: input.revokedBy,
          }
        : invite,
    ),
  });
}

/**
 * Replaces the canonical invite for a type by revoking all live invites and issuing a fresh code.
 * @param input - Coop state, acting member, invite type, and optional expiry override
 * @returns Updated state and the fresh invite code
 */
export function regenerateInviteCode(input: {
  state: CoopSharedState;
  createdBy: string;
  inviteType: InviteType;
  expiresInHours?: number;
}) {
  const revokedState = revokeInviteType({
    state: input.state,
    inviteType: input.inviteType,
    revokedBy: input.createdBy,
  });
  const invite = generateInviteCode({
    state: revokedState,
    createdBy: input.createdBy,
    type: input.inviteType,
    expiresInHours: input.expiresInHours,
  });
  const state = addInviteToState(revokedState, invite);

  return {
    state,
    invite,
  };
}

/**
 * Adds an invite code to the coop state within a Yjs document.
 * @param doc - The Yjs document to update
 * @param invite - The invite code to add
 * @returns The updated coop shared state
 */
export function applyAddInviteToDoc(doc: Y.Doc, invite: InviteCode) {
  return updateCoopState(doc, (current) => addInviteToState(current, invite));
}

/**
 * Revokes an invite code within a Yjs document's coop state.
 * @param doc - The Yjs document to update
 * @param inviteId - ID of the invite to revoke
 * @param revokedBy - Member ID of the revoker
 * @returns The updated coop shared state
 */
export function applyRevokeInviteToDoc(doc: Y.Doc, inviteId: string, revokedBy: string) {
  return updateCoopState(doc, (current) =>
    revokeInviteCode({ state: current, inviteId, revokedBy }),
  );
}
