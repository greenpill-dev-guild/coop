---
feature: agentic-flow-hardening
title: Agentic Flow Hardening state lane
lane: state
agent: codex
status: done
source_branch: feature/agentic-flow-hardening
work_branch: codex/state/agentic-flow-hardening
depends_on:
  - ../spec.md
owned_paths:
  - .plans/templates/feature
  - .plans/templates/status.json
  - .plans/features/agentic-flow-hardening
  - .plans/features/landing-closing-polish
  - .plans/how-can-we-improve-cuddly-kahan.md
  - scripts/check-agentic-flow.ts
  - scripts/__tests__/check-agentic-flow.test.ts
  - package.json
done_when:
  - Agent Readiness
  - check:agentic-flow
  - collectAgenticFlowImportFindings
skills:
  - state-logic
  - shared
  - storage
updated: 2026-05-26
---

# State Lane

## Objective

Implement the Planning OS and advisory-check parts of the hardening pass.

`done_when` should use concrete, searchable evidence strings that will exist under `owned_paths`
when the lane is truly complete.
Keep changes inside `owned_paths` where possible. If work spills beyond them, explain why in
`Handoff Notes`.

## Files

- `packages/shared/...`
- `packages/extension/src/runtime/...`
- `packages/extension/src/background/...`

## Tasks

- [x] Add `Agent Readiness` to the feature template.
- [x] Add a scaffolded docs lane template.
- [x] Keep API/contracts/docs default template statuses aligned with `status.json`.
- [x] Add `check:agentic-flow` and include it in `agentic:check`.
- [x] Verify the advisory scanner catches multiline imports and package-level tests outside `src`.
- [x] Preserve the flat landing polish note as a canonical feature pack.
- [x] Keep work inside `owned_paths` or document justified spillover.
- [x] Note any message-contract changes.

## Verification

- [x] `vitest run scripts/__tests__/plans.test.ts scripts/__tests__/check-agentic-flow.test.ts`
- [x] `bun run plans:validate`
- [x] `bun run plans:legacy`

## Handoff Notes

Human judgment callouts: advisory script added; package script changed; flat plan migrated. Review hardening replaced regex-only import extraction with TypeScript AST parsing and broadened package scan coverage. No dependencies, persisted-state changes, auth/session/policy changes, or blocking CI gates.
