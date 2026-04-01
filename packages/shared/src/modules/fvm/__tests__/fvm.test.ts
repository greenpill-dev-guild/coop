import { describe, expect, it } from 'vitest';
import {
  createLocalFvmSignerBinding,
  createLocalFvmSignerMaterial,
  createMockFvmRegistryState,
  describeFvmLocalSignerFundingHint,
  describeFvmRegistryRegistrationGate,
  encodeFvmRegisterArchiveCalldata,
  encodeFvmRegisterMembershipCalldata,
  encodeFvmRegisterMembershipsCalldata,
  getFvmChainConfig,
  getFvmExplorerTxUrl,
  inspectFvmRegistryDeployment,
  isFvmInsufficientFundsError,
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

    it('returns the canonical deployment when no configured registry address is provided', () => {
      expect(resolveFvmRegistryAddress('filecoin-calibration')).toBe(
        '0x80a906C175ea875af8a2afcA8F91F60b201dc824',
      );
    });

    it('returns the canonical mainnet deployment when no configured registry address is provided', () => {
      expect(resolveFvmRegistryAddress('filecoin')).toBe(
        '0x115819bCcaab03Be49107c69c00Bc4c21009839C',
      );
    });
  });

  describe('describeFvmRegistryRegistrationGate', () => {
    it('reports readiness when a registry address is present', () => {
      const gate = describeFvmRegistryRegistrationGate({
        chainKey: 'filecoin-calibration',
        configuredRegistryAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      });

      expect(gate.available).toBe(true);
      expect(gate.registryAddress).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
      expect(gate.detail).toContain('ready');
      expect(gate.checklist).toEqual([]);
    });

    it('falls back to the canonical deployment when no env override is configured', () => {
      const gate = describeFvmRegistryRegistrationGate({
        chainKey: 'filecoin-calibration',
      });

      expect(gate.available).toBe(true);
      expect(gate.registryAddress).toBe('0x80a906C175ea875af8a2afcA8F91F60b201dc824');
      expect(gate.detail).toContain('Members will sign');
      expect(gate.checklist).toEqual([]);
    });
  });

  describe('inspectFvmRegistryDeployment', () => {
    it('reports success when contract code exists and the ABI responds', async () => {
      const inspection = await inspectFvmRegistryDeployment({
        chainKey: 'filecoin-calibration',
        registryAddress: '0x80a906C175ea875af8a2afcA8F91F60b201dc824',
        client: {
          getCode: async () => '0x60016000',
          readContract: async () => 3n,
        },
      });

      expect(inspection).toEqual({
        ok: true,
        registryAddress: '0x80a906C175ea875af8a2afcA8F91F60b201dc824',
        archiveCount: 3n,
        detail:
          'Filecoin Calibration registry 0x80a906C175ea875af8a2afcA8F91F60b201dc824 is deployed and readable.',
      });
    });

    it('reports failure when no contract code exists at the registry address', async () => {
      const inspection = await inspectFvmRegistryDeployment({
        chainKey: 'filecoin-calibration',
        registryAddress: '0x80a906C175ea875af8a2afcA8F91F60b201dc824',
        client: {
          getCode: async () => '0x',
          readContract: async () => 0n,
        },
      });

      expect(inspection).toEqual({
        ok: false,
        registryAddress: '0x80a906C175ea875af8a2afcA8F91F60b201dc824',
        detail:
          'No contract code was found at 0x80a906C175ea875af8a2afcA8F91F60b201dc824 on Filecoin Calibration.',
      });
    });

    it('reports failure when the contract does not answer the expected CoopRegistry ABI', async () => {
      const inspection = await inspectFvmRegistryDeployment({
        chainKey: 'filecoin-calibration',
        registryAddress: '0x80a906C175ea875af8a2afcA8F91F60b201dc824',
        client: {
          getCode: async () => '0x60016000',
          readContract: async () => {
            throw new Error('execution reverted');
          },
        },
      });

      expect(inspection).toEqual({
        ok: false,
        registryAddress: '0x80a906C175ea875af8a2afcA8F91F60b201dc824',
        detail:
          'Contract code exists at 0x80a906C175ea875af8a2afcA8F91F60b201dc824 on Filecoin Calibration, but the registry ABI check failed: execution reverted',
      });
    });
  });

  describe('local FVM signer helpers', () => {
    it('creates a deterministic local binding id for a passkey credential on a chain', () => {
      const binding = createLocalFvmSignerBinding({
        chainKey: 'filecoin',
        accountAddress: '0x1234567890abcdef1234567890abcdef12345678',
        passkeyCredentialId: 'passkey-1',
        createdAt: '2026-03-31T10:00:00.000Z',
      });

      expect(binding.id).toBe('fvm-signer:filecoin:passkey-1');
      expect(binding.lastUsedAt).toBe('2026-03-31T10:00:00.000Z');
    });

    it('creates a signer with a private key and address', () => {
      const signer = createLocalFvmSignerMaterial({
        chainKey: 'filecoin-calibration',
        passkeyCredentialId: 'passkey-1',
      });

      expect(signer.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(signer.accountAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(signer.chainKey).toBe('filecoin-calibration');
    });

    it('detects insufficient-funds failures and formats a funding hint', () => {
      const error = new Error('insufficient funds for gas * price + value');
      expect(isFvmInsufficientFundsError(error)).toBe(true);
      expect(
        describeFvmLocalSignerFundingHint({
          chainKey: 'filecoin',
          signerAddress: '0x1234567890abcdef1234567890abcdef12345678',
          detail: error.message,
        }),
      ).toContain('Fund the member-local Filecoin signer');
    });
  });
});
