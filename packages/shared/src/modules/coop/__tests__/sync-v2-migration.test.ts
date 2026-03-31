import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { CoopSharedState } from '../../../contracts/schema';
import { createCoop } from '../flows';
import {
  createCoopDoc,
  encodeCoopDoc,
  hydrateCoopDoc,
  readCoopState,
  writeCoopState,
} from '../sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultSetupInsights = {
  summary: 'A concise but valid setup payload for sync v2 migration tests.',
  crossCuttingPainPoints: ['Context drifts'],
  crossCuttingOpportunities: ['Shared state stays typed'],
  lenses: [
    {
      lens: 'capital-formation' as const,
      currentState: 'Links are scattered.',
      painPoints: 'Funding context disappears.',
      improvements: 'Route leads into shared state.',
    },
    {
      lens: 'impact-reporting' as const,
      currentState: 'Reporting is rushed.',
      painPoints: 'Evidence gets dropped.',
      improvements: 'Collect evidence incrementally.',
    },
    {
      lens: 'governance-coordination' as const,
      currentState: 'Calls happen weekly.',
      painPoints: 'Actions slip.',
      improvements: 'Review actions through the board.',
    },
    {
      lens: 'knowledge-garden-resources' as const,
      currentState: 'Resources live in tabs.',
      painPoints: 'Research repeats.',
      improvements: 'Persist high-signal references.',
    },
  ],
};

function buildBaseState(): CoopSharedState {
  return createCoop({
    coopName: 'V2 Migration Test Coop',
    purpose: 'Testing v2 sync migration for collections and scalar objects.',
    creatorDisplayName: 'Tester',
    captureMode: 'manual',
    seedContribution: 'Testing seed.',
    setupInsights: defaultSetupInsights,
  }).state;
}

const FIXED_NOW = '2026-03-30T12:00:00.000Z';

function makeInvite(id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    type: 'member' as const,
    status: 'active' as const,
    expiresAt: '2027-01-01T00:00:00.000Z',
    code: `code-${id}`,
    bootstrap: {
      coopId: 'coop-1',
      coopDisplayName: 'Test Coop',
      inviteId: id,
      inviteType: 'member' as const,
      expiresAt: '2027-01-01T00:00:00.000Z',
      roomId: 'room-1',
      signalingUrls: [],
      inviteProof: 'proof-1',
    },
    createdAt: FIXED_NOW,
    createdBy: 'member-1',
    usedByMemberIds: [],
    ...overrides,
  };
}

function makeArchiveReceipt(id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    scope: 'artifact' as const,
    targetCoopId: 'coop-1',
    artifactIds: [`artifact-${id}`],
    bundleReference: `bundle-${id}`,
    rootCid: `bafy-root-${id}`,
    shardCids: [],
    pieceCids: [],
    gatewayUrl: `https://storacha.link/ipfs/bafy-root-${id}`,
    uploadedAt: FIXED_NOW,
    filecoinStatus: 'pending' as const,
    delegationIssuer: 'did:key:z1234',
    contentEncoding: 'plain-json' as const,
    ...overrides,
  };
}

function makeMemberAccount(memberId: string, overrides?: Record<string, unknown>) {
  return {
    id: `account-${memberId}`,
    memberId,
    coopId: 'coop-1',
    accountType: 'safe' as const,
    ownerPasskeyCredentialId: `cred-${memberId}`,
    chainKey: 'sepolia' as const,
    status: 'pending' as const,
    statusNote: '',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. agentIdentity and fvmState round-trip
// ---------------------------------------------------------------------------

describe('agentIdentity and fvmState serialization', () => {
  it('round-trips agentIdentity through Yjs encoding', () => {
    const state = buildBaseState();
    state.agentIdentity = {
      enabled: true,
      status: 'registered',
      agentId: 42,
      agentURI: 'https://agent.coop.town/42',
      feedbackCount: 3,
    };

    const doc = createCoopDoc(state);
    const update = encodeCoopDoc(doc);
    const hydrated = hydrateCoopDoc(update);
    const loaded = readCoopState(hydrated);

    expect(loaded.agentIdentity).toBeDefined();
    expect(loaded.agentIdentity?.enabled).toBe(true);
    expect(loaded.agentIdentity?.agentId).toBe(42);
    expect(loaded.agentIdentity?.agentURI).toBe('https://agent.coop.town/42');
    expect(loaded.agentIdentity?.status).toBe('registered');
    expect(loaded.agentIdentity?.feedbackCount).toBe(3);
  });

  it('round-trips fvmState through Yjs encoding', () => {
    const state = buildBaseState();
    state.fvmState = {
      chainKey: 'filecoin-calibration',
      chainId: 314159,
      registryAddress: '0x1234567890abcdef1234567890abcdef12345678',
      statusNote: 'Registered on Filecoin calibration.',
    };

    const doc = createCoopDoc(state);
    const update = encodeCoopDoc(doc);
    const hydrated = hydrateCoopDoc(update);
    const loaded = readCoopState(hydrated);

    expect(loaded.fvmState).toBeDefined();
    expect(loaded.fvmState?.chainKey).toBe('filecoin-calibration');
    expect(loaded.fvmState?.chainId).toBe(314159);
    expect(loaded.fvmState?.registryAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('preserves undefined agentIdentity and fvmState', () => {
    const state = buildBaseState();
    // Both should be undefined by default

    const doc = createCoopDoc(state);
    const loaded = readCoopState(doc);

    expect(loaded.agentIdentity).toBeUndefined();
    expect(loaded.fvmState).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Concurrent invites merge
// ---------------------------------------------------------------------------

describe('concurrent invites merge via v2 map', () => {
  it('merges invites added by two separate docs', () => {
    const state = buildBaseState();
    state.invites = [makeInvite('inv-seed')];

    const seedDoc = createCoopDoc(state);
    const seedUpdate = encodeCoopDoc(seedDoc);

    const left = hydrateCoopDoc(seedUpdate);
    const right = hydrateCoopDoc(seedUpdate);

    // Left adds invite A
    const leftState = readCoopState(left);
    leftState.invites.push(makeInvite('inv-left'));
    writeCoopState(left, leftState);

    // Right adds invite B
    const rightState = readCoopState(right);
    rightState.invites.push(makeInvite('inv-right'));
    writeCoopState(right, rightState);

    // Merge
    Y.applyUpdate(left, Y.encodeStateAsUpdate(right));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left));

    const merged = readCoopState(left);
    const ids = merged.invites.map((i) => i.id).sort();
    expect(ids).toContain('inv-seed');
    expect(ids).toContain('inv-left');
    expect(ids).toContain('inv-right');
    expect(merged.invites.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 3. Concurrent archiveReceipts merge
// ---------------------------------------------------------------------------

describe('concurrent archiveReceipts merge via v2 map', () => {
  it('merges archive receipts added by two separate docs', () => {
    const state = buildBaseState();
    state.archiveReceipts = [makeArchiveReceipt('rcpt-seed')];

    const seedDoc = createCoopDoc(state);
    const seedUpdate = encodeCoopDoc(seedDoc);

    const left = hydrateCoopDoc(seedUpdate);
    const right = hydrateCoopDoc(seedUpdate);

    const leftState = readCoopState(left);
    leftState.archiveReceipts.push(makeArchiveReceipt('rcpt-left'));
    writeCoopState(left, leftState);

    const rightState = readCoopState(right);
    rightState.archiveReceipts.push(makeArchiveReceipt('rcpt-right'));
    writeCoopState(right, rightState);

    Y.applyUpdate(left, Y.encodeStateAsUpdate(right));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left));

    const merged = readCoopState(left);
    const ids = merged.archiveReceipts.map((r) => r.id).sort();
    expect(ids).toContain('rcpt-seed');
    expect(ids).toContain('rcpt-left');
    expect(ids).toContain('rcpt-right');
    expect(merged.archiveReceipts.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 4. Concurrent memberAccounts merge
// ---------------------------------------------------------------------------

describe('concurrent memberAccounts merge via v2 map', () => {
  it('merges member accounts added by two separate docs', () => {
    const state = buildBaseState();
    state.memberAccounts = [makeMemberAccount('member-seed')];

    const seedDoc = createCoopDoc(state);
    const seedUpdate = encodeCoopDoc(seedDoc);

    const left = hydrateCoopDoc(seedUpdate);
    const right = hydrateCoopDoc(seedUpdate);

    const leftState = readCoopState(left);
    leftState.memberAccounts.push(makeMemberAccount('member-left'));
    writeCoopState(left, leftState);

    const rightState = readCoopState(right);
    rightState.memberAccounts.push(makeMemberAccount('member-right'));
    writeCoopState(right, rightState);

    Y.applyUpdate(left, Y.encodeStateAsUpdate(right));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left));

    const merged = readCoopState(left);
    const memberIds = merged.memberAccounts.map((a) => a.memberId).sort();
    expect(memberIds).toContain('member-seed');
    expect(memberIds).toContain('member-left');
    expect(memberIds).toContain('member-right');
    expect(merged.memberAccounts.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 5. Concurrent memberCommitments merge (deduplication)
// ---------------------------------------------------------------------------

describe('concurrent memberCommitments merge', () => {
  it('merges unique commitment hashes from two docs', () => {
    const state = buildBaseState();
    state.memberCommitments = ['hash-seed'];

    const seedDoc = createCoopDoc(state);
    const seedUpdate = encodeCoopDoc(seedDoc);

    const left = hydrateCoopDoc(seedUpdate);
    const right = hydrateCoopDoc(seedUpdate);

    const leftState = readCoopState(left);
    leftState.memberCommitments = [...leftState.memberCommitments, 'hash-left'];
    writeCoopState(left, leftState);

    const rightState = readCoopState(right);
    rightState.memberCommitments = [...rightState.memberCommitments, 'hash-right'];
    writeCoopState(right, rightState);

    Y.applyUpdate(left, Y.encodeStateAsUpdate(right));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left));

    const merged = readCoopState(left);
    expect(merged.memberCommitments).toContain('hash-seed');
    expect(merged.memberCommitments).toContain('hash-left');
    expect(merged.memberCommitments).toContain('hash-right');
    // Should be deduplicated
    const unique = new Set(merged.memberCommitments);
    expect(unique.size).toBe(merged.memberCommitments.length);
  });
});

// ---------------------------------------------------------------------------
// 6. Scalar object concurrent field edit (profile)
// ---------------------------------------------------------------------------

describe('scalar object concurrent field edits via v2 map', () => {
  it('merges concurrent profile field edits via direct v2 map manipulation', () => {
    const state = buildBaseState();

    const seedDoc = createCoopDoc(state);
    const seedUpdate = encodeCoopDoc(seedDoc);

    const left = hydrateCoopDoc(seedUpdate);
    const right = hydrateCoopDoc(seedUpdate);

    // Directly edit different fields in the v2 per-field map (simulating
    // a partial write that only touches one field per peer).
    const leftProfileV2 = left.getMap<string>('coop-profile-v2');
    const rightProfileV2 = right.getMap<string>('coop-profile-v2');

    left.transact(() => {
      leftProfileV2.set('name', JSON.stringify('Left Name'));
    });
    right.transact(() => {
      rightProfileV2.set('purpose', JSON.stringify('Right Purpose'));
    });

    // Merge
    Y.applyUpdate(left, Y.encodeStateAsUpdate(right));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left));

    const mergedLeft = readCoopState(left);
    const mergedRight = readCoopState(right);

    // Both changes should be present in both docs (convergence)
    expect(mergedLeft.profile.name).toBe(mergedRight.profile.name);
    expect(mergedLeft.profile.purpose).toBe(mergedRight.profile.purpose);

    // The v2 per-field map preserves both independent field edits
    expect(mergedLeft.profile.name).toBe('Left Name');
    expect(mergedLeft.profile.purpose).toBe('Right Purpose');
  });

  it('merges concurrent onchainState field edits via direct v2 map manipulation', () => {
    const state = buildBaseState();

    const seedDoc = createCoopDoc(state);
    const seedUpdate = encodeCoopDoc(seedDoc);

    const left = hydrateCoopDoc(seedUpdate);
    const right = hydrateCoopDoc(seedUpdate);

    // Directly edit different onchainState fields in v2
    const leftOnchainV2 = left.getMap<string>('coop-onchain-state-v2');
    const rightOnchainV2 = right.getMap<string>('coop-onchain-state-v2');

    left.transact(() => {
      leftOnchainV2.set('statusNote', JSON.stringify('Left status note'));
    });
    right.transact(() => {
      rightOnchainV2.set('safeCapability', JSON.stringify('ready'));
    });

    Y.applyUpdate(left, Y.encodeStateAsUpdate(right));

    const merged = readCoopState(left);
    expect(merged.onchainState.statusNote).toBe('Left status note');
    expect(merged.onchainState.safeCapability).toBe('ready');
  });

  it('full writeCoopState round-trips scalar objects correctly', () => {
    const state = buildBaseState();
    state.profile = { ...state.profile, name: 'Updated Name', purpose: 'Updated Purpose' };

    const doc = createCoopDoc(state);
    const loaded = readCoopState(doc);

    expect(loaded.profile.name).toBe('Updated Name');
    expect(loaded.profile.purpose).toBe('Updated Purpose');
  });
});

// ---------------------------------------------------------------------------
// 7. Legacy backward compatibility
// ---------------------------------------------------------------------------

describe('legacy backward compatibility', () => {
  it('still writes data to legacy root JSON format for pre-migration peers', () => {
    const state = buildBaseState();
    state.invites = [makeInvite('inv-1')];
    state.archiveReceipts = [makeArchiveReceipt('rcpt-1')];
    state.memberAccounts = [makeMemberAccount('member-1')];
    state.memberCommitments = ['hash-1', 'hash-2'];
    state.agentIdentity = {
      enabled: true,
      status: 'registered',
      agentId: 1,
      feedbackCount: 0,
    };

    const doc = createCoopDoc(state);
    const root = doc.getMap<string>('coop');

    // Legacy root should have all the keys
    expect(root.has('invites')).toBe(true);
    expect(root.has('archiveReceipts')).toBe(true);
    expect(root.has('memberAccounts')).toBe(true);
    expect(root.has('memberCommitments')).toBe(true);
    expect(root.has('agentIdentity')).toBe(true);
    expect(root.has('fvmState')).toBe(true);

    // Legacy format should be parseable JSON
    const legacyInvites = JSON.parse(root.get('invites') ?? '[]');
    expect(legacyInvites).toHaveLength(1);
    expect(legacyInvites[0].id).toBe('inv-1');

    const legacyAgentIdentity = JSON.parse(root.get('agentIdentity') ?? 'null');
    expect(legacyAgentIdentity?.enabled).toBe(true);
  });

  it('reads from legacy format when v2 maps are empty', () => {
    const state = buildBaseState();
    state.invites = [makeInvite('inv-legacy')];

    // Write ONLY legacy format
    const doc = new Y.Doc();
    const root = doc.getMap<string>('coop');
    doc.transact(() => {
      for (const key of Object.keys(state) as (keyof CoopSharedState)[]) {
        root.set(key, JSON.stringify(state[key]));
      }
    });

    const loaded = readCoopState(doc);
    expect(loaded.invites).toHaveLength(1);
    expect(loaded.invites[0].id).toBe('inv-legacy');
  });
});

// ---------------------------------------------------------------------------
// 8. v2 takes priority over legacy
// ---------------------------------------------------------------------------

describe('v2 priority over legacy', () => {
  it('prefers v2 invites data over stale legacy root', () => {
    const state = buildBaseState();
    state.invites = [makeInvite('inv-v2')];

    const doc = createCoopDoc(state);

    // Tamper with legacy root to have different data
    const root = doc.getMap<string>('coop');
    root.set('invites', JSON.stringify([makeInvite('inv-legacy-stale')]));

    const loaded = readCoopState(doc);
    // v2 map should win since it was populated by writeCoopState
    expect(loaded.invites.some((i) => i.id === 'inv-v2')).toBe(true);
  });

  it('prefers v2 profile data over stale legacy root', () => {
    const state = buildBaseState();
    const doc = createCoopDoc(state);

    // Tamper with legacy root profile to have stale name
    const root = doc.getMap<string>('coop');
    const legacyProfile = JSON.parse(root.get('profile') ?? '{}');
    legacyProfile.name = 'Stale Legacy Name';
    root.set('profile', JSON.stringify(legacyProfile));

    const loaded = readCoopState(doc);
    // v2 profile map should win
    expect(loaded.profile.name).toBe(state.profile.name);
  });
});
