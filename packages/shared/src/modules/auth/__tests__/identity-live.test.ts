import { describe, expect, it, vi } from 'vitest';

const identityMocks = vi.hoisted(() => ({
  createWebAuthnCredential: vi.fn(async () => ({
    id: 'credential-live',
    publicKey: '0xabcdef12',
  })),
  toWebAuthnAccount: vi.fn((input) => ({
    type: 'webAuthnAccount',
    credential: input.credential,
    rpId: input.rpId,
  })),
}));

vi.mock('viem/account-abstraction', () => identityMocks);

import {
  createLivePasskeyIdentity,
  ensurePasskeyIdentity,
  rehydratePasskeyOwner,
} from '../identity';

describe('live identity helpers', () => {
  it('creates a live passkey identity record and owner', async () => {
    const result = await createLivePasskeyIdentity({
      displayName: 'Ari',
      rpId: 'coop.local',
    });

    expect(identityMocks.createWebAuthnCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        rp: {
          id: 'coop.local',
          name: 'Coop',
        },
      }),
    );
    expect(result.record.displayName).toBe('Ari');
    expect(result.record.ownerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(result.owner).toMatchObject({ rpId: 'coop.local' });
  });

  it('rehydrates existing identities and supports mock identity fallback', async () => {
    const existing = {
      id: 'identity-1',
      displayName: 'Ari',
      ownerAddress: '0x1111111111111111111111111111111111111111',
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date(0).toISOString(),
      identityWarning: 'Device bound.',
      passkey: {
        id: 'credential-1',
        publicKey: '0x1234abcd',
        rpId: 'coop.local',
      },
    };

    const reused = await ensurePasskeyIdentity({
      displayName: 'Ari',
      existing: [existing],
      rpId: 'coop.local',
    });
    const mocked = await ensurePasskeyIdentity({
      displayName: 'Kai',
      mock: true,
    });

    expect(rehydratePasskeyOwner(existing)).toMatchObject({ rpId: 'coop.local' });
    expect(identityMocks.toWebAuthnAccount).toHaveBeenCalled();
    expect(new Date(reused.record.lastUsedAt).getTime()).toBeGreaterThan(
      new Date(existing.lastUsedAt).getTime(),
    );
    expect(mocked.record.passkey.rpId).toBe('mock.coop.local');
  });
});
