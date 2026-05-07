---
feature: next-step-review
title: Next-Step Review contracts lane
lane: contracts
agent: codex
status: n/a
source_branch: feature/next-step-review
work_branch: codex/contracts/next-step-review
depends_on:
  - ../spec.md
owned_paths: []
done_when:
  - no onchain contract work for next-step-review
skills:
  - contracts
  - onchain
  - permissions
updated: 2026-05-06
---

# Contracts Lane

## Objective

No onchain, permit, session, or policy contract work is planned for this feature.

## Rationale

Next-Step Review is local-only feedback for review salience. Feedback is not synced, published,
archived, signed, permitted, or submitted onchain.

## Tasks

- [x] Confirm no onchain contract, permit, policy, session, or API-server changes are required.

## Verification

- [x] Covered by scoped state/runtime/UI tests instead of contract probes.

## Handoff Notes

- If a later release wants feedback to influence agent reputation, that must be a separate plan with
  explicit privacy, permission, and onchain review.
