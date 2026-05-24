---
feature: agent-control-plane
title: Agent Control Plane contracts lane
lane: contracts
agent: codex
status: n/a
source_branch: feature/agent-control-plane
work_branch: codex/contracts/agent-control-plane
depends_on:
  - ../spec.md
skills:
  - contracts
  - onchain
  - permissions
updated: 2026-05-21
---

# Contracts Lane — Not Active

## Objective

No contracts lane is active for the backlog save. Existing session, permit, and scoped spending
work remains owned by `session-key-phase-2` and `agent-evolution`.
If this lane is promoted later, first confirm that the work does not already belong in those hubs.

## Files

- None for this save.

## Tasks

- [ ] Keep contracts status `n/a` until this hub is promoted and a concrete onchain/session
      contract boundary is assigned here.

## Verification

- [ ] `bun run plans validate` confirms this lane is aligned with `status.json`.

## Handoff Notes

If this becomes active later, first decide whether the work truly belongs here or should remain in
`session-key-phase-2` / `agent-evolution`.
