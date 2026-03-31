---
title: "Current Release Status"
slug: /reference/current-release-status
---

# Coop Current Release Status

Date: March 28, 2026

This is the canonical current-state release posture for Coop. Keep `README.md`,
[Testing & Validation](/reference/testing-and-validation), [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook),
and Chrome Web Store docs aligned to this page.

## Current Status

As of March 28, 2026:

- the automated mock-first staged-launch bar is green
- Coop is documentable and demoable in its current mock-first posture
- the remaining public-release blocker is manual real-Chrome confirmation of popup `Capture Tab`
  and `Screenshot` success paths
- live Safe, archive, and session-capability rails remain a separate second gate

## Automated Staged-Launch Bar

These commands define the current automated green bar for a public mock-first release candidate:

```bash
bun run test
bun run test:coverage
bun build
bun run validate:store-readiness
bun run validate:production-readiness
```

What this means:

- unit, build, extension, receiver, and mobile app suites are green on the mock path
- Chrome Web Store packaging checks are green
- receiver-origin and packaged extension audit checks are green when `VITE_COOP_RECEIVER_APP_URL`
  points at the exact production HTTPS receiver origin

## Remaining Public-Release Blocker

The remaining blocker before a public Chrome Web Store release is manual QA in real Chrome for
popup `Capture Tab` and `Screenshot` success paths.

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

- the staged-launch bar is already green
- the build is intentionally operator-controlled
- live Safe, archive, or session-capability behavior is being exercised on purpose

Composite live gate:

```bash
bun run validate:production-live-readiness
```

That gate layers these probes on top of `production-readiness`:

- `bun run validate:arbitrum-safe-live`
- `bun run validate:session-key-live`
- `bun run validate:archive-live`

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
- [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook)
- [Extension Install & Distribution](/reference/extension-install-and-distribution)
- [Receiver Pairing & Intake](/reference/receiver-pairing-and-intake)
- [Live Rails Operator Runbook](/reference/live-rails-operator-runbook)
- [Chrome Web Store Checklist](/reference/chrome-web-store-checklist)
