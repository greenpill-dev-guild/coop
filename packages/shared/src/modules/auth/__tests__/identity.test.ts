import { beforeEach, describe, expect, it, vi } from 'vitest';

const accountMocks = vi.hoisted(() => ({
  createWebAuthnCredential: vi.fn(),
  toWebAuthnAccount: vi.fn(),
}));

vi.mock('viem/account-abstraction', () => ({
  createWebAuthnCredential: accountMocks.createWebAuthnCredential,
  toWebAuthnAccount: accountMocks.toWebAuthnAccount,
}));

import {
  createLivePasskeyIdentity,
  createMockPasskeyIdentity,
  derivePasskeyRpId,
  ensurePasskeyIdentity,
  rehydratePasskeyOwner,
  touchLocalIdentity,
} from '../identity';

describe('passkey identity helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountMocks.toWebAuthnAccount.mockReturnValue({
      address: '0x1111111111111111111111111111111111111111',
    });
  });

  it('resolves the RP id from explicit input or the active window host', () => {
    expect(derivePasskeyRpId('coop.custom')).toBe('coop.custom');
    expect(derivePasskeyRpId()).toBe(window.location.hostname);
  });

  it('touches and rehydrates existing passkey identities', () => {
    const { record } = createMockPasskeyIdentity('Mina');
    const touched = touchLocalIdentity(record);
    const owner = rehydratePasskeyOwner(record, 'coop.override');

    expect(new Date(touched.lastUsedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(record.lastUsedAt).getTime(),
    );
    expect(accountMocks.toWebAuthnAccount).toHaveBeenCalledWith({
      credential: {
        id: record.passkey.id,
        publicKey: record.passkey.publicKey,
      },
      rpId: 'coop.override',
    });
    expect(owner).toEqual({
      address: '0x1111111111111111111111111111111111111111',
    });
  });

  it('creates live identities from browser passkey material', async () => {
    accountMocks.createWebAuthnCredential.mockResolvedValue({
      id: 'credential-1',
      publicKey: '0x1234abcd',
    });

    const result = await createLivePasskeyIdentity({
      displayName: 'Ari',
      rpId: 'coop.local',
    });

    expect(accountMocks.createWebAuthnCredential).toHaveBeenCalledWith({
      name: 'Ari',
      user: {
        name: 'Ari',
        displayName: 'Ari',
      },
      rp: {
        id: 'coop.local',
        name: 'Coop',
      },
    });
    expect(result.record.displayName).toBe('Ari');
    expect(result.record.passkey.id).toBe('credential-1');
    expect(result.record.ownerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(result.owner).toEqual({
      address: '0x1111111111111111111111111111111111111111',
    });
  });

  it('reuses existing identities and creates mock identities when requested', async () => {
    const existing = createMockPasskeyIdentity('Mina').record;

    const reused = await ensurePasskeyIdentity({
      displayName: 'Mina',
      existing: [existing],
      rpId: 'coop.local',
    });
    const created = await ensurePasskeyIdentity({
      displayName: 'Kai',
      mock: true,
    });

    expect(reused.record.displayName).toBe('Mina');
    expect(reused.owner).toEqual({
      address: '0x1111111111111111111111111111111111111111',
    });
    expect(created.record.displayName).toBe('Kai');
    expect(created.record.passkey.rpId).toBe('mock.coop.local');
  });
});
