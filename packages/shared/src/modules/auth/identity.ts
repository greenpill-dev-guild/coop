import {
  type WebAuthnAccount,
  createWebAuthnCredential,
  toWebAuthnAccount,
} from 'viem/account-abstraction';
import { type LocalPasskeyIdentity, localPasskeyIdentitySchema } from '../../contracts/schema';
import { assertHexString, createId, hashText, nowIso, toDeterministicAddress } from '../../utils';
import { createDeviceBoundWarning } from '../coop/flows';

export function derivePasskeyRpId(explicitRpId?: string) {
  if (explicitRpId) {
    return explicitRpId;
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'coop.local';
}

export function touchLocalIdentity(identity: LocalPasskeyIdentity) {
  return localPasskeyIdentitySchema.parse({
    ...identity,
    lastUsedAt: nowIso(),
  });
}

export function rehydratePasskeyOwner(
  identity: LocalPasskeyIdentity,
  rpId = identity.passkey.rpId,
) {
  return toWebAuthnAccount({
    credential: {
      id: identity.passkey.id,
      publicKey: assertHexString(identity.passkey.publicKey, 'passkey publicKey'),
    },
    rpId,
  });
}

export async function createLivePasskeyIdentity(input: {
  displayName: string;
  rpId?: string;
}): Promise<{ record: LocalPasskeyIdentity; owner: WebAuthnAccount }> {
  const rpId = derivePasskeyRpId(input.rpId);
  const credential = await createWebAuthnCredential({
    name: input.displayName,
    user: {
      name: input.displayName,
      displayName: input.displayName,
    },
    rp: {
      id: rpId,
      name: 'Coop',
    },
  });
  const owner = toWebAuthnAccount({
    credential: {
      id: credential.id,
      publicKey: assertHexString(credential.publicKey, 'passkey publicKey'),
    },
    rpId,
  });
  const ownerAddress = toDeterministicAddress(`passkey:${credential.id}:${credential.publicKey}`);
  const createdAt = nowIso();
  const record = localPasskeyIdentitySchema.parse({
    id: createId('identity'),
    displayName: input.displayName,
    ownerAddress,
    createdAt,
    lastUsedAt: createdAt,
    identityWarning: createDeviceBoundWarning(input.displayName),
    passkey: {
      id: credential.id,
      publicKey: credential.publicKey,
      rpId,
    },
  });

  return { record, owner };
}

export function createMockPasskeyIdentity(displayName: string) {
  const createdAt = nowIso();
  const record = localPasskeyIdentitySchema.parse({
    id: createId('identity'),
    displayName,
    ownerAddress: toDeterministicAddress(`mock-owner:${displayName}`),
    createdAt,
    lastUsedAt: createdAt,
    identityWarning: createDeviceBoundWarning(displayName),
    passkey: {
      id: createId('passkey'),
      publicKey: hashText(`mock-passkey:${displayName}`),
      rpId: 'mock.coop.local',
    },
  });

  return {
    record,
  };
}

export async function ensurePasskeyIdentity(input: {
  displayName: string;
  existing?: LocalPasskeyIdentity[];
  mock?: boolean;
  rpId?: string;
}): Promise<{ record: LocalPasskeyIdentity; owner?: WebAuthnAccount }> {
  const existing = [...(input.existing ?? [])]
    .reverse()
    .find((identity) => identity.displayName === input.displayName);

  if (existing) {
    const record = touchLocalIdentity(existing);
    return {
      record,
      owner: input.mock ? undefined : rehydratePasskeyOwner(record, input.rpId),
    };
  }

  if (input.mock) {
    return createMockPasskeyIdentity(input.displayName);
  }

  return createLivePasskeyIdentity({
    displayName: input.displayName,
    rpId: input.rpId,
  });
}
