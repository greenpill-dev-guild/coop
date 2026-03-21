import {
  type ToWebAuthnAccountParameters,
  createWebAuthnCredential,
  toWebAuthnAccount,
} from 'viem/account-abstraction';
import {
  type AuthSession,
  type LocalPasskeyIdentity,
  type Member,
  authSessionSchema,
  localPasskeyIdentitySchema,
} from '../../contracts/schema';
import { assertHexString, nowIso, toDeterministicAddress } from '../../utils';
import { createDeviceBoundWarning, createMember } from '../coop/flows';

type WebAuthnGetFn = ToWebAuthnAccountParameters['getFn'];

let webAuthnCredentialGetFnOverride: WebAuthnGetFn | null = null;

export function setWebAuthnCredentialGetFnOverride(getFn: WebAuthnGetFn | null) {
  webAuthnCredentialGetFnOverride = getFn;
}

export function createWebAuthnCredentialGetFn(): WebAuthnGetFn {
  if (webAuthnCredentialGetFnOverride) {
    return webAuthnCredentialGetFnOverride;
  }

  return async (options) => {
    const credentialContainer = globalThis.navigator?.credentials;
    if (!credentialContainer || typeof credentialContainer.get !== 'function') {
      throw new Error('WebAuthn credential retrieval is unavailable in this runtime.');
    }

    return credentialContainer.get.call(credentialContainer, options as CredentialRequestOptions);
  };
}

export function resolvePasskeyRpId(explicitRpId?: string) {
  if (explicitRpId) {
    return explicitRpId;
  }
  if (typeof location !== 'undefined' && location.hostname) {
    return location.hostname;
  }
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    return chrome.runtime.id;
  }
  throw new Error('Unable to determine the passkey RP ID in this environment.');
}

export function derivePasskeyAddress(input: { id: string; publicKey: string }) {
  return toDeterministicAddress(`passkey:${input.id}:${input.publicKey}`);
}

export async function createPasskeySession(input: {
  displayName: string;
  credential?: AuthSession['passkey'];
  rpId?: string;
}) {
  const rpId = resolvePasskeyRpId(input.rpId);
  const credential =
    input.credential ??
    (await createWebAuthnCredential({
      name: input.displayName,
      user: {
        name: input.displayName,
        displayName: input.displayName,
      },
      rp: {
        id: rpId,
        name: 'Coop',
      },
    }));

  return authSessionSchema.parse({
    authMode: 'passkey',
    displayName: input.displayName,
    primaryAddress: derivePasskeyAddress(credential),
    createdAt: nowIso(),
    identityWarning: createDeviceBoundWarning(input.displayName),
    passkey: {
      id: credential.id,
      publicKey: credential.publicKey,
      rpId,
    },
  });
}

export function restorePasskeyAccount(session: AuthSession) {
  if (!session.passkey) {
    throw new Error('No stored passkey credential is available.');
  }

  return toWebAuthnAccount({
    credential: {
      id: session.passkey.id,
      publicKey: assertHexString(session.passkey.publicKey, 'passkey publicKey'),
    },
    getFn: createWebAuthnCredentialGetFn(),
    rpId: session.passkey.rpId,
  });
}

export function authSessionToLocalIdentity(session: AuthSession): LocalPasskeyIdentity | null {
  if (!session.passkey) {
    return null;
  }

  return localPasskeyIdentitySchema.parse({
    id: `identity-${session.passkey.id}`,
    displayName: session.displayName,
    ownerAddress: session.primaryAddress,
    createdAt: session.createdAt,
    lastUsedAt: nowIso(),
    identityWarning: session.identityWarning,
    passkey: session.passkey,
  });
}

export function sessionToMember(session: AuthSession, displayName: string, role: Member['role']) {
  return createMember(displayName, role, {
    address: session.primaryAddress,
    authMode: session.authMode,
    identityWarning: session.identityWarning,
    passkeyCredentialId: session.passkey?.id,
  });
}
