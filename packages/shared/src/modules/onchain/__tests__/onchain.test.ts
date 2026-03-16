import { describe, expect, it } from 'vitest';
import { normalizeLegacyOnchainState, onchainStateSchema } from '../../../contracts/schema';
import {
  buildPimlicoRpcUrl,
  createMockOnchainState,
  createUnavailableOnchainState,
  describeOnchainModeSummary,
  getCoopChainConfig,
  getCoopChainLabel,
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
});
