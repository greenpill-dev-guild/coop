import { describe, expect, it } from 'vitest';
import { createCoop } from '../../coop/flows';
import {
  applyArchiveReceiptFollowUp,
  createArchiveBundle,
  createArchiveReceiptFromUpload,
  updateArchiveReceipt,
} from '../archive';

function buildSetupInsights() {
  return {
    summary: 'A compact setup payload for archive follow-up coverage.',
    crossCuttingPainPoints: ['Archive status stays invisible'],
    crossCuttingOpportunities: ['Refresh Filecoin info from a visible operator flow'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Funding context is scattered.',
        painPoints: 'Archive status goes stale.',
        improvements: 'Refresh it directly from the node.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Evidence is durable but hard to inspect.',
        painPoints: 'Filecoin follow-up is opaque.',
        improvements: 'Persist the useful subset.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Follow-up is manual.',
        painPoints: 'Operators lack confidence.',
        improvements: 'Keep the log and receipt in sync.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Resources are archived with little context.',
        painPoints: 'Piece status is missing.',
        improvements: 'Keep piece and deal data legible.',
      },
    ],
  } as const;
}

describe('archive follow-up helpers', () => {
  it('persists live delegation and piece metadata on live receipts', () => {
    const created = createCoop({
      coopName: 'Archive Follow-Up Coop',
      purpose: 'Keep live archive metadata operational.',
      creatorDisplayName: 'Ari',
      captureMode: 'manual',
      seedContribution: 'I bring a durable operator trail.',
      setupInsights: buildSetupInsights(),
    });
    const artifact = created.state.artifacts[0];
    if (!artifact) {
      throw new Error('Expected an initial artifact.');
    }

    const receipt = createArchiveReceiptFromUpload({
      bundle: createArchiveBundle({
        scope: 'artifact',
        state: created.state,
        artifactIds: [artifact.id],
      }),
      delegationIssuer: 'did:key:issuer',
      delegationIssuerUrl: 'https://issuer.example/delegate',
      delegationAudienceDid: 'did:key:audience',
      delegationMode: 'live',
      allowsFilecoinInfo: true,
      rootCid: 'bafyroot',
      shardCids: ['bafyshard'],
      pieceCids: ['bafkpiece'],
      gatewayUrl: 'https://storacha.link/ipfs/bafyroot',
      artifactIds: [artifact.id],
    });

    expect(receipt.delegation?.mode).toBe('live');
    expect(receipt.delegation?.issuerUrl).toBe('https://issuer.example/delegate');
    expect(receipt.filecoinInfo?.pieceCid).toBe('bafkpiece');
  });

  it('promotes receipt status as Filecoin follow-up becomes richer', () => {
    const created = createCoop({
      coopName: 'Archive Follow-Up Coop',
      purpose: 'Keep live archive metadata operational.',
      creatorDisplayName: 'Ari',
      captureMode: 'manual',
      seedContribution: 'I bring a durable operator trail.',
      setupInsights: buildSetupInsights(),
    });
    const artifact = created.state.artifacts[0];
    if (!artifact) {
      throw new Error('Expected an initial artifact.');
    }

    const receipt = createArchiveReceiptFromUpload({
      bundle: createArchiveBundle({
        scope: 'artifact',
        state: created.state,
        artifactIds: [artifact.id],
      }),
      delegationIssuer: 'did:key:issuer',
      delegationMode: 'live',
      allowsFilecoinInfo: true,
      rootCid: 'bafyroot',
      shardCids: ['bafyshard'],
      pieceCids: ['bafkpiece'],
      gatewayUrl: 'https://storacha.link/ipfs/bafyroot',
      artifactIds: [artifact.id],
    });

    const indexed = applyArchiveReceiptFollowUp({
      receipt,
      refreshedAt: '2026-03-13T00:10:00.000Z',
      filecoinInfo: {
        piece: 'bafkpiece',
        aggregates: [{ aggregate: 'bafyaggregate', inclusion: { subtree: ['x'], index: 1 } }],
        deals: [],
      },
    });
    const sealed = applyArchiveReceiptFollowUp({
      receipt: indexed,
      refreshedAt: '2026-03-13T00:12:00.000Z',
      filecoinInfo: {
        piece: 'bafkpiece',
        aggregates: [{ aggregate: 'bafyaggregate' }],
        deals: [
          {
            aggregate: 'bafyaggregate',
            provider: 'f01234',
            aux: {
              dataSource: {
                dealID: 44,
              },
            },
          },
        ],
      },
    });
    const updatedState = updateArchiveReceipt(
      {
        ...created.state,
        archiveReceipts: [receipt],
      },
      receipt.id,
      sealed,
    );

    expect(indexed.filecoinStatus).toBe('indexed');
    expect(sealed.filecoinStatus).toBe('sealed');
    expect(sealed.followUp?.refreshCount).toBe(2);
    expect(updatedState.archiveReceipts[0]?.filecoinInfo?.deals[0]?.dealId).toBe('44');
  });
});
