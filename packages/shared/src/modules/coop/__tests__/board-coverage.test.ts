import { describe, expect, it } from 'vitest';
import {
  buildCoopBoardDeepLink,
  buildCoopBoardGraph,
  coopBoardSnapshotSchema,
  createCoopBoardSnapshot,
  decodeCoopBoardSnapshot,
  encodeCoopBoardSnapshot,
} from '../board';
import { createCoop } from '../flows';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSetupInsights() {
  return {
    summary: 'Compact setup for board coverage tests.',
    crossCuttingPainPoints: ['Context gets lost'],
    crossCuttingOpportunities: ['Persist context in the board'],
    lenses: [
      {
        lens: 'capital-formation' as const,
        currentState: 'Scattered.',
        painPoints: 'Links disappear.',
        improvements: 'Route leads.',
      },
      {
        lens: 'impact-reporting' as const,
        currentState: 'Late.',
        painPoints: 'Evidence dropped.',
        improvements: 'Collect steadily.',
      },
      {
        lens: 'governance-coordination' as const,
        currentState: 'Weekly calls.',
        painPoints: 'Follow-up lost.',
        improvements: 'Track actions.',
      },
      {
        lens: 'knowledge-garden-resources' as const,
        currentState: 'Tabs.',
        painPoints: 'Repeat research.',
        improvements: 'Persist references.',
      },
    ],
  } as const;
}

function quickCoop() {
  return createCoop({
    coopName: 'Board Test Coop',
    purpose: 'Test board graph building and snapshot handling.',
    creatorDisplayName: 'Tester',
    captureMode: 'manual',
    seedContribution: 'Seed for board tests.',
    setupInsights: buildSetupInsights(),
  });
}

// ---------------------------------------------------------------------------
// createCoopBoardSnapshot
// ---------------------------------------------------------------------------

describe('createCoopBoardSnapshot', () => {
  it('creates a valid snapshot with no captures or drafts', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    expect(snapshot.version).toBe(1);
    expect(snapshot.coopId).toBe(created.state.profile.id);
    expect(snapshot.receiverCaptures).toHaveLength(0);
    expect(snapshot.drafts).toHaveLength(0);
  });

  it('filters captures to only those matching the coop id', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [
        {
          id: 'cap-match',
          deviceId: 'd1',
          pairingId: 'p1',
          coopId: created.state.profile.id,
          coopDisplayName: 'Board Test Coop',
          memberId: created.creator.id,
          memberDisplayName: 'Tester',
          kind: 'link',
          title: 'Matching capture',
          note: '',
          mimeType: 'text/html',
          byteSize: 100,
          createdAt: '2026-03-22T01:00:00.000Z',
          updatedAt: '2026-03-22T01:00:00.000Z',
          syncState: 'synced',
          syncedAt: '2026-03-22T01:01:00.000Z',
          retryCount: 0,
          intakeStatus: 'draft',
        },
        {
          id: 'cap-other',
          deviceId: 'd2',
          pairingId: 'p2',
          coopId: 'some-other-coop',
          coopDisplayName: 'Other Coop',
          memberId: 'other-member',
          memberDisplayName: 'Other',
          kind: 'file',
          title: 'Non-matching capture',
          note: '',
          mimeType: 'text/plain',
          byteSize: 50,
          createdAt: '2026-03-22T02:00:00.000Z',
          updatedAt: '2026-03-22T02:00:00.000Z',
          syncState: 'synced',
          syncedAt: '2026-03-22T02:01:00.000Z',
          retryCount: 0,
          intakeStatus: 'draft',
        },
      ],
      drafts: [],
      createdAt: '2026-03-22T03:00:00.000Z',
    });

    expect(snapshot.receiverCaptures).toHaveLength(1);
    expect(snapshot.receiverCaptures[0]?.id).toBe('cap-match');
  });

  it('includes activeMemberId and activeMemberDisplayName when provided', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      activeMemberId: created.creator.id,
      activeMemberDisplayName: 'Tester',
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    expect(snapshot.activeMemberId).toBe(created.creator.id);
    expect(snapshot.activeMemberDisplayName).toBe('Tester');
  });

  it('rejects a snapshot where coopId mismatches embedded state', () => {
    const created = quickCoop();
    const raw = {
      version: 1,
      coopId: 'WRONG-ID',
      createdAt: '2026-03-22T00:00:00.000Z',
      coopState: created.state,
      receiverCaptures: [],
      drafts: [],
    };

    const result = coopBoardSnapshotSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildCoopBoardGraph — edge cases
// ---------------------------------------------------------------------------

describe('buildCoopBoardGraph', () => {
  it('builds a graph with only the coop node and seed artifact when empty', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    const graph = buildCoopBoardGraph(snapshot);

    // Should have: coop node, 1 member node, 1 artifact node (seed)
    expect(graph.nodes.length).toBeGreaterThanOrEqual(3);
    expect(graph.nodes.find((n) => n.kind === 'coop')).toBeDefined();
    expect(graph.nodes.find((n) => n.kind === 'member')).toBeDefined();
    expect(graph.nodes.find((n) => n.kind === 'artifact')).toBeDefined();
    expect(graph.nodes.filter((n) => n.kind === 'capture')).toHaveLength(0);
    expect(graph.nodes.filter((n) => n.kind === 'draft')).toHaveLength(0);
    expect(graph.nodes.filter((n) => n.kind === 'archive')).toHaveLength(0);
  });

  it('sets correct metadata counts', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    const graph = buildCoopBoardGraph(snapshot);
    expect(graph.metadata.counts.members).toBe(1);
    expect(graph.metadata.counts.captures).toBe(0);
    expect(graph.metadata.counts.drafts).toBe(0);
    // createCoop produces seed + soul + rituals + setup-insights artifacts
    expect(graph.metadata.counts.artifacts).toBe(4);
    expect(graph.metadata.counts.archives).toBe(0);
  });

  it('generates a human-readable story string', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    const graph = buildCoopBoardGraph(snapshot);
    expect(graph.metadata.story).toContain('finds moved from loose chickens');
    expect(graph.metadata.story).toContain('shared finds');
    expect(graph.metadata.story).toContain('proof items');
  });

  it('includes published-to-coop edges for artifacts', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    const graph = buildCoopBoardGraph(snapshot);
    const publishEdges = graph.edges.filter((e) => e.kind === 'published-to-coop');
    // createCoop produces 4 artifacts (seed, soul, rituals, setup-insights), each gets an edge
    expect(publishEdges.length).toBe(4);
  });

  it('uses coop name and purpose in coop node metadata', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    const graph = buildCoopBoardGraph(snapshot);
    const coopNode = graph.nodes.find((n) => n.kind === 'coop');
    expect(coopNode?.title).toBe('Board Test Coop');
    expect(coopNode?.subtitle).toBe('Shared coop memory');
  });

  it('positions nodes with correct x coordinates by lane', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    const graph = buildCoopBoardGraph(snapshot);
    const memberNode = graph.nodes.find((n) => n.kind === 'member');
    const artifactNode = graph.nodes.find((n) => n.kind === 'artifact');
    const coopNode = graph.nodes.find((n) => n.kind === 'coop');
    if (!memberNode || !artifactNode || !coopNode) {
      throw new Error('Expected member, artifact, and coop nodes to exist.');
    }

    // Member lane should be leftmost, artifact further right, coop in between
    expect(memberNode.position.x).toBeLessThan(coopNode.position.x);
    expect(coopNode.position.x).toBeLessThan(artifactNode.position.x);
  });
});

// ---------------------------------------------------------------------------
// encodeCoopBoardSnapshot / decodeCoopBoardSnapshot
// ---------------------------------------------------------------------------

describe('encodeCoopBoardSnapshot / decodeCoopBoardSnapshot', () => {
  it('round-trips a snapshot through encode and decode', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    const encoded = encodeCoopBoardSnapshot(snapshot);
    const decoded = decodeCoopBoardSnapshot(encoded);
    expect(decoded).toEqual(snapshot);
  });

  it('produces a non-empty base64 string', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    const encoded = encodeCoopBoardSnapshot(snapshot);
    expect(encoded.length).toBeGreaterThan(0);
    // Should be URL-safe (no +, /, =)
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

// ---------------------------------------------------------------------------
// buildCoopBoardDeepLink
// ---------------------------------------------------------------------------

describe('buildCoopBoardDeepLink', () => {
  it('builds a deep link with the coop id in the path and snapshot in the hash', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    const link = buildCoopBoardDeepLink('https://coop.town', snapshot);
    expect(link).toContain(`/board/${created.state.profile.id}`);
    expect(link).toContain('#snapshot=');
    expect(link).toMatch(/^https:\/\/coop\.town/);
  });

  it('works with a localhost app URL', () => {
    const created = quickCoop();
    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      createdAt: '2026-03-22T00:00:00.000Z',
    });

    const link = buildCoopBoardDeepLink('http://127.0.0.1:3001', snapshot);
    expect(link).toMatch(/^http:\/\/127\.0\.0\.1:3001/);
    expect(link).toContain(`/board/${created.state.profile.id}`);
  });
});
