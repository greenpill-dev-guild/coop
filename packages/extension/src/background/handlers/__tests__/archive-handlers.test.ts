import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const configState = vi.hoisted(() => ({
  configuredArchiveMode: 'live' as 'live' | 'mock',
  configuredChain: 'sepolia',
  configuredFvmChain: 'filecoin-calibration',
  configuredFvmOperatorKey: undefined as `0x${string}` | undefined,
  configuredFvmRegistryAddress: undefined as `0x${string}` | undefined,
  configuredOnchainMode: 'mock' as 'live' | 'mock',
  configuredPimlicoApiKey: undefined as string | undefined,
}));

const mocks = vi.hoisted(() => ({
  createOwnerSafeExecutionContext: vi.fn(),
  createStorachaArchiveClient: vi.fn(),
  emitAgentObservationIfMissing: vi.fn(),
  getAnchorCapability: vi.fn(),
  getAuthSession: vi.fn(),
  getCoopBlob: vi.fn(),
  getCoops: vi.fn(),
  inspectFvmRegistryDeployment: vi.fn(),
  issueArchiveDelegation: vi.fn(),
  listArchiveRecoveryRecords: vi.fn(),
  logPrivilegedAction: vi.fn(),
  notifyExtensionEvent: vi.fn(),
  provisionStorachaSpace: vi.fn(),
  refreshBadge: vi.fn(),
  removeArchiveRecoveryRecord: vi.fn(),
  removeCoopArchiveSecrets: vi.fn(),
  requireAnchorModeForFeature: vi.fn(),
  requestArchiveOnChainSealWitness: vi.fn(),
  requestArchiveReceiptFilecoinInfo: vi.fn(),
  retrieveArchiveBundle: vi.fn(),
  resolveArchiveConfigForCoop: vi.fn(),
  resolveReceiverPairingMember: vi.fn(),
  saveState: vi.fn(),
  setArchiveRecoveryRecord: vi.fn(),
  setCoopArchiveSecrets: vi.fn(),
  setRuntimeHealth: vi.fn(),
  uploadArchiveBundleToStoracha: vi.fn(),
}));

const fvmSignerMocks = vi.hoisted(() => ({
  createLocalFvmSignerMaterial: vi.fn(),
  getLocalFvmSigner: vi.fn(),
  getLocalFvmSignerBinding: vi.fn(),
  saveLocalFvmSigner: vi.fn(),
}));

const viemMocks = vi.hoisted(() => ({
  createWalletClient: vi.fn(),
  http: vi.fn(() => 'transport'),
  privateKeyToAccount: vi.fn((privateKey: `0x${string}`) => ({
    address: privateKey,
    type: 'local',
  })),
}));

vi.mock('../../context', () => ({
  get configuredArchiveMode() {
    return configState.configuredArchiveMode;
  },
  get configuredChain() {
    return configState.configuredChain;
  },
  get configuredFvmChain() {
    return configState.configuredFvmChain;
  },
  get configuredFvmOperatorKey() {
    return configState.configuredFvmOperatorKey;
  },
  get configuredFvmRegistryAddress() {
    return configState.configuredFvmRegistryAddress;
  },
  get configuredOnchainMode() {
    return configState.configuredOnchainMode;
  },
  get configuredPimlicoApiKey() {
    return configState.configuredPimlicoApiKey;
  },
  db: {},
  getCoops: mocks.getCoops,
  notifyExtensionEvent: mocks.notifyExtensionEvent,
  resolveArchiveConfigForCoop: mocks.resolveArchiveConfigForCoop,
  saveState: mocks.saveState,
  setRuntimeHealth: mocks.setRuntimeHealth,
}));

vi.mock('../../dashboard', () => ({
  refreshBadge: mocks.refreshBadge,
}));

vi.mock('../../operator', () => ({
  logPrivilegedAction: mocks.logPrivilegedAction,
}));

vi.mock('../../../runtime/operator', () => ({
  describeArchiveLiveFailure: (error: unknown) =>
    error instanceof Error ? error.message : 'Archive upload failed.',
  requireAnchorModeForFeature: mocks.requireAnchorModeForFeature,
}));

vi.mock('../../../runtime/receiver', () => ({
  resolveReceiverPairingMember: mocks.resolveReceiverPairingMember,
}));

vi.mock('../agent', () => ({
  emitAgentObservationIfMissing: mocks.emitAgentObservationIfMissing,
}));

vi.mock('../session', () => ({
  createOwnerSafeExecutionContext: mocks.createOwnerSafeExecutionContext,
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createWalletClient: viemMocks.createWalletClient,
    http: viemMocks.http,
  };
});

vi.mock('viem/accounts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem/accounts')>();
  return {
    ...actual,
    privateKeyToAccount: viemMocks.privateKeyToAccount,
  };
});

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createStorachaArchiveClient: mocks.createStorachaArchiveClient,
    createLocalFvmSignerMaterial: fvmSignerMocks.createLocalFvmSignerMaterial,
    getAnchorCapability: mocks.getAnchorCapability,
    getAuthSession: mocks.getAuthSession,
    getCoopBlob: mocks.getCoopBlob,
    inspectFvmRegistryDeployment: mocks.inspectFvmRegistryDeployment,
    getLocalFvmSigner: fvmSignerMocks.getLocalFvmSigner,
    getLocalFvmSignerBinding: fvmSignerMocks.getLocalFvmSignerBinding,
    issueArchiveDelegation: mocks.issueArchiveDelegation,
    listArchiveRecoveryRecords: mocks.listArchiveRecoveryRecords,
    provisionStorachaSpace: mocks.provisionStorachaSpace,
    removeArchiveRecoveryRecord: mocks.removeArchiveRecoveryRecord,
    removeCoopArchiveSecrets: mocks.removeCoopArchiveSecrets,
    requestArchiveOnChainSealWitness: mocks.requestArchiveOnChainSealWitness,
    requestArchiveReceiptFilecoinInfo: mocks.requestArchiveReceiptFilecoinInfo,
    retrieveArchiveBundle: mocks.retrieveArchiveBundle,
    saveLocalFvmSigner: fvmSignerMocks.saveLocalFvmSigner,
    setArchiveRecoveryRecord: mocks.setArchiveRecoveryRecord,
    setCoopArchiveSecrets: mocks.setCoopArchiveSecrets,
    uploadArchiveBundleToStoracha: mocks.uploadArchiveBundleToStoracha,
  };
});

const {
  createArchiveBundle,
  createArchiveReceiptFromUpload,
  createCoop,
  createMockArchiveReceipt,
} = await import('@coop/shared');
const {
  handleArchiveArtifact,
  handleArchiveSnapshot,
  handleExportArtifact,
  handleExportReceipt,
  handleExportSnapshot,
  handleAnchorArchiveCid,
  handleFvmRegistration,
  handleProvisionArchiveSpace,
  handleRefreshArchiveStatus,
  handleRemoveCoopArchiveConfig,
  handleRetrieveArchiveBundle,
  handleSetCoopArchiveConfig,
} = await import('../archive');

function buildSetupInsights() {
  return {
    summary: 'Archive handler test insights.',
    crossCuttingPainPoints: ['Archive uploads can miss attachment bytes'],
    crossCuttingOpportunities: ['Keep attachment archival explicit and tested'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Artifacts include binary evidence.',
        painPoints: 'Archive uploads can lose attachment bytes.',
        improvements: 'Upload missing blobs before sealing receipts.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Artifacts carry media context.',
        painPoints: 'Attachment retrieval breaks without archive CIDs.',
        improvements: 'Persist attachment archive CIDs after upload.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Receipts are stored locally.',
        painPoints: 'Blob failures are hard to trace.',
        improvements: 'Fail loudly when required blob data is missing.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Research can include files.',
        painPoints: 'Files are omitted from archive payloads.',
        improvements: 'Bundle attachment bytes deliberately.',
      },
    ],
  } as const;
}

function buildCoopWithAttachment() {
  const created = createCoop({
    coopName: 'Archive Handler Coop',
    purpose: 'Exercise archive handler attachment uploads.',
    creatorDisplayName: 'Ari',
    captureMode: 'manual',
    seedContribution: 'I bring attachment-heavy archive coverage.',
    setupInsights: buildSetupInsights(),
  });
  const artifact = created.state.artifacts[0];
  if (!artifact) {
    throw new Error('Expected an initial artifact.');
  }

  return {
    coop: {
      ...created.state,
      artifacts: created.state.artifacts.map((candidate) =>
        candidate.id === artifact.id
          ? {
              ...candidate,
              attachments: [
                {
                  blobId: 'blob-1',
                  mimeType: 'image/png',
                  byteSize: 3,
                  kind: 'image' as const,
                },
              ],
            }
          : candidate,
      ),
    },
    artifactId: artifact.id,
  };
}

function buildLiveArchiveReceipt(
  coop: ReturnType<typeof buildCoopWithAttachment>['coop'],
  artifactId: string,
) {
  return createArchiveReceiptFromUpload({
    bundle: createArchiveBundle({
      scope: 'artifact',
      state: coop,
      artifactIds: [artifactId],
    }),
    delegationIssuer: 'did:key:issuer',
    delegationMode: 'live',
    allowsFilecoinInfo: true,
    rootCid: 'bafyroot123',
    shardCids: ['bafyshard1'],
    pieceCids: ['bafkpiece1'],
    gatewayUrl: 'https://storacha.link/ipfs/bafyroot123',
    artifactIds: [artifactId],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  configState.configuredArchiveMode = 'live';
  configState.configuredChain = 'sepolia';
  configState.configuredFvmChain = 'filecoin-calibration';
  configState.configuredFvmOperatorKey = undefined;
  configState.configuredFvmRegistryAddress = undefined;
  configState.configuredOnchainMode = 'mock';
  configState.configuredPimlicoApiKey = undefined;

  mocks.createStorachaArchiveClient.mockResolvedValue({
    did: () => 'did:key:audience',
  });
  mocks.getAnchorCapability.mockResolvedValue(null);
  mocks.issueArchiveDelegation.mockResolvedValue({
    spaceDid: 'did:key:space',
    delegationIssuer: 'did:key:issuer',
    gatewayBaseUrl: 'https://storacha.link',
    spaceDelegation: 'space-proof',
    proofs: [],
    allowsFilecoinInfo: false,
  });
  mocks.resolveArchiveConfigForCoop.mockResolvedValue({
    spaceDid: 'did:key:space',
    delegationIssuer: 'did:key:issuer',
    gatewayBaseUrl: 'https://storacha.link',
    spaceDelegation: 'space-proof',
    proofs: [],
    allowsFilecoinInfo: false,
    expirationSeconds: 600,
  });
  mocks.requestArchiveOnChainSealWitness.mockResolvedValue({
    proof: '{"type":"coop-filecoin-onchain-seal-witness"}',
    proofCid: 'bafysealwitness',
  });
  mocks.provisionStorachaSpace.mockResolvedValue({
    secrets: {
      spaceDelegation: 'space-proof',
      proofs: ['proof-1'],
    },
    publicConfig: {
      spaceDid: 'did:key:space',
      delegationIssuer: 'did:key:issuer',
      gatewayBaseUrl: 'https://storacha.link',
      proofs: ['proof-1'],
      allowsFilecoinInfo: false,
      expirationSeconds: 600,
    },
  });
  mocks.requestArchiveReceiptFilecoinInfo.mockResolvedValue({
    pieceCid: 'bafkpiece',
    aggregates: [{ aggregate: 'bafyaggregate' }],
    deals: [
      {
        aggregate: 'bafyaggregate',
        provider: 'f01234',
        dealId: '44',
      },
    ],
    lastUpdatedAt: '2026-03-27T10:00:00.000Z',
  });
  mocks.resolveReceiverPairingMember.mockImplementation((coop: { members: unknown[] }) => {
    return coop.members[0];
  });
  mocks.inspectFvmRegistryDeployment.mockResolvedValue({
    ok: true,
    registryAddress: '0x7777777777777777777777777777777777777777',
    archiveCount: 0n,
    detail:
      'Filecoin Calibration registry 0x7777777777777777777777777777777777777777 is deployed and readable.',
  });
  mocks.listArchiveRecoveryRecords.mockResolvedValue([]);
  mocks.requireAnchorModeForFeature.mockImplementation(() => undefined);
  mocks.removeArchiveRecoveryRecord.mockResolvedValue(undefined);
  mocks.removeCoopArchiveSecrets.mockResolvedValue(undefined);
  mocks.retrieveArchiveBundle.mockResolvedValue({
    rootCid: 'bafyroot',
    bytes: new Uint8Array([1, 2, 3]),
  });
  mocks.saveState.mockResolvedValue(undefined);
  mocks.setArchiveRecoveryRecord.mockResolvedValue(undefined);
  mocks.setCoopArchiveSecrets.mockResolvedValue(undefined);
  fvmSignerMocks.createLocalFvmSignerMaterial.mockReturnValue({
    id: 'fvm-signer:filecoin-calibration:passkey-1',
    chainKey: 'filecoin-calibration',
    accountAddress: '0x9999999999999999999999999999999999999999',
    passkeyCredentialId: 'passkey-1',
    privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    createdAt: '2026-03-31T10:00:00.000Z',
    lastUsedAt: '2026-03-31T10:00:00.000Z',
  });
  fvmSignerMocks.getLocalFvmSigner.mockResolvedValue(null);
  fvmSignerMocks.getLocalFvmSignerBinding.mockResolvedValue(null);
  fvmSignerMocks.saveLocalFvmSigner.mockResolvedValue(undefined);
  mocks.createOwnerSafeExecutionContext.mockResolvedValue({
    smartClient: {
      sendTransaction: vi.fn(async () => '0xanchorhash'),
    },
    publicClient: {
      waitForTransactionReceipt: vi.fn(async () => ({ transactionHash: '0xanchorhash' })),
    },
  });
  mocks.uploadArchiveBundleToStoracha.mockResolvedValue({
    audienceDid: 'did:key:audience',
    rootCid: 'bafyroot',
    shardCids: ['bafyshard'],
    pieceCids: ['bafkpiece'],
    gatewayUrl: 'https://storacha.link/ipfs/bafyroot',
    blobCids: {
      'blob-1': 'bafyblob',
    },
  });
  viemMocks.createWalletClient.mockReturnValue({
    sendTransaction: vi.fn(async () => '0xfvmhash'),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('archive handlers', () => {
  it('reconciles a pending archive recovery before starting a duplicate artifact upload', async () => {
    const { coop, artifactId } = buildCoopWithAttachment();
    const bundle = createArchiveBundle({
      scope: 'artifact',
      state: coop,
      artifactIds: [artifactId],
    });
    const recoveredReceipt = createMockArchiveReceipt({
      bundle,
      delegationIssuer: 'did:key:issuer',
      artifactIds: [artifactId],
    });

    mocks.getCoops.mockResolvedValue([coop]);
    mocks.listArchiveRecoveryRecords.mockResolvedValue([
      {
        id: 'archive-recovery-1',
        coopId: coop.profile.id,
        createdAt: '2026-03-27T00:00:00.000Z',
        receipt: recoveredReceipt,
        artifactIds: [artifactId],
        blobUploads: {
          'blob-1': {
            archiveCid: 'bafyblob-recovered',
          },
        },
      },
    ]);

    const result = await handleArchiveArtifact({
      type: 'archive-artifact',
      payload: {
        coopId: coop.profile.id,
        artifactId,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(recoveredReceipt);
    expect(mocks.saveState).toHaveBeenCalledTimes(1);
    expect(mocks.removeArchiveRecoveryRecord).toHaveBeenCalledWith({}, 'archive-recovery-1');
    expect(mocks.uploadArchiveBundleToStoracha).not.toHaveBeenCalled();
  });

  it('uploads required attachment blobs and stores returned archive CIDs on the artifact', async () => {
    const { coop, artifactId } = buildCoopWithAttachment();
    mocks.getCoops.mockResolvedValue([coop]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
    });
    mocks.getCoopBlob.mockResolvedValue({
      record: {
        blobId: 'blob-1',
      },
      bytes: new Uint8Array([1, 2, 3]),
    });

    const result = await handleArchiveArtifact({
      type: 'archive-artifact',
      payload: {
        coopId: coop.profile.id,
        artifactId,
      },
    });

    expect(result.ok).toBe(true);
    expect(mocks.uploadArchiveBundleToStoracha).toHaveBeenCalledTimes(1);

    const uploadInput = mocks.uploadArchiveBundleToStoracha.mock.calls[0]?.[0] as {
      blobBytes?: Map<string, Uint8Array>;
    };
    expect(Array.from(uploadInput.blobBytes?.keys() ?? [])).toEqual(['blob-1']);
    expect(Array.from(uploadInput.blobBytes?.get('blob-1') ?? [])).toEqual([1, 2, 3]);

    const savedState = mocks.saveState.mock.calls[0]?.[0] as typeof coop | undefined;
    const savedArtifact = savedState?.artifacts.find((artifact) => artifact.id === artifactId);
    expect(savedArtifact?.archiveStatus).toBe('archived');
    expect(savedArtifact?.attachments[0]?.archiveCid).toBe('bafyblob');
    expect(savedState?.archiveReceipts).toHaveLength(1);
  });

  it('keeps a recovery record when remote upload succeeds but local receipt persistence fails', async () => {
    const { coop, artifactId } = buildCoopWithAttachment();
    mocks.getCoops.mockResolvedValue([coop]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
    });
    mocks.getCoopBlob.mockResolvedValue({
      record: {
        blobId: 'blob-1',
      },
      bytes: new Uint8Array([1, 2, 3]),
    });
    mocks.saveState.mockRejectedValueOnce(new Error('Dexie write failed'));

    const result = await handleArchiveArtifact({
      type: 'archive-artifact',
      payload: {
        coopId: coop.profile.id,
        artifactId,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Archive upload completed remotely');
    expect(mocks.uploadArchiveBundleToStoracha).toHaveBeenCalledTimes(1);
    expect(mocks.setArchiveRecoveryRecord).toHaveBeenCalledTimes(1);
    expect(mocks.removeArchiveRecoveryRecord).not.toHaveBeenCalled();
    expect(mocks.notifyExtensionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: 'archive-artifact',
        state: 'recovery-pending',
      }),
    );
  });

  it('attaches independent on-chain seal witnesses during live archive follow-up refresh', async () => {
    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = {
      ...createArchiveReceiptFromUpload({
        bundle: createArchiveBundle({
          scope: 'artifact',
          state: coop,
          artifactIds: [artifactId],
        }),
        delegationIssuer: 'did:key:issuer',
        delegationMode: 'live',
        allowsFilecoinInfo: true,
        rootCid: 'bafyroot',
        shardCids: ['bafyshard'],
        pieceCids: ['bafkpiece'],
        gatewayUrl: 'https://storacha.link/ipfs/bafyroot',
        artifactIds: [artifactId],
      }),
      filecoinStatus: 'sealed' as const,
      filecoinInfo: {
        pieceCid: 'bafkpiece',
        aggregates: [{ aggregate: 'bafyaggregate', inclusionProofAvailable: false }],
        deals: [
          {
            aggregate: 'bafyaggregate',
            provider: 'f01234',
            dealId: '44',
          },
        ],
        lastUpdatedAt: '2026-03-27T09:00:00.000Z',
      },
    };
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        archiveReceipts: [receipt],
      },
    ]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
    });
    mocks.resolveArchiveConfigForCoop.mockResolvedValue({
      spaceDid: 'did:key:space',
      delegationIssuer: 'did:key:issuer',
      gatewayBaseUrl: 'https://storacha.link',
      spaceDelegation: 'space-proof',
      proofs: [],
      allowsFilecoinInfo: true,
      expirationSeconds: 600,
      filecoinWitnessRpcUrl: 'https://lotus.example/rpc/v1',
      filecoinWitnessRpcToken: 'token-1',
    });

    const result = await handleRefreshArchiveStatus({
      type: 'refresh-archive-status',
      payload: {
        coopId: coop.profile.id,
        receiptId: receipt.id,
      },
    });

    expect(result.ok).toBe(true);
    expect(mocks.requestArchiveReceiptFilecoinInfo).toHaveBeenCalledTimes(1);
    expect(mocks.requestArchiveOnChainSealWitness).toHaveBeenCalledWith({
      pieceCid: 'bafkpiece',
      dealId: '44',
      provider: 'f01234',
      rpcUrl: 'https://lotus.example/rpc/v1',
      rpcToken: 'token-1',
    });

    const savedState = mocks.saveState.mock.calls[0]?.[0] as
      | {
          archiveReceipts: Array<{
            filecoinInfo?: { deals: Array<{ onChainSealWitnessCid?: string }> };
          }>;
        }
      | undefined;
    expect(savedState?.archiveReceipts[0]?.filecoinInfo?.deals[0]?.onChainSealWitnessCid).toBe(
      'bafysealwitness',
    );
  });

  it('fails before upload when an attachment blob is missing locally and has no archive CID', async () => {
    const { coop, artifactId } = buildCoopWithAttachment();
    mocks.getCoops.mockResolvedValue([coop]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
    });
    mocks.getCoopBlob.mockResolvedValue(null);

    const result = await handleArchiveArtifact({
      type: 'archive-artifact',
      payload: {
        coopId: coop.profile.id,
        artifactId,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Archive is missing local blob data');
    expect(mocks.uploadArchiveBundleToStoracha).not.toHaveBeenCalled();
    expect(mocks.saveState).not.toHaveBeenCalled();
  });

  it('reconciles a pending snapshot recovery before starting a duplicate snapshot upload', async () => {
    const { coop } = buildCoopWithAttachment();
    const bundle = createArchiveBundle({
      scope: 'snapshot',
      state: coop,
    });
    const recoveredReceipt = createMockArchiveReceipt({
      bundle,
      delegationIssuer: 'did:key:issuer',
    });

    mocks.getCoops.mockResolvedValue([coop]);
    mocks.listArchiveRecoveryRecords.mockResolvedValue([
      {
        id: 'archive-recovery-snapshot',
        coopId: coop.profile.id,
        createdAt: '2026-03-27T00:00:00.000Z',
        receipt: recoveredReceipt,
        artifactIds: [],
        blobUploads: {},
      },
    ]);

    const result = await handleArchiveSnapshot({
      type: 'archive-snapshot',
      payload: {
        coopId: coop.profile.id,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(recoveredReceipt);
    expect(mocks.uploadArchiveBundleToStoracha).not.toHaveBeenCalled();
    expect(mocks.notifyExtensionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: 'archive-snapshot',
        title: 'Snapshot archive recovered',
      }),
    );
  });

  it('exports coop snapshots in JSON and text formats', async () => {
    const { coop } = buildCoopWithAttachment();
    mocks.getCoops.mockResolvedValue([coop]);

    const jsonResult = await handleExportSnapshot({
      type: 'export-snapshot',
      payload: {
        coopId: coop.profile.id,
        format: 'json',
      },
    });
    const textResult = await handleExportSnapshot({
      type: 'export-snapshot',
      payload: {
        coopId: coop.profile.id,
        format: 'text',
      },
    });

    expect(jsonResult.ok).toBe(true);
    expect(JSON.parse(jsonResult.data as string)).toMatchObject({
      type: 'coop-snapshot',
      snapshot: {
        profile: { id: coop.profile.id, name: coop.profile.name },
      },
    });
    expect(textResult.ok).toBe(true);
    expect(textResult.data).toContain(coop.profile.name);
  });

  it('exports individual artifacts and rejects unknown artifacts', async () => {
    const { coop, artifactId } = buildCoopWithAttachment();
    const artifact = coop.artifacts.find((candidate) => candidate.id === artifactId);
    if (!artifact) {
      throw new Error('expected artifact');
    }
    mocks.getCoops.mockResolvedValue([coop]);

    const result = await handleExportArtifact({
      type: 'export-artifact',
      payload: {
        coopId: coop.profile.id,
        artifactId,
        format: 'text',
      },
    });
    const missing = await handleExportArtifact({
      type: 'export-artifact',
      payload: {
        coopId: coop.profile.id,
        artifactId: 'missing-artifact',
        format: 'json',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toContain(artifact.title);
    expect(missing).toMatchObject({
      ok: false,
      error: 'Artifact not found.',
    });
  });

  it('exports archive receipts and rejects unknown receipt ids', async () => {
    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = createMockArchiveReceipt({
      bundle: createArchiveBundle({
        scope: 'artifact',
        state: coop,
        artifactIds: [artifactId],
      }),
      delegationIssuer: 'did:key:issuer',
      artifactIds: [artifactId],
    });
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        archiveReceipts: [receipt],
      },
    ]);

    const result = await handleExportReceipt({
      type: 'export-receipt',
      payload: {
        coopId: coop.profile.id,
        receiptId: receipt.id,
        format: 'json',
      },
    });
    const missing = await handleExportReceipt({
      type: 'export-receipt',
      payload: {
        coopId: coop.profile.id,
        receiptId: 'missing-receipt',
        format: 'text',
      },
    });

    expect(result.ok).toBe(true);
    expect(JSON.parse(result.data as string)).toMatchObject({
      type: 'archive-receipt',
      receipt: {
        id: receipt.id,
        scope: receipt.scope,
      },
    });
    expect(missing).toMatchObject({
      ok: false,
      error: 'Archive receipt not found.',
    });
  });

  it('retrieves an archived bundle when the receipt exists for the coop', async () => {
    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = createMockArchiveReceipt({
      bundle: createArchiveBundle({
        scope: 'artifact',
        state: coop,
        artifactIds: [artifactId],
      }),
      delegationIssuer: 'did:key:issuer',
      artifactIds: [artifactId],
    });
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        archiveReceipts: [receipt],
      },
    ]);

    const result = await handleRetrieveArchiveBundle({
      type: 'retrieve-archive-bundle',
      payload: {
        coopId: coop.profile.id,
        receiptId: receipt.id,
      },
    });

    expect(result).toEqual({
      ok: true,
      data: {
        rootCid: 'bafyroot',
        bytes: new Uint8Array([1, 2, 3]),
      },
    });
    expect(mocks.retrieveArchiveBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: receipt.id,
      }),
      expect.objectContaining({
        spaceDid: 'did:key:space',
      }),
    );
  });

  it('provisions archive space and persists synced config plus local secrets', async () => {
    const { coop } = buildCoopWithAttachment();
    mocks.getCoops.mockResolvedValue([coop]);

    const result = await handleProvisionArchiveSpace({
      coopId: coop.profile.id,
      email: 'archive@coop.test',
      coopName: coop.profile.name,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        spaceDid: 'did:key:space',
      },
    });
    expect(mocks.setCoopArchiveSecrets).toHaveBeenCalledWith(
      expect.anything(),
      coop.profile.id,
      expect.objectContaining({
        coopId: coop.profile.id,
      }),
    );
    expect(mocks.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        archiveConfig: expect.objectContaining({
          spaceDid: 'did:key:space',
        }),
      }),
    );
  });

  it('sets and removes a coop archive config without touching unrelated state', async () => {
    const { coop } = buildCoopWithAttachment();
    mocks.getCoops.mockResolvedValue([coop]);

    const setResult = await handleSetCoopArchiveConfig({
      coopId: coop.profile.id,
      publicConfig: {
        spaceDid: 'did:key:space-2',
        delegationIssuer: 'did:key:issuer-2',
        gatewayBaseUrl: 'https://storacha.example',
        proofs: [],
        allowsFilecoinInfo: true,
        expirationSeconds: 1200,
      },
      secrets: {
        spaceDelegation: 'space-proof-2',
      },
    });
    const removeResult = await handleRemoveCoopArchiveConfig({
      coopId: coop.profile.id,
    });

    expect(setResult).toEqual({ ok: true });
    expect(removeResult).toEqual({ ok: true });
    expect(mocks.setCoopArchiveSecrets).toHaveBeenCalledWith(
      expect.anything(),
      coop.profile.id,
      expect.objectContaining({
        coopId: coop.profile.id,
        proofs: [],
      }),
    );
    expect(mocks.removeCoopArchiveSecrets).toHaveBeenCalledWith(expect.anything(), coop.profile.id);
  });

  it('skips CID anchoring entirely while on-chain mode stays in mock', async () => {
    const result = await handleAnchorArchiveCid({
      coopId: 'coop-1',
      receiptId: 'receipt-1',
    });

    expect(result).toEqual({
      ok: true,
      data: { status: 'skipped' },
    });
  });

  it('anchors a live archive CID through the coop Safe and emits follow-up feedback', async () => {
    configState.configuredOnchainMode = 'live';
    configState.configuredPimlicoApiKey = 'pimlico-key';

    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = createMockArchiveReceipt({
      bundle: createArchiveBundle({
        scope: 'artifact',
        state: coop,
        artifactIds: [artifactId],
      }),
      delegationIssuer: 'did:key:issuer',
      artifactIds: [artifactId],
    });
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        agentIdentity: {
          agentId: 'erc8004-agent',
        },
        archiveReceipts: [receipt],
      },
    ]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
    });

    const result = await handleAnchorArchiveCid({
      coopId: coop.profile.id,
      receiptId: receipt.id,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        txHash: '0xanchorhash',
        status: 'anchored',
      },
    });
    expect(mocks.createOwnerSafeExecutionContext).toHaveBeenCalledWith({
      authSession: {
        primaryAddress: coop.members[0]?.address,
      },
      onchainState: coop.onchainState,
    });
    expect(mocks.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        archiveReceipts: [
          expect.objectContaining({
            id: receipt.id,
            anchorTxHash: '0xanchorhash',
            anchorChainKey: 'sepolia',
            anchorStatus: 'anchored',
          }),
        ],
      }),
    );
    expect(mocks.notifyExtensionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: 'archive-anchor',
        state: '0xanchorhash',
      }),
    );
    expect(mocks.emitAgentObservationIfMissing).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'erc8004-feedback-due',
        payload: expect.objectContaining({
          rootCid: receipt.rootCid,
          txHash: '0xanchorhash',
          targetAgentId: 'erc8004-agent',
        }),
      }),
    );
  });

  it('returns a typed failure when live archive anchoring through the Safe fails', async () => {
    configState.configuredOnchainMode = 'live';
    configState.configuredPimlicoApiKey = 'pimlico-key';

    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = createMockArchiveReceipt({
      bundle: createArchiveBundle({
        scope: 'artifact',
        state: coop,
        artifactIds: [artifactId],
      }),
      delegationIssuer: 'did:key:issuer',
      artifactIds: [artifactId],
    });
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        archiveReceipts: [receipt],
      },
    ]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
    });
    mocks.createOwnerSafeExecutionContext.mockResolvedValueOnce({
      smartClient: {
        sendTransaction: vi.fn(async () => {
          throw new Error('Anchor transaction failed.');
        }),
      },
      publicClient: {
        waitForTransactionReceipt: vi.fn(),
      },
    });

    const result = await handleAnchorArchiveCid({
      coopId: coop.profile.id,
      receiptId: receipt.id,
    });

    expect(result).toEqual({
      ok: false,
      error: 'Anchor transaction failed.',
    });
    expect(mocks.notifyExtensionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: 'archive-anchor',
        state: 'failed',
        message: 'Anchor transaction failed.',
      }),
    );
    expect(mocks.logPrivilegedAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'archive-anchor',
        status: 'failed',
        detail: 'Anchor transaction failed.',
      }),
    );
  });

  it('blocks Filecoin registration for mock archive receipts', async () => {
    configState.configuredFvmRegistryAddress = '0x7777777777777777777777777777777777777777';

    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = createMockArchiveReceipt({
      bundle: createArchiveBundle({
        scope: 'artifact',
        state: coop,
        artifactIds: [artifactId],
      }),
      delegationIssuer: 'did:key:issuer',
      artifactIds: [artifactId],
    });
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        archiveReceipts: [receipt],
      },
    ]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
      passkey: { id: 'passkey-1' },
    });

    const result = await handleFvmRegistration({
      coopId: coop.profile.id,
      receiptId: receipt.id,
    });

    expect(result).toEqual({
      ok: false,
      error:
        'Only live archive receipts can be registered on Filecoin. Re-run the archive step with live archiving enabled first.',
    });
    expect(mocks.saveState).not.toHaveBeenCalled();
    expect(viemMocks.createWalletClient).not.toHaveBeenCalled();
  });

  it('requires a stored passkey session before registering on Filecoin', async () => {
    configState.configuredFvmRegistryAddress = '0x7777777777777777777777777777777777777777';

    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = buildLiveArchiveReceipt(coop, artifactId);
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        archiveReceipts: [receipt],
      },
    ]);
    mocks.getAuthSession.mockResolvedValue(null);

    const result = await handleFvmRegistration({
      coopId: coop.profile.id,
      receiptId: receipt.id,
    });

    expect(result).toEqual({
      ok: false,
      error:
        'A stored passkey session is required before a member can register proofs on Filecoin.',
    });
    expect(mocks.saveState).not.toHaveBeenCalled();
    expect(viemMocks.createWalletClient).not.toHaveBeenCalled();
  });

  it('fails clearly when the configured registry deployment has no readable contract code', async () => {
    configState.configuredFvmRegistryAddress = '0x7777777777777777777777777777777777777777';
    mocks.inspectFvmRegistryDeployment.mockResolvedValueOnce({
      ok: false,
      registryAddress: '0x7777777777777777777777777777777777777777',
      detail:
        'No contract code was found at 0x7777777777777777777777777777777777777777 on Filecoin Calibration.',
    });

    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = buildLiveArchiveReceipt(coop, artifactId);
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        archiveReceipts: [receipt],
      },
    ]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
      passkey: { id: 'passkey-1' },
    });

    const result = await handleFvmRegistration({
      coopId: coop.profile.id,
      receiptId: receipt.id,
    });

    expect(result).toEqual({
      ok: false,
      error:
        'No contract code was found at 0x7777777777777777777777777777777777777777 on Filecoin Calibration.',
    });
    expect(viemMocks.createWalletClient).not.toHaveBeenCalled();
    expect(mocks.saveState).not.toHaveBeenCalled();
  });

  it('falls back to the canonical registry deployment when no env override is configured', async () => {
    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = buildLiveArchiveReceipt(coop, artifactId);
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        archiveReceipts: [receipt],
      },
    ]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
      passkey: { id: 'passkey-1' },
    });

    const result = await handleFvmRegistration({
      coopId: coop.profile.id,
      receiptId: receipt.id,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        txHash: '0xfvmhash',
        status: 'registered',
      },
    });
    expect(mocks.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        archiveReceipts: [
          expect.objectContaining({
            id: receipt.id,
            fvmRegistryTxHash: '0xfvmhash',
            fvmChainKey: 'filecoin-calibration',
          }),
        ],
      }),
    );
    expect(viemMocks.createWalletClient).toHaveBeenCalledTimes(1);
  });

  it('registers an archive receipt on the live Filecoin registry and stores the tx hash', async () => {
    configState.configuredFvmRegistryAddress = '0x7777777777777777777777777777777777777777';

    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = buildLiveArchiveReceipt(coop, artifactId);
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        archiveReceipts: [receipt],
      },
    ]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
      passkey: { id: 'passkey-1' },
    });

    const result = await handleFvmRegistration({
      coopId: coop.profile.id,
      receiptId: receipt.id,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        txHash: '0xfvmhash',
        status: 'registered',
      },
    });
    expect(fvmSignerMocks.getLocalFvmSigner).toHaveBeenCalledWith(
      {},
      'filecoin-calibration',
      'passkey-1',
    );
    expect(fvmSignerMocks.createLocalFvmSignerMaterial).toHaveBeenCalledWith({
      chainKey: 'filecoin-calibration',
      passkeyCredentialId: 'passkey-1',
    });
    expect(fvmSignerMocks.saveLocalFvmSigner).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: 'fvm-signer:filecoin-calibration:passkey-1',
      }),
    );
    expect(viemMocks.privateKeyToAccount).toHaveBeenCalledWith(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(viemMocks.createWalletClient).toHaveBeenCalledTimes(1);
    expect(mocks.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        archiveReceipts: [
          expect.objectContaining({
            id: receipt.id,
            fvmRegistryTxHash: '0xfvmhash',
            fvmChainKey: 'filecoin-calibration',
          }),
        ],
      }),
    );
    expect(mocks.notifyExtensionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: 'fvm-register-archive',
        state: '0xfvmhash',
      }),
    );
  });

  it('returns a funding hint when the member-local Filecoin signer has no FIL', async () => {
    configState.configuredFvmRegistryAddress = '0x7777777777777777777777777777777777777777';

    const { coop, artifactId } = buildCoopWithAttachment();
    const receipt = buildLiveArchiveReceipt(coop, artifactId);
    mocks.getCoops.mockResolvedValue([
      {
        ...coop,
        archiveReceipts: [receipt],
      },
    ]);
    mocks.getAuthSession.mockResolvedValue({
      primaryAddress: coop.members[0]?.address,
      passkey: { id: 'passkey-1' },
    });
    viemMocks.createWalletClient.mockReturnValueOnce({
      sendTransaction: vi.fn(async () => {
        throw new Error('insufficient funds for gas * price + value');
      }),
    });

    const result = await handleFvmRegistration({
      coopId: coop.profile.id,
      receiptId: receipt.id,
    });

    expect(result).toEqual({
      ok: false,
      error:
        'insufficient funds for gas * price + value Fund the member-local Filecoin signer 0x9999999999999999999999999999999999999999 on Filecoin Calibration and retry.',
    });
    expect(mocks.notifyExtensionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: 'fvm-register-archive',
        state: 'failed',
        message:
          'insufficient funds for gas * price + value Fund the member-local Filecoin signer 0x9999999999999999999999999999999999999999 on Filecoin Calibration and retry.',
      }),
    );
    expect(mocks.logPrivilegedAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'fvm-register-archive',
        status: 'failed',
        detail:
          'insufficient funds for gas * price + value Fund the member-local Filecoin signer 0x9999999999999999999999999999999999999999 on Filecoin Calibration and retry.',
      }),
    );
  });
});
