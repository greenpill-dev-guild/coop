import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArchiveReceipt } from '../../../contracts/schema';
import {
  deriveArchiveReceiptFilecoinStatus,
  isArchiveReceiptRefreshable,
  summarizeArchiveFilecoinInfo,
} from '../archive';
import {
  createStorachaArchiveClient,
  issueArchiveDelegation,
  requestArchiveReceiptFilecoinInfo,
  uploadArchiveBundleToStoracha,
} from '../storacha';

const storachaMocks = vi.hoisted(() => {
  const validPieceCid = 'bafkreibuenncyubohem5h4ak6xnlxb6llcxpivtlcbrr6ks5xfevb277xu';
  const addSpace = vi.fn();
  const addProof = vi.fn();
  const setCurrentSpace = vi.fn();
  const uploadFile = vi.fn();
  const filecoinInfo = vi.fn();
  const createDelegation = vi.fn();
  const did = vi.fn(() => 'did:key:test-agent');
  const clientFactory = vi.fn(async () => ({
    did,
    addSpace,
    addProof,
    setCurrentSpace,
    uploadFile,
    createDelegation,
    capability: {
      filecoin: {
        info: filecoinInfo,
      },
    },
  }));
  const parseProof = vi.fn(async (value: string) => ({ proof: value }));

  return {
    addSpace,
    addProof,
    setCurrentSpace,
    uploadFile,
    filecoinInfo,
    createDelegation,
    validPieceCid,
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

/* ------------------------------------------------------------------ */
/*  Helper to build a minimal ArchiveReceipt for testing               */
/* ------------------------------------------------------------------ */
function buildReceipt(overrides: Partial<ArchiveReceipt> = {}): ArchiveReceipt {
  return {
    id: 'receipt-1',
    scope: 'artifact',
    targetCoopId: 'coop-1',
    artifactIds: ['artifact-1'],
    bundleReference: 'bundle-1',
    rootCid: 'bafyroot',
    shardCids: ['bafyshard1'],
    pieceCids: [storachaMocks.validPieceCid],
    gatewayUrl: 'https://storacha.link/ipfs/bafyroot',
    uploadedAt: new Date().toISOString(),
    filecoinStatus: 'offered',
    delegationIssuer: 'trusted-node-demo',
    delegation: {
      issuer: 'trusted-node-demo',
      mode: 'live',
      allowsFilecoinInfo: true,
    },
    anchorStatus: 'pending',
    ...overrides,
  };
}

describe('storacha archive helpers', () => {
  const validAudienceDid = 'did:key:z6MkuTR1Q9bmw2iPVobJeEkUdMZkbGGcXK5KdYE8vKygUvGp';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ================================================================ */
  /*  issueArchiveDelegation                                          */
  /* ================================================================ */

  it('issues trusted-node delegation from static config without a signer key', async () => {
    const delegation = await issueArchiveDelegation({
      request: {
        audienceDid: validAudienceDid,
        coopId: 'coop-1',
        scope: 'artifact',
        operation: 'upload',
        artifactIds: ['artifact-1'],
        actorAddress: '0x1111111111111111111111111111111111111111',
        safeAddress: '0x2222222222222222222222222222222222222222',
        chainKey: 'sepolia',
      },
      config: {
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: ['proof-a'],
        allowsFilecoinInfo: false,
        expirationSeconds: 600,
      },
    });

    expect(delegation.spaceDid).toBe('did:key:space');
    expect(delegation.delegationIssuer).toBe('trusted-node-demo');
    expect(delegation.proofs).toEqual(['proof-a']);
    expect(delegation.allowsFilecoinInfo).toBe(false);
  });

  it('issues signer-backed trusted-node delegation with upload abilities', async () => {
    storachaMocks.createDelegation.mockResolvedValue({
      archive: async () => ({ ok: new Uint8Array([1, 2, 3, 4]) }),
    });

    const delegation = await issueArchiveDelegation({
      request: {
        audienceDid: validAudienceDid,
        coopId: 'coop-1',
        scope: 'artifact',
        operation: 'upload',
        artifactIds: ['artifact-1'],
        actorAddress: '0x1111111111111111111111111111111111111111',
        safeAddress: '0x2222222222222222222222222222222222222222',
        chainKey: 'sepolia',
      },
      config: {
        agentPrivateKey: 'agent-private-key',
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: ['proof-a', 'proof-b'],
        allowsFilecoinInfo: true,
        expirationSeconds: 600,
      },
      decodeSigner: () =>
        ({
          did: () => 'did:key:trusted-node',
        }) as never,
      createDelegationClient: async () =>
        ({
          addSpace: storachaMocks.addSpace,
          addProof: storachaMocks.addProof,
          setCurrentSpace: storachaMocks.setCurrentSpace,
          createDelegation: storachaMocks.createDelegation,
        }) as never,
    });

    expect(storachaMocks.parseProof).toHaveBeenCalledWith('space-proof');
    expect(storachaMocks.parseProof).toHaveBeenCalledWith('proof-a');
    expect(storachaMocks.parseProof).toHaveBeenCalledWith('proof-b');
    expect(storachaMocks.setCurrentSpace).toHaveBeenCalledWith('did:key:space');
    expect(storachaMocks.createDelegation).toHaveBeenCalledWith(
      expect.anything(),
      ['filecoin/offer', 'space/blob/add', 'space/index/add', 'upload/add', 'filecoin/info'],
      expect.objectContaining({
        expiration: expect.any(Number),
      }),
    );
    expect(delegation.delegationIssuer).toBe('did:key:trusted-node');
    expect(delegation.proofs).toEqual([]);
    expect(delegation.allowsFilecoinInfo).toBe(true);
  });

  it('issues follow-up delegation with only filecoin/info ability', async () => {
    const createDelegation = vi.fn().mockResolvedValue({
      archive: async () => ({ ok: new Uint8Array([9, 9, 9]) }),
    });

    await issueArchiveDelegation({
      request: {
        audienceDid: validAudienceDid,
        coopId: 'coop-1',
        scope: 'artifact',
        operation: 'follow-up',
        artifactIds: ['artifact-1'],
        actorAddress: '0x1111111111111111111111111111111111111111',
        safeAddress: '0x2222222222222222222222222222222222222222',
        chainKey: 'sepolia',
        receiptId: 'receipt-1',
        rootCid: 'bafyroot',
        pieceCids: ['bafkpiece1'],
      },
      config: {
        agentPrivateKey: 'agent-private-key',
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: [],
        allowsFilecoinInfo: false,
        expirationSeconds: 600,
      },
      decodeSigner: () =>
        ({
          did: () => 'did:key:trusted-node',
        }) as never,
      createDelegationClient: async () =>
        ({
          addSpace: vi.fn(),
          addProof: vi.fn(),
          setCurrentSpace: vi.fn(),
          createDelegation,
        }) as never,
    });

    expect(createDelegation).toHaveBeenCalledWith(
      expect.anything(),
      ['filecoin/info'],
      expect.objectContaining({
        expiration: expect.any(Number),
      }),
    );
  });

  it('rejects static follow-up delegation when config does not allow filecoin info', async () => {
    await expect(
      issueArchiveDelegation({
        request: {
          audienceDid: validAudienceDid,
          coopId: 'coop-1',
          scope: 'artifact',
          operation: 'follow-up',
          artifactIds: ['artifact-1'],
          receiptId: 'receipt-1',
          rootCid: 'bafyroot',
          pieceCids: ['bafkpiece1'],
        },
        config: {
          spaceDid: 'did:key:space',
          delegationIssuer: 'trusted-node-demo',
          gatewayBaseUrl: 'https://storacha.link',
          spaceDelegation: 'space-proof',
          proofs: ['proof-a'],
          allowsFilecoinInfo: false,
          expirationSeconds: 600,
        },
      }),
    ).rejects.toThrow('Static trusted-node archive config does not allow Filecoin info follow-up.');
  });

  it('fails clearly when trusted-node archive config is malformed', async () => {
    await expect(
      issueArchiveDelegation({
        request: {
          audienceDid: validAudienceDid,
          coopId: 'coop-1',
          scope: 'artifact',
          operation: 'upload',
          artifactIds: [],
        },
        config: {
          delegationIssuer: 'trusted-node-demo',
          gatewayBaseUrl: 'https://storacha.link',
          spaceDelegation: 'space-proof',
          proofs: [],
          allowsFilecoinInfo: false,
          expirationSeconds: 600,
        } as never,
      }),
    ).rejects.toThrow();
  });

  it('issues static follow-up delegation when config allows filecoin info', async () => {
    const delegation = await issueArchiveDelegation({
      request: {
        audienceDid: validAudienceDid,
        coopId: 'coop-1',
        scope: 'artifact',
        operation: 'follow-up',
        artifactIds: ['artifact-1'],
        receiptId: 'receipt-1',
        rootCid: 'bafyroot',
        pieceCids: ['bafkpiece1'],
      },
      config: {
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: ['proof-a'],
        allowsFilecoinInfo: true,
        expirationSeconds: 300,
      },
    });

    expect(delegation.spaceDid).toBe('did:key:space');
    expect(delegation.allowsFilecoinInfo).toBe(true);
    expect(delegation.expiresAt).toBeDefined();
  });

  it('issues upload delegation without filecoinInfo ability when config disallows it', async () => {
    const createDelegation = vi.fn().mockResolvedValue({
      archive: async () => ({ ok: new Uint8Array([5, 6]) }),
    });

    await issueArchiveDelegation({
      request: {
        audienceDid: validAudienceDid,
        coopId: 'coop-1',
        scope: 'artifact',
        operation: 'upload',
        artifactIds: ['artifact-1'],
      },
      config: {
        agentPrivateKey: 'agent-private-key',
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: [],
        allowsFilecoinInfo: false,
        expirationSeconds: 600,
      },
      decodeSigner: () =>
        ({
          did: () => 'did:key:trusted-node',
        }) as never,
      createDelegationClient: async () =>
        ({
          addSpace: vi.fn(),
          addProof: vi.fn(),
          setCurrentSpace: vi.fn(),
          createDelegation,
        }) as never,
    });

    expect(createDelegation).toHaveBeenCalledWith(
      expect.anything(),
      ['filecoin/offer', 'space/blob/add', 'space/index/add', 'upload/add'],
      expect.objectContaining({ expiration: expect.any(Number) }),
    );
  });

  it('throws when signer-backed delegation archive fails with an Error', async () => {
    const archiveError = new Error('Delegation archive exploded');
    const createDelegation = vi.fn().mockResolvedValue({
      archive: async () => ({ error: archiveError }),
    });

    await expect(
      issueArchiveDelegation({
        request: {
          audienceDid: validAudienceDid,
          coopId: 'coop-1',
          scope: 'artifact',
          operation: 'upload',
          artifactIds: [],
        },
        config: {
          agentPrivateKey: 'agent-private-key',
          spaceDid: 'did:key:space',
          delegationIssuer: 'trusted-node-demo',
          gatewayBaseUrl: 'https://storacha.link',
          spaceDelegation: 'space-proof',
          proofs: [],
          allowsFilecoinInfo: false,
          expirationSeconds: 600,
        },
        decodeSigner: () =>
          ({
            did: () => 'did:key:trusted-node',
          }) as never,
        createDelegationClient: async () =>
          ({
            addSpace: vi.fn(),
            addProof: vi.fn(),
            setCurrentSpace: vi.fn(),
            createDelegation,
          }) as never,
      }),
    ).rejects.toThrow('Delegation archive exploded');
  });

  it('throws generic message when delegation archive fails with non-Error value', async () => {
    const createDelegation = vi.fn().mockResolvedValue({
      archive: async () => ({ error: 'not an Error object' }),
    });

    await expect(
      issueArchiveDelegation({
        request: {
          audienceDid: validAudienceDid,
          coopId: 'coop-1',
          scope: 'artifact',
          operation: 'upload',
          artifactIds: [],
        },
        config: {
          agentPrivateKey: 'agent-private-key',
          spaceDid: 'did:key:space',
          delegationIssuer: 'trusted-node-demo',
          gatewayBaseUrl: 'https://storacha.link',
          spaceDelegation: 'space-proof',
          proofs: [],
          allowsFilecoinInfo: false,
          expirationSeconds: 600,
        },
        decodeSigner: () =>
          ({
            did: () => 'did:key:trusted-node',
          }) as never,
        createDelegationClient: async () =>
          ({
            addSpace: vi.fn(),
            addProof: vi.fn(),
            setCurrentSpace: vi.fn(),
            createDelegation,
          }) as never,
      }),
    ).rejects.toThrow('Could not archive delegation material.');
  });

  it('uses signer.did() as delegationIssuer when it returns a non-empty value', async () => {
    storachaMocks.createDelegation.mockResolvedValue({
      archive: async () => ({ ok: new Uint8Array([1]) }),
    });

    const delegation = await issueArchiveDelegation({
      request: {
        audienceDid: validAudienceDid,
        coopId: 'coop-1',
        scope: 'artifact',
        operation: 'upload',
        artifactIds: [],
      },
      config: {
        agentPrivateKey: 'agent-private-key',
        spaceDid: 'did:key:space',
        delegationIssuer: 'config-issuer',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: [],
        allowsFilecoinInfo: false,
        expirationSeconds: 600,
      },
      decodeSigner: () =>
        ({
          did: () => 'did:key:signer-did',
        }) as never,
      createDelegationClient: async () =>
        ({
          addSpace: storachaMocks.addSpace,
          addProof: storachaMocks.addProof,
          setCurrentSpace: storachaMocks.setCurrentSpace,
          createDelegation: storachaMocks.createDelegation,
        }) as never,
    });

    expect(delegation.delegationIssuer).toBe('did:key:signer-did');
  });

  it('falls back to config delegationIssuer when signer.did() returns null', async () => {
    storachaMocks.createDelegation.mockResolvedValue({
      archive: async () => ({ ok: new Uint8Array([1]) }),
    });

    const delegation = await issueArchiveDelegation({
      request: {
        audienceDid: validAudienceDid,
        coopId: 'coop-1',
        scope: 'artifact',
        operation: 'upload',
        artifactIds: [],
      },
      config: {
        agentPrivateKey: 'agent-private-key',
        spaceDid: 'did:key:space',
        delegationIssuer: 'fallback-issuer',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: [],
        allowsFilecoinInfo: false,
        expirationSeconds: 600,
      },
      decodeSigner: () =>
        ({
          did: () => null,
        }) as never,
      createDelegationClient: async () =>
        ({
          addSpace: storachaMocks.addSpace,
          addProof: storachaMocks.addProof,
          setCurrentSpace: storachaMocks.setCurrentSpace,
          createDelegation: storachaMocks.createDelegation,
        }) as never,
    });

    expect(delegation.delegationIssuer).toBe('fallback-issuer');
  });

  /* ================================================================ */
  /*  uploadArchiveBundleToStoracha                                   */
  /* ================================================================ */

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
        schemaVersion: 1,
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

    expect(storachaMocks.addSpace).toHaveBeenCalledTimes(1);
    expect(storachaMocks.addProof).toHaveBeenCalledTimes(2);
    expect(storachaMocks.setCurrentSpace).toHaveBeenCalledWith('did:key:space');
    expect(result.rootCid).toBe('bafyroot');
    expect(result.shardCids).toEqual(['bafyshard1', 'bafyshard2']);
    expect(result.pieceCids).toEqual(['bafkpiece1']);
    expect(result.gatewayUrl).toBe('https://storacha.link/ipfs/bafyroot');
  });

  it('uploads without explicit client and falls back to createStorachaArchiveClient', async () => {
    storachaMocks.uploadFile.mockResolvedValue({ toString: () => 'bafyroot-auto' });

    const result = await uploadArchiveBundleToStoracha({
      bundle: {
        id: 'bundle-auto',
        scope: 'artifact',
        targetCoopId: 'coop-1',
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
        payload: {
          coop: { id: 'coop-1', name: 'Auto Coop' },
          artifacts: [],
        },
      },
      delegation: {
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: [],
        allowsFilecoinInfo: false,
      },
    });

    expect(storachaMocks.clientFactory).toHaveBeenCalled();
    expect(result.rootCid).toBe('bafyroot-auto');
    expect(result.audienceDid).toBe('did:key:test-agent');
  });

  it('deduplicates piece CIDs across multiple shards', async () => {
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
          piece: { toString: () => 'bafkpiece-shared' },
        });
        options?.onShardStored?.({
          cid: { toString: () => 'bafyshard2' },
          piece: { toString: () => 'bafkpiece-shared' },
        });
        options?.onShardStored?.({
          cid: { toString: () => 'bafyshard3' },
          piece: { toString: () => 'bafkpiece-unique' },
        });
        return { toString: () => 'bafyroot-dedup' };
      },
    );

    const client = await createStorachaArchiveClient();
    const result = await uploadArchiveBundleToStoracha({
      client,
      bundle: {
        id: 'bundle-dedup',
        scope: 'artifact',
        targetCoopId: 'coop-1',
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
        payload: { coop: { id: 'coop-1', name: 'Dedup Coop' }, artifacts: [] },
      },
      delegation: {
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: [],
        allowsFilecoinInfo: false,
      },
    });

    expect(result.shardCids).toHaveLength(3);
    expect(result.pieceCids).toEqual(['bafkpiece-shared', 'bafkpiece-unique']);
  });

  /* ================================================================ */
  /*  requestArchiveReceiptFilecoinInfo                               */
  /* ================================================================ */

  it('requests Filecoin follow-up info for a live receipt', async () => {
    storachaMocks.filecoinInfo.mockResolvedValue({
      out: {
        ok: {
          piece: { toString: () => 'bafkpiece1' },
          aggregates: [{ aggregate: { toString: () => 'bafyaggregate' }, inclusion: {} }],
          deals: [
            {
              aggregate: { toString: () => 'bafyaggregate' },
              provider: { toString: () => 'f01234' },
              aux: {
                dataSource: {
                  dealID: 77,
                },
              },
            },
          ],
        },
      },
    });

    const info = await requestArchiveReceiptFilecoinInfo({
      client: await createStorachaArchiveClient(),
      receipt: buildReceipt(),
      delegation: {
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: ['proof-a'],
        allowsFilecoinInfo: true,
      },
    });

    expect(storachaMocks.filecoinInfo).toHaveBeenCalledTimes(1);
    expect(info.pieceCid).toBe('bafkpiece1');
    expect(info.aggregates[0]?.aggregate).toBe('bafyaggregate');
    expect(info.deals[0]?.dealId).toBe('77');
  });

  it('throws when receipt has no piece CID', async () => {
    await expect(
      requestArchiveReceiptFilecoinInfo({
        client: await createStorachaArchiveClient(),
        receipt: buildReceipt({
          pieceCids: [],
          filecoinInfo: undefined,
        }),
        delegation: {
          spaceDid: 'did:key:space',
          delegationIssuer: 'trusted-node-demo',
          gatewayBaseUrl: 'https://storacha.link',
          spaceDelegation: 'space-proof',
          proofs: [],
          allowsFilecoinInfo: true,
        },
      }),
    ).rejects.toThrow('Archive receipt has no piece CID to refresh.');
  });

  it('throws when delegation does not allow filecoin info', async () => {
    await expect(
      requestArchiveReceiptFilecoinInfo({
        client: await createStorachaArchiveClient(),
        receipt: buildReceipt(),
        delegation: {
          spaceDid: 'did:key:space',
          delegationIssuer: 'trusted-node-demo',
          gatewayBaseUrl: 'https://storacha.link',
          spaceDelegation: 'space-proof',
          proofs: [],
          allowsFilecoinInfo: false,
        },
      }),
    ).rejects.toThrow('Delegation does not allow Filecoin info follow-up.');
  });

  it('prefers filecoinInfo.pieceCid over pieceCids[0] for the info request', async () => {
    const infoPieceCid = storachaMocks.validPieceCid;
    const arrayPieceCid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenosa77bam';

    storachaMocks.filecoinInfo.mockResolvedValue({
      out: {
        ok: {
          piece: infoPieceCid,
          aggregates: [],
          deals: [],
        },
      },
    });

    await requestArchiveReceiptFilecoinInfo({
      client: await createStorachaArchiveClient(),
      receipt: buildReceipt({
        pieceCids: [arrayPieceCid],
        filecoinInfo: {
          pieceCid: infoPieceCid,
          aggregates: [],
          deals: [],
        },
      }),
      delegation: {
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: [],
        allowsFilecoinInfo: true,
      },
    });

    // Verify filecoin.info was called with the CID from filecoinInfo, not from pieceCids array
    expect(storachaMocks.filecoinInfo).toHaveBeenCalledTimes(1);
    const calledArg = storachaMocks.filecoinInfo.mock.calls[0]?.[0];
    expect(calledArg.toString()).toBe(infoPieceCid);
  });

  it('throws named error from filecoin/info response', async () => {
    storachaMocks.filecoinInfo.mockResolvedValue({
      out: {
        error: { name: 'PieceNotFound' },
      },
    });

    await expect(
      requestArchiveReceiptFilecoinInfo({
        client: await createStorachaArchiveClient(),
        receipt: buildReceipt(),
        delegation: {
          spaceDid: 'did:key:space',
          delegationIssuer: 'trusted-node-demo',
          gatewayBaseUrl: 'https://storacha.link',
          spaceDelegation: 'space-proof',
          proofs: [],
          allowsFilecoinInfo: true,
        },
      }),
    ).rejects.toThrow('PieceNotFound');
  });

  it('throws generic message when filecoin/info error has no name', async () => {
    storachaMocks.filecoinInfo.mockResolvedValue({
      out: {
        error: { code: 500 },
      },
    });

    await expect(
      requestArchiveReceiptFilecoinInfo({
        client: await createStorachaArchiveClient(),
        receipt: buildReceipt(),
        delegation: {
          spaceDid: 'did:key:space',
          delegationIssuer: 'trusted-node-demo',
          gatewayBaseUrl: 'https://storacha.link',
          spaceDelegation: 'space-proof',
          proofs: [],
          allowsFilecoinInfo: true,
        },
      }),
    ).rejects.toThrow('Storacha filecoin/info failed.');
  });

  it('throws when filecoin/info response has no ok result', async () => {
    storachaMocks.filecoinInfo.mockResolvedValue({
      out: {},
    });

    await expect(
      requestArchiveReceiptFilecoinInfo({
        client: await createStorachaArchiveClient(),
        receipt: buildReceipt(),
        delegation: {
          spaceDid: 'did:key:space',
          delegationIssuer: 'trusted-node-demo',
          gatewayBaseUrl: 'https://storacha.link',
          spaceDelegation: 'space-proof',
          proofs: [],
          allowsFilecoinInfo: true,
        },
      }),
    ).rejects.toThrow('Storacha filecoin/info returned no result.');
  });

  it('creates client automatically when none is provided to requestArchiveReceiptFilecoinInfo', async () => {
    storachaMocks.filecoinInfo.mockResolvedValue({
      out: {
        ok: {
          piece: 'bafk-auto',
          aggregates: [],
          deals: [],
        },
      },
    });

    const info = await requestArchiveReceiptFilecoinInfo({
      receipt: buildReceipt(),
      delegation: {
        spaceDid: 'did:key:space',
        delegationIssuer: 'trusted-node-demo',
        gatewayBaseUrl: 'https://storacha.link',
        spaceDelegation: 'space-proof',
        proofs: [],
        allowsFilecoinInfo: true,
      },
    });

    expect(storachaMocks.clientFactory).toHaveBeenCalled();
    expect(info.pieceCid).toBe('bafk-auto');
  });
});

/* ================================================================ */
/*  summarizeArchiveFilecoinInfo                                     */
/* ================================================================ */

describe('summarizeArchiveFilecoinInfo', () => {
  it('serializes piece as string when already a string', () => {
    const info = summarizeArchiveFilecoinInfo(
      { piece: 'bafk-string-piece' },
      '2026-03-13T00:00:00.000Z',
    );
    expect(info.pieceCid).toBe('bafk-string-piece');
  });

  it('serializes piece by calling toString() on objects', () => {
    const info = summarizeArchiveFilecoinInfo(
      { piece: { toString: () => 'bafk-object-piece' } },
      '2026-03-13T00:00:00.000Z',
    );
    expect(info.pieceCid).toBe('bafk-object-piece');
  });

  it('returns undefined pieceCid when piece is absent', () => {
    const info = summarizeArchiveFilecoinInfo({}, '2026-03-13T00:00:00.000Z');
    expect(info.pieceCid).toBeUndefined();
  });

  it('returns empty aggregates when none provided', () => {
    const info = summarizeArchiveFilecoinInfo({}, '2026-03-13T00:00:00.000Z');
    expect(info.aggregates).toEqual([]);
  });

  it('returns empty deals when none provided', () => {
    const info = summarizeArchiveFilecoinInfo({}, '2026-03-13T00:00:00.000Z');
    expect(info.deals).toEqual([]);
  });

  it('maps aggregates with string aggregate values', () => {
    const info = summarizeArchiveFilecoinInfo(
      {
        aggregates: [{ aggregate: 'bafyagg-string', inclusion: { subtree: ['x'], index: 0 } }],
      },
      '2026-03-13T00:00:00.000Z',
    );
    expect(info.aggregates).toHaveLength(1);
    expect(info.aggregates[0]?.aggregate).toBe('bafyagg-string');
    expect(info.aggregates[0]?.inclusionProofAvailable).toBe(true);
  });

  it('maps aggregates with object aggregate values', () => {
    const info = summarizeArchiveFilecoinInfo(
      {
        aggregates: [{ aggregate: { toString: () => 'bafyagg-obj' } }],
      },
      '2026-03-13T00:00:00.000Z',
    );
    expect(info.aggregates[0]?.aggregate).toBe('bafyagg-obj');
    expect(info.aggregates[0]?.inclusionProofAvailable).toBe(false);
  });

  it('maps deals with string aggregate and provider', () => {
    const info = summarizeArchiveFilecoinInfo(
      {
        deals: [
          {
            aggregate: 'bafyagg-deal',
            provider: 'f01234',
            aux: { dataSource: { dealID: 42 } },
          },
        ],
      },
      '2026-03-13T00:00:00.000Z',
    );
    expect(info.deals[0]?.aggregate).toBe('bafyagg-deal');
    expect(info.deals[0]?.provider).toBe('f01234');
    expect(info.deals[0]?.dealId).toBe('42');
  });

  it('maps deals with object aggregate and provider', () => {
    const info = summarizeArchiveFilecoinInfo(
      {
        deals: [
          {
            aggregate: { toString: () => 'bafyagg-deal-obj' },
            provider: { toString: () => 'f05678' },
            aux: { dataSource: { dealID: BigInt(99) } },
          },
        ],
      },
      '2026-03-13T00:00:00.000Z',
    );
    expect(info.deals[0]?.aggregate).toBe('bafyagg-deal-obj');
    expect(info.deals[0]?.provider).toBe('f05678');
    expect(info.deals[0]?.dealId).toBe('99');
  });

  it('handles deal without provider', () => {
    const info = summarizeArchiveFilecoinInfo(
      {
        deals: [{ aggregate: 'bafyagg' }],
      },
      '2026-03-13T00:00:00.000Z',
    );
    expect(info.deals[0]?.provider).toBeUndefined();
    expect(info.deals[0]?.dealId).toBeUndefined();
  });

  it('handles deal without aux or dataSource', () => {
    const info = summarizeArchiveFilecoinInfo(
      {
        deals: [{ aggregate: 'bafyagg', provider: 'f00000' }],
      },
      '2026-03-13T00:00:00.000Z',
    );
    expect(info.deals[0]?.dealId).toBeUndefined();
  });

  it('handles deal with aux but no dealID', () => {
    const info = summarizeArchiveFilecoinInfo(
      {
        deals: [{ aggregate: 'bafyagg', aux: { dataSource: {} } }],
      },
      '2026-03-13T00:00:00.000Z',
    );
    expect(info.deals[0]?.dealId).toBeUndefined();
  });

  it('uses default updatedAt when not provided', () => {
    const info = summarizeArchiveFilecoinInfo({ piece: 'bafk' });
    expect(info.lastUpdatedAt).toBeDefined();
    expect(typeof info.lastUpdatedAt).toBe('string');
  });

  it('maps multiple aggregates and deals correctly', () => {
    const info = summarizeArchiveFilecoinInfo(
      {
        piece: 'bafk-multi',
        aggregates: [{ aggregate: 'agg-1', inclusion: {} }, { aggregate: 'agg-2' }],
        deals: [
          {
            aggregate: 'agg-1',
            provider: 'f01',
            aux: { dataSource: { dealID: 1 } },
          },
          {
            aggregate: 'agg-2',
            provider: 'f02',
            aux: { dataSource: { dealID: 2 } },
          },
        ],
      },
      '2026-03-13T01:00:00.000Z',
    );

    expect(info.aggregates).toHaveLength(2);
    expect(info.aggregates[0]?.inclusionProofAvailable).toBe(true);
    expect(info.aggregates[1]?.inclusionProofAvailable).toBe(false);
    expect(info.deals).toHaveLength(2);
    expect(info.deals[0]?.dealId).toBe('1');
    expect(info.deals[1]?.dealId).toBe('2');
    expect(info.lastUpdatedAt).toBe('2026-03-13T01:00:00.000Z');
  });
});

/* ================================================================ */
/*  isArchiveReceiptRefreshable                                      */
/* ================================================================ */

describe('isArchiveReceiptRefreshable', () => {
  function makeReceipt(overrides: Partial<ArchiveReceipt> = {}): ArchiveReceipt {
    return {
      id: 'receipt-1',
      scope: 'artifact',
      targetCoopId: 'coop-1',
      artifactIds: ['artifact-1'],
      bundleReference: 'bundle-1',
      rootCid: 'bafyroot',
      shardCids: ['bafyshard1'],
      pieceCids: ['bafkpiece1'],
      gatewayUrl: 'https://storacha.link/ipfs/bafyroot',
      uploadedAt: '2026-03-13T00:00:00.000Z',
      filecoinStatus: 'offered',
      delegationIssuer: 'trusted-node-demo',
      delegation: {
        issuer: 'trusted-node-demo',
        mode: 'live',
        allowsFilecoinInfo: true,
      },
      anchorStatus: 'pending',
      ...overrides,
    };
  }

  it('returns true for live delegation, non-sealed status, with pieceCid', () => {
    expect(isArchiveReceiptRefreshable(makeReceipt())).toBe(true);
  });

  it('returns true for indexed status with live delegation', () => {
    expect(isArchiveReceiptRefreshable(makeReceipt({ filecoinStatus: 'indexed' }))).toBe(true);
  });

  it('returns true for pending status with live delegation and pieceCid in filecoinInfo', () => {
    expect(
      isArchiveReceiptRefreshable(
        makeReceipt({
          filecoinStatus: 'pending',
          pieceCids: [],
          filecoinInfo: {
            pieceCid: 'bafk-piece-in-info',
            aggregates: [],
            deals: [],
          },
        }),
      ),
    ).toBe(true);
  });

  it('returns false when delegation mode is mock', () => {
    expect(
      isArchiveReceiptRefreshable(
        makeReceipt({
          delegation: {
            issuer: 'trusted-node-demo',
            mode: 'mock',
            allowsFilecoinInfo: true,
          },
        }),
      ),
    ).toBe(false);
  });

  it('returns false when filecoinStatus is sealed', () => {
    expect(isArchiveReceiptRefreshable(makeReceipt({ filecoinStatus: 'sealed' }))).toBe(false);
  });

  it('returns false when no pieceCid is available anywhere', () => {
    expect(
      isArchiveReceiptRefreshable(
        makeReceipt({
          pieceCids: [],
          filecoinInfo: undefined,
        }),
      ),
    ).toBe(false);
  });

  it('returns false when delegation is undefined', () => {
    expect(
      isArchiveReceiptRefreshable(
        makeReceipt({
          delegation: undefined,
        }),
      ),
    ).toBe(false);
  });
});

/* ================================================================ */
/*  deriveArchiveReceiptFilecoinStatus                               */
/* ================================================================ */

describe('deriveArchiveReceiptFilecoinStatus', () => {
  it('returns sealed when deals are present', () => {
    expect(
      deriveArchiveReceiptFilecoinStatus({
        filecoinInfo: {
          pieceCid: 'bafk',
          aggregates: [{ aggregate: 'agg', inclusionProofAvailable: false }],
          deals: [{ aggregate: 'agg', provider: 'f01', dealId: '1' }],
        },
      }),
    ).toBe('sealed');
  });

  it('returns indexed when aggregates present but no deals', () => {
    expect(
      deriveArchiveReceiptFilecoinStatus({
        filecoinInfo: {
          pieceCid: 'bafk',
          aggregates: [{ aggregate: 'agg', inclusionProofAvailable: true }],
          deals: [],
        },
      }),
    ).toBe('indexed');
  });

  it('returns offered when pieceCids are present but no aggregates or deals', () => {
    expect(
      deriveArchiveReceiptFilecoinStatus({
        pieceCids: ['bafkpiece'],
        filecoinInfo: {
          pieceCid: 'bafk',
          aggregates: [],
          deals: [],
        },
      }),
    ).toBe('offered');
  });

  it('returns offered when filecoinInfo has pieceCid but pieceCids array is empty', () => {
    expect(
      deriveArchiveReceiptFilecoinStatus({
        pieceCids: [],
        filecoinInfo: {
          pieceCid: 'bafk',
          aggregates: [],
          deals: [],
        },
      }),
    ).toBe('offered');
  });

  it('returns currentStatus when no info suggests a higher state', () => {
    expect(
      deriveArchiveReceiptFilecoinStatus({
        currentStatus: 'offered',
      }),
    ).toBe('offered');
  });

  it('returns pending when no info and no currentStatus', () => {
    expect(deriveArchiveReceiptFilecoinStatus({})).toBe('pending');
  });

  it('returns sealed even when currentStatus is offered (deals take priority)', () => {
    expect(
      deriveArchiveReceiptFilecoinStatus({
        currentStatus: 'offered',
        filecoinInfo: {
          pieceCid: 'bafk',
          aggregates: [{ aggregate: 'agg', inclusionProofAvailable: false }],
          deals: [{ aggregate: 'agg', dealId: '5' }],
        },
      }),
    ).toBe('sealed');
  });

  it('returns offered when pieceCids exist but filecoinInfo is undefined', () => {
    expect(
      deriveArchiveReceiptFilecoinStatus({
        pieceCids: ['bafk-piece'],
      }),
    ).toBe('offered');
  });
});
