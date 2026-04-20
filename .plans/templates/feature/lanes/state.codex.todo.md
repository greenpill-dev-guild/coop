---
feature: <feature-slug>
title: <Feature Title> state lane
lane: state
agent: codex
status: backlog
source_branch: <source-branch>
work_branch: codex/state/<feature-slug>
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/modules/<replace-me>
done_when:
  - replace-with-concrete-symbol-or-file-evidence
skills:
  - state-logic
  - shared
  - storage
updated: <YYYY-MM-DD>
---

# State Lane

## Objective

Describe the shared state, runtime, storage, and orchestration changes Codex should own.

`done_when` should use concrete, searchable evidence strings that will exist under `owned_paths`
when the lane is truly complete.
Keep changes inside `owned_paths` where possible. If work spills beyond them, explain why in
`Handoff Notes`.

## Files

- `packages/shared/...`
- `packages/extension/src/runtime/...`
- `packages/extension/src/background/...`

## Tasks

- [ ] Update schemas/types first
- [ ] Implement state transitions and persistence behavior
- [ ] Add or update unit/integration coverage
- [ ] Keep work inside `owned_paths` or document justified spillover
- [ ] Note any message-contract changes

## Verification

- [ ] Appropriate validation tier was run
- [ ] Changed state paths are covered by tests

## Handoff Notes

Risks or edge cases QA should target.
List any human judgment callouts: dependencies, migrations/persisted state, auth/session/policy,
public contracts, runtime/toolchain boundaries, or ownership blur.
