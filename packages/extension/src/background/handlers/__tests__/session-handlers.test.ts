import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildSmartSession: vi.fn(() => ({
    permissionId: 'permission-1',
    modules: {
      validator: { address: '0xvalidator' },
      fallback: { address: '0xfallback' },
    },
  })),
  createSessionCapability: vi.fn((input: Record<string, unknown>) => ({
    id: 'session-1',
    coopId: input.coopId,
    issuedBy: input.issuedBy,
    executor: input.executor,
    scope: input.scope,
    sessionAddress: input.sessionAddress,
    validatorAddress: input.validatorAddress,
    validatorInitData: input.validatorInitData,
    status: 'pending',
    statusDetail: input.statusDetail,
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:00.000Z',
  })),
  createSessionCapabilityLogEntry: vi.fn((input: Record<string, unknown>) => input),
  createSessionSignerMaterial: vi.fn(() => ({
    sessionAddress: '0x1111111111111111111111111111111111111111',
    validatorAddress: '0x2222222222222222222222222222222222222222',
    validatorInitData: '0x1234',
    privateKey: '0x3333333333333333333333333333333333333333333333333333333333333333',
  })),
  createSessionWrappingSecret: vi.fn(async () => 'wrap-secret'),
  encryptSessionPrivateKey: vi.fn(async (input: Record<string, unknown>) => ({
    capabilityId: input.capabilityId,
    sessionAddress: input.sessionAddress,
    cipherText: 'cipher-text',
    wrappingSecret: input.wrappingSecret,
  })),
  getAuthSession: vi.fn(),
  getGreenGoodsDeployment: vi.fn(() => ({
    gardenToken: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    actionRegistry: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    gardensModule: '0xcccccccccccccccccccccccccccccccccccccccc',
  })),
  saveEncryptedSessionMaterial: vi.fn(async () => undefined),
  saveSessionCapability: vi.fn(async () => undefined),
  saveSessionCapabilityLogEntry: vi.fn(async () => undefined),
  setLocalSetting: vi.fn(async () => undefined),
}));

const contextMocks = vi.hoisted(() => ({
  settingsGet: vi.fn(),
}));

const operatorMocks = vi.hoisted(() => ({
  requireCreatorGrantManager: vi.fn(),
}));

const runtimeMocks = vi.hoisted(() => ({
  createRuntimePermitExecutor: vi.fn(() => ({
    label: 'Ari',
    localIdentityId: 'identity-1',
  })),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    buildSmartSession: mocks.buildSmartSession,
    createSessionCapability: mocks.createSessionCapability,
    createSessionCapabilityLogEntry: mocks.createSessionCapabilityLogEntry,
    createSessionSignerMaterial: mocks.createSessionSignerMaterial,
    createSessionWrappingSecret: mocks.createSessionWrappingSecret,
    encryptSessionPrivateKey: mocks.encryptSessionPrivateKey,
    getAuthSession: mocks.getAuthSession,
    getGreenGoodsDeployment: mocks.getGreenGoodsDeployment,
    saveEncryptedSessionMaterial: mocks.saveEncryptedSessionMaterial,
    saveSessionCapability: mocks.saveSessionCapability,
    saveSessionCapabilityLogEntry: mocks.saveSessionCapabilityLogEntry,
  };
});

vi.mock('../../context', () => ({
  configuredOnchainMode: 'mock',
  configuredPimlicoApiKey: undefined,
  configuredSessionMode: 'mock',
  db: {
    settings: {
      get: contextMocks.settingsGet,
    },
  },
  getLocalSetting: vi.fn(),
  setLocalSetting: mocks.setLocalSetting,
  stateKeys: {
    sessionWrappingSecret: 'sessionWrappingSecret',
  },
}));

vi.mock('../../dashboard', () => ({
  refreshBadge: vi.fn(),
}));

vi.mock('../../operator', () => ({
  getTrustedNodeContext: vi.fn(),
  logPrivilegedAction: vi.fn(),
  requireCreatorGrantManager: operatorMocks.requireCreatorGrantManager,
}));

vi.mock('../../../runtime/permit-runtime', () => ({
  createRuntimePermitExecutor: runtimeMocks.createRuntimePermitExecutor,
}));

const {
  handleIssueSessionCapability,
  requireSessionWrappingSecret,
  resolveDefaultSessionActionsForCoop,
  resolveSessionTargetAllowlist,
} = await import('../session');

function buildCoop(overrides: Record<string, unknown> = {}) {
  return {
    profile: { id: 'coop-1' },
    onchainState: {
      chainKey: 'sepolia',
      safeAddress: '0x9999999999999999999999999999999999999999',
    },
    greenGoods: {
      enabled: true,
      ...overrides.greenGoods,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  contextMocks.settingsGet.mockResolvedValue(undefined);
  mocks.getAuthSession.mockResolvedValue({
    authMode: 'passkey',
    primaryAddress: '0x9999999999999999999999999999999999999999',
  });
  operatorMocks.requireCreatorGrantManager.mockResolvedValue({
    ok: true,
    coop: buildCoop(),
    member: {
      id: 'member-1',
      displayName: 'Ari',
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('session handlers', () => {
  it('reuses the stored session wrapping secret when one already exists', async () => {
    contextMocks.settingsGet.mockResolvedValue({
      value: 'existing-wrap-secret',
    });

    await expect(requireSessionWrappingSecret()).resolves.toBe('existing-wrap-secret');
    expect(mocks.createSessionWrappingSecret).not.toHaveBeenCalled();
    expect(mocks.setLocalSetting).not.toHaveBeenCalled();
  });

  it('creates and stores a session wrapping secret when missing', async () => {
    await expect(requireSessionWrappingSecret()).resolves.toBe('wrap-secret');

    expect(mocks.createSessionWrappingSecret).toHaveBeenCalledTimes(1);
    expect(mocks.setLocalSetting).toHaveBeenCalledWith('sessionWrappingSecret', 'wrap-secret');
  });

  it('normalizes target allowlists and rejects invalid target-only actions', () => {
    const allowlist = resolveSessionTargetAllowlist({
      coop: buildCoop({
        greenGoods: {
          enabled: true,
          gardenAddress: '0x1234567890abcdef1234567890abcdef12345678',
        },
      }) as never,
      allowedActions: ['green-goods-sync-garden-profile'],
      overrides: {
        'green-goods-sync-garden-profile': [
          'not-an-address',
          '0x1234567890abcdef1234567890abcdef12345678',
          '0x1234567890abcdef1234567890abcdef12345678',
        ],
      },
    });

    expect(allowlist).toEqual({
      'green-goods-sync-garden-profile': ['0x1234567890abcdef1234567890abcdef12345678'],
    });

    expect(() =>
      resolveSessionTargetAllowlist({
        coop: buildCoop() as never,
        allowedActions: ['green-goods-sync-garden-profile'],
      }),
    ).toThrow('Garden-linked session actions require a linked Green Goods garden address first.');
  });

  it('returns the expected default action set for coop garden state', () => {
    expect(resolveDefaultSessionActionsForCoop(buildCoop() as never)).toEqual([
      'green-goods-create-garden',
    ]);
    expect(
      resolveDefaultSessionActionsForCoop(
        buildCoop({
          greenGoods: {
            enabled: true,
            gardenAddress: '0x1234567890abcdef1234567890abcdef12345678',
          },
        }) as never,
      ),
    ).toEqual([
      'green-goods-sync-garden-profile',
      'green-goods-set-garden-domains',
      'green-goods-create-garden-pools',
    ]);
  });

  it('issues a mock session capability, encrypts signer material, and logs the issuance', async () => {
    const result = await handleIssueSessionCapability({
      type: 'issue-session-capability',
      payload: {
        coopId: 'coop-1',
        expiresAt: '2026-04-01T00:00:00.000Z',
        maxUses: 5,
        allowedActions: ['green-goods-create-garden'],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      id: 'session-1',
      permissionId: 'permission-1',
    });
    expect(mocks.createSessionCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        coopId: 'coop-1',
        executor: {
          label: 'Ari',
          localIdentityId: 'identity-1',
        },
        scope: expect.objectContaining({
          allowedActions: ['green-goods-create-garden'],
          targetAllowlist: {
            'green-goods-create-garden': ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
          },
        }),
      }),
    );
    expect(mocks.encryptSessionPrivateKey).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilityId: 'session-1',
        sessionAddress: '0x1111111111111111111111111111111111111111',
        wrappingSecret: 'wrap-secret',
      }),
    );
    expect(mocks.saveSessionCapability).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'session-1',
        permissionId: 'permission-1',
      }),
    );
    expect(mocks.saveEncryptedSessionMaterial).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        capabilityId: 'session-1',
      }),
    );
    expect(mocks.saveSessionCapabilityLogEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        capabilityId: 'session-1',
        eventType: 'session-issued',
      }),
    );
  });
});
