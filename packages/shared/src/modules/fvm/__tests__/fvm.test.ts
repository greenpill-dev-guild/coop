import { describe, expect, it } from 'vitest';
import {
  createMockFvmRegistryState,
  describeFvmRegistryRegistrationGate,
  encodeFvmRegisterArchiveCalldata,
  encodeFvmRegisterMembershipCalldata,
  encodeFvmRegisterMembershipsCalldata,
  getFvmChainConfig,
  getFvmExplorerTxUrl,
  resolveFvmRegistryAddress,
} from '../fvm';

describe('fvm module', () => {
  describe('getFvmChainConfig', () => {
    it('returns config for filecoin', () => {
      const config = getFvmChainConfig('filecoin');
      expect(config.chain.id).toBe(314);
      expect(config.label).toBe('Filecoin Mainnet');
    });

    it('returns config for filecoin-calibration', () => {
      const config = getFvmChainConfig('filecoin-calibration');
      expect(config.chain.id).toBe(314159);
      expect(config.label).toBe('Filecoin Calibration');
    });

    it('throws for unknown chain key', () => {
      // @ts-expect-error -- testing invalid input
      expect(() => getFvmChainConfig('unknown')).toThrow('Unknown FVM chain key');
    });
  });

  describe('getFvmExplorerTxUrl', () => {
    it('returns filfox URL for mainnet', () => {
      const url = getFvmExplorerTxUrl('0xabc123', 'filecoin');
      expect(url).toContain('filfox.info');
      expect(url).toContain('0xabc123');
    });

    it('returns filscan URL for calibration', () => {
      const url = getFvmExplorerTxUrl('0xabc123', 'filecoin-calibration');
      expect(url).toContain('calibration.filscan.io');
      expect(url).toContain('0xabc123');
    });
  });

  describe('encodeFvmRegisterArchiveCalldata', () => {
    it('encodes valid calldata for artifact scope', () => {
      const data = encodeFvmRegisterArchiveCalldata({
        rootCid: 'bafyroot123',
        pieceCid: 'bagapiece456',
        scope: 0,
        coopId: 'coop-abc',
      });
      expect(data).toMatch(/^0x/);
      expect(data.length).toBeGreaterThan(10);
    });

    it('encodes valid calldata for snapshot scope', () => {
      const data = encodeFvmRegisterArchiveCalldata({
        rootCid: 'bafyroot123',
        pieceCid: '',
        scope: 1,
        coopId: 'coop-abc',
      });
      expect(data).toMatch(/^0x/);
    });
  });

  describe('encodeFvmRegisterMembershipCalldata', () => {
    it('encodes single membership calldata', () => {
      const data = encodeFvmRegisterMembershipCalldata({
        coopId: 'coop-abc',
        commitment: 'commitment123',
      });
      expect(data).toMatch(/^0x/);
      expect(data.length).toBeGreaterThan(10);
    });
  });

  describe('encodeFvmRegisterMembershipsCalldata', () => {
    it('encodes batch membership calldata', () => {
      const data = encodeFvmRegisterMembershipsCalldata({
        coopId: 'coop-abc',
        commitments: ['comm1', 'comm2', 'comm3'],
      });
      expect(data).toMatch(/^0x/);
      expect(data.length).toBeGreaterThan(10);
    });
  });

  describe('createMockFvmRegistryState', () => {
    it('creates mock state for calibration', () => {
      const state = createMockFvmRegistryState({});
      expect(state.chainKey).toBe('filecoin-calibration');
      expect(state.chainId).toBe(314159);
      expect(state.registryAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(state.statusNote).toContain('Calibration');
    });

    it('creates mock state for mainnet', () => {
      const state = createMockFvmRegistryState({ chainKey: 'filecoin' });
      expect(state.chainKey).toBe('filecoin');
      expect(state.chainId).toBe(314);
    });

    it('includes signer address when provided', () => {
      const state = createMockFvmRegistryState({
        signerAddress: '0x1234567890abcdef1234567890abcdef12345678',
      });
      expect(state.signerAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
    });

    it('includes custom registry address when provided', () => {
      const state = createMockFvmRegistryState({
        registryAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      });
      expect(state.registryAddress).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    });
  });

  describe('resolveFvmRegistryAddress', () => {
    it('prefers a configured registry address', () => {
      expect(
        resolveFvmRegistryAddress(
          'filecoin-calibration',
          '0xabcdef1234567890abcdef1234567890abcdef12',
        ),
      ).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('returns undefined when no configured or known deployment exists', () => {
      expect(resolveFvmRegistryAddress('filecoin-calibration')).toBeUndefined();
    });
  });

  describe('describeFvmRegistryRegistrationGate', () => {
    it('reports readiness when registry address and operator key are present', () => {
      const gate = describeFvmRegistryRegistrationGate({
        chainKey: 'filecoin-calibration',
        configuredRegistryAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        operatorKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });

      expect(gate.available).toBe(true);
      expect(gate.registryAddress).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
      expect(gate.detail).toContain('ready');
      expect(gate.checklist).toEqual([]);
    });

    it('returns an operator checklist when live registry material is missing', () => {
      const gate = describeFvmRegistryRegistrationGate({
        chainKey: 'filecoin-calibration',
      });

      expect(gate.available).toBe(false);
      expect(gate.detail).toContain('blocked');
      expect(gate.detail).toContain('VITE_COOP_FVM_OPERATOR_KEY');
      expect(gate.checklist).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Deploy packages/contracts/src/CoopRegistry.sol'),
          expect.stringContaining('VITE_COOP_FVM_REGISTRY_ADDRESS'),
          expect.stringContaining('VITE_COOP_FVM_OPERATOR_KEY'),
        ]),
      );
    });
  });
});
