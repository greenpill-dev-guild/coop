---
feature: agent-control-plane
title: Agent Control Plane API lane
lane: api
agent: codex
status: n/a
source_branch: feature/agent-control-plane
work_branch: codex/api/agent-control-plane
depends_on:
  - ../spec.md
skills:
  - api
  - hono
  - contracts
updated: 2026-05-21
---

# API Lane — Not Active

## Objective

No API lane is active for the backlog save. Coop's agent control-plane gaps are first captured as
state/runtime primitives and advanced/operator UI surfaces. Add an API lane only if a future
activation needs server-side observability, remote cancellation, or hosted runtime coordination.
If this lane is promoted later, it must preserve the metadata-first privacy posture from `spec.md`.

## Files

- None for this save.

## Tasks

- [ ] Keep API status `n/a` until the feature is promoted and a concrete server boundary exists.

## Verification

- [ ] `bun run plans validate` confirms this lane is aligned with `status.json`.

## Handoff Notes

If this becomes active later, call out public contracts, auth/session/policy boundaries, and any
hosted-runtime assumptions before implementation starts.
