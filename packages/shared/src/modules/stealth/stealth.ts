import { Secp256k1 } from 'ox';
import {
  bytesToHex,
  hexToBytes,
  keccak256,
  publicKeyToAddress as viemPublicKeyToAddress,
} from 'viem/utils';
import {
  type StealthAddress,
  type StealthAnnouncement,
  type StealthKeys,
  type StealthMetaAddress,
  stealthAddressSchema,
  stealthAnnouncementSchema,
  stealthKeysSchema,
  stealthMetaAddressSchema,
} from '../../contracts/schema';

/**
 * ERC-5564 scheme 1: secp256k1 with view tags.
 *
 * All functions are pure cryptographic operations -- no network access required.
 * Implements the core stealth address primitives:
 *   stealth_address = G * (spending_key + hash(shared_secret))
 */

// ── Curve primitives (via ox → @noble/curves/secp256k1) ─────────────

const secp = Secp256k1.noble;
const Point = secp.ProjectivePoint;

function mod(a: bigint, b: bigint): bigint {
  const result = a % b;
  return result >= 0n ? result : result + b;
}

// ── Internal helpers ────────────────────────────────────────────────

type HexString = `0x${string}`;

function randomPrivateKey(): Uint8Array {
  return secp.utils.randomPrivateKey();
}

function compressedPublicKeyFromPrivate(privateKey: Uint8Array): Uint8Array {
  return secp.getPublicKey(privateKey, true);
}

function computeSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return secp.getSharedSecret(privateKey, publicKey);
}

function hashSharedSecret(sharedSecret: Uint8Array): HexString {
  return keccak256(sharedSecret) as HexString;
}

function extractViewTag(hashedSharedSecret: HexString): HexString {
  // View tag is the first byte of the hashed shared secret (per ERC-5564)
  return `0x${hashedSharedSecret.substring(2, 4)}` as HexString;
}

function hexToScalar(hex: HexString): bigint {
  return BigInt(hex);
}

function computeStealthPublicKey(
  spendingPublicKey: Uint8Array,
  hashedSharedSecret: HexString,
): Uint8Array {
  // hash(shared_secret) * G -- use scalar multiplication directly to avoid byte-length issues
  const hashedSecretScalar = hexToScalar(hashedSharedSecret);
  const hashedSecretPoint = Point.BASE.multiply(hashedSecretScalar);
  const spendingPoint = Point.fromHex(spendingPublicKey);
  // Stealth public key = spending_public_key + hash(shared_secret) * G
  return spendingPoint.add(hashedSecretPoint).toRawBytes(false); // uncompressed for address derivation
}

function publicKeyToAddress(uncompressedPublicKey: Uint8Array): HexString {
  return viemPublicKeyToAddress(bytesToHex(uncompressedPublicKey)) as HexString;
}

function parseMetaAddressKeys(metaAddress: string): {
  spendingPublicKey: Uint8Array;
  viewingPublicKey: Uint8Array;
} {
  const cleanHex = metaAddress.startsWith('0x') ? metaAddress.slice(2) : metaAddress;
  // Each compressed public key is 33 bytes = 66 hex chars
  const spendingHex = cleanHex.slice(0, 66);
  const viewingHex = cleanHex.length >= 132 ? cleanHex.slice(66, 132) : spendingHex;
  return {
    spendingPublicKey: Point.fromHex(spendingHex).toRawBytes(true),
    viewingPublicKey: Point.fromHex(viewingHex).toRawBytes(true),
  };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Generate a new spending/viewing key pair for stealth address usage (ERC-5564).
 * Pure cryptographic operation -- no network access required.
 */
export function generateStealthKeys(): StealthKeys {
  const spendingKey = randomPrivateKey();
  const viewingKey = randomPrivateKey();
  const spendingPublicKey = compressedPublicKeyFromPrivate(spendingKey);
  const viewingPublicKey = compressedPublicKeyFromPrivate(viewingKey);

  return stealthKeysSchema.parse({
    spendingKey: bytesToHex(spendingKey),
    viewingKey: bytesToHex(viewingKey),
    spendingPublicKey: bytesToHex(spendingPublicKey),
    viewingPublicKey: bytesToHex(viewingPublicKey),
  });
}

/**
 * Derive the stealth meta-address from a spending/viewing key pair.
 * The meta-address is what gets published so senders can generate one-time addresses.
 */
export function computeStealthMetaAddress(keys: StealthKeys): StealthMetaAddress {
  // Meta-address = concatenation of spending and viewing compressed public keys
  const spendingHex = keys.spendingPublicKey.slice(2);
  const viewingHex = keys.viewingPublicKey.slice(2);
  const metaAddress = `0x${spendingHex}${viewingHex}` as HexString;
  return stealthMetaAddressSchema.parse(metaAddress);
}

/**
 * Generate a one-time stealth address for a recipient identified by their meta-address.
 * Each call produces a unique address using a fresh ephemeral key.
 */
export function generateStealthAddress(metaAddress: StealthMetaAddress): StealthAddress {
  const { spendingPublicKey, viewingPublicKey } = parseMetaAddressKeys(metaAddress);

  // Generate ephemeral key pair
  const ephemeralPrivateKey = randomPrivateKey();
  const ephemeralPublicKey = compressedPublicKeyFromPrivate(ephemeralPrivateKey);

  // Compute shared secret: ECDH(ephemeral_private, viewing_public)
  const sharedSecret = computeSharedSecret(ephemeralPrivateKey, viewingPublicKey);
  const hashedSharedSecret = hashSharedSecret(sharedSecret);

  // View tag for fast filtering
  const viewTag = extractViewTag(hashedSharedSecret);

  // Stealth public key = spending_public + hash(shared_secret) * G
  const stealthPublicKey = computeStealthPublicKey(spendingPublicKey, hashedSharedSecret);
  const stealthAddress = publicKeyToAddress(stealthPublicKey);

  return stealthAddressSchema.parse({
    stealthAddress,
    ephemeralPublicKey: bytesToHex(ephemeralPublicKey),
    viewTag,
  });
}

/**
 * Check if a stealth address belongs to a given set of keys (for scanning announcements).
 * Uses the view tag for fast filtering, then verifies the full address derivation.
 */
export function checkStealthAddress(params: {
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: string;
  spendingPublicKey: string;
  viewingPrivateKey: string;
}): boolean {
  const viewingPrivateKeyBytes = hexToBytes(params.viewingPrivateKey as HexString);
  const ephemeralPublicKeyBytes = hexToBytes(params.ephemeralPublicKey as HexString);
  const spendingPublicKeyBytes = hexToBytes(params.spendingPublicKey as HexString);

  // Compute shared secret: ECDH(viewing_private, ephemeral_public)
  const sharedSecret = computeSharedSecret(viewingPrivateKeyBytes, ephemeralPublicKeyBytes);
  const hashedSharedSecret = hashSharedSecret(sharedSecret);

  // Fast check: compare view tags
  const computedViewTag = extractViewTag(hashedSharedSecret);
  if (computedViewTag !== params.viewTag) {
    return false;
  }

  // Full check: derive stealth address and compare
  const stealthPublicKey = computeStealthPublicKey(spendingPublicKeyBytes, hashedSharedSecret);
  const derivedAddress = publicKeyToAddress(stealthPublicKey);

  return derivedAddress.toLowerCase() === params.stealthAddress.toLowerCase();
}

/**
 * Prepare announcement data for on-chain ERC-5564 Announcer event.
 * The metadata field encodes the view tag per the ERC-5564 spec.
 */
export function prepareStealthAnnouncement(params: {
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: string;
}): StealthAnnouncement {
  return stealthAnnouncementSchema.parse({
    schemeId: 1,
    stealthAddress: params.stealthAddress,
    ephemeralPublicKey: params.ephemeralPublicKey,
    metadata: params.viewTag,
  });
}

/**
 * Compute the private key needed to spend from a stealth address.
 * Requires the recipient's spending and viewing private keys plus the ephemeral public key
 * from the announcement.
 *
 * stealth_private_key = spending_private_key + hash(ECDH(viewing_private, ephemeral_public))
 */
export function computeStealthPrivateKey(params: {
  spendingPrivateKey: string;
  viewingPrivateKey: string;
  ephemeralPublicKey: string;
}): string {
  const viewingPrivateKeyBytes = hexToBytes(params.viewingPrivateKey as HexString);
  const ephemeralPublicKeyBytes = hexToBytes(params.ephemeralPublicKey as HexString);

  // Compute shared secret: ECDH(viewing_private, ephemeral_public)
  const sharedSecret = computeSharedSecret(viewingPrivateKeyBytes, ephemeralPublicKeyBytes);
  const hashedSharedSecret = hashSharedSecret(sharedSecret);

  // stealth_private = spending_private + hash(shared_secret) mod n
  const spendingPrivateKeyBigInt = BigInt(params.spendingPrivateKey);
  const hashedSecretBigInt = BigInt(hashedSharedSecret);
  const curveOrder = secp.CURVE.n;
  const stealthPrivateKeyBigInt = mod(spendingPrivateKeyBigInt + hashedSecretBigInt, curveOrder);

  return `0x${stealthPrivateKeyBigInt.toString(16).padStart(64, '0')}`;
}
