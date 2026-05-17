---
title: "Current Release Status"
slug: /reference/current-release-status
audience: builder
doc_type: runbook
status: current
validation_snapshot: "2026-04-19"
docs_reviewed: "2026-05-16"
---

# Coop Current Release Status

<DocMeta />

Docs review date: May 16, 2026

This is the canonical current-state release posture for Coop. Keep `README.md`,
[Production Release Checklist](/reference/production-release-checklist), [Testing & Validation](/reference/testing-and-validation),
[Demo & Deploy Runbook](/reference/demo-and-deploy-runbook), and Chrome Web Store docs aligned to
this page.

## Current Status

The last recorded release validation snapshot is from April 19, 2026:

- the automated mock-first staged-launch bar was green on that snapshot
- Coop is documentable and demoable in a mock-first posture with the automated release gate aligned
  to the shipped surfaces
- the remaining staged-launch gate before a public Chrome Web Store release is manual real-Chrome
  confirmation of popup `Capture Tab` and `Screenshot` success paths
- live Safe, Green Goods, archive, session-capability, and Filecoin registry rails remain a
  separate second gate

## Automated Staged-Launch Bar

These commands still define the staged-launch bar for a public mock-first release candidate:

```bash
bun run test
bun run test:coverage
bun run build
bun run validate:store-readiness
bun run validate:production-readiness
```

What that snapshot means:

- the bar was green on the validated run from April 19, 2026
- the broadened release-critical coverage run cleared the `85/70/85/85` thresholds at
  `86.56/78.02/87.19/86.56` (statements / branches / functions / lines)
- `validate:store-readiness` and `validate:production-readiness` were green for that snapshot
- rerun the staged-launch bar on the current tree before treating this page as release signoff
- manual Chrome checks still matter, but they are now the remaining staged-launch gate rather than
  a follow-up after a red automated bar

## Remaining Public-Release Gate

Before a public Chrome Web Store release, manual QA in real Chrome is still required for popup
`Capture Tab` and `Screenshot` success paths after the automated staged-launch bar has been rerun
and is green on the current tree.

Reason:

- Playwright can exercise the popup failure and gating paths
- Playwright cannot reliably reproduce the popup `activeTab` grant needed for those real success
  saves

Manual gate:

- click `Capture Tab` in the popup and confirm the saved result lands in review
- click `Screenshot` in the popup and confirm the saved result lands in review

## Current Public-Release Boundary

Public staged-launch candidates are still mock-first.

Keep these modes on the staged-launch path unless you are intentionally running the operator-only
live gate:

```bash
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
```

The current public-release boundary also requires:

- `VITE_COOP_RECEIVER_APP_URL` set to the exact production HTTPS receiver origin for store
  validation and packaged `host_permissions`
- remote knowledge-skill import remaining quarantined from the shipped build
- operator-only signing material staying out of public Chrome Web Store builds

## Second Gate: Live Rails

Live rails are not part of the default public staged-launch bar.

Use the live gate only when:

- the staged-launch bar is already green again
- the build is intentionally operator-controlled
- live Safe, archive, or session-capability behavior is being exercised on purpose

Composite live gate:

```bash
bun run validate:production-live-readiness
```

That gate layers these probes on top of `production-readiness`:

- `bun run validate:arbitrum-safe-live`
- `bun run validate:session-key-live`
- `bun run validate:greengoods-live`
- `bun run validate:archive-live`
- `bun run validate:fvm-registry-live`

Read [Live Rails Operator Runbook](/reference/live-rails-operator-runbook) before enabling those
env vars in any release candidate.

## What Coop Safely Claims Today

Safe to claim:

- browser-first capture, review, and local AI refinement are implemented, with local model execution
  depending on the relevant model assets and runtime capability being available
- receiver pairing and private intake sync are implemented
- local-first sync uses Yjs with y-webrtc peers and y-websocket support
- Chrome Web Store packaging and review docs are in place for a mock-first public candidate; the
  automated staged-launch bar must be rerun on the current tree before release signoff

Not safe to blur together:

- staged-launch readiness and live-rails readiness
- public Chrome Web Store builds and operator-controlled builds
- mock archive/onchain/session rehearsals and live production credentials

## Canonical Next Docs

- [Testing & Validation](/reference/testing-and-validation)
- [Production Release Checklist](/reference/production-release-checklist)
- [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook)
- [Extension Install & Distribution](/reference/extension-install-and-distribution)
- [Receiver Pairing & Intake](/reference/receiver-pairing-and-intake)
- [Live Rails Operator Runbook](/reference/live-rails-operator-runbook)
- [Chrome Web Store Checklist](/reference/chrome-web-store-checklist)
