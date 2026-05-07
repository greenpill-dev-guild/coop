---
feature: ux-surface-clarity
title: UX Surface Clarity contracts lane
lane: contracts
agent: codex
status: n/a
source_branch: feature/ux-surface-clarity
work_branch: codex/contracts/ux-surface-clarity
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/modules/onchain
  - packages/shared/src/modules/policy
  - packages/shared/src/modules/session
done_when:
  - no-contract-work-planned
skills:
  - contracts
  - onchain
  - permissions
updated: 2026-05-05
---

# Contracts Lane

## Objective

No onchain, permit, policy, session, or typed-intent work is planned for this feature. Advanced
rails should be hidden by UI mode only, not changed behaviorally.

## Files

- None.

## Tasks

- [ ] Do not change onchain/session/permit/policy behavior for this feature.
- [ ] If contract work becomes necessary, stop and update `status.json`, this lane, and handoff
  notes before implementation.

## Verification

- [ ] Not applicable.

## Handoff Notes

- Not applicable. QA should confirm advanced UI hiding does not change underlying execution rails.
