import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { CoopSharedState, Member } from '../../../contracts/schema';
import { createCoop } from '../flows';
import {
  createCoopDoc,
  encodeCoopDoc,
  hydrateCoopDoc,
  readCoopState,
  writeCoopState,
} from '../sync';

const defaultSetupInsights = {
  summary: 'A concise but valid setup payload for sync member testing.',
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
    coopName: 'Member Sync Test',
    purpose: 'Unit testing per-member sync migration.',
    creatorDisplayName: 'Creator',
    captureMode: 'manual',
    seedContribution: 'Testing seed contribution.',
    setupInsights: defaultSetupInsights,
  }).state;
}

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: overrides.id ?? `member-${crypto.randomUUID().slice(0, 8)}`,
    displayName: overrides.displayName ?? 'Test Member',
    role: overrides.role ?? 'member',
    authMode: 'passkey',
    address: overrides.address ?? `0x${'a'.repeat(40)}`,
    joinedAt: overrides.joinedAt ?? new Date().toISOString(),
    identityWarning: '',
    ...overrides,
  };
}

describe('origin tagging (R1)', () => {
  it('writeCoopState passes a transaction origin so local writes can be distinguished', () => {
    const state = buildTestState();
    const doc = new Y.Doc();

    const origins: unknown[] = [];
    doc.on('update', (_update: Uint8Array, origin: unknown) => {
      origins.push(origin);
    });

    writeCoopState(doc, state);

    // After the fix, writeCoopState should pass 'local' as the transaction origin.
    // The update handler receives the origin as the second argument.
    expect(origins).toHaveLength(1);
    expect(origins[0]).toBe('local');
  });

  it('local writes can be filtered by checking origin in the update handler', () => {
    const state = buildTestState();
    const doc = new Y.Doc();

    const remoteUpdates: Uint8Array[] = [];
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'local') {
        remoteUpdates.push(update);
      }
    });

    // Local write -- should be filtered out
    writeCoopState(doc, state);
    expect(remoteUpdates).toHaveLength(0);

    // Simulate a remote update (no origin / different origin)
    const remoteDoc = new Y.Doc();
    writeCoopState(remoteDoc, {
      ...state,
      profile: { ...state.profile, name: 'Remote Update' },
    });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remoteDoc));

    // Remote update should NOT be filtered
    expect(remoteUpdates.length).toBeGreaterThan(0);
  });
});

describe('per-member Y.Map migration (R2)', () => {
  const MEMBERS_V2_KEY = 'coop-members-v2';

  it('writeCoopState populates the v2 per-member map alongside the legacy format', () => {
    const state = buildTestState();
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const membersV2 = doc.getMap<Y.Map<string>>(MEMBERS_V2_KEY);
    expect(membersV2.size).toBe(state.members.length);

    // Verify each member is stored as a nested Y.Map with per-field entries
    for (const member of state.members) {
      const fieldMap = membersV2.get(member.id);
      expect(fieldMap).toBeDefined();
      expect(JSON.parse(fieldMap!.get('displayName') ?? '')).toBe(member.displayName);
      expect(JSON.parse(fieldMap!.get('role') ?? '')).toBe(member.role);
    }
  });

  it('readCoopState prefers v2 per-member map when populated', () => {
    const state = buildTestState();
    const doc = new Y.Doc();
    writeCoopState(doc, state);

    // Tamper with the legacy format to have a different member name
    const root = doc.getMap<string>('coop');
    const legacyMembers = JSON.parse(root.get('members') ?? '[]');
    legacyMembers[0].displayName = 'Legacy Name';
    root.set('members', JSON.stringify(legacyMembers));

    const result = readCoopState(doc);
    // v2 format should win -- member should have original name, not 'Legacy Name'
    expect(result.members[0].displayName).not.toBe('Legacy Name');
  });

  it('readCoopState falls back to legacy format when v2 map is empty', () => {
    const state = buildTestState();
    const doc = new Y.Doc();

    // Write ONLY the legacy format (bypass v2 map)
    const root = doc.getMap<string>('coop');
    doc.transact(() => {
      root.set('profile', JSON.stringify(state.profile));
      root.set('setupInsights', JSON.stringify(state.setupInsights));
      root.set('soul', JSON.stringify(state.soul));
      root.set('rituals', JSON.stringify(state.rituals));
      root.set('members', JSON.stringify(state.members));
      root.set('invites', JSON.stringify(state.invites));
      root.set('artifacts', JSON.stringify(state.artifacts));
      root.set('reviewBoard', JSON.stringify(state.reviewBoard));
      root.set('archiveReceipts', JSON.stringify(state.archiveReceipts));
      root.set('memoryProfile', JSON.stringify(state.memoryProfile));
      root.set('syncRoom', JSON.stringify(state.syncRoom));
      root.set('onchainState', JSON.stringify(state.onchainState));
      root.set('memberAccounts', JSON.stringify(state.memberAccounts));
      root.set('memberCommitments', JSON.stringify(state.memberCommitments));
    });

    const result = readCoopState(doc);
    expect(result.members).toHaveLength(state.members.length);
    expect(result.members[0].displayName).toBe(state.members[0].displayName);
  });

  it('concurrent member joins on separate docs merge correctly via v2 map', () => {
    const state = buildTestState();
    const creator = state.members[0];

    // Create two docs from the same initial state
    const doc1 = new Y.Doc();
    writeCoopState(doc1, state);

    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Doc1 adds member A
    const memberA = makeMember({ id: 'member-a', displayName: 'Alice' });
    const state1 = readCoopState(doc1);
    state1.members.push(memberA);
    writeCoopState(doc1, state1);

    // Doc2 adds member B (independently, without seeing member A)
    const memberB = makeMember({ id: 'member-b', displayName: 'Bob' });
    const state2 = readCoopState(doc2);
    state2.members.push(memberB);
    writeCoopState(doc2, state2);

    // Merge updates in both directions
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // Both docs should see all 3 members (creator + A + B)
    const result1 = readCoopState(doc1);
    const result2 = readCoopState(doc2);

    const expectedIds = [creator.id, 'member-a', 'member-b'].sort();
    expect(result1.members.map((m) => m.id).sort()).toEqual(expectedIds);
    expect(result2.members.map((m) => m.id).sort()).toEqual(expectedIds);
  });

  it('removes deleted members from the v2 map', () => {
    const state = buildTestState();
    const extraMember = makeMember({ id: 'member-to-remove', displayName: 'Removable' });
    state.members.push(extraMember);

    const doc = new Y.Doc();
    writeCoopState(doc, state);

    const membersV2 = doc.getMap<Y.Map<string>>(MEMBERS_V2_KEY);
    expect(membersV2.size).toBe(2);

    // Remove the extra member and rewrite
    state.members = state.members.filter((m) => m.id !== 'member-to-remove');
    writeCoopState(doc, state);

    expect(membersV2.size).toBe(1);
    expect(membersV2.has('member-to-remove')).toBe(false);
  });

  it('auto-migrates existing docs without v2 map on first write', () => {
    const state = buildTestState();
    const doc = new Y.Doc();

    // Write only legacy format
    const root = doc.getMap<string>('coop');
    doc.transact(() => {
      root.set('profile', JSON.stringify(state.profile));
      root.set('setupInsights', JSON.stringify(state.setupInsights));
      root.set('soul', JSON.stringify(state.soul));
      root.set('rituals', JSON.stringify(state.rituals));
      root.set('members', JSON.stringify(state.members));
      root.set('invites', JSON.stringify(state.invites));
      root.set('artifacts', JSON.stringify(state.artifacts));
      root.set('reviewBoard', JSON.stringify(state.reviewBoard));
      root.set('archiveReceipts', JSON.stringify(state.archiveReceipts));
      root.set('memoryProfile', JSON.stringify(state.memoryProfile));
      root.set('syncRoom', JSON.stringify(state.syncRoom));
      root.set('onchainState', JSON.stringify(state.onchainState));
      root.set('memberAccounts', JSON.stringify(state.memberAccounts));
      root.set('memberCommitments', JSON.stringify(state.memberCommitments));
    });

    // v2 map should be empty before migration
    const membersV2Before = doc.getMap<Y.Map<string>>(MEMBERS_V2_KEY);
    expect(membersV2Before.size).toBe(0);

    // Now write via writeCoopState -- this should auto-populate v2
    const loaded = readCoopState(doc);
    writeCoopState(doc, loaded);

    const membersV2After = doc.getMap<Y.Map<string>>(MEMBERS_V2_KEY);
    expect(membersV2After.size).toBe(state.members.length);
  });

  it('round-trips member fields through v2 format accurately', () => {
    const state = buildTestState();
    const member = state.members[0];

    const doc = new Y.Doc();
    writeCoopState(doc, state);
    const result = readCoopState(doc);

    expect(result.members[0]).toEqual(member);
  });
});
