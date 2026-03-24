import type * as Y from 'yjs';
import {
  type Artifact,
  type CaptureMode,
  type CoopSharedState,
  type CoopSpaceType,
  type GreenGoodsGardenState,
  type InviteCode,
  type InviteCoopBootstrapSnapshot,
  type InviteType,
  type Member,
  type MemberRole,
  type OnchainState,
  type SoundEvent,
  coopBootstrapSnapshotSchema,
  coopSharedStateSchema,
  inviteCodeSchema,
  memberSchema,
  setupInsightsSchema,
} from '../../contracts/schema';
import {
  createId,
  decodeBase64Url,
  encodeBase64Url,
  hashText,
  nowIso,
  slugify,
  toDeterministicAddress,
  truncateWords,
} from '../../utils';
import { createInitialGreenGoodsState } from '../greengoods/greengoods';
import { syncGreenGoodsMemberBindings } from '../greengoods/greengoods';
import { provisionMemberAccounts } from '../member-account/member-account';
import { createUnavailableOnchainState } from '../onchain/onchain';
import { buildMemoryProfileSeed } from './pipeline';
import { formatCoopSpaceTypeLabel } from './presets';
import { buildReviewBoard, updateMemoryProfileFromArtifacts } from './publish';
import {
  createBootstrapSyncRoomConfig,
  createCoopDoc,
  createSyncRoomConfig,
  isBootstrapSyncRoomConfig,
  readCoopState,
  toSyncRoomBootstrap,
  updateCoopState,
} from './sync';

const INVITE_MANAGER_ROLES: MemberRole[] = ['creator', 'trusted'];

export interface CreateCoopInput {
  coopName: string;
  purpose: string;
  spaceType?: CoopSpaceType;
  creatorDisplayName: string;
  setupInsights: unknown;
  captureMode: CaptureMode;
  seedContribution: string;
  signalingUrls?: string[];
  creator?: Member;
  onchainState?: OnchainState;
  greenGoods?: {
    enabled: boolean;
  };
}

export interface JoinCoopInput {
  state: CoopSharedState;
  invite: InviteCode;
  displayName: string;
  seedContribution: string;
  member?: Member;
}

/**
 * Generates a warning message about device-bound passkey identity.
 * @param displayName - Human-readable name of the member
 * @returns Warning string about passkey storage risk
 */
export function createDeviceBoundWarning(displayName: string) {
  return `${displayName}'s passkey is stored on this device profile. Clearing extension data may remove access to this account.`;
}

/**
 * Creates a new coop member with a deterministic address and passkey identity.
 * @param displayName - Human-readable display name
 * @param role - Member role (creator, trusted, member)
 * @param options - Optional overrides for address, auth mode, identity warning, and passkey credential
 * @returns A fully populated Member record
 */
export function createMember(
  displayName: string,
  role: Member['role'],
  options?: Partial<
    Pick<Member, 'address' | 'authMode' | 'identityWarning' | 'passkeyCredentialId'>
  >,
): Member {
  const id = createId('member');
  return {
    id,
    displayName,
    role,
    authMode: options?.authMode ?? 'passkey',
    address: options?.address ?? toDeterministicAddress(`member:${displayName}:${id}`),
    joinedAt: nowIso(),
    identityWarning: options?.identityWarning ?? createDeviceBoundWarning(displayName),
    passkeyCredentialId: options?.passkeyCredentialId,
  };
}

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
        bootstrapState: invite.bootstrap.bootstrapState,
      },
      inviteSigningSecret,
    )
  );
}

function deriveCoopSoul(input: CreateCoopInput) {
  const spaceType = input.spaceType ?? 'community';
  const focusByType: Record<CoopSpaceType, string> = {
    community: 'shared intelligence and coordinated follow-through',
    project: 'project memory and clearer delivery follow-through',
    friends: 'shared plans, recommendations, and small acts of follow-through',
    family: 'household memory, coordination, and care follow-through',
    personal: 'durable personal memory and clearer next steps',
  };

  return {
    purposeStatement: input.purpose,
    toneAndWorkingStyle: 'Warm, observant, playful on the surface, serious in the shared work.',
    usefulSignalDefinition:
      'Artifacts that tighten shared context, surface opportunities, and reduce repeated research.',
    artifactFocus: ['insights', 'funding leads', 'evidence', 'next steps'],
    whyThisCoopExists: `${input.coopName} exists to turn loose tabs into ${focusByType[spaceType]}.`,
    vocabularyTerms: [],
    prohibitedTopics: [],
    confidenceThreshold: 0.72,
  };
}

function deriveRitualDefinition(
  coopName: string,
  captureMode: CaptureMode,
  spaceType: CoopSpaceType,
) {
  const cadenceByType: Record<CoopSpaceType, string> = {
    community: 'Weekly review circle',
    project: 'Weekly working review',
    friends: 'Weekly check-in',
    family: 'Weekly family check-in',
    personal: 'Weekly self-review',
  };
  const facilitatorByType: Record<CoopSpaceType, string> = {
    community: 'A trusted member hosts the review and flags what should be actioned.',
    project: 'A project lead or trusted operator keeps the working review focused and actionable.',
    friends: 'One friend lightly steers the check-in so plans and useful finds do not disappear.',
    family: 'A household organizer keeps the review practical and legible for everyone involved.',
    personal:
      'You review your own queue and decide what should stay private, be shared, or be archived.',
  };
  const namedMomentsByType: Record<CoopSpaceType, string[]> = {
    community: ['Coop updates', `${coopName} weekly review`, 'Manual round-up'],
    project: ['Project sync', `${coopName} working review`, 'Manual round-up'],
    friends: ['Friend check-in', `${coopName} weekly check-in`, 'Manual round-up'],
    family: ['Family check-in', `${coopName} weekly review`, 'Manual round-up'],
    personal: ['Personal checkpoint', `${coopName} self-review`, 'Manual round-up'],
  };

  return {
    weeklyReviewCadence: cadenceByType[spaceType],
    namedMoments: namedMomentsByType[spaceType],
    facilitatorExpectation: facilitatorByType[spaceType],
    defaultCapturePosture:
      captureMode === 'manual'
        ? 'Manual round-up is primary; scheduled scans stay silent.'
        : 'Scheduled scans create drafts, but members still explicitly push into shared memory.',
  };
}

function createInitialArtifacts(input: {
  coopId: string;
  creator: Member;
  setupInsights: ReturnType<typeof setupInsightsSchema.parse>;
  coopName: string;
  purpose: string;
  spaceType: CoopSpaceType;
  seedContribution: string;
}): Artifact[] {
  const createdAt = nowIso();
  const originBase = createId('origin');
  const setupLabel = `${formatCoopSpaceTypeLabel(input.spaceType)} setup synthesis`;
  const seedNextStepByType: Record<CoopSpaceType, string> = {
    community: 'Invite another member so the coop does not remain single-voiced.',
    project: 'Invite the next collaborator so the review loop reflects real project context.',
    friends: 'Invite one more friend if this should become a shared curation loop.',
    family: 'Invite another household member when you are ready to share the family capsule.',
    personal:
      'Pair another device or capture a second note so the personal loop proves out privately.',
  };
  return [
    {
      id: createId('artifact'),
      originId: originBase,
      targetCoopId: input.coopId,
      title: 'Setup Insights',
      summary: truncateWords(input.setupInsights.summary, 36),
      sources: [
        {
          label: setupLabel,
          url: `coop://${slugify(input.coopName)}/setup-insights`,
          domain: 'coop.local',
        },
      ],
      tags: input.setupInsights.lenses.map((lens) => lens.lens),
      category: 'setup-insight',
      whyItMatters: 'This grounds routing and review in the coop’s actual context.',
      suggestedNextStep: 'Use this as the baseline vocabulary for capture and review.',
      createdBy: input.creator.id,
      createdAt,
      reviewStatus: 'published',
      archiveStatus: 'not-archived',
      attachments: [],
      archiveReceiptIds: [],
    },
    {
      id: createId('artifact'),
      originId: originBase,
      targetCoopId: input.coopId,
      title: 'Coop Soul',
      summary: truncateWords(input.purpose, 28),
      sources: [
        {
          label: 'Coop purpose',
          url: `coop://${slugify(input.coopName)}/soul`,
          domain: 'coop.local',
        },
      ],
      tags: ['purpose', 'signal', 'tone'],
      category: 'coop-soul',
      whyItMatters: 'This gives the coop a durable, legible sense of what matters.',
      suggestedNextStep: 'Refine this after the first weekly review if the language feels off.',
      createdBy: input.creator.id,
      createdAt,
      reviewStatus: 'published',
      archiveStatus: 'not-archived',
      attachments: [],
      archiveReceiptIds: [],
    },
    {
      id: createId('artifact'),
      originId: originBase,
      targetCoopId: input.coopId,
      title: 'Rituals',
      summary: 'Weekly review and explicit push define the shared-memory membrane.',
      sources: [
        {
          label: 'Coop rituals',
          url: `coop://${slugify(input.coopName)}/rituals`,
          domain: 'coop.local',
        },
      ],
      tags: ['ritual', 'review', 'manual-round-up'],
      category: 'ritual',
      whyItMatters: 'It keeps Coop from becoming an empty queue or automatic publishing bot.',
      suggestedNextStep: 'Use manual round-up as the demo-critical path.',
      createdBy: input.creator.id,
      createdAt,
      reviewStatus: 'published',
      archiveStatus: 'not-archived',
      attachments: [],
      archiveReceiptIds: [],
    },
    {
      id: createId('artifact'),
      originId: originBase,
      targetCoopId: input.coopId,
      title: `${input.creator.displayName}'s Seed Contribution`,
      summary: truncateWords(input.seedContribution, 28),
      sources: [
        {
          label: 'Seed contribution',
          url: `coop://${slugify(input.coopName)}/seed/${input.creator.id}`,
          domain: 'coop.local',
        },
      ],
      tags: ['seed', 'intro'],
      category: 'seed-contribution',
      whyItMatters: 'It gives the coop a first human artifact before passive capture starts.',
      suggestedNextStep: seedNextStepByType[input.spaceType],
      createdBy: input.creator.id,
      createdAt,
      reviewStatus: 'published',
      archiveStatus: 'not-archived',
      attachments: [],
      archiveReceiptIds: [],
    },
  ];
}

/**
 * Creates a new coop with its initial state, Yjs document, creator member, and seed artifacts.
 * Derives the coop soul, rituals, onchain state, and optional Green Goods integration.
 * @param input - Coop creation parameters including name, purpose, space type, and creator info
 * @returns Object containing the validated state, Yjs doc, creator member, and sound event
 */
export function createCoop(input: CreateCoopInput) {
  const setupInsights = setupInsightsSchema.parse(input.setupInsights);
  const spaceType = input.spaceType ?? 'community';
  const creator = input.creator
    ? memberSchema.parse({
        ...input.creator,
        displayName: input.creatorDisplayName || input.creator.displayName,
        role: 'creator',
      })
    : createMember(input.creatorDisplayName, 'creator');
  const coopId = createId('coop');
  const syncRoom = createSyncRoomConfig(coopId, input.signalingUrls);
  const onchainState =
    input.onchainState ??
    createUnavailableOnchainState({
      safeAddressSeed: `${coopId}:${creator.address}`,
      senderAddress: creator.address,
    });
  const profile = {
    id: coopId,
    name: input.coopName,
    purpose: input.purpose,
    spaceType,
    createdAt: nowIso(),
    createdBy: creator.id,
    captureMode: input.captureMode,
    safeAddress: onchainState.safeAddress,
    active: true,
  };
  const soul = deriveCoopSoul({ ...input, spaceType });
  const rituals = [deriveRitualDefinition(input.coopName, input.captureMode, spaceType)];
  const artifacts = createInitialArtifacts({
    coopId,
    creator,
    setupInsights,
    coopName: input.coopName,
    purpose: input.purpose,
    spaceType,
    seedContribution: input.seedContribution,
  });
  creator.seedContributionId = artifacts[3]?.id;
  const memberAccounts = provisionMemberAccounts({
    members: [creator],
    existingAccounts: [],
    coopId,
    chainKey: onchainState.chainKey,
    accountType: 'kernel',
  });
  const greenGoods: GreenGoodsGardenState | undefined = input.greenGoods?.enabled
    ? {
        ...createInitialGreenGoodsState({
          coopName: input.coopName,
          purpose: input.purpose,
          setupInsights,
        }),
        memberBindings: syncGreenGoodsMemberBindings({
          members: [creator],
          memberAccounts,
        }),
      }
    : undefined;

  const state = coopSharedStateSchema.parse({
    profile,
    setupInsights,
    soul,
    rituals,
    members: [creator],
    memberAccounts,
    invites: [],
    artifacts,
    reviewBoard: buildReviewBoard(artifacts),
    archiveReceipts: [],
    memoryProfile: updateMemoryProfileFromArtifacts(buildMemoryProfileSeed(), artifacts),
    syncRoom,
    onchainState,
    greenGoods,
  });
  const doc = createCoopDoc(state);

  return {
    state,
    doc,
    creator,
    soundEvent: 'coop-created' as SoundEvent,
  };
}

/**
 * Generates a signed invite code for a coop, embedding a bootstrap snapshot of the current state.
 * @param input - Object containing the coop state, creator member ID, invite type, and optional expiry
 * @param input.state - Current coop shared state
 * @param input.createdBy - Member ID of the invite creator
 * @param input.type - Invite type (trusted or member)
 * @param input.expiresInHours - Custom expiry in hours (defaults to 48h for trusted, 7d for member)
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
  const expiresInHours = input.expiresInHours ?? (input.type === 'trusted' ? 48 : 24 * 7);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
  const bootstrapBase = {
    coopId: input.state.profile.id,
    coopDisplayName: input.state.profile.name,
    inviteId,
    inviteType: input.type,
    expiresAt,
    roomId: input.state.syncRoom.roomId,
    signalingUrls: input.state.syncRoom.signalingUrls,
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
 * Joins an existing coop using a valid invite code, creating a new member and seed artifact.
 * Validates the invite (expiry, revocation, proof, duplicate identity), provisions onchain accounts,
 * and updates the coop state with the new member.
 * @param input - Join parameters including current state, invite code, display name, and seed contribution
 * @returns Object with the updated coop state and the newly created member
 * @throws If the invite is revoked, expired, has a failed integrity check, or the identity is already a member
 */
export function joinCoop(input: JoinCoopInput) {
  const stateInvite = input.state.invites.find((i) => i.id === input.invite.id);
  if (stateInvite?.status === 'revoked') {
    throw new Error('This invite has been revoked.');
  }

  if (!validateInvite({ invite: input.invite })) {
    throw new Error('Invite has expired.');
  }

  if (
    !isBootstrapSyncRoomConfig(input.state.syncRoom) &&
    !verifyInviteCodeProof(input.invite, input.state.syncRoom.inviteSigningSecret)
  ) {
    throw new Error('Invite code integrity check failed.');
  }

  const role = input.invite.type === 'trusted' ? 'trusted' : 'member';
  const member = input.member
    ? memberSchema.parse({
        ...input.member,
        displayName: input.displayName || input.member.displayName,
        role,
      })
    : createMember(input.displayName, role);

  if (input.state.members.some((existing) => existing.address === member.address)) {
    throw new Error('This passkey identity is already a member of the coop.');
  }
  if (
    member.passkeyCredentialId &&
    input.state.members.some(
      (existing) => existing.passkeyCredentialId === member.passkeyCredentialId,
    )
  ) {
    throw new Error('This passkey credential is already linked to a coop member.');
  }

  const seedArtifact: Artifact = {
    id: createId('artifact'),
    originId: createId('origin'),
    targetCoopId: input.state.profile.id,
    title: `${member.displayName}'s Seed Contribution`,
    summary: truncateWords(input.seedContribution, 28),
    sources: [
      {
        label: 'Seed contribution',
        url: `coop://${slugify(input.state.profile.name)}/seed/${member.id}`,
        domain: 'coop.local',
      },
    ],
    tags: ['seed', role],
    category: 'seed-contribution',
    whyItMatters: 'This widens the coop’s starting context and gives the feed another voice.',
    suggestedNextStep: 'Use the next round-up to compare emerging patterns across members.',
    createdBy: member.id,
    createdAt: nowIso(),
    reviewStatus: 'published',
    archiveStatus: 'not-archived',
    attachments: [],
    archiveReceiptIds: [],
  };
  member.seedContributionId = seedArtifact.id;

  const memberAccounts = [
    ...(input.state.memberAccounts ?? []),
    ...provisionMemberAccounts({
      members: [member],
      existingAccounts: input.state.memberAccounts ?? [],
      coopId: input.state.profile.id,
      chainKey: input.state.onchainState.chainKey,
      accountType: 'kernel',
    }),
  ];

  const nextState = coopSharedStateSchema.parse({
    ...input.state,
    members: [...input.state.members, member],
    memberAccounts,
    invites: input.state.invites.map((invite) =>
      invite.id === input.invite.id
        ? { ...invite, usedByMemberIds: [...invite.usedByMemberIds, member.id] }
        : invite,
    ),
    artifacts: [...input.state.artifacts, seedArtifact],
    greenGoods: input.state.greenGoods
      ? {
          ...input.state.greenGoods,
          memberBindings: syncGreenGoodsMemberBindings({
            current: input.state.greenGoods,
            members: [...input.state.members, member],
            memberAccounts,
          }),
        }
      : input.state.greenGoods,
  });

  nextState.reviewBoard = buildReviewBoard(nextState.artifacts);
  nextState.memoryProfile = updateMemoryProfileFromArtifacts(nextState.memoryProfile, [
    seedArtifact,
  ]);

  return { state: nextState, member };
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
 * Applies a join operation directly to a Yjs document, updating its coop state in place.
 * @param doc - The Yjs document to update
 * @param invite - The invite code used to join
 * @param displayName - Display name for the joining member
 * @param seedContribution - The member's seed contribution text
 * @returns The updated coop shared state
 */
export function applyJoinToDoc(
  doc: Y.Doc,
  invite: InviteCode,
  displayName: string,
  seedContribution: string,
) {
  return updateCoopState(
    doc,
    (current) => joinCoop({ state: current, invite, displayName, seedContribution }).state,
  );
}

/**
 * Reads the current coop shared state from a Yjs document.
 * @param doc - The Yjs document containing coop state
 * @returns The parsed coop shared state
 */
export function readStateFromDoc(doc: Y.Doc) {
  return readCoopState(doc);
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
