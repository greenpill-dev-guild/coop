---
title: "Testing & Validation"
slug: /reference/testing-and-validation
---

# Coop Testing And Validation

Date: March 28, 2026

This document maps the release-facing validation commands to the actual suite graph in
`scripts/validate.ts`. The canonical release boundary lives in
[Current Release Status](/reference/current-release-status). The demo flow and deployment steps live
in [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook). Operator-only second-gate guidance
lives in [Live Rails Operator Runbook](/reference/live-rails-operator-runbook).

As of March 28, 2026, the automated mock-first release bar is green. The remaining staged-launch
blocker is manual real-Chrome confirmation of popup `Capture Tab` and `Screenshot` success paths.

## Core Commands

List all named suites:

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

Chrome Web Store release gate:

```bash
bun run validate:store-readiness
```

Full pre-release extension gate:

```bash
bun run validate:production-readiness
```

Opt-in live-rails gate:

```bash
bun run validate:production-live-readiness
```

## Canonical Suite Graph

### Release Gates

- `store-readiness`
  Runs `build`, `unit:store-readiness`, `unit:extension-dist`, and `audit:store-readiness`.
- `production-readiness`
  Runs `lint`, `build`, `popup-slice`, `unit:sidepanel-actions`, `unit:archive-hardening`,
  `sync-hardening`, `onchain-ui`, `unit:agent-loop`, `unit:onchain-config`, `unit:session-key`,
  `store-readiness`, `e2e:extension`, `e2e:receiver-sync`, `e2e:agent-loop`, and
  `e2e:app:mobile`.
- `production-live-readiness`
  Runs `production-readiness`, `arbitrum-safe-live`, `session-key-live`, and `archive-live`.

### Supporting Composites

- `popup-slice`
  Runs `unit:popup-actions` and `e2e:popup`.
- `sync-hardening`
  Runs `unit:sync-hardening` and `e2e:sync`.
- `onchain-ui`
  Runs `unit:onchain-ui`.
- `core-loop`
  Runs `unit`, `build`, and `e2e:extension`.
- `receiver-hardening`
  Runs `lint`, `unit`, `build`, and `e2e:receiver-sync`.

## What The Browser Suites Actually Cover

- `bun run test:e2e:popup`
  Covers real popup roundup into drafts, the exact screenshot permission error when automation does
  not get a genuine popup `activeTab` grant, screenshot manual-gate copy before review opens, file
  review cancel/save, microphone denial and retry, and post-failure popup recovery.
- `bun run test:e2e:extension`
  Covers create/join coop flow, publish plus board/archive handoff, the focused trusted-helper run
  loop, and mock-path sidepanel member-account plus garden-pass actions.
- `bun run test:e2e:receiver-sync`
  Covers receiver pair, private intake sync, sidepanel-closed receiver runtime, and multi-coop
  publish from extension review.
- `bun run test:e2e:sync`
  Covers degraded and recovered sync runtime-health persisted across popup reopen. It does not do
  full network fault injection.
- `bun run test:e2e:agent-loop`
  Runs the `@agent-loop` slice from `e2e/extension.spec.cjs` as a focused trusted-helper browser
  rehearsal.

## Visual E2E

Playwright visual regression tests remain separate from the release suites:

```bash
bun run test:visual
```

That command runs:

- `e2e/visual-popup.spec.cjs`
- `e2e/visual-sidepanel.spec.cjs`

`test:visual` is not included in `store-readiness` or `production-readiness`.

## Targeted Test Entry Points

```bash
bun run test:unit:popup-actions
bun run test:unit:sidepanel-actions
bun run test:unit:archive-hardening
bun run test:unit:sync-hardening
bun run test:unit:onchain-ui
bun run test:unit:onchain-config
bun run test:unit:agent-loop
bun run test:unit:session-key
bun run test:e2e:popup
bun run test:e2e:sync
bun run test:e2e:extension
bun run test:e2e:receiver-sync
bun run test:e2e:agent-loop
bun run test:e2e:app:mobile
```

## Coverage Accounting

The repo-wide Vitest coverage report is currently thresholded for:

- `packages/shared/src`
- `packages/app/src`
- `packages/extension/src/runtime`
- `packages/extension/src/views`

Two important blind spots to remember when reading the aggregate percentage:

- `packages/api` is discovered by the root Vitest run and its tests execute, but it is not part of
  the current coverage totals.
- `packages/extension/src/background` also has tests, but it is outside the current coverage
  include list, so background-worker execution does not move the reported coverage percentage.

Treat the aggregate number as a useful gate for the measured surfaces, not as a full-repo coverage
statement.

## Local Safety Defaults

Keep these defaults for normal local development:

```bash
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
```

Local validation and demo env guidance should come from the repo-root `.env.local`, not
package-local env files.

## Live Validation

### Safe Probe

Use this when validating Safe deployment without live archive or session-key execution:

```bash
bun run validate:arbitrum-safe-live
```

Required env:

- `VITE_PIMLICO_API_KEY`
- `COOP_ONCHAIN_PROBE_PRIVATE_KEY`

Optional:

- `COOP_ONCHAIN_PROBE_CHAIN=arbitrum`

If the required env is missing, this probe prints a skip message and exits cleanly. That does not
prove live Safe readiness.

### Session-Key Probe

Use this when validating bounded Smart Session execution onchain:

```bash
bun run validate:session-key-live
```

Required env:

- `VITE_PIMLICO_API_KEY`
- `COOP_SESSION_PROBE_PRIVATE_KEY`

Optional:

- `COOP_SESSION_PROBE_CHAIN=arbitrum`
- `COOP_SESSION_PROBE_SAFE_ADDRESS=0x...`

If the required env is missing, this probe prints a skip message and exits cleanly. That does not
prove live session-key readiness.

This probe:

- deploys or reuses a probe Safe
- validates the local garden-pass rule set before any live send
- executes one allowed `green-goods-create-garden` action when the Safe supports the required
  session modules
- confirms a disallowed action is rejected before send
- revokes the session and confirms subsequent rejection

### Archive Probe

Use this when validating trusted-node archive delegation material:

```bash
bun run validate:archive-live
```

Required env for a real delegation:

- `VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION`

Commonly needed:

- `VITE_COOP_TRUSTED_NODE_ARCHIVE_AGENT_PRIVATE_KEY`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_PROOFS`
- `VITE_COOP_TRUSTED_NODE_ARCHIVE_ALLOWS_FILECOIN_INFO=true`

Important:

- `bun run validate:archive-live` falls back to an in-process static delegation when the trusted-node
  archive env is missing.
- Treat that fallback as a wiring check only. Use real trusted-node archive env when you need an
  actual live-archive proof.

### Full Live-Rails Gate

Use this only when the release candidate enables live Safe, session-key, or archive behavior:

```bash
bun run validate:production-live-readiness
```

## Manual Release Checks That Still Matter

### Popup Capture

- Automation already proves real popup roundup, popup manual-gate errors, file review/save, audio
  retry, and post-failure recovery.
- Manually confirm successful popup `Capture Tab` and `Screenshot` saves in Chrome with a real
  user click because Playwright cannot reliably reproduce the popup `activeTab` grant.

### Sidepanel And Receiver

- A second profile can join and see published state.
- Receiver pairing works on the intended origin and private intake sync still lands in the correct
  coop.
- Publish reaches the **Coops** feed and the board route.
- Archive receipts remain legible and export still works.

### Green Goods And Session Rails

- `production-readiness` now covers mock-path member-account provisioning and garden-pass issuance
  in the real sidepanel.
- Live Safe and Smart Session execution still require the opt-in live probes.
- Full live garden-pass execution may still skip if the probe Safe lacks ERC-7579 support.

## Related Docs

- [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook)
- [Current Release Status](/reference/current-release-status)
- [Live Rails Operator Runbook](/reference/live-rails-operator-runbook)
- [Receiver Pairing & Intake](/reference/receiver-pairing-and-intake)
- [Extension Install & Distribution](/reference/extension-install-and-distribution)
- [Chrome Web Store Checklist](/reference/chrome-web-store-checklist)
- [UI Action Coverage Map](/testing/ui-action-coverage)
