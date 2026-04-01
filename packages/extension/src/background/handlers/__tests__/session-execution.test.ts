import type { ActionBundle, CoopSharedState, SessionCapability } from '@coop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const contextState = vi.hoisted(() => ({
  configuredOnchainMode: 'live' as 'live' | 'mock',
  configuredPimlicoApiKey: 'pimlico-key' as string | undefined,
  configuredSessionMode: 'live' as 'live' | 'mock' | 'off',
  settingsGet: vi.fn(),
  setLocalSetting: vi.fn(async () => undefined),
}));

const sharedMocks = vi.hoisted(() => ({
  buildRemoveSessionExecution: vi.fn(() => ({
    execution: {
      to: '0x0000000000000000000000000000000000000001',
      data: '0xdeadbeef',
      value: 0n,
    },
  })),
  buildSmartSession: vi.fn(({ capability }: { capability: SessionCapability }) => ({
    permissionId: `permission-${capability.id}`,
    modules: {
      validator: { address: '0xvalidator' },
      fallback: { address: '0xfallback' },
    },
  })),
  checkSessionCapabilityEnabled: vi.fn(async () => true),
  createCoopPublicClient: vi.fn(),
  createCoopSmartAccountClient: vi.fn(),
  createSessionCapabilityLogEntry: vi.fn((input: Record<string, unknown>) => input),
  createSessionSignerMaterial: vi.fn(() => ({
    sessionAddress: '0x1111111111111111111111111111111111111111',
    validatorAddress: '0x2222222222222222222222222222222222222222',
    validatorInitData: '0x1234',
    privateKey: '0x3333333333333333333333333333333333333333333333333333333333333333',
  })),
  createSessionWrappingSecret: vi.fn(async () => 'wrap-secret'),
  decryptSessionPrivateKey: vi.fn(
    async () => '0x4444444444444444444444444444444444444444444444444444444444444444',
  ),
  encryptSessionPrivateKey: vi.fn(async () => ({
    cipherText: 'cipher',
  })),
  getAuthSession: vi.fn(),
  getEncryptedSessionMaterial: vi.fn(),
  getSessionCapability: vi.fn(),
  getSessionCapabilityUseStubSignature: vi.fn(
    ({ capability }: { capability: SessionCapability }) => `wrapped:${capability.id}:validator-stub`,
  ),
  incrementSessionCapabilityUsage: vi.fn((capability: SessionCapability) => ({
    ...capability,
    usedCount: ((capability as SessionCapability & { usedCount?: number }).usedCount ?? 0) + 1,
  })),
  listSessionCapabilities: vi.fn(),
  listSessionCapabilityLogEntries: vi.fn(),
  nowIso: vi.fn(() => '2026-03-29T00:00:00.000Z'),
  refreshSessionCapabilityStatus: vi.fn((capability: SessionCapability) => capability),
  restorePasskeyAccount: vi.fn((authSession: { primaryAddress: string }) => ({
    address: authSession.primaryAddress,
    type: 'passkey',
  })),
  revokeSessionCapability: vi.fn((capability: SessionCapability) => ({
    ...capability,
    status: 'revoked',
  })),
  rotateSessionCapability: vi.fn(
    (input: {
      capability: SessionCapability;
      sessionAddress: string;
      validatorAddress: string;
      validatorInitData: string;
    }) => ({
      ...input.capability,
      sessionAddress: input.sessionAddress,
      validatorAddress: input.validatorAddress,
      validatorInitData: input.validatorInitData,
      updatedAt: '2026-03-29T00:00:00.000Z',
    }),
  ),
  saveEncryptedSessionMaterial: vi.fn(async () => undefined),
  saveSessionCapability: vi.fn(async () => undefined),
  saveSessionCapabilityLogEntry: vi.fn(async () => undefined),
  sendSmartAccountTransactionWithCoopGasFallback: vi.fn(async () => ({
    txHash: '0xtxhash',
    userOperationHash: '0xuophash',
    receipt: {
      transactionHash: '0xreceipt',
    },
  })),
  signSessionCapabilityUserOperation: vi.fn(
    async ({
      capability,
    }: {
      capability: SessionCapability;
    }) => `wrapped:${capability.id}:validator-signature`,
  ),
  validateSessionCapabilityForBundle: vi.fn(),
  wrapUseSessionSignature: vi.fn(
    ({
      capability,
      validatorSignature,
    }: { capability: SessionCapability; validatorSignature: string }) =>
      `wrapped:${capability.id}:${validatorSignature}`,
  ),
}));

const permissionlessMocks = vi.hoisted(() => ({
  toSafeSmartAccount: vi.fn(),
}));

const rhinestoneMocks = vi.hoisted(() => ({
  checkModuleInstalled: vi.fn(),
  installModule: vi.fn(),
}));

const viemMocks = vi.hoisted(() => ({
  privateKeyToAccount: vi.fn((privateKey: string) => ({
    address: privateKey,
    type: 'local',
  })),
}));

const operatorMocks = vi.hoisted(() => ({
  getTrustedNodeContext: vi.fn(),
  logPrivilegedAction: vi.fn(),
  requireCreatorGrantManager: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    buildRemoveSessionExecution: sharedMocks.buildRemoveSessionExecution,
    buildSmartSession: sharedMocks.buildSmartSession,
    checkSessionCapabilityEnabled: sharedMocks.checkSessionCapabilityEnabled,
    createCoopPublicClient: sharedMocks.createCoopPublicClient,
    createCoopSmartAccountClient: sharedMocks.createCoopSmartAccountClient,
    createSessionCapabilityLogEntry: sharedMocks.createSessionCapabilityLogEntry,
    createSessionSignerMaterial: sharedMocks.createSessionSignerMaterial,
    createSessionWrappingSecret: sharedMocks.createSessionWrappingSecret,
    decryptSessionPrivateKey: sharedMocks.decryptSessionPrivateKey,
    encryptSessionPrivateKey: sharedMocks.encryptSessionPrivateKey,
    getAuthSession: sharedMocks.getAuthSession,
    getEncryptedSessionMaterial: sharedMocks.getEncryptedSessionMaterial,
    getSessionCapability: sharedMocks.getSessionCapability,
    getSessionCapabilityUseStubSignature: sharedMocks.getSessionCapabilityUseStubSignature,
    incrementSessionCapabilityUsage: sharedMocks.incrementSessionCapabilityUsage,
    listSessionCapabilities: sharedMocks.listSessionCapabilities,
    listSessionCapabilityLogEntries: sharedMocks.listSessionCapabilityLogEntries,
    nowIso: sharedMocks.nowIso,
    refreshSessionCapabilityStatus: sharedMocks.refreshSessionCapabilityStatus,
    restorePasskeyAccount: sharedMocks.restorePasskeyAccount,
    revokeSessionCapability: sharedMocks.revokeSessionCapability,
    rotateSessionCapability: sharedMocks.rotateSessionCapability,
    saveEncryptedSessionMaterial: sharedMocks.saveEncryptedSessionMaterial,
    saveSessionCapability: sharedMocks.saveSessionCapability,
    saveSessionCapabilityLogEntry: sharedMocks.saveSessionCapabilityLogEntry,
    sendSmartAccountTransactionWithCoopGasFallback:
      sharedMocks.sendSmartAccountTransactionWithCoopGasFallback,
    signSessionCapabilityUserOperation: sharedMocks.signSessionCapabilityUserOperation,
    validateSessionCapabilityForBundle: sharedMocks.validateSessionCapabilityForBundle,
    wrapUseSessionSignature: sharedMocks.wrapUseSessionSignature,
  };
});

vi.mock('../../context', () => ({
  get configuredOnchainMode() {
    return contextState.configuredOnchainMode;
  },
  get configuredPimlicoApiKey() {
    return contextState.configuredPimlicoApiKey;
  },
  get configuredSessionMode() {
    return contextState.configuredSessionMode;
  },
  db: {
    settings: {
      get: contextState.settingsGet,
    },
  },
  getLocalSetting: vi.fn(),
  setLocalSetting: contextState.setLocalSetting,
  stateKeys: {
    sessionWrappingSecret: 'sessionWrappingSecret',
  },
}));

vi.mock('../../dashboard', () => ({
  refreshBadge: vi.fn(),
}));

vi.mock('../../operator', () => ({
  getTrustedNodeContext: operatorMocks.getTrustedNodeContext,
  logPrivilegedAction: operatorMocks.logPrivilegedAction,
  requireCreatorGrantManager: operatorMocks.requireCreatorGrantManager,
}));

vi.mock('../../../runtime/permit-runtime', () => ({
  createRuntimePermitExecutor: vi.fn(() => ({
    localIdentityId: 'identity-1',
    label: 'Ava',
  })),
}));

vi.mock('@rhinestone/module-sdk/account', () => ({
  installModule: rhinestoneMocks.installModule,
  isModuleInstalled: rhinestoneMocks.checkModuleInstalled,
}));

vi.mock('permissionless/accounts', () => ({
  toSafeSmartAccount: permissionlessMocks.toSafeSmartAccount,
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: viemMocks.privateKeyToAccount,
}));

const {
  buildGreenGoodsSessionExecutor,
  createSessionExecutionContext,
  ensureSessionCapabilityReadyLive,
  handleRevokeSessionCapability,
  handleRotateSessionCapability,
  revokeSessionCapabilityLive,
  selectSessionCapabilityForBundle,
} = await import('../session');

function makeCoop(): CoopSharedState {
  return {
    profile: {
      id: 'coop-1',
      name: 'Starter Coop',
    },
    greenGoods: {
      enabled: true,
      gardenAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    onchainState: {
      chainId: 11155111,
      chainKey: 'sepolia',
      safeAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      safeSupports7579: true,
      safeOwners: ['0xcccccccccccccccccccccccccccccccccccccccc'],
      safeThreshold: 1,
    },
  } as CoopSharedState;
}

function makeCapability(overrides: Partial<SessionCapability> = {}): SessionCapability {
  return {
    id: 'cap-1',
    coopId: 'coop-1',
    sessionAddress: '0x1111111111111111111111111111111111111111',
    validatorAddress: '0x2222222222222222222222222222222222222222',
    validatorInitData: '0x1234',
    permissionId: 'permission-cap-1',
    scope: {
      allowedActions: ['green-goods-create-garden'],
      targetAllowlist: {
        'green-goods-create-garden': ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      },
      chainKey: 'sepolia',
      safeAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      maxUses: 5,
      expiresAt: '2026-04-01T00:00:00.000Z',
    },
    executor: {
      label: 'Ava',
      localIdentityId: 'identity-1',
    },
    issuedBy: {
      memberId: 'member-1',
      displayName: 'Ava',
      address: '0xcccccccccccccccccccccccccccccccccccccccc',
    },
    status: 'active',
    statusDetail: 'Ready',
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  } as SessionCapability;
}

function makeBundle(overrides: Partial<ActionBundle> = {}): ActionBundle {
  return {
    id: 'bundle-1',
    replayId: 'replay-1',
    coopId: 'coop-1',
    memberId: 'member-1',
    actionClass: 'green-goods-create-garden',
    payload: {},
    ...overrides,
  } as ActionBundle;
}

describe('session execution paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextState.configuredOnchainMode = 'live';
    contextState.configuredPimlicoApiKey = 'pimlico-key';
    contextState.configuredSessionMode = 'live';
    contextState.settingsGet.mockResolvedValue({
      value: 'wrap-secret',
    });

    const publicClient = {
      waitForTransactionReceipt: vi.fn(async () => ({
        transactionHash: '0xreceipt',
      })),
    };
    const smartClient = {
      sendTransaction: vi.fn(async () => '0xtxhash'),
    };
    const baseAccount = {
      entryPoint: {
        address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        version: '0.7' as const,
      },
      getStubSignature: vi.fn(async () => 'validator-stub'),
      signUserOperation: vi.fn(async () => 'validator-signature'),
    };

    sharedMocks.createCoopPublicClient.mockResolvedValue(publicClient);
    sharedMocks.createCoopSmartAccountClient.mockReturnValue({ smartClient });
    sharedMocks.getEncryptedSessionMaterial.mockResolvedValue({
      cipherText: 'cipher',
      sessionAddress: '0x1111111111111111111111111111111111111111',
    });
    permissionlessMocks.toSafeSmartAccount.mockResolvedValue(baseAccount);
    rhinestoneMocks.checkModuleInstalled.mockResolvedValue(true);
    rhinestoneMocks.installModule.mockResolvedValue([
      {
        to: '0x0000000000000000000000000000000000000010',
        data: '0xinstall',
        value: 0n,
      },
    ]);
    sharedMocks.listSessionCapabilities.mockResolvedValue([makeCapability()]);
    sharedMocks.validateSessionCapabilityForBundle.mockImplementation(({ capability }) => ({
      ok: true,
      capability,
    }));
    sharedMocks.getSessionCapability.mockResolvedValue(makeCapability());
    sharedMocks.getAuthSession.mockResolvedValue({
      authMode: 'passkey',
      primaryAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
    });
    operatorMocks.requireCreatorGrantManager.mockResolvedValue({
      ok: true,
      coop: makeCoop(),
      member: {
        id: 'member-1',
        displayName: 'Ava',
      },
    });
  });

  it('installs missing smart-session modules and enables the capability when live setup needs it', async () => {
    const sendTransaction = vi.fn(async () => '0xtxhash');
    sharedMocks.createCoopSmartAccountClient.mockReturnValue({
      smartClient: {
        sendTransaction,
      },
    });
    rhinestoneMocks.checkModuleInstalled.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    sharedMocks.checkSessionCapabilityEnabled.mockResolvedValue(false);

    const result = await ensureSessionCapabilityReadyLive({
      capability: makeCapability({
        moduleInstalledAt: undefined,
        permissionId: `0x${'1'.repeat(64)}`,
        status: 'pending',
      }),
      authSession: {
        authMode: 'passkey',
        primaryAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      } as never,
      onchainState: makeCoop().onchainState,
    });

    expect(rhinestoneMocks.installModule).toHaveBeenCalledTimes(1);
    expect(rhinestoneMocks.checkModuleInstalled).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({
          address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          type: 'safe',
          deployedOnChains: [11155111],
        }),
      }),
    );
    expect(rhinestoneMocks.installModule).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({
          address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          type: 'safe',
          deployedOnChains: [11155111],
        }),
      }),
    );
    expect(sendTransaction).toHaveBeenCalledTimes(2);
    expect(sendTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: '0x0000000000000000000000000000000000000010',
        data: '0xinstall',
      }),
    );
    expect(sendTransaction.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        to: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
        data: expect.stringMatching(/^0x[a-fA-F0-9]+$/),
        value: 0n,
      }),
    );
    expect(result.capability).toMatchObject({
      id: 'cap-1',
      status: 'active',
      statusDetail: 'Session key is enabled on the coop Safe and ready for bounded execution.',
      moduleInstalledAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    });
  });

  it('sends the bounded revoke execution when the live session capability is still enabled', async () => {
    const sendTransaction = vi.fn(async () => '0xrevokehash');
    sharedMocks.createCoopSmartAccountClient.mockReturnValue({
      smartClient: {
        sendTransaction,
      },
    });
    sharedMocks.checkSessionCapabilityEnabled.mockResolvedValue(true);

    await revokeSessionCapabilityLive({
      capability: makeCapability(),
      authSession: {
        authMode: 'passkey',
        primaryAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      } as never,
      onchainState: makeCoop().onchainState,
    });

    expect(sendTransaction).toHaveBeenCalledTimes(1);
    expect(sendTransaction).toHaveBeenCalledWith({
      to: '0x0000000000000000000000000000000000000001',
      data: '0xdeadbeef',
      value: 0n,
    });
  });

  it('skips the revoke transaction when the session capability is already disabled on-chain', async () => {
    const sendTransaction = vi.fn(async () => '0xrevokehash');
    sharedMocks.createCoopSmartAccountClient.mockReturnValue({
      smartClient: {
        sendTransaction,
      },
    });
    sharedMocks.checkSessionCapabilityEnabled.mockResolvedValue(false);

    await revokeSessionCapabilityLive({
      capability: makeCapability(),
      authSession: {
        authMode: 'passkey',
        primaryAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      } as never,
      onchainState: makeCoop().onchainState,
    });

    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('rejects session execution context creation when the Pimlico key is missing', async () => {
    contextState.configuredPimlicoApiKey = undefined;

    await expect(
      createSessionExecutionContext({
        capability: makeCapability(),
        onchainState: makeCoop().onchainState,
      }),
    ).rejects.toThrow('Pimlico API key is required for live session-key execution.');
  });

  it('rejects session execution context creation when encrypted material is unavailable', async () => {
    sharedMocks.getEncryptedSessionMaterial.mockResolvedValue(undefined);

    await expect(
      createSessionExecutionContext({
        capability: makeCapability(),
        onchainState: makeCoop().onchainState,
      }),
    ).rejects.toThrow('Encrypted session signer material is unavailable on this browser profile.');
  });

  it('builds a wrapped session signing account for live execution', async () => {
    await createSessionExecutionContext({
      capability: makeCapability(),
      onchainState: makeCoop().onchainState,
    });

    const account = sharedMocks.createCoopSmartAccountClient.mock.calls[0]?.[0]?.account as {
      getStubSignature: () => Promise<string>;
      signUserOperation: (input: Record<string, unknown>) => Promise<string>;
    };

    await expect(account.getStubSignature()).resolves.toBe('wrapped:cap-1:validator-stub');
    await expect(account.signUserOperation({ nonce: 1n })).resolves.toBe(
      'wrapped:cap-1:validator-signature',
    );
    expect(sharedMocks.decryptSessionPrivateKey).toHaveBeenCalledWith({
      material: {
        cipherText: 'cipher',
        sessionAddress: '0x1111111111111111111111111111111111111111',
      },
      wrappingSecret: 'wrap-secret',
    });
    expect(permissionlessMocks.toSafeSmartAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.4.1',
        safe4337ModuleAddress: '0x7579EE8307284F293B1927136486880611F20002',
        erc7579LaunchpadAddress: '0x7579011aB74c46090561ea277Ba79D510c6C00ff',
        attesters: ['0x000000333034E9f539ce08819E12c1b8Cb29084d'],
        attestersThreshold: 1,
      }),
    );
  });

  it('selects a usable session capability and persists any refreshed status change', async () => {
    sharedMocks.validateSessionCapabilityForBundle.mockImplementation(({ capability }) => ({
      ok: true,
      capability: {
        ...capability,
        statusDetail: 'Freshly validated',
      },
    }));

    const selected = await selectSessionCapabilityForBundle({
      coop: makeCoop(),
      bundle: makeBundle(),
    });

    expect(selected.statusDetail).toBe('Freshly validated');
    expect(sharedMocks.saveSessionCapability).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'cap-1',
        statusDetail: 'Freshly validated',
      }),
    );
  });

  it('logs validation rejections and throws the last rejection reason when no capability is usable', async () => {
    const capabilities = [makeCapability({ id: 'cap-1' }), makeCapability({ id: 'cap-2' })];
    sharedMocks.listSessionCapabilities.mockResolvedValue(capabilities);
    sharedMocks.validateSessionCapabilityForBundle
      .mockReturnValueOnce({
        ok: false,
        capability: {
          ...capabilities[0],
          status: 'unusable',
        },
        reason: 'Capability expired.',
        rejectType: 'expired',
      })
      .mockReturnValueOnce({
        ok: false,
        capability: {
          ...capabilities[1],
          status: 'unusable',
        },
        reason: 'Capability missing local material.',
        rejectType: 'missing-material',
      });

    await expect(
      selectSessionCapabilityForBundle({
        coop: makeCoop(),
        bundle: makeBundle(),
      }),
    ).rejects.toThrow('Capability missing local material.');

    expect(sharedMocks.saveSessionCapabilityLogEntry).toHaveBeenCalledTimes(2);
    expect(sharedMocks.saveSessionCapabilityLogEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        capabilityId: 'cap-1',
        reason: 'expired',
      }),
    );
    expect(sharedMocks.saveSessionCapabilityLogEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        capabilityId: 'cap-2',
        reason: 'missing-material',
      }),
    );
  });

  it('throws a clear error when no session capability exists for the coop', async () => {
    sharedMocks.listSessionCapabilities.mockResolvedValue([]);

    await expect(
      selectSessionCapabilityForBundle({
        coop: makeCoop(),
        bundle: makeBundle(),
      }),
    ).rejects.toThrow('No usable session key is available for this coop.');
  });

  it('returns undefined for Green Goods session execution outside live mode', async () => {
    contextState.configuredSessionMode = 'mock';

    await expect(
      buildGreenGoodsSessionExecutor({
        coop: makeCoop(),
        bundle: makeBundle(),
      }),
    ).resolves.toBeUndefined();
  });

  it('executes Green Goods transactions through a validated session key and records success', async () => {
    const executor = await buildGreenGoodsSessionExecutor({
      coop: makeCoop(),
      bundle: makeBundle(),
    });

    const result = await executor?.({
      to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      data: '0x1234',
      value: 2n,
    });

    expect(result).toEqual({
      txHash: '0xtxhash',
      receipt: {
        transactionHash: '0xreceipt',
      },
      safeAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
    expect(sharedMocks.saveSessionCapabilityLogEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'session-execution-attempted',
      }),
    );
    expect(sharedMocks.saveSessionCapabilityLogEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'session-execution-succeeded',
      }),
    );
    expect(sharedMocks.saveSessionCapability).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'cap-1',
      }),
    );
  });

  it('records failed Green Goods session executions and rethrows the failure', async () => {
    sharedMocks.sendSmartAccountTransactionWithCoopGasFallback.mockRejectedValueOnce(
      new Error('Bundler rejected user operation.'),
    );
    const sendTransaction = vi.fn(async () => {
      throw new Error('Bundler rejected user operation.');
    });
    sharedMocks.createCoopSmartAccountClient.mockReturnValue({
      smartClient: {
        sendTransaction,
      },
    });

    const executor = await buildGreenGoodsSessionExecutor({
      coop: makeCoop(),
      bundle: makeBundle(),
    });

    await expect(
      executor?.({
        to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        data: '0x1234',
      }),
    ).rejects.toThrow('Bundler rejected user operation.');

    expect(sharedMocks.saveSessionCapabilityLogEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'session-execution-failed',
        detail: 'Bundler rejected user operation.',
      }),
    );
  });

  it('returns a typed error when revoking a live session capability fails', async () => {
    contextState.configuredPimlicoApiKey = undefined;

    const result = await handleRevokeSessionCapability({
      type: 'revoke-session-capability',
      payload: {
        capabilityId: 'cap-1',
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Pimlico API key is required for live session-key setup.',
    });
  });

  it('returns a typed error when rotating a live session capability cannot revoke the current key', async () => {
    contextState.configuredPimlicoApiKey = undefined;

    const result = await handleRotateSessionCapability({
      type: 'rotate-session-capability',
      payload: {
        capabilityId: 'cap-1',
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Pimlico API key is required for live session-key setup.',
    });
  });
});
