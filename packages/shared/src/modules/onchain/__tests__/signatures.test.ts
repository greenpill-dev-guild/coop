import type { PublicClient } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SIGNATURE_VALIDATOR_ADDRESS,
  type ValidateSignatureParams,
  signatureValidatorAbi,
  validateSafeSignature,
  validateSignature,
} from '../signatures';

/** Minimal mock that satisfies the PublicClient shape used by signature validation. */
function createMockPublicClient(readContractImpl: ReturnType<typeof vi.fn>) {
  return { readContract: readContractImpl } as unknown as PublicClient;
}

describe('signature validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('SIGNATURE_VALIDATOR_ADDRESS', () => {
    it('exports the Ambire singleton address', () => {
      expect(SIGNATURE_VALIDATOR_ADDRESS).toBe('0x7dd271fa79df3a5feb99f73bebfa4395b2e4f4be');
    });
  });

  describe('signatureValidatorAbi', () => {
    it('exports a minimal ABI with isValidSig function', () => {
      expect(signatureValidatorAbi).toBeDefined();
      expect(Array.isArray(signatureValidatorAbi)).toBe(true);

      const isValidSigFn = signatureValidatorAbi.find((entry) => entry.name === 'isValidSig');
      expect(isValidSigFn).toBeDefined();
      expect(isValidSigFn?.type).toBe('function');
      expect(isValidSigFn?.stateMutability).toBe('view');
      expect(isValidSigFn?.inputs).toHaveLength(3);
      expect(isValidSigFn?.outputs).toHaveLength(1);
    });
  });

  describe('validateSignature', () => {
    const testParams: ValidateSignatureParams = {
      signer: '0x1111111111111111111111111111111111111111',
      hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      signature: '0xdeadbeef',
    };

    it('returns valid result for a successful EOA signature', async () => {
      const readContract = vi.fn().mockResolvedValue(true);
      const client = createMockPublicClient(readContract);

      const result = await validateSignature(client, testParams);

      expect(result.isValid).toBe(true);
      expect(readContract).toHaveBeenCalledWith({
        address: SIGNATURE_VALIDATOR_ADDRESS,
        abi: signatureValidatorAbi,
        functionName: 'isValidSig',
        args: [testParams.signer, testParams.hash, testParams.signature],
      });
    });

    it('returns invalid result when contract returns false', async () => {
      const client = createMockPublicClient(vi.fn().mockResolvedValue(false));

      const result = await validateSignature(client, testParams);

      expect(result.isValid).toBe(false);
    });

    it('returns invalid result when contract call reverts', async () => {
      const client = createMockPublicClient(
        vi.fn().mockRejectedValue(new Error('execution reverted')),
      );

      const result = await validateSignature(client, testParams);

      expect(result.isValid).toBe(false);
    });
  });

  describe('validateSafeSignature', () => {
    it('delegates to validateSignature with the Safe address as signer', async () => {
      const readContract = vi.fn().mockResolvedValue(true);
      const client = createMockPublicClient(readContract);

      const safeAddress = '0x2222222222222222222222222222222222222222' as const;
      const hash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as const;
      const signature = '0xdeadbeef' as const;

      const result = await validateSafeSignature(client, safeAddress, hash, signature);

      expect(result.isValid).toBe(true);
      expect(readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [safeAddress, hash, signature],
        }),
      );
    });
  });
});

describe('schema: signatureValidationResultSchema', () => {
  it('validates a valid signature result', async () => {
    const { signatureValidationResultSchema } = await import('../../../contracts/schema');

    const result = signatureValidationResultSchema.parse({
      isValid: true,
    });

    expect(result.isValid).toBe(true);
  });

  it('rejects invalid shapes', async () => {
    const { signatureValidationResultSchema } = await import('../../../contracts/schema');

    expect(() =>
      signatureValidationResultSchema.parse({
        isValid: 'yes',
      }),
    ).toThrow();
  });
});

describe('schema: providerModeSchema', () => {
  it('accepts standard and kohaku', async () => {
    const { providerModeSchema } = await import('../../../contracts/schema');

    expect(providerModeSchema.parse('standard')).toBe('standard');
    expect(providerModeSchema.parse('kohaku')).toBe('kohaku');
  });

  it('rejects invalid modes', async () => {
    const { providerModeSchema } = await import('../../../contracts/schema');

    expect(() => providerModeSchema.parse('helios')).toThrow();
  });
});
