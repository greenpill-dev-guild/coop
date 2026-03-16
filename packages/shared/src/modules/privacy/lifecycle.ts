/**
 * Privacy lifecycle orchestration.
 *
 * Wires privacy identity and stealth key creation into
 * coop lifecycle events (create-coop, join-coop).
 */

import { createId, nowIso } from '../../utils';
import { computeStealthMetaAddress, generateStealthKeys } from '../stealth/stealth';
import {
  type CoopDexie,
  getPrivacyIdentity,
  savePrivacyIdentity,
  saveStealthKeyPair,
} from '../storage/db';
import { createPrivacyIdentity } from './membership';

/**
 * Initialize privacy primitives when a coop is created.
 * Generates a Semaphore identity for the creator and stealth keys for the coop.
 * Called from background.ts after create-coop.
 */
export async function initializeCoopPrivacy(
  db: CoopDexie,
  input: { coopId: string; memberId: string },
) {
  const identity = createPrivacyIdentity();
  await savePrivacyIdentity(db, {
    id: createId('privacy-id'),
    coopId: input.coopId,
    memberId: input.memberId,
    commitment: identity.commitment,
    publicKey: identity.publicKey,
    exportedPrivateKey: identity.exportedPrivateKey,
    createdAt: nowIso(),
  });

  const stealthKeys = generateStealthKeys();
  const metaAddress = computeStealthMetaAddress(stealthKeys);
  await saveStealthKeyPair(db, {
    id: createId('stealth-kp'),
    coopId: input.coopId,
    spendingKey: stealthKeys.spendingKey,
    viewingKey: stealthKeys.viewingKey,
    spendingPublicKey: stealthKeys.spendingPublicKey,
    viewingPublicKey: stealthKeys.viewingPublicKey,
    metaAddress,
    createdAt: nowIso(),
  });

  return { identity, stealthKeys, metaAddress };
}

/**
 * Initialize privacy identity when a member joins a coop.
 * Idempotent — returns existing record if one already exists.
 * Called from background.ts after join-coop.
 */
export async function initializeMemberPrivacy(
  db: CoopDexie,
  input: { coopId: string; memberId: string },
) {
  const existing = await getPrivacyIdentity(db, input.coopId, input.memberId);
  if (existing) return existing;

  const identity = createPrivacyIdentity();
  const record = {
    id: createId('privacy-id'),
    coopId: input.coopId,
    memberId: input.memberId,
    commitment: identity.commitment,
    publicKey: identity.publicKey,
    exportedPrivateKey: identity.exportedPrivateKey,
    createdAt: nowIso(),
  };
  await savePrivacyIdentity(db, record);
  return record;
}
