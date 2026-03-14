import { describe, expect, it } from 'vitest';
import type { ArchiveReceipt, Artifact, CoopSharedState } from '../../../contracts/schema';
import { createCoop } from '../../coop/flows';
import {
  exportArchiveReceiptJson,
  exportArchiveReceiptTextBundle,
  exportArtifactJson,
  exportArtifactTextBundle,
  exportCoopSnapshotJson,
  exportSnapshotTextBundle,
} from '../export';

function buildSetupInsights() {
  return {
    summary: 'Testing export formatting.',
    crossCuttingPainPoints: ['Lost context'],
    crossCuttingOpportunities: ['Durable exports'],
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
    coopName: 'Export Test Coop',
    purpose: 'Testing export formatting.',
    creatorDisplayName: 'Mina',
    captureMode: 'manual',
    seedContribution: 'Export test seed.',
    setupInsights: buildSetupInsights(),
  }).state;
}

function createTestArtifact(state: CoopSharedState): Artifact {
  return {
    id: 'artifact-export-1',
    originId: 'origin-1',
    targetCoopId: state.profile.id,
    title: 'Exported Artifact',
    summary: 'This artifact tests the export format.',
    sources: [
      { url: 'https://example.com/exported', label: 'Example Export', domain: 'example.com' },
    ],
    tags: ['export', 'test'],
    category: 'insight',
    whyItMatters: 'Validates export integrity.',
    suggestedNextStep: 'Check the output.',
    createdBy: state.members[0].id,
    createdAt: '2026-03-13T14:00:00.000Z',
    reviewStatus: 'published',
    archiveStatus: 'not-archived',
    archiveReceiptIds: [],
  };
}

function createTestReceipt(state: CoopSharedState): ArchiveReceipt {
  return {
    id: 'receipt-export-1',
    scope: 'artifact',
    targetCoopId: state.profile.id,
    artifactIds: ['artifact-export-1'],
    bundleReference: 'bundle-export-1',
    rootCid: 'bafyexportcid123456789',
    shardCids: [],
    pieceCids: ['piece-cid-1'],
    gatewayUrl: 'https://gateway.example.com/ipfs/bafyexportcid123456789',
    uploadedAt: '2026-03-13T14:30:00.000Z',
    filecoinStatus: 'pending',
    delegationIssuer: 'export-test-issuer',
    delegation: {
      issuer: 'export-test-issuer',
      mode: 'mock',
      allowsFilecoinInfo: false,
    },
    anchorStatus: 'pending',
  };
}

describe('exportCoopSnapshotJson', () => {
  it('produces valid JSON with expected top-level fields', () => {
    const state = createTestState();
    const json = exportCoopSnapshotJson(state);
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe('coop-snapshot');
    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.snapshot).toBeTruthy();
    expect(parsed.snapshot.profile.name).toBe('Export Test Coop');
    expect(parsed.snapshot.members).toHaveLength(1);
  });

  it('produces pretty-printed JSON (indented)', () => {
    const state = createTestState();
    const json = exportCoopSnapshotJson(state);
    // Pretty-printed JSON contains newlines and indentation
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });
});

describe('exportSnapshotTextBundle', () => {
  it('produces readable text with coop name, members, and artifact count', () => {
    const state = createTestState();
    const text = exportSnapshotTextBundle(state);

    expect(text).toContain('# Export Test Coop');
    expect(text).toContain('Members:');
    expect(text).toContain('Mina');
    expect(text).toContain('Artifacts:');
    expect(text).toContain('Archive receipts:');
    expect(text).toContain('Safe:');
  });
});

describe('exportArtifactJson', () => {
  it('wraps the artifact in a typed envelope', () => {
    const state = createTestState();
    const artifact = createTestArtifact(state);
    const json = exportArtifactJson(artifact);
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe('artifact');
    expect(parsed.artifact.id).toBe('artifact-export-1');
    expect(parsed.artifact.title).toBe('Exported Artifact');
  });
});

describe('exportArtifactTextBundle', () => {
  it('formats the artifact as a readable text block', () => {
    const state = createTestState();
    const artifact = createTestArtifact(state);
    const text = exportArtifactTextBundle(artifact);

    expect(text).toContain('# Exported Artifact');
    expect(text).toContain('This artifact tests the export format.');
    expect(text).toContain('Category: insight');
    expect(text).toContain('Tags: export, test');
    expect(text).toContain('Sources: https://example.com/exported');
    expect(text).toContain('Why it matters: Validates export integrity.');
    expect(text).toContain('Suggested next step: Check the output.');
  });
});

describe('exportArchiveReceiptJson', () => {
  it('wraps the receipt in a typed envelope', () => {
    const state = createTestState();
    const receipt = createTestReceipt(state);
    const json = exportArchiveReceiptJson(receipt);
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe('archive-receipt');
    expect(parsed.receipt.id).toBe('receipt-export-1');
    expect(parsed.receipt.rootCid).toBe('bafyexportcid123456789');
  });
});

describe('exportArchiveReceiptTextBundle', () => {
  it('formats the receipt as readable text with all present fields', () => {
    const state = createTestState();
    const receipt = createTestReceipt(state);
    const text = exportArchiveReceiptTextBundle(receipt);

    expect(text).toContain('# Archive Receipt receipt-export-1');
    expect(text).toContain('Scope: artifact');
    expect(text).toContain(`Target coop: ${state.profile.id}`);
    expect(text).toContain('Root CID: bafyexportcid123456789');
    expect(text).toContain('Gateway: https://gateway.example.com/ipfs/bafyexportcid123456789');
    expect(text).toContain('Filecoin status: pending');
    expect(text).toContain('Delegation issuer: export-test-issuer');
    expect(text).toContain('Delegation mode: mock');
    expect(text).toContain('Piece CIDs: piece-cid-1');
  });

  it('omits optional fields when absent', () => {
    const state = createTestState();
    const receipt: ArchiveReceipt = {
      ...createTestReceipt(state),
      delegation: undefined,
      pieceCids: [],
    };
    const text = exportArchiveReceiptTextBundle(receipt);

    expect(text).not.toContain('Delegation mode:');
    expect(text).not.toContain('Piece CIDs:');
    expect(text).not.toContain('Last follow-up');
  });
});
