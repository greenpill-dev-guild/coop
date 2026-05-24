---
feature: modern-css-web-ui-primitives
title: Modern CSS Web UI Primitives state lane
lane: state
agent: codex
status: backlog
source_branch: main
work_branch: codex/state/modern-css-web-ui-primitives
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/styles/tokens.css
  - scripts/validate.ts
  - scripts/plans.ts
done_when:
  - modern CSS/Web UI validation or token-guardrail evidence is recorded in eval/implementation-notes.md
skills:
  - state-logic
  - shared
  - testing
updated: 2026-05-24
---

# State Lane

## Objective

Own non-visual support for the CSS modernization pack: shared token guardrail decisions, validation wiring, and plan-status consistency. Do not introduce runtime state, API, storage, or message-contract changes unless a later scope decision explicitly requires them.

## Files

- `packages/shared/src/styles/tokens.css`
- `scripts/validate.ts`
- `scripts/plans.ts`

## Tasks

- [ ] Review whether existing validation catches hardcoded CSS/token drift well enough for this pack.
- [ ] Propose the smallest guardrail improvement only if the UI lane finds repeatable drift.
- [ ] Keep API, storage, background runtime, and message-contract code out of scope.
- [ ] Record validation proof and proof limits in `eval/implementation-notes.md`.

## Verification

- [ ] `bun run plans validate`
- [ ] Targeted validation for any future script or token-check change.

## Handoff Notes

QA should verify that any future guardrail is cheap, scoped, and does not block intentional local art direction or generated fixtures.
