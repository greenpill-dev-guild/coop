import { Identity } from '@semaphore-protocol/core';
import type { MembershipProof } from '../../contracts/schema';
import { type CoopDexie, getPrivacyIdentitiesForCoop, getPrivacyIdentity } from '../storage/db';
import { createMembershipGroup, generateMembershipProof } from './membership';

/**
 * Generate a Semaphore membership proof for anonymous publishing.
 *
 * The proof proves "I am a member of this coop" without revealing which member.
 * - `message` is the artifact origin ID (ties the proof to a specific publish action)
 * - `scope` is the coop ID (prevents proof reuse across coops)
 *
 * Returns null if proof generation fails (missing identity, not enough members, etc.)
 */
export async function generateAnonymousPublishProof(
  db: CoopDexie,
  input: { coopId: string; memberId: string; artifactOriginId: string },
): Promise<MembershipProof | null> {
  // 1. Get this member's privacy identity
  const identityRecord = await getPrivacyIdentity(db, input.coopId, input.memberId);
  if (!identityRecord) return null;

  // 2. Get all member commitments for the coop
  const allIdentities = await getPrivacyIdentitiesForCoop(db, input.coopId);
  const commitments = allIdentities.map((id) => id.commitment);
  if (commitments.length === 0) return null;

  // 3. Reconstruct the Semaphore Identity from the stored export
  const identity = Identity.import(identityRecord.exportedPrivateKey);

  // 4. Create the group from all member commitments
  const { group } = createMembershipGroup(commitments);

  // 5. Generate the ZK proof
  const proof = await generateMembershipProof(
    identity,
    group,
    input.artifactOriginId, // message -- ties proof to this specific publish
    input.coopId, // scope -- prevents cross-coop replay
  );

  return proof;
}
