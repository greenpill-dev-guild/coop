import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPimlicoRpcUrl,
  createMockOnchainState,
  createUnavailableOnchainState,
  deployCoopSafe,
} from '../../onchain/onchain';
import {
  authSessionToLocalIdentity,
  createWebAuthnCredentialGetFn,
  createPasskeySession,
  derivePasskeyAddress,
  resolvePasskeyRpId,
  restorePasskeyAccount,
  setWebAuthnCredentialGetFnOverride,
  sessionToMember,
} from '../auth';

vi.mock('viem/account-abstraction', () => ({
  createWebAuthnCredential: vi.fn(async () => ({
    id: 'credential-1',
    publicKey: '0x1234abcd',
  })),
  toWebAuthnAccount: vi.fn((input) => ({
    address: `0x${'12'.repeat(20)}`,
    credential: input.credential,
    getFn: input.getFn,
    rpId: input.rpId,
  })),
}));

vi.mock('permissionless/accounts', () => ({
  toSafeSmartAccount: vi.fn(async () => ({
    address: `0x${'34'.repeat(20)}`,
  })),
}));

vi.mock('permissionless/clients', () => ({
  createSmartAccountClient: vi.fn(() => ({
    sendTransaction: vi.fn(async () => `0x${'56'.repeat(32)}`),
  })),
}));

vi.mock('permissionless/clients/pimlico', () => ({
  createPimlicoClient: vi.fn(() => ({
    getUserOperationGasPrice: vi.fn(async () => ({
      fast: {
        maxFeePerGas: 1n,
        maxPriorityFeePerGas: 1n,
      },
    })),
  })),
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    http: vi.fn((url) => ({ url })),
    createPublicClient: vi.fn(() => ({
      waitForTransactionReceipt: vi.fn(async () => ({})),
      getCode: vi.fn(async () => '0x1234'),
    })),
  };
});

afterEach(() => {
  setWebAuthnCredentialGetFnOverride(null);
  vi.unstubAllGlobals();
});

describe('auth and onchain helpers', () => {
  it('resolves the RP ID from the extension runtime when no hostname is available', () => {
    vi.stubGlobal('location', { hostname: '' });
    vi.stubGlobal('chrome', { runtime: { id: 'coop-extension-id' } });

    expect(resolvePasskeyRpId()).toBe('coop-extension-id');
  });

  it('honors a getFn override for passkey account restoration helpers', async () => {
    const getFnOverride = vi.fn(async () => ({
      id: 'override-credential',
      type: 'public-key',
      rawId: new Uint8Array(),
      response: {} as AuthenticatorAssertionResponse,
      clientExtensionResults: () => ({}),
    }));

    setWebAuthnCredentialGetFnOverride(getFnOverride);

    const getFn = createWebAuthnCredentialGetFn();
    if (!getFn) {
      throw new Error('Expected WebAuthn getFn override to be installed.');
    }
    await getFn({
      publicKey: { challenge: new Uint8Array([1]) },
    } as Parameters<typeof getFn>[0]);

    expect(getFnOverride).toHaveBeenCalledTimes(1);
    setWebAuthnCredentialGetFnOverride(null);
  });

  it('throws a clear error when WebAuthn credential retrieval is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    setWebAuthnCredentialGetFnOverride(null);

    const getFn = createWebAuthnCredentialGetFn();
    if (!getFn) {
      throw new Error('Expected WebAuthn getFn helper to be defined.');
    }

    await expect(getFn({ publicKey: { challenge: new Uint8Array([1]) } } as Parameters<
      typeof getFn
    >[0])).rejects.toThrow('WebAuthn credential retrieval is unavailable in this runtime.');
  });

  it('derives a stable local sender address from passkey material', () => {
    const address = derivePasskeyAddress({
      id: 'credential-1',
      publicKey: '0x1234abcd',
    });

    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(
      derivePasskeyAddress({
        id: 'credential-1',
        publicKey: '0x1234abcd',
      }),
    ).toBe(address);
  });

  it('creates a mock onchain state for mocked extension flows', () => {
    const state = createMockOnchainState({
      seed: 'coop-seed',
      senderAddress: '0x1111111111111111111111111111111111111111',
      chainKey: 'sepolia',
    });

    expect(state.chainId).toBe(11155111);
    expect(state.chainKey).toBe('sepolia');
    expect(state.safeCapability).toBe('stubbed');
    expect(state.statusNote).toContain('mock Safe on Sepolia');
  });

  it('builds the Pimlico RPC url from the selected chain key', () => {
    const url = buildPimlicoRpcUrl('sepolia', 'test-key');

    expect(url).toContain('/sepolia/rpc');
    expect(url).toContain('apikey=test-key');
  });

  it('creates a passkey session, local identity, and member projection', async () => {
    const session = await createPasskeySession({
      displayName: 'Mina',
      rpId: 'coop.local',
    });

    expect(session.primaryAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(session.passkey?.id).toBe('credential-1');
    const account = restorePasskeyAccount(session);
    expect(account).toMatchObject({
      rpId: 'coop.local',
    });
    expect((account as { getFn?: unknown }).getFn).toEqual(expect.any(Function));

    const identity = authSessionToLocalIdentity(session);
    expect(identity?.ownerAddress).toBe(session.primaryAddress);
    expect(identity?.passkey.rpId).toBe('coop.local');

    const member = sessionToMember(session, 'Mina', 'creator');
    expect(member.address).toBe(session.primaryAddress);
    expect(member.passkeyCredentialId).toBe('credential-1');
  });

  it('deploys a coop safe with mocked Pimlico clients on supported chains', async () => {
    const session = await createPasskeySession({
      displayName: 'Kai',
      rpId: 'coop.local',
    });

    for (const [chainKey, statusLabel] of [
      ['arbitrum', 'live Safe on Arbitrum'],
      ['sepolia', 'live Safe on Sepolia'],
    ] as const) {
      const state = await deployCoopSafe({
        authSession: session,
        coopSeed: `coop-seed:${chainKey}`,
        pimlico: {
          apiKey: 'pimlico-test-key',
          chainKey,
        },
      });

      expect(state.safeCapability).toBe('executed');
      expect(state.chainKey).toBe(chainKey);
      expect(state.senderAddress).toBe(session.primaryAddress);
      expect(state.safeAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(state.deploymentTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(state.statusNote).toContain(statusLabel);
    }
  });

  it('creates an unavailable placeholder for live-safe bootstrapping gaps', () => {
    const state = createUnavailableOnchainState({
      safeAddressSeed: 'pending-coop',
      senderAddress: '0x1111111111111111111111111111111111111111',
      chainKey: 'sepolia',
    });

    expect(state.chainKey).toBe('sepolia');
    expect(state.safeCapability).toBe('unavailable');
    expect(state.statusNote).toContain('live Safe on Sepolia is unavailable');
  });
});
