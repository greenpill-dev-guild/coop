import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type {
  ArchiveReceipt,
  CoopSharedState,
  GreenGoodsMemberBinding,
  InviteCode,
  MemberOnchainAccount,
} from '../../../contracts/schema';
import { createCoop } from '../flows';
import { createCoopDoc, readCoopState, readCoopStateRaw, writeCoopState } from '../sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultSetupInsights = {
  summary: 'A concise but valid setup payload for v2 migration testing.',
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

function buildTestState(): CoopSharedState {
  return createCoop({
    coopName: 'V2 Migration Test',
    purpose: 'Unit testing v2 Yjs storage paths.',
    creatorDisplayName: 'Creator',
    captureMode: 'manual',
    seedContribution: 'Testing seed contribution.',
    setupInsights: defaultSetupInsights,
  }).state;
}

const FIXED_NOW = '2026-03-22T00:00:00.000Z';

function makeInvite(overrides: Partial<InviteCode> = {}): InviteCode {
  const id = overrides.id ?? `invite-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    type: 'member',
    status: 'active',
    expiresAt: '2026-12-31T23:59:59.000Z',
    code: `code-${id}`,
    bootstrap: {
      coopId: 'coop-1',
      coopDisplayName: 'Test Coop',
      inviteId: id,
      inviteType: 'member',
      expiresAt: '2026-12-31T23:59:59.000Z',
      roomId: 'room-1',
      signalingUrls: [],
      inviteProof: 'proof-123',
    },
    createdAt: FIXED_NOW,
    createdBy: 'creator-1',
    usedByMemberIds: [],
    ...overrides,
  };
}

function makeArchiveReceipt(overrides: Partial<ArchiveReceipt> = {}): ArchiveReceipt {
  const id = overrides.id ?? `receipt-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    scope: 'snapshot',
    targetCoopId: 'coop-1',
    artifactIds: [],
    bundleReference: `bundle-${id}`,
    rootCid: `bafyrei${id}`,
    shardCids: [],
    pieceCids: [],
    gatewayUrl: `https://storacha.link/ipfs/${id}`,
    uploadedAt: FIXED_NOW,
    filecoinStatus: 'pending',
    delegationIssuer: 'did:key:z1234',
    contentEncoding: 'plain-json',
    ...overrides,
  };
}

function makeMemberAccount(overrides: Partial<MemberOnchainAccount> = {}): MemberOnchainAccount {
  const memberId = overrides.memberId ?? `member-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id: overrides.id ?? `account-${memberId}`,
    memberId,
    coopId: 'coop-1',
    accountType: 'safe',
    ownerPasskeyCredentialId: 'cred-1',
    chainKey: 'sepolia',
    status: 'active',
    statusNote: '',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

function makeMemberBinding(
  overrides: Partial<GreenGoodsMemberBinding> = {},
): GreenGoodsMemberBinding {
  const memberId = overrides.memberId ?? `member-${crypto.randomUUID().slice(0, 8)}`;
  return {
    memberId,
    desiredRoles: [],
    currentRoles: [],
    status: 'pending-account',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('v2 Yjs storage migration', () => {
  describe('sharedKeys completeness', () => {
    it('agentIdentity round-trips through Yjs doc', () => {
      const state = buildTestState();
      state.agentIdentity = {
        enabled: true,
        agentId: 42,
        agentURI: 'ipfs://Qm1234',
        status: 'registered',
        statusNote: 'Active agent',
        feedbackCount: 5,
      };

      const doc = createCoopDoc(state);
      const loaded = readCoopState(doc);

      expect(loaded.agentIdentity).toBeDefined();
      expect(loaded.agentIdentity?.agentId).toBe(42);
      expect(loaded.agentIdentity?.status).toBe('registered');
      expect(loaded.agentIdentity?.enabled).toBe(true);
    });

    it('fvmState round-trips through Yjs doc', () => {
      const state = buildTestState();
      state.fvmState = {
        chainKey: 'filecoin-calibration',
        chainId: 314159,
        registryAddress: '0x' + 'ab'.repeat(20),
        statusNote: 'FVM connected',
      };

      const doc = createCoopDoc(state);
      const loaded = readCoopState(doc);

      expect(loaded.fvmState).toBeDefined();
      expect(loaded.fvmState?.chainKey).toBe('filecoin-calibration');
      expect(loaded.fvmState?.chainId).toBe(314159);
      expect(loaded.fvmState?.statusNote).toBe('FVM connected');
    });
  });

  describe('concurrent invite merges', () => {
    it('two peers adding different invites both appear after merge', () => {
      const state = buildTestState();

      const doc1 = new Y.Doc();
      writeCoopState(doc1, state);

      const doc2 = new Y.Doc();
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Peer 1 adds invite A
      const inviteA = makeInvite({ id: 'invite-a' });
      const state1 = readCoopState(doc1);
      state1.invites.push(inviteA);
      writeCoopState(doc1, state1);

      // Peer 2 adds invite B (independently)
      const inviteB = makeInvite({ id: 'invite-b' });
      const state2 = readCoopState(doc2);
      state2.invites.push(inviteB);
      writeCoopState(doc2, state2);

      // Merge in both directions
      Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      const result1 = readCoopState(doc1);
      const result2 = readCoopState(doc2);

      const ids1 = result1.invites.map((i) => i.id).sort();
      const ids2 = result2.invites.map((i) => i.id).sort();

      expect(ids1).toContain('invite-a');
      expect(ids1).toContain('invite-b');
      expect(ids1).toEqual(ids2);
    });
  });

  describe('concurrent archiveReceipt merges', () => {
    it('two peers adding different receipts both appear after merge', () => {
      const state = buildTestState();

      const doc1 = new Y.Doc();
      writeCoopState(doc1, state);

      const doc2 = new Y.Doc();
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Peer 1 adds receipt A
      const receiptA = makeArchiveReceipt({ id: 'receipt-a' });
      const state1 = readCoopState(doc1);
      state1.archiveReceipts.push(receiptA);
      writeCoopState(doc1, state1);

      // Peer 2 adds receipt B (independently)
      const receiptB = makeArchiveReceipt({ id: 'receipt-b' });
      const state2 = readCoopState(doc2);
      state2.archiveReceipts.push(receiptB);
      writeCoopState(doc2, state2);

      // Merge
      Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      const result1 = readCoopState(doc1);
      const result2 = readCoopState(doc2);

      const ids1 = result1.archiveReceipts.map((r) => r.id).sort();
      const ids2 = result2.archiveReceipts.map((r) => r.id).sort();

      expect(ids1).toContain('receipt-a');
      expect(ids1).toContain('receipt-b');
      expect(ids1).toEqual(ids2);
    });
  });

  describe('concurrent memberAccount merges', () => {
    it('two peers adding different member accounts both appear after merge', () => {
      const state = buildTestState();

      const doc1 = new Y.Doc();
      writeCoopState(doc1, state);

      const doc2 = new Y.Doc();
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Peer 1 adds account for member-a
      const accountA = makeMemberAccount({ memberId: 'member-a', id: 'acct-a' });
      const state1 = readCoopState(doc1);
      state1.memberAccounts.push(accountA);
      writeCoopState(doc1, state1);

      // Peer 2 adds account for member-b
      const accountB = makeMemberAccount({ memberId: 'member-b', id: 'acct-b' });
      const state2 = readCoopState(doc2);
      state2.memberAccounts.push(accountB);
      writeCoopState(doc2, state2);

      // Merge
      Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      const result1 = readCoopState(doc1);
      const result2 = readCoopState(doc2);

      const ids1 = result1.memberAccounts.map((a) => a.memberId).sort();
      const ids2 = result2.memberAccounts.map((a) => a.memberId).sort();

      expect(ids1).toContain('member-a');
      expect(ids1).toContain('member-b');
      expect(ids1).toEqual(ids2);
    });
  });

  describe('concurrent memberCommitments merges (with dedupe)', () => {
    it('concurrent additions deduplicate by commitment hash', () => {
      const state = buildTestState();
      state.memberCommitments = ['commitment-shared'];

      const doc1 = new Y.Doc();
      writeCoopState(doc1, state);

      const doc2 = new Y.Doc();
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Peer 1 adds commitment-a and re-adds commitment-shared
      const state1 = readCoopState(doc1);
      state1.memberCommitments = ['commitment-shared', 'commitment-a'];
      writeCoopState(doc1, state1);

      // Peer 2 adds commitment-b and re-adds commitment-shared
      const state2 = readCoopState(doc2);
      state2.memberCommitments = ['commitment-shared', 'commitment-b'];
      writeCoopState(doc2, state2);

      // Merge
      Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      const result1 = readCoopState(doc1);
      const result2 = readCoopState(doc2);

      // Should have all unique commitments, no duplicates
      const unique1 = [...new Set(result1.memberCommitments)].sort();
      const unique2 = [...new Set(result2.memberCommitments)].sort();

      expect(unique1).toEqual(['commitment-a', 'commitment-b', 'commitment-shared']);
      expect(unique1).toEqual(unique2);
      // The actual result should already be deduped by readCoopState
      expect(result1.memberCommitments.sort()).toEqual(unique1);
    });
  });

  describe('concurrent greenGoods.memberBindings merges', () => {
    it('two peers adding different member bindings both appear after merge', () => {
      const state = buildTestState();
      state.greenGoods = {
        enabled: true,
        status: 'linked',
        name: 'Test Garden',
        description: 'A test garden',
        memberBindings: [],
      };

      const doc1 = new Y.Doc();
      writeCoopState(doc1, state);

      const doc2 = new Y.Doc();
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      // Peer 1 adds binding for member-a
      const bindingA = makeMemberBinding({ memberId: 'member-a' });
      const state1 = readCoopState(doc1);
      state1.greenGoods!.memberBindings.push(bindingA);
      writeCoopState(doc1, state1);

      // Peer 2 adds binding for member-b
      const bindingB = makeMemberBinding({ memberId: 'member-b' });
      const state2 = readCoopState(doc2);
      state2.greenGoods!.memberBindings.push(bindingB);
      writeCoopState(doc2, state2);

      // Merge
      Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
      Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

      const result1 = readCoopState(doc1);
      const result2 = readCoopState(doc2);

      const ids1 = result1.greenGoods!.memberBindings.map((b) => b.memberId).sort();
      const ids2 = result2.greenGoods!.memberBindings.map((b) => b.memberId).sort();

      expect(ids1).toContain('member-a');
      expect(ids1).toContain('member-b');
      expect(ids1).toEqual(ids2);
    });
  });

  describe('legacy backward compatibility', () => {
    it('reads state from a legacy-only doc (no v2 maps)', () => {
      const state = buildTestState();
      state.invites = [makeInvite({ id: 'legacy-invite' })];
      state.archiveReceipts = [makeArchiveReceipt({ id: 'legacy-receipt' })];

      const doc = new Y.Doc();
      const root = doc.getMap<string>('coop');

      // Write ONLY legacy format -- no v2 maps at all
      doc.transact(() => {
        for (const key of Object.keys(state) as Array<keyof CoopSharedState>) {
          root.set(key, JSON.stringify(state[key]));
        }
      });

      const loaded = readCoopState(doc);

      expect(loaded.invites).toHaveLength(1);
      expect(loaded.invites[0].id).toBe('legacy-invite');
      expect(loaded.archiveReceipts).toHaveLength(1);
      expect(loaded.archiveReceipts[0].id).toBe('legacy-receipt');
      expect(loaded.profile.name).toBe(state.profile.name);
    });
  });

  describe('mixed v2+legacy reads prefer v2', () => {
    it('v2 scalar objects take precedence over legacy root JSON', () => {
      const state = buildTestState();
      const doc = new Y.Doc();

      // Write via writeCoopState (populates both legacy and v2)
      writeCoopState(doc, state);

      // Tamper with the legacy root to have a different profile name
      const root = doc.getMap<string>('coop');
      const legacyProfile = JSON.parse(root.get('profile') ?? '{}');
      legacyProfile.name = 'Legacy Name';
      root.set('profile', JSON.stringify(legacyProfile));

      const loaded = readCoopState(doc);

      // v2 should win -- profile should have original name
      expect(loaded.profile.name).toBe(state.profile.name);
    });

    it('clears stale v2 greenGoods data when greenGoods becomes undefined', () => {
      const state = buildTestState();
      // First write with greenGoods enabled
      state.greenGoods = {
        gardenAddress: '0x123',
        operatorAddress: '0x456',
        memberBindings: [{ memberId: 'member-1', hypercertFractionId: 'frac-1' }],
      } as CoopSharedState['greenGoods'];

      const doc = new Y.Doc();
      writeCoopState(doc, state);

      // Verify greenGoods was written
      const raw1 = readCoopStateRaw(doc);
      expect(raw1.greenGoods).toBeDefined();

      // Now write with greenGoods undefined (disabled)
      // Use readCoopStateRaw to avoid Zod stripping the optional field
      const stateWithoutGG = { ...state, greenGoods: undefined };
      writeCoopState(doc, stateWithoutGG as unknown as CoopSharedState);

      const raw2 = readCoopStateRaw(doc);
      // greenGoods should be undefined, not stale v2 data
      expect(raw2.greenGoods).toBeUndefined();
    });

    it('v2 keyed collections take precedence over legacy root JSON', () => {
      const state = buildTestState();
      state.invites = [makeInvite({ id: 'original-invite' })];

      const doc = new Y.Doc();
      writeCoopState(doc, state);

      // Tamper with legacy root to add a different invite
      const root = doc.getMap<string>('coop');
      root.set('invites', JSON.stringify([{ ...state.invites[0], id: 'tampered-invite' }]));

      const loaded = readCoopState(doc);

      // v2 should win -- should see original-invite, not tampered-invite
      const ids = loaded.invites.map((i) => i.id);
      expect(ids).toContain('original-invite');
      expect(ids).not.toContain('tampered-invite');
    });
  });
});
