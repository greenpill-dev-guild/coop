---
title: "Current Release Status"
slug: /reference/current-release-status
---

# Coop Current Release Status

Date: April 9, 2026

This is the canonical current-state release posture for Coop. Keep `README.md`,
[Production Release Checklist](/reference/production-release-checklist), [Testing & Validation](/reference/testing-and-validation),
[Demo & Deploy Runbook](/reference/demo-and-deploy-runbook), and Chrome Web Store docs aligned to
this page.

## Current Status

As of April 9, 2026:

- the automated mock-first staged-launch bar is blocked
- Coop is still documentable and demoable in a mock-first posture, but the automated release gate
  is not yet honest enough to call green
- the immediate staged-launch blocker is the broadened release-critical coverage gate and the
  broader `validate:production-readiness` suite staying red
- manual real-Chrome confirmation of popup `Capture Tab` and `Screenshot` success paths remains
  required after the automated bar is green again
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

What the current result means:

- the bar is currently red because the broadened release-critical coverage run remains below the
  `85/85/85/70` threshold captured in
  `.plans/features/production-readiness/eval/qa-report.md`
- the biggest measured gaps remain in release-critical app hooks and sidepanel codepaths
- `validate:store-readiness` and the manual Chrome checks still matter, but they do not override a
  red `production-readiness` gate

## Remaining Public-Release Blocker

The staged-launch blocker before a public Chrome Web Store release is still the automated
`production-readiness` bar.

Even after that bar is green again, manual QA in real Chrome is still required for popup `Capture
Tab` and `Screenshot` success paths.

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

- browser-first capture, review, and local AI refinement are implemented
- receiver pairing and private intake sync are implemented
- local-first sync uses Yjs with y-webrtc peers and y-websocket support
- Chrome Web Store packaging and review docs are in place for a mock-first staged launch

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
