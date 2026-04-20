import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createCoop, generateInviteCode } from '../flows';
import { readCoopState, writeCoopState } from '../sync';

const defaultSetupInsights = {
  summary: 'A concise but valid setup payload for shared collection sync testing.',
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

function buildState() {
  const { state } = createCoop({
    coopName: 'Shared Collection Sync Test',
    purpose: 'Exercise the remaining per-item sync collections.',
    creatorDisplayName: 'Tester',
    captureMode: 'manual',
    seedContribution: 'Testing seed contribution.',
    setupInsights: defaultSetupInsights,
  });

  state.invites = [
    generateInviteCode({
      state,
      createdBy: state.members[0].id,
      type: 'member',
    }),
  ];
  state.reviewBoard = [
    {
      id: 'group-1',
      groupBy: 'category',
      label: 'Funding',
      artifactIds: [],
    },
  ];
  state.archiveReceipts = [
    {
      id: 'receipt-1',
      scope: 'artifact',
      targetCoopId: state.profile.id,
      artifactIds: [],
      bundleReference: 'bundle-1',
      rootCid: 'bafyroot123',
      shardCids: ['bafyshard123'],
      pieceCids: ['bafypiece123'],
      gatewayUrl: 'https://storacha.link/ipfs/bafyroot123',
      uploadedAt: new Date('2026-01-10T00:00:00.000Z').toISOString(),
      filecoinStatus: 'pending',
      delegationIssuer: 'did:key:zIssuer',
      contentEncoding: 'plain-json',
      anchorStatus: 'pending',
    },
  ];
  state.memberAccounts = [
    {
      id: 'account-1',
      memberId: state.members[0].id,
      coopId: state.profile.id,
      accountType: 'safe',
      ownerPasskeyCredentialId: 'passkey-1',
      chainKey: 'sepolia',
      status: 'pending',
      statusNote: 'Waiting for provisioning',
      createdAt: new Date('2026-01-11T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-01-11T00:00:00.000Z').toISOString(),
    },
  ];

  return state;
}

describe('remaining shared collection sync migrations', () => {
  it('round-trips invites, review board groups, archive receipts, and member accounts', () => {
    const state = buildState();
    const doc = new Y.Doc();

    writeCoopState(doc, state);
    const loaded = readCoopState(doc);

    expect(loaded.invites.map((invite) => invite.id)).toEqual(
      state.invites.map((invite) => invite.id),
    );
    expect(loaded.reviewBoard.map((group) => group.id)).toEqual(
      state.reviewBoard.map((group) => group.id),
    );
    expect(loaded.archiveReceipts.map((receipt) => receipt.id)).toEqual(
      state.archiveReceipts.map((receipt) => receipt.id),
    );
    expect(loaded.memberAccounts.map((account) => account.id)).toEqual(
      state.memberAccounts.map((account) => account.id),
    );
  });

  it('does not emit an update when the same state is written twice', () => {
    const state = buildState();
    const doc = new Y.Doc();

    writeCoopState(doc, state);
    const onUpdate = vi.fn();
    doc.on('update', onUpdate);

    writeCoopState(doc, state);

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
