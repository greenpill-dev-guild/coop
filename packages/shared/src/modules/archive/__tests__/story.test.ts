import { describe, expect, it } from 'vitest';
import type { ArchiveReceipt, CoopSharedState } from '../../../contracts/schema';
import { createCoop } from '../../coop/flows';
import {
  buildCoopArchiveStory,
  describeArchiveReceipt,
  isArchiveWorthy,
  withArchiveWorthiness,
} from '../story';

function buildSetupInsights() {
  return {
    summary: 'Testing archive worthiness.',
    crossCuttingPainPoints: ['Context disappears'],
    crossCuttingOpportunities: ['Archive it'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Scattered.',
        painPoints: 'Lost.',
        improvements: 'Keep.',
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
        improvements: 'Show.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Tabs.',
        painPoints: 'Lost.',
        improvements: 'Story.',
      },
    ],
  } as const;
}

function createTestState(): CoopSharedState {
  return createCoop({
    coopName: 'Archive Story Coop',
    purpose: 'Testing archive story logic.',
    creatorDisplayName: 'Mina',
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
    artifactIds: state.artifacts.slice(0, 1).map((a) => a.id),
    bundleReference: 'bundle-ref-1',
    rootCid: 'bafy1234567890abcdef1234567890',
    shardCids: [],
    pieceCids: [],
    gatewayUrl: 'https://gateway.example.com/ipfs/bafy1234567890abcdef1234567890',
    uploadedAt: '2026-03-13T14:00:00.000Z',
    filecoinStatus: 'pending',
    delegationIssuer: 'trusted-node-demo',
    anchorStatus: 'pending',
    ...overrides,
  };
}

describe('isArchiveWorthy', () => {
  it('returns true when flagged is true', () => {
    expect(
      isArchiveWorthy({
        archiveWorthiness: { flagged: true, flaggedAt: '2026-03-13T12:00:00.000Z' },
      }),
    ).toBe(true);
  });

  it('returns false when archiveWorthiness is undefined', () => {
    expect(isArchiveWorthy({ archiveWorthiness: undefined })).toBe(false);
  });

  it('returns false for null or undefined input', () => {
    expect(isArchiveWorthy(null)).toBe(false);
    expect(isArchiveWorthy(undefined)).toBe(false);
  });
});

describe('withArchiveWorthiness', () => {
  it('adds archive worthiness when flagged is true', () => {
    const result = withArchiveWorthiness({ id: '1' }, true, '2026-03-13T12:00:00.000Z');
    expect(result.archiveWorthiness).toEqual({
      flagged: true,
      flaggedAt: '2026-03-13T12:00:00.000Z',
    });
  });

  it('removes archive worthiness when flagged is false', () => {
    const result = withArchiveWorthiness({ id: '1' }, false);
    expect(result.archiveWorthiness).toBeUndefined();
  });

  it('preserves the original value properties', () => {
    const original = { id: '1', name: 'test' };
    const result = withArchiveWorthiness(original, true, '2026-03-13T12:00:00.000Z');
    expect(result.id).toBe('1');
    expect(result.name).toBe('test');
  });
});

describe('describeArchiveReceipt', () => {
  it('describes an artifact-scope receipt with resolved artifact titles', () => {
    const state = createTestState();
    const receipt = createTestReceipt(state);

    const details = describeArchiveReceipt({ receipt, state });

    expect(details.scope).toBe('artifact');
    expect(details.purpose).toBe('Shared find save');
    expect(details.title).toBe(state.artifacts[0].title);
    expect(details.rootCid).toBe(receipt.rootCid);
    expect(details.gatewayUrl).toBe(receipt.gatewayUrl);
    expect(details.delegationMode).toBe('mock');
  });

  it('describes a snapshot-scope receipt with coop profile info', () => {
    const state = createTestState();
    const receipt = createTestReceipt(state, {
      scope: 'snapshot',
      artifactIds: [],
    });

    const details = describeArchiveReceipt({ receipt, state });

    expect(details.scope).toBe('snapshot');
    expect(details.purpose).toBe('Coop snapshot');
    expect(details.title).toContain(state.profile.name);
    expect(details.summary).toContain('flock members');
    expect(details.summary).toContain('shared finds');
  });
});

describe('buildCoopArchiveStory', () => {
  it('builds a story with zero archived artifacts when none exist', () => {
    const state = createTestState();
    const story = buildCoopArchiveStory(state);

    expect(story.archivedArtifactCount).toBe(0);
    expect(story.latestSnapshotReceipt).toBeNull();
    expect(story.latestArtifactReceipt).toBeNull();
    expect(story.snapshotSummary).toBeTruthy();
  });

  it('finds the latest receipts by scope when receipts are present', () => {
    const state = createTestState();
    const artifactReceipt = createTestReceipt(state, { id: 'receipt-artifact-1' });
    const snapshotReceipt = createTestReceipt(state, {
      id: 'receipt-snapshot-1',
      scope: 'snapshot',
      artifactIds: [],
    });

    const stateWithReceipts = {
      ...state,
      archiveReceipts: [artifactReceipt, snapshotReceipt],
    };

    const story = buildCoopArchiveStory(stateWithReceipts);

    expect(story.latestArtifactReceipt).not.toBeNull();
    expect(story.latestArtifactReceipt?.id).toBe('receipt-artifact-1');
    expect(story.latestSnapshotReceipt).not.toBeNull();
    expect(story.latestSnapshotReceipt?.id).toBe('receipt-snapshot-1');
  });

  it('counts archive-worthy artifacts', () => {
    const state = createTestState();
    const flaggedArtifact = withArchiveWorthiness(
      state.artifacts[0],
      true,
      '2026-03-13T12:00:00.000Z',
    );

    const stateWithFlagged = {
      ...state,
      artifacts: [flaggedArtifact, ...state.artifacts.slice(1)],
    };

    const story = buildCoopArchiveStory(stateWithFlagged);
    expect(story.archiveWorthyArtifactCount).toBeGreaterThanOrEqual(1);
  });
});
