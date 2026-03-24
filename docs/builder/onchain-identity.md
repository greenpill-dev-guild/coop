---
title: Onchain Identity
slug: /builder/onchain-identity
---

# Onchain Identity

Coop's onchain identity stack turns a browser-native passkey into a full execution chain: individual
smart accounts, group multisig governance, and time-bounded session keys. No wallet extensions, no
seed phrases, no custody handoff.

This page walks through the four layers and how they compose.

## Identity Stack

Identity starts with a passkey -- a WebAuthn credential created by the browser or platform
authenticator. No external wallet is involved.

The `auth` module in `@coop/shared` handles passkey lifecycle:

- **`createPasskeySession`** registers a new WebAuthn credential and derives a deterministic
  address from the credential's ID and public key. This address becomes the user's
  `primaryAddress` -- their root identity across all coops.
- **`restorePasskeyAccount`** rehydrates a stored credential into a viem `WebAuthnAccount` that can
  sign ERC-4337 user operations.
- **`ensurePasskeyIdentity`** is the workhorse: it checks for an existing local identity, rehydrates
  it if found, or creates a new one (live or mock depending on mode).

The passkey credential itself stays on the device. What gets persisted to Dexie is a
`LocalPasskeyIdentity` record containing the credential ID, public key, derived owner address, and
RP ID. This record is device-bound by design -- losing the device means losing the credential
unless recovery is configured.

> **Shipped.** Passkey registration, session creation, and identity persistence are live. The
> identity warning system (`createDeviceBoundWarning`) is active and surfaces device-binding
> risks in the UI.

## Member Accounts

A passkey gives you identity. A member account gives you onchain agency within a coop.

The `member-account` module creates per-member smart accounts using ZeroDev Kernel (v0.3.1, EntryPoint
0.7). Each member of a coop gets their own counterfactual smart account, owned by their passkey.

The lifecycle:

1. **Provisioning** -- `provisionMemberAccounts` identifies members who lack an account record and
   creates `MemberOnchainAccount` entries in `pending` status.
2. **Address prediction** -- `predictMemberAccountAddress` computes the counterfactual address
   without deploying. The account moves to `predicted` status. This address is usable for
   allowlists and Safe owner additions before any gas is spent.
3. **Deployment** -- When a member needs to transact, the Kernel account is deployed through
   Pimlico's bundler. Status moves through `deploying` to `active`.
4. **Execution** -- `sendTransactionViaMemberAccount` signs and submits user operations through the
   member's Kernel account, using Pimlico for gas sponsorship.

Member accounts bridge the gap between passkey identity (device-local, no chain presence) and
onchain actions that require a sender address. The account type defaults to `kernel` but the
schema supports `safe` and `smart-account` as alternatives.

> **Shipped.** Account provisioning, counterfactual address prediction, and live deployment via
> Pimlico are implemented. The `LocalMemberSignerBinding` record links a member's passkey to
> their smart account address on the local device.

## Safe Integration

A coop is a group, and groups need shared governance. Coop uses Gnosis Safe (v1.4.1) as the group
identity and treasury.

The `onchain` module handles Safe deployment and management:

- **`deployCoopSafe`** takes a passkey-based auth session and deploys a Safe smart account through
  Pimlico's account abstraction infrastructure. The passkey owner becomes the first Safe signer.
  A deterministic salt nonce derived from the coop seed ensures the same coop always produces the
  same Safe address.
- **Owner management** -- The `safe-owners` module provides a complete owner lifecycle:
  `proposeAddOwner`, `proposeRemoveOwner`, `proposeSwapOwner`, and `proposeChangeThreshold`.
  Each produces a `SafeOwnerChange` record that tracks status from `proposed` through `executed`
  or `failed`. The threshold progression follows a conservative formula:
  `Math.ceil((ownerCount * 2) / 5)`, keeping quorum requirements proportional to group size.
- **Signature validation** -- The `signatures` module validates signatures against the Ambire
  universal validator contract, covering EOA, ERC-1271 (smart contract), and ERC-6492
  (counterfactual) signature types.

The `authority` module defines four authority classes that map actions to the appropriate signer:

| Authority Class | Signs With | Example Actions |
| --- | --- | --- |
| `safe-owner` | Safe multisig | Safe deployment, owner changes, work approvals |
| `session-executor` | Session key | Garden creation, profile sync, domain config |
| `member-account` | Kernel account | Add/remove gardeners, submit work, impact reports |
| `semaphore-identity` | ZK proof | Anonymous membership proofs (not a signer) |

This separation matters. Collapsing session-executor actions into safe-owner would require full
multisig approval for routine automation. Collapsing member-account into session-executor would
lose individual attribution.

> **Shipped.** Safe deployment, owner management, signature validation, and authority
> classification are live. Mock and live modes are both supported, controlled by
> `VITE_COOP_ONCHAIN_MODE`.

## Session Keys

Some actions need to happen without a human approving every transaction. Session keys provide
bounded, time-limited execution capabilities.

The `session` module implements Rhinestone's Smart Sessions protocol on top of the coop Safe:

- **Scope** -- Each `SessionCapability` defines exactly what it can do: which action classes are
  allowed, which contract addresses are in the target allowlist, a maximum use count, and an
  expiration timestamp.
- **Signer material** -- `createSessionSignerMaterial` generates a fresh ephemeral private key and
  wraps it in an ownable validator. The private key is encrypted with AES-GCM
  (`encryptSessionPrivateKey`) and stored locally as `EncryptedSessionMaterial`. It never leaves
  the device unencrypted.
- **Lifecycle** -- Session capabilities move through `active`, `expired`, `exhausted`, `revoked`,
  and `unusable` states. `refreshSessionCapabilityStatus` recomputes status on every access.
  `validateSessionCapabilityForBundle` runs a gauntlet of checks before allowing execution:
  action class support, capability status, encrypted material availability, Pimlico configuration,
  Safe existence, chain match, Safe address match, action allowlist, target allowlist, and typed
  authorization metadata.
- **On-chain integration** -- `buildSmartSession` constructs a Rhinestone `Session` object with
  time-frame and usage-limit policies. `buildEnableSessionExecution` and
  `buildRemoveSessionExecution` produce the Safe transactions to install or remove the session
  module.

Currently scoped to four Green Goods action classes: garden creation, profile sync, domain
configuration, and pool creation.

> **Shipped.** Session capability creation, validation, encryption, status management, and
> Rhinestone Smart Session integration are implemented. The validation pipeline is thorough --
> 11 distinct failure reasons with typed rejection codes. Session key rotation and revocation
> are supported.

## How They Fit Together

The full flow from passkey to bounded onchain action:

```
Passkey Registration
    |
    v
LocalPasskeyIdentity (device-local, Dexie)
    |
    +---> restorePasskeyAccount() ---> WebAuthnAccount (viem signer)
    |
    +---> Coop Creation
    |         |
    |         v
    |     deployCoopSafe() ---> Safe multisig (group identity)
    |         |
    |         +---> proposeAddOwner() ---> add member's Kernel address as co-signer
    |
    +---> Member Account
    |         |
    |         v
    |     predictMemberAccountAddress() ---> counterfactual Kernel address
    |         |
    |         v
    |     sendTransactionViaMemberAccount() ---> individual onchain actions
    |
    +---> Session Key
              |
              v
          createSessionCapability() ---> bounded execution scope
              |
              v
          validateSessionCapabilityForBundle() ---> pre-flight checks
              |
              v
          buildSmartSession() ---> Rhinestone session on Safe
```

Key design decisions:

- **Passkeys are the root of trust.** Everything derives from the WebAuthn credential. No mnemonic
  backup, no wallet extension dependency.
- **Counterfactual addresses before deployment.** Member accounts and Safe addresses are
  deterministic, so they can be used in allowlists and owner proposals before any gas is spent.
- **Authority classes enforce separation.** The `authority` module prevents accidentally routing a
  Safe-level action through a session key or vice versa.
- **Session keys are defense in depth.** Even if a session key is compromised, it can only call
  specific functions on specific contracts within a time window and use limit.
- **Everything works in mock mode.** `VITE_COOP_ONCHAIN_MODE=mock` provides deterministic addresses
  and state for development and demos without touching a chain.
