import { describe, expect, it } from 'vitest';
import { fvmChainKeySchema, fvmRegistryStateSchema } from '../../../contracts/schema';

describe('fvm schemas', () => {
  describe('fvmChainKeySchema', () => {
    it('accepts filecoin', () => {
      expect(fvmChainKeySchema.parse('filecoin')).toBe('filecoin');
    });

    it('accepts filecoin-calibration', () => {
      expect(fvmChainKeySchema.parse('filecoin-calibration')).toBe('filecoin-calibration');
    });

    it('rejects unknown chain key', () => {
      expect(() => fvmChainKeySchema.parse('ethereum')).toThrow();
    });
  });

  describe('fvmRegistryStateSchema', () => {
    const valid = {
      chainKey: 'filecoin-calibration',
      chainId: 314159,
      registryAddress: '0x1234567890abcdef1234567890abcdef12345678',
      statusNote: 'Deployed on Calibration.',
    };

    it('accepts valid state', () => {
      const result = fvmRegistryStateSchema.parse(valid);
      expect(result.chainKey).toBe('filecoin-calibration');
      expect(result.chainId).toBe(314159);
    });

    it('accepts state with signer address', () => {
      const result = fvmRegistryStateSchema.parse({
        ...valid,
        signerAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      });
      expect(result.signerAddress).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('rejects invalid chain key', () => {
      expect(() => fvmRegistryStateSchema.parse({ ...valid, chainKey: 'ethereum' })).toThrow();
    });

    it('rejects invalid registry address', () => {
      expect(() =>
        fvmRegistryStateSchema.parse({ ...valid, registryAddress: 'not-an-address' }),
      ).toThrow();
    });
  });
});
