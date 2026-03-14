---
paths:
  - "packages/shared/src/modules/onchain/**"
  - "packages/shared/src/modules/auth/**"
---

# Onchain & Auth Rules

- Onchain uses Safe v1.4.1 + ERC-4337 via Pimlico bundler with passkey as owner.
- Two chains: `sepolia` (dev/test) and `arbitrum` (production). Never hardcode chain IDs.
- Two modes: `mock` (deterministic fake addresses) and `live` (real Pimlico deployment). Controlled by `VITE_COOP_ONCHAIN_MODE`.
- Salt nonce is deterministic from coop seed: `toDeterministicBigInt(coopSeed)`.
- Passkey-first identity via `viem/account-abstraction`. No wallet-extension-first UX.
- Address derivation: `toDeterministicAddress(seed)` uses `keccak256(stringToHex(seed)).slice(2, 42)` then `getAddress()`.
- Auth sessions bridge to local identity records via `authSessionToLocalIdentity()`.
