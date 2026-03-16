import { describe, expect, it } from 'vitest';
import { archiveReceiptSchema } from '../../../contracts/schema';
import { createCoop } from '../../coop/flows';
import { applyArchiveAnchor, createArchiveBundle, createMockArchiveReceipt } from '../archive';

function buildSetupInsights() {
  return {
    summary: 'Anchor coverage setup payload.',
    crossCuttingPainPoints: ['CID anchoring is invisible'],
    crossCuttingOpportunities: ['On-chain CID anchoring for verification'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Funding context is scattered.',
        painPoints: 'No on-chain proof of archived knowledge.',
        improvements: 'Anchor CID on-chain for verifiable trail.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Evidence is durable but unverified.',
        painPoints: 'No chain link to archive.',
        improvements: 'Anchor creates a permanent link.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Decisions lack verifiable context.',
        painPoints: 'No anchor yet.',
        improvements: 'Self-tx anchors the archive.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Resources are archived but not anchored.',
        painPoints: 'Missing on-chain reference.',
        improvements: 'CID anchor closes the loop.',
      },
    ],
  } as const;
}

describe('archive anchor schema fields', () => {
  it('archiveReceiptSchema accepts anchor fields', () => {
    const base = {
      id: 'receipt-1',
      scope: 'artifact',
      targetCoopId: 'coop-1',
      artifactIds: [],
      bundleReference: 'bundle-1',
      rootCid: 'bafyroot',
      shardCids: [],
      pieceCids: [],
      gatewayUrl: 'https://storacha.link/ipfs/bafyroot',
      uploadedAt: '2026-03-14T12:00:00.000Z',
      filecoinStatus: 'pending',
      delegationIssuer: 'did:key:issuer',
    };

    const withAnchor = archiveReceiptSchema.parse({
      ...base,
      anchorTxHash: '0xabc123',
      anchorChainKey: 'sepolia',
      anchorStatus: 'anchored',
    });

    expect(withAnchor.anchorTxHash).toBe('0xabc123');
    expect(withAnchor.anchorChainKey).toBe('sepolia');
    expect(withAnchor.anchorStatus).toBe('anchored');
  });

  it('anchor fields default correctly when omitted', () => {
    const base = {
      id: 'receipt-2',
      scope: 'snapshot',
      targetCoopId: 'coop-2',
      artifactIds: [],
      bundleReference: 'bundle-2',
      rootCid: 'bafyroot2',
      shardCids: [],
      pieceCids: [],
      gatewayUrl: 'https://storacha.link/ipfs/bafyroot2',
      uploadedAt: '2026-03-14T12:00:00.000Z',
      filecoinStatus: 'offered',
      delegationIssuer: 'did:key:issuer',
    };

    const parsed = archiveReceiptSchema.parse(base);

    expect(parsed.anchorTxHash).toBeUndefined();
    expect(parsed.anchorChainKey).toBeUndefined();
    expect(parsed.anchorStatus).toBe('pending');
  });
});

describe('applyArchiveAnchor', () => {
  it('updates receipt with anchor transaction info', () => {
    const created = createCoop({
      coopName: 'Anchor Test Coop',
      purpose: 'Test on-chain CID anchoring.',
      creatorDisplayName: 'Anchor',
      captureMode: 'manual',
      seedContribution: 'Verify archive integrity on-chain.',
      setupInsights: buildSetupInsights(),
    });

    const artifact = created.state.artifacts[0];
    if (!artifact) throw new Error('Expected an initial artifact.');

    const receipt = createMockArchiveReceipt({
      bundle: createArchiveBundle({
        scope: 'artifact',
        state: created.state,
        artifactIds: [artifact.id],
      }),
      delegationIssuer: 'did:key:issuer',
      artifactIds: [artifact.id],
    });

    const anchored = applyArchiveAnchor(receipt, {
      txHash: '0xdeadbeef1234567890abcdef',
      chainKey: 'sepolia',
    });

    expect(anchored.anchorTxHash).toBe('0xdeadbeef1234567890abcdef');
    expect(anchored.anchorChainKey).toBe('sepolia');
    expect(anchored.anchorStatus).toBe('anchored');
    // Original fields are preserved
    expect(anchored.id).toBe(receipt.id);
    expect(anchored.rootCid).toBe(receipt.rootCid);
    expect(anchored.scope).toBe(receipt.scope);
  });

  it('preserves all existing receipt fields', () => {
    const created = createCoop({
      coopName: 'Preserve Fields Coop',
      purpose: 'Ensure anchor does not clobber receipt.',
      creatorDisplayName: 'Keeper',
      captureMode: 'manual',
      seedContribution: 'Nothing lost.',
      setupInsights: buildSetupInsights(),
    });

    const artifact = created.state.artifacts[0];
    if (!artifact) throw new Error('Expected an initial artifact.');

    const receipt = createMockArchiveReceipt({
      bundle: createArchiveBundle({
        scope: 'snapshot',
        state: created.state,
      }),
      delegationIssuer: 'did:key:issuer',
    });

    const anchored = applyArchiveAnchor(receipt, {
      txHash: '0xfeed',
      chainKey: 'arbitrum',
    });

    expect(anchored.filecoinStatus).toBe(receipt.filecoinStatus);
    expect(anchored.delegationIssuer).toBe(receipt.delegationIssuer);
    expect(anchored.gatewayUrl).toBe(receipt.gatewayUrl);
    expect(anchored.bundleReference).toBe(receipt.bundleReference);
  });
});
