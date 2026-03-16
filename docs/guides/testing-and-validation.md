---
title: "Testing & Validation"
sidebar_label: "Testing"
sidebar_position: 2
---

# Coop Testing And Validation

Date: March 13, 2026

This document tracks the validation entrypoints. The full operator flow, demo setup, and deploy
steps live in [demo-and-deploy-runbook.md](../guides/demo-and-deploy-runbook).

## Core Commands

List all suites:

```bash
bun run validate list
```

Fast confidence:

```bash
bun run validate smoke
```

Main extension workflow:

```bash
bun run validate core-loop
```

Receiver slice:

```bash
bun run validate receiver-slice
```

Final pre-demo production slice:

```bash
bun run validate production-readiness
```

Opt-in live Smart Session rehearsal:

```bash
bun run validate session-key-live
```

## What The Named Suites Cover

- `smoke`: unit tests plus workspace build
- `core-loop`: unit tests, build, then the two-profile extension flow
- `receiver-slice`: unit tests, build, app shell checks, then pair + sync into extension intake
- `receiver-hardening`: lint, unit tests, build, then receiver sync with the sidepanel closed
- `flow-board`: targeted board/archive tests plus focused Playwright checks
- `agent-loop`: trusted-node agent tests plus focused operator-console E2E
- `production-readiness`: lint, build, targeted agent/onchain/session-key tests, extension E2E,
  receiver sync E2E, agent-loop E2E, and mobile app coverage
- `session-key-live`: lint, targeted onchain/session-key tests, build, then an opt-in live Smart
  Session probe

## Targeted Test Entry Points

```bash
bun run test:unit:onchain-config
bun run test:unit:agent-loop
bun run test:unit:session-key
bun run test:e2e:extension
bun run test:e2e:receiver-sync
bun run test:e2e:agent-loop
bun run test:e2e:app:mobile
```

## Local Safety Defaults

Keep these defaults for normal local development:

```bash
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
```

Local validation and demo env guidance should come from the repo-root `.env.local` and the
runbook, not package-local env files.

## Live Validation

### Safe Probe

Use this when validating Safe deployment without live archive or session-key execution:

```bash
bun run validate arbitrum-safe-live
```

Required env:

- `VITE_PIMLICO_API_KEY`
- `COOP_ONCHAIN_PROBE_PRIVATE_KEY`

Optional:

- `COOP_ONCHAIN_PROBE_CHAIN=arbitrum`

### Session-Key Probe

Use this when validating bounded Smart Session execution onchain:

```bash
bun run validate session-key-live
```

Required env:

- `VITE_PIMLICO_API_KEY`
- `COOP_SESSION_PROBE_PRIVATE_KEY`

Optional:

- `COOP_SESSION_PROBE_CHAIN=arbitrum`

This probe:

- deploys or reuses a probe Safe
- enables a bounded Smart Session
- executes one allowed `green-goods-create-garden` action
- confirms a disallowed action is rejected before send
- revokes the session and confirms subsequent rejection

## Manual Adversarial Gates

Mirror these checks from the runbook before demos or production pushes.

### Create A Coop

- Preset-specific copy renders correctly.
- Friends, family, and personal never leak back to generic `community` language.
- State badges and extension icon states match the real runtime state.
- Onchain, archive, and session modes are visible in Settings.

### Pair And Sync

- A second profile can join and see published state.
- Expired or inactive pairing fails clearly.
- Missing signaling and sidepanel-closed sync fail safely.
- Local-only fallback remains usable.

### Receiver Capture

- `/pair`, `/receiver`, and `/inbox` work on local and production origins.
- QR, share, notifications, badges, and file export degrade gracefully.
- Receiver bridge injection works on local and Vercel origins.
- Wrong-member and expired-pairing envelopes are rejected.

### Agent Loop

- Manual round-up, observation capture, plan generation, and draft creation stay legible.
- Auto-run never bypasses action policy.

### Green Goods Session Keys

- Allowed session-key action succeeds.
- Disallowed action is blocked before send.
- Replay stays blocked.
- Revoked, expired, or exhausted sessions are blocked.
- Missing Safe, missing Pimlico, wrong chain, and missing session material surface actionable
  errors.

### Publish, Archive, And Export

- Publish reaches Feed and the board route.
- Archive receipts stay legible.
- Export works with file picker or download fallback.

## Related Docs

- [demo-and-deploy-runbook.md](../guides/demo-and-deploy-runbook)
- [extension-install-and-distribution.md](../getting-started/extension-install-and-distribution)
