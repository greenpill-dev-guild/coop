import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStorachaArchiveClient,
  requestArchiveDelegation,
  uploadArchiveBundleToStoracha,
} from '../storacha';

const storachaMocks = vi.hoisted(() => {
  const addSpace = vi.fn();
  const addProof = vi.fn();
  const setCurrentSpace = vi.fn();
  const uploadFile = vi.fn();
  const did = vi.fn(() => 'did:key:test-agent');
  const clientFactory = vi.fn(async () => ({
    did,
    addSpace,
    addProof,
    setCurrentSpace,
    uploadFile,
  }));
  const parseProof = vi.fn(async (value: string) => ({ proof: value }));

  return {
    addSpace,
    addProof,
    setCurrentSpace,
    uploadFile,
    did,
    clientFactory,
    parseProof,
  };
});

vi.mock('@storacha/client', () => ({
  create: storachaMocks.clientFactory,
}));

vi.mock('@storacha/client/proof', () => ({
  parse: storachaMocks.parseProof,
}));

describe('storacha archive helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('requests delegated archive material from a trusted issuer', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: ['proof-a'],
      }),
    } as Response);

    const delegation = await requestArchiveDelegation({
      issuerUrl: 'https://issuer.example/archive',
      issuerToken: 'issuer-token',
      audienceDid: 'did:key:test-agent',
      coopId: 'coop-1',
      scope: 'artifact',
      artifactIds: ['artifact-1'],
      actorAddress: '0x1111111111111111111111111111111111111111',
      safeAddress: '0x2222222222222222222222222222222222222222',
      chainKey: 'celo-sepolia',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://issuer.example/archive',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer issuer-token',
        }),
      }),
    );
    expect(delegation.spaceDid).toBe('did:key:space');
    expect(delegation.proofs).toEqual(['proof-a']);
  });

  it('uploads an archive bundle with delegated proofs and collects shard metadata', async () => {
    storachaMocks.uploadFile.mockImplementation(
      async (
        _blob: Blob,
        options?: {
          onShardStored?: (meta: {
            cid: { toString(): string };
            piece?: { toString(): string };
          }) => void;
        },
      ) => {
        options?.onShardStored?.({
          cid: { toString: () => 'bafyshard1' },
          piece: { toString: () => 'bafkpiece1' },
        });
        options?.onShardStored?.({
          cid: { toString: () => 'bafyshard2' },
        });
        return { toString: () => 'bafyroot' };
      },
    );

    const client = await createStorachaArchiveClient();
    const result = await uploadArchiveBundleToStoracha({
      client,
      bundle: {
        id: 'bundle-1',
        scope: 'artifact',
        targetCoopId: 'coop-1',
        createdAt: new Date().toISOString(),
        payload: {
          coop: { id: 'coop-1', name: 'Archive Coop' },
          artifacts: [{ id: 'artifact-1', title: 'Proof of work' }],
        },
      },
      delegation: {
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: ['proof-a', 'proof-b'],
        allowsFilecoinInfo: false,
      },
    });

    expect(storachaMocks.parseProof).toHaveBeenCalledWith('space-proof');
    expect(storachaMocks.parseProof).toHaveBeenCalledWith('proof-a');
    expect(storachaMocks.addSpace).toHaveBeenCalledTimes(1);
    expect(storachaMocks.addProof).toHaveBeenCalledTimes(2);
    expect(storachaMocks.setCurrentSpace).toHaveBeenCalledWith('did:key:space');
    expect(result.rootCid).toBe('bafyroot');
    expect(result.shardCids).toEqual(['bafyshard1', 'bafyshard2']);
    expect(result.pieceCids).toEqual(['bafkpiece1']);
    expect(result.gatewayUrl).toBe('https://storacha.link/ipfs/bafyroot');
  });
});
