# Coop Testing And Validation

Date: March 11, 2026

## Goals

The testing posture should protect the current v1 reality:

- the landing page stays coherent on desktop and mobile
- the extension core loop keeps working end to end
- mock and live integrations stay clearly separated
- Codex can run named suites without guessing which commands matter

## Named Validation Commands

List the available suites:

```bash
bun run validate list
```

Fast confidence run:

```bash
bun run validate smoke
```

Main extension workflow validation:

```bash
bun run validate core-loop
```

Receiver slice validation:

```bash
bun run validate receiver-slice
```

Receiver hardening validation:

```bash
bun run validate receiver-hardening
```

Board and archive-story validation:

```bash
bun run validate flow-board
```

Arbitrum and Sepolia Safe validation:

```bash
bun run validate arbitrum-safe-live
```

Full local pass before demos or merges:

```bash
bun run validate full
```

You can also run the underlying E2E suites directly:

```bash
bun run test:e2e:app
bun run test:e2e:app:mobile
bun run test:e2e:extension
bun run test:e2e:receiver-sync
```

## What Each Suite Covers

- `smoke`: unit tests plus workspace build
- `landing`: desktop and mobile Playwright checks for the app
- `core-loop`: unit tests, build, then the two-profile extension flow
- `receiver-slice`: unit tests, build, app shell checks, then pair + sync into extension intake
- `receiver-hardening`: lint, unit tests, build, then receiver sync with the sidepanel closed
- `flow-board`: targeted board/archive unit tests, build, then focused Playwright checks for the board route and extension handoff
- `arbitrum-safe-live`: lint, targeted onchain/config tests, build, then an optional Sepolia-first live Safe probe
- `full`: lint, unit, build, landing E2E, extension E2E, and receiver sync E2E

## Manual Validation Checklist

Use this when validating the app and extension as a product, not just as code.

1. Load the unpacked extension from `packages/extension/dist`.
2. Create a coop in mock mode and confirm the Safe state renders.
3. Generate a member invite and join from a second Chromium profile.
4. Run manual round-up with a few meaningful tabs open.
5. Edit at least one draft in the Roost and push it into shared memory.
6. Confirm the second profile sees the published artifact in the Feed.
7. Archive the latest artifact and export the latest receipt.
8. Export the full snapshot and verify the file contents are legible.
9. Change capture cadence and confirm alarms and status text update.
10. Toggle sound preferences and confirm the test sound still works.

## Negative-Path Validation

These are the failure modes worth checking over the next couple of days:

- remove tab or host permissions and confirm the runtime reports degraded health
- break signaling and confirm the extension falls back to local-only messaging
- run with no live archive issuer configured and confirm live mode fails loudly
- test empty coop states so the sidepanel still feels intentional when there are no drafts or artifacts

## Live Integration Matrix

Keep mock and live validation separate.

All live onchain validation should assume this fixed chain pair:

- `Arbitrum One` for production
- `Ethereum Sepolia` for test and development
- no live validation target on any additional chains

### Default Local Safety

- `VITE_COOP_CHAIN=sepolia`
- `VITE_COOP_ONCHAIN_MODE=mock`
- `VITE_COOP_ARCHIVE_MODE=mock`

This should stay the default path for CI and fast local validation.

### Live Onchain Only

Use this when validating Safe creation without adding Storacha risk at the same time.

- `VITE_COOP_CHAIN=sepolia`
- `VITE_COOP_ONCHAIN_MODE=live`
- `VITE_PIMLICO_API_KEY=...`
- `VITE_COOP_ARCHIVE_MODE=mock`

`bun run validate arbitrum-safe-live` uses this Sepolia path by default and only runs a real deployment probe when both of these are exported:

- `VITE_PIMLICO_API_KEY=...`
- `COOP_ONCHAIN_PROBE_PRIVATE_KEY=...`

Set `COOP_ONCHAIN_PROBE_CHAIN=arbitrum` only when you explicitly want to probe the production chain after Sepolia is already validated.

### Live Archive Only

Use this when validating archive delegation and upload independently.

- `VITE_COOP_ONCHAIN_MODE=mock`
- `VITE_COOP_ARCHIVE_MODE=live`
- `VITE_STORACHA_ISSUER_URL=...`
- optional `VITE_STORACHA_ISSUER_TOKEN=...`

### Full Live Path

Only run this after the two partial live modes are stable.

- `VITE_COOP_CHAIN=arbitrum` or `VITE_COOP_CHAIN=sepolia`, depending on which path you are validating
- `VITE_COOP_ONCHAIN_MODE=live`
- `VITE_PIMLICO_API_KEY=...`
- `VITE_COOP_ARCHIVE_MODE=live`
- `VITE_STORACHA_ISSUER_URL=...`

## Adding A New Named Suite

Edit `scripts/validate.mjs` and add either:

- a suite with direct `steps`
- a suite with `includes` that composes existing suites

After that, confirm the new suite appears in:

```bash
bun run validate list
```
