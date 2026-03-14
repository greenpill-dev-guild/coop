import { Group, Identity, generateProof, verifyProof } from '@semaphore-protocol/core';
import type { MembershipProof, PrivacyIdentity } from '../../contracts/schema';
import { createId } from '../../utils';

/**
 * Creates a new Semaphore v4 identity with a random private key.
 * Returns a serializable representation suitable for storage.
 */
export function createPrivacyIdentity(): PrivacyIdentity {
  const identity = new Identity();
  return serializeIdentity(identity);
}

/**
 * Restores a Semaphore v4 identity from a secret message string.
 * The secret is used as the deterministic private key seed.
 */
export function restorePrivacyIdentity(secretMessage: string): PrivacyIdentity {
  if (!secretMessage) {
    throw new Error('secretMessage must be a non-empty string');
  }
  const identity = new Identity(secretMessage);
  return serializeIdentity(identity);
}

/**
 * Creates an off-chain Semaphore Group from member identity commitments.
 * Returns both the Group instance (for proof generation) and serializable metadata.
 */
export function createMembershipGroup(members: string[]) {
  if (members.length === 0) {
    throw new Error('members must contain at least one commitment');
  }

  const bigintMembers = members.map((m) => BigInt(m));
  const group = new Group(bigintMembers);

  return {
    group,
    metadata: {
      id: createId('privacy-group'),
      memberCount: group.size,
      merkleRoot: group.root.toString(),
    },
  };
}

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

function serializeIdentity(identity: Identity): PrivacyIdentity {
  return {
    commitment: identity.commitment.toString(),
    publicKey: [identity.publicKey[0].toString(), identity.publicKey[1].toString()],
    exportedPrivateKey: identity.export(),
  };
}
