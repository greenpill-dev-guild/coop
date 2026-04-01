const { createHash } = require('node:crypto');

function identityWarning(displayName) {
  return `${displayName}'s passkey is stored on this device profile. Clearing extension data may remove access to this account.`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function digestHex(prefix, seed) {
  return createHash('sha256').update(`${prefix}:${seed}`).digest('hex');
}

function buildMockPasskeyCredential(input = {}) {
  const seed =
    typeof input === 'string'
      ? input
      : (input.address ?? input.displayName ?? input.passkeyCredentialId ?? 'coop-e2e-passkey');
  const digest = digestHex('mock-passkey', seed);
  return {
    id:
      typeof input === 'object' && input.passkeyCredentialId
        ? input.passkeyCredentialId
        : `passkey-${slugify(seed)}`,
    publicKey: `0x${digest}${digest}`,
    rpId: typeof input === 'object' && input.rpId ? input.rpId : 'mock.coop.local',
  };
}

function buildMockAddress(seed) {
  return `0x${digestHex('mock-address', seed).slice(0, 40)}`;
}

function createMockMemberIdentity(input = {}) {
  const displayName = input.displayName ?? 'Ari';
  const passkey = buildMockPasskeyCredential(input);
  const member = {
    id: input.id ?? `member-${slugify(`${displayName}-${passkey.id}`)}`,
    displayName,
    role: input.role ?? 'creator',
    authMode: input.authMode ?? 'passkey',
    address: input.address ?? buildMockAddress(`${displayName}:${passkey.id}`),
    joinedAt: input.joinedAt ?? new Date().toISOString(),
    identityWarning: input.identityWarning ?? identityWarning(displayName),
    passkeyCredentialId: input.passkeyCredentialId ?? passkey.id,
  };

  return {
    member,
    session: {
      authMode: member.authMode,
      createdAt: input.createdAt ?? new Date().toISOString(),
      displayName: member.displayName,
      identityWarning: member.identityWarning,
      primaryAddress: member.address,
      passkey: {
        ...passkey,
        id: member.passkeyCredentialId,
      },
    },
  };
}

module.exports = {
  createMockMemberIdentity,
};
