---
feature: <feature-slug>
title: <Feature Title> contracts lane
lane: contracts
agent: codex
status: backlog
source_branch: <source-branch>
work_branch: codex/contracts/<feature-slug>
depends_on:
  - ../spec.md
owned_paths:
  - packages/shared/src/modules/<replace-me>
done_when:
  - replace-with-concrete-symbol-or-file-evidence
skills:
  - contracts
  - onchain
  - permissions
updated: <YYYY-MM-DD>
---

# Contracts Lane

## Objective

Describe the onchain, permit, schema, or typed-intent work Codex should own.

`done_when` should use concrete, searchable evidence strings that will exist under `owned_paths`
when the lane is truly complete.
Keep changes inside `owned_paths` where possible. If work spills beyond them, explain why in
`Handoff Notes`.

## Files

- `packages/shared/src/modules/onchain/...`
- `packages/shared/src/modules/policy/...`
- `packages/shared/src/modules/session/...`

## Tasks

- [ ] Update schemas and typed contracts first
- [ ] Implement contract-facing logic
- [ ] Add or update targeted tests
- [ ] Keep work inside `owned_paths` or document justified spillover
- [ ] Document any live-probe follow-up

## Verification

- [ ] Appropriate validation tier was run
- [ ] Contract or schema behavior is covered

## Handoff Notes

State any replay, permission, or chain-mode risks for QA.
List any human judgment callouts: dependencies, migrations/persisted state, auth/session/policy,
public contracts, runtime/toolchain boundaries, or ownership blur.
