import { type Group, type Identity, generateProof, verifyProof } from '@semaphore-protocol/core';
import type { MembershipProof } from '../../contracts/schema';

/**
 * Generates a zero-knowledge Semaphore proof that an identity
 * is a member of a group, without revealing which member.
 */
export async function generateMembershipProof(
  identity: unknown,
  group: unknown,
  message: string,
  scope: string,
): Promise<MembershipProof> {
  const proof = await generateProof(identity as Identity, group as Group, message, scope);
  return proof as unknown as MembershipProof;
}

/**
 * Verifies a Semaphore membership proof.
 * Returns true if the proof is cryptographically valid.
 */
export async function verifyMembershipProof(proof: MembershipProof): Promise<boolean> {
  return verifyProof(proof as unknown as Parameters<typeof verifyProof>[0]);
}
