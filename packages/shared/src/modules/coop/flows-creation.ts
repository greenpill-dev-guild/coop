import type * as Y from 'yjs';
import {
  type Artifact,
  type CaptureMode,
  type CoopSharedState,
  type CoopSpaceType,
  type GreenGoodsGardenState,
  type InviteCode,
  type OnchainState,
  type SoundEvent,
  coopSharedStateSchema,
  memberSchema,
  setupInsightsSchema,
} from '../../contracts/schema';
import { createId, nowIso, slugify, truncateWords } from '../../utils';
// Direct imports to avoid vitest circular dep: coop barrel → these modules → auth → coop
import {
  createInitialGreenGoodsState,
  syncGreenGoodsMemberBindings,
} from '../greengoods/greengoods';
import { provisionMemberAccounts } from '../member-account/member-account';
import { createUnavailableOnchainState } from '../onchain/onchain';
import { seedDefaultInviteCodes, validateInvite, verifyInviteCodeProof } from './flows-invites';
import { createDeviceBoundWarning, createMember } from './member-factory';
import { buildMemoryProfileSeed } from './memory-profile';
import { formatCoopSpaceTypeLabel } from './presets';
import { buildReviewBoard, updateMemoryProfileFromArtifacts } from './publish';
import {
  createCoopDoc,
  createSyncRoomConfig,
  isBootstrapSyncRoomConfig,
  readCoopState,
  updateCoopState,
} from './sync';
import {
  summarizeRitualArtifact,
  summarizeSoulArtifact,
  synthesizeCoopFromPurpose,
} from './synthesis';

export { createDeviceBoundWarning, createMember } from './member-factory';

export interface CreateCoopInput {
  coopName: string;
  purpose: string;
  spaceType?: CoopSpaceType;
  creatorDisplayName: string;
  setupInsights: unknown;
  captureMode: CaptureMode;
  seedContribution: string;
  signalingUrls?: string[];
  creator?: import('../../contracts/schema').Member;
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
  member?: import('../../contracts/schema').Member;
}

function createInitialArtifacts(input: {
  coopId: string;
  creator: import('../../contracts/schema').Member;
  setupInsights: ReturnType<typeof setupInsightsSchema.parse>;
  coopName: string;
  spaceType: CoopSpaceType;
  soul: import('../../contracts/schema').CoopSoul;
  rituals: import('../../contracts/schema').RitualDefinition[];
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
      whyItMatters: "This grounds routing and review in the coop's actual context.",
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
      summary: summarizeSoulArtifact(input.soul),
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
      summary: summarizeRitualArtifact(
        input.rituals[0] ?? {
          weeklyReviewCadence: 'Weekly review',
          namedMoments: ['Manual round-up'],
          facilitatorExpectation: 'Review the queue together.',
          defaultCapturePosture: 'Manual round-up is primary.',
        },
      ),
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
  const { soul, rituals } = synthesizeCoopFromPurpose({
    coopName: input.coopName,
    purpose: input.purpose,
    spaceType,
    captureMode: input.captureMode,
  });
  const artifacts = createInitialArtifacts({
    coopId,
    creator,
    setupInsights,
    coopName: input.coopName,
    spaceType,
    soul,
    rituals,
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

  const baseState = coopSharedStateSchema.parse({
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
  const state = seedDefaultInviteCodes({
    state: baseState,
    createdBy: creator.id,
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
    whyItMatters: "This widens the coop's starting context and gives the feed another voice.",
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
