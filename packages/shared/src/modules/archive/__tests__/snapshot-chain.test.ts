import { describe, expect, it } from 'vitest';
import type { ArchiveReceipt, CoopSharedState } from '../../../contracts/schema';
import { createCoop } from '../../coop/flows';
import { createArchiveBundle } from '../archive';

function buildSetupInsights() {
  return {
    summary: 'Snapshot chain testing.',
    crossCuttingPainPoints: ['History is opaque'],
    crossCuttingOpportunities: ['Link snapshots by CID'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Scattered.',
        painPoints: 'Lost.',
        improvements: 'Chain.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Late.',
        painPoints: 'Gone.',
        improvements: 'Fast.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Weekly.',
        painPoints: 'Brittle.',
        improvements: 'Link.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Tabs.',
        painPoints: 'Lost.',
        improvements: 'Chain.',
      },
    ],
  } as const;
}

function createTestState(): CoopSharedState {
  return createCoop({
    coopName: 'Snapshot Chain Coop',
    purpose: 'Testing snapshot hash chain.',
    creatorDisplayName: 'Tester',
    captureMode: 'manual',
    seedContribution: 'Test seed.',
    setupInsights: buildSetupInsights(),
  }).state;
}

function createTestReceipt(
  state: CoopSharedState,
  overrides?: Partial<ArchiveReceipt>,
): ArchiveReceipt {
  return {
    id: 'receipt-1',
    scope: 'artifact',
    targetCoopId: state.profile.id,
    artifactIds: [],
    bundleReference: 'bundle-ref-1',
    rootCid: 'bafysnap0000000000000000000001',
    shardCids: [],
    pieceCids: [],
    gatewayUrl: 'https://gateway.example.com/ipfs/bafysnap0000000000000000000001',
    uploadedAt: '2026-03-13T14:00:00.000Z',
    filecoinStatus: 'pending',
    delegationIssuer: 'trusted-node-demo',
    anchorStatus: 'pending',
    ...overrides,
  };
}

describe('snapshot chain — previousSnapshotCid', () => {
  it('snapshot bundle has no previousSnapshotCid when no prior snapshots exist', () => {
    const state = createTestState();

    const bundle = createArchiveBundle({ scope: 'snapshot', state });

    expect(bundle.scope).toBe('snapshot');
    expect((bundle.payload as Record<string, unknown>).previousSnapshotCid).toBeUndefined();
  });

  it('snapshot bundle includes previousSnapshotCid from latest snapshot receipt', () => {
    const state = createTestState();

    const olderSnapshotReceipt = createTestReceipt(state, {
      id: 'receipt-snap-old',
      scope: 'snapshot',
      rootCid: 'bafysnap_older_0000000000000001',
      uploadedAt: '2026-03-10T10:00:00.000Z',
    });

    const newerSnapshotReceipt = createTestReceipt(state, {
      id: 'receipt-snap-new',
      scope: 'snapshot',
      rootCid: 'bafysnap_newer_0000000000000002',
      uploadedAt: '2026-03-12T10:00:00.000Z',
    });

    const stateWithReceipts: CoopSharedState = {
      ...state,
      archiveReceipts: [olderSnapshotReceipt, newerSnapshotReceipt],
    };

    const bundle = createArchiveBundle({ scope: 'snapshot', state: stateWithReceipts });

    expect((bundle.payload as Record<string, unknown>).previousSnapshotCid).toBe(
      'bafysnap_newer_0000000000000002',
    );
  });

  it('snapshot bundle ignores artifact-scope receipts when finding previous snapshot', () => {
    const state = createTestState();

    const artifactReceipt = createTestReceipt(state, {
      id: 'receipt-art-1',
      scope: 'artifact',
      rootCid: 'bafyartifact_00000000000000001',
      uploadedAt: '2026-03-13T12:00:00.000Z',
    });

    const snapshotReceipt = createTestReceipt(state, {
      id: 'receipt-snap-1',
      scope: 'snapshot',
      rootCid: 'bafysnap_only_00000000000000001',
      uploadedAt: '2026-03-11T10:00:00.000Z',
    });

    const stateWithReceipts: CoopSharedState = {
      ...state,
      archiveReceipts: [artifactReceipt, snapshotReceipt],
    };

    const bundle = createArchiveBundle({ scope: 'snapshot', state: stateWithReceipts });

    // Should use the snapshot receipt, not the artifact one (even though artifact is newer)
    expect((bundle.payload as Record<string, unknown>).previousSnapshotCid).toBe(
      'bafysnap_only_00000000000000001',
    );
  });

  it('artifact-scope bundles do NOT include previousSnapshotCid', () => {
    const state = createTestState();

    const snapshotReceipt = createTestReceipt(state, {
      id: 'receipt-snap-1',
      scope: 'snapshot',
      rootCid: 'bafysnap_exists_000000000000001',
      uploadedAt: '2026-03-12T10:00:00.000Z',
    });

    const stateWithReceipts: CoopSharedState = {
      ...state,
      archiveReceipts: [snapshotReceipt],
    };

    const bundle = createArchiveBundle({
      scope: 'artifact',
      state: stateWithReceipts,
      artifactIds: state.artifacts.slice(0, 1).map((a) => a.id),
    });

    // Artifact bundles should never have previousSnapshotCid
    expect((bundle.payload as Record<string, unknown>).previousSnapshotCid).toBeUndefined();
  });
});
