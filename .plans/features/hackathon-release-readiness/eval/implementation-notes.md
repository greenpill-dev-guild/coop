# Implementation Notes For Hackathon Release Readiness

## What Changed

- Filecoin registry registration no longer invents a mock success path when live onchain mode or
  live registry material is missing.
- Live Filecoin registration is now limited to live archive receipts produced from an
  operator-controlled live build.
- The archive live probe now requires real trusted-node archive env by default; the old fallback is
  available only through the explicit `COOP_ALLOW_ARCHIVE_PROBE_FALLBACK=true` wiring-check escape
  hatch.
- Operator docs now include an explicit registry deployment and live-rails checklist.

## Why It Changed

- The previous contract blurred operator-only live rails and mock-first staged-launch behavior by
  treating missing Filecoin registry config as a successful mock registration.
- `validate:archive-live` could also pass on a fallback delegation, which made the live gate look
  greener than it really was.

## Follow-Ups

- Populate `packages/shared/src/modules/fvm/fvm.ts` with the canonical live registry deployment
  only after the deployment is actually finalized and verified.
- Keep Filecoin registry registration gated in QA until the operator checklist is completed end to
  end.
