import type { PublicClient } from 'viem';
import type { SignatureValidationResult } from '../../contracts/schema';

/**
 * Ambire universal signature validator singleton contract address.
 * Deployed at the same address across all EVM chains.
 * Handles EOA ecrecover, ERC-1271, and ERC-6492 counterfactual signatures.
 *
 * @see https://github.com/AmbireAdEx/signature-validator
 */
export const SIGNATURE_VALIDATOR_ADDRESS = '0x7dd271fa79df3a5feb99f73bebfa4395b2e4f4be' as const;

/**
 * Minimal ABI for the Ambire UniversalSigValidator contract.
 * Only includes the `isValidSig` view function used for verification.
 */
export const signatureValidatorAbi = [
  {
    name: 'isValidSig',
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [
      { name: '_signer', type: 'address' as const },
      { name: '_hash', type: 'bytes32' as const },
      { name: '_signature', type: 'bytes' as const },
    ],
    outputs: [{ name: '', type: 'bool' as const }],
  },
] as const;

export interface ValidateSignatureParams {
  /** The address of the expected signer (EOA or smart contract). */
  signer: `0x${string}`;
  /** The hash that was signed (32 bytes). */
  hash: `0x${string}`;
  /** The signature bytes. */
  signature: `0x${string}`;
}

/**
 * Validates any signature (EOA, ERC-1271 smart contract, ERC-6492 pre-deploy)
 * using the Ambire universal signature validator singleton contract.
 *
 * @param client - A viem PublicClient to use for the contract read.
 * @param params - Signer address, hash, and signature bytes.
 * @returns A `SignatureValidationResult` indicating validity.
 */
export async function validateSignature(
  client: PublicClient,
  params: ValidateSignatureParams,
): Promise<SignatureValidationResult> {
  try {
    const isValid = await client.readContract({
      address: SIGNATURE_VALIDATOR_ADDRESS,
      abi: signatureValidatorAbi,
      functionName: 'isValidSig',
      args: [params.signer, params.hash, params.signature],
    });

    return { isValid: Boolean(isValid) };
  } catch {
    // Contract call reverted — treat as invalid signature.
    return { isValid: false };
  }
}

/**
 * Convenience wrapper for validating a Safe smart account signature.
 * Delegates to `validateSignature` with the Safe address as the signer.
 *
 * @param client      - A viem PublicClient.
 * @param safeAddress - The Safe contract address.
 * @param hash        - The hash that was signed.
 * @param signature   - The signature bytes.
 */
export async function validateSafeSignature(
  client: PublicClient,
  safeAddress: `0x${string}`,
  hash: `0x${string}`,
  signature: `0x${string}`,
): Promise<SignatureValidationResult> {
  return validateSignature(client, {
    signer: safeAddress,
    hash,
    signature,
  });
}
