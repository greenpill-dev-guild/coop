import { describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  createWebAuthnCredential: vi.fn(),
  toWebAuthnAccount: vi.fn((input) => ({
    type: 'webAuthnAccount',
    credential: input.credential,
    rpId: input.rpId,
  })),
}));

vi.mock('viem/account-abstraction', () => authMocks);

import {
  authSessionToLocalIdentity,
  createPasskeySession,
  restorePasskeyAccount,
  sessionToMember,
} from '../auth';

describe('auth session helpers', () => {
  it('creates a session from a supplied credential without prompting WebAuthn again', async () => {
    const session = await createPasskeySession({
      displayName: 'Mina',
      credential: {
        id: 'credential-1',
        publicKey: '0x1234abcd',
        rpId: 'coop.local',
      },
      rpId: 'coop.local',
    });

    expect(authMocks.createWebAuthnCredential).not.toHaveBeenCalled();
    expect(session.passkey?.id).toBe('credential-1');
    expect(session.primaryAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('restores a passkey account and projects the session into local identity/member records', () => {
    const session = {
      authMode: 'passkey' as const,
      displayName: 'Mina',
      primaryAddress: '0x1111111111111111111111111111111111111111',
      createdAt: new Date().toISOString(),
      identityWarning: 'Device bound.',
      passkey: {
        id: 'credential-1',
        publicKey: '0x1234abcd',
        rpId: 'coop.local',
      },
    };

    const account = restorePasskeyAccount(session);
    const identity = authSessionToLocalIdentity(session);
    const member = sessionToMember(session, 'Mina', 'member');

    expect(authMocks.toWebAuthnAccount).toHaveBeenCalledWith({
      credential: {
        id: 'credential-1',
        publicKey: '0x1234abcd',
      },
      rpId: 'coop.local',
    });
    expect(account).toMatchObject({ rpId: 'coop.local' });
    expect(identity?.id).toBe('identity-credential-1');
    expect(member.address).toBe(session.primaryAddress);
    expect(member.passkeyCredentialId).toBe('credential-1');
  });

  it('returns null or throws for incomplete passkey state', () => {
    const sessionWithoutPasskey = {
      authMode: 'passkey' as const,
      displayName: 'Mina',
      primaryAddress: '0x1111111111111111111111111111111111111111',
      createdAt: new Date().toISOString(),
      identityWarning: 'Device bound.',
    };

    expect(authSessionToLocalIdentity(sessionWithoutPasskey)).toBeNull();
    expect(() => restorePasskeyAccount(sessionWithoutPasskey)).toThrow(/no stored passkey/i);
  });
});
