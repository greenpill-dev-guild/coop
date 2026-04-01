import { describe, expect, it } from 'vitest';
import { normalizeLegacyOnchainState, onchainStateSchema } from '../../../contracts/schema';
import {
  buildCoopUserOperationGasOverrides,
  buildPimlicoRpcUrl,
  createMockOnchainState,
  createUnavailableOnchainState,
  describeOnchainModeSummary,
  getCoopChainConfig,
  getCoopChainLabel,
  prepareUserOperationWithCoopGasFallback,
  sendSmartAccountTransactionWithCoopGasFallback,
  shouldRetryWithManualUserOperationGas,
} from '../onchain';

describe('onchain chain support', () => {
  it('accepts only arbitrum and sepolia state shapes', () => {
    expect(
      onchainStateSchema.parse({
        chainId: 42161,
        chainKey: 'arbitrum',
        safeAddress: '0x1111111111111111111111111111111111111111',
        safeCapability: 'stubbed',
        statusNote: 'live Safe on Arbitrum was deployed via Pimlico account abstraction.',
      }).chainKey,
    ).toBe('arbitrum');

    expect(
      onchainStateSchema.parse({
        chainId: 11155111,
        chainKey: 'sepolia',
        safeAddress: '0x2222222222222222222222222222222222222222',
        safeCapability: 'stubbed',
        statusNote: 'mock Safe on Sepolia is ready for demo flows.',
      }).chainKey,
    ).toBe('sepolia');

    expect(() =>
      onchainStateSchema.parse({
        chainId: 10,
        chainKey: 'optimism',
        safeAddress: '0x3333333333333333333333333333333333333333',
        safeCapability: 'stubbed',
        statusNote: 'Unsupported chain.',
      }),
    ).toThrow();

    expect(() =>
      onchainStateSchema.parse({
        chainId: 42161,
        chainKey: 'sepolia',
        safeAddress: '0x4444444444444444444444444444444444444444',
        safeCapability: 'stubbed',
        statusNote: 'Mismatched chain id.',
      }),
    ).toThrow(/chainId must match the configured sepolia network/i);
  });

  it('rejects legacy celo chain keys at parse time (migration handles normalization)', () => {
    expect(() =>
      onchainStateSchema.parse({
        chainId: 11142220,
        chainKey: 'celo-sepolia',
        safeAddress: '0x5555555555555555555555555555555555555555',
        safeCapability: 'stubbed',
        statusNote: 'Mock onchain mode is active for Celo Sepolia.',
      }),
    ).toThrow();

    expect(() =>
      onchainStateSchema.parse({
        chainId: 42220,
        chainKey: 'celo',
        safeAddress: '0x6666666666666666666666666666666666666666',
        safeCapability: 'executed',
        statusNote: 'Safe deployed on Celo via Pimlico account abstraction.',
      }),
    ).toThrow();
  });

  it('normalizeLegacyOnchainState transforms celo keys for migration', () => {
    const normalized = normalizeLegacyOnchainState({
      chainId: 11142220,
      chainKey: 'celo-sepolia',
      safeAddress: '0x5555555555555555555555555555555555555555',
      safeCapability: 'stubbed',
      statusNote: 'Mock onchain mode is active for Celo Sepolia.',
    });

    expect(normalized).toHaveProperty('chainKey', 'sepolia');
    expect(normalized).toHaveProperty('chainId', 11155111);
    expect((normalized as Record<string, unknown>).statusNote).toContain('Sepolia');
  });

  it('creates deterministic mock and unavailable Safe placeholders on supported chains', () => {
    const mock = createMockOnchainState({ seed: 'coop-seed' });
    const pendingA = createUnavailableOnchainState({
      chainKey: 'arbitrum',
      safeAddressSeed: 'pending-coop',
    });
    const pendingB = createUnavailableOnchainState({
      chainKey: 'arbitrum',
      safeAddressSeed: 'pending-coop',
    });

    expect(mock.chainKey).toBe('sepolia');
    expect(mock.chainId).toBe(11155111);
    expect(mock.statusNote).toBe('mock Safe on Sepolia is ready for demo flows.');
    expect(mock.safeAddress).toBe(createMockOnchainState({ seed: 'coop-seed' }).safeAddress);

    expect(pendingA.safeAddress).toBe(pendingB.safeAddress);
    expect(pendingA.statusNote).toBe(
      'live Safe on Arbitrum is unavailable until passkeys and Pimlico are configured.',
    );
  });

  it('builds supported chain labels, summaries, and Pimlico URLs', () => {
    expect(getCoopChainConfig('arbitrum').chain.id).toBe(42161);
    expect(getCoopChainConfig('arbitrum').safe.version).toBe('1.4.1');
    expect(getCoopChainConfig('arbitrum').safe.safe7579ModuleAddress).toBe(
      '0x7579EE8307284F293B1927136486880611F20002',
    );
    expect(getCoopChainConfig('arbitrum').safe.erc7579LaunchpadAddress).toBe(
      '0x7579011aB74c46090561ea277Ba79D510c6C00ff',
    );
    expect(getCoopChainLabel('arbitrum')).toBe('Arbitrum One');
    expect(getCoopChainLabel('sepolia', 'short')).toBe('Sepolia');
    expect(describeOnchainModeSummary({ mode: 'live', chainKey: 'sepolia' })).toBe(
      'live Safe on Sepolia',
    );
    expect(buildPimlicoRpcUrl('arbitrum', 'test-key')).toBe(
      'https://api.pimlico.io/v2/arbitrum/rpc?apikey=test-key',
    );
    expect(buildPimlicoRpcUrl('sepolia', 'test-key')).toBe(
      'https://api.pimlico.io/v2/sepolia/rpc?apikey=test-key',
    );
  });

  it('detects bundler estimation failures that should retry with manual gas', () => {
    expect(
      shouldRetryWithManualUserOperationGas({
        message: 'Execution failed',
        cause: {
          details: 'UserOperation reverted during simulation with reason: 0x',
        },
      }),
    ).toBe(true);
    expect(
      shouldRetryWithManualUserOperationGas({
        message: 'Invalid fields set on User Operation.',
        cause: {
          details: 'User operation gas limits exceed the max gas per userOp: 42894609 > 20000000',
        },
      }),
    ).toBe(true);
    expect(shouldRetryWithManualUserOperationGas(new Error('Different failure'))).toBe(false);
  });

  it('builds higher gas overrides for large safe payloads and paymaster flows', () => {
    const overrides = buildCoopUserOperationGasOverrides({
      accountType: 'safe',
      callData: `0x${'ab'.repeat(1200)}`,
      hasPaymaster: true,
    });

    expect(overrides.callGasLimit).toBe(26_000_000n);
    expect(overrides.verificationGasLimit).toBe(1_200_000n);
    expect(overrides.preVerificationGas).toBe(650_000n);
    expect(overrides.paymasterVerificationGasLimit).toBe(650_000n);
    expect(overrides.paymasterPostOpGasLimit).toBe(250_000n);
  });

  it('builds tuned gas overrides for medium safe payloads behind the paymaster ceiling', () => {
    const overrides = buildCoopUserOperationGasOverrides({
      accountType: 'safe',
      callData: `0x${'ab'.repeat(600)}`,
      hasPaymaster: true,
    });

    expect(overrides.callGasLimit).toBe(19_100_000n);
    expect(overrides.verificationGasLimit).toBe(400_000n);
    expect(overrides.preVerificationGas).toBe(100_000n);
    expect(overrides.paymasterVerificationGasLimit).toBe(75_000n);
    expect(overrides.paymasterPostOpGasLimit).toBe(1n);
  });

  it('retries prepareUserOperation with manual gas after estimation failure', async () => {
    const attempts: Array<Record<string, unknown>> = [];
    const prepared = await prepareUserOperationWithCoopGasFallback(
      {
        account: { type: 'safe' },
        paymaster: {},
      } as never,
      {
        account: { type: 'safe' },
        calls: [{ data: `0x${'ab'.repeat(600)}` }],
      } as never,
      async (_client, parameters) => {
        attempts.push(parameters as Record<string, unknown>);
        if (attempts.length === 1) {
          throw new Error('UserOperation reverted during simulation with reason: 0x');
        }
        return {
          ...parameters,
          signature: '0x',
        } as never;
      },
    );

    expect(attempts).toHaveLength(2);
    expect(attempts[1].callGasLimit).toBe(19_100_000n);
    expect(attempts[1].verificationGasLimit).toBe(400_000n);
    expect(attempts[1].preVerificationGas).toBe(100_000n);
    expect(attempts[1].paymasterVerificationGasLimit).toBe(75_000n);
    expect(attempts[1].paymasterPostOpGasLimit).toBe(1n);
    expect(prepared).toMatchObject({
      callGasLimit: 19_100_000n,
      verificationGasLimit: 400_000n,
      preVerificationGas: 100_000n,
    });
  });

  it('overrides bundler-mutated gas fields on retry after estimation failure', async () => {
    const attempts: Array<Record<string, unknown>> = [];
    const initialParameters = {
      account: { type: 'safe' },
      calls: [{ data: `0x${'ab'.repeat(600)}` }],
    } as Record<string, unknown>;

    const prepared = await prepareUserOperationWithCoopGasFallback(
      {
        account: { type: 'safe' },
        paymaster: {},
      } as never,
      initialParameters as never,
      async (_client, parameters) => {
        attempts.push({ ...(parameters as Record<string, unknown>) });
        if (attempts.length === 1) {
          (parameters as Record<string, unknown>).callGasLimit = 41_753_198n;
          (parameters as Record<string, unknown>).verificationGasLimit = 387_879n;
          (parameters as Record<string, unknown>).preVerificationGas = 62_483n;
          (parameters as Record<string, unknown>).paymasterVerificationGasLimit = 46_456n;
          throw {
            message: 'Invalid fields set on User Operation.',
            cause: {
              details:
                'User operation gas limits exceed the max gas per userOp: 42904485 > 20000000',
            },
          };
        }
        return {
          ...parameters,
          signature: '0x',
        } as never;
      },
    );

    expect(attempts).toHaveLength(2);
    expect(attempts[1].callGasLimit).toBe(19_100_000n);
    expect(attempts[1].verificationGasLimit).toBe(400_000n);
    expect(attempts[1].preVerificationGas).toBe(100_000n);
    expect(attempts[1].paymasterVerificationGasLimit).toBe(75_000n);
    expect(attempts[1].paymasterPostOpGasLimit).toBe(1n);
    expect(prepared).toMatchObject({
      callGasLimit: 19_100_000n,
      verificationGasLimit: 400_000n,
      preVerificationGas: 100_000n,
      paymasterVerificationGasLimit: 75_000n,
    });
  });

  it('retries sendUserOperation with manual gas after send-time bundler rejection', async () => {
    const attempts: Array<Record<string, unknown>> = [];
    const result = await sendSmartAccountTransactionWithCoopGasFallback({
      smartClient: {
        account: { type: 'safe' },
        paymaster: {},
        async sendUserOperation(parameters: Record<string, unknown>) {
          attempts.push({ ...parameters });
          if (attempts.length === 1) {
            throw {
              message: 'Invalid fields set on User Operation.',
              cause: {
                details:
                  'User operation gas limits exceed the max gas per userOp: 42894609 > 20000000',
              },
            };
          }
          return `0x${'12'.repeat(32)}`;
        },
        async waitForUserOperationReceipt({ hash }: { hash: `0x${string}` }) {
          return {
            receipt: {
              transactionHash: `0x${'34'.repeat(32)}`,
            },
            userOperationHash: hash,
          };
        },
      } as never,
      accountTypeHint: 'safe',
      to: '0x1111111111111111111111111111111111111111',
      data: `0x${'ab'.repeat(600)}`,
      value: 0n,
    });

    expect(attempts).toHaveLength(2);
    expect(attempts[0].callGasLimit).toBeUndefined();
    expect(attempts[1].callGasLimit).toBe(19_100_000n);
    expect(attempts[1].verificationGasLimit).toBe(400_000n);
    expect(attempts[1].preVerificationGas).toBe(100_000n);
    expect(attempts[1].paymasterVerificationGasLimit).toBe(75_000n);
    expect(attempts[1].paymasterPostOpGasLimit).toBe(1n);
    expect(result).toMatchObject({
      txHash: `0x${'34'.repeat(32)}`,
      userOperationHash: `0x${'12'.repeat(32)}`,
    });
  });
});
