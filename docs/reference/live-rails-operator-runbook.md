---
title: "Live Rails Operator Runbook"
slug: /reference/live-rails-operator-runbook
---

# Live Rails Operator Runbook

Date: March 28, 2026

This is the canonical operator-only runbook for live Safe, session-capability, archive, and
Filecoin registry paths.

Use this only for the second gate. Do not use it to describe the default public staged-launch bar.

## When This Runbook Applies

Use this doc when all of these are true:

- the mock-first staged-launch bar is already green
- you are intentionally validating live Safe, archive, or session-capability rails
- the build is operator-controlled rather than a standard public Chrome Web Store candidate

For the current public-release boundary, read [Current Release Status](/reference/current-release-status).

## Public Build Separation

Standard staged-launch builds stay mock-first:

```bash
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
```

Why the separation matters:

- Coop's frontend `VITE_` env values are baked into the built extension bundle
- live integration config therefore belongs only in controlled operator builds
- public Chrome Web Store candidates should not carry live archive or registry signing material

Do not ship these values in a public Chrome Web Store candidate:

- `VITE_COOP_TRUSTED_NODE_ARCHIVE_*`
- `VITE_COOP_FVM_OPERATOR_KEY`

Treat any build enabling live rails as operator-controlled until that secret boundary changes in
code.

## Required Baseline Before The Live Gate

Before you touch live env:

```bash
bun run test
bun run test:coverage
bun build
bun run validate:store-readiness
bun run validate:production-readiness
```

For a public candidate, also complete the manual real-Chrome popup `Capture Tab` and `Screenshot`
checks before claiming release readiness.

## Live Mode Switches

These switches enable the second gate:

```bash
VITE_COOP_ONCHAIN_MODE=live
VITE_COOP_ARCHIVE_MODE=live
VITE_COOP_SESSION_MODE=live
```

Rebuild after any env change because Vite bakes them into the bundle.

Recommended commands:

```bash
bun run build:operator-live
bun run validate:operator-live
```

The `operator-live` profile overlay lives at `config/env/profiles/operator-live.env` and supplies
only the non-secret live mode/origin values. Keep the actual live credentials in the repo-root
`.env.local`.

## Safe Probe

Command:

```bash
bun run validate:arbitrum-safe-live
```

Required env:

- `VITE_PIMLICO_API_KEY`
- `COOP_ONCHAIN_PROBE_PRIVATE_KEY`

Optional:

- `COOP_ONCHAIN_PROBE_CHAIN=arbitrum`

Current behavior:

- deploys a probe Safe for the specified chain
- prints the resulting Safe address and deployment transaction hash
- exits cleanly with a skip message when the required env is missing

Operational guidance:

- use a dedicated probe private key, not a treasury owner key
- record the Safe address and tx hash from successful rehearsals

## Session-Capability Probe

Command:

```bash
bun run validate:session-key-live
```

Required env:

- `VITE_PIMLICO_API_KEY`
- `COOP_SESSION_PROBE_PRIVATE_KEY`

Optional:

- `COOP_SESSION_PROBE_CHAIN=arbitrum`
- `COOP_SESSION_PROBE_SAFE_ADDRESS=0x...`
- `COOP_SESSION_PROBE_NAME`
- `COOP_SESSION_PROBE_SLUG`
- `COOP_SESSION_PROBE_DESCRIPTION`
- `COOP_SESSION_PROBE_LOCATION`
- `COOP_SESSION_PROBE_BANNER_IMAGE`
- `COOP_SESSION_PROBE_METADATA`
- `COOP_SESSION_PROBE_HYPOTHETICAL_GARDEN_ADDRESS`

Current behavior:

- attaches to an existing probe Safe or deploys one
- validates the bounded policy locally before any live send
- exercises one allowed `green-goods-create-garden` action when the probe Safe supports the
  required modules
- confirms a disallowed action is rejected
- revokes the session and confirms later rejection
- exits cleanly with a skip message when the required env is missing

Use a dedicated probe Safe when you want repeatable rehearsals. `COOP_SESSION_PROBE_SAFE_ADDRESS`
is the right way to reuse that boundary instead of mixing real operator safes into the probe path.

## Archive Probe

Command:

```bash
bun run validate:archive-live
```

Core trusted-node archive env for a real delegation:

- `VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION`

Commonly needed:

- `VITE_COOP_TRUSTED_NODE_ARCHIVE_AGENT_PRIVATE_KEY`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_PROOFS`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_GATEWAY_URL`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_ALLOWS_FILECOIN_INFO`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_EXPIRATION_SECONDS`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_FILECOIN_WITNESS_RPC_URL`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_FILECOIN_WITNESS_RPC_TOKEN`
- `COOP_ARCHIVE_PROBE_AUDIENCE_DID`

Important current behavior:

- if the trusted-node archive env is missing, the script falls back to an in-process static
  delegation
- that fallback is useful for wiring checks, but it is not a proof that operator archive
  credentials are configured correctly

Operational guidance:

- only treat this probe as a live-archive check when the real trusted-node archive env is present
- keep `COOP_ARCHIVE_PROBE_AUDIENCE_DID` on a non-production audience for rehearsals

## Composite Live Gate

Once the staged-launch bar is green and the live env is intentionally configured:

```bash
bun run validate:production-live-readiness
```

That composite gate runs:

- `production-readiness`
- `arbitrum-safe-live`
- `session-key-live`
- `archive-live`

If probe env is missing, some component probes can skip cleanly. Review the logs and do not claim
live readiness from a skipped rehearsal.

## Filecoin / FVM Registry Boundary

The Filecoin registry path is still operator-controlled.

Relevant env:

- `VITE_COOP_FVM_CHAIN`
- `VITE_COOP_FVM_REGISTRY_ADDRESS`
- `VITE_COOP_FVM_OPERATOR_KEY`

Current constraint:

- deployment can use a Foundry keystore or private key from `packages/contracts`
- runtime registry actions in the extension still depend on `VITE_COOP_FVM_OPERATOR_KEY`
- because that value is baked into the bundle, it is not appropriate for a standard public Chrome
  Web Store build

## Operator Discipline

Recommended operating rules:

- keep live env only in the repo-root `.env.local`
- rebuild after changing live env
- use probe-specific private keys instead of production treasury keys
- unset live env before packaging a standard public staged-launch candidate
- treat successful live probes as rehearsal evidence, not as permission to blur public and
  operator-only release claims

## Related Docs

- [Current Release Status](/reference/current-release-status)
- [Testing & Validation](/reference/testing-and-validation)
- [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook)
- [Environment Reference](/builder/environment)
- [Agent Registry & API Server](/reference/erc8004-and-api)
