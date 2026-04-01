---
title: "Production Release Checklist"
slug: /reference/production-release-checklist
---

# Coop Production Release Checklist

Date: March 31, 2026

This is the canonical stage-based production checklist for Coop. It consolidates the release gates,
manual verification, deployment requirements, Chrome Web Store submission steps, and operator-only
live-rails checks that were previously spread across multiple docs.

Use this document to decide whether a candidate is ready for:

- internal demo rehearsal
- public mock-first staged launch
- Chrome Web Store submission
- operator-controlled live-rails rehearsal

This checklist does **not** claim the current branch is green. It defines what must be true before a
candidate can honestly move to the next stage.

## Supporting Docs

Use these as detailed references, not as separate competing checklists:

- [Current Release Status](/reference/current-release-status)
- [Testing & Validation](/reference/testing-and-validation)
- [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook)
- [Extension Install & Distribution](/reference/extension-install-and-distribution)
- [Chrome Web Store Checklist](/reference/chrome-web-store-checklist)
- [Chrome Web Store Reviewer Notes](/reference/chrome-web-store-reviewer-notes)
- [Live Rails Operator Runbook](/reference/live-rails-operator-runbook)
- [Receiver Pairing & Intake](/reference/receiver-pairing-and-intake)

## Stage Map

| Stage | Goal | Required Boundary | Main Output |
|---|---|---|---|
| 0 | Freeze release intent and env contract | choose public mock-first vs operator-live | one agreed release target |
| 1 | Build confidence on changed surfaces | local / rehearsal | green targeted suites |
| 2 | Verify production infrastructure | production origins and routes ready | production receiver + app verified |
| 3 | Clear public staged-launch gate | mock-first | releasable public candidate |
| 4 | Submit extension artifact | public Chrome Web Store flow | packaged extension + reviewer notes |
| 5 | Exercise live rails | operator-controlled only | live Safe/session/archive evidence |
| 6 | Post-release acceptance | final deployed artifact | signed-off production smoke |

## Stage 0: Freeze Release Intent And Inputs

- [ ] Decide which release target applies:
  - internal rehearsal only
  - public mock-first staged launch
  - operator-controlled live-rails rehearsal
- [ ] Use the repo-root `.env.local` only. Do not create package-specific `.env` files.
- [ ] Choose the correct profile overlay:
  - `config/env/profiles/public-release.env`
  - `config/env/profiles/operator-live.env`
  - `config/env/profiles/local-live-sepolia.env`
- [ ] Set `VITE_COOP_RECEIVER_APP_URL` to the exact target receiver origin for the candidate.
- [ ] Set `VITE_COOP_SIGNALING_URLS` to the intended local or production signaling endpoints.
- [ ] Confirm the final production passkey domain is the same domain that will host the production
      PWA.
- [ ] Decide whether the candidate is allowed to claim only mock-first behavior or also live rails.
- [ ] Confirm release notes, reviewer notes, and demo language do not blur mock vs live behavior.

### Public Mock-First Defaults

Keep these values for public staged-launch candidates:

```bash
VITE_COOP_CHAIN=arbitrum
VITE_COOP_FVM_CHAIN=filecoin
VITE_COOP_FVM_REGISTRY_ADDRESS=0x115819bCcaab03Be49107c69c00Bc4c21009839C
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
```

### Operator-Live Defaults

Use these only for controlled operator builds:

```bash
VITE_COOP_CHAIN=arbitrum
VITE_COOP_FVM_CHAIN=filecoin
VITE_COOP_FVM_REGISTRY_ADDRESS=0x115819bCcaab03Be49107c69c00Bc4c21009839C
VITE_COOP_ONCHAIN_MODE=live
VITE_COOP_ARCHIVE_MODE=live
VITE_COOP_SESSION_MODE=live
```

The `public-release` and `operator-live` profile overlays both target Arbitrum for Safe and Green
Goods flows and Filecoin mainnet for registry coordinates. The boundary between them is still the
mode switches plus whether operator-only secrets from `.env.local` are present.

## Stage 1: Change-Level Confidence

Run the smallest suites that honestly cover the surfaces touched by the change before escalating to
release gates.

### Baseline Preflight

- [ ] `bun format && bun lint`
- [ ] `bun run test`
- [ ] `bun run test:coverage`
- [ ] `bun run build`

### Targeted Validation Matrix

Run the relevant slices for the surfaces you changed:

- [ ] Popup capture, screenshot, or review UI:
      `bun run validate:popup-slice`
- [ ] Receiver intake, pairing, or inbox flows:
      `bun run validate:receiver-hardening`
- [ ] Sync runtime, CRDT, or active-coop behavior:
      `bun run validate:sync-hardening`
- [ ] Publish, board, archive, or flow-board behavior:
      `bun run validate:flow-board`
- [ ] Sidepanel settings, routing, or tab state:
      `bun run validate:sidepanel-settings`
- [ ] Background dashboard, alarms, or runtime summary state:
      `bun run validate:background-dashboard`
- [ ] Onchain UI, member account, or Green Goods controls:
      `bun run validate:onchain-ui`
- [ ] Session-capability or permission execution changes:
      `bun run validate:session-executors`
- [ ] Action executor or Green Goods executor changes:
      `bun run validate:action-executors`
- [ ] Full extension workflow confidence:
      `bun run validate:core-loop`

### Optional But Recommended

- [ ] If UI changed materially, run visual regression checks:
      `bun run test:visual`
- [ ] If the candidate is intended for demo rehearsal, run the exact story you plan to narrate with
      two profiles or two people.

## Stage 2: Production Infrastructure Ready

Do this before calling anything a production candidate.

### PWA / Receiver

- [ ] Deploy the app from `packages/app`.
- [ ] Verify the production origin serves:
  - `/`
  - `/pair`
  - `/receiver`
  - `/inbox`
  - `/board/<coop-id>`
  - `/manifest.webmanifest`
  - `/sw.js`
- [ ] Verify `/pair`, `/receiver`, and `/inbox` work on the actual production HTTPS origin.
- [ ] Confirm the receiver bridge origin matches the same exact production receiver origin used in
      the extension build.

### Passkeys And Origin Consistency

- [ ] Confirm production passkeys are created on the final production PWA domain.
- [ ] Confirm the domain used in the demo, reviewer notes, and release instructions matches the
      actual passkey domain.

### Signaling And Peer Flow

- [ ] Confirm the production signaling URL list is final.
- [ ] Confirm pair/join flows work against the intended signaling environment.
- [ ] Confirm local fallback behavior still leaves the receiver usable if signaling is unavailable.

## Stage 3: Public Staged-Launch Candidate

This is the default public production gate. It is mock-first by design.

### Automated Gate

Preferred profile command:

```bash
bun run validate:public-release
```

Full explicit command list:

```bash
bun format && bun lint
bun run test
bun run test:coverage
bun run build
bun run validate:store-readiness
bun run validate:production-readiness
```

- [ ] `bun run validate:public-release`
- [ ] `bun run validate:store-readiness`
- [ ] If running manually instead of the profile wrapper, all explicit commands above are green.

### What Must Be Green

- [ ] Unit, build, extension, receiver, and app-mobile suites pass on the mock path.
- [ ] `store-readiness` passes with the exact production receiver origin.
- [ ] `production-readiness` passes without skipped or ignored failures being treated as success.
- [ ] The candidate does not require live Safe, live archive, or live session capability to tell its
      public story.

### Manual Public-Release Verification

- [ ] Real Chrome popup `Capture Tab` save lands in review.
- [ ] Real Chrome popup `Screenshot` save lands in review.
- [ ] Popup screenshot edit/save and cancel paths work.
- [ ] Popup roundup, file review/save, audio retry, and post-failure recovery still work.
- [ ] Sidepanel create-coop flow works with correct preset-specific copy.
- [ ] A second profile can join and see published state.
- [ ] Chickens review, publish, and board handoff work.
- [ ] Archive flow and receipt export work.
- [ ] Receiver pairing, private intake sync, and inbox flow work.
- [ ] Badge and visible state labels match real coop state.
- [ ] Scheduled capture works for `30-min` and `60-min`.

### Public-Build Safety Assertions

- [ ] No operator-only signing material is present in the public build.
- [ ] Remote knowledge-skill import remains quarantined from the shipped extension.
- [ ] No remote `.js`, `.mjs`, or `.wasm` executable assets are loaded by the packaged build.
- [ ] Built output avoids `eval` and `new Function`.
- [ ] Host permissions match the exact receiver-origin allowlist.
- [ ] Hidden junk files such as `.DS_Store` are absent from `packages/extension/dist/chrome-mv3`.
- [ ] Sensitive local browsing payloads can still be cleared from the UI.

### No-Go For Public Release

Do **not** advance a candidate if any of these are true:

- [ ] `validate:production-readiness` is red.
- [ ] `validate:store-readiness` is red.
- [ ] Real Chrome popup `Capture Tab` or `Screenshot` success fails.
- [ ] The extension is built against the wrong production receiver origin.
- [ ] Public reviewer notes or listing text imply live rails that are not actually enabled.
- [ ] Any operator secret or baked live credential is present in a public build.

## Stage 4: Chrome Web Store Submission

This stage applies after the public staged-launch gate is green.

### Packaging

- [ ] Build the extension from the correct profile.
- [ ] Package from `packages/extension/dist/chrome-mv3` with files at the archive root.
- [ ] Confirm the generated archive is written under `packages/extension/dist/archives/`.
- [ ] Keep `builder-latest` prerelease artifacts separate from versioned stable release artifacts.

### Listing And Reviewer Artifacts

- [ ] Publish the privacy policy at `/privacy-policy`.
- [ ] Update reviewer notes from [Chrome Web Store Reviewer Notes](/reference/chrome-web-store-reviewer-notes).
- [ ] Make sure listing copy explains:
  - Coop is local-first
  - publish is explicit
  - receiver pairing and private intake are deliberate user actions
  - mock vs live rails are described honestly
- [ ] Record the first-run local-AI network trace for reviewer notes.
- [ ] Call out sidepanel entry, passkey flows, receiver pairing, and Smart Session limits clearly.

### Rollout

- [ ] Upload the archive to the Chrome Web Store dashboard.
- [ ] Start as `Unlisted`.
- [ ] Keep reviewer notes unusually explicit because the extension requests broad capabilities:
  - `tabs`
  - `activeTab`
  - `scripting`
  - `sidePanel`
  - `offscreen`
  - exact receiver-origin host permissions

## Stage 5: Operator-Controlled Live Rails

This is a separate second gate. It is never the default public release bar.

### Preconditions

- [ ] The public staged-launch gate is already green.
- [ ] The build is intentionally operator-controlled.
- [ ] The team explicitly intends to exercise live Safe, archive, or session-capability behavior.
- [ ] The candidate is not being described as a normal public Chrome Web Store build.

### Secrets Boundary

Do not ship these values in a public candidate:

- [ ] `VITE_COOP_TRUSTED_NODE_ARCHIVE_*`

Required live env is kept in repo-root `.env.local`, not in profile files.

### Recommended Commands

```bash
bun run build:operator-live
bun run validate:operator-live
```

Equivalent explicit live gate:

```bash
bun run validate:production-live-readiness
```

- [ ] `bun run build:operator-live`
- [ ] `bun run validate:operator-live`
- [ ] If using explicit commands instead, `bun run validate:production-live-readiness` is green.

### Required Live Inputs

- [ ] `VITE_PIMLICO_API_KEY`
- [ ] `VITE_COOP_TRUSTED_NODE_ARCHIVE_AGENT_PRIVATE_KEY`
- [ ] `VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID`
- [ ] `VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER`
- [ ] `VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION`

### Probe Expectations

- [ ] `bun run validate:arbitrum-safe-live`
- [ ] `bun run validate:session-key-live`
- [ ] `bun run validate:archive-live`
- [ ] No skipped probe is treated as proof of live readiness.
- [ ] Safe probe records the successful Safe address and deployment tx hash.
- [ ] Session-key probe records one allowed action success, one disallowed action rejection, and
      revocation behavior.
- [ ] Archive probe records successful live archive evidence.

### Allowed Session-Key Scope

Current allowed live session-capability actions:

- [ ] `green-goods-create-garden`
- [ ] `green-goods-sync-garden-profile`
- [ ] `green-goods-set-garden-domains`
- [ ] `green-goods-create-garden-pools`

### Human-Confirmed Only

These still require deliberate human approval:

- [ ] `safe-deployment`
- [ ] `green-goods-submit-work-approval`
- [ ] `green-goods-create-assessment`
- [ ] `green-goods-sync-gap-admins`
- [ ] treasury movement, approvals, and arbitrary calls

### Optional Filecoin / FVM Registry Checks

If the release also includes Filecoin registry behavior:

- [ ] Deploy the registry contract intentionally and record the deployed address.
- [ ] Set `VITE_COOP_FVM_CHAIN`.
- [ ] Set `VITE_COOP_FVM_REGISTRY_ADDRESS`.
- [ ] Update the deployment map in `packages/shared/src/modules/fvm/fvm.ts`.
- [ ] Confirm no embedded Filecoin or operator private key is present in the shipped bundle.

## Stage 6: Post-Deploy Acceptance

Do this against the exact deployed production artifact, not just a local dev build.

- [ ] Install the exact packaged extension artifact you plan to distribute.
- [ ] Open the production PWA and verify passkey login on the real production domain.
- [ ] Create or join a coop from a clean profile.
- [ ] Pair a receiver and submit one private intake item.
- [ ] Convert intake into a draft, review it, publish it, and open the board.
- [ ] Archive a snapshot and export the latest receipt.
- [ ] If the release includes live rails, verify the intended live mode indicators are visible and
      honest in the UI.
- [ ] Save the exact command outputs, artifact name, version identifier, and reviewer notes used for
      the release.

## Evidence Package To Keep

Before calling a release done, capture:

- [ ] the exact git commit or tag
- [ ] the profile used (`public-release` or `operator-live`)
- [ ] command outputs for the release gates
- [ ] the packaged extension archive name
- [ ] screenshots or notes for the manual popup `Capture Tab` and `Screenshot` checks
- [ ] reviewer notes submitted to the Chrome Web Store
- [ ] any live probe tx hashes or archive receipts, if applicable

## Canonical Commands

Fastest high-signal commands to remember:

```bash
bun run validate:smoke
bun run validate:core-loop
bun run validate:store-readiness
bun run validate:public-release
bun run validate:operator-live
bun run release:extension:public-release
```

## Claim Boundary

Safe to claim after Stage 3:

- browser-first capture, review, and local AI refinement
- receiver pairing and private intake sync
- local-first sync using Yjs with peer and websocket support
- Chrome Web Store readiness for a mock-first public candidate

Not safe to blur together:

- public staged-launch readiness and operator live-rails readiness
- mock archive/onchain/session rehearsals and live production credentials
- Safe smart-account support and mature multi-owner threshold operations unless that behavior has
  been deliberately validated for the candidate
