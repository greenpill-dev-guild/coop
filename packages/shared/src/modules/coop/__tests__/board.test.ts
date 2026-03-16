import { describe, expect, it } from 'vitest';
import type { ReceiverCapture } from '../../../contracts/schema';
import {
  createArchiveBundle,
  createMockArchiveReceipt,
  recordArchiveReceipt,
} from '../../archive/archive';
import { withArchiveWorthiness } from '../../archive/story';
import {
  buildCoopBoardDeepLink,
  buildCoopBoardGraph,
  createCoopBoardSnapshot,
  decodeCoopBoardSnapshot,
  encodeCoopBoardSnapshot,
} from '../board';
import { createCoop } from '../flows';
import { createReceiverDraftSeed } from '../review';

function buildSetupInsights() {
  return {
    summary: 'A compact setup payload for testing board rendering and archive storytelling.',
    crossCuttingPainPoints: ['Context is hard to inspect once it moves around'],
    crossCuttingOpportunities: ['Make archive receipts legible and durable'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Funding links are scattered.',
        painPoints: 'Important leads disappear.',
        improvements: 'Keep the best artifacts legible.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Evidence arrives late.',
        painPoints: 'Field context disappears.',
        improvements: 'Preserve good evidence quickly.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Weekly reviews carry the flow.',
        painPoints: 'Follow-up context is brittle.',
        improvements: 'Show what got published and archived.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Research lives in tabs and notes.',
        painPoints: 'Useful signal is hard to inspect later.',
        improvements: 'Give the board a durable archive story.',
      },
    ],
  } as const;
}

describe('coop board graph', () => {
  it('builds deterministic nodes and edges for captures, drafts, artifacts, and receipts', () => {
    const created = createCoop({
      coopName: 'Board Coop',
      purpose: 'Make capture, review, publish, and archive flows legible.',
      creatorDisplayName: 'Mina',
      captureMode: 'manual',
      seedContribution: 'I bring field notes and archive instincts.',
      setupInsights: buildSetupInsights(),
    });
    const creator = created.creator;
    const baseArtifact = created.state.artifacts[0];
    if (!baseArtifact) {
      throw new Error('Expected a seed artifact.');
    }

    const capture: ReceiverCapture = withArchiveWorthiness(
      {
        id: 'capture-1',
        deviceId: 'device-1',
        pairingId: 'pairing-1',
        coopId: created.state.profile.id,
        coopDisplayName: created.state.profile.name,
        memberId: creator.id,
        memberDisplayName: creator.displayName,
        kind: 'file',
        title: 'forest-notes.txt',
        note: 'Archive this after review.',
        fileName: 'forest-notes.txt',
        mimeType: 'text/plain',
        byteSize: 88,
        createdAt: '2026-03-12T18:00:00.000Z',
        updatedAt: '2026-03-12T18:00:00.000Z',
        syncState: 'synced',
        syncedAt: '2026-03-12T18:01:00.000Z',
        retryCount: 0,
        intakeStatus: 'draft',
        linkedDraftId: 'draft-receiver-capture-1',
      },
      true,
      '2026-03-12T18:01:30.000Z',
    );

    const draft = createReceiverDraftSeed({
      capture,
      availableCoopIds: [created.state.profile.id],
      preferredCoopId: created.state.profile.id,
      preferredCoopLabel: created.state.profile.name,
      workflowStage: 'ready',
      createdAt: '2026-03-12T18:02:00.000Z',
    });

    const flaggedState = {
      ...created.state,
      artifacts: [withArchiveWorthiness(baseArtifact, true, '2026-03-12T18:04:00.000Z')],
    };
    const bundle = createArchiveBundle({
      scope: 'artifact',
      state: flaggedState,
      artifactIds: [baseArtifact.id],
    });
    const receipt = createMockArchiveReceipt({
      bundle,
      delegationIssuer: 'trusted-node-demo',
      artifactIds: [baseArtifact.id],
    });
    const nextState = recordArchiveReceipt(flaggedState, receipt, [baseArtifact.id]);

    const snapshot = createCoopBoardSnapshot({
      state: nextState,
      receiverCaptures: [capture],
      drafts: [draft],
      activeMemberId: creator.id,
      activeMemberDisplayName: creator.displayName,
      createdAt: '2026-03-12T18:05:00.000Z',
    });
    const graph = buildCoopBoardGraph(snapshot);

    expect(graph.metadata.counts).toEqual({
      members: 1,
      captures: 1,
      drafts: 1,
      artifacts: 1,
      archives: 1,
      archiveWorthy: 3,
    });
    expect(graph.nodes.map((node) => node.id)).toEqual([
      `coop:${created.state.profile.id}`,
      `member:${creator.id}`,
      'capture:capture-1',
      'draft:draft-receiver-capture-1',
      `artifact:${baseArtifact.id}`,
      `archive:${receipt.id}`,
    ]);
    expect(graph.edges.map((edge) => `${edge.kind}:${edge.label}`)).toEqual([
      'captured-by:captured by',
      'draft-seeded-from-capture:draft seeded from capture',
      'routed-to-coop:routed to coop',
      'published-to-coop:published to coop',
      'archived-in:archived in',
    ]);
    expect(graph.metadata.story).toContain('1 finds moved from loose chickens through 1 drafts');
  });

  it('round-trips board snapshots through the fragment handoff payload', () => {
    const created = createCoop({
      coopName: 'Board Coop',
      purpose: 'Make capture, review, publish, and archive flows legible.',
      creatorDisplayName: 'Mina',
      captureMode: 'manual',
      seedContribution: 'I bring field notes and archive instincts.',
      setupInsights: buildSetupInsights(),
    });

    const snapshot = createCoopBoardSnapshot({
      state: created.state,
      receiverCaptures: [],
      drafts: [],
      activeMemberId: created.creator.id,
      activeMemberDisplayName: created.creator.displayName,
      createdAt: '2026-03-12T18:06:00.000Z',
    });

    const encoded = encodeCoopBoardSnapshot(snapshot);
    const decoded = decodeCoopBoardSnapshot(encoded);
    const link = buildCoopBoardDeepLink('http://127.0.0.1:3001', snapshot);

    expect(decoded).toEqual(snapshot);
    expect(link).toContain(`/board/${created.state.profile.id}#snapshot=`);
  });
});
