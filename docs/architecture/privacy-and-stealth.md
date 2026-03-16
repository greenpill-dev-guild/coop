---
title: "Privacy & Stealth Addresses"
sidebar_label: "Privacy & Stealth"
sidebar_position: 5
---

# Privacy & Stealth Addresses

Coop provides two complementary privacy primitives: **zero-knowledge group membership proofs** (Semaphore v4) for anonymous coop participation, and **stealth addresses** (ERC-5564) for private on-chain interactions. Both run entirely in the browser with no server-side computation.

The privacy module answers "prove you belong without revealing who you are." The stealth module answers "receive funds without linking the payment to your identity." Together they let coop members publish anonymously, receive donations privately, and participate in governance without exposing their on-chain address graph.

## Architecture Overview

```
                        ┌───────────────────────────┐
                        │   Coop Lifecycle Events    │
                        │  (create-coop, join-coop)  │
                        └────────────┬──────────────┘
                                     │
                          initializeCoopPrivacy()
                          initializeMemberPrivacy()
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                                  ▼
        ┌───────────────────┐              ┌───────────────────┐
        │  Privacy Module   │              │  Stealth Module   │
        │  (Semaphore v4)   │              │  (ERC-5564)       │
        │                   │              │                   │
        │  Identity         │              │  Key generation   │
        │  Group membership │              │  Meta-address     │
        │  ZK proofs        │              │  Address compute  │
        │  Anonymous publish│              │  View tag scan    │
        └────────┬──────────┘              └────────┬──────────┘
                 │                                  │
                 └──────────────┬───────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Dexie (IndexedDB)   │
                    │                       │
                    │  privacyIdentities    │
                    │  stealthKeyPairs      │
                    └───────────────────────┘
```

## Privacy Module (Semaphore v4)

### Purpose

The privacy module enables coop members to prove group membership without revealing which member they are. This is the foundation for anonymous publishing: a member can attach a zero-knowledge proof to a published artifact that says "a member of this coop endorsed this" without disclosing their identity.

Built on [Semaphore v4](https://semaphore.pse.dev/), which provides Groth16 ZK-SNARK proofs over Merkle tree membership. All proof generation and verification runs in-browser via WASM.

### Identity

Each coop member gets a Semaphore identity scoped to each coop they belong to. The identity consists of:

- **commitment**: A public value derived from the private key, used as the member's leaf in the Merkle tree. Safe to share.
- **publicKey**: A pair of field elements representing the EdDSA public key.
- **exportedPrivateKey**: Base64-encoded private key material, stored encrypted in IndexedDB.

```typescript
function createPrivacyIdentity(): PrivacyIdentity
function restorePrivacyIdentity(secretMessage: string): PrivacyIdentity
```

`createPrivacyIdentity` generates a fresh random identity. `restorePrivacyIdentity` derives an identity deterministically from a secret string, enabling recovery from a backup phrase.

The serialized identity is stored as a `PrivacyIdentityRecord` in the `privacyIdentities` Dexie table, indexed by `[coopId+memberId]`. One member can have distinct identities in different coops -- there is no cross-coop identity linkage.

### Group Membership

Groups are Merkle trees of member identity commitments. Two group management approaches are supported:

**Off-chain groups** are constructed locally from commitment arrays. The `createMembershipGroup` function builds a Semaphore `Group` instance from member commitments and returns both the group (for proof generation) and serializable metadata (member count, Merkle root):

```typescript
function createMembershipGroup(members: string[]): {
  group: Group;
  metadata: { id: string; memberCount: number; merkleRoot: string };
}
```

**Bandada-managed groups** use the [Bandada](https://bandada.pse.dev/) API for persistent, server-backed group management. The `groups.ts` module wraps the Bandada SDK:

```typescript
function createBandadaGroup(config: {
  name: string;
  description: string;
  treeDepth: number;
  fingerprintDuration: number;
  apiKey: string;
}): Promise<BandadaGroup>

function addGroupMember(params: {
  groupId: string;
  commitment: string;
  apiKey: string;
}): Promise<void>

function removeGroupMember(params: { ... }): Promise<void>
function getGroupMembers(groupId: string): Promise<string[]>
function isGroupMember(groupId: string, commitment: string): Promise<boolean>
```

Bandada groups provide durability and a canonical member list across devices. The `fingerprintDuration` parameter controls proof expiry -- after the duration elapses, the group fingerprint rotates and old proofs become invalid.

### Proof Generation and Verification

Proof generation takes four inputs:

1. **identity**: The prover's Semaphore `Identity` (reconstructed from the stored export)
2. **group**: A Semaphore `Group` containing all member commitments
3. **message**: An arbitrary string tied to the proof (the artifact origin ID for publishing)
4. **scope**: A string that prevents proof reuse across contexts (the coop ID)

```typescript
async function generateMembershipProof(
  identity: Identity,
  group: Group,
  message: string,
  scope: string,
): Promise<MembershipProof>

async function verifyMembershipProof(proof: MembershipProof): Promise<boolean>
```

The proof output includes the Merkle tree root, a nullifier, the message, the scope, and the Groth16 proof points. The **nullifier** is derived from the scope and identity (not the message), meaning the same identity produces the same nullifier for the same scope. This is by design -- it prevents double-signaling within a scope while allowing multiple messages.

Verification is a pure function: given a `MembershipProof`, it checks the Groth16 proof against the embedded Merkle root and returns a boolean.

### Anonymous Publishing Flow

The `generateAnonymousPublishProof` function orchestrates the full anonymous publish flow:

```typescript
async function generateAnonymousPublishProof(
  db: CoopDexie,
  input: { coopId: string; memberId: string; artifactOriginId: string },
): Promise<MembershipProof | null>
```

Steps:

1. Load the member's `PrivacyIdentityRecord` from Dexie (keyed by coopId + memberId)
2. Load all member commitments for the coop
3. Reconstruct the Semaphore `Identity` from the stored `exportedPrivateKey` via `Identity.import()`
4. Build the group from all member commitments
5. Generate the ZK proof with:
   - **message** = `artifactOriginId` (ties the proof to a specific publish action)
   - **scope** = `coopId` (prevents cross-coop replay)

Returns `null` if the member has no privacy identity or if no identities exist for the coop. The caller attaches the proof to the published artifact. Any verifier can confirm the proof without learning which member produced it.

### Group Lifecycle

**Proof expiry**: Bandada groups support a `fingerprintDuration` that rotates the group fingerprint. After rotation, proofs generated against the old fingerprint fail verification. This bounds the window in which a proof is valid.

**Member rotation**: When a member is removed via `removeGroupMember`, their commitment is deleted from the Merkle tree. Subsequent proof generations rebuild the tree without the removed member, invalidating any group inclusion claim.

**Idempotent initialization**: `initializeMemberPrivacy` checks for an existing identity before creating one. Repeated calls for the same `(coopId, memberId)` pair return the existing record unchanged.

## Stealth Module (ERC-5564)

### Purpose

The stealth module enables private on-chain interactions via one-time addresses. A coop publishes a stealth meta-address. Anyone can derive a fresh, unlinkable address from it to send funds or tokens. Only the coop (holding the viewing and spending keys) can detect and spend from these addresses.

Implements [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) scheme 1 (secp256k1 with view tags). All operations are pure cryptographic functions using `@noble/secp256k1` -- no network access required.

### Key Generation

Each coop gets a stealth key pair: a **spending key** (controls funds) and a **viewing key** (detects incoming payments).

```typescript
function generateStealthKeys(): StealthKeys
```

Returns four values:
- `spendingKey`: 32-byte private key (hex). Controls spending from stealth addresses.
- `viewingKey`: 32-byte private key (hex). Used to scan for incoming payments.
- `spendingPublicKey`: Compressed secp256k1 public key derived from the spending key.
- `viewingPublicKey`: Compressed secp256k1 public key derived from the viewing key.

The key pair is stored as a `StealthKeyPairRecord` in the `stealthKeyPairs` Dexie table, indexed by `coopId`.

### Meta-Address

The stealth meta-address is the public identifier that senders use to generate one-time stealth addresses. It is the concatenation of the spending and viewing compressed public keys (33 bytes each, 66 hex characters each):

```typescript
function computeStealthMetaAddress(keys: StealthKeys): StealthMetaAddress
```

The meta-address is deterministic for a given key pair and is safe to publish. It encodes no private key material. Validated to be at least 134 characters (0x prefix + 66 + 66 hex chars).

### Stealth Address Generation (Sender Side)

A sender who knows the recipient's meta-address generates a one-time stealth address:

```typescript
function generateStealthAddress(metaAddress: StealthMetaAddress): StealthAddress
```

The algorithm:

1. Parse the meta-address into `spendingPublicKey` and `viewingPublicKey`
2. Generate a fresh ephemeral key pair
3. Compute the ECDH shared secret: `sharedSecret = ECDH(ephemeralPrivate, viewingPublic)`
4. Hash the shared secret: `h = keccak256(sharedSecret)`
5. Extract the view tag: first byte of `h`
6. Compute the stealth public key: `stealthPub = spendingPublic + h * G`
7. Derive the Ethereum address from the uncompressed stealth public key

Returns:
- `stealthAddress`: The one-time Ethereum address (20 bytes)
- `ephemeralPublicKey`: Must be published in the announcement so the recipient can detect the payment
- `viewTag`: First byte of the hashed shared secret, used for fast filtering

Each call produces a unique address because a fresh ephemeral key is generated every time.

### Announcement

After sending funds to a stealth address, the sender publishes an announcement so the recipient can find the payment:

```typescript
function prepareStealthAnnouncement(params: {
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: string;
}): StealthAnnouncement
```

Returns an ERC-5564-compliant announcement with `schemeId: 1` (secp256k1). The `metadata` field contains the view tag. This announcement would be emitted via the on-chain ERC-5564 Announcer contract.

### View Tag Scanning (Recipient Side)

The recipient scans announcements to detect payments addressed to them:

```typescript
function checkStealthAddress(params: {
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: string;
  spendingPublicKey: string;
  viewingPrivateKey: string;
}): boolean
```

The algorithm uses a two-phase check:

1. **Fast filter (view tag)**: Compute `h = keccak256(ECDH(viewingPrivate, ephemeralPublic))` and compare the first byte to the announcement's view tag. This eliminates ~255/256 of non-matching announcements with minimal computation.
2. **Full derivation**: If the view tag matches, derive the full stealth address and compare. Only announcements passing both checks belong to the recipient.

### Spending

Once a stealth address is confirmed as belonging to the recipient, they derive the private key to spend from it:

```typescript
function computeStealthPrivateKey(params: {
  spendingPrivateKey: string;
  viewingPrivateKey: string;
  ephemeralPublicKey: string;
}): string
```

The stealth private key is:

```
stealthPrivateKey = spendingPrivateKey + keccak256(ECDH(viewingPrivate, ephemeralPublic)) mod n
```

where `n` is the secp256k1 curve order. This private key controls the stealth address and can be used to sign transactions.

## Lifecycle Integration

The `lifecycle.ts` module wires both privacy primitives into coop lifecycle events:

### Coop Creation

When a coop is created, `initializeCoopPrivacy` runs:

1. Generates a Semaphore identity for the creator
2. Saves the `PrivacyIdentityRecord` to Dexie (keyed by coopId + memberId)
3. Generates stealth spending + viewing keys for the coop
4. Computes the stealth meta-address
5. Saves the `StealthKeyPairRecord` to Dexie (keyed by coopId)

```typescript
async function initializeCoopPrivacy(
  db: CoopDexie,
  input: { coopId: string; memberId: string },
): Promise<{ identity: PrivacyIdentity; stealthKeys: StealthKeys; metaAddress: string }>
```

### Member Join

When a member joins, `initializeMemberPrivacy` runs:

1. Checks for an existing privacy identity for this (coopId, memberId) pair
2. If none exists, generates a fresh Semaphore identity and saves it
3. Returns the identity record (existing or newly created)

```typescript
async function initializeMemberPrivacy(
  db: CoopDexie,
  input: { coopId: string; memberId: string },
): Promise<PrivacyIdentityRecord>
```

Note that joining members do not get their own stealth keys -- stealth keys are per-coop, not per-member. The coop's stealth meta-address is shared so anyone can send to the coop. Individual members can generate personal stealth keys outside the coop lifecycle if needed.

## How Privacy and Stealth Work Together

The two modules serve different layers of the privacy stack:

| Layer | Module | Question Answered |
|-------|--------|-------------------|
| Identity | Privacy (Semaphore) | "Is this person a coop member?" |
| Payment | Stealth (ERC-5564) | "Can this person receive funds privately?" |

**Anonymous publishing**: A member uses the privacy module to generate a ZK proof of coop membership, then attaches it to a published artifact. Verifiers confirm the proof without learning which member published it.

**Private donations**: A supporter uses the coop's stealth meta-address to generate a one-time address and sends funds there. The coop scans announcements with its viewing key to detect the payment, then spends using the derived stealth private key. The donation is not linkable to the coop's public address on-chain.

**Stealth governance payments**: When a coop (backed by a Safe multisig) needs to pay a member without revealing the recipient, it generates a stealth address from the member's personal meta-address and sends funds there. The payment appears on-chain as a transfer to an unknown address.

## Security Properties and Trust Assumptions

### What runs locally

- All Semaphore identity creation, proof generation, and proof verification
- All stealth key generation, address computation, view tag scanning, and private key derivation
- Private key material (Semaphore exported keys, stealth spending/viewing keys) never leaves IndexedDB

### What touches external services

- **Bandada API** (optional): Group management for persistent, multi-device groups. The API sees member commitments (public values), not identities or private keys.
- **On-chain Announcer** (future): Stealth announcements are published on-chain for recipient scanning. The announcement reveals the stealth address and ephemeral public key but not the recipient's identity.

### Cryptographic guarantees

- **Unlinkability (privacy)**: A valid membership proof reveals nothing about which group member produced it. Two proofs from the same member in the same scope share a nullifier, but proofs across scopes are unlinkable.
- **Unlinkability (stealth)**: Each stealth address is derived from a fresh ephemeral key. Without the viewing private key, there is no way to link two stealth addresses to the same recipient.
- **View tag efficiency**: The view tag reduces scanning work by ~256x. A recipient only performs the full ECDH + address derivation for ~1/256 of all announcements.
- **Spending authority**: Only the holder of the spending private key can derive the stealth private key and spend from a stealth address. The viewing key allows detection but not spending.

### Trust boundaries

- The local device is trusted. Private keys in IndexedDB are only as secure as the browser profile.
- Bandada is a convenience layer. A compromised Bandada instance could add or remove commitments from a group, affecting proof validity, but cannot forge proofs or learn private keys.
- Proof verification is trustless -- anyone with the proof can verify it without contacting any service.

## Key Files

| File | Role |
|------|------|
| `shared/src/modules/privacy/membership.ts` | Identity creation, group construction, proof generation/verification |
| `shared/src/modules/privacy/anonymous-publish.ts` | End-to-end anonymous publish proof orchestration |
| `shared/src/modules/privacy/groups.ts` | Bandada API wrapper for persistent group management |
| `shared/src/modules/privacy/lifecycle.ts` | Wires privacy + stealth into coop create/join events |
| `shared/src/modules/stealth/stealth.ts` | ERC-5564 key generation, address derivation, scanning, spending |
| `shared/src/contracts/schema.ts` | Zod schemas for all privacy and stealth types |
| `shared/src/modules/storage/db.ts` | Dexie tables and CRUD for `privacyIdentities` and `stealthKeyPairs` |

## Design Principles

1. **Local-first**: All cryptographic operations run in-browser. No private key material is transmitted to any server.
2. **Scoped identity**: Privacy identities are per-(coop, member) pair. No global identity exists that could be correlated across coops.
3. **Pure functions**: The stealth module is entirely stateless -- pure cryptographic operations with no side effects. The privacy module's proof functions are similarly pure; only the lifecycle and anonymous-publish layers touch storage.
4. **Schema-validated**: All types cross trust boundaries through Zod schemas (`membershipProofSchema`, `stealthKeysSchema`, `stealthAddressSchema`, etc.). Malformed data is rejected at parse time.
5. **Idempotent initialization**: Privacy setup during coop join is idempotent. Repeated calls do not create duplicate identities or overwrite existing ones.
