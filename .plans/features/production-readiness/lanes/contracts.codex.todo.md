---
feature: production-readiness
title: Production readiness release-contract lane
lane: contracts
agent: codex
status: done
source_branch: main
work_branch: codex/contracts/production-readiness
depends_on:
  - ../spec.md
owned_paths:
  - docs/reference/current-release-status.md
  - docs/reference/testing-and-validation.md
  - docs/reference/demo-and-deploy-runbook.md
  - docs/reference/chrome-web-store-checklist.md
done_when:
  - the automated mock-first staged-launch bar is blocked
  - live rails remain a separate second gate
skills:
  - architecture
  - testing
updated: 2026-03-27
---

# Contracts Lane

- Separate staged-launch requirements from live-rails activation in the release docs.
- Document the live-rails env matrix explicitly:
  - `VITE_COOP_SESSION_MODE=live`
  - `VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID`
  - `VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER`
  - `VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION`
  - any operator-only credentials that must stay out of public builds
- Treat `bun run validate:production-live-readiness` as a deferred promotion gate, not part of the
  staged launch sign-off.
