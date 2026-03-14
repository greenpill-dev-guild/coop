import { describe, expect, it } from 'vitest';
import {
  stealthAddressSchema,
  stealthAnnouncementSchema,
  stealthKeysSchema,
  stealthMetaAddressSchema,
} from '../../../contracts/schema';
import {
  checkStealthAddress,
  computeStealthMetaAddress,
  computeStealthPrivateKey,
  generateStealthAddress,
  generateStealthKeys,
  prepareStealthAnnouncement,
} from '../stealth';

describe('stealth address module', () => {
  describe('schema validation', () => {
    it('validates well-formed stealth keys', () => {
      const keys = generateStealthKeys();
      expect(() => stealthKeysSchema.parse(keys)).not.toThrow();
    });

    it('rejects malformed stealth keys', () => {
      expect(() =>
        stealthKeysSchema.parse({
          spendingKey: 'not-hex',
          viewingKey: '0x1234',
          spendingPublicKey: '0xabc',
          viewingPublicKey: '0xdef',
        }),
      ).toThrow();
    });

    it('validates well-formed stealth meta-address', () => {
      const keys = generateStealthKeys();
      const metaAddress = computeStealthMetaAddress(keys);
      expect(() => stealthMetaAddressSchema.parse(metaAddress)).not.toThrow();
    });

    it('rejects stealth meta-address that is too short', () => {
      expect(() => stealthMetaAddressSchema.parse('0x1234')).toThrow();
    });

    it('validates well-formed stealth address result', () => {
      const keys = generateStealthKeys();
      const metaAddress = computeStealthMetaAddress(keys);
      const result = generateStealthAddress(metaAddress);
      expect(() => stealthAddressSchema.parse(result)).not.toThrow();
    });

    it('validates well-formed stealth announcement', () => {
      const keys = generateStealthKeys();
      const metaAddress = computeStealthMetaAddress(keys);
      const result = generateStealthAddress(metaAddress);
      const announcement = prepareStealthAnnouncement({
        stealthAddress: result.stealthAddress,
        ephemeralPublicKey: result.ephemeralPublicKey,
        viewTag: result.viewTag,
      });
      expect(() => stealthAnnouncementSchema.parse(announcement)).not.toThrow();
    });
  });

  describe('generateStealthKeys', () => {
    it('generates valid spending and viewing key pairs', () => {
      const keys = generateStealthKeys();
      expect(keys.spendingKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(keys.viewingKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(keys.spendingPublicKey).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(keys.viewingPublicKey).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('generates unique key pairs on each call', () => {
      const keys1 = generateStealthKeys();
      const keys2 = generateStealthKeys();
      expect(keys1.spendingKey).not.toBe(keys2.spendingKey);
      expect(keys1.viewingKey).not.toBe(keys2.viewingKey);
    });
  });

  describe('computeStealthMetaAddress', () => {
    it('derives a deterministic meta-address from keys', () => {
      const keys = generateStealthKeys();
      const meta1 = computeStealthMetaAddress(keys);
      const meta2 = computeStealthMetaAddress(keys);
      expect(meta1).toBe(meta2);
    });

    it('returns a hex string long enough to encode both public keys', () => {
      const keys = generateStealthKeys();
      const meta = computeStealthMetaAddress(keys);
      expect(meta).toMatch(/^0x[a-fA-F0-9]+$/);
      // Two compressed public keys (33 bytes each) = 66 hex chars each = 132 hex chars + 0x prefix = 134
      expect(meta.length).toBeGreaterThanOrEqual(134);
    });
  });

  describe('generateStealthAddress', () => {
    it('produces a valid stealth address, ephemeral public key, and view tag', () => {
      const keys = generateStealthKeys();
      const metaAddress = computeStealthMetaAddress(keys);
      const result = generateStealthAddress(metaAddress);

      expect(result.stealthAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.ephemeralPublicKey).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(result.viewTag).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('generates different stealth addresses for the same meta-address', () => {
      const keys = generateStealthKeys();
      const metaAddress = computeStealthMetaAddress(keys);
      const result1 = generateStealthAddress(metaAddress);
      const result2 = generateStealthAddress(metaAddress);

      expect(result1.stealthAddress).not.toBe(result2.stealthAddress);
      expect(result1.ephemeralPublicKey).not.toBe(result2.ephemeralPublicKey);
    });
  });

  describe('checkStealthAddress (round-trip)', () => {
    it('confirms ownership of a generated stealth address', () => {
      const keys = generateStealthKeys();
      const metaAddress = computeStealthMetaAddress(keys);
      const result = generateStealthAddress(metaAddress);

      const isOwner = checkStealthAddress({
        stealthAddress: result.stealthAddress,
        ephemeralPublicKey: result.ephemeralPublicKey,
        viewTag: result.viewTag,
        spendingPublicKey: keys.spendingPublicKey,
        viewingPrivateKey: keys.viewingKey,
      });

      expect(isOwner).toBe(true);
    });

    it('rejects a stealth address that does not belong to the keys', () => {
      const keys1 = generateStealthKeys();
      const keys2 = generateStealthKeys();
      const metaAddress1 = computeStealthMetaAddress(keys1);
      const result = generateStealthAddress(metaAddress1);

      const isOwner = checkStealthAddress({
        stealthAddress: result.stealthAddress,
        ephemeralPublicKey: result.ephemeralPublicKey,
        viewTag: result.viewTag,
        spendingPublicKey: keys2.spendingPublicKey,
        viewingPrivateKey: keys2.viewingKey,
      });

      expect(isOwner).toBe(false);
    });
  });

  describe('prepareStealthAnnouncement', () => {
    it('produces a valid announcement with schemeId 1', () => {
      const keys = generateStealthKeys();
      const metaAddress = computeStealthMetaAddress(keys);
      const result = generateStealthAddress(metaAddress);

      const announcement = prepareStealthAnnouncement({
        stealthAddress: result.stealthAddress,
        ephemeralPublicKey: result.ephemeralPublicKey,
        viewTag: result.viewTag,
      });

      expect(announcement.schemeId).toBe(1);
      expect(announcement.stealthAddress).toBe(result.stealthAddress);
      expect(announcement.ephemeralPublicKey).toBe(result.ephemeralPublicKey);
      expect(announcement.metadata).toMatch(/^0x[a-fA-F0-9]*$/);
    });
  });

  describe('computeStealthPrivateKey', () => {
    it('derives a private key that corresponds to the stealth address', () => {
      const keys = generateStealthKeys();
      const metaAddress = computeStealthMetaAddress(keys);
      const result = generateStealthAddress(metaAddress);

      const stealthPrivateKey = computeStealthPrivateKey({
        spendingPrivateKey: keys.spendingKey,
        viewingPrivateKey: keys.viewingKey,
        ephemeralPublicKey: result.ephemeralPublicKey,
      });

      expect(stealthPrivateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('produces different private keys for different stealth addresses', () => {
      const keys = generateStealthKeys();
      const metaAddress = computeStealthMetaAddress(keys);
      const result1 = generateStealthAddress(metaAddress);
      const result2 = generateStealthAddress(metaAddress);

      const pk1 = computeStealthPrivateKey({
        spendingPrivateKey: keys.spendingKey,
        viewingPrivateKey: keys.viewingKey,
        ephemeralPublicKey: result1.ephemeralPublicKey,
      });
      const pk2 = computeStealthPrivateKey({
        spendingPrivateKey: keys.spendingKey,
        viewingPrivateKey: keys.viewingKey,
        ephemeralPublicKey: result2.ephemeralPublicKey,
      });

      expect(pk1).not.toBe(pk2);
    });
  });
});
