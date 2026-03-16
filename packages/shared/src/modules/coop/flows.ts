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

export function createDeviceBoundWarning(displayName: string) {
  return `${displayName}'s passkey is stored on this device profile. Clearing extension data may remove access to this account.`;
}

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

export function createInviteBootstrapSnapshot(state: CoopSharedState): InviteCoopBootstrapSnapshot {
  return {
    profile: state.profile,
    setupInsights: state.setupInsights,
    soul: state.soul,
    rituals: state.rituals,
    members: state.members,
    artifacts: state.artifacts,
    reviewBoard: state.reviewBoard,
    archiveReceipts: state.archiveReceipts,
    memoryProfile: state.memoryProfile,
    syncRoom: toSyncRoomBootstrap(state.syncRoom),
    onchainState: state.onchainState,
    greenGoods: state.greenGoods,
  };
}

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

export function createInviteProof(
  bootstrap: Omit<InviteCode['bootstrap'], 'inviteProof'>,
  inviteSigningSecret: string,
) {
  return hashText(`${inviteSigningSecret}:${serializeInviteBootstrapForProof(bootstrap)}`);
}

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
      archiveReceiptIds: [],
    },
  ];
}

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
  const greenGoods: GreenGoodsGardenState | undefined = input.greenGoods?.enabled
    ? createInitialGreenGoodsState({
        coopName: input.coopName,
        purpose: input.purpose,
        setupInsights,
      })
    : undefined;

  const state = coopSharedStateSchema.parse({
    profile,
    setupInsights,
    soul,
    rituals,
    members: [creator],
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

export function generateInviteCode(input: {
  state: CoopSharedState;
  createdBy: string;
  type: InviteType;
  expiresInHours?: number;
}) {
  if (isBootstrapSyncRoomConfig(input.state.syncRoom)) {
    throw new Error('Invites are unavailable until sync completes on this member.');
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

export function validateInvite(input: { invite: InviteCode; now?: Date }) {
  const now = input.now ?? new Date();
  return new Date(input.invite.expiresAt).getTime() > now.getTime();
}

export function joinCoop(input: JoinCoopInput) {
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
    archiveReceiptIds: [],
  };
  member.seedContributionId = seedArtifact.id;

  const nextState = coopSharedStateSchema.parse({
    ...input.state,
    members: [...input.state.members, member],
    invites: input.state.invites.map((invite) =>
      invite.id === input.invite.id
        ? { ...invite, usedByMemberIds: [...invite.usedByMemberIds, member.id] }
        : invite,
    ),
    artifacts: [...input.state.artifacts, seedArtifact],
  });

  nextState.reviewBoard = buildReviewBoard(nextState.artifacts);
  nextState.memoryProfile = updateMemoryProfileFromArtifacts(nextState.memoryProfile, [
    seedArtifact,
  ]);

  return { state: nextState, member };
}

export function addInviteToState(state: CoopSharedState, invite: InviteCode) {
  return coopSharedStateSchema.parse({
    ...state,
    invites: [...state.invites, invite],
  });
}

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

export function readStateFromDoc(doc: Y.Doc) {
  return readCoopState(doc);
}
