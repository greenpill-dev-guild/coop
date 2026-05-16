# ADR-008: ERC-4337 Account Abstraction for Member Accounts

## Status

Accepted

## Date

2026-03-10 (Smart account provisioning integrated with passkey auth)

## Context

Coop members authenticate with passkeys (ADR-003) but need onchain accounts to participate in Safe multisig coops (ADR-002). Traditional EOA wallets require users to manage seed phrases and hold ETH for gas — both unacceptable for Coop's target audience of non-crypto-native users. The system needs a way to derive onchain accounts from passkey credentials with gasless transaction submission.

Member accounts must:

- Be deterministically derivable from a passkey credential
- Support Safe multisig ownership (as a signer on the coop Safe)
- Submit transactions without the user holding native gas tokens
- Work on Arbitrum (production) and Sepolia (development)

## Decision

Use ERC-4337 account abstraction with the `permissionless` SDK and Safe-compatible smart accounts, implemented in `packages/shared/src/modules/member-account/member-account.ts` and `packages/shared/src/modules/onchain/onchain.ts`:

- **Smart account types**: Support both `kernel` (ZeroDev Kernel) and `safe` (Safe&#123;Core&#125;) account types via `toKernelSmartAccount()` and `toSafeSmartAccount()` from the `permissionless/accounts` package
- **Entry point**: ERC-4337 v0.7 (`entryPoint07Address` from `viem/account-abstraction`)
- **Passkey signer**: Passkey credentials restored via `restorePasskeyAccount()` serve as the smart account owner/signer
- **Gas sponsorship**: Transactions routed through `createCoopSmartAccountClient()` with paymaster support, falling back to coop-funded gas via `sendSmartAccountTransactionWithCoopGasFallback()`
- **Deterministic addresses**: Account addresses are predictable from the passkey credential and a coop-specific salt nonce (`createCoopSaltNonce()`)

## Alternatives Considered

- **EOA wallets**: Require seed phrase management and gas tokens. Fundamentally incompatible with passkey-first UX and non-crypto-native users.
- **MPC wallets**: Distributed key generation avoids single points of failure but adds infrastructure complexity (MPC nodes) and latency for signing ceremonies.
- **Custodial accounts**: Simplest UX but contradicts Coop's self-sovereignty principle. Creates a central point of failure and trust.
- **Social recovery wallets**: Good UX for recovery but doesn't solve the initial account creation or gas sponsorship problems. Could complement ERC-4337 as a recovery mechanism.

## Consequences

### Positive

- Gasless UX — members never need to acquire or manage native tokens for transactions
- Passkey is the sole authentication factor — no seed phrases, no wallet extensions, no browser popups
- Deterministic account addresses enable pre-computation before deployment, allowing the UI to show account state early
- Compatible with Safe multisig — smart accounts can be added as Safe owners

### Negative

- Dependency on bundler infrastructure (Pimlico) for UserOperation submission — if the bundler is down, onchain actions are blocked
- Paymaster sponsorship has cost implications — someone must fund the gas for all member transactions
- Smart account deployment is a separate onchain transaction, adding a provisioning step before the account is fully active
- Two account types (kernel, safe) increase testing and maintenance surface

### Neutral

- Account lifecycle is tracked via status transitions (`pending` → `deploying` → `deployed`) in the local Dexie store
- Chain configuration is driven by `VITE_COOP_CHAIN` env var, with `getCoopChainConfig()` abstracting chain-specific details
- Session keys (ADR scope: `session` module) can be layered on top of smart accounts for scoped, time-bounded permissions
